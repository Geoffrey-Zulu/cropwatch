#!/usr/bin/env bash
# Provisions the knowledge layer: RAG Engine (RagManagedDb) in europe-west1, the corpus, and the
# Cloud Storage bucket its documents are imported from. Idempotent. Then load the documents:
#
#   bash infra/rag.sh
#   pnpm --filter @repo/corpus ingest
#
# RagManagedDb runs on a Spanner instance billed while it exists (Basic tier, about US$2-3 a
# day). After the hackathon, remove it with: bash infra/rag-teardown.sh
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

KNOWLEDGE_BUCKET="${PROJECT_ID}-knowledge"
CORPUS_NAME="cropwatch-knowledge"
EMBEDDING_MODEL="text-embedding-005"
AIP="https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}"

# Polls a long-running operation until it is done; prints its response, or fails with its error.
wait_operation() {
  local op="$1" body
  for _ in $(seq 1 60); do
    body="$(api "https://${REGION}-aiplatform.googleapis.com/v1/${op}")"
    if [[ "$(json 'j.done' <<<"$body")" == "true" ]]; then
      [[ -z "$(json 'j.error && j.error.message' <<<"$body")" ]] ||
        die "operation failed: $(json 'j.error.message' <<<"$body")"
      printf '%s' "$body"
      return 0
    fi
    sleep 5
  done
  die "operation ${op} still running after 5 minutes"
}

find_corpus() {
  api "${AIP}/ragCorpora" | json "(j.ragCorpora || []).filter(c => c.displayName === arg).map(c => c.name)[0]" "$CORPUS_NAME"
}

# -----------------------------------------------------------------------------
step "Preflight"
require_gcloud_account
RAG_AGENT="service-${PROJECT_NUMBER}@gcp-sa-vertex-rag.iam.gserviceaccount.com"
ok "project ${PROJECT_ID} (${PROJECT_NUMBER}), region ${REGION}"

# -----------------------------------------------------------------------------
step "Knowledge bucket gs://${KNOWLEDGE_BUCKET} (${REGION})"
if gcloud storage buckets describe "gs://${KNOWLEDGE_BUCKET}" --format=none 2>/dev/null; then
  ok "exists"
else
  gcloud storage buckets create "gs://${KNOWLEDGE_BUCKET}" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention --format=none
  ok "created"
fi
# The API reads index.json (document metadata and the corpus name) at startup.
retry gcloud storage buckets add-iam-policy-binding "gs://${KNOWLEDGE_BUCKET}" \
  --member="serviceAccount:${RUN_SA}" --role=roles/storage.objectViewer --format=none
ok "${RUN_SA} can read it"

# -----------------------------------------------------------------------------
step "RAG Engine: RagManagedDb, Basic tier (${REGION})"
config="$(api "${AIP}/ragEngineConfig")"
tier="$(json 'Object.keys(j.ragManagedDbConfig || {})[0]' <<<"$config")"
if [[ "$tier" == "basic" ]]; then
  ok "already Basic"
else
  op="$(api -X PATCH "${AIP}/ragEngineConfig" \
    -d "{\"name\":\"projects/${PROJECT_ID}/locations/${REGION}/ragEngineConfig\",\"ragManagedDbConfig\":{\"basic\":{}}}" |
    json 'j.name')"
  [[ -n "$op" ]] || die "could not set the RAG Engine tier (was: ${tier:-none})"
  wait_operation "$op" >/dev/null
  ok "set to Basic (was: ${tier:-none})"
fi

# -----------------------------------------------------------------------------
step "Corpus ${CORPUS_NAME} (embeddings: ${EMBEDDING_MODEL})"
corpus="$(find_corpus)"
if [[ -n "$corpus" ]]; then
  ok "exists: ${corpus}"
else
  response="$(api -X POST "${AIP}/ragCorpora" -d "{
    \"displayName\": \"${CORPUS_NAME}\",
    \"description\": \"CropWatch crop-protection corpus (tools/corpus/manifest.json)\",
    \"vectorDbConfig\": {
      \"ragManagedDb\": {},
      \"ragEmbeddingModelConfig\": {
        \"vertexPredictionEndpoint\": {
          \"endpoint\": \"projects/${PROJECT_ID}/locations/${REGION}/publishers/google/models/${EMBEDDING_MODEL}\"
        }
      }
    }
  }")"
  op="$(json 'j.name' <<<"$response")"
  [[ -n "$op" ]] || die "corpus creation refused in ${REGION}: $(json 'j.error && j.error.message' <<<"$response")"
  wait_operation "$op" >/dev/null
  corpus="$(find_corpus)"
  [[ -n "$corpus" ]] || die "corpus created but not listed yet; re-run in a minute"
  ok "created: ${corpus}"
fi

# -----------------------------------------------------------------------------
step "RAG service agent can import from gs://${KNOWLEDGE_BUCKET}"
# The agent exists once the project has used RAG Engine (the corpus above guarantees that).
RETRIES=12 retry gcloud storage buckets add-iam-policy-binding "gs://${KNOWLEDGE_BUCKET}" \
  --member="serviceAccount:${RAG_AGENT}" --role=roles/storage.objectViewer --format=none
ok "${RAG_AGENT}"

cat <<EOF

Knowledge layer ready:
  Corpus   ${corpus}
  Bucket   gs://${KNOWLEDGE_BUCKET}
Next: pnpm --filter @repo/corpus ingest
EOF

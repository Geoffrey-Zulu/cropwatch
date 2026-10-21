#!/usr/bin/env bash
# Removes the billed part of the knowledge layer after the hackathon: deletes the corpus and
# sets RAG Engine to the Unprovisioned tier, which deletes the RagManagedDb Spanner instance.
# The documents stay in gs://crop-watch01-knowledge (cents a month) unless --delete-bucket is
# given. Re-provision any time with infra/rag.sh and re-ingest.
#
#   bash infra/rag-teardown.sh [--delete-bucket]
#
# /recommend cannot cite anything once this has run: new observations stop at
# awaiting_expert_review (officer referral).
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

KNOWLEDGE_BUCKET="${PROJECT_ID}-knowledge"
CORPUS_NAME="cropwatch-knowledge"
AIP="https://${REGION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}"

step "Preflight"
require_gcloud_account

step "Delete corpus ${CORPUS_NAME}"
corpora="$(api "${AIP}/ragCorpora" | json "(j.ragCorpora || []).filter(c => c.displayName === arg).map(c => c.name).join(' ')" "$CORPUS_NAME")"
if [[ -z "$corpora" ]]; then
  ok "none"
else
  for corpus in $corpora; do
    api -X DELETE "https://${REGION}-aiplatform.googleapis.com/v1/${corpus}?force=true" >/dev/null
    ok "deleted ${corpus}"
  done
fi

step "RAG Engine tier → Unprovisioned (deletes the Spanner instance)"
op="$(api -X PATCH "${AIP}/ragEngineConfig" \
  -d "{\"name\":\"projects/${PROJECT_ID}/locations/${REGION}/ragEngineConfig\",\"ragManagedDbConfig\":{\"unprovisioned\":{}}}" |
  json 'j.name')"
[[ -n "$op" ]] || die "could not change the RAG Engine tier"
ok "requested (${op}); takes a few minutes"

if [[ "${1:-}" == "--delete-bucket" ]]; then
  step "Delete gs://${KNOWLEDGE_BUCKET}"
  gcloud storage rm --recursive "gs://${KNOWLEDGE_BUCKET}" --quiet || warn "bucket already gone"
  ok "deleted"
fi

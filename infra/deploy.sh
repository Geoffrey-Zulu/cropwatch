#!/usr/bin/env bash
# Builds and deploys the CropWatch API (apps/functions) to Cloud Run and wires Eventarc on
# Storage finalize, then deploys the security rules and the capture PWA (apps/capture) to its
# own Firebase Hosting site. Idempotent: re-run to ship a new revision. Run infra/setup.sh first.
#
#   bash infra/deploy.sh
#
# MIN_INSTANCES=1 bash infra/deploy.sh keeps one warm instance (demo days; ~US$2/day).
# The PWA's web-push (VAPID) public key lives in apps/capture/src/lib/firebaseConfig.ts.
# Account and project pinning, and the helpers, live in infra/lib.sh.
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

SERVICE="cropwatch-api"
AR_REPO="cropwatch"
BUILD_SA_NAME="cropwatch-build"
BUILD_SA="${BUILD_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
# Source staging in-region; gcloud's default staging bucket is US multi-region.
STAGING_BUCKET="${PROJECT_ID}-cloudbuild"
TRIGGER="cropwatch-photo-finalized"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.5-flash-lite}"
# Gemini is not served regionally in europe-west1 any more; the EU multi-region keeps processing
# in the EU (apps/functions/src/env.ts).
GEMINI_LOCATION="${GEMINI_LOCATION:-eu}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
CAPTURE_SITE="${PROJECT_ID}-capture"
BQ_DATASET="cropwatch"
ALERTS_TOPIC="cropwatch.alerts"
ALERTS_SUB="cropwatch-alerts-dispatch"
# Africa's Talking (SMS alerts). The username and API key live in Secret Manager; until both
# secrets exist the API logs what it would have sent. Username "sandbox" uses the AT sandbox.
#   printf '%s' "<username>" | gcloud secrets create africastalking-username --data-file=- \
#     --replication-policy=user-managed --locations=europe-west1
#   printf '%s' "<api key>" | gcloud secrets create africastalking-api-key --data-file=- \
#     --replication-policy=user-managed --locations=europe-west1
# A new key: gcloud secrets versions add africastalking-api-key --data-file=-, then re-deploy.
# AT_SENDER_ID (optional): an approved alphanumeric sender ID; empty uses AT's default sender.
AT_SENDER_ID="${AT_SENDER_ID:-}"
# Browser origins: the dashboard and the capture PWA (Firebase Hosting), plus local Vite for each.
CORS_ORIGINS="https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com,https://${CAPTURE_SITE}.web.app,https://${CAPTURE_SITE}.firebaseapp.com,http://localhost:5173,http://localhost:5174"

# -----------------------------------------------------------------------------
step "Preflight"
require_gcloud_account git
TAG="$(git rev-parse --short HEAD)"
[[ -z "$(git status --porcelain)" ]] || TAG="${TAG}-dirty-$(date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:${TAG}"
# Deterministic Cloud Run URL: https://SERVICE-PROJECT_NUMBER.REGION.run.app
URL="https://${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
ok "image ${IMAGE}"
SECRETS_FLAG=()
if gcloud secrets describe africastalking-username --format=none 2>/dev/null &&
  gcloud secrets describe africastalking-api-key --format=none 2>/dev/null; then
  SECRETS_FLAG=(--set-secrets="AT_USERNAME=africastalking-username:latest,AT_API_KEY=africastalking-api-key:latest")
  ok "SMS: Africa's Talking secrets found"
else
  ok "SMS: no Africa's Talking secrets yet; alerts will log SMS instead of sending"
fi

# -----------------------------------------------------------------------------
step "Artifact Registry repository ${AR_REPO} (${REGION})"
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --format=none 2>/dev/null; then
  ok "exists"
else
  gcloud artifacts repositories create "$AR_REPO" --location="$REGION" \
    --repository-format=docker --description="CropWatch images" --format=none
  ok "created"
fi

step "Cloud Build: service account ${BUILD_SA} and staging bucket gs://${STAGING_BUCKET}"
if gcloud iam service-accounts describe "$BUILD_SA" --format=none 2>/dev/null; then
  ok "service account exists"
else
  gcloud iam service-accounts create "$BUILD_SA_NAME" \
    --display-name="CropWatch image builds" --format=none
  ok "service account created"
fi
if gcloud storage buckets describe "gs://${STAGING_BUCKET}" --format=none 2>/dev/null; then
  ok "staging bucket exists"
else
  gcloud storage buckets create "gs://${STAGING_BUCKET}" --location="$REGION" \
    --uniform-bucket-level-access --format=none
  ok "staging bucket created"
fi
grant_project_role "serviceAccount:${BUILD_SA}" roles/logging.logWriter
retry gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" --location="$REGION" \
  --member="serviceAccount:${BUILD_SA}" --role=roles/artifactregistry.writer --format=none
retry gcloud storage buckets add-iam-policy-binding "gs://${STAGING_BUCKET}" \
  --member="serviceAccount:${BUILD_SA}" --role=roles/storage.objectViewer --format=none
ok "roles granted"

# -----------------------------------------------------------------------------
step "Build ${IMAGE} (Cloud Build, ${REGION})"
gcloud builds submit . \
  --config=infra/cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE}" \
  --region="$REGION" \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_SA}" \
  --gcs-source-staging-dir="gs://${STAGING_BUCKET}/source" \
  --suppress-logs --format=none ||
  die "build failed; see Cloud Build history in the console (region ${REGION})"
ok "built"

# -----------------------------------------------------------------------------
step "Cloud Run service ${SERVICE}"
# Public ingress: the mobile app authenticates with Firebase ID tokens, which the service
# checks itself. CPU stays allocated after a response, because diagnosis runs in the background
# once POST /observations has replied.
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="$RUN_SA" \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --cpu-boost \
  --cpu=1 --memory=1Gi \
  --concurrency=40 --timeout=120 \
  --min-instances="$MIN_INSTANCES" --max-instances=3 \
  --set-env-vars="^;^GOOGLE_CLOUD_PROJECT=${PROJECT_ID};GOOGLE_CLOUD_LOCATION=${REGION};GOOGLE_GENAI_USE_VERTEXAI=true;GEMINI_MODEL=${GEMINI_MODEL};GEMINI_LOCATION=${GEMINI_LOCATION};STORAGE_BUCKET=${BUCKET};KNOWLEDGE_INDEX_URI=gs://${PROJECT_ID}-knowledge/index.json;EVENTARC_SERVICE_ACCOUNT=${RUN_SA};CORS_ORIGINS=${CORS_ORIGINS};BQ_DATASET=${BQ_DATASET};ALERTS_TOPIC=${ALERTS_TOPIC};AT_SENDER_ID=${AT_SENDER_ID}" \
  "${SECRETS_FLAG[@]}" \
  --format=none
ok "deployed ${URL}"

# -----------------------------------------------------------------------------
step "Eventarc: ${TRIGGER} (Storage finalize on gs://${BUCKET} → ${SERVICE})"
retry gcloud run services add-iam-policy-binding "$SERVICE" --region="$REGION" \
  --member="serviceAccount:${RUN_SA}" --role=roles/run.invoker --format=none
if gcloud eventarc triggers describe "$TRIGGER" --location="$REGION" --format=none 2>/dev/null; then
  ok "trigger exists"
else
  # Git Bash rewrites "/internal/..." into a Windows path when gcloud hands its arguments to
  # python.exe; exempt just this flag (MSYS_NO_PATHCONV would also break gcloud's own
  # wrapper). No effect outside Git Bash.
  MSYS2_ARG_CONV_EXCL='--destination-run-path=' RETRIES=12 retry gcloud eventarc triggers create "$TRIGGER" \
    --location="$REGION" \
    --destination-run-service="$SERVICE" \
    --destination-run-region="$REGION" \
    --destination-run-path=/internal/events/storage \
    --event-filters="type=google.cloud.storage.object.v1.finalized" \
    --event-filters="bucket=${BUCKET}" \
    --service-account="$RUN_SA" \
    --format=none
  ok "trigger created (takes up to 2 minutes to start delivering)"
fi

# -----------------------------------------------------------------------------
step "Pub/Sub: ${ALERTS_SUB} (${ALERTS_TOPIC} → ${SERVICE} /internal/events/alerts)"
# Alert dispatch (push + SMS) runs off a push subscription, so a slow SMS gateway never holds
# up the report that raised the alert, and a failed delivery is retried. The service checks the
# OIDC token (same account as Eventarc); dispatch is idempotent, so a retry never re-sends.
PUSH_FLAGS=(
  --push-endpoint="${URL}/internal/events/alerts"
  --push-auth-service-account="$RUN_SA"
  --push-auth-token-audience="$URL"
  --ack-deadline=60
  --min-retry-delay=10s --max-retry-delay=300s
)
if gcloud pubsub subscriptions describe "$ALERTS_SUB" --format=none 2>/dev/null; then
  MSYS2_ARG_CONV_EXCL='--push-endpoint=' retry gcloud pubsub subscriptions update "$ALERTS_SUB" \
    "${PUSH_FLAGS[@]}" --format=none
  ok "exists (push config refreshed)"
else
  MSYS2_ARG_CONV_EXCL='--push-endpoint=' RETRIES=12 retry gcloud pubsub subscriptions create \
    "$ALERTS_SUB" --topic="$ALERTS_TOPIC" \
    --message-retention-duration=1d --expiration-period=never \
    "${PUSH_FLAGS[@]}" --format=none
  ok "created"
fi

# -----------------------------------------------------------------------------
step "Smoke test"
health="$(curl -sS --fail-with-body "${URL}/api/v1/health")" || die "health check failed: ${health}"
ok "${URL}/api/v1/health → ${health}"

# -----------------------------------------------------------------------------
step "Capture PWA → Firebase Hosting site ${CAPTURE_SITE}"
if firebase hosting:sites:get "$CAPTURE_SITE" --project "$PROJECT_ID" --account "$ACCOUNT" \
  --non-interactive >/dev/null 2>&1; then
  ok "site exists"
else
  firebase hosting:sites:create "$CAPTURE_SITE" --project "$PROJECT_ID" --account "$ACCOUNT" \
    --non-interactive >/dev/null
  ok "site created"
fi
VITE_API_URL="${URL}/api/v1" pnpm --filter capture build >/dev/null ||
  die "capture build failed (run: pnpm --filter capture build)"
ok "built apps/capture"
# Rules and indexes ship with the clients and API that depend on them (the PWA writes
# users/{uid}/push_tokens; the alert dispatcher queries them across users).
firebase deploy --only firestore,storage,hosting:capture \
  --project "$PROJECT_ID" --account "$ACCOUNT" --non-interactive >/dev/null
CAPTURE_URL="https://${CAPTURE_SITE}.web.app"
code="$(curl -sS -o /dev/null -w '%{http_code}' "${CAPTURE_URL}/manifest.webmanifest")"
[[ "$code" == "200" ]] || die "capture manifest answered HTTP ${code}"
ok "${CAPTURE_URL} (manifest 200)"

# -----------------------------------------------------------------------------
step "Command Center dashboard → Firebase Hosting site ${PROJECT_ID}"
# The dry-spell scenario (prototype) is behind a build-time flag: FEATURE_SCENARIO=false hides it.
FEATURE_SCENARIO="${FEATURE_SCENARIO:-true}"
VITE_API_BASE="${URL}" VITE_FEATURE_SCENARIO="${FEATURE_SCENARIO}" pnpm --filter web build >/dev/null ||
  die "dashboard build failed (run: pnpm --filter web build)"
ok "built apps/web (dry-spell scenario: ${FEATURE_SCENARIO})"
firebase deploy --only hosting:dashboard \
  --project "$PROJECT_ID" --account "$ACCOUNT" --non-interactive >/dev/null
DASHBOARD_URL="https://${PROJECT_ID}.web.app"
code="$(curl -sS -o /dev/null -w '%{http_code}' "${DASHBOARD_URL}/geo/zambia-districts.json")"
[[ "$code" == "200" ]] || die "dashboard district boundaries answered HTTP ${code}"
ok "${DASHBOARD_URL} (boundaries 200)"

cat <<EOF

Deployed ${SERVICE} (${TAG}) to ${REGION}:
  API        ${URL}/api/v1
  tRPC       ${URL}/trpc
  Eventarc   ${TRIGGER} → /internal/events/storage
  Pub/Sub    ${ALERTS_SUB} → /internal/events/alerts
  Capture    ${CAPTURE_URL}
  Dashboard  ${DASHBOARD_URL}
EOF

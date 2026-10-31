#!/usr/bin/env bash
# The current build on a preview, production untouched (docs/ceih-overnight-plan.md, Phase 4):
#   - the API as a tagged Cloud Run revision that takes no traffic (its own URL,
#     https://<tag>---cropwatch-api-….run.app); the production revision keeps 100% of traffic;
#   - the dashboard and the capture app on a Hosting preview channel, built against that revision.
# Production's sites and API traffic change only at the cutover (docs/demo-ops.md). Idempotent:
# re-running replaces the tagged revision and the channel's files.
#
#   bash infra/deploy-preview.sh                 (tag ceih, channel ceih-preview, MIN_INSTANCES=1)
#   TAG_NAME=… CHANNEL=… MIN_INSTANCES=0 bash infra/deploy-preview.sh
set -euo pipefail
source "$(dirname "$0")/lib.sh"

SERVICE="cropwatch-api"
AR_REPO="cropwatch"
BUILD_SA="cropwatch-build@${PROJECT_ID}.iam.gserviceaccount.com"
STAGING_BUCKET="${PROJECT_ID}-cloudbuild"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.5-flash-lite}"
GEMINI_LOCATION="${GEMINI_LOCATION:-eu}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"
CAPTURE_SITE="${PROJECT_ID}-capture"
BQ_DATASET="cropwatch"
ALERTS_TOPIC="cropwatch.alerts"
AT_SENDER_ID="${AT_SENDER_ID:-}"
TAG_NAME="${TAG_NAME:-ceih}"
CHANNEL="${CHANNEL:-ceih-preview}"

step "Preflight"
require_gcloud_account git
BUILD_TAG="$(git rev-parse --short HEAD)"
[[ -z "$(git status --porcelain)" ]] || BUILD_TAG="${BUILD_TAG}-dirty-$(date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:${BUILD_TAG}"
SERVICE_URL="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"
[[ -n "$SERVICE_URL" ]] || die "no ${SERVICE} service yet: run infra/deploy.sh first"
TAG_URL="${SERVICE_URL/https:\/\//https://${TAG_NAME}---}"
ok "image ${IMAGE}"
ok "tagged revision URL ${TAG_URL}"
SECRETS_FLAG=()
if gcloud secrets describe africastalking-username --format=none 2>/dev/null &&
  gcloud secrets describe africastalking-api-key --format=none 2>/dev/null; then
  SECRETS_FLAG=(--set-secrets="AT_USERNAME=africastalking-username:latest,AT_API_KEY=africastalking-api-key:latest")
  ok "SMS: Africa's Talking secrets found"
else
  ok "SMS: no Africa's Talking secrets; the SMS log is the beat"
fi

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
step "Dashboard and capture app → Hosting channel ${CHANNEL}"
VITE_API_BASE="$TAG_URL" VITE_FEATURE_SCENARIO=true pnpm --filter web build >/dev/null ||
  die "dashboard build failed"
VITE_API_URL="${TAG_URL}/api/v1" pnpm --filter capture build >/dev/null || die "capture build failed"
CHANNEL_JSON="$(firebase hosting:channel:deploy "$CHANNEL" --only dashboard,capture --expires 7d \
  --project "$PROJECT_ID" --account "$ACCOUNT" --non-interactive --json)" ||
  die "channel deploy failed"
read -r DASHBOARD_URL CAPTURE_URL < <(printf '%s' "$CHANNEL_JSON" | node -e '
  let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => {
    const urls = Object.values(JSON.parse(s).result ?? {}).map(r => r.url)
    const dash = urls.find(u => !u.includes("-capture--")) ?? ""
    const cap = urls.find(u => u.includes("-capture--")) ?? ""
    console.log(dash, cap)
  })')
[[ -n "$DASHBOARD_URL" && -n "$CAPTURE_URL" ]] || die "could not read the channel URLs"
ok "dashboard ${DASHBOARD_URL}"
ok "capture ${CAPTURE_URL}"

# -----------------------------------------------------------------------------
step "Cloud Run revision, tag ${TAG_NAME}, no traffic"
CORS_ORIGINS="${DASHBOARD_URL},${CAPTURE_URL},https://${PROJECT_ID}.web.app,https://${CAPTURE_SITE}.web.app,http://localhost:5173,http://localhost:5174"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --region="$REGION" \
  --service-account="cropwatch-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --no-traffic \
  --tag="$TAG_NAME" \
  --no-cpu-throttling \
  --cpu-boost \
  --cpu=1 --memory=1Gi \
  --concurrency=40 --timeout=120 \
  --min-instances="$MIN_INSTANCES" --max-instances=3 \
  --set-env-vars="^;^GOOGLE_CLOUD_PROJECT=${PROJECT_ID};GOOGLE_CLOUD_LOCATION=${REGION};GOOGLE_GENAI_USE_VERTEXAI=true;GEMINI_MODEL=${GEMINI_MODEL};GEMINI_LOCATION=${GEMINI_LOCATION};STORAGE_BUCKET=${BUCKET};KNOWLEDGE_INDEX_URI=gs://${PROJECT_ID}-knowledge/index.json;EVENTARC_SERVICE_ACCOUNT=cropwatch-api@${PROJECT_ID}.iam.gserviceaccount.com;CORS_ORIGINS=${CORS_ORIGINS};BQ_DATASET=${BQ_DATASET};ALERTS_TOPIC=${ALERTS_TOPIC};AT_SENDER_ID=${AT_SENDER_ID}" \
  "${SECRETS_FLAG[@]}" \
  --format=none
ok "deployed ${TAG_URL} (no traffic)"

step "Smoke test"
health="$(curl -sS --fail-with-body "${TAG_URL}/api/v1/health")" || die "health check failed: ${health}"
ok "${TAG_URL}/api/v1/health → ${health}"
traffic="$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.traffic[0].revisionName,status.traffic[0].percent)')"
ok "production traffic unchanged: ${traffic}"

echo
echo "Preview: dashboard ${DASHBOARD_URL} · capture ${CAPTURE_URL} · API ${TAG_URL}"

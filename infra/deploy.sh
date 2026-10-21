#!/usr/bin/env bash
# Builds and deploys the CropWatch API (apps/functions) to Cloud Run, and wires Eventarc on
# Storage finalize. Idempotent: re-run to ship a new revision. Run infra/setup.sh first.
#
#   bash infra/deploy.sh
#
# MIN_INSTANCES=1 bash infra/deploy.sh keeps one warm instance (demo days; ~US$2/day).
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
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
# The dashboard's origins (Firebase Hosting) plus local Vite.
CORS_ORIGINS="https://${PROJECT_ID}.web.app,https://${PROJECT_ID}.firebaseapp.com,http://localhost:5173"

# -----------------------------------------------------------------------------
step "Preflight"
require_gcloud_account git
TAG="$(git rev-parse --short HEAD)"
[[ -z "$(git status --porcelain)" ]] || TAG="${TAG}-dirty-$(date +%Y%m%d%H%M%S)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/api:${TAG}"
# Deterministic Cloud Run URL: https://SERVICE-PROJECT_NUMBER.REGION.run.app
URL="https://${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
ok "image ${IMAGE}"

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
  --set-env-vars="^;^GOOGLE_CLOUD_PROJECT=${PROJECT_ID};GOOGLE_CLOUD_LOCATION=${REGION};GOOGLE_GENAI_USE_VERTEXAI=true;GEMINI_MODEL=${GEMINI_MODEL};STORAGE_BUCKET=${BUCKET};EVENTARC_SERVICE_ACCOUNT=${RUN_SA};CORS_ORIGINS=${CORS_ORIGINS}" \
  --format=none
ok "deployed ${URL}"

# -----------------------------------------------------------------------------
step "Eventarc: ${TRIGGER} (Storage finalize on gs://${BUCKET} → ${SERVICE})"
retry gcloud run services add-iam-policy-binding "$SERVICE" --region="$REGION" \
  --member="serviceAccount:${RUN_SA}" --role=roles/run.invoker --format=none
if gcloud eventarc triggers describe "$TRIGGER" --location="$REGION" --format=none 2>/dev/null; then
  ok "trigger exists"
else
  RETRIES=12 retry gcloud eventarc triggers create "$TRIGGER" \
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
step "Smoke test"
health="$(curl -sS --fail-with-body "${URL}/api/v1/health")" || die "health check failed: ${health}"
ok "${URL}/api/v1/health → ${health}"

cat <<EOF

Deployed ${SERVICE} (${TAG}) to ${REGION}:
  API        ${URL}/api/v1
  tRPC       ${URL}/trpc
  Eventarc   ${TRIGGER} → /internal/events/storage
EOF

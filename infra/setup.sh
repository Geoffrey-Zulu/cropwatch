#!/usr/bin/env bash
# CropWatch infrastructure baseline for GCP/Firebase project crop-watch01.
# Idempotent: every step checks before it creates, so re-running is safe. If a step fails
# right after its API was first enabled, wait a minute and re-run (API enablement propagates).
#
#   bash infra/setup.sh
#
# One-time interactive prerequisites:
#   gcloud auth login zulugeoffrey034@gmail.com
#   firebase login:add zulugeoffrey034@gmail.com
#
# Account and project pinning, and the helpers, live in infra/lib.sh.
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

ALERTS_TOPIC="cropwatch.alerts"
BQ_DATASET="cropwatch"
BUDGET_NAME="cropwatch-hackathon"
BUDGET_AMOUNT="50"
BUDGET_CURRENCY="USD"
BUDGET_ALERT_EMAIL="$ACCOUNT"

# -----------------------------------------------------------------------------
step "Preflight"
require_gcloud_account firebase
firebase login:list 2>/dev/null | grep -q "$ACCOUNT" ||
  die "firebase CLI is not logged in as ${ACCOUNT}. Run: firebase login:add ${ACCOUNT}"
[[ "$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)')" == "True" ]] ||
  die "Billing is not enabled on ${PROJECT_ID}"
BILLING_ACCOUNT="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)')"
BILLING_ACCOUNT="${BILLING_ACCOUNT#billingAccounts/}"
ok "account ${ACCOUNT}, project ${PROJECT_ID} (#${PROJECT_NUMBER}), billing ${BILLING_ACCOUNT}"

# -----------------------------------------------------------------------------
step "APIs (no-op when already enabled)"
# CLAUDE.md list, plus what the steps below need: Artifact Registry (Cloud Run images), IAM,
# Firebase management/Storage/Rules, Identity Toolkit (Auth), Billing Budgets and Monitoring
# (the budget's email channel).
gcloud services enable \
  aiplatform.googleapis.com run.googleapis.com eventarc.googleapis.com \
  firestore.googleapis.com storage.googleapis.com bigquery.googleapis.com \
  pubsub.googleapis.com cloudfunctions.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com iam.googleapis.com \
  firebase.googleapis.com firebasestorage.googleapis.com firebaserules.googleapis.com \
  identitytoolkit.googleapis.com billingbudgets.googleapis.com monitoring.googleapis.com
ok "enabled"

# -----------------------------------------------------------------------------
step "Firestore (default) database, native mode, ${REGION}"
if loc="$(gcloud firestore databases describe --database='(default)' --format='value(locationId)' 2>/dev/null)"; then
  [[ "$loc" == "$REGION" ]] ||
    warn "(default) already exists in ${loc}, not ${REGION}. Location is immutable; leaving it."
  ok "exists (${loc})"
else
  retry gcloud firestore databases create --database='(default)' \
    --location="$REGION" --type=firestore-native --format=none
  ok "created"
fi

# -----------------------------------------------------------------------------
step "Cloud Storage for Firebase default bucket gs://${BUCKET}"
if loc="$(gcloud storage buckets describe "gs://${BUCKET}" --format='value(location)' 2>/dev/null)"; then
  [[ "$(printf '%s' "$loc" | tr '[:upper:]' '[:lower:]')" == "$REGION" ]] ||
    warn "bucket already exists in ${loc}, not ${REGION}. Location is immutable; leaving it."
  ok "exists (${loc})"
else
  # Creates the <project>.firebasestorage.app default bucket and links it to Firebase.
  resp="$(api --fail-with-body -X POST -d "{\"location\":\"${REGION}\"}" \
    "https://firebasestorage.googleapis.com/v1beta/projects/${PROJECT_ID}/defaultBucket")" ||
    die "default bucket API refused: ${resp}
    Fallback: Firebase console > Storage > Get started, location ${REGION}; then re-run."
  ok "created in ${REGION}"
fi

# -----------------------------------------------------------------------------
step "Pub/Sub topic ${ALERTS_TOPIC}"
if gcloud pubsub topics describe "$ALERTS_TOPIC" --format=none 2>/dev/null; then
  ok "exists"
else
  gcloud pubsub topics create "$ALERTS_TOPIC" \
    --message-storage-policy-allowed-regions="$REGION" --format=none
  ok "created"
fi

# -----------------------------------------------------------------------------
step "BigQuery dataset ${BQ_DATASET} in ${REGION}"
# REST rather than the bq CLI, whose wrapper cannot find Python under Git Bash on Windows.
BQ_API="https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets"
status="$(api -o /dev/null -w '%{http_code}' "${BQ_API}/${BQ_DATASET}")"
if [[ "$status" == "200" ]]; then
  ok "exists"
elif [[ "$status" == "404" ]]; then
  resp="$(api --fail-with-body -X POST -d "{
    \"datasetReference\": {\"projectId\": \"${PROJECT_ID}\", \"datasetId\": \"${BQ_DATASET}\"},
    \"location\": \"${REGION}\",
    \"description\": \"CropWatch observation history, risk scores and alerts\"
  }" "$BQ_API")" || die "dataset create failed: ${resp}"
  ok "created"
else
  die "unexpected HTTP ${status} checking dataset ${BQ_DATASET}"
fi

step "BigQuery tables and view (schemas from packages/shared)"
# observations (seed), observation_events (API snapshots), retracted_observations, risk_scores,
# and the observations_latest view the cluster rule reads. Adds new nullable columns in place.
pnpm --silent --filter @repo/seed tables || die "BigQuery tables failed"
ok "ready"

# -----------------------------------------------------------------------------
step "Cloud Run service account ${RUN_SA}"
if gcloud iam service-accounts describe "$RUN_SA" --format=none 2>/dev/null; then
  ok "exists"
else
  gcloud iam service-accounts create "$RUN_SA_NAME" \
    --display-name="CropWatch API (Cloud Run)" --format=none
  ok "created"
fi
# Least privilege for the demo path. firebasecloudmessaging.admin is the narrowest role that
# can send FCM messages (alert push). Project-level BigQuery roles: this project holds only the
# cropwatch dataset.
for role in roles/datastore.user roles/aiplatform.user roles/bigquery.dataEditor \
  roles/bigquery.jobUser roles/secretmanager.secretAccessor roles/eventarc.eventReceiver \
  roles/firebasecloudmessaging.admin; do
  grant_project_role "serviceAccount:${RUN_SA}" "$role"
done
retry gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUN_SA}" --role=roles/storage.objectViewer --format=none
retry gcloud pubsub topics add-iam-policy-binding "$ALERTS_TOPIC" \
  --member="serviceAccount:${RUN_SA}" --role=roles/pubsub.publisher --format=none
ok "roles granted"

# Eventarc Storage-finalize triggers (D2) need the Cloud Storage service agent to publish.
# The agent is created lazily on first lookup and can take minutes to reach IAM.
GCS_AGENT="$(gcloud storage service-agent --project="$PROJECT_ID" | tr -d '[:space:]')"
RETRIES=36 grant_project_role "serviceAccount:${GCS_AGENT}" roles/pubsub.publisher
ok "Eventarc prerequisite: ${GCS_AGENT} can publish"

# -----------------------------------------------------------------------------
step "Firebase: Firestore and Storage security rules (infra/*.rules)"
firebase deploy --only firestore,storage \
  --project "$PROJECT_ID" --account "$ACCOUNT" --non-interactive
ok "deployed"

step "Firebase Auth: anonymous (demo farmers) + email/password (officers)"
if resp="$(api --fail-with-body -X PATCH \
  -d '{"signIn":{"anonymous":{"enabled":true},"email":{"enabled":true,"passwordRequired":true}}}' \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=signIn.anonymous.enabled,signIn.email.enabled,signIn.email.passwordRequired")"; then
  AUTH_STATUS="anonymous + email/password"
  ok "enabled"
elif [[ "$resp" == *CONFIGURATION_NOT_FOUND* ]]; then
  AUTH_STATUS="NOT INITIALISED (see warning)"
  warn "Firebase Authentication has not been initialised for ${PROJECT_ID}."
  warn "Firebase console > Authentication > Get started, then re-run this script."
else
  AUTH_STATUS="NOT CONFIGURED (see warning)"
  warn "could not update Auth config: ${resp}"
fi

# -----------------------------------------------------------------------------
step "Budget alert: ${BUDGET_AMOUNT} ${BUDGET_CURRENCY} for ${PROJECT_ID}"
# Default budget emails go only to billing-account admins, who may not include this project's
# Owner (the pinned account cannot even read the billing account). So the budget also emails
# BUDGET_ALERT_EMAIL through a Cloud Monitoring channel. (enableProjectLevelRecipients looks
# like the fix but the API silently drops it on project-scoped budgets.)
MON_API="https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/notificationChannels"
channels="$(api --fail-with-body "${MON_API}?filter=type%3D%22email%22")" ||
  die "could not list notification channels: ${channels}"
channel="$(printf '%s' "$channels" |
  json 'j.notificationChannels?.find(c => c.labels?.email_address === arg)?.name' "$BUDGET_ALERT_EMAIL")"
if [[ -z "$channel" ]]; then
  resp="$(api --fail-with-body -X POST -d "{
    \"type\": \"email\",
    \"displayName\": \"CropWatch budget alerts\",
    \"labels\": {\"email_address\": \"${BUDGET_ALERT_EMAIL}\"}
  }" "$MON_API")" || die "could not create email notification channel: ${resp}"
  channel="$(printf '%s' "$resp" | json 'j.name')"
fi
NOTIFY="\"notificationsRule\": {\"monitoringNotificationChannels\": [\"${channel}\"]}"

# A project Owner can create a budget scoped to their own project without billing-account
# access, but can only list it with ?scope=.
BUDGETS_API="https://billingbudgets.googleapis.com/v1/billingAccounts/${BILLING_ACCOUNT}/budgets"
budgets="$(api --fail-with-body "${BUDGETS_API}?scope=projects/${PROJECT_NUMBER}")" ||
  die "could not list budgets, so not creating one (it might duplicate): ${budgets}"
budget_name="$(printf '%s' "$budgets" | json 'j.budgets?.find(b => b.displayName === arg)?.name' "$BUDGET_NAME")"
if [[ -n "$budget_name" ]]; then
  resp="$(api --fail-with-body -X PATCH -d "{${NOTIFY}}" \
    "https://billingbudgets.googleapis.com/v1/${budget_name}?updateMask=notificationsRule")" ||
    die "could not update budget notifications: ${resp}"
  ok "exists (${budget_name##*/})"
else
  # Alerts at 50%, 90% and 100% of actual spend, and at 100% of forecast.
  resp="$(api --fail-with-body -X POST -d "{
    \"displayName\": \"${BUDGET_NAME}\",
    \"budgetFilter\": {\"projects\": [\"projects/${PROJECT_NUMBER}\"]},
    \"amount\": {\"specifiedAmount\": {\"currencyCode\": \"${BUDGET_CURRENCY}\", \"units\": \"${BUDGET_AMOUNT}\"}},
    \"thresholdRules\": [
      {\"thresholdPercent\": 0.5}, {\"thresholdPercent\": 0.9}, {\"thresholdPercent\": 1.0},
      {\"thresholdPercent\": 1.0, \"spendBasis\": \"FORECASTED_SPEND\"}
    ],
    ${NOTIFY}
  }" "$BUDGETS_API")" ||
    die "budget create failed: ${resp}
    On a currency mismatch, set BUDGET_AMOUNT/BUDGET_CURRENCY at the top of this script."
  ok "created"
fi
# The API has silently dropped notification fields before, so confirm the channel stuck.
[[ "$(printf '%s' "$resp" | json 'j.notificationsRule?.monitoringNotificationChannels?.[0]')" == "$channel" ]] ||
  die "budget did not keep the email channel ${channel}: ${resp}"
ok "alerts email ${BUDGET_ALERT_EMAIL} (plus billing-account admins)"

# -----------------------------------------------------------------------------
cat <<EOF

Done. ${PROJECT_ID} in ${REGION}:
  Firestore      (default), native mode
  Storage        gs://${BUCKET}
  Pub/Sub        ${ALERTS_TOPIC}
  BigQuery       ${PROJECT_ID}:${BQ_DATASET}
  Service acct   ${RUN_SA}
  Auth           ${AUTH_STATUS}
  Budget         ${BUDGET_NAME} (${BUDGET_AMOUNT} ${BUDGET_CURRENCY})
EOF

#!/usr/bin/env bash
# Sets the API's warm-instance floor without rebuilding: 1 on demo days (no cold start on
# stage, ~US$2/day), 0 otherwise. See docs/demo-ops.md.
#
#   bash infra/scale.sh 1
#   bash infra/scale.sh 0
set -euo pipefail
# shellcheck source=infra/lib.sh
source "$(dirname "$0")/lib.sh"

SERVICE="cropwatch-api"
MIN="${1:-}"
[[ "$MIN" =~ ^[0-3]$ ]] || die "usage: bash infra/scale.sh <min instances 0-3> (max instances is 3)"

step "Cloud Run ${SERVICE}: min instances → ${MIN}"
require_gcloud_account curl
gcloud run services update "$SERVICE" --region="$REGION" --min-instances="$MIN" --format=none
current="$(gcloud run services describe "$SERVICE" --region="$REGION" \
  --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")')"
health="$(curl -sS --fail-with-body "https://${SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app/api/v1/health")" ||
  die "health check failed: ${health}"
ok "min instances ${current:-0}; ${health}"

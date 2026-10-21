# Shared by infra/setup.sh and infra/deploy.sh (source it; don't run it).
#
# The authorized account and project are pinned through CLOUDSDK_CORE_* for every gcloud call
# (REST calls use its token), so other logged-in accounts and your global gcloud config are
# never used or changed.

PROJECT_ID="crop-watch01"
REGION="europe-west1"
ACCOUNT="zulugeoffrey034@gmail.com"

BUCKET="${PROJECT_ID}.firebasestorage.app"
RUN_SA_NAME="cropwatch-api"
RUN_SA="${RUN_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

export CLOUDSDK_CORE_ACCOUNT="$ACCOUNT"
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
export CLOUDSDK_CORE_DISABLE_PROMPTS=1
# Git Bash on Windows rewrites arguments that start with "/" into Windows paths (it turned
# --destination-run-path=/internal/events/storage into C:/Program Files/Git/...). These
# scripts pass URLs and gs:// paths, never POSIX paths that need translating. No-op elsewhere.
export MSYS_NO_PATHCONV=1

# Repo root, where firebase.json lives.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

step() { printf '\n==> %s\n' "$*"; }
ok() { printf '    ok: %s\n' "$*"; }
warn() { printf '    WARN: %s\n' "$*" >&2; }
die() {
  printf '    ERROR: %s\n' "$*" >&2
  exit 1
}
# New resources (service accounts especially) take a while to become visible to IAM. Retries
# every 5 s, RETRIES times (default 6), and prints the output only if the last attempt fails.
retry() {
  local n=0 max="${RETRIES:-6}" out
  until out="$("$@" 2>&1)"; do
    n=$((n + 1))
    if [[ $n -ge $max ]]; then
      printf '%s\n' "$out" >&2
      return 1
    fi
    sleep 5
  done
}
grant_project_role() {
  retry gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="$1" --role="$2" --condition=None --format=none
}
api_token() { gcloud auth print-access-token; }
# Authenticated REST call as the pinned account, billed to this project.
api() {
  curl -sS -H "Authorization: Bearer $(api_token)" -H "x-goog-user-project: ${PROJECT_ID}" \
    -H "Content-Type: application/json" "$@"
}
# Evaluates a JS expression over JSON on stdin (bound to j, with $2 bound to arg). Prints the
# result, or nothing when it is undefined/null.
json() {
  node -e '
    let s = ""
    process.stdin.on("data", d => (s += d)).on("end", () => {
      const expr = new Function("j", "arg", "return (" + process.argv[1] + ")")
      const v = expr(JSON.parse(s || "{}"), process.argv[2])
      process.stdout.write(v == null ? "" : String(v))
    })' "$@"
}

# Fails unless the tools exist and gcloud holds credentials for the authorized account.
require_gcloud_account() {
  for cmd in gcloud curl node "$@"; do
    command -v "$cmd" >/dev/null || die "$cmd not found on PATH"
  done
  gcloud auth list --filter="account:${ACCOUNT}" --format="value(account)" | grep -qx "$ACCOUNT" ||
    die "gcloud has no credentials for ${ACCOUNT}. Run: gcloud auth login ${ACCOUNT}"
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
}

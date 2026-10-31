#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-simulator}"
case "$MODE" in
  simulator|unsigned-ipa|app-store-connect|release-testing) ;;
  *) echo "Unsupported build mode: $MODE" >&2; exit 1 ;;
esac

if [[ "$MODE" != simulator && "$MODE" != unsigned-ipa ]]; then
  for variable in IOS_CERTIFICATE_P12_BASE64 IOS_CERTIFICATE_PASSWORD IOS_PROVISION_PROFILE_BASE64 IOS_TEAM_ID; do
    if [[ -z "${!variable:-}" ]]; then
      echo "Missing signing secret: $variable. Use simulator mode until signing is configured." >&2
      exit 1
    fi
  done
fi

PROJECT="apps/capture/ios/App/App.xcodeproj"
OUTPUT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/phytos-ios"
mkdir -p "$OUTPUT"
pnpm --filter capture build
pnpm --filter capture exec cap sync ios
node scripts/configure-ios.mjs

# Native App Store icons must be opaque and 1024 px. Reuse the existing maskable artwork.
sips -s format jpeg apps/capture/public/icons/icon-maskable-512.png --out "$OUTPUT/icon.jpg" >/dev/null
sips -z 1024 1024 -s format png "$OUTPUT/icon.jpg" \
  --out apps/capture/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png >/dev/null

if [[ "$MODE" == simulator ]]; then
  xcodebuild -project "$PROJECT" -scheme App -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath "$OUTPUT/DerivedData" \
    CODE_SIGNING_ALLOWED=NO build
  ditto -c -k --sequesterRsrc --keepParent \
    "$OUTPUT/DerivedData/Build/Products/Debug-iphonesimulator/App.app" \
    "$OUTPUT/Phytos-simulator.zip"
  exit 0
fi

if [[ "$MODE" == unsigned-ipa ]]; then
  xcodebuild -project "$PROJECT" -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -derivedDataPath "$OUTPUT/DeviceDerivedData" \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
  mkdir -p "$OUTPUT/Payload" "$OUTPUT/export"
  ditto "$OUTPUT/DeviceDerivedData/Build/Products/Release-iphoneos/App.app" "$OUTPUT/Payload/App.app"
  ditto -c -k --norsrc --keepParent "$OUTPUT/Payload" "$OUTPUT/export/Phytos-unsigned.ipa"
  echo 'Unsigned device IPA exported. It must be signed before installation on an iPhone.'
  exit 0
fi

SIGNING=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/phytos-signing.XXXXXX")
KEYCHAIN="$SIGNING/build.keychain-db"
PROFILE_PATH=''
cleanup() {
  security delete-keychain "$KEYCHAIN" 2>/dev/null || true
  [[ -z "$PROFILE_PATH" ]] || rm -f "$PROFILE_PATH"
  rm -rf "$SIGNING"
}
trap cleanup EXIT
export SIGNING
python3 - <<'PY'
import base64, os, pathlib
for secret, name in [('IOS_CERTIFICATE_P12_BASE64', 'certificate.p12'),
                     ('IOS_PROVISION_PROFILE_BASE64', 'profile.mobileprovision')]:
    path = pathlib.Path(os.environ['SIGNING']) / name
    path.write_bytes(base64.b64decode(os.environ[secret], validate=True))
    path.chmod(0o600)
PY

KEYCHAIN_PASSWORD=$(openssl rand -hex 24)
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$SIGNING/certificate.p12" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN"
security cms -D -i "$SIGNING/profile.mobileprovision" > "$SIGNING/profile.plist"
PROFILE_UUID=$(/usr/libexec/PlistBuddy -c 'Print UUID' "$SIGNING/profile.plist")
PROFILE_NAME=$(/usr/libexec/PlistBuddy -c 'Print Name' "$SIGNING/profile.plist")
export PROFILE_NAME MODE
PROFILE_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
mkdir -p "$(dirname "$PROFILE_PATH")"
cp "$SIGNING/profile.mobileprovision" "$PROFILE_PATH"

python3 - <<'PY'
import os, plistlib, pathlib
signing = pathlib.Path(os.environ['SIGNING'])
profile = plistlib.loads((signing / 'profile.plist').read_bytes())
team = os.environ['IOS_TEAM_ID']
if team not in profile['TeamIdentifier']:
    raise SystemExit('Provisioning profile does not belong to IOS_TEAM_ID')
app = profile['Entitlements']['application-identifier']
if not app.endswith('.zm.cropwatch.app'):
    raise SystemExit('Provisioning profile must match bundle identifier zm.cropwatch.app')
options = dict(method=os.environ['MODE'], teamID=team, signingStyle='manual',
               signingCertificate='Apple Distribution',
               provisioningProfiles={'zm.cropwatch.app': os.environ['PROFILE_NAME']})
(signing / 'ExportOptions.plist').write_bytes(plistlib.dumps(options))
PY

xcodebuild -project "$PROJECT" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUTPUT/Phytos.xcarchive" \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$IOS_TEAM_ID" \
  CODE_SIGN_IDENTITY='Apple Distribution' PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" archive
xcodebuild -exportArchive -archivePath "$OUTPUT/Phytos.xcarchive" \
  -exportOptionsPlist "$SIGNING/ExportOptions.plist" -exportPath "$OUTPUT/export"

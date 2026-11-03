# Audit validation record

Date: 31 October 2026. Base: upstream `d9-dashboard-v2` at `13074135f05c5855559b550e7f5be36c0fddfcf8`. Working branch: `cropwatch-audit-ios`.

## Completed local checks

- Frozen dependency installation succeeded with the npm-distributed `pnpm@12.9.1` CLI. The Windows standalone launcher failed to find its platform package; using `npx --yes pnpm@12.9.1` resolved that launcher issue.
- The first full repository test run after native integration passed **506 tests** across ten tested workspaces, including six new native transport/camera/GPS tests and the expert-verification regression. The backend subset passed 142 tests at that point. A subsequent test covers the JSON body-size limit; final results are recorded below.
- Full repository lint passed (13 Turbo tasks including its build dependency).
- Full production build passed (shared package, Cloud Run API, dashboard and capture PWA). Vite warns about large frontend chunks; capture's main JS was approximately 899 kB before gzip and the dashboard approximately 1,013 kB. These are performance follow-ups, not build failures.
- Capture build type-checks both app and service-worker code. A standalone typecheck initially caught missing fields in the new native GPS test fixture; those were corrected before the passing build.
- Capacitor generated the iOS Xcode project on Windows. Sync, final dependency checks and the remote Mac workflow are recorded below.
- A focused source scan for common private-key/GitHub-token patterns found no matches. Firebase public client configuration remains committed as upstream intended; this scan is not a complete secret-history audit.
- No live Firebase, Storage, model, RAG, SMS or APNs mutations were performed. SKACE's existing local changes were not altered.

## Dependency audit

Initial scan: 16 findings (6 high / 7 moderate / 3 low), plus upstream's already ignored braces advisory. Same-major gRPC/Undici patches were added; the existing Zod v3 advisory requires a coordinated migration and remains visible. The API body limit is a mitigation, not an advisory suppression or a guarantee against all resource exhaustion. Do not describe the dependency/security gate as green while that finding remains.

## Release limits

- Windows cannot run Xcode. A local web build and unit tests do not prove an iOS compile, native permissions or real-device operation.
- The workflow supports a simulator `.app`, an unsigned device IPA and signed IPA export with supplied Apple Distribution credentials. No signing certificate/profile was supplied during this task, so no signed device IPA is claimed.
- Background native push, durable offline drafts, intervention/outcome endpoints, consent/account lifecycle and the other open audit findings remain explicitly unfinished.
- Tests for the new native API boundary use mocked native plugins and transports. They validate authentication/error/contract flow, not hardware behaviour.

## Final follow-up checks

- Final local tests: **507 passing**, including 143 backend tests and 20 capture tests. An unconstrained parallel rerun hit Vitest worker startup timeouts on Windows; the root test command now limits Turbo to two workspaces and Vitest to two workers, and the complete rerun passed.
- Repository type checking: 13 Turbo tasks passed. Production build: all four build tasks passed. Lint: all 13 tasks passed. Prettier, dependency consistency and `git diff --check` passed.
- Final dependency scan: **one high / three moderate / two low**, no critical findings. The remaining high finding is Zod ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). The existing `pnpm audit --audit-level high` CI gate therefore still fails; no new exception was introduced.
- Capacitor sync succeeded with camera 8.2.6 and geolocation 8.2.4, using Capacitor 8.6.0. Native project permission descriptions are present. Node script and Bash build-script syntax checks passed.
- The Tailwind declaration in the dashboard was aligned with capture's existing 3.4.19 version; this resolves the inherited dependency-consistency failure without changing the resolved Tailwind release.
- The iOS workflow is manual and exports an artifact only. It does not deploy the original backend, send alerts, upload to App Store Connect or publish an app. Remote compilation results are available in the fork's **Build Phytos iOS** Actions runs; installing the device IPA still requires signing.

## Verified remote iOS compile

[Mac build 41187727166](https://github.com/germansniper3/cropwatch/actions/runs/41187727166) **succeeded**, including frozen install, type checking, lint, tests, Xcode simulator compilation and artifact upload, for commit `38a6d4d`. Artifact: `Phytos-iOS-simulator` (3,896,059 bytes). This independently validates the project with Apple's toolchain; it does not test iPhone hardware or signing.

The normal [CI run 41187727380](https://github.com/germansniper3/cropwatch/actions/runs/41187727380) failed specifically at **Audit dependencies**, as expected from the remaining Zod advisory. That failure was not suppressed.

The workflow also has an `unsigned-ipa` mode, which compiles for physical iOS devices and exports an unsigned package without Apple credentials. Such a package must be signed before installation. Signed App Store/ad hoc modes continue to require the certificate and profile described in `IOS_BUILD.md`.

## Verified device IPA export

[Device build 41188116184](https://github.com/germansniper3/cropwatch/actions/runs/41188116184) **succeeded** for commit `59b42ee`, including the quality gates, Xcode Release compilation for physical iOS devices, IPA packaging and artifact upload. Artifact: `Phytos-iOS-unsigned-ipa`.

The downloaded package is at `artifacts/ios/export/Phytos-unsigned.ipa` (2,039,643 bytes; ignored by Git). Inspection of the actual ZIP, binary plist and Mach-O header confirmed `Payload/App.app`, bundle ID `zm.cropwatch.app`, platform `iPhoneOS` and CPU `arm64`. The app has no `_CodeSignature/CodeResources`, consistent with the deliberately unsigned build. This is a device IPA, not the simulator app; it still requires signing before installation.

SHA-256: `ed4184be437bfa1094216f766bc1fafb294aa783b4548e06d7f946ac747a857e`.

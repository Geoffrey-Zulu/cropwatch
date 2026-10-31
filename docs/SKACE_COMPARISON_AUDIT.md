# CropWatch / Phytos audit and SKACE comparison

Audit date: 31 October 2026 (Africa/Lusaka). This is a source and build audit, not a penetration test or a certification of deployed services.

## Scope and branch correction

The upstream default branch, `main` (`88ee00d`), stops at D4: backend diagnosis/recommendation, a template dashboard and a mobile README. Auditing that checkout alone would incorrectly conclude that CropWatch has no useful interface. The implementation branch is `d9-dashboard-v2` (`13074135f05c5855559b550e7f5be36c0fddfcf8`). This work branches from that revision as `cropwatch-audit-ios`.

SKACE was compared against the local `SKACE -SMART-FARMER` working tree. Its existing document changes were left alone. Evidence below names source files, rather than treating README promises as shipped features. Live cloud resources, external model accuracy, source licences and regulatory authorisation were not independently certified.

## Product assessment

SKACE is a farm operations and evidence product: it connects work, production, sales and independent verification into a farmer-controlled lender record. CropWatch is a crop-health reporting and surveillance product: it connects photos, grounded advice, clusters, alerts and officer visit priorities. SKACE has substantially greater functional breadth. CropWatch has a more explicit and focused crop-surveillance pipeline and stronger boundaries around chemical advice. Neither should be described as universally better.

## Functionality matrix

“Implemented” means the relevant source exists. It does not imply that every deployment dependency is configured or that a field trial has passed.

| Function                      | CropWatch / Phytos at D9                                                                                                                  | SKACE evidence and relative strength                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farmer crop photo reporting   | Capture PWA: crop picker, GPS/district, photo resize/upload, progressive diagnosis/result                                                 | Native Expo scanner and crop triage; SKACE has an actual mobile application source tree                                                                             |
| Diagnosis quality controls    | Controlled issue vocabulary, schema validation/retry, low-confidence/unknown expert routing; internal numbers separated from public bands | Crop and cattle triage plus photo scanning. Legacy photo diagnosis still requests numeric confidence and model-written treatment in `backend/modules/ai/service.go` |
| Recommendation grounding      | Curated Zambia/FAO/CABI corpus, Vertex retrieval, source tiers and citations, IPM ladder                                                  | Farm context, weather and AI coaching; not equivalent to CropWatch's explicit retrieved-source and regulatory pipeline                                              |
| Chemical filtering            | Deterministic crop/issue/expiry filter, verbatim dose, placeholders excluded by default                                                   | No equivalent deterministic product register was found in the reviewed SKACE diagnosis path; preserve CropWatch's implementation                                    |
| Regulatory proof              | Supports ZEMA/label/manual/Plantwise/placeholder source types. PMDG rows are guide-derived, not proof of current ZEMA registration        | Neither codebase alone establishes current legal authorisation; verify source data before making a registration claim                                               |
| Human crop verification       | Role/org checks, officer queue, correction triggers new recommendation and outbreak recount                                               | Crop screens and expert portal; CropWatch offers the clearer surveillance verification ladder                                                                       |
| Intervention/outcome tracking | Frozen contract and schemas exist, but both REST handlers return 501                                                                      | SKACE has farm logs, crop health screens, soil/post-harvest events; CropWatch's treatment follow-up loop is unfinished                                              |
| Outbreak surveillance         | BigQuery GIS same-issue clustering, transparent qualitative risk, cluster lifecycle, map                                                  | SKACE has cattle disease risk and farm insights; not the same national crop-cluster workflow                                                                        |
| Push and SMS                  | FCM topics/web tokens and Africa's Talking SMS adapters; actual provider delivery not re-exercised in this audit                          | Expo notification registration and worker/task workflows; CropWatch has the stronger crop alert fan-out source                                                      |
| Officer visit priorities      | Org/camp/district aggregates, reason codes, visit ranking and field-officer allocation                                                    | Task assignment and worker tracking; different operational objective                                                                                                |
| Offline behaviour             | Firestore read cache and PWA shell. Unsent photo/form and report id live in component memory, not a durable submission queue              | Persistent mobile action queue and capture anchors. SKACE is stronger here, though its queue has loss hazards noted below                                           |
| Account continuity            | Anonymous farmer identity on one installation; dashboard officer sign-in/claims                                                           | Named login, onboarding, profiles, user administration and roles. SKACE has the broader account lifecycle                                                           |
| Tenant and role controls      | Firebase claims, org scoping in API, deny-by-default client rules; command-center roles are globally privileged                           | PostgreSQL tenant scoping/RLS, route RBAC, maker/checker, platform ControlHub; SKACE is stronger for separate farm businesses                                       |
| Farm crop records             | Observations concern crops; no full crop-cycle inventory/harvest ledger                                                                   | Crop cycles, growth logs, planted area and actual yields in farm module/mobile screens                                                                              |
| Livestock                     | No equivalent found                                                                                                                       | Inventory, growth, cattle triage, veterinary verdicts and LSD risk                                                                                                  |
| Storage and post-harvest      | No equivalent found                                                                                                                       | Stock, condition readings, safe-storage model, intake/offtake/loss events                                                                                           |
| Soil and fertilizer           | No equivalent found                                                                                                                       | Soil captures/history/trends and economic fertilizer plans                                                                                                          |
| Worker operations             | Officer priority lists only                                                                                                               | Attendance, tasks, geofencing, shift location pings and tracking consent                                                                                            |
| Capture time evidence         | Server receipt time; no capture anchor in observation request                                                                             | Signed time anchors and bounded timestamp validation; stronger evidence, not proof against a malicious device holding its signing material                          |
| Land/boundary evidence        | Point/district location, with town fallback when GPS fails                                                                                | ZNSDI cadastral lookup and customary polygon co-signature                                                                                                           |
| Satellite evidence            | Architecture/roadmap; not a live Sentinel-2 parcel pipeline in this branch                                                                | Copernicus parcel NDVI, stress alerts, labelled demo fallback                                                                                                       |
| Revenue evidence              | No sales or buyer confirmation subsystem found                                                                                            | Buyer co-signed sales, verified revenue distinct from predicted revenue                                                                                             |
| Credit/lender report          | Roadmap only; outgrower rankings are not credit scores                                                                                    | Signed track record, PDF/QR verification, category score, trend/peer context                                                                                        |
| Data sharing                  | Org and command-center roles; no lender share-grant lifecycle found                                                                       | Named, expiring, revocable lender access with access audit                                                                                                          |
| Cooperative roll-up           | Org surveillance overview                                                                                                                 | Signed member-farm roll-ups and concentration flags                                                                                                                 |
| AI farm assistant             | Focused diagnosis/advice, no general farm action coach found                                                                              | Contextual chat with confirmation tokens for record-changing actions                                                                                                |
| Native iOS before this branch | No Dart source, pubspec, Runner project or native build pipeline; `apps/mobile/README.md` only                                            | Maintained Expo app and iOS bundle config; SKACE also lacks a checked-in `eas.json` in the reviewed tree                                                            |

## Prioritised findings

### P1 — Dependency audit fails the existing security gate (partly addressed)

The first `pnpm audit --audit-level high` reported 16 advisories: six high, seven moderate and three low (with the repository's pre-existing braces exception). High findings include inherited Firebase `@grpc/grpc-js`, jsdom `undici` and Zod. This branch pins affected gRPC/Undici ranges to same-major patched releases. Zod remains on v3 because shared schemas, OpenAPI generation and dependent tooling use that API; the advisory lists a v4 patched release. The JSON API now rejects bodies over 64 KiB before parsing/validation, reducing unbounded-input exposure, but this is not represented as a patched dependency. A coordinated Zod/OpenAPI migration remains a release blocker. No new advisory ignore was added. See `AUDIT_VALIDATION.md` for final scanner results.

### P1 — Lower-role verification can inherit an expert label (fixed here)

`apps/functions/src/services/observationModel.ts` previously kept the highest verification state while replacing `verified_issue` and `verified_by`. A field officer in the same org could change an expert-confirmed diagnosis to a different issue and the resulting recommendation would still be labelled `EXPERT_CONFIRMED`. The Firestore store now refuses non-expert writes to expert-confirmed observations. A route regression checks unchanged, different and unknown issues, unchanged evidence and the absence of processing; an agronomist can still correct the report.

### P1 — Missing GPS is silently converted into precise cluster evidence (open)

`apps/capture/src/pages/DiagnosePage.tsx` submits `findDistrict(district).center` when GPS fails. `buildReport` has no accuracy/source marker; `newObservation` treats the submitted point as normal, and `services/outbreaks/detect.ts` clusters those coordinates within 10 km. Several unrelated reports without GPS in the same district can appear as a local cluster at the district town. This is more serious than a map display issue because it can drive alerts and visit priority. Add optional location provenance and accuracy to the frozen contract, persist it, and exclude district-centre reports from spatial clustering while retaining district-level counts. SKACE's distinction between verified and reported location is the model to follow.

### P1 — No durable store-and-forward submission queue (open)

The capture page keeps `photo`, metadata and `attempt` in React state. Closing/reloading the app loses an unsent report, even though error copy says the photo is kept. An upload acknowledged by Storage but not by the client may also be retried against create-only Storage rules. Use an IndexedDB draft/outbox with a stable observation id, upload reconciliation, retry/backoff and explicit permanent-error states. Port the idea from SKACE, not its retry-drop behaviour.

### P1 — No application-level capture admission budget (open)

Anonymous Firebase auth is intentional, but `POST /observations` accepts new ids without a per-user budget, App Check enforcement or an application rate limiter in the reviewed path. Repeated ids are idempotent; repeated new ids can still trigger paid photo/model/RAG/analytics work. A single reporter can also generate the five qualifying reports used by clustering; the rule counts observations, not independent farms. Add admission quotas and abuse protection, and decide explicitly whether a cluster requires independent reporters. Cloud-level controls may exist separately; they were not inspected.

### P1 — Native application/build target absent (addressed here)

The Flutter directory was documentation, not a buildable app. This branch adds Capacitor around the implemented capture app, native camera/GPS, packaged local web assets and an iOS build workflow. This does not create a Flutter implementation. Apple signing and device validation remain external release requirements. See `IOS_BUILD.md` for exact commands and secrets.

### P2 — Verification history was overwritten (fixed here)

`firestoreObservations.ts` stored every decision in `internal/verification`, replacing its predecessor. It now preserves that current snapshot for existing readers and appends each decision under `internal/verification/history` in the same transaction. Client rules do not allow access to these internal documents. This is an append-only application audit trail, not a cryptographically signed lender report.

### P2 — Diagnosis completion can race with human verification (open)

`firestoreDiagnoser.ts` takes a lease, calls the external model, then batch-updates `status` and `verification_state` without re-reading the observation. Meanwhile the verify route accepts a diagnosing observation. Model completion can replace a newer human verification state. Use a final transaction that checks the lease owner/status and preserves human decisions. The recommender already checks whether its issue has been superseded; diagnosis needs equivalent protection.

### P2 — Processing and alert delivery have reliability gaps (open)

The API starts pipeline work with `void startProcessing`; errors are logged, not enqueued for a guaranteed later attempt. A Storage finalize event can arrive before its observation exists, be acknowledged as missing, then provide no later rescue. `services/alerts/dispatch.ts` intentionally records a dispatch as `sent` even when every channel fails, so a transient outage can permanently lose an alert. Conversely, a crash after delivery but before final persistence can duplicate sends after lease expiry. Add a durable outbox/worker and per-channel/recipient delivery states with a bounded retry policy. Do not claim exactly-once external messaging.

### P2 — Recent alert retrieval is limited before sorting (open)

`services/alerts/alertReader.ts` fetches up to 200 documents by district without `orderBy(created_at)`, then sorts locally and returns 20. Once a district has more than 200 alerts, its actual newest alerts can be excluded before sorting. Add a district/created-at index and apply descending order before the database limit. Test with more than 200 records.

### P2 — Intervention/outcome and recovery lifecycle unfinished (open)

`rest/v1.ts` returns 501 for intervention and outcome despite frozen schemas describing them. There is no implemented durable treatment-to-recovery loop for the farmer. Implement authorised, transactional writes with actor/time history and corresponding capture/officer screens; do not mark this feature shipped from the OpenAPI declaration alone. SKACE's post-harvest/health record lifecycle is a useful reference, but its domain models cannot simply be copied into Firestore.

### P2 — Legal/consent/account controls need production work (open)

The observation request has no versioned processing/sharing consent receipt. OS camera/location permission is not equivalent to consent for model processing or institutional access. Farmer accounts are anonymous, with no implemented account linking/recovery or self-service deletion flow in capture. Command-center claims grant global raw-data access, which is deliberate but warrants provisioning/revocation procedures and access logging. Add a concise disclosure, consent version/receipt, account recovery and deletion/export/retention policy before a public release.

### P2 — Register membership is not regulatory verification (open)

`registeredProduct.ts` accepts guide/label/manual sources and nullable expiry. `regulatoryFilter.ts` checks source placeholder status, crop, issue and expiry; it does not require `verified_by` or current registration evidence. This is a useful deterministic source filter, but it cannot establish legal status from a PMDG row. The D9 UI correctly distinguishes Plantwise guide text. Maintain that distinction and add source validation/review dates before advertising a legally verified register. No legal determination was made in this audit.

### P2 — Event receiver audience matching is broad (open)

`auth.ts` verifies a signed Google token and exact email, but accepts any audience beginning `https://cropwatch-api-` and containing `.run.app`. Configure the exact expected service audience and pass it to token verification. This is a defence-in-depth issue: the current code still requires a valid Google signature and the configured service-account email.

### P2 — Forked hosting does not migrate the backend (open dependency)

Client config and defaults still target Geoffrey's `crop-watch01` Firebase, Cloud Run, Storage and corpus. A GitHub fork changes source ownership only. Native REST calls use Capacitor's native HTTP transport, so browser CORS does not block those calls; authentication and backend permissions still apply. A separately owned backend requires new cloud configuration, roles, rules, corpus, messaging secrets and deployment. No original cloud resources were changed.

### P3 — Tooling and repository clarity (partly addressed)

The root README still describes the Hytel template; `main` is far behind the working D9 branch. The installed Windows standalone pnpm launcher tried the unavailable old-style package `@pnpm/win-x64@12.9.1`; the published JavaScript CLI works through `npx pnpm@12.9.1`. Use the exact repo-pinned CLI rather than changing application dependencies to work around a launcher problem. The local Node is 24.13.1, slightly below the repository's declared 24.15.0 minimum; CI uses the declared version. Development TLS, code signing and cloud credentials are intentionally separate from source push.

## SKACE strengths to adopt, in order

1. **Evidence quality:** distinguish captured/GPS/estimated/verified values, preserve capture time, and keep actor history. Do not let a point fallback masquerade as a verified farm location.
2. **Field reliability:** durable drafts/outbox, visible pending/failed states and no silent loss. SKACE demonstrates the architecture; improve its queue semantics before reuse.
3. **Farm continuity:** stable named farmer/farm membership, observation history, interventions and follow-up outcomes. Link to a crop cycle before adding larger inventory modules.
4. **Access governance:** org-scoped roles, auditable changes and consent-controlled sharing. Retain CropWatch's restricted commercial output shape.
5. **Production context:** crop cycles, planted area, actual harvests, soil and post-harvest history; then optional boundary/satellite evidence.
6. **Finance only after evidence:** buyer-confirmed sales and signed shareable track records. Do not infer creditworthiness from CropWatch's prototype risk levels or visit rankings.

Keep CropWatch's source tiers, controlled issue vocabulary, low-confidence referral, deterministic chemical filtering and outbreak explanations. A broad SKACE clone would weaken the current product focus. Extend shared contracts deliberately rather than exposing SKACE's Go/PostgreSQL API behind a mismatched Firebase client.

## SKACE limitations relevant to reuse

- `mobile/src/lib/stores/offline-store.ts` drops actions after its retry limit, replaces the queue from a snapshot (risking loss of additions during sync), and has task update/delete branches that do nothing. Reuse the durable-queue concept, not this implementation verbatim.
- `backend/db/migrations.go` seeds known demo passwords and a fallback platform-admin password. Production provisioning must override/disable defaults; the existence of RBAC is not proof that deployment credentials are safe.
- The legacy crop-photo path in `backend/modules/ai/service.go` requests model-authored treatment and a confidence percentage. The newer crop/cattle triage path is more disciplined. CropWatch should retain its own grounded safety controls.
- SKACE labels demo satellite/model/payment paths, but each live integration still depends on configured credentials and data. A screen or adapter is not independent evidence of live operation.

## Validation and release boundary

Build/test results and iOS limitations are recorded in `AUDIT_VALIDATION.md`. Repository-wide automated checks are useful regression evidence, not a substitute for a real farmer/officer rehearsal, Firebase rules emulation, device permission tests, external-provider tests or agronomic validation. A simulator artifact is not an installable signed IPA. No Apple signing credentials were supplied during the initial audit.

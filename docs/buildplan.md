# CropWatch — 10-Day Build Plan (21 → 30 October 2026)

> **Who does what:** Geoffrey + Claude Code build web, API and infrastructure (Hytel Way conventions). Geoffrey's friend builds the Flutter mobile app against a frozen REST contract. Geoffrey runs the non-code track (validation, corpus, logistics). This file and `technicaldoc.md` travel together; where they conflict, this file wins (two decisions below supersede technicaldoc v1.1).
>
> **Decisions superseding technicaldoc.md v1.1:**
>
> 1. Dashboard = **Vite + React SPA** per Hytel Way, deployed to Firebase Hosting (not Next.js / App Hosting). No SSR needed for a realtime dashboard.
> 2. API = **tRPC** (`apps/functions`) for the dashboard per Hytel Way, **plus a thin versioned REST adapter** (`/api/v1/*`) for the Flutter app and Eventarc webhooks. All request/response shapes defined ONCE as Zod schemas in `packages/shared`; the REST contract is generated from them and frozen on Day 2.
>
> Everything else in `technicaldoc.md` stands: golden rules/invariants, data model, diagnosis contract, RAG corpus plan, regulatory DB, cluster/risk v0, demo runbook.

---

## 0. Honesty rule for the hackathon

Everything we build now is a **reference implementation + prep assets**. Geoffrey emails the organisers ONE line this week: _"Our applied idea is an existing project — can we bring existing code and assets to build on during the weekend?"_ The programme page says existing projects are welcome; get it in writing. If yes: bring everything openly. If restricted: the weekend becomes a rebuild from our own prep (accounts, corpus, seed data, designs, and code Geoffrey fully understands) — which this plan also prepares him for, because he reviews every work package as it lands.

## 1. Repository layout (Hytel Way, adapted)

```
cropwatch/
├── apps/
│   ├── web/                      # Command Center dashboard — Vite + React + Tailwind + Shadcn
│   │   └── src/
│   │       ├── pages/            #   NationalMapPage, OutbreakDetailPage, ObservationDetailPage,
│   │       │                     #   OutgrowerViewPage, OfficerQueuePage  (— Page suffix)
│   │       ├── sections/         #   RiskPanelSection, ClusterListSection, VerifiedCounterSection…
│   │       ├── components/       #   app-specific (MapMarker, DemoBadge, ConfidenceBand…)
│   │       └── hooks/            #   useObservations, useClusters (Firestore listeners)
│   ├── functions/                # Backend on Cloud Run
│   │   └── src/
│   │       ├── trpc/
│   │       │   ├── index.ts      #   root router
│   │       │   ├── router.ts
│   │       │   └── routers/      #   observations.ts, recommendations.ts, risk.ts, org.ts, verify.ts
│   │       ├── rest/             #   /api/v1 adapter for MOBILE + Eventarc webhook (Hono or Express)
│   │       ├── services/         #   gemini.ts (Gen AI SDK), rag.ts, regulatory.ts, cluster.ts, alerts.ts
│   │       └── jobs/             #   scheduled cluster/risk runs
│   └── mobile/                   # Flutter app (friend's track; in repo, OUTSIDE pnpm workspace)
├── packages/
│   ├── shared/                   # SINGLE SOURCE OF TRUTH
│   │   └── src/
│   │       ├── schemas/          #   observation.ts, diagnosis.ts, recommendation.ts,
│   │       │                     #   registeredProduct.ts, alert.ts, org.ts
│   │       ├── constants/        #   issues.ts (controlled vocabulary), crops.ts, verification.ts
│   │       └── contracts/        #   openapi.json — GENERATED from Zod, FROZEN Day 2, versioned
│   ├── ui/                       # shared components (design-system level)
│   ├── eslint-config/
│   └── typescript-config/
├── tools/
│   ├── seed/                     # seed-data generator (sim:true observations, DEMO OUTGROWER CO.)
│   └── corpus/                   # corpus manifest + ingestion scripts for RAG Engine
├── infra/
│   ├── setup.sh                  # gcloud: APIs, Firebase, service accounts, Firestore rules, budget alert
│   └── firestore.rules
├── prompts/                      # versioned Gemini prompts (prompt_version stamped on every diagnosis)
├── docs/                         # technicaldoc.md, buildplan.md (this file), demo-runbook.md
└── CLAUDE.md                     # repo instructions for Claude Code (invariants + conventions)
```

Scaffold from the Hytel monorepo template; run the template-identification check first so conventions aren't misapplied.

## 2. The integration contract (what unblocks mobile)

> **FROZEN 2026-10-21 — REST v1, contract version 1.0.0** (`packages/shared/src/contracts/openapi.json`, generated from the Zod schemas; a test fails if the committed file drifts from them). Approved with four pre-freeze conditions, all in place: uid-bound photo paths with first-writer-wins `obs_id`; `district_slug` as the aggregation key; clients treat unrecognised enum values as generic; BigQuery streams the internal diagnosis numbers (technicaldoc §4.1–4.2 updated). Mobile setup: `apps/mobile/README.md`.

Mobile ↔ backend touch in exactly four places. Freeze these by **end of Day 2** and the friend never waits on us:

| Surface                                                             | Contract                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth**                                                            | Firebase Auth (anonymous for demo farmers; custom claim `role` for officers). Mobile uses Firebase SDK directly.                                                                                                                                                                                             |
| **Photo upload**                                                    | Mobile uploads direct to Cloud Storage via Firebase SDK at `observations/{uid}/{obsId}/{n}.jpg` (uid = signed-in user; the app generates obsId), then calls REST. No multipart to our API.                                                                                                                   |
| **REST v1** (generated from `packages/shared`, served at `/api/v1`) | `POST /observations` (metadata; returns obsId) · `GET /observations/{id}` (poll diagnosis+recommendation; or mobile listens to Firestore doc directly — preferred) · `POST /observations/{id}/verify` · `POST /observations/{id}/intervention` · `POST /observations/{id}/outcome` · `GET /alerts?district=` |
| **Push**                                                            | FCM topics per district (`alerts-{district_slug}`); payload schema (`AlertPushData`) in the frozen contract.                                                                                                                                                                                                 |

Rule: after Day 2 the contract only ADDS optional fields, never changes or removes. `packages/shared/src/contracts/openapi.json` is committed and the friend codes against that file, not against our server.

## 3. Ten days, three tracks

**Hackathon: Fri 30 Oct (evening) – Sun 1 Nov.** Build window: Tue 21 – Wed 29. Thu 30 = travel/setup buffer, nothing scheduled.

| Day              | Claude Code track (web + API + infra)                                                                                                                                                           | Mobile track (friend)                                                                                  | Geoffrey non-code track                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 · Tue 21**  | Scaffold repo from Hytel template; CLAUDE.md + docs in; `infra/setup.sh` (APIs, Firebase, Firestore rules, budget alert); CI (lint/typecheck/build); Zod schemas v0 in `packages/shared`        | Flutter project init in `apps/mobile`; Firebase SDK wired; screen skeletons (Home / Diagnose / Result) | Email organisers re: existing code. Confirm both pitchers were selected. Create/choose GCP project, share credentials with Claude Code |
| **D2 · Wed 22**  | **CONTRACT FREEZE**: REST v1 generated from Zod + committed; `/diagnose` service (Gen AI SDK, structured output, confidence bands, `needs_expert_review` routing); Eventarc on Storage finalize | Capture flow: camera, GPS, crop + planting-date form; direct-to-Storage upload                         | Start corpus collection: MoA FAW manual 2nd ed., CABI Zambia factsheets, FAO IPM guides, ZARI material                                 |
| **D3 · Thu 23**  | Regulatory Product DB (`registered_products` + filter service, label-dose rendering); seed generator v0 (`tools/seed`, deterministic, `sim:true`, DEMO OUTGROWER CO.)                           | Result screen: diagnosis card (confidence band, severity), Firestore doc listener                      | ZEMA register request; fallback = FAW-manual annex → send product rows to Claude Code as CSV                                           |
| **D4 · Fri 24**  | Corpus ingestion into RAG Engine (metadata: tier/crop/issue/year); `/recommend` — context-shaped retrieval, IPM ladder, citations, regulatory filter in line                                    | Report flow: submit observation, confirmation screen                                                   | Validation interviews round 1 (2 outgrowers if reachable; agro-dealers)                                                                |
| **D5 · Sat 25**  | Dashboard shell: NationalMapPage with live Firestore markers + DemoBadge; seeded data rendering; ObservationDetailPage                                                                          | **END-TO-END #1**: real phone photo → diagnose → recommend → appears on map                            | Take 100+ field photos (Lusaka West / Chongwe); note which crops are standing (demo-crop decision)                                     |
| **D6 · Sun 26**  | BigQuery streaming + cluster rule; Risk Model v0 (LOW/ELEVATED/HIGH + contributing factors); alerts: Pub/Sub → FCM + Africa's Talking SMS (sandbox)                                             | FCM alerts receive + display; offline photo queue (store & forward)                                    | Score Gemini zero-shot against the 100 photos → tune prompt with Claude Code; church/rest as needed                                    |
| **D7 · Mon 27**  | OutbreakDetailPage + OutgrowerViewPage (priority visit lists, per-officer grouping); OfficerQueuePage + verify flow (verified counter)                                                          | Officer mode: review queue, confirm/correct diagnosis                                                  | Validation interviews round 2; collect one quotable loss story                                                                         |
| **D8 · Tue 28**  | **FULL DEMO REHEARSAL** end-to-end on real devices; `--live-demo` seed sequence (presenter's report completes the cluster); bug burn-down                                                       | Rehearsal participant; polish capture UX; error states                                                 | Draft Friday-night 90-second pitch + final pitch skeleton with pitchers                                                                |
| **D9 · Wed 29**  | **FREEZE.** Backup screen-recordings of every demo step; deploy stability check; tag release                                                                                                    | Freeze; build signed APK + backup phone                                                                | Pitch rehearsal ×2 with both presenters; pack kit (phones, cables, hotspot, printed one-pager)                                         |
| **D10 · Thu 30** | Buffer only — no planned work                                                                                                                                                                   | Buffer                                                                                                 | Arrive, settle, arrange the judge-SMS moment when judges are known                                                                     |

**Cut lines if behind schedule** (drop top-first): WhatsApp channel → Earth Engine layer (static weather) → officer mobile mode (officers use dashboard on phone browser) → on-device triage (already a stretch; it is NOT in this plan's critical path) → Nyanja alert templates (English only).

## 4. Work-package acceptance criteria (Claude Code checks each before marking done)

1. **Scaffold/infra:** `pnpm install && pnpm typecheck && pnpm build` green in CI; `setup.sh` idempotent; Firestore rules deny unauthenticated writes except demo-scoped paths.
2. **/diagnose:** given a test image set, returns schema-valid JSON 100% of the time (invalid → one retry → expert-review routing, never a crash); `model_confidence` never rendered as a percentage anywhere in UI code.
3. **/recommend:** every chemical in output exists in `registered_products` with matching crop+issue; dose text is byte-identical to the DB row; zero chemicals → IPM-only + officer referral line; every response carries ≥1 citation.
4. **Seed:** deterministic across runs; every row `sim:true`; map shows DEMO badge whenever any sim row is displayed.
5. **Clusters/risk:** cluster appears within 60 s of the qualifying report; risk panel always shows contributing factors, never a bare level.
6. **Alerts:** presenter's report → SMS on a registered number in < 30 s, end-to-end, on hotel-grade wifi.
7. **Demo:** full sequence passes twice consecutively on the actual demo hardware before D9 freeze.

## 5. Mobile plan (hand this section to the friend)

- **Stack:** Flutter, Firebase Auth (anonymous) + Storage + Firestore + FCM. State: whatever he ships fastest (Riverpod/Bloc/setState — his call). Contract: `packages/shared/src/contracts/openapi.json` ONLY.
- **Screens (priority order):** 1) Diagnose (camera/gallery, GPS auto, crop picker, planting date) · 2) Result (confidence band — never a raw percentage; severity; IPM steps; registered product + label dose; "where to buy" list; sources) · 3) Home (my reports + area alerts) · 4) Report confirmation · 5) [stretch] Officer mode · 6) [stretch] offline queue.
- **Flow:** capture → upload photo to Storage → `POST /observations` → listen to the Firestore observation doc → render diagnosis, then recommendation as they land (two progressive updates, good UX on slow data).
- **Milestones:** D2 project runs with Firebase · D5 end-to-end #1 · D8 rehearsal · D9 freeze + signed APK + installed on a backup phone.
- **Demo constraint:** the phone must work on mobile data, not just wifi; rehearse on 4G.

## 6. Risks register (build-phase)

| Risk                                         | Mitigation                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Organisers restrict pre-written code         | Email Day 1; worst case the weekend is a guided rebuild from prep — Geoffrey reviews every package this week so he can rebuild any of it |
| Gemini zero-shot weak on real Zambian photos | D5–D6 photo scoring; prompt iteration; few-shot exemplars in prompt; worst case narrow demo to the best-performing crop/issue            |
| ZEMA data not obtainable                     | Fallback already decided: FAW-manual annex + labels, ~20–40 rows, demo scope                                                             |
| Africa's Talking sandbox/sender-ID delays    | Register account D1; test real SMS by D6, not D8                                                                                         |
| Venue wifi fails during demo                 | Hotspot in kit; Firestore offline persistence on dashboard laptop; backup recordings of every step                                       |
| Friend slips on mobile                       | Dashboard-only demo variant rehearsed as plan B: Presenter 1 uses the web capture page on a phone browser                                |
| Geoffrey single point of failure on GCP      | All infra as scripts in `infra/`, secrets in Secret Manager, README covers redeploy from zero                                            |

## 7. What done looks like on 29 October

A deployed system where: a photo from a phone becomes a diagnosed, regulatory-filtered, cited recommendation in under 30 seconds; the report lands on a live national map among labelled simulated data; a cluster forms and an SMS arrives on a real phone; an officer confirms it and the verified counter ticks; and the Outgrower View turns it all into a prioritised visit list — plus a rehearsed 90-second Friday pitch, a final-pitch skeleton, interview evidence, and a backup recording of everything.

## Progress log

### D1 · Tue 21 Oct — template gaps, infra script, schemas v0

**Status:** D1 complete. Code is verified locally and `infra/setup.sh` has fully provisioned `crop-watch01`. Auth has anonymous sign-in (demo farmers) plus email/password and Google SSO (officers/dashboard), which Geoffrey enabled in the console. Anonymous sign-in was tested end to end with the web API key. Nothing committed.

**Landed**

- **Firebase config:** `firebase.json` (Firestore + Storage rules, Hosting of `apps/web/dist` as an SPA, emulators: auth 9099, firestore 8080, storage 9199, UI 4000) and `.firebaserc` → `crop-watch01`. Rules and indexes live in `infra/`.
- **`infra/firestore.rules`** (deny-by-default). Clients never write observations, recommendations, alerts, orgs or registered_products: the API (Admin SDK) does. Farmers read their own observations and recommendations. Signed-in users read alerts and registered_products. Command Center roles (`extension_officer`, `agronomist`, `admin`) read everything. A farmer may create/edit their own `users/{uid}` but can never set role, org or `sim`.
- **`infra/storage.rules`.** `observations/{obsId}/{n}.jpg` is create-only: JPEG, < 10 MB, with custom metadata `reporter_id` equal to the uploader's uid. Readable by the owner or Command Center.
- **`infra/setup.sh`** (idempotent). APIs; Firestore `(default)` in europe-west1; the `crop-watch01.firebasestorage.app` default bucket; Pub/Sub `cropwatch.alerts`; BigQuery `cropwatch`; SA `cropwatch-api` with least-privilege roles; Eventarc prerequisite (GCS agent → Pub/Sub publisher); rules deploy; Auth providers (anonymous + email/password); a $50 budget at 50/90/100 % plus a forecast alert, emailed to `zulugeoffrey034@gmail.com` through a Cloud Monitoring channel. Pins `zulugeoffrey034@gmail.com` per command and refuses to run without its credentials. Needs only `gcloud`, `firebase`, `curl` and `node`: BigQuery, budgets, the bucket and Auth go through REST, because the `bq` CLI cannot find Python under Git Bash on Windows.
- **`packages/shared`.** Constants for crops, issues (`KNOWN_ISSUES` + `unknown`), verification states + v0 weights, confidence bands, the 0.6 review threshold, and roles. Schemas v0: observation, diagnosis (stored) + diagnosis model output (§6 contract), recommendation, registeredProduct, alert, org + user profile, plus shared wire primitives.
- **`apps/functions`.** Hono server (`src/server.ts`) serving tRPC at `/trpc` and the `/api/v1` REST stub (all six buildplan §2 routes answer 501), with `/health`, CORS for the dashboard origin, and JSON 404/500. esbuild bundles it to `dist/server.js`; `Dockerfile` (build from repo root) → `node:24-slim`, non-root, port 8080. `pnpm dev` now runs the API (tsx watch) next to Vite.
- **`apps/web`.** Created `src/pages/` and `src/sections/`. The tRPC client defaults to `http://localhost:3001/trpc`.
- **`.env.example`** replaced with CropWatch variables (names only, no secrets).

**Decisions and deviations from technicaldoc.md (flag any you disagree with)**

1. Invariants are enforced in the schemas, not only in services:
   - `DiagnosisSchema` rejects confidence < 0.6 or `unknown` unless `needs_expert_review: true`.
   - `ObservationSchema` rejects an expert-review observation marked `AI_ASSESSED`.
   - `ChemicalOptionSchema` is a `pick` of the regulatory row, so dose text can only be `label_dose`.
   - Recommendations need at least one citation.
2. A required `sim` flag is on orgs, users, alerts and recommendations as well as observations (invariant 5: "every synthetic row"). It is not on registered_products: those rows must always be real.
3. Alerts carry `contributing_factors` (≥ 1), because a risk level is never shown bare (invariant 2).
4. `field_officer` (outgrower staff) gets no direct Firestore/Storage read of observations (invariant 6). The officer queue and verify flow go through the API. Revisit at D7 if officers need live listeners.
5. Timestamps cross the wire as ISO-8601 strings. Converting to Firestore Timestamp is the API's job.
6. The health check is `/health`, not `/healthz`, because Cloud Run reserves paths ending in `z`. The local API port is 3001 because the Firestore emulator owns 8080.
7. Ran prettier over `docs/*.md` (whitespace only). CI `format:check` was failing on them, and the commit hook would apply it anyway.

**Verification**

- Every `ci.yml` step passes locally with turbo's cache bypassed: frozen install, `audit --audit-level high`, lint, `format:check`, typecheck, build, test (80 tests), `sync:lint`.
- The bundled server was run and exercised over HTTP. The Docker image was built and run the way Cloud Run runs it: port 8080, non-root, clean SIGTERM exit.
- Security rules: 17 emulator tests pass (scratch harness, not committed). They caught one real hole: Storage treats an overwrite as a create, so farmers could replace photo evidence. Fixed with `resource == null`.
- `setup.sh`: `bash -n` and shellcheck are clean. It was run five times against `crop-watch01`; the last two runs were full no-op re-runs (idempotent). Resources were then checked independently, read-only: locations, IAM bindings, exactly one budget, exactly one email channel. Bugs the live runs caught and fixed:
  - `bq` could not find Python under Git Bash, so BigQuery now goes through REST.
  - The new GCS service agent needed more than 30 s to reach IAM, so it now gets a ~3-minute retry window.
  - A failed `budgets list` was being read as "no budget", which would have created duplicates. Listing now uses the project scope and dies on error.
  - The budget emailed only billing-account admins, so it now also emails the project account. `enableProjectLevelRecipients` is silently dropped by the API, so a Monitoring channel is used and verified instead.
  - The summary claimed Auth was enabled when it wasn't.

**Needs Geoffrey**

- GitHub Actions cannot run: "account is locked due to a billing issue". CI is verified locally only, which doesn't block anything: deploys run from `infra/` scripts, not Actions.

**Carry-forward**

- **D5:** the `firebase` web SDK pulls `@grpc/grpc-js@1.9.16` (pinned by `@firebase/firestore`), which fails `pnpm audit --audit-level high` on GHSA-m9gg-hp2v-232j. That advisory is server-side and grpc-js is not in the browser bundle, but it needs an explicit risk-acceptance decision. The SDK also needs `'@firebase/util': false` and `protobufjs: false` under `allowBuilds`.
- **Any package:** adding `@types/node` splits vitest into two peer variants and breaks jest-dom matcher types. `web` and `ui` both carry `@types/node` so they share one vitest. Keep it that way.
- **D3:** ZEMA registration numbers may contain `/`, which is invalid in a Firestore document ID. Normalise the ID for `registered_products/{id}`.

### D2 · Tue 21 Oct (pulled forward) — contract freeze, /diagnose, first deploy

**Status:** accepted and merged to `main`. Live API: `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1` (revision `cropwatch-api-00002-5fn`, image `7560890`).

**Landed**

- **Contract frozen:** REST v1 1.0.0, with the four pre-freeze conditions (see §2). The Android app `zm.cropwatch.app` is registered, and `apps/mobile/README.md` is the mobile hand-off.
- **/diagnose:**
  - Model: `gemini-2.5-flash` on Vertex AI `europe-west1` via `@google/genai`. Its `responseJsonSchema` is built from the controlled vocabularies, the prompt is `prompts/diagnose-v1.md`, and `model_id` + `prompt_version` are stamped on every diagnosis.
  - Invalid output gets one retry, then routes to experts as `unknown` / `invalid_model_output`, never a crash. Quota and server errors (429/5xx) get their own backoff and don't use up that retry.
  - Routing is decided by the server, not the model. The observation gets bands only; the numbers go to `internal/diagnosis`.
- **Triggers:** `POST /observations` starts diagnosis in the background (Cloud Run keeps CPU allocated). Eventarc on Storage finalize posts to `/internal/events/storage`, which verifies the caller's Google-signed token. A lease stops the two triggers from double-running.
- **REST:** `POST /observations`, `GET /observations/{id}` and `/health` are live. `verify`, `intervention`, `outcome` and `alerts` answer 501 until D6/D7.
- **Deploy:** `infra/deploy.sh` (with `lib.sh` and `cloudbuild.yaml`) creates or reuses the Artifact Registry repo, a dedicated build service account with an in-region staging bucket, then runs Cloud Build in `europe-west1`, deploys Cloud Run, wires Eventarc and smoke-tests the health endpoint.
- **Tools (`tools/admin`):** `set-role` (pulled forward from D5) sets officer claims; `smoke-e2e` plays the mobile app against the live API.
- **UI lint rule:** `model_confidence`, `severity_pct` and probability/percent identifiers are banned in UI code (`web`, `ui`).

**Acceptance (buildplan §4.2)**

| Check                                    | Result                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| Real model, 12 labelled test images      | 12/12 schema-valid on the first attempt; 10/12 match the expected issue; slowest 12.5 s |
| First reply of each corrupted (retry)    | 12/12 recovered on the retry                                                            |
| Every reply corrupted                    | 12/12 routed to experts (`invalid_model_output`), no crash                              |
| Live round trip, upload then POST        | 7.7 s; all 15 checks (contract, live Storage/Firestore rules, internal numbers, stamps) |
| Live round trip, Eventarc as the trigger | 8.0 s warm (27 s on the very first delivery after the trigger was created)              |
| No numbers in UI-bound data              | Contract test + Firestore-document test + UI lint rule                                  |
| `pnpm` gate                              | install, audit, lint, format, typecheck, build, test (176 tests), syncpack: all green   |

The test images are public Wikimedia Commons photos, held outside the repo. The eval (`pnpm --filter @repo/functions eval:diagnose <dir>`) is reusable for D6 scoring of the 100 field photos.

**Found and fixed on the way**

- **Vertex quota:** Vertex returned 429 under a burst of requests, which routed good photos to experts. Fixed with a transient backoff that's separate from the invalid-output retry.
- **vitest split again:** the vitest peer split came back via firebase-admin's `@opentelemetry/api`. jest-dom's types are now declared in each consuming package, which supersedes the D1 `@types/node` workaround.
- **Cloud Build quota:** new projects have no Cloud Build quota for `E2_HIGHCPU_8` in `europe-west1`, so builds use the default worker.
- **Git Bash path rewriting:** Git Bash rewrote the Eventarc path `/internal/events/storage`. A scoped `MSYS2_ARG_CONV_EXCL` fixes it; the global `MSYS_NO_PATHCONV` breaks gcloud itself.
- **pnpm supply-chain check:** `pnpm deploy --offline` fails pnpm 12's supply-chain check, so the image's dependency step runs online.
- **Identity Toolkit quota project:** user credentials need a quota project (`GOOGLE_CLOUD_QUOTA_PROJECT`).
- **Token in error output:** a firebase-admin error dump printed a short-lived access token into local session output. `set-role` now prints only the error code and message.

**For D6 prompt tuning (not D2 gates):** one late-blight photo was called early blight with medium/high confidence, a confident miss. The mustard-leaf diamondback-moth photo came back `unknown` in one run and `diamondback_moth` in another.

**Needs Geoffrey**

- Before demo day, run `MIN_INSTANCES=1 bash infra/deploy.sh` to keep one instance warm (about US$2/day); revert to 0 afterwards.
- GitHub Actions is still blocked by the billing lock.

**Carry-forward**

- **D3 seed:** write the full frozen document shape: `district_slug`, `status`, bands, `sim: true`, and `internal/diagnosis` for simulated diagnoses.
- **D4:** `/recommend` moves `status` to `complete`; the D7 verify flow re-triggers it when the issue is corrected.
- **D6:** the BigQuery stream must include `internal/diagnosis` (frozen condition 4).
- **Rehearsals:** use `pnpm --filter @repo/admin-tools smoke-e2e --image <photo>`.

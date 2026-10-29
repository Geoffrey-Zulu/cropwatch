# Phytos — 10-Day Build Plan (21 → 30 October 2026)

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
│   ├── capture/                  # Capture PWA, the PRIMARY demo client (in the pnpm workspace; same contract as mobile)
│   └── mobile/                   # Flutter app (friend's track; in repo, OUTSIDE pnpm workspace; not schedule-critical)
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

> **Clients (scope change 2026-10-23).** The primary demo client is the **capture PWA** (`apps/capture`), not the Flutter app. Both consume this contract unchanged: REST v1 plus Firestore listeners, no new endpoints. Two things are browser-specific and change no contract: the API sends CORS headers on `/api/v1` for the PWA's origin, and because web clients cannot subscribe themselves to FCM topics, the PWA keeps its push token in `users/{uid}/push_tokens` (owner-only rules) for the alert dispatcher to subscribe to `alerts-{district_slug}`.

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

| Day              | Claude Code track (web + API + infra)                                                                                                                                                                                                                                      | Mobile track (friend)                                                                                  | Geoffrey non-code track                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 · Tue 21**  | Scaffold repo from Hytel template; CLAUDE.md + docs in; `infra/setup.sh` (APIs, Firebase, Firestore rules, budget alert); CI (lint/typecheck/build); Zod schemas v0 in `packages/shared`                                                                                   | Flutter project init in `apps/mobile`; Firebase SDK wired; screen skeletons (Home / Diagnose / Result) | Email organisers re: existing code. Confirm both pitchers were selected. Create/choose GCP project, share credentials with Claude Code |
| **D2 · Wed 22**  | **CONTRACT FREEZE**: REST v1 generated from Zod + committed; `/diagnose` service (Gen AI SDK, structured output, confidence bands, `needs_expert_review` routing); Eventarc on Storage finalize                                                                            | Capture flow: camera, GPS, crop + planting-date form; direct-to-Storage upload                         | Start corpus collection: MoA FAW manual 2nd ed., CABI Zambia factsheets, FAO IPM guides, ZARI material                                 |
| **D3 · Thu 23**  | Regulatory Product DB (`registered_products` + filter service, label-dose rendering); seed generator v0 (`tools/seed`, deterministic, `sim:true`, DEMO OUTGROWER CO.)                                                                                                      | Result screen: diagnosis card (confidence band, severity), Firestore doc listener                      | ZEMA register request; fallback = FAW-manual annex → send product rows to Claude Code as CSV                                           |
| **D4 · Fri 24**  | Corpus ingestion into RAG Engine (metadata: tier/crop/issue/year); `/recommend` — context-shaped retrieval, IPM ladder, citations, regulatory filter in line                                                                                                               | Report flow: submit observation, confirmation screen                                                   | Validation interviews round 1 (2 outgrowers if reachable; agro-dealers)                                                                |
| **D5 · Sat 25**  | **Capture PWA** (`apps/capture`, primary demo client); dashboard shell: NationalMapPage with live Firestore markers + DemoBadge; seeded data rendering; ObservationDetailPage. **END-TO-END #1** = PWA on a real Android phone over 4G → diagnose → recommend → on the map | Flutter continues against the frozen contract (no longer schedule-critical)                            | Take 100+ field photos (Lusaka West / Chongwe); note which crops are standing (demo-crop decision)                                     |
| **D6 · Sun 26**  | BigQuery streaming + cluster rule; Risk Model v0 (LOW/ELEVATED/HIGH + contributing factors); alerts: Pub/Sub → FCM + Africa's Talking SMS (sandbox)                                                                                                                        | FCM alerts receive + display; offline photo queue (store & forward)                                    | Score Gemini zero-shot against the 100 photos → tune prompt with Claude Code; church/rest as needed                                    |
| **D7 · Mon 27**  | OutbreakDetailPage + OutgrowerViewPage (priority visit lists, per-officer grouping); OfficerQueuePage + verify flow (verified counter)                                                                                                                                     | Officer mode: review queue, confirm/correct diagnosis                                                  | Validation interviews round 2; collect one quotable loss story                                                                         |
| **D8 · Tue 28**  | **FULL DEMO REHEARSAL** end-to-end on real devices; `--live-demo` seed sequence (presenter's report completes the cluster); bug burn-down                                                                                                                                  | Rehearsal participant; polish capture UX; error states                                                 | Draft Friday-night 90-second pitch + final pitch skeleton with pitchers                                                                |
| **D9 · Wed 29**  | **FREEZE.** Backup screen-recordings of every demo step; deploy stability check; tag release                                                                                                                                                                               | Freeze; build signed APK + backup phone                                                                | Pitch rehearsal ×2 with both presenters; pack kit (phones, cables, hotspot, printed one-pager)                                         |
| **D10 · Thu 30** | Buffer only — no planned work                                                                                                                                                                                                                                              | Buffer                                                                                                 | Arrive, settle, arrange the judge-SMS moment when judges are known                                                                     |

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

> Since 2026-10-23 the capture PWA (`apps/capture`) is the primary demo client, so this track is no longer on the critical path: the Flutter app is a bonus if it is ready, built against the same frozen contract.

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
| Capture PWA fails on the demo phone          | Plan B: the same PWA in a phone browser tab without installing (push off), on the backup phone; Flutter app if it is ready               |
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
- **`.env.example`** replaced with Phytos variables (names only, no secrets).

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

### D3 · Tue 21 Oct (pulled forward) — regulatory DB, filter, seed, demo ops

**Status:** accepted and merged to `main`. Live data: `registered_products` (7 placeholder rows), and 500 sim observations plus 332 sim users and DEMO OUTGROWER CO. in Firestore and in BigQuery `cropwatch.observations`.

**Landed**

- **Regulatory Product Database.** `registered_products` is loaded by `tools/regulatory/load-products.ts`. Every CSV row is validated against `@repo/shared`; the parser never trims, so `label_dose` stays byte-identical; the load is all-or-nothing; and the CSV is the whole register, so a dry-run plans and `--commit` syncs. Rows carry a required `source` (`zema` | `label` | `moa_faw_manual` | `placeholder`). The document ID is the percent-encoded registration number, because ZEMA numbers may contain `/`.
- **Placeholder register (`placeholder-products.csv`, 7 rows):**
  - covers maize/FAW, tomato/Tuta, tomato late and early blight, and cabbage/DBM;
  - includes one expired row and one registration number with a slash;
  - cassava and maize lethal necrosis deliberately have no products (viral diseases, IPM only).
  - The filter **excludes placeholders unless a caller explicitly allows them**, so they never reach a farmer as advice.
- **Regulatory filter and IPM ladder** (`apps/functions/src/services/recommend/`):
  - Candidates match a register row by exact registration number, or by trade name or active ingredient ignoring case and spacing. A match is accepted only if it's approved for this crop and issue and unexpired on the Lusaka calendar date. Every rejection is logged with a reason.
  - The ladder keeps only cited steps, ordered scout → cultural → biological → chemical. The chemical line is always written by Phytos, so doses come only from `label_dose`. If no chemical survives, the output is IPM-only plus the officer referral; with no cited evidence there is no recommendation at all.
  - The knowledge layer is an interface whose stub refuses until D4. Nothing is wired into the live pipeline yet.
- **Seed (`tools/seed`):**
  - Deterministic: a seeded PRNG plus an anchor time; the same anchor gives byte-identical data.
  - 500 sim observations over 21 days: an accelerating Eastern FAW storyline (180), the Lusaka/Chongwe Tuta storyline (120), and a sparse national background (200).
  - Every row has a `district_slug`; all four verification states appear; 332 sim users, including DEMO OUTGROWER CO. members and 6 field officers.
  - Diagnoses are stamped `sim-seed` (no Gemini calls), with internal numbers so BigQuery calibration queries have data.
  - `--live-demo` ages demo-issue reports near the venue out of the 72 h window and pre-arms 4 qualifying reports within 4 km. It refuses to write unless the §9 rule confirms the venue is exactly one report short, and it prints when the arming expires.
- **Supporting pieces:**
  - `packages/shared`: `geo.ts` (geohash, distance), approximate district centres, and the BigQuery row schema with `toObservationRow` (includes the internal numbers, per frozen condition 4; no `reporter_id`).
  - `tools/gcp`: the shared REST client for Firestore and BigQuery (load jobs, so sim rows can always be deleted).
  - `apps/web`: the `DemoBadge` component.
  - `infra/scale.sh`: sets the warm-instance floor without a rebuild.
  - `docs/demo-ops.md`: the morning-of checklist.

**Acceptance**

| Check                                                                                               | Result                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.3: only registered, crop- and issue-matched, unexpired chemicals; dose byte-identical to the row | A unit test per branch (registration no., trade name, ingredient, not registered, wrong crop, wrong issue, unknown issue, expired, expiring today, placeholder) plus a 300-trial property test |
| §4.3: zero chemicals → IPM-only + officer referral                                                  | Tested through to the contract view (`officer_referral: true`)                                                                                                                                 |
| §4.3: ≥ 1 citation on every response                                                                | Enforced by the schema; uncited evidence → no recommendation                                                                                                                                   |
| §4.4: deterministic across runs                                                                     | Same anchor → byte-identical; another anchor shifts only timestamps                                                                                                                            |
| §4.4: every row `sim: true`                                                                         | Tested; the seed refuses to write otherwise and only ever touches `sim-` ids                                                                                                                   |
| §4.4: DEMO badge whenever a sim row is displayed                                                    | `DemoBadge` tested (any sim row → shown, none → hidden); the D5 map mounts it                                                                                                                  |
| Live writes                                                                                         | Loader re-run shows 7 unchanged (exact round trip); seed re-commit replaces rather than duplicates (BigQuery: 500 rows, 500 distinct)                                                          |
| Seeded docs match the frozen contract                                                               | 3 sim observations read through the live API as an agronomist: valid views, nothing leaked; an anonymous farmer gets 403                                                                       |
| Live demo                                                                                           | Venue exactly one report short for Lusaka/Tuta and for Chipata/FAW (inside an outbreak); the presenter's report completes it                                                                   |
| `pnpm` gate                                                                                         | install, audit, lint, format, typecheck, build, test (251 tests across 8 packages), syncpack: all green                                                                                        |

**Found and fixed on the way**

- The seed CLI's `--demo-center=…` form was silently ignored, which would have dropped the venue coordinates. Arguments are now strict: both forms work, unknown flags and coordinates outside Zambia are errors.
- `pnpm --filter` runs scripts in the package directory, so the loader and `smoke-e2e` couldn't open repo-relative paths. Paths now resolve from `INIT_CWD`.

**Needs Geoffrey**

- Real register rows (MoA FAW-manual annex / ZEMA) as a CSV in the `placeholder-products.csv` format. Loading them removes the placeholders.
- Demo issue and venue coordinates for `--live-demo` (see `docs/demo-ops.md`).

**Carry-forward**

- **D4:** wire `recommend()` with RAG Engine as the knowledge layer and a Firestore products reader; set `status: complete` and `recommendation_id`. Decide whether to backfill recommendations for the seeded rows, which currently sit at `recommending` or `awaiting_expert_review`.
- **D5:** mount `DemoBadge` on every view of observations and alerts; officers sign in through `set-role`.
- **D6:** the §9 cluster rule in BigQuery. The JS reference (`tools/seed/cluster.ts`) and the coarse-grid SQL agree on the storylines; refine with `ST_DWITHIN` as technicaldoc says.

### D4 · Thu 23 Oct — corpus, RAG Engine, live /recommend, deploy

**Status:** accepted against the deployed service (revision `cropwatch-api-00004-tc8`) and merged to `main`.

**Landed**

- **Corpus fetcher (`tools/corpus/fetch`).** A curated `sources.yaml` (42 targets with tier, crop, issue, year and licence); not a crawler.
  - Live first, with an honest User-Agent, robots.txt and 1 request per 2 s per host; then the newest good Wayback snapshot; then mirrors.
  - PDFs that do not parse are rejected and the next copy tried. HTML becomes markdown with frontmatter.
  - `manifest.json` records the source, the copy fetched, sha256 and `needs_ocr`; `fetch-report.md` lists every failure and extraction concern.
  - `--import <id> <file>` records a document downloaded by hand. `pending:` marks one that will arrive by email (the MoA FAW manual, requested 2026-10-21).
  - The repository is public, so documents whose licence forbids redistribution (the CIMMYT guide, "all rights reserved"; the icipe manual, no licence) are fetched and ingested but kept out of git.
- **Corpus: 27 documents, 7 of the 8 priority ones.** The FAO FFS guide and guidance notes, the FAO/CABI ToT manual, the CIMMYT guide (from a mirror), ZARI crop guides and division pages, MoA pages (Wayback), and the five Zambian Plantwise PMDGs (Tuta, late and early blight, DBM, CMD), downloaded by Geoffrey because Plantwise refuses automated clients. No scanned PDFs. The MoA manual is pending by email.
- **RAG Engine (`infra/rag.sh`, `tools/corpus ingest`).**
  - RagManagedDb is allowlist-only in europe-west1 for new projects, so the corpus lives in **europe-west4** (an approved exception). europe-west1 RAG is set to Unprovisioned, and `infra/rag-teardown.sh` removes the corpus after the hackathon.
  - All 26 documents with content are in the corpus. Ingest imports one file at a time, paced below the embedding quota (about 7 requests a minute in europe-west4); re-ingesting is the same command.
- **Live /recommend (`apps/functions/src/services/recommend/`).**
  - Retrieval is context-shaped (crop, issue, stage, severity band, district). It keeps on-topic excerpts, at most 3 per document, ordered by authority tier.
  - Gemini writes IPM steps from those excerpts (`prompts/recommend-v1.md`). Each step is checked in code: it must cite an excerpt it was shown, and it is dropped if it carries a dose or interval or names a pesticide.
  - Chemicals the model names go to the regulatory filter as candidates; placeholders stay gated. No citations → no recommendation, and the observation goes to the officer queue.
- **Pipeline.** Any trigger (report, photo event, verify, retry) runs diagnose then recommend; each step is idempotent and holds a lease. Status goes `recommending → complete`. `POST /observations/{id}/verify` is live per the frozen contract: a correction re-runs the recommendation, and a run that a verify supersedes is discarded and repeated.
- **Gemini model change.** Gemini 2.5 retired on Vertex on **2026-10-20**, and europe-west1 serves no current Gemini model. Calls now go to **`gemini-3.5-flash-lite` on the EU multi-region endpoint** (`GEMINI_LOCATION=eu`), using `thinkingLevel` (Gemini 3.x rejects `thinkingBudget`). Chosen on the 12 test photos:

  | Model (EU endpoint)     | Schema-valid | Correct | Slowest | Note                                          |
  | ----------------------- | ------------ | ------- | ------- | --------------------------------------------- |
  | `gemini-3.5-flash-lite` | 12/12        | 11/12   | 6.4 s   | chosen; supported until at least July 2027    |
  | `gemini-3.5-flash`      | 9/12         | 11/12   | 184 s   | intermittent 45 s timeouts and 504s           |
  | `gemini-3.8-flash`      | 5/5 run      | 4/5     | 144 s   | 429s: a new model with little capacity for us |
  | `gemini-2.5-flash` (D2) | 12/12        | 10/12   | 12.5 s  | retired                                       |

- **Seed (decision a).**
  - Complete rows get a deterministic canned recommendation per issue. Its steps paraphrase the cited corpus documents (a test checks the citations against the manifest), carry no doses, end with the officer referral, and are `sim: true`.
  - 449 rows are complete and 43 await review, across both storylines. Rows whose issue the corpus cannot cite (maize lethal necrosis, unknown) wait for an officer too, as live reports do.
  - crop-watch01 is re-seeded: 492 observations, 449 recommendations.
- **Tools.** `eval:recommend` runs the real path for each issue. `e2e-timing` plays the app over a photo set against the deployed API and checks §4.3 on every live recommendation.

**Acceptance (deployed service)**

| Check                                                                        | Result                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.3: every chemical is a registered crop + issue match, dose byte-identical | Checked on every live recommendation against `registered_products`. None were shown (placeholders gated); model-named candidates were rejected as not registered |
| §4.3: zero chemicals → IPM-only + officer referral                           | 9/9 live recommendations end with the referral, `officer_referral: true`                                                                                         |
| §4.3: ≥ 1 citation on every response                                         | 9/9 (1–3 sources each); uncited → officer queue                                                                                                                  |
| Photo → diagnosis → recommendation → complete, 12 test photos                | **p50 5.4 s, p95 8.4 s** (max 8.4 s) to the final status. 9 complete (p50 6.2 s); 3 unknown reached the officer queue in ≤ 3.7 s                                 |
| A verify that corrects the issue re-triggers                                 | An agronomist's correction (FAW → late blight) went `recommending` → `complete` for the new issue in 3.6 s                                                       |
| Contract and rules (smoke-e2e, report path and Eventarc path)                | All checks pass; `model_id` is stamped `gemini-3.5-flash-lite`                                                                                                   |
| `pnpm` gate                                                                  | typecheck, lint, build, test (307 tests across 9 packages): all green                                                                                            |

**Found and fixed on the way**

- `pnpm fetch` is a pnpm built-in, so the fetcher's script is `fetch-corpus`.
- RAG Engine fails a file on the first embedding 429 instead of waiting, so multi-file imports silently lost 17 of 25 files. Imports now go one at a time, paced below the quota, with retries; retrieval retries 429s with backoff.
- A Wayback capture cut off at 1 MiB was saved before it failed to parse. PDFs are now validated before anything is written.
- The smoke test left recommendations behind once the pipeline went on to recommend; its cleanup now covers them.

**Needs Geoffrey**

- **Embedding quota:** request an increase for `textembedding-gecko` online prediction requests per minute in **europe-west4** (Cloud console → Quotas). At about 7 a minute, a burst of more than about 6 reports a minute queues retrievals.
- **The MoA FAW manual,** when it arrives: `pnpm --filter @repo/corpus fetch-corpus --import moa-faw-manual-2nd-ed-2026 <file>`, then `pnpm --filter @repo/corpus ingest`. The API picks it up within 10 minutes, and its products annex is extracted for review.
- **Real register rows** (still placeholders), as before.
- **Billing:** RagManagedDb (Spanner, europe-west4) costs about US$2–3 a day until `bash infra/rag-teardown.sh`.

**Carry-forward**

- **apps/capture (PWA)** is now the primary demo client (scope change); the Flutter app continues against the frozen contract.
- **D6:** score Gemini on the 100 field photos, and revisit `gemini-3.8-flash` once its capacity allows (supported until at least September 2027).
- **Retrieval quality:** the CBSD recommendation is thin (two steps) because the corpus has little CBSD guidance. Plantwise CBSD guides are in `sources.yaml` for hand download.

### D5 (part) · Thu 23 Oct — capture PWA, the primary demo client

**Status:** built and deployed at **https://crop-watch01-capture.web.app** (branch `d5-capture-pwa`). Acceptance waits on the real-hardware run: an Android phone over 4G, by Geoffrey. Merges to `main` after that run passes.

**Landed**

- **"Field Slip" design system** (was `design-system/cropwatch/MASTER.md`; replaced on 28 Oct by the Phytos "Field Brief" system in `design-system/phytos/MASTER.md`), shared with the dashboard. A report is a specimen slip, stamped as it moves; advice is a ladder with chemicals last. It draws on Lusaka's hand-painted shop signs, stencilled grain sacks and herbarium labels, with a miombo-woodland palette in place of agritech green. It is built for sunlight: body text ≥ 7:1 and actions ≥ 5:1 (computed), Atkinson Hyperlegible Next for reading.
- **`apps/capture`** (Vite + React PWA in the workspace) runs on the frozen REST v1 contract plus Firestore listeners, with no new endpoints. Screens:
  - **Diagnose:** camera through the capture input, photo resized to 1600 px before upload, GPS with a district picker as fallback.
  - **Report confirmation.**
  - **Result:** progressive (diagnosis, then the ladder), confidence in words only, routed reports with no advice.
  - **Home:** my reports and area alerts, with the DEMO badge on simulated rows.
- **Push:** FCM web push is wired in. Tokens go to `users/{uid}/push_tokens` under owner-only rules, because web clients cannot subscribe to topics.
- **Service worker:** precaches the app shell and the Latin fonts. The upload retry queue was cut (nice-to-have); a failed send keeps the photo and offers "Try again" with the same report id.
- **API and hosting:** the API sends CORS headers on `/api/v1` for the capture origins. A second Hosting site is deployed by `infra/deploy.sh` together with the rules it depends on.

**Acceptance so far**

| Check                                                                                                               | Result                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Installable PWA                                                                                                     | Manifest live (standalone, 192/512 and maskable icons, theme colour); service worker activated; `sw.js`, `index.html` and the manifest served no-cache |
| Full flow on the deployed PWA, in real headless Chrome as a 390 px Android phone with GPS at Chongwe                | Photo → upload → report accepted **2.9 s** · diagnosis on screen **6.9 s** · advice ready **7.7 s**; no console errors; test data removed afterwards   |
| CORS                                                                                                                | Capture origin allowed (preflight 204 with `authorization`); other origins get nothing                                                                 |
| `pnpm` gate                                                                                                         | typecheck, lint, build, test (13 capture tests, 101 API tests): all green                                                                              |
| **Real Android phone over 4G: install → photo → report → diagnosis + recommendation; the same report in Firestore** | **Pending: Geoffrey**                                                                                                                                  |

**Needs Geoffrey**

- **The phone run** (above). Send the 4-character report number so it can be checked in Firestore and the timing logged here.
- ~~A web-push key~~ — received 26 Oct; it lives in `apps/capture/src/lib/firebaseConfig.ts` and is deployed. Registration was verified on the deployed PWA: the token landed in `users/{uid}/push_tokens` (test data removed). Alerts reach it through the D6 dispatcher.

### D6 · Sun 26 Oct — clusters, Risk Model v0, alerts and SMS (logic only; dashboard screens wait for UI feedback)

**Status:** logic built and deployed (branch `d6-clusters-alerts`). §4.5 passes on the deployed API. §4.6 is measured as far as the SMS gateway: real SMS waits on Geoffrey's Africa's Talking account. Dashboard visuals are on hold until Geoffrey's UI feedback, as instructed.

**Landed**

- **Risk Model v0 and the cluster rule** live in `packages/shared/src/risk.ts`, one implementation for the seed and the API.
  - Cluster: ≥ 5 same-issue reports, weight ≥ 0.5, within 10 km, within 72 h. The spatial pass is BigQuery `ST_DWITHIN`; anchors merge in `mergeAnchors`.
  - Risk: LOW / ELEVATED / HIGH, always with contributing factors and never a number (technicaldoc §9).
- **Per-report tracking** runs beside the recommendation (`apps/functions/src/services/outbreaks/`) and never holds up the farmer's result:
  - a snapshot is streamed to `observation_events`;
  - clusters are detected over the `observations_latest` view;
  - `clusters/{id}` is upserted in one transaction per issue, with created / grown / unchanged / closed states;
  - `risk/{district}` and `risk_scores` are refreshed;
  - an alert is raised for a **new** cluster, or for a district that has just turned HIGH.
- **Dispatch** goes through Pub/Sub `cropwatch.alerts` and the push subscription `cropwatch-alerts-dispatch` to `/internal/events/alerts` (OIDC-checked):
  - FCM topic `alerts-{district}` for the mobile app;
  - FCM web push to the capture PWA's tokens;
  - SMS through Africa's Talking, which only logs until the account's secrets exist.

  A transactional claim means a redelivery never re-sends. Each channel fails on its own. Simulated alerts say DEMO on every channel.

- **`GET /api/v1/alerts`** is live (frozen contract shape).
- **BigQuery:** `observation_events`, `retracted_observations`, `risk_scores` and the `observations_latest` view all come from the shared schemas (`pnpm --filter @repo/seed tables`, run by `setup.sh`). `observations` gained `recorded_at`.
- **Seed:**
  - writes the outbreak state it implies: 6 sim clusters, risk for 33 districts, and their alerts with dispatch `skipped`;
  - clears a previous rehearsal's state;
  - refuses to arm the live demo unless the presenter's report would form a **new** cluster, because a grown cluster would not alert.
- **Tools:**
  - `outbreak-e2e`: the D6 acceptance run against the deployed API, undone afterwards;
  - `sms-subscribe`: E.164 numbers per district or all, with consent recorded; numbers are masked in output; no client can read them;
  - E2E cleanups now retract their test reports, so test traffic in Chongwe can never pre-empt the demo cluster.
- **Infra:** push subscription, Firestore rules for `clusters` (Command Center only) and `risk` (signed-in), the `push_tokens` collection-group index, `roles/firebasecloudmessaging.admin` for the API's service account, and the AT secrets mounted when present.

**Found by the first live run and fixed:** dispatch threw after claiming the alert, because the new `push_tokens` index was still building. Pub/Sub's retry was then acknowledged as "in progress" and the alert was never sent. Channel lookups now fail inside their channel. A delivery that finds another one mid-dispatch now answers 503, so Pub/Sub retries.

**Acceptance (deployed revision `cropwatch-api-00007-t4x`, `outbreak-e2e` playing the presenter ~1 km from the venue after `seed --commit --live-demo`)**

| Check                                                              | Result                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4.5 cluster within 60 s of the qualifying report                  | **Pass, twice in a row.** New 5-report cluster and its alert written **3.6 s** and **2.3 s** after the report was sent (alert `created_at`; the cluster is written just before it). The tool sees them later (9–12 s) because each of its Firestore reads fetches a gcloud token |
| Risk panel shows contributing factors, never a bare level          | Pass: Lusaka ELEVATED → **HIGH**, "Cluster of 5 Tuta absoluta (tomato leafminer) reports within 10 km (5 new in 24 h) · 22 reports this week (+175% on last week)"; no numbers that read as odds                                                                                 |
| §4.6 report → dispatched (FCM topic + web push + SMS gateway call) | Pass to the gateway: **7.4 s** and **5.8 s**, report sent → dispatch finished (alert → dispatched 3.7 s / 3.5 s). FCM topic `alerts-lusaka` accepted. One Pub/Sub delivery each, HTTP 200                                                                                        |
| §4.6 SMS on a registered phone in < 30 s                           | **Pending: Africa's Talking account.** Dispatch ran the log-only sender (0 subscribers). The remaining step is AT's own delivery time                                                                                                                                            |
| GET /alerts, sim flag, cleanup                                     | Pass: listed in the contract shape, `sim: true` (four seeded members), DEMO on every channel; test report retracted, cluster + alert removed, demo still armed                                                                                                                   |
| Rules (emulator)                                                   | Pass: clusters Command Center only; risk signed-in read; `sms_subscribers` and `alerts/*/internal/dispatch` closed to every client; earlier 19 rules tests still pass                                                                                                            |
| `pnpm` gate                                                        | typecheck, lint, build, test: green (126 API, 115 shared, 25 seed tests)                                                                                                                                                                                                         |

**Demo risk found:** `tuta-fruit.jpg` (a Wikimedia photo of Tuta damage on fruit) came back **early blight, high confidence**: a confident miss, so it correctly formed no cluster. The leaf photo is reliable (3/3). The presenter should photograph **leaf mines**, not fruit. Prompt tuning with the field photos is still open from D2.

**Needs Geoffrey**

- **Africa's Talking account** (only you can register; it needs your identity and payment):
  1. Sign up at africastalking.com and create a live app (username of your choice).
  2. Generate an API key (Settings → API Key) in the live app, and one in the sandbox app for testing.
  3. Store them: `printf '%s' "<username>" | gcloud secrets create africastalking-username --data-file=- --replication-policy=user-managed --locations=europe-west1 --project=crop-watch01`, and the same for `africastalking-api-key`. Then `bash infra/deploy.sh`. To test first without real texts, store username `sandbox` with the sandbox key; messages then show in AT's simulator.
  4. Top up a little airtime credit (Zambian SMS is billed per message).
  5. Request an alphanumeric sender ID ("Phytos") now for after the hackathon. It goes through ZICTA per carrier, MTN only displays pre-registered IDs, and it takes weeks, so the demo uses AT's default sender.
- **Subscribe the demo phones** (with consent): `pnpm --filter @repo/admin-tools sms-subscribe add --phone +260… --district Lusaka --consent "…"`; use `--district all` for the presenter's phone.

### D7 · Tue 28 to Wed 29 Oct — Phytos rebrand, "Field Brief" restyle, Command Center dashboard

**Status:** built, tested and deployed (branch `d7-phytos`). Acceptance against live data waits on the officer accounts, which only Geoffrey can create (they grant roles): see `docs/demo-ops.md`, "Officer accounts". Category 2 (landing page, dry-forecast scenario) has not started: the brief allows it only once D7 passes acceptance.

**Landed**

- **Rebrand to Phytos** on every user-facing surface. Infrastructure keeps its names. Versioned prompts are untouched: they are model-facing.
- **"Field Brief" design system** (`design-system/phytos/MASTER.md`): paper, navy, copper, and muted green for guidance only. Derived shades exist only where the given colours could not carry text.
- **Capture restyle**: same layouts; the app opens on a live camera viewfinder. No em dashes in UI copy.
- **Alert classes**: weather advisory / verified cluster alert / model risk signal, each with uncertainty wording, shared by the app, the dashboard, push and SMS. A cluster alert becomes "verified" when an officer verifies any report in it, and follows later verifications.
- **Weather context** from Open-Meteo. Guide notes come from the corpus; the thresholds are Phytos prototype thresholds and are labelled as such. Weather counts as a factor, never sets a level, and raises weather advisories (never sent by SMS).
- **Dashboard** (`apps/web`):
  - national map;
  - outbreak detail;
  - observation detail with the Evidence panel;
  - officer queue with verify and the live verified counter;
  - Outgrower View with per-officer visit lists;
  - Knowledge sources page.
- **tRPC procedures** with role guards: evidence, outgrower, weather.
- **Architecture**: `docs/architecture.md` and `.svg`.
- **Runbook**: `docs/demo-ops.md` retimed to the 3-minute final.

**Checks**

| Check                                         | Result                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm` gate                                   | Green. Typecheck, lint, build, and tests: 369 across 10 packages (138 API, 120 shared, 25 seed, 13 capture, 8 dashboard)                                                                                                                                                                                      |
| Invariants in tests                           | Outgrower output has no coordinate (schema plus string check). Evidence carries no `model_confidence`. No copy string has an em dash or reads as odds. Verification copy says "test case", never learning                                                                                                     |
| tRPC guards                                   | Unsigned calls get 401. Evidence is for Command Center roles only. Outgrower is for the Command Center or the org's own field officers                                                                                                                                                                        |
| Every page rendered with seed fixtures        | Desktop 1440 px and phone 390 px with no horizontal scroll (`docs/ui-review/2026-10-29/`)                                                                                                                                                                                                                     |
| Live, revision `cropwatch-api-00008-2b7`      | `outbreak-e2e` passes: report → dispatched in 9.2 s. The new cluster's alert is stored as a **model risk signal** (0 of 5 verified). Lusaka's factors include the live Open-Meteo line. A **weather advisory** (Tuta, late dry season) was raised and not dispatched. Rehearsal removed and the demo re-armed |
| Deployed                                      | Dashboard https://crop-watch01.web.app ("Phytos Command Center"); capture https://crop-watch01-capture.web.app (manifest "Phytos"); unsigned tRPC calls get 401                                                                                                                                               |
| **Live: sign in, map, verify, counter ticks** | **Pending: officer account (Geoffrey)**                                                                                                                                                                                                                                                                       |

### D8 · Wed 29 Oct — "Field Signal" UI pass, PMDG register live, dry-spell scenario, freeze

**Landed**

- **"Field Signal" design system** (`design-system/phytos/MASTER.md`, `philosophy.md`) replaces the navy/copper "Field Brief": one identity in two exposures. The Command Center is the night console (dark ground, glowing risk districts, chartreuse cluster rings); the capture app is the day exposure (wordmark on its dark chip, smaller headline, chartreuse sticky Send report). Bricolage Grotesque, IBM Plex Mono for every label, Instrument Sans. Same layouts, same wording.
- **Density**: alerts are one-line signal rows; districts to watch are one line each; visit lists are one line per farm with reason chips (`reason_codes`, an additive tRPC field); one emphasised figure per view.
- **PMDG register live**: 17 rows from the four tomato and cabbage PMDGs (`source: plantwise_pmdg`), doses verbatim from the guides; the seven placeholders retired. The UI shows "Plantwise Zambia PMDG" and "Dose (from the guide)", never the `PMDG-…` id as a registration number. Spot-check list for Geoffrey: `docs/pmdg-spot-check.md`. Excluded: cassava mosaic cypermethrin (the guide advises against it for smallholders); copper and mancozeb + metalaxyl (no PHI in the guides).
- **Dry-spell scenario** (prototype, behind `VITE_FEATURE_SCENARIO`, on in `infra/deploy.sh`): "If the next 14 days turn dry, which camps need closer monitoring?" Open-Meteo forecast or the canned dry spell × crop-stage table (each row quotes its guide or says it is a Phytos assumption) × verified reports; camps ranked with reasons; no free text, no yields. Browser-only: it never calls the Phytos API.
- **Landing page cut** from hackathon scope (post-event).
- **Freeze**: tag `freeze-2026-10-29`; printed morning checklist (`docs/morning-checklist.pdf`); Saturday test plan (`docs/hackathon-backlog.md`).

**Checks**

| Check                                              | Result                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm` gate                                        | Green: typecheck, lint, build; tests 387 (139 API, 122 shared, 25 seed, 18 regulatory, 16 dashboard, 14 capture, …)                                                                        |
| UI review                                          | The same 12 views before and after, plus the scenario: `docs/ui-review/2026-10-29-field-signal/`                                                                                           |
| Contrast                                           | Every text token ≥ 4.5:1 on its ground in both exposures; input borders ≥ 3:1 (MASTER.md §3)                                                                                               |
| Deployed                                           | API `cropwatch-api-00009-lh7`; capture and dashboard on Hosting; dashboard redeployed with the scenario on                                                                                 |
| Register                                           | `load-products --commit`: 17 added, 7 placeholders removed; a live row parses; spot-check by Geoffrey pending (`verified_by`)                                                              |
| Live smoke (Tuta leaf)                             | Diagnosed Tuta absoluta, high confidence, in 2.6 to 3.1 s; advice complete. The model proposed no chemical, so the advice was IPM-only with the officer referral (PMDG rows not exercised) |
| Live demo armed at the venue                       | `-15.388311, 28.346069`: 4 qualifying reports; armed until 31 Oct 20:46 UTC. Re-arm on the pitch morning                                                                                   |
| Two automated demo runs at the venue               | `outbreak-e2e` ×2: all checks passed; report → dispatched in 8.0 s and 7.6 s; SMS log-only (no Africa's Talking secrets yet); cleaned up                                                   |
| **Human runs, backup recordings, officer sign-in** | **Pending: the team, on the real devices, with officer accounts**                                                                                                                          |

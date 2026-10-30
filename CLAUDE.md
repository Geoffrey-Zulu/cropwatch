# CLAUDE.md — Phytos repo instructions

Phytos (Team Phytos; formerly CropWatch): early-warning and crop-health intelligence prototype for Zambia. GreenCode Hackathon (Lusaka, 30 Oct – 1 Nov 2026). Read `docs/buildplan.md` (schedule, work packages, acceptance criteria) and `docs/technicaldoc.md` (data model, contracts, corpus, demo runbook) before building anything. Where they conflict, buildplan.md wins.

## Invariants — never violate, even under time pressure

1. The LLM NEVER determines pesticide legality or dosage. Every chemical recommendation passes the deterministic filter against `registered_products`; doses are rendered byte-identical from `label_dose`. Zero matches → IPM-only output + officer referral.
2. No numeric outbreak probabilities anywhere. Risk is a qualitative prototype signal (LOW / ELEVATED / HIGH) with contributing factors always displayed.
3. `model_confidence` is internal. UI shows qualitative bands ("AI assessment: high confidence"), never percentages, never the word "probability".
4. Low confidence (< 0.6) or `suspected_issue == "unknown"` → `needs_expert_review: true` and the officer queue. Never guess.
5. Every synthetic row carries `sim: true`; any view displaying a sim row renders the `DemoBadge` ("DEMO DATA · SIMULATED").
6. Farmer-level data: consented, access-controlled; precise locations never appear in Outgrower/commercial views — aggregates and camp/district level only.
7. Use the Google Gen AI SDK (`google-genai`). Never `vertexai.generative_models` (deprecated).
8. "Where to buy" lists ALL registered options for the issue, renders only after the recommendation, never sponsor-filtered.
9. Never imply auto-learning. Officer-verified observations are evaluation data: "every correction becomes a test case". Never claim the model learns or improves from corrections.
10. Every alert shows its class (weather advisory / verified cluster alert / model risk signal) with its uncertainty wording (`alertUncertainty` in `packages/shared`). "Verified" means at least one report in it was verified by an officer, nothing less.

## Environment

- **GCP / Firebase project:** `crop-watch01` · **Authorized account:** `zulugeoffrey034@gmail.com` — use this account for ALL gcloud/firebase commands, not any other logged-in account.
  - `gcloud auth login zulugeoffrey034@gmail.com && gcloud config set project crop-watch01`
  - `firebase login` (same account) · `firebase use crop-watch01`
- **Default region:** `europe-west1` for Cloud Run, Firestore, Storage, BigQuery and everything else (good latency from Zambia). Set once in `infra/lib.sh`; don't add regions beyond these two sanctioned exceptions, both EU:
  - **Gemini → `eu` multi-region endpoint** (`GEMINI_LOCATION`). europe-west1 serves no current Gemini model (2.5 retired on Vertex 2026-10-20; 3.x is global/multi-region only). Model: `gemini-3.5-flash-lite` (GA until at least 2027-07), configurable via `GEMINI_MODEL`. Gemini 3.x takes `thinkingLevel`, not `thinkingBudget`.
  - **RAG Engine corpus → `europe-west4`** (`RAG_REGION`). RagManagedDb is allowlist-only in europe-west1. Only public documents and query text (crop, issue, stage, district) go there. Unprovision after the hackathon with `infra/rag-teardown.sh`.
- **Firebase web app config** (public client config — safe to commit) lives at `apps/web/src/lib/firebase.ts`:
  - apiKey `AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU` · authDomain `crop-watch01.firebaseapp.com` · projectId `crop-watch01` · storageBucket `crop-watch01.firebasestorage.app` · messagingSenderId `24960589333` · appId `1:24960589333:web:cbe577be90032352c4f81c`
  - Drop `measurementId`/Analytics — not needed; do NOT init `getAnalytics` (breaks in non-browser contexts and adds nothing to the demo).
- Billing must be enabled on `crop-watch01` and these APIs on (setup.sh enables them): `aiplatform`, `run`, `eventarc`, `firestore`, `storage`, `bigquery`, `pubsub`, `cloudfunctions`, `secretmanager`, `cloudbuild`.
- Server-side auth: Application Default Credentials (`gcloud auth application-default login`) locally; service accounts on Cloud Run. Never download SA key files.

## This repo's template (identified 2026-10-21 — do not re-derive)

- This is the **React/Vite + Firebase Hytel template** (`hytel-react-boilerplate`): Vite + React 18 in `apps/web`, tRPC 11 library in `apps/functions`, imports scoped `@repo/*`, pnpm 12, Node ≥ 24, Tailwind 3, Vitest. Judge structure against THIS template only.
- **Known template gaps — resolve as Day 1 work, they are not breakage:** no `firebase.json`, no Firestore/Storage rules, `apps/web/src` has no `pages/` or `sections/` yet (create them), `.env.example` carries placeholder entries (replace with Phytos vars), and `apps/functions` has no server/deploy entrypoint.
- **Backend deploy decision:** `apps/functions` stays a tRPC router library; add a server entrypoint (Hono) that serves tRPC at `/trpc` and the mobile REST adapter at `/api/v1`, containerize it, deploy to **Cloud Run** via an idempotent `infra/deploy.sh`. Do NOT use the template's Firebase-Functions bundling path, and ignore the `deploy-dev/stage/main` WIF workflows for the hackathon (leave the files; keep `ci.yml` running lint/typecheck/build/test).
- buildplan.md D1's "scaffold repo from Hytel template" is DONE (this repo). D1 now means: the gap-resolution above + `infra/setup.sh` + schemas v0.

## Brand and copy (rebrand 28 Oct 2026)

- The product is **Phytos** (Team Phytos), formerly CropWatch. Every user-facing surface says Phytos: apps, manifests, page titles, push and SMS templates ("Phytos DEMO alert"), docs.
- **Infrastructure keeps its names**: GCP project `crop-watch01`, Cloud Run `cropwatch-api`, topic `cropwatch.alerts`, BigQuery dataset `cropwatch`, buckets, secrets, the repo. Never rename infrastructure for the brand.
- Versioned prompts (`prompts/*-v1.md`) still say CropWatch: they are model-facing and stamped by version; rename only in a new prompt version.
- **No em dashes in any UI copy** (rendered strings, notifications, SMS). Use a colon, a full stop or a middle dot. Model-written text goes through `withoutEmDash` for display (never a label dose).
- **Design.** The capture app follows the Phytos "Field Signal" day exposure (`design-system/phytos/MASTER.md`). The **Command Center follows `design-system/phytos/patterns-v2.md`** (dashboard v2, 29 Oct): progressive disclosure (each page answers one question; title then content, no question line under it since 30 Oct; detail opens in right-side drawers, deeper evidence behind expanders), a neutral white console with one blue accent (`#2160C4`, `theme-console`), amber and red-gold for risk only, at most four colour roles a screen, borders only on controls, Instrument Sans throughout (Plex Mono for ids and doses, Bricolage only in the wordmark), sentence case, at most one chip a row, shimmer skeletons instead of spinners (a spinner only inside a busy button), Lucide icons at 20 px with a 1.5 px stroke, figures as stat cards, the DEMO badge as a quiet pill on the data it marks, never in the chrome (polish, 30 Oct). Every deploy runs `pnpm --filter @repo/visual shots` (laptop and phone, all views) and every shot is looked at before a tag.
- **UI window:** dashboard v2.1 (29 Oct) is the keeper structure. Saturday 31 Oct at the venue is point-and-fix polish on it, with no re-architecture; hard freeze 18:00 Saturday. After the freeze, UI feedback is logged to `docs/ui-feedback-log.md`, not built, until after the final pitch on Sunday 1 Nov. The map as a full canvas is post-event.
- **Register rows from a Plantwise PMDG** (`source: plantwise_pmdg`) show "Source: Plantwise Zambia PMDG" and "Dose (from the guide)"; their `PMDG-…` id is never shown as a registration number.
- **Grounded language**: a prototype, not a platform. Since 30 Oct the word "prototype" is not in UI copy; signals are "risk signals from reports, not a forecast"; models "assess", officers "verify". No "predicts", "revolutionary", "AI-powered platform".

## Conventions

- Hytel Way monorepo: pnpm + Turborepo. Reusable UI → `packages/ui`; app-specific → `apps/<app>/src/components`; pages `*Page.tsx`; sections `*Section.tsx`; hooks `use*`; tRPC routers in `apps/functions/src/trpc/routers/`; every schema/type shared by FE+BE lives in `packages/shared` as Zod + `z.infer`; import scope is `@repo/*` (matches this repo), e.g. `import { ObservationSchema } from '@repo/shared'`.
- `apps/capture` (Vite + React PWA) is the **primary demo client** and is IN the pnpm workspace. It consumes the frozen `/api/v1` contract and Firestore listeners exactly as the mobile app would (no new endpoints, no contract changes) and follows the Phytos "Field Signal" design system (`design-system/phytos/MASTER.md` and `philosophy.md`, tokens in `packages/ui/theme/phytos.css`) in its day exposure. The app opens straight to the camera. Deployed to its own Hosting site by `infra/deploy.sh`.
- `apps/mobile` (Flutter) is unchanged: in the repo but OUTSIDE the pnpm workspace, no longer schedule-critical. Never import from it; it consumes only `packages/shared/src/contracts/openapi.json`.
- **Contract freeze:** after Day 2, `packages/shared/src/contracts/openapi.json` and the `/api/v1` REST surface only gain optional fields — no renames, no removals, no type changes. Regenerate the file from Zod on any additive change and commit it.
- Controlled vocabulary for crops/issues lives in `packages/shared/src/constants/` — the Gemini response schema, the regulatory DB and the dashboard all reference it; never free-string an issue name.
- Versioned prompts in `prompts/`; stamp `prompt_version` and `model_id` on every diagnosis written.
- Infra only via scripts in `infra/` (idempotent); secrets in Secret Manager, never in code or env files committed.

## Definition of done per work package

Acceptance criteria are in `docs/buildplan.md` §4 — check them before marking a package complete. Minimum for any package: `pnpm typecheck && pnpm lint && pnpm build` green; demo-path behaviour verified by actually running it, not by reading the code.

## Build order

Follow buildplan.md §3 day by day. Cut lines when behind (in order): WhatsApp → Earth Engine → officer mobile mode → on-device triage → Nyanja templates. The demo path (photo → diagnose → recommend → map → cluster → SMS → verify → Outgrower View) is sacred: nothing that risks it ships after Day 8.

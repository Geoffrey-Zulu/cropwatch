# CLAUDE.md — CropWatch repo instructions

CropWatch: early-warning and crop-health intelligence platform for Zambia. GreenCode Hackathon (Lusaka, 30 Oct – 1 Nov 2026). Read `docs/buildplan.md` (schedule, work packages, acceptance criteria) and `docs/technicaldoc.md` (data model, contracts, corpus, demo runbook) before building anything. Where they conflict, buildplan.md wins.

## Invariants — never violate, even under time pressure

1. The LLM NEVER determines pesticide legality or dosage. Every chemical recommendation passes the deterministic filter against `registered_products`; doses are rendered byte-identical from `label_dose`. Zero matches → IPM-only output + officer referral.
2. No numeric outbreak probabilities anywhere. Risk is a qualitative prototype signal (LOW / ELEVATED / HIGH) with contributing factors always displayed.
3. `model_confidence` is internal. UI shows qualitative bands ("AI assessment: high confidence"), never percentages, never the word "probability".
4. Low confidence (< 0.6) or `suspected_issue == "unknown"` → `needs_expert_review: true` and the officer queue. Never guess.
5. Every synthetic row carries `sim: true`; any view displaying a sim row renders the `DemoBadge` ("DEMO DATA — SIMULATED").
6. Farmer-level data: consented, access-controlled; precise locations never appear in Outgrower/commercial views — aggregates and camp/district level only.
7. Use the Google Gen AI SDK (`google-genai`). Never `vertexai.generative_models` (deprecated).
8. "Where to buy" lists ALL registered options for the issue, renders only after the recommendation, never sponsor-filtered.

## Environment

- **GCP / Firebase project:** `crop-watch01` · **Authorized account:** `zulugeoffrey034@gmail.com` — use this account for ALL gcloud/firebase commands, not any other logged-in account.
  - `gcloud auth login zulugeoffrey034@gmail.com && gcloud config set project crop-watch01`
  - `firebase login` (same account) · `firebase use crop-watch01`
- **Default region:** `europe-west1` for Cloud Run, Firestore, Storage and Gemini/Vertex calls (good latency from Zambia, full product coverage). Set once in `infra/setup.sh`; never mix regions.
- **Firebase web app config** (public client config — safe to commit) lives at `apps/web/src/lib/firebase.ts`:
  - apiKey `AIzaSyB6brxOl9sgWsf7X059B1rZvLiWXCPDTqU` · authDomain `crop-watch01.firebaseapp.com` · projectId `crop-watch01` · storageBucket `crop-watch01.firebasestorage.app` · messagingSenderId `24960589333` · appId `1:24960589333:web:cbe577be90032352c4f81c`
  - Drop `measurementId`/Analytics — not needed; do NOT init `getAnalytics` (breaks in non-browser contexts and adds nothing to the demo).
- Billing must be enabled on `crop-watch01` and these APIs on (setup.sh enables them): `aiplatform`, `run`, `eventarc`, `firestore`, `storage`, `bigquery`, `pubsub`, `cloudfunctions`, `secretmanager`, `cloudbuild`.
- Server-side auth: Application Default Credentials (`gcloud auth application-default login`) locally; service accounts on Cloud Run. Never download SA key files.

## This repo's template (identified 2026-10-21 — do not re-derive)

- This is the **React/Vite + Firebase Hytel template** (`hytel-react-boilerplate`): Vite + React 18 in `apps/web`, tRPC 11 library in `apps/functions`, imports scoped `@repo/*`, pnpm 12, Node ≥ 24, Tailwind 3, Vitest. Judge structure against THIS template only.
- **Known template gaps — resolve as Day 1 work, they are not breakage:** no `firebase.json`, no Firestore/Storage rules, `apps/web/src` has no `pages/` or `sections/` yet (create them), `.env.example` carries placeholder entries (replace with CropWatch vars), and `apps/functions` has no server/deploy entrypoint.
- **Backend deploy decision:** `apps/functions` stays a tRPC router library; add a server entrypoint (Hono) that serves tRPC at `/trpc` and the mobile REST adapter at `/api/v1`, containerize it, deploy to **Cloud Run** via an idempotent `infra/deploy.sh`. Do NOT use the template's Firebase-Functions bundling path, and ignore the `deploy-dev/stage/main` WIF workflows for the hackathon (leave the files; keep `ci.yml` running lint/typecheck/build/test).
- buildplan.md D1's "scaffold repo from Hytel template" is DONE (this repo). D1 now means: the gap-resolution above + `infra/setup.sh` + schemas v0.

## Conventions

- Hytel Way monorepo: pnpm + Turborepo. Reusable UI → `packages/ui`; app-specific → `apps/web/src/components`; pages `*Page.tsx`; sections `*Section.tsx`; hooks `use*`; tRPC routers in `apps/functions/src/trpc/routers/`; every schema/type shared by FE+BE lives in `packages/shared` as Zod + `z.infer`; import scope is `@repo/*` (matches this repo), e.g. `import { ObservationSchema } from '@repo/shared'`.
- `apps/mobile` (Flutter) is in the repo but OUTSIDE the pnpm workspace. Never import from it; it consumes only `packages/shared/src/contracts/openapi.json`.
- **Contract freeze:** after Day 2, `packages/shared/src/contracts/openapi.json` and the `/api/v1` REST surface only gain optional fields — no renames, no removals, no type changes. Regenerate the file from Zod on any additive change and commit it.
- Controlled vocabulary for crops/issues lives in `packages/shared/src/constants/` — the Gemini response schema, the regulatory DB and the dashboard all reference it; never free-string an issue name.
- Versioned prompts in `prompts/`; stamp `prompt_version` and `model_id` on every diagnosis written.
- Infra only via scripts in `infra/` (idempotent); secrets in Secret Manager, never in code or env files committed.

## Definition of done per work package

Acceptance criteria are in `docs/buildplan.md` §4 — check them before marking a package complete. Minimum for any package: `pnpm typecheck && pnpm lint && pnpm build` green; demo-path behaviour verified by actually running it, not by reading the code.

## Build order

Follow buildplan.md §3 day by day. Cut lines when behind (in order): WhatsApp → Earth Engine → officer mobile mode → on-device triage → Nyanja templates. The demo path (photo → diagnose → recommend → map → cluster → SMS → verify → Outgrower View) is sacred: nothing that risks it ships after Day 8.

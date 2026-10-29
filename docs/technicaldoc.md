# Phytos — Technical Reference (v1.1)

> **Purpose of this file:** implementation reference for Claude Code (and human devs) during the GreenCode Hackathon build, 30 Oct – 1 Nov 2026, Lusaka. It encodes the final agreed strategy (v1.1, post red-team by two AI reviewers). The companion PDF is the team/pitcher strategy document; this file is the build spec.
>
> **Golden rules (never violate, even under time pressure):**
>
> 1. The LLM is NEVER the source of truth for pesticide legality or dosage. All product recommendations pass through the deterministic Regulatory Product Database filter.
> 2. Never display numeric outbreak probabilities. Risk is a qualitative **prototype signal** (LOW / ELEVATED / HIGH) from transparent rules.
> 3. `model_confidence` ≠ accuracy. UI shows qualitative bands ("high confidence"). Never present LLM confidence as calibrated probability.
> 4. All synthetic/demo data is visibly labelled. The dashboard carries a permanent **DEMO DATA — SIMULATED** badge during the hackathon.
> 5. AI predictions are never ground truth: every observation carries a verification state.
> 6. Low model confidence → route to expert review (`needs_expert_review: true`), never guess.
> 7. Farmer-level data: consented, access-controlled, aggregated before any commercial analytics. Precise farm locations never exposed to commercial customers.
> 8. Use the **Google Gen AI SDK** (`google-genai`). Do NOT use deprecated `vertexai.generative_models`.

---

## 1. Concept (one paragraph)

Phytos is an **early-warning and crop-health intelligence prototype**. Free farmer/field-officer reporting (app + WhatsApp/USSD/SMS) produces geotagged, AI-assessed, human-verifiable crop-health observations. Aggregation turns them into surveillance (clusters, spread) and operational decisions ("which farms should field officers visit this week") for organisations managing farmer networks — outgrowers first. Detection is the data-collection mechanism, not the product. We claim **detection** and **surveillance** at MVP; **prediction** is a prototype risk signal only.

Positioning: we connect and operationalise existing systems (MoA/ZARI PlantVillage, FAO FAMEWS, e-extension) — we do not replace them.

## 2. Capability claims discipline

| Capability                                         | Claim level    | Implementation                                                     |
| -------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Detection ("something is happening on this farm")  | Claimed at MVP | Gemini multimodal diagnosis, structured output, confidence routing |
| Surveillance ("something appears to be spreading") | Claimed at MVP | BigQuery GIS cluster rule, live map                                |
| Prediction ("likely to happen next")               | Prototype only | Risk Model v0, qualitative signal, explicitly unvalidated          |

Language rules for UI/pitch: "prototype risk signal", "Phytos Risk Model v0", "simulated historical observations", "AI assessment: high confidence". Banned: "94% chance", "predicts outbreaks", "5× more targeted", "free forever".

## 3. Stack

| Layer                      | Technology                                                                                         | Notes                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile app                 | Flutter                                                                                            | 3 screens MVP: Home, Diagnose, Result. Field-officer mode adds Visit List + Confirm/Intervene/Outcome                                                                |
| Auth / storage / integrity | Firebase Auth, Cloud Storage for Firebase, App Check                                               | Anonymous auth OK for demo farmers; role claims for officers                                                                                                         |
| Messaging channels         | Africa's Talking (SMS, USSD), WhatsApp Business API (stretch)                                      | SMS is first-class; WhatsApp is a cut-line item                                                                                                                      |
| API / services             | Cloud Run (one service, multiple routes; or per-route services)                                    | Event-driven via Eventarc on Storage finalize                                                                                                                        |
| GenAI                      | Gemini via **Google Gen AI SDK** on Gemini Enterprise Agent Platform (formerly Vertex AI Platform) | Structured JSON output enforced (response_schema). `gemini-3.5-flash-lite` on the `eu` multi-region endpoint (2.5 retired 2026-10-20; europe-west1 serves no Gemini) |
| RAG                        | RAG Engine, RagManagedDb backend                                                                   | Zambia-first metadata ranking. Corpus in europe-west4 (RagManagedDb is allowlist-only in europe-west1)                                                               |
| Regulatory DB              | Firestore collection (or Cloud SQL if relational needs grow)                                       | Deterministic filter; see §8                                                                                                                                         |
| Live state                 | Firestore                                                                                          | Dashboard listens via snapshots                                                                                                                                      |
| History / analytics        | BigQuery (+ GIS functions)                                                                         | Cluster detection, spread rates                                                                                                                                      |
| Geo/env context            | Google Maps Weather API; Earth Engine (CHIRPS rainfall, NDVI) via BigQuery `ST_REGIONSTATS`        | Earth Engine is architecture, NOT MVP critical path                                                                                                                  |
| Eventing                   | Pub/Sub → Cloud Functions                                                                          | Alert fan-out                                                                                                                                                        |
| Push                       | FCM                                                                                                | Farmer + institutional alerts                                                                                                                                        |
| Dashboard                  | Next.js on Firebase App Hosting (runs on Cloud Run), Google Maps JS                                | Custom-built; not Looker Studio                                                                                                                                      |
| On-device triage (stretch) | Google AI Edge / LiteRT small multimodal model                                                     | Kill switch; cut first if flaky                                                                                                                                      |

## 4. Data model

### 4.1 Firestore collections

> **Revised 2026-10-21 with the REST v1 contract freeze.** Source of truth: the Zod schemas in `packages/shared/src/schemas/`. The app may listen to `observations/{obsId}` directly, so that document is UI-bound: it carries qualitative bands only. Raw model numbers live in the client-unreadable sub-document `observations/{obsId}/internal/diagnosis`. Every collection that can hold synthetic rows carries a required `sim`.

```
users/{userId}
  role: "farmer" | "field_officer" | "extension_officer" | "agronomist" | "admin"
  org_id: string | null            // outgrower/NGO the reporter belongs to
  district: string, province: Province   // Province = one of Zambia's 10
  channel: "app" | "whatsapp" | "sms" | "ussd"
  sim: boolean

orgs/{orgId}                        // e.g. DEMO OUTGROWER CO.
  name, type: "outgrower" | "ngo" | "gov" | "input_company"
  enrolled_farmer_count: number
  sim: boolean

observations/{obsId}                // the core entity
  reporter_id, reporter_role, org_id
  created_at: timestamp
  location: geopoint                // precise; NEVER exposed to commercial views
  geohash: string                   // for cheap proximity queries
  district: string                 // as submitted
  district_slug: string            // normalised; THE aggregation key (clusters, alerts, FCM topics)
  province: Province
  camp: string | null              // rarely known at capture
  crop: "maize" | "tomato" | "cabbage" | "cassava" | "soybean" | ...
  planting_date: date | null
  growth_stage: string | null       // e.g. "V6", "vegetative", "flowering"
  photo_paths: string[]             // observations/{uid}/{obsId}/{n}.jpg (uid = uploader)
  farmer_description: string | null
  status: "diagnosing" | "awaiting_expert_review" | "recommending" | "complete"
  diagnosis: {                      // written by /diagnose; bands only (UI-bound)
    suspected_issue: string         // canonical issue slug, e.g. "fall_armyworm"
    confidence_band: "low" | "medium" | "high"   // low ⇔ model_confidence < 0.6
    severity_band: "none" | "low" | "moderate" | "severe" | null   // null if output unusable
    visible_symptoms: string[]
    needs_expert_review: boolean
    expert_review_reason: "low_confidence" | "unknown_issue" | "invalid_model_output" | null
    model_id: string, prompt_version: string, diagnosed_at: timestamp
  } | null
  verification_state: "UNVERIFIED" | "AI_ASSESSED" | "FIELD_VERIFIED" | "EXPERT_CONFIRMED"
  verified_by: userId | null
  verified_issue: string | null     // may differ from AI diagnosis
  recommendation_id: ref | null
  intervention: {                   // outcome loop
    applied_at, type: "cultural" | "biological" | "chemical" | "mixed"
    products: string[]              // registration numbers, not free text
    notes: string
  } | null
  outcome: {
    followup_at, severity_band: "none" | "low" | "moderate" | "severe", resolved: boolean, notes: string
  } | null
  sim: boolean                      // TRUE for all seeded demo data — drives the badge

observations/{obsId}/internal/diagnosis   // INTERNAL: no client can read it (firestore.rules)
  model_confidence: number | null   // 0–1; null when the output was unusable
  severity_pct: number | null       // 0–100 visual estimate
  reasoning_summary: string | null
  invalid_output: string | null     // raw text of the last unusable output, for prompt tuning
  attempts: number, model_id, prompt_version, created_at

recommendations/{recId}
  obs_id, created_at
  ipm_steps: string[]               // ordered: scout → cultural → biological → chemical
  chemical_options: [{ registration_no, trade_name, active_ingredient,
                       label_dose, phi_days, source_doc }]   // ONLY from regulatory DB
  rag_sources: [{ title, tier, uri, chunk_ids }]
  regulatory_check: { passed: boolean, rejected_products: string[] }
  sim: boolean

alerts/{alertId}
  type: "cluster" | "risk_change" | "org_priority"
  issue, district, district_slug, geo_center, radius_km
  level: "LOW" | "ELEVATED" | "HIGH"
  contributing_factors: string[]   // ≥ 1; a level is never shown bare
  observation_ids: string[]
  channels_sent: ["fcm","sms"], created_at
  sim: boolean                     // true if built from any simulated observation
  cluster_id: string | null        // the cluster that raised it (type "cluster")

alerts/{alertId}/internal/dispatch // INTERNAL: who was sent what; no client reads it
  state: "pending" | "sending" | "sent" | "skipped"   // seeded/backfilled alerts: "skipped"
  fcm: { topic, topic_ok, web_sent, web_failed, web_pruned }
  sms: { gateway, recipients, sent, failed, error }, dispatch_ms, finished_at

clusters/{clusterId}               // Command Center read only (members are report ids)
  issue, district, district_slug   // district most members are in
  center: GeoPoint, radius_km      // centroid of members, never a farm
  members: string[], size, new_last_24h
  active: boolean, first_detected_at, updated_at, closed_at?
  alert_id: string | null, sim: boolean

risk/{districtSlug}                // Risk Model v0, latest per district (§9)
  district, district_slug, level, contributing_factors: string[], computed_at, sim

sms_subscribers/{e164digits_slug}  // NO client access; tools/admin sms-subscribe
  phone (E.164), district_slug (or "*" = every district), active, label
  consent: { note, recorded_by, recorded_at }, created_at

registered_products/{registrationNo}   // Regulatory Product Database — see §8
```

### 4.2 BigQuery tables (explicit writes; schemas in `packages/shared/src/schemas/analytics.ts`)

Created and extended by `pnpm --filter @repo/seed tables` (run by `infra/setup.sh` and by the seed).

```
cropwatch.observations        -- flattened observation rows, GEOGRAPHY point column, keyed on
                              -- district_slug; INCLUDES observations/{id}/internal/diagnosis
                              -- (model_confidence, severity_pct, attempts) for accuracy and
                              -- calibration work. BigQuery is never UI-bound. Seed load jobs only.
cropwatch.observation_events  -- the same row, streamed by the API each time a report changes
                              -- (diagnosed, verified), stamped recorded_at
cropwatch.retracted_observations -- E2E test reports deleted after the fact
cropwatch.observations_latest -- VIEW: latest row per obs_id across both tables, minus
                              -- retracted; the cluster rule and risk counts read this
cropwatch.risk_scores         -- every district risk computation: level + contributing factors
cropwatch.weather_daily       -- district-level daily weather pulls (with Earth Engine; cut line)
cropwatch.satellite_metrics   -- optional (Earth Engine ST_REGIONSTATS outputs)
```

### 4.3 Verification ladder weights (v0 placeholders — agronomist to redefine)

```
UNVERIFIED        0.2
AI_ASSESSED       0.5
FIELD_VERIFIED    0.8
EXPERT_CONFIRMED  1.0
```

Used only inside cluster/risk scoring. Never shown as science.

## 5. API surface (Cloud Run)

```
POST /observations           create observation (metadata; photos already in Storage)
POST /diagnose               triggered by Eventarc (Storage finalize) or called directly
                             -> Gemini structured output -> writes diagnosis to observation
POST /recommend              obs_id -> RAG retrieval -> regulatory filter -> recommendation
POST /verify                 officer confirms/corrects diagnosis; bumps verification_state
POST /intervene              record intervention on an observation
POST /outcome                record follow-up outcome
GET  /risk?district=…        current prototype risk signal + contributing factors
POST /alerts/dispatch        internal; Pub/Sub push target -> FCM + SMS
GET  /org/{id}/priorities    Outgrower View data: flagged farms, camps, suggested visits
```

All endpoints validate input with a schema library; officer/admin routes require role claims.

## 6. Diagnosis contract (Gemini)

Request context: image(s) + crop + location (district only, not precise) + planting date/growth stage + farmer description.

Enforce structured output with a response schema equivalent to:

```json
{
  "crop": "string (echo or correct)",
  "suspected_issue": "slug from controlled vocabulary | 'unknown'",
  "model_confidence": 0.0,
  "severity_pct": 0,
  "growth_stage": "string|null",
  "visible_symptoms": ["string"],
  "needs_expert_review": false,
  "reasoning_summary": "one sentence, no treatment advice here"
}
```

Routing: `model_confidence < 0.6` or `suspected_issue == "unknown"` → `needs_expert_review = true` with an `expert_review_reason`, state stays `UNVERIFIED` (`AI_ASSESSED` is NOT set), `status = awaiting_expert_review`; observation appears in officer review queue. Output that fails schema validation gets one retry; a second failure is stored as `unknown` with reason `invalid_model_output`, never a crash. The model's numbers are stored only in `observations/{obsId}/internal/diagnosis`; the observation document gets bands (§4.1). Controlled vocabulary of issues lives in one config file (start: fall_armyworm, tuta_absoluta, late_blight, early_blight, diamondback_moth, cassava_mosaic, cassava_brown_streak, maize_lethal_necrosis, unknown).

Prompt versioning: store `prompt_version` on every diagnosis. Keep prompts in repo under `prompts/`.

## 7. RAG (RAG Engine, RagManagedDb)

### Corpus layout (Cloud Storage)

```
knowledge/
  zambia/moa/        # FAW manual 2nd ed. 2026, bulletins, crop protection, e-extension, CSA
  zambia/zari/       # pathology, entomology, diagnostics
  zambia/zmd/        # seasonal forecasts, agro-met advisories
  international/fao/ # FAW guide, IPM, FFS, pesticide management
  international/cabi/# PlantwisePlus Zambia factsheets, decision guides (green/yellow lists)
  research/          # peer-reviewed IPM/efficacy; IITA cassava guides
```

Per-document metadata: `{country, crop[], issue[], source, authority_tier (1–6), year}`.
Ranking: local authoritative overrides generic on conflict — tier 1 (MoA) → 2 (ZARI) → 3 (ZMD) → 4 (FAO) → 5 (CABI) → 6 (research). Product labels are NOT in the RAG corpus; label data feeds the regulatory DB.

### Retrieval query shape (context-shaped, not chat)

```
crop=<crop> issue=<slug> growth_stage=<stage> severity=<band> district=<d>
question="evidence-backed interventions appropriate to this situation, IPM-first"
```

Response composition: IPM ladder first (scout → cultural → biological → chemical last); citations required on every recommendation; chemical candidates handed to the regulatory filter before rendering.

## 8. Regulatory Product Database (the chemical firewall)

**Dependency [NEEDS VALIDATION]:** machine-readable ZEMA register unconfirmed. Build the table from available sources in priority order: (1) ZEMA registration data if obtainable, (2) product labels photographed at agro-dealers (worksheet: `tools/regulatory/products-from-pmdg.md`), (3) the MoA FAW manual's products annex, only if the manual ever arrives (requested by email 2026-10-21, no reply; nothing waits on it), (4) the Zambian Plantwise PMDGs themselves.

**Live register since 2026-10-29 (approved):** `tools/regulatory/pmdg-products.csv`, 13 rows with `source: plantwise_pmdg` ("Plantwise Zambia PMDG"), one per product or product type the Tuta absoluta, early blight and diamondback moth PMDGs name for chemical control. A PMDG has no registration number, so `registration_no` is an internal id (`PMDG-…`) that the UI never shows as a registration number; `label_dose` is the guide's own text, copied verbatim, or, where the guide gives no rate, "The guide gives no rate for this product. Use the rate on the product label."; `phi_days` is the guide's value (the longer end of a range); `verified_by` records Geoffrey's spot-check (`tools/regulatory/mark-verified.ts`, then reload). Loading it retired the seven placeholder rows. Left out on purpose: the mancozeb brands for late blight (that guide gives no PHI, and a PHI borrowed from the early-blight guide would be invented guidance; late blight stays IPM-only with the officer referral), cassava mosaic cypermethrin (the PMDG advises against insecticides for small-scale farmers), and the copper and mancozeb + metalaxyl products (neither guide gives a pre-harvest interval, and the register never invents one). Fall armyworm has no Zambian PMDG in the corpus, so it stays IPM-only with the officer referral. Spot-check list: `docs/pmdg-spot-check.md`. Label or ZEMA rows join the same CSV later and take precedence.

Schema (`registered_products/{registeredProductDocId(registration_no)}`; the document ID is the percent-encoded number, since ZEMA numbers may contain `/`). Loaded from a CSV with `tools/regulatory/load-products.ts`, which validates every row against `@repo/shared` and treats the CSV as the whole register:

```json
{
  "registration_no": "string (PK)",
  "trade_name": "string",
  "active_ingredient": "string",
  "registrant": "string",
  "approved_crops": ["tomato", "maize"],
  "approved_issues": ["tuta_absoluta"],
  "label_dose": "string, verbatim from the label (or, for plantwise_pmdg, from the guide)",
  "phi_days": 7,
  "who_class": "II",
  "source": "zema | label | moa_faw_manual | plantwise_pmdg | placeholder",
  "source_doc": "uri, or corpus document id + page",
  "expiry": "date|null (valid through this date)",
  "verified_by": "string|null (who spot-checked the row; optional)"
}
```

Filter logic (deterministic, in `/recommend`; `apps/functions/src/services/recommend/regulatoryFilter.ts`): every chemical candidate from RAG/Gemini must match a row (by exact registration number, or by trade name or active ingredient ignoring case and spacing) on `approved_crops` AND `approved_issues`, unexpired on the Lusaka calendar date. Rows with `source: placeholder` exist only so the filter is testable before the real register lands; they are excluded unless a caller explicitly allows them, so they never reach a farmer as advice. The chemical rung of the IPM ladder is always written by Phytos, never taken from retrieved text. No match → dropped and logged in `regulatory_check.rejected_products`. Doses rendered ONLY from `label_dose`. Each chemical option carries its row's `source` (optional in the contract), so clients name a PMDG row's source instead of showing its id as a registration number. The server reads the register fail-closed per row: a row it cannot parse is left out, never guessed at. If zero chemicals survive, the recommendation ships IPM-only with "consult an extension officer for chemical options".

Commercial firewall: "where to buy" renders after the recommendation, lists ALL registered options for the issue, never filtered by sponsor.

## 9. Cluster & risk (Risk Model v0 — prototype)

### Cluster rule (BigQuery, per report)

v0, in one sentence for the stage: **five or more reports of the same issue, each AI-assessed or better (weight ≥ 0.5), within 10 km of one another's anchor, in the last 72 hours.** Constants and the merge step live in `packages/shared/src/risk.ts`, so the seed and the API run the same code.

Each time a report changes (diagnosed, verified), the API (`apps/functions/src/services/outbreaks/`):

1. streams its snapshot to `observation_events`;
2. for a known issue with weight ≥ 0.5, finds every qualifying report's same-issue neighbours within 10 km:

```sql
WITH q AS (
  SELECT obs_id, geo, created_at, district, district_slug, sim
  FROM `cropwatch.observations_latest`
  WHERE issue = @issue AND verification_weight >= 0.5
    AND created_at > TIMESTAMP_SUB(@now, INTERVAL 72 HOUR) AND created_at <= @now
)
SELECT a.obs_id, ARRAY_AGG(b.obs_id) AS neighbours, ...
FROM q AS a JOIN q AS b ON ST_DWITHIN(a.geo, b.geo, 10000)
GROUP BY a.obs_id
```

3. anchors (≥ 5 neighbours, itself included) sharing any member merge into one cluster (`mergeAnchors`);
4. in one Firestore transaction per issue, a detected cluster continues the stored one it shares members with (`grown` / `unchanged`), otherwise it is `created`; stored clusters no longer detected close;
5. district risk is recomputed for every district touched, and an alert is raised for each **created** cluster, or for a district that has just risen to HIGH without one (`risk_change`). A cluster that only grows does not alert again.

Tracking runs beside the recommendation; if it fails, the farmer's result is unaffected (logged).

### Risk signal per district: LOW / ELEVATED / HIGH (`riskV0`)

- **HIGH:** a cluster of 8 or more, two or more clusters, or a cluster still growing (new reports in 24 h) while reports surge.
- **ELEVATED:** any cluster, or a surge: at least 5 reports this week and ≥ +50% on last week.
- **LOW:** otherwise.

Contributing factors are always stored and shown with the level, e.g. "Cluster of 6 Tuta absoluta (tomato leafminer) reports within 10 km (2 new in 24 h)", "14 reports this week (+133% on last week)", "No cluster in the last 72 hours". No numeric likelihoods anywhere (CLAUDE.md invariant 2). Weather context and crop-calendar sensitivity join the inputs when Earth Engine and the agronomist's stage table do (cut lines); until then the factors say only what the reports show.

## 10. Alerts

`alerts/{id}` is written with `internal/dispatch.state = "pending"` and its id published to Pub/Sub topic `cropwatch.alerts`. Push subscription `cropwatch-alerts-dispatch` delivers it to the API at `/internal/events/alerts` (OIDC token for the API's service account, checked like Eventarc's). The dispatcher claims the alert in a transaction, so a redelivery never sends twice, then sends:

- **FCM topic** `alerts-{district_slug}` (mobile app subscribers);
- **FCM web push** to capture-PWA tokens registered for the district (`users/{uid}/push_tokens`; dead tokens pruned);
- **SMS** via Africa's Talking to active `sms_subscribers` for the district or `*`. Without the account's secrets in Secret Manager (`africastalking-username`, `africastalking-api-key`) the API logs what it would have sent. Username `sandbox` uses the AT sandbox (simulator only, no real phone).

Copy (`apps/functions/src/services/alerts/templates.ts`, English; Nyanja is a cut line): level word (Low / Watch / Act now), issue, district, the factors, and what to do; SMS carries the leading factor only, no links. Simulated alerts say DEMO on every channel. Only live reports dispatch; seeded and backfilled alerts are stored with `state: "skipped"`.

**Sender ID:** Zambian alphanumeric sender IDs are registered per carrier through ZICTA (MTN only shows pre-registered IDs); expect weeks, not days. The demo uses Africa's Talking's default sender. Demo: the judge's number is subscribed (with consent) by `pnpm --filter @repo/admin-tools sms-subscribe add ...` before the pitch.

Institutional alert variant (org admins, priorities link) is not built.

## 11. Dashboard (Next.js)

Screens:

1. **National map** — live observations (Firestore snapshot listener), cluster overlays, risk chips per province. Permanent badge component: `DEMO DATA — SIMULATED` (rendered whenever any displayed row has `sim: true`).
2. **Outbreak detail** — cluster drill-down: reports, timeline, weather context, prototype risk signal + contributing factors.
3. **Observation detail** — photo, diagnosis (confidence band), verification state, recommendation with citations, intervene/outcome timeline.
4. **Outgrower View (DEMO OUTGROWER CO.)** — enrolled farmers (simulated), farms flagged for priority visits, camps needing attention, top emerging issue, "Prioritise field officers" action → per-officer visit lists. NO loan-exposure figures; one roadmap line instead.
5. **Officer confirm flow** — approve/correct diagnosis; increments the live "Verified observations" counter (the moat moment).

## 12. Seed-data generator

Script `tools/seed` (`pnpm --filter @repo/seed seed`, dry run by default; `--commit` replaces the sim data in Firestore and BigQuery): generates ~500 synthetic observations over realistic Zambian geography (district centroids + jitter; Eastern Province FAW storyline, Lusaka/Chongwe Tuta storyline), timestamps spread over 21 days with an accelerating cluster in the demo district, all rows `sim: true`, mixed verification states, plausible severity distributions. Also seeds DEMO OUTGROWER CO. with simulated enrolled-farmer counts. Deterministic seed for rehearsals (same sequence every run). One flag `--live-demo` (with `--demo-issue`, `--demo-center`, `--demo-district`) pre-arms the exact rehearsed sequence: the presenter's real report becomes the 5th report completing the cluster. Demo-issue reports near the venue are aged out of the window, four qualifying reports are placed within 4 km, and the run refuses to write unless the §9 rule confirms the venue is exactly one report short and that the presenter's report forms a _new_ cluster (a grown one would not alert). The seed also writes the outbreak state it implies at the anchor (sim clusters, district risk, and their alerts with dispatch `skipped`, never sent) and clears the previous rehearsal's. `pnpm --filter @repo/admin-tools outbreak-e2e --image <tuta photo>` rehearses the presenter's report against the deployed API and undoes it. Morning-of procedure: `docs/demo-ops.md`.

## 13. Demo runbook (deterministic)

1. Dashboard open on national map (badge visible). App on Presenter 1's phone, logged in as demo farmer.
2. [Stretch, kill-switch] Airplane mode → on-device triage → reconnect.
3. Photo of real damaged leaf (demo crop per field check) → diagnosis (confidence band) → recommendation: IPM steps, one registered product + label dose, nearest agro-dealer, cited sources → REPORT.
4. Presenter 2: report lands on map in seconds → cluster completes → Lusaka's risk goes from ELEVATED (Watch: reports surging, no cluster) to HIGH (Act now: a new cluster while reports surge) → SMS fires to judge's phone ("Phytos DEMO alert (Act now): …": the cluster contains simulated reports, so it says DEMO).
5. Officer confirm → verified counter ticks up.
6. Outgrower View → "Prioritise field officers" → per-officer visit lists.
7. Close: "One farmer can report a problem. Phytos lets an entire country see it coming."

Backup screen-recording exists for every step; wifi failure = play recording, keep talking.

## 14. 48-hour build order (with cut lines)

| Window  | Build                                                                       | Cut first if behind                    |
| ------- | --------------------------------------------------------------------------- | -------------------------------------- |
| Fri eve | Team, pitch v0, GCP+Firebase up, corpus in RAG Engine, seed generator ready | —                                      |
| Sat AM  | /diagnose (Gemini structured JSON, Gen AI SDK) + Eventarc; app capture flow | on-device triage                       |
| Sat PM  | /recommend (RAG + regulatory filter); Firestore live map; seed data loaded  | WhatsApp (SMS only)                    |
| Sat eve | Cluster rule; risk signal v0; SMS alert end-to-end                          | Earth Engine (static weather fallback) |
| Sun AM  | Outgrower View; officer confirm flow; 2× rehearsal on stage hardware        | analytics screens                      |
| Sun PM  | FREEZE. Rehearse. Backup recordings.                                        | —                                      |

Pre-hackathon prep (check organiser rules on pre-written code): GCP project, IAM, corpus collected + ingested, regulatory table rows, seed generator, prompt drafts. Application code within the rules.

## 15. Validation register (blocks slides, not code)

1. Outgrower economics (who bears risk/finances inputs/employs officers) → payer interviews
2. Pricing unit → same interviews
3. Ops-platform hypothesis ("show me how officers report today") → interview probe
4. Crops observable at demo weekend → field check
5. ZEMA register machine-readability → request; fallback per §8
6. Pest/crop severity claims (Tuta etc.) → agronomist confirmation
7. Gemini zero-shot accuracy on 100+ real Zambian field photos → scored before event
8. Officer daily reporting behaviour → interviews + incentive design
9. On-device triage quality → prototype; cut if weak
10. Nyanja/Bemba voice quality → test; English + Nyanja text fallback
11. Environmental-impact claims → "potentially" until outcome loop measures
12. Risk weights & methodology → agronomist-defined, post-hackathon
13. Organiser rules on pre-written code → ask

## 16. Glossary / naming

- **Gemini Enterprise Agent Platform** — current name of Google's former Vertex AI Platform (use in all docs).
- **RAG Engine / RagManagedDb** — managed RAG corpus + default vector backend.
- **FAW** — fall armyworm. **IPM** — integrated pest management. **PHI** — pre-harvest interval.
- **ZEMA** — Zambia Environmental Management Agency (pesticide registration). **ZARI** — Zambia Agriculture Research Institute. **MoA** — Ministry of Agriculture. **ZMD** — Zambia Meteorological Department.
- **FAMEWS** — FAO's FAW Monitoring and Early Warning System.
- **Outgrower** — company contracting smallholders, typically financing inputs repaid from harvest (hypothesis — validate per market).

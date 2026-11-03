# CEIH Pivot: Overnight Execution Plan

**Saturday 31 October 2026, evening → Sunday 1 November. Demo is Sunday afternoon.**

Read `docs/ceih-workflows-mvp.md` (the spec) first; this plan sequences it and narrows its scope. **Where this plan and the spec disagree, this plan wins** — it carries Geoffrey's Saturday-evening scope decisions. CLAUDE.md invariants apply throughout, as amended in §2 below.

---

## 0. Scope decisions (Geoffrey, Saturday evening — final)

1. **The demo is ONE surface: the dashboard.** No farmer app. No admin side. No new USSD build. Every demo beat lands on the Outgrower View and its new tabs. "We demo the solutions part."
2. **The field-airy UI stays exactly as built.** New tabs and cards are composed from the existing kit: cream canvas, white islands with layered shadows, the one field-green accent, Fraunces figures, Figtree text, shimmer skeletons, Lucide icons, DEMO pill on data never chrome, no em dashes in rendered strings. The mockup contract (`apps/web/public/mockups/a-field-airy.html` + `theme-field` tokens) governs every new screen. Nothing dark, nothing novel.
3. **USSD (spec §3.3 and §4 step 4) is NOT built.** The spec's own cut line already names the replacement: the advance is requested **on the farmer's behalf from the dashboard** (`requested_via: "officer"`). A static mock of the USSD menu may appear on a pitch slide; never claim it is live.
4. **Officer photo beat:** the existing capture PWA is unchanged and already does this (photo → diagnose → lands on the map). Keep it available as an optional live beat (it is not "the farmer app"; it is the officer tool that already exists). ALSO build the seeded alternative: a demo-control action that injects Given's `FIELD_VERIFIED` observation. Both paths must work; Geoffrey picks one at rehearsal.
5. **SMS beat:** if Africa's Talking secrets are in Secret Manager by Sunday morning, the judge-phone SMS is live. Otherwise the dashboard **SMS log** is the beat (existing pattern, already demoed). Build so either works; never block on AT.
6. **The old demo path stays intact as the fallback.** Before any pivot code: make sure the current field-airy build is deployed, tagged, and its recordings are the safety net.

---

## 1. Step 0: safety, branch, and CLAUDE.md amendments (30 min, do first)

1. Commit the two pending `tools/regulatory` spot-check files on the current branch with message noting "spot-check values pending Geoffrey's review". Move or gitignore the untracked `Claude outputs/` folder.
2. Verify the currently deployed dashboard + capture are the field-airy build; if the cutover tag is missing, **tag the deployed state `stable-2026-10-31`** and push the tag. This is the Sunday fallback. Run the demo check once against it and note the result in `docs/buildplan.md`.
3. Branch: `git checkout -b ceih` from that state.
4. Amend `CLAUDE.md` verbatim (spec §7):
   - **Invariant 6, amended:** farmer-level data is visible to the farmer's own contracting agribusiness under recorded contract consent (`consent.scope == "org_contract"`). Precise locations remain hidden from any other organisation, from insurers and from exports; those receive camp/district aggregates only.
   - **New invariant 9:** Phytos never moves money without (a) farmer OTP confirmation after seeing amount and fee, (b) a human approval by a user who did not perform the verification, and (c) a ledger entry. No exceptions for the demo.
   - **New invariant 10:** eligibility and shock decisions are rule-based with stored, displayed factors. No model decides who gets money. Satellite signals are thresholds on NDVI against calendar and camp median, with every pass stored; no "AI crop health score".
   - Note in CLAUDE.md that technicaldoc §3 ("Earth Engine is architecture, not MVP critical path") and §11 item 4 ("no loan-exposure figures") are superseded by the CEIH spec §3.6 and §3.4: exposure figures are now the point, always under the DEMO badge while simulated.
   - Clarifying note: invariant 2 (no numeric probabilities) is untouched. NDVI values, ZMW amounts, hectares and dates are measurements and amounts, not probabilities; they display as figures. No scores, no percentages of confidence, anywhere.
5. Commit the spec and this plan into `docs/` (already placed there) and reference both from `docs/buildplan.md` with a dated "CEIH pivot" entry.

---

## 2. Phase plan for the night

Time boxes are targets; the gates are what matter. After each phase: `pnpm typecheck && pnpm lint && pnpm build` green, then a one-paragraph report in `docs/buildplan.md`.

### Phase 1 — data model, constants, seed (target 3h)

- `packages/shared`: Zod schemas + `z.infer` for `farmers`, `contracts`, `satellite_metrics` passes, `advances` (with frozen `eligibility_snapshot`), `ledger_entries`, `deliveries`, `weather_triggers`, exactly as spec §3.1. Observations gain `farmer_id`, `geofence_ok`, `source` (all optional → contract stays additive; regenerate `openapi.json`).
- `packages/shared/src/constants/ceih.ts`: `status_derived` enum, ledger entry types, eligibility thresholds. **Every agronomic/credit number is a named constant with a `// PLACEHOLDER until agronomist/credit team sets it` comment**: establishment NDVI threshold (start 0.35 for soya), camp-median tolerance (±0.08), verification window (21 days), min clean passes (2), severity pause threshold (40), `cap_pct` default 0.15 (range 0.10–0.20), `hard_ceiling` ZMW 2,500, advance fee 5%.
- **Field polygon from pin:** MVP rule — a circle around `field_pin` with `radius_m = sqrt(claimed_ha × 10000 / π)`, stored as GeoJSON on the contract. Walked boundaries are post-MVP. Geofence check = point-in-polygon with a 150 m grace buffer.
- **Seed (`tools/seed`, new `--ceih` mode, composable with `--live-demo`):** DEMO OUTGROWER CO., ~120 soya contracts across three Southern Province camps (Monze storyline: e.g. Chikuni, Keemba, Hamangaba), Zambian names as in the realism pass. ~80 field-verified, ~40 eligible, 10 advances approved, input loans ledgered. Per-contract seeded NDVI curves (Oct→Jan weekly points): archetypes _established on track_, _not planted_ (flat ~0.15), _field stress_ (rises then drops while camp median rises), one whole camp _shared stress_ (armed for drought). Cloud gaps in Dec–Jan points (`usable: false`). **Given**: real-named demo farmer, `sim: true`, curve rising with camp median, but exactly one clean pass in the last 21 days → not eligible, "cloud gap, ground check required". Everything `sim: true`.
- **Gate:** seed runs idempotently; Firestore shows the collections; a printed eligibility dry-run for Given says NOT eligible with correct factors, and for a fully-verified farmer says eligible with cap ZMW 840-style arithmetic.

### Phase 2 — eligibility engine + API (target 2h)

- Pure, deterministic, unit-tested function in `packages/shared` (or `apps/functions/src/lib`): input = contract + farmer + passes + observations; output = `{ eligible, cap_zmw, factors[] }`, factors human-readable per spec §3 example. Rules exactly spec W3. `geofence_ok == false` observations and `usable == false` passes never count (test this).
- tRPC routers + `/api/v1` REST additions (additive only): `POST /farmers`, `POST /contracts/import` (CSV), `POST /contracts/{id}/inputs`, `GET /farmers/{id}/eligibility`, `POST /advances`, `POST /advances/{id}/confirm`, `POST /advances/{id}/approve`, `POST /advances/{id}/disburse` (internal), `POST /deliveries`, `GET /contracts/{id}/statement`, `GET /contracts/{id}/satellite`, `POST /satellite/ingest` (internal), `POST /triggers/evaluate` (internal), `GET /org/{id}/portfolio`.
- Advance state machine enforced server-side: `requested → farmer_confirmed(otp_ok) → approved(approver_id ≠ verifying officer uid) → disbursed`. OTP in MVP: 6-digit code written to the SMS log (and real SMS if AT live); confirm endpoint checks it. Fee computed and included in the pre-confirmation message. **Vitest: an advance cannot reach disbursement without `otp_ok` and a distinct approver — the spec §6.2 test is mandatory, not optional.**
- `SimulatedProvider` mobile-money adapter: `disburse(msisdn, amount, ref)` → `{ status: "simulated", tx_ref }`, writes ledger rows (`advance`, `advance_fee`), sends/logs the "ZMW 840 sent… Deducted at harvest with ZMW 42 fee." SMS. Statement endpoint computes totals **from ledger rows only**.
- **Gate:** the §6 acceptance tests for eligibility, state machine, ledger, and fee-before-confirm pass in Vitest.

### Phase 3 — the dashboard (target 4h; this is the demo)

Outgrower View grows three tabs plus a portfolio header. Reuse the field-airy kit everywhere; the national map stays the page on the existing views, the new tabs are white islands over the cream canvas.

- **Portfolio header** (stat cards, Fraunces figures, count-up motion): contracts · projected value ZMW · input loans out · advances out · recovered · shock-flagged camps. DEMO pill on the card data.
- **Tab 1 · Season ledger:** roster table (farmer · camp · verified state + date · eligible chip · advance status · exposure ZMW), camp filter, CSV export. Each row expands to the **field card**: NDVI curve (field line vs camp-median line, cloud gaps rendered as breaks, planting date + today markers), verification timeline (inputs → planted → stage checks → issues, each entry with source icon: satellite / officer / farmer / ai), eligibility factors list. The NDVI chart is one small reusable component; sparkline version in the table row.
- **Tab 2 · Approvals:** queue of advance requests. Card = the Verified Season Record: NDVI curve vs camp median, officer photos, stage + date + `geofence ok`, then factors, cap, requested amount, fee. Approve / decline with reason. Approve opens a confirm modal restating amount + fee + farmer OTP state; blocked with a plain explanation if the logged-in user was the verifying officer (maker-checker). On approve → simulated disbursement → SMS log entry appears ("simulated" labelled) → ledger updates live.
- **Tab 3 · Reconciliation:** delivery entry form (weight, moisture, grade → priced at contract price), statement preview (ledger lines + net payout), variance flag with its explanation (_shock: drought trigger 14 Mar_ vs _unexplained: possible side-sale_).
- **Demo control** (existing hidden pattern): buttons for _inject Given's ground check_, _request advance on Given's behalf_, _advance season to March (fires `triggers/evaluate` on the armed camp)_, _jump to June (enter Given's delivery)_. These drive the storyline without a second device.
- Shock trigger: one rule, one camp — seeded 30-day rainfall below threshold + camp median NDVI falling → `shock_flag: drought` on every contract in the camp, claim-pack view (camp, contracts affected, trigger evidence), advances paused in that camp, "insurance payout SIMULATED" labelled.
- **Gate:** `pnpm --filter @repo/visual shots` extended to the three tabs + approval modal (laptop, phone, projector sizes), every shot eyeballed. Demo check script extended to walk beats 1–6 of §5 below.

### Phase 4 — demo arming + deploy (target 1.5h)

- `--ceih --live-demo` arming: Given one ground-check short of eligible; approvals queue holding 2 background items; drought camp armed but not fired; venue cluster arming for the old path retained (fallback).
- Deploy via `infra/deploy.sh` (fail-loud), MIN_INSTANCES=1, warm-up ritual extended: one eligibility call + one satellite GET before the pitch.
- Re-record the backup: one clean screen recording of the full 9-beat storyline on the deployed build.
- **Gate:** demo check green on the deployed URL, from a clean browser profile, on the projector resolution.

### Phase 5 — stretch, only if Phases 1–4 are green

In order: (a) live Sentinel-2 pull for the ~10 hero fields (§3 routes below), cache into `satellite_metrics`, "refresh from satellite" button; (b) reconciliation polish + CSV import; (c) Nyanja strings. **Cut order when behind (spec §5): live satellite pull → shock trigger (describe on a slide) → reconciliation UI depth (keep API + SMS). Never cut: the NDVI curve on the field card, factors on screen, maker-checker, fee shown before confirmation, ledger entry per movement.**

---

## 3. Satellite layer: research plan and routes

The demo path is **seeded curves regardless** (Route C). Live pulls only decorate hero fields if a route lands tonight. The rule engine and UI are identical either way.

- **Route A — Google Earth Engine (preferred; needs Geoffrey, ~10 min, tonight).** Verified 31 Oct: noncommercial registration is free, **enabled immediately**, no billing config needed, and service accounts are covered automatically once the project is registered. Steps (as `zulugeoffrey034@gmail.com`):
  1. Enable the Earth Engine API on `crop-watch01` (API Library).
  2. Register the project: `https://code.earthengine.google.com/register?project=crop-watch01` (or console.cloud.google.com/earth-engine) → choose **Unpaid / noncommercial**, complete the questionnaire (hackathon prototype / research-evaluation use).
  3. Grant the Cloud Run service account the Earth Engine resource viewer/writer role in IAM if prompted.
  - If the questionnaire classes the project as commercial, stop and use Route B or C; do not misrepresent use.
  - Implementation: Python `earthengine-api` in a small Cloud Run job (or a local script run once and cached): `COPERNICUS/S2_SR_HARMONIZED`, filter by polygon + date, mask clouds with the `SCL` band (keep classes 4, 5, 6, 7, 11), NDVI = (B8 − B4)/(B8 + B4), `reduceRegion(mean)` per pass, write `{date, ndvi, cloud_pct, usable}` into `satellite_metrics`. Camp median computed across the camp's fields per pass date. EE is a global service; this is a sanctioned exception to the europe-west1 rule, like Gemini: note it in CLAUDE.md env section.
- **Route B — no-signup fallback: STAC on AWS open data.** `earth-search` (element84) STAC API, collection `sentinel-2-l2a`, no key required: `pystac-client` to find scenes intersecting the polygon, `rioxarray`/`rasterio` windowed reads of the B04/B08 COGs clipped to the polygon, same NDVI + SCL masking. Slower per field but fine for ~10 hero fields. Verify the endpoint is reachable from Cloud Run before committing.
- **Route C — seeded (always built, always the demo).** Spec §3.6: `tools/seed` writes the four curve archetypes with `sim: true`; any view showing them carries the DEMO badge.
- **Rainfall (shock trigger):** seeded 30-day series for the armed camp. CHIRPS integration is post-hackathon; name the source honestly in the UI as "demo rainfall series".

---

## 4. Demo storyline v2 (dashboard-only, ~3 minutes)

Replaces the spec §4 storyline's device beats with dashboard beats. Presenter 1 drives the dashboard; Presenter 2 narrates the farmer's side. Backup recording for every beat.

1. **Open on the Season ledger**, portfolio header counting up. One line: "This agribusiness lends inputs to 120 farmers it cannot see. Now it watches every field from space."
2. **Given's field card:** curve rising with the camp median, but chip reads _Not eligible: cloud gap, ground check required_. "Satellites saw his crop establish, then December clouds. The system does not guess; it sends an officer."
3. **Ground check lands** (capture-app photo live, or demo-control inject — Geoffrey's call at rehearsal): Given flips to _Eligible · cap ZMW 840_, factors on screen (satellite passes + officer verification + no open issues + the cap arithmetic). Beside him a neighbour's flat curve reads _not planted: no advance, visit task created_. "That contrast is the product."
4. **Request the advance on Given's behalf** (dashboard; in production this is his USSD menu, shown on the slide). The fee shows **before** confirmation; OTP confirm appears in the SMS log.
5. **Approvals tab:** the card with the photo taken a minute ago, the curve, the factors. Approve. The maker-checker line is said out loud: "The officer who verified cannot be the one who approves."
6. **The money moves (simulated):** SMS log (or judge's phone if AT is live): "ZMW 840 sent to your Airtel Money. Deducted at harvest with ZMW 42 fee." Ledger row appears.
7. **Advance the season to March** (demo control): drought trigger fires on the neighbouring camp — shock flags, advances paused there, claim pack generated, payout marked SIMULATED. Given's camp unaffected. "Controllable versus uncontrollable, finally separated."
8. **Jump to June:** enter Given's delivery → statement with every ledger line → net payout. "No disputed deductions. Both sides see the same season."
9. **Close:** "The agribusiness could never see its season. Now it can. So it can give Given the January cash that keeps the crop in the contract."

---

## 5. Acceptance criteria (check before marking anything done)

Spec §6 verbatim, all seven, plus:

8. The three new tabs pass the visual shot pass at laptop, phone and projector sizes, and match the field-airy kit (no new colours, no dark surfaces, no em dashes in strings).
9. The demo check script walks beats 1–6 against the deployed build and exits green.
10. The old demo path (photo → map → cluster → verify) still passes its existing check on the same deploy. The pivot adds; it must not break the fallback.

---

## 6. Freeze and fallback

- **Sunday 09:00 gate:** beats 1–6 green on the deployed build, or **present `stable-2026-10-31`** with the existing recordings and the CEIH story told on slides + the spec. No half-pivot on stage.
- If the gate passes: Sunday morning = Phase 5 stretch + two full rehearsals; **absolute freeze when rehearsals start**, nothing ships after.
- Morning ritual (either path): re-arm seed, warm-up calls, demo check, clean browser profile, projector resolution, recordings on the desktop.

---

## 7. Geoffrey's actions tonight (~20 minutes)

1. **Earth Engine registration** (Route A steps above, 10 min). If the questionnaire feels wrong, skip; seeded curves carry the demo.
2. **Africa's Talking:** either put the API key + username into Secret Manager tonight, or confirm the SMS-log beat. Say which.
3. **Pick beat 3's form** at rehearsal: live capture-app photo (one phone, existing app) or fully seeded injection.
4. The CLAUDE.md amendments in §1.4 will be applied as written unless you object before Claude Code starts.
5. Brief Mukuka and Presenter 2 on storyline v2 (§4); the old script is retired unless we fall back.

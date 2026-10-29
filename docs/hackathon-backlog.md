# Saturday test plan (Sat 31 Oct, GreenCode Hackathon day 2)

Team Phytos tests the frozen build today; nobody builds new features. The code is frozen at the tag `freeze-2026-10-29b` (UI feedback goes to `docs/ui-feedback-log.md`, not code). The pitch is a 3-minute live demo, run with `docs/demo-ops.md`; the printed morning checklist is `docs/morning-checklist.md`.

- Capture app (farmer, phone): https://crop-watch01-capture.web.app
- Command Center (officer, laptop or phone): https://crop-watch01.web.app
- The live demo is armed at the venue (M'Kango Golfview Hotel, `-15.388311, 28.346069`) until **31 Oct 20:46 UTC (22:46 in Lusaka)**. Re-arm on the pitch morning (morning checklist, step 2).

**Order for the day:** 1 → 2 → the rehearsal slots in 5, with bugs triaged by rule 3 and mentor notes in 4 as they come. The landing page is **cut from hackathon scope** (post-event work). A stub may be started on Saturday only once everything in this plan is ticked and nothing else is open.

## 1. Solo runs on your own phone (each presenter, twice)

Each presenter runs both flows **alone, twice, on their own phone** (not the demo phone), so that both can take over if the other is ill or the demo phone dies. Do the runs at different times of day, and at least once on mobile data only.

Before the first run: install the capture app from the link above (Add to Home Screen), allow the camera and location, and sign in to the Command Center with your officer account.

**Farmer flow (capture app):**

1. Open Phytos. It opens on the camera.
2. Photograph a crop problem (leaf mines on tomato if you have them).
3. Choose the crop and the district. Send report.
4. Note the time to the diagnosis and to the advice.
5. Read the advice ladder top to bottom. Check that the chemicals rung either lists products with their source and dose, or says to consult an extension officer.

**Officer flow (Command Center):**

1. Open the officer queue and find your report.
2. Confirm it, or correct it if the AI was wrong.
3. Watch the verified counter tick in the header.
4. Open the report's Evidence panel.
5. Open the Outgrower View and press **Prioritise field officers**.

| Presenter | Run | Phone and network | Diagnosis (s) | Advice (s) | Farmer flow OK? | Officer flow OK? | Counter ticked? | Problems (log in 3) |
| --------- | --- | ----------------- | ------------- | ---------- | --------------- | ---------------- | --------------- | ------------------- |
| P1        | 1   |                   |               |            |                 |                  |                 |                     |
| P1        | 2   |                   |               |            |                 |                  |                 |                     |
| P2        | 1   |                   |               |            |                 |                  |                 |                     |
| P2        | 2   |                   |               |            |                 |                  |                 |                     |

Reports you make during practice are real (not simulated) and stay on the map. Report away from the venue unless you mean to test the cluster, because a Tuta report within 10 km of the venue completes the armed cluster early. Re-arming on the pitch morning resets this.

## 2. Walk through every dashboard view

Sit together with the Command Center on the projector, if you can get one. For each view, one person says aloud what it shows and what we claim. The other checks the claim against the "we do not claim" column. If anyone says a word from that column during a rehearsal, write it down.

| View                                          | What it shows                                                                                                                                                                                                                                 | What we claim                                                                                                                                                           | What we do not claim                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **National map**                              | Districts shaded by Risk Model v0, recent reports, active clusters, the top five districts to watch, three figures; alerts are behind the bell                                                                                                | A rule-based prototype signal from reports, with weather as context; every level shows its factors                                                                      | Predictions, probabilities, coverage of all of Zambia, that simulated history is real                                                      |
| **Alerts drawer and outbreak drawer**         | Alerts by level with class and verification; one opens its outbreak: size, verified, the alert's uncertainty sentence, every district factor; reports, timeline and weather behind expanders                                                  | Five or more reports of the same issue within 10 km is a cluster. "Verified" means an officer verified at least one report in it                                        | That a cluster is a confirmed outbreak; that the weather caused it                                                                         |
| **Observation drawer and "Why this advice?"** | The report, the AI assessment as a band, the advice sent, the officer's verify; sources with tiers, the register check and escalation one click down                                                                                          | Every answer shows what it rests on. Chemicals are named only after a deterministic register check, never by the model alone. PMDG products say "Plantwise Zambia PMDG" | That products are ZEMA-registered (PMDG rows are guide-derived, spot-checked by Geoffrey); confidence numbers; that the AI is always right |
| **Officer queue**                             | Reports routed to an officer, and clustered reports not yet verified; confirm or correct                                                                                                                                                      | Officers verify; every correction becomes a test case                                                                                                                   | That the model learns or improves from corrections                                                                                         |
| **Outgrower View and visit drawer**           | DEMO OUTGROWER CO.: on load, the top five camps needing attention and one line per field officer (visits, the farm first, View); Prioritise opens the full ranked lists; View opens the farm's reasons, recent reports and a district locator | Camp and district level only. Priority is an ordering from the reasons shown                                                                                            | Farm locations; loan, credit or yield figures (roadmap only, not built)                                                                    |
| **Knowledge sources**                         | The curated corpus: tiers, retrieval status, licences                                                                                                                                                                                         | Advice cites Zambian and FAO guides first                                                                                                                               | That every listed document is in retrieval (see each status)                                                                               |
| **Dry-spell scenario** (prototype, flagged)   | Camps ranked for closer monitoring if the next 14 days turn dry: the Open-Meteo forecast or the canned dry spell, the crop-stage table, verified reports                                                                                      | An ordering for where to look first, with every assumption on the page                                                                                                  | Yields, losses, likelihoods, or that the dry spell is a forecast. If it misbehaves, redeploy with `FEATURE_SCENARIO=false`                 |

## 3. Bug triage rule

- **Demo path** (photo → diagnose → recommend → map → cluster → SMS or push → verify → Outgrower View): **fix now.**
  1. Make the fix on a branch from the freeze tag and run the full gate: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`.
  2. Deploy: `MIN_INSTANCES=1 bash infra/deploy.sh`.
  3. Re-run `outbreak-e2e` at the venue (morning checklist, step 3).
  4. Tag the result `freeze-2026-10-31-N`.
  5. Two people agree before deploying.
- **Anything else** (cosmetic, wording, a view that is not on the demo path): **log it only.** Nothing ships on Saturday that isn't a demo-path fix. The dry-spell scenario is off the demo path; if it breaks, flag it off rather than fixing it.

| #   | Found by | View or step | What happened | Demo path? | Action (fix now or logged) | Status |
| --- | -------- | ------------ | ------------- | ---------- | -------------------------- | ------ |
| 1   |          |              |               |            |                            |        |
| 2   |          |              |               |            |                            |        |
| 3   |          |              |               |            |                            |        |

## 4. Mentor feedback sheet

One row per conversation, written straight after it. Bring the pricing hypothesis from the pitch PDF: farmers free; outgrowers pay per farmer or per season; NGO pilots first.

| Time | Mentor (name, role, organisation) | What they asked | What landed | Concerns or objections | Reaction to pricing | Who else to talk to | Follow-up (owner) |
| ---- | --------------------------------- | --------------- | ----------- | ---------------------- | ------------------- | ------------------- | ----------------- |
|      |                                   |                 |             |                        |                     |                     |                   |
|      |                                   |                 |             |                        |                     |                     |                   |
|      |                                   |                 |             |                        |                     |                     |                   |

At the end of the day: the three most common concerns, and whether any of them changes a sentence of the pitch (not the product).

## 5. Pitch rehearsal slots (stopwatch)

Run the full 3-minute pitch with `docs/demo-ops.md` (the two-presenter run), on the real devices, with a third person holding the stopwatch and calling the time at 1:00, 2:00 and 2:45. Record every rehearsal on a phone; the best clean run of each step becomes a backup recording.

| Slot  | Who watches  | Total time | Step that overran | Diagnosis wait (s) | Cut or change for next run |
| ----- | ------------ | ---------- | ----------------- | ------------------ | -------------------------- |
| 09:30 | team         |            |                   |                    |                            |
| 11:30 | a mentor     |            |                   |                    |                            |
| 14:00 | team         |            |                   |                    |                            |
| 16:30 | another team |            |                   |                    |                            |
| 19:00 | final, timed |            |                   |                    |                            |

**Cut order if a run goes over 3:00:**

1. The Evidence panel step.
2. The Outgrower View visit lists (say one line instead).
3. Shorten the close.

Never cut the officer verification: it is the moat.

## Post-event (not in hackathon scope)

- Landing page (cut 29 Oct).
- The national map as a full canvas, with the stat strip, districts to watch and drawers floating over it (v2.1 review, 29 Oct).
- A newer `recommend` prompt version that names a PMDG product when the guide supports it. In the live runs on 29 Oct the model proposed no chemical for Tuta, so the advice was IPM-only with the officer referral. That is safe, and IPM-first is the story; the 13 PMDG rows were simply not exercised.
- Africa's Talking sender ID ("Phytos") through ZICTA; ZEMA or label rows to replace the PMDG-derived ones.

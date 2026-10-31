# Overnight log (31 Oct to 1 Nov)

Autonomous overnight work on the CEIH demo: what was reviewed, what was built, what was checked, and what production ran at each point. Times are Lusaka (CAT). Decisions that need the team are in [`morning-decisions.md`](morning-decisions.md).

## Before the loop (21:30 to 23:00)

- **Block 2, the Fields map:** finished and checked on the preview (`ceih-fields` channel, API tag `fields`). Demo check 30/30, old outbreak check HIGH in 8.6 s, fallback no. 2 green with `--no-fields`.
- **Fields map fixes:**
  - A dropped imagery tile is requested once more.
  - The map now fills the screen below its header, so the legend shows whole at 1280×800 and 1080p. Before this, at 1280×800 the legend's last two rows were below the fold.
- **Block 3, the storyline:**
  - `record-ceih` opens on the Fields map (the fly into Chikuni), cuts to the Season ledger and runs beats 2 to 8. It also cuts a take per beat.
  - The warm-up now reads the Fields map and fetches one imagery tile.
  - `demo-ops.md` has beats 1a and 1b.
- **Repository cleanup:**
  - A new README.
  - Superseded documents moved to `docs/archive/`.
  - Screenshots, recordings and scratch files untracked and ignored (still on disk).
- **Commits:** none carry attribution trailers from 22:56. The old ones are queued in morning decision 1.

## Production cutover (22:56 to 23:20)

- `MIN_INSTANCES=1 bash infra/deploy.sh` from `47b00e8`: the dashboard and capture sites moved to the CEIH build, and Cloud Run created `cropwatch-api-00017-c5w`.
- **Red for about 4 minutes (23:02 to 23:06).** The preview tags had pinned the traffic split, so the new revision got no traffic and the new dashboard talked to the old API (`00014`). Fixed by sending 100% to `00017-c5w` with the tags kept. `infra/deploy.sh` now does this itself (`update-traffic --to-latest`).
- **Checks on production, all green:**
  - demo check: all checks, beats 1 to 6 in 16.1 s on a slow local line;
  - old outbreak check: dispatched in 9.2 s, Lusaka HIGH.
- **Tag `ceih-2026-10-31`:** commit `47b00e8`, revision `00017-c5w`.
- **Fallbacks:** both preview channels and their tagged revisions (`ceih`, `fields`) are untouched.

## Cycle 1 review (23:25 to 00:05): five personas on the production frames

Reviewers: a judge seeing the demo cold, a Zambian agribusiness credit manager, a Chikuni field officer, a design reviewer against mockup A, and a pitch mentor timing the run. Each read the 13 production frames at 1280×800, the beat list and the code. None edited anything.

**Verdicts in one line each:**

- **Judge:** about 7/10 as shown. The logic is honest, but three payoffs happen off screen: the eligibility flip, the ledger row, and the drought.
- **Credit manager:** the arithmetic reconciles to the kwacha. Four things block releasing money:
  - the approver is separated only from the verifier, not from the requester;
  - approval acts on January's facts;
  - the total owed at harvest is hidden;
  - the consent text claims an SMS that was never sent.
- **Field officer:** the camp workflow is right. Satellite readings are called "verified", "Not planted" is stated before any visit, and "inside the field" really means within 150 m.
- **Design:** the components match mockup A, but the page doesn't: the map isn't the page, cloud gaps are the loudest mark, and DEMO pills repeat.
- **Pitch mentor:** the documented order runs about 3:10. Swapping beats 2 and 3, merging 7 into 8 and showing the ledger after "sent" gives 2:53.

**Triage: built in cycle 1** (ranked by demo impact per hour):

1. **The opening map.**
   - Cloud gaps become ink dashes, not solid white boxes.
   - Given's field gets a solid ink outline and his name, permanently.
   - The header counts the states ("40 fields · 23 established · 14 under cloud …").
   - Legend wording: "Established: seen from space or on a field visit", "No crop seen from space: visit", "Stress on this field only".
   - Drought camps are filled solidly.
   - A tile still loading reads as ground.
2. **DEMO CONTROLS** pinned at the bottom right, opening upward, so the ground-check flip and the drought count-up happen in view. Hidden on the Fields map tab, where it would cover the imagery credit.
3. **The portfolio counts up** on every tab change, so beat 1b counts.
4. **The farmer's code** is masked in the SMS log. The consent lines say what really happened ("logged on screen, not sent" while the gateway is off).
5. **Money on the cards:**
   - the fee labelled "5% flat" and set smaller than the advance;
   - "Owed at harvest after this advance ZMW 2,832 of ZMW 5,600 projected";
   - the cap factor names the projected crop value and the ceiling.
6. **Field card:** the chip says "Advance requested" while an advance is open, and the cap figure shows only when the farmer is eligible.
7. "Within 150 m of the field boundary" instead of "inside the field".
8. **Approval re-checks eligibility on the day:** a drought-paused camp's pending advance can no longer be approved.
9. An opened ledger row scrolls into view.

**Queued for cycle 2:**

- The Fields map as the page (full bleed, title and tabs floating).
- Ledger "Verified" column renamed "Field status".
- Given's stage V4 → R1, and the officer's note shown.
- Page head: all-caps title, stacked solid toggles.
- One DEMO pill per island.
- Ledger row dividers and sparkline gaps.
- Claim-pack colours and copy.
- Reconciliation layout.
- Chart label halos.
- Shortfall rows in kwacha.
- "Last officer visit" on satellite-only approvals.
- Phone legend and record layout.
- A limit on OTP attempts.

**To the team (morning decisions):**

- Requester ≠ approver: needs a second account, and creating accounts is Geoffrey's to do.
- The live capture-app ground check with a real soya plant.

**Discarded as out of scope:**

- A Chitonga SMS template (new scope; Nyanja templates were already a cut line).
- Re-running the recording during daytime (it will be re-recorded at the 06:30 freeze; the live demo runs in the afternoon).

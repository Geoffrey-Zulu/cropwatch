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
- **Commit messages:** plain from 22:56; older messages are morning decision 2.

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

## Cycle 1 build and checks (23:40 to 00:45)

- **Gate:** typecheck, lint and build clean, and every test passes. That includes the new service test: an advance whose camp the drought rule paused after the farmer confirmed cannot be approved, and the card says why.
- **Preview `night1`** (API tag `night1`, revision `00019-nid`; dashboard https://crop-watch01--ceih-night-epl345e7.web.app):
  - demo check: all checks, beats 1 to 6 in 16.1 s;
  - old outbreak check: dispatched in 9.2 s, Lusaka HIGH.
- **The full recording in the new order** found two things, both fixed and re-recorded with no page errors:
  1. The Fields map's opening fly-in overrode a camp pressed in its first 700 ms. A pressed camp now always wins.
  2. **In June** the map shows most Chikuni fields as "stress". Soya greenness falls at maturity, and the status rule reads that as stress. The map beat therefore moves to **March** (Hamangaba in brick, Chikuni green), and the run closes on June's statement.
  - Teaching the status rule about maturity is a model change, and stays out of tonight's scope.
- **Visual pass** of the seven changed views at laptop, phone and projector sizes (`docs/ui-review/2026-11-01-night1/`): no issues, every shot looked at. One cosmetic phone wrap in the map legend is queued for cycle 2.
- `deploy-preview.sh` misreported production traffic: it printed the first traffic entry, not the one serving. Production was never affected, and the script is fixed.

## Production deploy of cycle 1 (00:10 to 00:45)

- **First run of `deploy.sh` from `1407e4a`:** the API went live (`cropwatch-api-00019-sng`, 100%, with the preview tags kept by the new `--to-latest` step). Then the script stopped at the Firebase step for the capture site and rules, exit 1, with no message in the log. Neither site was redeployed.
- **Production was never red:**
  - the 31 Oct dashboard works against the new API, since every API change is additive;
  - after a re-arm the demo check passed on production (all checks, beats 1 to 6 in 11.7 s).
- The Firebase CLI session checked out. The failure looks transient, on a line that has dropped connections all night, so the deploy was re-run.
- **Re-run (00:45 to 00:55):** the API went live as `00020-wnp`, the capture site and rules deployed, and the dashboard deployed (bundle `index-U75SiXyZ.js`). The script's last step, a fetch of the district boundaries, hit a connection reset on the local line (curl exit 56); the same fetch then answered 200.
- **Checks on production, all green:**
  - demo check: beats 1 to 6 in 13.1 s;
  - old outbreak check: dispatched in 5.3 s, Lusaka HIGH;
  - the full storyline v3 recorded, 14 beats, no page errors: `Desktop/Phytos CEIH recording 2026-11-01 night1 production 1280/`.
- **Tag `ceih-night-1`:** commit `1407e4a`, revision `00020-wnp`. Production green throughout.

## Cycle 2 (00:59 to 01:25): the map as the page, and the field officer's words

**Built** (commit `b353297`):

1. **The Fields map is the page, as in mockup A:**
   - the map fills the screen under the header;
   - "Demo Outgrower Co." and the tabs float on it;
   - the controls and the key are islands;
   - the fly-in lands the fields clear of the islands;
   - on a phone it stacks, with the key below the map.
2. **Page tabs take the nav's tint**, so a page has one filled toggle (the camp filter). Org names stored in capitals are title-cased for the page title only; the stored name and the SMS text are unchanged.
3. **The field officer's words:**
   - The ledger column is "Field status": "Seen from space", "Field visit", "No crop seen from space", "Cloud gap". The word "verified" is kept for a field visit.
   - The chip is "Not eligible: no crop seen".
   - Joseph reads "No crop seen from space. No advance. Visit task created."
   - Given's ground check records stage R1, which agrees with 55 days after an 18 Nov planting, where V4 contradicted his curve. The demo check accepts R1 or V4, so the fallback builds still pass.
4. **Design review fixes:**
   - one DEMO pill per island (the chart and per-approval pills dropped; each island and drawer keeps its own);
   - "Season record" in sentence case;
   - the folded record checks are named;
   - chart labels get a halo;
   - the reconciliation grid no longer stretches;
   - the delivery button goes once the statement is final.
5. **The drought claim pack is brick**, matching the map's colour for the camp: titled "Hamangaba: drought trigger", "Claim pack for an insurer · the payout is simulated", and the greenness source says "(demo curves)".
6. **Credit manager fixes:**
   - shortfall rows show the money ("Still owes ZMW 1,666", "Net due to the farmer ZMW 2,444");
   - the list never cuts silently ("Show all 114");
   - satellite-only approvals say "Field visit: none this season".

**Checks:**

- **Gate:** typecheck, lint, build and every test pass.
- **Preview `night2`** (revision `00023-tas`; dashboard https://crop-watch01--ceih-night2-e7c7utir.web.app):
  - demo check: beats 1 to 6 in 11.7 s;
  - old outbreak check: dispatched in 6.3 s, Lusaka HIGH;
  - the full storyline recorded, 14 beats, no page errors; every changed frame looked at.
- **Visual pass** of the changed views at laptop, phone and projector sizes in `docs/ui-review/2026-11-01-night2/`: no issues. A stray tooltip in the field-drawer shot comes from the pass's synthetic click (no pointer position); it does not happen with a real click.
- **Production deploy (01:20 to 01:25):** clean, exit 0. API `00022-ln7`, dashboard bundle `index-DS1t20V0.js`.
- **Checks on production, all green:**
  - demo check: beats 1 to 6 in 12.3 s;
  - old outbreak check: dispatched in 6.1 s, Lusaka HIGH;
  - the storyline recorded with no page errors: `Desktop/Phytos CEIH recording 2026-11-01 night2 production 1280/`.
- **Tag `ceih-night-2`:** commit `b353297`. Re-armed.

## Cycle 3 (01:30 to 02:05): second review round and its fixes

**Review round 2** on the night2 production frames (same five personas):

- **Judge:** 8/10, every figure reconciles across the beats. Found a real chart bug on the approval card: in compact mode the single pass after the clouds was not drawn, so the field looked flat at the moment of approval.
- **Credit manager:** would pilot it on one camp. One blocker: a Command Center role could approve, send and record deliveries on a _real_ org, not only a simulated one.
- **Field officer:** the camp workflow now reads right, with small wording leftovers.
- **Design:** "it now reads as mockup A", with polish left.
- **Pitch mentor:** a 3:00 run sheet, but with two Home-key presses and two manual scrolls, because the statement sat below the fold and the tabs scrolled away.

**Built** (commit `3440ac5`):

1. **Security:** on a real org, only its own credit team approves, sends, declines or records deliveries. A Command Center stand-in works on a simulated season only. New test.
2. **The approval card's chart** draws the latest reading and any pass alone between clouds.
3. **Given's field** is drawn last, so no neighbour's halo covers it, with a wider halo. His name sits on his own west edge, not over Joseph's grey field.
4. **A tick or a cross per rule.** The failing rule reads from the back of the room.
5. **Field officer wording:**
   - "No crop seen from space" everywhere a satellite stood in for a visit;
   - "Behind the camp", and "Cloud gap: 1 of 2 clear passes";
   - "On track from space" in the record (establishment is the rule's word);
   - "69 established" on the tile;
   - "Photo taken: within 150 m";
   - satellite-only approvals say "No field visit: established from space";
   - no zero counts in the map header.
6. **The run without Home keys or scrolls:**
   - the tabs stay under the header;
   - before June the delivery form folds to one line, so the statement is in view;
   - the statement and, after a delivery, the net due scroll into view.
7. **The ledger row carries the transfer reference** ("ref SIM-…"), so it traces to the "sent" receipt.
8. **The fee rounds down,** like the cap: 5% of 2,350 is 117, not 118. There is now one harvest date, June.
9. **Design:**
   - the intro is one crisp island (no glow);
   - the map key has a title, with counts aligned;
   - the DEMO pill sits top right in dialogs and islands;
   - the fee shows its unit;
   - sparklines are bolder;
   - a loading tile reads as loading;
   - the current tab is kept in view on a phone;
   - the tile prefetch covers every camp, zoom by zoom.

**Checks:**

- **Gate:** typecheck, lint, build and every test pass.
- **Visual pass** (`docs/ui-review/2026-11-01-night3/`):
  - The first run found sideways scroll on phone (579 px): the new sticky wrapper around the tabs had grown to the strip's width. Fixed, re-shot, no issues.
  - Every changed shot looked at.
- **Preview `night3`:**
  - demo check: beats 1 to 6 in 10.4 s, after the check itself learned the neighbour's new wording;
  - old outbreak check: dispatched in 6.2 s, HIGH;
  - full recording: 14 beats, no page errors.
- **Production deploy (02:03 to 02:08):** clean. API `00024-pt2`, dashboard `index-C6Si9-Ua.js`.
- **Checks on production, all green:**
  - demo check: beats 1 to 6 in 12.7 s;
  - old outbreak check: dispatched in 6.5 s, HIGH;
  - recording: no page errors, `Desktop/Phytos CEIH recording 2026-11-01 night3 production 1280/`.
- **Tag `ceih-night-3`:** commit `33325b1`. Re-armed.
- **Seen in the production frames, for cycle 4:**
  - when Given's row rises, the sticky tabs sit over the ledger's filter row;
  - the DEMO CONTROLS pill overlaps the last line of Joseph's panel.

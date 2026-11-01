# Morning report (1 Nov 2026)

For Team Phytos, before the final pitch. What changed overnight and why, where production stands, what needs a decision, and the rehearsal script with every click. The detail is in [`overnight-log.md`](overnight-log.md); decisions are in [`morning-decisions.md`](morning-decisions.md).

## The final shape (1 Nov, 12:55): two apps, tag `ceih-final-4`

Geoffrey's restructure, built and live on production (API `cropwatch-api-00038-pq8`, MIN_INSTANCES 1; the sites from `b510a3d`). Earlier sections below describe the overnight and morning builds and are kept for the record; the run sheet further down is v5.

- **Labels:** "Agro dashboard" and "Farmer dashboard" beside the logo, so the room knows which app it is looking at. The season line reads "Season 2026/27" (no "Simulated"); "simulated" stays on money lines and data source lines.
- **Agribusiness app, tab 1:** https://crop-watch01.web.app. Three screens: Fields map (the org name alone, no season line), Season ledger (informational; the loan check runs on any farmer), Reconciliation (a batch). The Approvals screen is gone: within the cap the season's rules send an advance (CLAUDE.md invariant 11, amended).
- **Farmer app, tab 2:** https://crop-watch01-farmer.web.app. No sign-in. Given's dashboard from a snapshot in the bundle: his field on the imagery, his curve, his loan, and "Check my advance", which plays the same check in his voice to "You are eligible for ZMW 840"; "Get advance" then opens the money (amount and fee before the send, "ZMW 840 sent to your registered mobile money account · simulated", the SMS, his statement updated). Everything is in memory: **a refresh resets it**, and it never reads or writes the live season.
- **Reconciliation batch:** "Start reconciliation" shows 28 farmers ready and 86 not yet (three shown, then a count; Given not yet), so the batch is short enough to narrate. The run resolves each ready farmer (delivered, value, less inputs, less advance and fee, net) in about 5 s. The summary: 28 settled, gross ZMW 412,969, recovered ZMW 186,526, payouts due ZMW 226,443; Hamangaba's 9 short deliveries uncontrollable; 2 unexplained (Kelvin Moono, Mulenga Hangoma) flagged. "Request bulk payment" → "Pay 25 farmers ZMW 226,443?" → "Send bulk payment" → "Bulk payment request sent to Phytos · simulated", one ledger row per farmer, never twice. Start moves the season to June itself; a refresh starts the batch over (Start clears the last run first).
- **Checks on production:** the demo check (map, ledger, ground check, cap, June batch, bulk payment, a second press paying no one, the rerun clearing the rows) passes, beats 1 to 6 in 6.2 s. A hard refresh after a finished bulk payment opened on Start twice running, and each bulk payment waited for its press. The farmer app played at projector, laptop and phone: 16 s from the press to "sent", no page errors, no sideways scroll. The overflow audit (`tools/visual/overflow.ts`) passes every screen of both apps at 390, 600, 768, 1024, 1152, 1280 and 1440 px. The visual pass is in `docs/ui-review/2026-11-01-two-apps/`.
- **Layout fixes from Geoffrey's screenshot:** the loan check stacks below 1280 px (two columns there squeezed the verdict's figures and its button) and the ledger table folds below 1280 px (it ran 26 px wider than a 1024 px screen).
- **Backup:** `Desktop/Phytos CEIH recording 2026-11-01 two apps production 1280/`: the continuous run on this build (labels, Get advance, one-press Start, bulk payment), 12 takes, a picture per beat, no page errors. The four-screen recordings are retired.
- **Season:** re-armed at 12:55, day 12 Jan 2027.
- **Not built:** the float card (decision 7 in [`morning-decisions.md`](morning-decisions.md)).

## Where production stands

**Green, frozen at 06:30, tag `ceih-night-7`** (commit `827620c`, API revision `cropwatch-api-00032-8w4`, MIN_INSTANCES 1). Production stayed green at every check through the night: a watch every 15 minutes from 04:00 to 06:30 found the API and the dashboard up each time.

**Freeze checks (06:31 to 06:45), all on production:**

- **Demo check:** all checks pass, beats 1 to 6 in 8.7 s. A run that overlapped the visual pass took 90 s, because this laptop's line was saturated; alone it was the fastest of the night.
- **Old outbreak check:** report to dispatch in 7.1 s, Lusaka HIGH.
- **Full storyline recorded:** 14 beats, no page errors, every frame looked at. The ground check and the request now read 06:41, not the small hours.
- **Visual pass:** all 72 shots, both apps, laptop, phone and projector sizes. No issues; the shots are in `docs/ui-review/2026-11-01-freeze/`.
- **Season:** re-armed after the recording, at day 12 Jan 2027, armed until 3 Nov.

**Backup video:** `Desktop/Phytos CEIH recording 2026-11-01 final production 1280/`:

- `ceih-storyline.mp4`, the continuous run (86 s);
- `takes/`, one MP4 per beat (4 to 10 s each);
- a PNG per beat.

**Fallbacks:**

- No. 1 is the same build on the preview `ceih-night7`: https://crop-watch01--ceih-night7-fcfiu79x.web.app.
- No. 2 is CEIH without the Fields map: https://crop-watch01--ceih-preview-2d9ec7jj.web.app.
- After those, the outbreak story at `stable-2026-10-31`, with its recordings.

All three previews share production's Firestore, so one re-arm serves them all.

**Tags tonight:**

- `ceih-2026-10-31`: the first production cutover;
- `ceih-night-1` to `ceih-night-7`: one per production deploy, each green.

Any of them can be redeployed with `git checkout <tag> && MIN_INSTANCES=1 bash infra/deploy.sh`.

## What changed this morning (Geoffrey's orders, 06:53 to 08:00)

The app is four screens: **Fields map, Season ledger, Approvals, Reconciliation**.

- **A. Old surfaces deleted.**
  - The National map, Officer queue, Dry-spell scenario and Knowledge sources are gone, with their nav, the verified counter, the bell, the Field visits tab and the old outbreak check.
  - Sign-in lands on the Fields map.
  - The season engine's inputs stay: the observation model, diagnose and verify, the ground check, the seed and the SMS log. The capture app is still deployed, unlinked.
  - Recovery point: tag `pre-ceih-only`.
- **B. De-badged.**
  - No DEMO pills and no "demo" or "prototype" in the copy.
  - Two quiet markers remain: "Simulated season 2026/27" beside the season day (also on the Fields map), and "simulated" on transfers and the insurance payout.
  - The season controls are a small gear at the right end of the top bar, before the avatar.
  - The org reads "Outgrower Co.", and the SMS templates lost their DEMO prefix.
  - CLAUDE.md invariant 5 is amended as your decision.
- **C. The loan check, played.** "Run check" on any farmer plays four stages in about 11 s:
  - the map flies to his traced field and the outline draws itself;
  - the passes arrive along his curve, with the cloud gap;
  - the rules tick on one by one;
  - the cap counts up to the verdict, which carries "Request advance".

  A click moves to the next stage, and Skip goes straight to the verdict. The same rules engine runs underneath, with no scores. It is wired into beat 3.

- **D. Real imagery instead of the satellite glyph.**
  - Each farm's Esri thumbnail, outline on top, appears on the field card, on satellite-only approvals and on the season record's passes.
  - The imagery credit appears once per view.
  - Outlines go only to callers who may see them (invariant 6).
- **E. Tracing.**
  - Drag a corner to adjust it, with the hectares updating live.
  - A click on the first corner closes the field. Esc cancels.
  - Paste "lat, lng" to fly there first.
  - Saving goes straight to the Season ledger with the new row open.
- **Top bar (Geoffrey, 07:56).**
  - The four screens are the pills in the top bar beside the Phytos logo: same style, same active state, Approvals with its count.
  - The gear sits at the right end of the top bar, before the avatar, on every screen.
  - The page keeps only "Outgrower Co.", smaller, with "Simulated season 2026/27 · Season day … · phase" beside it.
  - The header is sticky, so the screens stay in reach on scroll.
  - On a phone the screens are a strip under the header that scrolls sideways, with the current one centred.
- **Combobox, sources, live rainfall (Geoffrey, 09:00).**
  - **Combobox.** The Reconciliation farmer picker is the field-airy combobox: type to filter, an island list opening downward with its own scroll, the camp muted, keyboard and Esc. No native select is left on any screen.
  - **Source lines.** One quiet source line per data card, never two:
    - imagery: "Imagery: Esri, Maxar, Earthstar Geographics";
    - greenness: "Greenness: Sentinel-2 (simulated season)";
    - the drought card's rainfall: "Rainfall series for the simulated season · live seasons read ZMD and CHIRPS".
  - **Live rainfall.** A farm added through Add farm shows its real rainfall on its card: "Rain, <from> to <to>: X mm · Open-Meteo, fetched live", over the last 30 days at the outline's centroid.
    - The browser asks Open-Meteo first; our API asks if the browser is blocked; the answer is cached.
    - If both fail, nothing renders.
    - It is card data only: not in eligibility, the loan check or the run sheet.

Five reviewers read the production app: a judge seeing it cold, a Zambian agribusiness credit manager, a Chikuni field officer, a designer holding it against mockup A, and a pitch mentor timing the run. They ran in three rounds. Each round's findings were triaged against the fixed idea and the invariants, built, checked on a preview, then deployed. Nothing was added to the product's scope.

**The opening lands:**

- The Fields map is the page, as in mockup A: the map fills the screen, and the title, tabs and controls float on it as islands.
- Given is named on his field, and the field is drawn so no neighbour hides it.
- Cloud gaps are ink dashes rather than white boxes.
- The header counts what the map shows: "40 fields · 23 established · 14 under cloud".

**The payoffs happen in view:**

- DEMO CONTROLS (now the gear in the top bar) sat in the sticky tab bar, so the eligibility flip, the drought and the harvest change on screen, not at the foot of the page.
- "Sent" is followed by the ledger rows, which carry the transfer reference.
- Before June the Reconciliation tab leads with the statement; in June the form, then the net due, scroll into view.
- The drought is shown on the map in March, with Hamangaba in brick.
- The run needs no scrolling or Home key: 25 presses in 2:50.

**A credit manager would trust it more:**

- Approval and disbursement re-run the rules on the day, so a camp paused by the drought rule cannot be paid.
- On a real org, only its own credit team can approve, send or record deliveries.
- The cards show the fee's rate, and what the farmer owes at harvest against his projected crop.
- The cap factor names the projected crop value and the ceiling.
- The fee rounds down, like the cap.
- The farmer's code never shows in the SMS log.
- The consent line says whether the SMS was really sent.
- Shortfall rows show kwacha, and the list never cuts silently.

**The words are the field officer's:**

- "Verified" is kept for a field visit; satellite readings are "seen from space".
- "No crop seen from space" replaces "not planted".
- "Within 150 m of the field" replaces "inside the field".
- Each rule shows a tick or a cross.
- Given's check records stage R1, which agrees with his planting date.

**Honest everywhere:**

- The imagery credit says the field outlines are simulated.
- Maker-checker is worded as what is enforced: an approver who did not verify the field.
- The claim pack says an insurer receives camp totals only.
- The README says what is real and what is simulated, including the stand-in login.

**The repository reads clean:**

- A new README.
- Template leftovers and superseded working documents moved to `docs/archive/`.
- Screenshots, recordings and scratch files untracked (kept on disk).
- No AI attribution in any commit since 22:56.

## Decisions waiting for Geoffrey

See [`morning-decisions.md`](morning-decisions.md). In short:

1. **Do first:** fast-forward `main` to `ceih`, so GitHub shows the current README and code (2 minutes, command ready).
2. Older commit messages: a history rewrite, after the pitch if at all.
3. Fields map visibility: a Command Center stand-in sees outlines on the simulated org only; strict mode needs a credit account.
4. Requester ≠ approver: a small rule change, but the live demo would then need a second account.
5. Rule items from the credit-manager review (drought cover for fields that held, moisture pricing, a code-attempt limit, disbursement order).
6. Post-event: rotate David's password; tear down the RAG corpus.

## Rehearsal script v5: two tabs, the agribusiness and Given's phone (3:00, 17 presses)

**Roles.** **D** drives the laptop and says nothing; **N** speaks every line. A number in brackets is D's cue for that press. Timings are the measured app waits on the final production build (`ceih-final-3`) plus speech at about 150 words a minute. Run sheet v4 and its recordings are retired: there is no Approvals screen and no request on the ledger any more.

### Pre-stage

1. **Re-arm after the last rehearsal.** Then run the demo check (green), then `ceih-e2e --warm` in the 10 minutes before you go on.
2. **Browser.** A clean profile, two tabs, zoom 100%, F11 full screen, 1280×800 if the projector takes it. Notifications, sleep and updates off; charger in.
   - **Tab 1, the agribusiness ("Agro dashboard" beside the logo):** https://crop-watch01.web.app, signed in as david@phytos.com.
   - **Tab 2, Given's phone ("Farmer dashboard" beside the logo):** https://crop-watch01-farmer.web.app. **It resets on refresh** and never touches the live season: press F5 on it just before you go on, and rehearse on it as often as you like.
   - **Reconciliation reruns too:** a refresh of tab 1 on Reconciliation always opens on "Start reconciliation", and Start clears the last run's payout rows before it plays. Rehearse it as often as you like; re-arm once at the end to put the season back to January.
   - Ctrl+1 and Ctrl+2 switch the tabs, also in full screen.
3. **"Season ledger" check (tab 1).** Beside "Outgrower Co." the line reads "Season 2026/27 · Season day 12 Jan 2027 · January: the advance". Given is first, with "Not eligible: cloud gap, ground check required". Do not open a row.
4. **Farmer check (tab 2).** "Hello, Given" and the green "Check my advance". "Your loan" shows one line, Inputs on loan ZMW 1,950.
5. **Opening frame.** Tab 1, the "Fields map" (top bar): let it fly into Chikuni, then press **All camps**. Park the pointer top left, off the map.
6. **Backup.** Open `Desktop/Phytos CEIH recording 2026-11-01 two apps production 1280/takes/` in a video player, one Alt+Tab away.
7. **Never press on stage:** "Back to January", "Add farm", "Cancel", "Not now", "Export CSV".
8. **Timekeeper.** One person in the front row holds the checkpoints. D presses only on a cue, never the same button twice.

### Run sheet

| Time      | Beat                        | Presses (D)                                                                                       | Say (N)                                                                                                                                                                                                                                                                                                 | s   |
| --------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0:00–0:14 | Hook (tab 1, Fields map)    | 1. "Chikuni", on the word "Phytos"                                                                | "Zambia's outgrower companies lend seed and fertiliser to farmers they never see. In January those farmers run out of cash, and the crop gets side-sold. **[1]** Phytos is the verification and ledger layer: the agribusiness's season on one side, the farmer's phone on the other."                  | 14  |
| 0:14–0:24 | 1a Chikuni                  | None                                                                                              | "Chikuni camp, Monze, on real satellite imagery. Green: crop seen from space. Grey: no crop seen, so an officer visits. Dashed: cloud. And this is Given Mweemba."                                                                                                                                      | 10  |
| 0:24–0:33 | 1b Season ledger            | 2. "Season ledger" (top bar)                                                                      | "**[2]** The season ledger: 120 contracts, every loan and advance in kwacha. Given first: not eligible. Cloud gap, ground check required."                                                                                                                                                              | 9   |
| 0:33–0:42 | 2 Given's card              | 3. His row                                                                                        | "**[3]** His farm, his curve: on track until the December clouds. One clear pass; the rule wants two, or an officer. Phytos doesn't guess: it sends one."                                                                                                                                               | 9   |
| 0:42–0:48 | 3a Ground check             | 4. The gear (top bar, right)<br>5. "The field officer's ground check lands"<br>6. The gear        | "**[4] [5]** The officer's check lands. **[6]**"                                                                                                                                                                                                                                                        | 6   |
| 0:48–1:04 | 3b The loan check           | 7. "Run check" (on his card); let it play                                                         | "**[7]** The hunger-month loan check. His traced field, on real imagery. The passes along his curve. The rules, one by one: **rules, not a score**. The cap: fifteen percent of his projected crop, 840 kwacha. The agribusiness set these rules before the season: within the cap, no approval queue." | 16  |
| 1:04–1:08 | 4a Given's phone            | 8. "Done"<br>9. Ctrl+2 (tab 2, "Farmer dashboard")                                                | "**[8] [9]** Now Given's phone."                                                                                                                                                                                                                                                                        | 4   |
| 1:08–1:30 | 4b Check my advance         | 10. "Check my advance"; let it play to "You are eligible for ZMW 840" (11 s)<br>11. "Get advance" | "**[10]** He asks for himself. The same check, in his words: his field, his crop from space, the season's rules. He is eligible for 840 kwacha. **[11]** He takes it: the amount and the fee on screen before it is sent, **840 kwacha to his mobile money, simulated**, and the SMS."                  | 22  |
| 1:30–1:38 | 4c His statement            | 12. "Done"                                                                                        | "**[12]** On his statement: the inputs, the advance and the fee. He owes 2,832 kwacha at harvest, from his crop."                                                                                                                                                                                       | 8   |
| 1:38–1:44 | 5a Back to the agribusiness | 13. Ctrl+1 (tab 1, "Agro dashboard")<br>14. "Reconciliation" (top bar)                            | "**[13] [14]** Back to the agribusiness. June: harvest."                                                                                                                                                                                                                                                | 6   |
| 1:44–2:04 | 5b The reconciliation batch | 15. "Start reconciliation" (it moves the season to June, then plays: about 12 s)                  | "**[15]** Who has delivered, and who not yet. Each row: the crop at the contract price, less the inputs, less the advance and fee: what each farmer is owed. Hamangaba's shortfalls: drought, rain and space agree, uncontrollable. Two in Keemba: unexplained, flagged for the credit team."           | 20  |
| 2:04–2:18 | 6 One bulk payment          | 16. "Request bulk payment"<br>17. "Send bulk payment"                                             | "**[16]** One bulk payment for every farmer owed: the count and the total, restated. **[17]** Sent to Phytos: **a simulated transfer, and a ledger row for every farmer**."                                                                                                                             | 14  |
| 2:18–2:29 | Close                       | None; stay on "Bulk payment request sent"                                                         | "The agribusiness could never see its season. Now it can: Given gets the January cash that keeps his crop in the contract, and every farmer is paid at harvest from one ledger. Thank you."                                                                                                             | 11  |
| 2:29–3:00 | Slack                       |                                                                                                   | For the room, a slow tile or a recovery.                                                                                                                                                                                                                                                                | 31  |

**Driver notes:**

- The screens are the pills in the top bar beside the Phytos logo: Fields map, Season ledger, Reconciliation. The gear is at the right end of the top bar, on every screen.
- The loan check runs about 11 s on its own, in both tabs; a click moves it on a stage, "Skip" goes to the verdict. On Given's phone the verdict waits for "Get advance"; the send then takes about 3 s.
- "Start reconciliation" moves the season to June itself (it says so under the button), then the batch plays in under 10 s whatever the count; "Skip" shows it all at once. The page scrolls the batch under the top bar by itself. "Request bulk payment" never fires by itself: it needs the press and the confirm.
- **Tab 2 resets on refresh.** If anything goes wrong there, F5 and press "Check my advance" again: the live season is untouched.

### Checkpoints

| By   | On screen                                                     | Said by then                             |
| ---- | ------------------------------------------------------------- | ---------------------------------------- |
| 0:14 | The fly into Chikuni under way                                | The hook                                 |
| 0:42 | Given's card, a cross on the failing rule                     |                                          |
| 1:04 | The loan check's verdict, "Eligible ZMW 840"                  | "rules, not a score"                     |
| 1:30 | Tab 2: "ZMW 840 sent to your registered mobile money account" | "simulated"                              |
| 1:44 | Tab 1: "Start reconciliation"                                 |                                          |
| 2:18 | "Bulk payment request sent to Phytos · simulated"             | "a simulated transfer, and a ledger row" |

If you are 5 s late at a checkpoint, take the next cut; 15 s late, the next two.

**Cut order:**

1. Beat 4c (saves 8 s): stay on the receipt, say "He owes 2,832 kwacha at harvest" over it, then Ctrl+1.
2. The loan check in tab 1 (saves 6 s): click once per stage instead of letting it play.
3. Beat 5b's last two sentences (8 s).
4. Beat 1b (4 s): say only "Given first: not eligible."

**Never cut:** the loan check's verdict, "rules, not a score", "within the cap, no approval queue", "simulated" on both money lines, the close.

### Recovery rule

- **When to act:** nothing new 8 s after a press (the two loan checks and the batch excepted: they play for 11, 11 and 12 s), red error text, a spinner that keeps turning, or the sign-in page. Missing imagery is not a reason: the map falls back to EOX, then to the plain canvas.
- **Safe to press once more:** a tab, his row, "Chikuni", the gear and its buttons, "Run check", "Skip", "Start reconciliation". Anything in tab 2 (after an F5). F5 on Reconciliation starts the batch over.
- **Never press twice:** "Send bulk payment". If it hangs, go straight to the take.
- **The take:** D Alt+Tabs and plays `takes/<beat>.mp4`; N keeps the same lines and adds "Same step, recorded on production this morning." From beat 5a on, stay on the takes to the close.

### Do not say

1. "predicts", "forecast", "probability", "AI-powered", "revolutionary", "platform", or "score" except in "rules, not a score".
2. "verified from space": it is "seen from space"; "verified" is an officer's visit.
3. "inside his field": say "within 150 metres of the field".
4. "a real transfer", "Phytos lends": the agribusiness lends its own money, inside rules it set; the transfer is simulated.
5. "approved by", "the credit team approves": there is no approval queue now. Rules the agribusiness pre-set decide.
6. "the AI decides", "the model approves": rules decide.
7. "we insure", "insurance paid": a claim pack for a licensed insurer, simulated.
8. "real farmers", "live data": the season is simulated, and the screen says so.
9. "side-seller", "fraud": shortfalls are "unexplained".
10. "Given's phone is live": tab 2 is the farmer app on a snapshot of his season; it resets on refresh.

### Likely questions, with honest answers

- **"Is this real data?"** The imagery is real (Esri). The season is simulated, and every screen says so beside the season day. The rules, the money controls and the ledger arithmetic are the running code.
- **"Who approves the money?"** No one, case by case: the agribusiness sets the season's rules and caps before the season, and within the cap an advance is sent when the farmer asks. Money still needs every rule passed, a ledger row and the provider (simulated here).
- **"Is Given's phone connected to the agribusiness's screen?"** Not in this build: the farmer app runs on a snapshot of his season so it can be shown any number of times. In a live season both read the same ledger.
- **"37 of 40 falling, all 40 uncontrollable?"** The drought rule is camp-wide by design today. Marking only fields whose own curve fell is the next refinement, already written up.

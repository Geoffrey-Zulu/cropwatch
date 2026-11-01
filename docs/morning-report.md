# Morning report (1 Nov 2026)

For Team Phytos, before the final pitch. What changed overnight and why, where production stands, what needs a decision, and the rehearsal script with every click. The detail is in [`overnight-log.md`](overnight-log.md); decisions are in [`morning-decisions.md`](morning-decisions.md).

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

**Known, not changed (freeze):** the "Field visits" tab, which is not on the demo path, still shows the org name in capitals. It is a one-line fix after the pitch.

## What changed overnight, and why

Five reviewers read the production app: a judge seeing it cold, a Zambian agribusiness credit manager, a Chikuni field officer, a designer holding it against mockup A, and a pitch mentor timing the run. They ran in three rounds. Each round's findings were triaged against the fixed idea and the invariants, built, checked on a preview, then deployed. Nothing was added to the product's scope.

**The opening lands:**

- The Fields map is the page, as in mockup A: the map fills the screen, and the title, tabs and controls float on it as islands.
- Given is named on his field, and the field is drawn so no neighbour hides it.
- Cloud gaps are ink dashes rather than white boxes.
- The header counts what the map shows: "40 fields · 23 established · 14 under cloud".

**The payoffs happen in view:**

- DEMO CONTROLS sits in the sticky tab bar, so the eligibility flip, the drought and the harvest change on screen, not at the foot of the page.
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

## Rehearsal script v4: the four screens (3:00, 27 presses, no scrolling)

**Roles.** **D** drives the laptop and says nothing; **N** speaks every line. A number in brackets is D's cue for that press. Timings are measured app waits on the final production build plus speech at about 150 words a minute.

### Pre-stage

1. **Re-arm after the last rehearsal.** Then run the demo check (green), then `ceih-e2e --warm` in the 10 minutes before you go on.
2. **Browser.** A clean profile, signed in as david@phytos.com. Zoom 100%, F11 full screen, 1280×800 if the projector takes it. Notifications, sleep and updates off; charger in.
3. **"Season ledger" check.** The page reads "Season day 12 Jan 2027 · … · Simulated season 2026/27". Given is first, with "Not eligible: cloud gap, ground check required". The tab reads "Approvals 2". Do not open a row.
4. **Opening frame.** On the "Fields map" tab, let it fly into Chikuni, then press **All camps**. Park the pointer top left, off the map.
5. **Backup.** Open `Desktop/Phytos CEIH recording 2026-11-01 four screens production 1280/takes/` in a video player, one Alt+Tab away.
6. **Never press on stage:** "Back to January", "Add farm", "Decline", "Cancel", "Export CSV".
7. **Timekeeper.** One person in the front row holds the checkpoints. D presses only on a cue, never the same button twice.

### Run sheet

| Time      | Beat                         | Presses (D)                                                                                                                   | Say (N)                                                                                                                                                                                                                                                                                                                    | s   |
| --------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0:00–0:14 | Hook (Fields map, All camps) | 1. "Chikuni", on the word "Phytos"                                                                                            | "Zambia's outgrower companies lend seed and fertiliser to farmers they never see. In January those farmers run out of cash, and the crop gets side-sold. **[1]** Phytos is the verification and ledger layer: one season, four screens."                                                                                   | 14  |
| 0:14–0:24 | 1a Chikuni                   | None                                                                                                                          | "Chikuni camp, Monze, on real satellite imagery. Green: crop seen from space. Grey: no crop seen, so an officer visits. Dashed: cloud. And this is Given Mweemba."                                                                                                                                                         | 10  |
| 0:24–0:33 | 1b Season ledger             | 2. "Season ledger" tab                                                                                                        | "**[2]** The season ledger: 120 contracts, every loan and advance in kwacha. Given first: not eligible. Cloud gap, ground check required."                                                                                                                                                                                 | 9   |
| 0:33–0:42 | 2 Given's card               | 3. His row                                                                                                                    | "**[3]** His farm, his curve: on track until the December clouds. One clear pass; the rule wants two, or an officer. Phytos doesn't guess: it sends one."                                                                                                                                                                  | 9   |
| 0:42–0:48 | 3a Ground check              | 4. The gear<br>5. "The field officer's ground check lands"<br>6. The gear                                                     | "**[4] [5]** The officer's check lands. **[6]**"                                                                                                                                                                                                                                                                           | 6   |
| 0:48–1:04 | 3b The loan check            | 7. "Run check" (on his card); let it play                                                                                     | "**[7]** The hunger-month loan check. His traced field, on real imagery. The passes, along his curve: the clouds, then on track. The rules, one by one: photo within 150 metres, the ground check covers the clouds, no open problem: **rules, not a score**. The cap: fifteen percent of his projected crop. 840 kwacha." | 16  |
| 1:04–1:24 | 4 Amount, fee, code          | 8. "Request advance for Given" (on the verdict)<br>9. "Send to Given"<br>10. "Use the code from the SMS log"<br>11. "Confirm" | "**[8]** Before anything moves: the amount, the fee, five percent flat, and what he owes at harvest. **[9]** The SMS with the amount, the fee and a code: logged on screen, not sent. **[10]** He reads the code back. **[11]** Confirmed by the farmer."                                                                  | 20  |
| 1:24–1:38 | 5 Approval card              | 12. "Open approvals"                                                                                                          | "**[12]** The credit team approves, and never the officer who verified the field: same record, same curve, same rules. The agribusiness lends its own money."                                                                                                                                                              | 14  |
| 1:38–1:54 | 6 Money and ledger           | 13. "Approve ZMW 840"<br>14. "Approve and send"<br>15. "Done"<br>16. "Reconciliation" tab                                     | "**[13] [14]** Approved. 840 kwacha to his mobile money: **a simulated transfer; the ledger row is real**. **[15] [16]** On Given's statement: the advance and the fee, straight from the ledger."                                                                                                                         | 16  |
| 1:54–2:10 | 7a March: the drought rule   | 17. The gear<br>18. "Go to March: drought rule"<br>19. The gear                                                               | "**[17] [18]** Jump to March. Hamangaba: 8.3 millimetres of rain against a 60 millimetre rule; from space, 37 of 40 fields falling. **[19]** Rain and space agree, so the rule fires: advances pause there, and a claim pack is ready for a licensed insurer, simulated."                                                  | 16  |
| 2:10–2:19 | 7b The drought on the map    | 20. "Fields map" tab (let Chikuni land)<br>21. "Hamangaba"                                                                    | "**[20]** Chikuni, Given's camp: no drought flag. **[21]** Hamangaba: all 40 fields in brick."                                                                                                                                                                                                                             | 9   |
| 2:19–2:37 | 8 June: harvest              | 22. "Reconciliation" tab<br>23. The gear<br>24. "Go to June: harvest"<br>25. The gear<br>26. "Record delivery"                | "**[22] [23] [24]** June: harvest. **[25]** The depot enters Given's delivery: 720 kilos, grade A. **[26]** Net due to Given: 2,928 kwacha, every line from the ledger. Keemba's shortfalls: unexplained, so the credit team looks there first. Hamangaba's: uncontrollable."                                              | 18  |
| 2:37–2:48 | Close                        | None; stay on the statement                                                                                                   | "The agribusiness could never see its season. Now it can, so it can give Given the January cash that keeps the crop in the contract. Thank you."                                                                                                                                                                           | 11  |
| 2:48–3:00 | Slack                        |                                                                                                                               | For the room, a slow tile or a recovery.                                                                                                                                                                                                                                                                                   | 12  |

**Driver notes:**

- The loan check runs about 11 s on its own. A click anywhere in it moves to the next stage, and "Skip" goes straight to the verdict. If you run long, click once per stage while N speaks.
- The Fields map flies into Chikuni about 0.7 s after it opens, unless a camp was already pressed. In 7b, wait for Chikuni to land before pressing "Hamangaba".
- "Record delivery" needs no typing: 720 kg, 11% and grade A are already filled in.

### Checkpoints

| By   | On screen                                               | Said by then                                   |
| ---- | ------------------------------------------------------- | ---------------------------------------------- |
| 0:14 | The fly into Chikuni under way                          | The hook                                       |
| 0:42 | Given's card, a cross on the failing rule               |                                                |
| 1:04 | The loan check's verdict, "Eligible ZMW 840"            | "rules, not a score"                           |
| 1:24 | "Confirmed by the farmer"                               | "logged on screen, not sent"                   |
| 1:54 | Given's statement with "Cash advance" and "Advance fee" | "a simulated transfer; the ledger row is real" |
| 2:19 | Hamangaba in brick                                      |                                                |
| 2:37 | "Net due to Given ZMW 2,928"                            |                                                |

If you are 5 s late at a checkpoint, take the next cut; 15 s late, the next two.

**Cut order:**

1. Beat 7b (saves 9 s): stay on Reconciliation after 7a.
2. The loan check (saves 6 s): click once per stage instead of letting it play.
3. Beat 8's last two sentences (6 s).
4. Beat 1b (4 s): say only "Given first: not eligible."
5. Beat 7a's figures (6 s).

**Never cut:** the loan check's verdict, "rules, not a score", "a simulated transfer; the ledger row is real", "logged on screen, not sent", "never the officer who verified the field", the close.

### Recovery rule

- **When to act:** nothing new 8 s after a press (the loan check excepted: it plays for about 11 s), red error text, a spinner that keeps turning, or the sign-in page. Missing imagery is not a reason: the map falls back to EOX, then to the plain canvas.
- **Safe to press once more:** a tab, his row, "Chikuni", "Hamangaba", the gear and its buttons, "Run check", "Skip".
- **Never press twice:** "Send to Given", "Confirm", "Approve and send", "Record delivery". If one of those hangs, go straight to the take.
- **The take:** D Alt+Tabs and plays `takes/<beat>.mp4`; N keeps the same lines and adds "Same step, recorded on production this morning." From beat 3a on, stay on the takes to the close.

### Do not say

1. "predicts", "forecast", "probability", "AI-powered", "revolutionary", "platform", or "score" except in "rules, not a score".
2. "verified from space": it is "seen from space"; "verified" is an officer's visit.
3. "his photo": the approval card's photo is a library image.
4. "inside his field": say "within 150 metres of the field".
5. "Given gets an SMS": it is "logged on screen, not sent".
6. "a real transfer", "Phytos pays", "Phytos lends": the agribusiness lends its own money; the transfer is simulated.
7. "the AI decides", "the model approves": rules decide, and the approver is never the officer who verified.
8. "we insure", "payout sent": a claim pack for a licensed insurer, simulated.
9. "real farmers", "live data": the season is simulated, and the screen says so.
10. "side-seller", "fraud": shortfalls are "unexplained".

### Likely questions, with honest answers

- **"Is this real data?"** The imagery is real (Esri). The season is simulated, and every screen says so beside the season day. The rules, the money controls and the ledger arithmetic are the running code.
- **"One login requested and approved?"** The rule we enforce is that the officer who verified the field cannot approve. Requester ≠ approver is one more rule, added together with a credit-team account.
- **"37 of 40 falling, all 40 uncontrollable?"** The drought rule is camp-wide by design today. Marking only fields whose own curve fell is the next refinement, already written up.

# Morning report (1 Nov 2026)

For Team Phytos, before the final pitch. What changed overnight and why, where production stands, what needs a decision, and the rehearsal script with every click. The detail is in [`overnight-log.md`](overnight-log.md); decisions are in [`morning-decisions.md`](morning-decisions.md).

## Where production stands

<!-- filled at the 06:30 freeze -->

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

## Rehearsal script (3:00, 25 presses, no scrolling)

**Roles.** **D** drives the laptop and says nothing; **N** speaks every line. A number in brackets in N's line is D's cue for that press. Timed at about 150 words a minute against the app waits measured on production. Nothing in the run needs a scroll or the Home key; if you find yourself scrolling, use the recovery rule.

### Pre-stage

1. **Re-arm only after the last rehearsal.** Then run the demo check (green), then `ceih-e2e --warm` in the 10 minutes before you go on. Every run uses up the season.
2. **Browser and laptop.** A clean profile signed in as david@phytos.com, zoom 100%, F11 full screen, 1280×800 if the projector takes it. Notifications, sleep and updates off; the charger plugged in.
3. **"Season ledger" tab check.** The season day reads 12 Jan 2027; Given is first with "Not eligible: cloud gap, ground check required"; the tab reads "Approvals 2". If anything differs, re-arm. Do not open a row.
4. **"Fields map" tab.** Wait for the fly into Chikuni, then press **All camps** and park the pointer top left, off the map. This is the opening frame.
5. **Backup video.** Open `Desktop/Phytos CEIH recording 2026-11-01 final production 1280/takes/` in a video player, one Alt+Tab away. N keeps a copy on USB.
6. **Never press on stage:** "Back to January", "Add farm", "Decline", "Cancel", "Close", "Export CSV".
7. **Discipline.** A timekeeper sits in the front row with the checkpoints. D presses only on a cue, and never presses the same button twice.

### Run sheet

| Time      | Beat                         | Presses (D)                                                                                                                                                                            | Say (N)                                                                                                                                                                                                                                                                                                               | s   |
| --------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| 0:00–0:14 | Hook (Fields map, All camps) | 1. "Chikuni", on the word "Phytos" (the fly-in takes up to 3.7 s)                                                                                                                      | "Zambia's outgrower companies lend seed and fertiliser to farmers they never see. In January those farmers run out of cash, and the crop gets side-sold. **[1]** Phytos is the verification and ledger layer: one season, one dashboard."                                                                             | 14  |
| 0:14–0:24 | 1a Chikuni                   | None; pointer still                                                                                                                                                                    | "Chikuni camp, Monze. Green: crop seen from space. Grey: no crop seen, so an officer visits. Dashed: cloud gaps. And this is Given Mweemba."                                                                                                                                                                          | 10  |
| 0:24–0:34 | 1b Season ledger             | 2. "Season ledger" tab                                                                                                                                                                 | "**[2]** The season ledger: 120 contracts, every loan and advance in kwacha. Given comes first: not eligible. Cloud gap, ground check required."                                                                                                                                                                      | 10  |
| 0:34–0:48 | 2 Given's card               | 3. His row (the card rises); point at the crosses                                                                                                                                      | "**[3]** From space, his crop tracks the camp, until the December clouds. Every rule shows a tick or a cross: **rules, not a score**. Phytos doesn't guess: it sends the officer."                                                                                                                                    | 14  |
| 0:48–1:02 | 3 Ground check               | 4. "DEMO CONTROLS"<br>5. "The field officer's ground check lands"<br>6. "DEMO CONTROLS" (folds it)                                                                                     | "**[4]** This demo control stands in for the officer's visit. **[5]** Field verified: eligible, capped at 840 kwacha. **[6]** Beside him, Joseph: no crop seen from space. No advance; a visit task instead."                                                                                                         | 14  |
| 1:02–1:24 | 4 Amount, fee, code          | 7. "Request advance for Given"<br>8. "Send to Given"<br>9. "Use the code from the SMS log (demo)"<br>10. "Confirm"                                                                     | "**[7]** Requested on Given's behalf; the agribusiness lends its own money. Before anything moves: the amount, the fee, and what he owes at harvest. **[8]** The SMS with the amount, the fee and a code: in the demo, logged on screen, not sent. **[9]** He reads the code back. **[10]** Confirmed by the farmer." | 22  |
| 1:24–1:39 | 5 Approval card              | 11. "Open approvals"                                                                                                                                                                   | "**[11]** The credit team approves, and never the officer who verified the field: same record, same curve, same rules. A ground check counts only within 150 metres of the field; the picture here is a library image."                                                                                               | 15  |
| 1:39–1:55 | 6 Money and ledger           | 12. "Approve ZMW 840"<br>13. "Approve and send"<br>14. "Done"<br>15. "Reconciliation" tab (the statement scrolls in)                                                                   | "**[12] [13]** Approved. 840 kwacha to his mobile money: **a simulated transfer in the demo; the ledger row is real**. **[14] [15]** On Given's statement: the advance and the fee, straight from the ledger."                                                                                                        | 16  |
| 1:55–2:12 | 7a March: the drought rule   | 16. "DEMO CONTROLS"<br>17. "Go to March: drought rule"<br>18. "DEMO CONTROLS" (folds it)                                                                                               | "**[16] [17]** Jump to March. Hamangaba: 8.3 millimetres of rain against a 60 millimetre rule; from space, 37 of 40 fields falling. **[18]** Rain and space agree, so the rule fires: advances pause there, and a claim pack is ready for a licensed insurer, simulated."                                             | 17  |
| 2:12–2:21 | 7b The drought on the map    | 19. "Fields map" tab (it flies into Chikuni; let it land)<br>20. "Hamangaba"                                                                                                           | "**[19]** On the map: Chikuni, Given's camp, no drought flag. **[20]** Hamangaba: all 40 fields in brick."                                                                                                                                                                                                            | 9   |
| 2:21–2:39 | 8 June: harvest              | 21. "Reconciliation" tab<br>22. "DEMO CONTROLS"<br>23. "Go to June: harvest" (the form scrolls in)<br>24. "DEMO CONTROLS" (folds it)<br>25. "Record delivery" (the net due scrolls in) | "**[21] [22] [23]** Jump to June: harvest. **[24]** The depot enters Given's delivery: 720 kilos, grade A. **[25]** Net due to Given: 2,928 kwacha, every line from the ledger. Keemba's shortfalls: unexplained, so the credit team looks there first. Hamangaba's: uncontrollable."                                 | 18  |
| 2:39–2:50 | Close                        | None; stay on the statement                                                                                                                                                            | "The agribusiness could never see its season. Now it can, so it can give Given the January cash that keeps the crop in the contract. Thank you."                                                                                                                                                                      | 11  |
| 2:50–3:00 | Slack                        |                                                                                                                                                                                        | For the room, a slow tile or a recovery.                                                                                                                                                                                                                                                                              | 10  |

**Driver notes:**

- The Fields map flies into Chikuni about 0.7 s after it opens, unless a camp was already pressed. That is why the pre-stage presses "All camps", and why in 7b you wait for Chikuni to land before pressing "Hamangaba".
- In beats 3 and 8 the DEMO CONTROLS panel covers the right side: always fold it with a second press of the pill.
- "Record delivery" needs no typing: 720 kg, 11% and grade A are already filled in.

### Checkpoints

| By   | On screen                                               | Said by then                                               |
| ---- | ------------------------------------------------------- | ---------------------------------------------------------- |
| 0:14 | The fly into Chikuni under way                          | The hook                                                   |
| 0:34 | Season ledger, Given "Not eligible"                     |                                                            |
| 0:48 | Given's card, ticks and crosses                         | "rules, not a score"                                       |
| 1:02 | "Eligible · cap ZMW 840", panel folded                  |                                                            |
| 1:24 | "Confirmed by the farmer"                               | "logged on screen, not sent"                               |
| 1:55 | Given's statement with "Cash advance" and "Advance fee" | "a simulated transfer in the demo; the ledger row is real" |
| 2:21 | Hamangaba in brick                                      |                                                            |
| 2:39 | "Net due to Given ZMW 2,928"                            |                                                            |
| 2:50 |                                                         | "Thank you."                                               |

5 s late at a checkpoint: take the next cut. 15 s late: take the next two. Never speed up the verbatim lines.

**Cut order:**

1. Beat 7b (saves 9 s): stay on Reconciliation after 7a, and start beat 8 at press 22.
2. Beat 8's last two sentences (saves 6 s).
3. Beat 1b (saves 5 s): say only "Given comes first: not eligible."
4. Beat 7a's figures (saves 6 s): say "Jump to March. In Hamangaba, rain and space agree, so the drought rule fires: advances pause there; claim pack ready for a licensed insurer, simulated."
5. Beat 1a (saves 5 s): say only "Chikuni camp. And this is Given Mweemba."

**Never cut:** "rules, not a score"; "a simulated transfer in the demo; the ledger row is real"; "logged on screen, not sent"; "library image"; "never the officer who verified the field"; the close.

### Recovery rule

- **When to act:** if nothing new appears 8 s after a press (the slowest beat answers in 4.5 s), red error text appears, a spinner keeps turning, or the sign-in page appears. Missing imagery is not a reason: the map falls back to EOX, then to the plain canvas, and the fields still draw.
- **Safe to press once more:** a tab, his row, "Chikuni", "Hamangaba", DEMO CONTROLS and its buttons.
- **Never press twice:** "Send to Given", "Confirm", "Approve and send", "Record delivery". If one of these hangs, go straight to the take.
- **Playing a take:** D Alt+Tabs to the player and plays `takes/<beat>.mp4`, pausing each take on its last frame until N finishes the line. N keeps the same lines and adds only: "Same step, recorded on production last night."
- **Going back live:** before beat 3 nothing has changed yet, so go back live at the next beat if the app answers. From beat 3 on, stay on the takes to the close.

**Takes per beat:**

| Beat | Take files                                                    |
| ---- | ------------------------------------------------------------- |
| 1a   | `1a-fields-map`                                               |
| 1b   | `1b-season-ledger`                                            |
| 2    | `2-given-cloud-gap`                                           |
| 3    | `3-ground-check-eligible`                                     |
| 4    | `4a-request-amount-and-fee`, `4b-farmer-code`, `4c-confirmed` |
| 5    | `5-approval-card`                                             |
| 6    | `6a-approve`, `6b-sent`, `6c-ledger-rows`                     |
| 7a   | `7a-march-drought`                                            |
| 7b   | `7b-fields-map-drought`                                       |
| 8    | `8-june-statement`                                            |

### Do not say

1. "predicts", "forecast", "probability", "AI-powered", "revolutionary", "platform", or "score" except in "rules, not a score".
2. "verified from space" or "the satellite verified": it is "seen from space"; "verified" is an officer's visit.
3. "his photo" or "the photo taken a minute ago": it is a library image.
4. "inside his field": say "within 150 metres of the field".
5. "Given gets an SMS" or "the SMS is sent": it is "logged on screen, not sent".
6. "a real transfer", "Phytos pays" or "Phytos lends": the agribusiness lends its own money; the transfer is simulated.
7. "the AI decides" or "the model approves": rules decide, and the approver is never the officer who verified.
8. "we insure" or "payout sent": it is a claim pack for a licensed insurer, simulated.
9. "it learns", "real farmers" or "live data": demo data, simulated.
10. "side-seller", "cheating" or "fraud": shortfalls are "unexplained".

### Likely questions, with honest answers

- **"One login requested and approved?"** The rule we enforce is that the officer who verified the field cannot approve. Requester ≠ approver is a one-line rule we add together with a credit-team account.
- **"37 of 40 falling, but all 40 marked uncontrollable?"** The drought rule is camp-wide by design today. Marking only the fields whose own curve fell is the next refinement, and it is already written up.
- **"The cap ignores the input loan?"** The card shows both: Given owes ZMW 2,832 at harvest against ZMW 5,600 projected. The 15% cap is the agribusiness's own setting.

# Demo-day operations

The checklist and the timed run for the live Phytos demo at the GreenCode final (3-minute pitch). Start the morning checklist **at least two hours before** the pitch, from a laptop with the repo, pnpm 12.9.1 and `gcloud` logged in as `zulugeoffrey034@gmail.com`. Every command runs from the repo root. Each step says what "good" looks like; if a step fails, fix it before moving on.

- Capture app (presenter's phone): https://crop-watch01-capture.web.app
- Command Center (laptop): https://crop-watch01.web.app
- API: `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1`
- The morning ritual for the CEIH demo is below ("Morning ritual (CEIH)"). The printed checklist and the Saturday test plan from before the pivot are in [`archive/`](archive/).

## CEIH pivot (31 Oct): the dashboard-only demo

Plan: [`ceih-overnight-plan.md`](ceih-overnight-plan.md) (storyline v2, §4). The demo is the dashboard: Outgrower View → Season ledger, Approvals, Reconciliation. The old path below stays as the fallback and passes on the same API.

**Where it runs (production since 31 Oct 23:06, tag `ceih-2026-10-31`, API revision `cropwatch-api-00017-c5w`):**

| What                                            | URL                                                                                                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard (the demo)                            | https://crop-watch01.web.app → `#/outgrower/fields`                                                                                                                              |
| Capture app (optional live photo)               | https://crop-watch01-capture.web.app                                                                                                                                             |
| API                                             | https://cropwatch-api-24960589333.europe-west1.run.app                                                                                                                           |
| Fallback no. 1: the Block 2 preview, same build | https://crop-watch01--ceih-fields-bn4uxra8.web.app (API tag `fields`: https://fields---cropwatch-api-7d3oc7ppba-ew.a.run.app)                                                    |
| Fallback no. 2: CEIH without the Fields map     | https://crop-watch01--ceih-preview-2d9ec7jj.web.app → `#/outgrower/season` (API tag `ceih`: https://ceih---cropwatch-api-7d3oc7ppba-ew.a.run.app; demo check with `--no-fields`) |
| Static preview for mentors                      | https://crop-watch01.web.app/mockups/d-ceih.html                                                                                                                                 |

The previews share production's Firestore, so one re-arm serves all three builds. Leave the `ceih` and `fields` tags and their channels alone (they expire 7 Nov). `infra/deploy.sh` sends all production traffic to the new revision and keeps the tags. Sign in as a Command Center account (david@phytos.com): it stands in for the credit team, and it is not the officer who verifies the field, so it may approve.

**Morning ritual (CEIH):**

1. Re-arm both paths in one run: `pnpm --filter @repo/seed seed --live-demo --demo-issue tuta_absoluta --demo-center=-15.388311,28.346069 --demo-district Lusaka --ceih --commit`. Good: "Firestore CEIH: 120 farmers and contracts …; season day 2027-01-1x". Add `--demo-phone +2609…` to let Given's SMS reach the judge's phone once the Africa's Talking secrets exist; add `--given-pin <venue lat,lng>` only for the live capture-app beat (his field must be where the photo is taken).
2. Demo check: `PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/admin-tools ceih-e2e` (production by default; `--api <url>` for a fallback). Good: "All checks passed", beats 1 to 6 in about 10 to 16 s, "Cleaned up … the season is armed again". Then the old path: `API_URL=<that API>/api/v1 pnpm --filter @repo/admin-tools outbreak-e2e …` (step 3 below).
3. Warm-up just before the pitch: the same `ceih-e2e … --warm` (the Fields map and one Esri imagery tile over Chikuni, the ledger, Given's card, REST eligibility and satellite; changes nothing). Good: "Fields map: Chikuni armed, two grey holes", "the Fields map loads imagery", "Warm in … s".
4. Open the dashboard in a clean browser profile at the projector's resolution, signed in, on `#/outgrower/fields`, and let the map land once: the browser then holds the Chikuni tiles (the page also prefetches zooms 13 to 17 over every camp). If the venue blocks Esri, the map switches to EOX Sentinel-2 by itself; if both fail it shows the fields on the plain canvas, and the story still holds.

**Storyline v3 (1 Nov, after the overnight review), what to press.** Pre-stage: the dashboard on `#/outgrower/fields` with **All camps** pressed, the map landed once. DEMO CONTROLS is the pill pinned at the bottom right of every Outgrower tab except the Fields map; its panel opens upward, and a press shows its effect in view.

| Beat      | On screen                                                                                                                                                            | Press                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a        | Fields map: the fly into Chikuni; green fields, two grey "no crop seen" holes, one amber stress field, white-dashed cloud gaps; **Given Mweemba** named on his field | "Chikuni"                                                                                                                                                                                                                              |
| 1b        | Season ledger, the portfolio counting up; Given first: "Not eligible: cloud gap, ground check required"                                                              | The "Season ledger" tab                                                                                                                                                                                                                |
| 2         | His card rises under the header: the curve tracking the camp until the December clouds, the factors                                                                  | His row                                                                                                                                                                                                                                |
| 3         | The card flips in view: Eligible · cap ZMW 840, the cap's arithmetic; Joseph beside him: not planted, no advance                                                     | DEMO CONTROLS → "The field officer's ground check lands", then the pill again to fold it (or, live: a capture-app photo of a **healthy** soya plant from inside his field, armed with `--given-pin`, then the same button verifies it) |
| 4         | Amount, fee (5% flat) and what he owes at harvest, before anything is sent; the code read back                                                                       | "Request advance for Given" → "Send to Given" → "Use the code from the SMS log (demo)" → Confirm                                                                                                                                       |
| 5         | The approval card: record, factors, "owed at harvest ZMW 2,832 of ZMW 5,600 projected", the officer who verified cannot approve; the code masked in the SMS log      | "Open approvals"                                                                                                                                                                                                                       |
| 6         | "ZMW 840 sent" (simulated transfer), then **the ledger**: Given's statement with the advance and fee rows                                                            | "Approve ZMW 840" → "Approve and send" → Done → the "Reconciliation" tab                                                                                                                                                               |
| 7a        | March: Hamangaba's drought trigger (8.3 mm against the 60 mm rule, camp greenness 0.68 to 0.52, 37 of 40 fields falling), advances there paused                      | DEMO CONTROLS → "Go to March: drought rule", fold the pill                                                                                                                                                                             |
| 7b        | The drought as a picture: Hamangaba's 40 fields in brick, Chikuni still green                                                                                        | The "Fields map" tab → "Hamangaba"                                                                                                                                                                                                     |
| 8 (close) | June: Given's statement, delivery 720 kg grade A, net due ZMW 2,928; beside it, shortfalls under the drought marked uncontrollable, Keemba's unexplained             | The "Reconciliation" tab → DEMO CONTROLS → "Go to June: harvest" → fold → "Record delivery"                                                                                                                                            |

The presenter never says "his photo" (the seeded check uses a library image), "predicts", "AI-powered" or "probability". Two lines must be exact: "rules, not a score" at the factors, and "a simulated transfer in the demo; the ledger row is real" at the money. An approval refused because the rules changed since the request (a camp paused by the drought rule) says so on the card.

Each beat answers in about 1 to 4.5 s on the deployed revision (recorded 31 Oct). Backup recordings (a continuous run as `.webm` and `.mp4`, a take a beat in `takes/`, a frame a beat), at 1280×800:

- `Desktop/Phytos CEIH recording 2026-10-31 production 1280/`: production, the Fields map opening (the current backup).
- `Desktop/Phytos CEIH recording 2026-10-31 fields-preview/`: the same build on the Block 2 preview.
- `Desktop/Phytos CEIH recording 2026-10-31/`: the first take, opening on the Season ledger.

Recorded with `PHYTOS_RECORD_EMAIL=… PHYTOS_RECORD_PASSWORD=… pnpm --filter @repo/visual record-ceih --out <folder> [--dashboard <url>] [--size 1920x1080]` (default dashboard: production; ffmpeg cuts the takes). It moves the season to June: re-arm after recording.

The Fields map is the Outgrower View's own: farm-level outlines for this agribusiness under contract consent (its credit and field-officer roles; a Command Center account stands in on the simulated org), camp totals for anyone else, and nothing precise in exports. "Add farm" (draw-to-enrol) works live but leaves a farmer behind: re-arm after showing it.

**Cutover: done** (31 Oct 23:06, `MIN_INSTANCES=1 bash infra/deploy.sh` from `ceih`). **Fallback until Sunday 09:00:** if beats 1 to 6 are not green on the deployed build, present `stable-2026-10-31` (field-airy, the outbreak story) with its recordings and tell the CEIH story on slides.

## Before the day (freeze tag freeze-2026-10-30)

### Officer accounts (Geoffrey)

The dashboard needs officer accounts; creating them grants roles, so Geoffrey runs these himself:

1. Create the accounts in the Firebase console (Authentication → Add user), email and password:
   - the dashboard laptop's agronomist, e.g. `agronomist@<your domain>`;
   - optionally a field officer for the Outgrower View alone.
2. Give them roles:

   ```bash
   pnpm --filter @repo/admin-tools set-role --email <agronomist email> --role agronomist
   pnpm --filter @repo/admin-tools set-role --email <field officer email> --role field_officer --org demo-outgrower
   ```

3. Sign in on the laptop at https://crop-watch01.web.app. Good: the national map, the verified counter in the header, and the **DEMO DATA · SIMULATED** pill on the map's top-right corner.

### Backup recordings of every step

Record each step of the run below on the real devices, once it passes, and keep the files on the laptop desktop (and a USB stick):

1. The capture app opening on the camera, a photo of leaf mines, Send, the diagnosis and the advice ladder.
2. The dashboard map as the report lands and the cluster ring appears; Lusaka going from Elevated to High; the bell showing the new alert and the alerts drawer.
3. The SMS arriving on a phone (or the Africa's Talking simulator, if the live account is not ready).
4. The officer queue: verifying the presenter's report, the counter ticking, the alert turning into a verified cluster alert (open the bell to show it).
5. The Outgrower View: the camps and officer lines on load, "Prioritise field officers", the visit lists, and one visit drawer (View).
6. The presenter's report in its drawer, then "Why this advice?" (sources with tiers, the register check).

If the wifi or the API fails on stage, play the matching recording and keep talking.

**Made on 30 Oct (automated, genuine live runs):** `Desktop/Phytos backup recordings 2026-10-30 seeded/` holds recordings 1, 2, 4, 5 and 6 of the current stable version (tag `stable-2026-10-30c`: Zambian names, library photos); `Desktop/Phytos backup recordings 2026-10-30/` holds the same set made earlier, before the seed realism pass, with a README and the run's log. They were recorded by `tools/visual/record-demo.ts` driving the live capture app (phone size) and dashboard (laptop size) through one real report at the venue pin, which was then retracted. Recording 3 (the SMS on a phone) still has to be filmed on the phone. To re-make them (for example after a UI change):

```bash
PHYTOS_RECORD_EMAIL=<officer email> PHYTOS_RECORD_PASSWORD=<password> pnpm --filter @repo/visual record-demo --out <folder> --photo path/to/leaf-mines.jpg
pnpm --filter @repo/admin-tools retract-report --obs <the id it prints> --commit
```

### Field-airy rebuild: preview and cutover (31 Oct)

The rebuild (mockup A, with B's map motion) runs on the "rebuild" Hosting preview channels. Production stays on the stable UI all Saturday for the mentor walkthroughs.

- Dashboard preview: https://crop-watch01--rebuild-we2jq4zo.web.app
- Capture preview: https://crop-watch01-capture--rebuild-dmzdlrt4.web.app

Both channels expire 6 Nov and are allowed by the API's CORS. To redeploy the previews from the current branch:

```bash
URL=$(gcloud run services describe cropwatch-api --region europe-west1 --project crop-watch01 --account zulugeoffrey034@gmail.com --format='value(status.url)')
VITE_API_BASE="$URL" VITE_FEATURE_SCENARIO=true pnpm --filter web build
VITE_API_URL="https://cropwatch-api-24960589333.europe-west1.run.app/api/v1" pnpm --filter capture build
firebase hosting:channel:deploy rebuild --only dashboard,capture --expires 7d --project crop-watch01 --account zulugeoffrey034@gmail.com
```

**Cutover**, only when the rebuild passes the full gate, the demo check and the visual pass: run `bash infra/deploy.sh` (it rebuilds and deploys both production sites), then the demo check. **Fallback** until 09:00 Sunday: check out the tag `stable-2026-10-30c` and run `bash infra/deploy.sh`.

### Still to do before Sunday (people)

- **Recording 3,** the SMS or alert buzz on the phone, filmed at the next human run.
- **The in-app alert buzz,** tested on the demo phone: "Send alerts for Lusaka to this phone" in the capture app, then one demo check at the venue pin (step 3). The phone should buzz with the alert.

## Morning-of checklist

### 1. Warm the API

```bash
bash infra/scale.sh 1
```

Good: `ok: min instances 1; {"status":"ok",...}`. One instance now stays warm, so there's no cold start on stage (about US$2/day until you set it back to 0).

If the code changed since the last deploy, deploy instead (about 8 min, same effect): `MIN_INSTANCES=1 bash infra/deploy.sh`.

### 2. Re-arm the live demo at the venue (the current arming has expired)

The arming lasts about 59 hours, so do this **on the morning of the pitch**. The venue is the **M'Kango Golfview Hotel, Lusaka: `-15.388311, 28.346069`** (Geoffrey's Google Maps pin). The demo issue is Tuta absoluta on tomato. Dry run first:

```bash
pnpm --filter @repo/seed seed --live-demo --demo-issue tuta_absoluta --demo-center=-15.388311,28.346069 --demo-district Lusaka
```

Good:

- `Live demo: 4 qualifying tuta_absoluta reports within 10 km of -15.388311, 28.346069`.
- `Armed until <time>`, with that time **after the pitch**.
- No `Checks failed` (the checks also confirm the presenter's report will form a **new** cluster, which is what raises the alert).

Then run the same command with `--commit` added.

### 3. Rehearse the presenter's report end to end, then undo it

With a photo of the actual demo leaf (**leaf mines**):

```bash
pnpm --filter @repo/admin-tools outbreak-e2e --image path/to/leaf-mines.jpg --center -15.388311,28.346069 --district Lusaka
```

Good: `All checks passed`; the cluster and its alert within seconds of the report; dispatch finished well under 30 s. It deletes and retracts everything it made, so the demo stays armed. Then a plain diagnosis check far from the venue:

```bash
pnpm --filter @repo/admin-tools smoke-e2e --image path/to/leaf-mines.jpg --crop tomato
```

Good: `all checks passed`, including the advice check (every chemical option passed the register check; none is a placeholder). On 29 Oct the model proposed no chemical for a Tuta leaf, so the advice was IPM-only with the officer referral: expected, and safe.

### 4. SMS (Africa's Talking)

- If the account's secrets are in Secret Manager (`africastalking-username`, `africastalking-api-key`) and deployed, alerts go out by SMS; otherwise the API logs what it would have sent and only push works.
- Check the account balance.
- Subscribe the phones that should receive the live SMS, with their owners' consent:

  ```bash
  pnpm --filter @repo/admin-tools sms-subscribe add --phone +260… --district Lusaka --consent "verbal, at the venue, 1 Nov" --label "Judge 1"
  pnpm --filter @repo/admin-tools sms-subscribe list
  ```

- The text reads `Phytos DEMO alert (Act now): Tuta absoluta (tomato leafminer) near Lusaka. …` It says DEMO because the cluster includes simulated reports. It comes from Africa's Talking's default sender: a "Phytos" sender ID needs ZICTA registration and is not ready.

### 5. Quota and spend sanity check

- **Vertex AI quota:** run the photo eval over 5–12 field photos (a folder of JPEGs plus `labels.json`; the format is in `apps/functions/src/eval/diagnoseEval.ts`):

  ```bash
  pnpm --filter @repo/functions eval:diagnose path/to/photos
  ```

  Good: `schemaValid` equals `images` and no image takes over 20 s. `call failed: ... 429` means the shared Gemini quota is under pressure: re-run in 10 minutes and keep the recordings ready.

- **Spend:** Cloud console → Billing → Budgets. The `cropwatch-hackathon` budget ($50) should be comfortably under its first 50% alert.

### 6. Devices

- **Presenter's phone:** the Phytos app installed from https://crop-watch01-capture.web.app; camera and location allowed; on 4G mobile data, not the venue wifi; battery above 80%.
- **The leaf:** a tomato leaf with **leaf mines**. Photograph the mines, close up, in daylight. **Not fruit**: on 26 Oct a fruit photo of Tuta damage came back as early blight with high confidence, while the leaf photo was right every time.
- **Dashboard laptop:** signed in as the agronomist, on the national map, focus "Lusaka and Chongwe", bell drawer closed.
- **Kit:** hotspot charged; backup recordings on the desktop.

## The run: Sunday 3-minute final script

Agreed 30 Oct, with the wording revised the same day so every line matches the build. Two presenters: **P1** on the phone (the farmer, then the officer); **P2** narrates at the dashboard (projected).

### Pre-stage (morning checklist)

- `MIN_INSTANCES=1` (step 1: `bash infra/scale.sh 1`).
- Re-arm `--live-demo` at the venue pin (step 2).
- ONE warm-up report fired end-to-end and cleaned (step 3, `outbreak-e2e`).
- Demo phone on 4G, not the venue wifi.
- Officer session already signed in on the laptop.
- Queue pre-opened on the **In a cluster, not verified** tab: open Officer queue, pick that tab, then go back to the national map. The queue remembers the tab in this browser, so it opens there at 1:30.
- Bell drawer closed.
- National map view up.
- Backup recordings one click away.

### Script

**0:00–0:20 · P2** (map on screen):

> "Last season, fall armyworm reached thousands of Zambian farms before anyone saw the pattern. A farmer sees one sick plant. An officer sees one farm. Nobody sees the outbreak early."

**0:20–0:50 · P1** raises the leaf, photographs it in the Phytos app, taps Send, holds the phone down. **P2** bridge (covers the 8–12 s pipeline):

> "That farmer just used Phytos free, on any phone — no app store. The AI reads the photo, and the advice it returns only cites published guides: the Ministry, ZARI, FAO, CABI. It cannot name a chemical that isn't on our checked product list — a database controls that, not the AI."

**0:50–1:30** · The report lands on the map; the cluster ring completes; the district flips High; the SMS buzzes (P1 holds the phone to the mic). **P2:**

> "And here is what no farmer can see. His report just completed a cluster. The district went High, and that SMS says 'not yet verified by an officer' — because Phytos never treats an AI guess as truth."

**1:30–2:10 · P1** moves to the laptop as the officer: opens the report from the queue, confirms. **P2:**

> "A trained officer just took responsibility — watch the alert upgrade to a verified cluster alert, and the verified counter tick. Every correction becomes a test case for the next prompt or model version."

**2:10–2:50 · P2** switches to the Outgrower View:

> "This demo outgrower finances 1,240 smallholder farmers. Phytos just told it which camps need attention and which farms each field officer visits first. Farmers use Phytos free. Companies that lend farmers inputs pay — because when outbreaks are caught early, more of those loans get repaid."

**2:50–3:00 · P2**, back on the national map:

> "One farmer can report a problem. Phytos lets an entire country see it early. We're Team Phytos."

### Failure rules

- **Wifi or API dies:** P2 says "let me show you this morning's run" and plays the backup recording. No apology; keep narrating.
- **Diagnosis slow:** P1 stays silent; P2 extends the bridge with the safety line.
- **SMS doesn't buzz:** P2 points at the alert in the bell drawer instead and moves on.

### Stage notes from the build (checked 30 Oct)

- **Finding the report (1:30).** A report the AI identified with confidence is the top row (newest first) of **In a cluster, not verified**. The queue opens on the tab last used in the browser, so the pre-stage leaves it there. P1: Officer queue → top row → **Verify in the field** (an extension officer account such as david@phytos.com) or **Confirm as an expert** (an agronomist account). If the diagnosis came back unsure, the report is the top row of the first tab, **Routed to an officer**, instead.
- **The upgrade (1:30).** The verified counter is in the header. The alert's new class shows in the bell drawer: open the bell to show "Verified cluster alert". On 30 Oct the venue alert read "Elevated · Verified cluster alert · 1 of 5 verified", under Elevated, about 6 s after Verify.
  - Fixed on 30 Oct (API `cropwatch-api-00012-7ph`): before, confirming the AI's own issue never re-ran the outbreak check, so the alert did not upgrade. Found while recording the backups. Every verify now re-runs it.
- **The SMS (0:50).**
  - It reads "Phytos DEMO alert (Act now): Tuta absoluta (tomato leafminer) near Lusaka. … Not yet verified by an officer. …".
  - It is sent only once the Africa's Talking secrets are deployed (checklist step 4). Every check so far was log-only.
  - Without the secrets, the buzz has to come from the Phytos app. Turn on "Send alerts for Lusaka to this phone" on the app's home screen on the phone held to the mic. This has not been tried on the demo phone yet. If it doesn't buzz, the failure rule applies.
- **"The district went High" (0:50).**
  - A new 5-report cluster makes the district High only while reports also surge: at least +50% on the week before (Risk Model v0); otherwise it is Elevated.
  - On 29 Oct, the day the demo was armed, the check ended High (+133% on last week). On 30 Oct, a day later, Lusaka ended Elevated.
  - Re-arm on the pitch morning (checklist step 2), then look for `risk/lusaka has a level and factors  (HIGH)` in step 3's output.
  - If it says Elevated, P2 says "the district went to Elevated", not High.
- **Timing.** The checks at the venue on 29 and 30 Oct gave a diagnosis in about 3 s, report to alert in 8 to 9 s, and report to dispatch in 8 to 13 s. The 0:20–0:50 bridge covers it.
- **The Outgrower View (2:10).** The camps and one line per field officer show on load, with no button to press. The company and its 1,240 farmers are simulated, and the DEMO badge is on screen.
- **Officer sign-in.** It needs the officer accounts (Before the day).

## After the demo

```bash
bash infra/scale.sh 0
```

Good: `min instances 0`. This stops paying for the warm instance.

Optionally restore the default demo data (no live-demo arming): `pnpm --filter @repo/seed seed --commit`.

## If something goes wrong on stage

- **The diagnosis says an officer will review:** verify it from the officer queue; the verification completes the cluster.
- **The diagnosis is wrong (e.g. early blight):** say so ("an honest miss: this is why officers verify") and correct it in the queue to Tuta absoluta; the cluster then forms.
- **The API or venue wifi fails:** switch to the hotspot. If it's still down, play the backup recording and keep talking.
- **The diagnosis is slow (quota):** the service retries automatically. Keep talking over the map while it lands.

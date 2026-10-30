# Demo-day operations

The checklist and the timed run for the live Phytos demo at the GreenCode final (3-minute pitch). Start the morning checklist **at least two hours before** the pitch, from a laptop with the repo, pnpm 12.9.1 and `gcloud` logged in as `zulugeoffrey034@gmail.com`. Every command runs from the repo root. Each step says what "good" looks like; if a step fails, fix it before moving on.

- Capture app (presenter's phone): https://crop-watch01-capture.web.app
- Command Center (laptop): https://crop-watch01.web.app
- API: `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1`
- Printed one-page version of the morning checklist: [`morning-checklist.pdf`](morning-checklist.pdf) (source `morning-checklist.html`). Saturday's test plan: [`hackathon-backlog.md`](hackathon-backlog.md).

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

3. Sign in on the laptop at https://crop-watch01.web.app. Good: the national map, the verified counter in the header, and the **DEMO DATA · SIMULATED** badge.

### Backup recordings of every step

Record each step of the run below on the real devices, once it passes, and keep the files on the laptop desktop (and a USB stick):

1. The capture app opening on the camera, a photo of leaf mines, Send, the diagnosis and the advice ladder.
2. The dashboard map as the report lands and the cluster ring appears; Lusaka going from Elevated to High; the bell showing the new alert and the alerts drawer.
3. The SMS arriving on a phone (or the Africa's Talking simulator, if the live account is not ready).
4. The officer queue: verifying the presenter's report, the counter ticking, the alert turning into a verified cluster alert (open the bell to show it).
5. The Outgrower View: the camps and officer lines on load, "Prioritise field officers", the visit lists, and one visit drawer (View).
6. The presenter's report in its drawer, then "Why this advice?" (sources with tiers, the register check).

If the wifi or the API fails on stage, play the matching recording and keep talking.

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

- **Finding the report (1:30).** A report the AI identified with confidence is the top row (newest first) of **In a cluster, not verified**. The queue opens on the tab last used in the browser, so the pre-stage leaves it there. P1: Officer queue → top row → **Confirm as an expert**. If the diagnosis came back unsure, the report is the top row of the first tab, **Routed to an officer**, instead.
- **The upgrade (1:30).** The verified counter is in the header. The alert's new class shows in the bell drawer: open the bell to show "Verified cluster alert".
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

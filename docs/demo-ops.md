# Demo-day operations

The checklist and the timed run for the live Phytos demo at the GreenCode final (3-minute pitch). Start the morning checklist **at least two hours before** the pitch, from a laptop with the repo, pnpm 12.9.1 and `gcloud` logged in as `zulugeoffrey034@gmail.com`. Every command runs from the repo root. Each step says what "good" looks like; if a step fails, fix it before moving on.

- Capture app (presenter's phone): https://crop-watch01-capture.web.app
- Command Center (laptop): https://crop-watch01.web.app
- API: `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1`
- Printed one-page version of the morning checklist: [`morning-checklist.pdf`](morning-checklist.pdf) (source `morning-checklist.html`). Saturday's test plan: [`hackathon-backlog.md`](hackathon-backlog.md).

## Before the day (D9 freeze, Wed 29 Oct)

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
5. The Outgrower View: "Prioritise field officers", the visit lists, and one visit drawer (View).
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

- **Presenter's phone:** the Phytos app installed from https://crop-watch01-capture.web.app; camera and location allowed; on mobile data, not only wifi; battery above 80%.
- **The leaf:** a tomato leaf with **leaf mines**. Photograph the mines, close up, in daylight. **Not fruit**: on 26 Oct a fruit photo of Tuta damage came back as early blight with high confidence, while the leaf photo was right every time.
- **Dashboard laptop:** signed in as the agronomist, on the national map, focus "Lusaka and Chongwe".
- **Kit:** hotspot charged; backup recordings on the desktop.

## The run: 3 minutes

Two presenters: P1 on the phone, P2 on the dashboard (projected). Times are from the start of the pitch.

| Time      | Who | What happens                                                                                                                                                                                          | Say (short)                                                                                                  |
| --------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0:00–0:20 | P1  | The problem.                                                                                                                                                                                          | Pests reach a district before anyone sees the pattern.                                                       |
| 0:20–0:30 | P2  | National map on screen ("Where is it bad right now?"), DEMO badge visible.                                                                                                                            | "Three weeks of simulated history. One report is about to be real."                                          |
| 0:30–0:55 | P1  | Phytos opens on the camera. Photograph the leaf mines, choose Tomato, Send. Diagnosis then advice in about 7–10 s.                                                                                    | "AI assessment, in words. Advice only from Zambian and FAO guides; chemicals only after the register check." |
| 0:55–1:15 | P2  | The report lands; the cluster ring appears; Lusaka goes from Elevated to High; the bell counts it. Open the bell: the alert is a **model risk signal**, "Not yet verified". The judge's phone buzzes. | "Five reports within 10 km: a prototype signal, labelled as not yet verified."                               |
| 1:15–1:35 | P2  | Officer queue: confirm the presenter's report. The verified counter ticks; open the bell: the alert is now a **verified cluster alert**.                                                              | "An officer confirms it. Every correction becomes a test case. The model does not learn on its own."         |
| 1:35–1:55 | P2  | Outgrower View → **Prioritise field officers** → visit lists; open one farm with **View**.                                                                                                            | "Which farms each field officer visits first. Camp level only: no farm locations."                           |
| 1:55–2:10 | P2  | (Cut first if late.) The presenter's report: in the queue, **Full report**, then **Why this advice?**                                                                                                 | "Every answer shows what it rests on."                                                                       |
| 2:10–3:00 | P1  | Close: who pays, what is next, the team.                                                                                                                                                              | "One farmer can report a problem. Phytos lets a district see it in time."                                    |

If the diagnosis says an officer will review, verify it in the officer queue straight away: the verification completes the cluster (the alert then arrives as a verified cluster alert). If anything stalls for more than 10 s, play that step's recording.

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

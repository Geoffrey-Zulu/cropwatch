# Demo-day operations

The morning-of checklist for a live Phytos demo. Start **at least two hours before** the pitch, from a laptop with the repo, pnpm 12.9.1 and `gcloud` logged in as `zulugeoffrey034@gmail.com`. Every command runs from the repo root. Each step says what "good" looks like; if a step fails, fix it before moving on.

Live API: `https://cropwatch-api-24960589333.europe-west1.run.app/api/v1`

## Morning-of checklist

### 1. Warm the API

```bash
bash infra/scale.sh 1
```

Good: `ok: min instances 1; {"status":"ok",...}`. One instance now stays warm, so there's no cold start on stage (about US$2/day until you set it back to 0).

If the code changed since the last deploy, deploy instead (about 6 min, same effect): `MIN_INSTANCES=1 bash infra/deploy.sh`.

### 2. Re-seed with the live demo armed

Decide the **demo issue** from the leaf the presenter will photograph (tomato → `tuta_absoluta`, maize → `fall_armyworm`). Read the **venue coordinates** off a phone at the venue. Dry run first:

```bash
pnpm --filter @repo/seed seed --live-demo --demo-issue tuta_absoluta --demo-center=-15.4167,28.2833 --demo-district Lusaka
```

Good:

- `Live demo: 4 qualifying <issue> reports within 10 km of <venue>`.
- `Armed until <time>`, with that time **after the pitch**.
- No `Checks failed`.

Then run the same command with `--commit` added.

The presenter's report completes the cluster if it is diagnosed as the demo issue with medium or high confidence and is sent from within 10 km. If it comes back "an officer will review", the officer confirming it on the dashboard completes the cluster instead.

### 3. Fire one warm-up report end to end

Use a photo of the actual demo leaf:

```bash
pnpm --filter @repo/admin-tools smoke-e2e --image path/to/demo-leaf.jpg
```

Good: `all checks passed`, and `diagnosis landed` under 30 s (normally 7–10 s). It reports from Chongwe, far from the venue, so it can't trip the armed cluster, and it deletes everything it created.

### 4. Quota and spend sanity check

- **Vertex AI quota:** run the photo eval over 5–12 field photos (a folder of JPEGs plus `labels.json`; the format is in `apps/functions/src/eval/diagnoseEval.ts`):

  ```bash
  pnpm --filter @repo/functions eval:diagnose path/to/photos
  ```

  Good: `schemaValid` equals `images` and no image takes over 20 s. Slow images or `call failed: ... 429` in the report mean the shared Gemini quota is under pressure. Re-run in 10 minutes, and keep the backup recordings ready.

- **Spend:** Cloud console → Billing → Budgets. The `cropwatch-hackathon` budget ($50) should be comfortably under its first 50% alert.

### 5. SMS (Africa's Talking) — placeholder until D6

To be filled in when SMS alerts land (D6):

- check the account balance;
- confirm the sender ID is approved;
- confirm the judge's number is registered for the live SMS moment.

### 6. Devices

- **Presenter's phone:**
  - the Phytos app is installed and signed in;
  - location is on, and it's on mobile data, not only Wi-Fi;
  - battery is above 80%.
- **Dashboard laptop:** signed in as an agronomist (`pnpm --filter @repo/admin-tools set-role --email <email> --role agronomist`, then sign out and in). The map shows the **DEMO DATA — SIMULATED** badge.
- **Kit:** the hotspot is charged and the backup screen recordings are on the laptop.

## After the demo

```bash
bash infra/scale.sh 0
```

Good: `min instances 0`. This stops paying for the warm instance.

Optionally restore the default demo data (no live-demo arming): `pnpm --filter @repo/seed seed --commit`.

## If something goes wrong on stage

- **The diagnosis says an officer will review:** confirm it from the dashboard's officer queue (built on D7). A field verification completes the cluster.
- **The API or venue Wi-Fi fails:** switch to the hotspot. If it's still down, play the backup recording and keep talking.
- **The diagnosis is slow (quota):** the service retries automatically. Keep talking through the map while it lands.

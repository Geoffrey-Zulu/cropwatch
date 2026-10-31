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

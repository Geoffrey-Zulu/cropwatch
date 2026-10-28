# tools

Workspace packages (`tools/*`) for operating Phytos. They authenticate as the authorized account through gcloud (`gcloud auth login zulugeoffrey034@gmail.com`), never through ADC. Paths you pass are relative to where you run `pnpm`.

- **`admin/`** (`@repo/admin-tools`)
  - `pnpm --filter @repo/admin-tools set-role --email <email> --role <field_officer|extension_officer|agronomist|admin> [--org <orgId>]` sets an officer's `role` claim. Field officers need `--org`; `--clear` makes the user a farmer again.
  - `pnpm --filter @repo/admin-tools smoke-e2e --image <photo.jpg> [--post-first]` plays the mobile app against the deployed API (upload, report, diagnosis), checks the contract and the live security rules, then deletes what it created. `--post-first` proves the Eventarc path.
- **`regulatory/`** (`@repo/regulatory-tools`)
  - `pnpm --filter @repo/regulatory-tools load-products <file.csv> [--commit]` loads the Regulatory Product Database. The CSV is the whole register: a dry run shows the plan, `--commit` adds, updates and removes rows to match. Start from `placeholder-products.csv`; real rows (`source: zema | label | moa_faw_manual`) replace it.
- **`seed/`** (`@repo/seed`)
  - `pnpm --filter @repo/seed seed [--commit] [--live-demo --demo-issue <issue> --demo-center <lat,lng> --demo-district <name>]` writes deterministic `sim: true` demo data (technicaldoc §12) to Firestore and BigQuery. See `docs/demo-ops.md` for demo morning.
- **`gcp/`** (`@repo/tools-gcp`): the shared Firestore and BigQuery REST client the tools use.
- **`corpus/`** (`@repo/corpus`): the RAG knowledge corpus (technicaldoc §7).
  - `pnpm --filter @repo/corpus fetch-corpus [--force] [--only <id,id>]` fetches the curated targets in `corpus/fetch/sources.yaml` (live with an honest User-Agent, robots.txt and 1 request per 2 s per host; then the Wayback Machine; then mirrors) into the tier folders, and writes `manifest.json` (metadata, source, sha256, `needs_ocr`) and `fetch-report.md` (what failed and why). Not a crawler: add a document to `sources.yaml` first.
  - `pnpm --filter @repo/corpus fetch-corpus --import <id> <file>` records a document downloaded by hand, for publishers that refuse automated clients.
  - `pnpm --filter @repo/corpus ingest [--dry-run]` uploads new or changed documents to `gs://crop-watch01-knowledge` and imports them into the RAG Engine corpus (provision it once with `bash infra/rag.sh`). Re-run after any fetch: it replaces changed documents and removes deleted ones. `pnpm --filter @repo/corpus probe <crop> <issue>` shows what retrieval returns.
  - Documents whose licence does not allow redistribution (`redistribute: false`) are fetched and ingested but kept out of git (`corpus/.gitignore`, generated).

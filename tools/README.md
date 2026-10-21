# tools

Workspace packages (`tools/*`) for operating CropWatch. They authenticate as the authorized account through gcloud (`gcloud auth login zulugeoffrey034@gmail.com`), never through ADC.

- **`admin/`** (`@repo/admin-tools`)
  - `pnpm --filter @repo/admin-tools set-role --email <email> --role <field_officer|extension_officer|agronomist|admin> [--org <orgId>]` sets an officer's `role` claim (field officers need `--org`); `--clear` makes them a farmer again.
  - `pnpm --filter @repo/admin-tools smoke-e2e --image <photo.jpg>` plays the mobile app against the deployed API (upload → report → diagnosis), checks the contract and security rules live, then deletes what it created.
- **`seed/`** (D3): deterministic `sim: true` seed generator. See technicaldoc.md §12.
- **`corpus/`** (D4): RAG corpus manifest and ingestion. See technicaldoc.md §7.

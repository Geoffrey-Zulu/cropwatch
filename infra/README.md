# Idempotent infra scripts only. Secrets in Secret Manager. See CLAUDE.md Environment.

- `setup.sh`: APIs, Firebase, Firestore and Storage rules, BigQuery, budget alert.
- `deploy.sh`: builds and deploys the API to Cloud Run and wires Eventarc.
- `scale.sh <0-3>`: minimum warm instances (demo days).
- `rag.sh`: RAG Engine (RagManagedDb, Basic tier), the corpus and its bucket. Then `pnpm --filter @repo/corpus ingest`.
- `rag-teardown.sh [--delete-bucket]`: after the hackathon, deletes the corpus and unprovisions RagManagedDb (its Spanner instance bills while it exists).

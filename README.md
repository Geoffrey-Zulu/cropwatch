# Phytos

Phytos is a verification and ledger layer for outgrower agribusinesses in Zambia. An agribusiness that lends seed, inputs and cash to smallholders against a contract uses Phytos to see which contracted fields are really planted and growing, to decide by stated rules who may draw a cash advance in the hunger months, to move that advance under controls, and to settle each farmer's account at harvest from the ledger.

Team Phytos built it for the GreenCode Hackathon (Lusaka, final 30 October to 1 November 2026): the crop-health path from 21 October, the CEIH season during the final. It is a working prototype on simulated season data.

## The season: C, E, I, H

The product is four screens: **Fields map, Season ledger, Approvals, Reconciliation**. Sign-in lands on the Fields map.

| Step                      | What happens                                                                                                                                                                                              | Where it shows                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **C** · Crop verification | Every contracted field has a weekly greenness curve (Sentinel-2 NDVI) against its camp's median, and a field officer's geofenced photo settles a field the clouds hide.                                   | Fields map (real satellite imagery, field outlines coloured by state; trace a new farm) and the field card |
| **E** · Eligibility       | Fixed rules, every factor shown: established from space or on the ground, no open severe issue, one advance a season, a cap of 15% of the projected crop value. No score.                                 | The field card's **Run check**: the field, the passes, the rules one by one, then the cap                  |
| **I** · The advance       | The farmer sees the amount and the fee and confirms with an SMS code; a second person, who did not verify the field, approves; the transfer runs and a ledger row is written.                             | Season ledger → Approvals                                                                                  |
| **H** · Harvest           | The depot records the delivery; the statement (inputs, advance, fee, crop) is summed from ledger rows. A rainfall and greenness rule flags a drought camp, so shortfalls there are marked uncontrollable. | Reconciliation                                                                                             |

The agribusiness lends its own money; Phytos verifies and keeps the ledger. Crop insurance would come from a licensed partner and is simulated here.

**What is real and what is simulated.** The rules, the advance's state machine (code check, maker-checker, ledger entry) and the ledger arithmetic run in the deployed API. The season itself (farmers, contracts, field outlines, NDVI curves, rainfall, deliveries) is seeded and every screen says so: "Simulated season 2026/27" beside the season day, and "simulated" on every transfer and payout. Money moves through a simulated provider, SMS messages go to an on-screen log, and the imagery under the Fields map is Esri World Imagery. In the demo one Command Center login stands in for the agribusiness's credit team, on the simulated org only; on a real org only its own credit team can approve, send or record deliveries, and the officer who verified a field can never approve its advance.

**Guarantees** (the full list is in [`CLAUDE.md`](CLAUDE.md)): no money moves without the farmer's code after seeing amount and fee, approval by someone other than the officer who verified the field, and a ledger entry; eligibility and drought decisions are rules with stored, displayed factors; no outbreak or crop figure is shown as a probability; precise field locations stay with the farmer's own contracting agribusiness.

Phytos grew from a crop-health path: a photo from the capture app is assessed by Gemini, advice is filtered deterministically against Zambia's registered pesticide list, and officers verify it. That path's API and the capture app stay (the season's ground checks use them); its screens (a national map, an officer queue, a dry-spell scenario, knowledge sources) were retired on 1 Nov and live at tag `pre-ceih-only`.

## Stack

- **Monorepo**: pnpm 12 and Turborepo, TypeScript throughout, Zod schemas shared by front end and API.
- **`apps/web`**: the four screens (Vite, React 18, Tailwind, tRPC client, Leaflet for the Fields map and the loan check).
- **`apps/functions`**: the API (Hono on Cloud Run): tRPC for the dashboard and a REST surface at `/api/v1` (OpenAPI in [`packages/shared/src/contracts/openapi.json`](packages/shared/src/contracts/openapi.json)).
- **`apps/capture`**: the capture PWA for field photos.
- **`packages/shared`**: schemas, controlled vocabularies and the CEIH rules as pure, tested functions (`src/ceih/`).
- **`tools/`**: the seed (the simulated season), end-to-end demo checks, the visual pass and the regulatory and corpus loaders.
- **Google Cloud and Firebase** (project `crop-watch01`, `europe-west1`): Firestore, Storage, Auth, Hosting, Cloud Run, Pub/Sub, BigQuery, and Gemini through the Google Gen AI SDK.
- `apps/mobile` is a Flutter client outside the pnpm workspace.

## Run it

Prerequisites: Node 24.15 or later and pnpm 12.9.1.

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm build && pnpm test
```

Dashboard against the deployed API (sign-in needs a Command Center account):

```bash
cp .env.example .env    # then fill in the values it describes
pnpm --filter web dev   # http://localhost:5173
```

The API runs locally with `pnpm --filter @repo/functions dev` and Application Default Credentials (`gcloud auth application-default login`). Infrastructure is created and deployed only through the idempotent scripts in [`infra/`](infra/): `setup.sh`, `deploy.sh`, and `deploy-preview.sh` for a tagged preview that takes no production traffic.

## Documents

- [`docs/ceih-workflows-mvp.md`](docs/ceih-workflows-mvp.md): the CEIH specification; [`docs/ceih-overnight-plan.md`](docs/ceih-overnight-plan.md): how it was built.
- [`docs/demo-ops.md`](docs/demo-ops.md): the demo runbook, the beat list and the checks.
- [`docs/technicaldoc.md`](docs/technicaldoc.md) and [`docs/architecture.md`](docs/architecture.md): data model, contracts and architecture.
- [`docs/buildplan.md`](docs/buildplan.md): the build log, day by day.
- [`docs/archive/`](docs/archive/): superseded working documents, kept for the record.

## iOS and live field evidence

This branch also keeps the Capacitor iOS client, its Firebase startup fix, owner-scoped field boundaries and the live Copernicus field-evidence service. See [iOS builds](docs/IOS_BUILD.md), [satellite integration](docs/field-satellite-integration.md) and [mobile CEIH scope](docs/ceih-demo-readiness.md).

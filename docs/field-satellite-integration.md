# Field evidence adapted from SKACE

## What was inspected

SKACE's `backend/external/clients/sentinelhub.go` requests Sentinel-2 L2A statistics from Copernicus using B04, B08, SCL and dataMask. `backend/modules/satellite/service.go` stores interval statistics, compares trends and falls back to a labelled demo series without credentials. Its parcel loader can fall back to a box around a farm pin. `backend/modules/farm/trackrecord.go` excludes demo readings from satellite verification. Boundary claims support a separate co-signature flow.

The inspected Dokploy compose stack did not pass CDSE credentials to its backend. Its final Docker image contains the executable, not the local `.env`. A token request using the local configuration was rejected. No secrets were copied into Phytos or its IPA, and no SKACE source files or deployment settings were changed.

## What Phytos adds

- A separate authenticated field-evidence API. Firebase ID tokens are verified against Google's public certificates, including project audience and issuer. No service-account key is required. Each field and report is scoped to the signed-in user.
- Persistent field records and reports in SQLite on a dedicated Dokploy volume. This is a single-instance pilot service; volume backups and restore procedures must be operated before relying on it for production records.
- Offline GPS-corner drafts and GeoJSON Polygon import. Saving sends the field to Phytos. The API requires a closed, non-self-crossing polygon inside Zambia, at least 0.1 ha and at most 5,000 ha. Area is an approximation, not a survey. Ownership and cadastral accuracy are not established.
- No implicit square around a pin. A recorded boundary is explicitly labelled **claimed / unattested**. The map shows its actual coordinates.
- Real intersecting Sentinel-2 acquisition metadata and full-tile previews from the public Earth Search catalogue. Scene cloud cover is not presented as field-level clear-pixel coverage. Monze context is labelled regional and cannot serve as a farm record.
- An optional Copernicus Statistical API path adapted from SKACE. It samples at 10 m rather than resizing every parcel to 256 × 256 pixels, masks invalid SCL classes, and only retains finite NDVI intervals with at least 50% usable coverage and 10 valid pixels. It never generates substitute NDVI values.
- Separate states for missing configuration, rejected authorization, an upstream failure and no usable pixels. No data is not interpreted as a failed crop.
- A review status that remains **officer review required**. Satellite greenness does not establish planting, weeding, yield, contract performance, credit eligibility or an insurance trigger.

## Data and deployment

The app uses `VITE_FIELD_API_URL`, defaulting to `https://phytos-api.samuelkaoma.dev`. The existing crop-report API remains on Cloud Run. `infra/field-evidence.compose.yml` builds a pinned public Git commit, exposes the API through Dokploy's HTTPS domain routing, and mounts `field_records` at `/data`.

Environment settings:

- `PHYTOS_GIT_REF`: the source commit to build.
- `FIREBASE_PROJECT_ID`: `crop-watch01`.
- `FIELD_DATABASE`: `/data/fields.sqlite`.
- `CORS_ORIGINS`: approved browser origins; the native app sends Firebase bearer tokens through CapacitorHttp.
- `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET`: optional Copernicus OAuth credentials. Configure these only in Dokploy's environment, then redeploy. Never put them in a Vite environment variable, a client config file, Git, chat or an IPA.

Without working CDSE credentials, acquisition dates, scene cloud cover and previews are live; **field NDVI is unavailable**. The app explicitly states this. The public catalogue supplies no service guarantee.

## How to use it

Open **Crop check → My field**. Register an actual field using ordered GPS corners or an imported Polygon/Feature. Save the claimed boundary, select it, then request satellite evidence. This sends the polygon to Earth Search and, when configured, Copernicus. Satellite imagery needs internet; GPS-corner drafts can be recorded offline and saved later.

**Financing example** opens Given's separate simulated C/E/I/H walkthrough. Real field evidence is not automatically turned into a lending approval or a payment. Agronomic validation, attestation, contract and yield inputs, human underwriting, payment execution, insurance and depot reconciliation remain separate integration work.

## References

- [Copernicus Sentinel-2 L2A bands and scene classifications](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)
- [Copernicus Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
- [Earth Search public catalogue](https://github.com/Element84/earth-search)

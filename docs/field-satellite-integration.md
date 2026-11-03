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
- An optional Copernicus Statistical API path adapted from SKACE. It targets approximately 10 m sampling, converting metres into EPSG:4326 degrees at the field latitude rather than resizing every parcel to 256 × 256 pixels. It masks invalid SCL classes and only retains finite NDVI intervals with at least 50% usable coverage and 10 valid pixels. It never generates substitute NDVI values. OAuth tokens are reused until shortly before expiry.
- Separate states for missing configuration, rejected authorization, an upstream failure and no usable pixels. No data is not interpreted as a failed crop.
- Coverage is the valid-pixel fraction of the requested sampling grid. Masked pixels outside an irregular polygon also reduce this fraction, so the 50% requirement is conservative and can reject a usable narrow or irregular field. It is not a cadastral measurement of the clear portion of a field.
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

The deployed API is `https://phytos-api.samuelkaoma.dev`. On 1 November 2026, a disposable authenticated integration probe saved a public Monze test polygon, retrieved 12 intersecting scenes, read the stored report back and deleted the test field. Requests without a Firebase token returned 401. This verifies the authenticated catalogue and persistence path, not Copernicus NDVI processing. The probe's temporary anonymous account was also removed.

At 09:13 Africa/Lusaka on 1 November 2026, fresh project-level Copernicus credentials were accepted and connected through service environment references (`${{project.CDSE_CLIENT_ID}}` and `${{project.CDSE_CLIENT_SECRET}}`). After redeployment, a second disposable 4.758 ha Monze polygon returned 12 catalogue scenes and 18 qualified NDVI intervals from the deployed service. The latest interval was 27 October to 1 November, with NDVI 0.22235 and 462 valid sampled pixels (100% of its sampling grid). The stored report was retrieved successfully, and the temporary field and anonymous account were deleted. This verifies live NDVI processing, not the crop, ownership, yield or creditworthiness of a real farm. Officer review remains required.

Configure fresh credentials at **Dokploy → Phytos field evidence → production → Field evidence API → Environment**. Preserve `PHYTOS_GIT_REF`, add `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET`, then redeploy the compose service. Both keys belong to a Copernicus Data Space Sentinel Hub OAuth client; they are not the account password or S3 access keys.

## How to use it

Open **Crop check → My field**. Register an actual field using ordered GPS corners or an imported Polygon/Feature. Save the claimed boundary, select it, then request satellite evidence. This sends the polygon to Earth Search and, when configured, Copernicus. Satellite imagery needs internet; GPS-corner drafts can be recorded offline and saved later.

The mobile workspace opens to Zambia with no preselected district. **Explore satellite coverage by district** offers town-level context across all ten provinces; the list is not a complete district register and does not restrict where a field can be saved. Each district has its own cached report. The original no-parameter context endpoint keeps its Monze default for older installed clients. Monze is the location in Given's financing example, not a confirmed pilot boundary. The pitch's proposed Central Province cohort remains a business planning decision.

On 3 November 2026, this branch merged upstream `ceih` at `f0f8838c4debdf1e5a8557c995ac605bcfa83044`; upstream `main` was unchanged at `88ee00d`. The merge keeps the iOS Firebase persistence fix, native camera support and this field-evidence service alongside the newer agribusiness and farmer web apps. The mobile layout removes the duplicated live-field account header, uses smaller headings and amount readouts, and keeps form controls at 16 px without automatically focusing a text input. Pinch zoom remains enabled.

The updated deployment was checked live on 3 November: Kabwe and Chipata each returned 12 scenes with distinct Sentinel-2 tile IDs. A disposable 4.8 ha Kabwe polygon returned 15 qualified NDVI intervals, and its stored report could be read back. The temporary field and account for this successful probe were deleted. Earlier requests encountered intermittent connection timeouts; the successful check used persistent HTTPS connections and bounded connection retries.

**Financing example** opens Given's separate simulated C/E/I/H walkthrough. Real field evidence is not automatically turned into a lending approval or a payment. Agronomic validation, attestation, contract and yield inputs, human underwriting, payment execution, insurance and depot reconciliation remain separate integration work.

## References

- [Copernicus Sentinel-2 L2A bands and scene classifications](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html)
- [Copernicus Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html)
- [Earth Search public catalogue](https://github.com/Element84/earth-search)

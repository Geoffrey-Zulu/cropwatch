# CEIH demo and pitch alignment

The iOS app combines a field-evidence service with a separate interactive CEIH financing prototype and the existing crop-report system. It is not a deployed lending or payment service. See [the SKACE satellite adaptation](field-satellite-integration.md) for the actual field workflow and provider limits.

| Pitch component | What the app currently demonstrates | What remains unconnected |
| --- | --- | --- |
| Crop health and yield | My field: saved claimed polygons, actual Sentinel-2 scene metadata and previews, optional cloud-masked Copernicus NDVI when configured. Financing example: three illustrative checks and yield/price inputs. Existing crop diagnosis remains accessible. | Working CDSE configuration for field NDVI, agronomic yield estimation, attested boundaries and signed field visits |
| Eligibility and capping | A 10%, 15% or 20% example cap with an amount constrained to that limit; transparent principal and 5% fee | Lender approval, risk policy enforcement and a live farmer contract |
| Digital disbursement | Airtel or MTN example wallet selection, review, confirmation and a recorded demo advance | Provider integration, identity verification, transaction execution and settlement callbacks |
| Harvest reconciliation | Gross crop value less inputs, advance and fee; the proposed 2% company fee is shown separately | Depot intake, actual weights/prices, shared ledger, payout execution and reconciliation with payment providers |
| Weather insurance | The proposed protection is disclosed as inactive | An insurer, policy, trigger feed, coverage terms and payout integration |

## A coherent demonstration

1. Open Crop check. Explain that Given is an example farmer, with 2.4 ha and an illustrative 4,800 kg harvest at K 10 per kg. The map is the town overview, not his farm boundary. Complete the three example field checks. GPS uses the actual device position and can be captured offline; map imagery requires internet.
2. Open Eligibility. Projected value is K 48,000. A 15% cap allows K 7,200. Select K 5,000. The 5% fee is K 250 and the harvest deduction is K 5,250.
3. Continue to the wallet, select an example provider and open the review sheet. Explain the amount, fee and destination. Confirm the demo transfer. No money moves.
4. Open Harvest. K 48,000 gross less K 12,000 inputs, K 5,000 advance and K 250 fee leaves K 30,750. The K 960 software fee belongs to the agribusiness and is not included in farmer deductions. Save the local demo reconciliation.

## Pitch wording that matches the implementation

“We are prototyping a liquidity layer for outgrower networks. This demonstration connects crop checks, a conservative advance cap, a mobile-money review flow and a transparent harvest ledger. The financial transactions are simulated. Our next milestone is an integrated pilot with an agribusiness, capital provider and payment partner.”

Until there is evidence, avoid describing side-selling as eliminated, capital as completely protected, weather payouts as guaranteed, or these mobile-money transfers as live. The script's outgrower count and loss estimates need attributed sources. The fundraising currency, amount, pilot cohort and partner commitments still need confirmed values.

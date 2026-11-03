# PMDG register: 5-minute spot-check (Geoffrey)

The live register is `tools/regulatory/pmdg-products.csv`: 13 rows taken from the Zambian Plantwise PMDGs, all `source: plantwise_pmdg` (shown as "Plantwise Zambia PMDG"). Every row is one of our demo issues. Open each guide (`tools/corpus/international/cabi/<guide>.pdf`, one page each) and compare it with the dose, PHI and WHO columns below. **The dose must match the guide word for word.**

| Ids                                                                                                                        | Product (as the guide prints it)                                                | Active ingredient                   | Dose (`label_dose`, verbatim)                                                 | PHI (days) | WHO | Guide, page                                 | Geoffrey OK? |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------- | ---------- | --- | ------------------------------------------- | ------------ |
| PMDG-TUTA-BT                                                                                                               | Bacillus thuringiensis var kurstaki products                                    | Bacillus thuringiensis var kurstaki | The guide gives no rate for this product. Use the rate on the product label.  | 1          | III | pw-pmdg-tuta-absoluta-zambia-2022, p1       |              |
| PMDG-TUTA-NIMBICIDINE                                                                                                      | Nimbicidine                                                                     | azadirachtin                        | The guide gives no rate for this product. Use the rate on the product label.  | 3          | U ¹ | pw-pmdg-tuta-absoluta-zambia-2022, p1       |              |
| PMDG-TUTA-SPINOSAD                                                                                                         | Spinosad-based products                                                         | spinosad                            | The guide gives no rate for this product. Use the rate on the product label.  | 3          | III | pw-pmdg-tuta-absoluta-zambia-2022, p1       |              |
| PMDG-TUTA-BELT-480SC                                                                                                       | BELT 480SC                                                                      | flubendiamide                       | 4mls per 20L                                                                  | 3          | III | pw-pmdg-tuta-absoluta-zambia-2022, p1       |              |
| PMDG-EB-DACONIL                                                                                                            | Daconil                                                                         | chlorothalonil                      | The guide gives no rate for this product. Use the rate on the product label.  | 14 ³       | U   | pw-pmdg-early-blight-tomato-zambia-2014, p1 |              |
| PMDG-DBM-TRIGER-5EC, PMDG-DBM-MOZICON, PMDG-DBM-ATS-ICON-10CS, PMDG-DBM-BIOPLANT-5EC, PMDG-DBM-KANGFU, PMDG-DBM-LAMBDA-5EC | TRIGER 5 EC; MOZICON; ATS-ICON 10CS; BIOPLANT 5%EC BOLLPACK; KANGFU; LAMBDA 5EC | lambda-cyhalothrin                  | The guide gives no rate for this product. Use the rate on the product label.  | 7 ³        | II  | pw-pmdg-diamondback-moth-zambia-2014, p1    |              |
| PMDG-DBM-CYPERMETHRIN-20, PMDG-DBM-SENTINEL-15EC                                                                           | CYPERMETHRIN 20% ⁴; SENTINEL 15%EC                                              | cypermethrin                        | Often applied at 20-30ml per 20 litres, but double-check with product labels. | 7          | II  | pw-pmdg-diamondback-moth-zambia-2014, p1    |              |

1. The guide says "Not WHO classified (unlikely to present acute hazard in normal use)", which is the WHO's definition of class U.
2. (Removed 29 Oct: the four mancozeb rows, see below.)
3. The guide gives a range (chlorothalonil 7–14 d, lambda-cyhalothrin 3–7 d); the row uses the longer, safer end.
4. The guide prints "CYPERM ETHRIN 20%" across a line break; the row reads "CYPERMETHRIN 20%".

**Left out on purpose (not loaded):**

- **Cassava mosaic: cypermethrin (Cypermethryn 20EC; Cyrux 20EC, "5ml per 20L water").** The PMDG says insecticides against the whitefly vector are "not advised for small-scale farmers". Cassava mosaic advice stays IPM-only plus the officer referral. Say if you want it loaded anyway.
- **Mancozeb brands for late blight (DITHANE; ETHANE M45 80%WP; DIPACK; ROLIM 700WP).** The late-blight guide gives no pre-harvest interval. Borrowing the 14 days from the early-blight guide would present a number the guide does not give, so the rows are held back (decision 29 Oct). Late blight falls to IPM plus the officer referral, which is the designed behaviour.
- **Copper products (late and early blight) and mancozeb + metalaxyl (METALIN VICTORY; DILAX, late blight).** Neither guide gives a pre-harvest interval, and the register never invents one. (The late-blight guide's copper rate, "40-80 mg /20 litres", also looks like a typo for grams.)
- **Fall armyworm:** there is no Zambian FAW PMDG in the corpus, so maize FAW stays IPM-only with "Consult an extension officer for chemical options."

## When you confirm rows

Run from the repo root with the ids you checked (comma-separated, no spaces):

```bash
pnpm --filter @repo/regulatory-tools mark-verified tools/regulatory/pmdg-products.csv --by geoffrey --ids PMDG-TUTA-BT,PMDG-TUTA-BELT-480SC && pnpm --filter @repo/regulatory-tools load-products tools/regulatory/pmdg-products.csv --commit
```

`mark-verified` sets `verified_by` to `geoffrey` on those rows in the CSV (nothing else changes; running it twice is harmless); `load-products --commit` writes the change to Firestore. Commit the CSV afterwards. To fix a dose instead, edit that cell in the CSV, then reload.

**Order matters:** load the PMDG register only after the API revision that knows `plantwise_pmdg` is deployed. The current revision (00008) rejects that source and would stop recommending entirely.

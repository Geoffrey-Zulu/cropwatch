# Products named in the Zambia PMDGs: worksheet for label checks

> **Update 2026-10-29:** the PMDG-derived rows were approved and are the live register: `tools/regulatory/pmdg-products.csv` (`source: plantwise_pmdg`, doses verbatim from the guides; spot-check in `docs/pmdg-spot-check.md`). This worksheet stays for photographing real labels, which would add `source: label` rows alongside.

**For Geoffrey, at the agro-dealer.** This lists every pesticide product and active ingredient that the five Zambian Plantwise Pest Management Decision Guides (PMDGs) in the corpus name, per crop problem. It is a shopping list of what to look for, **not** the register. Nothing here is loaded into `registered_products`. A row is loaded only after you have photographed a real label and confirmed it below. Placeholders stay gated until then.

**Rules (CLAUDE.md invariant 1):**

- **The dose comes from the label only.** Copy the label's dose text exactly: same words, numbers, units and punctuation. Where a PMDG gives a rate, it is left out of this sheet on purpose; never use it.
- **One label, one row.** Photograph the front (trade name, active ingredient and concentration, registration number) and the back (dose table, crops, pre-harvest interval, WHO class or hazard colour band, registrant, expiry or batch date). Name the photos `<trade-name>-front.jpg` and `<trade-name>-back.jpg`.
- **The label must name the crop and the problem.** A product only goes on the register for a crop and pest or disease its label lists. If the label does not mention tomato, it does not go on the register for tomato, whatever the PMDG says.
- **Expired or no registration number: skip it.**
- The PMDGs date from 2014 to 2024, so some named brands may no longer be sold or registered. That is expected.

Once you send the photos, I transcribe them into the register CSV (`source: label`, `source_doc` = the photo file) and show you the dry run before anything is committed.

---

## Tomato · Tuta absoluta (tomato leafminer)

Source: _Tomato leafminer in tomato, Zambia_, PMDG, T. Mfune (MoA), updated June 2022.

| Active ingredient                             | Brands the PMDG names | What the PMDG says (context only)                                                                | Found at dealer? | Reg. no. | Label dose (copy exactly) | PHI (days) | WHO class | Registrant | Expiry | Photos |
| --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | -------- | ------------------------- | ---------- | --------- | ---------- | ------ | ------ |
| _Bacillus thuringiensis_ var. _kurstaki_ (Bt) | none named            | WHO III; stomach poison, must be eaten; spray young larvae in the evening; PHI 1 d; max 2 sprays |                  |          |                           |            |           |            |        |        |
| azadirachtin (neem)                           | Nimbicidine           | Not WHO classified; PHI 3 d; max 1 spray during flowering; toxic to bees                         |                  |          |                           |            |           |            |        |        |
| spinosad                                      | none named            | WHO III; PHI 3 d; max 2 sprays, 7 d apart; not in rain or bright sun                             |                  |          |                           |            |           |            |        |        |
| flubendiamide                                 | BELT 480SC            | WHO III; PHI 3 d                                                                                 |                  |          |                           |            |           |            |        |        |

## Tomato · Late blight

Source: _Late blight on tomato, Zambia_, PMDG, B. Mulomba, 2021.

| Active ingredient                         | Brands the PMDG names                          | What the PMDG says (context only)                                                                     | Found at dealer? | Reg. no. | Label dose (copy exactly) | PHI (days) | WHO class | Registrant | Expiry | Photos |
| ----------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------------------- | ---------- | --------- | ---------- | ------ | ------ |
| mancozeb                                  | DITHANE; ETHANE M45 80%WP; DIPACK; ROLIM 700WP | Protective contact fungicide; WHO U; max 2 sprays, 7–10 d apart; not on wet or drought-stressed crops |                  |          |                           |            |           |            |        |        |
| copper (copper oxychloride, copper salts) | none named                                     | WHO II; never more than 6 kg copper per ha per year; not during fruit set; can burn leaves            |                  |          |                           |            |           |            |        |        |
| mancozeb + metalaxyl                      | METALIN VICTORY; DILAX                         | For resistance management; WHO II; max 3 sprays, 10–14 d apart                                        |                  |          |                           |            |           |            |        |        |

## Tomato · Early blight

Source: _Early blight fungal disease in tomato, Zambia_, PMDG, F. Mwanda et al. (ZARI), 2014. The guide says prevention is the main measure and sprays mostly only protect.

| Active ingredient     | Brands the PMDG names             | What the PMDG says (context only)                                                            | Found at dealer? | Reg. no. | Label dose (copy exactly) | PHI (days) | WHO class | Registrant | Expiry | Photos |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------------------- | ---------- | --------- | ---------- | ------ | ------ |
| chlorothalonil        | Daconil                           | WHO U; PHI 7–14 d depending on product; max 3 sprays, 10 d apart; very toxic to aquatic life |                  |          |                           |            |           |            |        |        |
| mancozeb              | none named here (see late blight) | WHO U; max 2 applications; PHI 14 d                                                          |                  |          |                           |            |           |            |        |        |
| copper (copper salts) | none named                        | Dose, PHI and limits from the label                                                          |                  |          |                           |            |           |            |        |        |

A late-blight mancozeb or copper product may also list early blight on its label. If it does, one row covers both: set `approved_issues` to both.

## Cabbage · Diamondback moth

Source: _Diamondback moth on cabbage, Zambia_, PMDG, M. S. Tembo et al. (ZARI), 2014.

| Active ingredient  | Brands the PMDG names                                                           | What the PMDG says (context only)                                                                               | Found at dealer? | Reg. no. | Label dose (copy exactly) | PHI (days) | WHO class | Registrant | Expiry | Photos |
| ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------------------- | ---------- | --------- | ---------- | ------ | ------ |
| lambda-cyhalothrin | TRIGER 5 EC; MOZICON; ATS-ICON 10CS; BIOPLANT 5%EC BOLLPACK; KANGFU; LAMBDA 5EC | Pyrethroid; WHO II; PHI 3–7 d; max 2 sprays a season                                                            |                  |          |                           |            |           |            |        |        |
| cypermethrin       | CYPERMETHRIN 20%; SENTINEL 15%EC                                                | Pyrethroid; WHO II; PHI 7 d; max 2 sprays, 7 d apart (1 when flowering); high risk to bees; weak in hot weather |                  |          |                           |            |           |            |        |        |

The PMDG's other options (Cotesia wasps from ZARI, a neem leaf extract made at home) are not products and do not go on the register; the advice already covers them.

## Cassava · Cassava mosaic disease

Source: _Cassava mosaic disease in cassava, Zambia_, PMDG, A. Goma (MoA), April 2024.

| Active ingredient                                          | Brands the PMDG names         | What the PMDG says (context only)                                                                                                                                                                                            | Found at dealer? | Reg. no. | Label dose (copy exactly) | PHI (days) | WHO class | Registrant | Expiry | Photos |
| ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------- | ------------------------- | ---------- | --------- | ---------- | ------ | ------ |
| cypermethrin (against the whitefly that spreads the virus) | Cypermethryn 20EC; Cyrux 20EC | WHO II; PHI 3–7 d; max 2 sprays a season; not where leaves are eaten. **The PMDG advises against it for small-scale farmers** (usually ineffective, whiteflies move too much); it is for large growers of planting material. |                  |          |                           |            |           |            |        |        |

**Recommendation:** do not load a cassava mosaic product for farmer advice even if the label lists whitefly on cassava, unless an agronomist agrees. The advice stays IPM-only plus the officer referral, which is what the PMDG says for smallholders.

---

## Not covered by these five guides

- **Maize · Fall armyworm: the main storyline, and the biggest gap.** There is no Zambian FAW PMDG in the corpus. _Fall armyworm on maize in Zambia_ (Plantwise, 2018, ZARI authors) is in `sources.yaml` as `pw-pmdg-fall-armyworm-zambia-2018`, but Plantwise blocked the automated download. Two ways to close it:
  1. Download it in a browser as you did the other five, and record it with `pnpm --filter @repo/corpus fetch-corpus --import pw-pmdg-fall-armyworm-zambia-2018 <file>`. I then extend this sheet.
  2. At the dealer, photograph every product whose label lists **fall armyworm on maize**, whatever the active ingredient.
- **Cassava brown streak and maize lethal necrosis:** viral diseases with no chemical control. Nothing to load; the advice is IPM-only by design.
- **The MoA FAW manual (2nd edition):** treated as not coming. Its `sources.yaml` entry stays as pending by email. If it ever arrives, its products annex can still be extracted for review, but nothing waits on it.

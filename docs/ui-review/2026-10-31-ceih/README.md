# CEIH tabs: visual pass and the live storyline (31 Oct)

The Outgrower View's three CEIH tabs (`docs/ceih-overnight-plan.md`, Phase 3), on the field-airy kit: no new colours, no dark surfaces, the DEMO pill on every simulated figure, the dialogs on a light canvas scrim.

## Visual pass (preview fixtures, `tools/seed/ceih-fixtures.ts`)

Every view at laptop (1440), phone (390) and projector (1280, 1920). The checks found no issues ([visual-pass.md](visual-pass.md)), and every shot was looked at.

| View                                             | Laptop                                             | Phone                                            | Projector                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Season ledger, Given's field card open (January) | [1440](dashboard-season-ledger-laptop.png)         | [390](dashboard-season-ledger-phone.png)         | [1280](dashboard-season-ledger-projector-1280.png) · [1920](dashboard-season-ledger-projector-1920.png)                 |
| Approvals (Given's advance waiting)              | [1440](dashboard-season-approvals-laptop.png)      | [390](dashboard-season-approvals-phone.png)      | [1280](dashboard-season-approvals-projector-1280.png) · [1920](dashboard-season-approvals-projector-1920.png)           |
| The approval dialog                              | [1440](dashboard-season-approve-laptop.png)        | [390](dashboard-season-approve-phone.png)        | [1280](dashboard-season-approve-projector-1280.png) · [1920](dashboard-season-approve-projector-1920.png)               |
| Reconciliation (June)                            | [1440](dashboard-season-reconciliation-laptop.png) | [390](dashboard-season-reconciliation-phone.png) | [1280](dashboard-season-reconciliation-projector-1280.png) · [1920](dashboard-season-reconciliation-projector-1920.png) |

The report photos show the preview's "could not be loaded" frame: the previews have no sign-in, so Storage refuses them. The live shots below have them.

## The storyline, live (real Firestore season, the API run locally, signed in as a Command Center account)

Beats of plan §4, played through the dashboard: [1 ledger](live-1-ledger.png) · [2 Given, cloud gap](live-2-given-cloud-gap.png) · [3 ground check, eligible at ZMW 840](live-3-given-eligible.png) · [4 request: amount and fee](live-4a-request-dialog.png), [the code from the SMS log](live-4b-code-dialog.png), [confirmed](live-4c-confirmed.png) · [5 approvals](live-5-approvals.png) · [6 approve](live-6a-approve-dialog.png), [sent](live-6b-sent.png), [the SMS log](live-6c-sms-log.png) · [7 March: Hamangaba's claim pack](live-7-march-claim-pack.png) · [8 June: Given's statement](live-8-june-statement.png). The season was re-armed afterwards.

Found by looking and fixed before these shots:

- **The drought rule fired on every camp in June** (live): a dry harvest month with every field maturing reads as rain and NDVI agreeing. The rule now watches the growing season only (30 to 125 days after the camp's median planting, PLACEHOLDER), and a jump straight to June runs March's rule as of its day.
- **The portfolio at 1920:** six columns in the page's width ran "ZMW 2,321,400" into "ZMW 764,690". Three columns at every width.
- **On a phone:** the portfolio figures clipped in two columns (one column under 440 px); the camp filter pushed the page 12 px wide (its row now shrinks and the filter scrolls in its pill); the season-day line wrapped into columns.
- **Given's curve:** random December clouds hid the rise the story is about; his passes are now clear until the two clouded ones. The chart starts three weeks before planting, not in October.
- **The dialogs** had no DEMO pill; they carry it now. Statement lines no longer say "simulated" twice, and the advance lists before its fee.
- **A satellite-established field** showed "Simulated report: no photo" on its approval card; it says it was established from space and needed no ground photo.

Known and left:

- The dashboard's own calls take 5 to 25 s a beat when the API runs on a laptop in Lusaka (every view loads the season from Firestore in europe-west1); on Cloud Run, next to Firestore, they are expected to take well under a second. The demo check times them on the deployed API.

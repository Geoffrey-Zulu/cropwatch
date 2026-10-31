# Field-airy rebuild: visual pass (31 Oct)

The visual pass of the rebuild to mockup A ([`a-field-airy.html`](../../../apps/web/public/mockups/a-field-airy.html)), with the map motion from mockup B. Every view is shot at laptop (1440) and phone (390), and the national map also at projector sizes (1280 and 1920). The checks found no issues ([visual-pass.md](visual-pass.md)), and every shot was looked at.

| View                                    | Laptop                                                                                                                     | Phone                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| National map                            | [1440](dashboard-map-laptop.png)                                                                                           | [390](dashboard-map-phone.png)                                                                                          |
| Map, Lusaka and Chongwe (the demo view) | [1440](dashboard-map-lusaka-laptop.png)                                                                                    | [390](dashboard-map-lusaka-phone.png)                                                                                   |
| Map, Eastern Province (fly-to)          | [1440](dashboard-map-eastern-laptop.png)                                                                                   | [390](dashboard-map-eastern-phone.png)                                                                                  |
| Map, a district pressed (Chipangali)    | [1440](dashboard-map-district-laptop.png)                                                                                  | [390](dashboard-map-district-phone.png)                                                                                 |
| Alerts                                  | [1440](dashboard-alerts-laptop.png)                                                                                        | [390](dashboard-alerts-phone.png)                                                                                       |
| Outbreak                                | [1440](dashboard-outbreak-laptop.png)                                                                                      | [390](dashboard-outbreak-phone.png)                                                                                     |
| Report                                  | [1440](dashboard-observation-laptop.png)                                                                                   | [390](dashboard-observation-phone.png)                                                                                  |
| Officer queue                           | [1440](dashboard-queue-laptop.png)                                                                                         | [390](dashboard-queue-phone.png)                                                                                        |
| Outgrower View                          | [1440](dashboard-outgrower-laptop.png)                                                                                     | [390](dashboard-outgrower-phone.png)                                                                                    |
| Outgrower View, field officers ranked   | [1440](dashboard-outgrower-prioritised-laptop.png)                                                                         | [390](dashboard-outgrower-prioritised-phone.png)                                                                        |
| Farm visit                              | [1440](dashboard-visit-laptop.png)                                                                                         | [390](dashboard-visit-phone.png)                                                                                        |
| Dry-spell scenario, off and on          | [off](dashboard-scenario-laptop.png) · [on](dashboard-scenario-dry-laptop.png)                                             | [off](dashboard-scenario-phone.png) · [on](dashboard-scenario-dry-phone.png)                                            |
| Knowledge sources                       | [1440](dashboard-sources-laptop.png)                                                                                       | [390](dashboard-sources-phone.png)                                                                                      |
| Capture: camera, ready, sent            | [1](capture-1-camera-laptop.png) · [2](capture-2-diagnose-ready-laptop.png) · [3](capture-3-report-sent-laptop.png)        | [1](capture-1-camera-phone.png) · [2](capture-2-diagnose-ready-phone.png) · [3](capture-3-report-sent-phone.png)        |
| Capture: advice, officer, home          | [4](capture-4-result-advice-laptop.png) · [5](capture-5-result-officer-laptop.png) · [6](capture-6-home-alerts-laptop.png) | [4](capture-4-result-advice-phone.png) · [5](capture-5-result-officer-phone.png) · [6](capture-6-home-alerts-phone.png) |

Projector shots: the national map at [1280](dashboard-map-projector-1280.png) and [1920](dashboard-map-projector-1920.png); Lusaka and Chongwe at [1280](dashboard-map-lusaka-projector-1280.png) and [1920](dashboard-map-lusaka-projector-1920.png).

Found by looking and fixed before these shots:

- **Lusaka and Chongwe, found on the live preview:** at that zoom (about 12 times the national view) every report was a blob about 25 px across, the rings were 280 px wide, and the boundaries and stripes were drawn as thick bands. The cause was mockup A's sizes, which are floors in map units and so grow with the zoom. Lines, stripes and dots now keep their screen size once zoomed in. A ring grows only to its true 10 km, so it encloses the reports it counts. The national view is unchanged. This view is now in every visual pass.

- **Zoomed views:** report dots ran through the "National map" title, and the Lusaka ring sat under the boundaries credit. Text set straight on the map now sits on a soft patch of canvas, which can't be seen on the national view.
- **Last week's count** ("(199)") wrapped onto a line of its own. It now stays with "last week".
- **A knowledge status pill** ("Fetched, not indexed") wrapped onto two lines.
- **The phone district shot:** the Chipata cluster ring covers Chipangali on a phone, so the tap opened the cluster, which is correct. The shot now presses the shape itself.

Known and left:

- **On a phone, a pressed district's card** appears in "Districts to watch", below the map. The map flies to the district, but the card is a scroll away. The demo runs on a laptop and the projector.
- **On a phone, the queue's second tab** ("In a cluster, not verified") runs off the right edge. The tab strip scrolls sideways.
- **The figures are the preview fixtures.** "Signals updated 33 h ago" is the fixtures' age. The live system recomputes on every report.

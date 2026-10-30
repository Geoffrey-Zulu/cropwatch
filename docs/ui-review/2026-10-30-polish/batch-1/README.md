# Polish batch 1: the chrome (30 Oct)

Items 1 to 6 of the polish batch on the v2.1 structure, deployed to https://crop-watch01.web.app and https://crop-watch01-capture.web.app on 30 Oct, with the API at `cropwatch-api-00011-c8d` (the alert push text comes from the shared wording).

What changed:

1. **Loaders.** One loading state: shimmer blocks shaped like what lands (the app start, the map, the photo, the advice, the scenario's forecast). No "…" text in the Command Center. A spinner appears only inside a button mid-action ("Saving", "Signing in"). The scenario no longer flashes "0 camps" while the forecast loads.
2. **Icons.** Lucide everywhere, from one provider: 20 px for navigation and actions, 16 px inline with text, a 1.5 px stroke at any size. Sign out is Lucide `log-out`.
3. **Sidebar.** The rail folds between 56 px icons with tooltips and a labelled 224 px panel. The chevron control is at the bottom. The state is remembered per user in this browser.
4. **Navbar.** The Phytos lockup alone: the leaf mark on the ink chip, plus the wordmark. It was picked over the plain wordmark block after a side-by-side. "Command Center" and the prototype chip are gone. The right side has the verified count, the bell and the avatar. **DEMO DATA · SIMULATED** is now a quiet pill on the data it marks:
   - the map's top-right corner;
   - the right of the queue tabs;
   - the stat rows on the Outgrower View and the scenario;
   - the drawer headers.

   Every view that shows simulated rows still shows it (invariant 5).

5. **"Prototype"** is gone from the UI copy:
   - "Risk signal from reports, not a forecast";
   - "Threshold set by Phytos";
   - alerts read "Risk signal from AI-assessed reports. Not yet verified by an officer."
6. **Page headers.** A title, then the content. There are no question lines under page or drawer titles.

Also changed: the officer queue opens on the tab last used in the browser, so the demo laptop can be left on **In a cluster, not verified** (the new pre-stage line in `docs/demo-ops.md`).

Checks after the deploy:

- **Repo gate:** green (typecheck, lint, build, 394 tests).
- **Demo check:** passed (`outbreak-e2e`: report to dispatch in 8.4 s; Lusaka Elevated). An earlier run passed its checks, then a network timeout stopped its cleanup. The test report it left in the venue cluster was retracted by hand, and the cluster and alert it had raised were removed. The re-run cleaned up after itself.
- **Visual pass:** all 17 states at laptop and phone, plus the map at 1280 and 1920, with no issues ([visual-pass.md](visual-pass.md)). Every shot was looked at on the sheets.

Sheets: [laptop](sheet-laptop.png), [phone](sheet-phone.png). Known: with a drawer open over the map, the drawer covers part of the map's DEMO pill. The drawer carries its own pill.

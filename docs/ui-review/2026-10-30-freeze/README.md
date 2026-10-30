# Freeze `freeze-2026-10-30`: dashboard v2.1, accepted

The build at the tag `freeze-2026-10-30`, deployed to https://crop-watch01.web.app on 30 Oct. The API is unchanged since increment 2 (`cropwatch-api-00010-f44`).

Changes since v2.1 (`docs/ui-review/2026-10-29-v2/v2.1/`):

- **Officer queue:** the routed list is headed "AI could not identify, or was unsure". It holds low-confidence reports the AI did identify, as well as ones it could not.
- **Knowledge sources, phones:** the publisher line wraps under the title. Since v2.1 set it in the wider sans, it took the row and squeezed each title to a word per line. The automated checks did not flag it; it was found by eye on the phone sheet.

Checks after the last deploy:

- the full repo gate is green (typecheck, lint, build, 392 tests);
- the demo check passed at the venue (`outbreak-e2e`: report to dispatch 8.9 s);
- the visual pass ran on all 17 states at laptop and phone widths, plus the map at 1280 and 1920, with no issues ([visual-pass.md](visual-pass.md));
- every shot was looked at on the contact sheets.

The demo check ended with Lusaka at **Elevated**, not High: "17 reports this week (+31% on last week)" is under the +50% surge that makes a 5-report cluster High. Re-arm on the pitch morning and check again. The stage notes in `docs/demo-ops.md` say what P2 says if it stays Elevated.

All states at both widths: [sheet-laptop.png](sheet-laptop.png), [sheet-phone.png](sheet-phone.png). The national map at projector sizes: [1280 x 800](dashboard-map-projector-1280.png), [1920 x 1080](dashboard-map-projector-1920.png).

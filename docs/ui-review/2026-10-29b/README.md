# UI review, 29 Oct 2026 (b): the final UI pass before the pitch

The same 12 views, before (this morning's "Field Signal" night console, `docs/ui-review/2026-10-29-field-signal/`) and after (tag `freeze-2026-10-29b`). Same preview fixtures, same viewports: capture at 390 px, Command Center at 1440 px. UI only; the demo path is unchanged. Patterns come from `design-system/phytos/patterns.md` (OneSoil, John Deere Operations Center, Climate FieldView, xarvio, Linear, Stripe).

What changed:

- **Command Center on the light day exposure.** Hotel projectors wash out dark grounds.
- **Header:**
  - wordmark and a smaller prototype badge on the left;
  - the verified-observations chip on the right;
  - an initials avatar that opens the account menu (email, role, sign out).
  - No email in the chrome.
- **Mono caps only on kickers, chips and stat labels.** Nav, table headers, form labels, buttons and body are sentence case.
- **Nav:**
  - icons and sentence-case labels;
  - a chartreuse bar and tint on the current page;
  - quiet grey counts.
- **Lists:**
  - at most two chips and two lines per row;
  - severity is a coloured dot and a word;
  - "High district" folds into the reason line.
  - Districts to watch are two lines each.
  - Nothing ends in "…".
- **Stat row as on the pitch PDF:** a big Bricolage number with a two-line label beside it.
- **Spacing:** an 8 px grid, 24 px panels and a 1320 px maximum width.
- **Map on a light ground:**
  - paper basemap with moss outlines;
  - gold and amber risk fills;
  - dark report dots;
  - deep-leaf cluster rings;
  - the selected district outlined, and its row tinted, in deep leaf.
- **Capture:**
  - same layouts;
  - field and form labels and report metadata in sentence case;
  - kickers unchanged.

| View                               | Before (Field Signal, night)                                 | After (freeze-2026-10-29b)        |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| Capture: camera                    | ![](../2026-10-29-field-signal/capture-1-camera.png)         | ![](capture-1-camera.png)         |
| Capture: ready to send             | ![](../2026-10-29-field-signal/capture-2-diagnose-ready.png) | ![](capture-2-diagnose-ready.png) |
| Capture: report sent               | ![](../2026-10-29-field-signal/capture-3-report-sent.png)    | ![](capture-3-report-sent.png)    |
| Capture: result and advice         | ![](../2026-10-29-field-signal/capture-4-result-advice.png)  | ![](capture-4-result-advice.png)  |
| Capture: with an officer           | ![](../2026-10-29-field-signal/capture-5-result-officer.png) | ![](capture-5-result-officer.png) |
| Capture: home and area alerts      | ![](../2026-10-29-field-signal/capture-6-home-alerts.png)    | ![](capture-6-home-alerts.png)    |
| Command Center: national map       | ![](../2026-10-29-field-signal/dashboard-map.png)            | ![](dashboard-map.png)            |
| Command Center: outbreak detail    | ![](../2026-10-29-field-signal/dashboard-outbreak.png)       | ![](dashboard-outbreak.png)       |
| Command Center: observation detail | ![](../2026-10-29-field-signal/dashboard-observation.png)    | ![](dashboard-observation.png)    |
| Command Center: officer queue      | ![](../2026-10-29-field-signal/dashboard-queue.png)          | ![](dashboard-queue.png)          |
| Command Center: Outgrower View     | ![](../2026-10-29-field-signal/dashboard-outgrower.png)      | ![](dashboard-outgrower.png)      |
| Command Center: knowledge sources  | ![](../2026-10-29-field-signal/dashboard-sources.png)        | ![](dashboard-sources.png)        |
| Dry-spell scenario (flagged)       | ![](../2026-10-29-field-signal/dashboard-scenario.png)       | ![](dashboard-scenario.png)       |

After this tag, UI feedback goes to `docs/ui-feedback-log.md` and is not built until after the final pitch.

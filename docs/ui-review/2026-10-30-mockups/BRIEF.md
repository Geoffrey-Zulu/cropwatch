# Phytos National Map: mockup brief (shared by all three directions)

## The product and the decision

Phytos is a crop-health early-warning prototype for Zambia. Farmers photograph a sick crop, and an AI assesses it. Reports that sit close together form clusters, and districts get a qualitative risk signal. Extension officers verify reports. Its Command Center is a web dashboard. The **National Map** page is its main screen, and at the hackathon final it is projected in front of judges.

Geoffrey, the product owner, will open three competing static mockups of this page tomorrow morning: on a laptop (1440×900), on a projector (1920×1080) and on his phone (390×844). He will pick one, and every dashboard view will then be rebuilt to match it **exactly**: the mockup is the contract. Make every detail deliberate, and make it the best version of your direction's idea. The other two directions exist too, so yours must be unmistakably its own idea, not a variation of a generic dashboard.

## The data (real; use nothing else)

`national.json` (next to this brief) is exported from the live seeded system. Every row is simulated demo data.

- `header`:
  - `verified_observations`: officer-verified reports;
  - `queue`: reports waiting for an officer;
  - `new_alerts`: alerts in the last 24 h.
- `stats`:
  - reports this week and last week;
  - active clusters (and how many are new this week);
  - districts at High and at Elevated;
  - reports waiting for an officer (and how many are new this week).
- `daily[14]`: reports per day, oldest first, as `all`, `fall_armyworm`, `tuta_absoluta`, `other` and `verified`.
- `districts_to_watch[]`: the district, its level (HIGH/ELEVATED), `compact` (one line of its factors) and `factors[]` (the full sentences), in display order.
- `alerts[]`: the 12 newest, each with:
  - `issue` and `district`;
  - `level`;
  - `class`: "Weather advisory", "Model risk signal" or "Verified cluster alert";
  - `how_sure`: the sentence saying how sure the alert is;
  - `first_factor` and `created_at`.
- `clusters[]`: active clusters, each with issue, district, `size` (number of reports), `new_last_24h`, `verified`, and `x`/`y` for the map.
- `reports[]`: every report from the last 14 days, with `x`/`y`, `issue`, `district` and `status`.
- `districts[]`: all 116 districts, each with `slug`, `name`, `province`, `level` (HIGH/ELEVATED/LOW) and `d`, an SVG path string.
- `frame`: the map's coordinate frame, 960×720. Use `viewBox="0 0 960 720"`. Every `x`/`y` and every path is in this frame.
- `generated_at`: the time base. Write times as "2 h ago" and similar, relative to it.

Use only these numbers, names and sentences. **Do not invent figures, districts, alerts, trends or charts.** A chart must plot `daily`, or something computed from the data. You decide what to show and how prominently, and what sits behind an affordance; draw the affordance closed, or draw one state open on purpose.

## Required on the page

- **Brand:** Phytos (design the wordmark or lockup; the existing motif is a simple leaf mark).
- **Navigation, in this order:**
  1. National map (current)
  2. Officer queue (with its waiting count from `header.queue`)
  3. Outgrower View
  4. Dry-spell scenario
  5. Knowledge sources
- **Header right:** "`<header.verified_observations>` verified observations", a bell carrying `header.new_alerts`, and an avatar with the initials "DA".
- **Page title:** National map.
- **Key figures:** from `stats`, with their week-on-week change where the data has one.
- **The map:**
  - the 116 districts, shaded by level;
  - the report dots, all simulated;
  - the cluster rings, each with its report count;
  - a region toggle (All Zambia (selected) / Lusaka and Chongwe / Eastern Province);
  - zoom controls;
  - a legend, which may sit behind an affordance;
  - the boundary credit, small: "Boundaries: geoBoundaries, GRID3 and Office of the Surveyor General (CC BY 4.0)".
- **Districts to watch:** each district with its level and its `compact` factor line.
- **The honesty line, verbatim:** "Risk signal from reports, not a forecast."
- **A DEMO DATA · SIMULATED marker** on the data area. It can be quiet, but it must be visible.
- **Alerts:** optional on this page (today they sit behind the bell). If you show any, each one shows its `class` and its `how_sure` text.

## Product rules (breaking one fails the mockup)

1. Risk is qualitative: High, Elevated or Low. Never a probability, likelihood, odds or confidence number. Counts and the week-on-week changes already in the data are fine.
2. A level never appears without its factors, at least the `compact` line.
3. Never encode a level by colour alone: pair it with the word or a distinct shape. High must read as more severe than Elevated, including to colour-blind viewers.
4. **Copy:**
   - No em dashes (—) anywhere.
   - Never use the words "prototype", "predict"/"predicts", "probability", "AI-powered", "platform" or "revolutionary".
   - "forecast" appears only in "not a forecast".
   - Models "assess"; officers "verify".
5. All the data is simulated, so the DEMO marker stays visible on the data.

## Technical

- **One self-contained HTML file.** CSS and SVG are inline. Google Fonts via `<link>` is the only external resource allowed. Use inline JavaScript only for small things (an open legend, a hover state, generating the map's SVG from the JSON you inline), with no frameworks and no other network requests. Inlining the data and building the SVG with a small script is fine, as is writing the SVG out directly.
- **Responsive and intentional** at 1440×900 (laptop), 1920×1080 (projector) and 390×844 (phone, which can scroll). Text must stay readable from the back of a room at 1920.
- **Check your work, and iterate.** Take screenshots with Playwright, run from `C:\Users\geoff\OneDrive\Documents\GitHub\cropwatch\tools\visual` (it has `playwright`; use `chromium.launch({ channel: 'chrome' })`), at all three sizes. Use a full-page capture for the phone. Look at every PNG with the Read tool and keep refining until it is excellent. Put screenshots under `...\scratchpad\mockups\shots\<your letter>\`. Write any helper scripts to `...\scratchpad\mockups\tools\` and run them from `tools\visual` (for example `npx tsx <abs path>`), so `playwright` resolves.
- **Stay in your lane.** Don't modify the repo, don't commit, don't deploy, and don't touch the other directions' files.

## Your deliverable

Your HTML file at the path your direction gives. Then a final message containing:

- the path;
- 6 to 10 lines on the design decisions: layout, type, palette and how the risk colours were chosen, density, how it adapts on phones;
- anything in the rules you were unsure about.

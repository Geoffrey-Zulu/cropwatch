# Dashboard patterns v2: progressive disclosure

Research note, 29 Oct 2026, for the Command Center redesign (summary first, detail on demand). It studies four products: OneSoil, Linear, Stripe Dashboard and Grafana. Where possible the method was the live product, not its docs: pages were loaded in Playwright at 1440 x 900, screenshotted early and late, clicked through, and measured. Screenshots are in `.playwright-mcp/` (git-ignored).

**What was measured and how.** A script read every visible element in the viewport: text `color`, `background-color`, visible `border-color` and SVG `fill` and `stroke`. Translucent values were blended over the body background and near-duplicates (RGB distance under 22) merged. A cluster is neutral when its chroma is under 20/255; the rest are grouped into 30° hue families. A **bordered box** has three or four visible bordered sides; a **rule** has one or two. Canvas and WebGL pixels (OneSoil's map, Grafana's timelines) are not sampled. Contrast is WCAG 2; colour-blind separation is a Machado 2009 simulation compared with CIE76 ΔE.

Each claim below is marked **measured**, **seen** (in a screenshot) or cited with a URL. Anything I could not see is marked **not observed**.

## OneSoil

Sources: live public map https://map.onesoil.ai/; the web app's login page https://app.onesoil.ai/ (its CSS tokens only); help centre screenshots of the 2024 web app at [help.onesoil.ai 5237541](https://help.onesoil.ai/en/articles/5237541-how-to-compare-sort-group-and-share-fields-in-the-mobile-and-web-apps) and [5237493](https://help.onesoil.ai/en/articles/5237493-how-to-monitor-vegetation-indexes-ndvi-msavi-ndre-etc); App Store screenshots at https://apps.apple.com/app/id1458134040.

(a) Default vs one click

- **Public map (seen).** Full-bleed map plus one white 360 px left panel showing the place title, a unit, and "Crop ranking in regions" (rank dot, crop, size). Clicking a field opens a "Field data" sheet with two figures (Crop, Field size), one CTA and two "Inform us" links. The sheet slides over the region panel; the map stays live and the selected field is lit (seen). Year, layer, filter and season sit in a slim bar of four dropdowns.
- **Sheet geometry (measured).** 360 px wide, 8 px top radius, shadow `0 -2px 8px rgba(0,0,0,.05)`. The scrim `rgba(0,0,0,.55)` dims only the panel underneath, not the map. Transition 0.2 s.
- **Deep links (seen).** The URL records the state: `?field=4512&last=field&sandbox=…`.
- **Uncertainty (seen).** The accuracy caveat is one line, "Noticed an inaccuracy? Contact us." with a "Details" link. The explanation opens in place.
- **Web app (help screenshots, seen).** The legend is collapsed ("Show legend"). Layers and labels sit in a two-column popover; sort, group and order in a "Sort" popover; filters in a floating right panel with "Reset filter". Crop groups collapse. Field detail is a large sheet: name, area and crop, then tabs (Status, Field report, Prescription maps, Data, Yield Analysis). Status opens on three summary tiles (crop, planting date, weather with an arrow to more).
- **Mobile, AI Agronomist (App Store, seen).** An accordion of one-line topics ("Current Conditions ›", "Moisture Pattern ›"). Only one or two are open, each a short paragraph. This is the same shape as a "Why this advice?" expander.

(b) Colours and boxes

- **Public map viewport (measured).** 7 neutral clusters and 5 non-neutral clusters in 3 hue families: green `#24AE60`, link blue `#094DBA`, plus a share-button blue and yellow.
  - 23 bordered boxes, every one a 15 px map marker. The panel itself has 0 boxes and 8 one- or two-side rules.
- **Grouping (seen).**
  - The panel separates its blocks with one full-width hairline and whitespace.
  - The section title carries a dark underline.
  - Field rows (web app) are thumbnail, name (semibold) and area (grey) with no dividers. One right-aligned value per row; only its up or down arrow is coloured.
- **Where borders remain (seen).** Inputs (2 px, `rgba(165,178,188,.3)`, from the app tokens), folder tiles (fill, no border), and the Status tiles (hairline).

(c) Loading

- **Public map (seen).** At 400 ms the panel text is up in a fallback font, with the map black. Tiles and markers stream in by 2.5 s. After a click, the crop list grows into place: 6 rows visible at 600 ms, all 11 at 6 s. No spinners, no skeletons.
- **Web app (seen).** A flat light-grey full screen for over 5 s, then the login page. No spinner, no skeleton.

(d) Typography (measured)

- **Family.** Graphik for everything; Helvetica only in Mapbox attribution.
- **Sizes.** Place title 28/700. Field figures 28/31 700 with the unit at 15/700. Panel heading 15/700. Body and labels 13/400. Filter values 15/700 under 13/400 labels.
- **Case.** Sentence case for nav and headers.

(e) Accent

- **Tokens (measured).** `--color-primary: #27AE60`, used on CTA fills, map markers and the add button. Links are blue `#094DBA` (7.55:1).
- **Contrast problem.** White on `#27AE60` measures 2.87:1, which fails AA for text.
- **Where green never appears (seen).** Body text and row values. Crop fills use their own palette.
- **Greys.** Apple's system greys: `#F2F2F7`, `#E5E5EA`, `#D1D1D6`, `#8E8E93`. Text is `#222`.

## Linear

Sources: https://linear.app/ (the homepage renders the app in HTML, dark theme); [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui); [Triage docs](https://linear.app/docs/triage); [Peek](https://linear.app/docs/peek.md); [Display options](https://linear.app/docs/display-options.md).

(a) Default vs one click

- **Issue list (seen).**
  - Group headers: chevron, status icon, name and count, on a tinted band.
  - Rows: priority icon, grey ID, status icon, title. Nothing else.
- **Behind one action.**
  - Display properties in a popover (Shift V); "Show empty groups" is off.
  - Peek (Space) previews description, assignee, status, priority, cycle, labels, estimate and dates without leaving the list ([docs](https://linear.app/docs/peek.md)).
  - Sidebar sections fold ("Workspace ▾", "Favorites ▾"), with "More" for rare items (seen).
- **Triage inbox (docs image, seen).** Two-line rows: title with ID on the right, then source with age on the right.
- **Aim of the 2024 redesign.** "Reduce visual noise, maintain visual alignment, and increase the hierarchy and density of navigation elements" ([blog](https://linear.app/now/how-we-redesigned-the-linear-ui)).

(b) Colours and boxes

- **Hero app mock (measured).** 10 neutral clusters and 5 non-neutral in 5 families: the yellow in-progress icon, indigo, orange, and green and red diff counts.
  - 18 bordered boxes: the frame, comment cards, the agent panel and code tags. 2 rules and 14 shadows.
- **What carries colour (seen).** Status icons and diff counts. Text stays grey and white.
- **Light theme (blog screenshot, seen).** A grey sidebar against a white list, grey group bands, and hairline rows.
- **Theme system ([blog](https://linear.app/now/how-we-redesigned-the-linear-ui)).** Light tokens in the site CSS (measured): surfaces `#FFF`, `#F8F8F8`, `#F4F4F4`, `#F0F0F0`; lines `#D4D4D6`, `#EAEAEB`, `#F0F0F0`; text `#282A30`, tertiary `#6F6E77` (5.03:1). The whole theme is generated from three variables: base, accent and contrast.
- **Grouping (seen).** Grouping comes from bands, indentation and weight. Selected nav is a grey fill, not a border.

(c) Loading

- **Not observed in the app**: there is no public workspace.
- **Marketing page.** Showed only the header on an empty ground for at least 4 s, then the hero faded in. No skeletons or spinners.

(d) Typography (measured)

- **Family.** Inter Variable, with Berkeley Mono only for code and branch names.
- **Weights.** 400, 510 and 590 (tokens `--font-weight-medium: 510`, `--font-weight-semibold: 590`).
- **Sizes.** Issue title 20/590. Section ("Activity") 16/590. Body 14/400. Nav 13/510. Sidebar section labels 12/510 in grey. Meta and counts 12/400.
- **Text tokens.** `mini` 13 px, `small` 14 px, `regular` 15 px.
- **Case.** Sentence case everywhere, with no uppercase labels.

(e) Accent

- **Value.** Indigo `#5E6AD2` (`--color-indigo`; brand background `#7070FF`). Measured: 4 indigo marks in the hero viewport.
- **Where it appears (seen).** The composer send button and the @mention tint.
- **Where it never appears (seen).** Status (yellow, green, grey), the selected nav item (grey fill), body text and counts.

## Stripe Dashboard

Sources: the live embedded payments component on [docs.stripe.com](https://docs.stripe.com/connect/supported-embedded-components/payments) (Stripe's own Dashboard list and detail, rendered in an iframe); Stripe Apps [Design](https://docs.stripe.com/stripe-apps/design), [Style](https://docs.stripe.com/stripe-apps/style), [Lists](https://docs.stripe.com/stripe-apps/patterns/lists), [Loading](https://docs.stripe.com/stripe-apps/patterns/loading) and [Communicating state](https://docs.stripe.com/stripe-apps/patterns/communicating-state).

(a) Default vs one click

- **Payments list (seen, measured).**
  - Default: 10 rows ("1-10 of 88 results") with four columns: Date, Status badge, From, Amount. The amount is bold; the currency is grey.
  - Behind one click: five filters, each a collapsed chip that opens a popover; Export; Disputes on a second tab.
- **Detail (seen, measured).** A row click opens a detail layer. Header: amount 24/32 700 with currency 24/400 grey, then "From …". One blue primary button and one grey secondary. Below that, key and value sections.
  - The fee breakdown is behind a chevron ("Processing fee ⌄").
  - At this width the layer is a centred modal, not a drawer (seen).
- **Context drawer by default.** Apps start in a ContextView, "a drawer, so users can look at them side-by-side" with the page. A FocusView, with a blocking backdrop, is reserved for "focused, start-to-finish tasks" ([Design](https://docs.stripe.com/stripe-apps/design)).
- **Messages.** Banners sit under the drawer header and need an action to dismiss. Toasts are 30 characters at most ([state](https://docs.stripe.com/stripe-apps/patterns/communicating-state)).

(b) Colours and boxes (measured on the payments list)

- **Colours.** 4 neutral clusters (`#D7D7D7`, `#393B3E`, `#717171`, `#EBEEF1`). Non-neutral: success green (badge border, fill and text), link blue `#0074D4`, and slate secondary `#545969`. That is 2 hue families plus a near-grey slate.
- **Boxes.** 18 bordered boxes: 5 filter chips, Export, and 10 status badges. 45 rules: row dividers of 0.8 px `#D7D7D7`. Rows are 38 px tall.
- **No cards.** Sections in the detail are separated by a heading and one rule.
- **Border tokens ([Style](https://docs.stripe.com/stripe-apps/style)).** Only two: `neutral`, "the default color for all borders and dividers", and `critical`. Text colour tokens include `critical`, "used sparingly".

(c) Loading

- **Docs.** Spinners, not skeletons: delay 200 to 300 ms to "prevent flash", large for a view and medium for a section. "Don't wrap Tabs in a loading state"; buttons use a `pending` prop ([Loading](https://docs.stripe.com/stripe-apps/patterns/loading)).
- **Live, with data requests delayed 8 s (seen).** A small ring spinner in the empty area, then an empty white card.
- **Skeletons:** not observed.

(d) Typography (measured)

- **Family.** The system UI stack (`-apple-system`, Segoe UI on Windows).
- **Apps tokens.** heading 16/24 700; subheading 11/20 600 uppercase; body 14/20 400; caption 12/16 400.
- **Component.** Rows 14/400. Table headers 12/700 in sentence case ("Date", "Status"). Badge 12/400. Detail keys 14/400 grey `#717171`, values 14/400 `#444`, section titles 16/700.

(e) Accent

- **Values.** The brand is blurple `#635BFF` (4.70:1), used on the Apps illustration's primary buttons. The embedded component's default theme uses blue: `#0074D4` was measured on links, and the primary button appears in the same blue (seen).
- **Where it never appears.** Status: badges use success, attention and critical tokens. Amounts and body text are ink or grey.

## Grafana

Source: live https://play.grafana.org (reachable, so the Datadog fallback was not needed). Pages: alert rules [list view](https://play.grafana.org/alerting/list?theme=light&view=list), [Alert activity](https://play.grafana.org/alerting/alerts?theme=light), a [rule page](https://play.grafana.org/alerting/grafana/random-multiple-series/view) and the [Alert list dashboard](https://play.grafana.org/d/bdodlcyou483ke/alert-list). The light theme was forced with `?theme=light`.

(a) Default vs one click

- **Alert rules page (seen).** Opens grouped: data source › folder › evaluation group. Groups are collapsed, so you see no individual rules until you expand one or switch to "List".
- **Filter sidebar.** State filters (Firing, Normal, Pending, Recovering), labels, folder and source.
- **Per-row actions.** Behind "More ▾".
- **Alert activity (seen).**
  - A state timeline chart, then rule rows with an instance count and a "Rule details" button.
  - The chevron opens the instances inline, with their label chips and "Instance details".
  - "Rule details" opens a right drawer.

(b) Colours and boxes (measured)

- **Rules list, firing filter.** 6 neutral clusters and 7 non-neutral in 5 families: firing `#CF0E5B`, action blue `#1F62E0`, "Provisioned" chip purple `#7C2EA3`, normal `#0A764E`, pending `#B04E0C`. 11 bordered boxes, all inputs, buttons or the info banner. Rule rows have 0 borders and 0 fills.
- **Alert activity.** 8 neutrals and 11 non-neutral in 5 families (label chips add olive and purple). 26 boxes: filters, toolbar buttons, "Rule details" buttons, the chart frame.
- **Grouping (seen).** Grouping is whitespace (about 16 px between rows), a grey second line and indentation under folder headers.
- **Where borders remain.** Controls, the chart panel, and the query editor cards inside the drawer.

(c) Loading (seen, measured)

- **Boot.** A full-screen grey with an orange spinner for 9 to 10 s.
- **Alert activity skeletons.** Rows of `react-loading-skeleton` bars that match the final layout:
  - Shape: a 16 px icon dot, a 133 px label bar and two 22 px count pills per filter row. One long bar plus a timeline bar per list row.
  - Bars: 16 px tall, 6 px radius, base `#ECEDED`, a `#DBDCDC` highlight sweep at 1.5 s ease-in-out, infinite.
  - Buttons and the chart frame render as empty outlines first.
- **Dashboards.** "Loading ..." text with a small spinner.
- **Layout shift.** On the rules list, a promo banner arrived after first paint and pushed the content down 196 px.

(d) Typography (measured)

- **Family.** Inter.
- **Sizes.** Page title 28/32 400 (light, not bold). Drawer title 28/32 400. Tabs and body 14/22 400. Rule name 14/22 400 (500 in the dashboard alert-list panel). Second line 12/18 400 at `rgba(36,41,46,.75)`, which works out to `#5A5E61` (6.33:1). Filter labels 12/500.
- **Case.** Sentence case for nav, tabs and labels ("Alert rules", "Rule name").

(e) Accent

- **Actions.** Blue `#1F62E0` (5.23:1 on `#FBFBFB`): primary buttons, "Clear filters", "View alert rule". It is also the Recovering state colour.
- **Brand.** Orange is kept to brand marks: the logo, the active tab underline and the active nav bar (seen).
- **Never.** Accent on firing or pending.
- **Contrast slip.** In the dashboard alert-list panel, pending text uses `#FF9900` (2.14:1 on white).

(f) Alert list row (measured on `?view=list&search=state:firing`)

- **Line 1.** A 15 px state icon (firing: a circle with "!" in `#CF0E5B`), the rule name 14/22 ink, at most one chip ("Provisioned"), and "More ▾" on the right.
- **Line 2, optional.** The summary annotation in grey ("Example from Alerting Docs").
- **Line 3.** Metadata at 12/18, grey icons, separated by "|": folder › group | data source | "1 instance" | "4 labels". Labels never appear as chips in the list; they collapse to a count.
- **Size.** About 44 px for two lines, 64 px for three. No borders, no fill.
- **States.** They differ in both colour and shape (measured on the filter list): firing `#CF0E5B`, "!" in a circle; pending `#B04E0C`, empty circle; normal `#0A764E`, check in a circle; recovering `#1F62E0`, up arrow.
- **Dashboard alert-list panel.** Adds the state word with a duration ("Firing for 2h 38m 21s"). The instances sit behind a "› 1 instance" expander.
- **On click.**
  - The rule name opens the full rule page: title with a "● Firing" pill; tabs Query and conditions, Instances (3), History, Notifications; a right key and value rail.
  - "1 instance" opens that page on its Instances tab.
  - In Alert activity, "Rule details" opens a right drawer: 720 px (half of 1440), white, shadow `0 13px 20px 1px rgba(24,26,27,.18)`, resizable edge, `aria-modal="true"`. Focus moves to Close; Esc closes it. It holds the title, a state pill, two actions (Silence, View alert rule) and two tabs. The list behind stays visible but dimmed.

## Comparison

| Product                     | Default view shows                                                                                                   | Colours on screen (measured)                         | Bordered boxes (measured)                       | Loading pattern                                                                     | Accent                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| OneSoil (public map)        | Map and one 360 px panel: place, crop ranking. Detail opens as a sheet over the panel; legend and filters are hidden | 7 neutral, 5 hue clusters (3 families), map excluded | 23, all map markers; 0 in the panel             | Progressive: text, then tiles, then rows grow in; app shows a flat grey screen      | Green `#27AE60` (CTA, markers); links `#094DBA`          |
| Linear (homepage app, dark) | Sidebar, issue, activity, agent panel; rows hold icon, ID, status, title                                             | 10 neutral, 5 hue families (status, diff)            | 18 (frame, cards, panel, code tags)             | App not observed; marketing hero blank, then fade-in                                | Indigo `#5E6AD2`, never on status or nav selection       |
| Stripe (payments component) | 10 rows x 4 columns, filters as chips, detail on row click                                                           | 4 neutral, about 2 hue families                      | 18 (filter chips, Export, badges); 45 row rules | Spinner after a 200 to 300 ms delay (docs); no skeleton seen                        | Blurple `#635BFF` brand; blue `#0074D4` in the component |
| Grafana (alert rules list)  | Collapsed groups by default; list view has two-line rows, filter sidebar                                             | 6 neutral, 5 hue families                            | 11, all controls and a banner; rows 0           | Boot spinner; shape-matched skeleton rows with shimmer; "Loading ..." on dashboards | Blue `#1F62E0` for actions; orange only for brand marks  |

## Decisions for Phytos

### 1. Accent and neutrals

- **Accent: `#2160C4`** (blue, hue 217) for the primary button fill, focus ring, selected-row bar, the selected district or cluster outline on the map, and links. White text on it is 5.94:1.
- **Accent text: `#1B4F8F`** for links and accent words on light grounds: 8.20:1 on `#FFFFFF`, 7.51:1 on the rail.
- **Why blue, not green.** All four products put interaction on a blue or indigo and keep state colours separate: OneSoil links `#094DBA`, Linear `#5E6AD2`, Stripe `#635BFF` and `#0074D4`, Grafana `#1F62E0`. OneSoil's green fails for Phytos twice:
  - white on `#27AE60` is 2.87:1;
  - under simulated deuteranopia it sits only ΔE 32 from ELEVATED `#D9A441` and ΔE 26 from HIGH `#B4521C`. `#2160C4` stays at ΔE 99 or more from both, for both deuteranopia and protanopia.
- **Never:** accent on a risk level, on verification state, on counts, on chart series, or on the bell badge. Never a second accent.
- **Neutrals:** ground `#FFFFFF`; rail and hover `#F4F5F6`; hairline `#E4E6E9` (1.25:1, decorative only); control border `#7D838C` (3.82:1 on white, 3.50:1 on the rail); secondary text `#5C616A` (6.23:1 on white, 5.70:1 on the rail); ink `#17191C` (17.61:1 on white, 16.14:1 on the rail).
- **Risk tokens.** They keep their current values (ELEVATED `--attention`, HIGH `--high` in `phytos.css`) and are the only warm colours. The DemoBadge leaves the gold tint for a neutral hatch with ink text, because amber now means risk only.

### 2. Type

- **One family: Instrument Sans** for all UI text and figures. Every number gets `font-variant-numeric: tabular-nums`. Measured: Instrument Sans ships `tnum`. At 40 px, "1111111111" and "0000000000" both measure 240 px with it, against 152 and 272 px without. All four products run one sans family for the UI.
- **IBM Plex Mono** only for label doses rendered verbatim, report IDs, coordinates, and model and prompt version strings.
- **Bricolage Grotesque** only for the wordmark and the landing page. Not in the Command Center.
- **Scale (size/line-height, weight):**

  | Role               | Size, weight          |
  | ------------------ | --------------------- |
  | Page title         | 24/32, 600            |
  | Drawer title       | 20/28, 600            |
  | Section title      | 15/20, 600            |
  | Body               | 14/20, 400            |
  | Row title          | 14/20, 500            |
  | Secondary and meta | 13/18, 400            |
  | Table header       | 13/18, 500, `#5C616A` |
  | Stat figure        | 28/32, 600, tabular   |
  | Stat label         | 13/18, 400            |
  | Nav and tabs       | 14/20, 500            |

- **Why these sizes.** All four use 14 px for body. Grafana and Stripe use 12 px for secondary text; Phytos uses 13 because the demo runs on a projector.
- **Case.** Sentence case for nav, tabs, headers, buttons and chips. No letter-spaced uppercase, except the fixed DEMO badge text.

### 3. Borders, colours and chips

- **Borders are allowed only on:** inputs and controls (1 px `#7D838C`); the bottom of the header bar (hairline); row dividers in tables of four or more columns (hairline, as Stripe does).
- **Drawers, popovers and toasts:** one shadow and no border, as in Grafana and OneSoil.
- **Never bordered:** list rows, rail items, stats, risk levels, section groups.
- **Group with space and weight instead:** 24 px between sections, 12 px between two-line rows, plus a section title.
- **Colour roles visible at once: 4 at most.** Ink (with its secondary grey), accent, amber, red. A screen with no risk on it shows two.
- **Chips: at most 1 per row** (Grafana 1, Stripe 1, Linear and OneSoil 0). The risk level is a dot and a word, not a chip. Extra reasons or labels collapse to a count ("2 more reasons"), the way Grafana shows "4 labels", and open on click.
- **Test.** Run the measurement script on any screen. It passes with 8 or fewer bordered boxes (each a control, the drawer or a popover), 3 or fewer non-neutral hue families, and 6 or fewer neutral clusters.

### 4. Progressive disclosure per view

| View                 | Default shows                                                                                                                                               | One click away                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map                  | District fills, report dots, cluster rings. A rail with the top 5 districts to watch: district, level dot and word, first factor. A stat strip of 3 figures | Legend ("Show legend", as OneSoil). Layers popover. Hover tooltip (district and level). "Show all districts". Outbreak drawer from a ring or district |
| Alerts drawer (bell) | High and Elevated alerts, grouped by level with counts                                                                                                      | "Show low (n)". Outbreak detail replaces the list, with "Back to alerts"                                                                              |
| Outbreak drawer      | Issue and district; level, class and the full uncertainty sentence; all contributing factors (invariant 2); report counts; next action                      | "Why this advice?" (sources, register check, model and prompt version). Reports list                                                                  |
| Observation drawer   | Photo, AI assessment band in words, status, camp, advice steps                                                                                              | "Why this advice?" evidence, full-size photo, officer history                                                                                         |
| Verification queue   | Two-line rows, oldest first: issue and crop with age; camp and AI band in words                                                                             | Observation drawer with Verify and Correct                                                                                                            |
| Outgrower View       | One group per field officer: first group open, others collapsed with a count. Rows: rank, farm, one reason phrase, time, View                               | Detail drawer with every reason. Camp and district level only (invariant 6)                                                                           |
| Knowledge sources    | Table: title, publisher, tier, date                                                                                                                         | Source drawer: excerpt and link                                                                                                                       |
| Scenario             | Toggle, three stats, top 10 ranked camps                                                                                                                    | "Assumptions (n)" expander, "Show all camps"                                                                                                          |

### 5. Loading

- **Skeletons, shaped like the final layout,** as in Grafana's Alert activity. Never a spinner inside content. Bars 14 px tall, 4 px radius, base `#EEF0F2`, highlight `#E3E6E9`, a 1.5 s ease-in-out sweep (static under reduced motion). Show them only after 250 ms (Stripe's 200 to 300 ms delay).
- **Shapes per view:**
  - rail: 5 rows of a 10 px dot and a 40% bar, over a 70% bar;
  - stat strip: 3 blocks, each a 56 x 28 px bar over a 96 x 13 px bar;
  - lists and queues: 6 two-line rows at their final height;
  - tables: the real header plus 8 rows of cell bars;
  - drawer: the header filled at once from the clicked row, then a section-title bar and three line bars;
  - map: district outlines drawn at once from the bundled SVG, with fills and dots fading in over 150 ms. No skeleton over the map.
- **Chrome first.** Header, tabs and filters render first and stay usable (Stripe: never wrap tabs in a loading state).
- **Pending buttons** keep their size, disable, and show words with an ellipsis ("Verifying…").
- **No layout shift.** Reserve space for any banner that may arrive late (Grafana's banner moved the list down 196 px).

### 6. Drawers

- **Size.** Right side, 480 px (min 400 px, max 40% of the viewport), so 960 px of map stays visible at 1440. For reference: Grafana 720 px, OneSoil 360 px.
- **Non-modal over the map.** Detail drawers have no scrim (Stripe's ContextView default). The map stays pannable and the selected feature is outlined in accent. The drawer covers the rail; the header and stat strip stay visible.
- **Header.** Title at 20/28 600, two lines at most. One meta line at 13 px secondary: class · level · age. Close button top right, 40 x 40, labelled "Close". At most two actions. The DemoBadge sits here whenever simulated rows show.
- **Scrolling.** The body scrolls; the header and the primary action bar stay fixed.
- **Focus.** On open, focus goes to the drawer heading. Esc closes, as in Grafana. Focus returns to the row or map feature that opened it.
- **Deep links.** The URL records the open drawer (`?outbreak=…`), as OneSoil records `?field=…`.
- **One drawer at a time.** Deeper detail opens inline as an expander, or replaces the drawer content with a "Back" link. Never a second drawer.
- **Blocking modal** only for the verify and correct form (Stripe's FocusView).

### 7. Alert row anatomy (Alerts drawer)

- **Line 1.** A 16 px level icon, the title "Fall armyworm · Chipata" at 14/20 500, and the age on the right at 13 px secondary.
  - The icon differs in shape as well as colour, as in Grafana: HIGH is a red filled circle with "!", ELEVATED an amber empty circle, LOW a grey dot (LOW appears only under "Show low").
- **Line 2, 13/18 secondary, joined with middle dots:**
  - the level word in its text token plus a duration ("High for 2 days", after Grafana's "Firing for 2h");
  - the class word: Weather advisory, Verified cluster or Model risk signal;
  - the short uncertainty form: "3 of 5 verified", "Forecast only" or "Not yet verified". The full `alertUncertainty` sentence is on hover and in the drawer.
- **Line 3.** The first contributing factor in secondary text. It wraps and is never cut off with an ellipsis.
- **Chips.** None in the normal case; one at most.
- **Look.** No dividers. 10 px vertical padding. Hover fills with `#F4F5F6`; the selected row adds a 2 px accent bar on the left.
- **Order.** Group headers "High · 2" and "Elevated · 3", as Linear's status bands with counts. Newest first inside each group.
- **Click.** Anywhere on the row opens the outbreak detail in the same drawer, with "Back to alerts". The map pans to the cluster and outlines it in accent. "5 reports" in the detail links straight to the reports section, as Grafana's "1 instance" links to Instances.
- **Bell.** The badge counts High and Elevated alerts not yet opened, as a white figure on ink.

## v2.1 (29 Oct, after Geoffrey's review of v2)

The v2 structure is the keeper. These four changes amend the decisions above; nothing else changed. After v2.1, work before the pitch is point-and-fix polish on this structure, with no further re-architecture.

- **Outgrower View: never empty on first paint** (amends decision 4).
  - "Camps needing attention" is open on load: the top 5 camps, then "Show all 21 camps".
  - Below it, one line per field officer: officer and district, visit count, the farm to visit first with its one reason, and View (the visit drawer).
  - "Prioritise field officers" still opens the full ranked lists, as in the runbook.
  - On phones the camps table keeps its first four columns.
- **Map: the projector view.**
  - The map takes about 70% of the screen height, at least 480 px. The map page may widen to 1760 px; the other pages keep 1320 px.
  - Report dots are twice the radius, and simulated dots are dark grey instead of light grey.
  - Risk fills are stronger, so they read from the back of a room: High `#C8612A`, Elevated `#E5B451`, outlines `#7A3109` and `#8F6511`.
  - A cluster is one ring with its report count inside. Where the 10 km circle is too small for the count, the ring becomes a white badge at a fixed size on screen. Badges that would overlap are nudged apart, as with Lusaka and Chongwe at the national view.
  - The region toggle stays.
- **Navigation: a slim icon rail** (after OneSoil).
  - The rail is 56 px wide on screens from 1024 px. The page name shows as a tooltip on hover and keyboard focus.
  - The current page has a filled icon (accent at 22%) and an accent bar on the rail's edge. The queue count is a badge on its icon.
  - Phones keep the labelled strip: touch has no hover.
- **Copy.**
  - The officer queue's routed list is headed "AI could not identify".
  - The publisher, year and country column on Knowledge sources is in the body sans, not mono.

**Post-event:** the map as a full canvas, with panels floating over it, is on the roadmap in `docs/hackathon-backlog.md`.

## Not observed

- **OneSoil.** The web app behind its login. Its UI comes from 2024 help-centre screenshots; its tokens come from the login page CSS. The app's loading states beyond the flat grey screen were not seen, and there is no live measurement of the light app.
- **Linear.** The app itself; there is no public workspace. The light theme comes from a blog screenshot and the site's CSS tokens. App loading states and accent use in the light app were not seen.
- **Stripe.** The real Dashboard is behind a login; the embedded payments component and the Stripe Apps docs stood in for it. Not observed: skeletons, the Home page live, and a right-side detail drawer in the full Dashboard (the embedded detail opened as a centred modal).
- **Grafana.** Pending and normal rows in the list view were not screenshotted on their own; their icon colours came from the state filter. Panel-level loading inside dashboards was not caught: the "Loading ..." text came before any panel drew.

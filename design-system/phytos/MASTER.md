# Phytos design system: "Field Signal"

The single source of truth for Phytos interfaces: the capture PWA (`apps/capture`) and the Command Center dashboard (`apps/web`). Tokens live in `packages/ui/theme` (CSS variables in `phytos.css` plus a Tailwind preset); this file says what they are for. The design language behind it is [philosophy.md](philosophy.md). Page overrides go in `pages/<page>.md`.

Replaces "Field Brief" (navy and copper, 28 Oct 2026) on 29 Oct 2026. Layouts were kept; colour, type and the density of lists changed. **Revised the same day (freeze-2026-10-29b):** mono caps restricted to kickers, chips and stat labels; chrome and lists after [patterns.md](patterns.md).

> **The Command Center no longer follows this file (29 Oct, dashboard v2).** Its structure and visual language come from [patterns-v2.md](patterns-v2.md) (OneSoil, Linear, Stripe, Grafana): progressive disclosure with drawers, a neutral white console (`theme-console` in `packages/ui/theme/phytos.css`) with one blue accent `#2160C4`, amber and red-gold for risk only, Instrument Sans at a 14 px body, borders only on controls. This file still governs the **capture app** (day exposure) and the shared tokens. The dashboard sections below record the Field Signal console for history.

## 1. Concept

Phytos is a **monitoring station after dark**: the land is unlit, and every point of light is a fact someone checked. One identity in two exposures:

- **Night** (`exposure-night` on `<html>`): dark moss ground, panels a step lighter, hairlines instead of shadows. Kept for documents and dark slides; **no app uses it since 29 Oct**, because projectors wash it out.
- **Day** (the default, both apps): bone-light ground with the same three signals, for farmers in direct sun and for the Command Center on a hotel projector.

Three lights are allowed on the ground, each with one job:

- **Chartreuse** (`#C9E265`) is life and action: the primary action, the one loudest element per view, and what an officer has verified. As small text on the day ground it becomes **deep leaf**.
- **Gold** (`#D9A441`) is attention: Elevated, model and forecast signals, warnings, the second line of a thought.
- **Sage** (`#7D9184`) murmurs the secondary labels.

High risk is the one deeper amber (red-gold); no other hue enters.

## 2. Principles

1. **Evidence before conclusion.** Show what a signal rests on (reports, sources, weather, rules) next to the signal. A level never appears without its contributing factors (CLAUDE.md invariant 2).
2. **Say how sure, in words.** AI confidence is a band in words ("AI assessment: high confidence"), never a number or the word "probability" (invariant 3). Unverified things look unverified: dashed outlines mean modelled or forecast; solid chartreuse means verified by an officer.
3. **One loud thing per view.** A single chartreuse fill per screen: the primary action. Chartreuse is also the active-nav bar, and nothing else: never selection, links or chips (patterns.md rule 12). Until an action can run, its button stays quiet too.
4. **Sunlight on the phone, projector on the console.** Capture body text ≥ 7:1, actions ≥ 4.5:1, body never below 17 px. The Command Center is light too: on a projector, contrast survives on a light ground and dies on a dark one.
5. **Density without chip soup.** A row is at most two lines (the name, then one secondary line joined with middle dots) and carries at most two chips; status is a coloured dot and a word; text wraps, never ends in "…" in a panel we present (patterns.md rules 7 to 10).
6. **Grounded language.** It is a prototype, not a platform. Signals are "prototype signals"; models "assess", officers "verify".
7. **No auto-learning claims.** Officer-verified observations are evaluation data: "every correction becomes a test case". Never say the model learns or improves from corrections.
8. **Cheap on data.** Fonts are self-hosted and precached; no remote images or map tiles; photos are resized before upload.

## 3. Colour

Computed WCAG ratios. Text never uses a token below 4.5:1 on its ground; controls never below 3:1.

| Token               | Night     | Day       | Use                                          | Contrast (night · day)                     |
| ------------------- | --------- | --------- | -------------------------------------------- | ------------------------------------------ |
| `--ground`          | `#0E1613` | `#F0EDE2` | Page                                         | (base)                                     |
| `--panel`           | `#141F1A` | `#FAF8F1` | Panels, cards, inputs                        | (base)                                     |
| `--well`            | `#1B2922` | `#E7E3D5` | Hover, selected row, inset                   | fg on it 12.5 · 12.4                       |
| `--fg`              | `#EDE9DD` | `#1A2420` | All reading text                             | 15.1 / 13.9 on panel · 13.6 / 15.0         |
| `--fg-2`            | `#7D9184` | `#55675B` | Secondary labels, kickers                    | 5.5 on ground, 5.0 on panel · 5.2 / 5.7    |
| `--signal`          | `#C9E265` | `#C9E265` | Primary action fill, the loud figure (night) | `--signal-ink` on it 12.7                  |
| `--signal-text`     | `#C9E265` | `#4E6A14` | Verified, "visit first", advice ready (text) | 12.7 · 5.3 on ground, 5.8 on panel         |
| `--leaf`            | `#C9E265` | `#5F7F1C` | Rails, markers, focus ring (non-text)        | · 4.0 on ground (UI only)                  |
| `--attention`       | `#D9A441` | `#D9A441` | Gold borders, bars, Elevated glow            | 8.2 on ground · borders only               |
| `--attention-text`  | `#D9A441` | `#7E5B10` | Gold as text                                 | 8.2 · 5.3                                  |
| `--attention-tint`  | `#2A2616` | `#F3E6C6` | Elevated block, officer referral, DEMO badge | attention-text on it 6.7 · 5.0             |
| `--high`            | `#E07B39` | `#B4521C` | High fill                                    | `--high-ink` on it 6.2 · 4.7               |
| `--high-text`       | `#E8873F` | `#9A4515` | Severe, High district (text)                 | 6.4 on panel · 5.5 on ground               |
| `--hairline`        | `#2A382F` | `#D6D1C2` | Rules, card borders (decorative only)        | never the only cue                         |
| `--hairline-strong` | `#5C7064` | `#857F6E` | Input and control borders                    | 3.2 on panel · 3.8 on panel                |
| `--chip`            | `#1B2922` | `#0E1613` | The wordmark chip                            | `--chip-fg` (chartreuse) on it 10.5 · 12.7 |

Never chartreuse, gold or sage as small text on the day ground (1.2 to 2.9:1): use `--signal-text`, `--attention-text` and `--fg-2`.

### Signal levels (Risk Model v0)

| Level    | Chip                                       | Map (night)                         | Word (capture) |
| -------- | ------------------------------------------ | ----------------------------------- | -------------- |
| HIGH     | `--high` fill, `--high-ink` text           | red-gold fill at 45%, red-gold glow | Act now        |
| ELEVATED | `--attention-tint`, gold border, gold text | gold fill at 28%, gold glow         | Watch          |
| LOW      | hairline-strong outline, `--fg-2` text     | a step above unlit land, no glow    | Low            |

### Alert classes

Every alert carries one class chip, its level and its factors, plus its uncertainty wording (`alertUncertainty`):

| Class                      | Chip                                     | Uncertainty line                                                   | Row short form     |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| **Weather advisory**       | dashed hairline-strong, sage, cloud icon | "Forecast conditions only. No report confirms this."               | `FORECAST ONLY`    |
| **Verified cluster alert** | solid chartreuse (leaf by day), badge    | "N of M reports verified by an officer; the rest are AI-assessed." | `N OF M VERIFIED`  |
| **Model risk signal**      | dashed gold, activity icon               | "Prototype signal from AI-assessed reports. Not yet verified."     | `NOT YET VERIFIED` |

In one-line alert rows the short form shows and the full sentence is on hover; the outbreak detail and the capture app show the full sentence.

## 4. Type

| Role         | Family                         | Use                                                                                                                                                                                                                        |
| ------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Headline** | Bricolage Grotesque (variable) | The wordmark, screen titles, panel titles, issue names, figures. 600 to 800. No serif anywhere.                                                                                                                            |
| **Readout**  | IBM Plex Mono (400, 500, 600)  | Mono caps **only** on kickers (the `.eyebrow` above a title), chips and stat labels. Mono in sentence case for ids, dates and doses. Nav, table headers, form labels, buttons and body are Instrument Sans, sentence case. |
| **Body**     | Instrument Sans (variable)     | Everything people read: advice steps, factors, notes. 400 to 600, open leading.                                                                                                                                            |

Scale (px, line-height): `stat` 40/40 · `display-xl` 36/40 (dashboard titles) · `display` 28/32 (capture titles: one step down from the Field Brief) · `title` 21/28 · `body` 18/27 (capture) · `body-sm` 16/24 (dashboard) · `label` 15/20 · `caption` 13/18 · `eyebrow` 12/16 (Mono, uppercase, +0.12em) · `data` 15/22 (Mono).

## 5. Shape and depth

- **Radius:** 4 px cards, panels, buttons and inputs; 2 px chips. No pills except status dots.
- **Borders:** 1 px `--hairline` on panels; 1 to 1.5 px `--hairline-strong` on inputs; a 2 px chartreuse rail on the current page in the dashboard navigation.
- **Depth:** flat, edges drawn with hairlines. One elevation, `--raise`, only for things floating above the page (map tooltips, menus).
- **Light:** nothing glows. Risk on the map is carried by fill and outline, so it reads on a projector and in greyscale.
- **Texture:** none, except the diagonal hatch that marks simulated data (the DEMO badge).

## 6. Components

Capture (day exposure, same layouts as the Field Brief):

- **App header:** the ground with a hairline below; the wordmark `PHYTOS` in Bricolage 800, +0.16em, chartreuse on the dark chip (as on the pitch PDF); the district in Mono on the right.
- **Case card:** panel, hairline border, Mono kicker row (`REPORT 7F3K · 23 OCT`), ruled field rows, status tag top right.
- **Status tag:** Mono uppercase in a 1.5 px border. SENT and ASSESSING (ink outline; assessing has the three-dot wait), WITH AN OFFICER (gold tint), ADVICE READY (leaf border on the signal tint).
- **Guidance ladder:** a 2 px leaf rail with square numbered markers, chemicals always last and labelled `CHEMICALS`: each product that passed the register check with its dose verbatim in Mono (`Label dose` from a label; `Dose (from the guide)` and `Source: Plantwise Zambia PMDG` from a PMDG, never its internal id as a registration number), or the officer referral on a gold-tint block.
- **Action bar:** fixed bottom, the ground with a hairline above, one primary button, 56 px: chartreuse with dark text, Bricolage 700. Quiet (well, sage text) until the action can run.
- **Camera:** the app opens on a live rear-camera viewfinder (4:3) with a round chartreuse shutter and "Gallery"; the file picker is the fallback when the camera is unavailable.
- **Crop chips, location row, inputs:** panel with a hairline-strong border; the selected chip is ink with ground text.
- **Demo badge:** `DEMO DATA · SIMULATED` in Mono on the gold tint with the hatch and a gold border, whenever a simulated row is on screen (invariant 5).

Dashboard (Field Signal, superseded by patterns-v2.md on 29 Oct):

- **Shell:** a panel-coloured top bar with a hairline below. Left: the wordmark chip, "Command Center", a small `PROTOTYPE` badge. Right: the verified-observations chip (leaf dot, Bricolage count, "verified observations") and a round initials avatar that opens the account menu (email, role, sign out). **No email in the chrome.** Sidebar on the ground, icon plus sentence-case label; the current page has a 3 px chartreuse bar and the signal tint; counts are quiet grey badges. Content sits at a maximum of 1320 px.
- **Figures:** the pitch-PDF stat row: a hairline above, then each figure as a Bricolage 40 px number in deep leaf with a two-line small label beside it that reads on from the number ("408 reports in the last 14 days"). No boxes.
- **Map:** district boundaries as SVG (no tiles) on a pale paper basemap with moss outlines; Elevated in gold, High in amber, each with a darker outline in its own hue; reports as dark dots, simulated reports as smaller sage dots; clusters as deep-leaf 10 km rings with the count above; the selected district outlined in deep leaf, and its row tinted in Districts to watch (two-way selection). Legend always visible, attached under the map. The side panel is 360 px on the right.
- **Alert rows:** class chip, level chip, issue · district, the first factor in full (wrapped), the short uncertainty form, age, Detail.
- **Districts to watch:** two lines each: the district and its level chip, then the full first factor.
- **Visit lists:** two lines per farm. Line 1: farm label, the priority chip, at most one reason chip (`CLUSTER`, else `AWAITING REVIEW`), age. Line 2: camp · crop · issue, severity as a coloured dot and a word, then every other reason in words ("Chipata at High"). In tables, a level is a dot and a word, never a filled pill.
- **Evidence panel:** retrieved sources with tiers, the register check (passed products, rejected candidates and why), escalation status, model and prompt version. Confidence in words only.
- **Tables:** hairline rows, sentence-case Instrument Sans headers, no zebra striping.

## 7. Icons

Lucide only, stroke 2, 14 to 24 px. Never emoji. Every icon has a text label beside it or an `aria-label`.

## 8. Motion

150 to 200 ms, `cubic-bezier(.2,.8,.2,1)`. Two moments: a status tag or the verified count arriving, and guidance steps revealing top-down (60 ms apart). Waiting uses a three-dot ellipsis with words, never a bare spinner. Reduced motion is respected.

## 9. Voice

Short, plain English, second person on the phone ("Take a photo of the damaged leaf"), third person on the dashboard ("5 reports within 10 km in 72 hours"). Name the source ("From Zambian and FAO guides", "Weather: Open-Meteo"). **No em dashes in any UI copy**: use a colon, a full stop or a middle dot. Never "probability", never a percentage of confidence or risk, never a dose that did not come from a label or the named guide, never a claim that the model learns from corrections.

## 10. Anti-patterns

- Warm cream and soft copper (the generic look this replaced); agritech emerald gradients, leaf illustrations, stock farmers.
- More than one chartreuse fill on a screen; chartreuse as decoration; glow anywhere.
- Sentences repeated on every row of a list (use chips; keep the sentence for hover and detail).
- Serif headings; mono caps on nav, table headers, form labels, buttons or body (it reads as a template); truncated text in a presented panel; an email address in the chrome.
- "Platform", "revolutionary", "predicts outbreaks", "AI-powered" as decoration.
- Spinners with no words; percentages anywhere near the AI; a level without factors.
- Map tiles or remote images (hotel wifi and 4G).

## 11. Checks before shipping a screen

Text ≥ 4.5:1 and controls ≥ 3:1 (use only tokens) · one chartreuse fill per view · mono caps only on kickers, chips and stat labels · no row over two lines or two chips · no `truncate` in a presented panel · no email in the chrome · spacing on the 8 px grid · touch targets ≥ 48 px on the phone (primary 56) · visible focus ring (leaf by day, chartreuse by night) · labels on every icon · readable at 360 px with no horizontal page scroll · DEMO badge whenever a sim row shows · no confidence numbers and no em dash in any rendered string.

## References

- [philosophy.md](philosophy.md): Field Signal, the Phytos design language.
- [patterns.md](patterns.md): header, nav, map and panel, list density; what Phytos takes from six products.
- GSMA, [AgriTech UX Design Guidebook](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2025/10/AgriTech-UX-Design-Guidebook.pdf) (2025): recognisable patterns, short text.
- Google, [Android colour contrast](https://support.google.com/accessibility/android/answer/7158390): contrast for extreme lighting.
- Bricolage Grotesque, IBM Plex Mono, Instrument Sans: SIL Open Font License, self-hosted via Fontsource.

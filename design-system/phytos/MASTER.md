# Phytos design system: "Field Signal"

The single source of truth for Phytos interfaces: the capture PWA (`apps/capture`) and the Command Center dashboard (`apps/web`). Tokens live in `packages/ui/theme` (CSS variables in `phytos.css` plus a Tailwind preset); this file says what they are for. The design language behind it is [philosophy.md](philosophy.md). Page overrides go in `pages/<page>.md`.

Replaces "Field Brief" (navy and copper, 28 Oct 2026) on 29 Oct 2026. Layouts were kept; colour, type and the density of lists changed.

## 1. Concept

Phytos is a **monitoring station after dark**: the land is unlit, and every point of light is a fact someone checked. One identity in two exposures:

- **Night** (the Command Center, `exposure-night` on `<html>`): dark moss ground, panels a step lighter, hairlines instead of shadows. For people who watch the whole country, on a laptop or a projector.
- **Day** (the capture app, the default): bone-light ground with the same three signals, for farmers and officers standing in direct sun.

Three lights are allowed on the ground, each with one job:

- **Chartreuse** (`#C9E265`) is life and action: the primary action, the one loudest element per view, and what an officer has verified. As small text on the day ground it becomes **deep leaf**.
- **Gold** (`#D9A441`) is attention: Elevated, model and forecast signals, warnings, the second line of a thought.
- **Sage** (`#7D9184`) murmurs the secondary labels.

High risk is the one deeper amber (red-gold); no other hue enters.

## 2. Principles

1. **Evidence before conclusion.** Show what a signal rests on (reports, sources, weather, rules) next to the signal. A level never appears without its contributing factors (CLAUDE.md invariant 2).
2. **Say how sure, in words.** AI confidence is a band in words ("AI assessment: high confidence"), never a number or the word "probability" (invariant 3). Unverified things look unverified: dashed outlines mean modelled or forecast; solid chartreuse means verified by an officer.
3. **One loud thing per view.** A single chartreuse fill per screen: the primary action, or the one figure that matters. Everything else stays quiet. Until an action can run, its button stays quiet too.
4. **Sunlight on the phone, projector on the console.** Capture body text ≥ 7:1, actions ≥ 4.5:1, body never below 17 px. The dashboard keeps body text ≥ 12:1 on its panels so a washed-out projector still reads.
5. **Density without sentences.** Lists are rows: chips for reasons, one line of text, the full sentence on hover or in the detail view.
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

| Role         | Family                         | Use                                                                                                                                                 |
| ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Headline** | Bricolage Grotesque (variable) | The wordmark, screen titles, panel titles, issue names, figures. 600 to 800. No serif anywhere.                                                     |
| **Readout**  | IBM Plex Mono (400, 500, 600)  | Every label, kicker, stat label, status, chip, date, id and dose. Uppercase and letterspaced (+0.12em) for labels; sentence case for doses and ids. |
| **Body**     | Instrument Sans (variable)     | Everything people read: advice steps, factors, notes. 400 to 600, open leading.                                                                     |

Scale (px, line-height): `stat` 40/40 · `display-xl` 36/40 (dashboard titles) · `display` 28/32 (capture titles: one step down from the Field Brief) · `title` 21/28 · `body` 18/27 (capture) · `body-sm` 16/24 (dashboard) · `label` 15/20 · `caption` 13/18 · `eyebrow` 12/16 (Mono, uppercase, +0.12em) · `data` 15/22 (Mono).

## 5. Shape and depth

- **Radius:** 4 px cards, panels, buttons and inputs; 2 px chips. No pills except status dots.
- **Borders:** 1 px `--hairline` on panels; 1 to 1.5 px `--hairline-strong` on inputs; a 2 px chartreuse rail on the current page in the dashboard navigation.
- **Depth:** flat, edges drawn with hairlines. One elevation, `--raise`, only for things floating above the page (map tooltips, menus).
- **Light:** on the night map only, Elevated and High districts glow (a blurred copy under the fill) and real reports are points of light. Nothing else glows.
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

Dashboard (night exposure):

- **Shell:** the ground with a hairline below the top bar: wordmark chip, `COMMAND CENTER` and the `PROTOTYPE` tag in Mono, the live verified counter (the number in chartreuse: a verified fact is what the console lights up), the account. Left rail of pages in Mono; the current page has the chartreuse rail.
- **Figures:** a strip of four on hairline dividers; the number in Bricolage 40 px, the label in Mono. One figure per view carries the chartreuse (the active clusters on the map, verified reports on the outbreak and Outgrower views, documents in retrieval on Knowledge sources).
- **Map:** district boundaries as SVG (no tiles) on unlit land; Elevated and High glow; real reports are bone points of light, simulated reports smaller sage dots; clusters are chartreuse 10 km rings with the count above. Legend always visible.
- **Alert rows:** one line each, table-like: class chip, level chip, issue · district, the first factor (truncated), the short uncertainty form, age, `DETAIL`.
- **Districts to watch:** one line each: level chip, district, the first factor.
- **Visit lists:** one line per farm (rank, priority chip, farm label, camp · crop · issue, age) and reason chips beneath: `CLUSTER`, `SEVERE`, `MODERATE`, `AWAITING REVIEW`, `HIGH DISTRICT`.
- **Evidence panel:** retrieved sources with tiers, the register check (passed products, rejected candidates and why), escalation status, model and prompt version. Confidence in words only.
- **Tables:** hairline rows, Mono headers, no zebra striping.

## 7. Icons

Lucide only, stroke 2, 14 to 24 px. Never emoji. Every icon has a text label beside it or an `aria-label`.

## 8. Motion

150 to 200 ms, `cubic-bezier(.2,.8,.2,1)`. Two moments: a status tag or the verified count arriving, and guidance steps revealing top-down (60 ms apart). Waiting uses a three-dot ellipsis with words, never a bare spinner. Reduced motion is respected.

## 9. Voice

Short, plain English, second person on the phone ("Take a photo of the damaged leaf"), third person on the dashboard ("5 reports within 10 km in 72 hours"). Name the source ("From Zambian and FAO guides", "Weather: Open-Meteo"). **No em dashes in any UI copy**: use a colon, a full stop or a middle dot. Never "probability", never a percentage of confidence or risk, never a dose that did not come from a label or the named guide, never a claim that the model learns from corrections.

## 10. Anti-patterns

- Warm cream and soft copper (the generic look this replaced); agritech emerald gradients, leaf illustrations, stock farmers.
- More than one chartreuse fill on a screen; chartreuse as decoration; glow anywhere but the map.
- Sentences repeated on every row of a list (use chips; keep the sentence for hover and detail).
- Serif headings; labels in body type where a Mono readout belongs.
- "Platform", "revolutionary", "predicts outbreaks", "AI-powered" as decoration.
- Spinners with no words; percentages anywhere near the AI; a level without factors.
- Map tiles or remote images (hotel wifi and 4G).

## 11. Checks before shipping a screen

Text ≥ 4.5:1 and controls ≥ 3:1 (use only tokens) · one chartreuse fill per view · touch targets ≥ 48 px on the phone (primary 56) · visible focus ring (leaf by day, chartreuse by night) · labels on every icon · readable at 360 px with no horizontal page scroll · DEMO badge whenever a sim row shows · no confidence numbers and no em dash in any rendered string.

## References

- [philosophy.md](philosophy.md): Field Signal, the Phytos design language.
- GSMA, [AgriTech UX Design Guidebook](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2025/10/AgriTech-UX-Design-Guidebook.pdf) (2025): recognisable patterns, short text.
- Google, [Android colour contrast](https://support.google.com/accessibility/android/answer/7158390): contrast for extreme lighting.
- Bricolage Grotesque, IBM Plex Mono, Instrument Sans: SIL Open Font License, self-hosted via Fontsource.

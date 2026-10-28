# Phytos design system: "Field Brief"

The single source of truth for Phytos interfaces: the capture PWA (`apps/capture`), the Command Center dashboard (`apps/web`) and the landing page. Tokens live in `packages/ui/theme` (CSS variables in `phytos.css` plus a Tailwind preset); this file says what they are for. Page overrides go in `pages/<page>.md`.

Replaces "Field Slip" (26 Oct 2026). Layouts were kept; colour, type, shape and voice changed.

## 1. Concept

Phytos is a **field intelligence brief**: the calm, exact document an analyst hands an extension officer. Every report is a case file with evidence attached; every signal says what it is based on and how sure it is. The tone is a serious prototype: precise, sourced, never louder than the evidence.

- **Paper** is the ground: warm, low glare, printable.
- **Navy** carries structure and the primary action: the header, headings, primary buttons, selected states.
- **Copper** is the analyst's marker: the one accent, used for attention (HIGH and ELEVATED), the focus ring and the active item. Never decoration.
- **Muted green** is for guidance only: advice ready, the IPM ladder rail, "what to do". It never signals risk.

## 2. Principles

1. **Evidence before conclusion.** Show what a signal rests on (reports, sources, weather, rules) next to the signal. A level never appears without its contributing factors (CLAUDE.md invariant 2).
2. **Say how sure, in words.** AI confidence is a band in words ("AI assessment: high confidence"), never a number or the word "probability" (invariant 3). Unverified things look unverified: dashed outlines mean modelled or unconfirmed; solid means verified.
3. **Sunlight first on the phone.** Capture: body text ≥ 7:1, actions ≥ 5:1, body never below 17 px, no light weights. The dashboard keeps the same palette at desktop sizes (body 16 px) for projectors.
4. **One primary action per screen.** Navy, full width at thumb height on the phone.
5. **Grounded language.** It is a prototype, not a platform. No "revolutionary", "AI-powered platform", "predicts". Signals are "prototype signals"; models "assess", officers "verify".
6. **No auto-learning claims.** Officer-verified observations are evaluation data: "every correction becomes a test case". Never say the model learns or improves from corrections.
7. **Cheap on data.** Fonts are self-hosted and precached; no remote images or map tiles; photos are resized before upload.

## 3. Colour

Paper about 70%, navy and ink for structure about 25%, copper under 5%. Six base colours were given; the derived shades exist only to keep text readable (computed WCAG ratios below).

| Token            | Hex       | Use                                                    | Contrast                          |
| ---------------- | --------- | ------------------------------------------------------ | --------------------------------- |
| `--paper`        | `#FAF6EF` | Background                                             | (base)                            |
| `--sheet`        | `#FFFDF9` | Cards, inputs, panels                                  | (base)                            |
| `--navy`         | `#13293D` | Header, headings, primary buttons, selected            | 13.8:1 on paper; white on it 14.9 |
| `--navy-2`       | `#2C4A66` | Primary hover, secondary navy                          | white on it 9.2:1                 |
| `--navy-tint`    | `#E6EBF0` | Selected rows, info blocks, weather advisory tag       | navy on it 12.4:1                 |
| `--copper`       | `#B4642A` | Accent: focus ring, active marker, borders, large type | 4.1:1 on paper: never small text  |
| `--copper-deep`  | `#8F4519` | Copper text; HIGH fill (white text); errors            | 6.4:1 on paper; white on it 6.9   |
| `--copper-light` | `#E0A06A` | Copper on navy only (wordmark mark, header accents)    | 6.7:1 on navy                     |
| `--copper-tint`  | `#F4E6D8` | ELEVATED block, attention block, DEMO badge            | ink on it 10.9; copper-deep 5.7   |
| `--green`        | `#4F6F52` | Guidance only: advice rail, "advice ready"             | 5.2:1 on paper; white on it 5.6   |
| `--green-deep`   | `#3E5A41` | Guidance text                                          | 7.1:1 on paper                    |
| `--green-tint`   | `#E6ECE3` | Guidance block                                         | green-deep on it 6.4; ink 11.1    |
| `--ink`          | `#2B3036` | Body text                                              | 12.4:1 on paper                   |
| `--ink-2`        | `#4A5058` | Secondary text (never lighter)                         | 7.6:1 on paper; 8.0 on sheet      |
| `--line`         | `#D8D2C4` | Rules and card borders (decorative only)               | 1.4:1: never the only cue         |
| `--line-strong`  | `#8A8478` | Input and control borders                              | 3.7:1 on sheet (UI component)     |

Fixed pairs: white on navy, navy-2, copper-deep and green; navy or ink on the tints; copper-light only on navy. Never copper (`#B4642A`) as text under 24 px.

### Signal levels (Risk Model v0)

| Level    | Block                                  | Word (capture) |
| -------- | -------------------------------------- | -------------- |
| HIGH     | `--copper-deep` fill, white text       | Act now        |
| ELEVATED | `--copper-tint` fill, copper-deep word | Watch          |
| LOW      | `--sheet` with `--line` border         | Low            |

### Alert classes

Every alert carries one class label, its level and its factors, plus one line of uncertainty wording:

| Class                      | Tag                                 | Based on                                                          | Uncertainty line                                                   |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Weather advisory**       | navy-tint, cloud icon               | Open-Meteo forecast × issue weather notes from the guides         | "Forecast conditions only. No report confirms this."               |
| **Verified cluster alert** | navy solid, check badge icon        | The cluster rule, with at least one report verified by an officer | "N of M reports verified by an officer; the rest are AI-assessed." |
| **Model risk signal**      | dashed ink-2 outline, activity icon | Risk Model v0 rules over AI-assessed reports                      | "Prototype signal from AI-assessed reports. Not yet verified."     |

## 4. Type

| Role        | Family                                | Use                                                                                    |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| **Display** | Source Serif 4 (variable)             | The wordmark, screen titles, issue names, key numbers. 600–700. Sentence case.         |
| **Body**    | Atkinson Hyperlegible Next (variable) | Everything people read. Built so look-alike characters differ in glare. 400, 600, 800. |
| **Data**    | Atkinson Hyperlegible Mono            | Report numbers, dates, districts, registration numbers, label doses, eyebrows.         |

Scale (px, line-height): `display-xl` 36/40 · `display` 28/32 · `title` 21/28 (Body 800) · `body` 18/27 (capture) · `body-sm` 16/24 (dashboard) · `label` 15/20 (Body 600) · `caption` 13/18 · `eyebrow` 12/16 (Mono 600, uppercase, +0.08em) · `data` 15/22 (Mono 500).

## 5. Shape and depth

- **Radius:** 4 px cards, panels, buttons and inputs; 2 px tags. No pills except status dots.
- **Borders:** 1 px `--line` on cards; 1.5 px `--line-strong` on inputs; 2 px navy on the selected item.
- **Depth:** flat. One soft elevation, `--raise`, only for things floating above the page (map tooltips, menus). No shadows on cards.
- **Texture:** none. Simulated data is marked by a diagonal hatch (the DEMO badge, sim markers on the map).

## 6. Components

Capture (same layouts as Field Slip):

- **App header:** navy strip, 56 px; the wordmark `PHYTOS` in Source Serif 4 600 with +0.14em tracking and a copper-light marker dot; the district in Mono on the right.
- **Case card** (was the field slip): sheet, 1 px line border, eyebrow row (`REPORT 7F3K · 23 OCT`), ruled field rows (`CROP · Tomato`), status tag top right.
- **Status tag** (was the stamp): Mono uppercase in a 1.5 px border, square corners, no rotation. SENT and ASSESSING (ink outline; assessing has the three-dot wait), WITH AN OFFICER (copper-tint block), ADVICE READY (green block, white text). A new status fades in once (180 ms).
- **Guidance ladder:** a 2 px green rail with square numbered markers, one step per rung, chemicals always last and labelled `CHEMICALS`: a registered product with its label dose verbatim in Mono, or the officer referral on a copper-tint block.
- **Sources:** a ruled list: title, then the tier in Mono (`MINISTRY OF AGRICULTURE`, `ZARI`, `FAO`, `CABI PLANTWISE`, `RESEARCH`).
- **Alert card:** class tag, level block, issue in Source Serif, district, factors as a list, and the uncertainty line in ink-2.
- **Action bar** (was the thumb bar): fixed bottom, paper with a top line, one navy primary button, 56 px.
- **Camera:** the app opens on a live rear-camera viewfinder (4:3, 4 px radius) with a round navy shutter and "Choose from gallery"; the file picker is the fallback when the camera is unavailable.
- **Crop chips, location row, inputs:** sheet with a 1.5 px line-strong border; selected chip is navy with white text.
- **Demo badge:** `DEMO DATA · SIMULATED` in Mono on copper-tint with a diagonal hatch and a copper-deep 1 px border, whenever a simulated row is on screen (invariant 5).

Dashboard:

- **Shell:** navy top bar (wordmark, "Prototype" tag, live verified counter, demo badge, account); left rail of pages; content on paper.
- **Map:** district boundaries drawn as an SVG (no tiles), districts filled by risk level, report dots (navy; hatched ring when simulated), clusters as copper 10 km rings. Legend always visible.
- **Panels:** sheet cards with an eyebrow, a serif title and ruled rows. Numbers that matter in Source Serif.
- **Evidence panel:** retrieved sources with tiers, the regulatory check (passed products, rejected candidates and why), escalation status, model and prompt version. Confidence in words only.
- **Tables:** 1 px line rows, Mono for ids and dates, no zebra striping.

## 7. Icons

Lucide only, stroke 2, 20–24 px. Never emoji. Every icon has a text label beside it or an `aria-label`.

## 8. Motion

150–200 ms, `cubic-bezier(.2,.8,.2,1)`. Two moments: a status tag fading in, and guidance steps revealing top-down (60 ms apart). Waiting uses a three-dot ellipsis with words, never a bare spinner. Everything non-essential sits behind `prefers-reduced-motion: no-preference`.

## 9. Voice

Short, plain English, second person on the phone ("Take a photo of the damaged leaf"), third person on the dashboard ("5 reports within 10 km in 72 hours"). Name the source ("From Zambian and FAO guides", "Weather: Open-Meteo"). **No em dashes in any UI copy**: use a colon, a full stop or a middle dot. Never "probability", never a percentage of confidence or risk, never a dose that did not come from a registered label, never a claim that the model learns from corrections.

## 10. Anti-patterns

- Agritech emerald gradients, leaf illustrations, stock farmers.
- "Platform", "revolutionary", "predicts outbreaks", "AI-powered" as decoration.
- Copper as small text or as decoration; more than one copper element competing on a screen.
- Spinners with no words; percentages anywhere near the AI; a level without factors.
- Map tiles or remote images (hotel wifi and 4G).

## 11. Checks before shipping a screen

Capture body ≥ 7:1 and actions ≥ 5:1 (use only tokens) · touch targets ≥ 48 px (primary 56) · visible 3 px copper focus ring · labels on every icon · readable at 360 px wide with no horizontal scroll · `prefers-reduced-motion` respected · DEMO badge whenever a sim row shows · no confidence numbers in any rendered string · no em dash in any rendered string.

## References

- GSMA, [AgriTech UX Design Guidebook](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2025/10/AgriTech-UX-Design-Guidebook.pdf) (2025): recognisable patterns, short text.
- Google, [Android colour contrast](https://support.google.com/accessibility/android/answer/7158390): contrast for extreme lighting.
- Braille Institute, [Atkinson Hyperlegible](https://en.wikipedia.org/wiki/Atkinson_Hyperlegible) (Next, 2025).
- Adobe, [Source Serif 4](https://github.com/adobe-fonts/source-serif) (SIL Open Font License).

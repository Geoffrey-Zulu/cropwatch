# CropWatch design system: "Field Slip"

The single source of truth for CropWatch interfaces: the capture PWA (`apps/capture`) now and the Command Center dashboard (`apps/web`) next. Tokens live in `packages/ui/theme` (CSS variables plus a Tailwind preset); this file says what they are for. Page overrides go in `pages/<page>.md`.

## 1. Concept

A farmer's report is a **specimen**, and CropWatch treats it like one: every report is a **field slip**, a ruled paper tag with the crop, the place and the date written on it, stamped as it moves through the system (**SENT → ASSESSED → ADVICE READY**, or **WITH AN OFFICER**). Advice is a **ladder** you climb from the bottom: look first, then field practice, then natural control, and chemicals last, through an officer.

Three local sources shape it, all chosen because they already work outdoors in Zambia:

- **Hand-painted shop signs** (Lusaka's sign painters): flat blocks of strong colour, heavy letters, a hard black drop shadow, readable from across a dusty road in full sun.
- **Stencilled grain sacks** (maize and maize-meal bags): condensed stencil capitals for the few words that must be seen first.
- **Specimen and herbarium labels**: ruled fields (crop, place, date, collector), a tag notch, and rubber stamps for status. Dense facts in a fixed place, so people learn where to look.

The palette comes from the **miombo woodland** in October, the hackathon month: the copper-red flush of new msasa leaves, dry-season straw, laterite soil, and charcoal. It is deliberately not "agritech emerald": green appears only as the signal for "advice ready".

## 2. Principles

1. **Sunlight first.** Light theme only. Body text ≥ 7:1 (AAA), actions ≥ 5:1. No light or thin weights; nothing that relies on a hairline or a pale grey to be read.
2. **Shapes before words.** Status is a stamp, alert level is a coloured board, the advice is a ladder. A farmer who skips the text still knows where they are.
3. **One thing per screen, at thumb height.** The primary action sits in the bottom bar, 56 px tall, full width.
4. **Honest states.** Every wait says what it is waiting for ("Looking at your photo", "Finding advice from Zambian guides"). AI confidence appears only as words ("AI assessment: high confidence"), never as a number or the word "probability" (CLAUDE.md invariants 2 and 3).
5. **Cheap on data.** Fonts are self-hosted and precached once; no remote images; photos are resized before upload. Nothing decorative is downloaded.

## 3. Colour

Dominant **paper** (about 70%), **ink** and **signboard** for structure (about 20%), **copper** as the single action accent (under 10%). Signal colours appear only as status blocks, never as decoration.

| Token             | Hex       | Use                                           | Contrast                        |
| ----------------- | --------- | --------------------------------------------- | ------------------------------- |
| `--paper`         | `#F5F0E6` | App background (warm, lower glare than white) | —                               |
| `--slip`          | `#FFFCF5` | Slips, cards, inputs                          | —                               |
| `--ink`           | `#17130F` | Text, borders, hard shadows                   | 16.3:1 on paper                 |
| `--ink-2`         | `#4A4238` | Secondary text (never lighter)                | 8.7:1 on paper                  |
| `--rule`          | `#D9CFBD` | Ruled lines on slips (decorative only)        | —                               |
| `--signboard`     | `#17130F` | Header board, bottom bar                      | paper on it 16.3:1              |
| `--copper`        | `#A63D12` | Primary action, links, focus ring             | slip on it 6.2:1; as text 5.6:1 |
| `--copper-bright` | `#E2672A` | Copper on the signboard only (wordmark rule)  | 5.5:1 on signboard              |
| `--maize`         | `#F2B90C` | "With an officer", ELEVATED alerts, warnings  | ink on it 10.3:1                |
| `--leaf`          | `#24521A` | "Advice ready", success                       | slip on it 8.9:1                |
| `--laterite`      | `#8E1B10` | HIGH alerts, errors                           | slip on it 8.9:1                |

Pairs are fixed: ink on maize; slip on copper, leaf and laterite; paper on signboard. Never put copper text on maize or leaf.

## 4. Type

| Role          | Family                                | Use                                                                                                                                                                                    |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stencil**   | Big Shoulders Stencil (variable)      | The wordmark and at most one stencilled word per screen (the stamp of the moment). Uppercase, 700–900.                                                                                 |
| **Display**   | Big Shoulders (variable)              | Screen titles, the issue name on a result, numbers that matter. Condensed, so long issue names fit a phone line. 700–800.                                                              |
| **Body**      | Atkinson Hyperlegible Next (variable) | Everything people read: steps, labels, buttons. Built by the Braille Institute so look-alike characters (1/l/I, 0/O) differ, which matters on a glaring screen. 400, 600 and 800 only. |
| **Slip data** | Atkinson Hyperlegible Mono            | Slip fields: report number, dates, district, registration numbers, label doses.                                                                                                        |

Scale (px, line-height): `display-xl` 44/44 (Big Shoulders 800) · `display` 32/34 · `title` 22/28 (Body 800) · `body` 18/27 (Body 400; never below 17) · `label` 15/20 (Body 600, tracking +0.02em) · `eyebrow` 13/16 (Mono 600, uppercase, tracking +0.08em) · `data` 16/22 (Mono 500).

## 5. Shape, depth and texture

- **Radius:** slips 6 px (paper, not pillows); inputs 4 px; buttons 6 px; stamps 3 px. No fully round pills except the GPS dot.
- **Shadow: one system, the sign-painter's.** A hard, offset, unblurred ink shadow: `--shadow-sign: 3px 3px 0 var(--ink)` on primary buttons and the active slip; `--shadow-sign-sm: 2px 2px 0 var(--ink)` on chips. Pressing a button removes the shadow and moves it 2 px (it goes into the board). No soft blurred shadows anywhere.
- **Borders:** 2 px ink on slips, inputs and buttons. Ruled lines inside slips are 1 px `--rule`.
- **Texture:** paper grain at 4% opacity on `--paper` (inline SVG noise, no image download). Slips carry a tag notch (a punched hole) top left.

## 6. Components

- **Signboard header:** a full-width `--signboard` strip; the stencil wordmark `CROPWATCH` in paper with a 4 px `--copper-bright` underline; the district on the right in Mono. 56 px.
- **Field slip:** a `--slip` card with a 2 px ink border, a punched notch, an eyebrow row (`REPORT 7F3K · 23 OCT`), then ruled field rows (`CROP · Tomato`, `PLACE · Chongwe`, `PLANTED · 2 Sep`). The status stamp sits top right.
- **Stamp:** an uppercase Stencil word in a 2.5 px border, rotated −3°, colours from the status: SENT (ink outline), ASSESSING (ink outline, animated ellipsis), WITH AN OFFICER (maize block), ADVICE READY (leaf block). A new stamp presses in once (scale 1.15 → 1, 220 ms) when the status changes.
- **Advice ladder:** a vertical rail (4 px ink) on the left with square rungs, one step per rung, in the order the API gives them (scout → field practice → natural control). The contract carries order, not rung type, so eyebrows read `STEP 1`, `STEP 2` …. Rungs reveal top-down, 80 ms apart. The chemical rung is always last and labelled `CHEMICALS`: a registered product with its label dose verbatim in Mono, or the officer referral on a maize block.
- **Sources:** a ruled list under the ladder: title, then a tier tag in Mono (`MINISTRY OF AGRICULTURE`, `ZARI`, `FAO`, `CABI`, `RESEARCH`).
- **Alert board:** area alerts are painted boards: a laterite (HIGH) or maize (ELEVATED) block, the issue in Big Shoulders, the district, and the contributing factors as a list. A level never appears without its factors (invariant 2). Simulated data carries the DEMO DATA badge.
- **Thumb bar:** a fixed bottom `--signboard` bar holding the one primary action: a copper button with the sign shadow, full width, 56 px tall, body 800.
- **Capture tile:** a large dashed 2 px ink frame showing a camera icon and "Take a photo of the damaged leaf". After capture it shows the photo with a "Retake" chip.
- **Choice chips (crop):** a 2-column grid of 64 px chips, each a Lucide icon plus a label. The selected chip is an ink block with paper text and the small sign shadow.
- **Location row:** a GPS state (searching, found and the nearest district, or not available) with a district picker as the fallback. It always shows the district, never the coordinates.
- **Demo badge:** `DEMO DATA — SIMULATED`, maize block, ink text, Mono, whenever a simulated row is on screen (invariant 5).

## 7. Icons

Lucide only, stroke 2.25, 24 px (28 px in chips). Never emoji. Crop chips use Lucide glyphs plus the label; the label is never omitted.

## 8. Motion

- State changes 150–220 ms, `cubic-bezier(.2,.8,.2,1)`.
- The two choreographed moments: the stamp press, and the ladder revealing rung by rung when advice lands.
- Waiting uses a three-dot ellipsis on the stamp, never a spinner wheel.
- Everything non-essential sits behind `prefers-reduced-motion: no-preference`.

## 9. Voice

Short, second person, plain English (Nyanja later): "Take a photo of the damaged leaf", "We sent your report", "An extension officer will look at this". Name the source of advice ("From Zambian and FAO guides"). Never "probability", never a percentage of confidence or risk, never a dose that did not come from a registered label.

## 10. Anti-patterns for this product

- Emerald-green "agritech" gradients, leaf illustrations and smiling-farmer stock art.
- Soft blurred card shadows, glassmorphism, and grey-on-white secondary text.
- Spinners with no words; percentages anywhere near the AI.
- Icons without labels; text under 17 px; light font weights.
- More than one copper action per screen.

## 11. Checks before shipping a screen

Body ≥ 7:1 and actions ≥ 5:1 (the tokens above guarantee this, so use only tokens) · touch targets ≥ 48 px (primary 56) · visible 3 px copper focus ring · labels on every icon · readable at 360 px wide · `prefers-reduced-motion` respected · DemoBadge whenever a sim row shows · no confidence numbers in any rendered string.

## References

- GSMA, [AgriTech UX Design Guidebook](https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/wp-content/uploads/2025/10/AgriTech-UX-Design-Guidebook.pdf) (2025), and Making Sense, [inclusive design for farmers in emerging markets](https://makingsense.com/blog/post/inclusive-design-app-case-study-for-farmers-in-emerging-markets): recognisable imagery over text, consistent patterns, short text.
- Google, [Android colour contrast](https://support.google.com/accessibility/android/answer/7158390): contrast for extreme lighting; field-app reports of light grey failing in sun ([trap.nz forum](https://forums.trap.nz/t/improve-readability-of-app-text-difficult-to-see-in-the-sun/2030)).
- Braille Institute, [Atkinson Hyperlegible](https://en.wikipedia.org/wiki/Atkinson_Hyperlegible) (Next, 2025: 7 weights, variable, monospace).
- Arden Stern, [Zambian sign painting and print](https://design-altruism-project.org/2007/11/15/dateline-zambia-skill-savvy-survival/); [The Street Museum: sign painting as art and history](https://pbssocal.org/shows/departures/the-street-museum-sign-painting-as-art-and-history).
- Herbarium and seed-packet labels as a layout model (ruled fields, typography-led packets such as [Piccolo's botanical alphabet](https://mossandfog.beehiiv.com/p/stunning-botanical-seed-packaging-for-piccolo)).

# Polish batch 2: the content (30 Oct)

Items 7 to 11 of the polish batch on the v2.1 structure, deployed to https://crop-watch01.web.app on 30 Oct. The API is unchanged since batch 1 (`cropwatch-api-00011-c8d`).

What changed:

7. **Stat cards.** Every page's figures, and the outbreak drawer's, are now cards: a small grey label on top and a large tabular figure that settles in again when it changes. Where the data has a change line, the card shows it:
   - on the national map, reports this week against last week, and clusters and waiting reports new this week;
   - on the Outgrower View, the rising issue against last week;
   - on the outbreak drawer, reports new in 24 h.

   Each label appears once, above the figure.

8. **Map legend.** It is behind an (i) button at the map's bottom-left. It opens on hover and pins open on click. The map takes the space the legend had. The open legend is its own state in the visual pass ([dashboard-map-legend-laptop.png](dashboard-map-legend-laptop.png)).
9. **Districts to watch.** An aligned list with "District" and "Signal" columns. Each row has the district and a right-aligned level pill, then one compact line, for example "13 FAW reports · 10 km cluster · +3 in 24 h". The compact line is read back from Risk Model v0's own factor sentences, so it is the same factors, shorter (invariant 2). Opening a row shows every factor in full.
10. **Report detail (full report drawer and officer queue).**
    - The key facts come first, as a grid: Crop, District, Sent, Stage (the crop stage on the day of the report, from the planting date).
    - Then labelled blocks:
      - Photo;
      - Assessment (issue, the confidence band in words, damage, why it was routed, what the AI saw);
      - Advice (a compact numbered list, doses verbatim);
      - Evidence (behind "Why this advice?");
      - Verify.
    - Every citation is a chip with the publisher and title. It opens the original document in a new tab.
11. **De-densified pages.**
    - **Outgrower View:** stat cards, right-aligned counts in the camps table, and shorter sentences.
    - **Scenario:** the ranked camps are a table: #, camp, crop, reports, crop stage, rain, verified.
    - **Knowledge sources:** a table per tier: document, publisher, coverage, status.
    - Phones keep the first columns of each table.

The full report drawer at full height, with the evidence open, was also checked at laptop and phone widths. It is not in the folder because the pass shoots the viewport only.

Checks after the deploy:

- **Repo gate:** green (typecheck, lint, build, 398 tests).
- **Demo check:** passed (`outbreak-e2e`: report to dispatch in 11.4 s; it cleaned up after itself; Lusaka Elevated).
- **Visual pass:** all 18 states at laptop and phone, plus the map at 1280 and 1920, with no issues ([visual-pass.md](visual-pass.md)). Every shot was looked at.

Sheets: [laptop](sheet-laptop.png), [phone](sheet-phone.png).

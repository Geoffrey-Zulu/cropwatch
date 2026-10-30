# National map: three mockups (30 Oct)

Live at https://crop-watch01.web.app/mockups/, a chooser page linking to the three. Each mockup is one static HTML file (`apps/web/public/mockups/`). The data comes from the live demo system after the seed realism pass, exported by `pnpm --filter @repo/admin-tools mockup-data`. Geoffrey picks one on Saturday morning, and every dashboard view is then rebuilt to it exactly. The capture app is reskinned to the same direction, with its flow unchanged.

|     | Direction                                                                                                                                                                                                                                             | Laptop                            | Projector                         | Phone                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------- | ------------------------------- |
| A   | **Field-airy:** the map on a calm cream ground with white floating islands (figures, Districts to watch, map key), a serif title, green land, red-brown High and hatched gold Elevated                                                                | [1440](a-field-airy-1440.png)     | [1920](a-field-airy-1920.png)     | [390](a-field-airy-390.png)     |
| B   | **Ops console:** dark, dense panels with thin rules, mono figures, daily bars from the reports, an alert log with each alert's class and how sure it is, a clusters table; High hatched red-gold, Elevated flat gold, every level with a 3-step meter | [1440](b-ops-console-1440.png)    | [1920](b-ops-console-1920.png)    | [390](b-ops-console-390.png)    |
| C   | **Modern product:** dark layered cards, one violet brand colour, large display figures, a left rail, a native-app tab bar on phones; risk keeps its own red and gold                                                                                  | [1440](c-modern-product-1440.png) | [1920](c-modern-product-1920.png) | [390](c-modern-product-390.png) |

How they were made:

- **Built** by three parallel agents from one brief ([BRIEF.md](BRIEF.md)): the same data, required parts and product rules.
- **Finished by hand** after the agents stalled. All three stopped at once when Google's font files stopped loading on the build machine, so their screenshot calls hung.
- **The standing chrome rules,** which the brief had missed, applied to all three:
  - the logo alone in the header, with no "Command Center";
  - no question line under the title;
  - the DEMO marker on the data, never in the chrome.
- **Copy checked** on each page's text: no em dashes, none of the banned words, "forecast" only in "Risk signal from reports, not a forecast.", and the DEMO marker present.
- **Fonts:** these screenshots use fallback fonts, because fonts.gstatic.com timed out from the build machine. On a normal connection each mockup loads its own Google Fonts: A uses Figtree and Fraunces, B uses IBM Plex Mono and Instrument Sans, C uses its own choice.

Notes for the pick and the rebuild:

- **Six newer districts share their parent's risk unit:** Chipangali and Kasenengwa (Chipata), Chasefu and Lumezi (Lundazi), Lusangazi (Petauke) and Pemba (Choma). The map therefore shades 10 High shapes while the figures say 5 districts at High. The live dashboard says "Counted with Chipata" on hover. Whichever direction is picked needs that wording.
- **Two reports in Lusaka are not simulated** (`sim: false`, issue unknown, awaiting review). They are drawn like the rest.
- **The mockups show the state before the pitch:** Lusaka is Elevated (a surge, no cluster). The presenter's report completes the venue cluster and tips it to High.

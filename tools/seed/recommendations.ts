import {
  OFFICER_REFERRAL,
  RecommendationSchema,
  type KnownIssue,
  type RagSource,
  type Recommendation,
} from '@repo/shared'

// Canned recommendations for seeded rows (D4 decision a): no model is called. Each step
// paraphrases the document it cites, with the same rules as the live path: IPM rungs only, no
// doses, no pesticide names. Seeded rows get no chemical options (the register's placeholder
// rows never reach advice), so every one ends with the officer referral.

// Documents in tools/corpus/manifest.json; recommendations.test.ts keeps these in step with it.
export const SOURCES = {
  'fao-faw-scouting-guidance-note-2018': {
    title: 'FAO Fall Armyworm guidance note 2, scouting',
    tier: 4,
    uri: 'https://www.fao.org/fileadmin/templates/fcc/Fall_Armyworm/web_guidance-note-2.pdf',
  },
  'moa-faw-maize-legume-intercropping-2022': {
    title:
      'Maize-legume intercropping in Fall Armyworm fight yielding results – Ministry of Agriculture',
    tier: 1,
    uri: 'https://www.agriculture.gov.zm/2022/05/maize-legume-intercropping-in-fall-armyworm-fight-yielding-results/',
  },
  'moa-faw-biological-control-2023': {
    title:
      'Biological Control a sustainable Approach to Combat Fall Armyworm – Ministry of Agriculture',
    tier: 1,
    uri: 'https://www.agriculture.gov.zm/2023/11/biological-control-a-sustainable-approach-to-combat-fall-armyworm/',
  },
  'pw-pmdg-tuta-absoluta-zambia-2022': {
    title: 'Tomato leafminer in tomato, Zambia (PMDG, T. Mfune, MoA, updated June 2022)',
    tier: 5,
    uri: 'https://plantwiseplusknowledgebank.org/doi/pdf/10.1079/pwkb.20177801301',
  },
  'pw-pmdg-late-blight-tomato-zambia-2021': {
    title: 'Late blight on tomato, Zambia (PMDG)',
    tier: 5,
    uri: 'https://plantwiseplusknowledgebank.org/doi/pdf/10.1079/pwkb.20237800264',
  },
  'pw-pmdg-early-blight-tomato-zambia-2014': {
    title: 'Early blight fungal disease in tomato, Zambia (PMDG)',
    tier: 5,
    uri: 'https://plantwiseplusknowledgebank.org/doi/pdf/10.1079/pwkb.20147801175',
  },
  'pw-pmdg-diamondback-moth-zambia-2014': {
    title: 'Diamondback moth on cabbage, Zambia (PMDG)',
    tier: 5,
    uri: 'https://plantwiseplusknowledgebank.org/doi/pdf/10.1079/pwkb.20147801373',
  },
  'pw-pmdg-cassava-mosaic-zambia-2024': {
    title: 'Cassava mosaic disease in cassava, Zambia (PMDG)',
    tier: 5,
    uri: 'https://plantwiseplusknowledgebank.org/doi/pdf/10.1079/pwkb.20257800018',
  },
  'zari-crop-guide-cassava-2025': {
    title: 'ZARI crop production guide, cassava',
    tier: 2,
    uri: 'https://www.zari.gov.zm/download/83/crop-production-guides/4500/cassava-edited.pdf',
  },
  'moa-cbsd-cmd-chienge-kaputa-2025': {
    title:
      'GOVERNMENT INTENSIFIES FIGHT AGAINST CBSD and CMD in CHIENGE and KAPUTA. – Ministry of Agriculture',
    tier: 1,
    uri: 'https://www.agriculture.gov.zm/2025/02/government-intensifies-fight-against-cbsd-and-cmd-in-chienge-and-kaputa/',
  },
} as const satisfies Record<string, Omit<RagSource, 'chunk_ids'>>

type SourceId = keyof typeof SOURCES

interface CannedStep {
  text: string
  sources: SourceId[]
}

// In ladder order: scout, cultural, biological. Maize lethal necrosis has no source in the
// corpus, so it has no template: those rows wait for an officer, as a live report would.
export const CANNED: Partial<Record<KnownIssue, CannedStep[]>> = {
  fall_armyworm: [
    {
      text: 'Scout at least once a week: walk the field in a W and, at five stations of 10 plants, look in each whorl for fresh leaf damage or frass. Count only plants with signs of a live larva.',
      sources: ['fao-faw-scouting-guidance-note-2018'],
    },
    {
      text: 'Intercrop maize with legumes such as cowpeas. In Ministry of Agriculture farmer field school trials, farmers saw less fall armyworm attack than in maize grown alone.',
      sources: ['moa-faw-maize-legume-intercropping-2022'],
    },
    {
      text: 'Protect the natural enemies and beneficial insects that keep fall armyworm down, and favour plant-based remedies such as neem and chilli over chemical sprays.',
      sources: ['moa-faw-biological-control-2023'],
    },
  ],
  tuta_absoluta: [
    {
      text: 'Set pheromone water traps and check them every week. Brown, silvery moths in the traps warn of Tuta before damage shows.',
      sources: ['pw-pmdg-tuta-absoluta-zambia-2022'],
    },
    {
      text: 'Check leaves for white to cream mines with small green to pinkish larvae, and fruit for holes with black frass. Act early: once many fruits are infested it is too late to control.',
      sources: ['pw-pmdg-tuta-absoluta-zambia-2022'],
    },
    {
      text: 'Plant seedlings free from infestation, and do not plant tomato next to infested tomato, potato, eggplant or pepper.',
      sources: ['pw-pmdg-tuta-absoluta-zambia-2022'],
    },
    {
      text: 'Crush larvae by hand, remove leaves and fruit with mines, and bury or burn infested fruit and crop remains. Never leave them at markets or on the farm.',
      sources: ['pw-pmdg-tuta-absoluta-zambia-2022'],
    },
  ],
  late_blight: [
    {
      text: 'Check plants twice a week in the dry season and daily in the rainy season for dark greyish leaf lesions, brown-black patches on stems and white fuzzy growth under leaves. Act as soon as one plant shows symptoms.',
      sources: ['pw-pmdg-late-blight-tomato-zambia-2021'],
    },
    {
      text: 'Transplant disease-free seedlings of resistant varieties, space plants so air can flow, and water at the base or by drip instead of overhead.',
      sources: ['pw-pmdg-late-blight-tomato-zambia-2021'],
    },
    {
      text: 'Rotate with cereals such as maize, avoid fields that last grew potato, tomato or eggplant, and bury infected plants and all tomato debris after harvest.',
      sources: ['pw-pmdg-late-blight-tomato-zambia-2021'],
    },
  ],
  early_blight: [
    {
      text: 'From the vegetative stage to fruiting, check every week for dark spots with rings on the lower leaves, on stems and near the fruit stalk, especially after heavy rain.',
      sources: ['pw-pmdg-early-blight-tomato-zambia-2014'],
    },
    {
      text: 'Use tolerant varieties, plant in raised beds with wide spacing, water the soil rather than the leaves, and mulch to stop soil splashing onto them.',
      sources: ['pw-pmdg-early-blight-tomato-zambia-2014'],
    },
    {
      text: 'Rotate with crops outside the tomato family (not potato), remove and destroy infected leaves without carrying them openly through the field, and burn affected plants at the end of the season.',
      sources: ['pw-pmdg-early-blight-tomato-zambia-2014'],
    },
  ],
  diamondback_moth: [
    {
      text: 'From the four-leaf stage, check the undersides of leaves every week for small, thin green larvae and shot-hole damage. Young larvae are the ones that can still be controlled.',
      sources: ['pw-pmdg-diamondback-moth-zambia-2014'],
    },
    {
      text: 'Plant between March and June, rotate with onions or legumes, slash leftover cabbage stems after harvest, and grow marigold, tomato or pepper around the field to repel moths.',
      sources: ['pw-pmdg-diamondback-moth-zambia-2014'],
    },
    {
      text: 'Crush larvae by hand when there are few. ZARI’s entomology section can supply Cotesia wasps, which parasitise the larvae.',
      sources: ['pw-pmdg-diamondback-moth-zambia-2014'],
    },
  ],
  cassava_mosaic: [
    {
      text: 'Once a week, examine about 20 plants for yellow or white mottled, wrinkled leaves and stunting, and shake plants in the early morning or evening to see whiteflies.',
      sources: ['pw-pmdg-cassava-mosaic-zambia-2024'],
    },
    {
      text: 'Plant resistant varieties and disease-free cuttings from registered suppliers such as ZARI, do not exchange cuttings between farms, and sterilise cutting tools.',
      sources: ['pw-pmdg-cassava-mosaic-zambia-2024', 'zari-crop-guide-cassava-2025'],
    },
    {
      text: 'Remove diseased cassava and other host plants, then dry and burn them far from the field. Keep weeds down and intercrop with maize, cowpeas or marigolds to repel whiteflies.',
      sources: ['pw-pmdg-cassava-mosaic-zambia-2024'],
    },
  ],
  cassava_brown_streak: [
    {
      text: 'Look for yellow, mottled patches along the leaf veins, brown streaks on the stems and a dry brown-black rot inside the roots.',
      sources: ['zari-crop-guide-cassava-2025'],
    },
    {
      text: 'Plant resistant varieties and cuttings only from disease-free plants. The Ministry of Agriculture has distributed disease-free planting material in affected districts.',
      sources: ['zari-crop-guide-cassava-2025', 'moa-cbsd-cmd-chienge-kaputa-2025'],
    },
    {
      text: 'Uproot and destroy diseased plants.',
      sources: ['zari-crop-guide-cassava-2025'],
    },
  ],
}

export function cannedRecommendation(
  obsId: string,
  issue: KnownIssue,
  createdAt: string
): Recommendation | null {
  const steps = CANNED[issue]
  if (!steps) return null
  const cited = [...new Set(steps.flatMap(step => step.sources))]
  return RecommendationSchema.parse({
    obs_id: obsId,
    created_at: createdAt,
    ipm_steps: [...steps.map(step => step.text), OFFICER_REFERRAL],
    chemical_options: [],
    rag_sources: cited
      .map(id => ({ ...SOURCES[id], chunk_ids: [] }))
      .sort((a, b) => a.tier - b.tier || a.title.localeCompare(b.title)),
    regulatory_check: { passed: true, rejected_products: [] },
    sim: true,
  })
}

// Looks for the FAW manual's recommended-products annex in Ministry documents and lifts the
// product lines into a CSV FOR HUMAN REVIEW. Its columns deliberately differ from the register
// format, so tools/regulatory refuses to load it until someone transcribes and signs it off.

const INGREDIENTS = [
  'emamectin benzoate',
  'chlorantraniliprole',
  'spinetoram',
  'spinosad',
  'lambda-cyhalothrin',
  'lambda cyhalothrin',
  'flubendiamide',
  'indoxacarb',
  'cypermethrin',
  'chlorpyrifos',
  'abamectin',
  'thiamethoxam',
  'acetamiprid',
  'imidacloprid',
  'deltamethrin',
  'novaluron',
  'lufenuron',
  'methomyl',
  'profenofos',
  'bacillus thuringiensis',
  'beauveria bassiana',
  'metarhizium',
  'azadirachtin',
  'neem',
  'mancozeb',
  'metalaxyl',
  'chlorothalonil',
  'copper oxychloride',
  'difenoconazole',
  'azoxystrobin',
]

export interface AnnexRow {
  file: string
  page: number | null
  ingredient: string
  raw: string
}

export function findAnnexRows(file: string, pages: string[]) {
  const all = pages.join('\n')
  const hasAnnex =
    /\b(annex|appendix)\b/i.test(all) &&
    /(active ingredient|trade name|registered|registration)/i.test(all)
  if (!hasAnnex) return { hasAnnex, rows: [] as AnnexRow[] }

  const rows: AnnexRow[] = []
  const seen = new Set<string>()
  pages.forEach((text, index) => {
    for (const line of text.split(/\r?\n/)) {
      const raw = line.replace(/\s+/g, ' ').trim()
      const ingredient = INGREDIENTS.find(name => raw.toLowerCase().includes(name))
      if (!ingredient || raw.length < 8 || seen.has(raw)) continue
      seen.add(raw)
      rows.push({ file, page: pages.length > 1 ? index + 1 : null, ingredient, raw })
    }
  })
  return { hasAnnex, rows }
}

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function annexCsv(rows: AnnexRow[]) {
  const header = ['source_file', 'page', 'active_ingredient', 'raw_text', 'review_note']
  const note =
    'CANDIDATE ONLY, not loaded: check against the manual, then transcribe into the register format'
  return [
    header.join(','),
    ...rows.map(r => [r.file, r.page, r.ingredient, r.raw, note].map(csvCell).join(',')),
  ].join('\n')
}

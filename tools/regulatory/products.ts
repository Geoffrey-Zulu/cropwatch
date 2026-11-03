import { RegisteredProductSchema, type RegisteredProduct } from '@repo/shared'
import { parseCsv } from './csv'

// The register CSV: one row per registered product, columns in this order, optionally followed
// by verified_by. List columns (approved_crops, approved_issues) are semicolon-separated slugs;
// an empty expiry means none; an empty verified_by means not yet spot-checked.
export const COLUMNS = [
  'registration_no',
  'trade_name',
  'active_ingredient',
  'registrant',
  'approved_crops',
  'approved_issues',
  'label_dose',
  'phi_days',
  'who_class',
  'source',
  'source_doc',
  'expiry',
] as const
export const VERIFIED_BY = 'verified_by'

export interface ParsedProducts {
  products: RegisteredProduct[]
  errors: string[]
}

const list = (cell: string) =>
  cell
    .split(';')
    .map(item => item.trim())
    .filter(Boolean)

// All-or-nothing: any error means nothing should be loaded. Row numbers match a spreadsheet
// (the header is row 1).
export function parseProductsCsv(text: string): ParsedProducts {
  const [header, ...rows] = parseCsv(text).filter(row => row.some(cell => cell !== ''))
  const withVerifiedBy = header?.join(',') === [...COLUMNS, VERIFIED_BY].join(',')
  if (!header || (header.join(',') !== COLUMNS.join(',') && !withVerifiedBy)) {
    return {
      products: [],
      errors: [`Header must be exactly: ${COLUMNS.join(',')} (optionally then ,${VERIFIED_BY})`],
    }
  }

  const products: RegisteredProduct[] = []
  const errors: string[] = []
  const seen = new Map<string, number>()

  rows.forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== header.length) {
      errors.push(`Row ${line}: expected ${header.length} columns, found ${cells.length}`)
      return
    }
    const cell = Object.fromEntries(COLUMNS.map((name, i) => [name, cells[i]])) as Record<
      (typeof COLUMNS)[number],
      string
    >
    const phi = cell.phi_days.trim()
    const parsed = RegisteredProductSchema.safeParse({
      registration_no: cell.registration_no.trim(),
      trade_name: cell.trade_name.trim(),
      active_ingredient: cell.active_ingredient.trim(),
      registrant: cell.registrant.trim(),
      approved_crops: list(cell.approved_crops),
      approved_issues: list(cell.approved_issues),
      // Verbatim: whatever the label says, exactly.
      label_dose: cell.label_dose,
      phi_days: /^\d+$/.test(phi) ? Number(phi) : phi,
      who_class: cell.who_class.trim(),
      source: cell.source.trim(),
      source_doc: cell.source_doc.trim(),
      expiry: cell.expiry.trim() || null,
      verified_by: withVerifiedBy ? cells[COLUMNS.length].trim() || null : null,
    })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`Row ${line} ${issue.path.join('.')}: ${issue.message}`)
      }
      return
    }
    const earlier = seen.get(parsed.data.registration_no)
    if (earlier) {
      errors.push(
        `Row ${line}: registration_no ${parsed.data.registration_no} repeats row ${earlier}`
      )
      return
    }
    seen.set(parsed.data.registration_no, line)
    products.push(parsed.data)
  })

  return { products, errors }
}

// Sets verified_by on the rows whose registration_no is in `ids`, touching nothing else in the
// file (label_dose stays byte-identical). The CSV must carry the verified_by column.
export function markVerified(text: string, ids: string[], by: string) {
  if (!/^[a-z][a-z0-9_.-]*$/i.test(by)) throw new Error(`verified_by must be a plain name: ${by}`)
  const lines = text.split(/(?<=\n)/)
  if (!parseCsv(lines[0] ?? '')[0]?.includes(VERIFIED_BY)) {
    throw new Error(`The CSV has no ${VERIFIED_BY} column`)
  }
  const found = new Set<string>()
  let changed = 0
  const out = lines.map((line, i) => {
    const id = i === 0 ? undefined : ids.find(candidate => line.startsWith(`${candidate},`))
    if (!id) return line
    found.add(id)
    return line.replace(/,([^,"\r\n]*)(\r?\n)?$/, (_, current: string, end = '') => {
      if (current !== by) changed++
      return `,${by}${end}`
    })
  })
  const result = out.join('')
  const { errors } = parseProductsCsv(result)
  if (errors.length) throw new Error(errors.join('\n'))
  return { text: result, changed, missing: ids.filter(id => !found.has(id)) }
}

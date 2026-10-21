import { RegisteredProductSchema, type RegisteredProduct } from '@repo/shared'
import { parseCsv } from './csv'

// The register CSV: one row per registered product, columns in this order. List columns
// (approved_crops, approved_issues) are semicolon-separated slugs; an empty expiry means none.
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
  if (!header || header.join(',') !== COLUMNS.join(',')) {
    return { products: [], errors: [`Header must be exactly: ${COLUMNS.join(',')}`] }
  }

  const products: RegisteredProduct[] = []
  const errors: string[] = []
  const seen = new Map<string, number>()

  rows.forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== COLUMNS.length) {
      errors.push(`Row ${line}: expected ${COLUMNS.length} columns, found ${cells.length}`)
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

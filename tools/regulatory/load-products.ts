// Loads the Regulatory Product Database (registered_products) from a CSV. The CSV is the whole
// register: --commit adds and updates its rows and deletes rows that are not in it.
//
//   pnpm --filter @repo/regulatory-tools load-products <file.csv>            (dry run: plan only)
//   pnpm --filter @repo/regulatory-tools load-products <file.csv> --commit
//
// The live register is pmdg-products.csv (source: plantwise_pmdg, from the Zambian Plantwise
// PMDGs); label, ZEMA or MoA-manual rows join it in the same file. placeholder-products.csv is
// test data only: loading the PMDG file removes its rows. Spot-checks: mark-verified.ts.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { registeredProductDocId } from '@repo/shared'
import { commit, listDocuments, type Write } from '@repo/tools-gcp'
import { parseProductsCsv } from './products'

const COLLECTION = 'registered_products'

const args = process.argv.slice(2).filter(arg => arg !== '--')
const file = args.find(arg => !arg.startsWith('--'))
const apply = args.includes('--commit')
if (!file) {
  console.error('usage: load-products <file.csv> [--commit]')
  process.exit(2)
}

// pnpm --filter runs scripts in the package directory; resolve paths from where it was invoked.
const path = resolve(process.env.INIT_CWD ?? process.cwd(), file)
const { products, errors } = parseProductsCsv(readFileSync(path, 'utf8'))
if (errors.length) {
  console.error(`${file}: ${errors.length} problem(s); nothing loaded.\n  ${errors.join('\n  ')}`)
  process.exit(1)
}

const bySource = Object.entries(
  products.reduce<Record<string, number>>((counts, p) => {
    counts[p.source] = (counts[p.source] ?? 0) + 1
    return counts
  }, {})
)
const coverage = [
  ...new Set(
    products.flatMap(p => p.approved_crops.flatMap(c => p.approved_issues.map(i => `${c}/${i}`)))
  ),
].sort()
console.log(`${file}: ${products.length} valid product(s)`)
console.log(`  sources: ${bySource.map(([s, n]) => `${s} ${n}`).join(', ')}`)
console.log(`  crop/issue pairs: ${coverage.join(', ')}`)
const verified = products.filter(p => p.verified_by)
console.log(`  spot-checked: ${verified.length} of ${products.length}`)
const expired = products.filter(
  p => p.expiry !== null && p.expiry < new Date().toISOString().slice(0, 10)
)
if (expired.length) console.log(`  expired: ${expired.map(p => p.registration_no).join(', ')}`)

const existing = new Map(
  (await listDocuments(COLLECTION)).map(doc => [doc.data.registration_no as string, doc])
)
const writes: Write[] = []
const plan = { add: [] as string[], update: [] as string[], unchanged: 0, remove: [] as string[] }
for (const product of products) {
  const current = existing.get(product.registration_no)
  if (!current) plan.add.push(product.registration_no)
  else if (!isDeepStrictEqual(current.data, product)) plan.update.push(product.registration_no)
  else {
    plan.unchanged++
    continue
  }
  writes.push({
    set: `${COLLECTION}/${registeredProductDocId(product.registration_no)}`,
    data: product,
  })
}
for (const [registrationNo, doc] of existing) {
  if (!products.some(p => p.registration_no === registrationNo)) {
    plan.remove.push(registrationNo)
    writes.push({ delete: doc.path })
  }
}

console.log(
  `\nregistered_products: add ${plan.add.length}, update ${plan.update.length}, unchanged ${plan.unchanged}, remove ${plan.remove.length}`
)
for (const [action, ids] of [
  ['+', plan.add],
  ['~', plan.update],
  ['-', plan.remove],
] as const) {
  for (const id of ids) console.log(`  ${action} ${id}`)
}

if (!apply) {
  console.log('\nDry run. Re-run with --commit to apply.')
} else if (writes.length === 0) {
  console.log('\nNothing to change.')
} else {
  await commit(writes)
  console.log(`\nCommitted ${writes.length} write(s).`)
}

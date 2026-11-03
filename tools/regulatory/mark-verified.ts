// Records a spot-check: sets verified_by on the named rows of a register CSV, in place. The CSV
// stays the whole register, so load-products then carries the change to Firestore.
//
//   pnpm --filter @repo/regulatory-tools mark-verified <file.csv> --by geoffrey --ids A,B,C
//
// Idempotent; only the verified_by cell of each named row changes.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { markVerified } from './products'

const args = process.argv.slice(2).filter(arg => arg !== '--')
const value = (flag: string) => {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}
const file = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'))
const by = value('--by')
const ids = (value('--ids') ?? '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean)
if (!file || !by || ids.length === 0) {
  console.error('usage: mark-verified <file.csv> --by <name> --ids <id,id,...>')
  process.exit(2)
}

const path = resolve(process.env.INIT_CWD ?? process.cwd(), file)
const { text, changed, missing } = markVerified(readFileSync(path, 'utf8'), ids, by)
if (missing.length) {
  console.error(`Not in ${file}: ${missing.join(', ')}. Nothing changed.`)
  process.exit(1)
}
writeFileSync(path, text)
console.log(`${file}: verified_by=${by} on ${ids.length} row(s), ${changed} changed.`)
console.log('Now load it: pnpm --filter @repo/regulatory-tools load-products <file.csv> --commit')

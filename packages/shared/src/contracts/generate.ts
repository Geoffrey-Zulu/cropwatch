// Writes openapi.json next to this file. Run: pnpm --filter @repo/shared generate:openapi
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildOpenApiDocument } from './openapi'

const out = fileURLToPath(new URL('./openapi.json', import.meta.url))
writeFileSync(out, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`)
console.log(`wrote ${out}`)

// Shows what the corpus returns for a context-shaped query (technicaldoc §7), the same shape
// /recommend uses:
//
//   pnpm --filter @repo/corpus probe tomato tuta_absoluta
import { CropSchema, KnownIssueSchema } from '@repo/shared'
import { CORPUS_NAME } from './plan'
import { findCorpus, retrieveContexts } from './rag'

const [crop, issue] = process.argv.slice(2).filter(arg => arg !== '--')
const query = `crop=${CropSchema.parse(crop)} issue=${KnownIssueSchema.parse(issue)} question="evidence-backed interventions appropriate to this situation, IPM-first"`

const corpus = await findCorpus(CORPUS_NAME)
if (!corpus) throw new Error(`No corpus named ${CORPUS_NAME}`)
const started = Date.now()
const contexts = await retrieveContexts(corpus, query, 10)
console.log(`${contexts.length} contexts in ${Date.now() - started} ms for: ${query}\n`)
for (const context of contexts) {
  console.log(`[${context.score?.toFixed(3) ?? '?'}] ${context.sourceUri}`)
  console.log(`  ${context.text.replace(/\s+/g, ' ').slice(0, 220)}…\n`)
}

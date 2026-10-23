// Runs the real recommendation path (knowledge index → RAG Engine retrieval → Gemini → checks
// → regulatory filter → IPM ladder) for one situation per issue, as the authorized account:
// buildplan §4.3 acceptance before deploy, and a quick look at what farmers would read.
//
//   pnpm --filter @repo/functions eval:recommend [--issue=late_blight] [--out=report.json]
import { writeFileSync } from 'node:fs'
import { ThinkingLevel } from '@google/genai'
import type { GoogleAuth } from 'google-auth-library'
import {
  CROPS,
  ISSUES,
  KNOWN_ISSUES,
  type Crop,
  type KnownIssue,
  type Observation,
} from '@repo/shared'
import { readEnv } from '../env'
import { gcloudAccessToken, gcloudAuthClient } from '../lib/localAuth'
import { withTransientRetry } from '../services/diagnosisModel'
import { geminiJsonModel } from '../services/gemini'
import { loadPrompt } from '../services/prompt'
import { recommend } from '../services/recommend/ipmLadder'
import type { KnowledgeLayer, KnowledgeResult } from '../services/recommend/knowledge'
import { COMPOSITION_RESPONSE_SCHEMA, ragKnowledge } from '../services/recommend/ragKnowledge'
import {
  cachedIndex,
  parseGcsUri,
  vertexRetrieve,
  withRetrieveRetry,
} from '../services/recommend/vertexRag'

const CROP_FOR: Record<KnownIssue, Crop> = {
  fall_armyworm: 'maize',
  tuta_absoluta: 'tomato',
  late_blight: 'tomato',
  early_blight: 'tomato',
  diamondback_moth: 'cabbage',
  cassava_mosaic: 'cassava',
  cassava_brown_streak: 'cassava',
  maize_lethal_necrosis: 'maize',
}

const args = process.argv.slice(2)
const only = args.find(arg => arg.startsWith('--issue='))?.split('=')[1]
const out = args.find(arg => arg.startsWith('--out='))?.split('=')[1]
if (only && !(ISSUES as readonly string[]).includes(only)) throw new Error(`Unknown issue ${only}`)
if (!CROPS.length) throw new Error('No crops')

const env = readEnv()
const prompt = loadPrompt('recommend-v1')
const authClient = gcloudAuthClient()
const index = parseGcsUri(env.knowledgeIndexUri)
const knowledge = ragKnowledge({
  loadIndex: cachedIndex(async () => {
    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${index.bucket}/o/${encodeURIComponent(index.object)}?alt=media`,
      { headers: { authorization: `Bearer ${gcloudAccessToken()}` } }
    )
    if (!response.ok) throw new Error(`index.json: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }),
  retrieve: withRetrieveRetry(
    vertexRetrieve({ getClient: async () => authClient } as unknown as GoogleAuth)
  ),
  compose: withTransientRetry(
    geminiJsonModel(
      env,
      {
        responseJsonSchema: COMPOSITION_RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 4096,
        thinkingLevel: ThinkingLevel.LOW,
        timeoutMs: 30_000,
      },
      { authClient }
    )
  ),
  prompt,
  modelId: env.geminiModel,
})

const rows = []
for (const issue of KNOWN_ISSUES.filter(i => !only || i === only)) {
  const observation = {
    crop: CROP_FOR[issue],
    growth_stage: null,
    district: 'Chongwe',
    verified_issue: null,
    diagnosis: { suspected_issue: issue, severity_band: 'moderate' },
    sim: false,
  } as unknown as Observation
  let result: KnowledgeResult | null = null
  const traced: KnowledgeLayer = { retrieve: async q => (result = await knowledge.retrieve(q)) }
  const started = Date.now()
  const outcome = await recommend(
    { knowledge: traced, products: [] },
    { obsId: `eval-${issue}`, observation, now: new Date().toISOString() }
  )
  const ms = Date.now() - started
  const trace = (result as KnowledgeResult | null)?.trace as
    { retrieve_ms: number; compose_ms: number; excerpts: unknown[]; dropped: unknown[] } | undefined
  console.log(
    `\n=== ${issue} on ${CROP_FOR[issue]}: ${outcome.kind} in ${ms} ms (retrieve ${trace?.retrieve_ms} ms, compose ${trace?.compose_ms} ms, ${trace?.excerpts.length} excerpts)`
  )
  if (trace?.dropped.length) console.log('  dropped:', JSON.stringify(trace.dropped))
  if (outcome.kind === 'recommendation') {
    const { recommendation, rejected } = outcome
    recommendation.ipm_steps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`))
    console.log('  sources:')
    recommendation.rag_sources.forEach(s => console.log(`    [tier ${s.tier}] ${s.title}`))
    if (rejected.length) {
      console.log(
        `  rejected candidates: ${rejected.map(r => `${r.candidate} (${r.reason})`).join(', ')}`
      )
    }
  }
  rows.push({ issue, crop: CROP_FOR[issue], outcome, trace, ms })
}

if (out) writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`)

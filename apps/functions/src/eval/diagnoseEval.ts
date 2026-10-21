// Runs the real diagnosis pipeline (prompt → Gemini → schema validation → routing → stored
// records) over a labelled image set: buildplan §4.2 acceptance, and D6 photo scoring.
//
//   pnpm --filter @repo/functions eval:diagnose <dir> [--inject-invalid=first|all] [--out=report.json]
//
// <dir> holds JPEGs plus labels.json: [{ "file", "crop", "expect", "district"?, "province"? }].
// --inject-invalid corrupts real replies to exercise retry (first) and expert routing (all).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CropSchema, IssueSchema } from '@repo/shared'
import { z } from 'zod'
import { readEnv } from '../env'
import { gcloudAuthClient } from '../lib/localAuth'
import {
  buildModelRequest,
  diagnosisRecords,
  runDiagnosis,
  withTransientRetry,
  type GenerateFn,
} from '../services/diagnosisModel'
import { geminiDiagnosisModel } from '../services/gemini'
import { loadPrompt } from '../services/prompt'

const LabelsSchema = z.array(
  z.object({
    file: z.string(),
    crop: CropSchema,
    expect: IssueSchema,
    district: z.string().default('Chongwe'),
    province: z.string().default('Lusaka'),
  })
)

const args = process.argv.slice(2)
const dir = args.find(arg => !arg.startsWith('--'))
const inject = args.find(arg => arg.startsWith('--inject-invalid='))?.split('=')[1]
const out = args.find(arg => arg.startsWith('--out='))?.split('=')[1]
if (!dir) throw new Error('usage: diagnoseEval <dir> [--inject-invalid=first|all] [--out=file]')

const env = readEnv()
const prompt = loadPrompt('diagnose-v1')
const real = withTransientRetry(geminiDiagnosisModel(env, { authClient: gcloudAuthClient() }))

// Corrupts the first (or every) reply per image, to prove retry and routing on the real path.
function withInjection(generate: GenerateFn): () => GenerateFn {
  return () => {
    let calls = 0
    return async request => {
      calls++
      if (inject === 'all' || (inject === 'first' && calls === 1)) {
        await generate(request)
        return { text: '{"crop": "maize", "suspected_issue": "loc', modelVersion: null }
      }
      return generate(request)
    }
  }
}
const generateFor = withInjection(real)

const labels = LabelsSchema.parse(JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')))
const rows = []
for (const label of labels) {
  const started = Date.now()
  const request = buildModelRequest(
    prompt,
    {
      crop: label.crop,
      district: label.district,
      province: label.province,
      planting_date: null,
      growth_stage: null,
      farmer_description: null,
    },
    [{ mimeType: 'image/jpeg', data: readFileSync(join(dir, label.file)).toString('base64') }]
  )
  const run = await runDiagnosis(generateFor(), request, { modelId: env.geminiModel })
  // Throws if routing or band mapping would store something invalid.
  const records = diagnosisRecords(run, prompt.version, new Date().toISOString())
  const row = {
    file: label.file,
    expect: label.expect,
    valid: run.output !== null,
    attempts: run.attempts,
    issue: records.diagnosis.suspected_issue,
    band: records.diagnosis.confidence_band,
    severity: records.diagnosis.severity_band,
    routed: records.diagnosis.expert_review_reason,
    status: records.status,
    match: records.diagnosis.suspected_issue === label.expect,
    ms: Date.now() - started,
  }
  rows.push({ ...row, internal: records.internal })
  console.log(
    [
      row.file.padEnd(24),
      `valid=${row.valid ? 'Y' : 'N'} x${row.attempts}`,
      `${row.issue}${row.match ? '' : ` (expected ${row.expect})`}`.padEnd(42),
      `band=${row.band}`.padEnd(12),
      `routed=${row.routed ?? '-'}`.padEnd(30),
      `${(row.ms / 1000).toFixed(1)}s`,
    ].join('  ')
  )
}

const n = rows.length
const summary = {
  model: env.geminiModel,
  prompt: prompt.version,
  inject: inject ?? 'none',
  images: n,
  schemaValid: rows.filter(r => r.valid).length,
  validFirstAttempt: rows.filter(r => r.valid && r.attempts === 1).length,
  routedToExperts: rows.filter(r => r.routed).length,
  issueMatches: rows.filter(r => r.match).length,
  maxSeconds: Math.max(...rows.map(r => r.ms)) / 1000,
}
console.log('\n' + JSON.stringify(summary, null, 2))
if (out) writeFileSync(out, JSON.stringify({ summary, rows }, null, 2))

import type { Context, Hono, MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { DeliveryInputSchema, type ErrorResponse } from '@repo/shared'
import type { Caller } from '../services/observationModel'
import type { EnrolService } from '../services/ceih/enrol'
import { SeasonError, type SeasonService } from '../services/ceih/season'

// CEIH REST additions to /api/v1 (docs/ceih-overnight-plan.md, Phase 2; additive only). The same
// service as the dashboard's tRPC routes, so the rules hold whichever door a request comes in by.
// The org is the caller's own; a Command Center account names it with ?org_id=.

type Env = { Variables: { caller: Caller } }

export interface CeihRestServices {
  season: SeasonService
  enrol: EnrolService
}

const fail = (c: Context, status: 400 | 403 | 404 | 409, body: ErrorResponse) =>
  c.json(body, status)

async function handle(c: Context<Env>, work: (caller: Caller, orgId: string) => Promise<unknown>) {
  const caller = c.get('caller')
  const orgId = c.req.query('org_id') ?? caller.orgId
  if (!orgId) return fail(c, 400, { error: 'validation_failed', message: 'org_id is required' })
  try {
    const result = await work(caller, orgId)
    return c.json(result ?? { ok: true })
  } catch (error) {
    if (error instanceof SeasonError)
      return error.code === 'not_found'
        ? fail(c, 404, { error: 'not_found', message: error.message })
        : error.code === 'forbidden'
          ? fail(c, 403, { error: 'forbidden', message: error.message })
          : fail(c, 409, { error: 'conflict', message: error.message })
    if (error instanceof z.ZodError)
      return fail(c, 400, {
        error: 'validation_failed',
        issues: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      })
    throw error
  }
}

const body = async (c: Context) => (await c.req.json().catch(() => null)) as unknown

export function mountCeih(
  app: Hono<Env>,
  services: CeihRestServices,
  requireCaller: MiddlewareHandler<Env>
) {
  const { season, enrol } = services

  app.post('/farmers', requireCaller, c =>
    handle(c, async (caller, orgId) => enrol.createFarmer(caller, orgId, await body(c)))
  )
  app.post('/contracts/import', requireCaller, c =>
    handle(c, async (caller, orgId) => enrol.importContracts(caller, orgId, await c.req.text()))
  )
  app.post('/contracts/:id/inputs', requireCaller, c =>
    handle(c, async (caller, orgId) =>
      enrol.recordInputs(
        caller,
        orgId,
        c.req.param('id'),
        z
          .object({
            code: z
              .string()
              .regex(/^\d{6}$/)
              .optional(),
          })
          .parse((await body(c)) ?? {}).code
      )
    )
  )
  app.get('/farmers/:id/eligibility', requireCaller, c =>
    handle(c, (caller, orgId) => season.eligibility(caller, orgId, c.req.param('id')))
  )
  app.post('/advances', requireCaller, c =>
    handle(c, async (caller, orgId) => {
      const input = z
        .object({
          contract_id: z.string().min(1).max(128),
          amount_zmw: z.number().int().positive().optional(),
        })
        .parse(await body(c))
      return season.requestAdvance(caller, orgId, input.contract_id, input.amount_zmw)
    })
  )
  app.post('/advances/:id/confirm', requireCaller, c =>
    handle(c, async (caller, orgId) => {
      const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(await body(c))
      return season.confirmAdvance(caller, orgId, c.req.param('id'), code)
    })
  )
  app.post('/advances/:id/approve', requireCaller, c =>
    handle(c, (caller, orgId) => season.approveAdvance(caller, orgId, c.req.param('id')))
  )
  app.post('/advances/:id/disburse', requireCaller, c =>
    handle(c, (caller, orgId) => season.disburse(caller, orgId, c.req.param('id')))
  )
  app.post('/deliveries', requireCaller, c =>
    handle(c, async (caller, orgId) =>
      season.recordDelivery(caller, orgId, DeliveryInputSchema.parse(await body(c)))
    )
  )
  app.get('/contracts/:id/statement', requireCaller, c =>
    handle(c, (caller, orgId) => season.statement(caller, orgId, c.req.param('id')))
  )
  app.get('/contracts/:id/satellite', requireCaller, c =>
    handle(c, async (caller, orgId) => {
      const card = await season.fieldCard(caller, orgId, c.req.param('id'))
      return {
        contract_id: card.contract_id,
        status: card.status,
        source: card.curve_source,
        curve: card.curve,
        sim: card.sim,
      }
    })
  )
  app.post('/satellite/ingest', requireCaller, c =>
    handle(c, async (caller, orgId) => enrol.ingestPasses(caller, orgId, await body(c)))
  )
  app.post('/triggers/evaluate', requireCaller, c =>
    handle(c, (caller, orgId) => season.evaluateTriggers(caller, orgId))
  )
  // Camp level only: no farmer rows, no locations (acceptance 7).
  app.get('/org/:id/portfolio', requireCaller, c =>
    handle(c, async caller => {
      const p = await season.portfolio(caller, c.req.param('id'))
      return {
        org_id: p.org_id,
        name: p.name,
        season: p.season,
        today: p.today,
        contracts: p.contracts,
        projected_value_zmw: p.projected_value_zmw,
        input_loans_zmw: p.input_loans_zmw,
        advances_out_zmw: p.advances_out_zmw,
        recovered_zmw: p.recovered_zmw,
        shock_camps: p.shock_camps,
        verified: p.verified,
        eligible: p.eligible,
        awaiting_approval: p.awaiting_approval,
        camps: p.camps.map(camp => {
          const rows = p.rows.filter(r => r.camp === camp)
          return {
            camp,
            contracts: rows.length,
            verified: rows.filter(
              r => r.verified.state === 'satellite' || r.verified.state === 'officer'
            ).length,
            eligible: rows.filter(r => r.eligible).length,
            exposure_zmw: rows.reduce((n, r) => n + r.exposure_zmw, 0),
            shock: rows.some(r => r.shock),
          }
        }),
        sim: p.sim,
      }
    })
  )
}

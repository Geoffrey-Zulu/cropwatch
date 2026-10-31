import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  ApprovalSchema,
  DeliveryInputSchema,
  FieldCardSchema,
  PortfolioSchema,
  ReconciliationSchema,
  SeasonPhaseSchema,
  SmsLogViewSchema,
  StatementSchema,
} from '@repo/shared'
import { SeasonError } from '../../services/ceih/season'
import { router, signedInProcedure } from '../trpc'

// CEIH (docs/ceih-overnight-plan.md, Phase 3): the Outgrower View's season ledger, approvals and
// reconciliation. Outputs are parsed against the shared view schemas, which have no field for a
// pin, a polygon, a full phone number or a code. Who may do what is checked in the service.

const Org = z.object({ orgId: z.string().min(1).max(128) })
const Id = z.string().min(1).max(128)

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (error instanceof SeasonError)
      throw new TRPCError({
        code:
          error.code === 'not_found'
            ? 'NOT_FOUND'
            : error.code === 'forbidden'
              ? 'FORBIDDEN'
              : 'BAD_REQUEST',
        message: error.message,
      })
    throw error
  }
}

export const seasonRouter = router({
  portfolio: signedInProcedure
    .input(Org)
    .output(PortfolioSchema)
    .query(({ ctx, input }) => run(() => ctx.services.season.portfolio(ctx.caller, input.orgId))),

  fieldCard: signedInProcedure
    .input(Org.extend({ contractId: Id }))
    .output(FieldCardSchema)
    .query(({ ctx, input }) =>
      run(() => ctx.services.season.fieldCard(ctx.caller, input.orgId, input.contractId))
    ),

  approvals: signedInProcedure
    .input(Org)
    .output(z.array(ApprovalSchema))
    .query(({ ctx, input }) => run(() => ctx.services.season.approvals(ctx.caller, input.orgId))),

  statement: signedInProcedure
    .input(Org.extend({ contractId: Id }))
    .output(StatementSchema)
    .query(({ ctx, input }) =>
      run(() => ctx.services.season.statement(ctx.caller, input.orgId, input.contractId))
    ),

  reconciliation: signedInProcedure
    .input(Org)
    .output(ReconciliationSchema)
    .query(({ ctx, input }) =>
      run(() => ctx.services.season.reconciliation(ctx.caller, input.orgId))
    ),

  smsLog: signedInProcedure
    .input(Org)
    .output(z.array(SmsLogViewSchema))
    .query(({ ctx, input }) => run(() => ctx.services.season.smsLog(ctx.caller, input.orgId))),

  requestAdvance: signedInProcedure
    .input(
      Org.extend({ contractId: Id, amountZmw: z.number().int().positive().max(100_000).optional() })
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        ctx.services.season.requestAdvance(
          ctx.caller,
          input.orgId,
          input.contractId,
          input.amountZmw
        )
      )
    ),

  confirmAdvance: signedInProcedure
    .input(Org.extend({ advanceId: Id, code: z.string().regex(/^\d{6}$/) }))
    .mutation(({ ctx, input }) =>
      run(() =>
        ctx.services.season.confirmAdvance(ctx.caller, input.orgId, input.advanceId, input.code)
      )
    ),

  approveAdvance: signedInProcedure
    .input(Org.extend({ advanceId: Id }))
    .mutation(({ ctx, input }) =>
      run(() => ctx.services.season.approveAdvance(ctx.caller, input.orgId, input.advanceId))
    ),

  declineAdvance: signedInProcedure
    .input(Org.extend({ advanceId: Id, reason: z.string().trim().min(3).max(300) }))
    .mutation(({ ctx, input }) =>
      run(() =>
        ctx.services.season.declineAdvance(ctx.caller, input.orgId, input.advanceId, input.reason)
      )
    ),

  recordDelivery: signedInProcedure
    .input(Org.merge(DeliveryInputSchema))
    .output(StatementSchema)
    .mutation(({ ctx, input }) => {
      const { orgId, ...delivery } = input
      return run(() => ctx.services.season.recordDelivery(ctx.caller, orgId, delivery))
    }),

  evaluateTriggers: signedInProcedure
    .input(Org)
    .mutation(({ ctx, input }) =>
      run(() => ctx.services.season.evaluateTriggers(ctx.caller, input.orgId))
    ),

  // Demo controls: drive the storyline from the dashboard (simulated seasons only).
  demo: router({
    setPhase: signedInProcedure
      .input(Org.extend({ phase: SeasonPhaseSchema }))
      .mutation(({ ctx, input }) =>
        run(() => ctx.services.season.setPhase(ctx.caller, input.orgId, input.phase))
      ),
    groundCheck: signedInProcedure
      .input(Org)
      .mutation(({ ctx, input }) =>
        run(() => ctx.services.season.groundCheck(ctx.caller, input.orgId))
      ),
  }),
})

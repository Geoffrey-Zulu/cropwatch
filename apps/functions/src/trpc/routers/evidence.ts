import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { ObservationEvidenceSchema, ObservationIdSchema } from '@repo/shared'
import { commandCenterProcedure, router } from '../trpc'

// Observation detail, Evidence panel: what the diagnosis and the recommendation rested on.
export const evidenceRouter = router({
  observation: commandCenterProcedure
    .input(z.object({ obsId: ObservationIdSchema }))
    .output(ObservationEvidenceSchema)
    .query(async ({ ctx, input }) => {
      const evidence = await ctx.services.evidence(input.obsId)
      if (!evidence) throw new TRPCError({ code: 'NOT_FOUND' })
      return evidence
    }),
})

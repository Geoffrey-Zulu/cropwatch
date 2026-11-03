import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { COMMAND_CENTER_ROLES, OutgrowerOverviewSchema } from '@repo/shared'
import { router, signedInProcedure } from '../trpc'

// Outgrower View: camp and district aggregates and per-officer visit lists for one org. Command
// Center roles, or a field officer of that org. Never a farm location (CLAUDE.md invariant 6).
export const outgrowerRouter = router({
  overview: signedInProcedure
    .input(z.object({ orgId: z.string().min(1).max(128) }))
    .output(OutgrowerOverviewSchema)
    .query(async ({ ctx, input }) => {
      const { caller } = ctx
      const allowed =
        COMMAND_CENTER_ROLES.includes(caller.role) ||
        (caller.role === 'field_officer' && caller.orgId === input.orgId)
      if (!allowed) throw new TRPCError({ code: 'FORBIDDEN' })
      const overview = await ctx.services.outgrower(input.orgId)
      if (!overview) throw new TRPCError({ code: 'NOT_FOUND' })
      return overview
    }),
})

import { initTRPC, TRPCError } from '@trpc/server'
import { COMMAND_CENTER_ROLES } from '@repo/shared'
import type { Caller } from '../services/observationModel'
import type { DashboardServices } from '../services/dashboard/types'

// The dashboard's tRPC context: the caller from a verified Firebase ID token (null when absent
// or invalid), and the services the dashboard reads through the API rather than Firestore.
export interface TrpcContext {
  caller: Caller | null
  services: DashboardServices
}

const t = initTRPC.context<TrpcContext>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const createCallerFactory = t.createCallerFactory

export const signedInProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.caller) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { ...ctx, caller: ctx.caller } })
})

export const commandCenterProcedure = signedInProcedure.use(({ ctx, next }) => {
  if (!COMMAND_CENTER_ROLES.includes(ctx.caller.role)) throw new TRPCError({ code: 'FORBIDDEN' })
  return next()
})

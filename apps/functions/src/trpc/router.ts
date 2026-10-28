import { router } from './trpc'
import { evidenceRouter } from './routers/evidence'
import { outgrowerRouter } from './routers/outgrower'
import { userRouter } from './routers/user'
import { weatherRouter } from './routers/weather'

export const appRouter = router({
  user: userRouter,
  evidence: evidenceRouter,
  outgrower: outgrowerRouter,
  weather: weatherRouter,
})

export type AppRouter = typeof appRouter

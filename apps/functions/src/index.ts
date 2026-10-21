// Library entry point. The deployable server lives in ./server.ts (Hono on Cloud Run).
export { appRouter, type AppRouter } from './trpc/router'
export { createApp, type AppOptions } from './app'

import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@repo/functions/router'
import { API_BASE } from './apiBase'
import { auth } from './firebase'

export const trpc = createTRPCReact<AppRouter>()

// Every call carries the officer's Firebase ID token; the API checks the role claim.
export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE}/trpc`,
      async headers() {
        const token = await auth.currentUser?.getIdToken()
        return token ? { authorization: `Bearer ${token}` } : {}
      },
    }),
  ],
})

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { useCallback, useEffect, useState } from 'react'
import { COMMAND_CENTER_ROLES, RoleSchema, type Role } from '@repo/shared'
import { auth } from '../lib/firebase'

export interface Officer {
  user: User
  email: string
  role: Role
  orgId: string | null
  commandCenter: boolean
}

// Officers sign in with email and password; the role and org come from the custom claims the
// API and the security rules also check (tools/admin set-role).
export function useAuth() {
  const [officer, setOfficer] = useState<Officer | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(
    () =>
      onAuthStateChanged(auth, async user => {
        if (!user) {
          setOfficer(null)
          setReady(true)
          return
        }
        const { claims } = await user.getIdTokenResult()
        const role = RoleSchema.safeParse(claims.role)
        const resolved = role.success ? role.data : 'farmer'
        setOfficer({
          user,
          email: user.email ?? 'anonymous',
          role: resolved,
          orgId: typeof claims.org_id === 'string' ? claims.org_id : null,
          commandCenter: COMMAND_CENTER_ROLES.includes(resolved),
        })
        setReady(true)
      }),
    []
  )

  const signIn = useCallback(
    (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    []
  )
  const signOut = useCallback(() => firebaseSignOut(auth), [])

  return { officer, ready, signIn, signOut }
}

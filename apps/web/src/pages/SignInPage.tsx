import { LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'

// Officers only: email and password accounts with a role claim (tools/admin set-role).
export function SignInPage({
  signedInAsFarmer,
  onSignIn,
  onSignOut,
}: {
  signedInAsFarmer: boolean
  onSignIn: (email: string, password: string) => Promise<unknown>
  onSignOut: () => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim(), password)
    } catch {
      setError(
        'That email and password did not work. Check them, or ask an admin for an officer account.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="h-3 w-3 rounded-full bg-copper" />
          <span className="font-display text-[26px] font-semibold uppercase tracking-[0.14em] text-navy">
            Phytos
          </span>
        </div>
        <h1 className="font-display text-display font-semibold text-navy">Command Center</h1>
        <p className="mt-1 text-body-sm text-ink-2">
          A prototype for extension officers, agronomists and outgrower field teams in Zambia.
        </p>

        {signedInAsFarmer ? (
          <div className="mt-6 rounded-card border border-line bg-sheet p-4">
            <p className="text-body-sm">
              This account has no officer role. Sign out and sign in with an officer account.
            </p>
            <button type="button" className="btn-quiet mt-3" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Email</span>
              <input
                className="field"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="eyebrow">Password</span>
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-label font-semibold text-copper-deep">
                {error}
              </p>
            )}
            <button type="submit" className="btn-primary mt-1" disabled={busy}>
              <LogIn size={18} strokeWidth={2} aria-hidden />
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

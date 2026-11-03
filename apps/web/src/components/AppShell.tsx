import { Building2, LogOut } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PhytosLogo } from './PhytosLogo'

// The frame in mockup A's language (Field-airy): a white header with the Phytos lockup, the four
// screens as pills beside it (the current one field green on its tint), and on the right the
// presenter's gear and the account avatar (initials, never a raw email in the chrome). The
// header is sticky, so the screens stay in reach on scroll. Below 1024 px the screens move to a
// pill strip under the header that scrolls sideways. The Fields map is a full-bleed stage; the
// other screens sit on the cream canvas at a readable width.
export function AppShell({
  email,
  role,
  onSignOut,
  nav,
  actions,
  bleed = false,
  children,
}: {
  email: string
  role: string
  onSignOut: () => void
  // The screens: links, shown in the header and in the phone strip.
  nav?: ReactNode
  // Before the avatar (the season controls' gear).
  actions?: ReactNode
  // The page is a map that fills the screen under the header: no column, no padding.
  bleed?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-30">
        <header className="relative flex h-[3.75rem] items-center gap-3 bg-panel px-4 shadow-[0_1px_0_rgb(27_41_32/0.06),0_10px_26px_-18px_rgb(27_41_32/0.3)] md:gap-8 md:px-[1.6rem]">
          <a
            href="#/outgrower/fields"
            aria-label="Phytos: Fields map"
            className="shrink-0 rounded-card"
          >
            <PhytosLogo />
          </a>
          {/* Which of the two apps the room is looking at (the other: the farmer dashboard). */}
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-well px-3 py-1 text-caption font-semibold text-fg shadow-[inset_0_0_0_1px_var(--hairline)]">
            <Building2 size={14} aria-hidden className="text-signal" />
            Agro dashboard
          </span>
          {nav && (
            <nav aria-label="Screens" className="hidden min-w-0 items-center gap-[0.2rem] lg:flex">
              {nav}
            </nav>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-3">
            {actions}
            <AccountMenu email={email} role={role} onSignOut={onSignOut} />
          </div>
        </header>
        {nav && (
          <nav
            aria-label="Screens"
            data-screens-strip
            className="flex gap-[0.2rem] overflow-x-auto bg-panel px-3 pb-[0.6rem] pt-[0.55rem] shadow-[0_1px_0_rgb(27_41_32/0.06)] [scrollbar-width:none] lg:hidden"
          >
            {nav}
          </nav>
        )}
      </div>
      <main className={`canvas min-w-0 flex-1 ${bleed ? '' : 'px-4 py-6 md:px-[1.6rem] md:py-8'}`}>
        {bleed ? children : <div className="mx-auto max-w-[1320px]">{children}</div>}
      </main>
    </div>
  )
}

// "agronomist@…" reads "AG"; "jane.banda@…" reads "JB".
export function initials(email: string) {
  const parts = email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

const roleName = (role: string) => {
  const words = role.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// The account: initials in a circle; the email and role only inside the menu.
function AccountMenu({
  email,
  role,
  onSignOut,
}: {
  email: string
  role: string
  onSignOut: () => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !box.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${roleName(role)}`}
        onClick={() => setOpen(o => !o)}
        className="flex items-center rounded-pill p-0.5 transition-colors duration-200 ease-out hover:bg-well"
      >
        <span className="grid h-[2.3rem] w-[2.3rem] place-items-center rounded-pill bg-[#EFE6D1] text-[0.85rem] font-bold tracking-[0.02em] text-[#4A3B1A]">
          {initials(email)}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="slide-in absolute right-0 top-full z-40 mt-2 w-64 rounded-card bg-panel p-2 shadow-island"
        >
          <div className="px-2 pb-2 pt-1">
            <p className="break-all text-label font-semibold text-fg">{email}</p>
            <p className="meta mt-0.5">{roleName(role)}</p>
          </div>
          <div className="border-t border-hairline pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              className="flex w-full items-center gap-2 rounded-card px-2 py-2 text-left text-label text-fg hover:bg-well"
            >
              <LogOut aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

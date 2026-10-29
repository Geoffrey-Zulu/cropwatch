import {
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  Map,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { hrefFor, type Route } from '../hooks/useRoute'
import { SCENARIO_ENABLED } from '../lib/features'

interface NavItem {
  page: Route['page']
  label: string
  icon: LucideIcon
  route: Route
  commandCenterOnly: boolean
}

const NAV: NavItem[] = [
  {
    page: 'map',
    label: 'National map',
    icon: Map,
    route: { page: 'map' },
    commandCenterOnly: true,
  },
  {
    page: 'queue',
    label: 'Officer queue',
    icon: ClipboardCheck,
    route: { page: 'queue' },
    commandCenterOnly: true,
  },
  {
    page: 'outgrower',
    label: 'Outgrower View',
    icon: Users,
    route: { page: 'outgrower' },
    commandCenterOnly: false,
  },
  ...(SCENARIO_ENABLED
    ? [
        {
          page: 'scenario',
          label: 'Dry-spell scenario',
          icon: Sun,
          route: { page: 'scenario' },
          commandCenterOnly: true,
        } satisfies NavItem,
      ]
    : []),
  {
    page: 'sources',
    label: 'Knowledge sources',
    icon: BookOpen,
    route: { page: 'sources' },
    commandCenterOnly: false,
  },
]

// The Command Center frame (patterns.md): the wordmark on its chip and a small prototype badge on
// the left; the live verified count and the account menu (initials, never a raw email in the
// chrome) on the right; sentence-case navigation with a chartreuse bar on the current page; the
// page at a readable maximum width.
export function AppShell({
  active,
  commandCenter,
  email,
  role,
  verified,
  queue,
  onSignOut,
  children,
}: {
  active: Route['page']
  commandCenter: boolean
  email: string
  role: string
  verified: number | null
  queue: number | null
  onSignOut: () => void
  children: ReactNode
}) {
  const items = NAV.filter(item => commandCenter || !item.commandCenterOnly)
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-hairline bg-panel">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
          <a href="#/" className="flex items-center gap-3" aria-label="Phytos Command Center">
            <span className="rounded-tag bg-chip px-2.5 py-1.5 font-display text-[16px] font-extrabold uppercase leading-none tracking-[0.16em] text-chip-fg">
              Phytos
            </span>
            <span className="hidden text-label font-semibold text-fg sm:inline">
              Command Center
            </span>
          </a>
          <span className="rounded-tag border border-attention px-1 font-mono text-[10px] font-semibold uppercase leading-4 tracking-[0.1em] text-attention-text">
            Prototype
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {verified !== null && <VerifiedChip count={verified} />}
            <AccountMenu email={email} role={role} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      <div className="lg:flex">
        <nav
          aria-label="Pages"
          className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-hairline bg-ground px-2 py-2 lg:h-[calc(100dvh-56px)] lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
        >
          {items.map(item => {
            const current = item.page === active
            return (
              <a
                key={item.page}
                href={hrefFor(item.route)}
                aria-current={current ? 'page' : undefined}
                className={`relative flex shrink-0 items-center gap-2.5 rounded-card px-3 py-2 text-label transition-colors ${
                  current
                    ? 'bg-signal-tint font-semibold text-fg'
                    : 'font-medium text-fg-2 hover:bg-well hover:text-fg'
                }`}
              >
                {current && (
                  <span
                    aria-hidden
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-signal max-lg:inset-x-3 max-lg:bottom-0 max-lg:top-auto max-lg:h-[3px] max-lg:w-auto"
                  />
                )}
                <item.icon size={18} strokeWidth={2} aria-hidden />
                {item.label}
                {item.page === 'queue' && queue !== null && queue > 0 && (
                  <span className="ml-auto rounded-full bg-well px-2 text-caption font-medium text-fg-2">
                    {queue}
                  </span>
                )}
              </a>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

// The live count of officer-verified observations: the moat, ticking as officers verify.
function VerifiedChip({ count }: { count: number }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-hairline bg-ground py-1 pl-2 pr-2.5 sm:gap-2 sm:pl-2.5 sm:pr-3"
      aria-live="polite"
    >
      <span aria-hidden className="h-2 w-2 rounded-full bg-leaf" />
      <span
        key={count}
        className="animate-tag font-display text-[17px] font-bold leading-none text-fg"
      >
        {count}
      </span>
      <span className="text-caption text-fg-2">
        verified<span className="hidden sm:inline"> observations</span>
      </span>
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
        className="flex items-center gap-1 rounded-full p-0.5 pr-1.5 hover:bg-well"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fg text-caption font-semibold text-ground">
          {initials(email)}
        </span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden className="hidden text-fg-2 sm:block" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 rounded-card border border-hairline bg-panel p-2 shadow-raise"
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
              <LogOut size={16} strokeWidth={2} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

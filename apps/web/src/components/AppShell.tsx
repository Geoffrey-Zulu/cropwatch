import {
  Bell,
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
import { hrefFor, useDrawerLinks, type Route } from '../hooks/useRoute'
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
// chrome) on the right; the page at a readable maximum width. Navigation is a slim icon rail on
// wide screens (v2.1, after OneSoil) with the page name as a tooltip, and the current page a
// filled icon with a bar, so the width goes to the map; phones keep a labelled strip.
export function AppShell({
  active,
  commandCenter,
  email,
  role,
  verified,
  queue,
  newAlerts = null,
  onSignOut,
  children,
}: {
  active: Route['page']
  commandCenter: boolean
  email: string
  role: string
  verified: number | null
  queue: number | null
  // Alerts raised in the last 24 hours, for the bell; null hides the bell.
  newAlerts?: number | null
  onSignOut: () => void
  children: ReactNode
}) {
  const items = NAV.filter(item => commandCenter || !item.commandCenterOnly)
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-hairline bg-panel">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:px-6">
          <a href="#/" className="flex items-center gap-3" aria-label="Phytos Command Center">
            <span className="rounded-tag bg-chip px-2 py-1 font-wordmark text-[15px] font-extrabold uppercase leading-none tracking-[0.16em] text-chip-fg">
              Phytos
            </span>
            <span className="hidden text-label font-medium text-fg sm:inline">Command Center</span>
          </a>
          <span className="rounded bg-well px-1.5 text-caption font-medium text-fg-2">
            Prototype
          </span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            {verified !== null && <VerifiedChip count={verified} />}
            {newAlerts !== null && <AlertsBell count={newAlerts} />}
            <AccountMenu email={email} role={role} onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      <div className="lg:flex">
        <nav
          aria-label="Pages"
          className="sticky top-14 z-20 flex gap-0.5 overflow-x-auto bg-well px-2 py-2 lg:h-[calc(100dvh-56px)] lg:w-14 lg:shrink-0 lg:flex-col lg:items-center lg:gap-1 lg:overflow-visible lg:py-3"
        >
          {items.map(item => {
            const current = item.page === active
            const count = item.page === 'queue' && queue !== null && queue > 0 ? queue : null
            return (
              <a
                key={item.page}
                href={hrefFor(item.route)}
                aria-current={current ? 'page' : undefined}
                className={`group relative flex shrink-0 items-center gap-2.5 rounded-card px-3 py-1.5 text-label font-medium transition-colors lg:h-10 lg:w-10 lg:justify-center lg:p-0 ${
                  current ? 'text-signal-text' : 'text-fg-2 hover:bg-panel hover:text-fg'
                }`}
              >
                {current && (
                  <span
                    aria-hidden
                    className="absolute bg-signal max-lg:inset-x-3 max-lg:bottom-0 max-lg:h-[3px] max-lg:rounded-full lg:-left-2 lg:inset-y-1.5 lg:w-[3px] lg:rounded-r-full"
                  />
                )}
                <span className="relative inline-flex">
                  <item.icon
                    strokeWidth={2}
                    aria-hidden
                    className="h-4 w-4 lg:h-5 lg:w-5"
                    fill={current ? 'currentColor' : 'none'}
                    fillOpacity={current ? 0.22 : undefined}
                  />
                  {count !== null && (
                    <span
                      aria-hidden
                      className="absolute -right-2.5 -top-2 hidden min-w-[18px] rounded-full bg-fg px-1 text-center text-[11px] font-semibold leading-[18px] text-ground lg:block"
                    >
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                <span className="lg:sr-only">
                  {item.label}
                  {count !== null && <span className="sr-only">, {count} waiting</span>}
                </span>
                {count !== null && (
                  <span
                    aria-hidden
                    className="ml-auto text-caption font-medium tabular-nums text-fg-2 lg:hidden"
                  >
                    {count}
                  </span>
                )}
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-card bg-fg px-2.5 py-1.5 text-caption font-medium text-ground shadow-raise lg:group-hover:block lg:group-focus-visible:block"
                >
                  {item.label}
                  {count !== null ? ` · ${count} waiting` : ''}
                </span>
              </a>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {/* The map page is the projector view: it takes a 1080p screen's width too. */}
          <div className={`mx-auto ${active === 'map' ? 'max-w-[1760px]' : 'max-w-[1320px]'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// The alerts live behind the bell (patterns-v2.md): the map page answers one question.
function AlertsBell({ count }: { count: number }) {
  const { open } = useDrawerLinks()
  return (
    <a
      href={open({ kind: 'alerts' })}
      aria-label={count ? `Alerts: ${count} in the last 24 hours` : 'Alerts'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-fg hover:bg-well"
    >
      <Bell size={20} strokeWidth={2} aria-hidden />
      {count > 0 && (
        <span className="absolute right-0 top-0 min-w-[18px] rounded-full bg-fg px-1 text-center text-[11px] font-semibold leading-[18px] text-ground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </a>
  )
}

// The live count of officer-verified observations: the moat, ticking as officers verify.
function VerifiedChip({ count }: { count: number }) {
  return (
    <div
      className="flex items-baseline gap-1.5"
      aria-live="polite"
      aria-label={`${count} verified observations`}
    >
      <span key={count} className="animate-tag text-label font-semibold tabular-nums text-fg">
        {count}
      </span>
      <span className="hidden text-caption text-fg-2 sm:inline">verified observations</span>
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

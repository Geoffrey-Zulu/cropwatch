import {
  Bell,
  BookOpen,
  CircleCheck,
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
import { CountUp } from '../hooks/useCountUp'
import { PhytosLogo } from './PhytosLogo'

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

// The Command Center frame in mockup A's language (Field-airy, chosen 30 Oct): a white header
// with the Phytos lockup, the pages as pills (the current one field green on its tint), and on
// the right the live verified count, the bell and the account avatar (initials, never a raw
// email in the chrome). Phones keep the lockup, bell and avatar in the header and move the pages
// to a scrolling pill strip under it. The map page is a full-bleed stage; every other page sits
// on the cream canvas at a readable width. The DEMO badge is never in the chrome: each view
// shows it on the data it marks (CLAUDE.md invariant 5).
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
  const links = (strip: boolean) =>
    items.map(item => {
      const current = item.page === active
      const count = item.page === 'queue' && queue !== null && queue > 0 ? queue : null
      return (
        <a
          key={item.page}
          href={hrefFor(item.route)}
          aria-current={current ? 'page' : undefined}
          className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill text-[0.95rem] transition-colors duration-200 ease-out ${
            strip ? 'px-[0.85rem] py-[0.6rem]' : 'px-[0.85rem] py-2'
          } ${
            current
              ? 'bg-signal-tint font-semibold text-signal-text'
              : 'font-medium text-fg-2 hover:bg-well hover:text-fg'
          }`}
        >
          {item.label}
          {count !== null && (
            <span className="inline-grid h-[1.3rem] min-w-[1.6rem] place-items-center rounded-pill bg-[#EDF0E8] px-1.5 text-[0.78rem] font-bold tabular-nums text-fg">
              <span className="sr-only">, </span>
              {count > 999 ? '999+' : count}
              <span className="sr-only"> waiting</span>
            </span>
          )}
        </a>
      )
    })
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-30">
        <header className="relative flex h-[3.75rem] items-center gap-3 bg-panel px-4 shadow-[0_1px_0_rgb(27_41_32/0.06),0_10px_26px_-18px_rgb(27_41_32/0.3)] md:gap-8 md:px-[1.6rem]">
          <a href="#/" aria-label="Phytos: national map" className="shrink-0 rounded-card">
            <PhytosLogo />
          </a>
          <nav aria-label="Pages" className="hidden min-w-0 items-center gap-[0.2rem] lg:flex">
            {links(false)}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-4">
            {verified !== null && <VerifiedCount count={verified} />}
            {newAlerts !== null && <AlertsBell count={newAlerts} />}
            <AccountMenu email={email} role={role} onSignOut={onSignOut} />
          </div>
        </header>
        <nav
          aria-label="Pages"
          className="flex gap-[0.2rem] overflow-x-auto bg-panel px-3 pb-[0.6rem] pt-[0.55rem] shadow-[0_1px_0_rgb(27_41_32/0.06)] [scrollbar-width:none] lg:hidden"
        >
          {links(true)}
        </nav>
      </div>
      <main
        className={`canvas min-w-0 flex-1 ${active === 'map' ? '' : 'px-4 py-6 md:px-[1.6rem] md:py-8'}`}
      >
        {active === 'map' ? children : <div className="mx-auto max-w-[1320px]">{children}</div>}
      </main>
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
      className="relative inline-grid h-10 w-10 place-items-center rounded-pill text-fg transition-colors duration-200 ease-out hover:bg-well"
    >
      <Bell aria-hidden />
      {count > 0 && (
        <span className="absolute right-[0.15rem] top-[0.2rem] h-[1.1rem] min-w-[1.1rem] rounded-pill bg-fg px-[0.3rem] text-center text-[0.7rem] font-bold leading-[1.1rem] text-white shadow-[0_0_0_2px_#fff]">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </a>
  )
}

// The live count of officer-verified observations: the moat, counting up as officers verify.
function VerifiedCount({ count }: { count: number }) {
  return (
    <div
      className="hidden items-center gap-2 whitespace-nowrap text-[0.95rem] text-fg-2 md:inline-flex"
      aria-live="polite"
      aria-label={`${count} verified observations`}
    >
      <CircleCheck aria-hidden className="h-[1.15rem] w-[1.15rem] text-signal" />
      <span>
        <b className="font-bold tabular-nums text-fg">
          <CountUp value={count} />
        </b>{' '}
        verified observations
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

import { BookOpen, ClipboardCheck, LogOut, Map, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { hrefFor, type Route } from '../hooks/useRoute'

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
  {
    page: 'sources',
    label: 'Knowledge sources',
    icon: BookOpen,
    route: { page: 'sources' },
    commandCenterOnly: false,
  },
]

// The Command Center frame: navy top bar (wordmark, prototype tag, the live verified counter,
// the officer), page navigation, and the page on paper.
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
      <header className="sticky top-0 z-30 bg-navy text-white">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <a href="#/" className="flex items-center gap-2" aria-label="Phytos Command Center">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-copper-light" />
            <span className="font-display text-[20px] font-semibold uppercase leading-none tracking-[0.14em]">
              Phytos
            </span>
          </a>
          <span className="hidden text-label text-white/90 sm:inline">Command Center</span>
          <span className="rounded-tag border border-copper-light px-1.5 py-0.5 font-mono text-eyebrow font-semibold uppercase text-copper-light">
            Prototype
          </span>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            {verified !== null && <VerifiedCounter count={verified} />}
            <div className="hidden text-right md:block">
              <p className="text-label font-semibold leading-tight">{email}</p>
              <p className="font-mono text-eyebrow uppercase text-white/80">
                {role.replace('_', ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-card px-2 text-label font-semibold text-white hover:bg-navy-2"
            >
              <LogOut size={18} strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="lg:flex">
        <nav
          aria-label="Pages"
          className="sticky top-14 z-20 flex gap-1 overflow-x-auto border-b border-line bg-paper px-2 py-2 lg:h-[calc(100dvh-56px)] lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
        >
          {items.map(item => {
            const current = item.page === active
            return (
              <a
                key={item.page}
                href={hrefFor(item.route)}
                aria-current={current ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-card px-3 py-2 text-label font-semibold transition-colors ${
                  current ? 'bg-navy text-white' : 'text-navy hover:bg-navy-tint'
                }`}
              >
                <item.icon size={18} strokeWidth={2} aria-hidden />
                {item.label}
                {item.page === 'queue' && queue !== null && queue > 0 && (
                  <span
                    className={`ml-auto rounded-tag px-1.5 font-mono text-eyebrow font-semibold ${current ? 'bg-white text-navy' : 'bg-copper-tint text-copper-deep'}`}
                  >
                    {queue}
                  </span>
                )}
              </a>
            )
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  )
}

// The live count of officer-verified observations: the moat, ticking as officers verify.
function VerifiedCounter({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span
        key={count}
        className="animate-tag font-display text-[22px] font-semibold leading-none text-copper-light"
      >
        {count}
      </span>
      <span className="font-mono text-eyebrow uppercase leading-tight text-white/90">
        Verified
        <span className="hidden sm:inline">
          <br />
          observations
        </span>
      </span>
    </div>
  )
}

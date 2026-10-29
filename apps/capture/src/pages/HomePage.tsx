import type { User } from 'firebase/auth'
import { Camera, X } from 'lucide-react'
import { findDistrict } from '@repo/shared'
import { AppHeader } from '../components/AppHeader'
import { ActionBar } from '../components/ActionBar'
import { useAreaAlerts } from '../hooks/useAreaAlerts'
import { useMyReports } from '../hooks/useMyReports'
import { usePush } from '../hooks/usePush'
import type { Route } from '../hooks/useRoute'
import { AlertBoardsSection } from '../sections/AlertBoardsSection'
import { MyReportsSection } from '../sections/MyReportsSection'
import { readHomeDistrict } from '../lib/homeDistrict'

export function HomePage({ user, navigate }: { user: User; navigate: (route: Route) => void }) {
  const reports = useMyReports(user.uid)
  // Home district: the latest report's, else the last one chosen on this phone.
  const district = reports?.[0]?.district ?? readHomeDistrict() ?? null
  const slug = district ? (findDistrict(district)?.slug ?? null) : null
  const alerts = useAreaAlerts(slug)
  const push = usePush(user.uid, slug)

  return (
    <>
      <AppHeader district={district} onBack={() => navigate({ page: 'diagnose' })} />
      <main className="mx-auto flex max-w-md flex-col gap-8 px-4 pt-6">
        <div>
          <p className="eyebrow">Crop health · Zambia</p>
          <h1 className="font-display text-display font-bold text-fg">
            Photograph a sick crop. Get advice from Zambian guides.
          </h1>
        </div>

        {push.alert && (
          <div
            role="alert"
            className="flex gap-3 rounded-card border border-attention-text border-l-4 bg-attention-tint p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-eyebrow font-semibold uppercase">
                {push.alert.sim ? 'Demo alert' : 'New alert'}
              </p>
              <p className="text-body font-extrabold">{push.alert.title}</p>
              <p className="text-body">{push.alert.body}</p>
            </div>
            <button
              type="button"
              onClick={push.dismissAlert}
              aria-label="Dismiss alert"
              className="h-10 w-10 shrink-0"
            >
              <X size={24} strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}

        <AlertBoardsSection
          district={district}
          alerts={alerts}
          push={push.state}
          onEnablePush={push.enable}
        />
        <MyReportsSection reports={reports} />
      </main>
      <ActionBar>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate({ page: 'diagnose' })}
        >
          <Camera size={22} strokeWidth={2} aria-hidden />
          Report a sick crop
        </button>
      </ActionBar>
    </>
  )
}

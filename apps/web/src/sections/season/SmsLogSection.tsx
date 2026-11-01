import { MessageSquare } from 'lucide-react'
import type { SmsLogView } from '@repo/shared'
import { DemoBadge } from '../../components/DemoBadge'
import { SkeletonRows } from '../../components/Skeleton'
import { seasonDate, seasonTime } from '../../lib/season'

const STATUS = { sent: 'Sent', logged: 'Logged, not sent', failed: 'Not delivered' } as const

// Every message the season sends or would send, newest first: the demo's SMS beat when no
// gateway is on, and a record of what each farmer was told when it is. The farmer's code is never
// shown here: it is the farmer's consent, and staff must not be able to read it. The number is
// masked too.
export function SmsLogSection({ sms }: { sms: SmsLogView[] | undefined }) {
  return (
    <section aria-labelledby="sms-log" className="island self-start px-[1.3rem] py-[1.2rem]">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="sms-log"
          className="flex items-center gap-2 whitespace-nowrap text-section font-semibold text-fg"
        >
          <MessageSquare size={18} aria-hidden />
          SMS log
        </h2>
        {sms && <DemoBadge small rows={sms} />}
      </div>
      <p className="mt-1 text-caption text-fg-2">
        What the farmers&apos; phones receive
        {sms?.some(s => s.status === 'logged')
          ? '. The gateway is off in the demo: logged, not sent'
          : ''}
      </p>
      {!sms ? (
        <SkeletonRows rows={3} lines={3} label="Loading the SMS log" />
      ) : sms.length === 0 ? (
        <p className="mt-2 text-label text-fg-2">No messages yet.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-3">
          {sms.slice(0, 6).map(s => (
            <li key={s.id}>
              <p className="text-caption text-fg-2">
                {s.farmer_name ?? 'Farmer'} · {s.to_masked} ·{' '}
                {seasonDate(s.season_at).replace(/ \d{4}$/, '')} {seasonTime(s.at)}
              </p>
              <p className="mt-1 rounded-[1rem_1rem_1rem_0.3rem] bg-ground px-3 py-2 text-label leading-[1.45] text-fg shadow-[inset_0_0_0_1px_var(--hairline)]">
                {s.message.replace(/code: \d{6}/, 'code: ••••••')}
              </p>
              <p className="mt-0.5 text-caption text-fg-2">{STATUS[s.status]}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

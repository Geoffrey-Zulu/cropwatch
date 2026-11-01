import {
  Banknote,
  Check,
  CircleCheck,
  CloudOff,
  Package,
  Scan,
  Sparkles,
  Sprout,
  Sun,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { FieldThumb, IMAGERY_CREDIT } from '../../components/FieldThumb'
import {
  CROP_LABELS,
  eligibilityLabel,
  establishmentNdvi,
  zmw,
  type EligibilityFactor,
  type FieldCard,
  type TimelineEntry,
} from '@repo/shared'
import { NdviChart } from '../../components/NdviChart'
import { Bar, Loading } from '../../components/Skeleton'
import { firstName, seasonDate } from '../../lib/season'
import { trpc } from '../../lib/trpc'
import { RequestAdvanceDialog } from './AdvanceDialogs'

// A season ledger row opened (plan §3, Tab 1): the field's curve against its camp, the Verified
// Season Record entry by entry with its source, and the eligibility factors. Rules, never a score.
export function FieldCardSection({
  orgId,
  contractId,
  commandCenter,
  narrow = false,
}: {
  orgId: string
  contractId: string
  commandCenter: boolean
  // One column (in a drawer).
  narrow?: boolean
}) {
  const card = trpc.season.fieldCard.useQuery(
    { orgId, contractId },
    { refetchInterval: 6000, staleTime: 2000 }
  )
  if (card.error)
    return (
      <p className="px-2 py-4 text-label text-fg-2">
        The field card could not load ({card.error.message}).
      </p>
    )
  if (!card.data)
    return (
      <Loading label="Loading the field card">
        <div className="grid gap-6 p-4 lg:grid-cols-[1.3fr_1fr]">
          <Bar className="h-56 w-full rounded-card" />
          <div className="flex flex-col gap-3">
            <Bar className="h-4 w-1/2" />
            <Bar className="h-3.5 w-5/6" />
            <Bar className="h-3.5 w-2/3" />
            <Bar className="h-3.5 w-3/4" />
          </div>
        </div>
      </Loading>
    )
  return (
    <FieldCardView orgId={orgId} card={card.data} commandCenter={commandCenter} narrow={narrow} />
  )
}

const SOURCE_ICON = {
  satellite: Scan,
  officer: UserRound,
  farmer: Sprout,
  ai: Sparkles,
} as const
const KIND_ICON: Partial<Record<TimelineEntry['kind'], typeof Package>> = {
  inputs: Package,
  advance: Banknote,
  delivery: Truck,
  shock: Sun,
}

export function FieldCardView({
  orgId,
  card,
  commandCenter,
  narrow = false,
}: {
  orgId: string
  card: FieldCard
  commandCenter: boolean
  narrow?: boolean
}) {
  const [requesting, setRequesting] = useState(false)
  const e = card.eligibility
  const advance = card.advance
  const open = advance && !['declined', 'failed'].includes(advance.state)
  return (
    <div
      className={`grid gap-x-8 gap-y-6 rounded-card bg-panel p-[1.2rem] shadow-[inset_0_0_0_1px_var(--hairline)] md:p-[1.4rem] ${narrow ? '' : 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-section font-semibold text-fg">Greenness from space</h3>
            <p className="text-caption text-fg-2">
              Sentinel-2, a pass a week · planted {seasonDate(card.planting_date)} ·{' '}
              {card.contracted_ha} ha {cropWord(card.crop)} · field from the officer&apos;s pin
            </p>
          </div>
          {/* The farm itself, on real imagery: what "from space" is looking at. */}
          {card.ring && (
            <FieldThumb
              ring={card.ring}
              size={narrow ? 84 : 96}
              label={`Imagery of ${card.farmer_name}'s field, its traced outline on top`}
            />
          )}
        </div>
        <div className="mt-3">
          <NdviChart
            curve={card.curve}
            plantingDate={card.planting_date}
            today={card.today}
            threshold={establishmentNdvi(card.crop)}
            label={`${card.farmer_name}'s NDVI against the ${card.camp} camp median: ${card.status_label}`}
          />
        </div>

        {card.ring && <p className="mt-1 text-[0.72rem] text-fg-2">{IMAGERY_CREDIT}</p>}

        <h3 className="mt-6 text-section font-semibold text-fg">Season record</h3>
        <p className="text-caption text-fg-2">Every entry with its source</p>
        <ol className="mt-2 flex flex-col">
          {card.timeline.map((t, i) => {
            const Icon =
              KIND_ICON[t.kind] ??
              (t.text.startsWith('No clear pass') ? CloudOff : SOURCE_ICON[t.source])
            // A clear pass is shown as the farm it saw, not as a glyph.
            const seen = t.source === 'satellite' && !KIND_ICON[t.kind] && Icon !== CloudOff
            return (
              <li
                key={`${t.at}-${i}`}
                className="grid grid-cols-[2rem_4.6rem_minmax(0,1fr)] items-start gap-x-2 border-t border-hairline py-2 first:border-t-0"
              >
                {seen && card.ring ? (
                  <FieldThumb
                    ring={card.ring}
                    size={28}
                    inset={0.72}
                    label="Seen from space"
                    className="!rounded-pill"
                  />
                ) : (
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-pill ${t.source === 'satellite' ? 'bg-signal-tint text-signal-text' : 'bg-well text-fg-2'}`}
                    title={t.source}
                  >
                    <Icon size={15} aria-hidden />
                    <span className="sr-only">{t.source}</span>
                  </span>
                )}
                <span className="pt-0.5 text-caption text-fg-2">
                  {seasonDate(t.at).replace(/ \d{4}$/, '')}
                </span>
                <span className="text-label text-fg">{t.text}</span>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <section aria-labelledby={`f-${card.contract_id}`}>
          <h3 id={`f-${card.contract_id}`} className="text-section font-semibold text-fg">
            {card.farmer_name}: eligibility
          </h3>
          <p className="text-caption text-fg-2">Rules, not a score. Every one is shown.</p>
          <FactorList factors={e.factors} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* While an advance is open the chip says so, as the ledger row does: "Not eligible"
                beside a waiting advance reads as a refusal. The cap shows only when it applies. */}
            <EligibilityChip
              eligible={e.eligible}
              label={e.eligible ? 'Eligible' : open ? eligibilityLabel(e) : 'Not eligible'}
            />
            {e.eligible && (
              <span className="serif text-[1.7rem] font-semibold leading-none tabular-nums text-fg">
                <span className="mr-1 font-body text-[0.85rem] font-[650] text-fg-2">cap ZMW</span>
                {e.cap_zmw.toLocaleString('en-GB')}
              </span>
            )}
          </div>
          {open ? (
            <p className="mt-3 text-label text-fg-2">
              Advance {zmw(advance.amount_zmw)}:{' '}
              <span className="font-semibold text-fg">{ADVANCE_STATE[advance.state]}</span>
            </p>
          ) : (
            e.eligible && (
              <button
                type="button"
                className="btn-primary mt-4"
                onClick={() => setRequesting(true)}
              >
                <Banknote aria-hidden size={18} />
                Request advance for {firstName(card.farmer_name)}
              </button>
            )
          )}
          {open && advance.state === 'requested' && (
            <button type="button" className="btn-quiet mt-3" onClick={() => setRequesting(true)}>
              Enter {firstName(card.farmer_name)}&apos;s code
            </button>
          )}
        </section>

        {card.neighbour && (
          <section
            className="rounded-card bg-ground p-4 shadow-[inset_0_0_0_1px_var(--hairline)]"
            aria-label="The neighbour"
          >
            <h3 className="text-label font-semibold text-fg">
              Beside {firstName(card.farmer_name)}: {card.neighbour.farmer_name}
            </h3>
            <p className="text-caption text-fg-2">
              {card.camp} · {card.neighbour.contracted_ha} ha {cropWord(card.crop)} · same camp,
              same clouds
            </p>
            <div className="mt-2">
              <NdviChart
                compact
                height={120}
                curve={card.neighbour.curve}
                plantingDate={card.planting_date}
                today={card.today}
                threshold={establishmentNdvi(card.crop)}
                label={`${card.neighbour.farmer_name}'s NDVI: ${card.neighbour.status_label}`}
              />
            </div>
            <p className="mt-2 text-label font-semibold text-fg">
              {card.neighbour.status_label}. No advance. Visit task created.
            </p>
            <p className="text-caption text-fg-2">{card.neighbour.eligibility_label}</p>
          </section>
        )}
      </div>

      {requesting && (
        <RequestAdvanceDialog
          orgId={orgId}
          card={card}
          commandCenter={commandCenter}
          onClose={() => setRequesting(false)}
        />
      )}
    </div>
  )
}

export const ADVANCE_STATE: Record<string, string> = {
  requested: 'waiting for the farmer’s code',
  farmer_confirmed: 'confirmed by the farmer, waiting for approval',
  approved: 'approved, sending',
  disbursed: 'sent',
  declined: 'declined',
  failed: 'transfer failed',
}

// The headline rules first; the farmer's record folds away when all of it holds.
const RECORD: EligibilityFactor['code'][] = [
  'contract',
  'consent',
  'momo',
  'history',
  'shock',
  'one_advance',
]
// Named in the folded line, so "every one is shown" holds before it is opened.
const RECORD_NAME: Partial<Record<EligibilityFactor['code'], string>> = {
  contract: 'contract',
  consent: 'consent',
  momo: 'mobile money number',
  history: 'history',
  shock: 'camp flag',
  one_advance: 'one advance',
}

// The crop as people in the camp say it: soybean is "soya" in Zambia.
const cropWord = (crop: FieldCard['crop']) =>
  crop === 'soybean' ? 'soya' : CROP_LABELS[crop].toLowerCase()

export function FactorList({ factors }: { factors: EligibilityFactor[] }) {
  const head = factors.filter(f => !RECORD.includes(f.code) || !f.met)
  const record = factors.filter(f => RECORD.includes(f.code) && f.met)
  return (
    <>
      <ul className="mt-2 flex flex-col gap-1.5">
        {head.map((f, i) => (
          <Factor key={`${f.code}-${i}`} factor={f} />
        ))}
      </ul>
      {record.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-caption font-medium text-fg-2 hover:text-fg [&::-webkit-details-marker]:hidden">
            + {record.length} record checks met:{' '}
            {record.map(f => RECORD_NAME[f.code] ?? f.code).join(', ')}{' '}
            <span className="font-semibold text-signal-text group-open:hidden">(show)</span>
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {record.map(f => (
              <Factor key={f.code} factor={f} />
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

// A tick or a cross, not a dot's colour: the rule that fails must read from the back of a room.
function Factor({ factor }: { factor: EligibilityFactor }) {
  const Mark = factor.met ? Check : X
  return (
    <li
      className={`relative pl-[1.35rem] text-label leading-[1.4] text-fg ${factor.met ? '' : 'font-semibold'}`}
    >
      <Mark
        size={15}
        strokeWidth={2.6}
        aria-hidden
        className={`absolute left-0 top-[0.2rem] ${factor.met ? 'text-signal' : 'text-high-text'}`}
      />
      <span className="sr-only">{factor.met ? 'Met: ' : 'Not met: '}</span>
      {factor.text}
    </li>
  )
}

export function EligibilityChip({ eligible, label }: { eligible: boolean; label: string }) {
  const paused = !eligible && label.startsWith('Paused')
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-[0.18rem] text-caption font-semibold leading-[1.35] ${
        eligible
          ? 'bg-signal-tint text-signal-text'
          : paused
            ? 'bg-attention-tint text-attention-text'
            : 'bg-well text-fg-2 shadow-[inset_0_0_0_1px_var(--hairline)]'
      }`}
    >
      {eligible && <CircleCheck size={14} aria-hidden />}
      {label}
    </span>
  )
}

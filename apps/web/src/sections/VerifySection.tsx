import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { ISSUE_LABELS, KNOWN_ISSUES, OFFICER_ROLES, type Crop, type Issue } from '@repo/shared'
import type { Officer } from '../hooks/useAuth'
import type { DashObservation } from '../hooks/useLive'
import { verifyObservation } from '../lib/api'
import { EVALUATION_NOTE, VERIFICATION_TEXT } from '../lib/copy'

// Issues an officer is likely to pick first, per crop; every known issue stays available.
const LIKELY: Record<Crop, Issue[]> = {
  maize: ['fall_armyworm', 'maize_lethal_necrosis'],
  tomato: ['tuta_absoluta', 'late_blight', 'early_blight'],
  cabbage: ['diamondback_moth'],
  cassava: ['cassava_mosaic', 'cassava_brown_streak'],
  soybean: [],
}

// Confirm the AI assessment or correct it (frozen REST verify). Field and extension officers
// set FIELD_VERIFIED; agronomists and admins EXPERT_CONFIRMED. The recommendation and the
// cluster check re-run; the counter in the header ticks when the report turns verified.
export function VerifySection({
  observation,
  officer,
  onDone,
}: {
  observation: DashObservation
  officer: Officer
  onDone?: () => void
}) {
  const ai = observation.suspectedIssue
  const [choice, setChoice] = useState<'confirm' | 'correct'>(
    ai && ai !== 'unknown' ? 'confirm' : 'correct'
  )
  const likely = LIKELY[observation.crop]
  const [issue, setIssue] = useState<Issue>(likely[0] ?? KNOWN_ISSUES[0])
  const [notes, setNotes] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!(OFFICER_ROLES as readonly string[]).includes(officer.role)) return null
  const level = ['agronomist', 'admin'].includes(officer.role)
    ? 'Confirm as an expert'
    : 'Verify in the field'
  const target: Issue | null = choice === 'confirm' ? ai : issue
  const ordered = [...likely, ...KNOWN_ISSUES.filter(i => !likely.includes(i))]

  async function submit() {
    if (!target || target === 'unknown') return
    setState('sending')
    setMessage(null)
    try {
      await verifyObservation(observation.id, target, notes)
      setState('done')
      setMessage(
        `Verified as ${ISSUE_LABELS[target]}. Saved as an evaluation case; the advice and the cluster check re-run.`
      )
      onDone?.()
    } catch (error) {
      setState('error')
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-label">
        Now:{' '}
        <strong className="font-semibold">{VERIFICATION_TEXT[observation.verification]}</strong>
        {observation.verifiedIssue && ` as ${ISSUE_LABELS[observation.verifiedIssue]}`}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="eyebrow mb-1">{level}</legend>
        {ai && ai !== 'unknown' && (
          <label className="flex items-center gap-2 text-label">
            <input
              type="radio"
              name={`verify-${observation.id}`}
              checked={choice === 'confirm'}
              onChange={() => setChoice('confirm')}
            />
            Confirm the AI assessment: <strong className="font-semibold">{ISSUE_LABELS[ai]}</strong>
          </label>
        )}
        <label className="flex flex-wrap items-center gap-2 text-label">
          <input
            type="radio"
            name={`verify-${observation.id}`}
            checked={choice === 'correct'}
            onChange={() => setChoice('correct')}
          />
          {ai && ai !== 'unknown' ? 'Correct it to' : 'Record the problem as'}
          <select
            className="field w-auto min-w-[14rem]"
            value={issue}
            onChange={e => {
              setIssue(e.target.value as Issue)
              setChoice('correct')
            }}
            aria-label="Issue"
          >
            {ordered.map(i => (
              <option key={i} value={i}>
                {ISSUE_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <label className="flex flex-col gap-1">
        <span className="eyebrow">Notes (optional)</span>
        <textarea
          className="field min-h-16 py-2"
          maxLength={500}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What you saw in the field"
        />
      </label>
      <button
        type="button"
        className="btn-primary self-start"
        disabled={state === 'sending' || !target || target === 'unknown'}
        onClick={() => void submit()}
      >
        <BadgeCheck size={18} strokeWidth={2} aria-hidden />
        {state === 'sending' ? 'Saving…' : level}
      </button>
      {message && (
        <p
          role="status"
          className={`text-label font-semibold ${state === 'error' ? 'text-attention-text' : 'text-signal-text'}`}
        >
          {message}
        </p>
      )}
      <p className="text-caption text-fg-2">{EVALUATION_NOTE}</p>
    </div>
  )
}

import { UserCheck } from 'lucide-react'
import { CONFIDENCE_BANDS, ISSUE_LABELS, withoutEmDash, type ObservationView } from '@repo/shared'
import { confidenceText, SEVERITY_TEXT, waitingText } from '../lib/copy'

// What the AI saw, in words: issue, confidence band, severity, symptoms. Confidence is a
// three-step band with its words, never a number (invariant 3). Routed reports say an officer
// will look, and give no advice (invariant 4).
export function DiagnosisSection({ view }: { view: ObservationView }) {
  const { diagnosis } = view
  if (!diagnosis) {
    return <p className="text-body font-semibold text-ink-2">{waitingText(view.status)}…</p>
  }

  const verified = view.verified_issue
  const label = verified ? ISSUE_LABELS[verified] : diagnosis.suspected_issue_label
  const level = CONFIDENCE_BANDS.indexOf(diagnosis.confidence_band) + 1
  const unknown = (verified ?? diagnosis.suspected_issue) === 'unknown'

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="eyebrow">{verified ? 'Confirmed by an officer' : 'What we see'}</p>
        <h2 className="font-display text-display font-semibold text-navy">
          {unknown ? 'Not sure yet' : label}
        </h2>
      </div>

      {!verified && (
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-semibold">
            {confidenceText(diagnosis.confidence_band)}
          </span>
          <span aria-hidden className="flex gap-1">
            {CONFIDENCE_BANDS.map((band, i) => (
              <span
                key={band}
                className={`h-2.5 w-8 rounded-tag border-1.5 border-navy ${i < level ? 'bg-navy' : 'bg-transparent'}`}
              />
            ))}
          </span>
        </div>
      )}

      {diagnosis.severity_band && (
        <p className="text-body font-semibold">{SEVERITY_TEXT[diagnosis.severity_band]}</p>
      )}

      {diagnosis.visible_symptoms.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-line pt-2">
          {diagnosis.visible_symptoms.map(symptom => (
            <li key={symptom} className="flex gap-2 text-body">
              <span aria-hidden className="mt-[11px] h-1.5 w-1.5 shrink-0 bg-navy" />
              {withoutEmDash(symptom)}
            </li>
          ))}
        </ul>
      )}

      {view.status === 'awaiting_expert_review' && (
        <div className="flex gap-3 rounded-card border border-copper-deep border-l-4 bg-copper-tint p-3 text-ink">
          <UserCheck
            size={24}
            strokeWidth={2}
            aria-hidden
            className="mt-0.5 shrink-0 text-copper-deep"
          />
          <p className="text-body font-semibold">
            {unknown
              ? 'We could not tell what this is from the photo. An extension officer will look at your report and follow up.'
              : 'An extension officer will check this report before we give advice.'}
          </p>
        </div>
      )}
    </div>
  )
}

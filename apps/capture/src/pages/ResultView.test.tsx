import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OFFICER_REFERRAL, type ObservationView } from '@repo/shared'
import { ResultView } from './ResultPage'

const base: ObservationView = {
  obs_id: 'k3J9xQ2mW8pL5vR1tY7u',
  created_at: '2026-10-23T09:00:00.000Z',
  crop: 'tomato',
  district: 'Chongwe',
  district_slug: 'chongwe',
  province: 'Lusaka',
  camp: null,
  planting_date: '2026-09-02',
  growth_stage: null,
  photo_paths: ['observations/u1/k3J9xQ2mW8pL5vR1tY7u/0.jpg'],
  farmer_description: null,
  status: 'diagnosing',
  verification_state: 'UNVERIFIED',
  verified_issue: null,
  diagnosis: null,
  recommendation: null,
  intervention: null,
  outcome: null,
  sim: false,
}

const diagnosis = {
  suspected_issue: 'late_blight' as const,
  suspected_issue_label: 'Late blight',
  confidence_band: 'high' as const,
  severity_band: 'moderate' as const,
  visible_symptoms: ['dark lesions on leaves'],
  needs_expert_review: false,
  expert_review_reason: null,
  diagnosed_at: '2026-10-23T09:00:05.000Z',
}

const recommendation = {
  ipm_steps: ['Check plants twice a week.', 'Remove infected leaves.', OFFICER_REFERRAL],
  chemical_options: [],
  officer_referral: true,
  sources: [
    { title: 'Late blight on tomato, Zambia (PMDG)', tier: 5, uri: 'https://example.org/pmdg' },
  ],
}

describe('ResultView (progressive)', () => {
  it('waits for the diagnosis, saying what it is doing', () => {
    render(<ResultView view={base} />)
    expect(screen.getByRole('status')).toHaveTextContent(/assessing/i)
    expect(screen.getAllByText(/looking at your photo/i).length).toBeGreaterThan(0)
    expect(screen.getByText('K3J9', { exact: false })).toBeInTheDocument()
  })

  it('shows the diagnosis while advice is found, with confidence in words only', () => {
    const { container } = render(
      <ResultView view={{ ...base, status: 'recommending', diagnosis }} />
    )
    expect(screen.getByRole('heading', { name: /late blight/i })).toBeInTheDocument()
    expect(screen.getByText('AI assessment: high confidence')).toBeInTheDocument()
    expect(screen.getByText(/finding advice/i)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/%|probab/i)
  })

  it('lays the advice out as a ladder with chemicals last, and cites its sources', () => {
    render(<ResultView view={{ ...base, status: 'complete', diagnosis, recommendation }} />)
    const rungs = within(screen.getByRole('list', { name: /step by step/i })).getAllByRole(
      'listitem'
    )
    expect(rungs.map(r => r.querySelector('.eyebrow')?.textContent)).toEqual([
      'Step 1',
      'Step 2',
      'Chemicals',
    ])
    expect(rungs[2]).toHaveTextContent(OFFICER_REFERRAL)
    expect(screen.getByRole('link', { name: /late blight on tomato/i })).toBeInTheDocument()
    expect(screen.getByText('CABI Plantwise')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/advice ready/i)
  })

  it('shows a registered product with its label dose verbatim', () => {
    const dose = '2.5 kg/ha in 400–600 L water; repeat at 7–10 days'
    render(
      <ResultView
        view={{
          ...base,
          status: 'complete',
          diagnosis,
          recommendation: {
            ...recommendation,
            ipm_steps: ['Check plants.', 'Chemical control, as a last resort: …'],
            officer_referral: false,
            chemical_options: [
              {
                registration_no: 'ZEMA/PCP/123',
                trade_name: 'Example 80WP',
                active_ingredient: 'mancozeb',
                label_dose: dose,
                phi_days: 7,
                source_doc: 'label',
              },
            ],
          },
        }}
      />
    )
    expect(screen.getByText(dose)).toBeInTheDocument()
    expect(screen.getByText('ZEMA/PCP/123')).toBeInTheDocument()
  })

  it('routes uncertain reports to an officer, with no advice (invariant 4)', () => {
    render(
      <ResultView
        view={{
          ...base,
          status: 'awaiting_expert_review',
          diagnosis: {
            ...diagnosis,
            suspected_issue: 'unknown',
            suspected_issue_label: 'Unknown — needs expert review',
            confidence_band: 'low',
            needs_expert_review: true,
            expert_review_reason: 'unknown_issue',
          },
        }}
      />
    )
    expect(screen.getByRole('status')).toHaveTextContent(/with an officer/i)
    expect(screen.getByText(/extension officer will look/i)).toBeInTheDocument()
    expect(screen.queryByText(/step 1/i)).not.toBeInTheDocument()
  })

  it('carries the DEMO badge on simulated rows (invariant 5)', () => {
    render(<ResultView view={{ ...base, sim: true }} />)
    expect(screen.getByText(/demo data — simulated/i)).toBeInTheDocument()
  })
})

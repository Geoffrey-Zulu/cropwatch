import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CeihPage } from './CeihPage'
vi.mock('../components/FieldEvidence', () => ({ FieldEvidence: () => null }))

beforeEach(() => {
  localStorage.clear()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

it('walks through checked crops, capped eligibility, a simulated advance and harvest deductions', () => {
  const navigate = vi.fn()
  const { rerender } = render(<CeihPage uid="example-user" step="crop" navigate={navigate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Financing example' }))
  for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox)
  rerender(<CeihPage uid="example-user" step="eligibility" navigate={navigate} />)
  const review = screen.getByRole('button', { name: 'Continue to wallet' })
  expect(review).toBeEnabled()
  fireEvent.click(review)
  expect(navigate).toHaveBeenLastCalledWith({ page: 'ceih', step: 'advance' })
  rerender(<CeihPage uid="example-user" step="advance" navigate={navigate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Review demo transfer' }))
  expect(screen.getByRole('dialog', { name: 'Review demo transfer' })).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm demo transfer' }))
  expect(screen.getByRole('status')).toHaveTextContent('Demo advance saved')
  rerender(<CeihPage uid="example-user" step="harvest" navigate={navigate} />)
  expect(screen.getAllByText('K 30,750.00').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile demo harvest' }))
  expect(screen.getByRole('status')).toHaveTextContent('No real payout has been sent')
})

it('keeps demo data scoped to the signed-in user and gates approval on crop checks', () => {
  const navigate = vi.fn()
  render(<CeihPage uid="new-user" step="eligibility" navigate={navigate} />)
  expect(screen.getByRole('button', { name: 'Continue to wallet' })).toBeDisabled()
  const nav = screen.getByRole('navigation', { name: 'CEIH season' })
  fireEvent.click(nav.querySelectorAll('button')[3])
  expect(navigate).toHaveBeenCalledWith({ page: 'ceih', step: 'harvest' })
})

it('preserves an advance cap saved by an earlier installed app', () => {
  localStorage.setItem(
    'phytos:ceih-demo:v1:legacy-user',
    JSON.stringify({
      checks: [true, true, true],
      ['percent']: 15,
      amount: 5000,
      approved: true,
      sent: false,
      reconciled: false,
      provider: 'Airtel',
    })
  )
  render(<CeihPage uid="legacy-user" step="eligibility" navigate={vi.fn()} />)
  expect(screen.getAllByText('K 7,200.00').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Continue to wallet' })).toBeEnabled()
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
})

import { render, screen } from '@testing-library/react'
import { DemoBadge, DEMO_BADGE_TEXT, hasSimulatedRows } from './DemoBadge'

describe('DemoBadge', () => {
  it('shows when any displayed row is simulated', () => {
    render(<DemoBadge rows={[{ sim: false }, { sim: true }, { sim: false }]} />)
    expect(screen.getByRole('status')).toHaveTextContent('DEMO DATA — SIMULATED')
  })

  it('stays hidden when every row is real', () => {
    const { container } = render(<DemoBadge rows={[{ sim: false }, { sim: false }]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('stays hidden for an empty view', () => {
    const { container } = render(<DemoBadge rows={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('uses the exact wording from CLAUDE.md', () => {
    expect(DEMO_BADGE_TEXT).toBe('DEMO DATA — SIMULATED')
    expect(hasSimulatedRows([{ sim: true }])).toBe(true)
  })
})

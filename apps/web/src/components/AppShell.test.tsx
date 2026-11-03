import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell, initials } from './AppShell'

const shell = (nav?: React.ReactNode) =>
  render(
    <AppShell
      email="agronomist@phytos.test"
      role="agronomist"
      onSignOut={() => undefined}
      nav={nav}
      actions={<button type="button">Season controls</button>}
    >
      <p>page</p>
    </AppShell>
  )

describe('AppShell header (design-system/phytos/patterns.md rule 1)', () => {
  it('never prints the email in the chrome; it is only inside the account menu', () => {
    shell()
    expect(screen.queryByText('agronomist@phytos.test')).not.toBeInTheDocument()
    expect(screen.getByText('AG')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /account/i }))
    expect(screen.getByRole('menu')).toHaveTextContent('agronomist@phytos.test')
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('carries the screens in the header and the phone strip, and the gear before the avatar', () => {
    shell(<a href="#/outgrower/season">Season ledger</a>)
    expect(screen.getAllByRole('navigation', { name: 'Screens' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Season ledger' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Season controls' })).toBeInTheDocument()
  })

  it('without screens, carries no nav', () => {
    shell()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('initials', () => {
  it('reads two letters from the address', () => {
    expect(initials('agronomist@phytos.test')).toBe('AG')
    expect(initials('jane.banda@phytos.test')).toBe('JB')
  })
})

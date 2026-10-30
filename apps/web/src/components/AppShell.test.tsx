import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell, initials } from './AppShell'

const shell = () =>
  render(
    <AppShell
      active="map"
      commandCenter
      email="agronomist@phytos-demo.test"
      role="agronomist"
      verified={188}
      queue={82}
      onSignOut={() => undefined}
    >
      <p>page</p>
    </AppShell>
  )

describe('AppShell header (design-system/phytos/patterns.md rule 1)', () => {
  it('never prints the email in the chrome; it is only inside the account menu', () => {
    shell()
    expect(screen.queryByText('agronomist@phytos-demo.test')).not.toBeInTheDocument()
    expect(screen.getByText('AG')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /account/i }))
    expect(screen.getByRole('menu')).toHaveTextContent('agronomist@phytos-demo.test')
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('marks the current page and keeps nav labels in sentence case', () => {
    shell()
    // The pages are listed twice: in the header on wide screens, as a strip on phones.
    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current).toHaveLength(2)
    for (const link of current) expect(link).toHaveTextContent('National map')
  })

  it('carries the lockup only: no "Command Center" text, no prototype chip, no DEMO badge', () => {
    shell()
    expect(screen.getByRole('link', { name: /phytos/i })).toHaveTextContent('Phytos')
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/prototype/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/demo data/i)).not.toBeInTheDocument()
  })

  it('shows the queue count beside its page', () => {
    shell()
    const queue = screen.getAllByRole('link', { name: /officer queue/i })[0]
    expect(queue).toHaveTextContent('82')
  })

  it('reads initials from the email', () => {
    expect(initials('jane.banda@example.org')).toBe('JB')
    expect(initials('agronomist@phytos-demo.test')).toBe('AG')
  })
})

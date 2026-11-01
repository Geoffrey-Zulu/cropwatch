import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell, initials } from './AppShell'

const shell = () =>
  render(
    <AppShell email="agronomist@phytos.test" role="agronomist" onSignOut={() => undefined}>
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

  it('carries no page nav: the four screens are the tabs on each page', () => {
    shell()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /fields map/i })).toHaveAttribute(
      'href',
      '#/outgrower/fields'
    )
  })
})

describe('initials', () => {
  it('reads two letters from the address', () => {
    expect(initials('agronomist@phytos.test')).toBe('AG')
    expect(initials('jane.banda@phytos.test')).toBe('JB')
  })
})

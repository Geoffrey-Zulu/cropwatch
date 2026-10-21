import { describe, it, expect } from 'vitest'
import { nextClaims, parseArgs } from './roles'

describe('parseArgs', () => {
  it('sets a role by email', () => {
    expect(parseArgs(['--email', 'a@b.zm', '--role', 'agronomist'])).toEqual({
      target: { email: 'a@b.zm' },
      role: 'agronomist',
      org: null,
    })
  })

  it('sets a field officer by uid with an org, ignoring the pnpm "--" separator', () => {
    expect(
      parseArgs(['--', '--uid', 'u1', '--role', 'field_officer', '--org', 'demo-org'])
    ).toEqual({ target: { uid: 'u1' }, role: 'field_officer', org: 'demo-org' })
  })

  it('clears a role', () => {
    expect(parseArgs(['--email', 'a@b.zm', '--clear'])).toMatchObject({ role: null, org: null })
  })

  it.each([
    [['--role', 'admin'], 'exactly one of --email or --uid'],
    [['--email', 'a', '--uid', 'u', '--role', 'admin'], 'exactly one of --email or --uid'],
    [['--email', 'a'], 'exactly one of --role or --clear'],
    [['--email', 'a', '--role', 'farmer'], 'Unknown role'],
    [['--email', 'a', '--role', 'superuser'], 'Unknown role'],
    [['--email', 'a', '--role', 'field_officer'], 'needs --org'],
    [['--email', 'a', '--clear', '--org', 'x'], 'drop --org'],
    [['--email'], 'needs a value'],
  ])('rejects %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message)
  })
})

describe('nextClaims', () => {
  it('keeps unrelated claims and replaces role and org', () => {
    expect(
      nextClaims(
        { beta: true, role: 'agronomist', org_id: 'old' },
        { role: 'field_officer', org: 'new' }
      )
    ).toEqual({ beta: true, role: 'field_officer', org_id: 'new' })
  })

  it('drops a stale org when the new role has none', () => {
    expect(
      nextClaims({ role: 'field_officer', org_id: 'x' }, { role: 'admin', org: null })
    ).toEqual({
      role: 'admin',
    })
  })

  it('clears both on --clear', () => {
    expect(nextClaims({ role: 'admin', org_id: 'x', beta: 1 }, { role: null, org: null })).toEqual({
      beta: 1,
    })
  })
})

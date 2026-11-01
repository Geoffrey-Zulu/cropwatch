import { act, renderHook } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'

const mocks = vi.hoisted(() => ({ subscribe: vi.fn(), signIn: vi.fn(), stop: vi.fn() }))
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mocks.subscribe,
  signInAnonymously: mocks.signIn,
}))
vi.mock('../lib/firebase', () => ({ auth: { currentUser: null } }))

let notify: (user: User | null) => void

beforeEach(() => {
  vi.useFakeTimers()
  mocks.subscribe.mockImplementation((_auth, next) => {
    notify = next
    return mocks.stop
  })
  mocks.signIn.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('anonymous auth startup', () => {
  it('identifies a stalled session restore before requesting a new account', () => {
    const { result, unmount } = renderHook(useAuth)
    act(() => vi.advanceTimersByTime(15_000))
    expect(result.current.error).toContain('before a sign-in request could start')
    expect(mocks.signIn).not.toHaveBeenCalled()
    unmount()
    expect(mocks.stop).toHaveBeenCalledOnce()
  })

  it('identifies a stalled sign-in request and avoids duplicate requests', () => {
    const { result, unmount } = renderHook(useAuth)
    act(() => { notify(null); notify(null) })
    expect(mocks.signIn).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(15_000))
    expect(result.current.error).toBe('Anonymous sign-in request timed out after 15 seconds.')
    unmount()
  })

  it('accepts a sign-in result and cancels the startup timeout', async () => {
    const user = { uid: 'saved-farmer' } as User
    mocks.signIn.mockResolvedValue({ user })
    const { result, unmount } = renderHook(useAuth)
    await act(async () => { notify(null) })
    act(() => vi.advanceTimersByTime(15_000))
    expect(result.current).toEqual({ user, error: null })
    unmount()
  })
})

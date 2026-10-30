import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, getToken, setToken } from './tokenStore.ts'

const STORAGE_KEY = 'epistemictrace:token'
const NOW = new Date('2026-10-30T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  sessionStorage.clear()
})

describe('tokenStore', () => {
  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull()
  })

  it('stores the token and expiresAt under epistemictrace:token', () => {
    setToken('header.payload.signature', '2026-10-30T20:00:00Z')

    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      token: 'header.payload.signature',
      expiresAt: '2026-10-30T20:00:00Z',
    })
    expect(getToken()).toBe('header.payload.signature')
  })

  it('does not use localStorage', () => {
    setToken('header.payload.signature', '2026-10-30T20:00:00Z')

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns null and removes the entry once expiresAt has passed', () => {
    setToken('header.payload.signature', '2026-10-30T20:00:00Z')

    vi.setSystemTime(new Date('2026-10-30T20:00:01Z'))

    expect(getToken()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('treats a token whose expiresAt is exactly now as expired', () => {
    setToken('header.payload.signature', NOW.toISOString())

    expect(getToken()).toBeNull()
  })

  it('accepts an expiresAt with fractional seconds', () => {
    setToken('header.payload.signature', '2026-10-30T12:00:00.500Z')

    expect(getToken()).toBe('header.payload.signature')
  })

  it.each([
    ['not JSON', 'header.payload.signature'],
    ['a JSON string', '"header.payload.signature"'],
    ['missing expiresAt', '{"token":"header.payload.signature"}'],
    ['an empty token', '{"token":"","expiresAt":"2026-10-30T20:00:00Z"}'],
    ['an unparsable expiresAt', '{"token":"header.payload.signature","expiresAt":"tomorrow"}'],
  ])('returns null and removes the entry when the stored value is %s', (_label, raw) => {
    sessionStorage.setItem(STORAGE_KEY, raw)

    expect(getToken()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clearToken removes the stored token', () => {
    setToken('header.payload.signature', '2026-10-30T20:00:00Z')

    clearToken()

    expect(getToken()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

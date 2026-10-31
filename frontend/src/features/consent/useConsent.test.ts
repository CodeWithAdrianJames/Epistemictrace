import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/ApiError.ts'
import { me, type User } from '../../api/authApi.ts'
import { putConsent } from '../../api/consentApi.ts'
import { AuthProvider, useAuth } from '../../auth/AuthProvider.tsx'
import { setToken } from '../../auth/tokenStore.ts'
import { CONSENT_DECLINED_KEY, useConsent } from './useConsent.ts'

vi.mock('../../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

vi.mock('../../api/consentApi.ts', () => ({
  putConsent: vi.fn(),
}))

const meMock = vi.mocked(me)
const putConsentMock = vi.mocked(putConsent)

const FUTURE = '2099-01-01T00:00:00Z'

const NEW_STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const CONSENTED_STUDENT: User = { ...NEW_STUDENT, consentAccepted: true }

function wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, null, createElement(AuthProvider, null, children))
}

// Signs the student in through the stored token, then renders the hook once the user is known.
async function renderConsent(user: User = NEW_STUDENT) {
  setToken('token-7', FUTURE)
  meMock.mockResolvedValue(user)
  const view = renderHook(() => ({ auth: useAuth(), consent: useConsent() }), { wrapper })
  await waitFor(() => expect(view.result.current.auth.status).toBe('authenticated'))
  return view
}

const INSECURE = () => new DOMException('The operation is insecure.', 'SecurityError')

// The auth token lives in sessionStorage too, so only the consent key is made to fail.
function denyConsentRead() {
  const original = Storage.prototype.getItem
  return vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key === CONSENT_DECLINED_KEY) {
      throw INSECURE()
    }
    return original.call(this, key)
  })
}

function denyConsentWrite() {
  const original = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === CONSENT_DECLINED_KEY) {
      throw INSECURE()
    }
    original.call(this, key, value)
  })
}

function apiError(status: number): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail: `detail ${status}`, fieldErrors: {} })
}

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

describe('useConsent status', () => {
  it('is pending for a student who has not accepted and has not declined in this tab', async () => {
    const { result } = await renderConsent()

    expect(result.current.consent.status).toBe('pending')
  })

  it('is accepted when the account already accepted', async () => {
    const { result } = await renderConsent(CONSENTED_STUDENT)

    expect(result.current.consent.status).toBe('accepted')
  })

  it('is declined when this tab remembers a decline', async () => {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')

    const { result } = await renderConsent()

    expect(result.current.consent.status).toBe('declined')
  })

  it('is accepted, not declined, when the account accepted on another device and this tab declined earlier', async () => {
    sessionStorage.setItem(CONSENT_DECLINED_KEY, 'true')

    const { result } = await renderConsent(CONSENTED_STUDENT)

    expect(result.current.consent.status).toBe('accepted')
  })

  it('uses the key epistemictrace:consent-declined', () => {
    expect(CONSENT_DECLINED_KEY).toBe('epistemictrace:consent-declined')
  })

  it('is pending, not an error, when sessionStorage throws on read', async () => {
    const getItem = denyConsentRead()

    const { result } = await renderConsent()

    expect(result.current.consent.status).toBe('pending')
    getItem.mockRestore()
  })
})

describe('useConsent decline', () => {
  it('stores the choice in sessionStorage and becomes declined', async () => {
    const { result } = await renderConsent()

    act(() => {
      result.current.consent.decline()
    })

    expect(result.current.consent.status).toBe('declined')
    expect(sessionStorage.getItem(CONSENT_DECLINED_KEY)).not.toBeNull()
    expect(putConsentMock).not.toHaveBeenCalled()
  })

  it('does not use localStorage', async () => {
    const { result } = await renderConsent()

    act(() => {
      result.current.consent.decline()
    })

    expect(localStorage.length).toBe(0)
  })

  it('still becomes declined for this page when sessionStorage throws on write', async () => {
    const setItem = denyConsentWrite()
    const { result } = await renderConsent()

    act(() => {
      result.current.consent.decline()
    })

    expect(result.current.consent.status).toBe('declined')
    setItem.mockRestore()
  })

  it('is a new, pending tab again once the tab storage is gone', async () => {
    const first = await renderConsent()
    act(() => {
      first.result.current.consent.decline()
    })
    first.unmount()
    sessionStorage.clear()

    const second = await renderConsent()

    expect(second.result.current.consent.status).toBe('pending')
  })
})

describe('useConsent accept', () => {
  it('calls PUT /api/me/consent with the token, then marks the user accepted', async () => {
    putConsentMock.mockResolvedValue({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    const { result } = await renderConsent()

    await act(async () => {
      await result.current.consent.accept()
    })

    expect(putConsentMock).toHaveBeenCalledTimes(1)
    expect(putConsentMock.mock.calls[0][0]).toBe('token-7')
    expect(result.current.consent.status).toBe('accepted')
    expect(result.current.auth.user).toEqual(CONSENTED_STUDENT)
  })

  it('stays pending and rejects with the ApiError when the call fails', async () => {
    putConsentMock.mockRejectedValue(apiError(500))
    const { result } = await renderConsent()
    let failure: unknown

    await act(async () => {
      failure = await result.current.consent.accept().catch((error: unknown) => error)
    })

    expect(failure).toBeInstanceOf(ApiError)
    expect(result.current.consent.status).toBe('pending')
    expect(result.current.auth.user).toEqual(NEW_STUDENT)
  })

  it('stays declined when the call fails after a decline', async () => {
    putConsentMock.mockRejectedValue(apiError(500))
    const { result } = await renderConsent()
    act(() => {
      result.current.consent.decline()
    })

    await act(async () => {
      await result.current.consent.accept().catch(() => {})
    })

    expect(result.current.consent.status).toBe('declined')
    expect(sessionStorage.getItem(CONSENT_DECLINED_KEY)).not.toBeNull()
  })

  it('becomes accepted after a decline and clears the remembered decline', async () => {
    putConsentMock.mockResolvedValue({ consentAcceptedAt: '2026-10-31T08:00:00Z' })
    const { result } = await renderConsent()
    act(() => {
      result.current.consent.decline()
    })

    await act(async () => {
      await result.current.consent.accept()
    })

    expect(result.current.consent.status).toBe('accepted')
    expect(sessionStorage.getItem(CONSENT_DECLINED_KEY)).toBeNull()
  })

  it('signs the student out when the server answers 401', async () => {
    putConsentMock.mockRejectedValue(apiError(401))
    const { result } = await renderConsent()

    await act(async () => {
      await result.current.consent.accept().catch(() => {})
    })

    expect(result.current.auth.status).toBe('anonymous')
  })
})

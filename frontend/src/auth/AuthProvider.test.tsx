import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/ApiError.ts'
import { login, me, register, type User } from '../api/authApi.ts'
import { AuthProvider, useAuth } from './AuthProvider.tsx'
import { getToken, setToken } from './tokenStore.ts'

vi.mock('../api/authApi.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  me: vi.fn(),
}))

const registerMock = vi.mocked(register)
const loginMock = vi.mocked(login)
const meMock = vi.mocked(me)

const FUTURE = '2099-01-01T00:00:00Z'

const STUDENT: User = {
  id: 7,
  name: 'Student One',
  email: 'student1@example.test',
  role: 'STUDENT',
  consentAccepted: false,
}

const INSTRUCTOR: User = {
  id: 1,
  name: 'Instructor One',
  email: 'instructor1@example.test',
  role: 'INSTRUCTOR',
  consentAccepted: false,
}

function apiError(status: number, detail = 'Something went wrong. Please try again.'): ApiError {
  return new ApiError({ status, title: `HTTP ${status}`, detail, fieldErrors: {} })
}

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider })
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
})

describe('AuthProvider', () => {
  it('starts anonymous without calling me() when no token is stored', () => {
    const { result } = renderAuth()

    expect(result.current.status).toBe('anonymous')
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(meMock).not.toHaveBeenCalled()
  })

  it('restores the user from a stored token', async () => {
    setToken('stored.token.value', FUTURE)
    const pending = deferred<User>()
    meMock.mockReturnValue(pending.promise)

    const { result } = renderAuth()

    expect(result.current.status).toBe('loading')
    expect(result.current.token).toBe('stored.token.value')
    expect(result.current.user).toBeNull()
    expect(meMock).toHaveBeenCalledWith('stored.token.value', expect.any(AbortSignal))

    await act(async () => {
      pending.resolve(STUDENT)
    })

    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(STUDENT)
    expect(result.current.token).toBe('stored.token.value')
    expect(getToken()).toBe('stored.token.value')
  })

  it('clears the stored token and becomes anonymous when me() answers 401', async () => {
    setToken('expired.token.value', FUTURE)
    meMock.mockRejectedValue(apiError(401))

    const { result } = renderAuth()

    await waitFor(() => {
      expect(result.current.status).toBe('anonymous')
    })
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('becomes anonymous but keeps the stored token when me() fails without a 401', async () => {
    setToken('stored.token.value', FUTURE)
    meMock.mockRejectedValue(apiError(0, "Can't reach the server. Check your connection."))

    const { result } = renderAuth()

    await waitFor(() => {
      expect(result.current.status).toBe('anonymous')
    })
    expect(result.current.token).toBeNull()
    expect(getToken()).toBe('stored.token.value')
  })

  it('does not call me() for an expired stored token', () => {
    setToken('expired.token.value', '2000-01-01T00:00:00Z')

    const { result } = renderAuth()

    expect(result.current.status).toBe('anonymous')
    expect(meMock).not.toHaveBeenCalled()
  })

  it('login stores the token and becomes authenticated', async () => {
    loginMock.mockResolvedValue({ token: 'new.token.value', expiresAt: FUTURE, user: INSTRUCTOR })
    const { result } = renderAuth()

    let user: User | undefined
    await act(async () => {
      user = await result.current.login('instructor1@example.test', 'password123')
    })

    expect(loginMock).toHaveBeenCalledWith('instructor1@example.test', 'password123')
    expect(user).toEqual(INSTRUCTOR)
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(INSTRUCTOR)
    expect(result.current.token).toBe('new.token.value')
    expect(getToken()).toBe('new.token.value')
  })

  it('login rethrows a 401 and stays anonymous without storing a token', async () => {
    const error = apiError(401, 'Email or password is incorrect.')
    loginMock.mockRejectedValue(error)
    const { result } = renderAuth()

    await act(async () => {
      await expect(result.current.login('student1@example.test', 'wrong-password')).rejects.toBe(error)
    })

    expect(result.current.status).toBe('anonymous')
    expect(getToken()).toBeNull()
  })

  it('register creates the account, then logs in with the same credentials', async () => {
    registerMock.mockResolvedValue({ id: 7, name: 'Student One', email: 'student1@example.test', role: 'STUDENT' })
    loginMock.mockResolvedValue({ token: 'new.token.value', expiresAt: FUTURE, user: STUDENT })
    const { result } = renderAuth()

    let user: User | undefined
    await act(async () => {
      user = await result.current.register('Student One', 'student1@example.test', 'password123')
    })

    expect(registerMock).toHaveBeenCalledWith('Student One', 'student1@example.test', 'password123')
    expect(loginMock).toHaveBeenCalledWith('student1@example.test', 'password123')
    expect(user).toEqual(STUDENT)
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(STUDENT)
    expect(getToken()).toBe('new.token.value')
  })

  it('register rethrows a 409 and does not log in', async () => {
    const error = apiError(409, 'An account with this email already exists.')
    registerMock.mockRejectedValue(error)
    const { result } = renderAuth()

    await act(async () => {
      await expect(
        result.current.register('Student One', 'student1@example.test', 'password123'),
      ).rejects.toBe(error)
    })

    expect(loginMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe('anonymous')
    expect(getToken()).toBeNull()
  })

  it('logout clears the token and becomes anonymous', async () => {
    setToken('stored.token.value', FUTURE)
    meMock.mockResolvedValue(STUDENT)
    const { result } = renderAuth()
    await waitFor(() => {
      expect(result.current.status).toBe('authenticated')
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.status).toBe('anonymous')
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(getToken()).toBeNull()
  })

  it('ignores a restore that finishes after login replaced it, and aborts it', async () => {
    setToken('stored.token.value', FUTURE)
    const pending = deferred<User>()
    meMock.mockReturnValue(pending.promise)
    loginMock.mockResolvedValue({ token: 'new.token.value', expiresAt: FUTURE, user: INSTRUCTOR })
    const { result } = renderAuth()
    const signal = meMock.mock.lastCall?.[1]

    await act(async () => {
      await result.current.login('instructor1@example.test', 'password123')
    })
    await act(async () => {
      pending.resolve(STUDENT)
    })

    expect(signal?.aborted).toBe(true)
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(INSTRUCTOR)
    expect(result.current.token).toBe('new.token.value')
    expect(getToken()).toBe('new.token.value')
  })

  it('aborts the restore request on unmount', () => {
    setToken('stored.token.value', FUTURE)
    meMock.mockReturnValue(deferred<User>().promise)
    const { unmount } = renderAuth()
    const signal = meMock.mock.lastCall?.[1]

    unmount()

    expect(signal?.aborted).toBe(true)
  })

  it('useAuth throws outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used inside AuthProvider')

    consoleError.mockRestore()
  })
})

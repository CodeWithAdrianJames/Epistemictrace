import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api/ApiError.ts'
import * as authApi from '../api/authApi.ts'
import type { User } from '../api/authApi.ts'
import { clearToken, getToken, setToken } from './tokenStore.ts'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

// 'loading' only happens on mount while a stored token is checked with GET /api/auth/me.
export type AuthState =
  | { status: 'loading'; user: null; token: string }
  | { status: 'anonymous'; user: null; token: null }
  | { status: 'authenticated'; user: User; token: string }

export type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => void
  // Spec 15 R4: after PUT /api/me/consent succeeds, so the user reads consentAccepted = true without a reload.
  markConsentAccepted: () => void
}

const ANONYMOUS: AuthState = { status: 'anonymous', user: null, token: null }

const AuthContext = createContext<AuthContextValue | null>(null)

function initialState(): AuthState {
  const token = getToken()
  return token ? { status: 'loading', user: null, token } : ANONYMOUS
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)
  const restoringToken = state.status === 'loading' ? state.token : null

  useEffect(() => {
    if (restoringToken === null) {
      return
    }
    const controller = new AbortController()
    // Only settle the restore if nothing (login, logout) replaced the state in the meantime.
    const settle = (next: AuthState) => {
      setState((current) => (current.status === 'loading' && current.token === restoringToken ? next : current))
    }

    authApi
      .me(restoringToken, controller.signal)
      .then((user) => {
        settle({ status: 'authenticated', user, token: restoringToken })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        if (error instanceof ApiError && error.status === 401 && getToken() === restoringToken) {
          clearToken()
        }
        // Other failures (network, 5xx) keep the stored token so a refresh can retry.
        settle(ANONYMOUS)
      })

    return () => {
      controller.abort()
    }
  }, [restoringToken])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.login(email, password)
    setToken(result.token, result.expiresAt)
    setState({ status: 'authenticated', user: result.user, token: result.token })
    return result.user
  }, [])

  // R6: a successful register logs in with the same credentials.
  const register = useCallback(
    async (name: string, email: string, password: string): Promise<User> => {
      await authApi.register(name, email, password)
      return login(email, password)
    },
    [login],
  )

  const logout = useCallback(() => {
    clearToken()
    setState(ANONYMOUS)
  }, [])

  const markConsentAccepted = useCallback(() => {
    setState((current) =>
      current.status === 'authenticated'
        ? { ...current, user: { ...current.user, consentAccepted: true } }
        : current,
    )
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, markConsentAccepted }),
    [state, login, register, logout, markConsentAccepted],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- spec 07 R3 keeps the hook beside its provider.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}

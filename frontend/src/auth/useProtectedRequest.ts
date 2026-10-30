import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../api/ApiError.ts'
import { useAuth } from './AuthProvider.tsx'
import { getToken } from './tokenStore.ts'

export type ProtectedRequest = <T>(call: (token: string) => Promise<T>) => Promise<T>

// Spec 07 R4: runs an api/ call with the provider's token. A 401 logs out and redirects to /login,
// then the ApiError is rethrown so the caller can stop its own work.
export function useProtectedRequest(): ProtectedRequest {
  const auth = useAuth()
  const navigate = useNavigate()
  const token = auth.status === 'authenticated' ? auth.token : null
  const { logout } = auth

  return useCallback(
    async <T>(call: (token: string) => Promise<T>): Promise<T> => {
      if (token === null) {
        throw new Error('useProtectedRequest needs a signed-in user')
      }
      try {
        return await call(token)
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401 && !replacedBy(token)) {
          logout()
          navigate('/login', { replace: true })
        }
        throw error
      }
    },
    [token, logout, navigate],
  )
}

// A 401 for a token that a newer login has already replaced must not log the new session out.
// An expired or already cleared token reads back as null and still counts as the current session.
function replacedBy(token: string): boolean {
  const current = getToken()
  return current !== null && current !== token
}

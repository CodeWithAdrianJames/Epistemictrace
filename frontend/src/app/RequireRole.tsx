import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import type { Role } from '../api/authApi.ts'
import { useAuth } from '../auth/AuthProvider.tsx'
import { homePathFor } from '../auth/homePath.ts'

interface RequireRoleProps {
  role: Role
  children: ReactNode
}

// Spec 07 R7: renders children only for a signed-in user with `role`; everyone else is sent away.
function RequireRole({ role, children }: RequireRoleProps) {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p>Loading…</p>
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }
  if (auth.user.role !== role) {
    return <Navigate to={homePathFor(auth.user.role)} replace />
  }
  return children
}

export default RequireRole

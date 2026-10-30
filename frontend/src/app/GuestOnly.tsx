import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import { homePathFor } from '../auth/homePath.ts'

interface GuestOnlyProps {
  children: ReactNode
}

// Spec 07 R8: /login and /register send a signed-in user to their home.
function GuestOnly({ children }: GuestOnlyProps) {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p>Loading…</p>
  }
  if (auth.status === 'authenticated') {
    return <Navigate to={homePathFor(auth.user.role)} replace />
  }
  return children
}

export default GuestOnly

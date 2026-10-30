import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthProvider.tsx'
import { homePathFor } from '../auth/homePath.ts'

// Spec 07 R8: / goes to the signed-in user's home, otherwise to /login.
function HomeRedirect() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <p>Loading…</p>
  }
  return <Navigate to={auth.status === 'authenticated' ? homePathFor(auth.user.role) : '/login'} replace />
}

export default HomeRedirect

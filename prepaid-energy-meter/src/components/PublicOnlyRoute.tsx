import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import LoadingScreen from './LoadingScreen'

// Wraps pages meant for signed-out visitors (sign in, sign up,
// forgot password). Signed-in users are sent on to the app.
export default function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }

  if (user) {
    // If a protected page sent them here, go back to that page.
    const from = (location.state as { from?: string } | null)
      ?.from

    const target =
      from && from.startsWith('/') && !from.startsWith('//')
        ? from
        : '/dashboard'

    return <Navigate to={target} replace />
  }

  return <Outlet />
}

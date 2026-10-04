import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function ProtectedRoute() {
  const {
    user,
    loading,
    profileLoading,
  } = useAuth()

  const location = useLocation()

  if (loading || profileLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <Outlet />
}
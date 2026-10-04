import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function AdminRoute() {
  const {
    user,
    profile,
    loading,
    profileLoading,
  } = useAuth()

  if (loading || profileLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
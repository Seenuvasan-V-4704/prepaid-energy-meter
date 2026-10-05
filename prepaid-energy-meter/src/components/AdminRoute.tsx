import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function AdminRoute() {
  const {
    user,
    profile,
    loading,
    profileLoading,
    profileError,
    refreshProfile,
  } = useAuth()

  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    await refreshProfile()
    setRetrying(false)
  }

  if (loading || profileLoading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  // Without a profile we cannot tell if the user is an admin.
  // Show the problem instead of silently redirecting.
  if (!profile) {
    return (
      <div
        role="alert"
        className="max-w-xl rounded-xl bg-red-50 p-5 text-sm text-red-700 ring-1 ring-red-200"
      >
        <p className="font-semibold">
          Could not check your admin access
        </p>

        <p className="mt-1">
          Your profile did not load
          {profileError ? `: ${profileError}` : '.'}
        </p>

        <button
          onClick={handleRetry}
          disabled={retrying}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    )
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

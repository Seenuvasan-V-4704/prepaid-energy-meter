import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Sidebar from './Sidebar'

export default function AppLayout() {
  const { profileError, refreshProfile } = useAuth()

  const [sidebarOpen, setSidebarOpen] =
    useState(false)

  // Remember which error message the user closed.
  const [dismissedError, setDismissedError] =
    useState<string | null>(null)

  const [retrying, setRetrying] = useState(false)

  const showBanner =
    profileError !== null && profileError !== dismissedError

  async function handleRetry() {
    setDismissedError(null)
    setRetrying(true)
    await refreshProfile()
    setRetrying(false)
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-4 lg:p-6">
          {showBanner && (
            <div
              role="alert"
              className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              <p>
                We could not load your profile:{' '}
                {profileError}
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {retrying ? 'Retrying...' : 'Retry'}
                </button>

                <button
                  onClick={() =>
                    setDismissedError(profileError)
                  }
                  className="rounded-md px-2 py-1 text-red-700 hover:bg-red-100"
                  aria-label="Dismiss this message"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { useState } from 'react'

import { useAuth } from '../contexts/AuthContext'

type HeaderProps = {
  onMenuClick: () => void
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  const {
    profile,
    signOut,
  } = useAuth()

  const [signingOut, setSigningOut] =
    useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        ☰
      </button>

      <div className="hidden lg:block">
        <h1 className="font-semibold text-slate-900">
          Prepaid Energy Meter
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-800">
            {profile?.full_name || 'User'}
          </p>

          <p className="text-xs capitalize text-slate-500">
            {profile?.role || 'user'}
          </p>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {signingOut
            ? 'Signing out...'
            : 'Sign out'}
        </button>
      </div>
    </header>
  )
}
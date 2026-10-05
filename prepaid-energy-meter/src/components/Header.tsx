import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

type HeaderProps = {
  onMenuClick: () => void
}

export default function Header({
  onMenuClick,
}: HeaderProps) {
  const {
    user,
    profile,
    signOut,
  } = useAuth()

  const [signingOut, setSigningOut] =
    useState(false)

  const name = profile?.full_name?.trim() || ''

  // First letter of the name (or the email) for the round avatar.
  const initial = (name || user?.email || 'U')
    .charAt(0)
    .toUpperCase()

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

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Name and avatar both open the Profile page.
            On a phone only the avatar is shown. */}
        <Link
          to="/profile"
          title="Your profile"
          aria-label="Open your profile"
          className="flex items-center gap-3 rounded-lg p-1 hover:bg-slate-50"
        >
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">
              {name || 'User'}
            </p>

            <p className="text-xs capitalize text-slate-500">
              {profile?.role || 'user'}
            </p>
          </div>

          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initial}
          </span>
        </Link>

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

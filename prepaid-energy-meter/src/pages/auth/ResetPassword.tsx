import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

// If the email link was invalid or expired, Supabase sends the
// visitor back here with the error in the address, either after "?"
// or after "#". This reads it and returns a friendly message.
function readLinkError(
  search: string,
  hash: string
): string | null {
  const fromQuery = new URLSearchParams(search)
  const fromHash = new URLSearchParams(
    hash.startsWith('#') ? hash.slice(1) : hash
  )

  const read = (key: string) =>
    fromQuery.get(key) ?? fromHash.get(key)

  const code = read('error_code')
  const description = read('error_description')
  const generic = read('error')

  if (!code && !description && !generic) {
    return null
  }

  if (
    code === 'otp_expired' ||
    /expired|invalid/i.test(description ?? '')
  ) {
    return 'This password reset link is invalid or has expired. Reset links work only once and stop working after a short time.'
  }

  return (
    description ??
    'We could not verify this password reset link.'
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()

  // "loading" = still checking for a saved sign-in.
  // "session" exists when the email link signed the user in.
  const { loading: authLoading, session } = useAuth()

  // Read once, when the page first opens.
  const [linkError] = useState(() =>
    readLinkError(
      window.location.search,
      window.location.hash
    )
  )

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [loading, setLoading] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setError('')

    if (password.length < 8) {
      setError(
        'Password must contain at least 8 characters.'
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      })

    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }

    // Shows the green box right away, so the "link not ready"
    // box cannot flash while we sign out.
    setFinished(true)

    // The reset link signed the user in. Sign out so they log in
    // again with the new password.
    const { error: signOutError } =
      await supabase.auth.signOut()

    if (signOutError) {
      // Fallback: at least clear the sign-in on this device.
      await supabase.auth.signOut({ scope: 'local' })
    }

    navigate('/signin', {
      replace: true,
      state: {
        message:
          'Your password was updated. Please sign in with your new password.',
      },
    })
  }

  function renderBody() {
    if (finished) {
      return (
        <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          Password updated. Taking you to the sign-in
          page...
        </div>
      )
    }

    if (authLoading) {
      return (
        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          Checking your reset link...
        </div>
      )
    }

    if (linkError || !session) {
      return (
        <div className="mt-6 space-y-4">
          <div
            role="alert"
            className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800"
          >
            {linkError ??
              'Your password reset session is not ready. The link may have expired or already been used.'}
          </div>

          <Link
            to="/forgot-password"
            className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-700"
          >
            Request a new reset link
          </Link>
        </div>
      )
    }

    return (
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="New password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          placeholder="Confirm new password"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">
          Choose a new password
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Enter your new password below.
        </p>

        {renderBody()}

        <Link
          to="/signin"
          className="mt-6 block text-center text-sm text-blue-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

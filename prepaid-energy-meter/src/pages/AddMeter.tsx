import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useMeters } from '../contexts/meterContextValue'
import { supabase } from '../lib/supabase'

// Turns the database error into a clear sentence for the user.
function explainClaimError(message: string): string {
  const text = message.toLowerCase()

  if (/already|claimed|taken|owned|in use/.test(text)) {
    return 'This meter has already been claimed. If it is yours, ask the administrator to release it.'
  }

  if (/invalid|not found|no meter|unknown|does not exist|no such|wrong/.test(text)) {
    return 'That claim code is not valid. Check the code on your meter and try again.'
  }

  if (/jwt|not authenticated|not logged|permission|unauthori/.test(text)) {
    return 'Your sign-in has expired. Please sign out and sign in again.'
  }

  return 'The meter could not be linked.'
}

export default function AddMeter() {
  const navigate = useNavigate()
  const { meters, selectMeter, refreshMeters } = useMeters()

  const [claimCode, setClaimCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setDetails('')

    const code = claimCode.trim()

    if (!code) {
      setError('Please enter the claim code.')
      return
    }

    setSubmitting(true)

    const { error: claimError } = await supabase.rpc('claim_meter', {
      p_claim_code: code,
    })

    if (claimError) {
      setSubmitting(false)
      setError(explainClaimError(claimError.message))
      setDetails(claimError.message) // the original text, for troubleshooting
      return
    }

    // Success: reload the list and open the new meter.
    const knownIds = new Set(meters.map((meter) => meter.id))
    const updated = await refreshMeters()
    const added = updated.find((meter) => !knownIds.has(meter.id))

    if (added) {
      selectMeter(added.id)
    }

    navigate('/dashboard')
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-slate-900">Add a meter</h2>

      <p className="mt-2 text-sm text-slate-500">
        Enter the claim code that came with your meter. It links the meter to
        your account.
      </p>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Claim code
            </span>

            <input
              value={claimCode}
              onChange={(event) => setClaimCode(event.target.value)}
              placeholder="DEMO-0001"
              autoComplete="off"
              autoCapitalize="characters"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              <p>{error}</p>

              {details && (
                <p className="mt-1 text-xs text-red-500">Details: {details}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Linking...' : 'Link meter'}
            </button>

            <Link
              to="/meters"
              className="text-sm text-slate-600 hover:underline"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

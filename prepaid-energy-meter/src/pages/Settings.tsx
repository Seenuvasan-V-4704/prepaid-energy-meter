import type { FormEvent } from 'react'
import { useState } from 'react'

import MeterSelector from '../components/MeterSelector'
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { useMeters } from '../contexts/meterContextValue'
import { formatInr } from '../lib/format'
import type { Meter } from '../lib/meters'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { meters, selectedMeter, loading, error, refreshMeters } = useMeters()

  function renderBody() {
    if (loading) {
      return <LoadingBlock text="Loading your meters..." />
    }

    if (error && meters.length === 0) {
      return (
        <ErrorBlock
          message={`Could not load your meters: ${error}`}
          onRetry={() => void refreshMeters()}
        />
      )
    }

    if (!selectedMeter) {
      return (
        <EmptyState
          title="No meter linked yet"
          text="Link a meter first, then you can rename it and set its low-balance alert here."
          actionLabel="Add a meter"
          actionTo="/meters/add"
        />
      )
    }

    // key: the form starts from the saved values once per meter and is
    // not reset when the meter updates live in the background.
    return <MeterSettingsForm key={selectedMeter.id} meter={selectedMeter} />
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>

        <MeterSelector />
      </div>

      {renderBody()}
    </div>
  )
}

function MeterSettingsForm({ meter }: { meter: Meter }) {
  const { refreshMeters } = useMeters()

  const [name, setName] = useState(meter.name)
  const [threshold, setThreshold] = useState(String(meter.alertThreshold))

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    const cleanName = name.trim()
    const amount = Number(threshold)

    if (!cleanName) {
      setError('Please enter a name for the meter.')
      return
    }

    if (cleanName.length > 40) {
      setError('The name can have at most 40 characters.')
      return
    }

    if (threshold.trim() === '' || !Number.isFinite(amount) || amount < 0) {
      setError('The alert threshold must be a number that is 0 or more.')
      return
    }

    if (amount > 100000) {
      setError('The alert threshold is too large (maximum 100000).')
      return
    }

    setSaving(true)

    const { error: saveError } = await supabase.rpc('update_meter_settings', {
      p_meter_id: meter.id,
      p_name: cleanName,
      p_alert_threshold: Math.round(amount * 100) / 100, // 2 decimals
    })

    if (saveError) {
      setSaving(false)
      setError(saveError.message)
      return
    }

    await refreshMeters()
    setSaving(false)
    setName(cleanName)
    setMessage('Settings saved.')
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h3 className="font-semibold text-slate-900">Meter settings</h3>

      <p className="mt-1 text-sm text-slate-500">Device {meter.deviceId}</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Meter name
          </span>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Low-balance alert threshold (INR)
          </span>

          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <span className="mt-1 block text-xs text-slate-500">
            You get a WhatsApp message when the balance falls to this amount.
            Power is cut at the minimum balance of {formatInr(meter.minBalance)},
            so keep the alert above that.
          </span>
        </label>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'

import { callFunction } from '../lib/api'
import { isMeterOnline, type Meter } from '../lib/meters'
import { supabase } from '../lib/supabase'

type Command = { id: string; value: number; status: string }

const STATUS_TEXT: Record<string, string> = {
  pending: 'Pending',
  acked: 'Acknowledged',
  failed: 'Failed',
}

const STATUS_COLOUR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  acked: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
}

export default function RelayCard({ meter, now }: { meter: Meter; now: number }) {
  const [command, setCommand] = useState<Command | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('commands')
      .select('id, value, status')
      .eq('meter_id', meter.id)
      .eq('action', 'relay')
      .order('created_at', { ascending: false })
      .limit(1)

    setCommand((data?.[0] as Command | undefined) ?? null)
  }, [meter.id])

  // Load once, then reload whenever a command of this meter changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()

    const channel = supabase
      .channel(`commands-${meter.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commands', filter: `meter_id=eq.${meter.id}` },
        () => void load()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [meter.id, load])

  const online = isMeterOnline(meter.lastSeenMs, now)
  const noMoney = meter.balance <= meter.minBalance

  async function send(value: 0 | 1) {
    setBusy(true)
    setError('')

    try {
      await callFunction('send-command', { meter_id: meter.id, value })
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }

    setBusy(false)
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Relay control</h3>

        {command && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              STATUS_COLOUR[command.status] ?? 'bg-slate-200 text-slate-600'
            }`}
          >
            Last command: relay {command.value === 1 ? 'ON' : 'OFF'} ·{' '}
            {STATUS_TEXT[command.status] ?? command.status}
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => void send(1)}
          disabled={busy || !online || noMoney}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Relay ON
        </button>

        <button
          onClick={() => void send(0)}
          disabled={busy || !online}
          className="rounded-lg bg-slate-700 px-5 py-2.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Relay OFF
        </button>
      </div>

      {!online && <p className="text-sm text-slate-500">Meter is offline.</p>}
      {online && noMoney && (
        <p className="text-sm text-slate-500">Balance is too low to switch ON. Recharge first.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
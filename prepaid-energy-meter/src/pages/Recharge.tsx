import { useCallback, useEffect, useRef, useState } from 'react'

import MeterSelector from '../components/MeterSelector'
import { EmptyState, LoadingBlock } from '../components/StateBlocks'
import { useMeters } from '../contexts/meterContextValue'
import { callFunction } from '../lib/api'
import { formatInr } from '../lib/format'
import { supabase } from '../lib/supabase'

const AMOUNTS = [50, 100, 200, 500]

type Row = Record<string, unknown>

export default function Recharge() {
  const { selectedMeter, loading, refreshMeters } = useMeters()

  const [amount, setAmount] = useState<number | null>(null)
  const [tab, setTab] = useState<'upi' | 'card'>('upi')
  const [fail, setFail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ledger, setLedger] = useState<Row[]>([])
  const clicked = useRef(false) // blocks a double click

  const meterId = selectedMeter?.id

  const loadLedger = useCallback(async () => {
    if (!meterId) return
    const { data } = await supabase
      .from('ledger')
      .select('*')
      .eq('meter_id', meterId)
      .order('created_at', { ascending: false })
      .limit(10)
    setLedger((data as Row[] | null) ?? [])
  }, [meterId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLedger()
  }, [loadLedger])

  if (loading) return <LoadingBlock text="Loading your meters..." />

  if (!selectedMeter) {
    return (
      <EmptyState
        title="No meter linked yet"
        text="Link a meter first, then you can recharge it."
        actionLabel="Add a meter"
        actionTo="/meters/add"
      />
    )
  }

  async function pay() {
    if (clicked.current || !amount || !selectedMeter) return
    clicked.current = true
    setBusy(true)
    setError('')
    setMessage('')

    try {
      const order = await callFunction<{ payment_id: string }>('create-recharge-order', {
        meter_id: selectedMeter.id,
        amount,
      })

      await new Promise((resolve) => setTimeout(resolve, 2000)) // fake processing

      const result = await callFunction<{ status: string; balance: number }>('confirm-recharge', {
        payment_id: order.payment_id,
        success: !fail,
      })

      setMessage(
        fail
          ? 'Payment failed. Nothing was charged.'
          : `Recharge successful. New balance: ${formatInr(Number(result.balance))}`
      )
      setAmount(null)
      await refreshMeters()
      await loadLedger()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    }

    setBusy(false)
    clicked.current = false
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Recharge</h2>
        <MeterSelector />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">
          {selectedMeter.name} · Balance {formatInr(selectedMeter.balance)}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {AMOUNTS.map((value) => (
            <button
              key={value}
              onClick={() => {
                setAmount(value)
                setMessage('')
                setError('')
              }}
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
            >
              {formatInr(value)}
            </button>
          ))}
        </div>

        {message && (
          <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{message}</div>
        )}
        {error && !amount && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-900">Last 10 ledger entries</h3>

        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No entries yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Time</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, index) => (
                <tr key={String(row.id ?? index)} className="border-t border-slate-100">
                  <td className="py-1.5">{new Date(String(row.created_at)).toLocaleString()}</td>
                  <td>{String(row.type ?? row.kind ?? row.description ?? '')}</td>
                  <td className="text-right">{formatInr(Number(row.amount ?? 0))}</td>
                  <td className="text-right">
                    {row.balance_after == null ? '' : formatInr(Number(row.balance_after))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {amount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <p className="rounded-md bg-amber-100 px-3 py-1.5 text-center text-xs font-bold text-amber-800">
              SIMULATED PAYMENT, no real money
            </p>

            <h3 className="text-lg font-semibold text-slate-900">Pay {formatInr(amount)}</h3>

            <div className="flex gap-2">
              {(['upi', 'card'] as const).map((name) => (
                <button
                  key={name}
                  onClick={() => setTab(name)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                    tab === name ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {name === 'upi' ? 'UPI' : 'Card'}
                </button>
              ))}
            </div>

            {tab === 'upi' ? (
              <input
                placeholder="name@upi"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              />
            ) : (
              <div className="space-y-2">
                <input placeholder="Card number" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
                <div className="flex gap-2">
                  <input placeholder="MM/YY" className="w-1/2 rounded-lg border border-slate-300 px-3 py-2.5" />
                  <input placeholder="CVV" className="w-1/2 rounded-lg border border-slate-300 px-3 py-2.5" />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
              Simulate failed payment
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setAmount(null)}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={() => void pay()}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {busy ? 'Processing...' : 'Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
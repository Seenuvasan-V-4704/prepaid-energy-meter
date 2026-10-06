import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import OnlineBadge from '../components/OnlineBadge'
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { useMeters } from '../contexts/meterContextValue'
import { useNow } from '../hooks/useNow'
import { formatInr } from '../lib/format'

export default function Meters() {
  const { meters, selectedMeter, loading, error, selectMeter, refreshMeters } =
    useMeters()

  const navigate = useNavigate()
  const now = useNow(5000)

  // Reload the list when the page opens, so balances are fresh.
  useEffect(() => {
    void refreshMeters()
  }, [refreshMeters])

  function openDashboard(id: string) {
    selectMeter(id)
    navigate('/dashboard')
  }

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

    if (meters.length === 0) {
      return (
        <EmptyState
          title="No meters yet"
          text="Add your first meter with the claim code that came with it."
          actionLabel="Add a meter"
          actionTo="/meters/add"
        />
      )
    }

    return (
      <ul className="grid gap-4 md:grid-cols-2">
        {meters.map((meter) => {
          const selected = selectedMeter?.id === meter.id

          return (
            <li
              key={meter.id}
              className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${
                selected ? 'ring-2 ring-blue-500' : 'ring-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{meter.name}</h3>
                  <p className="text-sm text-slate-500">Device {meter.deviceId}</p>
                </div>

                {selected && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Selected
                  </span>
                )}
              </div>

              <div className="mt-3">
                <OnlineBadge lastSeenMs={meter.lastSeenMs} now={now} />
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Balance{' '}
                <span className="font-semibold text-slate-900">
                  {formatInr(meter.balance)}
                </span>
              </p>

              <button
                onClick={() => openDashboard(meter.id)}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Open dashboard
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">My meters</h2>

        <Link
          to="/meters/add"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add meter
        </Link>
      </div>

      {renderBody()}
    </div>
  )
}

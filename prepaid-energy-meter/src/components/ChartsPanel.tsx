import { useState } from 'react'

import type { LiveReadings } from '../hooks/useLiveReadings'
import type { Reading } from '../lib/meters'
import {
  bucketSecondsFor,
  RANGES,
  type SeriesPoint,
} from '../lib/series'
import LiveChart from './LiveChart'

type ChartsPanelProps = {
  live: LiveReadings
  // Current time, updated every few seconds by the parent.
  now: number
  rangeMinutes: number
  onRangeChange: (minutes: number) => void
}

// A frozen copy of what the charts showed when "Pause" was pressed.
type Snapshot = {
  points: SeriesPoint[]
  latest: Reading | null
  windowStart: number
  windowEnd: number
}

export default function ChartsPanel({
  live,
  now,
  rangeMinutes,
  onRangeChange,
}: ChartsPanelProps) {
  const [frozen, setFrozen] = useState<Snapshot | null>(null)

  const windowMs = rangeMinutes * 60_000
  const lastPoint = live.points[live.points.length - 1]
  const windowEnd = Math.max(now, lastPoint ? lastPoint.t : 0)

  // What the charts show when they are live.
  const liveView: Snapshot = {
    points: live.points,
    latest: live.latest,
    windowStart: windowEnd - windowMs,
    windowEnd,
  }

  // While paused the charts keep showing the frozen copy,
  // but new readings still arrive in the background.
  const view = frozen ?? liveView
  const paused = frozen !== null

  const gapMs = Math.max(30_000, bucketSecondsFor(rangeMinutes) * 3000)

  function togglePaused() {
    setFrozen((current) => (current ? null : liveView))
  }

  function chooseRange(minutes: number) {
    setFrozen(null) // a new range always starts live
    onRangeChange(minutes)
  }

  // Props shared by the three charts.
  const shared = {
    points: view.points,
    windowStart: view.windowStart,
    windowEnd: view.windowEnd,
    gapMs,
    loading: live.seriesLoading,
    error: live.seriesError,
    onRetry: live.reload,
    paused,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Live graphs</h3>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionPill status={live.liveStatus} />

          <div
            role="group"
            aria-label="Time range"
            className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white"
          >
            {RANGES.map((range) => (
              <button
                key={range.minutes}
                onClick={() => chooseRange(range.minutes)}
                aria-pressed={range.minutes === rangeMinutes}
                className={`px-3 py-1.5 text-sm font-medium ${
                  range.minutes === rangeMinutes
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          <button
            onClick={togglePaused}
            aria-pressed={paused}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              paused
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            {paused ? '▶ Paused - tap to resume' : '● Live - tap to pause'}
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        <LiveChart
          {...shared}
          title="Voltage"
          unit="V"
          color="#2563eb"
          metric="v"
          latest={view.latest ? view.latest.voltage : null}
          decimals={1}
          yPad={2}
        />

        <LiveChart
          {...shared}
          title="Current"
          unit="A"
          color="#ea580c"
          metric="i"
          latest={view.latest ? view.latest.current : null}
          decimals={2}
          yPad={0.1}
          nonNegative
        />

        <LiveChart
          {...shared}
          title="Power"
          unit="W"
          color="#059669"
          metric="p"
          latest={view.latest ? view.latest.power : null}
          decimals={1}
          yPad={10}
          nonNegative
        />
      </div>

      <p className="text-xs text-slate-500">
        Times are shown in your local time. Min and max are taken from the
        points on the chart; on the longer ranges each point is an average.
      </p>
    </div>
  )
}

function ConnectionPill({ status }: { status: LiveReadings['liveStatus'] }) {
  if (status === 'live') {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        Live updates on
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
        Connection lost - retrying
      </span>
    )
  }

  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      Connecting...
    </span>
  )
}

import { memo, useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatClock, formatDateTime } from '../lib/format'
import {
  makeTicks,
  seriesStats,
  toPlotData,
  yAxisScale,
  type Metric,
  type SeriesPoint,
} from '../lib/series'

type LiveChartProps = {
  title: string
  unit: string
  color: string
  metric: Metric
  // All points held in memory (the chart shows the part inside the window).
  points: SeriesPoint[]
  windowStart: number
  windowEnd: number
  // A time gap longer than this breaks the line.
  gapMs: number
  // Newest raw value, shown above the chart.
  latest: number | null
  decimals: number
  // Extra space above and below the data on the Y axis.
  yPad: number
  nonNegative?: boolean
  loading: boolean
  error: string | null
  onRetry?: () => void
  paused: boolean
}

function LiveChart({
  title,
  unit,
  color,
  metric,
  points,
  windowStart,
  windowEnd,
  gapMs,
  latest,
  decimals,
  yPad,
  nonNegative = false,
  loading,
  error,
  onRetry,
  paused,
}: LiveChartProps) {
  const plotData = useMemo(
    () => toPlotData(points, windowStart, windowEnd, gapMs),
    [points, windowStart, windowEnd, gapMs]
  )

  // Min and max of what is on the chart.
  const stats = useMemo(
    () =>
      seriesStats(
        points.filter((p) => p.t >= windowStart && p.t <= windowEnd),
        metric
      ),
    [points, windowStart, windowEnd, metric]
  )

  const yScale = yAxisScale(stats, yPad, nonNegative)
  const ticks = useMemo(
    () => makeTicks(windowStart, windowEnd),
    [windowStart, windowEnd]
  )

  const showSeconds = windowEnd - windowStart <= 10 * 60_000
  const format = (value: number) => value.toFixed(decimals)

  function renderBody() {
    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-red-700">
          <p>{error}</p>

          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          )}
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Loading readings...
        </div>
      )
    }

    if (plotData.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Waiting for data from the meter
        </div>
      )
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={plotData}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="t"
            type="number"
            domain={[windowStart, windowEnd]}
            allowDataOverflow
            ticks={ticks}
            tickFormatter={(value: number) => formatClock(value, showSeconds)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            height={44}
            label={{
              value: 'Time',
              position: 'insideBottom',
              offset: 0,
              fontSize: 12,
              fill: '#475569',
            }}
          />

          <YAxis
            domain={yScale ? yScale.domain : ['auto', 'auto']}
            ticks={yScale ? yScale.ticks : undefined}
            tickFormatter={(value: number) => format(value)}
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={64}
            label={{
              value: `${title} (${unit})`,
              angle: -90,
              position: 'insideLeft',
              offset: 8,
              fontSize: 12,
              fill: '#475569',
              style: { textAnchor: 'middle' },
            }}
          />

          <Tooltip
            isAnimationActive={false}
            labelFormatter={(label) => formatDateTime(Number(label))}
            formatter={(value) => [
              typeof value === 'number' ? `${format(value)} ${unit}` : '',
              title,
            ]}
          />

          <Line
            type="linear"
            dataKey={metric}
            name={title}
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {title} <span className="font-normal text-slate-500">({unit})</span>
        </h3>

        {paused && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Paused
          </span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Latest</dt>
          <dd className="font-semibold" style={{ color }}>
            {latest === null ? '—' : `${format(latest)} ${unit}`}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Min</dt>
          <dd className="font-semibold text-slate-800">
            {stats ? `${format(stats.min)} ${unit}` : '—'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-slate-500">Max</dt>
          <dd className="font-semibold text-slate-800">
            {stats ? `${format(stats.max)} ${unit}` : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 h-56 sm:h-64">{renderBody()}</div>
    </section>
  )
}

// memo: a chart is redrawn only when its own data changes.
export default memo(LiveChart)

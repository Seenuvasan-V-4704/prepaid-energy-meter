// Logic for the live graphs. Everything here is plain functions, so it
// is easy to test and never touches React or Supabase.

import type { Reading } from './meters'

export type Metric = 'v' | 'i' | 'p'

// One stored point: the average of the readings in one time bucket.
// n = how many readings are inside (used to keep the average correct).
export type SeriesPoint = {
  t: number
  v: number
  i: number
  p: number
  n: number
}

// A point as drawn. null values make a gap in the line.
export type PlotPoint = {
  t: number
  v: number | null
  i: number | null
  p: number | null
}

// The most points we keep per chart.
export const MAX_POINTS = 500

export const RANGES = [
  { label: '5 min', minutes: 5 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
] as const

export const DEFAULT_RANGE_MINUTES = 30

// Bucket size in seconds, so a range never has more than MAX_POINTS
// buckets. 5 min -> 1 s, 30 min -> 4 s, 1 h -> 8 s, 6 h -> 44 s.
// The database function uses the very same number.
export function bucketSecondsFor(rangeMinutes: number): number {
  return Math.max(1, Math.ceil((rangeMinutes * 60) / MAX_POINTS))
}

// Converts one row from the database function into a point.
export function rowToSeriesPoint(row: Record<string, unknown>): SeriesPoint {
  const num = (value: unknown) => {
    const result = Number(value)
    return Number.isFinite(result) ? result : 0
  }

  return {
    t: Date.parse(String(row.bucket_start)),
    v: num(row.voltage),
    i: num(row.current),
    p: num(row.power),
    n: Math.max(1, num(row.n)),
  }
}

// Adds one live reading. It is averaged into its time bucket, so the
// chart never grows beyond MAX_POINTS. Old points leave the window.
export function mergeReading(
  points: SeriesPoint[],
  reading: Reading,
  bucketSec: number,
  windowStartMs: number
): SeriesPoint[] {
  const bucketMs = bucketSec * 1000
  const start = Math.floor(reading.t / bucketMs) * bucketMs
  const next = points.slice()

  // Find the bucket from the end (new readings almost always go last).
  let index = next.length - 1

  while (index >= 0 && next[index].t > start) {
    index--
  }

  if (index >= 0 && next[index].t === start) {
    const old = next[index]
    const n = old.n + 1

    next[index] = {
      t: start,
      v: (old.v * old.n + reading.voltage) / n,
      i: (old.i * old.n + reading.current) / n,
      p: (old.p * old.n + reading.power) / n,
      n,
    }
  } else {
    next.splice(index + 1, 0, {
      t: start,
      v: reading.voltage,
      i: reading.current,
      p: reading.power,
      n: 1,
    })
  }

  // Drop points that are older than the time window.
  const firstKept = next.findIndex((p) => p.t >= windowStartMs - bucketMs)
  const trimmed =
    firstKept === -1 ? [] : firstKept > 0 ? next.slice(firstKept) : next

  // Safety net: never keep more than MAX_POINTS.
  return trimmed.length > MAX_POINTS
    ? trimmed.slice(trimmed.length - MAX_POINTS)
    : trimmed
}

// Prepares points for drawing: keeps only the visible window and
// inserts an empty point where the data has a long gap, so the line
// breaks instead of joining two far-apart readings.
export function toPlotData(
  points: SeriesPoint[],
  windowStart: number,
  windowEnd: number,
  gapMs: number
): PlotPoint[] {
  const out: PlotPoint[] = []
  let previous: SeriesPoint | null = null

  for (const point of points) {
    if (point.t < windowStart || point.t > windowEnd) {
      continue
    }

    if (previous && point.t - previous.t > gapMs) {
      out.push({ t: previous.t + 1, v: null, i: null, p: null })
    }

    out.push({ t: point.t, v: point.v, i: point.i, p: point.p })
    previous = point
  }

  return out
}

// Smallest and largest value of one metric (null when there is no data).
export function seriesStats(
  points: SeriesPoint[],
  metric: Metric
): { min: number; max: number } | null {
  if (points.length === 0) {
    return null
  }

  let min = Infinity
  let max = -Infinity

  for (const point of points) {
    const value = point[metric]
    if (value < min) min = value
    if (value > max) max = value
  }

  return { min, max }
}

// Rounds a step size to 1, 2 or 5 times a power of ten (0.1, 0.2, 0.5, 1, 2, 5, 10 ...).
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

// Y axis: a little space above and below the data, rounded to clean
// steps, with the tick values worked out here (about 5 to 7 ticks).
export function yAxisScale(
  stats: { min: number; max: number } | null,
  pad: number,
  nonNegative: boolean
): { domain: [number, number]; ticks: number[] } | null {
  if (!stats) {
    return null
  }

  const rawLow = nonNegative ? Math.max(0, stats.min - pad) : stats.min - pad
  const rawHigh = stats.max + pad
  const step = niceStep(Math.max(rawHigh - rawLow, pad) / 5)

  const low = Math.floor(rawLow / step) * step
  const high = Math.max(Math.ceil(rawHigh / step) * step, low + step)

  const ticks: number[] = []
  for (let value = low; value <= high + step / 1000; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6)
  }

  return { domain: [low, high], ticks }
}

// "Nice" tick times for the X axis, lined up with local clock times.
const TICK_STEPS_MS = [
  10_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000,
  3_600_000, 7_200_000,
]

export function makeTicks(start: number, end: number): number[] {
  const span = end - start
  const step =
    TICK_STEPS_MS.find((candidate) => span / candidate <= 6) ??
    TICK_STEPS_MS[TICK_STEPS_MS.length - 1]

  // Shift by the time-zone offset so ticks land on :00, :05 and so on.
  const offset = -new Date(start).getTimezoneOffset() * 60_000
  const ticks: number[] = []

  for (
    let tick = Math.ceil((start + offset) / step) * step - offset;
    tick <= end;
    tick += step
  ) {
    ticks.push(tick)
  }

  return ticks
}

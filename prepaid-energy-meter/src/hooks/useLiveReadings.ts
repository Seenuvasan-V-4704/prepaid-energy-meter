import { useCallback, useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'
import {
  READING_COLUMNS,
  toReading,
  type Reading,
} from '../lib/meters'
import {
  bucketSecondsFor,
  mergeReading,
  rowToSeriesPoint,
  type SeriesPoint,
} from '../lib/series'

export type LiveStatus = 'connecting' | 'live' | 'error'

export type LiveReadings = {
  // Chart points for the chosen range (updated live).
  points: SeriesPoint[]
  // The newest reading, for the dashboard cards.
  latest: Reading | null
  seriesLoading: boolean
  seriesError: string | null
  latestLoading: boolean
  latestError: string | null
  // State of the Realtime connection.
  liveStatus: LiveStatus
  // Loads everything again (used by the Retry button).
  reload: () => void
}

// Results are stored together with the meter/range they belong to.
// A result for an old meter or range is simply ignored.
type SeriesState = { key: string; points: SeriesPoint[]; error: string | null }
type LatestState = {
  meterId: string
  reading: Reading | null
  error: string | null
}
type ConnectionState = { key: string; status: 'live' | 'error' }

function makeKey(meterId: string, rangeMinutes: number): string {
  return `${meterId}|${rangeMinutes}`
}

function newer(a: Reading | null, b: Reading | null): Reading | null {
  if (!a) return b
  if (!b) return a
  return a.t >= b.t ? a : b
}

export function useLiveReadings(
  meterId: string | null,
  rangeMinutes: number
): LiveReadings {
  const [seriesState, setSeriesState] = useState<SeriesState | null>(null)
  const [latestState, setLatestState] = useState<LatestState | null>(null)
  const [connection, setConnection] = useState<ConnectionState | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    if (!meterId) {
      return
    }

    const id = meterId
    const seriesKey = makeKey(id, rangeMinutes)
    const windowMs = rangeMinutes * 60_000
    const bucketSec = bucketSecondsFor(rangeMinutes)

    let cancelled = false
    let ready = false // becomes true once the history is loaded
    let loadedUntil = 0 // newest time already inside the history
    let hadError = false
    const waiting: Reading[] = [] // live readings that came during loading

    function addToSeries(reading: Reading) {
      setSeriesState((previous) =>
        previous && previous.key === seriesKey
          ? {
              ...previous,
              points: mergeReading(
                previous.points,
                reading,
                bucketSec,
                Date.now() - windowMs
              ),
            }
          : previous
      )
    }

    function setLatest(reading: Reading | null, error: string | null) {
      setLatestState((previous) => {
        const old = previous && previous.meterId === id ? previous.reading : null
        return { meterId: id, reading: newer(old, reading), error }
      })
    }

    // A new reading arrived through Realtime.
    function handleIncoming(reading: Reading) {
      setLatest(reading, null)

      if (!ready) {
        waiting.push(reading)
        return
      }

      if (reading.t > loadedUntil) {
        addToSeries(reading)
      }
    }

    // 1. Open the Realtime subscription FIRST, so nothing is missed.
    //    The random suffix avoids a clash with a channel that is still
    //    closing (React StrictMode runs effects twice in development).
    const channel = supabase
      .channel(`readings-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'readings',
          filter: `meter_id=eq.${id}`,
        },
        (payload) => handleIncoming(toReading(payload.new))
      )
      .subscribe((status) => {
        if (cancelled) {
          return
        }

        if (status === 'SUBSCRIBED') {
          setConnection({ key: seriesKey, status: 'live' })

          // Connection came back after a problem: reload to fill the gap.
          if (hadError) {
            hadError = false
            setReloadTick((tick) => tick + 1)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          hadError = true
          setConnection({ key: seriesKey, status: 'error' })
        }
      })

    // 2. Load the history and the newest reading.
    async function load() {
      const since = new Date(Date.now() - windowMs).toISOString()

      const [seriesResult, latestResult] = await Promise.all([
        supabase.rpc('get_reading_series', {
          p_meter_id: id,
          p_since: since,
          p_bucket_seconds: bucketSec,
        }),
        supabase
          .from('readings')
          .select(READING_COLUMNS)
          .eq('meter_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (cancelled) {
        return
      }

      // Newest reading (cards)
      if (latestResult.error) {
        setLatest(null, latestResult.error.message)
      } else {
        setLatest(
          latestResult.data
            ? toReading(latestResult.data as Record<string, unknown>)
            : null,
          null
        )
      }

      // History (charts)
      if (seriesResult.error) {
        const missing = seriesResult.error.code === 'PGRST202'

        setSeriesState({
          key: seriesKey,
          points: [],
          error: missing
            ? 'The chart function is missing in Supabase. Run "SQL 1" of Step 3 first.'
            : seriesResult.error.message,
        })
        return
      }

      const rows = (seriesResult.data ?? []) as Record<string, unknown>[]
      const points = rows.map(rowToSeriesPoint)

      loadedUntil = rows.reduce((newest, row) => {
        const time = Date.parse(String(row.last_at))
        return Number.isNaN(time) ? newest : Math.max(newest, time)
      }, 0)

      setSeriesState({ key: seriesKey, points, error: null })
      ready = true

      // Add the live readings that arrived while we were loading
      // (skipping any that are already inside the history).
      for (const reading of waiting.splice(0)) {
        if (reading.t > loadedUntil) {
          addToSeries(reading)
        }
      }
    }

    load().catch((caught: unknown) => {
      if (cancelled) {
        return
      }

      const message =
        caught instanceof Error ? caught.message : 'Could not load readings.'

      setSeriesState({ key: seriesKey, points: [], error: message })
      setLatest(null, message)
    })

    // Cleanup: runs when the meter or range changes and on unmount.
    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [meterId, rangeMinutes, reloadTick])

  const reload = useCallback(() => setReloadTick((tick) => tick + 1), [])

  // ---- Values for the screen ----
  const key = meterId ? makeKey(meterId, rangeMinutes) : ''
  const currentSeries = seriesState && seriesState.key === key ? seriesState : null
  const currentLatest =
    latestState && latestState.meterId === meterId ? latestState : null
  const currentConnection =
    connection && connection.key === key ? connection.status : 'connecting'

  return {
    points: currentSeries?.points ?? EMPTY_POINTS,
    latest: currentLatest?.reading ?? null,
    seriesLoading: meterId !== null && currentSeries === null,
    seriesError: currentSeries?.error ?? null,
    latestLoading: meterId !== null && currentLatest === null,
    latestError: currentLatest?.error ?? null,
    liveStatus: currentConnection,
    reload,
  }
}

// One shared empty array, so "no data" does not create a new array
// (and a re-render) every time.
const EMPTY_POINTS: SeriesPoint[] = []

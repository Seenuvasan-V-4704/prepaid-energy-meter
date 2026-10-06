import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { supabase } from '../lib/supabase'
import { METER_COLUMNS, toMeter, type Meter } from '../lib/meters'
import { useAuth } from './AuthContext'
import { MeterContext, type MeterContextType } from './meterContextValue'

type MetersState = { userId: string; meters: Meter[]; error: string | null }
type Selection = { userId: string; id: string }

const NO_METERS: Meter[] = []

// The chosen meter is remembered in the browser, separately per user.
function storageKey(userId: string): string {
  return `energypay:selected-meter:${userId}`
}

function readStoredId(userId: string | null): string | null {
  if (!userId) {
    return null
  }

  try {
    return window.localStorage.getItem(storageKey(userId))
  } catch {
    return null // storage can be blocked, so never crash
  }
}

function storeId(userId: string, meterId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), meterId)
  } catch {
    // ignore: the choice just will not be remembered
  }
}

async function fetchMeters(
  userId: string
): Promise<{ meters: Meter[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('meters')
      .select(METER_COLUMNS)
      // Only meters this user owns (an admin may be able to read more).
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      return { meters: null, error: error.message }
    }

    return {
      meters: (data ?? []).map((row) =>
        toMeter(row as unknown as Record<string, unknown>)
      ),
      error: null,
    }
  } catch (caught) {
    return {
      meters: null,
      error:
        caught instanceof Error
          ? caught.message
          : 'Could not load your meters.',
    }
  }
}

export function MeterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [state, setState] = useState<MetersState | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)

  // ---- Values derived from the state ----
  const current = state && state.userId === userId ? state : null
  const meters = current?.meters ?? NO_METERS
  const loading = userId !== null && current === null
  const error = current?.error ?? null

  const storedId = useMemo(() => readStoredId(userId), [userId])
  const chosenId =
    selection && selection.userId === userId ? selection.id : storedId

  // If the remembered meter is gone, fall back to the first one.
  const selectedMeter =
    meters.find((meter) => meter.id === chosenId) ?? meters[0] ?? null

  const selectedId = selectedMeter?.id ?? null

  // ---- Load the list when the signed-in user changes ----
  useEffect(() => {
    if (!userId) {
      return
    }

    let cancelled = false

    void fetchMeters(userId).then((result) => {
      if (!cancelled) {
        setState({
          userId,
          meters: result.meters ?? NO_METERS,
          error: result.error,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  // ---- Live updates of the SELECTED meter row only ----
  // (balance, relay, last_seen ...). The subscription is closed
  // when the meter changes or the page is left.
  useEffect(() => {
    if (!selectedId) {
      return
    }

    const channel = supabase
      .channel(`meter-${selectedId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meters',
          filter: `id=eq.${selectedId}`,
        },
        (payload) => {
          const updated = toMeter(payload.new)

          setState((previous) =>
            previous
              ? {
                  ...previous,
                  meters: previous.meters.map((meter) =>
                    meter.id === updated.id ? updated : meter
                  ),
                }
              : previous
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [selectedId])

  // ---- Actions ----
  const selectMeter = useCallback(
    (id: string) => {
      if (!userId) {
        return
      }

      setSelection({ userId, id })
      storeId(userId, id)
    },
    [userId]
  )

  const refreshMeters = useCallback(async (): Promise<Meter[]> => {
    if (!userId) {
      return []
    }

    const result = await fetchMeters(userId)

    setState((previous) => ({
      userId,
      // If the reload failed, keep the list we already had.
      meters:
        result.meters ??
        (previous && previous.userId === userId ? previous.meters : NO_METERS),
      error: result.error,
    }))

    return result.meters ?? []
  }, [userId])

  const value = useMemo<MeterContextType>(
    () => ({
      meters,
      selectedMeter,
      loading,
      error,
      selectMeter,
      refreshMeters,
    }),
    [meters, selectedMeter, loading, error, selectMeter, refreshMeters]
  )

  return <MeterContext.Provider value={value}>{children}</MeterContext.Provider>
}

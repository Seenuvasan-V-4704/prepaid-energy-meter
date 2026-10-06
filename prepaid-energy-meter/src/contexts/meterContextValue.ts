import { createContext, useContext } from 'react'

import type { Meter } from '../lib/meters'

export type MeterContextType = {
  // All meters owned by the signed-in user.
  meters: Meter[]
  // The meter chosen in the selector (remembered between visits).
  selectedMeter: Meter | null
  loading: boolean
  error: string | null
  selectMeter: (id: string) => void
  // Loads the list again. Returns the new list ([] if it failed).
  refreshMeters: () => Promise<Meter[]>
}

export const MeterContext = createContext<MeterContextType | undefined>(
  undefined
)

export function useMeters(): MeterContextType {
  const context = useContext(MeterContext)

  if (!context) {
    throw new Error('useMeters must be used inside MeterProvider')
  }

  return context
}

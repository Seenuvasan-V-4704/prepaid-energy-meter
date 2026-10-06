import { useEffect, useState } from 'react'

// Returns the current time and updates it every intervalMs.
// Used to recompute "online/offline" and to slide the chart window.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      intervalMs
    )

    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

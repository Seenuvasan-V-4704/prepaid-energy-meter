// Formatting helpers for money, times and "x seconds ago".

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

export function formatInr(amount: number): string {
  return inr.format(amount)
}

// Clock time such as 14:03 or 14:03:25.
export function formatClock(ms: number, withSeconds = false): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
  })
}

// Date and time with seconds, used in chart tooltips.
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// "12 s ago", "3 min ago", "2 h ago".
export function formatAgo(ms: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - ms) / 1000))

  if (seconds < 60) {
    return `${seconds} s ago`
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ago`
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} h ago`
  }

  return `${Math.floor(seconds / 86400)} d ago`
}

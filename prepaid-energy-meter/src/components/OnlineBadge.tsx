import { formatAgo } from '../lib/format'
import { isMeterOnline } from '../lib/meters'

type OnlineBadgeProps = {
  lastSeenMs: number | null
  // The current time. The parent updates it every few seconds.
  now: number
  // Show "last seen ..." next to the badge.
  showLastSeen?: boolean
}

export default function OnlineBadge({
  lastSeenMs,
  now,
  showLastSeen = true,
}: OnlineBadgeProps) {
  const online = isMeterOnline(lastSeenMs, now)

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          online
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-slate-200 text-slate-600'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            online ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        />
        {online ? 'Online' : 'Offline'}
      </span>

      {showLastSeen && (
        <span className="text-xs text-slate-500">
          {lastSeenMs === null
            ? 'Never seen'
            : `Last seen ${formatAgo(lastSeenMs, now)}`}
        </span>
      )}
    </div>
  )
}

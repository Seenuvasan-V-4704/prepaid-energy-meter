import { Link } from 'react-router-dom'

// Small building blocks for loading, error and empty states.

export function LoadingBlock({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200"
    >
      {text}
    </div>
  )
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200"
    >
      <p>{message}</p>

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

export function EmptyState({
  title,
  text,
  actionLabel,
  actionTo,
}: {
  title: string
  text: string
  actionLabel?: string
  actionTo?: string
}) {
  return (
    <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{text}</p>

      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-5 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

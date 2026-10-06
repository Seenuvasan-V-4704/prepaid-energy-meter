type Tone = 'default' | 'good' | 'warn' | 'bad'

type StatCardProps = {
  label: string
  value: string
  unit?: string
  hint?: string
  tone?: Tone
  // Grey the value out (for example when there is no data yet).
  dim?: boolean
}

const VALUE_COLOURS: Record<Tone, string> = {
  default: 'text-slate-900',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
}

export default function StatCard({
  label,
  value,
  unit,
  hint,
  tone = 'default',
  dim = false,
}: StatCardProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p
        className={`mt-2 text-2xl font-bold ${
          dim ? 'text-slate-300' : VALUE_COLOURS[tone]
        }`}
      >
        {value}
        {unit && (
          <span className="ml-1 text-sm font-medium text-slate-500">{unit}</span>
        )}
      </p>

      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

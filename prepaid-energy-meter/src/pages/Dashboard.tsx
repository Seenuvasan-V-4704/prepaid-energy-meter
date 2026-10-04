import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h2>

        <p className="mt-1 text-slate-500">
          Welcome back,{' '}
          {profile?.full_name || 'User'}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Balance"
          value="₹0.00"
          description="Available prepaid balance"
        />

        <Card
          title="Voltage"
          value="-- V"
          description="Waiting for meter"
        />

        <Card
          title="Current"
          value="-- A"
          description="Waiting for meter"
        />

        <Card
          title="Power"
          value="-- W"
          description="Waiting for meter"
        />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 className="font-semibold text-slate-900">
          Meter status
        </h3>

        <p className="mt-2 text-sm text-slate-500">
          Live meter data will appear here in the next
          development step.
        </p>
      </div>
    </div>
  )
}

function Card({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  )
}
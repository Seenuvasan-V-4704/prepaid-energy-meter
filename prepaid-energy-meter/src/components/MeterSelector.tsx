import { useMeters } from '../contexts/meterContextValue'

// Lets the user pick which meter the page shows. The choice is
// remembered, so it is still selected on the next visit.
export default function MeterSelector() {
  const { meters, selectedMeter, selectMeter } = useMeters()

  if (meters.length === 0 || !selectedMeter) {
    return null
  }

  if (meters.length === 1) {
    return (
      <p className="text-sm text-slate-600">
        Meter: <span className="font-medium text-slate-900">{selectedMeter.name}</span>
      </p>
    )
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span>Meter</span>

      <select
        value={selectedMeter.id}
        onChange={(event) => selectMeter(event.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        {meters.map((meter) => (
          <option key={meter.id} value={meter.id}>
            {meter.name} ({meter.deviceId})
          </option>
        ))}
      </select>
    </label>
  )
}

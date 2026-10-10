import { useState } from 'react'

import { useLiveReadings } from '../hooks/useLiveReadings'
import { useNow } from '../hooks/useNow'
import { formatAgo, formatClock, formatInr } from '../lib/format'
import type { Meter } from '../lib/meters'
import { DEFAULT_RANGE_MINUTES } from '../lib/series'
import ChartsPanel from './ChartsPanel'
import OnlineBadge from './OnlineBadge'
import RelayCard from './RelayCard'
import { ErrorBlock } from './StateBlocks'
import StatCard from './StatCard'

// Everything for ONE meter. The parent gives it key={meter.id}, so
// switching meters starts fresh (new subscriptions, range back to default).
export default function LiveDashboard({ meter }: { meter: Meter }) {
  // Ticks every 5 seconds: recomputes Online/Offline and slides the graphs.
  const now = useNow(5000)

  const [rangeMinutes, setRangeMinutes] = useState(DEFAULT_RANGE_MINUTES)
  const live = useLiveReadings(meter.id, rangeMinutes)

  const reading = live.latest
  const noData = reading === null

  const lowest = meter.balance <= meter.minBalance
  const low = meter.balance <= meter.alertThreshold

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{meter.name}</h3>

          <p className="text-sm text-slate-500">
            Device {meter.deviceId} · Tariff {formatInr(meter.tariffPerKwh)} per kWh
          </p>
        </div>

        <OnlineBadge lastSeenMs={meter.lastSeenMs} now={now} />
      </div>

      {meter.autoCut && (
        <div role="alert" className="rounded-xl bg-red-600 p-4 font-medium text-white">
          Power cut: balance finished. Recharge to restore.
        </div>
      )}

      {live.latestError && (
        <ErrorBlock
          message={`Could not load the latest reading: ${live.latestError}`}
          onRetry={live.reload}
        />
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Voltage"
          value={reading ? reading.voltage.toFixed(1) : '—'}
          unit="V"
          dim={noData}
        />

        <StatCard
          label="Current"
          value={reading ? reading.current.toFixed(2) : '—'}
          unit="A"
          dim={noData}
        />

        <StatCard
          label="Power"
          value={reading ? reading.power.toFixed(1) : '—'}
          unit="W"
          dim={noData}
        />

        <StatCard
          label="Energy"
          value={reading ? reading.energy.toFixed(3) : '—'}
          unit="kWh"
          hint="Total since the meter started"
          dim={noData}
        />

        <StatCard
          label="Balance"
          value={formatInr(meter.balance)}
          tone={lowest ? 'bad' : low ? 'warn' : 'good'}
          hint={
            lowest
              ? 'At or below the minimum balance'
              : low
                ? `Low balance (alert at ${formatInr(meter.alertThreshold)})`
                : `Alert at ${formatInr(meter.alertThreshold)}`
          }
        />

        <StatCard
          label="Relay"
          value={meter.relayOn ? 'ON' : 'OFF'}
          tone={meter.relayOn ? 'good' : 'bad'}
          hint={meter.autoCut ? 'Cut off automatically (low balance)' : undefined}
        />

        <StatCard
          label="Fault"
          value={meter.fault ? 'Fault' : 'None'}
          tone={meter.fault ? 'bad' : 'good'}
        />

        <StatCard
          label="Last reading"
          value={reading ? formatAgo(reading.t, now) : '—'}
          hint={reading ? formatClock(reading.t, true) : 'No readings yet'}
          dim={noData}
        />
      </div>

      <RelayCard meter={meter} now={now} />
      
      <ChartsPanel
        live={live}
        now={now}
        rangeMinutes={rangeMinutes}
        onRangeChange={setRangeMinutes}
      />
    </div>
  )
}

import LiveDashboard from '../components/LiveDashboard'
import MeterSelector from '../components/MeterSelector'
import { EmptyState, ErrorBlock, LoadingBlock } from '../components/StateBlocks'
import { useMeters } from '../contexts/meterContextValue'

export default function Dashboard() {
  const { meters, selectedMeter, loading, error, refreshMeters } = useMeters()

  function renderBody() {
    if (loading) {
      return <LoadingBlock text="Loading your meters..." />
    }

    if (error && meters.length === 0) {
      return (
        <ErrorBlock
          message={`Could not load your meters: ${error}`}
          onRetry={() => void refreshMeters()}
        />
      )
    }

    if (!selectedMeter) {
      return (
        <EmptyState
          title="No meter linked yet"
          text="Link your prepaid meter with the claim code that came with it, and its live readings will appear here."
          actionLabel="Add a meter"
          actionTo="/meters/add"
        />
      )
    }

    // key: a different meter means a completely fresh dashboard.
    return <LiveDashboard key={selectedMeter.id} meter={selectedMeter} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>

        <MeterSelector />
      </div>

      {renderBody()}
    </div>
  )
}

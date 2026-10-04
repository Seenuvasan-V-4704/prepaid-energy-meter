export default function Recharge() {
  return (
    <Placeholder
      title="Recharge"
      description="Simulated recharge will be implemented in a later step."
    />
  )
}

function Placeholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Page
      title={title}
      description={description}
    />
  )
}

function Page({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900">
        {title}
      </h2>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-500">
          {description}
        </p>
      </div>
    </div>
  )
}
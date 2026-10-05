// Shown instead of a blank page when the Supabase settings are missing.

type SetupMessageProps = {
  problems: string[]
}

export default function SetupMessage({
  problems,
}: SetupMessageProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
          PE
        </div>

        <h1 className="text-2xl font-bold text-slate-900">
          Setup needed
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          The app cannot start because its connection
          settings are not complete:
        </p>

        <ul className="mt-3 list-disc space-y-1 rounded-lg bg-red-50 p-3 pl-8 text-sm text-red-700">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>

        <h2 className="mt-6 font-semibold text-slate-900">
          On your computer
        </h2>

        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            In the project folder, create a file named{' '}
            <code className="rounded bg-slate-100 px-1">
              .env.local
            </code>{' '}
            (copy{' '}
            <code className="rounded bg-slate-100 px-1">
              .env.example
            </code>
            ).
          </li>
          <li>
            Fill in{' '}
            <code className="rounded bg-slate-100 px-1">
              VITE_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="rounded bg-slate-100 px-1">
              VITE_SUPABASE_ANON_KEY
            </code>{' '}
            from your Supabase project settings (API page).
          </li>
          <li>
            Stop the dev server (Ctrl+C) and run{' '}
            <code className="rounded bg-slate-100 px-1">
              npm run dev
            </code>{' '}
            again.
          </li>
        </ol>

        <h2 className="mt-6 font-semibold text-slate-900">
          On Vercel
        </h2>

        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            Open your project, then Settings, then
            Environment Variables.
          </li>
          <li>Add both variables with the same names.</li>
          <li>
            Open the Deployments tab and redeploy. New
            values only apply to new deployments.
          </li>
        </ol>
      </div>
    </div>
  )
}

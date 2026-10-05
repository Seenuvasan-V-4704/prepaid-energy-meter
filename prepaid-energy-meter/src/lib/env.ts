// Reads the two settings the app needs and reports problems.
// This file must NOT import supabase.ts, so it can run even when
// the settings are missing.

const rawUrl: unknown = import.meta.env.VITE_SUPABASE_URL
const rawKey: unknown = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseUrl: string =
  typeof rawUrl === 'string' ? rawUrl.trim() : ''

export const supabaseAnonKey: string =
  typeof rawKey === 'string' ? rawKey.trim() : ''

function urlLooksValid(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

// A list of plain-English problems. Empty list = all good.
export const envProblems: string[] = []

if (!supabaseUrl) {
  envProblems.push('VITE_SUPABASE_URL is missing.')
} else if (!urlLooksValid(supabaseUrl)) {
  envProblems.push(
    'VITE_SUPABASE_URL is not a valid web address. It should look like https://your-project-ref.supabase.co'
  )
}

if (!supabaseAnonKey) {
  envProblems.push('VITE_SUPABASE_ANON_KEY is missing.')
}

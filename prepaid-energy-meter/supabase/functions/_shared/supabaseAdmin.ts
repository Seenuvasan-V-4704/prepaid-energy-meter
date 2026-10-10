// Creates the Supabase "admin" client that uses the service role key.
// This key bypasses row-level security, so it must only ever exist
// here, inside an Edge Function. Supabase puts SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY into every Edge Function automatically,
// so you do NOT set them yourself.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

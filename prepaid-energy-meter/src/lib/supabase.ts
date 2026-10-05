import { createClient } from '@supabase/supabase-js'

import {
  envProblems,
  supabaseAnonKey,
  supabaseUrl,
} from './env'

// main.tsx shows a setup screen and never loads this file when the
// settings are wrong. This check is only a safety net.
if (envProblems.length > 0) {
  throw new Error(envProblems.join(' '))
}

// The frontend only ever uses the public "anon" key.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)

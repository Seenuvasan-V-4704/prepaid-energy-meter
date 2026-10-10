import { supabase } from './supabase'

// Calls an Edge Function (the login token is added automatically).
// Throws an Error with the server's message if it answers with an error.
export async function callFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    let message = error.message
    try {
      const response = (error as { context?: Response }).context
      const detail = (await response?.json()) as { message?: string } | undefined
      if (detail?.message) message = detail.message
    } catch {
      // keep the default message
    }
    throw new Error(message)
  }

  return data as T
}
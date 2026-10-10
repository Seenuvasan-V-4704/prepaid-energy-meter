// Reads the Bearer token of a request and returns the user id (or null).
import type { createDb } from './db.ts'

export async function userIdFromRequest(
  req: Request,
  db: ReturnType<typeof createDb>
): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? ''
  const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!jwt) return null
  return await db.getUserIdFromJwt(jwt).catch(() => null)
}
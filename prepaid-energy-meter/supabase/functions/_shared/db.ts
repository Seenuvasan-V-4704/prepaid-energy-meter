// All database work of the two functions, in one place.
// It uses the admin client, so row-level security does not apply:
// every function that uses it MUST check permissions itself.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import type { CommandRow } from './relayCommand.ts'
import type { Ack, Status, Telemetry } from './validation.ts'

// A database function may return one object (jsonb) or a table with
// one row. Both are turned into a plain object here.
function firstRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data

  return row !== null && typeof row === 'object'
    ? (row as Record<string, unknown>)
    : {}
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`)
}

export function createDb(client: SupabaseClient) {
  return {
    // ---- used by device-ingest ----
    async processReading(deviceId: string, t: Telemetry) {
      const { data, error } = await client.rpc('process_reading', {
        p_device_id: deviceId,
        p_seq: t.seq,
        p_ts: t.ts,
        p_v: t.v,
        p_i: t.i,
        p_p: t.p,
        p_e: t.e,
        p_relay: t.relay,
        p_fault: t.fault,
      })

      if (error) fail('process_reading', error)
      return firstRow(data)
    },

    async processAck(deviceId: string, a: Ack) {
      const { data, error } = await client.rpc('process_ack', {
        p_device_id: deviceId,
        p_cmd_id: a.id,
        p_ok: a.ok,
        p_relay: a.relay,
      })

      if (error) fail('process_ack', error)
      return firstRow(data)
    },

    async processStatus(deviceId: string, s: Status) {
      const { data, error } = await client.rpc('process_status', {
        p_device_id: deviceId,
        p_online: s.online,
      })

      if (error) fail('process_status', error)
      return firstRow(data)
    },

    async getMeterByDevice(deviceId: string) {
      const { data, error } = await client
        .from('meters')
        .select('id, owner_id')
        .eq('device_id', deviceId)
        .maybeSingle()

      if (error) fail('read meter', error)
      return data as { id: string; owner_id: string | null } | null
    },

    // Is there a relay command still waiting for an answer that was
    // created after "sinceIso"?
    async hasPendingRelayCommand(meterId: string, sinceIso: string) {
      const { data, error } = await client
        .from('commands')
        .select('id')
        .eq('meter_id', meterId)
        .eq('action', 'relay')
        .eq('status', 'pending')
        .gte('created_at', sinceIso)
        .limit(1)

      if (error) fail('read commands', error)
      return (data ?? []).length > 0
    },

    // ---- used by both functions ----
    async insertCommand(row: CommandRow) {
      const { error } = await client.from('commands').insert(row)
      if (error) fail('save command', error)
    },

    async markCommandFailed(id: string) {
      const { error } = await client
        .from('commands')
        .update({ status: 'failed' })
        .eq('id', id)

      if (error) fail('update command', error)
    },

    // ---- used by send-command ----
    // Returns the user id for a valid access token, otherwise null.
    async getUserIdFromJwt(jwt: string) {
      const { data, error } = await client.auth.getUser(jwt)
      return error || !data.user ? null : data.user.id
    },

    // The meter, but ONLY if it belongs to this user.
    async getOwnedMeter(meterId: string, userId: string) {
      const { data, error } = await client
        .from('meters')
        .select('id, device_id, balance, min_balance')
        .eq('id', meterId)
        .eq('owner_id', userId)
        .maybeSingle()

      if (error) fail('read meter', error)

      return data as {
        id: string
        device_id: string
        balance: number | string
        min_balance: number | string
      } | null
    },
  }
}

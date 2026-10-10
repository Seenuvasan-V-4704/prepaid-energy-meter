import assert from 'node:assert/strict'

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { createDb } from '../_shared/db.ts'

// A fake Supabase client that records how it was called.
function fakeClient(options: { rpcData?: unknown; rpcError?: string; rows?: unknown; user?: string | null } = {}) {
  const log: { rpc?: [string, Record<string, unknown>]; from?: string; filters: [string, string, unknown][]; inserted?: unknown; updated?: unknown } = { filters: [] }

  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const name of ['eq', 'gte']) {
    builder[name] = (column: string, value: unknown) => { log.filters.push([name, column, value]); return builder }
  }
  builder.select = chain
  builder.limit = chain
  builder.update = (values: unknown) => { log.updated = values; return builder }
  const result = { data: options.rows ?? [], error: null }
  builder.maybeSingle = () => Promise.resolve({ data: Array.isArray(options.rows) ? options.rows[0] ?? null : options.rows ?? null, error: null })
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result)

  const client = {
    rpc: (name: string, params: Record<string, unknown>) => {
      log.rpc = [name, params]
      return Promise.resolve(options.rpcError ? { data: null, error: { message: options.rpcError } } : { data: options.rpcData ?? null, error: null })
    },
    from: (table: string) => { log.from = table; return Object.assign(builder, { insert: (row: unknown) => { log.inserted = row; return Promise.resolve({ error: null }) } }) },
    auth: { getUser: (jwt: string) => Promise.resolve(options.user && jwt === 'good' ? { data: { user: { id: options.user } }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } }) },
  }
  return { db: createDb(client as unknown as SupabaseClient), log }
}

const telemetry = { seq: 42, ts: 1759500000, v: 231.4, i: 0.82, p: 184.6, e: 12.346, relay: 1 as const, fault: 0 }

Deno.test('process_reading is called with exactly the parameter names of the SQL function', async () => {
  const { db, log } = fakeClient({ rpcData: { cut_needed: true } })
  const result = await db.processReading('meter-001', telemetry)
  assert.deepEqual(log.rpc, ['process_reading', { p_device_id: 'meter-001', p_seq: 42, p_ts: 1759500000, p_v: 231.4, p_i: 0.82, p_p: 184.6, p_e: 12.346, p_relay: 1, p_fault: 0 }])
  assert.deepEqual(result, { cut_needed: true })
})

Deno.test('a function that returns a table (array of rows) is read from its first row; nothing returned gives {}', async () => {
  assert.deepEqual(await fakeClient({ rpcData: [{ cut_needed: true, alert_needed: false }] }).db.processReading('m', telemetry), { cut_needed: true, alert_needed: false })
  assert.deepEqual(await fakeClient({ rpcData: null }).db.processReading('m', telemetry), {})
  assert.deepEqual(await fakeClient({ rpcData: [] }).db.processReading('m', telemetry), {})
})

Deno.test('process_ack and process_status parameter names', async () => {
  const a = fakeClient()
  await a.db.processAck('meter-001', { id: '3f2b7c0e-8d1a-4f6e-9b2d-1a2b3c4d5e6f', ok: true, relay: 0 })
  assert.deepEqual(a.log.rpc, ['process_ack', { p_device_id: 'meter-001', p_cmd_id: '3f2b7c0e-8d1a-4f6e-9b2d-1a2b3c4d5e6f', p_ok: true, p_relay: 0 }])
  const s = fakeClient()
  await s.db.processStatus('meter-001', { online: false })
  assert.deepEqual(s.log.rpc, ['process_status', { p_device_id: 'meter-001', p_online: false }])
})

Deno.test('a database error is thrown with the name of the step', async () => {
  await assert.rejects(() => fakeClient({ rpcError: 'meter not found' }).db.processReading('m', telemetry), /process_reading: meter not found/)
})

Deno.test('pending check filters: this meter, relay commands, pending, newer than the cutoff', async () => {
  const none = fakeClient({ rows: [] })
  assert.equal(await none.db.hasPendingRelayCommand('M1', '2026-01-01T00:00:00.000Z'), false)
  assert.equal(none.log.from, 'commands')
  assert.deepEqual(none.log.filters, [['eq', 'meter_id', 'M1'], ['eq', 'action', 'relay'], ['eq', 'status', 'pending'], ['gte', 'created_at', '2026-01-01T00:00:00.000Z']])
  assert.equal(await fakeClient({ rows: [{ id: 'x' }] }).db.hasPendingRelayCommand('M1', 'z'), true)
})

Deno.test('ownership check filters on BOTH meter id and owner id', async () => {
  const { db, log } = fakeClient({ rows: [{ id: 'M1', device_id: 'meter-001', balance: 5, min_balance: 1 }] })
  const meter = await db.getOwnedMeter('M1', 'U1')
  assert.equal(meter?.device_id, 'meter-001')
  assert.deepEqual(log.filters, [['eq', 'id', 'M1'], ['eq', 'owner_id', 'U1']])
})

Deno.test('insert, mark failed, and JWT lookup', async () => {
  const c = fakeClient({ user: 'U1' })
  await c.db.insertCommand({ id: 'i', meter_id: 'm', user_id: null, action: 'relay', value: 0, status: 'pending' })
  assert.equal(c.log.from, 'commands')
  assert.deepEqual(c.log.inserted, { id: 'i', meter_id: 'm', user_id: null, action: 'relay', value: 0, status: 'pending' })
  await c.db.markCommandFailed('i')
  assert.deepEqual(c.log.updated, { status: 'failed' })
  assert.equal(await c.db.getUserIdFromJwt('good'), 'U1')
  assert.equal(await c.db.getUserIdFromJwt('forged'), null)
})

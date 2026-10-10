import assert from 'node:assert/strict'

import type { PublishFn } from '../_shared/emqx.ts'
import { createIngestHandler, PENDING_WINDOW_MS, type IngestDb } from '../device-ingest/handler.ts'

const SECRET = 'test-secret-123'
const METER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', owner_id: 'bbbbbbbb-0000-4000-8000-000000000002' }
const good = { seq: 42, ts: 1759500000, v: 231.4, i: 0.82, p: 184.6, e: 12.346, relay: 1, fault: 0 }

type Calls = string[]

function setup(options: { readingResult?: unknown; pending?: boolean; publishError?: boolean; noSubscribers?: boolean; dbError?: boolean; meter?: typeof METER | null } = {}) {
  const calls: Calls = []
  const inserted: Record<string, unknown>[] = []
  const published: { topic: string; payload: unknown }[] = []

  const db: IngestDb = {
    processReading: (deviceId, t) => { calls.push(`processReading:${deviceId}:${t.seq}`); if (options.dbError) throw new Error('db down'); return Promise.resolve((options.readingResult ?? {}) as Record<string, unknown>) },
    processAck: (deviceId, a) => { calls.push(`processAck:${deviceId}:${a.id}:${a.ok}:${a.relay}`); return Promise.resolve({ updated: true }) },
    processStatus: (deviceId, s) => { calls.push(`processStatus:${deviceId}:${s.online}`); return Promise.resolve({}) },
    getMeterByDevice: () => Promise.resolve(options.meter === undefined ? METER : options.meter),
    hasPendingRelayCommand: (_m, since) => { calls.push(`pendingCheck:${since}`); return Promise.resolve(options.pending ?? false) },
    insertCommand: (row) => { calls.push('insertCommand'); inserted.push(row as unknown as Record<string, unknown>); return Promise.resolve() },
    markCommandFailed: (id) => { calls.push(`markFailed:${id}`); return Promise.resolve() },
  }
  const publish: PublishFn = (topic, payload) => {
    calls.push('publish'); published.push({ topic, payload })
    if (options.publishError) return Promise.reject(new Error('emqx down'))
    return Promise.resolve({ delivered: !options.noSubscribers })
  }
  const clock = 1_760_000_000_000
  const handler = createIngestHandler({ secret: SECRET, db, publish, now: () => clock })
  const post = (body: unknown, headers: Record<string, string> = { 'x-ingest-secret': SECRET }) =>
    handler(new Request('https://x/functions/v1/device-ingest', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }))
  return { handler, post, calls, inserted, published, clock }
}
const telemetry = (over: Record<string, unknown> = {}, topic = 'meters/meter-001/telemetry') => ({ topic, payload: JSON.stringify({ ...good, ...over }), clientid: 'esp32-1' })

Deno.test('secret header: missing or wrong gives 401 and touches nothing', async () => {
  const s = setup()
  assert.equal((await s.post(telemetry(), {})).status, 401)
  assert.equal((await s.post(telemetry(), { 'x-ingest-secret': 'wrong' })).status, 401)
  assert.equal((await s.post(telemetry(), { 'x-ingest-secret': SECRET + 'x' })).status, 401)
  assert.equal((await s.post(telemetry(), { 'x-ingest-secret': '' })).status, 401)
  assert.deepEqual(s.calls, [])
})

Deno.test('fails closed when INGEST_SECRET is not configured, and only POST is allowed', async () => {
  const s = setup()
  const open = createIngestHandler({ secret: '', db: {} as IngestDb, publish: () => Promise.resolve({ delivered: true }) })
  const res = await open(new Request('https://x', { method: 'POST', headers: { 'x-ingest-secret': '' }, body: '{}' }))
  assert.equal(res.status, 500)
  assert.equal((await s.handler(new Request('https://x', { method: 'GET' }))).status, 405)
})

Deno.test('bad requests get 400 and nothing is saved', async () => {
  const s = setup()
  const bad: unknown[] = [
    'not json', '[]', {}, { topic: 'meters/m1/telemetry' }, { topic: 'x/y', payload: '{}' },
    telemetry({ v: 999 }), telemetry({ seq: 1.5 }), telemetry({ relay: 7 }),
    { topic: 'meters/m1/telemetry', payload: 'plain text' },
    { topic: 'meters/m1/ack', payload: JSON.stringify({ id: 'nope', ok: true, relay: 0 }) },
    { topic: 'meters/m1/status', payload: JSON.stringify({ online: 'yes' }) },
  ]
  for (const body of bad) assert.equal((await s.post(body as string)).status, 400, JSON.stringify(body))
  assert.deepEqual(s.calls, [])
  const big = await s.post('x'.repeat(20000))
  assert.equal(big.status, 413)
})

Deno.test('good telemetry calls process_reading once and does not cut when not needed', async () => {
  const s = setup({ readingResult: { cut_needed: false, alert_needed: false } })
  const res = await s.post(telemetry())
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true); assert.equal(body.cut_needed, false); assert.equal(body.command, null)
  assert.deepEqual(s.calls, ['processReading:meter-001:42'])
  assert.equal(s.published.length, 0)
})

Deno.test('payload may arrive as an object, and the database result may be a one-row array', async () => {
  const s = setup()
  const res = await s.post({ topic: 'meters/meter-001/telemetry', payload: good })
  assert.equal(res.status, 200)
  assert.deepEqual(s.calls, ['processReading:meter-001:42'])
})

Deno.test('cut_needed true and nothing pending: saves a pending command FIRST, then publishes relay-off with the same UUID', async () => {
  const s = setup({ readingResult: { cut_needed: true } })
  const body = await (await s.post(telemetry())).json()
  assert.equal(body.command.sent, true)
  assert.equal(body.command.delivered, true)
  assert.deepEqual(s.calls.map((c) => c.split(':')[0]), ['processReading', 'pendingCheck', 'insertCommand', 'publish'])
  const row = s.inserted[0]
  assert.equal(row.status, 'pending'); assert.equal(row.action, 'relay'); assert.equal(row.value, 0)
  assert.equal(row.meter_id, METER.id); assert.equal(row.user_id, METER.owner_id)
  assert.equal(s.published[0].topic, 'meters/meter-001/cmd')
  assert.deepEqual(s.published[0].payload, { id: row.id, action: 'relay', value: 0 }) // the id the device gets IS commands.id
  assert.equal(body.command.command_id, row.id)
})

Deno.test('the pending check looks back exactly 20 seconds', async () => {
  const s = setup({ readingResult: { cut_needed: true } })
  await s.post(telemetry())
  const since = s.calls.find((c) => c.startsWith('pendingCheck:'))!.slice('pendingCheck:'.length)
  assert.equal(PENDING_WINDOW_MS, 20_000)
  assert.equal(new Date(since).getTime(), s.clock - 20_000)
})

Deno.test('cut_needed true but a relay command is already pending: nothing is inserted or published', async () => {
  const s = setup({ readingResult: { cut_needed: true }, pending: true })
  const body = await (await s.post(telemetry())).json()
  assert.deepEqual(body.command, { sent: false, reason: 'recent_pending_command' })
  assert.equal(s.inserted.length, 0); assert.equal(s.published.length, 0)
})

Deno.test('publish fails: the command row is marked failed, the reading still succeeds (200), and the next reading retries', async () => {
  const s = setup({ readingResult: { cut_needed: true }, publishError: true })
  const res = await s.post(telemetry())
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.command.sent, false); assert.match(body.command.error, /emqx down/)
  assert.ok(s.calls.some((c) => c.startsWith('markFailed:')))
})

Deno.test('device offline (EMQX 202): command stays pending, reported as not delivered', async () => {
  const s = setup({ readingResult: { cut_needed: true }, noSubscribers: true })
  const body = await (await s.post(telemetry())).json()
  assert.equal(body.command.sent, true); assert.equal(body.command.delivered, false)
  assert.ok(!s.calls.some((c) => c.startsWith('markFailed:')))
})

Deno.test('meter not found while cutting: no command, reading still 200', async () => {
  const s = setup({ readingResult: { cut_needed: true }, meter: null })
  const body = await (await s.post(telemetry())).json()
  assert.deepEqual(body.command, { sent: false, reason: 'meter_not_found' })
})

Deno.test('the function never inserts alert rows itself (process_reading does that)', async () => {
  const s = setup({ readingResult: { cut_needed: true, alert_needed: true } })
  await s.post(telemetry())
  assert.ok(!s.calls.some((c) => c.toLowerCase().includes('alert')))
  assert.ok(s.inserted.every((row) => row.action === 'relay')) // only commands rows
})

Deno.test('ack and status go to process_ack / process_status', async () => {
  const s = setup()
  const id = '3f2b7c0e-8d1a-4f6e-9b2d-1a2b3c4d5e6f'
  assert.equal((await s.post({ topic: 'meters/meter-001/ack', payload: JSON.stringify({ id, ok: true, relay: 0 }) })).status, 200)
  assert.equal((await s.post({ topic: 'meters/meter-001/status', payload: JSON.stringify({ online: false }) })).status, 200)
  assert.deepEqual(s.calls, [`processAck:meter-001:${id}:true:0`, 'processStatus:meter-001:false'])
})

Deno.test('database error gives 500 so EMQX can see the failure', async () => {
  const s = setup({ dbError: true })
  const res = await s.post(telemetry())
  assert.equal(res.status, 500)
  assert.equal((await res.json()).error, 'database_error')
})

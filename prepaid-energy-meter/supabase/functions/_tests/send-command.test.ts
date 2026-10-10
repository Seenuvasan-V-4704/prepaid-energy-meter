import assert from 'node:assert/strict'

import type { PublishFn } from '../_shared/emqx.ts'
import { createSendCommandHandler, type SendCommandDb } from '../send-command/handler.ts'

const USER = 'bbbbbbbb-0000-4000-8000-000000000002'
const OTHER = 'cccccccc-0000-4000-8000-000000000003'
const METER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

function setup(opts: { balance?: number | string; minBalance?: number | string; publishError?: boolean; noSubscribers?: boolean; insertError?: boolean } = {}) {
  const calls: string[] = []
  const inserted: Record<string, unknown>[] = []
  const published: { topic: string; payload: unknown }[] = []
  const db: SendCommandDb = {
    getUserIdFromJwt: (jwt) => Promise.resolve(jwt === 'good-token' ? USER : jwt === 'other-token' ? OTHER : null),
    getOwnedMeter: (meterId, userId) => {
      calls.push(`owned:${meterId}:${userId}`)
      return Promise.resolve(meterId === METER_ID && userId === USER ? { id: METER_ID, device_id: 'meter-001', balance: opts.balance ?? 100, min_balance: opts.minBalance ?? 10 } : null)
    },
    insertCommand: (row) => { calls.push('insert'); if (opts.insertError) throw new Error('db down'); inserted.push(row as unknown as Record<string, unknown>); return Promise.resolve() },
    markCommandFailed: (id) => { calls.push(`markFailed:${id}`); return Promise.resolve() },
  }
  const publish: PublishFn = (topic, payload) => {
    calls.push('publish'); published.push({ topic, payload })
    if (opts.publishError) return Promise.reject(new Error('emqx down'))
    return Promise.resolve({ delivered: !opts.noSubscribers })
  }
  const handler = createSendCommandHandler({ db, publish })
  const call = (body: unknown, token: string | null = 'good-token', method = 'POST') =>
    handler(new Request('https://x/functions/v1/send-command', { method, headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}, body: method === 'POST' ? JSON.stringify(body) : undefined }))
  return { call, calls, inserted, published }
}

Deno.test('CORS: preflight answers 204 and every reply carries the CORS headers', async () => {
  const s = setup()
  const pre = await s.call(null, null, 'OPTIONS')
  assert.equal(pre.status, 204)
  assert.match(pre.headers.get('Access-Control-Allow-Headers')!, /authorization/)
  const unauth = await s.call({ meter_id: METER_ID, value: 0 }, null)
  assert.equal(unauth.status, 401)
  assert.equal(unauth.headers.get('Access-Control-Allow-Origin'), '*')
})

Deno.test('no token or a bad token: 401 and nothing happens', async () => {
  const s = setup()
  assert.equal((await s.call({ meter_id: METER_ID, value: 0 }, null)).status, 401)
  assert.equal((await s.call({ meter_id: METER_ID, value: 0 }, 'forged')).status, 401)
  assert.deepEqual(s.calls, [])
})

Deno.test('bad input: 400', async () => {
  const s = setup()
  for (const body of [{}, { meter_id: 'x', value: 0 }, { meter_id: METER_ID }, { meter_id: METER_ID, value: 2 }, { meter_id: METER_ID, value: '1' }, { meter_id: METER_ID, value: true }]) {
    assert.equal((await s.call(body)).status, 400, JSON.stringify(body))
  }
  assert.equal((await s.call('{broken')).status, 400)
  assert.equal(s.published.length, 0)
})

Deno.test("someone else's meter looks exactly like a missing meter (404), nothing is sent", async () => {
  const s = setup()
  const res = await s.call({ meter_id: METER_ID, value: 0 }, 'other-token')
  assert.equal(res.status, 404)
  assert.equal((await res.json()).error, 'meter_not_found')
  assert.equal(s.inserted.length, 0); assert.equal(s.published.length, 0)
})

Deno.test('relay ON is refused when balance is at or below min_balance (409), relay OFF is still allowed', async () => {
  for (const [balance, min] of [[10, 10], [5, 10], [0, 0], ['10.00', '10.00'], [-3, 0]] as const) {
    const s = setup({ balance, minBalance: min })
    const res = await s.call({ meter_id: METER_ID, value: 1 })
    assert.equal(res.status, 409, `${balance}/${min}`)
    assert.equal((await res.json()).error, 'insufficient_balance')
    assert.equal(s.inserted.length, 0); assert.equal(s.published.length, 0)
    const off = await s.call({ meter_id: METER_ID, value: 0 })
    assert.equal(off.status, 200, 'switching OFF must always work')
  }
  const rich = setup({ balance: 10.01, minBalance: 10 })
  assert.equal((await rich.call({ meter_id: METER_ID, value: 1 })).status, 200)
})

Deno.test('success: saves a pending command first, publishes the same UUID, returns it', async () => {
  const s = setup()
  const res = await s.call({ meter_id: METER_ID, value: 0 })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(s.calls, [`owned:${METER_ID}:${USER}`, 'insert', 'publish'])
  const row = s.inserted[0]
  assert.equal(row.status, 'pending'); assert.equal(row.user_id, USER); assert.equal(row.meter_id, METER_ID); assert.equal(row.value, 0)
  assert.equal(s.published[0].topic, 'meters/meter-001/cmd')
  assert.deepEqual(s.published[0].payload, { id: row.id, action: 'relay', value: 0 })
  assert.equal(body.command_id, row.id); assert.equal(body.delivered, true)
})

Deno.test('meter offline: still 200, but delivered=false with a clear message', async () => {
  const s = setup({ noSubscribers: true })
  const body = await (await s.call({ meter_id: METER_ID, value: 1 })).json()
  assert.equal(body.ok, true); assert.equal(body.delivered, false); assert.match(body.message, /not connected/)
})

Deno.test('publish fails: 502, the command is marked failed and its id is returned', async () => {
  const s = setup({ publishError: true })
  const res = await s.call({ meter_id: METER_ID, value: 0 })
  assert.equal(res.status, 502)
  const body = await res.json()
  assert.equal(body.error, 'publish_failed'); assert.equal(body.command_id, s.inserted[0].id)
  assert.ok(s.calls.includes(`markFailed:${s.inserted[0].id}`))
})

Deno.test('cannot save the command: 500 and nothing is published', async () => {
  const s = setup({ insertError: true })
  assert.equal((await s.call({ meter_id: METER_ID, value: 0 })).status, 500)
  assert.equal(s.published.length, 0)
})

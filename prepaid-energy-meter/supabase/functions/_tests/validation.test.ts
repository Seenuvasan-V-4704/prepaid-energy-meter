import assert from 'node:assert/strict'

import { createEmqxPublisher, emqxPublishUrl } from '../_shared/emqx.ts'
import {
  parseAck,
  parsePayload,
  parseStatus,
  parseTelemetry,
  parseTopic,
} from '../_shared/validation.ts'

const good = { seq: 42, ts: 1759500000, v: 231.4, i: 0.82, p: 184.6, e: 12.346, relay: 1, fault: 0 }

Deno.test('topic: accepts the three message types and rejects the rest', () => {
  assert.deepEqual(parseTopic('meters/meter-001/telemetry'), { ok: true, value: { deviceId: 'meter-001', kind: 'telemetry' } })
  assert.equal(parseTopic('meters/meter-001/ack').ok, true)
  assert.equal(parseTopic('meters/meter-001/status').ok, true)
  for (const bad of ['meters/meter-001/cmd', 'meters//telemetry', 'meters/a/b/telemetry', 'other/x/telemetry', 'meters/../x/telemetry', 'meters/x y/telemetry', 42, null]) {
    assert.equal(parseTopic(bad).ok, false, String(bad))
  }
})

Deno.test('payload: text or object, but only a JSON object', () => {
  assert.equal(parsePayload('{"a":1}').ok, true)
  assert.equal(parsePayload({ a: 1 }).ok, true)
  for (const bad of ['not json', '[1,2]', '"text"', '5', null, 7, '{"a":' ]) assert.equal(parsePayload(bad).ok, false, String(bad))
})

Deno.test('telemetry: valid message and every range rule', () => {
  assert.equal(parseTelemetry(good).ok, true)
  const cases: [string, unknown][] = [
    ['v', 300.1], ['v', -1], ['v', '231'], ['i', 101], ['p', 25001], ['e', -0.1], ['seq', 1.5], ['seq', -1],
    ['ts', 'now'], ['relay', 2], ['relay', true], ['fault', 256], ['fault', 0.5],
  ]
  for (const [key, value] of cases) {
    assert.equal(parseTelemetry({ ...good, [key]: value }).ok, false, `${key}=${String(value)}`)
  }
  for (const key of Object.keys(good)) {
    const copy: Record<string, unknown> = { ...good }
    delete copy[key]
    assert.equal(parseTelemetry(copy).ok, false, `missing ${key}`)
  }
  assert.equal(parseTelemetry({ ...good, v: 0, i: 0, p: 0, e: 0, relay: 0 }).ok, true)
  assert.equal(parseTelemetry({ ...good, ts: 5 }).ok, true) // a wrong device clock is fine: the database falls back to server time
})

Deno.test('ack and status', () => {
  const id = '3f2b7c0e-8d1a-4f6e-9b2d-1a2b3c4d5e6f'
  assert.equal(parseAck({ id, ok: true, relay: 0 }).ok, true)
  assert.equal(parseAck({ id: 'abc', ok: true, relay: 0 }).ok, false)
  assert.equal(parseAck({ id, ok: 'yes', relay: 0 }).ok, false)
  assert.equal(parseAck({ id, ok: true, relay: 3 }).ok, false)
  assert.equal(parseStatus({ online: false }).ok, true)
  assert.equal(parseStatus({ online: 1 }).ok, false)
})

Deno.test('emqx: address forms are all accepted', () => {
  for (const url of ['https://x.emqxsl.com:8443', 'https://x.emqxsl.com:8443/', 'https://x.emqxsl.com:8443/api/v5', 'https://x.emqxsl.com:8443/api/v5/', 'https://x.emqxsl.com:8443/api/v5/publish']) {
    assert.equal(emqxPublishUrl(url), 'https://x.emqxsl.com:8443/api/v5/publish', url)
  }
})

Deno.test('emqx: request shape, 200 = delivered, 202 = nobody subscribed, errors throw', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const make = (status: number, body: string) =>
    createEmqxPublisher({ apiUrl: 'https://x.emqxsl.com:8443/api/v5', apiKey: 'KEY', apiSecret: 'SECRET' }, (url, init) => {
      seen = { url: String(url), init: init as RequestInit }
      return Promise.resolve(new Response(body, { status }))
    })

  const delivered = await make(200, '{"id":"ABC"}')('meters/m1/cmd', { id: 'u', action: 'relay', value: 0 })
  assert.deepEqual(delivered, { delivered: true, id: 'ABC' })
  assert.equal(seen!.url, 'https://x.emqxsl.com:8443/api/v5/publish')
  const headers = seen!.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Basic ' + btoa('KEY:SECRET'))
  const sent = JSON.parse(String(seen!.init.body))
  assert.equal(sent.topic, 'meters/m1/cmd')
  assert.equal(sent.qos, 1)
  assert.equal(sent.retain, false)
  assert.deepEqual(JSON.parse(sent.payload), { id: 'u', action: 'relay', value: 0 }) // payload is JSON text

  assert.deepEqual(await make(202, '{"message":"no_matching_subscribers","reason_code":16}')('t', {}), { delivered: false })
  await assert.rejects(() => make(401, '{"code":"BAD_USERNAME_OR_PASSWORD"}')('t', {}), /EMQX publish failed \(401\)/)
  await assert.rejects(() => make(500, 'boom')('t', {}), /500/)
})

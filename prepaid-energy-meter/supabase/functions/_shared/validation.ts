// Checks everything that arrives from the outside world. Nothing here
// touches the network or the database, so it is easy to test.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export type MessageKind = 'telemetry' | 'ack' | 'status'

export type Telemetry = {
  seq: number
  ts: number
  v: number
  i: number
  p: number
  e: number
  relay: 0 | 1
  fault: number
}

export type Ack = { id: string; ok: boolean; relay: 0 | 1 }
export type Status = { online: boolean }

const fail = <T>(error: string): Result<T> => ({ ok: false, error })
const ok = <T>(value: T): Result<T> => ({ ok: true, value })

// meters/<deviceId>/<telemetry|ack|status>
const TOPIC = /^meters\/([A-Za-z0-9][A-Za-z0-9_-]{0,63})\/(telemetry|ack|status)$/

export function parseTopic(
  topic: unknown
): Result<{ deviceId: string; kind: MessageKind }> {
  if (typeof topic !== 'string') {
    return fail('"topic" must be text')
  }

  const match = TOPIC.exec(topic)

  if (!match) {
    return fail('topic must look like meters/<deviceId>/telemetry, /ack or /status')
  }

  return ok({ deviceId: match[1], kind: match[2] as MessageKind })
}

// EMQX sends the device message either as text (JSON inside a string)
// or already as an object. Both are accepted.
export function parsePayload(raw: unknown): Result<Record<string, unknown>> {
  let value: unknown = raw

  if (typeof raw === 'string') {
    if (raw.length > 4096) {
      return fail('payload is too large')
    }

    try {
      value = JSON.parse(raw)
    } catch {
      return fail('payload is not valid JSON')
    }
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail('payload must be a JSON object')
  }

  return ok(value as Record<string, unknown>)
}

function readNumber(
  obj: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  integer = false
): Result<number> {
  const value = obj[key]

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(`"${key}" must be a number`)
  }

  if (integer && !Number.isSafeInteger(value)) {
    return fail(`"${key}" must be a whole number`)
  }

  if (value < min || value > max) {
    return fail(`"${key}" must be between ${min} and ${max}`)
  }

  return ok(value)
}

export function parseTelemetry(obj: Record<string, unknown>): Result<Telemetry> {
  const seq = readNumber(obj, 'seq', 0, Number.MAX_SAFE_INTEGER, true)
  if (!seq.ok) return seq

  // "ts" only has to be a number. If the device clock is wrong, the
  // database falls back to the server time.
  const ts = readNumber(obj, 'ts', 0, Number.MAX_SAFE_INTEGER, true)
  if (!ts.ok) return ts

  const v = readNumber(obj, 'v', 0, 300)
  if (!v.ok) return v

  const i = readNumber(obj, 'i', 0, 100)
  if (!i.ok) return i

  const p = readNumber(obj, 'p', 0, 25000)
  if (!p.ok) return p

  const e = readNumber(obj, 'e', 0, 10_000_000)
  if (!e.ok) return e

  const relay = readNumber(obj, 'relay', 0, 1, true)
  if (!relay.ok) return relay

  const fault = readNumber(obj, 'fault', 0, 255, true)
  if (!fault.ok) return fault

  return ok({
    seq: seq.value,
    ts: ts.value,
    v: v.value,
    i: i.value,
    p: p.value,
    e: e.value,
    relay: relay.value as 0 | 1,
    fault: fault.value,
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function parseAck(obj: Record<string, unknown>): Result<Ack> {
  if (!isUuid(obj.id)) {
    return fail('"id" must be the command UUID')
  }

  if (typeof obj.ok !== 'boolean') {
    return fail('"ok" must be true or false')
  }

  const relay = readNumber(obj, 'relay', 0, 1, true)
  if (!relay.ok) return relay

  return ok({ id: obj.id, ok: obj.ok, relay: relay.value as 0 | 1 })
}

export function parseStatus(obj: Record<string, unknown>): Result<Status> {
  if (typeof obj.online !== 'boolean') {
    return fail('"online" must be true or false')
  }

  return ok({ online: obj.online })
}

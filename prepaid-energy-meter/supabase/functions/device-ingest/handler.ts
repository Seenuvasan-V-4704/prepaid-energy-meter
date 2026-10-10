// The logic of the device-ingest function.
// EMQX calls it (a "webhook") for every message a meter publishes.
//
// It is built as createIngestHandler(deps) so tests can hand in fake
// database and fake MQTT helpers. index.ts hands in the real ones.

import { json } from '../_shared/responses.ts'
import type { PublishFn } from '../_shared/emqx.ts'
import { issueRelayCommand, type CommandStore } from '../_shared/relayCommand.ts'
import {
  parseAck,
  parsePayload,
  parseStatus,
  parseTelemetry,
  parseTopic,
  type Ack,
  type Status,
  type Telemetry,
} from '../_shared/validation.ts'

// A relay command that is still waiting for an answer blocks a new
// automatic cut-off command for this long.
export const PENDING_WINDOW_MS = 20_000

// The header EMQX must send. The value is the INGEST_SECRET.
export const SECRET_HEADER = 'x-ingest-secret'

const MAX_BODY_CHARS = 16_384

export type IngestDb = CommandStore & {
  processReading(deviceId: string, t: Telemetry): Promise<Record<string, unknown>>
  processAck(deviceId: string, a: Ack): Promise<Record<string, unknown>>
  processStatus(deviceId: string, s: Status): Promise<Record<string, unknown>>
  getMeterByDevice(
    deviceId: string
  ): Promise<{ id: string; owner_id: string | null } | null>
  hasPendingRelayCommand(meterId: string, sinceIso: string): Promise<boolean>
}

export type IngestDeps = {
  secret: string
  db: IngestDb
  publish: PublishFn
  now?: () => number
}

// Compares two texts without stopping at the first difference,
// so the time it takes does not leak how much of a guess was right.
function safeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length

  for (let k = 0; k < Math.max(x.length, y.length); k++) {
    diff |= (x[k] ?? 0) ^ (y[k] ?? 0)
  }

  return diff === 0
}

const badRequest = (message: string) =>
  json({ ok: false, error: 'bad_request', message }, 400)

type CutOutcome = {
  sent: boolean
  reason?: string
  command_id?: string
  delivered?: boolean
  error?: string
}

export function createIngestHandler(deps: IngestDeps) {
  const now = deps.now ?? (() => Date.now())

  // process_reading says cut_needed = true on EVERY reading while the
  // relay is on and the balance is too low. We send a relay-off command
  // unless one is already waiting for an answer.
  async function sendCutOff(deviceId: string): Promise<CutOutcome> {
    try {
      const meter = await deps.db.getMeterByDevice(deviceId)

      if (!meter) {
        return { sent: false, reason: 'meter_not_found' }
      }

      const since = new Date(now() - PENDING_WINDOW_MS).toISOString()

      if (await deps.db.hasPendingRelayCommand(meter.id, since)) {
        return { sent: false, reason: 'recent_pending_command' }
      }

      const command = await issueRelayCommand(
        { ...deps.db, publish: deps.publish },
        // The owner is recorded as the user of this automatic command.
        { meterId: meter.id, deviceId, userId: meter.owner_id, value: 0 }
      )

      return {
        sent: command.published,
        command_id: command.id,
        delivered: command.delivered,
        error: command.error,
      }
    } catch (caught) {
      // The reading is already saved, so do not fail the whole request.
      // The next reading says cut_needed again and we retry then.
      const message = caught instanceof Error ? caught.message : String(caught)
      console.error(JSON.stringify({ evt: 'cut_off_failed', deviceId, message }))
      return { sent: false, reason: 'error', error: message }
    }
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405)
    }

    // Never run with an empty secret: that would let everyone in.
    if (!deps.secret) {
      console.error('INGEST_SECRET is not set')
      return json({ ok: false, error: 'server_not_configured' }, 500)
    }

    const sent = req.headers.get(SECRET_HEADER) ?? ''

    if (!safeEqual(sent, deps.secret)) {
      return json({ ok: false, error: 'unauthorized' }, 401)
    }

    // ---- read and check the request ----
    const text = await req.text()

    if (text.length > MAX_BODY_CHARS) {
      return json({ ok: false, error: 'payload_too_large' }, 413)
    }

    let body: unknown

    try {
      body = JSON.parse(text)
    } catch {
      return badRequest('request body is not valid JSON')
    }

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return badRequest('request body must be a JSON object')
    }

    const message = body as Record<string, unknown>

    const topic = parseTopic(message.topic)
    if (!topic.ok) return badRequest(topic.error)

    const payload = parsePayload(message.payload)
    if (!payload.ok) return badRequest(payload.error)

    const { deviceId, kind } = topic.value

    try {
      // ---------- telemetry ----------
      if (kind === 'telemetry') {
        const telemetry = parseTelemetry(payload.value)
        if (!telemetry.ok) return badRequest(telemetry.error)

        const result = await deps.db.processReading(deviceId, telemetry.value)
        const cutNeeded = result.cut_needed === true
        const command = cutNeeded ? await sendCutOff(deviceId) : null

        console.log(
          JSON.stringify({
            evt: 'telemetry',
            deviceId,
            seq: telemetry.value.seq,
            cutNeeded,
            command: command ? (command.reason ?? (command.sent ? 'sent' : 'not_sent')) : null,
          })
        )

        return json({
          ok: true,
          type: 'telemetry',
          device_id: deviceId,
          cut_needed: cutNeeded,
          alert_needed: result.alert_needed ?? null,
          command,
          result,
        })
      }

      // ---------- ack (the device answers a command) ----------
      if (kind === 'ack') {
        const ack = parseAck(payload.value)
        if (!ack.ok) return badRequest(ack.error)

        const result = await deps.db.processAck(deviceId, ack.value)

        console.log(
          JSON.stringify({ evt: 'ack', deviceId, id: ack.value.id, ok: ack.value.ok })
        )

        return json({ ok: true, type: 'ack', device_id: deviceId, result })
      }

      // ---------- status (online / offline) ----------
      const status = parseStatus(payload.value)
      if (!status.ok) return badRequest(status.error)

      const result = await deps.db.processStatus(deviceId, status.value)

      console.log(
        JSON.stringify({ evt: 'status', deviceId, online: status.value.online })
      )

      return json({ ok: true, type: 'status', device_id: deviceId, result })
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      console.error(JSON.stringify({ evt: 'database_error', deviceId, kind, detail }))

      return json({ ok: false, error: 'database_error', message: detail }, 500)
    }
  }
}

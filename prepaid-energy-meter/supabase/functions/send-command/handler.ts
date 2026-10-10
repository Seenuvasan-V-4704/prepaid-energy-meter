// The logic of the send-command function.
// The logged-in browser calls it to switch a meter's relay on or off.

import { corsHeaders, corsPreflight } from '../_shared/cors.ts'
import type { PublishFn } from '../_shared/emqx.ts'
import { issueRelayCommand, type CommandStore } from '../_shared/relayCommand.ts'
import { json } from '../_shared/responses.ts'
import { isUuid } from '../_shared/validation.ts'

export type SendCommandDb = CommandStore & {
  // Returns the user id for a valid access token, otherwise null.
  getUserIdFromJwt(jwt: string): Promise<string | null>
  // Returns the meter only if it belongs to this user.
  getOwnedMeter(
    meterId: string,
    userId: string
  ): Promise<{
    id: string
    device_id: string
    balance: number | string
    min_balance: number | string
  } | null>
}

export type SendCommandDeps = { db: SendCommandDb; publish: PublishFn }

// Every answer carries the CORS headers, errors included. Without
// them the browser would hide the real error message.
const reply = (body: unknown, status = 200) => json(body, status, corsHeaders)

export function createSendCommandHandler(deps: SendCommandDeps) {
  return async function handle(req: Request): Promise<Response> {
    const preflight = corsPreflight(req)
    if (preflight) return preflight

    if (req.method !== 'POST') {
      return reply({ ok: false, error: 'method_not_allowed' }, 405)
    }

    // ---- who is calling? ----
    const authorization = req.headers.get('Authorization') ?? ''
    const jwt = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''

    if (!jwt) {
      return reply({ ok: false, error: 'unauthorized', message: 'Please sign in.' }, 401)
    }

    let userId: string | null

    try {
      userId = await deps.db.getUserIdFromJwt(jwt)
    } catch {
      userId = null
    }

    if (!userId) {
      return reply(
        { ok: false, error: 'unauthorized', message: 'Your sign-in is not valid. Please sign in again.' },
        401
      )
    }

    // ---- what do they want? ----
    let body: unknown

    try {
      body = await req.json()
    } catch {
      return reply({ ok: false, error: 'bad_request', message: 'Request body must be JSON.' }, 400)
    }

    const input = (body ?? {}) as Record<string, unknown>

    if (!isUuid(input.meter_id)) {
      return reply({ ok: false, error: 'bad_request', message: '"meter_id" must be a meter UUID.' }, 400)
    }

    if (input.value !== 0 && input.value !== 1) {
      return reply({ ok: false, error: 'bad_request', message: '"value" must be 0 (relay off) or 1 (relay on).' }, 400)
    }

    const value: 0 | 1 = input.value

    // ---- is it their meter? ----
    // Not found and "not yours" give the same answer on purpose.
    let meter: Awaited<ReturnType<SendCommandDb['getOwnedMeter']>>

    try {
      meter = await deps.db.getOwnedMeter(input.meter_id, userId)
    } catch (caught) {
      console.error(JSON.stringify({ evt: 'read_meter_failed', message: String(caught) }))
      return reply({ ok: false, error: 'server_error', message: 'Could not read the meter.' }, 500)
    }

    if (!meter) {
      return reply({ ok: false, error: 'meter_not_found', message: 'Meter not found.' }, 404)
    }

    // ---- never switch ON a meter with no money ----
    if (value === 1 && Number(meter.balance) <= Number(meter.min_balance)) {
      return reply(
        {
          ok: false,
          error: 'insufficient_balance',
          message: 'The balance is too low to switch the relay on. Please recharge first.',
        },
        409
      )
    }

    // ---- save the command, then send it ----
    let command: Awaited<ReturnType<typeof issueRelayCommand>>

    try {
      command = await issueRelayCommand(
        { ...deps.db, publish: deps.publish },
        { meterId: meter.id, deviceId: meter.device_id, userId, value }
      )
    } catch (caught) {
      console.error(JSON.stringify({ evt: 'save_command_failed', message: String(caught) }))
      return reply({ ok: false, error: 'server_error', message: 'Could not save the command.' }, 500)
    }

    if (!command.published) {
      console.error(JSON.stringify({ evt: 'publish_failed', commandId: command.id, error: command.error }))

      return reply(
        {
          ok: false,
          error: 'publish_failed',
          command_id: command.id,
          message: 'The command could not be sent to the meter. Please try again.',
        },
        502
      )
    }

    console.log(JSON.stringify({ evt: 'command', meterId: meter.id, value, commandId: command.id }))

    return reply({
      ok: true,
      command_id: command.id,
      delivered: command.delivered,
      message: command.delivered
        ? 'Command sent to the meter.'
        : 'Command saved, but the meter is not connected right now.',
    })
  }
}

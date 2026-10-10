// confirm-recharge: the browser reports the payment result.
// DEMO ONLY: this stands in for a payment gateway webhook. A real
// gateway would call a function like this itself, with a signature
// we verify; the browser would never be trusted to say "paid".
import { userIdFromRequest } from '../_shared/authUser.ts'
import { corsHeaders, corsPreflight } from '../_shared/cors.ts'
import { createDb } from '../_shared/db.ts'
import { publishToEmqx } from '../_shared/emqx.ts'
import { issueRelayCommand } from '../_shared/relayCommand.ts'
import { json } from '../_shared/responses.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { isUuid } from '../_shared/validation.ts'

const admin = createAdminClient()
const db = createDb(admin)
const reply = (body: unknown, status = 200) => json(body, status, corsHeaders)

Deno.serve(async (req) => {
  const preflight = corsPreflight(req)
  if (preflight) return preflight

  if (req.method !== 'POST') {
    return reply({ ok: false, error: 'method_not_allowed' }, 405)
  }

  try {
    const userId = await userIdFromRequest(req, db)
    if (!userId) {
      return reply({ ok: false, error: 'unauthorized', message: 'Please sign in.' }, 401)
    }

    const input = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

    if (!isUuid(input.payment_id) || typeof input.success !== 'boolean') {
      return reply({ ok: false, error: 'bad_request', message: '"payment_id" and "success" are required.' }, 400)
    }

    // Only the owner's own payment.
    const { data: payment, error: payError } = await admin
      .from('payments')
      .select('id, meter_id')
      .eq('id', input.payment_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (payError) throw new Error(payError.message)
    if (!payment) {
      return reply({ ok: false, error: 'payment_not_found', message: 'Payment not found.' }, 404)
    }

    // credit_recharge is idempotent: calling it twice credits once.
    const { data, error } = await admin.rpc('credit_recharge', {
      p_payment_id: payment.id,
      p_success: input.success,
    })
    if (error) throw new Error(error.message)

    const result = (Array.isArray(data) ? data[0] : data) ?? {}

    // If the meter was auto-cut, switch the relay back on.
    let relayOnSent = false

    if (result.relay_on_needed === true) {
      const { data: meter, error: meterError } = await admin
        .from('meters')
        .select('id, device_id')
        .eq('id', payment.meter_id)
        .single()
      if (meterError) throw new Error(meterError.message)

      // Skip if a relay-ON command was already created in the last 20 s.
      const since = new Date(Date.now() - 20_000).toISOString()
      const { data: recent, error: recentError } = await admin
        .from('commands')
        .select('id')
        .eq('meter_id', meter.id)
        .eq('action', 'relay')
        .eq('value', 1)
        .gte('created_at', since)
        .limit(1)
      if (recentError) throw new Error(recentError.message)

      if ((recent ?? []).length === 0) {
        const command = await issueRelayCommand(
          { ...db, publish: publishToEmqx },
          { meterId: meter.id, deviceId: meter.device_id, userId, value: 1 }
        )
        relayOnSent = command.published
      }
    }

    return reply({
      ok: true,
      status: result.status,
      balance: result.balance,
      relay_on_sent: relayOnSent,
    })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught)
    console.error(JSON.stringify({ evt: 'confirm_recharge_failed', message }))
    return reply({ ok: false, error: 'server_error', message }, 500)
  }
})
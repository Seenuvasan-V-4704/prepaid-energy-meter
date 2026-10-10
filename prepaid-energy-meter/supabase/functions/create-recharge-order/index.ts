// create-recharge-order: the browser asks for a pending payment.
import { userIdFromRequest } from '../_shared/authUser.ts'
import { corsHeaders, corsPreflight } from '../_shared/cors.ts'
import { createDb } from '../_shared/db.ts'
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
    const amount = Number(input.amount)

    if (!isUuid(input.meter_id)) {
      return reply({ ok: false, error: 'bad_request', message: '"meter_id" must be a meter UUID.' }, 400)
    }

    if (!Number.isFinite(amount) || amount < 10 || amount > 5000) {
      return reply({ ok: false, error: 'bad_request', message: 'Amount must be between 10 and 5000.' }, 400)
    }

    const meter = await db.getOwnedMeter(input.meter_id, userId)
    if (!meter) {
      return reply({ ok: false, error: 'meter_not_found', message: 'Meter not found.' }, 404)
    }

    const { data, error } = await admin
      .from('payments')
      .insert({
        user_id: userId,
        meter_id: meter.id,
        amount: Math.round(amount * 100) / 100,
        provider: 'simulated',
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    return reply({ ok: true, payment_id: data.id })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught)
    console.error(JSON.stringify({ evt: 'create_order_failed', message }))
    return reply({ ok: false, error: 'server_error', message }, 500)
  }
})
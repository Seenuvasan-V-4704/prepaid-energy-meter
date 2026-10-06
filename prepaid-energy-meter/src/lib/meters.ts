// Types and small helpers for meters and readings.
// Supabase may return some columns as booleans, numbers or text, so
// everything is converted here, in one place, into simple types.

export type Meter = {
  id: string
  deviceId: string
  name: string // never empty: falls back to the device id
  tariffPerKwh: number
  balance: number
  minBalance: number
  alertThreshold: number
  alertSent: boolean
  autoCut: boolean
  relayOn: boolean
  fault: boolean
  lastSeenMs: number | null
}

export type Reading = {
  t: number // time in milliseconds (the server time the reading was stored)
  voltage: number
  current: number
  power: number
  energy: number // cumulative kWh
  relayOn: boolean
  fault: boolean
}

// A meter counts as online if it was seen in the last 30 seconds.
export const ONLINE_WINDOW_MS = 30_000

// Columns we ask Supabase for. claim_code is deliberately left out.
export const METER_COLUMNS =
  'id, device_id, name, tariff_per_kwh, balance, min_balance, alert_threshold, alert_sent, auto_cut, relay_state, fault, last_seen'

export const READING_COLUMNS =
  'created_at, voltage, current, power, energy_kwh, relay, fault'

export function toNumber(value: unknown): number {
  const result = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(result) ? result : 0
}

// Accepts an ISO date string (or a number of seconds / milliseconds).
export function toTimeMs(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value
  }

  const parsed = Date.parse(String(value))
  return Number.isNaN(parsed) ? null : parsed
}

// Relay can be stored as true/false, 1/0 or text.
export function isRelayOn(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') {
    return true
  }

  return (
    typeof value === 'string' &&
    ['on', 'true', 't', 'closed'].includes(value.toLowerCase())
  )
}

// Fault can be true/false, a number (0 = no fault) or text.
export function hasFault(value: unknown): boolean {
  if (value === true) {
    return true
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value === 'string') {
    return !['', '0', 'false', 'f', 'no', 'none', 'ok'].includes(
      value.trim().toLowerCase()
    )
  }

  return false
}

export function toMeter(row: Record<string, unknown>): Meter {
  const deviceId = String(row.device_id ?? '')
  const rawName = typeof row.name === 'string' ? row.name.trim() : ''

  return {
    id: String(row.id ?? ''),
    deviceId,
    name: rawName || deviceId,
    tariffPerKwh: toNumber(row.tariff_per_kwh),
    balance: toNumber(row.balance),
    minBalance: toNumber(row.min_balance),
    alertThreshold: toNumber(row.alert_threshold),
    alertSent: row.alert_sent === true,
    autoCut: row.auto_cut === true,
    relayOn: isRelayOn(row.relay_state),
    fault: hasFault(row.fault),
    lastSeenMs: toTimeMs(row.last_seen),
  }
}

export function toReading(row: Record<string, unknown>): Reading {
  return {
    t: toTimeMs(row.created_at) ?? Date.now(),
    voltage: toNumber(row.voltage),
    current: toNumber(row.current),
    power: toNumber(row.power),
    energy: toNumber(row.energy_kwh),
    relayOn: isRelayOn(row.relay),
    fault: hasFault(row.fault),
  }
}

export function isMeterOnline(
  lastSeenMs: number | null,
  nowMs: number
): boolean {
  return lastSeenMs !== null && nowMs - lastSeenMs <= ONLINE_WINDOW_MS
}

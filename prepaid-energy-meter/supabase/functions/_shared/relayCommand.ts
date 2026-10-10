// Sends one relay command to a meter. Used by BOTH functions:
//   - device-ingest (automatic cut-off when the balance is too low)
//   - send-command  (the user pressing the relay button)
//
// The order matters: the commands row is saved FIRST, because the
// device may answer within milliseconds and process_ack must already
// find the row. The command id sent to the device is that row's UUID.

import type { PublishFn } from './emqx.ts'

export type CommandRow = {
  id: string
  meter_id: string
  user_id: string | null
  action: 'relay'
  value: 0 | 1
  status: 'pending'
}

export type CommandStore = {
  // Throws if the row could not be saved.
  insertCommand(row: CommandRow): Promise<void>
  markCommandFailed(id: string): Promise<void>
}

export type IssuedCommand = {
  id: string
  // false = the broker could not be reached, nothing was sent
  published: boolean
  // false = published, but no client is subscribed (device offline)
  delivered: boolean
  error?: string
}

export async function issueRelayCommand(
  deps: CommandStore & { publish: PublishFn },
  args: {
    meterId: string
    deviceId: string
    userId: string | null
    value: 0 | 1
  }
): Promise<IssuedCommand> {
  const id = crypto.randomUUID()

  // If this throws, nothing has been sent, and the caller decides.
  await deps.insertCommand({
    id,
    meter_id: args.meterId,
    user_id: args.userId,
    action: 'relay',
    value: args.value,
    status: 'pending',
  })

  try {
    const result = await deps.publish(`meters/${args.deviceId}/cmd`, {
      id,
      action: 'relay',
      value: args.value,
    })

    return { id, published: true, delivered: result.delivered }
  } catch (caught) {
    // Could not reach the broker: mark the row as failed (best effort).
    await deps.markCommandFailed(id).catch(() => {})

    return {
      id,
      published: false,
      delivered: false,
      error: caught instanceof Error ? caught.message : String(caught),
    }
  }
}

// Publishes a message to the MQTT broker (EMQX) through its REST API.
// This is how the cloud sends a command to a meter.

export type PublishResult = {
  // false when nobody is subscribed to the topic right now
  // (for example the meter is offline). The message is NOT queued.
  delivered: boolean
  id?: string
}

export type PublishFn = (topic: string, payload: unknown) => Promise<PublishResult>

export type EmqxConfig = {
  apiUrl: string // the "API endpoint" from the EMQX deployment overview
  apiKey: string
  apiSecret: string
}

// Accepts the address with or without "/api/v5" or "/publish" and
// returns the full publish address.
export function emqxPublishUrl(apiUrl: string): string {
  let base = apiUrl.trim().replace(/\/+$/, '')

  if (base.endsWith('/publish')) {
    return base
  }

  if (!base.endsWith('/api/v5')) {
    base += '/api/v5'
  }

  return `${base}/publish`
}

export function createEmqxPublisher(
  config: EmqxConfig,
  fetchImpl: typeof fetch = fetch
): PublishFn {
  const url = emqxPublishUrl(config.apiUrl)
  const authorization = 'Basic ' + btoa(`${config.apiKey}:${config.apiSecret}`)

  return async (topic, payload) => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        topic,
        // EMQX wants the message body as text, so we send JSON as text.
        payload: JSON.stringify(payload),
        qos: 1,
        retain: false,
      }),
      signal: AbortSignal.timeout(6000),
    })

    const text = await response.text()

    // 200 = delivered to at least one subscriber.
    if (response.status === 200) {
      let id: string | undefined

      try {
        id = (JSON.parse(text) as { id?: string }).id
      } catch {
        // the body is not important
      }

      return { delivered: true, id }
    }

    // 202 = accepted, but no client is subscribed to that topic.
    if (response.status === 202) {
      return { delivered: false }
    }

    throw new Error(`EMQX publish failed (${response.status}): ${text.slice(0, 200)}`)
  }
}

// The real publisher, configured from the secrets you set with
// "supabase secrets set". It is created on first use.
let cached: PublishFn | null = null

export const publishToEmqx: PublishFn = (topic, payload) => {
  if (!cached) {
    const apiUrl = Deno.env.get('EMQX_API_URL')
    const apiKey = Deno.env.get('EMQX_API_KEY')
    const apiSecret = Deno.env.get('EMQX_API_SECRET')

    if (!apiUrl || !apiKey || !apiSecret) {
      throw new Error('EMQX_API_URL, EMQX_API_KEY or EMQX_API_SECRET is not set')
    }

    cached = createEmqxPublisher({ apiUrl, apiKey, apiSecret })
  }

  return cached(topic, payload)
}

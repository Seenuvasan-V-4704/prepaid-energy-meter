// MQTT bridge (FALLBACK). Use it only if the EMQX webhook is not available.
//
// It connects to the MQTT broker, listens to every meter's telemetry,
// ack and status messages, and forwards each one to the device-ingest
// Edge Function, in exactly the format the EMQX webhook would send:
//   { "topic": "...", "payload": "<the message text>", "clientid": "..." }
//
// Run:  npm install   (once)   then   npm start
// It must keep running (on your PC or a small server) for data to flow.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import mqtt from 'mqtt'

// ---- Read settings: real environment first, then a ".env" file ----
function loadDotEnv() {
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), '.env')

    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)

      if (match && !line.trim().startsWith('#') && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // no .env file: that is fine if the variables are already set
  }
}

loadDotEnv()

const { MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, INGEST_URL, INGEST_SECRET } = process.env

for (const [name, value] of Object.entries({ MQTT_URL, INGEST_URL, INGEST_SECRET })) {
  if (!value) {
    console.error(`Missing setting ${name}. Copy .env.example to .env and fill it in.`)
    process.exit(1)
  }
}

const TOPICS = ['meters/+/telemetry', 'meters/+/ack', 'meters/+/status']
const CLIENT_ID = process.env.MQTT_CLIENT_ID || `mqtt-bridge-${Math.random().toString(16).slice(2, 8)}`

// ---- Send one message to the Edge Function (retry once on a server error) ----
async function forward(topic, payload) {
  const body = JSON.stringify({ topic, payload: payload.toString('utf8'), clientid: CLIENT_ID })

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ingest-secret': INGEST_SECRET },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        return
      }

      const text = (await response.text()).slice(0, 200)
      console.error(`[${topic}] ingest answered ${response.status}: ${text}`)

      // 4xx means our message is wrong (or the secret): retrying cannot help.
      if (response.status < 500) {
        return
      }
    } catch (error) {
      console.error(`[${topic}] could not reach ingest: ${error.message}`)
    }
  }
}

// Messages are sent one after another, in the order they arrived.
let queue = Promise.resolve()

// ---- Connect to the broker ----
const client = mqtt.connect(MQTT_URL, {
  clientId: CLIENT_ID,
  username: MQTT_USERNAME || undefined,
  password: MQTT_PASSWORD || undefined,
  reconnectPeriod: 3000,
  connectTimeout: 15_000,
})

client.on('connect', () => {
  console.log(`Connected to ${MQTT_URL} as ${CLIENT_ID}`)

  client.subscribe(TOPICS, { qos: 1 }, (error) => {
    if (error) console.error('Subscribe failed:', error.message)
    else console.log('Listening to:', TOPICS.join(', '))
  })
})

client.on('message', (topic, payload) => {
  queue = queue.then(() => forward(topic, payload)).catch(() => {})
})

client.on('reconnect', () => console.log('Reconnecting to the broker...'))
client.on('error', (error) => console.error('MQTT error:', error.message))

process.on('SIGINT', () => {
  console.log('Stopping...')
  client.end(false, () => process.exit(0))
})

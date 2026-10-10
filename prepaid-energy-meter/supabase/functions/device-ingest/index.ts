// device-ingest: receives the webhook from EMQX.
//
// DEPLOY WITHOUT JWT VERIFICATION. EMQX is not a Supabase user, so it
// has no user token. Protection comes from the secret header instead.
//   npx supabase functions deploy device-ingest --no-verify-jwt --use-api
// (supabase/config.toml also says verify_jwt = false for this function)

import { createDb } from '../_shared/db.ts'
import { publishToEmqx } from '../_shared/emqx.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { createIngestHandler } from './handler.ts'

Deno.serve(
  createIngestHandler({
    secret: Deno.env.get('INGEST_SECRET') ?? '',
    db: createDb(createAdminClient()),
    publish: publishToEmqx,
  })
)

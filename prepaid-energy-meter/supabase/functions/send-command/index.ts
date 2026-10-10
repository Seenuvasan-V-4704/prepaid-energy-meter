// send-command: the logged-in browser calls this to switch a relay.
//
// JWT verification stays ON (the default): Supabase rejects requests
// without a valid user token before this code even runs. The handler
// then checks the token again to learn WHICH user it is, and checks
// that the meter belongs to that user.
//   npx supabase functions deploy send-command --use-api

import { createDb } from '../_shared/db.ts'
import { publishToEmqx } from '../_shared/emqx.ts'
import { createAdminClient } from '../_shared/supabaseAdmin.ts'
import { createSendCommandHandler } from './handler.ts'

Deno.serve(
  createSendCommandHandler({
    db: createDb(createAdminClient()),
    publish: publishToEmqx,
  })
)

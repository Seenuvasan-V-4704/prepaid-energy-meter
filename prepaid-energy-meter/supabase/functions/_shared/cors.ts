// CORS helper. Browsers refuse to call a function on another website
// unless the function answers with these headers. Only send-command is
// called from the browser, so only it uses this.

export const corsHeaders: Record<string, string> = {
  // "*" is fine here: the function does not use cookies. It is protected
  // by the user's JWT, which a browser only sends if our own code adds it.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Before a real request, the browser sends an OPTIONS "preflight"
// question. This answers it. Returns null for every other request.
export function corsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  return null
}

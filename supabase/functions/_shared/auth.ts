import { createClient } from 'npm:@supabase/supabase-js@2'

// These three are injected automatically into every deployed Edge Function.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Thrown anywhere in a handler to short-circuit with a specific HTTP status.
export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// A client scoped to the CALLER's JWT — RLS applies as that signed-in user.
// Use for reads/writes that should respect the caller's own permissions.
export function userClient(req: Request) {
  const authorization = req.headers.get('Authorization') ?? ''
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
}

// A full-access client that BYPASSES RLS. Only use after you have authorized
// the caller yourself (e.g. confirmed they are an admin or the recipient).
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

// Resolve the signed-in user from the request, or 401.
export async function requireUser(req: Request) {
  const supabase = userClient(req)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new HttpError(401, 'Not authenticated')
  return { user, supabase }
}

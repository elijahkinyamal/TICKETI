// admin-create-user — lets an owner/admin mint a staff login with an enforced
// 30-day expiry. Creating auth users needs the service-role key, which must
// never reach the browser — hence this function.
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, adminClient, HttpError } from '../_shared/auth.ts'

const EXPIRY_DAYS = 30
const ASSIGNABLE_ROLES = ['admin', 'staff', 'viewer']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user, supabase } = await requireUser(req)

    // Authorize the CALLER: only owners/admins may create logins.
    const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!me || !['owner', 'admin'].includes(me.role)) throw new HttpError(403, 'Admins only')

    const { email, password, full_name = '', role = 'staff' } = await req.json()
    if (!email || !password) throw new HttpError(400, 'email and password are required')
    if (!ASSIGNABLE_ROLES.includes(role)) throw new HttpError(400, `role must be one of ${ASSIGNABLE_ROLES.join(', ')}`)

    const admin = adminClient()
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // admin-created accounts skip the confirmation email
      user_metadata: { full_name },
    })
    if (error) throw new HttpError(400, error.message)

    // The on_auth_user_created trigger already inserted a profile row; upsert to
    // set the role + expiry (upsert guards against any trigger-timing surprises).
    const expires_at = new Date(Date.now() + EXPIRY_DAYS * 86_400_000).toISOString()
    const { error: upErr } = await admin
      .from('profiles')
      .upsert({ id: created.user.id, full_name, role, expires_at })
    if (upErr) throw new HttpError(500, upErr.message)

    return json({ id: created.user.id, email, role, expires_at })
  } catch (e) {
    return json({ error: (e as Error).message }, (e as HttpError).status ?? 500)
  }
})

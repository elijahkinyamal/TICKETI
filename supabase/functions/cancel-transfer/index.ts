// cancel-transfer — the SENDER cancels their own pending transfer. The seats
// that were held pending are released back to the sender (pending_transfer_id
// cleared) and the transfer is marked cancelled. Runs with the service role
// after verifying the caller is the transfer's sender.
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, adminClient, HttpError } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireUser(req)
    const { transfer_id } = await req.json()
    if (!transfer_id) throw new HttpError(400, 'transfer_id is required')

    const admin = adminClient()
    const { data: t } = await admin.from('transfers').select('*').eq('id', transfer_id).single()
    if (!t) throw new HttpError(404, 'Transfer not found')
    if (t.from_user !== user.id) throw new HttpError(403, 'This is not your transfer')
    if (t.status !== 'pending') throw new HttpError(409, `Transfer already ${t.status}`)

    // Release the held seats back to the sender.
    const { data: released, error: e1 } = await admin.from('seats')
      .update({ pending_transfer_id: null })
      .eq('pending_transfer_id', transfer_id)
      .select('id')
    if (e1) throw new HttpError(500, e1.message)

    const { error: e2 } = await admin.from('transfers')
      .update({ status: 'cancelled' })
      .eq('id', transfer_id)
    if (e2) throw new HttpError(500, e2.message)

    return json({ status: 'cancelled', released: released?.length ?? 0 })
  } catch (e) {
    return json({ error: (e as Error).message }, (e as HttpError).status ?? 500)
  }
})

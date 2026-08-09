// accept-transfer — the recipient accepts a pending transfer, which reassigns
// event ownership to them. That write crosses the RLS owner boundary (neither
// the old nor the new owner could do it under the "owner only" policy), so it
// runs with the service-role client AFTER we verify the caller is the recipient.
// On success it emails the recipient a Ticket-branded "accepted" confirmation.
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, adminClient, HttpError } from '../_shared/auth.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('TRANSFER_FROM_EMAIL') ?? 'Ticket <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''
const BRAND = '#026cdf'
const BRAND_DARK = '#0257b0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user } = await requireUser(req)
    const { transfer_id } = await req.json()
    if (!transfer_id) throw new HttpError(400, 'transfer_id is required')

    const admin = adminClient()
    const { data: t } = await admin.from('transfers').select('*').eq('id', transfer_id).single()
    if (!t) throw new HttpError(404, 'Transfer not found')
    if (t.status !== 'pending') throw new HttpError(409, `Transfer already ${t.status}`)
    if ((t.to_email ?? '').toLowerCase() !== (user.email ?? '').toLowerCase())
      throw new HttpError(403, 'This transfer is not addressed to you')

    // Reassign ownership, then mark the transfer accepted.
    const { error: e1 } = await admin.from('events').update({ owner_id: user.id }).eq('id', t.event_id)
    if (e1) throw new HttpError(500, e1.message)
    const { error: e2 } = await admin.from('transfers')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', transfer_id)
    if (e2) throw new HttpError(500, e2.message)

    // Confirmation email to the recipient (best-effort — never fails the accept).
    let emailed = false
    try {
      if (RESEND_KEY && user.email) {
        const { data: ev } = await admin.from('events').select('name, poster_url, starts_at, venue').eq('id', t.event_id).single()
        const { data: seatRows } = await admin.from('seats').select('section, seat_row, seat').eq('event_id', t.event_id)
        const { data: sender } = await admin.from('profiles').select('full_name').eq('id', t.from_user).single()
        emailed = await sendAcceptedEmail({
          to: user.email,
          recipientName: user.user_metadata?.full_name || user.email.split('@')[0],
          senderName: sender?.full_name || 'a member',
          eventName: ev?.name || 'your event',
          posterUrl: ev?.poster_url, startsAt: ev?.starts_at, venue: ev?.venue,
          seats: seatRows || [],
        })
      }
    } catch (mailErr) { console.error('accepted email failed', mailErr) }

    return json({ event_id: t.event_id, status: 'accepted', emailed })
  } catch (e) {
    return json({ error: (e as Error).message }, (e as HttpError).status ?? 500)
  }
})

async function sendAcceptedEmail(p: {
  to: string; recipientName: string; senderName: string; eventName: string
  posterUrl?: string | null; startsAt?: string | null; venue?: string | null
  seats: Array<{ section?: string; seat_row?: string; seat?: string }>
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: p.to,
      subject: `You've accepted your tickets — ${p.eventName}`,
      html: buildAcceptedHtml(p),
    }),
  })
  if (!res.ok) { console.error('Resend send failed', res.status, await res.text()); return false }
  return true
}

function buildAcceptedHtml(p: {
  to: string; recipientName: string; senderName: string; eventName: string
  posterUrl?: string | null; startsAt?: string | null; venue?: string | null
  seats: Array<{ section?: string; seat_row?: string; seat?: string }>
}) {
  const when = p.startsAt
    ? new Date(p.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date TBA'
  const count = p.seats.length || 1
  const seatLines = p.seats.length
    ? p.seats.map((s) => `Section ${esc(s.section || '—')}, Row ${esc(s.seat_row || '—')}, Seat ${esc(s.seat || '—')}`).join('<br>')
    : 'General Admission'
  const banner = p.posterUrl
    ? `<tr><td style="padding:0"><img src="${p.posterUrl}" width="100%" alt="" style="display:block;width:100%;max-height:230px;object-fit:cover;border-radius:12px 12px 0 0"></td></tr>`
    : ''

  // All three steps complete (blue) — the transfer is done.
  const dot = (glyph: string) =>
    `<div style="width:34px;height:34px;line-height:31px;border-radius:50%;margin:0 auto;text-align:center;` +
    `background:${BRAND};border:2px solid ${BRAND};color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700">${glyph}</div>`
  const cap = (t: string) => `<div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;margin-top:7px;color:${BRAND}">${t}</div>`
  const line = `<td valign="top" style="padding:0 3px"><div style="height:2px;background:${BRAND};margin-top:17px"></div></td>`
  const tracker =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td align="center" width="72" valign="top">${dot('&#8599;')}${cap('Received')}</td>` + line +
    `<td align="center" width="72" valign="top">${dot('&#10003;')}${cap('Accepted')}</td>` + line +
    `<td align="center" width="72" valign="top">${dot('&#9733;')}${cap('Complete')}</td>` +
    `</tr></table>`

  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">

      <tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:18px 20px;text-align:center">
        <span style="display:inline-block;vertical-align:middle;width:34px;height:34px;line-height:34px;background:#fff;border-radius:9px;color:${BRAND};font-family:Arial,sans-serif;font-size:20px;font-weight:800;text-align:center;margin-right:9px">T</span>
        <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:.5px;vertical-align:middle">Ticket</span>
      </td></tr>

      <tr><td style="padding:26px 28px 6px">
        <h1 style="margin:0;font-family:Arial,sans-serif;font-size:20px;color:#111;text-align:center">
          You've successfully accepted ${count} ticket${count > 1 ? 's' : ''} to ${esc(p.eventName)}
        </h1>
      </td></tr>

      <tr><td style="padding:18px 28px 8px">${tracker}</td></tr>

      <tr><td style="padding:14px 28px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceef2;border-radius:12px;overflow:hidden">
          ${banner}
          <tr><td style="padding:16px">
            <div style="font-family:Arial,sans-serif;font-size:16px;font-weight:800;color:#111">${esc(p.eventName)}</div>
            <div style="font-family:Arial,sans-serif;font-size:13px;color:#66707e;margin-top:4px">${esc(when)}</div>
            <div style="font-family:Arial,sans-serif;font-size:13px;color:#66707e">${esc(p.venue || '')}</div>
            <div style="font-family:Arial,sans-serif;font-size:13px;color:#111;margin-top:10px;font-weight:600">${seatLines}</div>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:18px 28px 4px">
        <p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:0">
          Hi ${esc(p.recipientName)},<br><br>
          You've successfully accepted your ticket transfer from ${esc(p.senderName)} — you're now on your way to see <b>${esc(p.eventName)}</b>.
          To access your tickets, sign in to Ticket with <b>${esc(p.to)}</b>.
        </p>
      </td></tr>

      ${APP_URL ? `<tr><td style="padding:16px 28px 6px" align="center">
        <a href="${APP_URL}/tickets" style="display:inline-block;background:${BRAND};color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:10px">View my tickets</a>
      </td></tr>` : ''}

      <tr><td style="padding:16px 28px 26px">
        <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#9aa3b2;margin:0;text-align:center">
          Ticket · Confirmation of a transfer you accepted.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

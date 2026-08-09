// send-transfer — records a pending transfer and emails the recipient a
// branded Eliki Tickets HTML email (event picture + progress tracker + Accept
// button). The email send uses a secret (Resend) that must stay server-side.
import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, HttpError } from '../_shared/auth.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('TRANSFER_FROM_EMAIL') ?? 'Ticket <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? ''

const BRAND = '#026cdf'       // Eliki blue (matches the app accent)
const BRAND_DARK = '#0257b0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { user, supabase } = await requireUser(req)
    const { event_id, to_email, to_name = '', note = '' } = await req.json()
    if (!event_id || !to_email) throw new HttpError(400, 'event_id and to_email are required')

    // Confirm ownership up front for a clean 403 (RLS would also block the insert).
    const { data: ev } = await supabase
      .from('events').select('id, name, owner_id, poster_url, starts_at, venue').eq('id', event_id).single()
    if (!ev || ev.owner_id !== user.id) throw new HttpError(403, 'You do not own this event')

    const { data: seatRows } = await supabase
      .from('seats').select('section, seat_row, seat').eq('event_id', event_id)

    // Insert as the caller — RLS requires from_user === auth.uid().
    const { data: transfer, error } = await supabase
      .from('transfers')
      .insert({ event_id, from_user: user.id, to_email, note })
      .select().single()
    if (error) throw new HttpError(400, error.message)

    let emailed = false
    if (RESEND_KEY) {
      const senderName = user.user_metadata?.full_name || user.email || 'a member'
      const acceptUrl = APP_URL ? `${APP_URL}/accept?transfer=${transfer.id}` : ''
      emailed = await sendEmail({
        to: to_email, toName: to_name, senderName,
        eventName: ev.name, posterUrl: ev.poster_url, startsAt: ev.starts_at, venue: ev.venue,
        seats: seatRows || [], note, acceptUrl,
      })
    }
    return json({ transfer, emailed })
  } catch (e) {
    return json({ error: (e as Error).message }, (e as HttpError).status ?? 500)
  }
})

async function sendEmail(p: {
  to: string; toName: string; senderName: string; eventName: string
  posterUrl?: string | null; startsAt?: string | null; venue?: string | null
  seats: Array<{ section?: string; seat_row?: string; seat?: string }>; note: string; acceptUrl: string
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: p.to,
      subject: `${p.senderName} sent you tickets — ${p.eventName}`,
      html: buildHtml(p),
    }),
  })
  if (!res.ok) {
    console.error('Resend send failed', res.status, await res.text())
    return false
  }
  return true
}

function buildHtml(p: {
  toName: string; senderName: string; eventName: string
  posterUrl?: string | null; startsAt?: string | null; venue?: string | null
  seats: Array<{ section?: string; seat_row?: string; seat?: string }>; note: string; acceptUrl: string
}) {
  const when = p.startsAt
    ? new Date(p.startsAt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Date TBA'
  const seatLines = p.seats.length
    ? p.seats.map((s) => `Section ${esc(s.section || '—')}, Row ${esc(s.seat_row || '—')}, Seat ${esc(s.seat || '—')}`).join('<br>')
    : 'General Admission'
  const count = p.seats.length || 1

  // Event picture merged into a banner card (poster with a dark overlay + title).
  const banner = p.posterUrl
    ? `<tr><td style="padding:0">
         <div style="position:relative">
           <img src="${p.posterUrl}" width="100%" alt="" style="display:block;width:100%;max-height:230px;object-fit:cover;border-radius:12px 12px 0 0">
         </div>
       </td></tr>`
    : ''

  const dot = (glyph: string, active: boolean) =>
    `<div style="width:34px;height:34px;line-height:31px;border-radius:50%;margin:0 auto;text-align:center;` +
    `background:${active ? BRAND : '#ffffff'};border:2px ${active ? 'solid' : 'dashed'} ${active ? BRAND : '#cfd5df'};` +
    `color:${active ? '#ffffff' : '#aab2c0'};font-family:Arial,sans-serif;font-size:15px;font-weight:700">${glyph}</div>`
  const cap = (t: string, active: boolean) =>
    `<div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;margin-top:7px;color:${active ? BRAND : '#9aa3b2'}">${t}</div>`
  const lineOn = `<td valign="top" style="padding:0 3px"><div style="height:2px;background:${BRAND};margin-top:17px"></div></td>`
  const lineOff = `<td valign="top" style="padding:0 3px"><div style="height:2px;background:#d7dbe3;margin-top:17px"></div></td>`
  const tracker =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
    `<td align="center" width="72" valign="top">${dot('&#10003;', true)}${cap('Received', true)}</td>` +
    lineOn +
    `<td align="center" width="72" valign="top">${dot('&#10003;', false)}${cap('Accepted', false)}</td>` +
    lineOff +
    `<td align="center" width="72" valign="top">${dot('&#9733;', false)}${cap('Complete', false)}</td>` +
    `</tr></table>`

  return `<!doctype html><html><body style="margin:0;background:#f4f4f7;padding:24px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:92%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">

      <!-- Brand header (logo lockup: badge mark + wordmark) -->
      <tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:18px 20px;text-align:center">
        /*<span style="display:inline-block;vertical-align:middle;width:34px;height:34px;line-height:34px;background:#fff;border-radius:9px;color:${BRAND};font-family:Arial,sans-serif;font-size:20px;font-weight:800;text-align:center;margin-right:9px">t</span>
        <span style="display:inline-block;width:34px;height:34px;line-height:34px;background:#026CDF;border-radius:9px;color:#FFFFFF;font-size:24px;font-weight:900;text-align:center;margin-right:9px;font-style:italic;">t</span>
        <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:800;color:#fff;letter-spacing:.5px;vertical-align:middle">Ticket</span>
      </td></tr>

      <tr><td style="padding:26px 28px 6px">
        <h1 style="margin:0;font-family:Arial,sans-serif;font-size:20px;color:#111;text-align:center">
          Your ticket transfer from ${esc(p.senderName)} is ready to accept
        </h1>
      </td></tr>

      <!-- Progress tracker -->
      <tr><td style="padding:18px 28px 8px">
        ${tracker}
      </td></tr>

      <!-- Event card with picture merged in -->
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

      <!-- Accept button -->
      <tr><td style="padding:20px 28px 6px" align="center">
        ${p.acceptUrl
          ? `<a href="${p.acceptUrl}" style="display:inline-block;background:${BRAND};color:#fff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:10px">Accept ${count} Ticket${count > 1 ? 's' : ''}</a>`
          : `<p style="font-family:Arial,sans-serif;font-size:14px;color:#66707e">Sign in to Ticket to accept your tickets.</p>`}
      </td></tr>

      ${p.note ? `<tr><td style="padding:8px 28px">
        <div style="background:#f3f1ff;border:1px solid #e5e0ff;border-radius:10px;padding:12px 14px">
          <div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:${BRAND_DARK};margin-bottom:4px">A message from ${esc(p.senderName)}</div>
          <div style="font-family:Arial,sans-serif;font-size:13px;color:#333">${esc(p.note)}</div>
        </div></td></tr>` : ''}

      <tr><td style="padding:18px 28px 26px">
        <p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:#9aa3b2;margin:0;text-align:center">
            Ticket · This transfer was sent to you by ${esc(p.senderName)}. If you weren't expecting it, you can ignore this email.
        </p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

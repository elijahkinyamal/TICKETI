// send-transfer
//
// Records a pending ticket transfer and emails the recipient
// a branded Eliki Tickets HTML email.
//
// Includes:
// - Event poster
// - Ticket count
// - Event details
// - Seats
// - Received -> Accepted -> Complete tracker
// - Eliki verified badge
// - Gmail preview/preheader
// - Accept button
// - Sender message
// - Secure transfer information
// - Responsive email layout
//
// Resend API key remains server-side.

import { corsHeaders, json } from '../_shared/cors.ts'
import { requireUser, HttpError } from '../_shared/auth.ts'

const RESEND_KEY =
  Deno.env.get('RESEND_API_KEY')

const FROM =
  Deno.env.get('TRANSFER_FROM_EMAIL') ??
  'Ticketmaster <onboarding@resend.dev>'

const APP_URL =
  Deno.env.get('APP_URL') ?? ''

// ============================================================
// TICKETMASTER LOGO
// ============================================================
//
// Set this in Supabase Edge Function secrets:
//
//   TICKETMASTER_LOGO_URL
//
// Use a PUBLIC (non-expiring) Storage URL to a PNG of the logo.
// For the header, a transparent-background PNG with the WHITE
// wordmark looks best on the blue gradient.
//
// When unset, the header/footer fall back to styled text.
//
const LOGO_URL =
  Deno.env.get('TICKETMASTER_LOGO_URL') ?? ''

// ============================================================
// VERIFIED BADGE
// ============================================================
//
// Blue certification seal shown right after the header wordmark.
// Public (non-expiring) Storage URL, so it renders in Gmail
// without needing a secret.
//
const VERIFIED_BADGE_URL =
  'https://lhbrcahdtuxjxjqjxfnq.supabase.co/storage/v1/object/public/eliki-verified-badge-40.png/eliki-verified-badge-40.png'

// ============================================================
// ELIKI DESIGN TOKENS
// ============================================================

const C = {
  primary: '#0054b1',
  primaryContainer: '#026cdf',
  onPrimary: '#ffffff',

  secondary: '#125db6',
  secondaryFixed: '#d7e3ff',
  onSecondaryFixed: '#001b3f',

  background: '#f7f9fb',

  surfaceContainer: '#eceef0',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerLowest: '#ffffff',

  onSurface: '#191c1e',
  onSurfaceVariant: '#414754',

  outlineVariant: '#c1c6d6',
  outline: '#727785',

  inverseSurface: '#2d3133',
  inverseOnSurface: '#eff1f3',

  secondaryFixedDim: '#abc7ff',
}

// ============================================================
// MAIN FUNCTION
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  try {
    const { user, supabase } =
      await requireUser(req)

    const {
      event_id,
      to_email,
      to_name = '',
      note = '',
    } = await req.json()

    if (!event_id || !to_email) {
      throw new HttpError(
        400,
        'event_id and to_email are required'
      )
    }

    // ----------------------------------------------------------
    // Confirm event ownership
    // ----------------------------------------------------------

    const { data: ev } =
      await supabase
        .from('events')
        .select(
          'id, name, owner_id, poster_url, starts_at, venue'
        )
        .eq('id', event_id)
        .single()

    if (!ev || ev.owner_id !== user.id) {
      throw new HttpError(
        403,
        'You do not own this event'
      )
    }

    // ----------------------------------------------------------
    // Get seats
    // ----------------------------------------------------------

    const { data: seatRows } =
      await supabase
        .from('seats')
        .select(
          'section, seat_row, seat'
        )
        .eq('event_id', event_id)

    // ----------------------------------------------------------
    // Create pending transfer
    // ----------------------------------------------------------

    const {
      data: transfer,
      error,
    } = await supabase
      .from('transfers')
      .insert({
        event_id,
        from_user: user.id,
        to_email,
        note,
      })
      .select()
      .single()

    if (error) {
      throw new HttpError(
        400,
        error.message
      )
    }

    // ----------------------------------------------------------
    // Send email
    // ----------------------------------------------------------

    let emailed = false

    if (RESEND_KEY) {
      const senderName =
        user.user_metadata?.full_name ||
        user.email ||
        'a member'

      const acceptUrl = APP_URL
        ? `${APP_URL}/accept?transfer=${transfer.id}`
        : ''

      emailed = await sendEmail({
        to: to_email,
        toName: to_name,
        senderName,

        eventName: ev.name,
        posterUrl: ev.poster_url,
        startsAt: ev.starts_at,
        venue: ev.venue,

        seats: seatRows || [],

        note,
        acceptUrl,
      })
    }

    return json({
      transfer,
      emailed,
    })
  } catch (e) {
    return json(
      {
        error: (e as Error).message,
      },
      (e as HttpError).status ?? 500
    )
  }
})

// ============================================================
// SEND EMAIL
// ============================================================

async function sendEmail(p: {
  to: string
  toName: string
  senderName: string

  eventName: string
  posterUrl?: string | null
  startsAt?: string | null
  venue?: string | null

  seats: Array<{
    section?: string
    seat_row?: string
    seat?: string
  }>

  note: string
  acceptUrl: string
}) {
  const html = buildHtml(p)

  const res = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${RESEND_KEY}`,

        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        from: FROM,

        to: p.to,

        subject:
          `${p.senderName} sent you tickets — ${p.eventName}`,

        html,
      }),
    }
  )

  if (!res.ok) {
    console.error(
      'Resend send failed',
      res.status,
      await res.text()
    )

    return false
  }

  return true
}

// ============================================================
// BUILD HTML EMAIL
// ============================================================

function buildHtml(p: {
  toName: string
  senderName: string

  eventName: string
  posterUrl?: string | null
  startsAt?: string | null
  venue?: string | null

  seats: Array<{
    section?: string
    seat_row?: string
    seat?: string
  }>

  note: string
  acceptUrl: string
}) {
  // ----------------------------------------------------------
  // Date
  // ----------------------------------------------------------

  const when = p.startsAt
    ? new Date(
        p.startsAt
      ).toLocaleString(
        'en-US',
        {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }
      )
    : 'Date TBA'

  // ----------------------------------------------------------
  // Doors
  // ----------------------------------------------------------

  const doorsTime = p.startsAt
    ? new Date(
        p.startsAt
      ).toLocaleString(
        'en-US',
        {
          hour: 'numeric',
          minute: '2-digit',
        }
      )
    : ''

  // ----------------------------------------------------------
  // Seats
  // ----------------------------------------------------------

  const seatSummary = p.seats.length
    ? p.seats
        .map(
          (s) =>
            `Sec ${esc(s.section || 'GA')} · ` +
            `Row ${esc(s.seat_row || '—')} · ` +
            `Seat ${esc(s.seat || '—')}`
        )
        .join('<br>')
    : 'General Admission'

  const count =
    p.seats.length || 1

  // ----------------------------------------------------------
  // Email-safe font
  // ----------------------------------------------------------
  //
  // Averta is used first for environments that have it.
  // Gmail/Outlook will fall back to Arial.
  //

  const font =
    "'Averta', Arial, Helvetica, sans-serif"

  // ==========================================================
  // GMAIL EMAIL PREVIEW / PREHEADER
  // ==========================================================

  const preheader = `
    <div
      style="
        display:none;
        max-height:0;
        overflow:hidden;
        opacity:0;
        color:transparent;
        font-size:1px;
        line-height:1px;
      "
    >
      ${esc(p.senderName)}
      sent you
      ${count}
      ticket${count > 1 ? 's' : ''}
      for
      ${esc(p.eventName)}.
      Your tickets are ready to accept.
    </div>
  `

  // ==========================================================
  // EVENT IMAGE
  // ==========================================================

  const banner = p.posterUrl
    ? `
      <tr>

        <td
          style="
            padding:0;
            margin:0;
          "
        >

          <img
            src="${esc(p.posterUrl)}"
            width="600"
            alt="${esc(p.eventName)}"
            style="
              display:block;
              width:100%;
              max-width:100%;
              height:auto;
              min-height:150px;
              max-height:260px;
              object-fit:cover;
              border:0;
            "
          >

          <div
            style="
              background:${C.primary};
              color:${C.onPrimary};

              font-family:${font};
              font-size:12px;
              font-weight:700;
              line-height:16px;

              padding:6px 10px;

              border-radius:8px;

              margin:10px;

              display:inline-block;
            "
          >
            x${count}
            Ticket${count > 1 ? 's' : ''}
          </div>

        </td>

      </tr>
    `
    : ''

  // ==========================================================
  // PROGRESS ICON
  // ==========================================================

  const progressIcon = (
    icon: string,
    active: boolean
  ) => `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        margin:0 auto;
      "
    >

      <tr>

        <td
          align="center"
          valign="middle"
          style="
            width:42px;
            height:42px;
            min-width:42px;

            background:
              ${
                active
                  ? C.primaryContainer
                  : '#dfe3ea'
              };

            border-radius:50%;

            text-align:center;
            vertical-align:middle;

            font-family:${font};

            font-size:20px;
            line-height:42px;

            font-weight:700;

            color:
              ${
                active
                  ? '#ffffff'
                  : C.onSurfaceVariant
              };
          "
        >
          ${icon}
        </td>

      </tr>

    </table>
  `

  // ==========================================================
  // PROGRESS LABEL
  // ==========================================================

  const progressLabel = (
    text: string,
    active: boolean
  ) => `
    <div
      style="
        font-family:${font};

        font-size:11px;
        line-height:15px;

        font-weight:
          ${active ? '700' : '600'};

        color:
          ${
            active
              ? C.primary
              : C.onSurfaceVariant
          };

        margin-top:7px;

        white-space:nowrap;
      "
    >
      ${text}
    </div>
  `

  // ==========================================================
  // PROGRESS LINE
  // ==========================================================

  const progressLine = (
    filled: boolean
  ) => `
    <td
      valign="top"
      style="
        width:25%;
        padding:0 5px;
      "
    >

      <div
        style="
          height:2px;

          margin-top:20px;

          background:
            ${
              filled
                ? C.primaryContainer
                : C.outlineVariant
            };
        "
      ></div>

    </td>
  `

  // ==========================================================
  // PROGRESS TRACKER
  // ==========================================================

  const tracker = `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width:100%;
      "
    >

      <tr>

        <!-- RECEIVED -->

        <td
          align="center"
          valign="top"
          style="
            width:16.66%;
          "
        >

          ${progressIcon(
            '↗',
            true
          )}

          ${progressLabel(
            'Received',
            true
          )}

        </td>

        ${progressLine(true)}

        <!-- ACCEPTED -->

        <td
          align="center"
          valign="top"
          style="
            width:16.66%;
          "
        >

          ${progressIcon(
            '✓',
            false
          )}

          ${progressLabel(
            'Accepted',
            false
          )}

        </td>

        ${progressLine(false)}

        <!-- COMPLETE -->

        <td
          align="center"
          valign="top"
          style="
            width:16.66%;
          "
        >

          ${progressIcon(
            '▣',
            false
          )}

          ${progressLabel(
            'Complete',
            false
          )}

        </td>

      </tr>

    </table>
  `

  // ==========================================================
  // COMPLETE EMAIL
  // ==========================================================

  return `
<!DOCTYPE html>

<html>

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="x-apple-disable-message-reformatting"
  >

  <title>
    Ticket Transfer
  </title>

  <style>

    html,
    body {
      margin:0 !important;
      padding:0 !important;

      width:100% !important;

      background:${C.background};

      -webkit-text-size-adjust:100%;
      -ms-text-size-adjust:100%;
    }

    table {
      border-spacing:0;
    }

    img {
      border:0;
      outline:none;
      text-decoration:none;
      max-width:100%;
    }

    a {
      text-decoration:none;
    }

    @media only screen and (max-width:600px) {

      .email-content {
        width:100% !important;
        max-width:100% !important;
      }

      .hero {
        padding:20px 16px 8px !important;
      }

      .hero-title {
        font-size:21px !important;
      }

      .mobile-padding {
        padding-left:16px !important;
        padding-right:16px !important;
      }

      .ticket-content {
        padding:14px !important;
      }

      .event-name {
        font-size:16px !important;
        line-height:21px !important;
      }

      .tracker-wrapper {
        padding-left:16px !important;
        padding-right:16px !important;
      }

      .cta-wrapper {
        padding-left:16px !important;
        padding-right:16px !important;
      }

      .footer {
        padding:22px 16px !important;
      }

    }

  </style>

</head>

<body>

${preheader}

<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
    width:100%;
    margin:0;
    padding:0;
    background:${C.background};
  "
>

  <tr>

    <td
      align="center"
      style="
        padding:0;
      "
    >

      <!-- ================================================= -->
      <!-- MAIN EMAIL CONTAINER -->
      <!-- ================================================= -->

      <table
        role="presentation"
        class="email-content"
        width="600"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="
          width:100%;
          max-width:600px;
          margin:0 auto;

          background:
            ${C.surfaceContainerLowest};
        "
      >

        <!-- ================================================= -->
        <!-- HEADER -->
        <!-- ================================================= -->

        <tr>

          <td
            style="
              background:#024ce0;

              padding:20px;

              text-align:center;
            "
          >

            <!-- ticketmaster WORDMARK -->

            <table
              role="presentation"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                margin:0 auto;
              "
            >

              <tr>

                <!-- ticketmaster wordmark -->

                <td
                  valign="middle"
                  style="
                    font-family:${font};

                    font-size:24px;
                    line-height:28px;

                    font-weight:700;

                    font-style:italic;

                    color:${C.onPrimary};

                    letter-spacing:-1px;

                    vertical-align:middle;
                  "
                >
                  ${
                    LOGO_URL
                      ? `<img src="${esc(LOGO_URL)}" alt="ticketmaster" height="26" style="display:block;height:26px;width:auto;border:0;outline:none;text-decoration:none;">`
                      : 'ticketmaster'
                  }
                </td>

                <!-- VERIFIED BADGE -->

                <td
                  valign="middle"
                  style="
                    padding-left:5px;

                    vertical-align:middle;
                  "
                >
                  <img
                    src="${esc(VERIFIED_BADGE_URL)}"
                    width="19"
                    height="19"
                    alt="Verified"
                    style="
                      display:block;
                      width:19px;
                      height:19px;
                      border:0;
                      outline:none;
                      text-decoration:none;
                    "
                  >
                </td>

              </tr>

            </table>

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- PROGRESS TRACKER -->
        <!-- ================================================= -->

        <tr>

          <td
            class="tracker-wrapper"
            style="
              padding:22px 28px 6px;
            "
          >

            ${tracker}

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- HERO -->
        <!-- ================================================= -->

        <tr>

          <td
            class="hero"
            style="
              padding:10px 24px 18px;

              text-align:center;
            "
          >

            <!-- SAFE TRANSFER -->

            <span
              style="
                display:inline-block;

                background:
                  ${C.secondaryFixed};

                color:
                  ${C.onSecondaryFixed};

                font-family:${font};

                font-size:11px;

                font-weight:600;

                padding:5px 12px;

                border-radius:999px;

                margin-bottom:12px;
              "
            >
              ✓ Safe Transfer Verified
            </span>

            <!-- MAIN MESSAGE -->

            <h1
              class="hero-title"
              style="
                margin:0 0 6px;

                font-family:${font};

                font-size:22px;
                line-height:1.3;

                font-weight:700;

                color:${C.onSurface};
              "
            >
              Your tickets are ready to accept
            </h1>

            <p
              style="
                margin:0;

                font-family:${font};

                font-size:14px;
                line-height:20px;

                color:
                  ${C.onSurfaceVariant};
              "
            >
              ${esc(p.senderName)}
              sent you
              ${count}
              ticket${count > 1 ? 's' : ''}
            </p>

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- TICKET CARD -->
        <!-- ================================================= -->

        <tr>

          <td
            class="mobile-padding"
            style="
              padding:16px 20px 4px;
            "
          >

            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                width:100%;

                border:
                  1px solid
                  ${C.outlineVariant};

                border-radius:16px;

                overflow:hidden;

                background:
                  ${C.surfaceContainerLowest};
              "
            >

              <!-- POSTER -->

              ${banner}

              <!-- EVENT DETAILS -->

              <tr>

                <td
                  class="ticket-content"
                  style="
                    padding:16px 16px 12px;
                  "
                >

                  <!-- EVENT NAME -->

                  <div
                    class="event-name"
                    style="
                      font-family:${font};

                      font-size:17px;
                      line-height:22px;

                      font-weight:700;

                      color:
                        ${C.onSurface};

                      word-break:break-word;
                    "
                  >
                    ${esc(p.eventName)}
                  </div>

                  <!-- DATE -->

                  <table
                    role="presentation"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      margin-top:8px;
                    "
                  >

                    <tr>

                      <td
                        style="
                          font-family:${font};

                          font-size:13px;
                          line-height:18px;

                          color:
                            ${C.onSurfaceVariant};

                          padding-right:5px;
                        "
                      >
                        📅
                      </td>

                      <td
                        style="
                          font-family:${font};

                          font-size:13px;
                          line-height:18px;

                          color:
                            ${C.onSurfaceVariant};
                        "
                      >

                        ${esc(when)}

                        ${
                          doorsTime
                            ? ` · Doors ${esc(doorsTime)}`
                            : ''
                        }

                      </td>

                    </tr>

                  </table>

                  <!-- VENUE -->

                  ${
                    p.venue
                      ? `
                  <table
                    role="presentation"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                      margin-top:4px;
                    "
                  >

                    <tr>

                      <td
                        style="
                          font-family:${font};

                          font-size:13px;
                          line-height:18px;

                          color:
                            ${C.onSurfaceVariant};

                          padding-right:5px;
                        "
                      >
                        📍
                      </td>

                      <td
                        style="
                          font-family:${font};

                          font-size:13px;
                          line-height:18px;

                          color:
                            ${C.onSurfaceVariant};

                          word-break:break-word;
                        "
                      >
                        ${esc(p.venue)}
                      </td>

                    </tr>

                  </table>
                  `
                      : ''
                  }

                </td>

              </tr>

              <!-- ================================================= -->
              <!-- SEATS -->
              <!-- ================================================= -->

              <tr>

                <td
                  style="
                    padding:12px 16px 16px;

                    border-top:
                      1px dashed
                      ${C.outlineVariant};
                  "
                >

                  <div
                    style="
                      font-family:${font};

                      font-size:13px;
                      line-height:20px;

                      font-weight:600;

                      color:
                        ${C.onSurface};
                    "
                  >
                    ${seatSummary}
                  </div>

                </td>

              </tr>

            </table>

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- MESSAGE FROM SENDER -->
        <!-- ================================================= -->

        ${
          p.note
            ? `
        <tr>

          <td
            class="mobile-padding"
            style="
              padding:16px 20px 4px;
            "
          >

            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="
                width:100%;

                background:
                  ${C.surfaceContainer};

                border-radius:14px;
              "
            >

              <tr>

                <td
                  style="
                    padding:14px 16px;
                  "
                >

                  <div
                    style="
                      font-family:${font};

                      font-size:11px;

                      font-weight:700;

                      color:${C.secondary};

                      margin-bottom:4px;

                      word-break:break-word;
                    "
                  >
                    MESSAGE FROM
                    ${esc(
                      p.senderName
                    ).toUpperCase()}
                  </div>

                  <div
                    style="
                      font-family:${font};

                      font-size:14px;
                      line-height:20px;

                      font-style:italic;

                      color:
                        ${C.onSurface};

                      word-break:break-word;
                    "
                  >
                    "${esc(p.note)}"
                  </div>

                </td>

              </tr>

            </table>

          </td>

        </tr>
        `
            : ''
        }

        <!-- ================================================= -->
        <!-- ACCEPT BUTTON -->
        <!-- ================================================= -->

        <tr>

          <td
            class="cta-wrapper"
            align="center"
            style="
              padding:20px 24px 8px;
            "
          >

            ${
              p.acceptUrl
                ? `
            <a
              href="${esc(p.acceptUrl)}"

              style="
                display:block;

                width:100%;

                box-sizing:border-box;

                background:
                  ${C.primary};

                color:
                  ${C.onPrimary};

                font-family:${font};

                font-size:15px;
                line-height:20px;

                font-weight:700;

                text-decoration:none;

                padding:16px 0;

                border-radius:14px;

                text-align:center;
              "
            >
              Accept
              ${count}
              Ticket${count > 1 ? 's' : ''}
            </a>
            `
                : `
            <p
              style="
                font-family:${font};

                font-size:13px;
                line-height:18px;

                color:
                  ${C.onSurfaceVariant};
              "
            >
              Sign in to Ticketmaster to accept your tickets.
            </p>
            `
            }

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- TRUST ROW -->
        <!-- ================================================= -->

        <tr>

          <td
            class="mobile-padding"
            style="
              padding:16px 24px 8px;

              border-top:
                1px solid
                ${C.outlineVariant};
            "
          >

            <table
              role="presentation"
              width="100%"
              cellpadding="0"
              cellspacing="0"
              border="0"
            >

              <tr>

                <!-- SECURE TRANSFER -->

                <td
                  width="50%"
                  style="
                    width:50%;

                    padding-top:16px;

                    padding-right:8px;

                    vertical-align:top;
                  "
                >

                  <div
                    style="
                      font-family:${font};

                      font-size:12px;

                      font-weight:700;

                      color:
                        ${C.onSurface};
                    "
                  >
                    🔒 Secure Transfer
                  </div>

                  <div
                    style="
                      font-family:${font};

                      font-size:11px;
                      line-height:16px;

                      color:
                        ${C.onSurfaceVariant};

                      margin-top:2px;
                    "
                  >
                    Tied to your account instantly.
                  </div>

                </td>

                <!-- FAN SUPPORT -->

                <td
                  width="50%"
                  style="
                    width:50%;

                    padding-top:16px;

                    padding-left:8px;

                    vertical-align:top;
                  "
                >

                  <div
                    style="
                      font-family:${font};

                      font-size:12px;

                      font-weight:700;

                      color:
                        ${C.onSurface};
                    "
                  >
                    🎧 Fan Support
                  </div>

                  <div
                    style="
                      font-family:${font};

                      font-size:11px;
                      line-height:16px;

                      color:
                        ${C.onSurfaceVariant};

                      margin-top:2px;
                    "
                  >
                    We're here if anything goes wrong.
                  </div>

                </td>

              </tr>

            </table>

          </td>

        </tr>

        <!-- ================================================= -->
        <!-- FOOTER -->
        <!-- ================================================= -->

        <tr>

          <td
            class="footer"
            style="
              background:
                ${C.inverseSurface};

              padding:24px 20px;

              text-align:center;
            "
          >

            <div
              style="
                font-family:${font};

                font-size:16px;

                font-weight:900;

                color:
                  ${C.inverseOnSurface};

                margin-bottom:6px;

                font-style:italic;

                letter-spacing:-1px;
              "
            >
              ticketmaster
            </div>

            <div
              style="
                font-family:${font};

                font-size:11px;

                line-height:17px;

                color:
                  ${C.secondaryFixedDim};
              "
            >

              This transfer was sent to you by
              ${esc(p.senderName)}.

              If you weren't expecting it,
              you can ignore this email.

            </div>

          </td>

        </tr>

      </table>

    </td>

  </tr>

</table>

</body>

</html>
`
}

// ============================================================
// HTML ESCAPE
// ============================================================

function esc(s: string) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c]!)
  )
}

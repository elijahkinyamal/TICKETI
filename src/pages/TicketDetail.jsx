import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase, isConfigured } from '../lib/supabase'
import { sendTransfer } from '../lib/api'

const money = (n, cur = 'USD') =>
  n == null ? null : new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n)

// Decorative barcode (display only — deterministic bars from a reference string,
// NOT a scannable/valid entry credential).
function Barcode({ value }) {
  const src = ((value || 'REFERENCE') + '').replace(/\s/g, '')
  const seq = src + src + src
  let x = 0
  const rects = []
  for (let i = 0; i < seq.length; i++) {
    const c = seq.charCodeAt(i)
    const bw = 2 + (c % 3)
    const sw = 2 + (Math.floor(c / 3) % 3)
    rects.push(<rect key={i} x={x} y="0" width={bw} height="72" fill="#111" />)
    x += bw + sw
  }
  return <svg viewBox={`0 0 ${x} 72`} width="100%" height="72" preserveAspectRatio="none">{rects}</svg>
}

export default function TicketDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [ev, setEv] = useState(null)
  const [seats, setSeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tickets')
  const [showDetails, setShowDetails] = useState(false)
  const [showBarcode, setShowBarcode] = useState(false)

  // inline transfer sheet (recipient details)
  const [transferOpen, setTransferOpen] = useState(false)
  const [tfirst, setTfirst] = useState('')
  const [tlast, setTlast] = useState('')
  const [temail, setTemail] = useState('')
  const [tnote, setTnote] = useState('')
  const [tmsg, setTmsg] = useState('')

  useEffect(() => {
    if (!isConfigured || !user) { setLoading(false); return }
    supabase.from('events').select('*, seats(*)').eq('id', id).single()
      .then(({ data }) => {
        setEv(data || null)
        setSeats(data?.seats || [])
        setLoading(false)
      })
  }, [id, user])

  if (loading) return (<><Header title="Ticket" back /><div className="center-note">Loading…</div></>)
  if (!ev) return (<><Header title="Ticket" back /><div className="center-note">Ticket not found.</div></>)

  const when = ev.starts_at
    ? new Date(ev.starts_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()
    : 'DATE TBA'
  const count = seats.length || 1
  const lat = ev.lat ?? 40.7505
  const lng = ev.lng ?? -73.9934
  const total = (Number(ev.price) || 0) + (Number(ev.fee) || 0)
  const seatSummary = seats.length
    ? `SEC ${seats[0].section || '—'}, ROW ${seats[0].seat_row || '—'}, SEAT${seats.length > 1 ? 'S' : ''} ${seats.map((s) => s.seat).filter(Boolean).join(' / ') || '—'}`
    : 'General Admission'
  const entryInfo = seats[0]?.section ? `SEC ${seats[0].section}` : 'General Admission'
  const purchased = new Date(ev.created_at)
  const purchasedStr = purchased.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    + ' • ' + purchased.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const submitTransfer = async () => {
    setTmsg('')
    if (!temail.trim()) { setTmsg('Enter a recipient email.'); return }
    const to_name = `${tfirst.trim()} ${tlast.trim()}`.trim()
    try {
      const r = await sendTransfer({ event_id: ev.id, to_email: temail.trim(), to_name, note: tnote.trim() })
      setTmsg(r.emailed ? `Sent to ${temail.trim()}.` : `Transfer created for ${temail.trim()}.`)
      setTfirst(''); setTlast(''); setTemail(''); setTnote('')
    } catch (e) { setTmsg(e.message) }
  }

  return (
    <div className="tdpage">
      <Header title="" back right={<button className="link" style={{ color: '#fff' }} onClick={() => setShowDetails(true)}>Help</button>} />

      {/* Hero */}
      <div className="tdhero" style={ev.poster_url ? { backgroundImage: `url(${ev.poster_url})` } : undefined}>
        <div className="tdhero-veil" />
        <div className="tdhero-meta">
          <div className="tdhero-date">{when}</div>
          <div className="tdhero-title">{ev.name}</div>
          <div className="tdhero-venue">
            <span>{ev.venue || 'Venue TBA'}</span>
            <span className="tdhero-count">🎟️ ×{count}</span>
          </div>
        </div>
      </div>

      <button className="viewtickets" onClick={() => setShowBarcode(true)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" /></svg>
        View Tickets
      </button>

      {/* Tabs */}
      <div className="tdtabs">
        <button className={tab === 'tickets' ? 'active' : ''} onClick={() => setTab('tickets')}>Tickets</button>
        <button className={tab === 'extras' ? 'active' : ''} onClick={() => setTab('extras')}>Extras</button>
      </div>

      <div className="view" style={{ paddingBottom: 120 }}>
        {tab === 'extras' ? (
          <div className="center-note">No extras for this event.</div>
        ) : (
          <>
            <div className="orderhead">
              <div>
                <div className="orderhead-num">Order #{ev.order_number || '—'}</div>
                <div className="orderhead-sub">×{count} Ticket{count > 1 ? 's' : ''}</div>
              </div>
              <button className="orderhead-more" onClick={() => setShowDetails(true)} aria-label="Ticket details">⋮</button>
            </div>

            {(seats.length ? seats : [null]).map((s, i) => (
              <div key={s?.id || i} className="seatcard">
                <div className="seatcard-label">{ev.sale_label || 'General Sale'}</div>
                <div className="seatcard-cols">
                  <div><span>SECTION</span><b>{s?.section || 'GA'}</b></div>
                  <div><span>ROW</span><b>{s?.seat_row || '—'}</b></div>
                  <div><span>SEAT</span><b>{s?.seat || '—'}</b></div>
                </div>
              </div>
            ))}

            {/* Venue map */}
            <div className="tdsection">MORE OPTIONS</div>
            <div className="mapwrap">
              <div className="mapname">{ev.venue?.split('—')[0]?.trim() || 'Venue'}</div>
              <iframe title="map" loading="lazy" src={`https://maps.google.com/maps?q=${lat},${lng}&z=13&output=embed`} />
            </div>
            <a className="getdirections" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener">Get Directions</a>

            {/* Seat map — only shown when the event actually has a real map image */}
            {ev.seat_map_url && (
              <>
                <div className="tdsection">SEAT MAP</div>
                <p className="tdsection-sub">Venue layout for this event.</p>
                <div className="seatmapwrap"><img src={ev.seat_map_url} alt="Seat map" /></div>
              </>
            )}
          </>
        )}
      </div>

      {/* Floating action bar */}
      <div className="floatbar">
        <button onClick={() => { setTransferOpen(true); setTmsg('') }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8" /></svg>
          Transfer
        </button>
        <span className="floatbar-div" />
        <button className="muted" onClick={() => alert('Selling is coming in a later phase.')}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /></svg>
          Sell
        </button>
      </div>

      {/* View Tickets — display-only barcode */}
      {showBarcode && (
        <div className="sheet-overlay" onClick={() => setShowBarcode(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><span>Your Ticket</span><button onClick={() => setShowBarcode(false)}>✕</button></div>
            <div className="sheet-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{ev.name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', margin: '4px 0 2px' }}>{when}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{ev.venue}</div>
              <div className="barcode-card">
                <Barcode value={ev.order_number || ev.id} />
                <div className="barcode-num">{ev.order_number || ev.id?.slice(0, 12)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{seatSummary}</div>
              <div className="notice" style={{ margin: '16px 0 0' }}>
                Order reference — <b>not a venue entry pass</b>. Entry to the event is managed by the original ticket issuer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Details modal */}
      {showDetails && (
        <div className="sheet-overlay" onClick={() => setShowDetails(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><span>Ticket Details</span><button onClick={() => setShowDetails(false)}>✕</button></div>
            <div className="sheet-body">
              <div className="dl"><dt>Seat Location</dt><dd>{seatSummary}</dd></div>
              <div className="dl">
                <dt className="dl-title">{ev.name}</dt>
                <dd>{when}{ev.venue ? ` · ${ev.venue}` : ''}</dd>
              </div>
              <div className="dl"><dt>Entry Info</dt><dd>{entryInfo}</dd></div>
              <div className="dl">
                <dt>Ticket Info</dt>
                <div className="dl-eventname">{ev.name}</div>
                <div className="ornament">· • ·</div>
                <dd>{when}</dd>
                <dd>{ev.venue || '—'}</dd>
              </div>
              <div className="dl"><dt>Order Number</dt><dd>{ev.order_number || '—'}</dd></div>
              <div className="dl"><dt>Ticket Type</dt><dd>{ev.ticket_type || 'Standard Admission'}</dd></div>
              <div className="dl"><dt>Purchase Date</dt><dd>{purchasedStr}</dd></div>
              {ev.price != null && (
                <div className="dl">
                  <dt>Ticket Price</dt>
                  <div className="pricebox">
                    <div className="pricerow"><span>{ev.ticket_type || 'Standard Admission'}</span><span>{money(ev.price, ev.currency)}</span></div>
                    {ev.fee != null && <div className="pricerow"><span>Fee</span><span>{money(ev.fee, ev.currency)}</span></div>}
                    <div className="pricerow grand"><span>GRAND TOTAL</span><span>{money(total, ev.currency)}</span></div>
                  </div>
                </div>
              )}
              <div className="terms">
                <div className="terms-title">Terms of Use</div>
                <p>These Terms of Use (“Terms”) govern your use of Live Nation and Ticketmaster’s websites and applications—including (without limitation) <a href="https://www.livenation.com" target="_blank" rel="noopener">livenation.com</a>, <a href="https://www.ticketmaster.com" target="_blank" rel="noopener">ticketmaster.com</a>, and <a href="https://www.ticketexchangebyticketmaster.com" target="_blank" rel="noopener">ticketexchangebyticketmaster.com</a>—and your purchase, possession, sale, acceptance, or use of any of our tickets, products, or services (our “Marketplace,” defined in Section 1, below).</p>
                <p>Our other policies—including our Standard Purchase Policy, Resale Purchase Policy, Travel &amp; Experiences Policy, Transfer Recipient Policy, Reseller Policy, and Privacy Policy (collectively “Other Policies”)—are also incorporated into these Terms.</p>
                <p className="terms-note">This is a demo marketplace built with Eliki Tickets. These terms are shown for layout parity and are not a binding agreement.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer sheet */}
      {transferOpen && (
        <div className="sheet-overlay" onClick={() => setTransferOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head"><span>Transfer tickets</span><button onClick={() => setTransferOpen(false)}>✕</button></div>
            <div className="sheet-body">
              <p className="eyebrow">Recipient details</p>
              <div className="row2">
                <div className="field"><label>First name</label><input className="input" value={tfirst} onChange={(e) => setTfirst(e.target.value)} placeholder="Jane" /></div>
                <div className="field"><label>Last name</label><input className="input" value={tlast} onChange={(e) => setTlast(e.target.value)} placeholder="Doe" /></div>
              </div>
              <div className="field"><label>Email</label><input className="input" type="email" value={temail} onChange={(e) => setTemail(e.target.value)} placeholder="fan@email.com" /></div>
              <div className="field"><label>Note (optional)</label><input className="input" value={tnote} onChange={(e) => setTnote(e.target.value)} placeholder="Enjoy the show!" /></div>
              <button className="btn primary" onClick={submitTransfer}>Transfer {count} Ticket{count > 1 ? 's' : ''}</button>
              {tmsg && <div className="notice">{tmsg}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

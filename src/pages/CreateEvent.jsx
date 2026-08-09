import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { searchEvents } from '../lib/api'

const pad = (n) => String(n).padStart(2, '0')

export default function CreateEvent() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { id } = useParams()          // present when editing an existing event
  const editing = Boolean(id)
  const [f, setF] = useState({ name: '', date: '', time: '', venue: '', lat: '', lng: '', price: '', fee: '', order: '', label: 'General Sale', poster_url: '', seat_map_url: '' })
  const [seats, setSeats] = useState([{ section: '', seat_row: '', seat: '' }])
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // Ticketmaster lookup
  const [lookupType, setLookupType] = useState('events')
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')

  // In edit mode, load the event + its seats and prefill the form.
  useEffect(() => {
    if (!editing || !isConfigured || !user) return
    supabase.from('events').select('*, seats(*)').eq('id', id).single().then(({ data }) => {
      if (!data) return
      let date = '', time = ''
      if (data.starts_at) {
        const dt = new Date(data.starts_at)
        date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
        time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
      }
      setF({
        name: data.name || '', date, time, venue: data.venue || '',
        lat: data.lat ?? '', lng: data.lng ?? '', price: data.price ?? '', fee: data.fee ?? '',
        order: data.order_number || '', label: data.sale_label || 'General Sale',
        poster_url: data.poster_url || '', seat_map_url: data.seat_map_url || '',
      })
      if (data.seats?.length) setSeats(data.seats.map((s) => ({ section: s.section || '', seat_row: s.seat_row || '', seat: s.seat || '' })))
    })
  }, [id, editing, user])

  const addSeat = () => setSeats([...seats, { section: '', seat_row: '', seat: '' }])
  const removeSeat = (i) => setSeats(seats.filter((_, idx) => idx !== i))
  const setSeat = (i, k) => (e) => setSeats(seats.map((s, idx) => idx === i ? { ...s, [k]: e.target.value } : s))

  const doLookup = async (e) => {
    e?.preventDefault()
    setLookupMsg('')
    if (!q.trim()) { setResults(null); return }
    if (!isConfigured || !user) { setLookupMsg('Sign in to look up on Ticketmaster.'); return }
    setSearching(true)
    try {
      const data = await searchEvents({ keyword: q.trim(), type: lookupType })
      setResults(lookupType === 'venues' ? (data.venues || []) : (data.events || []))
    } catch (err) { setLookupMsg(err.message); setResults(null) }
    finally { setSearching(false) }
  }

  // Fill the form from a chosen Ticketmaster event (everything incl. poster + seat map)
  const pickEvent = (ev) => {
    let date = '', time = ''
    if (ev.starts_at) {
      const dt = new Date(ev.starts_at)
      date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
      time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    }
    setF((prev) => ({
      ...prev,
      name: ev.name || prev.name,
      date, time,
      venue: ev.venue || prev.venue,
      lat: ev.lat ?? prev.lat,
      lng: ev.lng ?? prev.lng,
      poster_url: ev.poster_url || prev.poster_url,
      seat_map_url: ev.seat_map_url || prev.seat_map_url,
    }))
    setResults(null)
    setMsg('Details filled from Ticketmaster — add your pricing & seats below.')
  }

  // Venue lookup fills location only
  const pickVenue = (v) => {
    setF((prev) => ({ ...prev, venue: v.venue || prev.venue, lat: v.lat ?? prev.lat, lng: v.lng ?? prev.lng }))
    setResults(null)
    setMsg('Location filled from Ticketmaster.')
  }

  const save = async () => {
    setMsg('')
    if (!isConfigured || !user) { setMsg('Connect Supabase and sign in to save events (see README).'); return }
    const starts_at = f.date ? new Date(`${f.date}T${f.time || '00:00'}`).toISOString() : null
    const payload = {
      name: f.name || 'Untitled Event', starts_at, venue: f.venue,
      lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
      order_number: f.order, sale_label: f.label, price: f.price ? Number(f.price) : null,
      fee: f.fee ? Number(f.fee) : null,
      poster_url: f.poster_url || null, seat_map_url: f.seat_map_url || null,
    }
    const cleanSeats = seats.filter((s) => s.section || s.seat_row || s.seat)

    if (editing) {
      const { error } = await supabase.from('events').update(payload).eq('id', id)
      if (error) { setMsg(error.message); return }
      // Replace the seat set (simplest reliable update for 1..n seats).
      await supabase.from('seats').delete().eq('event_id', id)
      if (cleanSeats.length) await supabase.from('seats').insert(cleanSeats.map((s) => ({ ...s, event_id: id })))
      nav(`/ticket/${id}`)
    } else {
      const { data: ev, error } = await supabase.from('events').insert({ owner_id: user.id, ...payload }).select().single()
      if (error) { setMsg(error.message); return }
      if (cleanSeats.length) await supabase.from('seats').insert(cleanSeats.map((s) => ({ ...s, event_id: ev.id })))
      nav(`/ticket/${ev.id}`)
    }
  }

  return (
    <>
      <Header title={editing ? 'Edit event' : 'Create event'} back />
      <div className="view pad">
        <p className="eyebrow">Event</p>

        {/* Poster / image */}
        <div className="field">
          <label>Image</label>
          <p className="hint">Use Ticketmaster lookup below to fill a poster automatically, or paste an image URL.</p>
          {f.poster_url && <div className="poster-preview" style={{ backgroundImage: `url(${f.poster_url})` }} />}
          <input className="input" value={f.poster_url} onChange={set('poster_url')} placeholder="https://…/poster.jpg" />
        </div>

        {/* Ticketmaster lookup */}
        <div className="lookup">
          <div className="lookup-head">
            <b>Look up on Ticketmaster</b>
            <div className="seg">
              <button className={lookupType === 'events' ? 'on' : ''} onClick={() => { setLookupType('events'); setResults(null) }}>Events</button>
              <button className={lookupType === 'venues' ? 'on' : ''} onClick={() => { setLookupType('venues'); setResults(null) }}>Venues</button>
            </div>
          </div>
          <p className="hint">{lookupType === 'events' ? 'Search artist or tour — pick a show to fill name, date, venue, poster & seat map.' : 'Search a venue — fills location only.'}</p>
          <form onSubmit={doLookup}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={lookupType === 'events' ? 'Artist, tour, or event name' : 'Venue name'} />
          </form>
          {searching && <p className="hint" style={{ marginTop: 10 }}>Searching…</p>}
          {lookupMsg && <div className="notice" style={{ margin: '10px 0 0' }}>{lookupMsg}</div>}
          {results && results.length === 0 && !searching && <p className="hint" style={{ marginTop: 10 }}>No matches.</p>}
          {results && results.length > 0 && (
            <div className="lookup-results">
              {results.map((r) => (
                <button key={r.tm_id} className="lookup-item" onClick={() => lookupType === 'venues' ? pickVenue(r) : pickEvent(r)}>
                  {lookupType === 'events' && <div className="lookup-thumb" style={r.poster_url ? { backgroundImage: `url(${r.poster_url})` } : undefined} />}
                  <div className="lookup-info">
                    <b>{r.name}</b>
                    <span>{r.venue || '—'}{r.starts_at ? ` · ${new Date(r.starts_at).toLocaleDateString()}` : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="field"><label>Name</label><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Summer Night Live" /></div>
        <div className="field"><label>Date &amp; start time</label>
          <div className="row2"><input className="input" type="date" value={f.date} onChange={set('date')} /><input className="input" type="time" value={f.time} onChange={set('time')} /></div>
        </div>
        <div className="field"><label>Venue &amp; location</label><input className="input" value={f.venue} onChange={set('venue')} placeholder="e.g. Madison Square Garden — New York, NY" /></div>
        <div className="field"><div className="row2">
          <div><label>Lat</label><input className="input" value={f.lat} onChange={set('lat')} placeholder="40.7505" /></div>
          <div><label>Lng</label><input className="input" value={f.lng} onChange={set('lng')} placeholder="-73.9934" /></div>
        </div></div>
        <div className="field"><label>Seat map image URL</label>
          <p className="hint">Filled automatically from Ticketmaster lookup when a chart is available.</p>
          <input className="input" value={f.seat_map_url} onChange={set('seat_map_url')} placeholder="https://…/seatmap.png" />
        </div>

        <p className="eyebrow">Pricing &amp; order</p>
        <div className="field"><div className="row2">
          <div><label>Price</label><input className="input" value={f.price} onChange={set('price')} placeholder="560" /></div>
          <div><label>Fee</label><input className="input" value={f.fee} onChange={set('fee')} placeholder="25.60" /></div>
        </div></div>
        <div className="field"><label>Order number</label><input className="input" value={f.order} onChange={set('order')} placeholder="94-456485/TX" /></div>
        <div className="field"><label>Sale label</label>
          <select className="select" value={f.label} onChange={set('label')}>
            <option>General Sale</option><option>American Express Presale</option><option>Verified Fan Presale</option><option>VIP Package</option><option>Army Membership Presale</option>
          </select>
        </div>

        <p className="eyebrow">Seat tickets</p>
        {seats.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 13, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 10 }}>
              Ticket {i + 1}{i > 0 && <button className="link" style={{ color: 'var(--bad)' }} onClick={() => removeSeat(i)}>Remove</button>}
            </div>
            <div className="row2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <input className="input" value={s.section} onChange={setSeat(i, 'section')} placeholder="Section" />
              <input className="input" value={s.seat_row} onChange={setSeat(i, 'seat_row')} placeholder="Row" />
              <input className="input" value={s.seat} onChange={setSeat(i, 'seat')} placeholder="Seat" />
            </div>
          </div>
        ))}
        <button className="btn ghost" onClick={addSeat} style={{ marginBottom: 16 }}>+ Add ticket</button>

        <button className="btn primary" onClick={save}>{editing ? 'Save changes' : 'Create event'}</button>
        {msg && <div className="notice">{msg}</div>}
      </div>
    </>
  )
}

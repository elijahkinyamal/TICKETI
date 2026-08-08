import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function CreateEvent() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ name: '', date: '', time: '', venue: '', lat: '', lng: '', price: '', fee: '', order: '', label: 'General Sale' })
  const [seats, setSeats] = useState([{ section: '', seat_row: '', seat: '' }])
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const addSeat = () => setSeats([...seats, { section: '', seat_row: '', seat: '' }])
  const removeSeat = (i) => setSeats(seats.filter((_, idx) => idx !== i))
  const setSeat = (i, k) => (e) => setSeats(seats.map((s, idx) => idx === i ? { ...s, [k]: e.target.value } : s))

  const create = async () => {
    setMsg('')
    if (!isConfigured || !user) { setMsg('Connect Supabase and sign in to create real events (see README).'); return }
    const starts_at = f.date ? new Date(`${f.date}T${f.time || '00:00'}`).toISOString() : null
    const { data: ev, error } = await supabase.from('events').insert({
      owner_id: user.id, name: f.name || 'Untitled Event', starts_at, venue: f.venue,
      lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
      order_number: f.order, sale_label: f.label, price: f.price ? Number(f.price) : null,
      fee: f.fee ? Number(f.fee) : null,
    }).select().single()
    if (error) { setMsg(error.message); return }
    const rows = seats.filter((s) => s.section || s.seat_row || s.seat).map((s) => ({ ...s, event_id: ev.id }))
    if (rows.length) await supabase.from('seats').insert(rows)
    nav('/tickets')
  }

  return (
    <>
      <Header title="Create event" back />
      <div className="view pad">
        <p className="eyebrow">Event</p>
        <div className="field"><label>Name</label><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Summer Night Live" /></div>
        <div className="field"><label>Date &amp; start time</label>
          <div className="row2"><input className="input" type="date" value={f.date} onChange={set('date')} /><input className="input" type="time" value={f.time} onChange={set('time')} /></div>
        </div>
        <div className="field"><label>Venue &amp; location</label><input className="input" value={f.venue} onChange={set('venue')} placeholder="e.g. Madison Square Garden — New York, NY" /></div>
        <div className="field"><div className="row2">
          <div><label>Lat</label><input className="input" value={f.lat} onChange={set('lat')} placeholder="40.7505" /></div>
          <div><label>Lng</label><input className="input" value={f.lng} onChange={set('lng')} placeholder="-73.9934" /></div>
        </div></div>

        <p className="eyebrow">Pricing &amp; order</p>
        <div className="field"><div className="row2">
          <div><label>Price</label><input className="input" value={f.price} onChange={set('price')} placeholder="560" /></div>
          <div><label>Fee</label><input className="input" value={f.fee} onChange={set('fee')} placeholder="25.60" /></div>
        </div></div>
        <div className="field"><label>Order number</label><input className="input" value={f.order} onChange={set('order')} placeholder="94-456485/TX" /></div>
        <div className="field"><label>Sale label</label>
          <select className="select" value={f.label} onChange={set('label')}>
            <option>General Sale</option><option>Army Membership Presale</option><option>Verified Fan Presale</option><option>VIP Package</option>
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

        <button className="btn primary" onClick={create}>Create event</button>
        {msg && <div className="notice">{msg}</div>}
      </div>
    </>
  )
}

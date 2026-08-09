import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sendTransfer } from '../lib/api'

const TITLES = { live: 'Tickets I\'m selling', sold: 'Sold tickets', expired: 'Expired tickets' }

export default function ManageEvents() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const status = params.get('status') // live | sold | expired | null (all)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // inline transfer form state (which event is open + its fields)
  const [transferFor, setTransferFor] = useState(null)
  const [temail, setTemail] = useState('')
  const [tnote, setTnote] = useState('')
  const [tmsg, setTmsg] = useState('')

  const load = () => {
    if (!isConfigured || !user) { setLoading(false); return }
    setLoading(true)
    let q = supabase.from('events').select('*').eq('owner_id', user.id)
    if (status) q = q.eq('status', status)
    q.order('created_at', { ascending: false })
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }
  useEffect(load, [user, status])

  const del = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(events.filter((e) => e.id !== id))
  }

  const openTransfer = (id) => {
    setTransferFor(transferFor === id ? null : id)
    setTemail(''); setTnote(''); setTmsg('')
  }

  const submitTransfer = async (event_id) => {
    setTmsg('')
    if (!temail.trim()) { setTmsg('Enter a recipient email.'); return }
    try {
      const r = await sendTransfer({ event_id, to_email: temail.trim(), note: tnote.trim() })
      setTmsg(r.emailed ? `Sent to ${temail.trim()}.` : `Transfer created for ${temail.trim()} (email not configured — they can still accept in-app).`)
      setTemail(''); setTnote('')
    } catch (e) { setTmsg(e.message) }
  }

  return (
    <>
      <Header title={TITLES[status] || 'Manage events'} back />
      <div className="view pad">
        <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>Create, edit, transfer, or remove events you host. Changes apply to your public pages and ticket views.</p>
        {!isConfigured && <div className="notice">Connect Supabase (see README) to manage real events.</div>}
        {isConfigured && user && loading && <div className="center-note">Loading…</div>}
        {isConfigured && user && !loading && events.length === 0 && <div className="center-note">No events yet.</div>}
        {events.map((e) => (
          <div key={e.id} style={{ border: '1px solid var(--line)', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ padding: 12 }}>
              <b style={{ fontSize: 14 }}>{e.name}</b>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{e.starts_at ? new Date(e.starts_at).toLocaleString() : 'Date TBA'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.venue}</div>
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid var(--line)' }}>
              <button className="link" style={{ flex: 1, padding: 12 }} onClick={() => nav(`/admin/edit/${e.id}`)}>Edit</button>
              <button className="link" style={{ flex: 1, padding: 12, borderLeft: '1px solid var(--line)' }} onClick={() => openTransfer(e.id)}>Transfer</button>
              <button className="link" style={{ flex: 1, padding: 12, borderLeft: '1px solid var(--line)', color: 'var(--bad)' }} onClick={() => del(e.id)}>Delete</button>
            </div>
            {transferFor === e.id && (
              <div style={{ padding: 12, borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Recipient email</label>
                  <input className="input" type="email" value={temail} onChange={(ev) => setTemail(ev.target.value)} placeholder="fan@email.com" />
                </div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Note (optional)</label>
                  <input className="input" value={tnote} onChange={(ev) => setTnote(ev.target.value)} placeholder="Enjoy the show!" />
                </div>
                <button className="btn primary" onClick={() => submitTransfer(e.id)}>Send transfer</button>
                {tmsg && <div className="notice" style={{ margin: '12px 0 0' }}>{tmsg}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

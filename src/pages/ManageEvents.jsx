import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ManageEvents() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!isConfigured || !user) { setLoading(false); return }
    supabase.from('events').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }
  useEffect(load, [user])

  const del = async (id) => {
    await supabase.from('events').delete().eq('id', id)
    setEvents(events.filter((e) => e.id !== id))
  }

  return (
    <>
      <Header title="Manage events" back />
      <div className="view pad">
        <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>Create, edit, or remove events you host. Changes apply to your public pages and ticket views.</p>
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
              <button className="link" style={{ flex: 1, padding: 12 }} onClick={() => nav('/admin/create')}>Edit</button>
              <button className="link" style={{ flex: 1, padding: 12, borderLeft: '1px solid var(--line)', color: 'var(--bad)' }} onClick={() => del(e.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

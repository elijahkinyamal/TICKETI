import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase, isConfigured } from '../lib/supabase'
import { acceptTransfer } from '../lib/api'

export default function MyTickets() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [events, setEvents] = useState([])
  const [incoming, setIncoming] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState('upcoming')

  const load = () => {
    if (!isConfigured || !user) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      supabase.from('events').select('*, seats(count)').eq('owner_id', user.id)
        .order('created_at', { ascending: false }),
      // transfers addressed to me and still pending (RLS also scopes by my email)
      supabase.from('transfers').select('*, events(name, starts_at)')
        .eq('to_email', user.email).eq('status', 'pending'),
    ]).then(([ev, tr]) => {
      setEvents(ev.data || [])
      setIncoming(tr.data || [])
      setLoading(false)
    })
  }
  useEffect(load, [user])

  const accept = async (id) => {
    setMsg('')
    try {
      await acceptTransfer(id)
      load()
    } catch (e) { setMsg(e.message) }
  }

  const now = Date.now()
  const isPast = (e) => e.starts_at && new Date(e.starts_at).getTime() < now
  const upcoming = events.filter((e) => !isPast(e))
  const past = events.filter(isPast)
  const shown = tab === 'upcoming' ? upcoming : past

  return (
    <>
      <Header title="My Tickets" />
      <div className="tdtabs">
        <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button className={tab === 'past' ? 'active' : ''} onClick={() => setTab('past')}>Past ({past.length})</button>
      </div>
      <div className="view">
        {!isConfigured && <div className="notice">Connect Supabase (see README) to load your tickets.</div>}
        {isConfigured && !user && (
          <div className="center-note">
            Sign in to see your tickets.<br /><br />
            <button className="link" onClick={() => nav('/signin')}>Sign in</button>
          </div>
        )}
        {isConfigured && user && loading && <div className="center-note">Loading…</div>}

        {incoming.length > 0 && (
          <>
            <div className="pad" style={{ paddingBottom: 0 }}><p className="eyebrow">Incoming transfers</p></div>
            {incoming.map((t) => (
              <div key={t.id} className="tkcard" style={{ background: 'var(--accent)' }}>
                <div className="body">
                  <div className="d">Transfer · pending</div>
                  <div className="t">{t.events?.name || 'Event'}</div>
                  <div className="v">{t.events?.starts_at ? new Date(t.events.starts_at).toLocaleString() : 'Date TBA'}</div>
                  <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => accept(t.id)}>Accept tickets</button>
                </div>
              </div>
            ))}
            {msg && <div className="notice">{msg}</div>}
          </>
        )}

        {isConfigured && user && !loading && shown.length === 0 && incoming.length === 0 && (
          <div className="emptystate">
            <div className="emptystate-icon">🎟️</div>
            <div className="emptystate-title">{tab === 'upcoming' ? 'No upcoming events' : 'No past events'}</div>
            <p>{tab === 'upcoming' ? 'Tickets you create or receive will appear here.' : 'Events you\'ve attended will appear here after they end.'}</p>
            <button className="btn ghost" style={{ maxWidth: 220, margin: '18px auto 0' }} onClick={load}>Refresh</button>
          </div>
        )}
        {shown.map((e) => {
          const count = e.seats?.[0]?.count ?? 0
          const when = e.starts_at
            ? new Date(e.starts_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()
            : 'DATE TBA'
          return (
            <div key={e.id} className="tkcard" onClick={() => nav(`/ticket/${e.id}`)}>
              <div className="art" style={e.poster_url ? { background: `url(${e.poster_url}) center/cover` } : undefined} />
              <div className="body">
                <div className="d">{when}</div>
                <div className="t">{e.name}</div>
                <div className="v">{e.venue} · ×{count}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase, isConfigured } from '../lib/supabase'

export default function MyTickets() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured || !user) { setLoading(false); return }
    supabase.from('events').select('*, seats(count)').eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
  }, [user])

  return (
    <>
      <Header title="My Tickets" />
      <div className="view">
        {!isConfigured && <div className="notice">Connect Supabase (see README) to load your tickets.</div>}
        {isConfigured && !user && (
          <div className="center-note">
            Sign in to see your tickets.<br /><br />
            <button className="link" onClick={() => nav('/signin')}>Sign in</button>
          </div>
        )}
        {isConfigured && user && loading && <div className="center-note">Loading…</div>}
        {isConfigured && user && !loading && events.length === 0 && (
          <div className="center-note">No tickets yet. Create an event from the Sell tab.</div>
        )}
        {events.map((e) => {
          const count = e.seats?.[0]?.count ?? 0
          const when = e.starts_at ? new Date(e.starts_at).toLocaleString() : 'Date TBA'
          return (
            <div key={e.id} className="tkcard" onClick={() => nav('/admin/manage')}>
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

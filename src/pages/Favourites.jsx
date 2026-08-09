import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase, isConfigured } from '../lib/supabase'

export default function Favourites() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    if (!isConfigured || !user) { setLoading(false); return }
    setLoading(true)
    supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }
  useEffect(load, [user])

  const remove = async (id) => {
    await supabase.from('favorites').delete().eq('id', id)
    setItems(items.filter((i) => i.id !== id))
  }

  return (
    <>
      <Header title="My Favourites" back />
      <div className="view">
        {isConfigured && user && loading && <div className="center-note">Loading…</div>}
        {isConfigured && user && !loading && items.length === 0 && (
          <div className="emptystate">
            <div className="emptystate-icon">♥</div>
            <div className="emptystate-title">No favourites yet</div>
            <p>Tap the heart on any event in Discover to save it here.</p>
            <button className="btn ghost" style={{ maxWidth: 220, margin: '18px auto 0' }} onClick={() => nav('/')}>Browse events</button>
          </div>
        )}
        {items.map((ev) => (
          <div key={ev.id} className="tkcard" onClick={() => ev.url && window.open(ev.url, '_blank', 'noopener')}>
            <button className="fav-btn" onClick={(e) => { e.stopPropagation(); remove(ev.id) }} aria-label="Remove">
              <svg viewBox="0 0 24 24" className="faved"><path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6C19 16.5 12 21 12 21Z" /></svg>
            </button>
            <div className="art" style={ev.poster_url ? { background: `url(${ev.poster_url}) center/cover` } : undefined} />
            <div className="body">
              <div className="d">{ev.starts_at ? new Date(ev.starts_at).toLocaleString() : 'Date TBA'}</div>
              <div className="t">{ev.name}</div>
              <div className="v">{ev.venue || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

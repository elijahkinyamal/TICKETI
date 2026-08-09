import { useEffect, useState } from 'react'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { searchEvents } from '../lib/api'
import { supabase } from '../lib/supabase'

const shortDate = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const city = (venue) => (venue ? venue.split(',').slice(-2).join(',').trim() : '')

const CATS = [
  { key: 'music', label: '🎵 Music', cn: 'Music' },
  { key: 'sports', label: '🏈 Sports', cn: 'Sports' },
  { key: 'arts', label: '🎭 Arts & Theatre', cn: 'Arts & Theatre' },
]

// Keep only the first event per artist/name so a tour's many dates don't repeat.
const dedupe = (arr) => {
  const seen = new Set(); const out = []
  for (const e of arr || []) {
    const k = (e.name || '').toLowerCase().trim()
    if (!k || seen.has(k)) continue
    seen.add(k); out.push(e)
  }
  return out
}

// Module-level so they keep a stable identity across renders (no card remount/flicker on state change).
function Heart({ faved, onClick }) {
  return (
    <button className="fav-btn" onClick={onClick} aria-label="Save to favourites">
      <svg viewBox="0 0 24 24" className={faved ? 'faved' : ''}><path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6C19 16.5 12 21 12 21Z" /></svg>
    </button>
  )
}

function CardRow({ title, events, favs, onToggle, onOpen }) {
  if (!events?.length) return null
  return (
    <>
      <div className="section-title">{title}</div>
      <div className="hrow">
        {events.map((ev) => (
          <div key={ev.tm_id} className="hcard" onClick={() => onOpen(ev)}>
            <div className="hcard-art" style={ev.poster_url ? { backgroundImage: `url(${ev.poster_url})` } : undefined}>
              <Heart faved={favs.has(ev.tm_id)} onClick={(e) => { e.stopPropagation(); onToggle(ev) }} />
            </div>
            <div className="hcard-name">{ev.name}</div>
            <div className="hcard-sub">{shortDate(ev.starts_at)}{ev.venue ? ` · ${city(ev.venue)}` : ''}</div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Discover() {
  const { isConfigured, user } = useAuth()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [sections, setSections] = useState(null)   // { trending, music, sports, arts }
  const [feedLoading, setFeedLoading] = useState(false)
  const [loc, setLoc] = useState('')
  const [feedCity, setFeedCity] = useState('')
  const [favs, setFavs] = useState(new Set())
  const [recent, setRecent] = useState([])

  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem('recentlyViewed') || '[]')) } catch { setRecent([]) }
  }, [])

  // Pull trending + each category in parallel for real variety.
  useEffect(() => {
    if (!isConfigured || !user) return
    setFeedLoading(true)
    const base = { size: 18, countryCode: 'US', city: feedCity || undefined }
    // allSettled: one failed category (e.g. a transient TM error) must not wipe the whole feed.
    const evOf = (r) => (r.status === 'fulfilled' ? (r.value.events || []) : [])
    Promise.allSettled([
      searchEvents({ ...base, sort: 'relevance,desc' }),
      ...CATS.map((c) => searchEvents({ ...base, classificationName: c.cn, sort: 'date,asc' })),
    ]).then(([tr, ...cats]) => {
      setSections({
        trending: dedupe(evOf(tr)),
        music: dedupe(evOf(cats[0])),
        sports: dedupe(evOf(cats[1])),
        arts: dedupe(evOf(cats[2])),
      })
    }).finally(() => setFeedLoading(false))
  }, [user, isConfigured, feedCity])

  useEffect(() => {
    if (!isConfigured || !user) { setFavs(new Set()); return }
    supabase.from('favorites').select('tm_id').eq('user_id', user.id)
      .then(({ data }) => setFavs(new Set((data || []).map((r) => r.tm_id))))
  }, [user, isConfigured])

  const toggleFav = async (ev) => {
    if (!user) return
    if (favs.has(ev.tm_id)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('tm_id', ev.tm_id)
      setFavs((p) => { const n = new Set(p); n.delete(ev.tm_id); return n })
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, tm_id: ev.tm_id, name: ev.name, poster_url: ev.poster_url, venue: ev.venue, starts_at: ev.starts_at, url: ev.url })
      setFavs((p) => new Set(p).add(ev.tm_id))
    }
  }

  const open = (ev) => {
    setRecent((prev) => {
      const next = [ev, ...prev.filter((e) => e.tm_id !== ev.tm_id)].slice(0, 10)
      try { localStorage.setItem('recentlyViewed', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    if (ev.url) window.open(ev.url, '_blank', 'noopener')
  }
  const removeRecent = (id) => setRecent((prev) => {
    const n = prev.filter((e) => e.tm_id !== id)
    try { localStorage.setItem('recentlyViewed', JSON.stringify(n)) } catch { /* ignore */ }
    return n
  })

  const search = async (e) => {
    e?.preventDefault()
    setMsg('')
    const keyword = q.trim()
    if (!keyword) { setResults(null); return }
    if (!user) { setMsg('Sign in to search live events.'); return }
    setLoading(true)
    try { const { events } = await searchEvents({ keyword }); setResults(dedupe(events)) }
    catch (err) { setMsg(err.message); setResults(null) }
    finally { setLoading(false) }
  }
  const applyLocation = (e) => { e.preventDefault(); setFeedCity(loc.trim()) }

  const s = sections
  const hero = s?.trending?.[0]
  const trending = s?.trending?.slice(1) || []

  return (
    <>
      <Header wordmark />
      <div className="view">
        {!isConfigured && (
          <div className="notice">Not connected to Supabase yet. Add your project keys to <b>.env</b> to load real data. See README.md.</div>
        )}

        <div className="filterbar">
          <form className="filtercol" onSubmit={applyLocation}>
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>
            <span className="filtercol-body">
              <span className="filtercol-lbl">LOCATION</span>
              <input className="filtercol-input" placeholder="City or Zip Code" value={loc} onChange={(e) => setLoc(e.target.value)} />
            </span>
          </form>
          <div className="filtercol-div" />
          <div className="filtercol">
            <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
            <span className="filtercol-body"><span className="filtercol-lbl">DATES</span><span className="filtercol-val">All Dates</span></span>
            <span className="filtercol-chev">⌄</span>
          </div>
        </div>

        <form className="pad" style={{ paddingBottom: 10 }} onSubmit={search}>
          <div className="searchbox">
            <input className="input" type="search" placeholder="Artist, Event or Venue" value={q} onChange={(e) => setQ(e.target.value)} />
            <svg viewBox="0 0 24 24" onClick={search}><circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" /></svg>
          </div>
        </form>

        {loading && <div className="center-note">Searching…</div>}
        {msg && <div className="notice">{msg}</div>}

        {results !== null ? (
          results.length === 0 && !loading
            ? <div className="center-note">No events found for “{q}”.</div>
            : results.map((ev) => (
                <div key={ev.tm_id} className="tkcard" onClick={() => open(ev)}>
                  <Heart faved={favs.has(ev.tm_id)} onClick={(e) => { e.stopPropagation(); toggleFav(ev) }} />
                  <div className="art" style={ev.poster_url ? { background: `url(${ev.poster_url}) center/cover` } : undefined} />
                  <div className="body">
                    <div className="d">{ev.starts_at ? new Date(ev.starts_at).toLocaleString() : 'Date TBA'}</div>
                    <div className="t">{ev.name}</div>
                    <div className="v">{ev.venue || '—'}{ev.price_min != null && ` · from ${ev.currency || ''} ${ev.price_min}`}</div>
                  </div>
                </div>
              ))
        ) : (
          <>
            {isConfigured && user && feedLoading && !s && <div className="center-note">Loading events…</div>}

            {hero && (
              <div className="ehero" style={hero.poster_url ? { backgroundImage: `url(${hero.poster_url})` } : undefined} onClick={() => open(hero)}>
                <Heart faved={favs.has(hero.tm_id)} onClick={(e) => { e.stopPropagation(); toggleFav(hero) }} />
                <div className="veil" />
                <div className="cap">
                  <div className="ehero-sub">Featured{hero.venue ? ` · ${city(hero.venue)}` : ''}</div>
                  <div className="ehero-title">{hero.name}</div>
                  <button className="b">Find Tickets</button>
                </div>
              </div>
            )}

            {recent.length > 0 && (
              <>
                <div className="section-title">Recently viewed</div>
                <div className="recent-row">
                  {recent.map((ev) => (
                    <div key={ev.tm_id} className="recent-pill" onClick={() => open(ev)}>
                      <span className="recent-x" onClick={(e) => { e.stopPropagation(); removeRecent(ev.tm_id) }}>×</span>
                      <span className="recent-av" style={ev.poster_url ? { backgroundImage: `url(${ev.poster_url})` } : undefined} />
                      <span className="recent-name">{ev.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <CardRow title="🔥 Trending now" events={trending} favs={favs} onToggle={toggleFav} onOpen={open} />
            <CardRow title="🎵 Music" events={s?.music} favs={favs} onToggle={toggleFav} onOpen={open} />
            <CardRow title="🏈 Sports" events={s?.sports} favs={favs} onToggle={toggleFav} onOpen={open} />
            <CardRow title="🎭 Arts & Theatre" events={s?.arts} favs={favs} onToggle={toggleFav} onOpen={open} />

            {!user && <div className="notice">Sign in to see live events from across the United States.</div>}
            {s && !hero && <div className="notice">No live events for that location — try another city or clear it.</div>}
          </>
        )}
      </div>
    </>
  )
}

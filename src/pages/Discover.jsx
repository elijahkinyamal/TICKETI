import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'

const featured = [
  { name: "BTS WORLD TOUR 'ARIRANG'", sub: 'World Tour · Apr 25 · Tampa' },
  { name: 'Coldplay: Music of the Spheres', sub: 'Stadium Tour · Jun 12' },
  { name: 'Johnny Blue Skies', sub: 'Live on Tour' },
]

export default function Discover() {
  const { isConfigured } = useAuth()
  return (
    <>
      <Header wordmark />
      <div className="view">
        {!isConfigured && (
          <div className="notice">Not connected to Supabase yet. Add your project keys to <b>.env</b> to load real data. See README.md.</div>
        )}
        <div className="pad" style={{ paddingBottom: 4 }}>
          <p className="eyebrow">Featured</p>
        </div>
        {featured.map((e) => (
          <div key={e.name} className="hero">
            <div className="veil" />
            <div className="cap">
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', opacity: .85, marginBottom: 6 }}>{e.sub}</div>
              <div className="t">{e.name}</div>
              <button className="b">Find Tickets</button>
            </div>
          </div>
        ))}
        <div className="notice">Live search &amp; the full catalog come from the Ticketmaster Discovery API — wired in a later phase.</div>
      </div>
    </>
  )
}

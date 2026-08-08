import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

export default function Sell() {
  const nav = useNavigate()
  return (
    <>
      <Header title="Sell" />
      <div className="view">
        <div style={{ background: 'var(--chrome)', color: '#fff', padding: '26px 20px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>SELL TICKETS FROM ANY SITE</h2>
          <p style={{ margin: 0, color: '#9aa7bc', fontSize: 14 }}>Reach fans even if you didn't buy on Ticketmaster.</p>
        </div>
        <div className="pad">
          <button className="btn primary" onClick={() => nav('/admin/create')}>Sell your tickets</button>
        </div>
        <div className="pad" style={{ paddingTop: 0 }}>
          <button className="btn ghost" onClick={() => nav('/admin/manage')}>Tickets I'm selling</button>
        </div>
      </div>
    </>
  )
}

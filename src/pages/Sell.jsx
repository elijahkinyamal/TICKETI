import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'

function Row({ icon, label, onClick }) {
  return (
    <button className="sell-row" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{icon}</svg>
      <span className="sell-row-label">{label}</span>
      <span className="sell-row-chev">›</span>
    </button>
  )
}

export default function Sell() {
  const nav = useNavigate()
  return (
    <>
      <Header title="Sell" />
      <div className="view">
        <div className="sell-hero">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="46" height="46">
            <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" />
            <path d="M15 6v12" strokeDasharray="1.5 2.5" />
          </svg>
          <h2>SELL TICKETS FROM ANY SITE</h2>
          <p>Reach fans even if you didn't buy them here.</p>
        </div>

        <div className="pad">
          <button className="btn primary" onClick={() => nav('/admin/create')}>Sell Your Tickets</button>
        </div>

        <div className="sell-list">
          <Row label="Tickets I'm Selling" onClick={() => nav('/admin/manage?status=live')}
            icon={<><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4Z" /></>} />
          <Row label="Sold Tickets" onClick={() => nav('/admin/manage?status=sold')}
            icon={<><path d="M20 6 9 17l-5-5" /></>} />
          <Row label="Expired Tickets" onClick={() => nav('/admin/manage?status=expired')}
            icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
        </div>
      </div>
    </>
  )
}

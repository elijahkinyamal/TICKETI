import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'

function Row({ label, value, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line)', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ flex: 1, fontSize: 15 }}>{label}</span>
      {value && <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{value}</span>}
    </div>
  )
}

export default function Account() {
  const { user, displayName, signOut, isConfigured } = useAuth()
  const nav = useNavigate()
  return (
    <>
      <Header title="My Account" />
      <div className="view">
        <div style={{ background: 'var(--navbar)', color: '#fff', padding: '20px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>{displayName}</h2>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,.82)', fontSize: 14 }}>{user?.email || 'Not signed in'}</p>
        </div>
        <div style={{ padding: '18px 16px 6px', fontWeight: 800, fontSize: 13 }}>Preferences</div>
        <Row label="My favourites" onClick={() => {}} />
        <Row label="My location" value="Texas, TX" />
        <div style={{ padding: '18px 16px 6px', fontWeight: 800, fontSize: 13 }}>Seller tools</div>
        <Row label="Manage my events & listings" onClick={() => nav('/admin')} />
        <div className="pad" style={{ paddingTop: 20 }}>
          {user
            ? <button className="btn ghost" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
            : <button className="btn primary" onClick={() => nav('/signin')} disabled={!isConfigured}>Sign in</button>}
        </div>
      </div>
    </>
  )
}

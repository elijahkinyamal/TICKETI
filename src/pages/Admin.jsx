import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'

function Card({ title, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 15px', cursor: 'pointer' }}>
      <h4 style={{ margin: '0 0 3px', fontSize: 15 }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>{sub}</p>
    </div>
  )
}

export default function Admin() {
  const { user, profile, signOut, isConfigured } = useAuth()
  const nav = useNavigate()
  const isAdmin = profile && ['owner', 'admin'].includes(profile.role)
  return (
    <>
      <Header title="Manage Tickets" back />
      <div className="view">
        <div className="pad">
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>Signed in</div>
          <div style={{ fontSize: 20, fontWeight: 800, margin: '5px 0 6px' }}>{user?.email || (isConfigured ? '—' : 'demo (not connected)')}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Choose an action. Changes sync to your public pages and ticket details.</div>
        </div>
        <div className="pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, paddingTop: 0 }}>
          <Card title="Create event" sub="Date, venue, tickets, pricing" onClick={() => nav('/admin/create')} />
          <Card title="Manage events" sub="Edit, view, or delete" onClick={() => nav('/admin/manage')} />
          <Card title="Profile & location" sub="Name, email, city, country" onClick={() => nav('/profile')} />
          {isAdmin && <Card title="Create staff login" sub="30-day access for your team" onClick={() => nav('/admin/staff')} />}
        </div>
        <div className="pad">
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 6 }}>Developer contact</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>Telegram <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@elikitecch</span></p>
        </div>
        {user && <div className="pad" style={{ paddingTop: 0 }}><button className="btn ghost" onClick={async () => { await signOut(); nav('/') }}>Sign out</button></div>}
      </div>
    </>
  )
}

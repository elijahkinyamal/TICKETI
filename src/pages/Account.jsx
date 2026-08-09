import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const I = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  pin: <><path d="M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11Z" /><circle cx="12" cy="10" r="2.4" /></>,
  flag: <><path d="M4 21V4M4 5h13l-2 4 2 4H4" /></>,
  send: <><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></>,
  heart: <><path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6C19 16.5 12 21 12 21Z" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1 .9-1 1.6" /><circle cx="12" cy="16.4" r=".5" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
}

function Row({ icon, label, value, onClick, right }) {
  return (
    <button className="acct-row" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <svg viewBox="0 0 24 24">{icon}</svg>
      <span className="acct-row-label">{label}</span>
      {value && <span className="acct-row-value">{value}</span>}
      {right}
      {onClick && !right && <span className="acct-row-chev">›</span>}
    </button>
  )
}

function Toggle({ on, onToggle }) {
  return <span className={'toggle' + (on ? ' on' : '')} onClick={(e) => { e.stopPropagation(); onToggle() }} role="switch" aria-checked={on} />
}

export default function Account() {
  const { user, profile, displayName, signOut, isConfigured: cfg, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [toast, setToast] = useState('')

  const soon = () => { setToast('Coming soon'); setTimeout(() => setToast(''), 1400) }

  const setPref = async (key, val) => {
    if (!cfg || !user) return
    await supabase.from('profiles').update({ [key]: val }).eq('id', user.id)
    await refreshProfile?.()
  }

  return (
    <>
      <Header title="My Account" />
      <div className="view">
        <div className="acct-head">
          <h2>{displayName}</h2>
          <p>{user?.email || 'Not signed in'}</p>
        </div>

        <div className="acct-section">Notifications</div>
        <Row icon={I.mail} label="My Notifications" onClick={soon} />
        <Row icon={I.bell} label="Receive Notifications?" right={<Toggle on={profile?.notify ?? true} onToggle={() => setPref('notify', !(profile?.notify ?? true))} />} />

        <div className="acct-section">Location Settings</div>
        <Row icon={I.pin} label="My Location" value={profile?.city || 'Set location'} onClick={() => nav('/profile')} />
        <Row icon={I.flag} label="My Country" value={profile?.country || 'United States'} onClick={() => nav('/profile')} />
        <Row icon={I.send} label="Location Based Content" right={<Toggle on={profile?.location_based ?? false} onToggle={() => setPref('location_based', !(profile?.location_based ?? false))} />} />

        <div className="acct-section">Preferences</div>
        <Row icon={I.heart} label="My Favourites" onClick={() => nav('/favourites')} />
        <Row icon={I.wallet} label="Saved Payment Methods" onClick={soon} />

        <div className="acct-section">Help &amp; Guidance</div>
        <Row icon={I.help} label="Need Help?" onClick={soon} />
        <Row icon={I.pencil} label="Give Us Feedback" onClick={soon} />

        <div className="pad" style={{ paddingTop: 20 }}>
          {user
            ? <button className="btn ghost" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
            : <button className="btn primary" onClick={() => nav('/signin')} disabled={!cfg}>Sign in</button>}
        </div>

        {toast && <div className="acct-toast">{toast}</div>}
      </div>
    </>
  )
}

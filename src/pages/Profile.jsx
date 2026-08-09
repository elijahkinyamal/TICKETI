import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { supabase, isConfigured } from '../lib/supabase'

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Kenya', 'Nigeria', 'South Africa', 'Australia', 'Other']

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: '', contact_email: '', city: '', country: 'United States' })
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => {
    if (!profile && !user) return
    setF({
      full_name: profile?.full_name || user?.user_metadata?.full_name || '',
      contact_email: profile?.contact_email || user?.email || '',
      city: profile?.city || '',
      country: profile?.country || 'United States',
    })
  }, [profile, user])

  const save = async () => {
    setMsg('')
    if (!isConfigured || !user) { setMsg('Sign in to edit your profile.'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ full_name: f.full_name, contact_email: f.contact_email, city: f.city, country: f.country })
      .eq('id', user.id)
    if (error) { setMsg(error.message); setSaving(false); return }
    await supabase.auth.updateUser({ data: { full_name: f.full_name } })
    await refreshProfile?.()
    setSaving(false)
    nav('/account')
  }

  return (
    <>
      <Header title="Profile & location" back />
      <div className="view pad">
        <p className="hint" style={{ marginTop: 0 }}>
          Edit what appears on My Account. Updating your name or email here doesn’t change your login credentials.
        </p>

        <p className="eyebrow">Profile</p>
        <div className="field"><label>Display name</label>
          <input className="input" value={f.full_name} onChange={set('full_name')} placeholder="Your name" />
        </div>
        <div className="field"><label>Email</label>
          <input className="input" type="email" value={f.contact_email} onChange={set('contact_email')} placeholder="you@email.com" />
        </div>

        <p className="eyebrow">Location</p>
        <div className="field"><label>City / State</label>
          <input className="input" value={f.city} onChange={set('city')} placeholder="e.g. Austin, TX" />
        </div>
        <div className="field"><label>Country</label>
          <select className="select" value={f.country} onChange={set('country')}>
            {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        {msg && <div className="notice">{msg}</div>}
      </div>
    </>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'

export default function SignIn() {
  const { signIn, signUp, isConfigured, notice, clearNotice } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    setMsg(''); clearNotice()
    try {
      if (mode === 'signup') { await signUp(email, pass, name); setMsg('Account created — check your email to confirm, then sign in.') }
      else { await signIn(email, pass); nav('/admin') }
    } catch (e) { setMsg(e.message) }
  }

  return (
    <>
      <Header title={mode === 'signup' ? 'Create account' : 'Sign in'} back />
      <div className="view">
        <div className="pad" style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
              <path style={{ fill: '#fff' }} d="M5 13c0-1.7 1.3-3 3-3h24c1.7 0 3 1.3 3 3v3.2a3.8 3.8 0 0 0 0 7.6V27c0 1.7-1.3 3-3 3H8c-1.7 0-3-1.3-3-3v-3.2a3.8 3.8 0 0 0 0-7.6V13z" />
              <path style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 2, strokeLinecap: 'round', strokeDasharray: '2 3' }} d="M20 12v16" />
            </svg>
          </div>
          <h2 style={{ margin: '0 0 6px' }}>Welcome to Ticket</h2>
          <p style={{ color: 'var(--ink-3)', margin: 0 }}>Sign in to manage events, tickets, and transfers.</p>
        </div>
        <div className="pad">
          {!isConfigured && <div className="notice" style={{ margin: '0 0 14px' }}>Supabase isn't configured yet — add keys to .env (see README) to enable real sign-in.</div>}
          {notice === 'expired' && <div className="notice" style={{ margin: '0 0 14px' }}>Your access has expired. Contact the admin on Telegram for a new login.</div>}
          {notice === 'device' && <div className="notice" style={{ margin: '0 0 14px' }}>You were signed out because this login was used on another device. Each login works on one device at a time.</div>}
          {mode === 'signup' && (
            <div className="field"><label>Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Victor Kiptoo" /></div>
          )}
          <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></div>
          <div className="field"><label>Password</label><input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" /></div>
          <button className="btn primary" onClick={submit}>{mode === 'signup' ? 'Create account' : 'Sign in'}</button>
          {msg && <div className="notice">{msg}</div>}
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--ink-2)', fontSize: 14 }}>
            {mode === 'signup'
              ? <>Have an account? <button className="link" onClick={() => setMode('signin')}>Sign in</button></>
              : <>Need an account? <button className="link" onClick={() => setMode('signup')}>Create one</button></>}
          </p>
          <p style={{ textAlign: 'center', color: 'var(--ink-2)', fontSize: 13 }}>
            Contact admin on Telegram <span style={{ color: 'var(--accent)', fontWeight: 700 }}>@elikitecch</span>
          </p>
        </div>
      </div>
    </>
  )
}

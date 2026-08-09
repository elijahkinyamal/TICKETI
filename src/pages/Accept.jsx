import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { acceptTransfer } from '../lib/api'

export default function Accept() {
  const { user, isConfigured } = useAuth()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const transferId = params.get('transfer')

  const [state, setState] = useState('idle') // idle | working | done | error
  const [msg, setMsg] = useState('')

  const accept = async () => {
    setState('working'); setMsg('')
    try {
      await acceptTransfer(transferId)
      setState('done')
    } catch (e) { setState('error'); setMsg(e.message) }
  }

  return (
    <>
      <Header title="Accept tickets" back />
      <div className="view pad">
        {!transferId && <div className="notice">No transfer specified in the link.</div>}

        {transferId && !isConfigured && (
          <div className="notice">Supabase isn’t configured yet — accepting transfers needs a connected backend.</div>
        )}

        {transferId && isConfigured && !user && (
          <div className="center-note">
            Sign in with the email this transfer was sent to, then reopen this link.<br /><br />
            <button className="link" onClick={() => nav('/signin')}>Sign in</button>
          </div>
        )}

        {transferId && isConfigured && user && (
          <>
            <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>
              Someone sent you tickets. Accept to move them into your account (<b>{user.email}</b>).
            </p>
            {state === 'done'
              ? (
                <div className="center-note">
                  🎟️ The tickets are now yours.<br /><br />
                  <button className="link" onClick={() => nav('/tickets')}>View in My Tickets</button>
                </div>
              )
              : (
                <button className="btn primary" onClick={accept} disabled={state === 'working'}>
                  {state === 'working' ? 'Accepting…' : 'Accept these tickets'}
                </button>
              )}
            {msg && <div className="notice">{msg}</div>}
          </>
        )}
      </div>
    </>
  )
}

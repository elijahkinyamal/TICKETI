import { useState } from 'react'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { createStaffLogin } from '../lib/api'

const EMPTY = { email: '', password: '', full_name: '', role: 'staff' }

export default function CreateLogin() {
  const { profile } = useAuth()
  const [f, setF] = useState(EMPTY)
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const isAdmin = profile && ['owner', 'admin'].includes(profile.role)

  const submit = async () => {
    setMsg(''); setCreated(null)
    try {
      const r = await createStaffLogin(f)
      setCreated(r)
      setF(EMPTY)
    } catch (e) { setMsg(e.message) }
  }

  return (
    <>
      <Header title="Create staff login" back />
      <div className="view pad">
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 0 }}>
          Creates a login that expires automatically after 30 days. Owners and admins only.
        </p>
        {!isAdmin && <div className="notice">Only owners and admins can create staff logins.</div>}

        <div className="field"><label>Full name</label>
          <input className="input" value={f.full_name} onChange={set('full_name')} placeholder="Victor Kiptoo" />
        </div>
        <div className="field"><label>Email</label>
          <input className="input" type="email" value={f.email} onChange={set('email')} placeholder="staff@email.com" />
        </div>
        <div className="field"><label>Temporary password</label>
          <input className="input" value={f.password} onChange={set('password')} placeholder="at least 6 characters" />
        </div>
        <div className="field"><label>Role</label>
          <select className="select" value={f.role} onChange={set('role')}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>

        <button className="btn primary" onClick={submit} disabled={!isAdmin}>Create login</button>

        {created && (
          <div className="notice" style={{ background: 'var(--good-bg)', color: 'var(--good)' }}>
            Created <b>{created.email}</b> ({created.role}) — expires {new Date(created.expires_at).toLocaleDateString()}.
            Share the email + password with them.
          </div>
        )}
        {msg && <div className="notice">{msg}</div>}
      </div>
    </>
  )
}

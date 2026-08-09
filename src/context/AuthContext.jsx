import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// Stable per-device id kept in localStorage — used to enforce one-device logins.
const DEVICE_KEY = 'eliki_device_id'
function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2) + Date.now())
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch { return 'unknown-device' }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('') // '' | 'expired' | 'device'

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Load profile, then enforce 30-day expiry and single-device access.
  useEffect(() => {
    if (!isConfigured || !user) { setProfile(null); return }
    let active = true
    ;(async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!active) return
      if (!data) { setProfile(null); return }

      // 1) Expiry — owner/admin have expires_at = null, so they never expire.
      if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        setNotice('expired'); await supabase.auth.signOut(); return
      }

      // 2) One device — claim on a fresh login, otherwise verify this is the active device.
      const myId = getDeviceId()
      if (sessionStorage.getItem('eliki_claim')) {
        sessionStorage.removeItem('eliki_claim')
        if (data.device_id !== myId) {
          await supabase.from('profiles').update({ device_id: myId }).eq('id', user.id)
          data.device_id = myId
        }
      } else if (data.device_id && data.device_id !== myId) {
        setNotice('device'); await supabase.auth.signOut(); return
      }

      setProfile(data)
    })()
    return () => { active = false }
  }, [user])

  // Live sign-out if another device claims the account or it expires (needs realtime on profiles).
  useEffect(() => {
    if (!isConfigured || !user) return
    const myId = getDeviceId()
    const ch = supabase.channel(`profile-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        ({ new: row }) => {
          if (row?.device_id && row.device_id !== myId) { setNotice('device'); supabase.auth.signOut() }
          else if (row?.expires_at && new Date(row.expires_at).getTime() < Date.now()) { setNotice('expired'); supabase.auth.signOut() }
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  const refreshProfile = async () => {
    if (!isConfigured || !user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
  }

  const signIn = async (email, password) => {
    if (!isConfigured) throw new Error('Supabase is not configured yet — add your keys to .env')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    sessionStorage.setItem('eliki_claim', '1') // claim this device on a genuine login
  }

  const signUp = async (email, password, fullName) => {
    if (!isConfigured) throw new Error('Supabase is not configured yet — add your keys to .env')
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signOut = async () => { if (isConfigured) await supabase.auth.signOut() }
  const clearNotice = () => setNotice('')

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Member'

  return (
    <AuthCtx.Provider value={{ user, profile, loading, signIn, signUp, signOut, isConfigured, displayName, refreshProfile, notice, clearNotice }}>
      {children}
    </AuthCtx.Provider>
  )
}

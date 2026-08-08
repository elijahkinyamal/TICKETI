import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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

  // load the profile row (name, role) whenever the user changes
  useEffect(() => {
    if (!isConfigured || !user) { setProfile(null); return }
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => setProfile(data))
  }, [user])

  const signIn = async (email, password) => {
    if (!isConfigured) throw new Error('Supabase is not configured yet — add your keys to .env')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email, password, fullName) => {
    if (!isConfigured) throw new Error('Supabase is not configured yet — add your keys to .env')
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  const signOut = async () => { if (isConfigured) await supabase.auth.signOut() }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Member'

  return (
    <AuthCtx.Provider value={{ user, profile, loading, signIn, signUp, signOut, isConfigured, displayName }}>
      {children}
    </AuthCtx.Provider>
  )
}

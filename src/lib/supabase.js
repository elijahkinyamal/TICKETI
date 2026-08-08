import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// True only when real credentials are present in .env
export const isConfigured = Boolean(url && anon && !url.includes('YOUR-PROJECT'))

// When not configured, we still export a client-shaped object so the app
// renders (in "demo, not connected" mode) instead of crashing on boot.
export const supabase = isConfigured
  ? createClient(url, anon)
  : null

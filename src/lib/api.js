// Thin client for the Supabase Edge Functions (our backend).
// supabase.functions.invoke() automatically attaches the signed-in user's
// JWT, which every function requires.
import { supabase, isConfigured } from './supabase'

async function invoke(name, body) {
  if (!isConfigured) throw new Error('Supabase is not configured yet — add your keys to .env')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error) // functions return { error } on failure
  return data
}

// Search live events via the Ticketmaster Discovery proxy.
export const searchEvents = (params) => invoke('discovery-search', params)

// Owner/admin: create a staff login with an enforced 30-day expiry.
export const createStaffLogin = (payload) => invoke('admin-create-user', payload)

// Holder: transfer selected seats (payload.seat_ids) and email the recipient.
// Omitting seat_ids transfers all seats you currently hold on the event.
export const sendTransfer = (payload) => invoke('send-transfer', payload)

// Recipient: accept a pending transfer (moves the transferred seats to you).
export const acceptTransfer = (transfer_id) => invoke('accept-transfer', { transfer_id })

// Sender: cancel a pending transfer (releases the held seats back to you).
export const cancelTransfer = (transfer_id) => invoke('cancel-transfer', { transfer_id })

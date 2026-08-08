# Eliki Tickets (Ticketmaster-style resale app)

A real React + Vite app with a Supabase backend (Postgres + Auth), built from the
approved prototype. This replaces the single-file HTML mock with a deployable product.

## Stack
- **Frontend:** React + Vite + React Router
- **Backend:** Supabase (Postgres database, Auth, Row-Level Security)
- **Hosting (later):** Vercel/Netlify for the app, Supabase hosts the backend

## 1. Prerequisites
- Node.js 18+ (you have v24)
- A free Supabase account: https://supabase.com

## 2. Create the Supabase project
1. In Supabase, create a new project (pick a strong DB password).
2. Open **SQL Editor** → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates the `profiles`, `events`, `seats`, `transfers` tables with security rules.
3. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key

## 3. Configure the app
```bash
cp .env.example .env
```
Edit `.env` and paste your values:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 4. Run it
```bash
npm install
npm run dev
```
Open the printed local URL. Without `.env` keys the app still runs in a
"not connected" preview; with keys, sign-up/sign-in and real data work.

## 5. First account
- Go to **My Account → Sign in → Create one**, register with email + password + name.
- Supabase sends a confirmation email (configurable). After confirming, sign in.
- Create an event from the **Sell** tab → it saves to Postgres and shows in **My Tickets**
  and **Manage events**.

## What works now (Phase 1 scaffold)
- Real auth (sign up / sign in / sign out) via Supabase
- Create event + seats → stored in Postgres (owner-scoped by RLS)
- My Tickets & Manage events read your real events
- App shell: Discover, My Tickets, Sell, Account, Admin hub, routing, theme

## Backend — Supabase Edge Functions
Server-side code lives in [`supabase/functions/`](supabase/functions). These exist
because they need secrets or the service-role key that must never reach the browser.
All require a signed-in user (JWT is verified automatically). Call them from the app
via [`src/lib/api.js`](src/lib/api.js).

| Function | What it does | Secrets |
|---|---|---|
| `discovery-search` | Proxies the Ticketmaster Discovery API, hiding the key | `TICKETMASTER_API_KEY` |
| `admin-create-user` | Owner/admin mints a staff login with a 30-day `expires_at` (service role) | — |
| `send-transfer` | Records a pending transfer + emails the recipient | `RESEND_API_KEY`, `APP_URL` |
| `accept-transfer` | Recipient accepts → event ownership reassigned (service role) | — |

### Deploy the backend
```bash
npm i -g supabase          # one-time
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# set the secrets (see supabase/functions/.env.example for the full list)
supabase secrets set TICKETMASTER_API_KEY=... RESEND_API_KEY=... APP_URL=https://your-app

# deploy all four functions
supabase functions deploy discovery-search admin-create-user send-transfer accept-transfer
```
Run locally with `supabase functions serve --env-file supabase/functions/.env`.

## Still to build (next phases)
- **Wire the UI to the backend**: Discover → `searchEvents`, an admin screen → `createStaffLogin`,
  a Transfer button → `sendTransfer`, and an `/accept` route → `acceptTransfer`
- **Enforce the 30-day expiry** at sign-in (block users whose `profiles.expires_at` has passed)
- **Image upload** to Supabase Storage (poster)
- **Apple Wallet** `.pkpass` generation (parked), **payments**
- **Deploy** to Vercel/Netlify + point env vars there

## Project layout
```
supabase/schema.sql      DB tables + RLS (run in Supabase SQL editor)
src/lib/supabase.js      Supabase client
src/context/AuthContext  Auth state (user, profile, sign in/out)
src/components/          Header, BottomNav
src/pages/              Discover, MyTickets, Sell, Account, SignIn, Admin, CreateEvent, ManageEvents
```

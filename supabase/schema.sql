-- =====================================================================
--  Eliki Tickets — database schema (run in Supabase → SQL Editor)
--  Tables: profiles, events, seats, transfers
--  Security: Row Level Security (RLS) so users only touch their own data.
-- =====================================================================

-- ---------- PROFILES (one row per auth user) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  role        text not null default 'staff',      -- owner | admin | staff | viewer
  expires_at  timestamptz,                        -- for admin-created 30-day logins
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- EVENTS (a listing / created event) ----------
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users on delete cascade,
  name         text not null,
  starts_at    timestamptz,
  venue        text,
  lat          double precision,
  lng          double precision,
  poster_url   text,
  order_number text,
  sale_label   text,
  price        numeric,
  fee          numeric,
  currency     text default 'USD',
  status       text not null default 'live',       -- live | sold | delisted | expired
  created_at   timestamptz not null default now()
);

alter table public.events enable row level security;

-- owner manages their own events; created events are also publicly browsable
create policy "events: owner full access" on public.events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "events: public read" on public.events
  for select using (true);

-- ---------- SEATS (1..n per event) ----------
create table if not exists public.seats (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events on delete cascade,
  section   text,
  seat_row  text,
  seat      text
);

alter table public.seats enable row level security;

create policy "seats: read with event" on public.seats
  for select using (true);
create policy "seats: owner writes" on public.seats
  for all using (
    exists (select 1 from public.events e where e.id = seats.event_id and e.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.events e where e.id = seats.event_id and e.owner_id = auth.uid())
  );

-- ---------- TRANSFERS ----------
create table if not exists public.transfers (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events on delete cascade,
  from_user   uuid not null references auth.users on delete cascade,
  to_email    text not null,
  note        text,
  status      text not null default 'pending',     -- pending | accepted | cancelled | expired
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.transfers enable row level security;

create policy "transfers: sender manages" on public.transfers
  for all using (auth.uid() = from_user) with check (auth.uid() = from_user);
create policy "transfers: recipient reads" on public.transfers
  for select using (auth.email() = to_email);

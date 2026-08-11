-- =====================================================================
--  Seat-level ownership  (run in Supabase → SQL Editor)
--
--  Enables partial transfers: a holder can transfer SOME seats and keep
--  the rest. Ownership moves from the event down to each seat.
--
--  Safe to re-run.
-- =====================================================================

-- 1. Each seat now has its own owner, and can be flagged as "out" on a
--    pending transfer (which removes it from the owner's available count
--    until the transfer is accepted or cancelled).
alter table public.seats
  add column if not exists owner_id uuid references auth.users on delete cascade;

alter table public.seats
  add column if not exists pending_transfer_id uuid references public.transfers on delete set null;

-- 2. Backfill: every existing seat belongs to its event's current owner.
update public.seats s
set owner_id = e.owner_id
from public.events e
where e.id = s.event_id
  and s.owner_id is null;

-- 3. Indexes for the "seats I own" / "seats on this transfer" lookups.
create index if not exists seats_owner_idx   on public.seats (owner_id);
create index if not exists seats_pending_idx on public.seats (pending_transfer_id);

-- 4. RLS: seats stay publicly readable (unchanged). Writes now allowed for
--    either the seat's owner OR the event owner. All transfer mutations still
--    run through the Edge Functions with the service role, so this is mainly
--    belt-and-suspenders.
drop policy if exists "seats: owner writes" on public.seats;
create policy "seats: owner writes" on public.seats
  for all using (
    auth.uid() = owner_id
    or exists (select 1 from public.events e where e.id = seats.event_id and e.owner_id = auth.uid())
  ) with check (
    auth.uid() = owner_id
    or exists (select 1 from public.events e where e.id = seats.event_id and e.owner_id = auth.uid())
  );

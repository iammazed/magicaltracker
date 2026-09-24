-- Heartbeat table for the keep-awake workflow.
-- Run once in the Supabase dashboard: SQL Editor → New query → Run.
--
-- Holds one meaningless row. Its only job is to be selectable by the anon role
-- so a scheduled GitHub Action can register database activity every few days
-- and keep the Free Plan project from pausing.

create table if not exists public.heartbeat (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

insert into public.heartbeat default values;

-- RLS on, with exactly one permissive read policy. Nothing sensitive lives
-- here, but leaving a table unprotected sets a bad precedent for the tables
-- that follow.
alter table public.heartbeat enable row level security;

drop policy if exists "anon can read heartbeat" on public.heartbeat;
create policy "anon can read heartbeat"
  on public.heartbeat
  for select
  to anon
  using (true);

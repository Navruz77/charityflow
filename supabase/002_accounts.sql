-- M4: account tables (Appendix B.1) with row-level security.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is safe to re-run: tables use "if not exists" and policies/functions
-- are dropped and recreated.
--
-- How access works:
--   * Our server talks to these tables with the service-role (secret) key.
--     That key bypasses RLS, so the server ALSO filters every query by the
--     signed-in user's id in code (server/supabase/dbClient.js).
--   * RLS is the second layer: a request carrying a user's own token can only
--     ever see or change rows where user_id is that user (auth.uid()).
--   * Every user_id references auth.users with "on delete cascade", so
--     deleting the sign-in record removes every row the user owns (S3.6).

-- ---------------------------------------------------------------- tables

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  time_zone text not null default 'UTC', -- IANA name, e.g. America/New_York
  zakat_date date,
  zakat_hijri_month smallint check (zakat_hijri_month between 1 and 12),
  zakat_hijri_day smallint check (zakat_hijri_day between 1 and 30),
  created_at timestamptz not null default now()
);

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  saved_at timestamptz not null default now(),
  zakat_date date,
  nisab_choice text not null check (nisab_choice in ('gold', 'silver')),
  inputs jsonb not null,
  prices_used jsonb not null,
  result jsonb not null
);
create index if not exists calculations_user_id_idx on public.calculations (user_id);

create table if not exists public.reminder_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('zakatMonth', 'ramadan', 'friday', 'dhulHijjah')),
  enabled boolean not null default false,
  in_app boolean not null default false,
  email boolean not null default false,
  primary key (user_id, type)
);

create table if not exists public.reminders_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('zakatMonth', 'ramadan', 'friday', 'dhulHijjah')),
  channel text not null check (channel in ('inApp', 'email')),
  local_date date not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- This key is what stops a second reminder on the same day (NFR8).
  primary key (user_id, type, channel, local_date)
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  amount_cents bigint not null check (amount_cents > 0),
  period text not null check (period in ('monthly', 'yearly')),
  created_at timestamptz not null default now(),
  -- Lets gifts point at (goal id, owner) so a gift can only use its own
  -- owner's goal.
  unique (id, user_id)
);
create index if not exists goals_user_id_idx on public.goals (user_id);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  given_on date not null,
  recipient text,
  note text,
  goal_id uuid,
  goal_label text, -- the server fills this with the goal's name before removing the goal (M7)
  created_at timestamptz not null default now(),
  -- Same-owner goal only. When the goal is removed, only goal_id becomes
  -- null (user_id is kept).
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete set null (goal_id)
);
create index if not exists gifts_user_id_idx on public.gifts (user_id);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.admin_access_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  subject_user_id uuid references auth.users (id) on delete set null,
  accessed_at timestamptz not null default now(),
  action text not null
);

-- ------------------------------------------------------- row-level security

alter table public.profiles enable row level security;
alter table public.calculations enable row level security;
alter table public.reminder_prefs enable row level security;
alter table public.reminders_sent enable row level security;
alter table public.goals enable row level security;
alter table public.gifts enable row level security;
alter table public.admins enable row level security;           -- no policies: server only
alter table public.admin_access_log enable row level security; -- no policies: server only

-- A user can read, add, change and delete only their own rows.
drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.calculations;
create policy own_rows on public.calculations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.reminder_prefs;
create policy own_rows on public.reminder_prefs for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.goals;
create policy own_rows on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists own_rows on public.gifts;
create policy own_rows on public.gifts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- reminders_sent: users read their own and mark them read. Only the server
-- inserts (no insert/delete policy, and update is limited to read_at below).
drop policy if exists own_read on public.reminders_sent;
create policy own_read on public.reminders_sent for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists own_mark_read on public.reminders_sent;
create policy own_mark_read on public.reminders_sent for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------- grants
-- "Auto-expose new tables" is OFF in this project, so nothing is reachable
-- until granted. anon (no sign-in) gets nothing at all.

grant usage on schema public to service_role, authenticated;

grant select, insert, update, delete on
  public.profiles, public.calculations, public.reminder_prefs, public.reminders_sent,
  public.goals, public.gifts, public.admins, public.admin_access_log
  to service_role;

grant select, insert, update, delete on
  public.profiles, public.calculations, public.reminder_prefs, public.goals, public.gifts
  to authenticated;
grant select on public.reminders_sent to authenticated;
grant update (read_at) on public.reminders_sent to authenticated;
-- admins, admin_access_log, price_cache: no grant to authenticated or anon.

-- -------------------------------------------------------------- functions

-- The only admin path to a user's data (NFR5, D11). The server passes the
-- admin's id, which it took from the verified session. Each call writes
-- exactly one admin_access_log row, then returns the subject's rows.
create or replace function public.admin_read_user_data(p_admin uuid, p_subject uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  -- Extra guard: if a user token ever reached this, it must be the admin's own.
  if auth.uid() is not null and auth.uid() <> p_admin then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admins a where a.user_id = p_admin) then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  insert into public.admin_access_log (admin_id, subject_user_id, action)
  values (p_admin, p_subject, 'read_user_data');

  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = p_subject),
    'calculations', coalesce((select jsonb_agg(to_jsonb(c) order by c.saved_at desc)
                              from public.calculations c where c.user_id = p_subject), '[]'::jsonb),
    'reminderPrefs', coalesce((select jsonb_agg(to_jsonb(r))
                               from public.reminder_prefs r where r.user_id = p_subject), '[]'::jsonb),
    'remindersSent', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc)
                               from public.reminders_sent s where s.user_id = p_subject), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(g) order by g.created_at)
                       from public.goals g where g.user_id = p_subject), '[]'::jsonb),
    'gifts', coalesce((select jsonb_agg(to_jsonb(f) order by f.given_on desc)
                       from public.gifts f where f.user_id = p_subject), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Counts for the status page (NFR9). No user data, so no log row.
create or replace function public.admin_stats(p_admin uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = p_admin) then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'calculations', (select count(*) from public.calculations)
  );
end;
$$;

-- Supabase grants execute on new functions to anon/authenticated by
-- default. Take that away: only the server may call these.
revoke all on function public.admin_read_user_data(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_stats(uuid) from public, anon, authenticated;
grant execute on function public.admin_read_user_data(uuid, uuid) to service_role;
grant execute on function public.admin_stats(uuid) to service_role;

-- --------------------------------------------------------------- admins
-- After the four of us have registered, add each one by email, e.g.:
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'teammate@example.com'
--   on conflict do nothing;

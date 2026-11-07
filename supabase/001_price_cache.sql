-- M3: price_cache table (Appendix B.1/B.2). Paste this into the Supabase
-- SQL editor and run it once. Only the server's service-role key reads or
-- writes this table — RLS is enabled with no policies, so the anon and
-- authenticated roles (what the browser could ever present) get nothing;
-- the service role bypasses RLS entirely, which is the only way in.

create table if not exists price_cache (
  id smallint primary key default 1,
  gold_usd_per_gram numeric,
  silver_usd_per_gram numeric,
  fetched_at timestamptz,
  source text check (source in ('metalcharts', 'api-ninjas')),
  last_attempt_at timestamptz,
  last_attempt_ok boolean,
  last_attempt_note text,
  constraint price_cache_single_row check (id = 1)
);

alter table price_cache enable row level security;
-- No policies are created on purpose: with RLS on and zero policies, the
-- anon/authenticated roles can never read or write this table. Only a
-- request made with the service-role key (used only by server/) bypasses
-- RLS, which is exactly the access rule PROJECT.md specifies.

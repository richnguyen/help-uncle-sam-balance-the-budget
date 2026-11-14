-- Partner codes: anonymous daily totals per partner link (?via=<code>), so a newsletter, creator,
-- teacher group or press piece can be credited with the players it brings, and how far they get.
-- Only counts by day are kept: no player id, no device, no time of day, nothing about who.
--   metric     one count means
--   arrival    a browser opened the game from this partner's link for the first time
--   played     a player who first came from this code finished a mission step or a Daily Dollar
--   finished   ... finished a whole mission
--   returned   ... came back on a later day
--   shared     ... shared something from the game
-- Each is counted at most once per browser (the browser remembers what it already sent).
-- A code is 2-24 characters: lowercase letters, digits and hyphens, starting with a letter or digit.
-- Any well-formed code counts, so a new partner needs no change here; label known ones in
-- src/data/curated/partners.json. Run after the earlier migrations. Safe to re-run.

create table if not exists public.partner_counts (
  day date not null,
  code text not null,
  metric text not null,
  n integer not null default 0,
  primary key (day, code, metric)
);
-- Row-level security with no policies: only the functions below read or write it.
alter table public.partner_counts enable row level security;

-- One more count (anyone may call it; malformed codes and unknown metrics are ignored, and a
-- day's count for a code stops at a million).
create or replace function public.count_partner(p_code text, p_metric text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_code is null or p_metric is null
     or p_code !~ '^[a-z0-9][a-z0-9-]{1,23}$'
     or p_metric not in ('arrival', 'played', 'finished', 'returned', 'shared') then return; end if;
  insert into public.partner_counts as c (day, code, metric, n)
  values ((now() at time zone 'utc')::date, p_code, p_metric, 1)
  on conflict (day, code, metric) do update set n = c.n + 1 where c.n < 1000000;
end $$;

-- The totals for the last `window_days` days (UTC): by code and metric, and by day.
create or replace function public.partner_stats(window_days int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (select least(greatest(coalesce(window_days, 30), 1), 3650) as n),
  since as (select (now() at time zone 'utc')::date - (select n from d) + 1 as day),
  pc as (select * from public.partner_counts where day >= (select day from since))
  select jsonb_build_object(
    'window_days', (select n from d),
    'since', (select day from since),
    'codes', coalesce((
      select jsonb_object_agg(code, ms) from (
        select code, jsonb_object_agg(metric, t) as ms from (
          select code, metric, sum(n) as t from pc group by code, metric) x
        group by code) y), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'code', code, 'metric', metric, 'n', n) order by day, code, metric)
      from pc), '[]'::jsonb)
  );
$$;

revoke all on function public.count_partner(text, text) from public;
revoke all on function public.partner_stats(int) from public;
grant execute on function public.count_partner(text, text) to anon, authenticated;
grant execute on function public.partner_stats(int) to anon, authenticated;

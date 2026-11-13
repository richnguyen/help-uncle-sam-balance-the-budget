-- Play counts: anonymous daily totals that show where real players get stuck, for the playtest.
-- Only counts by day are kept, never who did what: no player id, no device, no time of day.
--   metric             key                       what one count means
--   desk_open          level-5 | level-8 | ...   a budget desk was opened (once per browser per day)
--   desk_play          the desk                  the first card was played on it (once per day)
--   desk_done          the desk                  its goal was met (once per day)
--     abandonment = desk_play - desk_done, per desk
--   ripple_time        lt15 | 15-30 | 30-60 | 60-120 | gt120
--                                                seconds spent on mission 1.6's ripple ranking round
--   poll_view          feed                      the feed's polls were seen (once per browser per day)
--   poll_vote          feed                      a poll in the feed was answered
--   free_roam          on                        free roam was switched on
--   jump_ahead         a mission id              a mission was opened ahead of the next one in order
--   quick_start        a mission id              Quick play was started
--   quick_done         a mission id              Quick play was finished
-- Run after the earlier migrations. Safe to re-run.

create table if not exists public.play_counts (
  day date not null,
  metric text not null,
  key text not null,
  n integer not null default 0,
  primary key (day, metric, key)
);
-- Row-level security with no policies: only the functions below read or write it.
alter table public.play_counts enable row level security;

create or replace function public.play_metric_ok(m text, k text) returns boolean
language sql immutable set search_path = '' as $$
  select case m
    when 'desk_open' then k ~ '^level-(5|8|10)$'
    when 'desk_play' then k ~ '^level-(5|8|10)$'
    when 'desk_done' then k ~ '^level-(5|8|10)$'
    when 'ripple_time' then k ~ '^(lt15|15-30|30-60|60-120|gt120)$'
    when 'poll_view' then k = 'feed'
    when 'poll_vote' then k = 'feed'
    when 'free_roam' then k = 'on'
    when 'jump_ahead' then k ~ '^level-[a-z0-9-]{1,24}$'
    when 'quick_start' then k ~ '^level-[a-z0-9-]{1,24}$'
    when 'quick_done' then k ~ '^level-[a-z0-9-]{1,24}$'
    else false end;
$$;

-- One more count (anyone may call it; unknown metrics or keys are ignored, and a day's count stops at a million).
create or replace function public.count_play(p_metric text, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_metric is null or p_key is null or not public.play_metric_ok(p_metric, p_key) then return; end if;
  insert into public.play_counts as c (day, metric, key, n)
  values ((now() at time zone 'utc')::date, p_metric, p_key, 1)
  on conflict (day, metric, key) do update set n = c.n + 1 where c.n < 1000000;
end $$;

-- The totals for the last `window_days` days (UTC): by metric and key, and by day.
create or replace function public.play_stats(window_days int default 30) returns jsonb
language sql stable security definer set search_path = '' as $$
  with d as (select least(greatest(coalesce(window_days, 30), 1), 3650) as n),
  since as (select (now() at time zone 'utc')::date - (select n from d) + 1 as day),
  pc as (select * from public.play_counts where day >= (select day from since))
  select jsonb_build_object(
    'window_days', (select n from d),
    'since', (select day from since),
    'totals', coalesce((
      select jsonb_object_agg(metric, ks) from (
        select metric, jsonb_object_agg(key, t) as ks from (
          select metric, key, sum(n) as t from pc group by metric, key) x
        group by metric) y), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'metric', metric, 'key', key, 'n', n) order by day, metric, key)
      from pc), '[]'::jsonb)
  );
$$;

revoke all on function public.count_play(text, text) from public;
revoke all on function public.play_stats(int) from public;
grant execute on function public.count_play(text, text) to anon, authenticated;
grant execute on function public.play_stats(int) to anon, authenticated;

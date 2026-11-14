-- The Daily Dollar's crowd counts: for each puzzle, how many players called each of its five
-- numbers right or wrong, and how many finished with each score. Anonymous totals only: no
-- player id, no device, no time. They give the game its "61% of players got this one" lines and
-- the daily posts their numbers.
--   call  result   one count means
--   1-5   1 | 0    a player called that number right (1) or wrong (0)
--   0     0-5      a player finished the puzzle with that score
-- Puzzle #1 was 2026-11-06 (src/game/daily.ts). Players' puzzles follow their own calendar day,
-- so counts are taken for the puzzle one day either side of today's (UTC). Each browser counts
-- each call once. Run after the earlier migrations. Safe to re-run.

create table if not exists public.daily_counts (
  puzzle integer not null,
  call smallint not null,
  result smallint not null,
  n integer not null default 0,
  primary key (puzzle, call, result)
);
-- Row-level security with no policies: only the functions below read or write it.
alter table public.daily_counts enable row level security;

-- Today's puzzle number (UTC).
create or replace function public.daily_puzzle_today() returns integer
language sql stable set search_path = '' as $$
  select ((now() at time zone 'utc')::date - date '2026-11-05')::integer;
$$;

-- One more count (anyone may call it; anything out of range is ignored, and a count stops at a million).
create or replace function public.count_daily(p_puzzle int, p_call int, p_result int) returns void
language plpgsql security definer set search_path = '' as $$
declare today int := public.daily_puzzle_today();
begin
  if p_puzzle is null or p_call is null or p_result is null
     or p_puzzle < greatest(1, today - 1) or p_puzzle > today + 1
     or p_call < 0 or p_call > 5
     or (p_call = 0 and (p_result < 0 or p_result > 5))
     or (p_call > 0 and p_result not in (0, 1)) then return; end if;
  insert into public.daily_counts as c (puzzle, call, result, n)
  values (p_puzzle, p_call, p_result, 1)
  on conflict (puzzle, call, result) do update set n = c.n + 1 where c.n < 1000000;
end $$;

-- One puzzle's totals: each call's rights and wrongs, the scores, and how many finished.
create or replace function public.daily_stats(p_puzzle int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select * from public.daily_counts where puzzle = p_puzzle)
  select jsonb_build_object(
    'puzzle', p_puzzle,
    'calls', (select jsonb_agg(jsonb_build_object(
        'call', k,
        'right', coalesce((select n from c where call = k and result = 1), 0),
        'wrong', coalesce((select n from c where call = k and result = 0), 0)) order by k)
      from generate_series(1, 5) as k),
    'scores', coalesce((select jsonb_object_agg(result::text, n) from c where call = 0), '{}'::jsonb),
    'players', coalesce((select sum(n) from c where call = 0), 0)
  );
$$;

revoke all on function public.count_daily(int, int, int) from public;
revoke all on function public.daily_stats(int) from public;
grant execute on function public.count_daily(int, int, int) to anon, authenticated;
grant execute on function public.daily_stats(int) to anon, authenticated;

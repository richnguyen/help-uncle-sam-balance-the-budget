-- Following a bill from the feed. A player follows a bill and the game remembers the stage it was
-- at; when the bill moves (committee, a floor vote, the President), devices with notifications on
-- get one alert. The daily-reminders Edge Function does the checking on its hourly run: it reads
-- the bills the site published (https://balancethebudget.us/bills.json) and compares.
-- No names: a follow is an anonymous player, a bill number and a stage. Run after the earlier
-- migrations. Safe to re-run.

create table if not exists public.bill_follows (
  player uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The game's bill id: type, number, Congress, e.g. "hr227-119", "s1176-119".
  bill text not null check (bill ~ '^[a-z]{1,8}[0-9]{1,5}-[0-9]{2,3}$'),
  -- The stage when followed, or when the player was last alerted.
  status text not null check (length(status) between 1 and 40),
  created_at timestamptz not null default now(),
  primary key (player, bill)
);
create index if not exists bill_follows_bill on public.bill_follows (bill);
alter table public.bill_follows enable row level security;

drop policy if exists "own follows: read" on public.bill_follows;
drop policy if exists "own follows: add" on public.bill_follows;
drop policy if exists "own follows: change" on public.bill_follows;
drop policy if exists "own follows: remove" on public.bill_follows;
create policy "own follows: read" on public.bill_follows for select to authenticated using (player = (select auth.uid()));
create policy "own follows: add" on public.bill_follows for insert to authenticated
  with check (player = (select auth.uid()));
create policy "own follows: change" on public.bill_follows for update to authenticated
  using (player = (select auth.uid())) with check (player = (select auth.uid()));
create policy "own follows: remove" on public.bill_follows for delete to authenticated using (player = (select auth.uid()));

-- At most 50 bills followed per player.
create or replace function public.bill_follows_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.bill_follows f where f.player = new.player) >= 50 then
    raise exception 'you follow 50 bills already';
  end if;
  return new;
end $$;
drop trigger if exists bill_follows_limit on public.bill_follows;
create trigger bill_follows_limit before insert on public.bill_follows for each row execute function public.bill_follows_limit();

-- For the sender only (service role): every device to tell about a followed bill that has moved.
-- p_now is { "<bill>": "<stage now>" } from the published bills.
create or replace function public.bill_alerts_due(p_now jsonb)
returns table (endpoint text, p256dh text, auth text, bill text, status text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth, f.bill, p_now ->> f.bill
  from public.bill_follows f
  join public.push_subscriptions s on s.player = f.player
  where p_now ? f.bill and f.status <> (p_now ->> f.bill)
  order by f.bill
  limit 5000;
$$;

-- For the sender only: after the alerts go out, remember the new stage for every follower.
create or replace function public.mark_bills_alerted(p_now jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.bill_follows f set status = p_now ->> f.bill
  where p_now ? f.bill and f.status <> (p_now ->> f.bill);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.bill_alerts_due(jsonb) from public, anon, authenticated;
revoke all on function public.mark_bills_alerted(jsonb) from public, anon, authenticated;
grant execute on function public.bill_alerts_due(jsonb) to service_role;
grant execute on function public.mark_bills_alerted(jsonb) to service_role;

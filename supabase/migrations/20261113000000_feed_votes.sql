-- The feed's polls: one answer per player on each poll card and each bill card ("Would you
-- include this in a plan?", "Would you support this bill?"). A player can change their answer.
-- Answers are anonymous; the feed shows only counts, and only to players who have answered.
-- These are players of a civic game, not a scientific poll, and the feed says so.
-- Run after the earlier migrations. Safe to re-run.

create table if not exists public.feed_votes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- "poll:<option id>" or "bill:<bill id>", e.g. "poll:carbon-tax-25", "bill:hr227-119".
  item text not null check (item ~ '^(poll|bill):[a-z0-9-]{1,60}$'),
  choice text not null check (choice in ('yes', 'no', 'unsure', 'support', 'oppose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item)
);
create index if not exists feed_votes_item_idx on public.feed_votes (item);

alter table public.feed_votes enable row level security;

-- A player sees, adds, changes and takes back only their own answers.
drop policy if exists "own feed votes: read" on public.feed_votes;
drop policy if exists "own feed votes: add" on public.feed_votes;
drop policy if exists "own feed votes: change" on public.feed_votes;
drop policy if exists "own feed votes: take back" on public.feed_votes;
create policy "own feed votes: read" on public.feed_votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own feed votes: add" on public.feed_votes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own feed votes: change" on public.feed_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own feed votes: take back" on public.feed_votes for delete to authenticated
  using (user_id = (select auth.uid()));

drop trigger if exists feed_votes_touch on public.feed_votes;
create trigger feed_votes_touch before update on public.feed_votes for each row execute function public.touch_updated_at();

-- The counts for up to 50 cards at once: { "<item>": { "yes": 12, "no": 4, "unsure": 3, "total": 19 } }.
create or replace function public.feed_tallies(items text[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(item, counts), '{}'::jsonb)
  from (
    select v.item, jsonb_object_agg(v.choice, v.n) || jsonb_build_object('total', sum(v.n)) as counts
    from (
      select f.item, f.choice, count(*) as n
      from public.feed_votes f
      where f.item = any ((coalesce(items, '{}'))[1:50])
      group by f.item, f.choice
    ) v
    group by v.item
  ) t;
$$;

revoke all on function public.feed_tallies(text[]) from public;
grant execute on function public.feed_tallies(text[]) to anon, authenticated;

-- Duel boards: one duel link can go to many friends, and each friend who finishes it sees how
-- every plan on that link stacks up (the game plays each plan against each other one, in the
-- same three rounds). The board keeps, per duel link, the host's plan (from the link itself) and
-- each friend's latest plan with the first name they signed it with, if any. That is exactly
-- what the links already carry, so nothing new is revealed. Plans are compared, never people.
-- Run after the earlier migrations. Safe to re-run.

create table if not exists public.duel_entries (
  id bigint generated always as identity primary key,
  duel text not null check (duel ~ '^[a-z0-9]{6,12}$'),
  -- The friend who played (null on the host's row: the host's plan comes from the link).
  user_id uuid references auth.users (id) on delete cascade,
  is_host boolean not null default false,
  -- The plan, as the link spells it: cards (p), across-the-board changes (lv), phased in or not.
  p text not null check (p ~ '^10\.[a-z]{0,30}$'),
  lv text not null default '' check (lv ~ '^([a-z]-?[0-9]{1,3}(\.[a-z]-?[0-9]{1,3}){0,6})?$'),
  ph boolean not null default true,
  by_name text check (by_name is null or (char_length(by_name) between 1 and 24 and by_name !~ '[[:cntrl:]<>]')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_host = (user_id is null))
);
create unique index if not exists duel_entries_host_idx on public.duel_entries (duel) where is_host;
create unique index if not exists duel_entries_guest_idx on public.duel_entries (duel, user_id) where user_id is not null;
create index if not exists duel_entries_user_idx on public.duel_entries (user_id, created_at);
-- Row-level security with no policies: only the functions below read or write it.
alter table public.duel_entries enable row level security;

-- A friend's plan joins the board (or replaces their earlier one); the first entry also records
-- the host's plan from the link. Signed-in players only (an anonymous sign-in is enough).
-- Limits: 200 plans per board, 40 new boards per player a day.
create or replace function public.enter_duel(
  p_duel text, h_p text, h_lv text, h_ph boolean, h_name text,
  p_p text, p_lv text, p_ph boolean, p_name text
) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign-in needed.' using errcode = '42501'; end if;
  if not exists (select 1 from public.duel_entries e where e.duel = p_duel and e.user_id = me) then
    if (select count(*) from public.duel_entries e where e.duel = p_duel) >= 200 then
      raise exception 'This duel board is full.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.duel_entries e where e.user_id = me and e.created_at > now() - interval '1 day') >= 40 then
      raise exception 'Too many duels today; try again tomorrow.' using errcode = 'P0001';
    end if;
  end if;
  insert into public.duel_entries (duel, user_id, is_host, p, lv, ph, by_name)
  values (p_duel, null, true, h_p, coalesce(h_lv, ''), coalesce(h_ph, true), nullif(btrim(h_name), ''))
  on conflict (duel) where is_host do nothing;
  insert into public.duel_entries as e (duel, user_id, is_host, p, lv, ph, by_name)
  values (p_duel, me, false, p_p, coalesce(p_lv, ''), coalesce(p_ph, true), nullif(btrim(p_name), ''))
  on conflict (duel, user_id) where user_id is not null
  do update set p = excluded.p, lv = excluded.lv, ph = excluded.ph, by_name = excluded.by_name, updated_at = now();
end $$;

-- A board: the host's plan first, then every friend's, oldest first. Which one is yours is marked.
create or replace function public.duel_board(p_duel text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'host', e.is_host, 'name', e.by_name, 'p', e.p, 'lv', e.lv, 'ph', e.ph,
      'mine', coalesce(e.user_id = auth.uid(), false)
    ) order by e.is_host desc, e.created_at, e.id), '[]'::jsonb)
  from (select * from public.duel_entries where duel = p_duel order by is_host desc, created_at, id limit 200) e;
$$;

revoke all on function public.enter_duel(text, text, text, boolean, text, text, text, boolean, text) from public;
revoke all on function public.duel_board(text) from public;
grant execute on function public.enter_duel(text, text, text, boolean, text, text, text, boolean, text) to authenticated;
grant execute on function public.duel_board(text) to anon, authenticated;

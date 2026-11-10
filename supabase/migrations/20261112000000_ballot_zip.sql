-- A ZIP code on the ballot.
--
-- In mission 1.4 ("Back home") a player may choose to save their ZIP code, and the state it's in,
-- with their budget votes: the ballot gains `"zip": "22301"` and `"state": "VA"`. It's optional,
-- off by default, and removable from the same screen. The ballot row stays readable only by its
-- player (the row-level security in 20261106000000_init.sql); nothing here changes that.
--
-- The game already saves the ZIP inside the ballot, so it works before this migration runs. This
-- file adds (1) format checks, so a ballot can only hold a five-digit ZIP and a two-letter state,
-- and (2) ballot_area_totals(), which groups ballots that carry a ZIP by state and by 3-digit ZIP
-- area and returns counts only, and only for groups of 10 or more players: never a ZIP, a ballot,
-- or a group small enough to point at one person. Safe to run again.

alter table public.ballots drop constraint if exists ballot_zip_shape;
alter table public.ballots add constraint ballot_zip_shape check (
  (ballot ->> 'zip') is null or (ballot ->> 'zip') ~ '^[0-9]{5}$'
);
alter table public.ballots drop constraint if exists ballot_state_shape;
alter table public.ballots add constraint ballot_state_shape check (
  (ballot ->> 'state') is null or (ballot ->> 'state') ~ '^[A-Z]{2}$'
);

create or replace function public.ballot_area_totals() returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (
    select ballot, ballot ->> 'state' as st, left(ballot ->> 'zip', 3) as z3
    from public.ballots
    where (ballot ->> 'zip') ~ '^[0-9]{5}$'
  ),
  grp as (
    select 'states'::text as kind, st as k, ballot from b where st is not null
    union all
    select 'zip3'::text, z3, ballot from b
  ),
  sizes as (
    select kind, k, count(*) as n from grp group by kind, k having count(*) >= 10
  ),
  opts as (
    select g.kind, g.k, e.key as card,
           count(*) filter (where e.value = '1'::jsonb) as support,
           count(*) filter (where e.value = '-1'::jsonb) as oppose
    from grp g join sizes s using (kind, k), jsonb_each(coalesce(g.ballot -> 'options', '{}'::jsonb)) e
    group by g.kind, g.k, e.key
  ),
  opt_obj as (
    select kind, k, jsonb_object_agg(card, jsonb_build_object('support', support, 'oppose', oppose)) as options
    from opts group by kind, k
  ),
  iss as (
    select g.kind, g.k, e.key as q, e.value as answer, count(*) as n
    from grp g join sizes s using (kind, k), jsonb_each_text(coalesce(g.ballot -> 'issues', '{}'::jsonb)) e
    where e.value is not null and e.value <> ''
    group by g.kind, g.k, e.key, e.value
  ),
  iss_q as (select kind, k, q, jsonb_object_agg(answer, n) as answers from iss group by kind, k, q),
  iss_obj as (select kind, k, jsonb_object_agg(q, answers) as issues from iss_q group by kind, k),
  area as (
    select s.kind, s.k, jsonb_build_object('voters', s.n, 'options', coalesce(o.options, '{}'::jsonb), 'issues', coalesce(i.issues, '{}'::jsonb)) as body
    from sizes s left join opt_obj o using (kind, k) left join iss_obj i using (kind, k)
  )
  select jsonb_build_object(
    'min', 10,
    'states', coalesce((select jsonb_object_agg(k, body) from area where kind = 'states'), '{}'::jsonb),
    'zip3', coalesce((select jsonb_object_agg(k, body) from area where kind = 'zip3'), '{}'::jsonb)
  );
$$;

revoke all on function public.ballot_area_totals() from public;
grant execute on function public.ballot_area_totals() to anon, authenticated;

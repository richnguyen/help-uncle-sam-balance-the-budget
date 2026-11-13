// Runs the Supabase migration in PGlite (Postgres in WebAssembly) with stand-ins for Supabase's
// auth schema and roles, then checks row-level security and the public totals. npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';

// Every migration, in order, as the SQL Editor or `supabase db push` would run them.
const dir = new URL('../migrations/', import.meta.url);
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const db = new PGlite();
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(sql);
// Supabase grants table privileges to these roles by default; RLS decides the rows.
await db.exec(`
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`);
// Re-running the migration must be safe.
await db.exec(sql);
ok(true, 'migration runs twice');

const U = Array.from({ length: 7 }, (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`);
for (const u of U) await db.query('insert into auth.users (id) values ($1)', [u]);
const as = async (u, q, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${u ?? ''}', false); set role ${u ? 'authenticated' : 'anon'};`);
  try { return await db.query(q, params); } finally { await db.exec('reset role;'); }
};
const fails = async (fn) => { try { await fn(); return false; } catch { return true; } };

// Ballots
const ballot = (o) => JSON.stringify({ options: o.options ?? {}, plan: o.plan ?? null, issues: o.issues ?? {}, updated: '2026-11-06T00:00:00Z' });
await as(U[0], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': 1, 'vat-5pct': -1 }, plan: 'economists', issues: { goal: 'stabilize', mix: 'even' } })]);
await as(U[1], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': -1 }, plan: 'economists', issues: { goal: 'balance' } })]);
await as(U[2], 'insert into public.ballots (ballot) values ($1)', [ballot({ options: { 'cut-defense-budget': 1 }, issues: { goal: 'stabilize' } })]);
ok((await as(U[0], 'select * from public.ballots')).rows.length === 1, 'a player sees only their own ballot');
ok(await fails(() => as(U[0], 'insert into public.ballots (user_id, ballot) values ($1, $2)', [U[3], ballot({})])), 'cannot write a ballot for someone else');
ok(await fails(() => as(null, 'insert into public.ballots (user_id, ballot) values ($1, $2)', [U[3], ballot({})])), 'signed-out visitors cannot write');
ok((await as(null, 'select * from public.ballots')).rows.length === 0, 'signed-out visitors cannot read ballots');
await as(U[0], `update public.ballots set ballot = jsonb_set(ballot, '{plan}', '"protect"')`);
const upd = await as(U[1], `update public.ballots set ballot = '{}'::jsonb where user_id = $1`, [U[0]]);
ok(upd.affectedRows === 0, 'cannot change someone else’s ballot');
ok(await fails(() => as(U[3], 'insert into public.ballots (ballot) values ($1)', ['{"options": []}'])), 'ballot shape is checked');
const bt = (await as(null, 'select public.ballot_totals() as t')).rows[0].t;
console.log('  ballot_totals:', JSON.stringify(bt));
ok(bt.voters === 3 && bt.options['cut-defense-budget'].support === 2 && bt.options['cut-defense-budget'].oppose === 1, 'option totals');
ok(bt.plans.economists === 1 && bt.plans.protect === 1, 'plan totals (after a change of mind)');
ok(bt.issues.goal.stabilize === 2 && bt.issues.goal.balance === 1 && bt.issues.mix.even === 1, 'issue totals');

// Players
const rec = (done, stars) => JSON.stringify({ v: 1, done, stars, firstTry: { l1q1: true }, medals: ['first-steps'], updated: '2026-11-06T00:00:00Z' });
for (let i = 0; i < 6; i++) await as(U[i], 'insert into public.players (record, state, channel) values ($1, $2, $3)', [rec(i < 5 ? ['level-1', 'level-2'] : ['level-1'], { 'level-1': 3, 'level-2': 2 }), i < 5 ? 'OH' : 'TX', 'wh']);
ok((await as(U[0], 'select * from public.players')).rows.length === 1, 'a player sees only their own record');
ok(await fails(() => as(U[6], `insert into public.players (record, state) values ($1, 'Ohio')`, [rec([], {})])), 'state must be a two-letter code');
const pt = (await as(null, 'select public.player_totals() as t')).rows[0].t;
console.log('  player_totals:', JSON.stringify(pt));
ok(pt.players === 6 && pt.done['level-1'] === 6 && pt.done['level-2'] === 5 && pt.stars['level-1'].sum === 18, 'player totals');
ok(pt.stars_total === 30 && pt.finished_all === 0, 'stars in all, and nobody has finished every level yet');
const all = Array.from({ length: 10 }, (_, i) => `level-${i + 1}`);
await as(U[6], 'insert into public.players (record) values ($1)', [rec(all, { 'level-10': 3 })]);
ok((await as(null, 'select public.player_totals() as t')).rows[0].t.finished_all === 1, 'finished all ten levels');
const sr = (await as(null, 'select * from public.state_rankings()')).rows;
console.log('  state_rankings:', JSON.stringify(sr));
ok(sr.length === 1 && sr[0].state === 'OH', 'state ranking leaves out states with fewer than 5 players');

// Plans
const ins = await as(U[0], `insert into public.plans (level, code, cards, stars, revenue_share, by_name) values (10, 'p=10.acg&lv=r5.d-5', '{income-tax-rates-1pt,ss-tax-earnings-over-250k,limit-itemized-15pct}', 2, 0.6, 'Rich') returning id`);
const id = ins.rows[0].id;
ok(/^[0-9a-f]{12}$/.test(id), 'short link id: ' + id);
await as(U[1], `insert into public.plans (level, code, cards, stars) values (10, 'p=10.ar', '{income-tax-rates-1pt,cut-defense-budget}', 1)`);
ok((await as(U[1], 'select * from public.plans')).rows.length === 1, 'players cannot list other people’s plans');
ok((await as(null, 'select * from public.plans')).rows.length === 0, 'signed-out visitors cannot list plans');
const gp = (await as(null, 'select public.get_plan($1) as p', [id])).rows[0].p;
ok(gp && gp.code === 'p=10.acg&lv=r5.d-5' && gp.by === 'Rich', 'anyone with the link can open the plan');
ok(await fails(() => as(U[2], `insert into public.plans (level, code, stars) values (10, 'p=10.a<script>', 1)`)), 'plan code is checked');
ok(await fails(() => as(U[2], `insert into public.plans (level, code, stars) values (7, 'p=7.a', 1)`)), 'only budget-desk levels');
const cr = (await as(null, 'select * from public.card_rankings(10::smallint)')).rows;
console.log('  card_rankings:', JSON.stringify(cr));
ok(cr[0].card === 'income-tax-rates-1pt' && Number(cr[0].share) === 1, 'card ranking');
// A player who changes their plan counts once, with their latest plan.
await as(U[1], `insert into public.plans (level, code, cards, stars) values (10, 'p=10.e', '{vat-5pct}', 1)`);
const cr2 = (await as(null, 'select * from public.card_rankings(10::smallint)')).rows;
const share = (c) => Number(cr2.find((r) => r.card === c)?.share ?? 0);
ok(share('vat-5pct') === 0.5 && share('cut-defense-budget') === 0 && share('income-tax-rates-1pt') === 0.5, 'each player’s latest plan counts once');
let capped = false;
for (let k = 0; k < 31; k++) { try { await as(U[3], `insert into public.plans (level, code, stars) values (5, 'p=5.a', 1)`); } catch (e) { capped = /Too many/.test(e.message); break; } }
ok(capped, 'daily cap on shared plans');

// The People's Budget: one move a day, changeable that day only.
const upsertMove = (u, card, dir) => as(u, `insert into public.peoples_moves (card, dir) values ($1, $2)
  on conflict (user_id, day) do update set card = excluded.card, dir = excluded.dir`, [card, dir]);
await upsertMove(U[0], 'vat-5pct', 1);
await upsertMove(U[1], 'vat-5pct', 1);
await upsertMove(U[2], 'vat-5pct', -1);
await upsertMove(U[3], 'cut-defense-budget', 1);
ok(await fails(() => as(U[0], `insert into public.peoples_moves (card, dir) values ('chained-cpi', 1)`)), 'only one move a day');
await upsertMove(U[3], 'chained-cpi', -1);
ok((await as(U[3], 'select card, dir from public.peoples_moves')).rows[0].card === 'chained-cpi', 'today’s move can be changed');
ok(await fails(() => as(U[4], `insert into public.peoples_moves (day, card, dir) values ((now() at time zone 'utc')::date - 3, 'vat-5pct', 1)`)), 'no moves on past days');
ok(await fails(() => as(U[4], `insert into public.peoples_moves (card, dir) values ('vat-5pct', 2)`)), 'a move is +1 or -1');
ok(await fails(() => as(U[4], `insert into public.peoples_moves (user_id, card, dir) values ($1, 'vat-5pct', 1)`, [U[5]])), 'cannot move for someone else');
ok((await as(U[0], 'select * from public.peoples_moves')).rows.length === 1, 'a player sees only their own moves');
ok((await as(null, 'select * from public.peoples_moves')).rows.length === 0, 'signed-out visitors cannot read moves');
// An older move (written as the owner of the table) can't be changed or taken back.
await db.query(`insert into public.peoples_moves (user_id, day, card, dir) values ($1, (now() at time zone 'utc')::date - 40, 'alcohol-tax', 1), ($1, (now() at time zone 'utc')::date - 5, 'gas-tax-15c', 1)`, [U[5]]);
ok((await as(U[5], `update public.peoples_moves set dir = -1 where card = 'gas-tax-15c'`)).affectedRows === 0, 'yesterday’s moves stay as they were');
ok((await as(U[5], `delete from public.peoples_moves where card = 'gas-tax-15c'`)).affectedRows === 0, 'yesterday’s moves cannot be taken back');
await as(U[2], `delete from public.peoples_moves where day = (now() at time zone 'utc')::date`);
ok((await as(U[2], 'select * from public.peoples_moves')).rows.length === 0, 'today’s move can be taken back');
const pb = (await as(null, 'select public.peoples_budget() as t')).rows[0].t;
console.log('  peoples_budget:', JSON.stringify(pb));
ok(pb.cards['vat-5pct'].net === 2 && pb.cards['chained-cpi'].net === -1 && pb.cards['gas-tax-15c'].net === 1, 'net pushes per card');
ok(!pb.cards['alcohol-tax'] && pb.contributors === 4 && pb.today === 3 && pb.all_time === 5, 'moves older than 30 days drop out');
ok((await as(null, 'select public.peoples_budget(60) as t')).rows[0].t.cards['alcohol-tax'].net === 1, 'a longer window can be asked for');
const pr = (await as(null, 'select * from public.peoples_recent(3)')).rows;
ok(pr.length === 3 && pr.every((r) => !('user_id' in r)) && Object.keys(pr[0]).join() === 'card,dir,at', 'recent moves carry no identity');

// Rooms: a group plays one level together.
const room = (await as(U[0], `insert into public.rooms (name, level) values ('Ms. Lee’s 3rd period', 10) returning code`)).rows[0].code;
ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/.test(room), 'room code: ' + room);
ok(await fails(() => as(U[0], `insert into public.rooms (name, level) values ($1, 10)`, ['x'.repeat(41)])), 'room names are at most 40 characters');
ok(await fails(() => as(U[0], `insert into public.rooms (name, level) values ('Class', 7)`)), 'rooms play a budget-desk level');
ok(await fails(() => as(U[0], `insert into public.rooms (name, level) values ($1, 10)`, ['bad\nname'])), 'no control characters in room names');
await as(U[1], 'insert into public.room_members (room) values ($1)', [room]);
await as(U[2], 'insert into public.room_members (room) values ($1)', [room]);
ok(await fails(() => as(U[1], 'insert into public.room_members (room) values ($1)', [room])), 'joining twice is refused');
ok(await fails(() => as(U[1], 'insert into public.room_members (room, user_id) values ($1, $2)', [room, U[3]])), 'cannot join for someone else');
ok(await fails(() => as(U[1], `insert into public.room_members (room) values ('ZZZZZZ')`)), 'cannot join a room that doesn’t exist');
const gr = (await as(null, 'select public.get_room($1) as r', [room.toLowerCase()])).rows[0].r;
ok(gr.name === 'Ms. Lee’s 3rd period' && gr.level === 10 && gr.members === 2 && gr.plans === 0 && gr.mine === false, 'anyone with the code sees the room (any letter case)');
ok((await as(U[0], 'select public.get_room($1) as r', [room])).rows[0].r.mine === true, 'the starter is told it’s their room');
await as(U[1], `update public.room_members set cards = '{income-tax-rates-1pt,cut-defense-budget}', stars = 2, plan_at = now() where room = $1`, [room]);
await as(U[2], `update public.room_members set cards = '{income-tax-rates-1pt}', stars = 1, plan_at = now() where room = $1`, [room]);
ok((await as(U[1], `update public.room_members set cards = '{}' where user_id = $1`, [U[2]])).affectedRows === 0, 'cannot change another member’s plan');
ok((await as(U[0], 'select * from public.room_members')).rows.length === 0, 'the starter cannot list members');
let rt = (await as(null, 'select public.room_totals($1) as t', [room])).rows[0].t;
console.log('  room_totals (2 members):', JSON.stringify(rt));
ok(rt.members === 2 && rt.plans === 2 && rt.cards['income-tax-rates-1pt'] === 2 && rt.cards['cut-defense-budget'] === 1 && rt.stars['2'] === 1, 'room totals');
ok(rt.votes === null, 'no vote breakdown with fewer than 3 members');
await as(U[3], 'insert into public.room_members (room) values ($1)', [room]);
rt = (await as(null, 'select public.room_totals($1) as t', [room])).rows[0].t;
ok(rt.members === 3 && rt.votes && rt.votes.voters === 2 && rt.votes.issues.goal.balance === 1, 'vote breakdown once 3 have joined');
ok((await as(U[1], `update public.rooms set name = 'Mine now' where code = $1`, [room])).affectedRows === 0, 'only the starter can rename a room');
ok((await as(U[0], `update public.rooms set name = 'Ms. Lee’s class' where code = $1`, [room])).affectedRows === 1, 'the starter can rename it');
await as(U[3], 'delete from public.room_members where room = $1', [room]);
ok((await as(null, 'select public.get_room($1) as r', [room])).rows[0].r.members === 2, 'members can leave');
let roomCap = false;
for (let k = 0; k < 11; k++) { try { await as(U[4], `insert into public.rooms (name, level) values ('Room ${k}', 5)`); } catch (e) { roomCap = /Too many new rooms/.test(e.message); break; } }
ok(roomCap, 'daily cap on new rooms');
ok((await as(null, `select public.room_totals('ZZZZZZ') as t`)).rows[0].t === null, 'no totals for a room that doesn’t exist');
const closing = (await as(U[5], `insert into public.rooms (name, level) values ('Family night', 8) returning code`)).rows[0].code;
await as(U[6], 'insert into public.room_members (room) values ($1)', [closing]);
await as(U[5], 'delete from public.rooms where code = $1', [closing]);
ok((await as(null, 'select public.get_room($1) as r', [closing])).rows[0].r === null, 'the starter can close a room, and its memberships go with it');

// Share stats: anonymous counts of shares and opened links, and where new players came from.
for (let k = 0; k < 3; k++) await as(null, `select public.count_share('plan', 'wh')`);
await as(U[1], `select public.count_share('story', 'x')`);
await as(null, `select public.count_arrival('plan', 'wh')`);
await as(null, `select public.count_arrival('plan', 'wh')`);
await as(null, `select public.count_share('nonsense', 'wh')`);
await as(null, `select public.count_share('plan', 'myspace')`);
ok(await fails(() => as(null, `insert into public.share_counts (day, kind, channel, shares) values (current_date, 'plan', 'x', 999)`)), 'nobody writes the counts directly');
ok((await as(null, 'select * from public.share_counts')).rows.length === 0 && (await as(U[1], 'select * from public.share_counts')).rows.length === 0, 'nobody reads the counts directly');
await as(U[2], `update public.players set came_from = 'plan', channel = 'wh' where user_id = $1`, [U[2]]);
ok(await fails(() => as(U[3], `update public.players set came_from = 'spam' where user_id = $1`, [U[3]])), 'came_from must be a known kind of link');
const ss = (await as(null, 'select public.share_stats(30) as s')).rows[0].s;
console.log('  share_stats:', JSON.stringify(ss));
ok(ss.shares.plan.wh === 3 && ss.shares.story.x === 1 && !ss.shares.nonsense && !(ss.shares.plan.myspace), 'shares by kind and channel; unknown ones ignored');
ok(ss.arrivals.plan.wh === 2 && ss.daily.length === 1 && ss.daily[0].shares === 4 && ss.daily[0].arrivals === 2, 'opened links, and the daily totals');
ok(ss.players.plan.wh === 1 && ss.players.site.wh === 5 && ss.players.site.direct === 1 && ss.players_all === 7, 'new players by where they came from');
await db.query(`update public.players set created_at = now() - interval '60 days' where user_id = $1`, [U[2]]);
ok(!(await as(null, 'select public.share_stats(30) as s')).rows[0].s.players.plan, 'players outside the window are left out');

// The challenge funnel.
for (const st of ['taken', 'taken', 'met', 'returned', 'bogus']) await as(null, 'select public.count_challenge_step($1)', [st]);
ok((await as(null, 'select * from public.challenge_steps')).rows.length === 0, 'nobody reads the funnel counts directly');
ok(await fails(() => as(null, `insert into public.challenge_steps (day, step, n) values (current_date, 'met', 50)`)), 'nobody writes the funnel counts directly');
const fu = (await as(null, 'select public.share_stats(30) as s')).rows[0].s.funnel;
ok(fu.taken === 2 && fu.met === 1 && fu.returned === 1, 'funnel steps counted; unknown steps ignored');

// Daily Dollar reminders: devices opt in; only the sender (service role) sees who is due.
const sub = (n) => ({ endpoint: `https://push.example.com/send/device-${n}`, p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) });
const save = (u, d, hour, tz) => as(u, 'select public.save_push_subscription($1, $2, $3, $4, $5)', [d.endpoint, d.p256dh, d.auth, hour, tz]);
const asService = async (q, params = []) => { await db.exec('reset role; set role service_role;'); try { return await db.query(q, params); } finally { await db.exec('reset role;'); } };
ok(await fails(() => save(null, sub(1), 8, 'America/Chicago')), 'signed-out visitors cannot turn reminders on');
await save(U[1], sub(1), 8, 'America/Chicago');
await save(U[1], sub(1), 9, 'America/Chicago'); // a new hour for the same device: still one row
await save(U[2], sub(2), 7, 'Not/AZone');
ok((await as(U[1], 'select hour from public.push_subscriptions')).rows.map((r) => r.hour).join() === '9', 'a player sees only their own devices, one row per device');
ok((await as(U[3], 'select * from public.push_subscriptions')).rows.length === 0 && (await as(null, 'select * from public.push_subscriptions')).rows.length === 0, 'nobody else sees them');
ok((await db.query(`select tz from public.push_subscriptions where endpoint = $1`, [sub(2).endpoint])).rows[0].tz === 'America/New_York', 'an unknown time zone falls back to Eastern time');
ok(await fails(() => as(U[3], `insert into public.push_subscriptions (endpoint, p256dh, auth, hour, tz) values ('https://x.example/1', $1, $2, 8, 'UTC')`, [sub(3).p256dh, sub(3).auth])), 'no direct inserts');
ok((await as(U[3], `update public.push_subscriptions set hour = 3`)).affectedRows === 0, 'no changing other players’ devices');
ok(await fails(() => as(U[1], `select public.save_push_subscription('http://insecure.example/1', $1, $2, 8, 'UTC')`, [sub(3).p256dh, sub(3).auth])), 'push addresses must be https');
ok(await fails(() => as(U[1], 'select * from public.due_reminders()')) && await fails(() => as(null, 'select public.mark_reminders_sent($1)', [[sub(1).endpoint]])), 'players cannot list or mark reminders');
await save(U[3], sub(3), 0, 'UTC'); await save(U[4], sub(4), 0, 'UTC');
await db.query(`update public.push_subscriptions set hour = extract(hour from now() at time zone 'UTC')::int where endpoint = any($1)`, [[sub(3).endpoint, sub(4).endpoint]]);
await db.query(`update public.push_subscriptions set hour = (extract(hour from now() at time zone 'UTC')::int + 12) % 24 where endpoint = $1`, [sub(4).endpoint]);
const due1 = (await asService('select endpoint from public.due_reminders()')).rows.map((r) => r.endpoint);
ok(due1.includes(sub(3).endpoint) && !due1.includes(sub(4).endpoint), 'due: devices whose hour has come, in their own time zone');
await asService('select public.mark_reminders_sent($1)', [[sub(3).endpoint]]);
ok(!(await asService('select endpoint from public.due_reminders()')).rows.some((r) => r.endpoint === sub(3).endpoint), 'one reminder a day at most');
await asService('select public.drop_push_subscriptions($1)', [[sub(4).endpoint]]);
const w1 = (await asService('select * from public.claim_welcome($1)', [sub(1).endpoint])).rows.length;
const w2 = (await asService('select * from public.claim_welcome($1)', [sub(1).endpoint])).rows.length;
ok(w1 === 1 && w2 === 0, 'the "reminders are on" message goes once');
await as(null, 'select public.remove_push_subscription($1)', [sub(2).endpoint]);
const rs = (await as(null, 'select public.reminder_stats(30) as s')).rows[0].s;
console.log('  reminder_stats:', JSON.stringify(rs));
ok(rs.devices === 2 && rs.sent === 1, 'reminder stats: devices with reminders on, and reminders sent');
ok((await as(null, 'select * from public.reminder_counts')).rows.length === 0, 'nobody reads the reminder counts directly');
await as(null, `select public.count_arrival('daily', 'pu')`);
ok((await as(null, 'select public.share_stats(30) as s')).rows[0].s.arrivals.daily.pu === 1, 'opening the game from a reminder counts as its own channel');

// Deleting a user removes their data.
await db.query('delete from auth.users where id = $1', [U[0]]);
ok((await as(null, 'select public.ballot_totals() as t')).rows[0].t.voters === 2, 'deleting a user removes their ballot');
await db.query('delete from auth.users where id = $1', [U[1]]);
ok(!(await db.query('select 1 from public.push_subscriptions where endpoint = $1', [sub(1).endpoint])).rows.length, 'deleting a user removes their devices');

// ZIP codes on ballots: optional, private to the player, and counted only in groups of 10 or more.
const Z = Array.from({ length: 12 }, (_, i) => `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`);
for (const u of Z) await db.query('insert into auth.users (id) values ($1)', [u]);
const zb = (zip, state, o = {}) => JSON.stringify({ options: o.options ?? { 'cut-defense-budget': 1 }, plan: null, issues: o.issues ?? { goal: 'stabilize' }, updated: '2026-11-12T00:00:00Z', ...(zip ? { zip } : {}), ...(state ? { state } : {}) });
ok(await fails(() => as(Z[0], 'insert into public.ballots (ballot) values ($1)', [zb('2230', 'VA')])), 'a ZIP must be five digits');
ok(await fails(() => as(Z[0], 'insert into public.ballots (ballot) values ($1)', [zb('22301', 'Virginia')])), 'the state with a ZIP must be a two-letter code');
for (let i = 0; i < 9; i++) await as(Z[i], 'insert into public.ballots (ballot) values ($1)', [zb(`2230${i}`, 'VA', { options: { 'cut-defense-budget': i < 6 ? 1 : -1 } })]);
ok((await as(Z[1], 'select ballot from public.ballots')).rows.length === 1 && (await as(Z[1], 'select ballot from public.ballots')).rows[0].ballot.zip === '22301', 'a player sees their own ZIP, and no one else’s ballot');
let at = (await as(null, 'select public.ballot_area_totals() as t')).rows[0].t;
ok(at.min === 10 && !at.states.VA && !at.zip3['223'], 'nine Virginia ballots: too few to show');
await as(Z[9], 'insert into public.ballots (ballot) values ($1)', [zb('22314', 'VA', { issues: { goal: 'balance' } })]);
await as(Z[10], 'insert into public.ballots (ballot) values ($1)', [zb('10001', 'NY')]);
await as(Z[11], 'insert into public.ballots (ballot) values ($1)', [zb(null, null)]);
at = (await as(null, 'select public.ballot_area_totals() as t')).rows[0].t;
console.log('  ballot_area_totals:', JSON.stringify(at));
ok(at.states.VA.voters === 10 && at.states.VA.options['cut-defense-budget'].support === 7 && at.states.VA.options['cut-defense-budget'].oppose === 3 && at.states.VA.issues.goal.stabilize === 9 && at.states.VA.issues.goal.balance === 1, 'ten Virginia ballots: counted by state');
ok(at.zip3['223']?.voters === 10 && !at.states.NY && !at.zip3['100'], 'and by 3-digit area (223); New York’s one ballot stays hidden');
ok(!/\b\d{5}\b/.test(JSON.stringify(at)), 'the totals never contain a five-digit ZIP');
ok((await as(null, 'select public.ballot_totals() as t')).rows[0].t.voters >= 12, 'ballots with a ZIP still count in the overall totals');
await as(Z[9], `update public.ballots set ballot = ballot - 'zip' - 'state'`);
at = (await as(null, 'select public.ballot_area_totals() as t')).rows[0].t;
ok(!at.states.VA && !at.zip3['223'], 'removing one ZIP drops Virginia back under 10, so it disappears');
for (const u of Z) await db.query('delete from auth.users where id = $1', [u]);

// The feed's polls: one answer per player per card, changeable; counts only.
const F = ['00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f4'];
for (const u of F) await db.query('insert into auth.users (id) values ($1)', [u]);
await as(F[0], `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'yes'), ('bill:hr227-119', 'support')`);
await as(F[1], `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'no')`);
await as(F[2], `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'unsure')`);
ok(await fails(() => as(F[1], `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'yes')`)), 'feed: one answer per player per card');
await as(F[1], `update public.feed_votes set choice = 'yes' where item = 'poll:carbon-tax-25'`);
ok(await fails(() => as(F[3], `insert into public.feed_votes (item, choice) values ('poll:Carbon Tax', 'yes')`)) && await fails(() => as(F[3], `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'maybe-later')`)), 'feed: odd card ids and choices are refused');
ok(await fails(() => as(null, `insert into public.feed_votes (item, choice) values ('poll:carbon-tax-25', 'yes')`)), 'feed: answering needs a sign-in');
ok((await as(F[1], 'select * from public.feed_votes')).rows.length === 1, 'feed: a player sees only their own answers');
await as(F[1], `update public.feed_votes set choice = 'no' where user_id = '${F[0]}'`);
ok((await as(F[0], 'select choice from public.feed_votes where item = $1', ['poll:carbon-tax-25'])).rows[0].choice === 'yes', 'feed: no one changes another player’s answer');
const ft = (await as(null, `select public.feed_tallies(array['poll:carbon-tax-25', 'bill:hr227-119', 'poll:nothing-here']) as t`)).rows[0].t;
console.log('  feed_tallies:', JSON.stringify(ft));
ok(ft['poll:carbon-tax-25'].yes === 2 && ft['poll:carbon-tax-25'].unsure === 1 && Number(ft['poll:carbon-tax-25'].total) === 3 && ft['bill:hr227-119'].support === 1 && !ft['poll:nothing-here'], 'feed: counts per card, for anyone, with no identities');
await as(F[2], `delete from public.feed_votes where item = 'poll:carbon-tax-25'`);
ok(Number((await as(null, `select public.feed_tallies(array['poll:carbon-tax-25']) as t`)).rows[0].t['poll:carbon-tax-25'].total) === 2, 'feed: a player can take an answer back');

// Following bills: one row per player per bill; the sender lists devices whose followed bill moved.
const G = ['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3'];
for (const u of G) await db.query('insert into auth.users (id) values ($1)', [u]);
const gsub = (k) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/follow-${k}`, p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) });
await save(G[0], gsub(0), 8, 'America/Chicago');
await save(G[1], gsub(1), 8, 'America/Chicago');
await as(G[0], `insert into public.bill_follows (bill, status) values ('s1176-119', 'Introduced'), ('hr1-119', 'Became law')`);
await as(G[1], `insert into public.bill_follows (bill, status) values ('s1176-119', 'Introduced')`);
await as(G[2], `insert into public.bill_follows (bill, status) values ('s1176-119', 'Introduced')`); // no device with notifications
ok(await fails(() => as(G[0], `insert into public.bill_follows (bill, status) values ('s1176-119', 'Introduced')`)), 'follows: once per bill');
ok(await fails(() => as(G[0], `insert into public.bill_follows (bill, status) values ('Not a bill', 'x')`)), 'follows: odd bill ids are refused');
ok(await fails(() => as(null, `insert into public.bill_follows (bill, status) values ('s5-119', 'Introduced')`)), 'follows: need a sign-in');
ok((await as(G[1], 'select bill from public.bill_follows')).rows.length === 1, 'follows: a player sees only their own');
ok(await fails(() => as(G[0], `select * from public.bill_alerts_due('{}'::jsonb)`)) && await fails(() => as(G[0], `select public.mark_bills_alerted('{}'::jsonb)`)), 'follows: players cannot list or mark alerts');
const nowStages = JSON.stringify({ 's1176-119': 'Passed Senate', 'hr1-119': 'Became law' });
const dueB = (await asService('select endpoint, bill, status from public.bill_alerts_due($1::jsonb)', [nowStages])).rows;
console.log('  bill_alerts_due:', JSON.stringify(dueB.map((r) => [r.endpoint.slice(-8), r.bill, r.status])));
ok(dueB.length === 2 && dueB.every((r) => r.bill === 's1176-119' && r.status === 'Passed Senate') && dueB.some((r) => r.endpoint === gsub(0).endpoint) && dueB.some((r) => r.endpoint === gsub(1).endpoint), 'follows: a moved bill reaches each follower’s device; an unmoved one doesn’t');
const marked = (await asService('select public.mark_bills_alerted($1::jsonb) as n', [nowStages])).rows[0].n;
ok(marked === 3 && (await asService('select * from public.bill_alerts_due($1::jsonb)', [nowStages])).rows.length === 0, `follows: after the alerts, every follower is up to date (${marked} rows), so nothing goes twice`);
await as(G[1], `delete from public.bill_follows where bill = 's1176-119'`);
ok((await as(G[1], 'select * from public.bill_follows')).rows.length === 0, 'follows: a player can stop following');

// Play counts (the playtest): anonymous daily totals only, from a fixed list of metrics.
for (const [m, k] of [['desk_open', 'level-5'], ['desk_open', 'level-5'], ['desk_play', 'level-5'], ['desk_done', 'level-5'], ['ripple_time', '30-60'], ['poll_view', 'feed'], ['poll_vote', 'feed'], ['free_roam', 'on'], ['jump_ahead', 'level-7'], ['quick_start', 'level-2'], ['quick_done', 'level-2']]) await as(null, 'select public.count_play($1, $2)', [m, k]);
await as(G[0], `select public.count_play('desk_open', 'level-8')`);
await as(null, `select public.count_play('desk_open', 'level-99')`);
await as(null, `select public.count_play('who_played', 'rich@example.com')`);
await as(null, `select public.count_play('ripple_time', '12.34')`);
const ps = (await as(null, 'select public.play_stats(30) as s')).rows[0].s;
console.log('  play_stats:', JSON.stringify(ps.totals));
ok(ps.totals.desk_open['level-5'] === 2 && ps.totals.desk_open['level-8'] === 1 && ps.totals.desk_play['level-5'] === 1 && ps.totals.desk_done['level-5'] === 1, 'play counts: desks opened, started and finished, as daily totals');
ok(ps.totals.ripple_time['30-60'] === 1 && ps.totals.poll_vote.feed === 1 && ps.totals.quick_done['level-2'] === 1 && ps.totals.jump_ahead['level-7'] === 1, 'play counts: ripple time in buckets, polls, quick play, jump-ahead');
ok(!ps.totals.who_played && !ps.totals.desk_open['level-99'] && !ps.totals.ripple_time['12.34'], 'play counts: unknown metrics and keys are ignored (nothing personal can be stored)');
ok(Array.isArray(ps.daily) && ps.daily.every((r) => Object.keys(r).sort().join() === 'day,key,metric,n'), 'play counts: the daily rows hold only a day, a metric, a key and a count');
ok(await fails(() => as(null, `insert into public.play_counts (day, metric, key, n) values (current_date, 'desk_open', 'level-5', 999)`)), 'play counts: nobody writes the counts directly');
ok((await as(null, 'select * from public.play_counts')).rows.length === 0 && (await as(G[0], 'select * from public.play_counts')).rows.length === 0, 'play counts: nobody reads the table directly');

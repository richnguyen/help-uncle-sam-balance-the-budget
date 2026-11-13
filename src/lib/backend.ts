import { load, save } from './storage';
import { turnstileToken } from './turnstile';

// The public site's shared database (Supabase): anonymous sign-in and a few table and function
// calls over plain HTTPS, without the full client library. The URL and the publishable key are
// public by design; row-level security on the server decides what each visitor may do
// (see supabase/migrations). The claude.ai copy uses the artifact's own database instead.

export const SUPABASE_URL = 'https://ygphfbeqgguypvmiundz.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_2ACWxnafBpBmGxgUtu0ScQ_oj-Xw2oX';

/**
 * Only the real site writes to the real database. Anywhere else (a local build, a preview, a fork)
 * it stays off unless switched on for testing with localStorage "ftd:backend" = "on".
 */
export const backendOn = (): boolean => {
  if (__ARTIFACT__ || typeof window === 'undefined' || typeof fetch !== 'function') return false;
  if ((window as { claude?: unknown }).claude) return false;
  const host = location.hostname;
  return host === 'balancethebudget.us' || host === 'www.balancethebudget.us' || load<string>('backend', '') === 'on';
};

interface Session { access_token: string; refresh_token: string; expires_at: number; user: { id: string } }
let current: Session | null = null;
let pending: Promise<Session | null> | null = null;

const headers = (token?: string) => ({ apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

async function authCall(path: string, body: object): Promise<Session | null> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) return null;
  const s = await r.json() as { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; user: { id: string } };
  const out: Session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + s.expires_in, user: { id: s.user.id } };
  save('sb-session', out);
  return out;
}

/** The saved session, refreshed when close to expiry, or null if this browser never signed in. */
export async function existingSession(): Promise<Session | null> {
  current ??= load<Session | null>('sb-session', null);
  if (!current) return null;
  if (current.expires_at - 60 > Date.now() / 1000) return current;
  pending ??= authCall('token?grant_type=refresh_token', { refresh_token: current.refresh_token }).finally(() => { pending = null; });
  const s = await pending;
  if (!s) { current = null; save('sb-session', null); }
  return (current = s);
}

/**
 * Signs in anonymously the first time something needs saving (no email, no name). Visitors who
 * only look around never get an account.
 */
export async function session(): Promise<Session | null> {
  const s = await existingSession();
  if (s) return s;
  // A fresh Turnstile token goes with the sign-in; Supabase Auth verifies it with Cloudflare on the
  // server (see turnstile.ts). Without CAPTCHA switched on in Supabase, the token is simply ignored.
  pending ??= (async () => {
    const token = await turnstileToken();
    return authCall('signup', { data: {}, ...(token ? { gotrue_meta_security: { captcha_token: token } } : {}) });
  })().finally(() => { pending = null; });
  return (current = await pending);
}

export class BackendError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function call<T>(path: string, init: RequestInit & { auth?: boolean; prefer?: string } = {}): Promise<T> {
  const s = init.auth ? await session() : await existingSession();
  if (init.auth && !s) throw new BackendError(401, 'sign-in failed');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(s?.access_token), ...(init.prefer ? { Prefer: init.prefer } : {}) },
  });
  if (!r.ok) throw new BackendError(r.status, await r.text().catch(() => ''));
  const text = await r.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Calls one of the public totals functions (no sign-in needed). */
export const rpc = <T>(fn: string, args: object = {}) => call<T>(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
/** Calls a function that acts for this player (signing in first if needed). */
export const authRpc = <T>(fn: string, args: object = {}) => call<T>(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args), auth: true });

/** Saves this player's single row in a table (insert or replace). */
export const upsertOwn = (table: 'ballots' | 'players' | 'peoples_moves' | 'feed_votes', row: object) =>
  call<null>(table, { method: 'POST', body: JSON.stringify(row), auth: true, prefer: 'resolution=merge-duplicates,return=minimal' });

/** This player's own row, if they have signed in before. */
export async function readOwn<T>(table: 'ballots' | 'players', columns: string): Promise<T | null> {
  if (!(await existingSession())) return null;
  const rows = await call<T[]>(`${table}?select=${columns}`);
  return rows?.[0] ?? null;
}

/** Stores a shared plan and returns its short id. */
export async function createPlan(row: { level: number; code: string; cards: string[]; stars: number; revenue_share: number | null; by_name: string | null }) {
  const rows = await call<{ id: string }[]>('plans?select=id', { method: 'POST', body: JSON.stringify(row), auth: true, prefer: 'return=representation' });
  return rows?.[0]?.id ?? null;
}

// ---------- the People's Budget: one move a day ----------
/** Today's date on the server's clock (UTC), which is when a day's move resets. */
export const todayUTC = () => new Date().toISOString().slice(0, 10);

export interface Move { card: string; dir: 1 | -1 }

/** This player's move today, if they have made one (and have ever signed in). */
export async function myMoveToday(): Promise<Move | null> {
  if (!(await existingSession())) return null;
  const rows = await call<Move[]>(`peoples_moves?select=card,dir&day=eq.${todayUTC()}`);
  return rows?.[0] ?? null;
}

/** Makes today's move, or replaces it (signing in first if needed). */
export const saveMove = (m: Move) => upsertOwn('peoples_moves', { card: m.card, dir: m.dir });

/** Takes back today's move. */
export const takeBackMove = () => call<null>(`peoples_moves?day=eq.${todayUTC()}`, { method: 'DELETE', auth: true, prefer: 'return=minimal' });

// ---------- rooms: a group plays one level together ----------
export interface Room { code: string; name: string; level: number; created_at: string; members: number; plans: number; mine: boolean }
export interface Membership { room: string; joined_at: string; cards: string[] | null; stars: number | null }
export const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/;

/** A room by its code (no sign-in needed), or null if there is none. */
export const getRoom = (code: string) => rpc<Room | null>('get_room', { room_code: code.toUpperCase() });

/** Starts a room and returns its code. */
export async function createRoom(name: string, level: number) {
  const rows = await call<{ code: string }[]>('rooms?select=code', { method: 'POST', body: JSON.stringify({ name, level }), auth: true, prefer: 'return=representation' });
  return rows?.[0]?.code ?? null;
}

/** This player's membership in a room, if they joined (and have ever signed in). */
export async function myMembership(code: string): Promise<Membership | null> {
  if (!(await existingSession())) return null;
  const rows = await call<Membership[]>(`room_members?select=room,joined_at,cards,stars&room=eq.${code}`);
  return rows?.[0] ?? null;
}

export const joinRoom = (code: string) => call<null>('room_members', { method: 'POST', body: JSON.stringify({ room: code }), auth: true, prefer: 'resolution=ignore-duplicates,return=minimal' });
export const leaveRoom = (code: string) => call<null>(`room_members?room=eq.${code}`, { method: 'DELETE', auth: true, prefer: 'return=minimal' });

/** Sends this member's latest plan for the room's level. */
export const sendRoomPlan = (code: string, cards: string[], stars: number) =>
  call<null>(`room_members?room=eq.${code}`, { method: 'PATCH', body: JSON.stringify({ cards: [...cards].sort(), stars, plan_at: new Date().toISOString() }), auth: true, prefer: 'return=minimal' });

/** Closes a room the player started (its memberships go with it). */
export const closeRoom = (code: string) => call<null>(`rooms?code=eq.${code}`, { method: 'DELETE', auth: true, prefer: 'return=minimal' });

// ---------- share stats: anonymous counts of shares and opened links ----------
export type LinkKind = 'plan' | 'story' | 'clip' | 'daily' | 'peoples' | 'room' | 'chain' | 'level' | 'site';
export const LINK_KINDS: LinkKind[] = ['plan', 'story', 'clip', 'daily', 'peoples', 'room', 'chain', 'level', 'site'];
// 'pu': opened from a Daily Dollar reminder (a push notification).
export const CHANNELS = ['x', 'fa', 'li', 're', 'bl', 'th', 'wh', 'em', 'sh', 'cp', 'pu'] as const;

/** Counts one share (fire and forget; nothing identifies who shared). */
export function countShare(kind: LinkKind, channel: string) {
  if (!backendOn() || !(CHANNELS as readonly string[]).includes(channel)) return;
  rpc('count_share', { p_kind: kind, p_channel: channel }).catch(() => {});
}
/** Counts one opened link. */
export function countArrival(kind: LinkKind, channel: string) {
  if (!backendOn() || !(CHANNELS as readonly string[]).includes(channel)) return;
  rpc('count_arrival', { p_kind: kind, p_channel: channel }).catch(() => {});
}

// ---------- challenge funnel: taken → goal met → sent back ----------
export type ChallengeStep = 'taken' | 'met' | 'returned';
/** Counts one step of a friend's challenge, once per challenge per browser (no identity is sent). */
export function countStep(step: ChallengeStep, challengeKey: string) {
  if (!backendOn()) return;
  const seen = load<Record<string, ChallengeStep[]>>('steps', {});
  const list = seen[challengeKey] ?? [];
  if (list.includes(step)) return;
  seen[challengeKey] = [...list, step];
  save('steps', Object.fromEntries(Object.entries(seen).slice(-50)));
  rpc('count_challenge_step', { p_step: step }).catch(() => {});
}

// The feed's polls (feed_votes): one answer per player per card, and the counts.
export type FeedTallies = Record<string, Record<string, number>>;
export const feedTallies = (items: string[]) => rpc<FeedTallies>('feed_tallies', { items: items.slice(0, 50) });
export const saveFeedVote = (item: string, choice: string) => upsertOwn('feed_votes', { item, choice });

// The Daily Dollar reminder sender: a Supabase Edge Function (Deno). One file, no dependencies, so it
// can be pasted into the dashboard's editor. Web Push is done here with the Web Crypto API:
// messages are encrypted for each device (RFC 8291, "aes128gcm") and signed with the site's VAPID
// key (RFC 8292), then posted to the device's push service (Google, Apple or Mozilla).
//
//   GET                        -> { publicKey }: the site asks for this before a device subscribes
//   POST { "welcome": address } -> "Reminders are on", once, to a device that opted in < 10 min ago
//   POST + header x-cron-secret -> today's reminder to every device whose chosen hour has come
//                                  (Supabase Cron calls this every hour; see supabase/README.md),
//                                  then an alert to every device that follows a bill that moved
//                                  (the stages come from the site's own bills.json)
//
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (https://balancethebudget.us or a mailto: address), CRON_SECRET. Supabase provides SUPABASE_URL
// and the service key itself. Deploy with JWT verification off: this function checks its own callers.

// deno-lint-ignore no-explicit-any
declare const Deno: any;

export interface Env {
  SUPABASE_URL: string;
  SERVICE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  CRON_SECRET: string;
}
interface Device { endpoint: string; p256dh: string; auth: string }

const ORIGINS = ['https://balancethebudget.us', 'https://www.balancethebudget.us'];
const SITE = 'https://balancethebudget.us/';

// ---------- base64url and bytes ----------
const enc = new TextEncoder();
export const b64u = {
  encode(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(s: string): Uint8Array {
    const t = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// ---------- RFC 8291: encrypt a message so only the device can read it ----------
export async function encryptFor(device: Pick<Device, 'p256dh' | 'auth'>, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64u.decode(device.p256dh);
  const authSecret = b64u.decode(device.auth);
  const mine = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', mine.publicKey));
  const theirs = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: theirs }, mine.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the message, then the 0x02 delimiter that marks the last record.
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, body);
}

// ---------- RFC 8292: sign the request with the site's VAPID key ----------
export async function vapidHeader(endpoint: string, env: Pick<Env, 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'>): Promise<string> {
  const pub = b64u.decode(env.VAPID_PUBLIC_KEY);
  const jwk: JsonWebKey = { kty: 'EC', crv: 'P-256', x: b64u.encode(pub.slice(1, 33)), y: b64u.encode(pub.slice(33, 65)), d: b64u.encode(b64u.decode(env.VAPID_PRIVATE_KEY)), ext: true };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = (o: object) => b64u.encode(enc.encode(JSON.stringify(o)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export type Sent = 'ok' | 'gone' | 'failed';
export async function sendPush(device: Device, message: object, env: Env, fetchImpl: typeof fetch = fetch): Promise<Sent> {
  try {
    const r = await fetchImpl(device.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(device.endpoint, env),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(12 * 3600), // undelivered after 12 hours: drop it, tomorrow brings a new one
        Urgency: 'normal',
        Topic: 'daily-dollar', // a newer reminder replaces one still waiting on the device
      },
      body: await encryptFor(device, enc.encode(JSON.stringify(message))),
    });
    if (r.status === 404 || r.status === 410) return 'gone';
    return r.ok ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}

// ---------- the database, through its sender-only functions ----------
async function db<T>(env: Env, fn: string, args: object, fetchImpl: typeof fetch): Promise<T> {
  const jwt = env.SERVICE_KEY.startsWith('ey');
  const r = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SERVICE_KEY, ...(jwt ? { Authorization: `Bearer ${env.SERVICE_KEY}` } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return (t ? JSON.parse(t) : null) as T;
}

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? ' a.m.' : ' p.m.'}`;
export const DAILY = { title: 'The Daily Dollar is ready', body: 'Today’s puzzle: five quick higher-or-lower calls on real federal numbers.', url: `${SITE}?daily&s=pu`, tag: 'daily-dollar' };
export const welcome = (hour: number) => ({ title: 'Reminders are on', body: `Uncle Sam will let you know at ${hourLabel(hour)} each day when a new Daily Dollar is ready. Turn it off any time in settings.`, url: `${SITE}#daily`, tag: 'daily-dollar-welcome' });

function json(body: object | null, status: number, origin: string | null) {
  const allow = origin && (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) ? origin : ORIGINS[0];
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' },
  });
}

/** Constant-time comparison for the cron secret. */
function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function handle(req: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return json(null, 204, origin);
  if (req.method === 'GET') return env.VAPID_PUBLIC_KEY ? json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, origin) : json({ error: 'not set up' }, 503, origin);
  if (req.method !== 'POST') return json({ error: 'method' }, 405, origin);
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !env.SERVICE_KEY) return json({ error: 'not set up' }, 503, origin);
  const body = await req.json().catch(() => ({})) as { welcome?: string };

  // A device that just opted in: one confirmation, which also proves the whole path works.
  if (typeof body.welcome === 'string') {
    const rows = await db<(Device & { hour: number })[]>(env, 'claim_welcome', { p_endpoint: body.welcome }, fetchImpl);
    if (!rows.length) return json({ sent: 0 }, 200, origin);
    const result = await sendPush(rows[0], welcome(rows[0].hour), env, fetchImpl);
    if (result === 'gone') await db(env, 'drop_push_subscriptions', { p_endpoints: [rows[0].endpoint] }, fetchImpl);
    return json({ sent: result === 'ok' ? 1 : 0 }, 200, origin);
  }

  // The hourly run.
  if (!same(req.headers.get('x-cron-secret') ?? '', env.CRON_SECRET)) return json({ error: 'forbidden' }, 403, origin);
  const due = await db<Device[]>(env, 'due_reminders', { p_limit: 2000 }, fetchImpl);
  const sent: string[] = [], gone: string[] = [];
  let failed = 0;
  for (let i = 0; i < due.length; i += 25) {
    const batch = due.slice(i, i + 25);
    const results = await Promise.all(batch.map((d) => sendPush(d, DAILY, env, fetchImpl)));
    results.forEach((r, k) => { if (r === 'ok') sent.push(batch[k].endpoint); else if (r === 'gone') gone.push(batch[k].endpoint); else failed++; });
  }
  if (sent.length) await db(env, 'mark_reminders_sent', { p_endpoints: sent }, fetchImpl);
  if (gone.length) await db(env, 'drop_push_subscriptions', { p_endpoints: gone }, fetchImpl);
  // Then the bills players follow. A failure here never stops the reminders above.
  let bills: BillRun = { checked: 0, alerts: 0, sent: 0 };
  try { bills = await billAlerts(env, fetchImpl); } catch (e) { console.error('bill alerts', e); }
  return json({ due: due.length, sent: sent.length, gone: gone.length, failed, bills }, 200, origin);
}

// ---------- bills that players follow ----------
interface PublishedBill { id: string; label: string; title: string; status: string; url: string }
type BillRun = { checked: number; alerts: number; sent: number };
const BILL_ID = /^[a-z]{1,8}[0-9]{1,5}-[0-9]{2,3}$/;

/** The alert for one followed bill that moved: its number and new stage, then its title. */
export const billAlert = (b: PublishedBill) => ({
  title: `${b.label}: ${b.status}`,
  body: `A bill you follow moved. ${b.title.length > 110 ? b.title.slice(0, 107) + '…' : b.title}`,
  url: `${SITE}#guide`,
  tag: `bill-${b.id}`,
});

/** Read the stages the site published, alert the followers of each bill that moved, then remember. */
export async function billAlerts(env: Env, fetchImpl: typeof fetch = fetch): Promise<BillRun> {
  const r = await fetchImpl(`${SITE}bills.json`, { headers: { Accept: 'application/json' } });
  if (!r.ok) return { checked: 0, alerts: 0, sent: 0 };
  const pub = await r.json() as { bills?: PublishedBill[] };
  const bills = (pub.bills ?? []).filter((b) => b && BILL_ID.test(b.id) && typeof b.status === 'string' && b.status.length > 0 && b.status.length <= 40);
  if (!bills.length) return { checked: 0, alerts: 0, sent: 0 };
  const now = Object.fromEntries(bills.map((b) => [b.id, b.status]));
  const byId = Object.fromEntries(bills.map((b) => [b.id, b]));
  const due = await db<(Device & { bill: string; status: string })[]>(env, 'bill_alerts_due', { p_now: now }, fetchImpl);
  let sent = 0;
  const gone = new Set<string>();
  for (let i = 0; i < due.length; i += 25) {
    const batch = due.slice(i, i + 25).filter((d) => !gone.has(d.endpoint) && byId[d.bill]);
    const results = await Promise.all(batch.map((d) => sendPush(d, billAlert({ ...byId[d.bill], status: d.status }), env, fetchImpl)));
    results.forEach((res, k) => { if (res === 'ok') sent++; else if (res === 'gone') gone.add(batch[k].endpoint); });
  }
  if (gone.size) await db(env, 'drop_push_subscriptions', { p_endpoints: [...gone] }, fetchImpl);
  await db(env, 'mark_bills_alerted', { p_now: now }, fetchImpl);
  return { checked: bills.length, alerts: due.length, sent };
}

/** The service key: the new secret key when the project has one, else the legacy service_role key. */
function serviceKey(): string {
  const own = Deno.env.get('SERVICE_KEY');
  if (own) return own;
  try {
    // Supabase injects the project's secret keys as JSON; every project has one named "default".
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (typeof key === 'string' && key) return key;
  } catch { /* not set */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

if (typeof Deno !== 'undefined') {
  Deno.serve((req: Request) => handle(req, {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SERVICE_KEY: serviceKey(),
    VAPID_PUBLIC_KEY: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    VAPID_PRIVATE_KEY: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    VAPID_SUBJECT: Deno.env.get('VAPID_SUBJECT') ?? '',
    CRON_SECRET: Deno.env.get('CRON_SECRET') ?? '',
  }).catch((e: unknown) => { console.error(e); return new Response(JSON.stringify({ error: 'failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }));
}

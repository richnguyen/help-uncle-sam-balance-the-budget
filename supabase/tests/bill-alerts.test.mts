// npm run test:alerts (Node 22: runs the TypeScript directly)
// The sender's bill alerts, with Supabase, the site and the push services as stand-ins.
import { handle, billAlert } from '../functions/daily-reminders/index.ts';
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as ArrayBuffer).toString('base64url');
// A VAPID key pair and two real device keys, so encryption and signing run for real.
const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const vpub = b64u(await crypto.subtle.exportKey('raw', vapid.publicKey));
const vpriv = (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d!;
const device = async (n: number) => { const k = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']); return { endpoint: `https://fcm.googleapis.com/fcm/send/dev-${n}`, p256dh: b64u(await crypto.subtle.exportKey('raw', k.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) }; };
const d1 = await device(1), d2 = await device(2);
const BILLS = { fetchedAt: '2026-11-14T00:00:00Z', bills: [{ id: 's1176-119', label: 'S. 1176', title: 'Healthy Food Access for All Americans Act', status: 'Passed Senate', url: 'https://www.congress.gov/bill/119th-congress/senate-bill/1176' }, { id: 'bad id', label: 'x', title: 'x', status: 'x', url: 'x' }] };
const calls: { url: string; body?: unknown }[] = [];
let gone = false;
const fetchImpl = (async (url: string, init?: RequestInit) => {
  const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ url, body });
  if (url === 'https://balancethebudget.us/bills.json') return new Response(JSON.stringify(BILLS), { status: 200 });
  if (url.endsWith('/rpc/due_reminders')) return new Response('[]', { status: 200 });
  if (url.endsWith('/rpc/bill_alerts_due')) return new Response(JSON.stringify([{ ...d1, bill: 's1176-119', status: 'Passed Senate' }, { ...d2, bill: 's1176-119', status: 'Passed Senate' }]), { status: 200 });
  if (url.includes('/rpc/')) return new Response('null', { status: 200 });
  if (url.startsWith('https://fcm.googleapis.com/')) return new Response('', { status: gone && url.endsWith('dev-2') ? 410 : 201 });
  return new Response('', { status: 404 });
}) as typeof fetch;
const env = { SUPABASE_URL: 'https://x.supabase.co', SERVICE_KEY: 'sb_secret_test', VAPID_PUBLIC_KEY: vpub, VAPID_PRIVATE_KEY: vpriv, VAPID_SUBJECT: 'https://balancethebudget.us', CRON_SECRET: 'c' };
const run = () => handle(new Request('https://f/daily-reminders', { method: 'POST', headers: { 'x-cron-secret': 'c' }, body: '{}' }), env, fetchImpl);
let res = await (await run()).json();
console.log('  response:', JSON.stringify(res));
const pushes = calls.filter((c) => c.url.startsWith('https://fcm.'));
const due = calls.find((c) => c.url.endsWith('/rpc/bill_alerts_due'));
const marked = calls.find((c) => c.url.endsWith('/rpc/mark_bills_alerted'));
ok(res.bills.checked === 1 && res.bills.alerts === 2 && res.bills.sent === 2 && pushes.length === 2, 'the hourly run reads the published bills (odd ids dropped) and alerts both devices that follow the moved bill');
ok(JSON.stringify((due?.body as { p_now: unknown }).p_now) === JSON.stringify({ 's1176-119': 'Passed Senate' }) && !!marked, 'it asks Supabase with the stages now, then marks the followers up to date');
const a = billAlert(BILLS.bills[0]);
ok(a.title === 'S. 1176: Passed Senate' && /^A bill you follow moved\. Healthy Food Access/.test(a.body) && a.url === 'https://balancethebudget.us/#guide' && a.tag === 'bill-s1176-119', `the alert: “${a.title}” · “${a.body}”`);
// A device that's gone is dropped.
calls.length = 0; gone = true;
res = await (await run()).json();
const dropped = calls.find((c) => c.url.endsWith('/rpc/drop_push_subscriptions'));
ok(res.bills.sent === 1 && JSON.stringify((dropped?.body as { p_endpoints: string[] }).p_endpoints) === JSON.stringify([d2.endpoint]), 'a device the push service says is gone is dropped');
// The site unreachable: the reminders still run, nothing else breaks.
const res2 = await (await handle(new Request('https://f/daily-reminders', { method: 'POST', headers: { 'x-cron-secret': 'c' }, body: '{}' }), env, (async (u: string, i?: RequestInit) => (u.endsWith('bills.json') ? new Response('', { status: 503 }) : fetchImpl(u, i))) as typeof fetch)).json();
ok(res2.bills.checked === 0 && res2.due === 0, 'with the site unreachable, the run still finishes and sends no bill alerts');

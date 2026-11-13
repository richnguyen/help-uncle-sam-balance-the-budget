import { useEffect, useState } from 'react';
import { authRpc, backendOn, rpc, SUPABASE_KEY, SUPABASE_URL } from '../lib/backend';
import { load, save } from '../lib/storage';
import { isIOS } from './install';
import { isInstalled } from './resume';

// Daily Dollar reminders: an opt-in notification, at most once a day, at the hour the player picks.
// The browser makes a push subscription for this device (an address at Google's, Apple's or
// Mozilla's push service, plus keys only this device can read with); the game saves it to the
// shared database, and the daily-reminders function sends to it every day (see
// supabase/functions/daily-reminders). On iPhone and iPad, web pages can receive notifications only
// once they're added to the home screen. Public site only.

const FN = `${SUPABASE_URL}/functions/v1/daily-reminders`;
interface Saved { on: boolean; hour: number; endpoint?: string }
const savedState = () => load<Saved>('reminder', { on: false, hour: 8 });

export type Support = 'ok' | 'install-first' | 'unsupported';
export function reminderSupport(): Support {
  if (!__OFFLINE__ || typeof window === 'undefined' || !backendOn()) return 'unsupported';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok';
  return isIOS() && !isInstalled() ? 'install-first' : 'unsupported';
}

// The site's public push key, from the function (null until reminders are set up on the server).
let keyAsk: Promise<string | null> | null = null;
export function serverKey(): Promise<string | null> {
  keyAsk ??= fetch(FN, { headers: { apikey: SUPABASE_KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { publicKey?: string } | null) => j?.publicKey ?? null)
    .catch(() => null)
    .then((k) => { if (!k) setTimeout(() => { keyAsk = null; }, 60000); return k; });
  return keyAsk;
}

const toBytes = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(t + '='.repeat((4 - (t.length % 4)) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const toB64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'; } catch { return 'America/New_York'; } };
const worker = () => Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 10000))]);

export type Result = 'on' | 'denied' | 'dismissed' | 'failed';

/** Turns reminders on for this device, or changes the hour. Call it straight from a tap. */
export async function turnOn(hour: number): Promise<Result> {
  // First, in the tap itself: browsers ask for permission only in response to one.
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'dismissed';
  try {
    const key = await serverKey();
    const reg = await worker();
    if (!key || !reg) return 'failed';
    let sub = await reg.pushManager.getSubscription();
    const subKey = sub?.options?.applicationServerKey;
    if (sub && subKey && toB64u(subKey) !== key) { await sub.unsubscribe().catch(() => {}); sub = null; }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key) });
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await authRpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_hour: hour, p_tz: timeZone() });
    const first = !savedState().on;
    save('reminder', { on: true, hour, endpoint: j.endpoint });
    // "Reminders are on": sent once, by the server, so it also shows the whole path works.
    if (first) fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY }, body: JSON.stringify({ welcome: j.endpoint }) }).catch(() => {});
    return 'on';
  } catch {
    return 'failed';
  }
}

export async function turnOff() {
  const s = savedState();
  save('reminder', { on: false, hour: s.hour });
  try {
    const reg = await worker();
    const sub = await reg?.pushManager.getSubscription();
    const endpoint = sub?.endpoint ?? s.endpoint;
    await sub?.unsubscribe().catch(() => {});
    if (endpoint) await rpc('remove_push_subscription', { p_endpoint: endpoint });
  } catch { /* the server drops it on its own once the push service says it's gone */ }
}

/** Whether this device has notifications on (they carry bill alerts too). */
export const notificationsOn = () => savedState().on && reminderSupport() === 'ok';

/** On each visit: if the browser renewed this device's address, or notifications were blocked since, catch up. */
export function syncReminders() {
  const s = savedState();
  if (!s.on || reminderSupport() !== 'ok') return;
  setTimeout(async () => {
    if (Notification.permission !== 'granted') { void turnOff(); return; }
    const reg = await worker();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub || sub.endpoint !== s.endpoint) void turnOn(s.hour);
  }, 4000);
}

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'a.m.' : 'p.m.'}`;
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 a.m. to 10 p.m.

/** The reminder switch and its hour, for settings and the Daily Dollar. */
export function ReminderControl({ where = 'settings' }: { where?: 'settings' | 'daily' }) {
  const support = reminderSupport();
  const [ready, setReady] = useState<boolean | null>(null);
  const [s, setS] = useState(savedState);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (support === 'ok') void serverKey().then((k) => setReady(!!k)); }, [support]);
  if (support === 'unsupported') return null;
  if (support === 'install-first') {
    return <p className="small muted reminder-note">{where === 'daily' ? 'Want a reminder when the next one is ready? ' : 'Daily Dollar reminders: '}on iPhone and iPad, first add the game to your home screen (Download the game, at the top of the settings menu), then turn reminders on from there.</p>;
  }
  if (!ready) return null;
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const apply = async (on: boolean, hour: number) => {
    // The switch moves at once; it goes back if the browser or the server says no.
    setBusy(true); setNote(''); setS({ on, hour });
    if (!on) { await turnOff(); setS({ on: false, hour }); setBusy(false); return; }
    const r = await turnOn(hour);
    setBusy(false);
    if (r === 'on') { setS({ on: true, hour }); setNote(`Reminders are on: ${hourLabel(hour)} each day.`); }
    else { setS((p) => ({ ...p, on: false, hour })); setNote(r === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser’s settings for balancethebudget.us, then try again.' : r === 'dismissed' ? 'No reminders, then. You can turn them on here any time.' : 'Reminders couldn’t be turned on right now. Try again in a little while.'); }
  };
  return (
    <div className={'reminder' + (where === 'daily' ? ' card reminder-daily' : '')}>
      {where === 'daily' && <strong>Want a nudge when the next one is ready?</strong>}
      <div className="reminder-row">
        <label className="switch"><input type="checkbox" checked={s.on} disabled={busy || (blocked && !s.on)} onChange={(e) => void apply(e.target.checked, s.hour)} /> Remind me about the Daily Dollar</label>
        <label className="small reminder-hour">at{' '}
          <select className="select" value={s.hour} disabled={busy} onChange={(e) => { const h = Number(e.target.value); if (s.on) void apply(true, h); else { setS({ ...s, hour: h }); save('reminder', { ...s, hour: h }); } }}>
            {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
          </select>
        </label>
      </div>
      {blocked && !s.on && <p className="small muted">Notifications are blocked for this site. Allow them in your browser’s settings to use reminders.</p>}
      {note && <p className="small" role="status">{note}</p>}
      <p className="small muted">One a day at most, at the hour you pick, in your time zone. No account or email; turn it off here any time.</p>
    </div>
  );
}

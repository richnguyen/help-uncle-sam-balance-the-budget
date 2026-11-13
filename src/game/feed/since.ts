import { useSyncExternalStore } from 'react';
import { load, save } from '../../lib/storage';
import { mergeNews } from '../news';
import { BILLS, type FeedItem } from './items';

// "New since your last visit". The game keeps when the feed was last open (ftd:feed-last). The
// feed marks posts newer than the visit before this one, kept for the whole session so the
// markers stay put while you read; the Feed tab counts what's arrived since the feed was last
// open. On a first visit nothing is marked new.

const KEY = 'feed-last';
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());

/** The last visit before this session (ISO), or null on a first visit. */
const SINCE: string | null = (() => {
  try {
    const kept = sessionStorage.getItem('ftd:feed-since');
    if (kept !== null) return kept || null;
    const v = load<string | null>(KEY, null);
    sessionStorage.setItem('ftd:feed-since', v ?? '');
    return v;
  } catch { return load<string | null>(KEY, null); }
})();
export const sinceVisit = () => SINCE;

/** The feed is open now: what's in it has been seen. */
export function markFeedSeen() { save(KEY, new Date().toISOString()); ping(); }

const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
/** A bill's dates are days (Washington time); a visit is a moment. New means a later day. */
const dayOf = (iso: string) => ET.format(new Date(iso));

/** Is this post newer than the given visit? Bills (by their summary or latest action) and news. */
export function isNewSince(it: FeedItem, since: string | null): boolean {
  if (!since) return false;
  if (it.kind === 'bill') { const d = dayOf(since); return it.bill.summaryDate > d || (!!it.bill.latestAction.date && it.bill.latestAction.date > d); }
  if (it.kind === 'news') return Date.parse(it.news.time) > Date.parse(since);
  return false;
}

/** How many bills and announcements arrived since the feed was last open (for the Feed tab). */
export function countNew(since: string | null, now = Date.now()): number {
  if (!since) return 0;
  const d = dayOf(since);
  const bills = BILLS.bills.filter((b) => b.summaryDate > d || (!!b.latestAction.date && b.latestAction.date > d)).length;
  const news = mergeNews([], now).filter((n) => Date.parse(n.time) > Date.parse(since)).length;
  return bills + news;
}

const subscribe = (f: () => void) => { subs.add(f); const st = (e: StorageEvent) => { if (e.key === 'ftd:' + KEY) f(); }; addEventListener('storage', st); return () => { subs.delete(f); removeEventListener('storage', st); }; };
/** The live count for the Feed tab: zero once the feed has been opened. */
export function useNewCount() {
  return useSyncExternalStore(subscribe, () => countNew(load<string | null>(KEY, null)), () => 0);
}

/** "Nov 12, 9:40 PM" for the line that says when the last visit was. */
export const visitLabel = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

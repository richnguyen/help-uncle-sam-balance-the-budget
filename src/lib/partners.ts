// Partner codes: a newsletter, creator, teacher group or press piece gets its own link
// (balancethebudget.us/?via=<code>, on any page), and the game counts, anonymously, how many
// people arrive by it and how far they get (supabase/migrations/…_partner_counts.sql). The first
// code a browser arrives with is the one credited; nothing about the player is sent, only the
// code and what happened, each at most once per browser.
import { backendOn, rpc, todayUTC } from './backend';
import { load, save } from './storage';

/** 2-24 characters: lowercase letters, digits and hyphens, starting with a letter or digit. */
export const PARTNER_RE = /^[a-z0-9][a-z0-9-]{1,23}$/;
export type PartnerMetric = 'arrival' | 'played' | 'finished' | 'returned' | 'shared';
export const PARTNER_METRICS: PartnerMetric[] = ['arrival', 'played', 'finished', 'returned', 'shared'];

interface Touch { code: string; day: string }
/** The partner this browser first arrived from, if any. */
export const partnerTouch = (): Touch | null => load<Touch | null>('via', null);

function send(code: string, metric: PartnerMetric) {
  // Tests read what would be sent (nothing else reads this).
  (globalThis as { __plays?: [string, string][] }).__plays?.push([`partner_${metric}`, code]);
  if (backendOn()) rpc('count_partner', { p_code: code, p_metric: metric }).catch(() => {});
}

/** Once per browser per code and metric. */
function once(code: string, metric: PartnerMetric) {
  const sent = load<Record<string, true>>('via-sent', {});
  const k = `${code}:${metric}`;
  if (sent[k]) return;
  save('via-sent', { ...sent, [k]: true });
  send(code, metric);
}

/**
 * Read on load: a partner link (?via=code). Counts the arrival (once per browser per code) and
 * keeps the first code as the one credited. Returns true when the link carried a code, so the
 * caller can take it out of the address (shared links then don't carry it on).
 */
export function takePartner(raw: string | null): boolean {
  if (raw == null) return false;
  const code = raw.trim().toLowerCase();
  if (!PARTNER_RE.test(code)) return true;
  if (!partnerTouch()) save('via', { code, day: todayUTC() });
  once(code, 'arrival');
  return true;
}

/** A milestone for the partner this browser first came from (played, finished, shared). */
export function partnerEvent(metric: Exclude<PartnerMetric, 'arrival' | 'returned'>) {
  const t = partnerTouch();
  if (t) once(t.code, metric);
}

/** On load: a player from a partner link who comes back on a later day. */
export function partnerReturnCheck() {
  const t = partnerTouch();
  if (t && t.day !== todayUTC()) once(t.code, 'returned');
}

/** A partner link to any part of the game, e.g. partnerLink('tangle', '#daily'). */
export function partnerLink(code: string, where = '', site = 'https://balancethebudget.us/') {
  const c = code.trim().toLowerCase();
  if (!PARTNER_RE.test(c)) return '';
  // A state page is its own page (/state/oh/); everything else is a place in the game (#…).
  if (/^state\/[a-z]{2}\/?$/.test(where)) return `${site}${where.replace(/\/?$/, '/')}?via=${c}`;
  return `${site}?via=${c}${where && where.startsWith('#') ? where : ''}`;
}

export interface PartnerStats { window_days: number; since: string; codes: Record<string, Partial<Record<PartnerMetric, number>>>; daily: { day: string; code: string; metric: PartnerMetric; n: number }[] }
/** The partner counts for the last `days` days, for the stats page. */
export async function partnerStats(days = 30): Promise<PartnerStats> {
  const r = await rpc<PartnerStats>('partner_stats', { window_days: days });
  return { window_days: r?.window_days ?? days, since: r?.since ?? '', codes: r?.codes && typeof r.codes === 'object' ? r.codes : {}, daily: Array.isArray(r?.daily) ? r.daily : [] };
}

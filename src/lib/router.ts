import { useEffect, useState } from 'react';

// Routes are plain hash names (#spending, #state-ca) so links work on any static host
// and inside a claude.ai artifact.
export const ROUTES = [
  'journey', 'level-1', 'level-2', 'level-3', 'level-4', 'level-5', 'level-6', 'level-7', 'level-8',
  'level-9', 'level-10',
  'overview', 'spending', 'revenue', 'gap', 'debt', 'laws', 'process', 'state', 'social-security',
  'receipt', 'glossary', 'sources', 'results', 'plan', 'story', 'daily', 'og-card', 'peoples', 'rooms', 'room', 'chain', 'stats',
  'me', 'clock', 'together', 'teach', 'duel', 'duels', 'levels', 'record', 'settings', 'guide',
] as const;
export type Route = (typeof ROUTES)[number];

export function parseHash(hash: string): { route: Route; param: string | null } {
  const raw = hash.replace(/^#/, '');
  // A shared plan carries its details after "plan?", as in a query string (names keep their case).
  if (/^plan\?/i.test(raw)) return { route: 'plan', param: raw.slice(5) };
  // The link-preview card that scripts/make-previews.mjs photographs.
  if (/^og-card\?/i.test(raw)) return { route: 'og-card', param: raw.slice(8) };
  // A room (room?c=CODE) and a pass-the-budget chain (chain?g=…&t=…) carry their details too.
  if (/^room\?/i.test(raw)) return { route: 'room', param: raw.slice(5) };
  if (/^chain(\?|$)/i.test(raw)) return { route: 'chain', param: raw.slice(6) || null };
  // A level 10 duel: the invite (duel=…, the host's plan) or the reply (duelr=…, both plans).
  if (/^duel(\?|$)/i.test(raw)) return { route: 'duel', param: raw.slice(5) || null };
  // A preview of another day's Daily Dollar (daily?d=2027-04-15), for checking themed weeks.
  if (/^daily\?/i.test(raw)) return { route: 'daily', param: raw.slice(6) };
  const h = raw.toLowerCase();
  if (h.startsWith('state-')) return { route: 'state', param: h.slice(6) };
  if (h.startsWith('sources-')) return { route: 'sources', param: h.slice(8) };
  // Links from earlier versions: the budget desk's separate missions and its free-play page.
  const legacy: Record<string, Route> = { 'desk-normal': 'level-5', 'desk-hard': 'level-8', 'desk-expert': 'level-10', sandbox: 'level-10' };
  if (legacy[h]) {
    try { history.replaceState(null, '', '#' + legacy[h]); } catch { /* not allowed in this frame */ }
    return { route: legacy[h], param: null };
  }
  if ((ROUTES as readonly string[]).includes(h)) return { route: h as Route, param: null };
  return { route: 'journey', param: null };
}

export function useHashRoute() {
  const [loc, setLoc] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setLoc(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

export function go(hash: string) {
  if (window.location.hash !== '#' + hash) window.location.hash = hash;
}

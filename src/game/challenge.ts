import { countArrival, LINK_KINDS, type LinkKind, todayUTC } from '../lib/backend';
import { partnerReturnCheck, takePartner } from '../lib/partners';
import { load, save } from '../lib/storage';
import type { SharedPlan } from './plans';
import { linkKind } from './share';

// The challenge a player accepted from a friend's link, kept in this browser until they finish
// or drop it. Only one at a time.

export interface Challenge { plan: SharedPlan; at: string }

export const activeChallenge = (): Challenge | null => load<Challenge | null>('challenge', null);
export const acceptChallenge = (plan: SharedPlan) => { save('challenge', { plan, at: new Date().toISOString() }); window.dispatchEvent(new Event('ftd-challenge')); };
export const dropChallenge = () => { save('challenge', null); window.dispatchEvent(new Event('ftd-challenge')); };

/** Read once on load: a plan link (?p=…) opens the friend's plan, and its channel tag is kept as the first-touch source. */
export function takeLinkFromSearch() {
  try {
    const q = new URLSearchParams(location.search);
    // A partner link (?via=code, on any page): counted, then taken out of the address so links
    // shared from here don't carry the partner on.
    if (takePartner(q.get('via'))) {
      q.delete('via');
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash);
    }
    partnerReturnCheck();
    const s = q.get('s');
    if (s && /^[a-z0-9-]{1,16}$/.test(s)) {
      // What kind of link it was, and where it was shared: the first one is kept with the player's
      // record, and every opened link is counted once per browser per day (no identity is sent).
      const k = q.get('k') as LinkKind | null;
      const kind: LinkKind = k && LINK_KINDS.includes(k) ? k : linkKind(location.href);
      if (!load<string>('src', '')) { save('src', s); save('src-kind', kind); }
      const day = todayUTC();
      const seen = Object.fromEntries(Object.entries(load<Record<string, string>>('opened', {})).filter(([, d]) => d === day));
      const key = `${kind}:${s}`;
      if (!seen[key]) { seen[key] = day; save('opened', seen); countArrival(kind, s); }
    }
    const keep = new URLSearchParams();
    // A short link (?plan=<id>) is looked up by the plan page.
    const id = q.get('plan');
    if (id && /^[0-9a-f]{12}$/.test(id)) keep.set('id', id);
    for (const k of ['p', 'lv', 'ph', 'by', 'b']) { const v = q.get(k); if (v != null) keep.set(k, v); }
    const daily = q.has('daily');
    // A shared Daily Dollar result: the puzzle, the sharer's right/wrong pattern and first name.
    const dailyQ = new URLSearchParams();
    for (const k of ['dn', 'vs', 'by']) { const v = q.get(k); if (v != null) dailyQ.set(k, v); }
    const peoples = q.has('peoples');
    const room = (q.get('room') ?? '').toUpperCase();
    const chain = new URLSearchParams();
    for (const k of ['g', 't', 'n']) { const v = q.get(k); if (v != null) chain.set(k, v); }
    const isChain = q.has('chain');
    // A level 10 duel: the invite carries the host's plan (h…), the reply both plans.
    const duel = new URLSearchParams();
    if (q.has('duel') || q.has('duelr')) for (const k of ['duel', 'duelr', 'hp', 'hlv', 'hph', 'hby', 'p', 'lv', 'ph', 'by']) { const v = q.get(k); if (v != null) duel.set(k, v); }
    const isDuel = duel.has('hp');
    const isPlan = keep.has('p') || keep.has('id');
    if (!isDuel && !isPlan && !daily && !peoples && !room && !isChain && !s) return;
    const hash = isDuel ? '#duel?' + duel.toString()
      : isPlan ? '#plan?' + keep.toString()
      : room ? '#room?c=' + encodeURIComponent(room)
      : isChain ? '#chain' + (chain.toString() ? '?' + chain.toString() : '')
      : daily ? '#daily' + (dailyQ.toString() ? '?' + dailyQ.toString() : '') : peoples ? '#peoples' : location.hash;
    // A link through a preview page (/p/<kind>/) lands on the game's root.
    history.replaceState(null, '', location.pathname.replace(/p\/[^/]+\/?$/, '') + hash);
  } catch { /* not allowed in this frame */ }
}

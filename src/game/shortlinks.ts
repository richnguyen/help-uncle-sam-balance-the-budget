import { useEffect, useState } from 'react';
import { assess } from '../lib/assess';
import { backendOn, createPlan } from '../lib/backend';
import { load, save } from '../lib/storage';
import { DESK } from './levels';
import { archetype, concentration, planCode, planLink, type SavedPlan, type SharedPlan, shortLink } from './plans';
import { previewKindId } from './previews';

// Short links for shared plans, on balancethebudget.us. A finished plan is stored once (its cards,
// across-the-board changes, and stars; no name, no answers to the big questions) and gets a short
// id; the same plan reuses its id. Stored plans also feed "the cards players reach for".

const cache: Record<string, string> = load<Record<string, string>>('short', {});
const inflight = new Map<string, Promise<string | null>>();

export function shortIdFor(level: string, plan: Pick<SavedPlan, 'ids' | 'lv' | 'gradual' | 'stars'>): Promise<string | null> {
  if (!backendOn()) return Promise.resolve(null);
  const d = DESK.find((x) => x.id === level);
  if (!d || !plan.ids.length) return Promise.resolve(null);
  const code = planCode({ level, goal: d.goal, ids: plan.ids, lv: plan.lv, gradual: plan.gradual });
  if (cache[code]) return Promise.resolve(cache[code]);
  let p = inflight.get(code);
  if (!p) {
    const a = assess(d.goal, plan.ids, plan.lv, plan.gradual);
    p = createPlan({ level: d.n, code, cards: [...plan.ids].sort(), stars: plan.stars, revenue_share: a.revTen + a.spTen ? Math.round(a.revenueShare * 1000) / 1000 : null, by_name: null })
      .then((id) => { if (id) { cache[code] = id; save('short', cache); } return id; })
      .catch(() => null)
      .finally(() => inflight.delete(code));
    inflight.set(code, p);
  }
  return p;
}

/**
 * The link to share for a finished plan: the short link once the site has stored the plan,
 * the long link (which works anywhere, with no server) until then or when there is no server.
 */
export function useShareLink(level: string | undefined, plan: Pick<SavedPlan, 'ids' | 'lv' | 'gradual' | 'stars'> | null, extra: Pick<SharedPlan, 'by' | 'ballot'>): string | undefined {
  const d = level ? DESK.find((x) => x.id === level) : undefined;
  const code = d && plan ? planCode({ level: d.id, goal: d.goal, ids: plan.ids, lv: plan.lv, gradual: plan.gradual }) : '';
  const [id, setId] = useState<string | null>(() => (code ? cache[code] ?? null : null));
  useEffect(() => {
    setId(code ? cache[code] ?? null : null);
    if (!code || !d || !plan || cache[code]) return;
    let alive = true;
    // Wait for the plan to settle, so trying cards doesn't store every combination.
    const t = setTimeout(() => { void shortIdFor(d.id, plan).then((x) => { if (alive) setId(x); }); }, 1500);
    return () => { alive = false; clearTimeout(t); };
  }, [code, plan?.stars]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || !plan) return undefined;
  // The link opens a static page whose preview matches the plan (level, stars, personality).
  const path = `p/${previewKind(d.id, plan)}/`;
  return id ? shortLink(id, extra, path) : planLink({ level: d.id, goal: d.goal, ids: plan.ids, lv: plan.lv, gradual: plan.gradual, ...extra }, undefined, path);
}

/** Which link preview fits a plan: its level, its stars, and its budget personality. */
export function previewKind(level: string, plan: Pick<SavedPlan, 'ids' | 'lv' | 'gradual' | 'stars'>) {
  const d = DESK.find((x) => x.id === level)!;
  const a = assess(d.goal, plan.ids, plan.lv, plan.gradual);
  const arche = archetype({ top: concentration(a.shares), rating: a.econ.rating, cards: plan.ids.length, slidersUsed: Object.values(plan.lv).some((v) => v !== 0) });
  return previewKindId(d.n, Math.max(1, a.ev.stars || plan.stars), arche.id);
}

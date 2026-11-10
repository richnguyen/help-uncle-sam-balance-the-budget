import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useJourney } from '../game/state';
import { backendOn, BackendError, readOwn, rpc, upsertOwn } from './backend';
import { isZip } from './zip';

// Citizen voting. On the claude.ai artifact it uses the artifact's shared database (`db`
// capability): each voter keeps one ballot document at votes/<their id>, and the page reads all
// ballots to count them. On balancethebudget.us it uses the site's Supabase database: one ballot
// row per anonymous player, and totals from a function that returns counts only. Anywhere else
// choices are kept locally so the game can continue.
//
// A player may add their ZIP code (and the state it's in) to their ballot, in mission 1.4. On the
// site it's saved with the ballot, which only that player can read; public results group by state
// or 3-digit ZIP area only. The artifact's ballots are readable by every viewer, so there the ZIP
// never leaves the browser.

export type Choice = 1 | -1;
export interface Ballot {
  options: Record<string, Choice>; // support / oppose on policy cards
  plan: string | null; // favorite ready-made plan
  issues: Record<string, string>; // single-choice questions, e.g. { goal: 'stabilize' }
  updated: string;
  zip?: string; // five digits, only if the player chose to save it
  state?: string; // the ZIP's state or territory, two letters
}
export interface Tally { support: number; oppose: number }

export interface VoteState {
  available: boolean;
  canVote: boolean | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  mine: Ballot;
  voters: number;
  options: Record<string, Tally>;
  plans: Record<string, number>;
  issues: Record<string, Record<string, number>>;
}

const EMPTY: Ballot = { options: {}, plan: null, issues: {}, updated: '' };

/** A ballot from the votes a player cast before the shared database was available (kept locally). */
function fromChoices(choices: Record<string, string>): Ballot {
  const b: Ballot = { options: {}, plan: null, issues: {}, updated: '' };
  for (const [k, v] of Object.entries(choices)) {
    if (!v) continue;
    if (k.startsWith('option:')) { if (v === 'support') b.options[k.slice(7)] = 1; else if (v === 'oppose') b.options[k.slice(7)] = -1; }
    else b.issues[k] = v;
  }
  return b;
}
const isEmpty = (b: Ballot) => !Object.keys(b.options).length && !Object.keys(b.issues).length && !b.plan;
const clean = (b: Partial<Ballot> | null | undefined): Ballot => ({
  options: { ...(b?.options ?? {}) }, plan: typeof b?.plan === 'string' ? b.plan : null, issues: { ...(b?.issues ?? {}) }, updated: b?.updated ?? '',
  ...(typeof b?.zip === 'string' && isZip(b.zip) ? { zip: b.zip } : {}),
  ...(typeof b?.state === 'string' && /^[A-Z]{2}$/.test(b.state) ? { state: b.state } : {}),
});
/** The ballot as the artifact stores it: never the ZIP, which every viewer there could read. */
const forArtifact = (b: Ballot): Ballot => { const { zip: _z, state: _s, ...rest } = b; return rest; };
interface Totals { voters: number; options: Record<string, Tally>; plans: Record<string, number>; issues: Record<string, Record<string, number>> }

type Votes = VoteState & {
  voteOption: (id: string, choice: Choice) => void;
  votePlan: (plan: string) => void;
  voteIssue: (id: string, value: string) => void;
  /** Fetch the latest totals now (the results page does this when it opens). */
  refresh: () => void;
  /** Add the player's ZIP (and its state) to their ballot, or take it off with null. */
  setZip: (zip: string | null, state: string | null) => void;
  /** Where a saved ZIP lives: in the site's database with the ballot, or only in this browser. */
  zipHome: 'database' | 'browser';
};

const Ctx = createContext<Votes | null>(null);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function VotesProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<VoteState>({ available: false, canVote: null, loading: true, stale: false, error: null, mine: EMPTY, voters: 0, options: {}, plans: {}, issues: {} });
  const dbRef = useRef<any>(null);
  const uidRef = useRef<string | null>(null);
  const writing = useRef(false);
  const pending = useRef<Ballot | null>(null);
  const mineRef = useRef<Ballot>(EMPTY);
  const j = useJourney();
  const mode = useRef<'artifact' | 'site' | null>(null);
  const refresh = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const c = (window as any).claude;
    if (!c?.use) {
      if (!backendOn()) { setS((p) => ({ ...p, loading: false })); return; }
      // balancethebudget.us: totals for everyone, this player's own ballot if they have one.
      mode.current = 'site';
      let alive = true;
      setS((p) => ({ ...p, available: true, canVote: true }));
      refresh.current = async () => {
        try {
          const t = await rpc<Totals>('ballot_totals');
          if (alive && t) setS((p) => ({ ...p, loading: false, stale: false, error: null, voters: t.voters, options: t.options ?? {}, plans: t.plans ?? {}, issues: t.issues ?? {} }));
        } catch {
          if (alive) setS((p) => ({ ...p, loading: false, stale: true }));
        }
      };
      (async () => {
        const own = await readOwn<{ ballot: Ballot }>('ballots', 'ballot').catch(() => null);
        if (!alive) return;
        if (own?.ballot) {
          const b = clean(own.ballot);
          mineRef.current = b;
          setS((p) => ({ ...p, mine: b }));
        } else {
          // Votes cast before the shared count existed join it now.
          const b = fromChoices(j.choices);
          if (!isEmpty(b)) write({ ...b, updated: new Date().toISOString() });
        }
        await refresh.current();
      })();
      const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh.current(); }, 60000);
      const vis = () => { if (document.visibilityState === 'visible') void refresh.current(); };
      document.addEventListener('visibilitychange', vis);
      return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
    }
    mode.current = 'artifact';
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    (async () => {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (cancelled) return;
      if (!db) { setS((p) => ({ ...p, loading: false })); return; }
      const uid = user ? await user.id() : null;
      const can = user ? await user.can('data.write') : null;
      if (cancelled) return;
      dbRef.current = db;
      uidRef.current = uid;
      setS((p) => ({ ...p, available: true, canVote: uid ? can : false }));
      timer = setTimeout(() => setS((p) => ({ ...p, stale: true })), 10000);
      unsub = db.collection('votes').onSnapshot(
        (snap: any) => {
          const options: Record<string, Tally> = {};
          const plans: Record<string, number> = {};
          const issues: Record<string, Record<string, number>> = {};
          let mine: Ballot = EMPTY;
          for (const d of snap.docs) {
            const b = d.data() as Partial<Ballot> | undefined;
            if (!b) continue;
            if (d.id === uid) mine = { options: { ...(b.options ?? {}) }, plan: b.plan ?? null, issues: { ...(b.issues ?? {}) }, updated: b.updated ?? '' };
            for (const [k, v] of Object.entries(b.options ?? {})) {
              const t = (options[k] ??= { support: 0, oppose: 0 });
              if (v === 1) t.support++;
              else if (v === -1) t.oppose++;
            }
            if (typeof b.plan === 'string') plans[b.plan] = (plans[b.plan] ?? 0) + 1;
            for (const [k, v] of Object.entries(b.issues ?? {})) {
              if (typeof v !== 'string') continue;
              const t = (issues[k] ??= {});
              t[v] = (t[v] ?? 0) + 1;
            }
          }
          if (!snap.metadata?.fromCache && timer) { clearTimeout(timer); timer = null; }
          const m = pending.current ?? mine;
          mineRef.current = m;
          setS((p) => ({ ...p, loading: false, stale: snap.metadata?.fromCache ? p.stale : false, voters: snap.size, options, plans, issues, mine: m }));
        },
        (e: any) => {
          if (timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, error: e?.code === 'revoked' ? null : 'Vote counts are unavailable right now.' }));
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // One write at a time to the ballot; a burst of clicks collapses into the latest ballot.
  const flush = useCallback(async () => {
    if (mode.current === 'site') {
      if (writing.current || !pending.current) return;
      writing.current = true;
      while (pending.current) {
        const b = pending.current;
        pending.current = null;
        try {
          await upsertOwn('ballots', { ballot: b });
          setS((p) => (p.error ? { ...p, error: null } : p));
        } catch (e) {
          setS((p) => ({ ...p, error: e instanceof BackendError && e.status === 401 ? 'Votes can’t be saved right now; yours is kept in this browser.' : 'Your vote could not be saved. Try again in a moment.' }));
          break;
        }
      }
      writing.current = false;
      void refresh.current();
      return;
    }
    const db = dbRef.current;
    const uid = uidRef.current;
    if (!db || !uid || writing.current || !pending.current) return;
    writing.current = true;
    while (pending.current) {
      const b = pending.current;
      pending.current = null;
      try {
        await db.doc('votes/' + uid).set(forArtifact(b));
      } catch (e: any) {
        if (e?.code === 'invalid_argument' || e?.code === 'not_granted') setS((p) => ({ ...p, canVote: false }));
        else if (e?.code === 'quota_exceeded') setS((p) => ({ ...p, error: 'The vote store is full, so new votes can’t be saved.' }));
        else setS((p) => ({ ...p, error: 'Your vote could not be saved. Try again in a moment.' }));
        break;
      }
    }
    writing.current = false;
  }, []);

  const write = useCallback((next: Ballot) => {
    mineRef.current = next;
    pending.current = next;
    setS((p) => ({ ...p, mine: next }));
    void flush();
  }, [flush]);

  const voteOption = useCallback((id: string, choice: Choice) => {
    const cur = mineRef.current;
    const opts = { ...cur.options };
    if (opts[id] === choice) delete opts[id];
    else opts[id] = choice;
    write({ ...cur, options: opts, updated: new Date().toISOString() });
  }, [write]);

  const votePlan = useCallback((plan: string) => {
    const cur = mineRef.current;
    write({ ...cur, plan: cur.plan === plan ? null : plan, updated: new Date().toISOString() });
  }, [write]);

  const voteIssue = useCallback((id: string, value: string) => {
    const cur = mineRef.current;
    const issues = { ...cur.issues };
    if (issues[id] === value) delete issues[id];
    else issues[id] = value;
    write({ ...cur, issues, updated: new Date().toISOString() });
  }, [write]);

  const setZip = useCallback((zip: string | null, state: string | null) => {
    const cur = mineRef.current;
    const next: Ballot = { ...cur, updated: new Date().toISOString() };
    if (zip && isZip(zip)) { next.zip = zip; if (state) next.state = state; else delete next.state; } else { delete next.zip; delete next.state; }
    if (mode.current === 'site') write(next);
    else { mineRef.current = next; setS((p) => ({ ...p, mine: next })); }
  }, [write]);

  const refreshNow = useCallback(() => { void refresh.current(); }, []);
  const zipHome = mode.current === 'site' ? 'database' : 'browser';
  return <Ctx.Provider value={{ ...s, voteOption, votePlan, voteIssue, refresh: refreshNow, setZip, zipHome }}>{children}</Ctx.Provider>;
}

export function useVotes(): Votes {
  const v = useContext(Ctx);
  if (!v) throw new Error('VotesProvider missing');
  return v;
}

import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LEVELS, quizzesOf, STOPS } from '../game/levels';
import { useJourney } from '../game/state';
import { BackendError, backendOn, rpc, upsertOwn } from './backend';
import { load, save } from './storage';

// How everyone played. Each player keeps one anonymous record: which levels they finished, their
// stars, whether each quick check was right on the first try, and their medals. No names or
// answers to the votes (those are in the ballot).
//  - On the claude.ai artifact the record is players/<id> in the artifact's database, and the page
//    reads every record to add them up.
//  - On balancethebudget.us it is one row in the site's Supabase database, and the page reads
//    totals from a function that returns counts only (plus the player's state, if they picked
//    one, and the channel their first visit came from).
//  - Anywhere else only the player's own record exists.

export interface PlayerRecord {
  v: 1;
  done: string[];
  stars: Record<string, number>;
  firstTry: Record<string, boolean>;
  medals: string[];
  updated: string;
}

/** Everyone's results, added up. */
export interface CommunityTotals {
  players: number;
  /** Players who finished every level (null where the server does not report it). */
  finishedAll: number | null;
  starsTotal: number;
  done: Record<string, number>;
  stars: Record<string, { sum: number; n: number }>;
  firstTry: Record<string, { right: number; n: number }>;
  medals: Record<string, number>;
}

export interface CommunityState {
  available: boolean;
  /** Where shared results come from. */
  source: 'artifact' | 'site' | null;
  canWrite: boolean | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  totals: CommunityTotals;
  /** Fetch the latest totals now (the results page does this when it opens). */
  refresh: () => void;
}

const EMPTY: CommunityTotals = { players: 0, finishedAll: 0, starsTotal: 0, done: {}, stars: {}, firstTry: {}, medals: {} };

/** Adds player records into totals. */
export function addUp(list: PlayerRecord[], base: CommunityTotals = EMPTY): CommunityTotals {
  const t: CommunityTotals = { ...base, done: { ...base.done }, stars: { ...base.stars }, firstTry: { ...base.firstTry }, medals: { ...base.medals } };
  for (const r of list) {
    t.players++;
    if (t.finishedAll != null && STOPS.every((s) => r.done.includes(s.id))) t.finishedAll++;
    for (const d of r.done) t.done[d] = (t.done[d] ?? 0) + 1;
    for (const [k, n] of Object.entries(r.stars)) { if (!(n >= 0 && n <= 3)) continue; const x = t.stars[k] ?? { sum: 0, n: 0 }; t.stars[k] = { sum: x.sum + n, n: x.n + 1 }; t.starsTotal += n; }
    for (const [k, ok] of Object.entries(r.firstTry)) { const x = t.firstTry[k] ?? { right: 0, n: 0 }; t.firstTry[k] = { right: x.right + (ok ? 1 : 0), n: x.n + 1 }; }
    for (const m of r.medals) t.medals[m] = (t.medals[m] ?? 0) + 1;
  }
  return t;
}

interface ServerTotals {
  players: number; finished_all?: number; stars_total?: number;
  done: Record<string, number>; stars: Record<string, { sum: number; n: number }>;
  firstTry: Record<string, { right: number; n: number }>; medals: Record<string, number>;
}
const fromServer = (s: ServerTotals): CommunityTotals => ({
  players: s.players ?? 0,
  finishedAll: s.finished_all ?? null,
  starsTotal: s.stars_total ?? Object.values(s.stars ?? {}).reduce((a, x) => a + x.sum, 0),
  done: s.done ?? {}, stars: s.stars ?? {}, firstTry: s.firstTry ?? {}, medals: s.medals ?? {},
});

const Ctx = createContext<CommunityState | null>(null);
const QUIZ_IDS = LEVELS.flatMap((l) => quizzesOf(l).map((q) => q.id));

/* eslint-disable @typescript-eslint/no-explicit-any */
export function CommunityProvider({ children }: { children: ReactNode }) {
  const j = useJourney();
  const [s, setS] = useState<Omit<CommunityState, 'totals' | 'refresh'>>({ available: false, source: null, canWrite: null, loading: true, stale: false, error: null });
  const [others, setOthers] = useState<PlayerRecord[]>([]); // artifact: everyone else's records
  const [server, setServer] = useState<CommunityTotals | null>(null); // site: totals from the server
  const dbRef = useRef<any>(null);
  const uidRef = useRef<string | null>(null);
  const sent = useRef(load<string>('sent-record', ''));
  const refresh = useRef<() => Promise<void>>(async () => {});

  // This player's record, from their journey.
  const mine = useMemo<PlayerRecord>(() => ({
    v: 1,
    done: [...j.done].sort(),
    stars: Object.fromEntries(Object.entries(j.stars).filter(([, n]) => n > 0)),
    firstTry: Object.fromEntries(QUIZ_IDS.filter((q) => j.quiz[q]).map((q) => [q, !!(j.quiz[q].correct && j.quiz[q].tries === 1)])),
    medals: [...j.medals].sort(),
    updated: '',
  }), [j.done, j.stars, j.quiz, j.medals]);
  const played = mine.done.length > 0 || Object.keys(mine.firstTry).length > 0;
  const [savedOnce, setSavedOnce] = useState(() => !!sent.current);

  useEffect(() => {
    const c = (window as any).claude;
    if (!c?.use) {
      if (!backendOn()) { setS((p) => ({ ...p, loading: false })); return; }
      let alive = true;
      setS((p) => ({ ...p, available: true, source: 'site', canWrite: true }));
      refresh.current = async () => {
        try {
          const t = await rpc<ServerTotals>('player_totals');
          if (alive && t) { setServer(fromServer(t)); setS((p) => ({ ...p, loading: false, stale: false, error: null })); }
        } catch {
          if (alive) setS((p) => ({ ...p, loading: false, stale: true, error: 'Results from other players can’t be loaded right now.' }));
        }
      };
      void refresh.current();
      const vis = () => { if (document.visibilityState === 'visible') void refresh.current(); };
      document.addEventListener('visibilitychange', vis);
      const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh.current(); }, 120000);
      return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
    }
    let unsub: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    (async () => {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (cancelled || !db) { setS((p) => ({ ...p, loading: false })); return; }
      const uid = user ? await user.id() : null;
      const can = user ? await user.can('data.write') : null;
      if (cancelled) return;
      dbRef.current = db;
      uidRef.current = uid;
      setS((p) => ({ ...p, available: true, source: 'artifact', canWrite: uid ? can : false }));
      timer = setTimeout(() => setS((p) => ({ ...p, stale: true })), 10000);
      unsub = db.collection('players').onSnapshot(
        (snap: any) => {
          const list: PlayerRecord[] = [];
          for (const d of snap.docs) {
            if (d.id === uid) continue; // this player's own record comes from their journey
            const r = d.data() as Partial<PlayerRecord> | undefined;
            if (!r || !Array.isArray(r.done)) continue;
            list.push({ v: 1, done: r.done.filter((x) => typeof x === 'string'), stars: r.stars ?? {}, firstTry: r.firstTry ?? {}, medals: Array.isArray(r.medals) ? r.medals : [], updated: r.updated ?? '' });
          }
          if (!snap.metadata?.fromCache && timer) { clearTimeout(timer); timer = null; }
          setOthers(list);
          setS((p) => ({ ...p, loading: false, stale: snap.metadata?.fromCache ? p.stale : false }));
        },
        (e: any) => {
          if (timer) { clearTimeout(timer); timer = null; }
          setS((p) => ({ ...p, loading: false, error: e?.code === 'revoked' ? null : 'Results from other players can’t be loaded right now.' }));
        },
      );
    })();
    return () => { cancelled = true; unsub?.(); if (timer) clearTimeout(timer); };
  }, []);

  // Save this player's record when it changes (a few seconds after, one write at a time).
  useEffect(() => {
    if (!s.available || s.canWrite === false || !played) return;
    const state = load<boolean>('state-picked', false) ? load<string>('state', '') : '';
    const channel = load<string>('src', '');
    const body = JSON.stringify({ ...mine, updated: '', state, channel });
    if (body === sent.current) return;
    const t = setTimeout(async () => {
      if (s.source === 'site') {
        try {
          const row = { record: { ...mine, updated: new Date().toISOString() }, state: /^[A-Z]{2}$/.test(state) ? state : null, channel: /^[a-z0-9-]{1,16}$/.test(channel) ? channel : null };
          const cameFrom = load<string>('src-kind', '');
          // Where the player first came from (the share-stats migration adds this column; before it
          // runs, the record is saved without it).
          try { await upsertOwn('players', { ...row, came_from: /^(plan|story|clip|daily|peoples|room|chain|level|site)$/.test(cameFrom) ? cameFrom : null }); }
          catch (e) { if (e instanceof BackendError && e.status === 400) await upsertOwn('players', row); else throw e; }
          sent.current = body;
          save('sent-record', body);
          setSavedOnce(true);
          void refresh.current();
        } catch {
          setS((p) => ({ ...p, error: 'Your results could not be added to the shared count yet; they are kept in this browser.' }));
        }
        return;
      }
      const db = dbRef.current, uid = uidRef.current;
      if (!db || !uid) return;
      try {
        await db.doc('players/' + uid).set({ ...mine, updated: new Date().toISOString() });
        sent.current = body;
      } catch (e: any) {
        if (e?.code === 'not_granted' || e?.code === 'invalid_argument') setS((p) => ({ ...p, canWrite: false }));
        else if (e?.code === 'quota_exceeded') setS((p) => ({ ...p, error: 'The results store is full, so new results can’t be saved.' }));
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [s.available, s.canWrite, s.source, played, mine]);

  const totals = useMemo(() => {
    if (s.source === 'site') {
      // The server's totals include this player once their record has been saved.
      const base = server ?? EMPTY;
      return played && !savedOnce ? addUp([mine], base) : base;
    }
    return addUp(played ? [...others, mine] : others);
  }, [s.source, server, others, played, mine, savedOnce]);
  const value = useMemo(() => ({ ...s, totals, refresh: () => { void refresh.current(); } }), [s, totals]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommunity(): CommunityState {
  const v = useContext(Ctx);
  if (!v) throw new Error('CommunityProvider missing');
  return v;
}

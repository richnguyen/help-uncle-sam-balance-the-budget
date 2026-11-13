import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVotes } from '../../lib/votes';
import { DEADLINES } from '../daily';
import { useHaptics } from '../haptics';
import { useJourney } from '../state';
import { CaughtUp, Carousel, FeedCard, Icon, ICON, NewContext, SkeletonCard } from './cards';
import { useMoves } from './follow';
import { isNewSince, markFeedSeen, sinceVisit } from './since';
import { buildItems, mix, page, rowKey, TOPICS, type FeedRow, type Topic } from './items';

// The main menu's feed, under Uncle Sam and the deficit: one column of posts with a sticky row of
// topics. It loads ten posts at a time from a cursor, a little before the reader gets to the end;
// keeps only the posts near the screen in the page (the rest are measured spacers), so a long
// scroll stays light; comes back to the same place after a post is opened and Back is pressed;
// and ends with a clear last card, not a spinner.

const BATCH = 10;
const GUESS = 300; // a post's height before it has been measured
const MEMORY = 'ftd:feed'; // where the place in the feed is kept for this visit (session only)

interface Memory { topic: Topic | 'all'; seed: string; count: number; y: number; heights: Record<string, number> }
const recall = (): Memory | null => { try { return JSON.parse(sessionStorage.getItem(MEMORY) ?? 'null'); } catch { return null; } };
const remember = (m: Memory) => { try { sessionStorage.setItem(MEMORY, JSON.stringify(m)); } catch { /* private mode */ } };
const today = () => new Date().toISOString().slice(0, 10);

export function Feed() {
  const mem = useRef(recall()).current;
  const [topic, setTopic] = useState<Topic | 'all'>(mem?.topic ?? 'all');
  const [seed, setSeed] = useState(mem?.seed ?? today());
  const items = useMemo(() => buildItems(), []);
  // What's new since the last visit (kept for this session), and followed bills that moved.
  const moves = useMoves();
  const newIds = useMemo(() => {
    const since = sinceVisit();
    const ids = new Set(items.filter((i) => isNewSince(i, since)).map((i) => i.id));
    for (const m of moves) ids.add(`bill:${m.id}`);
    return ids;
  }, [items, moves.map((m) => m.id + m.now).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => mix(items, topic, seed, Date.now(), newIds), [items, topic, seed, newIds]);
  // The feed is open: what's in it now counts as seen for the Feed tab's count.
  useEffect(() => { markFeedSeen(); }, []);

  const [count, setCount] = useState(() => Math.max(BATCH, mem?.count ?? BATCH));
  const [loading, setLoading] = useState(false);
  const loaded = all.slice(0, count);
  const done = count >= all.length;
  const buzz = useHaptics();

  // ---- Windowing: measured heights, a window of rows around the screen, spacers for the rest.
  const heights = useRef<Map<string, number>>(new Map(Object.entries(mem?.heights ?? {})));
  const listRef = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState<[number, number]>([0, Math.min(loaded.length, 8)]);
  const [, bump] = useState(0);
  const offsets = useMemo(() => {
    const o = [0];
    for (const r of loaded) o.push(o.at(-1)! + (heights.current.get(rowKey(r)) ?? GUESS));
    return o;
  }, [loaded, win]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    const el = listRef.current; if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY;
    const from = scrollY - top - innerHeight, to = scrollY - top + innerHeight * 2;
    let a = 0; while (a < loaded.length && offsets[a + 1] < from) a++;
    let b = a; while (b < loaded.length && offsets[b] < to) b++;
    setWin((w) => (w[0] === a && w[1] === b ? w : [a, b]));
    // Load the next batch when the reader is about 70% through what's loaded.
    if (!done && !loading && b >= loaded.length - Math.ceil(BATCH * 0.3)) {
      setLoading(true);
      requestAnimationFrame(() => setTimeout(() => {
        const next = page(all, rowKey(loaded.at(-1)!), BATCH);
        setCount((c) => c + next.rows.length);
        setLoading(false);
      }, 120));
    }
  }, [loaded, offsets, done, loading, all]);

  useEffect(() => {
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    on();
    addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); removeEventListener('scroll', on); removeEventListener('resize', on); };
  }, [measure]);

  // Each rendered row reports its height; a change re-lays the spacers.
  const ro = useMemo(() => new ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      const k = (e.target as HTMLElement).dataset.key!;
      const h = Math.round((e.target as HTMLElement).offsetHeight);
      if (h && heights.current.get(k) !== h) { heights.current.set(k, h); changed = true; }
    }
    if (changed) bump((x) => x + 1);
  }), []);
  useEffect(() => () => ro.disconnect(), [ro]);
  const track = useCallback((el: HTMLDivElement | null) => { if (el) ro.observe(el); }, [ro]);

  // ---- Coming back: the same posts, the same place.
  const yRef = useRef(0);
  useEffect(() => { const on = () => { yRef.current = scrollY; }; addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on); }, []);
  const state = useRef({ topic, seed, count });
  state.current = { topic, seed, count };
  useEffect(() => () => remember({ ...state.current, y: yRef.current, heights: Object.fromEntries(heights.current) }), []);
  useLayoutEffect(() => {
    if (!mem || mem.y < 50) return;
    // The app scrolls to the top on every new screen; come back after it has.
    const go = () => window.scrollTo({ top: mem.y });
    requestAnimationFrame(() => requestAnimationFrame(go));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Back to top, after two screens.
  const [far, setFar] = useState(false);
  useEffect(() => { const on = () => setFar(scrollY > innerHeight * 2); on(); addEventListener('scroll', on, { passive: true }); return () => removeEventListener('scroll', on); }, []);

  const head = useRef<HTMLDivElement>(null);
  const sec = useRef<HTMLElement>(null);
  // The top of the feed in the page (the topic bar is sticky, so measure the section, not the bar).
  const feedTop = () => (sec.current ? sec.current.getBoundingClientRect().top + scrollY : 0);
  const pickTopic = (t: Topic | 'all') => {
    buzz('tap');
    setTopic(t); setCount(BATCH); setWin([0, 8]);
    if (scrollY > feedTop()) window.scrollTo({ top: feedTop() });
  };
  const refresh = () => { buzz('tap'); setSeed(`${today()}:${Date.now() % 1000}`); setTopic('all'); setCount(BATCH); setWin([0, 8]); window.scrollTo({ top: feedTop(), behavior: 'smooth' }); };

  const [a, b] = win;
  const visible = loaded.slice(a, b);
  return (
    <section className="feed" aria-label="The feed" ref={sec}>
      <aside className="feed-rail" aria-label="Topics">
        <Filters topic={topic} pick={pickTopic} vertical />
        <nav className="feed-rail-links" aria-label="More">
          <a href="#guide">Saved posts and your record</a>
          <a href="#guide">The field guide</a>
          <a href="#glossary">Glossary</a>
          <a href="#sources">Sources &amp; methods</a>
        </nav>
      </aside>
      <div className="feed-main">
        <div className="feed-filters" ref={head}>
          <h2 className="feed-title">The feed</h2>
          <Filters topic={topic} pick={pickTopic} />
        </div>
        <div className="feed-list" ref={listRef} role="feed" aria-busy={loading} aria-label={`${TOPICS.find((t) => t.id === topic)!.label} posts`}>
          <div style={{ height: offsets[a] }} aria-hidden="true" />
          {visible.map((r, i) => (
            <div key={rowKey(r)} data-key={rowKey(r)} ref={track} className="feed-row" aria-posinset={a + i + 1} aria-setsize={done ? all.length : -1}>
              <Row row={r} isNew={newIds.has(rowKey(r))} fresher={newIds.size} />
            </div>
          ))}
          <div style={{ height: offsets[loaded.length] - offsets[b] }} aria-hidden="true" />
          {loading && <><SkeletonCard /><SkeletonCard /></>}
        </div>
        {done && <FeedEnd topic={topic} pick={pickTopic} refresh={refresh} count={all.length} />}
      </div>
      <aside className="feed-side" aria-label="Coming up and trending">
        <Upcoming />
        <Trending />
      </aside>
      {far && (
        <button type="button" className="feed-top" onClick={() => { buzz('tap'); window.scrollTo({ top: feedTop(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches || scrollY - feedTop() > innerHeight * 4 ? 'auto' : 'smooth' }); }} aria-label="Back to the top of the feed">
          <Icon d={ICON.up} size={20} /><span>Top</span>
        </button>
      )}
    </section>
  );
}

function Row({ row, isNew, fresher }: { row: FeedRow; isNew: boolean; fresher: number }) {
  if (row.kind === 'caughtup') return <CaughtUp fresh={row.fresh} fresher={fresher} since={sinceVisit()} />;
  if (row.kind === 'item') return <NewContext.Provider value={isNew}><FeedCard item={row.item} /></NewContext.Provider>;
  return <Carousel row={row} />;
}

function Filters({ topic, pick, vertical }: { topic: Topic | 'all'; pick: (t: Topic | 'all') => void; vertical?: boolean }) {
  return (
    <div className={'feed-pills' + (vertical ? ' feed-pills-v' : '')} role="group" aria-label="Show">
      {TOPICS.map((t) => <button key={t.id} type="button" className="feed-pill" aria-pressed={topic === t.id} onClick={() => pick(t.id)}>{t.label}</button>)}
    </div>
  );
}

function FeedEnd({ topic, pick, refresh, count }: { topic: Topic | 'all'; pick: (t: Topic | 'all') => void; refresh: () => void; count: number }) {
  return (
    <div className="feed-end card" role="status">
      <span className="feed-end-icon" aria-hidden="true"><Icon d={ICON.check} size={22} /></span>
      <h3>That’s everything{topic === 'all' ? '' : ` in ${TOPICS.find((t) => t.id === topic)!.label}`}</h3>
      <p className="muted">You’ve seen all {count} posts. New bills and announcements arrive every few hours.</p>
      <div className="feed-end-actions">
        <button type="button" className="btn btn-primary" onClick={refresh}>Start over, in a new order</button>
        {topic !== 'all' && <button type="button" className="btn" onClick={() => pick('all')}>Show all topics</button>}
      </div>
      <nav className="feed-end-links" aria-label="More to explore">
        {TOPICS.filter((t) => t.id !== 'all' && t.id !== topic).map((t) => <button key={t.id} type="button" className="feed-pill" onClick={() => pick(t.id)}>{t.label}</button>)}
      </nav>
      <p className="small muted feed-end-foot"><a href="#guide">Field guide</a> · <a href="#sources">Sources &amp; methods</a> · <a href="#glossary">Glossary</a> · <a href="#guide">Saved posts</a></p>
    </div>
  );
}

// ---- The side column on wide screens.

function Upcoming() {
  const now = Date.now();
  const dates = [
    ...DEADLINES.filter((d) => Date.parse(d.date + 'T23:59:59') >= now).map((d) => ({ date: d.date, what: d.kind === 'shutdown' ? 'Government funding runs out' : 'Debt limit X-date', url: d.source.url })),
    { date: `${new Date().getFullYear() + (new Date().getMonth() > 3 || (new Date().getMonth() === 3 && new Date().getDate() > 15) ? 1 : 0)}-04-15`, what: 'Federal income tax returns due', url: 'https://www.irs.gov/filing' },
  ].sort((x, y) => x.date.localeCompare(y.date)).slice(0, 4);
  const F = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return (
    <section className="feed-box card">
      <h3>Coming up</h3>
      <ul>{dates.map((d) => <li key={d.date + d.what}><time>{F.format(new Date(d.date + 'T12:00:00Z'))}</time> <a href={d.url} target="_blank" rel="noopener noreferrer">{d.what}</a></li>)}</ul>
    </section>
  );
}

function Trending() {
  const v = useVotes();
  const j = useJourney();
  const top = Object.entries(v.options).map(([id, t]) => ({ id, n: t.support + t.oppose, t })).sort((a, b) => b.n - a.n).slice(0, 4);
  const names = useMemo(() => Object.fromEntries(buildItems().filter((i) => i.kind === 'poll').map((i) => [i.id.slice(5), i.title])), []);
  if (!top.length || !v.available) return (
    <section className="feed-box card"><h3>Your civic record</h3><p className="small">{Object.keys(v.mine.options).length} polls answered · {(j.saved ?? []).length} saved</p><a className="small" href="#guide">Your record</a></section>
  );
  return (
    <section className="feed-box card">
      <h3>Most-answered polls</h3>
      <ul>{top.filter((x) => names[x.id]).map((x) => <li key={x.id}><span>{names[x.id]}</span> <span className="muted small">{x.n.toLocaleString()} answers · {Math.round((x.t.support / Math.max(1, x.n)) * 100)}% include it</span></li>)}</ul>
      <p className="small muted">Players of this game, not a scientific poll.</p>
    </section>
  );
}

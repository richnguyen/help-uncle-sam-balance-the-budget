import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ActionBar } from '../../components/ActionBar';
import { useHaptics } from '../haptics';
import { isUnlocked, missionShort, STOPS } from '../levels';
import { useJourney } from '../state';
import { useDailyStreak } from '../streak';
import { SamSays } from '../UncleSam';
import type { Mood } from '../voice';
import { bump, buildPart, flyStar, hidePart } from './anim';
import { FRAME, LandmarkArt } from './art';
import { balanceOf, BUILD_LINES, doneCount, isComplete, isOpen, type Landmark, LANDMARK_BY_ID, LANDMARKS, type LandmarkId, mallComplete, nextTask, partStates, starsSpent, starsWon, type Task, TOTAL_COST } from './landmarks';
import { MallView } from './mall';

// Build the Mall: the whole Mall (#mall) and each landmark's building site (#mall-monument …).
// Stars won in missions pay for each landmark's jobs, in order; a Daily Dollar streak unlocks its
// decoration (landmark N needs an N-day streak, the best run counting). See landmarks.ts for the
// jobs and their facts.

/** The best Daily Dollar streak: what unlocks the decorations. */
const useStreakBest = () => useDailyStreak().best;

/** Where to win more stars: the next mission, or a replay once every mission is done. */
function useStarSource() {
  const j = useJourney();
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  return next ? { href: '#' + next.id, label: `Play ${missionShort(next)}: ${next.title}` } : { href: '#levels', label: 'Replay a mission for more stars' };
}

export default function BuildPage({ param }: { param: string | null }) {
  const id = param && param in LANDMARK_BY_ID ? (param as LandmarkId) : null;
  return id ? <LandmarkSite key={id} l={LANDMARK_BY_ID[id]} /> : <MallPage />;
}

function Balance({ n, chipRef }: { n: number; chipRef?: React.Ref<HTMLSpanElement> }) {
  return <span className="bm-balance" ref={chipRef} aria-label={`${n} stars to spend`}><span aria-hidden="true">★</span> <strong className="num">{n}</strong> <span className="bm-balance-k">to spend</span></span>;
}

// ---------- the whole Mall ----------
function MallPage() {
  const j = useJourney();
  const built = j.built ?? [], decor = j.decor ?? [];
  const bal = balanceOf(j.stars, built);
  const cur = LANDMARKS.find((l) => isOpen(l, built) && !isComplete(l, built)) ?? null;
  const finished = LANDMARKS.filter((l) => isComplete(l, built)).length;
  const src = useStarSource();
  const scroller = useRef<HTMLDivElement>(null);
  // On a phone the view scrolls sideways: start it on the landmark being built.
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const at: Record<LandmarkId, number> = { capitol: 0.79, treasury: 0.42, whitehouse: 0.32, monument: 0.5, jefferson: 0.68, lincoln: 0.16 };
    el.scrollLeft = el.scrollWidth * at[cur?.id ?? 'monument'] - el.clientWidth / 2;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const say = mallComplete(built) ? BUILD_LINES.done : !built.length || !cur ? BUILD_LINES.fresh : BUILD_LINES.next(cur.short);
  return (
    <div className="bm-page">
      <header className="level-title">
        <h1 className="level-name sr-only">Build the Mall</h1>
        <span className="level-meta small"><Balance n={bal} /> <span className="muted">· {finished} of {LANDMARKS.length} landmarks</span></span>
      </header>
      <SamSays mood={mallComplete(built) ? 'cheering' : 'happy'} auto>{say}</SamSays>
      <div className="bm-mall card" ref={scroller}>
        <div className="bm-mall-inner"><MallView built={built} decor={decor} focus={cur?.id ?? null} /></div>
      </div>
      <p className="small muted bm-howto">Each mission’s stars pay for building jobs, in order: the ground and the foundation first, the roof and the statue last. Stars never run out; save them up or spend them as you go. Medals and budget-desk badges unlock each landmark’s finishing touch. {starsWon(j.stars)} stars won so far, {starsSpent(built)} spent, of the {TOTAL_COST} the whole Mall takes.</p>
      <ol className="bm-cards">
        {LANDMARKS.map((l, i) => <LandmarkCard key={l.id} l={l} n={i + 1} built={built} decor={decor} bal={bal} />)}
      </ol>
      <ActionBar label="Build">
        {cur ? (
          <a className="btn btn-primary" href={'#mall-' + cur.id} data-primary>{built.length ? 'Keep building' : 'Start building'}: {cur.short}</a>
        ) : <a className="btn btn-primary" href="#journey">Back to the main menu</a>}
        {cur && bal < (nextTask(cur, built)?.cost ?? 0) && <a className="btn" href={src.href}>{src.label}</a>}
      </ActionBar>
    </div>
  );
}

function LandmarkCard({ l, n, built, decor, bal }: { l: Landmark; n: number; built: string[]; decor: string[]; bal: number }) {
  const open = isOpen(l, built), fin = isComplete(l, built), next = nextTask(l, built);
  const k = doneCount(l, built);
  const [x, y, w, h] = FRAME[l.id];
  const prev = LANDMARKS[n - 2];
  return (
    <li>
      <a className="bm-card" href={'#mall-' + l.id} data-state={fin ? 'done' : open ? 'open' : 'locked'}>
        <svg className="bm bm-card-art" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <rect x={x - 400} y={0} width={w + 800} height={h} className="bm-lawn" />
          <LandmarkArt id={l.id} parts={partStates(l, built)} decor={decor.includes(l.decor.id)} />
        </svg>
        <span className="bm-card-text">
          <span className="stat-label">Landmark {n}</span>
          <strong>{l.short}</strong>
          <span className="bm-card-bar" aria-hidden="true"><span style={{ width: `${(k / l.tasks.length) * 100}%` }} /></span>
          <span className="small muted">{fin ? `Finished · ${l.tasks.length} of ${l.tasks.length} jobs` : !open ? `Opens when the ${prev.short} is finished` : `${k} of ${l.tasks.length} jobs · next: ${next!.label.toLowerCase()}, ★${next!.cost}${bal >= next!.cost ? '' : ' (win more stars)'}`}</span>
        </span>
      </a>
    </li>
  );
}

// ---------- one landmark's building site ----------
type Say = { key: string; text: string; mood: Mood };
const PRELUDE: Record<string, 'olddome' | 'fire'> = { 'capitol:drum': 'olddome', 'whitehouse:rebuild': 'fire' };

function LandmarkSite({ l }: { l: Landmark }) {
  const j = useJourney();
  const built = j.built ?? [], decor = j.decor ?? [];
  const acc = useStreakBest();
  const src = useStarSource();
  const buzz = useHaptics();
  const bal = balanceOf(j.stars, built);
  const open = isOpen(l, built), fin = isComplete(l, built);
  const next = nextTask(l, built);
  const placed = decor.includes(l.decor.id);
  const idx = LANDMARKS.indexOf(l);
  const after = LANDMARKS[idx + 1] ?? null, before = LANDMARKS[idx - 1] ?? null;
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState<string | null>(null);
  const [say, setSay] = useState<Say>(() => ({ key: 'intro', text: fin ? l.postcard[0] : l.blurb, mood: 'happy' }));
  const [card, setCard] = useState(false);
  const stage = useRef<HTMLDivElement>(null), art = useRef<SVGGElement>(null), layer = useRef<SVGGElement>(null), btn = useRef<HTMLButtonElement>(null);
  const pending = useRef<{ part: string; kind: Task['kind']; prelude: 'olddome' | 'fire' | null; then: () => void } | null>(null);
  const [x, y, w, h] = FRAME[l.id];
  const uid = useId().replace(/:/g, '');

  // Once the job is paid for, its piece is drawn built: hide it before the first frame, then
  // play its building.
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p || !art.current || !layer.current) return;
    pending.current = null;
    hidePart(art.current, p.part);
    const svg = art.current.ownerSVGElement;
    const scale = svg ? svg.getBoundingClientRect().width / w : 1;
    buildPart({ art: art.current, layer: layer.current, part: p.part, kind: p.kind, scale, frameTop: y, prelude: p.prelude, onLand: () => { buzz('build'); bump(stage.current); } }).then(p.then);
  }, [built.length, decor.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const doBuild = async () => {
    if (busy || !next || !open || bal < next.cost) return;
    setBusy(true);
    buzz('spend');
    await flyStar(btn.current, art.current?.querySelector(`[data-part="${next.part}"]`) ?? stage.current);
    const prelude = PRELUDE[next.id] ?? null;
    if (prelude) setBuilding(next.part);
    pending.current = {
      part: next.part, kind: next.kind, prelude,
      then: () => {
        setBuilding(null);
        setBusy(false);
        setSay({ key: next.id, text: next.fact, mood: 'cheering' });
        // The last job: the postcard.
        if (l.tasks.every((t) => t.id === next.id || (j.built ?? []).includes(t.id))) setTimeout(() => { buzz('landmark'); setCard(true); }, 1200);
      },
    };
    j.build(next.id);
  };
  const doDecor = () => {
    if (busy || placed || acc < l.decor.need || !fin) return;
    setBusy(true);
    pending.current = { part: 'decor', kind: l.decor.kind, prelude: null, then: () => { setBusy(false); setSay({ key: l.decor.id, text: l.decor.fact, mood: 'cheering' }); } };
    j.placeDecor(l.decor.id);
  };

  const short = next ? next.cost - bal : 0;
  const k = doneCount(l, built);
  return (
    <div className="bm-page bm-site">
      <header className="level-title">
        <h1 className="level-name">{l.name}</h1>
        <span className="level-meta small"><Balance n={bal} /> <span className="muted">· {k} of {l.tasks.length} jobs</span></span>
      </header>
      <SamSays key={say.key} mood={say.mood} auto>{say.text}</SamSays>
      <div className="bm-site-grid">
        <div className="bm-stage card" ref={stage}>
          <svg className="bm bm-stage-svg" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMax meet" role="img" aria-label={`${l.name}: ${k} of ${l.tasks.length} pieces built${placed ? ', with its decoration' : ''}`}>
            <defs>
              <linearGradient id={`sky${uid}`} x1="0" y1={y} x2="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" style={{ stopColor: 'var(--bm-sky-0)' }} /><stop offset="0.8" style={{ stopColor: 'var(--bm-sky-1)' }} /><stop offset="1" style={{ stopColor: 'var(--bm-sky-2)' }} />
              </linearGradient>
              <linearGradient id="bm-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--bm-water-0)' }} /><stop offset="1" style={{ stopColor: 'var(--bm-water-1)' }} /></linearGradient>
            </defs>
            <rect x={x - 2000} y={y - 2000} width={w + 4000} height={2000 - y} fill={`url(#sky${uid})`} />
            <rect x={x - 2000} y={0} width={w + 4000} height={h + 2000} className="bm-lawn" />
            <rect x={x - 2000} y={0} width={w + 4000} height="6" className="bm-lawn-hi" />
            <Scenery id={l.id} x={x} w={w} />
            <g ref={art}><LandmarkArt id={l.id} parts={partStates(l, built)} decor={placed} building={building} /></g>
            <g ref={layer} className="bm-fx" />
          </svg>
          {!open && <div className="bm-stage-lock"><strong>Opens when the {before?.short} is finished</strong><a className="btn" href={'#mall-' + before?.id}>Go to the {before?.short}</a></div>}
        </div>
        <section className="bm-jobs" aria-label="Building jobs">
          <div className="stat-label">The jobs, in order</div>
          <ol>
            {l.tasks.map((t, i) => {
              const st = built.includes(t.id) ? 'done' : t.id === next?.id && open ? 'next' : 'later';
              return (
                <li key={t.id} data-state={st}>
                  <span className="bm-job-mark" aria-hidden="true">{st === 'done' ? '✓' : i + 1}</span>
                  <span className="bm-job-label">{t.label}{st === 'done' && <span className="sr-only"> (built)</span>}</span>
                  <span className="bm-job-cost" aria-label={`${t.cost} star${t.cost === 1 ? '' : 's'}`}>★{t.cost}</span>
                </li>
              );
            })}
            <li data-state={placed ? 'done' : fin && acc >= l.decor.need ? 'next' : 'later'} className="bm-job-decor">
              <span className="bm-job-mark" aria-hidden="true">{placed ? '✓' : '✦'}</span>
              <span className="bm-job-label">{l.decor.label}<span className="small muted bm-job-need"> · {acc >= l.decor.need ? 'unlocked' : <>needs a <a href="#daily">Daily Dollar</a> streak of {l.decor.need} day{l.decor.need === 1 ? '' : 's'}; your best is {acc}</>}{!fin && ' · after the last job'}</span></span>
              <span className="bm-job-cost" aria-label={`a ${l.decor.need}-day Daily Dollar streak`}>🔥{l.decor.need}</span>
            </li>
          </ol>
          <ul className="bm-sources small">
            {l.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}
          </ul>
        </section>
      </div>
      <ActionBar label="Build">
        {!open ? (
          <a className="btn btn-primary" href={'#mall-' + before?.id} data-primary>Finish the {before?.short} first</a>
        ) : next ? (
          short > 0
            ? <a className="btn btn-primary" href={src.href} data-primary>{short} more ★ needed · {src.label}</a>
            : <button type="button" className="btn btn-primary bm-build" ref={btn} onClick={doBuild} disabled={busy} data-primary>{busy ? 'Building…' : <>Build: {next.label} · <span className="bm-cost">★{next.cost}</span></>}</button>
        ) : !placed && acc >= l.decor.need ? (
          <button type="button" className="btn btn-primary bm-build" onClick={doDecor} disabled={busy} data-primary>{l.decor.label}</button>
        ) : !placed && fin ? (
          <a className="btn btn-primary" href="#daily" data-primary>🔥 Play the Daily Dollar</a>
        ) : after ? (
          <a className="btn btn-primary" href={'#mall-' + after.id} data-primary>Next landmark: the {after.short}</a>
        ) : (
          <a className="btn btn-primary" href="#mall" data-primary>See the whole Mall</a>
        )}
        <a className="btn" href="#mall">The whole Mall</a>
      </ActionBar>
      {card && <Postcard l={l} placed={placed} after={after} acc={acc} onClose={() => setCard(false)} />}
    </div>
  );
}

/** What stands around each landmark at its site: trees, a path, the city behind. */
function Scenery({ id, x, w }: { id: LandmarkId; x: number; w: number }) {
  const trees = (xs: number[], y: number, r: number) => xs.map((tx, i) => <g key={tx} className="bm-scenery-tree"><TreeSimple x={tx} y={y + (i % 2) * 3} r={r + (i % 3) * 3} /></g>);
  const L = x + 20, R = x + w - 20;
  if (id === 'monument') return <>{trees([L + 10, L + 50, R - 50, R - 10], 8, 22)}</>;
  if (id === 'lincoln') return <>{trees([L, L + 30, R - 30, R], -2, 24)}</>;
  if (id === 'jefferson') return null;
  if (id === 'treasury') return <><rect x={x - 2000} y="6" width={w + 4000} height="22" className="bm-street" />{trees([L - 10, R + 10], 0, 20)}</>;
  if (id === 'whitehouse') return <>{trees([L, L + 34, R - 34, R], 4, 24)}</>;
  return <>{trees([L, L + 36, R - 36, R], 2, 26)}</>;
}
function TreeSimple({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <>
      <rect x={x - r * 0.1} y={y - r * 0.9} width={r * 0.2} height={r * 0.9} className="bm-trunk" />
      <circle cx={x} cy={y - r * 1.25} r={r * 0.72} className="bm-tree" />
      <circle cx={x - r * 0.48} cy={y - r * 0.95} r={r * 0.5} className="bm-tree" />
      <circle cx={x + r * 0.5} cy={y - r * 1.0} r={r * 0.52} className="bm-tree-side" />
    </>
  );
}

/** A finished landmark: a postcard with three facts, its sources, and what comes next. */
function Postcard({ l, placed, after, acc, onClose }: { l: Landmark; placed: boolean; after: Landmark | null; acc: number; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true });
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [x, y, w, h] = FRAME[l.id];
  const all = Object.fromEntries(l.tasks.map((t) => [t.part, 'built' as const]));
  return (
    <div className="celebrate-scrim" onClick={onClose}>
      <div className="celebrate bm-postcard" role="dialog" aria-modal="true" aria-labelledby="bm-pc-t" onClick={(e) => e.stopPropagation()} ref={box}>
        <div className="bm bm-postcard-art">
          <svg className="bm" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
            <rect x={x - 400} y={y - 400} width={w + 800} height={400 - y} className="bm-pc-sky" />
            <rect x={x - 400} y={0} width={w + 800} height={h + 400} className="bm-lawn" />
            <LandmarkArt id={l.id} parts={all} decor={placed} />
          </svg>
          <span className="bm-postcard-stamp" aria-hidden="true">★</span>
          <button type="button" className="celebrate-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="celebrate-body">
          <div className="stat-label">Greetings from the National Mall</div>
          <h2 className="celebrate-title" id="bm-pc-t">{l.name} is finished!</h2>
          <ul className="takeaways">{l.postcard.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="small muted">{acc >= l.decor.need ? `Its finishing touch is unlocked: ${l.decor.label.toLowerCase()}.` : `Its finishing touch (${l.decor.label.toLowerCase()}) unlocks with a ${l.decor.need}-day Daily Dollar streak; your best is ${acc}.`} Sources: {l.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></span>)}.</p>
          <div className="celebrate-actions">
            {after ? <a className="btn btn-primary" href={'#mall-' + after.id} data-primary onClick={onClose}>Next landmark: the {after.short}</a> : <a className="btn btn-primary" href="#mall" data-primary onClick={onClose}>See the whole Mall</a>}
            <button type="button" className="btn" onClick={onClose}>Stay here</button>
          </div>
        </div>
      </div>
    </div>
  );
}

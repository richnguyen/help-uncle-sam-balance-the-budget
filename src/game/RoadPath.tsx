import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FRAME, LandmarkArt } from './build/art';
import { doneCount, isComplete, LANDMARK_BY_ID, nextTask, partStates } from './build/landmarks';
import { LevelIcon } from './icons';
import { CAMPAIGNS, isUnlocked, LEVELS, missionShort, STOPS, unlockText } from './levels';
import { queueQuick } from './quickplay';
import { CAMP_COLOR, MATERIAL, road, type Spot, W, type Zone } from './roadLayout';
import { useJourney } from './state';
import { useDailyStreak } from './streak';
import { UncleSam } from './UncleSam';

// The road map: a walk from the Lincoln Memorial to the Capitol with one stop per mission (see
// roadLayout.ts for where things sit and how the ground is drawn). The stop you are on is bigger,
// with a ring for its steps, a START or CONTINUE bubble, and Uncle Sam beside it; a tap on any stop
// opens its card. The campaign's header stays pinned while you scroll; a tap on it opens all three
// campaigns, and its book opens that campaign's briefing. The landmarks beside the walk are the
// ones built with stars on the Mall: built parts stand in full, the rest show as blueprints.

const Star = ({ on }: { on: boolean }) => <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3L2.8 9.5l6.4-.9z" fill={on ? '#c28f12' : '#aab5a8'} /></svg>;
const Check = () => <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const BookIcon = () => <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" {...stroke} /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 21H20v-3" {...stroke} /><path d="M8.5 7.5h7M8.5 11h5" {...stroke} /></svg>;
const LockGlyph = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" {...stroke} /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" {...stroke} /></svg>;

/** The ring around the stop you are on: one arc per step of the mission, the done ones filled. */
function Ring({ steps, done }: { steps: number; done: number }) {
  const r = 49, c = 2 * Math.PI * r, gap = steps > 1 ? 9 : 0, seg = c / steps - gap;
  const turn = -90 + (gap / 2 / c) * 360;
  return (
    <svg className="rp-ring" width="112" height="112" viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="56" cy="56" r={r} fill="none" className="rp-ring-track" strokeWidth="8" strokeDasharray={`${seg} ${gap}`} transform={`rotate(${turn} 56 56)`} />
      {done > 0 && <circle cx="56" cy="56" r={r} fill="none" className="rp-ring-done" strokeWidth="8" strokeDasharray={`${Array.from({ length: done }, () => `${seg} ${gap}`).join(' ')} 0 ${c}`} transform={`rotate(${turn} 56 56)`} />}
    </svg>
  );
}

type Sheet = { kind: 'campaigns' } | { kind: 'briefing'; n: number } | null;

export function RoadPath({ scrollTo }: { scrollTo?: string | null }) {
  const j = useJourney();
  const R = useMemo(road, []);
  const streak = useDailyStreak();
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [learned, setLearned] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [camp, setCamp] = useState<1 | 2 | 3>(1);
  const [away, setAway] = useState<'up' | 'down' | null>(null);
  const built = j.built ?? [], decor = j.decor ?? [];
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam)) ?? null;
  const here = R.spots.find((p) => p.s.id === next?.id) ?? null;
  const stepsOf = (id: string) => LEVELS.find((l) => l.id === id)?.steps.length ?? 0;
  const doneSteps = (id: string) => Math.min(stepsOf(id), (j.steps[id] ?? []).length);

  // The stage is 390 units wide; it grows or shrinks to the screen.
  useLayoutEffect(() => {
    const el = wrap.current; if (!el) return;
    const fit = () => setK(Math.max(0.8, Math.min(1.25, el.clientWidth / W)));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Open at the stop you are on (or at a campaign another page asked for).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const target = scrollTo ? document.getElementById(scrollTo) : stage.current?.querySelector<HTMLElement>('.stop[data-next="true"]');
      target?.scrollIntoView({ block: scrollTo ? 'start' : 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Which campaign is under the pinned header, and whether your stop has scrolled out of view.
  useEffect(() => {
    let raf = 0;
    const look = () => {
      raf = 0;
      const st = stage.current; if (!st) return;
      const top = st.getBoundingClientRect().top, line = 170;
      const y = (line - top) / k;
      setCamp((R.zones.find((z) => y < z.y1) ?? R.zones[2]).n);
      if (here) { const sy = top + here.y * k; setAway(sy < 120 ? 'up' : sy > innerHeight - 110 ? 'down' : null); } else setAway(null);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(look); };
    look();
    addEventListener('scroll', on, { passive: true }); addEventListener('resize', on);
    return () => { removeEventListener('scroll', on); removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, [k, here?.y]); // eslint-disable-line react-hooks/exhaustive-deps
  // A tap elsewhere, or Escape, closes the card and the sheet.
  useEffect(() => {
    if (!open && !sheet) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); setSheet(null); } };
    const tap = (e: MouseEvent) => { if (open && !(e.target as HTMLElement).closest('.rp-card, .stop-btn')) setOpen(null); };
    addEventListener('keydown', key); addEventListener('click', tap);
    return () => { removeEventListener('keydown', key); removeEventListener('click', tap); };
  }, [open, sheet]);
  const toStop = () => stage.current?.querySelector<HTMLElement>('.stop[data-next="true"]')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const toCampaign = (n: number) => { setSheet(null); requestAnimationFrame(() => document.getElementById('campaign-' + n)?.scrollIntoView({ block: 'start' })); };

  const stateOf = (p: Spot) => {
    const done = j.done.includes(p.s.id), stars = j.stars[p.s.id] ?? 0;
    const unlocked = isUnlocked(p.s.id, j.done, j.settings.freeRoam);
    return { done, stars, unlocked, state: done ? (stars >= 3 ? 'gold' : 'done') : p.s.id === next?.id ? 'next' : unlocked ? 'open' : 'locked' };
  };
  const campStats = (z: Zone) => {
    const done = z.spots.filter((p) => j.done.includes(p.s.id)).length;
    const stars = z.spots.reduce((a, p) => a + (j.stars[p.s.id] ?? 0), 0);
    return { done, of: z.spots.length, stars, has: z.spots.some((p) => p.s.id === next?.id), opened: isUnlocked(z.spots[0].s.id, j.done, j.settings.freeRoam) };
  };
  const zone = R.zones[camp - 1], cs = campStats(zone);
  const headLine = cs.has ? `Mission ${next!.mission} of ${cs.of}` : cs.done === cs.of ? `All ${cs.of} missions done` : cs.opened ? `${cs.done} of ${cs.of} missions done` : `${cs.of} missions · locked`;
  // The walked part of the walk: every piece up to the stop you are on.
  const walked = (z: Zone) => {
    const upTo = !next ? z.spots.length : next.campaign > z.n ? z.spots.length : next.campaign < z.n ? 0 : z.spots.findIndex((p) => p.s.id === next.id) + 1;
    return z.segs.slice(0, upTo).join(' ');
  };
  const samSays = !here ? null : here.boss ? 'The big one, partner.' : (() => { const n = stepsOf(here.s.id), d = doneSteps(here.s.id); return d === 0 ? (j.done.length ? 'Next stop, partner!' : 'Start here, partner!') : `${n - d} step${n - d === 1 ? '' : 's'} to go, partner!`; })();
  const card = open ? R.spots.find((p) => p.s.id === open) ?? null : null;

  return (
    <div className="rp bm" ref={wrap} style={{ '--k': k } as CSSProperties}>
      <div className="rp-head" data-camp={camp} style={{ '--cc': CAMP_COLOR[camp].c, '--ce': CAMP_COLOR[camp].e } as CSSProperties}>
        <button type="button" className="rp-head-main" onClick={() => setSheet({ kind: 'campaigns' })} aria-haspopup="dialog" aria-label={`Campaign ${camp}, ${CAMPAIGNS[camp - 1].title}: ${headLine}. See all campaigns`}>
          <span className="rp-head-eyebrow">Campaign {camp} · {headLine}</span>
          <strong className="rp-head-title">{CAMPAIGNS[camp - 1].title}</strong>
        </button>
        <button type="button" className="rp-head-book" onClick={() => setSheet({ kind: 'briefing', n: camp })} aria-haspopup="dialog" aria-label={`Campaign ${camp} briefing`}><BookIcon /></button>
      </div>

      <div className="rp-fit" style={{ height: R.H * k }}>
        <div className="rp-stage" ref={stage} style={{ width: W, height: R.H }}>
          <svg className="rp-ground" width={W} height={R.H} viewBox={`0 0 ${W} ${R.H}`} aria-hidden="true">
            <defs dangerouslySetInnerHTML={{ __html: R.defs }} />
            <g dangerouslySetInnerHTML={{ __html: R.ground }} />
            {R.zones.map((z) => <path key={z.n} d={walked(z)} fill="none" stroke={CAMP_COLOR[z.n].c} strokeWidth="7" strokeLinecap="round" strokeDasharray="1 15" />)}
          </svg>

          {R.marks.map((m) => {
            const l = LANDMARK_BY_ID[m.id], f = FRAME[m.id], h = m.w * (f[3] / f[2]);
            const fin = isComplete(l, built), task = nextTask(l, built), n = doneCount(l, built);
            return (
              <div key={m.id} className="rp-mark" data-built={fin || undefined}>
                <svg viewBox={f.join(' ')} width={m.w} height={h} style={{ left: m.x, top: m.y }} role="img" aria-label={`${l.name}: ${fin ? 'built' : n ? `${n} of ${l.tasks.length} parts built` : 'not built yet, a blueprint'}`}>
                  <LandmarkArt id={m.id} parts={partStates(l, built)} decor={decor.includes(l.decor.id)} site={m.site} />
                </svg>
                <a className="rp-chip" href={'#mall-' + m.id} style={{ left: m.chipX, top: m.chipY }}>{fin ? 'You built this' : task ? `Build it: ${task.cost} star${task.cost === 1 ? '' : 's'}` : 'On the Mall'}</a>
              </div>
            );
          })}
          {R.captions.map((c) => <span key={c.text} className="rp-cap" style={{ left: c.x, top: c.y, width: c.w }}>{c.text}</span>)}
          {R.sides.map((s) => (
            <a key={s.kind} className="rp-side" data-kind={s.kind} href={s.href} style={{ left: s.x - 28, top: s.y - 28 }}>
              <span className="rp-side-dot" aria-hidden="true">
                {s.kind === 'daily'
                  ? <svg width="26" height="26" viewBox="0 0 24 24"><rect x="4" y="5.5" width="16" height="14" rx="2.2" {...stroke} /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" {...stroke} /><path d="M9 14.6l2 2 4-4.2" {...stroke} /></svg>
                  : <svg width="26" height="26" viewBox="0 0 24 24"><path d="M3.5 8V6.5A1.5 1.5 0 0 1 5 5h4l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" {...stroke} /><rect x="9.6" y="11.6" width="4.8" height="3.9" rx="0.9" {...stroke} /><path d="M10.6 11.6v-1a1.4 1.4 0 0 1 2.8 0v1" {...stroke} /></svg>}
              </span>
              <span className="rp-side-label"><strong>{s.label}</strong><span>{s.kind === 'daily' ? (streak.run > 0 ? `${streak.run}-day streak` : 'Today’s five') : s.sub}</span></span>
            </a>
          ))}

          {R.zones.map((z) => {
            const st = campStats(z), col = CAMP_COLOR[z.n];
            return (
              <section key={z.n} id={'campaign-' + z.n} className="rp-camp" data-camp={z.n} aria-labelledby={'rp-camp-' + z.n} style={{ top: z.y0, height: z.y1 - z.y0, '--cc': col.c, '--ce': col.e } as CSSProperties}>
                <h2 id={'rp-camp-' + z.n} className={z.n === 1 ? 'sr-only' : 'rp-gate'} data-open={st.opened || undefined}>
                  {z.n > 1 && <span className="rp-gate-lock" aria-hidden="true">{st.opened ? null : <LockGlyph size={24} />}</span>}
                  <span className="rp-gate-text">
                    <span className="rp-gate-eyebrow">Campaign {z.n} · {st.of} missions</span>
                    <span className="rp-gate-title">{CAMPAIGNS[z.n - 1].title}</span>
                    {z.n > 1 && !st.opened && <span className="rp-gate-sub">Opens when Campaign {z.n - 1}’s budget desk is done</span>}
                  </span>
                </h2>
                <ol className="roadmap">
                  {z.spots.map((p) => {
                    const { done, stars, unlocked, state } = stateOf(p);
                    const size = p.boss ? 96 : state === 'next' ? 76 : 68, y = p.y - z.y0;
                    const n = stepsOf(p.s.id), d = doneSteps(p.s.id);
                    const label = `${p.boss ? 'Final mission' : missionShort(p.s)}, ${p.s.title}: ${done ? `done, ${stars} of 3 stars` : state === 'next' ? (n ? `${d} of ${n} steps done` : 'ready') : unlocked ? 'open' : 'locked'}`;
                    return (
                      <li key={p.s.id} className="stop" data-state={state} data-done={done} data-open={unlocked} data-kind={p.s.kind} data-next={state === 'next'} data-boss={p.boss || undefined} style={{ left: p.x, top: y }}>
                        {p.boss && <svg className="rp-laurel" width="124" height="124" viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="57" fill="none" stroke="#d9a520" strokeWidth="4" strokeDasharray="3 9" strokeLinecap="round" /></svg>}
                        {state === 'next' && !p.boss && n > 0 && <Ring steps={n} done={d} />}
                        <button type="button" className="stop-btn" style={{ width: size, height: size }} aria-label={label} aria-expanded={open === p.s.id} onClick={() => { setLearned(false); setOpen(open === p.s.id ? null : p.s.id); }}>
                          {done ? <Check /> : <LevelIcon id={p.s.icon} size={p.boss ? 46 : state === 'next' ? 36 : 30} />}
                        </button>
                        {state === 'next' && open !== p.s.id && <span className="rp-bubble" aria-hidden="true"><span>{d > 0 ? 'Continue' : 'Start'}</span></span>}
                        {done && <span className="rp-stars" aria-hidden="true"><Star on={stars >= 1} /><Star on={stars >= 2} /><Star on={stars >= 3} /></span>}
                        <span className="stop-meta sr-only"><span>{p.boss ? 'Final mission' : missionShort(p.s)}</span></span>
                        {p.boss && <span className="rp-final" aria-hidden="true"><span>Final mission · budget desk</span></span>}
                        <h3 className="stop-title"><span>{p.s.title}</span></h3>
                        {state === 'next' && n > 0 && d > 0 && <span className="rp-step">Step {Math.min(n, d + 1)} of {n}</span>}
                        <span className="small sr-only">{unlocked ? p.s.topic : unlockText(p.s.id)}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}

          {here && samSays && (
            <div className="rp-sam" data-side={here.x >= 195 ? 'left' : 'right'} style={{ left: here.x >= 195 ? here.x - 138 : here.x + 68, top: here.y - (here.boss ? 20 : 34) }} aria-hidden="true">
              <span className="rp-sam-says">{samSays}</span>
              <UncleSam mood="happy" size={64} crop="bust" greet={false} />
            </div>
          )}

          {card && (() => {
            const { done, stars, unlocked, state } = stateOf(card);
            const lv = LEVELS.find((l) => l.id === card.s.id), n = stepsOf(card.s.id), d = doneSteps(card.s.id);
            const col = state === 'locked' ? { c: '#5f6a61', e: '#454e47' } : state === 'gold' ? { c: '#8a6410', e: '#684a08' } : CAMP_COLOR[card.s.campaign];
            const below = card.y + (card.boss ? 74 : 58);
            return (
              <div className="rp-card" role="dialog" aria-label={card.s.title} style={{ top: below, '--cc': col.c, '--ce': col.e, '--ax': `${card.x - 20}px` } as CSSProperties}>
                <span className="rp-card-eyebrow">{card.boss ? `Final mission ${card.s.campaign}.${card.s.mission} · budget desk` : missionShort(card.s)} · {card.s.difficulty} · about {card.s.minutes} min{done ? ` · ${stars} of 3 stars` : ''}</span>
                <strong className="rp-card-title">{card.s.title}</strong>
                <span className="rp-card-sub">{card.s.topic}{!unlocked ? `. ${unlockText(card.s.id)}.` : ''}</span>
                {unlocked && !done && n > 0 && d > 0 && (
                  <span className="rp-card-steps"><span className="rp-card-bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>{Array.from({ length: n }, (_, i) => <i key={i} data-on={i < d || undefined} />)}</span><span>Step {Math.min(n, d + 1)} of {n}</span></span>
                )}
                {learned && lv && <ul className="rp-card-learned">{lv.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>}
                {unlocked && <a className="rp-card-go" href={'#' + card.s.id}>{done ? (stars < 3 ? 'Replay for more stars' : 'Play again') : d > 0 ? 'Continue' : 'Start'}</a>}
                {unlocked && !done && lv && lv.steps.some((s) => s.game) && <a className="rp-card-alt" href={'#' + card.s.id} onClick={() => queueQuick(card.s.id)}>Quick play · 1 minute, up to 2 stars</a>}
                {done && lv && <button type="button" className="rp-card-alt" aria-expanded={learned} onClick={() => setLearned(!learned)}>{learned ? 'Hide what I learned' : 'What I learned'}</button>}
              </div>
            );
          })()}
        </div>
      </div>

      {away && here && <button type="button" className="rp-back" onClick={toStop} aria-label="Back to my stop"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d={away === 'up' ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}

      {sheet && (
        <div className="rp-scrim" onClick={() => setSheet(null)}>
          <div className="rp-sheet bm" role="dialog" aria-modal="true" aria-label={sheet.kind === 'campaigns' ? 'Campaigns' : `Campaign ${sheet.n} briefing`} onClick={(e) => e.stopPropagation()}>
            <header className="rp-sheet-head">
              <button type="button" className="rp-sheet-x" onClick={() => setSheet(null)} aria-label="Close" autoFocus><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg></button>
              <h2>{sheet.kind === 'campaigns' ? 'Campaigns' : `Campaign ${sheet.n} briefing`}</h2>
            </header>
            {sheet.kind === 'campaigns' ? (
              <div className="rp-sheet-body">
                {R.zones.map((z) => {
                  const st = campStats(z), col = CAMP_COLOR[z.n], art = (['lincoln', 'jefferson', 'capitol'] as const)[z.n - 1], f = FRAME[art];
                  return (
                    <section key={z.n} className="rp-cc" style={{ '--cc': col.c, '--ce': col.e } as CSSProperties}>
                      <div className="rp-cc-art" style={{ background: col.tint }}>
                        <svg viewBox={f.join(' ')} height="64" width={64 * (f[2] / f[3])} aria-hidden="true"><LandmarkArt id={art} parts={partStates(LANDMARK_BY_ID[art], built)} site={art !== 'capitol'} /></svg>
                        <span className="rp-cc-n">{st.of} missions</span>
                      </div>
                      <svg className="rp-cc-strip" viewBox="0 0 358 12" preserveAspectRatio="none" aria-hidden="true"><rect width="358" height="12" fill={`url(#${MATERIAL[z.material].id})`} /><rect width="358" height="1.5" fill={MATERIAL[z.material].edge} /></svg>
                      <div className="rp-cc-body">
                        <div className="rp-cc-row"><span className="rp-cc-eyebrow">Campaign {z.n}{st.has ? ' · you are here' : ''}</span><span className="rp-cc-stars">{st.stars} of {st.of * 3} stars</span></div>
                        <strong className="rp-cc-title">{CAMPAIGNS[z.n - 1].title}</strong>
                        <span className="rp-cc-walk">The walk: {z.walkName}</span>
                        <div className="rp-cc-row"><div className="rp-cc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.of} aria-valuenow={st.done} aria-label={`${st.done} of ${st.of} missions done`}><i style={{ width: `${(st.done / st.of) * 100}%` }} /></div><span className="rp-cc-count">{st.done} of {st.of}</span></div>
                        {st.has ? <a className="rp-cc-go" href={'#' + next!.id}>{doneSteps(next!.id) > 0 ? 'Continue' : 'Start'}: {missionShort(next!)}</a>
                          : st.opened ? <button type="button" className="rp-cc-see" onClick={() => toCampaign(z.n)}>{st.done === st.of ? 'See it on the path' : 'Go to this campaign'}</button>
                          : <span className="rp-cc-locked"><LockGlyph /> Opens after Campaign {z.n - 1}</span>}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="rp-sheet-body rp-brief" style={{ '--cc': CAMP_COLOR[sheet.n].c } as CSSProperties}>
                <strong className="rp-brief-title">{CAMPAIGNS[sheet.n - 1].title}</strong>
                <p>{CAMPAIGNS[sheet.n - 1].blurb}</p>
                <ol className="rp-brief-list">
                  {R.zones[sheet.n - 1].spots.map((p) => {
                    const { done, stars, unlocked } = stateOf(p);
                    return (
                      <li key={p.s.id} data-done={done || undefined} data-locked={!unlocked || undefined}>
                        <span className="rp-brief-icon" aria-hidden="true">{done ? <Check /> : <LevelIcon id={p.s.icon} size={18} />}</span>
                        <span className="rp-brief-text"><strong>{unlocked ? <a href={'#' + p.s.id}>{p.s.title}</a> : p.s.title}</strong><span>{p.boss ? 'Final mission · budget desk' : missionShort(p.s)} · {p.s.topic} · about {p.s.minutes} min{done ? ` · ${stars} of 3 stars` : ''}</span></span>
                      </li>
                    );
                  })}
                </ol>
                <button type="button" className="rp-cc-see" onClick={() => toCampaign(sheet.n)}>See it on the path</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

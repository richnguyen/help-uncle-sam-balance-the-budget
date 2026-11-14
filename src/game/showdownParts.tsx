import type { ReactNode } from 'react';
import { LAST_FY } from '../lib/assess';
import { LEVERS } from '../lib/sandbox';
import { cardName } from './ChallengeParts';
import { assessDuel, divergence, dossier, type DuelPlan, fog, RATING_NAME, type Rating, type RoundWinner, whoPays } from './duel';
import { esc, svgToPng } from './share';

// The Sealed Showdown's set pieces: the classified dossier (a sealed plan's rating, card count and
// debt figure, with the moves blacked out), the benchmark strip a friend builds against (the fog
// of war), the picture for each round of the reveal, the referee's stamp, and "Where you split".
// Two plans always wear the same two colors: yours blue, theirs orange.

const pc1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** The dossier: what a sealed plan shows. `unsealed` lifts the bars (the moves, once both plans are in). */
export function Dossier({ name, plan, mine = false, children }: { name?: string; plan: DuelPlan; mine?: boolean; children?: ReactNode }) {
  const d = dossier(plan);
  const whose = mine ? 'Your' : name ? `${name}’s` : 'A friend’s';
  return (
    <div className="dossier" data-rating={d.rating} role="group" aria-label={`${whose} plan, sealed`}>
      <span className="dossier-tab">Sealed budget plan</span>
      <span className="dossier-stamp" aria-hidden="true">Classified</span>
      <strong className="dossier-title"><span aria-hidden="true">🔒</span> {whose} {d.met ? 'balanced budget' : 'budget plan'}</strong>
      <dl className="dossier-facts">
        <div><dt>Plan rating</dt><dd><span className="dossier-rating" data-rating={d.rating}>{RATING_NAME(d.rating)}</span></dd></div>
        <div><dt>Cards played</dt><dd className="num">{d.cards} CBO option{d.cards === 1 ? '' : 's'}</dd></div>
        <div><dt>Debt by FY{LAST_FY}</dt><dd className="num">{d.debt}% of GDP</dd></div>
      </dl>
      <div className="dossier-moves">
        <span className="dossier-k">Moves{d.levers ? ` · ${d.cards} card${d.cards === 1 ? '' : 's'} + ${d.levers} across the board` : ''}</span>
        <ul aria-label={`${d.moves} moves, blacked out`}>
          {d.bars.map((w, i) => <li key={i} style={{ width: `${w}%` }} />)}
        </ul>
        {d.moves > d.bars.length && <span className="small">+ {d.moves - d.bars.length} more</span>}
      </div>
      {children}
    </div>
  );
}

const RATINGS: Rating[] = ['gentle', 'moderate', 'steep'];
// The debt scale the strip and the race share: 55% to 110% of GDP covers every plan that balances (and the do-nothing path).
const D0 = 0.55, D1 = 1.1;
const at = (x: number) => `${Math.max(0, Math.min(1, (x - D0) / (D1 - D0))) * 100}%`;

/**
 * The fog of war, shown on the desk while a friend builds against a sealed plan: a dotted line for
 * the sealed debt figure, the band (only the band) of its economy rating, and one clue for the
 * balance round.
 */
export function FogStrip({ sealed, mine, name }: { sealed: DuelPlan; mine: DuelPlan; name?: string }) {
  const f = fog(sealed);
  const a = assessDuel(mine);
  const used = mine.ids.length > 0 || LEVERS.some((l) => mine.lv[l.id]);
  const myDebt = a.last.debt / a.last.gdp;
  const state = !used ? 'none' : myDebt < f.debt - 0.001 ? 'ahead' : myDebt > f.debt + 0.001 ? 'behind' : 'even';
  const who = name ? `${name}’s` : 'The';
  const myBand = a.econ.rating;
  const econ = !used ? 'none' : RATINGS.indexOf(myBand) < RATINGS.indexOf(f.band) ? 'ahead' : RATINGS.indexOf(myBand) > RATINGS.indexOf(f.band) ? 'behind' : 'even';
  const WORD = { none: 'Not started', ahead: 'Ahead', behind: 'Behind', even: 'Too close to call' } as const;
  return (
    <section className="card fog" id="fog" aria-label={`${who} sealed benchmark`}>
      <div className="fog-head">
        <strong><span aria-hidden="true">🔒</span> {who} sealed benchmark</strong>
        <span className="small muted">What the dossier shows. The moves stay sealed until you lock in yours.</span>
      </div>
      <div className="fog-row" data-state={state}>
        <span className="fog-k">Round 1 · Debt</span>
        <span className="fog-s">{WORD[state]}</span>
        <div className="fog-track fog-debt" role="img" aria-label={`Debt by FY${LAST_FY}: yours ${pc1(myDebt)} of GDP, the sealed plan ${pc1(f.debt)}. Lower wins.`}>
          <span className="fog-ghost" style={{ left: at(f.debt) }}><i>Sealed {Math.round(f.debt * 100)}%</i></span>
          <span className="fog-me" style={{ left: at(myDebt) }}><i>You {Math.round(myDebt * 100)}%</i></span>
        </div>
        <span className="fog-note small muted">Debt by FY{LAST_FY}, as a share of the economy. Lower wins the round.</span>
      </div>
      <div className="fog-row" data-state={econ}>
        <span className="fog-k">Round 2 · Economy</span>
        <span className="fog-s">{WORD[econ]}</span>
        <div className="fog-track fog-econ" role="img" aria-label={`Hit to the economy: yours is ${RATING_NAME(myBand)}; the sealed plan is somewhere in ${RATING_NAME(f.band)}. Gentler wins.`}>
          {RATINGS.map((r) => <span key={r} className={'z z-' + r} data-ghost={r === f.band || undefined}>{r === f.band && <i>Sealed</i>}</span>)}
          <span className="fog-me" style={{ left: `${Math.min(a.econ.peakStep, 0.015) / 0.015 * 100}%` }}><i>You</i></span>
        </div>
        <span className="fog-note small muted">The sealed plan is somewhere in {RATING_NAME(f.band)}. Gentler wins the round.</span>
      </div>
      <div className="fog-row fog-row-clue">
        <span className="fog-k">Round 3 · Balance</span>
        <span className="fog-s">In the fog</span>
        <p className="fog-clue"><strong>Clue:</strong> {f.clue}</p>
        <span className="fog-note small muted">The split closer to half taxes, half cuts wins the round.</span>
      </div>
    </section>
  );
}

/** The scoreboard's slim debt gauge in a showdown: your debt figure, and a dotted line for the sealed plan's. */
export function DebtGhost({ sealed, mine }: { sealed: DuelPlan; mine: DuelPlan }) {
  const f = fog(sealed), a = assessDuel(mine), my = a.last.debt / a.last.gdp;
  return (
    <div className="hb-gauge hb-ghost">
      <div className="hb-label"><span>Debt</span> <strong>{Math.round(my * 100)}%</strong></div>
      <div className="fog-track fog-debt fog-mini" role="img" aria-label={`Debt by FY${LAST_FY}: yours ${pc1(my)} of GDP; the sealed benchmark is ${pc1(f.debt)}. Lower wins.`}>
        <span className="fog-ghost" style={{ left: at(f.debt) }} />
        <span className="fog-me" style={{ left: at(my) }} />
      </div>
    </div>
  );
}

/** The referee's stamp on a round: who took it, and by what. */
export function Stamp({ winner, children }: { winner: RoundWinner; children: ReactNode }) {
  return <div className="duel-stamp" data-winner={winner}><span>{children}</span></div>;
}

const legend = (me: string, other: string) => (
  <div className="face-legend" aria-hidden="true"><span><i className="sw sw-me" />{me}</span><span><i className="sw sw-them" />{other}</span></div>
);

/** Round 1: the two debt paths, drawn year by year, side by side. */
export function DebtRace({ mine, theirs, other }: { mine: DuelPlan; theirs: DuelPlan; other: string }) {
  const a = assessDuel(mine), b = assessDuel(theirs);
  const W = 320, H = 128, L = 34, R = 46, T = 10, B = 20;
  const ys = [...a.sim, ...b.sim].map((y) => y.debt / y.gdp);
  const lo = Math.floor(Math.min(...ys) * 20) / 20, hi = Math.ceil(Math.max(...ys) * 20) / 20;
  const n = a.sim.length;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const path = (s: typeof a.sim) => s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.debt / p.gdp).toFixed(1)}`).join(' ');
  const end = (s: typeof a.sim) => s.at(-1)!.debt / s.at(-1)!.gdp;
  // Keep the two end labels apart when the paths finish close together.
  let ya = y(end(a.sim)), yb = y(end(b.sim));
  if (Math.abs(ya - yb) < 13) { const mid = (ya + yb) / 2, up = ya <= yb; ya = mid + (up ? -7 : 7); yb = mid + (up ? 7 : -7); }
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <figure className="face face-debt">
      {legend('You', other)}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Debt as a share of the economy, FY${a.sim[0].fy} to FY${LAST_FY}: your plan ends at ${pc1(end(a.sim))}, ${other}’s at ${pc1(end(b.sim))}.`}>
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="face-grid" /><text x={L - 5} y={y(t) + 3.5} textAnchor="end" className="face-tick">{Math.round(t * 100)}%</text></g>)}
        <text x={L} y={H - 5} className="face-tick">FY{a.sim[0].fy}</text>
        <text x={W - R} y={H - 5} textAnchor="end" className="face-tick">FY{LAST_FY}</text>
        <path d={path(b.sim)} pathLength={1} className="face-line face-them" />
        <path d={path(a.sim)} pathLength={1} className="face-line face-me" />
        <circle cx={x(n - 1)} cy={y(end(b.sim))} r="4" className="face-dot face-them" />
        <circle cx={x(n - 1)} cy={y(end(a.sim))} r="4" className="face-dot face-me" />
        <text x={x(n - 1) + 8} y={ya + 4} className="face-end">{pc1(end(a.sim))}</text>
        <text x={x(n - 1) + 8} y={yb + 4} className="face-end">{pc1(end(b.sim))}</text>
      </svg>
    </figure>
  );
}

/** Round 2: each plan's steepest year on the gentle / moderate / steep scale. */
export function EconFace({ mine, theirs, other }: { mine: DuelPlan; theirs: DuelPlan; other: string }) {
  const a = assessDuel(mine).econ.peakStep, b = assessDuel(theirs).econ.peakStep;
  const max = Math.max(0.015, a, b) * 1.04;
  const mark = (v: number, cls: string, label: string) => <span className={'face-mark ' + cls} style={{ left: `${(v / max) * 100}%` }}><i>{label} {(v * 100).toFixed(2)}%</i></span>;
  return (
    <figure className="face face-econ">
      {legend('You', other)}
      <div className="face-scale" role="img" aria-label={`Steepest single-year tightening: your plan ${(a * 100).toFixed(2)}% of GDP, ${other}’s ${(b * 100).toFixed(2)}%.`}>
        <div className="face-zones">
          <span className="z z-gentle" style={{ width: `${(0.005 / max) * 100}%` }}>Gentle</span>
          <span className="z z-moderate" style={{ width: `${(0.005 / max) * 100}%` }}>Moderate</span>
          <span className="z z-steep" style={{ flex: 1 }}>Steep</span>
        </div>
        {mark(a, 'face-me up', 'You')}
        {mark(b, 'face-them down', other)}
      </div>
    </figure>
  );
}

/** Round 3: each plan's split between new taxes and spending cuts, against the halfway line. */
export function BalanceFace({ mine, theirs, other }: { mine: DuelPlan; theirs: DuelPlan; other: string }) {
  const row = (p: DuelPlan, who: string, cls: string) => {
    const s = assessDuel(p), w = whoPays(s), t = Math.round(w.taxShare * 100);
    return (
      <div className={'face-split ' + cls}>
        <span className="face-who"><i className={'sw ' + (cls === 'is-me' ? 'sw-me' : 'sw-them')} />{who} · <span className="face-rating">{RATING_NAME(s.econ.rating)}</span></span>
        <div className="face-bar" role="img" aria-label={`${who}: ${t}% taxes, ${100 - t}% cuts`}>
          <span className="fb-tax" style={{ width: `${t}%` }}>{t >= 18 ? `${t}% taxes` : ''}</span>
          <span className="fb-cut" style={{ width: `${100 - t}%` }}>{100 - t >= 18 ? `${100 - t}% cuts` : ''}</span>
          <span className="fb-half" aria-hidden="true" />
        </div>
      </div>
    );
  };
  return <figure className="face face-balance">{row(mine, 'You', 'is-me')}{row(theirs, other, 'is-them')}<figcaption className="small muted">The line marks half and half. Closer wins.</figcaption></figure>;
}

const leverMoves = (p: DuelPlan) => LEVERS.filter((l) => p.lv[l.id]).map((l) => `${l.label} ${p.lv[l.id] > 0 ? '+' : ''}${p.lv[l.id]}% across the board`);
/** Every move in a plan, by name: its cards, then its across-the-board changes. */
export const movesOf = (p: DuelPlan) => [...p.ids.map(cardName), ...leverMoves(p)];

/** The unsealed autopsy's lead: each plan's lean in a sentence, and the tagline for the pair. */
export function WhereYouSplit({ mine, theirs, me, other, share }: { mine: DuelPlan; theirs: DuelPlan; me: string; other: string; share?: ReactNode }) {
  const d = divergence(mine, theirs, 'Your plan', `${other}’s plan`);
  const row = (l: (typeof d)['a'], who: string, line: string, cls: string) => (
    <div className={'split-side ' + cls} data-lean={l.side}>
      <span className="split-who"><i className={'sw ' + (cls === 'is-me' ? 'sw-me' : 'sw-them')} />{who}</span>
      <strong className="split-big num">{Math.round(l.share * 100)}%</strong>
      <span className="split-what">{l.side === 'tax' ? 'tax increases' : l.side === 'cuts' ? 'spending cuts' : 'taxes, the rest cuts'}</span>
      <span className="small">{line}</span>
    </div>
  );
  return (
    <section className="card split-card" id="where-you-split" aria-labelledby="split-t">
      <div className="eyebrow">Unsealed</div>
      <h2 className="section-title" id="split-t">Where you split</h2>
      <div className="split-sides">
        {row(d.a, me === 'You' ? 'Your plan' : `${me}’s plan`, d.lines[0], 'is-me')}
        {row(d.b, `${other}’s plan`, d.lines[1], 'is-them')}
      </div>
      <p className="split-tag">{d.tagline}</p>
      {share}
    </section>
  );
}

const wrap = (t: string, n: number) => { const out: string[] = []; let line = ''; for (const w of t.split(' ')) { if ((line + ' ' + w).trim().length > n) { out.push(line.trim()); line = w; } else line += ' ' + w; } if (line.trim()) out.push(line.trim()); return out; };
/** "Where we split" as a 1080×1350 image for the group chat. */
export function splitPng(mine: DuelPlan, theirs: DuelPlan, me: string, other: string) {
  const d = divergence(mine, theirs, `${me}’s plan`, `${other}’s plan`);
  const W = 1080, H = 1350, f = 'Arial, Helvetica, sans-serif', n = 'Arial Narrow, Arial, Helvetica, sans-serif';
  const block = (l: (typeof d)['a'], who: string, line: string, y: number, color: string) => {
    const lines = wrap(line, 46).slice(0, 4);
    return `<rect x="70" y="${y}" width="940" height="400" rx="28" fill="#ffffff" stroke="${color}" stroke-width="8"/>
    <text x="110" y="${y + 70}" font-family="${f}" font-size="34" font-weight="800" fill="#47524c">${esc(who.toUpperCase().slice(0, 30))}</text>
    <text x="110" y="${y + 190}" font-family="${n}" font-size="130" font-weight="800" fill="#111b16">${Math.round(l.share * 100)}%</text>
    <text x="400" y="${y + 185}" font-family="${n}" font-size="56" font-weight="800" fill="${color}">${l.side === 'tax' ? 'tax increases' : l.side === 'cuts' ? 'spending cuts' : 'taxes, the rest cuts'}</text>
    ${lines.map((t, i) => `<text x="110" y="${y + 255 + i * 40}" font-family="${f}" font-size="30" fill="#2b352f">${esc(t)}</text>`).join('')}`;
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#14261f"/>
  <rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="36" fill="#f2f4ef"/>
  <text x="70" y="120" font-family="${f}" font-size="32" font-weight="800" letter-spacing="6" fill="#b4232f">SEALED SHOWDOWN · UNSEALED</text>
  <text x="70" y="215" font-family="${n}" font-size="92" font-weight="800" fill="#111b16">Where we split</text>
  ${block(d.a, `${me}’s plan`, d.lines[0], 270, '#2467c4')}
  ${block(d.b, `${other}’s plan`, d.lines[1], 700, '#c8541f')}
  <text x="${W / 2}" y="1190" text-anchor="middle" font-family="${n}" font-size="64" font-weight="800" fill="#111b16">${esc(d.tagline)}</text>
  <text x="${W / 2}" y="1260" text-anchor="middle" font-family="${f}" font-size="30" fill="#47524c">Plans compared, never people · balancethebudget.us</text>
</svg>`;
  return svgToPng(svg, W, H);
}

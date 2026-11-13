import { useMemo, useRef, useState } from 'react';
import { TimeChart } from '../components/charts';
import { ChartFrame } from '../components/ui';
import { cbo, debt, POP, process, ssa } from '../data';
import { CTX } from '../lib/assess';
import { bucketYear } from '../lib/derive';
import { dollars, money, moneyWords, pct } from '../lib/format';
import { MULT, mid } from '../lib/plan';
import { simulate, ZERO } from '../lib/sandbox';
import { useHaptics } from './haptics';
import type { Done } from './minigame';
import { Rated } from './Rated';

const fmtMult = (v: number) => `$${v.toFixed(2)}`;

// Simulations inside the missions: move a cause and watch the effect. Each works from the same
// official numbers the rest of the game uses, and says so; where a step simplifies (an average
// rate, a straight-line mix of two fixes), it says that too.

// ---------- a dial: a needle over labeled zones (the pace speedometer, the gap gauge) ----------
/** Status tones for a good or bad state; s1 to s3, light to dark, for a plain amount that is neither. */
export interface DialZone { to: number; label: string; tone: 'good' | 'warning' | 'critical' | 'neutral' | 's1' | 's2' | 's3'; short?: string }
export function Dial({ value, max, zones, label, readout, note }: { value: number; max: number; zones: DialZone[]; label: string; readout: string; note?: string }) {
  const R = 80, cx = 100, cy = 96;
  const at = (v: number) => Math.PI * (1 - Math.min(1, Math.max(0, v / max)));
  const pt = (a: number, r = R) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const arc = (from: number, to: number) => {
    const [x0, y0] = pt(at(from)), [x1, y1] = pt(at(to));
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  let prev = 0;
  const deg = (Math.min(1, Math.max(0, value / max)) * 180) - 90;
  const zone = zones.find((z) => value <= z.to) ?? zones.at(-1)!;
  return (
    <figure className="dial" role="img" aria-label={`${label}: ${readout}, ${zone.label}`}>
      <svg viewBox="0 0 200 118" aria-hidden="true">
        {zones.map((z) => { const d = arc(prev, Math.min(z.to, max)); prev = z.to; return <path key={z.label} className="dial-zone" data-tone={z.tone} d={d} />; })}
        {zones.map((z, k) => {
          const from = k ? zones[k - 1].to : 0;
          const [x, y] = pt(at((from + Math.min(z.to, max)) / 2), R + 17);
          return <text key={z.label + 't'} className="dial-zlabel" x={x} y={y} textAnchor="middle">{z.short ?? z.label}</text>;
        })}
        <g className="dial-needle" style={{ transform: `rotate(${deg}deg)` }}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - R + 10} />
        </g>
        <circle cx={cx} cy={cy} r="6" className="dial-hub" />
      </svg>
      <figcaption>
        <span className="dial-readout" data-tone={zone.tone}>{readout}</span>
        <span className="dial-zone-name">{zone.label}</span>
        {note && <span className="small muted">{note}</span>}
      </figcaption>
    </figure>
  );
}

// ---------- 2.1: the interest rate, and the interest bill it sets ----------
/** Debt held by the public times an average interest rate: a simple version of the interest bill. */
export function InterestRateSim({ defense, medicare, fy, game }: { defense: number; medicare: number; fy: number; game?: { done: Done } }) {
  const held = debt.latest.public;
  const now = debt.rates.at(-1)!;
  const recent = debt.rates.filter((r) => r.date >= '2018-01-01');
  const low = recent.reduce((a, b) => (b.marketable < a.marketable ? b : a));
  const [rate, setRate] = useState(game ? 1.5 : Math.round(now.marketable * 10) / 10);
  const [locked, setLocked] = useState(false);
  const buzz = useHaptics();
  const bill = held * rate / 100;
  const perPoint = held / 100;
  const cross = (defense / held) * 100;
  const hide = !!game && !locked; // in the game, the crossing point is the answer
  const lock = () => {
    if (!game || locked) return;
    setLocked(true);
    const off = Math.abs(rate - cross);
    game.done(off <= 0.1 ? 100 : off <= 0.3 ? 60 : off <= 0.6 ? 30 : 10, `Interest passes defense at ${cross.toFixed(1)}%. You locked in ${rate.toFixed(1)}%.`);
  };
  const rows = [
    { id: 'interest', label: `Interest at ${rate.toFixed(1)}%`, value: bill, color: 'var(--c-interest)' },
    { id: 'defense', label: `National defense (FY${fy})`, value: defense, color: 'var(--c-defense)' },
    { id: 'medicare', label: `Medicare (FY${fy})`, value: medicare, color: 'var(--c-medicare)' },
  ];
  const top = Math.max(...rows.map((r) => r.value), held * 0.07);
  const hist = debt.rates.filter((r) => r.date >= '2005-01-01');
  return (
    <div className="sim">
      <label className="sim-slider">
        <span className="sim-k">Average interest rate on the debt</span>
        <strong className="sim-v num">{rate.toFixed(1)}%</strong>
        <input type="range" min={1} max={7} step={0.1} value={rate} disabled={locked} onChange={(e) => setRate(Number(e.target.value))} onPointerUp={() => buzz('tap')}
          onKeyDown={(e) => { if (game && e.key === 'Enter') { e.preventDefault(); lock(); } }}
          aria-valuetext={`${rate.toFixed(1)} percent: interest of ${moneyWords(bill, 2)} a year`} />
        <span className="sim-scale" aria-hidden="true"><span>1%</span><span>7%</span></span>
        <span className="sim-marks" aria-hidden="true">
          <i style={{ left: `${((low.marketable - 1) / 6) * 100}%` }}>{low.date.slice(0, 4)} low: {low.marketable.toFixed(1)}%</i>
          <i style={{ left: `${((now.marketable - 1) / 6) * 100}%` }}>now: {now.marketable.toFixed(1)}%</i>
        </span>
      </label>
      <div className="sim-result" aria-live="polite">
        <span className="stat-label">A year’s interest on {money(held)} of debt held by the public</span>
        <strong className="concept-big">{moneyWords(bill, 2)} a year, about {dollars(bill / POP)} a person</strong>
        <span className="small muted">Every point of interest rate costs about {moneyWords(perPoint, 0)} a year.{hide ? '' : ` Above ${cross.toFixed(1)}%, interest costs more than defense.`}</span>
      </div>
      {game && !locked && <button type="button" className="btn btn-primary estimate-lock sim-lock" onClick={lock}>Lock in {rate.toFixed(1)}%</button>}
      <ul className="sim-bars" aria-label="Interest at this rate next to defense and Medicare">
        {rows.map((r) => (
          <li key={r.id} data-row={r.id}>
            <span className="sim-bar-label">{r.label}</span>
            <span className="sim-bar-track"><span className="sim-bar" style={{ width: `${(r.value / top) * 100}%`, background: r.color }} /></span>
            <span className="sim-bar-v num">{money(r.value)}</span>
          </li>
        ))}
      </ul>
      <ChartFrame title="The actual average rate on the Treasury’s marketable debt" sourceIds={['rates']}>
        <TimeChart label="Average interest rate on marketable Treasury debt" x={hist.map((r) => r.date)} xLabel={(d) => String(d).slice(0, 4)} xTicks={hist.map((r, i) => (r.date.slice(5, 7) === '01' && Number(r.date.slice(0, 4)) % 5 === 0 ? i : -1)).filter((i) => i >= 0)} height={130} yMin={0} yFormat={(v) => `${v.toFixed(0)}%`} tipFormat={(v) => `${v.toFixed(2)}%`} tipTitle={(d) => String(d).slice(0, 7)}
          series={[{ id: 'r', label: 'Average rate', color: 'var(--c-interest)', kind: 'line', values: hist.map((r) => r.marketable) }]} />
      </ChartFrame>
      <p className="small muted">Simplified: the debt held by the public on {debt.latest.date} times one average rate. The official interest bill also counts timing and the interest the Treasury earns, so it differs a little.</p>
    </div>
  );
}

// ---------- 3.1: close Social Security's 75-year gap, mixing a tax increase and a benefit cut ----------
const parse = (s: string | undefined, fallback: number) => { const n = Number(String(s ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : fallback; };
export function SsMixer({ late: forceLate, game }: { late?: boolean; game?: { done: Done } } = {}) {
  const NOW_RATE = 12.4;
  // The trustees' two ways to close the gap alone, starting now, and how much bigger each gets by 2034.
  const fixes = ssa.fixes ?? [];
  const taxNow = parse(fixes[0]?.value, 16.65), cutNow = parse(fixes[1]?.value, 25.2);
  const taxLate = parse(fixes[0]?.label.match(/\(([\d.]+)%/)?.[1], 17.3), cutLate = parse(fixes[1]?.label.match(/\(([\d.]+)%/)?.[1], 28.5);
  const [tax, setTax] = useState(NOW_RATE);
  const [cut, setCut] = useState(0);
  const [lateSet, setLate] = useState(false);
  const late = forceLate ?? lateSet;
  const [locked, setLocked] = useState(false);
  const buzz = useHaptics();
  const T = late ? taxLate : taxNow, C = late ? cutLate : cutNow;
  const closed = (tax - NOW_RATE) / (T - NOW_RATE) + cut / C;
  const worker = ((tax - NOW_RATE) / 100 / 2) * 60000;
  const done = closed >= 0.995;
  const lock = () => {
    if (!game || locked) return;
    setLocked(true);
    const off = Math.abs(closed - 1);
    game.done(off <= 0.01 ? 100 : off <= 0.03 ? 70 : off <= 0.08 ? 40 : 15, `You closed ${Math.round(closed * 100)}% of the gap${off <= 0.01 ? ', right on the mark' : closed > 1 ? ', more than it needed' : ''}.`);
  };
  return (
    <div className="sim">
      <div className="sim-two">
        <label className="sim-slider">
          <span className="sim-k">Social Security payroll tax (worker and employer together)</span>
          <strong className="sim-v num">{tax.toFixed(2)}%</strong>
          <input type="range" min={NOW_RATE} max={18} step={0.05} value={tax} disabled={locked} onChange={(e) => setTax(Number(e.target.value))} onPointerUp={() => buzz('tap')} aria-valuetext={`${tax.toFixed(2)} percent`} />
          <span className="sim-scale" aria-hidden="true"><span>12.4% today</span><span>18%</span></span>
        </label>
        <label className="sim-slider">
          <span className="sim-k">Cut to every benefit check</span>
          <strong className="sim-v num">{cut.toFixed(1)}%</strong>
          <input type="range" min={0} max={30} step={0.1} value={cut} disabled={locked} onChange={(e) => setCut(Number(e.target.value))} onPointerUp={() => buzz('tap')} aria-valuetext={`${cut.toFixed(1)} percent cut`} />
          <span className="sim-scale" aria-hidden="true"><span>no cut</span><span>30%</span></span>
        </label>
      </div>
      {forceLate == null ? <label className="switch"><input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} /> Wait until 2034 to start</label>
        : late ? <p className="small"><strong>Congress waited until 2034 to start.</strong></p> : null}
      <div className="sim-gauge-row">
        <Dial value={closed * 100} max={120} label="Share of the 75-year gap closed" readout={`${Math.round(closed * 100)}%`}
          zones={[{ to: 99.5, label: 'gap remains', tone: 'warning' }, { to: 120, label: 'gap closed', tone: 'good' }]} />
        <div className="sim-result" aria-live="polite">
          <span className="stat-label">{done ? 'The gap is closed' : 'The gap is not closed yet'}</span>
          <strong className="concept-big">{done ? 'Social Security pays every scheduled benefit for 75 years.' : `${Math.round(Math.max(0, closed) * 100)}% of the way there.`}</strong>
          <span className="small muted">
            {tax > NOW_RATE ? `A worker earning $60,000 pays about ${dollars(worker)} more a year (the employer pays the same again). ` : ''}
            {cut > 0 ? `Every retiree’s check is ${cut.toFixed(1)}% smaller, current retirees included. ` : ''}
            {game && !locked ? 'Mix the two any way you like; get the gauge to 100%.' : `Alone, closing it takes ${T.toFixed(2)}% or a ${C.toFixed(1)}% cut${late ? ' when Congress waits until 2034' : ' starting now'}.`}
          </span>
        </div>
      </div>
      {game && !locked && <button type="button" className="btn btn-primary estimate-lock sim-lock" onClick={lock}>Lock in this fix</button>}
      <p className="small muted">From the {ssa.report}: each change alone, starting now or in 2034. Mixing the two is simplified as a straight line between them.</p>
    </div>
  );
}

// ---------- 1.4: pour the spending into the revenue tank ----------
export function RevenueTank({ game }: { game?: { done: Done } } = {}) {
  const b = bucketYear(cbo.history.filter((h) => h.actual).at(-1)!.fy);
  const y = b.y;
  const blocks = [
    { id: 'ss', label: 'Social Security', v: y.socialSecurity, color: 'var(--c-ss)', kind: 'mandatory' },
    { id: 'medicare', label: 'Medicare', v: y.medicare, color: 'var(--c-medicare)', kind: 'mandatory' },
    { id: 'medicaid', label: 'Medicaid', v: y.medicaid, color: 'var(--c-health)', kind: 'mandatory' },
    { id: 'other', label: 'Other mandatory', v: y.otherMandatory, color: 'var(--c-income)', kind: 'mandatory' },
    { id: 'interest', label: 'Interest', v: y.netInterest, color: 'var(--c-interest)', kind: 'interest' },
    { id: 'defense', label: 'Defense', v: y.defense, color: 'var(--c-defense)', kind: 'discretionary' },
    { id: 'nondefense', label: 'Everything else Congress votes on', v: y.nondefense, color: 'var(--c-other)', kind: 'discretionary' },
  ];
  const [poured, setPoured] = useState<string[]>([]);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const tank = useRef<HTMLDivElement>(null);
  const buzz = useHaptics();
  const cap = y.revenues;
  const scale = cap * 1.42; // the drawing has room above the brim for what spills over
  const pour = (id: string) => {
    if (poured.includes(id)) return;
    buzz('card');
    const nx = [...poured, id];
    setPoured(nx);
    if (game && nx.length === blocks.length) {
      const first = nx.slice(0, 5).filter((b) => blocks.find((x) => x.id === b)!.kind !== 'discretionary').length;
      game.done((100 * first) / 5, first === 5 ? 'All five bills on autopilot went in first.' : `${first} of the 5 bills on autopilot went in first. The other two are the ones Congress votes on each year.`);
    }
  };
  const over2 = game && poured.length === blocks.length; // the game's tank shows each bill's kind once it's full
  const inTank = blocks.filter((x) => poured.includes(x.id));
  const total = inTank.reduce((s, x) => s + x.v, 0);
  const mi = blocks.filter((x) => x.kind !== 'discretionary').reduce((s, x) => s + x.v, 0);
  const over = Math.max(0, total - cap);
  const next = blocks.find((x) => !poured.includes(x.id));
  const onDown = (id: string) => (e: React.PointerEvent) => {
    if (poured.includes(id)) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ id, x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => { if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY }); };
  const onUp = (id: string) => (e: React.PointerEvent) => {
    const r = tank.current?.getBoundingClientRect();
    const moved = drag ? Math.hypot(e.clientX - drag.x, e.clientY - drag.y) : 0;
    const inside = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - 40 && e.clientY <= r.bottom;
    setDrag(null);
    if (inside || moved < 6) pour(id); // a drop on the tank, or a plain tap
  };
  let level = 0;
  return (
    <div className="sim tank-sim">
      <div className="tank-wrap">
        <div className="tank" ref={tank} role="img" aria-label={`Revenue tank: ${money(cap)} of revenue in ${b.short}. Poured in: ${money(total)}${over > 0 ? `, overflowing by ${money(over)}, which was borrowed` : ''}.`}>
          <span className="tank-brim" style={{ bottom: `${(cap / scale) * 100}%` }}><em>Revenue: {money(cap)}</em></span>
          {inTank.map((x) => {
            const from = level; level += x.v;
            return <span key={x.id} className="tank-layer" data-over={from >= cap || undefined} style={{ bottom: `${(from / scale) * 100}%`, height: `${(x.v / scale) * 100}%`, background: x.color }} title={`${x.label}: ${money(x.v)}`} />;
          })}
          {over > 0 && <span className="tank-spill" style={{ bottom: `${(cap / scale) * 100}%`, height: `${(over / scale) * 100}%` }}><em>Borrowed: {money(over)}</em></span>}
        </div>
        <div className="tank-readout" aria-live="polite">
          <span className="stat-label">In the tank</span>
          <strong className="concept-big">{pct(total / cap, 0)} of revenue</strong>
          <span className="small muted">
            {poured.length === 0 ? (game ? 'Pour in the bills on autopilot first, then the ones Congress votes on each year.' : 'Tap or drag the bills into the tank, starting with the ones on autopilot.')
              : over > 0 ? `It overflows: ${money(over)} had to be borrowed. That’s the deficit.`
              : inTank.every((x) => x.kind !== 'discretionary') && inTank.length === blocks.filter((x) => x.kind !== 'discretionary').length ? `Mandatory programs and interest alone fill ${pct(mi / cap, 0)} of the tank. Now add what Congress votes on.`
              : `${money(cap - total)} of room left.`}
          </span>
        </div>
      </div>
      <div className="tank-tray" role="group" aria-label="Bills to pour in" onPointerMove={onMove}>
        {blocks.map((x) => (
          <button key={x.id} type="button" className="tank-chip" data-kind={!game || over2 ? x.kind : undefined} data-done={poured.includes(x.id) || undefined} disabled={poured.includes(x.id)}
            onPointerDown={onDown(x.id)} onPointerUp={onUp(x.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pour(x.id); } }}
            data-drag={drag?.id === x.id || undefined} aria-label={`Pour in ${x.label}, ${money(x.v)}`}>
            <span className="tank-swatch" style={{ background: x.color }} aria-hidden="true" />
            <span>{x.label}</span>
            <span className="num small muted">{money(x.v)}</span>
          </button>
        ))}
      </div>
      <div className="sim-actions">
        {next && !game && <button type="button" className="btn" onClick={() => pour(next.id)}>Pour the next one: {next.label}</button>}
        {poured.length > 0 && !game && <button type="button" className="btn" onClick={() => setPoured([])}>Empty the tank</button>}
      </div>
      {drag && <span className="tank-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">{blocks.find((x) => x.id === drag.id)?.label}</span>}
      <p className="small muted">{b.label}</p>
    </div>
  );
}

// ---------- 3.2: wait to fix it, and the fix gets bigger ----------
/** Savings needed each year, from a start year on, to keep the debt from outgrowing the economy by the last year. */
function neededFrom(start: number) {
  const base = CTX.baseline;
  const run = (y: number) => simulate(base, CTX.startDebt, ZERO, { extra: { revenues: base.map((b, i) => (i >= start ? y * b.gdp : 0)) } });
  const ok = (y: number) => { const last = run(y).at(-1)!; return last.debt / last.gdp <= CTX.startRatio + 1e-9; };
  let lo = 0, hi = 0.5;
  if (ok(0)) return { share: 0, sim: run(0) };
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return { share: hi, sim: run(hi) };
}
/** The yearly fix needed for each start year, from now to the next-to-last year. */
export const waitShares = () => CTX.baseline.slice(0, -1).map((b, i) => ({ fy: b.fy, share: neededFrom(i).share }));
export function WaitSim() {
  const base = CTX.baseline;
  const starts = useMemo(() => base.slice(0, -1).map((b, i) => ({ fy: b.fy, ...neededFrom(i) })), [base]);
  const [k, setK] = useState(0);
  const buzz = useHaptics();
  const s = starts[k], first = starts[0];
  const avgGdp = base.slice(k).reduce((a, b) => a + b.gdp, 0) / (base.length - k);
  const interest = (x: typeof s) => x.sim.reduce((a, y) => a + y.interest, 0);
  const extraInterest = interest(s) - interest(first);
  const top = Math.max(...starts.map((x) => x.share));
  return (
    <div className="sim">
      <label className="sim-slider">
        <span className="sim-k">Start fixing it in</span>
        <strong className="sim-v num">FY{s.fy}</strong>
        <input type="range" min={0} max={starts.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} onPointerUp={() => buzz('tap')} aria-valuetext={`Fiscal year ${s.fy}: save ${pct(s.share, 1)} of GDP a year`} />
        <span className="sim-scale" aria-hidden="true"><span>FY{starts[0].fy} (now)</span><span>FY{starts.at(-1)!.fy}</span></span>
      </label>
      <div className="sim-result" aria-live="polite">
        <span className="stat-label">To keep the debt from outgrowing the economy by FY{base.at(-1)!.fy}</span>
        <strong className="concept-big">Save {pct(s.share, 1)} of GDP every year from FY{s.fy}: about {moneyWords(s.share * avgGdp, 0)} a year</strong>
        <span className="small muted">{k === 0 ? 'Starting now spreads the job over every year ahead.' : `${(s.share / first.share).toFixed(1)} times the yearly fix of starting now, and about ${moneyWords(Math.max(0, extraInterest), 0)} more in interest along the way.`}</span>
      </div>
      <ol className="wait-bars" aria-label="Yearly savings needed, by the year the fix starts">
        {starts.map((x, i) => (
          <li key={x.fy} data-on={i === k || undefined}>
            <button type="button" onClick={() => { setK(i); buzz('tap'); }} aria-pressed={i === k} aria-label={`Start in FY${x.fy}: ${pct(x.share, 1)} of GDP a year`}>
              <span className="wait-bar" style={{ height: `${(x.share / top) * 100}%` }} />
              <span className="wait-v num">{pct(x.share, 1)}</span>
              <span className="wait-x">FY{String(x.fy).slice(2)}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="small muted">Worked out by the game’s budget engine on the {cbo.projShort.toLowerCase()}: the same yearly savings (taxes or cuts) from the start year on, until the debt in FY{base.at(-1)!.fy} is back to today’s share of the economy.</p>
    </div>
  );
}

// ---------- 1.5: a ripple, sized by how much a dollar of savings shrinks the economy at first ----------
/** Area grows with the effect, so a ripple twice as big is twice the drag. The dashed ring is dollar for dollar. */
export function Ripple({ value, max, base, label }: { value: number; max: number; base: number; label: string }) {
  const R = 70, cx = 110, cy = 80;
  const r = R * Math.sqrt(Math.max(0, value) / max);
  const ref = R * Math.sqrt(base / max);
  return (
    <figure className="ripple" role="img" aria-label={label}>
      <svg viewBox="0 0 220 160" aria-hidden="true">
        <ellipse className="ripple-pond" cx={cx} cy={cy} rx={R + 30} ry={R + 4} />
        <circle className="ripple-fill" cx={cx} cy={cy} r={r} />
        <g key={value.toFixed(1)} className="ripple-rings">
          {[0, 1, 2].map((k) => <circle key={k} className="ripple-ring" cx={cx} cy={cy} r={r} style={{ animationDelay: `${k * 0.32}s` }} />)}
        </g>
        <circle className="ripple-ref" cx={cx} cy={cy} r={ref} />
        <text className="ripple-ref-label" x={cx} y={cy - ref - 4} textAnchor="middle">dollar for dollar</text>
        <circle className="ripple-stone" cx={cx} cy={cy} r={4.5} />
      </svg>
    </figure>
  );
}

// ---------- 2.2: put the budget calendar in order, then October 1 arrives ----------
const CAL = [
  { id: 'pres', when: 'First Monday in February', what: 'The President sends Congress a budget request' },
  { id: 'res', when: 'By April 15', what: 'Congress adopts a budget resolution that sets the totals' },
  { id: 'bills', when: 'Spring and summer', what: 'The House and Senate pass 12 spending bills, and the President signs them' },
  { id: 'oct', when: 'October 1', what: 'The new fiscal year begins, with every bill in place' },
];
export const BUDGET_CALENDAR = CAL;
/** October 1 arrives with the bills unfinished: a stopgap or a shutdown, each told from the record. */
export function OctoberChoice() {
  const [path, setPath] = useState<'cr' | 'shutdown' | null>(null);
  const buzz = useHaptics();
  const yrs = process.years;
  const crs = yrs.reduce((a, y) => a + y.crs, 0);
  const none = yrs.filter((y) => y.onTime === 0 && !/^Not final/.test(y.final)).length;
  const lapses = yrs.filter((y) => y.shutdownDays > 0);
  const now = yrs.at(-1)!;
  return (
    <div className="cal-oct" role="group" aria-labelledby="cal-oct-q">
      <strong id="cal-oct-q">Now October 1 arrives, and the 12 bills aren’t all signed. What happens?</strong>
      <div className="sim-actions">
        <button type="button" className="btn cal-pick" aria-pressed={path === 'cr'} onClick={() => { setPath('cr'); buzz('tap'); }}>Pass a stopgap</button>
        <button type="button" className="btn cal-pick" aria-pressed={path === 'shutdown'} onClick={() => { setPath('shutdown'); buzz('wrong'); }}>No deal</button>
      </div>
      {path && (
        <div className="sim-result" aria-live="polite">
          {path === 'cr' ? (
            <>
              <span className="stat-label">A continuing resolution</span>
              <strong className="concept-big">Agencies keep running at about last year’s funding until the bills pass.</strong>
              <span className="small muted">Congress passed {crs} stopgaps for FY{yrs[0].fy}–FY{now.fy}. In {none} of those years, not one regular bill was on time.{/^Not final/.test(now.final) ? ` Right now, FY${now.fy} is running on one: ${now.final.replace(/^Not final yet\.\s*/, '')}` : ''}</span>
            </>
          ) : (
            <>
              <span className="stat-label">A shutdown</span>
              <strong className="concept-big">Funding lapses. Agencies stop all but essential work, and essential employees keep working without a paycheck until it ends.</strong>
              <span className="small muted">Since FY{yrs[0].fy}, funding lapsed in {lapses.length} fiscal years: {lapses.map((y) => `FY${y.fy}, ${y.shutdownDays} day${y.shutdownDays === 1 ? '' : 's'}`).join('; ')}.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
// ---------- 2.3: let the debt grow, and see the slice of income it takes ----------
/** CBO's comparison for 2055: debt rising to 156% of GDP under current law, or held at about 100%, which leaves income per person about 4% higher. */
const CBO_HELD = 100, CBO_PROJ = 156, CBO_GAIN = 4;
const PER_POINT = CBO_GAIN / (CBO_PROJ - CBO_HELD);
export function PieSim() {
  const [debtPct, setDebt] = useState(CBO_PROJ);
  const buzz = useHaptics();
  const loss = Math.max(0, (debtPct - CBO_HELD) * PER_POINT);
  const today = (() => { const h = cbo.history.filter((x) => x.actual).at(-1)!; return { fy: h.fy, pct: (h.debtPublic / h.gdp) * 100 }; })();
  const R = 74, cx = 90, cy = 90;
  const a = (loss / 100) * Math.PI * 2;
  const pt = (t: number, r = R) => [cx + r * Math.sin(t), cy - r * Math.cos(t)];
  const [x1, y1] = pt(a);
  const big = a > Math.PI ? 1 : 0;
  // The slice that's gone, nudged out along its middle so it reads as missing.
  const [ox, oy] = [Math.sin(a / 2) * 8, -Math.cos(a / 2) * 8];
  const at = (v: number) => `${((v - 100) / 100) * 100}%`;
  return (
    <div className="sim">
      <label className="sim-slider">
        <span className="sim-k">Debt held by the public in 2055, as a share of the economy</span>
        <strong className="sim-v num">{Math.round(debtPct)}%</strong>
        <input type="range" min={100} max={200} step={1} value={debtPct} onChange={(e) => setDebt(Number(e.target.value))} onPointerUp={() => buzz('tap')}
          aria-valuetext={`${debtPct} percent of GDP: income per person about ${loss.toFixed(1)} percent lower`} />
        <span className="sim-scale" aria-hidden="true"><span>100%</span><span>200%</span></span>
        <span className="sim-marks" aria-hidden="true">
          <i data-edge="start" style={{ left: at(CBO_HELD) }}>held near today’s share</i>
          <i style={{ left: at(CBO_PROJ) }}>CBO’s projection</i>
        </span>
      </label>
      <div className="sim-gauge-row">
        <figure className="pie" role="img" aria-label={`Income per person in 2055: about ${loss.toFixed(1)} percent lower than if debt were held at about 100 percent of GDP`}>
          <svg viewBox="0 0 180 180" aria-hidden="true">
            {loss <= 0
              ? <circle className="pie-whole" cx={cx} cy={cy} r={R} />
              : <>
                  <path className="pie-whole" d={`M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${1 - big} 1 ${cx} ${cy - R} Z`} />
                  <path className="pie-lost" transform={`translate(${ox.toFixed(2)} ${oy.toFixed(2)})`} d={`M${cx} ${cy} L${cx} ${cy - R} A${R} ${R} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`} />
                </>}
          </svg>
          <figcaption className="small muted">The whole pie: income per person in 2055 if debt stays near today’s share</figcaption>
        </figure>
        <div className="sim-result" aria-live="polite">
          <span className="stat-label">Income per person in 2055</span>
          <strong className="concept-big">{loss < 0.05 ? 'The whole pie: debt stays near today’s share.' : `About ${loss.toFixed(1)}% smaller: $${loss.toFixed(1)} of every $100.`}</strong>
          <span className="small muted">Why: CBO estimates each extra dollar of deficits crowds out about 33 cents of private investment, so workers have fewer machines, factories, and software to work with. And more of what the country earns goes to foreign lenders. Debt held by the public was {Math.round(today.pct)}% of GDP in FY{today.fy}.</span>
        </div>
      </div>
      <p className="small muted">A rule of thumb from one CBO comparison (May 2025); past 156%, the line is the game’s extension.</p>
      <Rated id="growth" label="How this is figured" />
    </div>
  );
}

// ---------- 2.4: cut public investment, and watch the bridge wear down ----------
/** CBO (2016): federal nondefense investment returns about 5 cents a year per dollar, on average; half the private return. */
const FED_RETURN = 0.05;
export function BridgeSim() {
  const o = CTX.options.find((x) => x.id === 'cut-transport-education-grants')!;
  // CBO's ten-year estimate, spread over ten years in step with the economy (the engine's window is shorter).
  const g10 = (() => { const g = CTX.baseline.map((b) => b.gdp); const r = g.at(-1)! / g.at(-2)!; while (g.length < 10) g.push(g.at(-1)! * r); return g.slice(0, 10); })();
  const path = g10.map((x) => (o.savings10 * 1e9 * x) / g10.reduce((a, v) => a + v, 0));
  const [cut, setCut] = useState(33);
  const buzz = useHaptics();
  const scale = cut / 33; // the card's cut of a third, at 33% on the slider
  const save = path.map((v) => v * scale);
  let k = 0;
  const lost = save.map((v) => { const l = FED_RETURN * k; k += v; return l; });
  const saved10 = save.reduce((a, v) => a + v, 0);
  const lostAfter = FED_RETURN * saved10;
  const first = save[0] * mid('stateInfra');
  const wear = Math.min(1, cut / 50);
  const top = Math.max(...save, ...lost, 1);
  const yrs = path.map((_, i) => CTX.baseline[0].fy + i);
  return (
    <div className="sim">
      <label className="sim-slider">
        <span className="sim-k">Cut federal grants for roads, transit, and schools</span>
        <strong className="sim-v num">{cut}%</strong>
        <input type="range" min={0} max={50} step={1} value={cut} onChange={(e) => setCut(Number(e.target.value))} onPointerUp={() => buzz('tap')}
          aria-valuetext={`${cut} percent cut: saves ${moneyWords(saved10, 0)} over ten years`} />
        <span className="sim-scale" aria-hidden="true"><span>no cut</span><span>half</span></span>
        <span className="sim-marks" aria-hidden="true"><i style={{ left: `${(33 / 50) * 100}%` }}>the card: a third</i></span>
      </label>
      <figure className="bridge" role="img" aria-label={cut === 0 ? 'A bridge in good repair' : `A bridge wearing down: ${cut} percent less to maintain and build`} data-wear={wear > 0.66 ? 'high' : wear > 0.25 ? 'mid' : wear > 0 ? 'low' : undefined}>
        <svg viewBox="0 0 320 120" aria-hidden="true">
          <path className="bridge-water" d="M0 104 Q40 98 80 104 T160 104 T240 104 T320 104 V120 H0 Z" />
          <path className="bridge-arch" d={`M20 96 Q160 ${18 + wear * 16} 300 96`} />
          {[60, 100, 140, 180, 220, 260].map((x, i) => {
            const t = (x - 20) / 280, archY = (1 - t) * (1 - t) * 96 + 2 * (1 - t) * t * (18 + wear * 16) + t * t * 96;
            return <line key={x} className="bridge-hanger" x1={x} y1={58 + wear * 8 * Math.sin(Math.PI * t)} x2={x} y2={archY} data-gone={wear > 0.4 && i % 3 === 1 ? true : undefined} />;
          })}
          <path className="bridge-deck" d={`M8 56 Q160 ${56 + wear * 16} 312 56`} />
          <rect className="bridge-pier" x="12" y="56" width="12" height="50" />
          <rect className="bridge-pier" x="296" y="56" width="12" height="50" />
          <g className="bridge-cracks" style={{ opacity: wear }}>
            <path d="M120 60 l6 6 l-3 5 l7 5" /><path d="M200 63 l-5 5 l4 6" /><path d="M150 70 l3 7 l-4 4" />
          </g>
          {wear > 0.66 && <g className="bridge-cone"><path d="M236 52 l6 -16 l6 16 Z" /><rect x="233" y="51" width="18" height="3" /></g>}
        </svg>
      </figure>
      <div className="sim-two">
        <div className="sim-result" aria-live="polite">
          <span className="stat-label">Hit one: now</span>
          <strong className="concept-big">Saves {moneyWords(saved10, 0)} over ten years</strong>
          <span className="small muted">But the economy shrinks by about {moneyWords(first, 0)} in the first year, because that money would have been spent quickly (CBO: {fmtMult(MULT.stateInfra.lo)} to {fmtMult(MULT.stateInfra.hi)} per dollar of aid to states for infrastructure).</span>
        </div>
        <div className="sim-result">
          <span className="stat-label">Hit two: later</span>
          <strong className="concept-big">{cut === 0 ? 'Nothing lost' : `About ${moneyWords(lostAfter, 0)} less output every year after that`}</strong>
          <span className="small muted">Each dollar of public investment not made would have added about 5 cents a year to the economy, for as long as the roads, skills, and research last.</span>
        </div>
      </div>
      <figure className="bridge-bars" aria-label="Each year: savings and the economy's lost output">
        <div className="bridge-bars-cols">
          {yrs.map((fy, i) => (
            <span key={fy} className="bridge-col" title={`FY${fy}: saves ${money(save[i])}; output lost ${money(lost[i])}`}>
              <span className="bridge-bar" data-k="save" style={{ height: `${(save[i] / top) * 100}%` }} />
              <span className="bridge-bar" data-k="lost" style={{ height: `${(lost[i] / top) * 100}%` }} />
              <span className="phase-x">FY{String(fy).slice(2)}</span>
            </span>
          ))}
        </div>
        <figcaption className="small"><span className="bridge-key" data-k="save" /> saved that year <span className="bridge-key" data-k="lost" /> output lost that year, growing as the missing investment adds up</figcaption>
      </figure>
      <p className="small muted">A rule of thumb from CBO’s estimate that federal investment earns about 5% a year on average (2016).</p>
      <Rated id="investment" label="How this is figured" />
    </div>
  );
}

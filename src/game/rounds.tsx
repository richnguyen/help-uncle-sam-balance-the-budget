import { type ReactNode, useRef, useState } from 'react';
import { useHaptics } from './haptics';
import type { Done } from './minigame';
import { Dial } from './sims';
import { SamSays } from './UncleSam';

// Round types that only the mission games use: which is bigger, higher or lower than the
// average, and put things in order. Each scores up to 100 points and says how it scored.

// ---------- which is bigger? one pair at a time ----------
export interface PairItem { id: string; label: string; value: number; color: string }
export function PairsRound({ pairs, intro, done, format, prompt }: { pairs: [PairItem, PairItem][]; intro: ReactNode; done: Done; format: (v: number) => string; prompt: string }) {
  const [k, setK] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const buzz = useHaptics();
  const pair = pairs[k];
  const big = pair[0].value >= pair[1].value ? 0 : 1;
  const last = k === pairs.length - 1;
  const pick = (side: number) => {
    if (picked != null) return;
    setPicked(side);
    const ok = side === big;
    const r = right + (ok ? 1 : 0);
    setRight(r);
    buzz(ok ? 'right' : 'wrong');
    if (last) done((100 * r) / pairs.length, `${r} of ${pairs.length} pairs right.`);
  };
  const next = () => { setK((x) => x + 1); setPicked(null); buzz('tap'); };
  return (
    <div className="quiz">
      <SamSays mood="happy" compact auto>{intro}</SamSays>
      <div className="card quiz-card pairs" role="group" aria-labelledby="pairs-q">
        <h2 className="quiz-q" id="pairs-q">{prompt}</h2>
        <div className="pairs-count small muted">Pair {k + 1} of {pairs.length} · {right} right so far</div>
        <div className="pairs-row">
          {pair.map((it, side) => (
            <button key={it.id} type="button" className="pairs-pick" disabled={picked != null} data-state={picked == null ? undefined : side === big ? 'big' : 'small'} data-picked={picked === side || undefined} onClick={() => pick(side)}>
              <span className="swatch" style={{ background: it.color }} aria-hidden="true" />
              <strong>{it.label}</strong>
              {picked != null && <span className="pairs-v num">{format(it.value)}</span>}
            </button>
          ))}
        </div>
        {picked != null && (
          <div className="quiz-feedback" data-ok={picked === big} role="status">
            <strong>{picked === big ? 'Right.' : 'Not this one.'}</strong> {pair[big].label} is bigger, by {format(Math.abs(pair[0].value - pair[1].value))}.
            {!last && <> <button type="button" className="btn btn-sm pairs-next" onClick={next}>Next pair</button></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- higher or lower than the average ----------
export interface HiLoItem { id: string; label: string; value: number }
export function HigherLowerRound({ items, avg, intro, done, format, prompt, unit }: { items: HiLoItem[]; avg: number; intro: ReactNode; done: Done; format: (v: number) => string; prompt: (label: string) => string; unit: string }) {
  const [k, setK] = useState(0);
  const [picked, setPicked] = useState<'hi' | 'lo' | null>(null);
  const [right, setRight] = useState(0);
  const [streak, setStreak] = useState(0);
  const buzz = useHaptics();
  const it = items[k];
  const truth = it.value >= avg ? 'hi' : 'lo';
  const last = k === items.length - 1;
  const pick = (side: 'hi' | 'lo') => {
    if (picked) return;
    setPicked(side);
    const ok = side === truth;
    const r = right + (ok ? 1 : 0);
    setRight(r); setStreak(ok ? streak + 1 : 0);
    buzz(ok ? 'right' : 'wrong');
    if (last) done((100 * r) / items.length, `${r} of ${items.length} right.`);
  };
  const next = () => { setK((x) => x + 1); setPicked(null); buzz('tap'); };
  const ratio = (it.value / avg) * 100;
  return (
    <div className="quiz">
      <SamSays mood="happy" compact auto>{intro}</SamSays>
      <div className="card quiz-card hilo" role="group" aria-labelledby="hilo-q">
        <div className="pairs-count small muted">{k + 1} of {items.length} · {right} right{streak > 1 ? ` · ${streak} in a row` : ''}</div>
        <h2 className="quiz-q" id="hilo-q">{prompt(it.label)}</h2>
        <div className="pairs-row">
          <button type="button" className="pairs-pick hilo-pick" disabled={!!picked} data-state={picked ? (truth === 'hi' ? 'big' : 'small') : undefined} data-picked={picked === 'hi' || undefined} onClick={() => pick('hi')}><strong>More than average</strong></button>
          <button type="button" className="pairs-pick hilo-pick" disabled={!!picked} data-state={picked ? (truth === 'lo' ? 'big' : 'small') : undefined} data-picked={picked === 'lo' || undefined} onClick={() => pick('lo')}><strong>Less than average</strong></button>
        </div>
        {picked && (
          <div className="hilo-reveal" role="status">
            <Dial value={ratio} max={250} label={`${it.label}: ${format(it.value)} ${unit}`} readout={`${format(it.value)} ${unit}`}
              zones={[{ to: 85, label: 'below average', short: 'below', tone: 's1' }, { to: 115, label: 'near average', short: 'near', tone: 's2' }, { to: 250, label: 'above average', short: 'above', tone: 's3' }]} note={`${Math.round(ratio)}% of the average, ${format(avg)}`} />
            <div className="quiz-feedback" data-ok={picked === truth}>
              <strong>{picked === truth ? 'Right.' : 'Not this one.'}</strong> {it.label}: {format(it.value)} {unit}, {truth === 'hi' ? 'more' : 'less'} than the average of {format(avg)}.
              {!last && <> <button type="button" className="btn btn-sm pairs-next" onClick={next}>Next</button></>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- put things in order: drag a row or use the arrows, then check once ----------
export interface OrderItem { id: string; label: string; detail?: string }
export function OrderRound({ items, start, intro, done, prompt, after, revealNote }: { items: OrderItem[]; start: string[]; intro: ReactNode; done: Done; prompt: string; after?: ReactNode; revealNote?: (id: string) => ReactNode }) {
  const [order, setOrder] = useState(start);
  const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const rows = useRef<Record<string, HTMLLIElement | null>>({});
  const buzz = useHaptics();
  const at = (id: string) => items.findIndex((x) => x.id === id);
  const right = order.filter((id, i) => at(id) === i).length;
  const move = (id: string, to: number) => setOrder((o) => {
    const from = o.indexOf(id);
    if (to < 0 || to >= o.length || to === from) return o;
    const nx = o.filter((x) => x !== id); nx.splice(to, 0, id); return nx;
  });
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const mids = order.map((id) => { const r = rows.current[id]?.getBoundingClientRect(); return r ? r.top + r.height / 2 : 0; });
    const to = mids.filter((m) => e.clientY > m).length;
    const from = order.indexOf(drag);
    move(drag, to > from ? to - 1 : to);
  };
  const check = () => {
    setChecked(true);
    done((100 * right) / items.length, right === items.length ? 'Every one in the right spot.' : `${right} of ${items.length} in the right spot.`);
  };
  const shown = checked ? items.map((x) => x.id) : order;
  return (
    <div className="quiz">
      <SamSays mood={checked ? (right === items.length ? 'proud' : 'thinking') : 'happy'} compact auto>{intro}</SamSays>
      <div className="card quiz-card order" role="group" aria-labelledby="order-q">
        <h2 className="quiz-q" id="order-q">{prompt}</h2>
        {!checked && <div className="small muted">Drag a row by its handle, or use the arrows. Then check your order.</div>}
        <ol className="cal-list" onPointerMove={onMove} onPointerUp={() => { if (drag) buzz('tap'); setDrag(null); }} onPointerCancel={() => setDrag(null)}>
          {shown.map((id, i) => {
            const c = items[at(id)];
            const ok = checked ? order[i] === id : undefined;
            return (
              <li key={id} ref={(el) => { rows.current[id] = el; }} className="cal-row" data-drag={drag === id || undefined} data-ok={checked ? ok : undefined}>
                {!checked && <span className="cal-grip" aria-hidden="true" onPointerDown={(e) => { e.currentTarget.parentElement?.parentElement?.setPointerCapture?.(e.pointerId); setDrag(id); }}>⋮⋮</span>}
                <span className="cal-n num" aria-hidden="true">{checked ? (ok ? '✓' : i + 1) : i + 1}</span>
                <span className="cal-text"><strong>{c.label}</strong>{checked && (c.detail || revealNote) && <span className="small muted"> {revealNote ? revealNote(id) : c.detail}</span>}{checked && !ok && <span className="small cal-was"> (you had it {order.indexOf(id) + 1})</span>}</span>
                {!checked && (
                  <span className="cal-btns">
                    <button type="button" className="btn btn-sm cal-arrow" disabled={i === 0} aria-label={`Move “${c.label}” up`} onClick={() => { move(id, i - 1); buzz('tap'); }}>↑</button>
                    <button type="button" className="btn btn-sm cal-arrow" disabled={i === order.length - 1} aria-label={`Move “${c.label}” down`} onClick={() => { move(id, i + 1); buzz('tap'); }}>↓</button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {!checked
          ? <button type="button" className="btn btn-primary estimate-lock" onClick={check}>Check my order</button>
          : after}
      </div>
    </div>
  );
}

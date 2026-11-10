import { type ReactNode, useRef, useState } from 'react';
import { load, save } from '../lib/storage';
import { useHaptics } from './haptics';
import type { Quiz } from './levels';
import type { Done } from './minigame';
import { useJourney } from './state';
import { plain, SamSays } from './UncleSam';
import { QUIZ_LINES } from './script';

// Guesses made by hand instead of by picking: drag a slider, split a bar, size the bars, sort
// the cards. Each is locked in, then the real answer appears beside the guess with how close it
// came. As a quiz guess it never counts toward stars and is remembered in this browser; as a
// round of a mission's game it scores points instead, and starts fresh on every play.

type Grade = 'spot' | 'close' | 'far';
/** A round of a mission's game: Uncle Sam's opening line, and where the points go. */
export interface RoundCtx { intro: ReactNode; onDone: Done }
export const ROUND = {
  spot: 'Spot on! Full points.',
  close: 'Close! Good points.',
  far: 'Not this time, but you’ll know it next time.',
  farSay: (answer: string) => `Not this time. It’s ${answer}.`,
};
export const POINTS: Record<Grade, number> = { spot: 100, close: 60, far: 20 };

function useGuess<T>(quiz: Quiz, init: T, round?: RoundCtx) {
  const j = useJourney();
  const key = 'guess:' + quiz.id;
  const [value, setValue] = useState<T>(() => (round ? init : load<T | null>(key, null) ?? init));
  const [locked, setLocked] = useState<boolean>(() => !round && !!j.quiz[quiz.id] && load<T | null>(key, null) != null);
  const buzz = useHaptics();
  const lock = (grade: Grade, points: number, verdict: string) => {
    if (locked) return;
    setLocked(true);
    if (round) { j.answer(quiz.id, grade !== 'far'); round.onDone(points, verdict); return; }
    save(key, value);
    buzz(grade === 'far' ? 'wrong' : 'right');
    j.answer(quiz.id, grade !== 'far');
  };
  return { value, setValue, locked, lock, buzz };
}

/** Uncle Sam's line, the card with the question, and the lock-in button or the verdict. */
function GuessFrame({ quiz, kind, locked, grade, canLock = true, lockLabel, onLock, verdict, round, children }: {
  quiz: Quiz; kind: string; locked: boolean; grade: Grade; canLock?: boolean; lockLabel: string; onLock: () => void; verdict: ReactNode; round?: RoundCtx; children: ReactNode;
}) {
  const Q = QUIZ_LINES;
  const ex = plain(quiz.explain);
  const good = grade !== 'far';
  const line = round
    ? (locked ? ROUND[grade] : round.intro)
    : locked ? (good ? Q.guessRight : Q.guessReveal) : Q.guessPrompt;
  const say = round
    ? (locked ? (grade === 'far' ? `${ROUND.farSay(quiz.choices[0])} ${ex}` : `${ROUND[grade]} ${ex}`) : `${plain(round.intro)} ${quiz.question}`)
    : locked ? (good ? `${Q.guessRight} ${ex}` : `${Q.guessRevealSay(quiz.choices[0])} ${ex}`) : Q.guessAsk(quiz.question);
  return (
    <div className="quiz">
      <SamSays mood={locked ? (good ? 'proud' : 'surprised') : 'happy'} compact auto say={say}>{line}</SamSays>
      <div className={`card quiz-card guess-card ${kind}`} role="group" aria-labelledby={'q-' + quiz.id} data-locked={locked || undefined} data-grade={locked ? grade : undefined}>
        <h2 className="quiz-q" id={'q-' + quiz.id}>{quiz.question}</h2>
        {children}
        {!locked
          ? <button type="button" className="btn btn-primary estimate-lock" disabled={!canLock} onClick={onLock}>{lockLabel}</button>
          : (
            <div className="quiz-feedback" data-ok={good} role="status">
              <strong>{grade === 'spot' ? 'Spot on!' : grade === 'close' ? 'Close!' : 'Not this time.'}</strong>{' '}
              {verdict} {quiz.explain}
            </div>
          )}
      </div>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------- drag a slider to a number ----------
export function EstimateGuess({ quiz, round }: { quiz: Quiz; round?: RoundCtx }) {
  const e = quiz.estimate!;
  const g = useGuess<number>(quiz, e.start, round);
  const value = g.value;
  const off = Math.abs(value - e.answer);
  const rel = e.relative ? off / Math.abs(e.answer) : off;
  const grade: Grade = rel <= e.spot ? 'spot' : rel <= e.close ? 'close' : 'far';
  // Where a value sits along the slider: the thumb travels between half its width from each end.
  const at = (v: number) => `calc(9px + (100% - 18px) * ${((v - e.min) / (e.max - e.min)).toFixed(4)})`;
  const lock = () => g.lock(grade, POINTS[grade], `You said ${e.format(value)}; it’s ${e.format(e.answer)}${grade === 'spot' ? '' : ` (${e.diff(off)} off)`}.`);
  return (
    <GuessFrame quiz={quiz} kind="estimate" locked={g.locked} grade={grade} lockLabel={`Lock in ${e.format(value)}`} onLock={lock} round={round}
      verdict={<>You said {e.format(value)}; it’s {e.format(e.answer)}{grade === 'spot' ? '' : ` (${e.diff(off)} off)`}.</>}>
      <div className="estimate-value num" aria-hidden="true">{e.format(value)}</div>
      <div className="estimate-track">
        <input type="range" min={e.min} max={e.max} step={e.step} value={value} disabled={g.locked} aria-label={e.prompt} aria-valuetext={e.format(value)}
          onChange={(ev) => g.setValue(Number(ev.target.value))} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); lock(); } }} />
        {e.marks?.map((m) => <span key={m.label} className="estimate-mark" style={{ left: at(m.at) }}><i>{m.label}</i></span>)}
        {g.locked && <span className="estimate-answer" style={{ left: at(e.answer) }} aria-hidden="true"><i>{e.format(e.answer)}</i></span>}
      </div>
      <div className="estimate-scale" aria-hidden="true"><span>{e.format(e.min)}</span><span>{e.format(e.max)}</span></div>
    </GuessFrame>
  );
}

// ---------- split a bar: drag the dividers to share out $100 ----------
export interface SplitGuess {
  parts: { id: string; label: string; color: string; answer: number }[]; // answer: share in percent
  prompt: string;
  /** How many of the $100 can be in the wrong place and still count as spot on, or close. */
  spot: number; close: number;
}
export function SplitCard({ quiz, round }: { quiz: Quiz; round?: RoundCtx }) {
  const s = quiz.split!;
  const n = s.parts.length;
  const g = useGuess<number[]>(quiz, Array.from({ length: n - 1 }, (_, k) => Math.round(((k + 1) * 100) / n)), round);
  const cuts = g.value;
  const shares = [...cuts, 100].map((c, k) => c - (k ? cuts[k - 1] : 0));
  const off = Math.round(s.parts.reduce((a, p, k) => a + Math.abs(shares[k] - p.answer), 0) / 2);
  const grade: Grade = off <= s.spot ? 'spot' : off <= s.close ? 'close' : 'far';
  const bar = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const MIN = 1;
  const setCut = (k: number, v: number) => g.setValue((c) => {
    const nx = [...c];
    nx[k] = Math.round(clamp(v, (k ? c[k - 1] : 0) + MIN, (k < c.length - 1 ? c[k + 1] : 100) - MIN));
    return nx;
  });
  const verdictText = off === 0 ? 'Every dollar in the right place.' : `${off} of the $100 ${off === 1 ? 'was' : 'were'} in the wrong place.`;
  const lock = () => g.lock(grade, Math.max(10, 100 - 3 * off), verdictText);
  const xAt = (x: number) => { const r = bar.current!.getBoundingClientRect(); return r.width ? ((x - r.left) / r.width) * 100 : 50; };
  const down = (e: React.PointerEvent) => {
    if (g.locked) return;
    const x = xAt(e.clientX);
    const k = cuts.reduce((best, c, i) => (Math.abs(c - x) < Math.abs(cuts[best] - x) ? i : best), 0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(k); setCut(k, x);
  };
  const move = (e: React.PointerEvent) => { if (drag != null) setCut(drag, xAt(e.clientX)); };
  const up = () => { if (drag != null) g.buzz('tap'); setDrag(null); };
  const key = (k: number) => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0;
    if (e.key === 'Enter') { e.preventDefault(); lock(); return; }
    if (!d) return;
    e.preventDefault(); setCut(k, cuts[k] + d * (e.shiftKey ? 5 : 1));
  };
  const seg = (vals: number[], real: boolean) => {
    let at = 0;
    return s.parts.map((p, k) => {
      const from = at; at += vals[k];
      return (
        <span key={p.id} className="split-seg" style={{ left: `${from}%`, width: `${vals[k]}%`, background: p.color }} data-real={real || undefined}>
          {vals[k] >= 9 && <em>{Math.round(vals[k])}%</em>}
        </span>
      );
    });
  };
  return (
    <GuessFrame quiz={quiz} kind="split" locked={g.locked} grade={grade} lockLabel="Lock in my split" onLock={lock} round={round} verdict={<>{verdictText}</>}>
      <div className="split-label small muted">{g.locked ? 'Your guess' : s.prompt}</div>
      <div className="split-bar" ref={bar} data-drag={drag != null || undefined} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {seg(shares, false)}
        {!g.locked && cuts.map((c, k) => (
          <span key={k} className="split-handle" style={{ left: `${c}%` }} role="slider" tabIndex={0} aria-orientation="horizontal"
            aria-label={`Divider between ${s.parts[k].label} and ${s.parts[k + 1].label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c}
            aria-valuetext={`${s.parts[k].label} ${shares[k]}%, ${s.parts[k + 1].label} ${shares[k + 1]}%`} onKeyDown={key(k)} />
        ))}
      </div>
      {g.locked && (
        <>
          <div className="split-label small muted">The real split</div>
          <div className="split-bar split-real" aria-hidden="true">{seg(s.parts.map((p) => p.answer), true)}</div>
        </>
      )}
      <ul className="split-key" aria-live="polite">
        {s.parts.map((p, k) => (
          <li key={p.id}>
            <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
            <span className="split-key-label">{p.label}</span>
            <strong className="num">${shares[k]}</strong>
            {g.locked && <span className="split-key-real num">real: ${Math.round(p.answer)}</span>}
          </li>
        ))}
      </ul>
    </GuessFrame>
  );
}

// ---------- size the bars: drag each one to how big you think it is ----------
export interface SizeGuess {
  parts: { id: string; label: string; color: string; answer: number }[];
  max: number; step: number; start: number;
  format: (v: number) => string;
  prompt: string;
}
export function SizesCard({ quiz, round }: { quiz: Quiz; round?: RoundCtx }) {
  const s = quiz.sizes!;
  const g = useGuess<number[]>(quiz, s.parts.map(() => s.start), round);
  const vals = g.value;
  const answers = s.parts.map((p) => p.answer);
  const top = (a: number[]) => a.indexOf(Math.max(...a));
  const tallest = top(vals) === top(answers) && vals.filter((v) => v === Math.max(...vals)).length === 1;
  const meanOff = s.parts.reduce((a, p, k) => a + Math.abs(vals[k] - p.answer) / p.answer, 0) / s.parts.length;
  const grade: Grade = tallest && meanOff <= 0.15 ? 'spot' : tallest || meanOff <= 0.2 ? 'close' : 'far';
  const [drag, setDrag] = useState<number | null>(null);
  const set = (k: number, v: number) => g.setValue((c) => { const nx = [...c]; nx[k] = clamp(Math.round(v / s.step) * s.step, 0, s.max); return nx; });
  const yAt = (el: HTMLElement, y: number) => { const r = el.getBoundingClientRect(); return r.height ? ((r.bottom - y) / r.height) * s.max : s.start; };
  const big = s.parts[top(answers)];
  const verdictText = `${tallest ? `You made ${big.label} the biggest, and it is.` : `The biggest is ${big.label}.`} Your bars were off by ${Math.round(meanOff * 100)}% on average.`;
  const lock = () => g.lock(grade, Math.max(10, (tallest ? 50 : 0) + 50 * Math.max(0, 1 - meanOff / 0.5)), verdictText);
  const down = (k: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (g.locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(k); set(k, yAt(e.currentTarget, e.clientY));
  };
  const move = (k: number) => (e: React.PointerEvent<HTMLElement>) => { if (drag === k) set(k, yAt(e.currentTarget, e.clientY)); };
  const up = () => { if (drag != null) g.buzz('tap'); setDrag(null); };
  const key = (k: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); lock(); return; }
    const d = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 4, PageDown: -4 } as Record<string, number>)[e.key];
    if (e.key === 'Home') { e.preventDefault(); set(k, 0); return; }
    if (e.key === 'End') { e.preventDefault(); set(k, s.max); return; }
    if (!d) return;
    e.preventDefault(); set(k, vals[k] + d * s.step);
  };
  const h = (v: number) => `${(Math.min(v, s.max) / s.max) * 100}%`;
  return (
    <GuessFrame quiz={quiz} kind="sizes" locked={g.locked} grade={grade} lockLabel="Lock in my bars" onLock={lock} round={round} verdict={<>{verdictText}</>}>
      {!g.locked && <div className="small muted">{s.prompt}</div>}
      <div className="sizes-chart" style={{ gridTemplateColumns: `repeat(${s.parts.length}, minmax(0, 1fr))` }}>
        {s.parts.map((p, k) => (
          <div key={p.id} className="sizes-col">
            <span className="sizes-v num">{s.format(vals[k])}</span>
            <span className="sizes-track" role="slider" tabIndex={g.locked ? -1 : 0} aria-orientation="vertical" aria-label={p.label} aria-valuemin={0} aria-valuemax={s.max} aria-valuenow={vals[k]} aria-valuetext={s.format(vals[k])} aria-disabled={g.locked || undefined}
              data-drag={drag === k || undefined} onPointerDown={down(k)} onPointerMove={move(k)} onPointerUp={up} onPointerCancel={up} onKeyDown={key(k)}>
              <span className="sizes-bar" style={{ height: h(vals[k]), background: p.color }}>{!g.locked && <i className="sizes-grip" aria-hidden="true" />}</span>
              {g.locked && <span className="sizes-answer" style={{ bottom: h(p.answer) }} aria-hidden="true"><em>{s.format(p.answer)}</em></span>}
            </span>
            <span className="sizes-label">{p.label}</span>
          </div>
        ))}
      </div>
      {g.locked && <p className="small muted sizes-key"><span className="sizes-key-line" aria-hidden="true" /> the real amount</p>}
    </GuessFrame>
  );
}

// ---------- sort the cards: put each one in the group it belongs to ----------
export interface SortGuess {
  bins: { id: string; label: string }[];
  items: { id: string; label: string; bin: string }[];
  prompt: string;
}
export function SortCard({ quiz, round }: { quiz: Quiz; round?: RoundCtx }) {
  const s = quiz.sort!;
  const g = useGuess<Record<string, string>>(quiz, {}, round);
  const at = g.value;
  const [sel, setSel] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const right = s.items.filter((it) => at[it.id] === it.bin).length;
  const n = s.items.length;
  const grade: Grade = right === n ? 'spot' : right >= n - 2 ? 'close' : 'far';
  const all = s.items.every((it) => at[it.id]);
  const verdictText = `You put ${right} of ${n} in the right place.`;
  const lock = () => g.lock(grade, (100 * right) / n, verdictText);
  const place = (id: string, bin: string | null) => {
    g.setValue((c) => { const nx = { ...c }; if (bin) nx[id] = bin; else delete nx[id]; return nx; });
    setSel(null); g.buzz('card');
  };
  const down = (id: string) => (e: React.PointerEvent<HTMLElement>) => {
    if (g.locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragged.current = false;
    setDrag({ id, x: e.clientX, y: e.clientY, moved: false });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  };
  const up = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.moved) {
      dragged.current = true;
      const bin = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-bin]')?.dataset.bin;
      if (bin) place(drag.id, bin === 'tray' ? null : bin);
    }
    setDrag(null);
  };
  const tap = (id: string) => {
    if (dragged.current) { dragged.current = false; return; }
    if (g.locked) return;
    setSel((c) => (c === id ? null : id)); g.buzz('tap');
  };
  const chip = (it: SortGuess['items'][number]) => {
    const ok = at[it.id] === it.bin;
    return (
      <button key={it.id} type="button" className="sort-chip" aria-pressed={sel === it.id} disabled={g.locked} data-ok={g.locked ? ok : undefined} data-drag={drag?.id === it.id && drag.moved ? true : undefined}
        onPointerDown={down(it.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)} onClick={() => tap(it.id)}>
        {g.locked && <span className="sort-mark" aria-hidden="true">{ok ? '✓' : '✕'}</span>}
        <span className="sort-text">{it.label}</span>
        {g.locked && !ok && <span className="sort-fix small">belongs with {s.bins.find((b) => b.id === it.bin)!.label.toLowerCase()}</span>}
        {g.locked && <span className="sr-only">{ok ? ', right' : ', wrong'}</span>}
      </button>
    );
  };
  const tray = s.items.filter((it) => !at[it.id]);
  return (
    <GuessFrame quiz={quiz} kind="sort" locked={g.locked} grade={grade} canLock={all} lockLabel={all ? 'Lock in my sort' : `Sort ${n - Object.keys(at).length} more`} onLock={lock} round={round} verdict={<>{verdictText}</>}>
      {!g.locked && <div className="small muted">{s.prompt}</div>}
      {tray.length > 0 && <div className="sort-tray" data-bin="tray" role="group" aria-label="Cards to sort">{tray.map(chip)}</div>}
      <div className="sort-bins" style={{ gridTemplateColumns: `repeat(${s.bins.length}, minmax(0, 1fr))` }}>
        {s.bins.map((b) => (
          <div key={b.id} className="sort-bin" data-bin={b.id} data-ready={sel ? true : undefined} onClick={(e) => { if (sel && !(e.target as HTMLElement).closest('.sort-chip')) place(sel, b.id); }}>
            <button type="button" className="sort-bin-head" disabled={g.locked || !sel} onClick={(e) => { e.stopPropagation(); if (sel) place(sel, b.id); }}>
              {b.label}{sel && !g.locked && <span className="sr-only">: put the selected card here</span>}
            </button>
            <div className="sort-bin-items">{s.items.filter((it) => at[it.id] === b.id).map(chip)}</div>
          </div>
        ))}
      </div>
      {drag?.moved && <span className="tank-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">{s.items.find((it) => it.id === drag.id)?.label}</span>}
    </GuessFrame>
  );
}

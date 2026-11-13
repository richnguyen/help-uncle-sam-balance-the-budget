import { type JSX, useEffect, useRef, useState } from 'react';
import type { LeverId } from '../lib/sandbox';
import { money, pct } from '../lib/format';
import { focusPoint, TipRow, TipTitle, useTooltip } from './ui';

// Visual pieces for the balance-the-budget game.

// Taxes in blue, spending cuts in teal: neither side is shown in red, which reads as "bad".
export const SIDE_COLOR = { revenue: 'var(--c-ss)', spending: 'var(--c-cut)' } as const;

/** Small line icons for each budget area (24×24, stroke = currentColor). */
export function LeverIcon({ lever, size = 22 }: { lever: LeverId; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<LeverId, JSX.Element> = {
    revenues: <><circle cx="7.5" cy="7.5" r="2.5" {...common} /><circle cx="16.5" cy="16.5" r="2.5" {...common} /><path d="M18 6 6 18" {...common} /></>,
    socialSecurity: <><circle cx="8.5" cy="8" r="3" {...common} /><circle cx="16.5" cy="9" r="2.4" {...common} /><path d="M3 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M14 14.6c2.6-.4 5.2 1 6 4.4" {...common} /></>,
    medicare: <path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z" {...common} />,
    medicaid: <path d="M12 20s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10C19.5 15.6 12 20 12 20Z" {...common} />,
    otherMandatory: <><path d="M12 21V8" {...common} /><path d="M12 13c-3.5 0-5.5-2-5.5-5 3.5 0 5.5 2 5.5 5ZM12 10c3.5 0 5.5-2 5.5-5-3.5 0-5.5 2-5.5 5Z" {...common} /></>,
    defense: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6Z" {...common} />,
    nondefense: <><path d="M3 20h18M5 20V10l7-5 7 5v10" {...common} /><path d="M9.5 20v-5h5v5" {...common} /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[lever]}</svg>;
}

/** `share` is the fraction of the gap this piece closes (segments sum to the overall progress). */
export interface GapSegment { id: string; label: string; share: number; side: 'revenue' | 'spending' }

/**
 * The gap bar: the distance from the projection to the mission's goal is the full track; each
 * card fills its share. Past 100% the scale grows so the goal line stays visible.
 */
export function GapBar({ segments, progress }: { segments: GapSegment[]; progress: number }) {
  const { show, hide } = useTooltip();
  const scale = Math.max(1, progress);
  const goalAt = (1 / scale) * 100;
  return (
    <div className="gapbar">
      <div
        className="gapbar-track"
        role="meter"
        aria-label="Progress toward the mission goal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.min(progress, 9.99) * 100)}
        aria-valuetext={`${Math.round(progress * 100)}% of the way to the goal`}
      >
        {segments.map((s) => {
          const w = (Math.max(0, s.share) / scale) * 100;
          const tip = <><TipTitle>{s.label}</TipTitle><TipRow color={SIDE_COLOR[s.side]} line={false} label="Closes" value={`about ${Math.round(s.share * 100)}% of the gap`} /></>;
          return (
            <span
              key={s.id}
              className="gapbar-seg"
              tabIndex={0}
              style={{ width: `${w}%`, background: SIDE_COLOR[s.side] }}
              onPointerMove={(e) => show(tip, e.clientX, e.clientY)}
              onPointerLeave={hide}
              onFocus={(e) => { const p = focusPoint(e.currentTarget); show(tip, p.x, p.y); }}
              onBlur={hide}
            />
          );
        })}
        <span className="gapbar-goal" style={{ left: `${goalAt}%` }} aria-hidden="true"><span>Goal</span></span>
      </div>
    </div>
  );
}

/** Economy gauge: the steepest single-year tightening, against gentle / moderate / steep zones. */
export const econLabel = (peakStep: number) => (peakStep <= 0.005 ? 'Gentle' : peakStep <= 0.01 ? 'Moderate' : 'Steep');

export function EconMeter({ peakStep, vertical = false, compact = false }: { peakStep: number; vertical?: boolean; compact?: boolean }) {
  const max = 0.015;
  const at = Math.min(peakStep, max) / max;
  const label = econLabel(peakStep);
  // The scoreboard's slim version: just the zones and the needle (the label sits in its title).
  if (compact) return (
    <div className="econmeter econmeter-compact" role="meter" aria-label="How hard the plan hits the economy in its steepest year" aria-valuemin={0} aria-valuemax={1.5} aria-valuenow={+(peakStep * 100).toFixed(2)} aria-valuetext={`${label}: ${pct(peakStep, 1)} of GDP in the steepest year`}>
      <div className="econmeter-track">
        <span className="z z1" style={{ width: '33.333%' }} />
        <span className="z z2" style={{ width: '33.333%' }} />
        <span className="z z3" style={{ width: '33.334%' }} />
        <span className="econmeter-needle" style={{ left: `${at * 100}%` }} />
      </div>
    </div>
  );
  if (vertical) return (
    <div className="vmeter" role="meter" aria-label="How hard the plan hits the economy in its steepest year" aria-valuemin={0} aria-valuemax={1.5} aria-valuenow={+(peakStep * 100).toFixed(2)} aria-valuetext={`${label}: ${pct(peakStep, 1)} of GDP in the steepest year`}>
      <div className="vmeter-col">
        <div className="vmeter-track econ">
          <span className="z z3" /><span className="z z2" /><span className="z z1" />
          <span className="vmeter-needle" style={{ bottom: `${at * 100}%` }} />
        </div>
        <div className="vmeter-scale" aria-hidden="true"><span>Steep</span><span>Moderate</span><span>Gentle</span></div>
      </div>
      <div className="vmeter-value"><strong>{label}</strong><span>{pct(peakStep, 1)} of GDP</span></div>
    </div>
  );
  return (
    <div className="econmeter" role="meter" aria-label="How hard the plan hits the economy in its steepest year" aria-valuemin={0} aria-valuemax={1.5} aria-valuenow={+(peakStep * 100).toFixed(2)} aria-valuetext={`${label}: ${pct(peakStep, 1)} of GDP in the steepest year`}>
      <div className="econmeter-track">
        <span className="z z1" style={{ width: '33.333%' }} />
        <span className="z z2" style={{ width: '33.333%' }} />
        <span className="z z3" style={{ width: '33.334%' }} />
        <span className="econmeter-needle" style={{ left: `${at * 100}%` }} />
      </div>
      <div className="econmeter-labels"><span>Gentle</span><span>Moderate</span><span>Steep</span></div>
    </div>
  );
}

/** Taxes vs. spending cuts, with the balanced band (a third to two-thirds) marked. */
export function SplitBar({ revenue, spending, vertical = false, compact = false }: { revenue: number; spending: number; vertical?: boolean; compact?: boolean }) {
  const tot = revenue + spending;
  const r = tot ? revenue / tot : 0;
  if (compact) return (
    <div className="splitbar splitbar-compact">
      <div className="splitbar-track" role="img" aria-label={tot ? `${pct(r, 0)} from taxes, ${pct(1 - r, 0)} from spending cuts; a third to two-thirds from each is balanced` : 'No savings yet'}>
        {tot ? (
          <>
            <span style={{ flex: `${revenue} 0 0`, background: SIDE_COLOR.revenue }} />
            <span style={{ flex: `${spending} 0 0`, background: SIDE_COLOR.spending }} />
          </>
        ) : <span style={{ flex: 1, background: 'var(--surface-2)' }} />}
        <span className="splitbar-band" aria-hidden="true" />
      </div>
    </div>
  );
  if (vertical) return (
    <div className="vmeter" role="img" aria-label={tot ? `${pct(r, 0)} from taxes, ${pct(1 - r, 0)} from spending cuts` : 'No savings yet'}>
      <div className="vmeter-col">
        <div className="vmeter-track split">
          {tot ? (
            <>
              <span style={{ flex: `${spending} 0 0`, background: SIDE_COLOR.spending }} />
              <span style={{ flex: `${revenue} 0 0`, background: SIDE_COLOR.revenue }} />
            </>
          ) : <span style={{ flex: 1, background: 'var(--surface-2)' }} />}
          <span className="vmeter-band" aria-hidden="true" />
        </div>
        <div className="vmeter-scale" aria-hidden="true"><span>Cuts</span><span>Even</span><span>Taxes</span></div>
      </div>
      <div className="vmeter-value">
        <span><span className="swatch" style={{ background: SIDE_COLOR.revenue }} /> Taxes <strong>{tot ? pct(r, 0) : '0%'}</strong></span>
        <span><span className="swatch" style={{ background: SIDE_COLOR.spending }} /> Cuts <strong>{tot ? pct(1 - r, 0) : '0%'}</strong></span>
      </div>
    </div>
  );
  return (
    <div className="splitbar">
      <div className="splitbar-track" role="img" aria-label={tot ? `${pct(r, 0)} from taxes, ${pct(1 - r, 0)} from spending cuts` : 'No savings yet'}>
        {tot ? (
          <>
            <span style={{ flex: `${revenue} 0 0`, background: SIDE_COLOR.revenue }} />
            <span style={{ flex: `${spending} 0 0`, background: SIDE_COLOR.spending }} />
          </>
        ) : <span style={{ flex: 1, background: 'var(--surface-2)' }} />}
        <span className="splitbar-band" aria-hidden="true" />
      </div>
      <div className="legend" style={{ marginTop: 6 }}>
        <span className="legend-item"><span className="swatch" style={{ background: SIDE_COLOR.revenue }} />Taxes {tot ? `${pct(r, 0)} · ${money(revenue * 1e9)}` : '$0'}</span>
        <span className="legend-item"><span className="swatch" style={{ background: SIDE_COLOR.spending }} />Spending cuts {tot ? `${pct(1 - r, 0)} · ${money(spending * 1e9)}` : '$0'}</span>
      </div>
    </div>
  );
}

/** Three-step drag indicator. */
export function DragBars({ level }: { level: 1 | 2 | 3 }) {
  const label = level === 1 ? 'Low' : level === 2 ? 'Medium' : 'High';
  return (
    <span className="dragbars" aria-label={`${label} drag on the economy`}>
      {[1, 2, 3].map((i) => <i key={i} data-on={i <= level} style={{ height: 5 + i * 4 }} />)}
      <span>{label} drag</span>
    </span>
  );
}

export function Stars({ n, size = 'md', label }: { n: number; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  return (
    <span className={`stars stars-${size}`} role="img" aria-label={label ?? `${n} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? 'star on' : 'star'}>★</span>)}
    </span>
  );
}

/** Polite toast queue for unlocked badges. */
export function Toasts({ items }: { items: { key: number; text: string }[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => <div key={t.key} className="toast">{t.text}</div>)}
    </div>
  );
}

// One stack of toasts for the whole app (medals, desk badges), shown by the app's single
// <Toasts>, so two messages never land on the same spot.
type ToastItem = { key: number; text: string };
let toastItems: ToastItem[] = [];
let toastKey = 0;
const toastSubs = new Set<(t: ToastItem[]) => void>();
const setToastItems = (f: (p: ToastItem[]) => ToastItem[]) => { toastItems = f(toastItems); toastSubs.forEach((s) => s(toastItems)); };

export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>(toastItems);
  useEffect(() => { toastSubs.add(setItems); setItems(toastItems); return () => { toastSubs.delete(setItems); }; }, []);
  const push = (text: string) => {
    const key = ++toastKey;
    setToastItems((p) => [...p.slice(-1), { key, text }]);
    window.setTimeout(() => setToastItems((p) => p.filter((x) => x.key !== key)), 4000);
  };
  return { items, push };
}

/** Animate a number toward its target (respects reduced motion). */
export function useTween(target: number, ms = 450) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setV(target); from.current = target; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, ms]);
  return v;
}

import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line, curveMonotoneX } from 'd3-shape';
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { compactAxis, money, pct } from '../lib/format';
import { focusPoint, TipRow, TipTitle, useTooltip, useWidth } from './ui';

// =====================================================================================
// Ranked horizontal bars (HTML). One baseline; value at the tip; optional expandable detail.
// =====================================================================================
export interface BarItem {
  id: string;
  label: string;
  value: number;
  color: string;
  note?: ReactNode;
}

export function BarList({
  items, format = money, total, selected, onSelect, renderDetail, max,
}: {
  items: BarItem[]; format?: (v: number) => string; total?: number; selected?: string | null;
  onSelect?: (id: string | null) => void; renderDetail?: (id: string) => ReactNode; max?: number;
}) {
  const m = max ?? Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className="barlist" role="list">
      {items.map((it) => {
        const w = Math.max(0, (it.value / m) * 100);
        const open = selected === it.id;
        const inner = (
          <>
            <span className="bar-name">
              <span className="swatch" style={{ background: it.color }} />
              <span>{it.label}</span>
            </span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${w}%`, background: it.color }} />
            </span>
            <span className="bar-val">
              {format(it.value)}
              {total ? <span className="muted">{pct(it.value / total)}</span> : null}
            </span>
          </>
        );
        return (
          <div key={it.id} role="listitem">
            {onSelect ? (
              <button type="button" className="bar-row" aria-expanded={open} onClick={() => onSelect(open ? null : it.id)}>
                {inner}
              </button>
            ) : (
              <div className="bar-row">{inner}</div>
            )}
            {open && renderDetail && <div className="detail">{renderDetail(it.id)}</div>}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================================
// Segmented bar: one whole split into parts. Tall (28px) prints shares where they fit.
// =====================================================================================
export function SegBar({
  parts, thin = false, label, format = money, valueLabel = 'Amount',
}: { parts: { label: string; value: number; color: string; ink?: string }[]; thin?: boolean; label: string; format?: (v: number) => string; valueLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(600);
  const { show, hide } = useTooltip();
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const gaps = (parts.length - 1) * 2;
  return (
    <div
      ref={ref}
      className={thin ? 'segbar segbar-thin' : 'segbar'}
      role="img"
      aria-label={`${label}: ` + parts.map((p) => `${p.label} ${format(p.value)} (${pct(p.value / total)})`).join(', ')}
    >
      {parts.map((p) => {
        const share = p.value / total;
        const px = share * (width - gaps);
        const text = pct(share, 0);
        const fits = !thin && px > text.length * 7.5 + 12;
        return (
          <div
            key={p.label}
            tabIndex={0}
            style={{ flex: `${Math.max(p.value, 0)} 0 0`, background: p.color, color: p.ink ?? '#fff' }}
            onPointerMove={(e) => show(<><TipTitle>{p.label}</TipTitle><TipRow color={p.color} line={false} label={valueLabel} value={format(p.value)} /><TipRow label="Share" value={pct(share)} /></>, e.clientX, e.clientY)}
            onPointerLeave={hide}
            onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(<><TipTitle>{p.label}</TipTitle><TipRow color={p.color} line={false} label={valueLabel} value={format(p.value)} /><TipRow label="Share" value={pct(share)} /></>, pt.x, pt.y); }}
            onBlur={hide}
          >
            {fits ? text : null}
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================================
// Waffle: every $100 as 100 squares. Largest-remainder rounding so it sums to exactly 100.
// =====================================================================================
export function hundredths(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  const raw = values.map((v) => (Math.max(v, 0) / total) * 100);
  const base = raw.map(Math.floor);
  let rem = 100 - base.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rem <= 0) break;
    base[i]++;
    rem--;
  }
  return base;
}

export function Waffle({
  parts, active, onActive, label,
}: { parts: { id: string; label: string; value: number; color: string }[]; active: string | null; onActive: (id: string | null) => void; label: string }) {
  const counts = hundredths(parts.map((p) => p.value));
  const cells: { id: string; color: string }[] = [];
  parts.forEach((p, i) => {
    for (let k = 0; k < counts[i]; k++) cells.push({ id: p.id, color: p.color });
  });
  return (
    <div className="waffle" role="img" aria-label={label + ': ' + parts.map((p, i) => `${p.label} $${counts[i]}`).join(', ')} onPointerLeave={() => onActive(null)}>
      {cells.map((c, i) => (
        <span
          key={i}
          style={{ background: c.color }}
          data-dim={active != null && active !== c.id}
          onPointerEnter={() => onActive(c.id)}
        />
      ))}
    </div>
  );
}

// =====================================================================================
// Time chart: columns, stacked areas, and lines on one shared x (years or months), one y-axis.
// Crosshair snaps to the nearest x and the tooltip lists every series at that x.
// =====================================================================================
export interface TSeries {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  kind: 'line' | 'area' | 'bar';
  stack?: string;
  hatch?: boolean;
  dash?: boolean;
  width?: number;
  fillOpacity?: number;
  /** A reference line (an average, a target): no end dot, no hover dot, not in the tooltip. */
  hideInTip?: boolean;
}

export interface TimeChartProps {
  x: (number | string)[];
  series: TSeries[];
  height?: number;
  yFormat?: (v: number) => string;
  tipFormat?: (v: number) => string;
  xLabel?: (x: number | string, i: number) => string;
  tipTitle?: (x: number | string, i: number) => ReactNode;
  tipExtra?: (i: number) => ReactNode;
  projectFrom?: number; // index where projections begin
  projectLabel?: string;
  yMin?: number;
  yMax?: number;
  label: string;
  overlay?: (s: { x: (i: number) => number; y: (v: number) => number; h: number; w: number; step: number }) => ReactNode;
  endLabels?: boolean;
  zeroLine?: boolean;
  /** Explicit indices to label on the x-axis (otherwise evenly spaced). */
  xTicks?: number[];
}

const M = { top: 12, right: 12, bottom: 28, left: 52 };

export function TimeChart(p: TimeChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const { show, hide } = useTooltip();
  const [hover, setHover] = useState<number | null>(null);
  const height = p.height ?? 300;
  const yFmt = p.yFormat ?? compactAxis;
  const tipFmt = p.tipFormat ?? money;
  const n = p.x.length;
  const right = p.endLabels ? 96 : M.right;
  const iw = Math.max(10, width - M.left - right);
  const ih = height - M.top - M.bottom;

  const stacks = useMemo(() => {
    // cumulative stacks for area & bar series, positive and negative separately
    const out: Record<string, { lo: (number | null)[]; hi: (number | null)[] }> = {};
    const groups: Record<string, TSeries[]> = {};
    for (const s of p.series) if (s.kind !== 'line') (groups[s.stack ?? s.id] ??= []).push(s);
    for (const g of Object.values(groups)) {
      const pos = new Array(n).fill(0);
      const neg = new Array(n).fill(0);
      for (const s of g) {
        const lo: (number | null)[] = [];
        const hi: (number | null)[] = [];
        for (let i = 0; i < n; i++) {
          const v = s.values[i];
          if (v == null) { lo.push(null); hi.push(null); continue; }
          if (v >= 0) { lo.push(pos[i]); pos[i] += v; hi.push(pos[i]); }
          else { hi.push(neg[i]); neg[i] += v; lo.push(neg[i]); }
        }
        out[s.id] = { lo, hi };
      }
    }
    return out;
  }, [p.series, n]);

  let lo = p.yMin ?? 0;
  let hi = p.yMax ?? 0;
  if (p.yMax == null || p.yMin == null) {
    for (const s of p.series) {
      const vals = s.kind === 'line' ? s.values : [...stacks[s.id].lo, ...stacks[s.id].hi];
      for (const v of vals) if (v != null) { if (p.yMax == null) hi = Math.max(hi, v); if (p.yMin == null) lo = Math.min(lo, v); }
    }
  }
  const y = scaleLinear().domain([lo, hi]).nice(5).range([ih, 0]);
  const step = iw / n;
  const xc = (i: number) => (i + 0.5) * step;
  const ticks = y.ticks(5);
  const labelEvery = Math.max(1, Math.ceil(46 / step));
  const xLabel = p.xLabel ?? ((x) => String(x));
  const barSeries = p.series.filter((s) => s.kind === 'bar');
  const barGroups = [...new Set(barSeries.map((s) => s.stack ?? s.id))];
  const bw = Math.min(24, (step * 0.72) / Math.max(1, barGroups.length));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
    setHover(i);
    show(
      <>
        <TipTitle>{p.tipTitle ? p.tipTitle(p.x[i], i) : xLabel(p.x[i], i)}</TipTitle>
        {p.series.filter((s) => !s.hideInTip && s.values[i] != null).map((s) => (
          <TipRow key={s.id} color={s.color} line={s.kind === 'line'} label={s.label} value={tipFmt(s.values[i] as number)} />
        ))}
        {p.tipExtra?.(i)}
      </>,
      e.clientX,
      e.clientY,
    );
  };

  const projX = p.projectFrom != null ? p.projectFrom * step : null;

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={width} height={height} role="img" aria-label={p.label}>
        <defs>
          {p.series.filter((s) => s.hatch).map((s) => (
            <pattern key={s.id} id={`h-${s.id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--surface)" />
              <rect width="2.4" height="6" fill={s.color} />
            </pattern>
          ))}
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {projX != null && (
            <g>
              <rect className="proj-band" x={projX} y={0} width={iw - projX} height={ih} />
              <text className="proj-label" x={projX + 6} y={12}>{p.projectLabel ?? 'Projected'}</text>
            </g>
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line className={t === 0 ? 'baseline' : 'gridline'} x1={0} x2={iw} y1={y(t)} y2={y(t)} />
              <text className="tick-label" x={-8} y={y(t)} dy="0.32em" textAnchor="end">{yFmt(t)}</text>
            </g>
          ))}
          {(p.xTicks ?? (() => {
            const t: number[] = [];
            for (let i = 0; i < n; i += labelEvery) t.push(i);
            // add the final x only if it won't crowd the previous label
            if (t.at(-1) !== n - 1 && (n - 1 - t.at(-1)!) * step >= 44) t.push(n - 1);
            return t;
          })()).map((i) => (
            <text key={i} className="tick-label" x={xc(i)} y={ih + 18} textAnchor="middle">{xLabel(p.x[i], i)}</text>
          ))}
          {/* areas */}
          {p.series.filter((s) => s.kind === 'area').map((s) => {
            const st = stacks[s.id];
            const a = d3area<number>()
              .defined((i) => st.lo[i] != null && st.hi[i] != null)
              .x((i) => xc(i))
              .y0((i) => y(st.lo[i] as number))
              .y1((i) => y(st.hi[i] as number))
              .curve(curveMonotoneX);
            const top = d3line<number>().defined((i) => st.hi[i] != null).x((i) => xc(i)).y((i) => y(st.hi[i] as number)).curve(curveMonotoneX);
            const idx = [...Array(n).keys()];
            return (
              <g key={s.id}>
                <path d={a(idx) ?? ''} fill={s.hatch ? `url(#h-${s.id})` : s.color} fillOpacity={s.fillOpacity ?? 0.9} />
                <path d={top(idx) ?? ''} fill="none" stroke="var(--surface)" strokeWidth={1.5} />
              </g>
            );
          })}
          {/* bars */}
          {barSeries.map((s) => {
            const st = stacks[s.id];
            const gi = barGroups.indexOf(s.stack ?? s.id);
            const off = (gi - (barGroups.length - 1) / 2) * (bw + 2);
            return (
              <g key={s.id}>
                {s.values.map((v, i) => {
                  if (v == null || v === 0) return null;
                  const y0 = y(st.lo[i] as number);
                  const y1 = y(st.hi[i] as number);
                  const top = Math.min(y0, y1);
                  const h = Math.max(1, Math.abs(y1 - y0) - (barSeries.length > 1 ? 1 : 0));
                  const isTopOfStack = v >= 0 ? st.hi[i] === Math.max(...p.series.filter((q) => q.kind === 'bar' && (q.stack ?? q.id) === (s.stack ?? s.id)).map((q) => (stacks[q.id].hi[i] ?? -Infinity))) : st.lo[i] === Math.min(...p.series.filter((q) => q.kind === 'bar' && (q.stack ?? q.id) === (s.stack ?? s.id)).map((q) => (stacks[q.id].lo[i] ?? Infinity)));
                  const r = isTopOfStack ? Math.min(4, bw / 2, h / 2) : 0;
                  const x0 = xc(i) + off - bw / 2;
                  // rounded data-end only (top for positive, bottom for negative)
                  const d = v >= 0
                    ? `M${x0},${top + h} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${top + h} Z`
                    : `M${x0},${top} V${top + h - r} Q${x0},${top + h} ${x0 + r},${top + h} H${x0 + bw - r} Q${x0 + bw},${top + h} ${x0 + bw},${top + h - r} V${top} Z`;
                  return <path key={i} d={d} fill={s.hatch ? `url(#h-${s.id})` : s.color} opacity={hover != null && hover !== i ? 0.55 : 1} />;
                })}
              </g>
            );
          })}
          {p.zeroLine && y.domain()[0] < 0 && <line className="baseline" x1={0} x2={iw} y1={y(0)} y2={y(0)} />}
          {p.overlay?.({ x: xc, y, h: ih, w: iw, step })}
          {/* lines */}
          {p.series.filter((s) => s.kind === 'line').map((s) => {
            const l = d3line<number>().defined((i) => s.values[i] != null).x((i) => xc(i)).y((i) => y(s.values[i] as number)).curve(curveMonotoneX);
            const idx = [...Array(n).keys()];
            let last = n - 1;
            while (last >= 0 && s.values[last] == null) last--;
            return (
              <g key={s.id}>
                <path d={l(idx) ?? ''} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '5 4' : undefined} />
                {last >= 0 && !s.hideInTip && <circle cx={xc(last)} cy={y(s.values[last] as number)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
                {p.endLabels && last >= 0 && (
                  <text className="data-label" x={xc(last) + 8} y={y(s.values[last] as number)} dy="0.32em">{s.label}</text>
                )}
              </g>
            );
          })}
          {hover != null && <line className="crosshair" x1={xc(hover)} x2={xc(hover)} y1={0} y2={ih} />}
          {hover != null && p.series.filter((s) => s.kind === 'line' && !s.hideInTip && s.values[hover] != null).map((s) => (
            <circle key={s.id} cx={xc(hover)} cy={y(s.values[hover] as number)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
          ))}
          <rect
            x={0} y={0} width={iw} height={ih} fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => { setHover(null); hide(); }}
          />
        </g>
      </svg>
    </div>
  );
}

// =====================================================================================
// Treemap with drill-down (agency → bureau → account).
// =====================================================================================
export interface TreeNode { name: string; amount: number; prior?: number; children?: TreeNode[] }

export function Treemap({
  root, colorFor, height = 460, onDrill, format = money, total, ink = '#fff',
}: { root: TreeNode; colorFor: (n: TreeNode, i: number) => string; height?: number; onDrill?: (n: TreeNode) => void; format?: (v: number) => string; total: number; ink?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>(800);
  const { show, hide } = useTooltip();
  const h = Math.min(height, Math.max(320, width * 0.62));
  const layout = useMemo(() => {
    const data: TreeNode = { name: root.name, amount: 0, children: (root.children ?? []).filter((c) => c.amount > 0) };
    const hroot = hierarchy<TreeNode>(data, (d) => (d === data ? d.children : undefined))
      .sum((d) => (d === data ? 0 : Math.max(0, d.amount)))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<TreeNode>().tile(treemapSquarify.ratio(1.2)).size([width, h]).paddingInner(0).round(true)(hroot);
  }, [root, width, h]);
  const leaves = layout.children ?? [];
  return (
    <div ref={ref} className="treemap-wrap">
      <svg width={width} height={h} role="img" aria-label={`Treemap of ${root.name}`}>
        {leaves.map((lf: HierarchyRectangularNode<TreeNode>, i) => {
          const w = lf.x1 - lf.x0;
          const hh = lf.y1 - lf.y0;
          const n = lf.data;
          const fill = colorFor(n, i);
          const canDrill = !!(n.children && n.children.length > 0 && onDrill);
          const tip = (
            <>
              <TipTitle>{n.name}</TipTitle>
              <TipRow color={fill} line={false} label="Net outlays" value={format(n.amount)} />
              <TipRow label="Share of total" value={pct(n.amount / total, 2)} />
              {n.prior != null && n.prior > 0 && <TipRow label="Prior year" value={format(n.prior)} />}
              {canDrill && <div className="tooltip-note">Click to see what’s inside</div>}
            </>
          );
          const showLabel = w > 70 && hh > 34;
          const showVal = w > 70 && hh > 52;
          const maxChars = Math.floor((w - 12) / 6.6);
          const name = n.name.length > maxChars ? n.name.slice(0, Math.max(3, maxChars - 1)) + '…' : n.name;
          return (
            <g key={n.name + i} transform={`translate(${lf.x0},${lf.y0})`}>
              <rect
                width={w} height={hh} fill={fill} rx={3}
                tabIndex={0}
                role="button"
                aria-label={`${n.name}: ${format(n.amount)}`}
                onPointerMove={(e) => show(tip, e.clientX, e.clientY)}
                onPointerLeave={hide}
                onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(tip, pt.x, pt.y); }}
                onBlur={hide}
                onClick={() => { hide(); if (canDrill) onDrill!(n); }}
                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canDrill) { e.preventDefault(); onDrill!(n); } }}
                style={{ cursor: canDrill ? 'pointer' : 'default' }}
              />
              {showLabel && (
                <text x={8} y={18} fill={ink} fontSize={12} fontWeight={650}>{name}</text>
              )}
              {showVal && (
                <text x={8} y={34} fill={ink} fontSize={11.5} opacity={0.92} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(n.amount)} · {pct(n.amount / total, 1)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// =====================================================================================
// Diverging horizontal bar (laws): centered on zero, red = adds to deficits, blue = reduces.
// =====================================================================================
export function DivergingBar({ value, max, format }: { value: number; max: number; format: (v: number) => string }) {
  const w = (Math.abs(value) / max) * 50;
  const color = value > 0 ? 'var(--div-pos)' : 'var(--div-neg)';
  return (
    <div className="law-bar">
      <div className="law-bar-val" style={{ textAlign: value > 0 ? 'right' : 'left' }}>
        {format(value)}
      </div>
      <div className="law-bar-track" aria-hidden="true">
        <div
          className="law-bar-fill"
          style={{
            background: color,
            width: `${w}%`,
            left: value > 0 ? '50%' : `${50 - w}%`,
            borderRadius: value > 0 ? '0 4px 4px 0' : '4px 0 0 4px',
          }}
        />
      </div>
    </div>
  );
}

export function Spark({ values, color = 'var(--c-emph)', width = 120, height = 32 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const y = scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).range([height - 4, 4]);
  const x = scaleLinear().domain([0, values.length - 1]).range([2, width - 6]);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--c-deemph)" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r={3.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}

export { Fragment };

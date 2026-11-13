import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY_BY_ID, SOURCE_BY_ID } from '../data';

// ---------- width measurement ----------
export function useWidth<T extends HTMLElement>(initial = 720) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || initial);
    const ro = new ResizeObserver((entries) => {
      const cw = Math.round(entries[0].contentRect.width);
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [initial]);
  return [ref, w] as const;
}

// ---------- tooltip ----------
interface TipState { content: ReactNode; x: number; y: number }
const TipCtx = createContext<{ show: (c: ReactNode, x: number, y: number) => void; hide: () => void }>({ show: () => {}, hide: () => {} });

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const show = useCallback((content: ReactNode, x: number, y: number) => setTip({ content, x, y }), []);
  const hide = useCallback(() => setTip(null), []);
  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = tip.x + 14;
    let top = tip.y + 14;
    if (left + r.width > vw - 8) left = Math.max(8, tip.x - r.width - 14);
    if (top + r.height > vh - 8) top = Math.max(8, tip.y - r.height - 14);
    setPos({ left, top });
  }, [tip]);
  useEffect(() => {
    if (!tip) return;
    const off = () => setTip(null);
    window.addEventListener('scroll', off, { passive: true });
    return () => window.removeEventListener('scroll', off);
  }, [tip]);
  return (
    <TipCtx.Provider value={{ show, hide }}>
      {children}
      {tip &&
        createPortal(
          <div ref={ref} className="tooltip" role="status" style={{ left: pos.left, top: pos.top }}>
            {tip.content}
          </div>,
          document.body,
        )}
    </TipCtx.Provider>
  );
}

export const useTooltip = () => useContext(TipCtx);

/** Point to anchor a tooltip at for keyboard focus (element's top-right). */
export function focusPoint(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}

export function TipTitle({ children }: { children: ReactNode }) {
  return <div className="tooltip-title">{children}</div>;
}

export function TipRow({ color, label, value, line = true }: { color?: string; label: ReactNode; value: ReactNode; line?: boolean }) {
  return (
    <div className="tooltip-row">
      {color ? (
        <span style={{ width: 12, height: line ? 2 : 10, borderRadius: line ? 2 : 3, background: color, display: 'inline-block' }} />
      ) : (
        <span />
      )}
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

// ---------- chart frame with table twin ----------
export interface TableSpec {
  columns: { key: string; label: string; align?: 'r'; wrap?: boolean }[];
  rows: Record<string, ReactNode>[];
}

export function ChartFrame({
  title, sub, legend, children, table, sourceIds, note, actions,
}: {
  title: ReactNode; sub?: ReactNode; legend?: ReactNode; children: ReactNode; table?: TableSpec;
  sourceIds?: string[]; note?: ReactNode; actions?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className="chart" style={{ margin: 0 }}>
      <div className="chart-head">
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div className="chart-title">{title}</div>
          {sub && <div className="chart-sub">{sub}</div>}
        </div>
        {actions}
      </div>
      {legend}
      <div className="chart-body">{showTable && table ? <DataTable spec={table} /> : children}</div>
      <figcaption className="chart-foot">
        <span>{sourceIds && sourceIds.length > 0 && <SourceNote ids={sourceIds} />}{note && <> {note}</>}</span>
        {table && (
          <button className="link-btn" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function DataTable({ spec, maxHeight = 420 }: { spec: TableSpec; maxHeight?: number }) {
  return (
    <div className="table-wrap" style={{ maxHeight, overflowY: 'auto' }}>
      <table className="data">
        <thead>
          <tr>
            {spec.columns.map((c) => (
              <th key={c.key} className={c.align}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, i) => (
            <tr key={i}>
              {spec.columns.map((c) => (
                <td key={c.key} className={[c.align, c.wrap ? 'wrap' : ''].join(' ')}>{r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SourceNote({ ids }: { ids: string[] }) {
  const items = [...new Set(ids)].map((id) => SOURCE_BY_ID[id]).filter(Boolean);
  if (!items.length) return null;
  return (
    <span className="cite">
      Source:{' '}
      {items.map((s, i) => (
        <span key={s.id}>
          {i > 0 && '; '}
          <a href={s.url} target="_blank" rel="noreferrer">{s.publisher}, {s.title}</a>
        </span>
      ))}
    </span>
  );
}

export function Legend({ items }: { items: { label: ReactNode; color: string; kind?: 'rect' | 'line' | 'hatch' }[] }) {
  return (
    <div className="legend" role="list">
      {items.map((it, i) => (
        <span key={i} className="legend-item" role="listitem">
          {it.kind === 'line' ? (
            <span className="legend-line" style={{ background: it.color }} />
          ) : it.kind === 'hatch' ? (
            <span className="swatch" style={{ background: `repeating-linear-gradient(135deg, ${it.color} 0 2px, transparent 2px 4px)`, boxShadow: `inset 0 0 0 1px ${it.color}` }} />
          ) : (
            <span className="swatch" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------- small controls ----------
export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, note, color }: { label: ReactNode; value: ReactNode; note?: ReactNode; color?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{color && <span className="swatch" style={{ background: color }} />}<span>{label}</span></div>
      <div className="stat-value">{value}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}

// ---------- glossary term (a toggletip) ----------
// Tap or click the term to open its definition; tap again, tap elsewhere, or press Escape to close.
// Keyboard focus alone doesn't open it. The definition is also written into one shared live region
// (kept outside the text, so copying a sentence doesn't pick up stray line breaks), so a screen
// reader reads it out when it opens; the floating box is for the eyes.
function termLive() {
  let el = document.getElementById('term-live');
  if (!el) {
    el = document.createElement('div');
    el.id = 'term-live'; el.className = 'sr-only'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = GLOSSARY_BY_ID[id];
  const [open, setOpen] = useState<{ x: number; y: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !g) return;
    const live = termLive();
    const src = g.source ? SOURCE_BY_ID[g.source] : undefined;
    live.textContent = `${g.term}: ${g.def}${src ? ` Source: ${src.publisher}.` : ''}`;
    const away = (e: Event) => { const t = e.target as Node; if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(null); btn.current?.focus(); } };
    const off = () => setOpen(null);
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', off, { passive: true, capture: true });
    return () => { live.textContent = ''; document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', off, { capture: true }); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <>{children}</>;
  const src = g.source ? SOURCE_BY_ID[g.source] : undefined;
  const toggle = () => {
    if (open) return setOpen(null);
    const r = btn.current!.getBoundingClientRect();
    const up = r.bottom > window.innerHeight * 0.6;
    setOpen({ x: Math.min(r.left, window.innerWidth - 328), y: up ? window.innerHeight - r.top + 6 : r.bottom + 6, up });
  };
  return (
    <span className="term-wrap">
      <button ref={btn} type="button" className="term" aria-expanded={!!open} onClick={toggle} data-term={id}>
        {children ?? g.term}
      </button>
      {open &&
        createPortal(
          <div ref={pop} className="term-pop" aria-hidden="true" style={{ left: Math.max(8, open.x), ...(open.up ? { bottom: open.y } : { top: open.y }) }}>
            <b>{g.term}</b>
            {g.def}
            {src && <a className="term-src" href={src.url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>Source: {src.publisher}</a>}
          </div>,
          document.body,
        )}
    </span>
  );
}

export function Section({ id, eyebrow, title, sub, children }: { id?: string; eyebrow?: string; title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={id ? id + '-t' : undefined}>
      <div className="section-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="section-title" id={id ? id + '-t' : undefined}>{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * A page's head. The title shows in the top bar, so here it is only for screen readers (the
 * page's one h1); the lede, if any, opens the page. `eyebrow` is kept for old callers, unused.
 */
export function PageHead({ title, lede }: { eyebrow?: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <header className={'page-head' + (lede ? '' : ' page-head-empty')}>
      <h1 className="page-title sr-only">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

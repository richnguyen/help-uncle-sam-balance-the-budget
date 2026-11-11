import type { BuildKind } from './landmarks';

// The building, played with the Web Animations API on the drawing itself: a star flies from the
// button to the site; scaffolding goes up around the piece; the piece rises course by course,
// pops up column by column, is lowered by a crane, fills like water, is painted on in a sweep, or
// blooms; then dust puffs out at its base and sparkles catch the light. People who ask for less
// motion get a short fade instead. Everything drawn for the effect is removed when it ends.

const NS = 'http://www.w3.org/2000/svg';
export const lessMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const done = (a: Animation) => a.finished.then(() => undefined, () => undefined);

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

/** The parts' box, in the drawing's own units. */
function boxOf(parts: SVGGraphicsElement[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) {
    try {
      const b = p.getBBox();
      if (!b.width && !b.height) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    } catch { /* not rendered */ }
  }
  if (!isFinite(x0)) return { x: -20, y: -40, w: 40, h: 40 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A star flies from one element to another, along an arc, and bursts. */
export async function flyStar(from: Element | null, to: Element | null) {
  if (!from || !to || lessMotion()) return;
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const sx = a.left + a.width / 2, sy = a.top + a.height / 2, ex = b.left + b.width / 2, ey = b.top + b.height / 2;
  const cx = (sx + ex) / 2 + (ex > sx ? -60 : 60), cy = Math.min(sy, ey) - 140;
  const star = document.createElement('div');
  star.className = 'bm-flystar';
  star.textContent = '★';
  document.body.appendChild(star);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, u = 1 - t;
    const x = u * u * sx + 2 * u * t * cx + t * t * ex, y = u * u * sy + 2 * u * t * cy + t * t * ey;
    frames.push({ transform: `translate(${x - 14}px, ${y - 14}px) scale(${1 + Math.sin(t * Math.PI) * 0.6}) rotate(${t * 220}deg)`, opacity: t > 0.92 ? 0.4 : 1 });
  }
  await done(star.animate(frames, { duration: 720, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'forwards' }));
  star.remove();
}

/** Scaffolding around a box: poles and planks, put up from the ground, taken down after. */
function scaffold(layer: SVGGElement, b: { x: number; y: number; w: number; h: number }) {
  const g = el('g', { class: 'bm-scaffold' }, layer);
  const x0 = b.x - 8, x1 = b.x + b.w + 8, top = b.y - 10, bot = b.y + b.h;
  const n = Math.max(2, Math.round((x1 - x0) / 26));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; el('line', { x1: x, x2: x, y1: bot, y2: top }, g); }
  for (let y = bot - 14; y > top; y -= 18) el('line', { x1: x0 - 4, x2: x1 + 4, y1: y, y2: y, class: 'bm-plank' }, g);
  for (let i = 0; i < n; i++) { const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n; el('line', { x1: xa, x2: xb, y1: bot, y2: Math.max(top, bot - 36), class: 'bm-brace' }, g); }
  g.style.transformBox = 'fill-box'; g.style.transformOrigin = '50% 100%';
  return g;
}

/** A crane beside the box, its hook over the middle; returns the hook (cable and load) to lower. */
function crane(layer: SVGGElement, b: { x: number; y: number; w: number; h: number }, lift: number) {
  const g = el('g', { class: 'bm-crane' }, layer);
  const mx = b.x + b.w + Math.max(64, b.w * 0.6), top = b.y - lift - 40, hookX = b.x + b.w / 2;
  el('rect', { x: mx - 4, y: top, width: 8, height: -top, class: 'bm-crane-mast' }, g);
  for (let y = top + 10; y < -6; y += 14) el('line', { x1: mx - 4, x2: mx + 4, y1: y, y2: y + 10, class: 'bm-crane-lace' }, g);
  el('rect', { x: hookX - 16, y: top - 6, width: mx - hookX + 40, height: 6, class: 'bm-crane-mast' }, g);
  el('rect', { x: mx + 10, y: top - 4, width: 16, height: 12, class: 'bm-crane-dark' }, g);
  el('rect', { x: mx - 9, y: top + 2, width: 18, height: 12, rx: 2, class: 'bm-crane-dark' }, g);
  const cable = el('line', { x1: hookX, x2: hookX, y1: top, y2: b.y - 4, class: 'bm-cable' }, g);
  cable.style.transformBox = 'fill-box'; cable.style.transformOrigin = '50% 0%';
  el('path', { d: `M${hookX - 5} ${b.y - 4} L${hookX + 5} ${b.y - 4} L${hookX} ${b.y + 2} Z`, class: 'bm-crane-dark' }, g);
  return { g, cable, top };
}

/** Dust at the base and sparkles at the top, once a piece has landed. */
function burst(layer: SVGGElement, b: { x: number; y: number; w: number; h: number }, scale: number) {
  const out: Promise<void>[] = [];
  const base = b.y + b.h;
  for (let i = 0; i < 12; i++) {
    const x = b.x + (b.w * (i + 0.5)) / 12;
    const c = el('circle', { cx: x, cy: base - 2, r: (3 + (i % 3) * 1.6) * scale, class: 'bm-dust' }, layer);
    const dx = (i - 5.5) * 3.2 * scale, dy = -(6 + (i % 4) * 4) * scale;
    out.push(done(c.animate([{ transform: 'translate(0,0) scale(0.4)', opacity: 0.9 }, { transform: `translate(${dx}px, ${dy}px) scale(1.6)`, opacity: 0 }], { duration: 700 + (i % 3) * 120, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' })).then(() => c.remove()));
  }
  const pts = [[0.15, 0.1], [0.85, 0.05], [0.5, -0.04], [0.3, 0.4], [0.72, 0.36], [0.05, 0.62], [0.95, 0.58]];
  pts.forEach(([fx, fy], i) => {
    const x = b.x + b.w * fx, y = b.y + b.h * fy, r = (6 + (i % 3) * 2.5) * scale;
    const s = el('path', { d: `M${x} ${y - r} L${x + r * 0.22} ${y - r * 0.22} L${x + r} ${y} L${x + r * 0.22} ${y + r * 0.22} L${x} ${y + r} L${x - r * 0.22} ${y + r * 0.22} L${x - r} ${y} L${x - r * 0.22} ${y - r * 0.22} Z`, class: 'bm-spark' }, layer);
    s.style.transformBox = 'fill-box'; s.style.transformOrigin = 'center';
    out.push(done(s.animate([{ transform: 'scale(0) rotate(0deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }], { duration: 900, delay: 80 + i * 70, easing: 'ease-out', fill: 'both' })).then(() => s.remove()));
  });
  return Promise.all(out);
}

export interface BuildOpts {
  art: SVGGElement; // the landmark's drawing
  layer: SVGGElement; // where the scaffolding, the crane and the dust go (same units)
  part: string;
  kind: BuildKind;
  /** The drawing's scale on screen (so dust and sparkles keep a sensible size). */
  scale?: number;
  /** The top of the frame, so the crane's arm stays in view. */
  frameTop?: number;
  /** Before the piece: the old Capitol dome comes down, or the White House burns (1814). */
  prelude?: 'olddome' | 'fire' | null;
  onLand?: () => void;
}

/** Hide the piece before its first frame, so nothing flashes (call it as soon as it is built). */
export function hidePart(art: SVGGElement, part: string) {
  art.querySelectorAll<SVGGElement>(`[data-part="${part}"]`).forEach((p) => { p.style.opacity = '0'; });
}

export async function buildPart({ art, layer, part, kind, scale = 1, frameTop = -Infinity, prelude, onLand }: BuildOpts) {
  const parts = [...art.querySelectorAll<SVGGElement>(`[data-part="${part}"]`)];
  const show = () => parts.forEach((p) => { p.style.opacity = ''; });
  if (!parts.length) return;
  if (lessMotion()) {
    show();
    await Promise.all(parts.map((p) => done(p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }))));
    onLand?.();
    return;
  }
  const b = boxOf(parts);
  const s = Math.max(0.5, Math.min(2.5, 1 / scale));
  // the prelude
  if (prelude === 'olddome') {
    const old = art.querySelector<SVGGElement>('.bm-olddome');
    if (old) { old.style.transformBox = 'fill-box'; old.style.transformOrigin = '50% 100%'; await done(old.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(10px) scaleY(0.2)', opacity: 0 }], { duration: 900, easing: 'ease-in', fill: 'forwards' })); }
  } else if (prelude === 'fire') {
    await wait(1500);
    const fire = art.querySelector<SVGGElement>('.bm-fire');
    if (fire) await done(fire.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }));
  }
  const fx: Promise<unknown>[] = [];
  if (kind === 'rise' || kind === 'stagger' || kind === 'paint') {
    const sc = scaffold(layer, b);
    await done(sc.animate([{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both' }));
  }
  show();
  if (kind === 'rise' || kind === 'fill') {
    // Course by course: up a step, a breath, up again.
    const k = kind === 'fill' ? [[0, 100], [1, 0]] : [[0, 100], [0.2, 76], [0.28, 76], [0.48, 50], [0.56, 50], [0.76, 24], [0.84, 24], [1, 0]];
    const frames = k.map(([o, v]) => ({ offset: o, clipPath: `inset(${v}% -20% 0 -20%)` }));
    await Promise.all(parts.map((p) => done(p.animate(frames, { duration: kind === 'fill' ? 1500 : 1500, easing: kind === 'fill' ? 'cubic-bezier(0.4, 0, 0.3, 1)' : 'linear', fill: 'backwards' }))));
  } else if (kind === 'paint') {
    await Promise.all(parts.map((p) => done(p.animate([{ clipPath: 'inset(-5% 100% -5% -5%)' }, { clipPath: 'inset(-5% -5% -5% -5%)' }], { duration: 1300, easing: 'cubic-bezier(0.45, 0, 0.3, 1)', fill: 'backwards' }))));
  } else if (kind === 'stagger' || kind === 'bloom') {
    const units = parts.flatMap((p) => [...p.querySelectorAll<SVGGElement>('.bm-unit')]);
    const extra = parts.flatMap((p) => [...p.children].filter((c) => !c.classList.contains('bm-unit')) as SVGGraphicsElement[]);
    const gap = kind === 'bloom' ? 70 : Math.max(50, Math.min(120, 900 / Math.max(1, units.length)));
    const anims = units.map((u, i) => {
      u.style.transformBox = 'fill-box'; u.style.transformOrigin = '50% 100%';
      const f = kind === 'bloom'
        ? [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: 0.65 }, { transform: 'scale(1)', opacity: 1 }]
        : [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scaleY(1)', opacity: 1 }];
      return done(u.animate(f, { duration: 420, delay: i * gap, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)', fill: 'backwards' }));
    });
    // Anything not split into units (an entablature over the columns) settles in last.
    const tail = units.length * gap + 200;
    anims.push(...extra.map((e) => done(e.animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: tail, easing: 'ease-out', fill: 'backwards' }))));
    await Promise.all(anims);
  } else if (kind === 'drop') {
    const lift = Math.max(36, Math.min(Math.max(90, b.h * 1.6), b.y - frameTop - 56));
    const c = crane(layer, b, lift);
    await done(c.g.animate([{ opacity: 0, transform: 'translateY(-20px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out', fill: 'both' }));
    const startLen = b.y - lift - 4 - c.top, endLen = b.y - 4 - c.top;
    const easing = 'cubic-bezier(0.3, 0.1, 0.25, 1)';
    const dur = 1300;
    const lower = parts.map((p) => done(p.animate([{ transform: `translateY(${-lift}px)` }, { transform: 'translateY(4px)', offset: 0.88 }, { transform: 'translateY(0)' }], { duration: dur, easing, fill: 'backwards' })));
    const cab = done(c.cable.animate([{ transform: `scaleY(${Math.max(0.05, startLen / endLen)})` }, { transform: 'scaleY(1.02)', offset: 0.88 }, { transform: 'scaleY(1)' }], { duration: dur, easing, fill: 'both' }));
    const hook = c.g.lastElementChild as SVGGraphicsElement;
    const hk = done(hook.animate([{ transform: `translateY(${-lift}px)` }, { transform: 'translateY(4px)', offset: 0.88 }, { transform: 'translateY(0)' }], { duration: dur, easing, fill: 'both' }));
    await Promise.all([...lower, cab, hk]);
    fx.push(done(c.g.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-30px)' }], { duration: 500, delay: 250, fill: 'forwards' })).then(() => c.g.remove()));
  }
  onLand?.();
  fx.push(burst(layer, b, s));
  // take the scaffolding down
  for (const sc of layer.querySelectorAll<SVGGElement>('.bm-scaffold')) {
    fx.push(done(sc.animate([{ opacity: 1, transform: 'scaleY(1)' }, { opacity: 0, transform: 'scaleY(0.6)' }], { duration: 450, delay: 150, easing: 'ease-in', fill: 'forwards' })).then(() => sc.remove()));
  }
  await Promise.all(fx);
}

/** A soft bump of the whole stage when a piece lands. */
export function bump(stage: HTMLElement | null) {
  if (!stage || lessMotion()) return;
  stage.animate([{ transform: 'none' }, { transform: 'translateY(2px) scale(1.006)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
}

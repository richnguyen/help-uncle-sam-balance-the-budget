import type { LandmarkId } from './build/landmarks';
import { CAMPAIGNS, STOPS, type Stop } from './levels';

// The road map's layout: one stop per mission on a walk that runs from the Lincoln Memorial to the
// Capitol, in a stage 390 units wide (the page scales it to the screen). Everything here is worked
// out once, from the list of missions: where each stop sits, the walk through them, and the ground
// seen from above, drawn true to Washington, D.C.:
//   Campaign 1  light-gray granite: the Lincoln Memorial, north past the White House and the Treasury, to the Washington Monument
//   Campaign 2  dark-gray cobblestone: south around the Tidal Basin to the Jefferson Memorial
//   Campaign 3  tan crushed gravel between rows of American elms: down the Mall to the Capitol
// Along the way: the grid's cross streets, L'Enfant's diagonal avenues meeting in circles at the
// foot of Capitol Hill, spring ornamentals (dogwood, redbud, magnolia, azalea), cherry trees at the
// Tidal Basin, and statues that really stand on the route.

export const W = 390;
const PITCH = 148;
const XS = [195, 252, 286, 252, 195, 138, 104, 138];

export interface Spot { s: Stop; x: number; y: number; boss: boolean; k: number }
export interface Zone { n: 1 | 2 | 3; y0: number; y1: number; spots: Spot[]; walk: string; segs: string[]; start: string; material: 'granite' | 'cobble' | 'gravel'; walkName: string }
export interface Caption { x: number; y: number; w: number; text: string }
export interface Mark { id: LandmarkId; x: number; y: number; w: number; site?: boolean; chipX: number; chipY: number }
export interface SideStop { x: number; y: number; kind: 'daily' | 'showdown'; href: string; label: string; sub: string }
export interface Road { H: number; zones: Zone[]; spots: Spot[]; ground: string; defs: string; captions: Caption[]; marks: Mark[]; sides: SideStop[] }

export const CAMP_COLOR: Record<number, { c: string; e: string; tint: string }> = {
  1: { c: '#1b6e4c', e: '#124d35', tint: '#cfe6d8' },
  2: { c: '#2467c4', e: '#1a4c93', tint: '#cfdef5' },
  3: { c: '#6250d6', e: '#4838a8', tint: '#dcd7f7' },
};
export const MATERIAL = {
  granite: { id: 'mGranite', edge: '#aeb5b0', name: 'light-gray granite' },
  cobble: { id: 'mCobble', edge: '#5c6462', name: 'gray cobblestone' },
  gravel: { id: 'mGravel', edge: '#cfbd95', name: 'tan crushed gravel' },
} as const;

// ---------- patterns and symbols ----------
const SH = '#a7c3a0';
const PATTERNS = `<pattern id="mGranite" width="44" height="28" patternUnits="userSpaceOnUse"><rect width="44" height="28" fill="#d9dcda"/><rect x="0" y="0" width="22" height="14" fill="#e1e4e2"/><rect x="11" y="14" width="22" height="14" fill="#d0d4d1"/><path d="M0 0.5H44M0 14.5H44M0.5 0V14M22.5 0V14M11.5 14V28M33.5 14V28" stroke="#bcc2be" stroke-width="1"/></pattern>
<pattern id="mCobble" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#727a78"/><rect x="1" y="1" width="9.5" height="9.5" rx="2.5" fill="#99a29f"/><rect x="12" y="1" width="9" height="9.5" rx="2.5" fill="#8b9491"/><rect x="-4.5" y="12" width="9.5" height="9" rx="2.5" fill="#8b9491"/><rect x="6.5" y="12" width="9.5" height="9" rx="2.5" fill="#a5adaa"/><rect x="17.5" y="12" width="9" height="9" rx="2.5" fill="#939c99"/></pattern>
<pattern id="mGravel" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#eadfc6"/><g fill="#cdba91"><circle cx="3" cy="4" r="1"/><circle cx="14" cy="2.5" r="0.9"/><circle cx="20" cy="9" r="1.1"/><circle cx="8" cy="12" r="0.9"/><circle cx="15.5" cy="16" r="1"/><circle cx="4" cy="20" r="1.1"/><circle cx="21" cy="21" r="0.9"/></g><g fill="#f9f3e4"><circle cx="9" cy="5" r="1"/><circle cx="18" cy="13.5" r="0.9"/><circle cx="2.5" cy="12.5" r="0.8"/><circle cx="11" cy="20.5" r="1"/></g></pattern>
<pattern id="mLawn" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect width="64" height="64" fill="#dcead0"/><rect width="32" height="64" fill="#d3e4c6"/></pattern>`;
const tree = (id: string, base: string, hi: string, mid: string, lo: string, spark: string, extra = '') => `<g id="${id}"><ellipse cx="3" cy="5" rx="15" ry="14" fill="${SH}"/><circle r="15" fill="${base}"/><circle cx="-5" cy="-5" r="9.5" fill="${hi}"/><circle cx="6.5" cy="-2" r="7.5" fill="${mid}"/><circle cx="-1" cy="7" r="7" fill="${lo}"/><circle cx="-6.5" cy="-7.5" r="4" fill="${spark}"/>${extra}</g>`;
const SYMBOLS = [
  tree('tElm', '#69a66b', '#7dba7b', '#74b173', '#5c9a61', '#9fd096'),
  tree('tOak', '#4f8f5c', '#62a56c', '#58995f', '#437f50', '#82bf86'),
  tree('tCherry', '#eba3c0', '#f6c6da', '#f1b4cd', '#e290b1', '#fde3ee'),
  tree('tRedbud', '#c95f9c', '#dc82b5', '#d370a9', '#b54f8a', '#efb0d2'),
  tree('tDogwood', '#e9ecd9', '#fbfcf2', '#f1f4e4', '#d4dbc0', '#ffffff', '<g fill="#c9d3ae"><circle cx="-4" cy="-3" r="1.3"/><circle cx="5" cy="-5" r="1.3"/><circle cx="2" cy="6" r="1.3"/><circle cx="-7" cy="5" r="1.3"/></g>'),
  tree('tMagnolia', '#3f7a52', '#4e8d60', '#468457', '#356b47', '#5fa06f', '<g fill="#fdf8ee"><circle cx="-5" cy="-4" r="2.2"/><circle cx="6" cy="-6" r="2"/><circle cx="3" cy="6" r="2.2"/><circle cx="-8" cy="6" r="1.8"/><circle cx="9" cy="3" r="1.7"/></g>'),
  `<g id="shrub"><ellipse cx="1.5" cy="2.5" rx="8" ry="7" fill="${SH}"/><circle cx="-3" cy="0" r="5" fill="#5c9a61"/><circle cx="3.5" cy="-1" r="5" fill="#69a66b"/><circle cx="0" cy="3" r="4.5" fill="#4f8f5c"/><circle cx="-3.5" cy="-2" r="2" fill="#8fc48b"/></g>`,
  `<g id="azalea"><ellipse cx="1.5" cy="2.5" rx="9" ry="7.5" fill="${SH}"/><circle cx="-3.5" cy="0" r="5.5" fill="#4f8f5c"/><circle cx="4" cy="-1" r="5.5" fill="#5c9a61"/><circle cx="0" cy="3.5" r="5" fill="#437f50"/><g fill="#f06aa0"><circle cx="-5" cy="-2" r="1.8"/><circle cx="1" cy="-3" r="1.8"/><circle cx="5.5" cy="1" r="1.8"/><circle cx="-1" cy="4" r="1.8"/><circle cx="-5.5" cy="3" r="1.5"/></g></g>`,
  `<g id="bed"><circle cx="1.5" cy="2.5" r="15" fill="${SH}"/><circle r="15" fill="#5c9a61"/><circle r="12.5" fill="#a98a66"/><g fill="#d6453d"><circle cx="0" cy="-8" r="2.6"/><circle cx="8" cy="0" r="2.6"/><circle cx="0" cy="8" r="2.6"/><circle cx="-8" cy="0" r="2.6"/></g><g fill="#f2c230"><circle cx="5.7" cy="-5.7" r="2.6"/><circle cx="5.7" cy="5.7" r="2.6"/><circle cx="-5.7" cy="5.7" r="2.6"/><circle cx="-5.7" cy="-5.7" r="2.6"/></g><circle r="3.2" fill="#ffffff"/></g>`,
  `<g id="stBase"><ellipse cx="2" cy="23" rx="19" ry="6" fill="${SH}"/><ellipse cx="0" cy="20" rx="17" ry="5.5" fill="#c9cdc8"/><rect x="-10" y="6" width="20" height="14" rx="1.5" fill="#dfe2de"/><rect x="-10" y="6" width="5" height="14" fill="#cfd3ce"/><rect x="-12" y="4" width="24" height="3.5" rx="1" fill="#eef0ed"/></g>`,
  '<g id="stStand"><use href="#stBase"/><g fill="#5a4630"><circle cx="0" cy="-17" r="3.6"/><path d="M-5.5 -11.5Q0 -15 5.5 -11.5L4.5 -1L5 4H-5L-4.5 -1Z"/></g><path d="M-2 -10v8" stroke="#80684a" stroke-width="1.6" stroke-linecap="round"/></g>',
  '<g id="stMarble"><use href="#stBase"/><g fill="#f4f2ec" stroke="#cfcabd" stroke-width="0.8"><circle cx="0" cy="-17" r="3.4"/><path d="M-5.5 -11.5Q0 -15 5.5 -11.5L5 4H-5Z"/></g></g>',
  `<g id="stSeat"><ellipse cx="2" cy="17" rx="23" ry="7" fill="${SH}"/><path d="M-20 12a20 9 0 0 1 40 0v4h-40z" fill="#dfe2de"/><path d="M-20 12a20 9 0 0 1 40 0" fill="none" stroke="#c3c8c2" stroke-width="2"/><g fill="#5a4630"><circle cx="-1" cy="-9" r="4.6"/><path d="M-9 8Q-10 -3 -1 -4.5Q8 -3 9 4L13 9.5H-9Z"/></g><path d="M-5.5 -11q4.5 -4.5 9 0" fill="none" stroke="#80684a" stroke-width="1.8" stroke-linecap="round"/></g>`,
  `<g id="stStone"><ellipse cx="2" cy="22" rx="26" ry="6" fill="${SH}"/><path d="M-24 20L-23 2L-16 -3L-13 20Z" fill="#ddd7c8"/><path d="M24 20L23 2L16 -3L13 20Z" fill="#ddd7c8"/><path d="M-10 20L-11 -15L-4 -21L8 -18L10 20Z" fill="#efeadd"/><path d="M-10 20L-11 -15L-4 -21L-2 20Z" fill="#e2dccd"/><g fill="#cbc3b0"><circle cx="2.5" cy="-10" r="3.2"/><path d="M-2 -5.5h9L7.5 14h-9z"/></g></g>`,
  '<g id="stHorse"><use href="#stBase"/><g fill="#5a4630"><ellipse cx="0" cy="-4" rx="11" ry="4.8"/><path d="M8 -6.5L13 -15.5L17.5 -13L16.5 -10.5L13.5 -11L12 -4Z"/><path d="M-10.5 -6Q-15 -4 -14.5 3L-12.8 3Q-12.5 -2 -9.5 -3Z"/><path d="M-8 -1h2.4v7h-2.4zM-3.5 -1h2.4v7h-2.4zM3.5 -1h2.4v7h-2.4zM7.5 -1h2.4v7h-2.4z"/><path d="M-3 -7L-2 -16.5Q0 -18.5 2 -16.5L3.5 -7Z"/><circle cx="0" cy="-19.5" r="2.7"/><path d="M-4 -21.4h8v1.4h-8z"/></g></g>',
].join('\n');
const SYM = { E: 'tElm', O: 'tOak', C: 'tCherry', R: 'tRedbud', D: 'tDogwood', M: 'tMagnolia', S: 'shrub', A: 'azalea', B: 'bed', st: 'stStand', sm: 'stMarble', se: 'stSeat', sn: 'stStone', sh: 'stHorse' } as const;
type Kind = keyof typeof SYM;
const RAD: Partial<Record<Kind, number>> = { E: 15, O: 15, C: 15, R: 15, D: 15, M: 15, S: 8, A: 9, B: 15 };
type Item = [Kind, number, number, number];
const use = (items: Item[]) => items.map(([k, x, y, sc]) => `<use href="#${SYM[k]}" transform="translate(${x} ${Math.round(y)}) scale(${sc})"/>`).join('');
const sidePath = (d: string) => `<path d="${d}" fill="none" stroke="#cdbd97" stroke-width="12" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#ebe1c9" stroke-width="8" stroke-linecap="round"/>`;
const street = (y: number, h = 16) => `<rect x="0" y="${y}" width="${W}" height="${h}" fill="#c9cec9"/><rect x="0" y="${y}" width="${W}" height="1.5" fill="#b3b9b3"/><rect x="0" y="${y + h - 1.5}" width="${W}" height="1.5" fill="#b3b9b3"/><path d="M0 ${y + h / 2}H${W}" stroke="#f4f6f2" stroke-width="1.5" stroke-dasharray="8 7"/>`;
const crosswalk = (x: number, y: number, h = 16) => Array.from({ length: 7 }, (_, i) => `<rect x="${x - 24 + i * 8}" y="${y + 2}" width="4.5" height="${h - 4}" fill="#ffffff"/>`).join('');
const avenue = (d: string) => `<path d="${d}" fill="none" stroke="#b3b9b3" stroke-width="19"/><path d="${d}" fill="none" stroke="#c9cec9" stroke-width="16"/><path d="${d}" fill="none" stroke="#f4f6f2" stroke-width="1.5" stroke-dasharray="8 7"/>`;
const circle = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="24" fill="#b3b9b3"/><circle cx="${x}" cy="${y}" r="22.5" fill="#c9cec9"/><circle cx="${x}" cy="${y}" r="15" fill="#cfe1c1" stroke="#b3b9b3" stroke-width="1.2"/>`;
const walkPath = (d: string, m: keyof typeof MATERIAL) => `<path d="${d}" fill="none" stroke="${MATERIAL[m].edge}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="url(#${MATERIAL[m].id})" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>`;

/** Points along a path made of M, L and C commands (absolute), close enough together to keep plants off it. */
function samples(d: string) {
  const t = d.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  const pts: [number, number][] = [];
  let cur: [number, number] | null = null;
  for (let i = 0; i < t.length;) {
    const c = t[i++];
    if (c === 'M' || c === 'L') {
      const p: [number, number] = [+t[i], +t[i + 1]]; i += 2;
      if (c === 'L' && cur) { const n = Math.max(2, Math.round(Math.hypot(p[0] - cur[0], p[1] - cur[1]) / 10)); for (let k = 0; k <= n; k++) pts.push([cur[0] + (p[0] - cur[0]) * k / n, cur[1] + (p[1] - cur[1]) * k / n]); }
      cur = p; pts.push(p);
    } else {
      const a = [+t[i], +t[i + 1]], b = [+t[i + 2], +t[i + 3]], e: [number, number] = [+t[i + 4], +t[i + 5]]; i += 6;
      for (let k = 1; k <= 24; k++) { const u = k / 24, v = 1 - u; pts.push([v ** 3 * cur![0] + 3 * v * v * u * a[0] + 3 * v * u * u * b[0] + u ** 3 * e[0], v ** 3 * cur![1] + 3 * v * v * u * a[1] + 3 * v * u * u * b[1] + u ** 3 * e[1]]); }
      cur = e;
    }
  }
  return pts;
}
type Rect = [number, number, number, number];
/** Plants a garden around the walk: nothing on the walk, on a label, or on anything listed in `keep`. */
class Garden {
  items: Item[] = [];
  private pts: [number, number][];
  constructor(paths: string[], private keep: Rect[]) { this.pts = paths.flatMap(samples); }
  add(k: Kind, x: number, y: number, sc = 1, gap = 4, walkGap = 34) {
    const r = (RAD[k] ?? 10) * sc;
    if (x - r < -6 || x + r > W + 6) return false;
    if (this.keep.some(([x0, y0, x1, y1]) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1)) return false;
    if (walkGap && this.pts.some(([a, b]) => Math.abs(b - y) < walkGap + r && Math.hypot(a - x, b - y) < walkGap + r)) return false;
    if (this.items.some(([kk, a, b, ss]) => Math.hypot(a - x, b - y) < r + (RAD[kk] ?? 10) * ss + gap)) return false;
    this.items.push([k, x, y, sc]);
    return true;
  }
  /** A row down each side of the Mall, doubled wherever there is room. */
  rows(y0: number, y1: number, kind: Kind = 'E', step = 46) {
    for (let y = y0; y < y1; y += step) { this.add(kind, 22, y, 0.9); this.add(kind, 368, y, 0.9); this.add(kind, 60, y + step / 2, 0.8); this.add(kind, 330, y + step / 2, 0.8); }
  }
  /** Ornamentals in between, placed by a fixed scramble so the map is the same every time. */
  sprinkle(y0: number, y1: number, kinds: [Kind, number][], seed = 7, xs = [96, 140, 250, 296], step = 64) {
    let n = seed;
    for (let y = y0; y < y1; y += step) for (const x of xs) {
      n = (Math.imul(n, 1103515245) + 12345) & 0x7fffffff;
      const [k, sc] = kinds[n % kinds.length];
      this.add(k, x + ((n >> 8) % 19) - 9, y + ((n >> 12) % 23) - 11, sc, 10);
    }
  }
}
const ORN: [Kind, number][] = [['R', 0.72], ['D', 0.75], ['M', 0.8], ['S', 1], ['A', 1], ['B', 0.85], ['O', 0.8], ['D', 0.7]];
const CHERRY: [Kind, number][] = [['C', 0.8], ['C', 0.7], ['A', 1], ['C', 0.85], ['S', 1], ['D', 0.7]];

let cached: Road | null = null;
export function road(): Road {
  if (cached) return cached;
  const spots: Spot[] = [], zones: Zone[] = [], captions: Caption[] = [], marks: Mark[] = [], sides: SideStop[] = [], keep: Rect[] = [];
  const body: string[] = [], top: string[] = [];
  const ms = (n: number) => STOPS.filter((s) => s.campaign === n);
  /** Lays a campaign's stops from `first`; `gaps` adds room after a stop (for a street); the last stop is the bigger final mission. */
  const lay = (n: 1 | 2 | 3, y0: number, first: number, bossGap: number, gaps: Record<number, number> = {}) => {
    let y = first; const out: Spot[] = [];
    ms(n).forEach((s, k, all) => {
      const boss = k === all.length - 1;
      if (k > 0) y += boss ? bossGap : PITCH + (gaps[k - 1] ?? 0);
      out.push({ s, x: boss ? 195 : XS[k % XS.length], y, boss, k });
    });
    return out;
  };
  /** The walk through a campaign's stops, as one path and as one piece per stop (for the walked trail). */
  const through = (from: [number, number], sp: Spot[], to: [number, number]) => {
    const segs: string[] = []; let [px, py] = from;
    for (const p of sp) {
      const m = (py + p.y) / 2;
      segs.push(px === p.x ? `M${px} ${py} L${p.x} ${p.y}` : `M${px} ${py} C${px} ${m} ${p.x} ${m} ${p.x} ${p.y}`);
      [px, py] = [p.x, p.y];
    }
    const tail = `M${px} ${py} L${to[0]} ${to[1]}`;
    const walk = [segs[0], ...segs.slice(1).map((s) => s.replace(/^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? /, '')), tail.replace(/^M-?\d+(?:\.\d+)? -?\d+(?:\.\d+)? /, '')].join(' ');
    return { segs, walk };
  };
  const cap = (x: number, y: number, w: number, text: string) => { captions.push({ x, y, w, text }); keep.push([x, y - 2, x + w, y + 28]); };
  const statue = (k: Kind, x: number, y: number, sc: number, text: string, capW = 104) => { top.push(use([[k, x, y, sc]])); keep.push([x - 26, y - 26, x + 26, y + 30]); cap(x - capW / 2, y + 32, capW, text); };
  const stopKeeps = (sp: Spot[]) => sp.forEach((p) => { keep.push([p.x - 76, p.y + (p.boss ? 60 : 40), p.x + 76, p.y + (p.boss ? 140 : 104)]); if (p.boss) keep.push([p.x - 66, p.y - 66, p.x + 66, p.y + 66]); });
  const at = (sp: Spot[], k: number) => sp[k].y;

  // ---------- Campaign 1: the Lincoln Memorial, north past the White House and the Treasury, to the Monument ----------
  const s1 = lay(1, 0, 248, 250);
  const b1 = s1.at(-1)!.y, end1 = b1 + 216;
  const w1 = through([195, 172], s1, [195, end1]);
  zones.push({ n: 1, y0: 0, y1: end1, spots: s1, ...w1, start: `M195 172 L195 ${s1[0].y}`, material: 'granite', walkName: 'light-gray granite, from the Lincoln Memorial past the White House and the Treasury to the Washington Monument' });
  marks.push({ id: 'lincoln', x: 70, y: 16, w: 250, site: true, chipX: 250, chipY: 20 });
  keep.push([64, 0, 326, 182]);
  statue('se', 56, at(s1, 0) + 112, 1.05, 'Albert Einstein Memorial');
  body.push(sidePath(`M172 ${at(s1, 0) + 34} L84 ${at(s1, 0) + 108}`));
  sides.push({ x: 66, y: at(s1, 2) - 14, kind: 'daily', href: '#daily', label: 'Daily Dollar', sub: '' });
  keep.push([6, at(s1, 2) - 46, 126, at(s1, 2) + 56]);
  body.push(sidePath(`M246 ${at(s1, 2) - 16} L98 ${at(s1, 2) - 14}`));
  keep.push([96, at(s1, 2) - 28, 250, at(s1, 2)]);
  // The pond in Constitution Gardens, with its island: north of the walk.
  const py = at(s1, 3) - 28;
  body.push(`<g transform="translate(0 ${py - 748})"><path d="M22 748C22 722 60 712 96 716C128 720 150 734 148 752C146 772 110 784 76 782C44 780 22 770 22 748Z" fill="#a8d4e8" stroke="#8fc2da" stroke-width="2.5"/><path d="M38 742q8 -5 16 0M58 766q8 -5 16 0M116 762q7 -5 14 0M70 730q7 -5 14 0" fill="none" stroke="#dbeef7" stroke-width="2" stroke-linecap="round"/><ellipse cx="102" cy="748" rx="12" ry="10" fill="#cfe1c1" stroke="#b7cfae" stroke-width="1.5"/></g>`);
  top.push(use([['S', 102, py - 2, 0.8]]));
  cap(20, py - 58, 124, 'Constitution Gardens'); keep.push([14, py - 44, 156, py + 42]);
  marks.push({ id: 'whitehouse', x: 254, y: at(s1, 5) - 24, w: 130, chipX: 262, chipY: at(s1, 5) + 54 }); keep.push([248, at(s1, 5) - 30, W, at(s1, 5) + 90]);
  marks.push({ id: 'treasury', x: 252, y: at(s1, 6) + 44, w: 132, chipX: 262, chipY: at(s1, 6) + 104 }); keep.push([246, at(s1, 6) + 38, W, at(s1, 6) + 140]);
  // 15th Street, then the Monument grounds.
  const st17 = at(s1, 7) + 108;
  body.push(street(st17)); keep.push([0, st17 - 4, W, st17 + 20]); cap(326, st17 - 14, 60, '15th St');
  marks.push({ id: 'monument', x: 268, y: b1 - 152, w: 96, chipX: 262, chipY: b1 + 22 }); keep.push([262, b1 - 156, 370, b1 + 54]);
  statue('st', 338, b1 + 104, 1, 'John Paul Jones Memorial', 100);
  body.push(sidePath(`M246 ${b1 + 96} L314 ${b1 + 108}`));
  const ind = b1 + 190;
  body.push(street(ind)); keep.push([0, ind - 4, W, ind + 20]); cap(282, ind - 14, 100, 'Independence Ave');

  // ---------- Campaign 2: south around the Tidal Basin to the Jefferson Memorial, on cobblestone ----------
  const y2 = end1, s2 = lay(2, y2, y2 + 204, 214);
  const b2 = s2.at(-1)!.y, end2 = b2 + 216;
  const w2 = through([195, y2], s2, [195, end2]);
  zones.push({ n: 2, y0: y2, y1: end2, spots: s2, ...w2, start: `M195 ${y2} L195 ${s2[0].y}`, material: 'cobble', walkName: 'gray cobblestone around the Tidal Basin, to the Jefferson Memorial' });
  keep.push([14, y2 + 10, 376, y2 + 112]);
  // The Tidal Basin fills the bend of the walk; the Jefferson Memorial stands on its far shore.
  const tb = at(s2, 0) + 96, tbh = at(s2, 3) - at(s2, 0) - 40;
  body.push(`<path d="M-10 ${tb + 30}C20 ${tb - 6} 96 ${tb - 8} 130 ${tb + 26}C160 ${tb + 60} 156 ${tb + tbh * 0.55} 138 ${tb + tbh * 0.8}C118 ${tb + tbh + 6} 40 ${tb + tbh + 14} -10 ${tb + tbh - 10}Z" fill="#b5d9ea" stroke="#9bc9de" stroke-width="2"/><path d="M24 ${tb + tbh * 0.62}h30M70 ${tb + tbh * 0.74}h28M36 ${tb + tbh * 0.86}h22M92 ${tb + 60}h20" fill="none" stroke="#d6ecf5" stroke-width="2" stroke-linecap="round"/>`);
  keep.push([-10, tb - 10, 158, tb + tbh + 16]);
  marks.push({ id: 'jefferson', x: 4, y: tb + 44, w: 122, site: true, chipX: 8, chipY: tb + 124 });
  cap(34, tb + tbh * 0.66, 90, 'Tidal Basin');
  statue('sn', 112, at(s2, 0) + 26, 1, 'Martin Luther King, Jr. Memorial', 112);
  body.push(sidePath(`M170 ${at(s2, 0) + 4} L136 ${at(s2, 0) + 24}`));
  statue('se', 60, at(s2, 3) + 96, 1.05, 'Franklin Delano Roosevelt Memorial', 116);
  const st14 = b2 + 190;
  body.push(street(st14)); keep.push([0, st14 - 4, W, st14 + 20]); cap(326, st14 - 14, 60, '14th St');

  // ---------- Campaign 3: down the Mall between the elms to the Capitol, on gravel ----------
  const y3 = end2, s3 = lay(3, y3, y3 + 204, 236, { 1: 44 });
  const b3 = s3.at(-1)!.y, H = b3 + 500;
  const w3 = through([195, y3], s3, [195, b3 + 400]);
  zones.push({ n: 3, y0: y3, y1: H, spots: s3, ...w3, start: `M195 ${y3} L195 ${s3[0].y}`, material: 'gravel', walkName: 'the Mall’s tan gravel between the elms, to the Capitol' });
  keep.push([14, y3 + 10, 376, y3 + 112]);
  const st7 = at(s3, 1) + 112, st3 = at(s3, 3) + 112;
  body.push(street(st7), street(st3)); keep.push([0, st7 - 4, W, st7 + 20], [0, st3 - 4, W, st3 + 20]); cap(330, st7 - 14, 56, '7th St'); cap(330, st3 - 14, 56, '3rd St');
  statue('st', 322, at(s3, 0) + 72, 1, 'Joseph Henry statue', 100);
  sides.push({ x: 334, y: b3 - 6, kind: 'showdown', href: '#duels', label: 'Sealed Showdown', sub: 'Dare a friend' });
  keep.push([272, b3 - 40, W, b3 + 66]);
  // Capitol Hill rises in terraces; Pennsylvania and Maryland Avenues meet at its foot, each in a circle.
  const hill = b3 + 470, cy = b3 + 250;
  const terraces = `<ellipse cx="195" cy="${hill}" rx="262" ry="190" fill="#cfe1c1"/><path d="M-40 ${hill - 40}A262 190 0 0 1 430 ${hill - 40}" fill="none" stroke="#b7cfae" stroke-width="2"/><ellipse cx="195" cy="${hill}" rx="214" ry="150" fill="#d8e8cb"/><path d="M0 ${hill - 54}A214 150 0 0 1 390 ${hill - 54}" fill="none" stroke="#b7cfae" stroke-width="2"/><ellipse cx="195" cy="${hill}" rx="168" ry="112" fill="#e1eed5"/>`;
  body.push(avenue(`M-30 ${cy - 134} L36 ${cy}`), avenue(`M420 ${cy - 134} L354 ${cy}`), circle(36, cy), circle(354, cy));
  top.push(use([['sm', 36, cy - 6, 0.62], ['st', 354, cy - 6, 0.62]]));
  cap(0, cy - 84, 74, 'Pennsylvania Ave'); cap(318, cy - 84, 72, 'Maryland Ave'); cap(0, cy + 30, 74, 'Peace Monument'); cap(316, cy + 30, 74, 'Garfield Monument');
  keep.push([0, cy - 140, 80, cy + 60], [310, cy - 140, W, cy + 60]);
  top.push(use([['sh', 195, b3 + 186, 1]])); cap(222, b3 + 172, 100, 'Ulysses S. Grant Memorial'); keep.push([150, b3 + 150, 330, b3 + 220]);
  marks.push({ id: 'capitol', x: 30, y: b3 + 236, w: 330, chipX: 130, chipY: b3 + 470 }); keep.push([24, b3 + 226, 366, H]);

  // ---------- the planting ----------
  [s1, s2, s3].forEach(stopKeeps);
  spots.push(...s1, ...s2, ...s3);
  const walks = zones.map((z) => z.walk);
  const g = new Garden(walks, keep);
  for (const y of [28, 72, 116]) { g.add('E', 30, y, 1, 4, 0); g.add('E', 360, y, 1, 4, 0); }
  for (const y of [50, 94]) { g.add('O', 60, y, 0.8, 4, 0); g.add('O', 330, y, 0.8, 4, 0); }
  g.add('B', 50, 196, 0.9, 4, 0); g.add('B', 340, 196, 0.9, 4, 0);
  g.rows(232, end1 - 20); g.sprinkle(240, end1 - 30, ORN);
  // Cherry trees ring the Tidal Basin, then fill the rest of Campaign 2.
  for (let i = 0; i < 9; i++) g.add('C', 166 - (i % 2) * 6, tb + 20 + i * (tbh / 9), 0.7, 2, 30);
  g.rows(y2 + 124, end2 - 20, 'C'); g.sprinkle(y2 + 130, end2 - 30, CHERRY, 11);
  g.rows(y3 + 124, b3 + 100); g.rows(b3 + 300, H - 10); g.sprinkle(y3 + 130, b3 + 90, ORN, 23);

  const lawns = [0.16, 0.44, 0.7, 0.9].map((f, i) => `<ellipse cx="${i % 2 ? 320 : 70}" cy="${Math.round(H * f)}" rx="150" ry="240" fill="#cfe1c1" opacity="0.5"/>`).join('');
  const crossings = [[st17, 1], [ind, 1], [st14, 2], [st7, 3], [st3, 3]].map(([y, z]) => {
    const pts = samples(zones[z - 1].walk); let best = pts[0];
    for (const p of pts) if (Math.abs(p[1] - (y + 8)) < Math.abs(best[1] - (y + 8))) best = p;
    return crosswalk(Math.round(best[0]), y);
  }).join('');
  const ground = [`<rect width="${W}" height="${H}" fill="url(#mLawn)"/>`, lawns, terraces, ...body, ...zones.map((z) => walkPath(z.walk, z.material)), crossings, use(g.items), ...top].join('\n');
  cached = { H, zones, spots, ground, defs: PATTERNS + SYMBOLS, captions, marks, sides };
  return cached;
}
/** The campaign a point of the stage belongs to. */
export const zoneAt = (y: number) => road().zones.find((z) => y < z.y1) ?? road().zones[2];
export const campaignTitle = (n: number) => CAMPAIGNS[n - 1].title;

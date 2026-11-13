import { useId, useMemo } from 'react';
import { LevelIcon } from './icons';
import type { IconId } from './levels';

// The seal a finished mission earns, like the one on a certificate: a scalloped rosette in the
// mission's difficulty color (or gold, for the grand seal of all 21), its icon in the middle on an
// engraved disc, "MISSION 2.4 · COMPLETE" around the rim, the stars earned below, and two ribbon
// tails. It lands like a stamp (not for people who ask for less motion). Decorative: the card
// around it says the same in words.

const C = 100; // the middle of the 200 × 236 drawing

/** The scalloped edge: a circle with 28 bumps. */
function scallop(r: number, bump: number, n = 28) {
  let d = '';
  for (let i = 0; i <= 360; i++) {
    const t = (i / 360) * Math.PI * 2;
    const rr = r + bump * Math.cos(n * t);
    d += (i ? 'L' : 'M') + (C + rr * Math.sin(t)).toFixed(2) + ',' + (C - rr * Math.cos(t)).toFixed(2);
  }
  return d + 'Z';
}

/** Engraving: a hypotrochoid rosette, as on a banknote. */
function rosette(R: number, r: number, d: number, turns: number) {
  let s = '';
  const steps = 900;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    const x = C + (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = C + (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    s += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
  }
  return s;
}

const STAR = 'M0 -7 L2 -2.2 L7 -2.2 L3 1 L4.4 6.2 L0 3.2 L-4.4 6.2 L-3 1 L-7 -2.2 L-2 -2.2 Z';

export function Seal({ icon, ring, stars, diff, grand = false, size = 132 }: {
  icon: IconId;
  /** The words around the rim, e.g. "MISSION 2.4 · COMPLETE". */
  ring: string;
  /** Stars earned (0–3); left out on the grand seal. */
  stars?: number;
  /** The mission's difficulty, for its color: easy, medium, hard, super. */
  diff?: string;
  grand?: boolean;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const engraving = useMemo(() => [rosette(46, 4.6, 10.5, 10), rosette(34, 3.4, 8, 8)], []);
  // The rim, the way seals are lettered: the first part along the top arc and the rest along the
  // bottom arc, both upright and reading left to right ("MISSION 2.4" over, "COMPLETE" under).
  const [top, ...rest] = ring.split(' · ');
  const bottom = rest.join(' · ');
  // Squeeze a long line to fit its half of the ring (about 8.3 units a character at this size).
  const fit = (text: string, arc: number) => (text.length * 8.3 > arc ? { textLength: arc, lengthAdjust: 'spacingAndGlyphs' as const } : {});
  return (
    <span className={'seal' + (grand ? ' seal-grand' : '')} data-diff={grand ? undefined : diff} aria-hidden="true">
      <svg className="seal-svg" width={size} height={size * 1.18} viewBox="0 0 200 236" focusable="false">
        <defs>
          {/* the top arc runs left to right over the top; the bottom arc left to right under the
              bottom, a little wider, so its letters stand upright in the same band */}
          <path id={`rimt${uid}`} d={`M${C - 62} ${C} A62 62 0 0 1 ${C + 62} ${C}`} />
          <path id={`rimb${uid}`} d={`M${C - 71} ${C} A71 71 0 0 0 ${C + 71} ${C}`} />
          <linearGradient id={`shine${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`clip${uid}`}><path d={scallop(90, 5)} /></clipPath>
        </defs>
        {/* the ribbon tails, behind */}
        <path className="seal-ribbon" d="M62 150 L44 232 L66 216 L80 236 L96 164 Z" />
        <path className="seal-ribbon seal-ribbon-b" d="M138 150 L156 232 L134 216 L120 236 L104 164 Z" />
        {/* the rosette */}
        <path className="seal-edge" d={scallop(90, 5)} />
        <circle className="seal-ring" cx={C} cy={C} r="78" />
        <text className="seal-rim" textAnchor="middle"><textPath href={`#rimt${uid}`} startOffset="50%" {...fit(top, Math.PI * 62 - 24)}>{top}</textPath></text>
        {bottom && <text className="seal-rim" textAnchor="middle"><textPath href={`#rimb${uid}`} startOffset="50%" {...fit(bottom, Math.PI * 71 - 30)}>{bottom}</textPath></text>}
        {bottom && <g className="seal-rim-dots"><circle cx={C - 66} cy={C} r="2.2" /><circle cx={C + 66} cy={C} r="2.2" /></g>}
        <circle className="seal-ring" cx={C} cy={C} r="52" />
        <circle className="seal-disc" cx={C} cy={C} r="50" />
        <g className="seal-engrave">{engraving.map((d, i) => <path key={i} d={d} />)}</g>
        <g className="seal-icon" transform={`translate(${C - 22} ${grand ? C - 26 : C - 30})`}><LevelIcon id={icon} size={44} /></g>
        {stars != null && (
          <g className="seal-stars">
            {[0, 1, 2].map((k) => <path key={k} d={STAR} transform={`translate(${C - 18 + k * 18} ${C + 28 - (k === 1 ? 3 : 0)})`} data-on={k < stars || undefined} />)}
          </g>
        )}
        {grand && <path className="seal-stars-grand" d={STAR} transform={`translate(${C} ${C + 30}) scale(1.4)`} />}
        {/* a glint that crosses the seal once it has landed */}
        <g clipPath={`url(#clip${uid})`}><rect className="seal-shine" x="-120" y="-20" width="200" height="240" fill={`url(#shine${uid})`} /></g>
      </svg>
    </span>
  );
}

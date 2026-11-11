import { type CSSProperties, useId } from 'react';
import { LandmarkArt, Tree } from './art';
import { isComplete, isOpen, LANDMARK_BY_ID, LANDMARKS, type LandmarkId, nextTask, partStates } from './landmarks';

// The whole Mall, as the player has built it, seen from the west, high over the Potomac: the
// Lincoln Memorial up close, the Reflecting Pool running east to the Washington Monument, the
// White House and the Treasury to the north (left), the Jefferson Memorial across the Tidal Basin
// to the south (right), and the Capitol on its hill at the far end. A landmark's unbuilt pieces
// are blueprints; the one being worked on has a crane. Each landmark is a link to its site.

const W = 1600, H = 900, HORIZON = 318;
/** Where each landmark stands in the view, and how large: x, the ground line's y, the scale. The
 *  view looks northeast from over the Potomac, so the Mall runs from the lower left (the Lincoln
 *  Memorial) to the upper right (the Capitol), north is up and to the left (the White House and
 *  the Treasury) and south down and to the right (the Jefferson Memorial on the Tidal Basin).
 *  Smaller buildings are drawn a little larger than true, so they read at this distance. */
const SPOT: Record<LandmarkId, [number, number, number]> = {
  capitol: [1268, 396, 0.36],
  treasury: [672, 404, 0.28],
  whitehouse: [512, 446, 0.36],
  monument: [800, 532, 0.54],
  jefferson: [1086, 676, 0.42],
  lincoln: [262, 806, 0.72],
};
/** The soft shadow under each, in its own units. */
const SHADOW: Record<LandmarkId, number> = { capitol: 380, treasury: 320, whitehouse: 200, monument: 70, jefferson: 230, lincoln: 175 };
/** The tap area around each, in the view's units: left, top, width, height. */
const HIT: Record<LandmarkId, [number, number, number, number]> = {
  capitol: [1120, 250, 300, 160], treasury: [585, 355, 175, 60], whitehouse: [440, 380, 150, 75],
  monument: [760, 210, 80, 330], jefferson: [990, 560, 200, 125], lincoln: [130, 680, 270, 135],
};
/** A small sign above each: its name and how far along it is. */
const SIGN: Record<LandmarkId, [number, number]> = {
  capitol: [1268, 238], treasury: [672, 340], whitehouse: [512, 380], monument: [800, 196], jefferson: [1086, 562], lincoln: [262, 670],
};

export function MallView({ built, decor, focus, onPick, tabbable = true }: { built: string[]; decor: string[]; focus?: LandmarkId | null; onPick?: (id: LandmarkId) => void; tabbable?: boolean }) {
  const uid = useId().replace(/:/g, '');
  const art = (id: LandmarkId) => {
    const l = LANDMARK_BY_ID[id];
    const [x, y, s] = SPOT[id];
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`} className="bm-spot" data-landmark={id} data-done={isComplete(l, built) || undefined}>
        <ellipse cx="0" cy="2" rx={SHADOW[id]} ry={SHADOW[id] * 0.12} className="bm-shadow" />
        <LandmarkArt id={id} parts={partStates(l, built)} decor={decor.includes(l.decor.id)} site={false} />
      </g>
    );
  };
  // The Reflecting Pool is drawn on its own, between the memorial and the monument.
  const pool = partStates(LANDMARK_BY_ID.lincoln, built).pool;
  const sign = (id: LandmarkId) => {
    const l = LANDMARK_BY_ID[id];
    const [x, y] = SIGN[id];
    const open = isOpen(l, built), fin = isComplete(l, built);
    const n = l.tasks.filter((t) => built.includes(t.id)).length;
    const text = fin ? `${l.short} ✓` : open ? `${l.short} · ${n}/${l.tasks.length}` : l.short;
    const w = text.length * 8.6 + 28;
    return (
      <g className="bm-sign" data-state={fin ? 'done' : open ? 'open' : 'locked'} data-focus={focus === id || undefined} transform={`translate(${x} ${y})`}>
        <rect x={-w / 2} y="-15" width={w} height="30" rx="15" />
        <text x="0" y="5.5" textAnchor="middle">{text}</text>
        {!open && <path d="M-4 -4 h8 v7 h-8 z M-2.6 -4 v-2.4 a2.6 2.6 0 0 1 5.2 0 v2.4" transform={`translate(${-w / 2 + 14} 0)`} className="bm-sign-lock" />}
      </g>
    );
  };
  const current = LANDMARKS.find((l) => isOpen(l, built) && !isComplete(l, built));
  const crane = current && (() => {
    const [x, y, s] = SPOT[current.id];
    const t = nextTask(current, built);
    if (!t) return null;
    const h = Math.max(70, 200 * s + 40);
    return (
      <g className="bm-mallcrane" transform={`translate(${x + 120 * s + 30} ${y})`} aria-hidden="true">
        <rect x="-3" y={-h} width="6" height={h} className="bm-crane-mast" />
        <rect x={-70} y={-h - 5} width="96" height="5" className="bm-crane-mast" />
        <rect x="10" y={-h - 3} width="14" height="9" className="bm-crane-dark" />
        <line x1="-56" x2="-56" y1={-h} y2={-h + 36} className="bm-cable" />
        <rect x="-62" y={-h + 36} width="12" height="8" className="bm-crane-dark bm-mallcrane-load" />
      </g>
    );
  })();
  const link = (id: LandmarkId) => {
    const [x, y, w, h] = HIT[id];
    const l = LANDMARK_BY_ID[id];
    const open = isOpen(l, built), fin = isComplete(l, built);
    const n = l.tasks.filter((t) => built.includes(t.id)).length;
    return (
      <a key={id} href={'#mall-' + id} tabIndex={tabbable ? undefined : -1} aria-label={`${l.name}: ${fin ? 'finished' : open ? `${n} of ${l.tasks.length} pieces built` : 'opens later'}`} onClick={(e) => { if (onPick) { e.preventDefault(); onPick(id); } }} className="bm-hit">
        <rect x={x} y={y} width={w} height={h} rx="10" />
      </a>
    );
  };
  return (
    <svg className="bm bm-mall-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="group" aria-label="The National Mall, as you have built it">
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2={HORIZON} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--bm-sky-0)' }} /><stop offset="0.75" style={{ stopColor: 'var(--bm-sky-1)' }} /><stop offset="1" style={{ stopColor: 'var(--bm-sky-2)' }} />
        </linearGradient>
        <linearGradient id="bm-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: 'var(--bm-water-0)' }} /><stop offset="1" style={{ stopColor: 'var(--bm-water-1)' }} /></linearGradient>
        <linearGradient id={`ground${uid}`} x1="0" y1={HORIZON} x2="0" y2={H} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--bm-lawn-far)' }} /><stop offset="1" style={{ stopColor: 'var(--bm-lawn)' }} />
        </linearGradient>
      </defs>
      <rect width={W} height={HORIZON + 2} fill={`url(#sky${uid})`} />
      <g className="bm-mall-clouds">
        {[[180, 110, 1.1, 190], [640, 70, 0.8, 240], [1180, 140, 1.2, 170], [1460, 60, 0.7, 260]].map(([x, y, s, d], i) => (
          <g key={i} className="ms-drift" style={{ '--x': `${x}px`, animationDuration: `${d}s`, animationDelay: `${-((x + 300) / 2200) * d}s` } as CSSProperties}>
            <g transform={`translate(0 ${y}) scale(${s})`} className="bm-cloud"><ellipse cx="0" cy="0" rx="70" ry="20" /><ellipse cx="-34" cy="-8" rx="34" ry="20" /><ellipse cx="18" cy="-16" rx="42" ry="26" /><ellipse cx="54" cy="-4" rx="28" ry="16" /></g>
          </g>
        ))}
      </g>
      {/* the city to the east, hazy, and the ground running to the horizon */}
      <path className="bm-city" d={`M0 ${HORIZON} L0 300 L60 300 L60 288 L130 288 L130 302 L210 302 L210 292 L300 292 L300 306 L420 306 L420 296 L520 296 L520 304 L640 304 L640 298 L700 298 L700 ${HORIZON} Z M900 ${HORIZON} L900 300 L980 300 L980 290 L1080 290 L1080 304 L1180 304 L1180 294 L1290 294 L1290 302 L1400 302 L1400 290 L1500 290 L1500 300 L1600 300 L1600 ${HORIZON} Z`} />
      <rect y={HORIZON} width={W} height={H - HORIZON} fill={`url(#ground${uid})`} />
      {/* the Potomac, below the Lincoln Memorial, and the Washington Channel to the southeast */}
      <path className="bm-river" d="M0 700 C90 720 190 790 300 840 C360 868 420 886 470 900 L0 900 Z" />
      <path className="bm-river" d="M1600 620 C1480 660 1380 740 1290 800 C1220 846 1160 876 1110 900 L1600 900 Z" />
      {/* Capitol Hill */}
      <path className="bm-hill" d="M1060 402 Q1268 350 1470 402 Z" />
      {art('capitol')}
      {/* the Mall: a long lawn from the monument to the Capitol, gravel paths, rows of elms, and
          the museums along both sides */}
      <path className="bm-museums" d="M852 452 L1150 360 L1170 366 L1170 356 L1190 352 L1196 360 L880 470 Z M992 548 L1250 414 L1262 420 L1262 408 L1290 404 L1290 418 L1010 560 Z" />
      <path className="bm-malllawn" d="M866 476 L1182 372 L1244 398 L972 540 Z" />
      <path className="bm-mallpath" d="M884 476 L1186 378 L1194 382 L898 484 Z M950 528 L1226 396 L1234 400 L962 536 Z" />
      {[...Array(10)].map((_, i) => {
        const t = i / 9, r = 13 - t * 7;
        return <g key={i}><Tree x={872 + t * 300} y={474 - t * 100} r={r} unit={false} /><Tree x={976 + t * 262} y={544 - t * 142} r={r} unit={false} /></g>;
      })}
      {art('treasury')}
      {/* the Ellipse, south of the White House */}
      <ellipse cx="626" cy="486" rx="92" ry="18" className="bm-ellipse" />
      {art('whitehouse')}
      {/* the monument's grounds */}
      <ellipse cx="800" cy="536" rx="140" ry="26" className="bm-lawn-hi" />
      {art('monument')}
      {/* the World War II Memorial's fountain, between the monument and the pool */}
      <ellipse cx="690" cy="580" rx="44" ry="10" className="bm-pool-rim" /><ellipse cx="690" cy="580" rx="38" ry="7.5" className="bm-water" />
      {/* the Tidal Basin, with the cherry trees once they're planted */}
      <ellipse cx="948" cy="628" rx="150" ry="36" className="bm-pool-rim" /><ellipse cx="948" cy="628" rx="142" ry="31" className="bm-basin" />
      {decor.includes('jefferson:blossoms') && <g className="bm-part bm-decor" data-part="decor-mall" data-state="built">{[[812, 618], [846, 652], [900, 664], [1000, 600], [1056, 606], [1100, 630], [880, 598]].map(([x, y], i) => <Tree key={x} x={x} y={y} r={10 + (i % 3) * 2} blossom />)}</g>}
      {art('jefferson')}
      {/* the Reflecting Pool, from the memorial to the fountain */}
      <g className="bm-part" data-part="pool" data-state={pool}>
        <path d="M400 676 L652 556 L674 592 L432 734 Z" className="bm-pool-rim" />
        <path d="M408 680 L652 563 L668 588 L430 726 Z" className="bm-water" />
        <path d="M520 650 L640 576 L650 590 L534 664 Z" className="bm-reflect" />
        <g className="bm-shimmer"><line x1="450" x2="500" y1="690" y2="664" /><line x1="560" x2="610" y1="630" y2="604" /><line x1="500" x2="540" y1="700" y2="680" /></g>
      </g>
      {/* Constitution Gardens and the trees by the pool */}
      {[[420, 620, 16], [480, 596, 14], [560, 560, 13], [600, 660, 18], [520, 720, 22], [700, 640, 18], [360, 600, 18], [760, 690, 22]].map(([x, y, r]) => <Tree key={`${x}-${y}`} x={x} y={y} r={r} unit={false} />)}
      {art('lincoln')}
      {[[470, 880, 40], [80, 640, 30], [1230, 760, 34], [1380, 700, 30], [700, 880, 44], [900, 850, 40]].map(([x, y, r]) => <Tree key={`${x}-${y}`} x={x} y={y} r={r} unit={false} />)}
      {crane}
      {LANDMARKS.map((l) => <g key={l.id}>{sign(l.id)}</g>)}
      {LANDMARKS.map((l) => link(l.id))}
    </svg>
  );
}

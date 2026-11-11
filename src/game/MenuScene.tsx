import { type CSSProperties, useEffect, useRef } from 'react';
import { currentLandmark, isComplete, LANDMARK_BY_ID } from './build/landmarks';
import { useJourney } from './state';

// The main menu's backdrop: the National Mall, drawn for this game. The Washington Monument (with
// its ring of flags), the Capitol, and the Capitol Reflecting Pool. In the light theme it's a
// golden morning, the sun rising behind the dome; in the dark theme, a floodlit night with stars.
// It moves gently (clouds drift, birds cross, flags wave, the pool shimmers, people stroll) and
// shifts a few pixels with the pointer, so the menu feels like a place. All of it is CSS on
// transforms and opacity; it stops when the tab is hidden, when the scene is off screen, and for
// people who ask for less motion. Colors are tokens in app.css (.ms-*), redefined for dark mode.
// The two landmarks are the player's own (Build the Mall): one not yet finished is drawn as a pale
// blueprint, with a crane beside it while it's the one going up.

const W = 1600, GROUND = 700;

// A cloud: overlapping puffs.
// It drifts across the sky; `x` is where it sits when nothing moves, and where its drift starts.
function Cloud({ x, y, s = 1, d }: { x: number; y: number; s?: number; d: number }) {
  return (
    <g className="ms-drift" style={{ '--x': `${x}px`, animationDuration: `${d}s`, animationDelay: `${-((x + 300) / 2200) * d}s` } as CSSProperties}>
      <g transform={`translate(0 ${y}) scale(${s})`}>
        <ellipse cx="0" cy="0" rx="70" ry="22" className="ms-cloud" />
        <ellipse cx="-38" cy="-8" rx="36" ry="22" className="ms-cloud" />
        <ellipse cx="18" cy="-18" rx="44" ry="28" className="ms-cloud" />
        <ellipse cx="56" cy="-4" rx="30" ry="18" className="ms-cloud" />
        <ellipse cx="0" cy="8" rx="78" ry="12" className="ms-cloud-shade" />
      </g>
    </g>
  );
}

// A round tree: a trunk and two or three canopy puffs; some sway.
function Tree({ x, h, w, cls = 'ms-mid', sway }: { x: number; h: number; w: number; cls?: string; sway?: number }) {
  const top = GROUND + 22 - h;
  return (
    <g className={sway ? 'ms-sway' : undefined} style={sway ? ({ transformOrigin: `${x}px ${GROUND + 22}px`, animationDelay: `${-sway}s` } as CSSProperties) : undefined}>
      <rect x={x - 3} y={top + h * 0.55} width="6" height={h * 0.45} className={cls} />
      <ellipse cx={x} cy={top + h * 0.38} rx={w / 2} ry={h * 0.36} className={cls} />
      <ellipse cx={x - w * 0.28} cy={top + h * 0.55} rx={w * 0.34} ry={h * 0.24} className={cls} />
      <ellipse cx={x + w * 0.3} cy={top + h * 0.52} rx={w * 0.32} ry={h * 0.26} className={cls} />
    </g>
  );
}

// The Capitol, centered on cx: wings, porticos, the drum, the dome, the lantern and statue.
function Capitol({ cx }: { cx: number }) {
  const g = GROUND;
  const cols = (x0: number, x1: number, y0: number, y1: number, step: number) => {
    const out = [];
    for (let x = x0; x <= x1 + 0.1; x += step) out.push(<line key={x} x1={x} x2={x} y1={y0} y2={y1} />);
    return out;
  };
  const windows = (x0: number, x1: number, y: number, step: number) => {
    const out = [];
    for (let x = x0; x <= x1 + 0.1; x += step) out.push(<rect key={`${x}-${y}`} x={x} y={y} width="5" height="9" rx="1" />);
    return out;
  };
  const L = cx - 250, R = cx + 250;
  return (
    <g className="ms-capitol">
      {/* flags over the two wings */}
      <g className="ms-pole"><line x1={L + 75} x2={L + 75} y1={g - 78} y2={g - 112} /><line x1={R - 75} x2={R - 75} y1={g - 78} y2={g - 112} /></g>
      <g className="ms-flag" style={{ transformOrigin: `${L + 75}px ${g - 108}px` } as CSSProperties}><rect x={L + 75} y={g - 112} width="16" height="10" className="ms-flag-red" /><rect x={L + 75} y={g - 112} width="7" height="5" className="ms-flag-blue" /></g>
      <g className="ms-flag" style={{ transformOrigin: `${R - 75}px ${g - 108}px`, animationDelay: '-0.7s' } as CSSProperties}><rect x={R - 75} y={g - 112} width="16" height="10" className="ms-flag-red" /><rect x={R - 75} y={g - 112} width="7" height="5" className="ms-flag-blue" /></g>
      {/* the plinth and the wings */}
      <rect x={L - 10} y={g - 20} width={R - L + 20} height="20" className="ms-wall-shade" />
      <rect x={L} y={g - 78} width={cx - 90 - L} height="58" className="ms-wall" />
      <rect x={cx + 90} y={g - 78} width={R - cx - 90} height="58" className="ms-wall" />
      {/* end pavilions */}
      <rect x={L} y={g - 86} width="46" height="66" className="ms-wall" />
      <rect x={R - 46} y={g - 86} width="46" height="66" className="ms-wall" />
      {/* wing porticos with pediments */}
      <path d={`M${L + 50} ${g - 78} L${L + 100} ${g - 96} L${L + 150} ${g - 78} Z`} className="ms-wall" />
      <path d={`M${R - 150} ${g - 78} L${R - 100} ${g - 96} L${R - 50} ${g - 78} Z`} className="ms-wall" />
      {/* the central block, its portico and pediment */}
      <rect x={cx - 90} y={g - 100} width="180" height="80" className="ms-wall" />
      <path d={`M${cx - 62} ${g - 100} L${cx} ${g - 128} L${cx + 62} ${g - 100} Z`} className="ms-wall" />
      <rect x={cx - 62} y={g - 100} width="124" height="6" className="ms-wall-shade" />
      {/* shade on the right of each mass, for volume */}
      <rect x={R - 46} y={g - 86} width="46" height="66" className="ms-wall-side" />
      <rect x={cx + 60} y={g - 100} width="30" height="80" className="ms-wall-side" />
      <g className="ms-cols">
        {cols(cx - 56, cx + 56, g - 94, g - 22, 14)}
        {cols(L + 56, L + 144, g - 76, g - 22, 11)}
        {cols(R - 144, R - 56, g - 76, g - 22, 11)}
      </g>
      <g className="ms-windows">
        {windows(L + 8, L + 36, g - 70, 14)}{windows(L + 8, L + 36, g - 48, 14)}
        {windows(L + 156, cx - 100, g - 68, 15)}{windows(L + 156, cx - 100, g - 46, 15)}
        {windows(cx + 98, R - 160, g - 68, 15)}{windows(cx + 98, R - 160, g - 46, 15)}
        {windows(R - 40, R - 12, g - 70, 14)}{windows(R - 40, R - 12, g - 48, 14)}
      </g>
      {/* the drum: a colonnade, then the attic */}
      <rect x={cx - 62} y={g - 158} width="124" height="58" className="ms-wall" />
      <rect x={cx + 36} y={g - 158} width="26" height="58" className="ms-wall-side" />
      <g className="ms-cols">{cols(cx - 56, cx + 56, g - 154, g - 104, 8)}</g>
      <rect x={cx - 66} y={g - 162} width="132" height="6" className="ms-wall-shade" />
      <rect x={cx - 50} y={g - 184} width="100" height="22" className="ms-wall" />
      <g className="ms-windows">{windows(cx - 44, cx + 40, g - 178, 12)}</g>
      {/* the dome, with ribs and a rim of light */}
      <path d={`M${cx - 50} ${g - 184} C${cx - 50} ${g - 238}, ${cx - 26} ${g - 266}, ${cx} ${g - 270} C${cx + 26} ${g - 266}, ${cx + 50} ${g - 238}, ${cx + 50} ${g - 184} Z`} className="ms-dome" />
      <path d={`M${cx + 6} ${g - 269} C${cx + 30} ${g - 262}, ${cx + 50} ${g - 236}, ${cx + 50} ${g - 184} L${cx + 22} ${g - 184} C${cx + 22} ${g - 232}, ${cx + 14} ${g - 258}, ${cx + 6} ${g - 269} Z`} className="ms-dome-side" />
      <g className="ms-ribs">
        <path d={`M${cx - 30} ${g - 184} C${cx - 30} ${g - 230}, ${cx - 16} ${g - 258}, ${cx} ${g - 268}`} />
        <path d={`M${cx - 10} ${g - 184} C${cx - 10} ${g - 232}, ${cx - 5} ${g - 260}, ${cx} ${g - 268}`} />
        <path d={`M${cx + 10} ${g - 184} C${cx + 10} ${g - 232}, ${cx + 5} ${g - 260}, ${cx} ${g - 268}`} />
        <path d={`M${cx + 30} ${g - 184} C${cx + 30} ${g - 230}, ${cx + 16} ${g - 258}, ${cx} ${g - 268}`} />
        <path d={`M${cx - 47} ${g - 210} C${cx - 20} ${g - 216}, ${cx + 20} ${g - 216}, ${cx + 47} ${g - 210}`} />
      </g>
      <path d={`M${cx - 50} ${g - 184} C${cx - 50} ${g - 238}, ${cx - 26} ${g - 266}, ${cx} ${g - 270} C${cx + 26} ${g - 266}, ${cx + 50} ${g - 238}, ${cx + 50} ${g - 184}`} className="ms-rim" />
      {/* the lantern and the statue on top */}
      <rect x={cx - 9} y={g - 296} width="18" height="28" className="ms-wall" />
      <g className="ms-cols">{cols(cx - 6, cx + 6, g - 292, g - 272, 4)}</g>
      <path d={`M${cx - 12} ${g - 296} Q${cx} ${g - 306} ${cx + 12} ${g - 296} Z`} className="ms-dome" />
      <path d={`M${cx - 3} ${g - 304} L${cx - 4} ${g - 318} L${cx} ${g - 326} L${cx + 4} ${g - 318} L${cx + 3} ${g - 304} Z`} className="ms-wall-shade" />
    </g>
  );
}

// The Washington Monument, with the ring of flags at its base.
function Monument({ x }: { x: number }) {
  const g = GROUND, top = 248, half = 22, shoulder = 282;
  const flags = [];
  for (let i = -4; i <= 4; i++) {
    const fx = x + i * 15;
    flags.push(
      <g key={i}>
        <line x1={fx} x2={fx} y1={g - 4} y2={g - 34} className="ms-pole-line" />
        <g className="ms-flag" style={{ transformOrigin: `${fx}px ${g - 31}px`, animationDelay: `${-(i + 4) * 0.23}s` } as CSSProperties}>
          <rect x={fx} y={g - 34} width="10" height="6" className="ms-flag-red" />
          <rect x={fx} y={g - 34} width="4" height="3" className="ms-flag-blue" />
        </g>
      </g>,
    );
  }
  return (
    <g className="ms-monument">
      <path d={`M${x - half} ${g} L${x - half + 5} ${shoulder} L${x} ${top} L${x} ${g} Z`} className="ms-obelisk" />
      <path d={`M${x} ${g} L${x} ${top} L${x + half - 5} ${shoulder} L${x + half} ${g} Z`} className="ms-obelisk-side" />
      {/* the change in the marble's color, a third of the way up */}
      <path d={`M${x - half + 1.6} ${g - 150} L${x + half - 1.6} ${g - 150}`} className="ms-obelisk-line" />
      <rect x={x - 70} y={g - 4} width="140" height="6" rx="3" className="ms-wall-shade" />
      {flags}
    </g>
  );
}

// People strolling on the path, at different speeds.
function Walker({ x, y, s, d, flip }: { x: number; y: number; s: number; d: number; flip?: boolean }) {
  const from = flip ? (W + 60 - x) / (W + 120) : (x + 60) / (W + 120);
  return (
    <g className={'ms-walker' + (flip ? ' ms-walker-back' : '')} style={{ '--x': `${x}px`, animationDuration: `${d}s`, animationDelay: `${-from * d}s` } as CSSProperties}>
      <g transform={`translate(0 ${y}) scale(${s})`} className="ms-person">
        <circle cx="0" cy="-27" r="4.2" />
        <path d="M-4.5 -21 h9 l1.5 12 h-12 z" />
        <g className="ms-step"><path d="M-3 -9 l-2 9 h2.4 l1.6 -9 z" /><path d="M3 -9 l2 9 h-2.4 l-1.6 -9 z" /></g>
      </g>
    </g>
  );
}

/** A small crane beside a landmark that is going up. */
function Crane({ x, h }: { x: number; h: number }) {
  const g = GROUND;
  return (
    <g className="ms-crane">
      <rect x={x - 3} y={g - h} width="6" height={h} />
      <rect x={x - 84} y={g - h - 5} width="112" height="5" />
      <rect x={x + 12} y={g - h - 3} width="14" height="10" className="ms-crane-dark" />
      <line x1={x - 66} x2={x - 66} y1={g - h} y2={g - h + 54} className="ms-crane-cable" />
      <rect x={x - 72} y={g - h + 54} width="12" height="9" className="ms-crane-dark ms-crane-load" />
    </g>
  );
}

export function MenuScene() {
  const ref = useRef<HTMLDivElement>(null);
  const built = useJourney().built ?? [];
  const wm = isComplete(LANDMARK_BY_ID.monument, built), cap = isComplete(LANDMARK_BY_ID.capitol, built);
  const cur = currentLandmark(built)?.id;
  // Stop moving when nobody can see it; follow the pointer a little.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (k: string, on: boolean) => el.toggleAttribute(k, on);
    const vis = () => set('data-paused', document.hidden);
    document.addEventListener('visibilitychange', vis);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => set('data-offscreen', !e.isIntersecting)) : null;
    io?.observe(el);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, px = 0, py = 0;
    const move = (e: PointerEvent) => {
      if (still || e.pointerType === 'touch') return;
      px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; el.style.setProperty('--px', px.toFixed(3)); el.style.setProperty('--py', py.toFixed(3)); });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { document.removeEventListener('visibilitychange', vis); io?.disconnect(); window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  const stars = [[120, 90, 1.4], [260, 160, 1], [380, 60, 1.6], [520, 130, 1], [700, 70, 1.3], [860, 150, 1], [940, 50, 1.5], [1120, 110, 1], [1260, 60, 1.2], [1420, 140, 1.5], [1540, 70, 1], [180, 240, 1], [460, 220, 1.2], [780, 250, 1], [1180, 230, 1.1], [1500, 260, 1]];
  return (
    <div className="menu-scene" ref={ref} aria-hidden="true">
      <svg viewBox={`0 0 ${W} 900`} preserveAspectRatio="xMidYMax slice" className="menu-scene-svg" focusable="false">
        <defs>
          <linearGradient id="ms-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ms-s1" /><stop offset="0.5" className="ms-s2" /><stop offset="0.74" className="ms-s3" /><stop offset="0.8" className="ms-s4" />
          </linearGradient>
          <radialGradient id="ms-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" className="ms-glow-0" /><stop offset="0.35" className="ms-glow-1" /><stop offset="1" className="ms-glow-2" />
          </radialGradient>
          <linearGradient id="ms-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ms-s4" /><stop offset="1" className="ms-s2" />
          </linearGradient>
          <linearGradient id="ms-lawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className="ms-lawn-0" /><stop offset="1" className="ms-lawn-1" />
          </linearGradient>
        </defs>
        <rect width={W} height="900" fill="url(#ms-sky)" />
        <g className="ms-stars">{stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} style={{ animationDelay: `${-i * 0.7}s` } as CSSProperties} />)}</g>
        <g className="ms-moon"><circle cx="1360" cy="150" r="26" /><circle cx="1372" cy="142" r="24" className="ms-moon-cut" /></g>
        {/* the sun (or the city's glow), behind the dome */}
        <g className="ms-sun"><circle cx="1000" cy="430" r="330" fill="url(#ms-glow)" className="ms-sun-glow" /><circle cx="1000" cy="456" r="44" className="ms-sun-core" /></g>
        <g className="ms-par ms-par-sky">
          <Cloud x={160} y={170} s={1.1} d={210} />
          <Cloud x={640} y={110} s={0.8} d={260} />
          <Cloud x={1180} y={210} s={1.25} d={180} />
          <Cloud x={1480} y={90} s={0.7} d={300} />
        </g>
        <g className="ms-birds">
          {[[0, 0, 1], [26, 10, 0.8], [-22, 14, 0.9], [48, 22, 0.7], [10, 28, 0.75]].map(([dx, dy, s], i) => (
            <g key={i} transform={`translate(${dx} ${dy}) scale(${s})`}><path className="ms-bird" style={{ animationDelay: `${-i * 0.13}s` } as CSSProperties} d="M-8 0 Q-4 -5 0 0 Q4 -5 8 0" /></g>
          ))}
        </g>
        {/* the far tree line, hazy */}
        <path className="ms-far ms-par ms-par-far" d={`M-40 ${GROUND + 4} L-40 662 Q20 640 70 655 Q120 632 180 650 Q240 628 300 646 Q350 630 410 648 Q470 634 520 652 L520 ${GROUND + 4} Z M1290 ${GROUND + 4} L1290 650 Q1340 630 1400 646 Q1460 626 1520 644 Q1580 632 1640 648 L1640 ${GROUND + 4} Z`} />
        <g className="ms-par ms-par-mid">
          <g className="ms-landmark" data-state={wm ? 'built' : 'plan'}><Monument x={640} /></g>
          <g className="ms-landmark" data-state={cap ? 'built' : 'plan'}><Capitol cx={1000} /></g>
          {cur === 'monument' && <Crane x={700} h={300} />}
          {cur === 'capitol' && <Crane x={1280} h={280} />}
        </g>
        {/* the near trees */}
        <g className="ms-par ms-par-near">
          <Tree x={60} h={120} w={110} sway={1} /><Tree x={150} h={96} w={90} sway={2.2} /><Tree x={240} h={132} w={120} sway={0.4} />
          <Tree x={330} h={90} w={86} sway={3} /><Tree x={420} h={110} w={100} sway={1.7} /><Tree x={500} h={80} w={76} />
          <Tree x={690} h={70} w={66} sway={2.6} /><Tree x={740} h={56} w={54} />
          <Tree x={1270} h={60} w={58} /><Tree x={1330} h={100} w={96} sway={0.9} /><Tree x={1420} h={128} w={116} sway={2} />
          <Tree x={1510} h={96} w={92} sway={1.3} /><Tree x={1590} h={118} w={110} sway={2.8} />
        </g>
        {/* the lawn, the reflecting pool, the path */}
        <rect x="-10" y={GROUND + 18} width={W + 20} height={900 - GROUND} fill="url(#ms-lawn)" />
        <g className="ms-pool">
          <path d={`M770 ${GROUND + 40} L1230 ${GROUND + 40} L1290 ${GROUND + 96} L710 ${GROUND + 96} Z`} fill="url(#ms-water)" />
          <path d={`M770 ${GROUND + 40} L1230 ${GROUND + 40} L1290 ${GROUND + 96} L710 ${GROUND + 96} Z`} className="ms-pool-edge" />
          {/* the dome's reflection */}
          <path className="ms-reflect" d={`M950 ${GROUND + 42} C950 ${GROUND + 62}, 974 ${GROUND + 76}, 1000 ${GROUND + 78} C1026 ${GROUND + 76}, 1050 ${GROUND + 62}, 1050 ${GROUND + 42} Z M760 ${GROUND + 42} L1240 ${GROUND + 42} L1240 ${GROUND + 54} L760 ${GROUND + 54} Z`} />
          <g className="ms-shimmer">
            <line x1="820" x2="890" y1={GROUND + 58} y2={GROUND + 58} /><line x1="1060" x2="1150" y1={GROUND + 64} y2={GROUND + 64} />
            <line x1="900" x2="960" y1={GROUND + 76} y2={GROUND + 76} /><line x1="1120" x2="1200" y1={GROUND + 84} y2={GROUND + 84} />
            <line x1="760" x2="830" y1={GROUND + 88} y2={GROUND + 88} /><line x1="980" x2="1040" y1={GROUND + 90} y2={GROUND + 90} />
          </g>
        </g>
        <path className="ms-path" d={`M-10 ${GROUND + 118} L${W + 10} ${GROUND + 118} L${W + 10} ${GROUND + 134} L-10 ${GROUND + 134} Z`} />
        <g className="ms-walkers">
          <Walker x={380} y={GROUND + 128} s={1} d={70} />
          <Walker x={1340} y={GROUND + 130} s={1.1} d={84} flip />
          <Walker x={820} y={GROUND + 127} s={0.9} d={96} />
          <Walker x={1520} y={GROUND + 129} s={1} d={90} flip />
        </g>
      </svg>
    </div>
  );
}

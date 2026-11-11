import type { CSSProperties, ReactNode } from 'react';
import type { LandmarkId, PartState } from './landmarks';

// The six landmarks, drawn for this game, each in its own frame: the ground at y = 0, the middle
// at x = 0, up is negative (about a foot to a unit, so they keep their sizes to one another). Each
// is cut into the parts its jobs build; a part is drawn built (in color), as the next job (a
// glowing blueprint), or only on the plans (a faint dashed blueprint), so the player sees what
// is coming. The same drawings are used up close and in the view of the whole Mall. Colors are
// tokens (.bm-*) in app.css, with a sunny day in the light theme and a floodlit night in the dark.

export type Parts = Record<string, PartState>;
interface ArtProps { parts: Parts; decor?: boolean; /** The part going up right now (kept on screen for its animation). */ building?: string | null; /** Draw what is around it up close (water, a lawn); off in the view of the whole Mall. */ site?: boolean }

/** One part of a drawing. Several groups may share a part (a wall and the windows drawn over its paint). */
function P({ id, parts, children, className = '' }: { id: string; parts: Parts; children: ReactNode; className?: string }) {
  return <g className={'bm-part ' + className} data-part={id} data-state={parts[id] ?? 'built'}>{children}</g>;
}
/** The decoration, once placed. */
function D({ on, children }: { on?: boolean; children: ReactNode }) {
  return on ? <g className="bm-part bm-decor" data-part="decor" data-state="built">{children}</g> : null;
}

/** A column: shaft, a lit and a shaded side, a capital and a base. Each is a unit for the animation. */
function Column({ x, top, bottom, w, kind = 'doric' }: { x: number; top: number; bottom: number; w: number; kind?: 'doric' | 'ionic' }) {
  const capH = kind === 'ionic' ? 5 : 4;
  return (
    <g className="bm-unit">
      <rect x={x - w / 2} y={top + capH} width={w} height={bottom - top - capH - 3} className="bm-col" />
      <rect x={x + w * 0.12} y={top + capH} width={w * 0.38} height={bottom - top - capH - 3} className="bm-col-side" />
      {kind === 'ionic'
        ? <><rect x={x - w / 2 - 2.5} y={top + 1.5} width={w + 5} height={3.5} className="bm-cap" /><circle cx={x - w / 2 - 1.5} cy={top + 3.2} r="2.2" className="bm-cap" /><circle cx={x + w / 2 + 1.5} cy={top + 3.2} r="2.2" className="bm-cap" /></>
        : <rect x={x - w / 2 - 2} y={top} width={w + 4} height={capH} className="bm-cap" />}
      <rect x={x - w / 2 - 1.5} y={bottom - 3} width={w + 3} height="3" className="bm-cap" />
    </g>
  );
}
const range = (a: number, b: number, step: number) => { const o: number[] = []; for (let x = a; x <= b + 0.01; x += step) o.push(Math.round(x * 100) / 100); return o; };

/** A row of windows, each with a dark pane and a light sill. */
function Windows({ xs, y, w, h, cap }: { xs: number[]; y: number; w: number; h: number; cap?: 'flat' | 'pediment' }) {
  return (
    <g className="bm-windows">
      {xs.map((x) => (
        <g key={x}>
          <rect x={x - w / 2} y={y} width={w} height={h} className="bm-pane" />
          <rect x={x - w / 2 - 1.5} y={y + h} width={w + 3} height="2" className="bm-sill" />
          {cap === 'pediment' && <path d={`M${x - w / 2 - 2} ${y - 1.5} L${x} ${y - 5.5} L${x + w / 2 + 2} ${y - 1.5} Z`} className="bm-sill" />}
          {cap === 'flat' && <rect x={x - w / 2 - 2} y={y - 3} width={w + 4} height="2" className="bm-sill" />}
        </g>
      ))}
    </g>
  );
}

/** A flag on a pole: the stripes wave. */
function Flag({ x, y, h, s = 1, delay = 0 }: { x: number; y: number; h: number; s?: number; delay?: number }) {
  return (
    <g className="bm-unit">
      <line x1={x} x2={x} y1={y} y2={y - h} className="bm-pole" />
      <g className="bm-flag" style={{ transformOrigin: `${x}px ${y - h + 4 * s}px`, animationDelay: `${-delay}s` } as CSSProperties}>
        <rect x={x} y={y - h} width={13 * s} height={8 * s} className="bm-flag-red" />
        <rect x={x} y={y - h + 2.3 * s} width={13 * s} height={1.15 * s} className="bm-flag-white" />
        <rect x={x} y={y - h + 4.6 * s} width={13 * s} height={1.15 * s} className="bm-flag-white" />
        <rect x={x} y={y - h} width={5.5 * s} height={4.4 * s} className="bm-flag-blue" />
      </g>
    </g>
  );
}

/** A round tree; `blossom` makes it a cherry tree in bloom. */
export function Tree({ x, y, r, blossom, unit = true }: { x: number; y: number; r: number; blossom?: boolean; unit?: boolean }) {
  const c = blossom ? 'bm-blossom' : 'bm-tree';
  const g = (
    <>
      <rect x={x - r * 0.1} y={y - r * 0.9} width={r * 0.2} height={r * 0.9} className="bm-trunk" />
      <circle cx={x} cy={y - r * 1.25} r={r * 0.72} className={c} />
      <circle cx={x - r * 0.48} cy={y - r * 0.95} r={r * 0.5} className={c} />
      <circle cx={x + r * 0.5} cy={y - r * 1.0} r={r * 0.52} className={c + '-side'} />
    </>
  );
  return unit ? <g className="bm-unit">{g}</g> : <g>{g}</g>;
}

// ---------- 1. The Washington Monument ----------
// 555 feet tall; the shaft is about 55 feet wide at the base and narrows as it rises.
const WM = { base: -14, top: -514, peak: -569, hw0: 27.5, hw1: 17 };
const wmHw = (y: number) => WM.hw0 - ((WM.hw0 - WM.hw1) * (WM.base - y)) / (WM.base - WM.top);
function Monument({ parts, decor }: ArtProps) {
  const cut = WM.base - 152; // where work stopped in 1854
  const ring = (front: boolean) => {
    const out: ReactNode[] = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      out.push(<Flag key={i} x={Math.cos(a) * 92} y={2 + Math.sin(a) * 11} h={40} s={0.9} delay={i * 0.21} />);
    }
    return out;
  };
  const shaft = (y0: number, y1: number, cls: string) => (
    <>
      <path d={`M${-wmHw(y0)} ${y0} L${wmHw(y0)} ${y0} L${wmHw(y1)} ${y1} L${-wmHw(y1)} ${y1} Z`} className={cls} />
      <path d={`M0 ${y0} L${wmHw(y0)} ${y0} L${wmHw(y1)} ${y1} L0 ${y1} Z`} className={cls + '-side'} />
      <g className="bm-course">{range(y1 + 20, y0 - 10, 24).map((y) => <line key={y} x1={-wmHw(y)} x2={wmHw(y)} y1={y} y2={y} />)}</g>
    </>
  );
  return (
    <g className="bm-art" data-landmark="monument">
      <P id="grounds" parts={parts}>
        <path d="M-170 6 Q-80 -10 0 -12 Q80 -10 170 6 Z" className="bm-lawn-hi" />
        <ellipse cx="0" cy="0" rx="104" ry="13" className="bm-plaza" />
        <ellipse cx="0" cy="-1" rx="72" ry="8" className="bm-plaza-in" />
      </P>
      <D on={decor}>{ring(false)}</D>
      <P id="foundation" parts={parts}>
        <rect x="-40" y="-8" width="80" height="9" className="bm-stone" />
        <rect x="-34" y="-14" width="68" height="7" className="bm-stone-hi" />
        <rect x="0" y="-14" width="34" height="7" className="bm-stone-side" />
      </P>
      <P id="shaft1" parts={parts}>{shaft(WM.base, cut, 'bm-marble')}</P>
      <P id="shaft2" parts={parts}>
        {shaft(cut, WM.top, 'bm-marble2')}
        <line x1={-wmHw(cut)} x2={wmHw(cut)} y1={cut} y2={cut} className="bm-seam" />
      </P>
      <P id="pyramidion" parts={parts}>
        <path d={`M${-WM.hw1} ${WM.top} L${WM.hw1} ${WM.top} L0 ${WM.peak + 4} Z`} className="bm-marble2" />
        <path d={`M0 ${WM.top} L${WM.hw1} ${WM.top} L0 ${WM.peak + 4} Z`} className="bm-marble2-side" />
        <rect x="-3" y={WM.top + 22} width="6" height="2.5" rx="1" className="bm-pane" />
      </P>
      <P id="apex" parts={parts}>
        <path d={`M-3.2 ${WM.peak + 5} L3.2 ${WM.peak + 5} L0 ${WM.peak - 2} Z`} className="bm-alu" />
        <g className="bm-glint"><path d={`M0 ${WM.peak - 10} L1.2 ${WM.peak - 3.5} L7 ${WM.peak - 2} L1.2 ${WM.peak - 0.5} L0 ${WM.peak + 6} L-1.2 ${WM.peak - 0.5} L-7 ${WM.peak - 2} L-1.2 ${WM.peak - 3.5} Z`} /></g>
      </P>
      <D on={decor}>{ring(true)}</D>
    </g>
  );
}

// ---------- 2. The Lincoln Memorial, from the east, with the Reflecting Pool in front ----------
const LM_COLS = [-130, -108, -86, -64, -42, -20, 20, 42, 64, 86, 108, 130];
function Lincoln({ parts, decor, site = true }: ArtProps) {
  const colTop = -104, colBot = -30;
  return (
    <g className="bm-art" data-landmark="lincoln">
      {site && (
        <P id="pool" parts={parts}>
          <path d="M-74 10 L74 10 L250 150 L-250 150 Z" className="bm-pool-rim" />
          <path d="M-66 14 L66 14 L234 146 L-234 146 Z" className="bm-water" />
          {/* the memorial in the water */}
          <path d="M-58 16 L58 16 L70 40 L-70 40 Z" className="bm-reflect" />
          <g className="bm-shimmer"><line x1="-60" x2="10" y1="60" y2="60" /><line x1="30" x2="120" y1="84" y2="84" /><line x1="-150" x2="-60" y1="112" y2="112" /><line x1="60" x2="170" y1="128" y2="128" /></g>
        </P>
      )}
      <P id="terrace" parts={parts}>
        <rect x="-160" y="-22" width="320" height="22" className="bm-stone" />
        <rect x="0" y="-22" width="160" height="22" className="bm-stone-side" />
        <rect x="-146" y="-30" width="292" height="8" className="bm-marble" />
        {/* the steps */}
        {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={-56 + k * 2} y={-22 + k * 3.6 - 0.2} width={112 - k * 4} height="2" className="bm-step" />)}
        <rect x="-60" y="-1" width="120" height="3" className="bm-step" />
      </P>
      <P id="hall" parts={parts}>
        <rect x="-120" y="-100" width="240" height="70" className="bm-recess" />
        <rect x="-26" y="-96" width="52" height="66" className="bm-recess-deep" />
      </P>
      <P id="statue" parts={parts}>
        {/* Lincoln, seated, on his pedestal, deep in the hall */}
        <rect x="-11" y="-46" width="22" height="13" className="bm-statue-shade" />
        <path d="M-9 -47 L-9 -66 Q-9 -72 -3 -73 L3 -73 Q9 -72 9 -66 L9 -47 Z" className="bm-statue" />
        <circle cx="0" cy="-77" r="4.2" className="bm-statue" />
        <rect x="-12" y="-50" width="24" height="5" rx="1.5" className="bm-statue" />
        <rect x="-13" y="-36" width="26" height="6" className="bm-statue-shade" />
      </P>
      <P id="colsA" parts={parts}>{LM_COLS.slice(0, 6).map((x) => <Column key={x} x={x} top={colTop} bottom={colBot} w={11} />)}</P>
      <P id="colsB" parts={parts}>{LM_COLS.slice(6).map((x) => <Column key={x} x={x} top={colTop} bottom={colBot} w={11} />)}</P>
      <P id="attic" parts={parts}>
        {/* the frieze over the columns (the 36 states), then the attic (the 48 states of 1922) */}
        <rect x="-146" y="-116" width="292" height="12" className="bm-marble" />
        <g className="bm-carve">{range(-138, 138, 8).map((x) => <rect key={x} x={x - 2.4} y="-112" width="4.8" height="4" />)}</g>
        <rect x="-150" y="-120" width="300" height="4" className="bm-cap" />
        <rect x="-124" y="-146" width="248" height="26" className="bm-marble" />
        <rect x="60" y="-146" width="64" height="26" className="bm-marble-side" />
        <g className="bm-carve">{range(-116, 116, 10).map((x) => <path key={x} d={`M${x - 3} -134 Q${x} -139 ${x + 3} -134`} />)}</g>
        <rect x="-128" y="-150" width="256" height="4" className="bm-cap" />
      </P>
      <D on={decor}>
        <g className="bm-unit bm-floods">
          <ellipse cx="0" cy="-70" rx="150" ry="70" className="bm-floodlight" />
          <path d="M-160 0 L-120 -100 L-100 -100 Z M160 0 L120 -100 L100 -100 Z" className="bm-beam" />
        </g>
      </D>
    </g>
  );
}

// ---------- 3. The Jefferson Memorial, from the Tidal Basin ----------
function Jefferson({ parts, decor, site = true }: ArtProps) {
  const ring = [-78, -62, -46, -30, -14, 14, 30, 46, 62, 78].map((a) => Math.sin((a * Math.PI) / 180) * 152);
  return (
    <g className="bm-art" data-landmark="jefferson">
      {site && <><rect x="-260" y="0" width="520" height="70" className="bm-basin" />
      <g className="bm-shimmer"><line x1="-200" x2="-120" y1="22" y2="22" /><line x1="-40" x2="60" y1="40" y2="40" /><line x1="110" x2="210" y1="28" y2="28" /><line x1="-150" x2="-60" y1="58" y2="58" /></g></>}
      <D on={decor}>
        {[-236, -204, -172, 172, 204, 236].map((x, i) => <Tree key={x} x={x} y={-2 + (i % 2) * 3} r={20 + (i % 3) * 3} blossom />)}
      </D>
      <P id="platform" parts={parts}>
        <rect x="-214" y="-14" width="428" height="15" className="bm-stone" />
        <rect x="-196" y="-42" width="392" height="28" className="bm-marble" />
        <rect x="70" y="-42" width="126" height="28" className="bm-marble-side" />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => <rect key={k} x={-74 + k * 1.5} y={-42 + k * 4} width={148 - k * 3} height="2.2" className="bm-step" />)}
      </P>
      <P id="dome" parts={parts}>
        <rect x="-118" y="-160" width="236" height="22" className="bm-marble" />
        <rect x="50" y="-160" width="68" height="22" className="bm-marble-side" />
        <path d="M-112 -160 C-112 -206 -56 -228 0 -230 C56 -228 112 -206 112 -160 Z" className="bm-dome" />
        <path d="M14 -229.5 C66 -224 112 -204 112 -160 L52 -160 C52 -196 34 -222 14 -229.5 Z" className="bm-dome-side" />
        <path d="M-112 -160 C-112 -206 -56 -228 0 -230 C56 -228 112 -206 112 -160" className="bm-rim" />
      </P>
      <P id="colonnade" parts={parts}>
        <rect x="-158" y="-132" width="316" height="90" className="bm-recess" />
        {ring.map((x) => <Column key={x} x={x} top={-128} bottom={-42} w={8.5} kind="ionic" />)}
        <rect x="-162" y="-138" width="324" height="10" className="bm-marble" />
        <rect x="-164" y="-140" width="328" height="3" className="bm-cap" />
      </P>
      <P id="statue" parts={parts}>
        <rect x="-8" y="-54" width="16" height="12" className="bm-stone-hi" />
        <path d="M-6 -55 L-7 -88 Q-6 -94 0 -94 Q6 -94 7 -88 L6 -55 Z" className="bm-bronze" />
        <circle cx="0" cy="-98" r="4" className="bm-bronze" />
      </P>
      <P id="portico" parts={parts}>
        {[-63, -45, -27, -9, 9, 27, 45, 63].map((x) => <Column key={x} x={x} top={-132} bottom={-42} w={10} kind="ionic" />)}
        <rect x="-76" y="-144" width="152" height="12" className="bm-marble" />
        <path d="M-82 -144 L0 -178 L82 -144 Z" className="bm-marble" />
        <path d="M0 -178 L82 -144 L0 -144 Z" className="bm-marble-side" />
        <path d="M-66 -147 L0 -172 L66 -147 Z" className="bm-pediment" />
        <rect x="-84" y="-146" width="168" height="3" className="bm-cap" />
      </P>
    </g>
  );
}

// ---------- 4. The Treasury Building, its east front on 15th Street ----------
function Treasury({ parts, decor }: ArtProps) {
  const cols = range(-180, 180, 24);
  return (
    <g className="bm-art" data-landmark="treasury">
      <P id="north" parts={parts}>
        <rect x="-292" y="-116" width="96" height="116" className="bm-granite" />
        <rect x="-236" y="-116" width="40" height="116" className="bm-granite-side" />
        <Windows xs={[-276, -256, -236, -216]} y={-100} w={9} h={16} cap="pediment" />
        <Windows xs={[-276, -256, -236, -216]} y={-64} w={9} h={18} cap="flat" />
        <Windows xs={[-276, -256, -236, -216]} y={-30} w={9} h={16} />
      </P>
      <P id="south" parts={parts}>
        <rect x="196" y="-116" width="96" height="116" className="bm-granite" />
        <rect x="252" y="-116" width="40" height="116" className="bm-granite-side" />
        <Windows xs={[216, 236, 256, 276]} y={-100} w={9} h={16} cap="pediment" />
        <Windows xs={[216, 236, 256, 276]} y={-64} w={9} h={18} cap="flat" />
        <Windows xs={[216, 236, 256, 276]} y={-30} w={9} h={16} />
      </P>
      <P id="east" parts={parts}>
        <rect x="-200" y="-110" width="400" height="110" className="bm-granite" />
        <rect x="-204" y="-14" width="408" height="14" className="bm-stone" />
        <rect x="-196" y="-104" width="392" height="84" className="bm-recess" />
        <Windows xs={range(-168, 168, 24).map((x) => x + 12).filter((x) => x < 190)} y={-92} w={8} h={14} />
        <Windows xs={range(-168, 168, 24).map((x) => x + 12).filter((x) => x < 190)} y={-62} w={8} h={16} />
        <Windows xs={range(-168, 168, 24).map((x) => x + 12).filter((x) => x < 190)} y={-36} w={8} h={12} />
      </P>
      <P id="colonnade" parts={parts}>
        {cols.map((x) => <Column key={x} x={x} top={-102} bottom={-14} w={9} kind="ionic" />)}
        <rect x="-204" y="-114" width="408" height="12" className="bm-granite" />
        <rect x="-206" y="-116" width="412" height="3" className="bm-cap" />
      </P>
      <P id="roof" parts={parts}>
        <rect x="-296" y="-126" width="592" height="10" className="bm-granite" />
        <g className="bm-balusters">{range(-290, 290, 6).map((x) => <rect key={x} x={x - 1.2} y="-134" width="2.4" height="8" />)}</g>
        <rect x="-296" y="-136" width="592" height="3" className="bm-cap" />
        <Flag x={0} y={-136} h={46} s={1.3} />
      </P>
      <D on={decor}>
        <g className="bm-unit">
          <rect x="228" y="-16" width="20" height="16" className="bm-stone-hi" />
          <path d="M232 -17 L231 -44 Q232 -49 238 -49 Q244 -49 245 -44 L244 -17 Z" className="bm-bronze" />
          <circle cx="238" cy="-53" r="4" className="bm-bronze" />
        </g>
      </D>
    </g>
  );
}

// ---------- 5. The White House, from the south ----------
function WhiteHouse({ parts, decor, building, site = true }: ArtProps) {
  const xs = [-150, -126, -102, -78, 78, 102, 126, 150];
  const windows = (
    <>
      <Windows xs={xs} y={-98} w={9} h={15} cap="pediment" />
      <Windows xs={xs} y={-66} w={9} h={18} cap="flat" />
      <Windows xs={xs} y={-34} w={9} h={14} />
    </>
  );
  return (
    <g className="bm-art" data-landmark="whitehouse">
      {site && <rect x="-250" y="0" width="500" height="40" className="bm-lawn" />}
      <P id="walls" parts={parts}>
        <rect x="-170" y="-112" width="340" height="112" className="bm-sandstone" />
        <rect x="90" y="-112" width="80" height="112" className="bm-sandstone-side" />
      </P>
      <P id="paint" parts={parts}>
        <rect x="-170" y="-112" width="340" height="112" className="bm-whitewash" />
        <rect x="90" y="-112" width="80" height="112" className="bm-whitewash-side" />
        <rect x="-170" y="-46" width="340" height="2" className="bm-cap" />
      </P>
      {/* the windows show on the bare stone and on the paint */}
      <P id="walls" parts={parts} className="bm-over">{windows}</P>
      <P id="roof" parts={parts}>
        <path d="M-166 -112 L-150 -128 L150 -128 L166 -112 Z" className="bm-roof" />
        <path d="M90 -112 L90 -128 L150 -128 L166 -112 Z" className="bm-roof-side" />
      </P>
      <P id="rebuild" parts={parts}>
        <rect x="-176" y="-118" width="352" height="6" className="bm-cap" />
        <g className="bm-balusters">{range(-172, 172, 5).map((x) => <rect key={x} x={x - 1} y="-126" width="2" height="8" />)}</g>
        <rect x="-176" y="-128" width="352" height="2.5" className="bm-cap" />
        <rect x="-120" y="-142" width="10" height="16" className="bm-chimney" /><rect x="110" y="-142" width="10" height="16" className="bm-chimney" />
        <rect x="-60" y="-138" width="8" height="12" className="bm-chimney" /><rect x="52" y="-138" width="8" height="12" className="bm-chimney" />
      </P>
      <P id="portico" parts={parts}>
        {/* the round portico: its columns, the curved roof line and its rail, and the steps */}
        <path d="M-68 -2 Q0 14 68 -2 L68 2 Q0 18 -68 2 Z" className="bm-step" />
        <rect x="-64" y="-104" width="128" height="102" className="bm-recess-light" />
        {[-58, -38, -14, 14, 38, 58].map((x) => <Column key={x} x={x} top={-100} bottom={-2} w={9} kind="ionic" />)}
        <path d="M-70 -112 Q0 -104 70 -112 L70 -100 Q0 -92 -70 -100 Z" className="bm-whitewash" />
        <g className="bm-balusters">{range(-66, 66, 5).map((x) => <rect key={x} x={x - 1} y={-120 + Math.abs(x) * 0.02} width="2" height="7" />)}</g>
        <path d="M-71 -113 Q0 -105 71 -113 L71 -111 Q0 -103 -71 -111 Z" className="bm-cap" />
      </P>
      <P id="flag" parts={parts}><Flag x={0} y={-128} h={44} s={1.3} /></P>
      <D on={decor}>
        <g className="bm-unit">
          <ellipse cx="0" cy="30" rx="34" ry="7" className="bm-pool-rim" />
          <ellipse cx="0" cy="30" rx="30" ry="5.5" className="bm-water" />
          <g className="bm-spray"><path d="M0 28 Q-3 6 0 -4 Q3 6 0 28 Z" /><path d="M-2 28 Q-12 14 -16 26" /><path d="M2 28 Q12 14 16 26" /></g>
        </g>
      </D>
      {/* the fire of 1814, played before the rebuild */}
      {building === 'rebuild' && (
        <g className="bm-fire" aria-hidden="true">
          {[-140, -96, -40, 10, 64, 120].map((x, i) => (
            <g key={x} className="bm-flame" style={{ animationDelay: `${-i * 0.13}s` } as CSSProperties}>
              <path d={`M${x} -112 Q${x - 12} -136 ${x} -160 Q${x + 4} -140 ${x + 12} -150 Q${x + 14} -128 ${x} -112 Z`} />
              <path className="bm-flame-in" d={`M${x + 1} -113 Q${x - 5} -128 ${x + 1} -142 Q${x + 4} -130 ${x + 7} -134 Q${x + 8} -122 ${x + 1} -113 Z`} />
            </g>
          ))}
          {[-110, -20, 80].map((x, i) => <circle key={x} cx={x} cy="-170" r="16" className="bm-smoke" style={{ animationDelay: `${-i * 0.3}s` } as CSSProperties} />)}
        </g>
      )}
    </g>
  );
}

// ---------- 6. The U.S. Capitol, its west front on the Mall ----------
function Capitol({ parts, decor, building }: ArtProps) {
  const L = -330, R = 330;
  const win = (x0: number, x1: number, step: number) => range(x0, x1, step);
  // Bulfinch's low copper dome stands until the new dome's drum goes up (and is shown coming down).
  const oldDome = parts.drum !== 'built' || building === 'drum';
  return (
    <g className="bm-art" data-landmark="capitol">
      <D on={decor}>
        {[[-170, -330, 'a'], [150, -360, 'b'], [-20, -420, 'c'], [250, -280, 'a'], [-260, -250, 'b']].map(([x, y, c], i) => (
          <g key={i} className={`bm-unit bm-firework bm-fw-${c}`} style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${-i * 0.7}s` } as CSSProperties}>
            {range(0, 330, 30).map((a) => <line key={a} x1={Number(x)} y1={Number(y)} x2={Number(x) + Math.cos((a * Math.PI) / 180) * 30} y2={Number(y) + Math.sin((a * Math.PI) / 180) * 30} />)}
            <circle cx={Number(x)} cy={Number(y)} r="4" />
          </g>
        ))}
      </D>
      <P id="base" parts={parts}>
        <rect x={L - 30} y="-22" width={R - L + 60} height="22" className="bm-stone" />
        <rect x={L - 30} y="-26" width={R - L + 60} height="4" className="bm-cap" />
        {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={-70 + k * 3} y={-22 + k * 4.4} width={140 - k * 6} height="2.4" className="bm-step" />)}
      </P>
      <P id="wings" parts={parts}>
        {/* Walter's extensions: a connector, then a new wing with its portico, on each side */}
        {[-1, 1].map((sd) => {
          const a = sd < 0 ? L : 210, b = sd < 0 ? -210 : R;
          const pc = sd < 0 ? L + 62 : R - 62;
          return (
            <g key={sd}>
              <rect x={a} y="-96" width={b - a} height="70" className="bm-marble" />
              {sd > 0 && <rect x={R - 40} y="-96" width="40" height="70" className="bm-marble-side" />}
              <Windows xs={win(a + 10, b - 10, 14).filter((x) => Math.abs(x - pc) > 34)} y={-86} w={6} h={10} cap="flat" />
              <Windows xs={win(a + 10, b - 10, 14).filter((x) => Math.abs(x - pc) > 34)} y={-60} w={6} h={12} />
              <rect x={pc - 34} y="-100" width="68" height="74" className="bm-recess" />
              {range(pc - 28, pc + 28, 11.2).map((x) => <Column key={x} x={x} top={-96} bottom={-26} w={6} />)}
              <path d={`M${pc - 38} -100 L${pc} -118 L${pc + 38} -100 Z`} className="bm-marble" />
              <rect x={pc - 38} y="-102" width="76" height="3" className="bm-cap" />
              <rect x={a} y="-100" width={b - a} height="4" className="bm-cap" />
            </g>
          );
        })}
      </P>
      <P id="north" parts={parts}>
        <rect x="-210" y="-92" width="120" height="66" className="bm-marble" />
        <Windows xs={win(-200, -100, 14)} y={-84} w={6} h={10} cap="pediment" />
        <Windows xs={win(-200, -100, 14)} y={-58} w={6} h={12} />
        <rect x="-212" y="-96" width="124" height="4" className="bm-cap" />
      </P>
      <P id="south" parts={parts}>
        <rect x="90" y="-92" width="120" height="66" className="bm-marble" />
        <rect x="170" y="-92" width="40" height="66" className="bm-marble-side" />
        <Windows xs={win(100, 200, 14)} y={-84} w={6} h={10} cap="pediment" />
        <Windows xs={win(100, 200, 14)} y={-58} w={6} h={12} />
        <rect x="88" y="-96" width="124" height="4" className="bm-cap" />
      </P>
      <P id="center" parts={parts}>
        <rect x="-90" y="-108" width="180" height="82" className="bm-marble" />
        <rect x="60" y="-108" width="30" height="82" className="bm-marble-side" />
        <rect x="-62" y="-104" width="124" height="78" className="bm-recess" />
        {range(-56, 56, 14).map((x) => <Column key={x} x={x} top={-104} bottom={-26} w={7} />)}
        <path d="M-66 -108 L0 -134 L66 -108 Z" className="bm-marble" />
        <path d="M0 -134 L66 -108 L0 -108 Z" className="bm-marble-side" />
        <rect x="-92" y="-112" width="184" height="4" className="bm-cap" />
        {oldDome && (
          <g className="bm-olddome">
            <rect x="-46" y="-130" width="92" height="18" className="bm-marble" />
            <path d="M-46 -130 C-46 -156 -22 -166 0 -167 C22 -166 46 -156 46 -130 Z" className="bm-copper" />
            <path d="M8 -166.5 C30 -162 46 -152 46 -130 L22 -130 C22 -150 16 -162 8 -166.5 Z" className="bm-copper-side" />
            <rect x="-6" y="-178" width="12" height="11" className="bm-marble" />
          </g>
        )}
      </P>
      <P id="drum" parts={parts}>
        <rect x="-70" y="-174" width="140" height="62" className="bm-marble" />
        <rect x="-64" y="-170" width="128" height="56" className="bm-recess" />
        {range(-60, 60, 10).map((x) => <Column key={x} x={x} top={-170} bottom={-114} w={5} />)}
        <rect x="-74" y="-178" width="148" height="5" className="bm-cap" />
        <rect x="-56" y="-204" width="112" height="26" className="bm-marble" />
        <rect x="30" y="-204" width="26" height="26" className="bm-marble-side" />
        <Windows xs={range(-48, 48, 12)} y={-198} w={5} h={12} />
        <rect x="-58" y="-207" width="116" height="3" className="bm-cap" />
      </P>
      <P id="dome" parts={parts}>
        <path d="M-56 -207 C-56 -268 -28 -300 0 -304 C28 -300 56 -268 56 -207 Z" className="bm-dome" />
        <path d="M7 -303 C34 -296 56 -266 56 -207 L25 -207 C25 -262 16 -290 7 -303 Z" className="bm-dome-side" />
        <g className="bm-ribs">
          {[-34, -12, 12, 34].map((x) => <path key={x} d={`M${x} -207 C${x} -258 ${x * 0.5} -290 0 -302`} />)}
          <path d="M-52 -236 C-22 -243 22 -243 52 -236" /><path d="M-40 -270 C-16 -276 16 -276 40 -270" />
        </g>
        <path d="M-56 -207 C-56 -268 -28 -300 0 -304 C28 -300 56 -268 56 -207" className="bm-rim" />
        <rect x="-10" y="-332" width="20" height="30" className="bm-marble" />
        {range(-7, 7, 4.6).map((x) => <line key={x} x1={x} x2={x} y1="-328" y2="-305" className="bm-lantern" />)}
        <path d="M-13 -332 Q0 -344 13 -332 Z" className="bm-dome" />
      </P>
      <P id="freedom" parts={parts}>
        <path d="M-3.4 -342 L-4.6 -360 L0 -369 L4.6 -360 L3.4 -342 Z" className="bm-bronze" />
        <circle cx="0" cy="-372" r="3" className="bm-bronze" />
        <path d="M-3 -374 L0 -381 L3 -374 Z" className="bm-bronze" />
      </P>
    </g>
  );
}

export function LandmarkArt({ id, ...p }: ArtProps & { id: LandmarkId }) {
  switch (id) {
    case 'monument': return <Monument {...p} />;
    case 'lincoln': return <Lincoln {...p} />;
    case 'jefferson': return <Jefferson {...p} />;
    case 'treasury': return <Treasury {...p} />;
    case 'whitehouse': return <WhiteHouse {...p} />;
    case 'capitol': return <Capitol {...p} />;
  }
}

/** Each drawing's frame (x, y, width, height) around the ground line, for the close-up stage. */
export const FRAME: Record<LandmarkId, [number, number, number, number]> = {
  monument: [-260, -700, 520, 740],
  lincoln: [-300, -200, 600, 360],
  jefferson: [-280, -260, 560, 340],
  treasury: [-320, -190, 640, 260],
  whitehouse: [-280, -260, 560, 320],
  capitol: [-380, -480, 760, 520],
};

/** How large each drawing is next to the others (about a foot to a unit), for the Mall view. */
export const WORLD: Record<LandmarkId, number> = { monument: 1, lincoln: 0.85, jefferson: 0.62, treasury: 0.62, whitehouse: 0.62, capitol: 1.1 };

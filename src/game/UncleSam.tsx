import { type ReactNode, useContext, useEffect, useId, useRef } from 'react';
import { useJourney } from './state';
import { useSamDock } from './samdock';
import { MouthContext, type Mood, useNarrator } from './voice';

export type { Mood } from './voice';

// Uncle Sam, drawn as a friendly everyday American: reading glasses pushed up on his hat, a
// pencil in his pocket. Flat and quiet, in the same palette in both themes.
// He is the game's main character, so he acts: he breathes and blinks while he waits, glances
// around, and looks toward his words when he speaks. Each mood has its own face, hat and hands
// (a wave, a thumbs-up, wringing hands, hands up in surprise, a hand at the chin, both arms up),
// and each new line starts with a small reaction (a nod, a jump, a bounce). His mouth follows his
// recorded voice: the narrator sends how loud each moment is (see voice.tsx), and the mouth opens
// to match. With reduced motion, he holds still and keeps the shapes only.

const C = { navy: '#23406e', red: '#b8372f', white: '#fbfaf6', skin: '#f0c6a0', skinShade: '#dfa983', hair: '#eceae3', line: '#3b2f2a', glass: '#7fa3c8', gold: '#c9a645' };

const HAT: Record<Mood, string | undefined> = {
  happy: undefined,
  proud: 'rotate(-6 60 58)',
  worried: 'translate(0 2)',
  thinking: 'rotate(4 60 58)',
  surprised: 'translate(0 -7)',
  cheering: 'translate(6 -13) rotate(14 60 40)',
};

/** While he speaks, the narrator's loudness (0–3) sets his mouth, written straight onto the drawing. */
function useMouth(svg: React.RefObject<SVGSVGElement | null>, speaking: boolean) {
  const mouth = useContext(MouthContext);
  useEffect(() => {
    const el = svg.current;
    if (!el || !speaking || !mouth) return;
    const off = mouth((level) => { el.dataset.mouth = String(level); });
    return () => { off(); delete el.dataset.mouth; };
  }, [speaking, mouth, svg]);
}

/**
 * Something he does for a moment: a reaction to what the player just did (a nod, a thumbs-up, a
 * scratch of the head, a hat tip, a cheer, a salute) or, while he waits, one of his idle habits
 * (waving a little flag, checking his pocket watch, flipping a quarter, whistling a tune).
 */
export type SamAct = 'nod' | 'glance' | 'thumbs' | 'oops' | 'hattip' | 'cheer' | 'salute' | 'flag' | 'watch' | 'coin' | 'whistle';
/** Acts that use his right (or left) arm, so the mood's own hands step aside while they play. */
const ARM_ACTS = new Set<SamAct>(['thumbs', 'oops', 'hattip', 'cheer', 'salute', 'flag', 'watch', 'coin']);
const GLOVE = { fill: C.white, stroke: '#d9d5ca', strokeWidth: 0.9 };
const SLEEVE = { fill: 'none', stroke: C.navy, strokeWidth: 10, strokeLinecap: 'round' as const };

function ActLayer({ act }: { act: SamAct }) {
  switch (act) {
    case 'thumbs': return (
      <g className="sam-act-arm">
        <path d="M100 150 q6 -26 -6 -52" {...SLEEVE} />
        <rect x="86" y="88" width="13" height="12" rx="4" {...GLOVE} />
        <rect x="90" y="79" width="4.6" height="11" rx="2.3" {...GLOVE} />
      </g>
    );
    case 'oops': return (
      <g className="sam-act-arm sam-scratch">
        <path d="M20 150 q-12 -36 10 -76" {...SLEEVE} />
        <circle cx="31" cy="73" r="6.2" {...GLOVE} />
        <text x="88" y="76" className="sam-q" fontSize="16" fontWeight="700" fill="var(--muted)">?</text>
      </g>
    );
    case 'hattip': return (
      <g className="sam-act-arm sam-tiphand">
        <path d="M100 150 q14 -44 -8 -88" {...SLEEVE} />
        <ellipse className="sam-tipglove" cx="91" cy="61" rx="7" ry="5.6" {...GLOVE} />
      </g>
    );
    case 'cheer': return (
      <g className="sam-act-arm">
        <path d="M30 136 q-12 -18 -6 -56 M90 136 q12 -18 6 -56" {...SLEEVE} strokeWidth="11" />
        <circle cx="24" cy="78" r="6.5" {...GLOVE} />
        <circle cx="96" cy="78" r="6.5" {...GLOVE} />
        <g className="sam-spark" fill={C.gold}>
          {[[24, 56, 1], [96, 52, 1], [30, 32, 0.7], [92, 30, 0.8]].map(([x, y, k], i) => <path key={i} transform={`translate(${x} ${y}) scale(${k})`} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6z" />)}
        </g>
      </g>
    );
    case 'salute': return (
      <g className="sam-act-arm">
        <path d="M100 150 q16 -34 -12 -72" {...SLEEVE} />
        <ellipse cx="83" cy="75" rx="10" ry="3.8" transform="rotate(-26 83 75)" {...GLOVE} />
      </g>
    );
    case 'flag': return (
      <g className="sam-act-arm">
        <path d="M104 150 q4 -26 -8 -44" {...SLEEVE} />
        <line x1="96" y1="106" x2="98" y2="56" stroke="#8a6a3a" strokeWidth="1.8" strokeLinecap="round" />
        <g className="sam-flag">
          {[0, 1, 2, 3, 4, 5].map((r) => <rect key={r} x="82" y={57 + r * 1.9} width="15.5" height="1.9" fill={r % 2 ? C.white : C.red} />)}
          <rect x="90.5" y="57" width="7" height="5.7" fill={C.navy} />
          <circle cx="92.3" cy="58.8" r="0.5" fill={C.white} /><circle cx="95.3" cy="58.8" r="0.5" fill={C.white} /><circle cx="93.8" cy="60.9" r="0.5" fill={C.white} />
        </g>
        <circle cx="96" cy="104" r="6" {...GLOVE} />
      </g>
    );
    case 'watch': return (
      <g className="sam-act-arm">
        <path d="M70 122 q-6 6 -14 6" fill="none" stroke={C.gold} strokeWidth="1.2" strokeDasharray="1.6 1.4" />
        <path d="M102 150 q0 -22 -16 -38" {...SLEEVE} />
        <circle cx="78" cy="106" r="7" fill={C.gold} />
        <circle cx="78" cy="106" r="5.2" fill={C.white} />
        <path className="sam-watch-hand" d="M78 106 v-3.6 M78 106 h2.6" stroke={C.line} strokeWidth="0.9" strokeLinecap="round" />
        <circle cx="86" cy="111" r="6" {...GLOVE} />
      </g>
    );
    case 'coin': return (
      <g className="sam-act-arm">
        <path d="M102 150 q4 -22 -8 -36" {...SLEEVE} />
        <ellipse className="sam-coin" cx="92" cy="104" rx="4.4" ry="4.4" fill={C.gold} stroke="#a8862f" strokeWidth="0.8" />
        <circle cx="93" cy="112" r="6" {...GLOVE} />
      </g>
    );
    case 'whistle': return (
      <g className="sam-notes" fill="var(--muted)">
        {[0, 1, 2].map((k) => <g key={k} className="sam-note" style={{ animationDelay: `${k * 0.55}s` }}><ellipse cx="74" cy="100" rx="2.6" ry="2" transform="rotate(-20 74 100)" /><path d="M76.2 99.4 v-8.5 q3 1 4.5 3.2" fill="none" stroke="var(--muted)" strokeWidth="1.1" /></g>)}
      </g>
    );
    default: return null;
  }
}

/** How much of him shows: half his body (the top bar, and anywhere else), or head and shoulders,
 * close up (the main menu). */
type Crop = 'full' | 'bust';
// The bust (the main menu) shows him down to his coat, bow tie and lapel pin.
const VIEW: Record<Crop, [number, number, number, number]> = { full: [0, 0, 120, 150], bust: [12, 0, 96, 150] };

/** `greet`: he waves hello (happy mood) — on by default. `act`: what he's doing right now. */
export function UncleSam({ mood = 'happy', size = 140, title, speaking = false, greet = true, crop = 'full', act = null }: { mood?: Mood; size?: number; title?: string; speaking?: boolean; greet?: boolean; crop?: Crop; act?: SamAct | null }) {
  const svg = useRef<SVGSVGElement>(null);
  useMouth(svg, speaking);
  const brows: Record<Mood, string> = {
    happy: 'M41 77 q6 -4 12 -1 M67 76 q6 -3 12 1',
    proud: 'M41 76 q6 -5 12 -2 M67 74 q6 -3 12 2',
    worried: 'M41 74 q6 4 12 2 M67 76 q6 -2 12 -2',
    thinking: 'M41 78 q6 -2 12 0 M67 72 q6 -4 12 0',
    surprised: 'M41 71 q6 -6 12 -2 M67 69 q6 -4 12 2',
    cheering: 'M41 74 q6 -6 12 -2 M67 72 q6 -4 12 2',
  };
  const rest: Record<Mood, ReactNode> = {
    happy: <path d="M50 104 q10 9 20 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    proud: <path d="M48 103 q12 11 24 0 q-12 5 -24 0z" fill={C.line} />,
    worried: <path d="M51 107 q9 -6 18 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    thinking: <path d="M52 105 q8 3 15 -2" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />,
    surprised: <ellipse cx="60" cy="105" rx="4.5" ry="5.5" fill={C.line} />,
    cheering: <path d="M47 101 q13 15 26 0z" fill={C.line} />,
  };
  // The open "talking" shape alternates with the resting mouth while he speaks, when there is no
  // loudness to follow (a device voice); with his recorded voice, three openings follow the sound.
  const talk = mood === 'worried' ? <ellipse cx="60" cy="105" rx="5" ry="3.6" fill={C.line} /> : <path d="M50 102 q10 11 20 0 q-10 3 -20 0z" fill={C.line} />;
  const tongue = <ellipse cx="60" cy="108.2" rx="3.6" ry="1.5" fill="#c75b54" />;
  const closedEyes = mood === 'happy' || mood === 'proud' || mood === 'cheering';
  return (
    <svg ref={svg} className="sam" data-mood={mood} data-speaking={speaking || undefined} data-act={act ?? undefined} data-act-arm={(act && ARM_ACTS.has(act)) || undefined} data-crop={crop === 'full' ? undefined : crop}
      width={size} height={size * (VIEW[crop][3] / VIEW[crop][2])} viewBox={VIEW[crop].join(' ')} role="img" aria-label={title ?? `Uncle Sam, looking ${mood}${speaking ? ', speaking' : ''}`}>
      {/* A new mood re-draws him, so each one starts with its own small reaction. */}
      <g className="sam-figure" key={mood}>
      <g className="sam-breath">
      {/* raised arms when cheering */}
      {mood === 'cheering' && (
        <g className="sam-arms">
          <path d="M24 134 q-14 -16 -12 -40" fill="none" stroke={C.navy} strokeWidth="11" strokeLinecap="round" />
          <path d="M96 134 q14 -16 12 -40" fill="none" stroke={C.navy} strokeWidth="11" strokeLinecap="round" />
          <circle cx="12" cy="90" r="6.5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <circle cx="108" cy="90" r="6.5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
        </g>
      )}
      {/* coat and shoulders */}
      <path d="M14 150 q4 -30 30 -36 l16 10 l16 -10 q26 6 30 36z" fill={C.navy} />
      <path d="M44 114 l16 22 l16 -22 l-6 -3 l-10 9 l-10 -9z" fill={C.white} />
      <path d="M52 122 l8 6 l8 -6 l0 8 l-8 -2 l-8 2z" fill={C.red} />
      {/* a pencil in the breast pocket */}
      <rect x="80" y="128" width="12" height="3" rx="1" fill={C.white} opacity="0.85" />
      <rect x="86" y="121" width="2.2" height="9" rx="1" fill="#e0b64a" />
      <path d="M50 108 h20 v8 q-10 6 -20 0z" fill={C.skinShade} />
      <g className="sam-head">
        <path d="M30 78 q-6 10 2 20 q2 -10 6 -14z M90 78 q6 10 -2 20 q-2 -10 -6 -14z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
        <path d="M34 70 q0 -8 8 -10 h36 q8 2 8 10 v22 q0 26 -26 26 q-26 0 -26 -26z" fill={C.skin} />
        <ellipse cx="34" cy="88" rx="4" ry="6" fill={C.skinShade} />
        <ellipse cx="86" cy="88" rx="4" ry="6" fill={C.skinShade} />
        <path d="M50 108 q10 6 20 0 q-2 14 -10 22 q-8 -8 -10 -22z" fill={C.hair} stroke="#cfccc3" strokeWidth="0.8" />
        <g className="sam-eyes">
          {closedEyes ? (
            <path d="M44 86 q4 -4 8 0 M68 86 q4 -4 8 0" fill="none" stroke={C.line} strokeWidth="2.6" strokeLinecap="round" />
          ) : (
            <g className="sam-pupils">
              <circle cx="48" cy="86" r={mood === 'surprised' ? 3.6 : 2.8} fill={C.line} />
              <circle cx="72" cy="86" r={mood === 'surprised' ? 3.6 : 2.8} fill={C.line} />
              <circle cx="49" cy="85" r="0.9" fill="#fff" opacity="0.85" />
              <circle cx="73" cy="85" r="0.9" fill="#fff" opacity="0.85" />
              {mood === 'thinking' && <path d="M45 84 h6 M69 84 h6" stroke={C.skin} strokeWidth="1.6" />}
            </g>
          )}
        </g>
        <path className="sam-brows" d={brows[mood]} fill="none" stroke="#bdb9ae" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M60 88 q-4 8 0 10 q3 0 4 -2" fill="none" stroke={C.skinShade} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="42" cy="97" r={mood === 'cheering' || mood === 'proud' ? 5 : 4} fill="#e9a58a" opacity={mood === 'worried' ? 0.2 : 0.45} />
        <circle cx="78" cy="97" r={mood === 'cheering' || mood === 'proud' ? 5 : 4} fill="#e9a58a" opacity={mood === 'worried' ? 0.2 : 0.45} />
        <g className="sam-mouth-rest">{rest[mood]}</g>
        {/* The talking shapes start hidden, so a still picture of him (a share card) shows his resting mouth. */}
        <g className="sam-mouth-talk" opacity="0">{talk}</g>
        <g className="sam-m sam-m1" opacity="0"><path d="M53 103 q7 5 14 0 q-7 2 -14 0z" fill={C.line} /></g>
        <g className="sam-m sam-m2" opacity="0"><path d="M51 102 q9 10 18 0 q-9 3 -18 0z" fill={C.line} />{tongue}</g>
        <g className="sam-m sam-m3" opacity="0"><ellipse cx="60" cy="105.5" rx="6" ry="7" fill={C.line} />{tongue}</g>
        {mood === 'worried' && <path className="sam-sweat" d="M89 70 q4 6 0 9 q-4 -3 0 -9z" fill="#9cc3e6" />}
        {act === 'whistle' && <ellipse className="sam-pucker" cx="62" cy="104.5" rx="2.6" ry="3.2" fill={C.line} />}
        <g className="sam-hat" transform={HAT[mood]}>
          <ellipse cx="60" cy="61" rx="38" ry="7" fill={C.navy} />
          <path d="M38 60 l4 -50 q18 -6 36 0 l4 50z" fill={C.white} />
          <path d="M45 58 l2 -48 h6 l-1 48z M58 58 v-49 h6 l1 49z M72 58 l-1 -48 h6 l3 48z" fill={C.red} />
          <ellipse cx="60" cy="9" rx="18" ry="3.4" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <path d="M38.5 52 h43 l0.6 8 h-44.2z" fill={C.navy} />
          {[47, 60, 73].map((x) => (
            <path key={x} d={`M${x} 53.2 l1.2 2.4 l2.6 0.3 l-1.9 1.8 l0.5 2.6 l-2.4 -1.3 l-2.4 1.3 l0.5 -2.6 l-1.9 -1.8 l2.6 -0.3z`} fill={C.white} />
          ))}
          <g opacity="0.95">
            <circle cx="50" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
            <circle cx="70" cy="66" r="5" fill="none" stroke={C.glass} strokeWidth="1.8" />
            <path d="M55 66 h10" stroke={C.glass} strokeWidth="1.8" />
          </g>
        </g>
      </g>
      </g>
      {/* a wave hello, then a hand that talks along with him */}
      {mood === 'happy' && (
        <>
          {greet && <g className="sam-wave">
            <path d="M93 140 q13 -12 14 -38" fill="none" stroke={C.navy} strokeWidth="10" strokeLinecap="round" />
            <circle cx="107" cy="98" r="6.5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
            <path d="M103 92 v-3 M107 91 v-3.5 M111 92 v-3" stroke="#d9d5ca" strokeWidth="1.2" strokeLinecap="round" />
          </g>}
          {/* Hidden until he speaks (so a still picture of him has one right arm, not two). */}
          <g className="sam-explain" opacity="0" data-after-wave={greet || undefined}>
            <path d="M90 148 q8 -12 13 -26" fill="none" stroke={C.navy} strokeWidth="10" strokeLinecap="round" />
            <ellipse cx="104" cy="119" rx="7" ry="5" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          </g>
        </>
      )}
      {/* a hand on his heart when proud */}
      {mood === 'proud' && (
        <g className="sam-thumb">
          <path d="M100 148 q4 -16 -18 -21" fill="none" stroke={C.navy} strokeWidth="10" strokeLinecap="round" />
          <ellipse cx="78" cy="126" rx="7.5" ry="5.6" transform="rotate(-18 78 126)" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <path d="M73 123.5 q5 -1.6 10 0 M73.5 126.5 q5 -1.4 9.5 0" fill="none" stroke="#d9d5ca" strokeWidth="1" strokeLinecap="round" />
        </g>
      )}
      {/* wringing hands when worried */}
      {mood === 'worried' && (
        <g className="sam-wring">
          <path d="M24 148 q8 -12 28 -17 M96 148 q-8 -12 -28 -17" fill="none" stroke={C.navy} strokeWidth="9" strokeLinecap="round" />
          <circle cx="55" cy="131" r="5.6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <circle cx="65" cy="131" r="5.6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
        </g>
      )}
      {/* hands up when surprised */}
      {mood === 'surprised' && (
        <g className="sam-hands-up">
          <path d="M22 146 q-9 -20 -4 -46 M98 146 q9 -20 4 -46" fill="none" stroke={C.navy} strokeWidth="9" strokeLinecap="round" />
          <ellipse cx="18" cy="97" rx="5.6" ry="6.6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <ellipse cx="102" cy="97" rx="5.6" ry="6.6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
          <path className="sam-pop" d="M14 72 l-4 -5 M22 68 l-1 -6 M98 68 l1 -6 M106 72 l4 -5" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {/* a hand at the chin when thinking */}
      {mood === 'thinking' && (
        <g className="sam-arms">
          <path d="M98 142 q-4 -18 -22 -24" fill="none" stroke={C.navy} strokeWidth="10" strokeLinecap="round" />
          <circle cx="74" cy="116" r="6" fill={C.white} stroke="#d9d5ca" strokeWidth="0.9" />
        </g>
      )}
      {mood === 'thinking' && <g className="sam-think"><circle cx="100" cy="40" r="3" fill="var(--muted)" opacity="0.7" /><circle cx="108" cy="30" r="4.5" fill="var(--muted)" opacity="0.5" /></g>}
      {(mood === 'cheering' || mood === 'proud') && (
        <g className="sam-spark" fill={C.gold}>
          {(mood === 'cheering' ? [[8, 60, 1], [112, 58, 1], [20, 30, 0.7], [100, 22, 0.8]] : [[104, 70, 0.8], [112, 84, 0.55]]).map(([x, y, s], k) => (
            <path key={k} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6z" />
          ))}
        </g>
      )}
      {act && <g className="sam-act" key={act}><ActLayer act={act} /></g>}
      </g>
    </svg>
  );
}

export const plain = (n: ReactNode): string => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(plain).join('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = n as any;
  return el?.props ? plain(el.props.children) : '';
};

/**
 * Uncle Sam says a line. He lives in the top bar (and, on the main menu, above its buttons): this
 * hands the line to him (see samdock.tsx and samhud.tsx), and his words run across the strip
 * under the bar. With `auto`, he reads it aloud when it appears. `inline` draws him in the page.
 */
export function SamSays(props: { mood?: Mood; children: ReactNode; size?: number; compact?: boolean; auto?: boolean; delay?: number; say?: string; inline?: boolean }) {
  const dock = useSamDock();
  return props.inline || !dock ? <SamInline {...props} /> : <SamDocked {...props} />;
}

function SamDocked({ mood = 'happy', children, auto = false, delay = 250, say }: { mood?: Mood; children: ReactNode; auto?: boolean; delay?: number; say?: string }) {
  const dock = useSamDock()!;
  const id = useId();
  const text = (say ?? plain(children)).trim();
  useEffect(() => { dock.present({ owner: id, mood, node: children, text, auto, delay }); }, [text, mood]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => dock.clear(id), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Uncle Sam with a speech bubble, in the page. "Listen" replays the line at any time. */
function SamInline({ mood = 'happy', children, size = 120, compact = false, auto = false, delay = 250, say }: { mood?: Mood; children: ReactNode; size?: number; compact?: boolean; auto?: boolean; delay?: number; say?: string }) {
  const { settings } = useJourney();
  const n = useNarrator();
  const id = useId();
  const text = (say ?? plain(children)).trim();
  const speaking = n.speakingId === id;
  const last = useRef('');

  useEffect(() => {
    if (!auto || !settings.narration || !n.supported || !text) return;
    if (last.current === text + mood) return;
    const t = setTimeout(() => {
      if (!n.canAutoplay()) return;
      last.current = text + mood;
      n.speak(id, text, mood);
    }, delay);
    return () => clearTimeout(t);
  }, [auto, settings.narration, text, mood, n.supported]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => n.stop(id), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={'samsays' + (compact ? ' compact' : '')} data-speaking={speaking || undefined}>
      <UncleSam mood={mood} size={compact ? 72 : size} speaking={speaking} />
      <div className="bubble">
        <div className="bubble-name">Uncle Sam{speaking && <span className="bubble-live" aria-hidden="true"><i /><i /><i /></span>}</div>
        <div className="bubble-text">{children}</div>
        {n.supported && text && (
          <button type="button" className="link-btn bubble-listen" onClick={() => (speaking ? n.stop(id) : n.speak(id, text, mood))} aria-pressed={speaking}>
            {speaking ? 'Stop' : 'Listen'}
          </button>
        )}
      </div>
    </div>
  );
}

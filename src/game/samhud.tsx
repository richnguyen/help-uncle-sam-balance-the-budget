import { type RefObject, useEffect, useRef, useState } from 'react';
import { useSamDock } from './samdock';
import { useJourney } from './state';
import { type SamAct, UncleSam } from './UncleSam';
import { lineSeconds, useNarrator } from './voice';

// Uncle Sam in the middle of the top bar, always there, and the strip his words run across.
// He reacts to what the player does (a nod for a card, a thumbs-up for a right answer, a scratch
// of the head for a miss, a hat tip for a vote, a cheer for a finished mission, a salute for a
// medal), and while he waits he has a few American habits of his own: waving a little flag,
// tipping his hat, checking his pocket watch, flipping a quarter, whistling a tune, a salute.
// His line runs from right to left across the strip at the pace he speaks it, so the word he is
// saying passes under him; with his voice on, it follows the recording word for word.

const EVT = 'sam-act';
/** Ask Uncle Sam to react to something the player just did. */
export function samReact(act: SamAct) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<SamAct>(EVT, { detail: act }));
}

const LENGTH: Record<SamAct, number> = { nod: 900, glance: 800, thumbs: 1500, oops: 1500, hattip: 1700, cheer: 2000, salute: 1700, flag: 2600, watch: 2800, coin: 2100, whistle: 2900 };
const IDLE: SamAct[] = ['flag', 'hattip', 'watch', 'coin', 'whistle', 'salute'];
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What he's doing right now: a reaction to the player, or now and then an idle habit. */
export function useSamAct(speaking: boolean) {
  const [act, setAct] = useState<SamAct | null>(null);
  const busyUntil = useRef(0);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  useEffect(() => {
    let end: ReturnType<typeof setTimeout> | null = null;
    let idle: ReturnType<typeof setTimeout> | null = null;
    let raf = 0;
    let last: SamAct | null = null;
    const run = (a: SamAct) => {
      if (end) clearTimeout(end);
      cancelAnimationFrame(raf);
      setAct(null);
      raf = requestAnimationFrame(() => setAct(a)); // so the same act twice plays twice
      busyUntil.current = Date.now() + LENGTH[a];
      end = setTimeout(() => setAct(null), LENGTH[a]);
    };
    const later = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => {
        if (!document.hidden && !speakingRef.current && Date.now() > busyUntil.current + 2000 && !reduced()) {
          const pool = IDLE.filter((x) => x !== last);
          last = pool[Math.floor(Math.random() * pool.length)];
          run(last);
        }
        later();
      }, 9000 + Math.random() * 8000);
    };
    const onAct = (e: Event) => {
      if (reduced()) return;
      run((e as CustomEvent<SamAct>).detail);
      later();
    };
    window.addEventListener(EVT, onAct);
    later();
    return () => { window.removeEventListener(EVT, onAct); if (end) clearTimeout(end); if (idle) clearTimeout(idle); cancelAnimationFrame(raf); };
  }, []);
  return act;
}

/** Uncle Sam in the top bar (half his body, standing on its bottom edge), or close up on the main menu. A tap says his line again. */
export function SamPortrait({ variant = 'hud' }: { variant?: 'hud' | 'menu' }) {
  const dock = useSamDock();
  const n = useNarrator();
  const line = dock?.line ?? null;
  const speaking = !!line && n.speakingId === line.owner;
  const act = useSamAct(speaking);
  // He waves hello once, when he first appears.
  const [greet, setGreet] = useState(true);
  useEffect(() => { const t = setTimeout(() => setGreet(false), 2600); return () => clearTimeout(t); }, []);
  const mood = line?.mood ?? 'happy';
  const tap = () => {
    if (speaking && line) { n.stop(line.owner); return; }
    if (line) dock?.replay();
    else samReact('hattip');
  };
  return (
    <button type="button" className={'sam-portrait sam-portrait-' + variant} data-speaking={speaking || undefined} data-mood={mood} onClick={tap}
      aria-label={speaking ? 'Uncle Sam is speaking. Tap to stop him' : line ? 'Uncle Sam. Tap to hear his line again' : 'Uncle Sam'}>
      <span className="sam-portrait-frame" aria-hidden="true">
        {/* The whole figure, so a wave, a cheer or a hand that talks is never cut off at the edge. */}
        <UncleSam crop="full" mood={mood} speaking={speaking} act={act} greet={greet && mood === 'happy' && !act} size={variant === 'menu' ? 155 : 76} />
      </span>
    </button>
  );
}

/** Where on the strip the word he is saying sits: right under him, in the middle. */
/** Where the word he's saying sits in the strip: at its left end, right beside him. */
const READ = 0.04;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The strip under the top bar. While he talks, his line runs across it at his speaking pace (with
 * his voice on, in step with the recording); then it settles, and a tap runs it again. With no
 * line on the page it names where you are. With reduced motion the line simply sits still.
 */
export function SpeechStrip({ caption }: { caption: string }) {
  const dock = useSamDock();
  const n = useNarrator();
  const { settings } = useJourney();
  const line = dock?.line ?? null;
  const view = useRef<HTMLElement>(null);
  const run = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'running' | 'still'>('still');
  const speakingRef = useRef<string | null>(null);
  speakingRef.current = n.speakingId;
  const prog = useRef({ id: '', p: 0 });
  const onProgress = n.onProgress;
  useEffect(() => onProgress((id, p) => { prog.current = { id, p }; }), [onProgress]);
  const lastSeq = useRef(-1);
  const speaking = !!line && n.speakingId === line.owner;

  useEffect(() => {
    if (!line?.text || reduced()) { setState('still'); return; }
    const fresh = line.seq !== lastSeq.current;
    lastSeq.current = line.seq;
    setState('running');
    let raf = 0;
    const t0 = performance.now();
    const startAt = t0 + (fresh ? line.delay : 0);
    const expectVoice = settings.narration && n.supported && n.canAutoplay() && (fresh ? line.auto : true);
    const D = Math.max(1200, lineSeconds(line.text, line.mood) * 1000);
    let mode: 'wait' | 'voice' | 'time' = 'wait';
    let tStart = 0;
    let doneAt = 0;
    prog.current = { id: '', p: 0 };
    const frame = (now: number) => {
      const el = run.current, box = view.current;
      if (!el || !box) { raf = requestAnimationFrame(frame); return; }
      const W = el.scrollWidth, C = box.clientWidth, read = C * READ;
      let p = 0;
      if (speakingRef.current === line.owner) { mode = 'voice'; p = prog.current.id === line.owner ? prog.current.p : 0; }
      else if (mode === 'voice') p = 1; // he finished, or was stopped
      else if (mode === 'wait' && now >= startAt + (expectVoice ? 1500 : 0)) { mode = 'time'; tStart = now; }
      if (mode === 'time') p = Math.min(1, (now - tStart) / D);
      // The line slides in from the right edge, its first word stopping beside him until he starts.
      const x = mode === 'wait' ? C + (read - C) * ease(Math.min(1, (now - t0) / 500)) : read - p * W;
      el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      if (p >= 1) {
        if (!doneAt) doneAt = now;
        if (now - doneAt > 900) { setState('still'); return; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [line?.seq, dock?.play]); // eslint-disable-line react-hooks/exhaustive-deps

  const again = () => { if (speaking && line) n.stop(line.owner); else dock?.replay(); };
  return (
    <div className="sam-strip" data-state={line?.text ? state : 'caption'} data-speaking={speaking || undefined}>
      <span className="sam-strip-tag" aria-hidden="true">Uncle Sam{speaking && <span className="bubble-live"><i /><i /><i /></span>}</span>
      {line?.text ? (
        <button type="button" className="sam-strip-view" ref={view as RefObject<HTMLButtonElement>} onClick={again}
          aria-label={speaking ? 'Stop Uncle Sam' : 'Hear Uncle Sam’s line again'} title={state === 'still' ? line.text : undefined}>
          {state === 'running'
            ? <span className="sam-strip-run" ref={run} aria-hidden="true">{line.text}</span>
            : <span className="sam-strip-still" aria-hidden="true">{line.text}</span>}
          {state === 'still' && <span className="sam-strip-again" aria-hidden="true">↻</span>}
        </button>
      ) : (
        <div className="sam-strip-view" ref={view as RefObject<HTMLDivElement>}><span className="sam-strip-caption">{caption}</span></div>
      )}
      {/* What he says, for screen readers, once per line. */}
      <span className="sr-only" aria-live="polite">{line?.text ?? ''}</span>
    </div>
  );
}

/** The main menu has no top bar: Uncle Sam stands close up above its buttons, with a plain bubble. */
export function SamMenuSpot() {
  const dock = useSamDock();
  const n = useNarrator();
  const line = dock?.line ?? null;
  const speaking = !!line && n.speakingId === line.owner;
  return (
    <div className="menu-sam" data-speaking={speaking || undefined}>
      {line && (
        <div className="menu-sam-bubble">
          <p className="menu-sam-text">{line.node}</p>
          {n.supported && line.text && (
            <button type="button" className="link-btn menu-sam-listen" onClick={() => (speaking ? n.stop(line.owner) : dock?.replay())} aria-pressed={speaking}>{speaking ? 'Stop' : 'Listen'}</button>
          )}
        </div>
      )}
      <SamPortrait variant="menu" />
    </div>
  );
}

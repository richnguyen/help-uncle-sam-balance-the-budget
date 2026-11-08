import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useJourney } from './state';
import { UncleSam } from './UncleSam';
import { type Mood, useNarrator } from './voice';

// Uncle Sam always speaks from the same place: just above the action bar at the bottom of the
// screen, over whatever is behind him. Pages say what he says with <SamSays> (see UncleSam.tsx),
// which hands its line to this dock instead of drawing him in the page. Each new line slides him
// in from the left; tapping him, tapping elsewhere, or Continue on a level step slides him back
// out of view. A small handle at the edge brings him back to read the line again.

interface Line { owner: string; mood: Mood; node: ReactNode; text: string; auto: boolean; delay: number; seq: number }
interface Dock {
  line: Line | null;
  shown: boolean;
  present: (l: Omit<Line, 'seq'>) => void;
  clear: (owner: string) => void;
  hide: () => void;
  show: () => void;
}

const Ctx = createContext<Dock | null>(null);
export const useSamDock = () => useContext(Ctx);

export function SamDockProvider({ children }: { children: ReactNode }) {
  const { settings } = useJourney();
  const n = useNarrator();
  // Every SamSays on the screen, by owner; the latest line to arrive is the one shown.
  const lines = useRef(new Map<string, Line>());
  const seq = useRef(0);
  const [line, setLine] = useState<Line | null>(null);
  const [shown, setShown] = useState(false);
  const pick = () => [...lines.current.values()].sort((a, b) => b.seq - a.seq)[0] ?? null;

  const present = useCallback((l: Omit<Line, 'seq'>) => {
    const prev = lines.current.get(l.owner);
    if (prev && prev.text === l.text && prev.mood === l.mood) { lines.current.set(l.owner, { ...prev, node: l.node }); return; }
    const next = { ...l, seq: ++seq.current };
    lines.current.set(l.owner, next);
    setLine(next);
    setShown(true);
  }, []);
  const clear = useCallback((owner: string) => {
    if (!lines.current.delete(owner)) return;
    const top = pick();
    setLine(top);
    if (!top) setShown(false);
  }, []);
  const hide = useCallback(() => { setShown(false); n.stop(); }, [n]);
  const show = useCallback(() => setShown(true), []);

  // He reads each new line aloud (when his voice is on and the browser allows it).
  useEffect(() => {
    if (!line || !line.auto || !settings.narration || !n.supported || !line.text) return;
    const t = setTimeout(() => { if (n.canAutoplay()) n.speak(line.owner, line.text, line.mood); }, line.delay);
    return () => clearTimeout(t);
  }, [line?.seq, settings.narration, n.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ line, shown, present, clear, hide, show }), [line, shown, present, clear, hide, show]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Keep --abh (the action bar's height) current, so the dock sits right on top of the bar. */
function useActionBarHeight() {
  useEffect(() => {
    const root = document.documentElement;
    let ro: ResizeObserver | null = null;
    let current: Element | null = null;
    const measure = () => {
      // He stands on the action bar, or on the main menu's Today strip.
      const bar = [...document.querySelectorAll('.actionbar, .menu-strip')].find((e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).position === 'fixed') ?? null;
      if (bar !== current) {
        ro?.disconnect();
        current = bar;
        if (bar && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(bar); }
      }
      root.style.setProperty('--abh', `${bar ? Math.round(bar.getBoundingClientRect().height) : 0}px`);
    };
    measure();
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => { mo.disconnect(); ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
}

export function SamDockView({ route }: { route: string }) {
  const dock = useSamDock()!;
  const n = useNarrator();
  const box = useRef<HTMLDivElement>(null);
  useActionBarHeight();
  const { line, shown, hide, show } = dock;
  const speaking = !!line && n.speakingId === line.owner;
  // He waves hello only on the first line after sliding in; each later line gets just a reaction.
  const [enterSeq, setEnterSeq] = useState<number | null>(null);
  useEffect(() => {
    if (!shown || !line) { setEnterSeq(null); return; }
    setEnterSeq((cur) => (cur == null ? line.seq : cur));
  }, [shown, line?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tap anywhere else slides him away, except on a level step's own bar, which decides itself.
  useEffect(() => {
    if (!shown) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || box.current?.contains(t) || t.closest('.samdock-peek, [data-sam-keep], .ab-panel, .appbar')) return;
      hide();
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [shown, hide]);

  if (route === 'og-card') return null;
  // A tap on his glass pane or his words slides him away too (but not on the links and buttons in them).
  const onPane = (e: React.MouseEvent) => { if (!(e.target as Element).closest('button, a, .term, input, select')) hide(); };
  return (
    <>
      <div className="samdock" data-shown={(shown && !!line) || undefined} ref={box} aria-hidden={!(shown && line) || undefined}>
        {line && (
          <div className="samsays samdock-inner" data-speaking={speaking || undefined} data-mood={line.mood} onClick={onPane}>
            <button type="button" className="samdock-avatar" onClick={hide} aria-label="Slide Uncle Sam away" tabIndex={shown ? 0 : -1}>
              <UncleSam key={line.seq} mood={line.mood} size={120} speaking={speaking} greet={enterSeq == null || enterSeq === line.seq} />
            </button>
            <div className="bubble">
              <div className="bubble-name">Uncle Sam{speaking && <span className="bubble-live" aria-hidden="true"><i /><i /><i /></span>}</div>
              <div className="bubble-text" aria-live="polite">{line.node}</div>
              {n.supported && line.text && (
                <button type="button" className="link-btn bubble-listen" tabIndex={shown ? 0 : -1} onClick={() => (speaking ? n.stop(line.owner) : n.speak(line.owner, line.text, line.mood))} aria-pressed={speaking}>
                  {speaking ? 'Stop' : 'Listen'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {line && !shown && (
        <button type="button" className="samdock-peek" onClick={show} aria-label="Bring Uncle Sam back">
          <UncleSam mood={line.mood} size={34} />
        </button>
      )}
    </>
  );
}

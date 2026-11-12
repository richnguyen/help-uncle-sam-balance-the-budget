import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useJourney } from './state';
import { type Mood, useNarrator } from './voice';

// Uncle Sam lives in the top bar, in the middle, all the time (see samhud.tsx); on the main menu,
// which has no top bar, he stands above its buttons. Pages say what he says with <SamSays> (see
// UncleSam.tsx), which hands its line here instead of drawing him in the page; the latest line to
// arrive is the one he says. His words run across the strip under the bar at his own pace, and
// he reads them aloud when his voice is on. Nothing pops up over the page.

interface Line { owner: string; mood: Mood; node: ReactNode; text: string; auto: boolean; delay: number; seq: number }
interface Dock {
  line: Line | null;
  /** Goes up each time the line should play: a new line, or the player asking to hear it again. */
  play: number;
  present: (l: Omit<Line, 'seq'>) => void;
  clear: (owner: string) => void;
  /** Say the line again: aloud when his voice is on, and across the strip either way. */
  replay: () => void;
}

const Ctx = createContext<Dock | null>(null);
export const useSamDock = () => useContext(Ctx);

export function SamDockProvider({ children }: { children: ReactNode }) {
  const { settings } = useJourney();
  const n = useNarrator();
  // Every SamSays on the screen, by owner; the latest line to arrive is the one he says.
  const lines = useRef(new Map<string, Line>());
  const seq = useRef(0);
  const [line, setLine] = useState<Line | null>(null);
  const [play, setPlay] = useState(0);
  const pick = () => [...lines.current.values()].sort((a, b) => b.seq - a.seq)[0] ?? null;

  const present = useCallback((l: Omit<Line, 'seq'>) => {
    const prev = lines.current.get(l.owner);
    if (prev && prev.text === l.text && prev.mood === l.mood) { lines.current.set(l.owner, { ...prev, node: l.node }); return; }
    const next = { ...l, seq: ++seq.current };
    lines.current.set(l.owner, next);
    setLine(next);
    setPlay((p) => p + 1);
  }, []);
  const clear = useCallback((owner: string) => {
    if (!lines.current.delete(owner)) return;
    setLine(pick());
  }, []);
  const lineRef = useRef(line);
  lineRef.current = line;
  const replay = useCallback(() => {
    const l = lineRef.current;
    if (!l) return;
    setPlay((p) => p + 1);
    if (settings.narration && n.supported && l.text) n.speak(l.owner, l.text, l.mood);
  }, [settings.narration, n]);

  // He reads each new line aloud (when his voice is on and the browser allows it).
  useEffect(() => {
    if (!line || !line.auto || !settings.narration || !n.supported || !line.text) return;
    const t = setTimeout(() => { if (n.canAutoplay()) n.speak(line.owner, line.text, line.mood); }, line.delay);
    return () => clearTimeout(t);
  }, [line?.seq, settings.narration, n.supported]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => ({ line, play, present, clear, replay }), [line, play, present, clear, replay]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Keeps two sizes current for the layout: --abh, the bottom action bar's height (the person check
 * sits above it), and --hud-h, the top bar's height (pinned boards, panels and scrolling clear it).
 */
export function useBarHeights() {
  useEffect(() => {
    const root = document.documentElement;
    const watched = new Map<string, { el: Element | null; ro: ResizeObserver | null }>();
    const track = (name: string, el: Element | null) => {
      const cur = watched.get(name);
      if (cur?.el === el) return;
      cur?.ro?.disconnect();
      const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
      if (el) ro?.observe(el);
      watched.set(name, { el, ro });
    };
    function measure() {
      // The bars along the bottom (a screen's action bar, stacked on the tab bar): --abh is how far
      // up from the bottom they reach, --tabh the tab bar's own height.
      const bars = [...document.querySelectorAll('.actionbar, .tabbar')].filter((e) => getComputedStyle(e).display !== 'none' && getComputedStyle(e).position === 'fixed');
      const tabs = bars.find((e) => e.classList.contains('tabbar')) ?? null;
      const bar = bars.find((e) => !e.classList.contains('tabbar')) ?? null;
      const hud = document.querySelector('.appbar');
      track('bar', bar);
      track('tabs', tabs);
      track('hud', hud);
      const reach = bars.reduce((a, e) => Math.max(a, window.innerHeight - e.getBoundingClientRect().top), 0);
      root.style.setProperty('--abh', `${Math.round(Math.max(0, reach))}px`);
      root.style.setProperty('--tabh', `${tabs ? Math.round(tabs.getBoundingClientRect().height) : 0}px`);
      root.style.setProperty('--hud-h', `${hud ? Math.round(hud.getBoundingClientRect().height) : 0}px`);
    }
    measure();
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    return () => { mo.disconnect(); watched.forEach((w) => w.ro?.disconnect()); window.removeEventListener('resize', measure); };
  }, []);
}

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { load, save } from '../lib/storage';
import type { SavedPlan } from './plans';

// The player's journey: which levels are done, stars earned, quiz attempts, their choices on each
// level's issue, and reading settings. Kept in this browser only (a per-viewer convenience).

export type TextSize = 'normal' | 'large' | 'larger';
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface JourneyState {
  v: 2;
  done: string[]; // completed level ids (level-1 … level-10)
  stars: Record<string, number>; // best stars per level (0–3)
  steps: Record<string, number[]>; // completed step indexes per level
  quiz: Record<string, { tries: number; correct: boolean }>; // by quiz id
  choices: Record<string, string>; // local record of the player's vote on each issue
  started: string | null;
  marks: string[]; // things the player has done outside the levels (documents opened, pages read, shares)
  medals: string[]; // medals already awarded (so each is announced once)
  plans?: Record<string, SavedPlan>; // the latest plan that met each budget-desk level's goal
  games?: Record<string, { best: number; stars: number; plays: number }>; // each mission game's best score
  built?: string[]; // Build the Mall: the jobs paid for with stars, in order (task ids)
  decor?: string[]; // Build the Mall: the decorations placed (unlocked by accomplishments)
  settings: { text: TextSize; theme: ThemeChoice; freeRoam: boolean; narration: boolean; voice: string; haptics: boolean; sounds: boolean; voiceV?: number };
}

const DEFAULT: JourneyState = {
  v: 2,
  done: [],
  stars: {},
  steps: {},
  quiz: {},
  choices: {},
  started: null,
  marks: [],
  medals: [],
  settings: { text: 'normal', theme: 'system', freeRoam: false, narration: true, voice: 'auto', haptics: true, sounds: true, voiceV: 2 },
};

// Version 1 numbered seven chapter levels and three separate budget-desk missions. Version 2 folds
// the missions into one ten-level path; this maps saved progress onto the new numbering.
const V1_TO_V2: Record<string, string> = {
  'level-1': 'level-1', 'level-2': 'level-2', 'level-3': 'level-3', 'level-4': 'level-4',
  'desk-normal': 'level-5', 'level-5': 'level-6', 'level-6': 'level-7', 'desk-hard': 'level-8',
  'level-7': 'level-9', 'desk-expert': 'level-10',
};
function migrate(s: Partial<JourneyState> & { v?: number }): Partial<JourneyState> {
  if (s.v === 2 || (!s.done && !s.steps)) return s;
  const map = (id: string) => V1_TO_V2[id] ?? id;
  return {
    ...s,
    v: 2,
    done: (s.done ?? []).map(map),
    // Levels finished before stars existed keep one star; replaying can earn more.
    stars: Object.fromEntries((s.done ?? []).map((id) => [map(id), 1])),
    steps: Object.fromEntries(Object.entries(s.steps ?? {}).map(([k, v]) => [map(k), v])),
  };
}

interface Journey extends JourneyState {
  completeStep: (level: string, step: number) => void;
  completeLevel: (level: string, stars: number) => void;
  /** Record a finished play of a mission's game; the best score and stars are kept. */
  scoreGame: (game: string, score: number, stars: number) => void;
  answer: (quizId: string, correct: boolean) => void;
  /** Clear quiz answers so a replay can earn stars again. */
  retry: (quizIds: string[]) => void;
  choose: (issueId: string, value: string) => void;
  setSettings: (s: Partial<JourneyState['settings']>) => void;
  mark: (id: string) => void;
  award: (ids: string[]) => void;
  savePlan: (level: string, plan: SavedPlan) => void;
  /** Build the Mall: pay for a job (the page checks the cost and the order). */
  build: (taskId: string) => void;
  placeDecor: (id: string) => void;
  start: () => void;
  reset: () => void;
}

const Ctx = createContext<Journey | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<JourneyState>(() => {
    const s = migrate(load<Partial<JourneyState>>('journey', {}));
    // Voice choices made before Uncle Sam had his recorded voice go back to it once.
    if (s.settings && (s.settings.voiceV ?? 1) < 2) s.settings = { ...s.settings, voice: 'auto', voiceV: 2 };
    return { ...DEFAULT, ...s, v: 2, stars: { ...(s.stars ?? {}) }, marks: [...(s.marks ?? [])], medals: [...(s.medals ?? [])], settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } };
  });
  const update = (f: (p: JourneyState) => JourneyState) => setSt((p) => { const n = f(p); save('journey', n); return n; });

  // Reading settings apply to the whole page. "System" restores whatever theme the host set
  // (the claude.ai viewer sets data-theme itself), so the page never clears the host's choice.
  const hostTheme = useRef<string | undefined>(document.documentElement.dataset.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = st.settings.text;
    if (st.settings.theme === 'system') {
      if (hostTheme.current) root.dataset.theme = hostTheme.current;
      else delete root.dataset.theme;
    } else root.dataset.theme = st.settings.theme;
  }, [st.settings.text, st.settings.theme]);

  const value: Journey = {
    ...st,
    completeStep: (level, step) => update((p) => {
      const cur = p.steps[level] ?? [];
      return cur.includes(step) ? p : { ...p, steps: { ...p.steps, [level]: [...cur, step] } };
    }),
    completeLevel: (level, stars) => update((p) => ({
      ...p,
      done: p.done.includes(level) ? p.done : [...p.done, level],
      stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) },
    })),
    scoreGame: (game, score, stars) => update((p) => {
      const cur = p.games?.[game];
      const best = Math.max(cur?.best ?? 0, score);
      return { ...p, games: { ...(p.games ?? {}), [game]: { best, stars: Math.max(cur?.stars ?? 0, stars), plays: (cur?.plays ?? 0) + 1 } } };
    }),
    answer: (quizId, correct) => update((p) => {
      const q = p.quiz[quizId] ?? { tries: 0, correct: false };
      return { ...p, quiz: { ...p.quiz, [quizId]: { tries: q.tries + 1, correct: q.correct || correct } } };
    }),
    retry: (ids) => update((p) => ({ ...p, quiz: Object.fromEntries(Object.entries(p.quiz).filter(([k]) => !ids.includes(k))) })),
    choose: (issueId, v) => update((p) => ({ ...p, choices: { ...p.choices, [issueId]: v } })),
    setSettings: (s) => update((p) => ({ ...p, settings: { ...p.settings, ...s } })),
    mark: (id) => update((p) => (p.marks.includes(id) ? p : { ...p, marks: [...p.marks, id] })),
    award: (ids) => update((p) => ({ ...p, medals: [...p.medals, ...ids.filter((x) => !p.medals.includes(x))] })),
    savePlan: (level, plan) => update((p) => ({ ...p, plans: { ...(p.plans ?? {}), [level]: plan } })),
    build: (id) => update((p) => ((p.built ?? []).includes(id) ? p : { ...p, built: [...(p.built ?? []), id] })),
    placeDecor: (id) => update((p) => ((p.decor ?? []).includes(id) ? p : { ...p, decor: [...(p.decor ?? []), id] })),
    start: () => update((p) => (p.started ? p : { ...p, started: new Date().toISOString() })),
    reset: () => update((p) => ({ ...DEFAULT, marks: [], medals: [], plans: {}, games: {}, built: [], decor: [], settings: p.settings })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJourney() {
  const j = useContext(Ctx);
  if (!j) throw new Error('JourneyProvider missing');
  return j;
}

import { type ReactNode, useRef, useState } from 'react';
import { Stars } from '../components/game';
import { useHaptics } from './haptics';
import type { Quiz } from './levels';
import { EstimateGuess, ROUND, SizesCard, SortCard, SplitCard } from './guesses';
import { useJourney } from './state';
import { plain, SamSays } from './UncleSam';
import type { Mood } from './voice';

// Each lesson mission is one scored game: a few short rounds worth up to 100 points each, a
// running score and stars, and a final tally that sets the mission's stars. Rounds reuse the
// game's guesses and simulations, so every point is earned against the same official numbers.

export type Done = (points: number, verdict: string) => void;
interface RoundBase { id: string; label: string; sam: ReactNode; mood?: Mood }
export type RoundSpec =
  | (RoundBase & { kind: 'estimate' | 'split' | 'sizes' | 'sort' | 'choice'; quiz: Quiz })
  | (RoundBase & { kind: 'custom'; play: (ctx: { done: Done; intro: ReactNode }) => ReactNode; lines?: string[] });
export interface GameSpec { id: string; title: string; goal: string; rounds: RoundSpec[] }

/** What Uncle Sam says as rounds are scored. */
export const ROUND_LINES = {
  ...ROUND,
  bonusAsk: (question: string) => `Bonus round. ${question}`,
  bonusRight: 'That’s right! Full points.',
  bonusLater: 'You got it on the second try. Half points.',
  bonusWrong: 'Not quite. One more try, for half points.',
  bonusRevealSay: (answer: string) => `That one’s tricky. Here’s the answer: ${answer}.`,
  over: { 3: 'Three stars! You really know your stuff.', 2: 'Two stars. Nicely done. Play again for three.', 1: 'One star. Every round teaches something. Want another go?' } as Record<number, string>,
};

export const GRADE_POINTS = { spot: 100, close: 60, far: 20 } as const;
/** Three stars at 85% of the possible points, two at 60%, and one for finishing. */
export const starsFor = (score: number, max: number) => (score >= 0.85 * max ? 3 : score >= 0.6 * max ? 2 : 1);

export function GameStep({ game, takeaways }: { game: GameSpec; takeaways?: string[] }) {
  const j = useJourney();
  const best = j.games?.[game.id];
  const [view, setView] = useState<'play' | 'summary'>(best ? 'summary' : 'play');
  const [run, setRun] = useState(0);
  const [r, setR] = useState(0);
  const [pts, setPts] = useState<(number | null)[]>(() => game.rounds.map(() => null));
  const [verdict, setVerdict] = useState('');
  const buzz = useHaptics();
  const top = useRef<HTMLDivElement>(null);
  const n = game.rounds.length;
  const max = n * 100;
  const total = pts.reduce<number>((a, p) => a + (p ?? 0), 0);
  const over = pts.every((p) => p != null);
  const scrollTop = () => requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  // Scored once per round: the latest points, kept in a ref so a repeated call can't count twice.
  const ptsRef = useRef(pts);
  ptsRef.current = pts;
  const done: Done = (p, v) => {
    const cur = ptsRef.current;
    if (cur[r] != null) return;
    const nx = [...cur]; nx[r] = Math.max(0, Math.min(100, Math.round(p)));
    ptsRef.current = nx;
    setPts(nx);
    setVerdict(v);
    if (nx.every((x) => x != null)) {
      const tot = nx.reduce<number>((a, x) => a + (x ?? 0), 0);
      j.scoreGame(game.id, tot, starsFor(tot, max));
      buzz(starsFor(tot, max) === 3 ? 'win' : 'right');
    } else buzz(nx[r]! >= 60 ? 'right' : 'wrong');
  };
  const next = () => { setR((x) => x + 1); setVerdict(''); scrollTop(); buzz('step'); };
  const again = () => { const empty = game.rounds.map(() => null); ptsRef.current = empty; setRun((x) => x + 1); setR(0); setPts(empty); setVerdict(''); setView('play'); scrollTop(); buzz('tap'); };
  const round = game.rounds[r];
  const live = starsFor(total, max);
  // The star meter fills toward three stars as points come in.
  const meter = Math.min(1, total / (0.85 * max));
  if (view === 'summary' && best) {
    return (
      <div className="mgame" ref={top}>
        <SamSays mood="proud" compact auto>{ROUND_LINES.over[best.stars]}</SamSays>
        <div className="card game-over">
          <div className="game-over-title">{game.title}</div>
          <Stars n={best.stars} size="lg" label={`Best: ${best.stars} of 3 stars`} />
          <strong className="game-over-score num">{best.best} <span className="small muted">of {max} points, your best</span></strong>
          {takeaways && <><div className="stat-label">What the game showed</div><ul className="takeaways">{takeaways.map((t) => <li key={t}>{t}</li>)}</ul></>}
          <div className="sim-actions"><button type="button" className="btn btn-primary game-again" onClick={again}>Play again</button></div>
        </div>
      </div>
    );
  }
  return (
    <div className="mgame" ref={top} data-run={run}>
      <div className="game-hud" role="group" aria-label={`${game.title}: round ${Math.min(r + 1, n)} of ${n}, ${total} points`}>
        <span className="game-title">{game.title}</span>
        <span className="game-goal small muted">{game.goal}</span>
        <ol className="game-dots" aria-hidden="true">
          {game.rounds.map((x, k) => <li key={x.id} data-on={k === r || undefined} data-done={pts[k] != null || undefined}>{pts[k] != null ? `+${pts[k]}` : k + 1}</li>)}
        </ol>
        <span className="game-score"><strong className="num">{total}</strong><span className="small muted"> / {max}</span></span>
        <span className="game-meter" aria-hidden="true"><span style={{ width: `${meter * 100}%` }} /><i style={{ left: `${(0.6 / 0.85) * 100}%` }} /><i style={{ left: '100%' }} /></span>
        <Stars n={over ? live : Math.min(live, total >= 0.6 * max ? 2 : total > 0 ? 1 : 0)} size="sm" label={`${live} of 3 stars so far`} />
      </div>
      <section className="game-round" key={`${run}-${r}`} aria-labelledby={`round-${round.id}`}>
        <div className="game-round-label eyebrow" id={`round-${round.id}`}>Round {r + 1} of {n} · {round.label}</div>
        <RoundView round={round} done={done} />
      </section>
      {pts[r] != null && (
        <div className="game-banner" role="status" data-good={(pts[r] ?? 0) >= 60 || undefined}>
          <strong className="game-plus num">+{pts[r]}</strong>
          <span>{verdict}</span>
          {r < n - 1 && <button type="button" className="btn btn-primary game-next" onClick={next}>Next round: {game.rounds[r + 1].label}</button>}
        </div>
      )}
      {over && (
        <div className="card game-over" role="status">
          <SamSays mood={live === 3 ? 'cheering' : 'proud'} compact auto>{ROUND_LINES.over[live]}</SamSays>
          <div className="game-over-title">Final score</div>
          <Stars n={live} size="lg" />
          <strong className="game-over-score num">{total} <span className="small muted">of {max} points{best && best.best > total ? ` · your best: ${best.best}` : best && best.plays > 1 && best.best === total ? ' · a new best' : ''}</span></strong>
          {takeaways && <><div className="stat-label">What the game showed</div><ul className="takeaways">{takeaways.map((t) => <li key={t}>{t}</li>)}</ul></>}
          <div className="sim-actions"><button type="button" className="btn game-again" onClick={again}>Play again</button></div>
        </div>
      )}
    </div>
  );
}

function RoundView({ round, done }: { round: RoundSpec; done: Done }) {
  const ctx = { intro: round.sam, onDone: done };
  switch (round.kind) {
    case 'estimate': return <EstimateGuess quiz={round.quiz} round={ctx} />;
    case 'split': return <SplitCard quiz={round.quiz} round={ctx} />;
    case 'sizes': return <SizesCard quiz={round.quiz} round={ctx} />;
    case 'sort': return <SortCard quiz={round.quiz} round={ctx} />;
    case 'choice': return <ChoiceRound quiz={round.quiz} intro={round.sam} done={done} />;
    default: return <>{round.play({ done, intro: round.sam })}</>;
  }
}

// ---------- a bonus question: full points on the first try, half on the second ----------
const LETTERS = ['A', 'B', 'C', 'D'];
function ChoiceRound({ quiz, intro, done }: { quiz: Quiz; intro: ReactNode; done: Done }) {
  const j = useJourney();
  const [wrong, setWrong] = useState<number[]>([]);
  const [right, setRight] = useState(false);
  const buzz = useHaptics();
  const revealed = !right && wrong.length >= 2;
  const finished = right || revealed;
  const pick = (k: number) => {
    if (finished || wrong.includes(k)) return;
    j.answer(quiz.id, k === quiz.correct); // for the community's first-try rates
    if (k === quiz.correct) {
      setRight(true);
      done(wrong.length ? 50 : 100, wrong.length ? 'Right on the second try: half points.' : 'Right on the first try: full points.');
    } else {
      const w = [...wrong, k]; setWrong(w); buzz('wrong');
      if (w.length >= 2) done(0, 'The answer is marked. No points this time.');
    }
  };
  const ex = plain(quiz.explain);
  const Q = ROUND_LINES;
  const line = right ? (wrong.length ? Q.bonusLater : Q.bonusRight) : revealed ? 'That one’s tricky. Here’s the answer.' : wrong.length ? Q.bonusWrong : intro;
  const say = right ? `${line} ${ex}` : revealed ? `${Q.bonusRevealSay(quiz.choices[quiz.correct])} ${ex}` : wrong.length ? Q.bonusWrong : `${plain(intro)} ${quiz.question}`;
  return (
    <div className="quiz">
      <SamSays mood={right ? 'proud' : revealed ? 'thinking' : wrong.length ? 'worried' : 'happy'} compact auto say={say}>{line}</SamSays>
      <div className="card quiz-card" role="group" aria-labelledby={'q-' + quiz.id}>
        <h2 className="quiz-q" id={'q-' + quiz.id}>{quiz.question}</h2>
        <div className="quiz-choices">
          {quiz.choices.map((c, k) => {
            const state = (right || revealed) && k === quiz.correct ? 'right' : wrong.includes(k) ? 'wrong' : undefined;
            return (
              <button key={k} type="button" className="quiz-choice" data-state={state} disabled={finished || wrong.includes(k)} onClick={() => pick(k)}>
                <span className="quiz-letter" aria-hidden="true">{state === 'right' ? '✓' : state === 'wrong' ? '✕' : LETTERS[k]}</span>
                <span>{c}</span>
              </button>
            );
          })}
        </div>
        {(finished || wrong.length > 0) && (
          <div className="quiz-feedback" data-ok={right} role="status">
            <strong>{right ? 'Correct.' : revealed ? `The answer is ${LETTERS[quiz.correct]}.` : 'Not quite.'}</strong>{' '}
            {finished ? quiz.explain : 'One more try, for half points.'}
          </div>
        )}
      </div>
    </div>
  );
}

/** Every sentence a game can make Uncle Sam say, for recording. */
export function gameLines(game: GameSpec, Q = ROUND_LINES): string[] {
  const out: string[] = [];
  for (const r of game.rounds) {
    const intro = plain(r.sam);
    if (r.kind === 'custom') { out.push(intro, ...(r.lines ?? [])); continue; }
    const q = r.quiz, ex = plain(q.explain);
    if (r.kind === 'choice') {
      out.push(`${intro} ${q.question}`, Q.bonusWrong, `${Q.bonusRight} ${ex}`, `${Q.bonusLater} ${ex}`, `${Q.bonusRevealSay(q.choices[q.correct])} ${ex}`);
    } else {
      out.push(`${intro} ${q.question}`, `${Q.spot} ${ex}`, `${Q.close} ${ex}`, `${Q.farSay(q.choices[0])} ${ex}`);
    }
  }
  return out;
}

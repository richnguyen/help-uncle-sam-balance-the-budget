import { type ReactNode, useState } from 'react';
import { Stars } from '../components/game';
import { type Assessment, assess } from '../lib/assess';
import { pct } from '../lib/format';
import type { Goal } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import { CHALLENGE_LINES } from './script';
import { DESK } from './levels';
import { type Agreement, ballotFrom, compare, myName, type SavedPlan, setMyName, type SharedPlan } from './plans';
import { useShareLink } from './shortlinks';
import { ShareButton, SocialShare } from './ShareButton';
import { useJourney } from './state';
import { SamSays } from './UncleSam';

// The pieces of a friendly challenge: sending your plan, the head-to-head when a friend finishes
// the same level, and how much the two of you agree.

const NAME = Object.fromEntries(OPTIONS_DATA.options.map((o) => [o.id, o.name]));
export const cardName = (id: string) => NAME[id] ?? id;

export const GOAL_DONE: Record<Goal, string> = {
  stabilize: 'stopped Uncle Sam’s debt from outgrowing the economy',
  deficit3: 'cut Uncle Sam’s deficit to 3% of GDP',
  balance: 'balanced Uncle Sam’s budget',
};
export const GOAL_PLAN: Record<Goal, string> = {
  stabilize: 'plan to stop the debt from outgrowing the economy',
  deficit3: 'plan to cut the deficit to 3% of GDP',
  balance: 'plan to balance the budget',
};
const RATING: Record<string, string> = { gentle: 'gentle', moderate: 'moderate', steep: 'steep' };
export const whoPays = (a: Assessment) => (a.revTen + a.spTen ? `${pct(a.revenueShare, 0)} taxes, ${pct(1 - a.revenueShare, 0)} cuts` : 'no cards');

/** A challenge reads like a note from the player: "Rich here. I balanced Uncle Sam’s budget…" */
export const challengeText = (name: string, body: string) => (name ? `${name} here. ${body}` : body);

/** "Challenge a friend": your plan as a link, with an optional name and your answers to the big questions. */
export function ChallengeShare({ level, plan, onShare }: { level: string; plan: SavedPlan; onShare?: () => void }) {
  const j = useJourney();
  const d = DESK.find((x) => x.id === level)!;
  const [name, setName] = useState(myName);
  const ballot = ballotFrom(j.choices);
  const answered = Object.keys(ballot).length;
  const [withBallot, setWithBallot] = useState(answered > 0);
  const url = useShareLink(level, plan, { by: name || undefined, ballot: withBallot ? ballot : undefined })!;
  const text = challengeText(name, `I ${GOAL_DONE[d.goal]} with ${plan.ids.length} policy card${plan.ids.length === 1 ? '' : 's'} and ${plan.stars} of 3 stars. Can you beat my plan?`);
  return (
    <section className="card challenge-share" id="challenge" aria-labelledby="challenge-t">
      <div className="eyebrow">Challenge a friend</div>
      <h2 className="section-title" id="challenge-t">Send your plan and see who does it better</h2>
      <p className="small">Your friend sees your plan, plays the same mission, and finds out how much you two agree. Nothing is sent until you share the link; the plan travels inside the link itself.</p>
      <div className="challenge-fields">
        <div className="field">
          <label htmlFor="ch-name">Sign it with your first name, so your friend knows it’s from you</label>
          <input id="ch-name" className="input" value={name} maxLength={24} placeholder="Your first name" autoComplete="given-name"
            onChange={(e) => { setName(e.target.value); setMyName(e.target.value); }} />
        </div>
        {answered > 0 && (
          <label className="switch"><input type="checkbox" checked={withBallot} onChange={(e) => setWithBallot(e.target.checked)} /> Include my answers to the {answered} big question{answered === 1 ? '' : 's'}</label>
        )}
      </div>
      <div className="sb-actions"><ShareButton text={text} url={url} label="Send the challenge" className="btn btn-primary" kind="plan" onShare={onShare} /></div>
      <SocialShare text={text} url={url} kind="plan" onShare={onShare} />
    </section>
  );
}

export type Outcome = 'won' | 'tied' | 'lost';
interface Row { label: string; b: number; mine: ReactNode; theirs: ReactNode }

/** The head-to-head measures: stars, how hard each plan hits the economy, and how many cards it takes. */
export function headToHead(mine: Assessment, theirs: Assessment) {
  const steep = (a: Assessment) => a.econ.peakStep;
  const rows: Row[] = [
    { label: 'Stars', b: mine.ev.stars - theirs.ev.stars, mine: <Stars n={mine.ev.stars} size="sm" />, theirs: <Stars n={theirs.ev.stars} size="sm" /> },
    { label: 'Steepest year for the economy', b: Math.abs(steep(mine) - steep(theirs)) < 0.0005 ? 0 : steep(theirs) - steep(mine), mine: <span className="num">{pct(steep(mine), 1)} of GDP · {RATING[mine.econ.rating]}</span>, theirs: <span className="num">{pct(steep(theirs), 1)} of GDP · {RATING[theirs.econ.rating]}</span> },
    { label: 'Policy cards used', b: theirs.shares.length - mine.shares.length, mine: <span className="num">{mine.shares.length}</span>, theirs: <span className="num">{theirs.shares.length}</span> },
  ];
  const wins = rows.filter((r) => r.b > 0).length;
  const losses = rows.filter((r) => r.b < 0).length;
  const same = mine.shares.length === theirs.shares.length && mine.shares.every((x) => theirs.shares.some((y) => y.id === x.id));
  const outcome: Outcome | null = !mine.met ? null : wins > losses ? 'won' : wins === losses ? 'tied' : 'lost';
  return { rows, outcome, same };
}

/** Head-to-head on the same level, as a table. */
export function HeadToHead({ mine, theirs, by, sam = true, auto = true }: { mine: Assessment; theirs: Assessment; by: string; sam?: boolean; auto?: boolean }) {
  const { rows, outcome, same } = headToHead(mine, theirs);
  return (
    <div className="h2h">
      {outcome && sam && <SamSays mood={outcome === 'won' ? 'cheering' : outcome === 'tied' ? 'happy' : 'thinking'} compact auto={auto}>{CHALLENGE_LINES[outcome]}</SamSays>}
      {outcome && !sam && <p><strong>{CHALLENGE_LINES[outcome]}</strong></p>}
      {same && <p className="small"><strong>Same cards as {by}.</strong> Swap one for a gentler card, or do it with fewer, to pull ahead.</p>}
      <table className="h2h-table">
        <thead><tr><th scope="col"><span className="sr-only">Measure</span></th><th scope="col">You</th><th scope="col">{by}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td data-win={r.b > 0}>{r.mine}</td>
              <td data-win={r.b < 0}>{r.theirs}</td>
            </tr>
          ))}
          <tr><th scope="row">Who pays</th><td>{whoPays(mine)}</td><td>{whoPays(theirs)}</td></tr>
        </tbody>
      </table>
      <p className="small muted">More stars, a gentler steepest year, and fewer cards each count as a win. Who pays is a matter of taste, so it doesn’t count either way.</p>
    </div>
  );
}

/** How much two players agree: shared cards and matching answers to the big questions. */
export function AgreementCard({ a, by, shareUrl }: { a: Agreement; by: string; shareUrl?: string }) {
  if (!a.of) return null;
  const text = `${by} and I agree on ${a.agree} of ${a.of} choices about Uncle Sam’s budget. How about you?`;
  return (
    <div className="agree">
      <div className="agree-big"><span className="num">{a.agree}</span><span className="small"> of {a.of}</span></div>
      <div>
        <strong>You and {by} agree on {a.agree} of {a.of} choices.</strong>
        <p className="small muted">Counted over every policy card either of you played and every big question you both answered.</p>
      </div>
      <dl className="agree-lists">
        {a.bothCards.length > 0 && <div><dt>You both played</dt><dd>{a.bothCards.map(cardName).join('; ')}</dd></div>}
        {a.onlyMine.length > 0 && <div><dt>Only you played</dt><dd>{a.onlyMine.map(cardName).join('; ')}</dd></div>}
        {a.onlyTheirs.length > 0 && <div><dt>Only {by} played</dt><dd>{a.onlyTheirs.map(cardName).join('; ')}</dd></div>}
        {a.sameAnswers.length > 0 && <div><dt>Same answer</dt><dd>{a.sameAnswers.map((x) => `${x.question} (${x.answer})`).join('; ')}</dd></div>}
        {a.differentAnswers.length > 0 && <div><dt>Different answers</dt><dd>{a.differentAnswers.map((x) => `${x.question}: you said ${x.mine}, ${by} said ${x.theirs}`).join('; ')}</dd></div>}
      </dl>
      {shareUrl && <div className="sb-actions"><ShareButton text={text} url={shareUrl} label="Share how much we agree" /></div>}
    </div>
  );
}

export const assessShared = (p: SharedPlan | (SavedPlan & { goal: Goal })) => assess(p.goal, p.ids, p.lv, p.gradual);
export { compare };

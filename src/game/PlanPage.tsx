import { useEffect, useState } from 'react';
import { EconMeter, SplitBar, Stars } from '../components/game';
import { Section } from '../components/ui';
import { LAST_FY } from '../lib/assess';
import { countStep, rpc } from '../lib/backend';
import { pct } from '../lib/format';
import { acceptChallenge } from './challenge';
import { AgreementCard, assessShared, cardName, GOAL_PLAN, HeadToHead, whoPays } from './ChallengeParts';
import { PlanProposal } from './DeskExtras';
import { LevelIcon } from './icons';
import { missionLong, missionShort, STOP_BY_ID, stopForCode, STOPS } from './levels';
import { BALLOT, ballotFrom, closestPreset, compare, decodePlan, encodePlan, myName } from './plans';
import { useShareLink } from './shortlinks';
import { PLAN_LINES } from './script';
import { useJourney } from './state';
import { SamSays } from './UncleSam';
import { ActionBar } from '../components/ActionBar';

// A friend's shared plan (#plan?p=…): what they did, how it scored, and the challenge to beat it.

export default function PlanPage({ param }: { param: string | null }) {
  const j = useJourney();
  // A short link (id=…) is looked up on the site's server; a long link carries the plan itself.
  const q = new URLSearchParams(param ?? '');
  const id = q.get('id');
  const [stored, setStored] = useState<{ id: string; code: string } | 'missing' | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    rpc<{ code: string } | null>('get_plan', { plan_id: id })
      .then((r) => { if (alive) setStored(r?.code ? { id, code: r.code } : 'missing'); })
      .catch(() => { if (alive) setStored('missing'); });
    return () => { alive = false; };
  }, [id]);
  const full = id && stored && stored !== 'missing' && stored.id === id ? new URLSearchParams(`${stored.code}&${q.toString()}`) : q;
  const plan = id && (!stored || stored === 'missing') ? null : decodePlan(full);
  const mineSaved = plan ? j.plans?.[plan.level] : undefined;
  const myLink = useShareLink(plan?.level, mineSaved ?? null, { by: myName() || undefined, ballot: ballotFrom(j.choices) });
  if (id && !stored) return <div className="level"><p className="small muted" role="status">Opening the plan…</p></div>;
  if (!plan) {
    return (
      <div className="level">
        <header className="level-head"><h1 className="page-title">A plan from a friend</h1></header>
        <SamSays mood="worried" auto>{PLAN_LINES.broken}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href="#journey">Start the game</a></ActionBar>
      </div>
    );
  }
  const stop = STOP_BY_ID[plan.level];
  const by = plan.by || 'Your friend';
  const a = assessShared(plan);
  const mine = mineSaved ? assessShared({ ...mineSaved, goal: plan.goal }) : null;
  // Cards count only once the player has a plan of their own on this level; until then, only the
  // big questions both of you answered.
  const agreement = compare({ ids: mineSaved?.ids ?? [], ballot: ballotFrom(j.choices) }, { ids: mineSaved ? plan.ids : [], ballot: plan.ballot });
  const near = closestPreset(plan.ids);
  const slidersUsed = Object.values(plan.lv).some((v) => v !== 0);
  const taxes = a.shares.filter((s) => s.side === 'revenue');
  const cuts = a.shares.filter((s) => s.side === 'spending');
  const answered = BALLOT.filter((q) => plan.ballot?.[q.key]);
  const take = () => { countStep('taken', encodePlan(plan)); acceptChallenge(plan); location.hash = plan.level; };
  const RATING: Record<string, string> = { gentle: 'gentle on the economy', moderate: 'moderate on the economy', steep: 'steep on the economy' };
  const share = (x: number) => (x >= 1 ? 'the whole gap' : x < 0.01 ? 'under 1%' : `${Math.round(x * 100)}%`);

  return (
    <div className="level planpage">
      <header className="level-head">
        <div className="eyebrow level-eyebrow"><LevelIcon id={stop.icon} size={16} /> A plan from a friend · {missionLong(stop)} · {stop.difficulty}</div>
        <h1 className="page-title">{by === 'Your friend' ? 'Your friend’s' : `${by}’s`} {GOAL_PLAN[plan.goal]}</h1>
      </header>
      {/* The first screen: what the plan scored, and the button to take it on. */}
      <section className="card friendplan-quick" aria-label="The challenge">
        <div className="friendplan-quick-line">
          <Stars n={a.ev.stars} size="md" label={`${a.ev.stars} of 3 stars`} />
          <span className="small">{a.shares.length} card{a.shares.length === 1 ? '' : 's'} · {whoPays(a)} · {RATING[a.econ.rating]}</span>
        </div>
        <button type="button" className="btn btn-primary btn-lg bar-dup" onClick={take}>{mine ? 'Play it again and try to beat it' : 'Take the challenge'}</button>
        <span className="small muted">Opens {missionShort(stop)} right away · about {stop.minutes} minutes · no sign-up</span>
      </section>
      <SamSays mood="surprised" compact auto say={mine ? PLAN_LINES.played : PLAN_LINES.intro}>{mine ? PLAN_LINES.played : plan.by ? `${plan.by} sent you their plan for my budget. Have a look, then see if you can do better.` : PLAN_LINES.intro}</SamSays>

      <section className="card friendplan" aria-label="How the plan scores">
        <div className="friendplan-head">
          <Stars n={a.ev.stars} size="lg" label={`${a.ev.stars} of 3 stars`} />
          <div>
            <strong>{a.met ? 'Meets the goal' : `Closes ${Math.round(a.progress * 100)}% of the gap`}</strong>
            <div className="small muted">FY{LAST_FY}: deficit {a.last.deficit <= 0 ? 'balanced' : `${pct(a.last.deficit / a.last.gdp, 1)} of GDP`}, debt {pct(a.last.debt / a.last.gdp, 0)} of GDP · {a.shares.length} card{a.shares.length === 1 ? '' : 's'}{slidersUsed ? ' plus across-the-board changes' : ''}{plan.gradual ? ', phased in' : ''}</div>
          </div>
        </div>
        <div className="friendplan-bars">
          <div><div className="stat-label">Hit to the economy</div><EconMeter peakStep={a.econ.peakStep} /></div>
          <div><div className="stat-label">Who pays: {whoPays(a)}</div><SplitBar revenue={a.revTen} spending={a.spTen} /></div>
        </div>
      </section>

      <ActionBar className="plan-cta" label="The challenge">
        <button type="button" className="btn btn-primary" onClick={take}>{mine ? 'Play it again and try to beat it' : 'Take the challenge'}</button>
        <a className="btn" href="#journey">Start from mission 1.1</a>
      </ActionBar>
      <p className="small muted">Beat {by === 'Your friend' ? 'their' : `${by}’s`} plan on stars, a gentler steepest year for the economy, or fewer cards.</p>

      {mine && (
        <Section id="vs" title="Your plan against theirs" sub={`Your latest plan on ${missionShort(stop)}, scored the same way.`}>
          <HeadToHead mine={mine} theirs={a} by={by === 'Your friend' ? 'Them' : by} sam={false} />
        </Section>
      )}
      {agreement.of > 0 && (
        <Section id="agree" title="How much you agree">
          <AgreementCard a={agreement} by={by === 'Your friend' ? 'your friend' : by} shareUrl={myLink} />
        </Section>
      )}

      <Section id="cards" title="The cards they played" sub="Each card’s share of the gap is measured on its own; together they can add up to a little less, because they interact through interest costs.">
        <div className="grid-2">
          {[{ t: 'Taxes', list: taxes }, { t: 'Spending cuts', list: cuts }].map((g) => (
            <div className="card" key={g.t}>
              <div className="stat-label">{g.t}</div>
              {g.list.length ? (
                <ul className="plan-cards">{g.list.map((s) => <li key={s.id}><span>{cardName(s.id)}</span><span className="num muted">{share(s.share)}</span></li>)}</ul>
              ) : <p className="small muted">None.</p>}
            </div>
          ))}
        </div>
        {near && <div style={{ marginTop: 10 }}><PlanProposal id={near.id} /></div>}
      </Section>

      {answered.length > 0 && (
        <Section id="ballot" title="Their answers to the big questions">
          <ul className="plan-ballot">
            {answered.map((q) => {
              const v = plan.ballot![q.key];
              const yours = j.choices[q.key];
              return (
                <li key={q.key}>
                  <span className="small muted">{missionShort(stopForCode(q.level)!)}</span>
                  <strong>{q.question}</strong>
                  <span>{q.labels[q.values.indexOf(v)]}{yours ? <span className="small muted"> · you said {q.labels[q.values.indexOf(yours)] ?? yours}</span> : <span className="small muted"> · play {missionShort(stopForCode(q.level)!)} to answer</span>}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      <p className="small muted">Plans are scored with the same CBO estimates and rules as the game’s budget desk. See <a href="#sources">Sources &amp; methods</a>.</p>
    </div>
  );
}

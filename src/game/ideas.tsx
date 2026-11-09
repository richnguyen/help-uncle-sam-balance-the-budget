import { lower } from '../lib/format';
import { type ReactNode, useState } from 'react';
import { Stars } from '../components/game';
import { assess, CTX } from '../lib/assess';
import { type Goal } from '../lib/plan';
import { PRESETS } from '../lib/planData';
import { LEVERS, type Levers, ZERO } from '../lib/sandbox';
import { cardName } from './ChallengeParts';
import { proposalFor } from './DeskExtras';
import { splitLabel } from './duel';

// Plan ideas on each budget desk, in two kinds kept apart on purpose. "Plans that work well":
// plans built for this game's goal and scored by the same engine as the player's own, each with
// one idea behind it. "Proposals in Congress": real plans offered by members of Congress, each
// shown with the game's closest version in cards. Neither is a recommendation: every idea shows
// its score, who pays, and what it cuts, and the player can change any part of it.

export interface Idea { id: string; name: string; idea: string; ids: string[]; lv?: Partial<Levers>; gradual: boolean }

// The seven cards every balance-the-budget idea starts from: tax breaks and overpayments.
const TRIM = ['limit-itemized-15pct', 'cap-health-exclusion', 'carried-interest', 'medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient', 'cut-defense-budget', 'crop-insurance-subsidies'];

export const IDEAS: Record<Goal, Idea[]> = {
  stabilize: [
    { id: 'overpaying', name: 'Stop overpaying', gradual: true,
      idea: 'Pays Medicare’s private insurers and hospital outpatient departments closer to what the same care costs elsewhere, trims farm insurance subsidies, and caps the tax break for the priciest employer health plans. Social Security and tax rates stay as they are.',
      ids: ['cap-health-exclusion', 'crop-insurance-subsidies', 'medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient'] },
    { id: 'prices', name: 'Make prices tell the truth', gradual: true,
      idea: 'Raises the gas and alcohol taxes, which haven’t kept up with inflation, so prices carry more of the costs of driving and drinking, then adds the same health-care and farm-subsidy savings. Taxes on what people buy cost lower-income households a bigger share of what they earn.',
      ids: ['gas-tax-15c', 'alcohol-tax', 'crop-insurance-subsidies', 'site-neutral-hospital-outpatient', 'medicare-advantage-benchmarks', 'cap-health-exclusion'] },
    { id: 'two-moves', name: 'Two big moves', gradual: true,
      idea: 'Only two cards: limit what itemized deductions save high earners, and trim the defense budget. Easy to explain, and nothing else changes.',
      ids: ['limit-itemized-15pct', 'cut-defense-budget'] },
    { id: 'top-care', name: 'Ask the top, pay fairly for care', gradual: true,
      idea: 'Applies the Social Security payroll tax to earnings above $250,000 and taxes carried interest as ordinary income, then pays Medicare’s insurers and hospitals more efficiently and trims defense. Close to half new taxes, half cuts.',
      ids: ['ss-tax-earnings-over-250k', 'carried-interest', 'medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient', 'cut-defense-budget'] },
  ],
  deficit3: [
    { id: 'breaks-defense', name: 'Trim the tax breaks, plus defense', gradual: true,
      idea: 'Limits what itemized deductions save high earners, caps the tax break for the priciest employer health plans, pays Medicare’s private insurers less, and trims the defense budget. Four cards, no new tax rates.',
      ids: ['limit-itemized-15pct', 'cap-health-exclusion', 'medicare-advantage-benchmarks', 'cut-defense-budget'] },
    { id: 'ss-top', name: 'Shore up Social Security, ask the top', gradual: true,
      idea: 'Applies the payroll tax to earnings above $250,000 and slowly raises the full retirement age to 70 for people born in 1964 or later, alongside a limit on deductions, Medicare payment savings, and a smaller defense budget. People already retired keep their benefits; younger workers would wait longer for full benefits.',
      ids: ['limit-itemized-15pct', 'ss-tax-earnings-over-250k', 'raise-full-retirement-age-70', 'site-neutral-hospital-outpatient', 'medicare-advantage-benchmarks', 'cut-defense-budget'] },
    { id: 'prices-big', name: 'Make prices tell the truth', gradual: true,
      idea: 'Higher gas and alcohol taxes, a limit on deductions and on the tax break for pricey health plans, Medicare payment savings, less for defense, and smaller farm subsidies. Many small moves, each easy on the economy; the taxes on what people buy cost lower-income households a bigger share of income.',
      ids: ['gas-tax-15c', 'alcohol-tax', 'cap-health-exclusion', 'limit-itemized-15pct', 'medicare-advantage-benchmarks', 'site-neutral-hospital-outpatient', 'cut-defense-budget', 'crop-insurance-subsidies'] },
  ],
  balance: [
    { id: 'everyone', name: 'Everyone chips in', gradual: true,
      idea: 'Seven cards that trim tax breaks and overpayments, then 8% more tax revenue across the board and 8% less for every part of the budget, Social Security, Medicare, and Medicaid included. The most even split, and it cuts current retirees’ benefits too.',
      ids: TRIM, lv: { revenues: 8, socialSecurity: -8, medicare: -8, medicaid: -8, otherMandatory: -8, defense: -8, nondefense: -8 } },
    { id: 'protect-care', name: 'Protect Social Security and health care', gradual: true,
      idea: 'The same seven cards, then 11% more tax revenue and 11% less for defense, non-defense programs, and other mandatory programs. Social Security, Medicare, and Medicaid stay as scheduled; public investment and programs such as food aid take the cut instead.',
      ids: TRIM, lv: { revenues: 11, defense: -11, nondefense: -11, otherMandatory: -11 } },
    { id: 'mostly-taxes', name: 'Mostly taxes', gradual: true,
      idea: 'The same seven cards, then 15% more tax revenue across the board. Every spending program stays as scheduled; nearly everyone who pays taxes pays more.',
      ids: TRIM, lv: { revenues: 15 } },
  ],
};

const full = (lv?: Partial<Levers>): Levers => ({ ...ZERO, ...(lv ?? {}) });
const same = (a: { ids: string[]; lv: Levers; gradual: boolean }, b: { ids: string[]; lv: Levers; gradual: boolean }) =>
  a.gradual === b.gradual && [...a.ids].sort().join() === [...b.ids].sort().join() && LEVERS.every((l) => a.lv[l.id] === b.lv[l.id]);

/** What the plan asks of whom, beyond its cards: the groups the game watches. */
function reaches(ids: string[], lv: Levers) {
  const tags = new Set(CTX.options.filter((o) => ids.includes(o.id)).flatMap((o) => o.econ.tags));
  const out: string[] = [];
  if (tags.has('retirees') || lv.socialSecurity < 0 || lv.medicare < 0) out.push('Cuts current retirees’ benefits');
  if (tags.has('lowIncome') || lv.medicaid < 0 || lv.otherMandatory < 0) out.push('Cuts programs for low-income families');
  if (tags.has('investment') || lv.nondefense < 0) out.push('Cuts public investment');
  return out;
}

interface Props { goal: Goal; current: { ids: string[]; lv: Levers; gradual: boolean }; canLoad: boolean; onLoad: (p: { ids: string[]; lv: Levers; gradual: boolean }) => void }

function IdeaCard({ goal, plan, current, canLoad, onLoad, title, by, children }: Omit<Props, 'goal'> & { goal: Goal; plan: { id: string; ids: string[]; lv: Levers; gradual: boolean }; title: string; by?: ReactNode; children: ReactNode }) {
  const a = assess(goal, plan.ids, plan.lv, plan.gradual);
  const levers = LEVERS.filter((l) => plan.lv[l.id] !== 0);
  const flags = reaches(plan.ids, plan.lv);
  const loaded = same(current, plan);
  return (
    <article className="idea" data-idea={plan.id} data-met={a.met}>
      <div className="idea-head">
        <h3 className="idea-title">{title}</h3>
        {by}
      </div>
      {children}
      <ul className="idea-chips" aria-label="What it does">
        {plan.ids.map((id) => { const o = CTX.options.find((x) => x.id === id)!; return <li key={id} data-side={o.side}><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{cardName(id)}</li>; })}
        {levers.map((l) => <li key={l.id} data-side={l.id === 'revenues' ? 'revenue' : 'spending'} data-lever><span className="rcard-kind" data-side={l.id === 'revenues' ? 'revenue' : 'spending'}>All</span>{l.label} {plan.lv[l.id] > 0 ? '+' : '−'}{Math.abs(plan.lv[l.id])}%</li>)}
      </ul>
      <dl className="idea-score">
        <div><dt>Score</dt><dd><Stars n={a.ev.stars} size="sm" label={`${a.ev.stars} of 3 stars`} /> {a.met ? 'Goal met' : `Closes ${Math.floor(a.progress * 100)}% of the gap`}</dd></div>
        <div><dt>Economy</dt><dd>{a.econ.rating[0].toUpperCase() + a.econ.rating.slice(1)}</dd></div>
        <div><dt>Who pays</dt><dd>{splitLabel(a)}</dd></div>
      </dl>
      <div className="idea-foot">
        <span className="idea-flags">{flags.length ? flags.map((f) => <span key={f} className="pill pill-warn">{f}</span>) : <span className="pill pill-ok">Keeps the game’s ground rules</span>}</span>
        {canLoad && <button type="button" className={'btn' + (loaded ? '' : ' btn-primary')} disabled={loaded} onClick={() => onLoad(plan)}>{loaded ? 'On your desk' : 'Load this plan'}</button>}
      </div>
    </article>
  );
}

export function PlanIdeas({ goal, current, canLoad, onLoad }: Props) {
  const [tab, setTab] = useState<'ideas' | 'congress'>('ideas');
  const congress = PRESETS.filter((p) => p.ids?.length && proposalFor(p.id));
  return (
    <section className="card ideas" id="plan-ideas" aria-labelledby="ideas-t">
      <div className="ideas-head">
        <h2 className="section-title" id="ideas-t">Plan ideas</h2>
        <div className="ideas-tabs" role="tablist" aria-label="Kinds of plans">
          <button type="button" role="tab" id="ideas-tab-ideas" aria-selected={tab === 'ideas'} aria-controls="ideas-panel" onClick={() => setTab('ideas')}>Plans that work well</button>
          <button type="button" role="tab" id="ideas-tab-congress" aria-selected={tab === 'congress'} aria-controls="ideas-panel" onClick={() => setTab('congress')}>Proposals in Congress</button>
        </div>
      </div>
      <p className="small muted">
        {tab === 'ideas'
          ? 'Built for this goal and scored the same way as your plan, each around one idea. They’re ideas, not advice: each says who pays and what it cuts.'
          : 'Real plans from members of Congress, each with the game’s closest version in cards. The cards only approximate a real plan, and on this desk they may fall short of the goal.'}
        {' '}{canLoad ? 'Load one, then change any card or slider.' : 'Meet the goal once on your own, and you can load any of these with one tap.'}
      </p>
      <div className="ideas-list" id="ideas-panel" role="tabpanel" aria-labelledby={'ideas-tab-' + tab}>
        {tab === 'ideas'
          ? IDEAS[goal].map((x) => (
            <IdeaCard key={x.id} goal={goal} plan={{ id: x.id, ids: x.ids, lv: full(x.lv), gradual: x.gradual }} current={current} canLoad={canLoad} onLoad={onLoad} title={x.name}>
              <p className="small">{x.idea}</p>
            </IdeaCard>
          ))
          : congress.map((p) => {
            const r = proposalFor(p.id)!;
            return (
              <IdeaCard key={p.id} goal={goal} plan={{ id: 'congress-' + p.id, ids: p.ids!, lv: { ...ZERO }, gradual: true }} current={current} canLoad={canLoad} onLoad={onLoad}
                title={r.name} by={<span className="small muted">{r.by}, {r.year} · <a href={r.url} target="_blank" rel="noreferrer">Read it</a></span>}>
                <p className="small">{r.match}</p>
                <p className="small muted">The game’s closest version: {lower(p.name)}.</p>
              </IdeaCard>
            );
          })}
      </div>
    </section>
  );
}

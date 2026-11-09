import congress from '../data/curated/congress.json';
import { Stars } from '../components/game';
import { BADGES } from '../lib/game';
import { AwardIcon } from './icons';

// Budget-desk extras: the accomplishments shown under a level's title, and the links from each
// policy card, and from a finished plan, to the closest real proposal in Congress.

interface Bill { bill: string; congress: number; title: string; sponsor: string; year: number; url: string; match: string }
interface Plan { name: string; by: string; year: number; url: string; match: string }
type Maybe<T> = T | { none: true; note: string };
const DATA = congress as unknown as { options: Record<string, Maybe<Bill>>; plans: Record<string, Maybe<Plan>> };

/** Congress.gov's own legislation search, for options with no close bill. */
export const searchCongress = (q: string) =>
  'https://www.congress.gov/search?q=' + encodeURIComponent(JSON.stringify({ source: 'legislation', search: q }));

export function CongressLink({ id, topic }: { id: string; topic: string }) {
  const b = DATA.options[id];
  // Just the linked title; the bill's own page has the details.
  return (
    <div className="congress">
      <span className="congress-k">In Congress</span>
      {b && !('none' in b)
        ? <a href={b.url} target="_blank" rel="noreferrer" title={`${b.sponsor}, ${b.year}. ${b.match}`}>{b.bill}, {b.title} ({b.year})</a>
        : <a href={searchCongress(topic)} target="_blank" rel="noreferrer" title={b && 'none' in b ? b.note : undefined}>No close bill: search Congress</a>}
    </div>
  );
}

/** The real proposal closest to one of the game's ready-made plans, if there is one. */
export const proposalFor = (id: string) => { const p = DATA.plans[id]; return p && !('none' in p) ? p : null; };

export function PlanProposal({ id }: { id: string }) {
  const p = DATA.plans[id];
  if (!p || 'none' in p) return null;
  return (
    <div className="congress">
      <span className="congress-k">Closest real proposal</span>
      <a href={p.url} target="_blank" rel="noreferrer" title={`${p.by}, ${p.year}. ${p.match}`}>{p.name}</a>
    </div>
  );
}

/** Stars for this level and the budget-desk badges, shown under the level title. */
export function Accomplishments({ stars, badges }: { stars: number; badges: string[] }) {
  const got = BADGES.filter((b) => badges.includes(b.id)).length;
  return (
    <div className="accomp" aria-label="Accomplishments">
      <div className="accomp-points">
        <Stars n={stars} size="md" label={`Best on this mission: ${stars} of 3 stars`} />
        <span className="small muted">best on this mission</span>
      </div>
      <div className="accomp-badges">
        <span className="accomp-count"><AwardIcon size={16} /> {got} of {BADGES.length} badges</span>
        <ul className="accomp-list">
          {BADGES.map((b) => {
            const on = badges.includes(b.id);
            return (
              <li key={b.id} data-got={on} title={b.desc}>
                <span className="accomp-icon" aria-hidden="true"><AwardIcon size={14} /></span>
                <span>{b.name}</span>
                <span className="sr-only">{on ? ' (earned)' : ` (not yet: ${b.desc})`}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

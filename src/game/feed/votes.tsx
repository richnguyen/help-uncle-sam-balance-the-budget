import FLAGS from '../../data/generated/flags.json';
import { load } from '../../lib/storage';
import { useVotes } from '../../lib/votes';
import { areaForZip } from '../../lib/zip';
import type { Bill, FloorVote } from './items';

// A followed bill's floor votes, as the House Clerk and the Senate record them: the question, the
// result, the official yeas and nays, and a link to the record. If the player saved a ZIP code,
// how that state's members voted, as the record lists them (party and state included, as the
// record shows them). Facts only: no colors by party, no scores, no ratings of members.

const fmt = (iso: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

/** The player's state, from the ZIP code they saved (if any). */
export function useHomeState(): string | null {
  const votes = useVotes();
  const zip = (votes.zipHome === 'database' ? votes.mine.zip : load<string>('zip', '')) || '';
  if (votes.mine.state) return votes.mine.state;
  const a = zip ? areaForZip(zip) : null;
  return a?.kind === 'state' ? a.abbr : null;
}

/**
 * A state's or territory's flag: a plain geographic marker, shown the same way beside every
 * lawmaker the game names (bill sponsors, members in floor votes), whoever they are. Decorative:
 * the state is always in the text beside it. Files from Wikimedia Commons; credits in Sources.
 */
export function Flag({ st }: { st: string }) {
  if (!(st in FLAGS.flags)) return null;
  return <img className="st-flag" src={`flags/${st}.png`} alt="" aria-hidden="true" width={24} height={16} loading="lazy" decoding="async" />;
}

/** "Sen. Crapo, Mike [R-ID]": the sponsor exactly as Congress.gov lists them. */
export function sponsorLine(s: NonNullable<Bill['sponsor']>) {
  return s.display || `${s.name} [${s.party}-${s.state}${s.district ? '-' + s.district : ''}]`;
}

function OneVote({ v, home }: { v: FloorVote; home: string | null }) {
  const mine = home ? v.members.filter((m) => m[2] === home) : [];
  const t = v.totals;
  return (
    <li className="fv">
      <div className="fv-head">
        <strong>{v.chamber}</strong> · roll call {v.roll} · {fmt(v.date)}
      </div>
      <div className="fv-q">{v.question}: <strong>{v.result}</strong></div>
      <div className="fv-totals num">Yea {t.yea} · Nay {t.nay}{t.present ? ` · Present ${t.present}` : ''}{t.notVoting ? ` · Not voting ${t.notVoting}` : ''}</div>
      {home && (mine.length
        ? <details className="fv-mine"><summary>How {home}’s {v.chamber === 'Senate' ? 'senators' : 'representatives'} voted ({mine.length})</summary>
            <ul>{mine.map((m) => <li key={m.join()}><Flag st={m[2]} />{m[0]} ({m[1]}-{m[2]}): <strong>{m[3]}</strong></li>)}</ul>
          </details>
        : <p className="fv-mine small muted">No members from {home} in this record.</p>)}
      <a className="fv-src small" href={v.url} target="_blank" rel="noopener noreferrer">Official record ({v.chamber === 'House' ? 'House Clerk' : 'U.S. Senate'})</a>
    </li>
  );
}

/** The bill's floor votes, newest first; nothing at all before a bill reaches the floor. */
export function FloorVotes({ bill }: { bill: Bill }) {
  const home = useHomeState();
  if (!bill.votes?.length) return null;
  return (
    <div className="fv-wrap">
      <span className="stat-label">Floor votes</span>
      <ul className="fv-list">{bill.votes.map((v) => <OneVote key={`${v.chamber}${v.roll}${v.date}`} v={v} home={home} />)}</ul>
      {!home && <p className="small muted fv-hint">Save your ZIP code in mission 1.4 to see how your state’s members voted.</p>}
    </div>
  );
}

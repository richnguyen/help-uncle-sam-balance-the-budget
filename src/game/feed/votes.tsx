import FLAGS from '../../data/generated/flags.json';
import { load } from '../../lib/storage';
import { useVotes } from '../../lib/votes';
import { areaForZip } from '../../lib/zip';
import type { Bill, FloorNote, FloorVote } from './items';

// A bill's floor votes, as the House Clerk and the Senate record them: the question, the result,
// the official yeas and nays, a tie the Vice President broke, the sponsor's own vote, and a link
// to the record; passages with no roll call (voice vote, unanimous consent) say so. If the player
// saved a ZIP code, how that state's members voted, as the record lists them. Facts only: no
// colors by party, no scores, no ratings of members.

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

/**
 * The sponsor's line in a roll call, if they voted in it: same chamber, same state, and the
 * record's name is their last name ("Smith (MO)", "Scott, David", "Catherine Cortez Masto").
 * Only a single clear match counts; anything ambiguous shows nothing rather than a guess.
 */
export function sponsorVote(s: Bill['sponsor'], v: FloorVote) {
  if (!s) return null;
  if (v.chamber !== (/^Sen\b/.test(s.name) ? 'Senate' : 'House')) return null;
  const last = s.name.replace(/^(Rep|Sen|Del|Resident Commissioner)\.?\s+/i, '').split(',')[0].trim().toLowerCase();
  const hits = v.members.filter((m) => {
    if (m[2] !== s.state) return false;
    const n = m[0].replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
    return n.split(',')[0].trim() === last || n.endsWith(' ' + last);
  });
  return hits.length === 1 ? hits[0] : null;
}

function OneVote({ v, home, sponsor }: { v: FloorVote; home: string | null; sponsor: Bill['sponsor'] }) {
  const mine = home ? v.members.filter((m) => m[2] === home) : [];
  const t = v.totals;
  const sv = sponsorVote(sponsor, v);
  return (
    <li className="fv">
      <div className="fv-head">
        <strong>{v.chamber}</strong> · roll call {v.roll} · {fmt(v.date)}
      </div>
      <div className="fv-q">{v.question}: <strong>{v.result}</strong></div>
      <div className="fv-totals num">Yea {t.yea} · Nay {t.nay}{t.present ? ` · Present ${t.present}` : ''}{t.notVoting ? ` · Not voting ${t.notVoting}` : ''}</div>
      {v.tieBreaker && <div className="fv-tie small">Tied {t.yea}–{t.nay}; the {v.tieBreaker.by} broke the tie: <strong>{v.tieBreaker.vote}</strong></div>}
      {sv && <div className="fv-sponsor small"><Flag st={sv[2]} /><span className="muted">The sponsor’s vote:</span> {sv[0]} ({sv[1]}-{sv[2]}): <strong>{sv[3]}</strong></div>}
      {home && (mine.length
        ? <details className="fv-mine"><summary>How {home}’s {v.chamber === 'Senate' ? 'senators' : 'representatives'} voted ({mine.length})</summary>
            <ul>{mine.map((m) => <li key={m.join()}><Flag st={m[2]} />{m[0]} ({m[1]}-{m[2]}): <strong>{m[3]}</strong></li>)}</ul>
          </details>
        : <p className="fv-mine small muted">No members from {home} in this record.</p>)}
      <a className="fv-src small" href={v.url} target="_blank" rel="noopener noreferrer">Official record ({v.chamber === 'House' ? 'House Clerk' : 'U.S. Senate'})</a>
    </li>
  );
}

const HOW: Record<FloorNote['how'], string> = { 'voice vote': 'a voice vote', 'unanimous consent': 'unanimous consent', 'without objection': 'agreement without objection' };

/** A passage with no roll call: what Congress.gov records, and why there's no member list. */
function NoRollCall({ n }: { n: FloorNote }) {
  return (
    <li className="fv fv-noroll">
      <div className="fv-head"><strong>{n.chamber}</strong> · no roll call · {fmt(n.date)}</div>
      <div className="fv-q">{n.text}</div>
      <p className="small muted">Passed by {HOW[n.how]}, which records no member-by-member votes.</p>
    </li>
  );
}

/** The bill's floor votes and roll-call-free passages, newest first; nothing before a bill reaches the floor. */
export function FloorVotes({ bill }: { bill: Bill }) {
  const home = useHomeState();
  const rows = [
    ...(bill.votes ?? []).map((v) => ({ date: v.date, key: `${v.chamber}${v.roll}${v.date}`, el: <OneVote key={`${v.chamber}${v.roll}${v.date}`} v={v} home={home} sponsor={bill.sponsor} /> })),
    ...(bill.floorNotes ?? []).map((n) => ({ date: n.date, key: `${n.chamber}${n.date}`, el: <NoRollCall key={`n${n.chamber}${n.date}`} n={n} /> })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return null;
  return (
    <div className="fv-wrap">
      <span className="stat-label">Floor votes</span>
      <ul className="fv-list">{rows.map((r) => r.el)}</ul>
      {!home && bill.votes?.length ? <p className="small muted fv-hint">Save your ZIP code in mission 1.4 to see how your state’s members voted.</p> : null}
    </div>
  );
}

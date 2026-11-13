import { useEffect } from 'react';
import { useToasts } from '../../components/game';
import { backendOn, followBill, unfollowBill } from '../../lib/backend';
import { useHaptics } from '../haptics';
import { notificationsOn } from '../reminders';
import { useJourney, type FollowedBill } from '../state';
import { BILLS, type Bill } from './items';

// Following a bill. The player taps Follow on a bill in the feed; the game remembers the stage it
// was at. When the published bills show it at a new stage, the bill is marked "Moved" in the feed
// and in Your record, a toast says so on the next visit, and, on the real site with notifications
// on, the hourly alert run sends a notification (supabase/functions/daily-reminders).

const BELL = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
const BELL_ON = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" fill="none" /></svg>;

const nowOf = (id: string) => BILLS.bills.find((b) => b.id === id);

export interface Move { id: string; f: FollowedBill; now: string }
/** Followed bills that are at a new stage since the player last looked. */
export function useMoves(): Move[] {
  const j = useJourney();
  return Object.entries(j.follows ?? {}).flatMap(([id, f]) => {
    const b = nowOf(id);
    return b && b.status !== f.seen ? [{ id, f, now: b.status }] : [];
  });
}

export function FollowButton({ bill }: { bill: Bill }) {
  const j = useJourney();
  const buzz = useHaptics();
  const on = !!j.follows?.[bill.id];
  const toggle = () => {
    buzz('tap');
    j.toggleFollow({ label: bill.label, title: bill.title, url: bill.url, status: bill.status }, bill.id);
    if (backendOn()) (on ? unfollowBill(bill.id) : followBill(bill.id, bill.status)).catch(() => {});
  };
  return (
    <div className="fc-follow">
      <button type="button" className="fc-follow-btn" aria-pressed={on} onClick={toggle}>{on ? BELL_ON : BELL}{on ? 'Following' : 'Follow this bill'}</button>
      <span className="fc-fine">{on
        ? (notificationsOn() ? 'You’ll get a notification when it moves.' : <>You’ll see it here when it moves. <a href="#settings">Turn on notifications</a> to be told.</>)
        : 'Know when it moves: committee, a vote, the President.'}</span>
    </div>
  );
}

/** "Moved: Introduced → Passed Senate", on a followed bill's card. */
export function MovedNote({ bill }: { bill: Bill }) {
  const j = useJourney();
  const f = j.follows?.[bill.id];
  if (!f || f.seen === bill.status) return null;
  return <p className="fc-moved" role="status"><strong>Moved</strong> since you last looked: {f.seen} → <strong>{bill.status}</strong></p>;
}

/** Your record: the bills you follow, where each stands, and what moved. Seeing them marks them seen. */
export function FollowedBills() {
  const j = useJourney();
  const moves = useMoves();
  const list = Object.entries(j.follows ?? {});
  const moved = new Set(moves.map((m) => m.id));
  // Once the list has been on screen a moment, what's moved counts as seen.
  useEffect(() => {
    if (!moves.length) return;
    const t = setTimeout(() => j.seeFollows(Object.fromEntries(moves.map((m) => [m.id, m.now]))), 2500);
    return () => clearTimeout(t);
  }, [moves.map((m) => m.id + m.now).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null;
  return (
    <ul className="fb-list">
      {list.map(([id, f]) => {
        const b = nowOf(id);
        return (
          <li key={id} className="card fb-item" data-moved={moved.has(id) || undefined}>
            <a href={f.url} target="_blank" rel="noopener noreferrer">
              <span className="fb-label">{f.label}{moved.has(id) && <span className="fb-badge">Moved</span>}</span>
              <strong>{f.title}</strong>
              <span className="small muted">{b ? (moved.has(id) ? <>{f.seen} → <strong>{b.status}</strong></> : b.status) : `${f.status} · no new action in the last 60 days`}</span>
            </a>
            <button type="button" className="btn btn-sm" onClick={() => { j.toggleFollow(f, id); if (backendOn()) unfollowBill(id).catch(() => {}); }} aria-label={`Stop following ${f.label}`}>Unfollow</button>
          </li>
        );
      })}
    </ul>
  );
}

/** Once a visit: a toast for each followed bill that moved since the player last looked. */
export function useMoveToasts() {
  const moves = useMoves();
  const toasts = useToasts();
  useEffect(() => {
    if (!moves.length) return;
    let told = false;
    try { told = sessionStorage.getItem('ftd:moves-told') === '1'; } catch { /* private mode */ }
    if (told) return;
    // The flag is set when the toast shows (effects can run twice in development).
    const t = setTimeout(() => {
      try { sessionStorage.setItem('ftd:moves-told', '1'); } catch { /* private mode */ }
      moves.slice(0, 2).forEach((m) => toasts.push(`${m.f.label} moved: ${m.now}`));
    }, 1500);
    return () => clearTimeout(t);
  }, [moves.length]); // eslint-disable-line react-hooks/exhaustive-deps
}

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { backendOn, countPlay, feedTallies, saveFeedVote } from '../../lib/backend';
import { FloorVotes, sponsorLine } from './votes';
import { moneyWords } from '../../lib/format';
import { useVotes } from '../../lib/votes';
import { OPTIONS_DATA } from '../../lib/planData';
import { laws } from '../../data';
import { puzzleFor, todayKey } from '../daily';
import { useHaptics } from '../haptics';
import { LevelIcon } from '../icons';
import { missionShort } from '../levels';
import { when } from '../news';
import { useJourney } from '../state';
import { visitLabel } from './since';
import type { Bill, FeedItem, FeedRow, Slice, Stat, Topic } from './items';
import { PostArt, type ART_GLYPH } from './art';
import { FollowButton, MovedNote } from './follow';
import { Seal } from '../Seal';
import { diffKey, type IconId } from '../levels';
import { Terms } from '../../components/Terms';

// One card per kind of post. Every card has the same head: what it is, its official source and
// date, and Save. Then its body, and its own one action: vote, swipe, check, start, or read more.

const TOPIC_LABEL: Record<Topic, string> = { bills: 'Bill in Congress', budget: 'Budget lesson', polls: 'Poll', lessons: 'Civic lesson', facts: 'Fun fact', news: 'Announcement' };
const KIND_LABEL: Partial<Record<FeedItem['kind'], string>> = { check: 'Quick check', tutorial: 'Mission', chapter: 'Field guide', term: 'Word to know', law: 'Law that moved the deficit', deadline: 'Deadline', daily: 'Daily Dollar' };
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? DATE.format(new Date(d.slice(0, 10) + 'T12:00:00Z')) : d ?? '');

export function Icon({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{d}</svg>;
}
export const ICON = {
  bookmark: <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />,
  bookmarkOn: <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" fill="currentColor" />,
  bill: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 15.5h5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  poll: <><path d="M5 20V12M12 20V5M19 20v-9" /><path d="M3 20h18" /></>,
  lesson: <><path d="M3 8.5 12 4l9 4.5-9 4.5z" /><path d="M7 10.6V15c1.5 1.4 3.2 2 5 2s3.5-.6 5-2v-4.4M21 8.5V14" /></>,
  news: <><path d="M4 6h13v13H6a2 2 0 0 1-2-2z" /><path d="M17 9h3v8a2 2 0 0 1-2 2M7.5 9.5h6M7.5 13h6M7.5 16h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  up: <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />,
  ext: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  chevron: <path d="m9 6 6 6-6 6" />,
  bulb: <><path d="M9 17.5h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></>,
};
const TOPIC_ICON: Record<Topic, ReactNode> = { bills: ICON.bill, budget: ICON.chart, polls: ICON.poll, lessons: ICON.lesson, facts: ICON.bulb, news: ICON.news };

function SaveButton({ item }: { item: FeedItem }) {
  const j = useJourney();
  const buzz = useHaptics();
  const on = (j.saved ?? []).some((s) => s.id === item.id);
  return (
    <button type="button" className="fc-save" aria-pressed={on} aria-label={on ? `Saved: ${item.title}. Remove from saved` : `Save for later: ${item.title}`} title={on ? 'Saved' : 'Save for later'}
      onClick={() => { buzz('tap'); j.toggleSaved({ id: item.id, kind: item.kind, title: item.title, href: item.href, source: item.source.name }); }}>
      <Icon d={on ? ICON.bookmarkOn : ICON.bookmark} />
    </button>
  );
}

// ---- Who a post comes from: a small mark of our own drawing (never an agency's logo or seal,
// which would suggest the office stands behind this game; it doesn't, and says so).

type Mark = { id: string; label: string; text?: string; glyph?: ReactNode; name: string };
const GLYPH = {
  dome: <><path d="M12 3v2" /><path d="M7.5 11a4.5 4.5 0 0 1 9 0" /><path d="M6.5 11h11M7.5 11v3M16.5 11v3" /><path d="M4 14h16M5 14v5M9 14v5M12 14v5M15 14v5M19 14v5M3.5 19.5h17" /></>,
  portico: <><path d="M3.5 9 12 4.5 20.5 9z" /><path d="M5 9.5h14M6.5 10v7M10 10v7M14 10v7M17.5 10v7M4 17.5h16M3 20h18" /></>,
  building: <><path d="M4 8.5 12 4l8 4.5" /><path d="M5 9h14M6.5 9.5v8M10 9.5v8M14 9.5v8M17.5 9.5v8M4 18h16M3 20.5h18" /></>,
  hat: <><path d="M8 4.5h8l-1 11H9z" fill="#c8372d" stroke="none" /><path d="M9.3 7.5h5.4M9.6 10.5h4.8M9.9 13.5h4.2" stroke="#fff" strokeWidth="1.4" /><path d="M8 4.5h8l-1 11H9z" /><path d="M3.5 17.2c2.5-1.6 14.5-1.6 17 0-1.6 1.6-15.4 1.6-17 0z" fill="#1f3a6b" stroke="none" /><path d="M8.6 15.4h6.8" stroke="#1f3a6b" strokeWidth="2.2" /></>,
};
const MARKS: { test: RegExp; mark: Mark }[] = [
  { test: /\bJCT\b|Joint Committee on Taxation/i, mark: { id: 'jct', label: 'JCT', text: 'JCT', name: 'Joint Committee on Taxation' } },
  { test: /\bCRS\b|Congressional Research Service/i, mark: { id: 'crs', label: 'CRS', text: 'CRS', name: 'Congressional Research Service' } },
  { test: /\bCBO\b|Congressional Budget Office/i, mark: { id: 'cbo', label: 'CBO', text: 'CBO', name: 'Congressional Budget Office' } },
  { test: /\bGAO\b/i, mark: { id: 'gao', label: 'GAO', text: 'GAO', name: 'Government Accountability Office' } },
  { test: /\bOMB\b/i, mark: { id: 'omb', label: 'OMB', text: 'OMB', name: 'Office of Management and Budget' } },
  { test: /Social Security Administration|\bSSA\b/i, mark: { id: 'ssa', label: 'SSA', text: 'SSA', name: 'Social Security Administration' } },
  { test: /\bCMS\b/i, mark: { id: 'cms', label: 'CMS', text: 'CMS', name: 'Centers for Medicare & Medicaid Services' } },
  { test: /U\.S\. Mint/i, mark: { id: 'mint', label: 'Mint', text: '1¢', name: 'U.S. Mint' } },
  { test: /National Archives|Truman Library/i, mark: { id: 'nara', label: 'Archives', text: 'NA', name: 'National Archives' } },
  { test: /White House/i, mark: { id: 'wh', label: 'White House', glyph: GLYPH.portico, name: 'The White House' } },
  { test: /Treasury|Fiscal Data/i, mark: { id: 'treas', label: 'Treasury', glyph: GLYPH.building, name: 'U.S. Department of the Treasury' } },
  { test: /Congress\.gov|Senate floor|House floor|Sent to the President|Public Law|P\.L\.|U\.S\.C\./i, mark: { id: 'congress', label: 'Congress', glyph: GLYPH.dome, name: 'Congress' } },
];
const GAME_MARK: Mark = { id: 'game', label: 'Help Uncle Sam', glyph: GLYPH.hat, name: 'Help Uncle Sam Balance the Budget (this game)' };
export function markFor(item: FeedItem): Mark {
  const src = `${item.kind === 'news' ? item.news.source + ' ' : ''}${item.source.name}`;
  // CRS summaries come through Congress.gov: credit CRS, which wrote them.
  return MARKS.find((m) => m.test.test(src))?.mark ?? GAME_MARK;
}

function SourceMark({ mark }: { mark: Mark }) {
  return (
    <span className="fc-mark" data-mark={mark.id} title={`From: ${mark.name}`} aria-hidden="true">
      {mark.glyph ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" focusable="false">{mark.glyph}</svg> : <span className="fc-mark-text">{mark.text}</span>}
    </span>
  );
}

/** Posts newer than the last visit wear a "New" mark (set by the feed). */
export const NewContext = createContext(false);

function Head({ item, badge }: { item: FeedItem; badge?: string }) {
  const isNew = useContext(NewContext);
  const s = item.source;
  const date = item.kind === 'news' ? when(item.news.time, item.news.dateOnly) : s.date ? (item.kind === 'bill' ? `Updated ${fmtDate(s.date)}` : /^\d{4}-\d/.test(s.date) ? fmtDate(s.date) : s.date) : '';
  return (
    <header className="fc-head">
      <SourceMark mark={markFor(item)} />
      <span className="fc-head-text">
        <span className="fc-badge-row"><span className="fc-badge" data-topic={item.topic}><Icon d={TOPIC_ICON[item.topic]} size={14} />{badge ?? KIND_LABEL[item.kind] ?? TOPIC_LABEL[item.topic]}</span>{isNew && <span className="fc-new">New</span>}</span>
        <span className="fc-source">
          {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}
          {date && <> · <time>{date}</time></>}
        </span>
      </span>
      <SaveButton item={item} />
    </header>
  );
}

/** Community bars, shown only after answering; always labeled for what they are. */
function Bars({ rows, total, mine }: { rows: { value: string; label: string; n: number }[]; total: number; mine?: string }) {
  return (
    <div className="fc-bars">
      {rows.map((r) => {
        const p = total ? Math.round((r.n / total) * 100) : 0;
        return (
          <div className="fc-bar" key={r.value} data-mine={mine === r.value || undefined}>
            <span className="fc-bar-label">{r.label}{mine === r.value && <span className="fc-you"> · you</span>}</span>
            <span className="fc-bar-track" aria-hidden="true"><span className="fc-bar-fill" style={{ width: `${p}%` }} /></span>
            <span className="fc-bar-pct">{p}%</span>
          </div>
        );
      })}
      <p className="fc-fine">{total.toLocaleString()} {total === 1 ? 'player' : 'players'} of this game, not a scientific poll.</p>
    </div>
  );
}

// ---- Pictures for the posts (art.tsx): which icon goes with which post.

type Pic = { icon?: IconId; glyph?: keyof typeof ART_GLYPH };
/** A bill's picture, from its policy area and title. */
function billPic(b: Bill): Pic {
  const t = `${b.area} ${b.title}`;
  if (/social security/i.test(t)) return { icon: 'people' };
  if (/medicare|medicaid|health/i.test(t)) return { icon: 'shield' };
  if (/tax|credit|deduction/i.test(t)) return { icon: 'paycheck' };
  if (/appropriation|spending|fund/i.test(t)) return { icon: 'bills' };
  if (/debt|borrow/i.test(t)) return { icon: 'card' };
  return { icon: 'capitol' };
}
const LAW_PIC: Record<string, Pic> = { tax: { icon: 'paycheck' }, emergency: { icon: 'shield' }, spending: { icon: 'bills' }, reduction: { icon: 'scale' }, mixed: { icon: 'flow' } };
const FACT_PIC: Record<string, Pic> = {
  'treasury-founded': { icon: 'capitol' }, 'income-tax-1861': { icon: 'paycheck' }, 'sixteenth-amendment': { glyph: 'scroll' }, 'debt-limit-1917': { icon: 'gauge' },
  'budget-accounting-1921': { icon: 'scale' }, 'social-security-act': { icon: 'people' }, 'ida-may-fuller': { glyph: 'check' }, 'medicare-signed': { icon: 'card' },
  'budget-act-1974': { icon: 'capitol' }, 'cbo-opens': { icon: 'ruler' }, 'transition-quarter': { icon: 'hourglass' }, 'shutdown-2025': { icon: 'brake' },
  'last-penny': { glyph: 'coin' }, 'penny-cost': { glyph: 'coin' }, 'medicaid-1966': { icon: 'shield' },
  'per-second': { icon: 'flow' }, 'interest-day': { icon: 'wave' }, 'debt-1790': { icon: 'bridge' }, 'debt-1835': { icon: 'target' }, 'last-surplus': { icon: 'scale' }, 'defense-1962': { icon: 'shield' },
};
const CHAPTER_PIC: Record<string, IconId> = { overview: 'gauge', spending: 'bills', revenue: 'paycheck', receipt: 'paycheck', state: 'home', gap: 'gap', debt: 'card', process: 'capitol', laws: 'scale', 'social-security': 'people' };

// ---- Bills

const STAGES = ['Introduced', 'In committee', 'Reported by committee', 'Passed House', 'Passed Senate', 'Passed both chambers', 'Sent to President', 'Became law'];
const BILL_CHOICES = [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }];
const tallyCache = new Map<string, Record<string, number>>();

function initials(name: string) {
  const parts = name.replace(/^(Rep|Sen|Del|Resident Commissioner)\.?\s+/i, '').split(/\s+/).filter((w) => /^[A-Z]/.test(w) && !/^[A-Z]\.$/.test(w));
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase();
}

/** How a bill becomes law, as six stops; the ones it has passed are filled. */
const TRACK = ['Introduced', 'Committee', 'Passed one chamber', 'Passed both chambers', 'To the President', 'Law'];
function trackAt(status: string) {
  if (status === 'Became law') return 5;
  if (status === 'Sent to President' || status === 'Vetoed') return 4;
  if (status === 'Passed both chambers') return 3;
  if (status === 'Passed House' || status === 'Passed Senate') return 2;
  if (status === 'Reported by committee' || status === 'In committee') return 1;
  return 0;
}
function StageTrack({ status }: { status: string }) {
  const at = trackAt(status);
  return (
    <div className="fc-trackwrap">
      <ol className="fc-track" aria-hidden="true">
        {TRACK.map((t, i) => <li key={t} data-done={i <= at || undefined} data-here={i === at || undefined} title={t}><span className="fc-track-dot" /></li>)}
      </ol>
      <p className="fc-track-cap">Step {at + 1} of {TRACK.length}: <strong>{TRACK[at]}</strong>{at < TRACK.length - 1 ? <span className="muted"> · next, {TRACK[at + 1].toLowerCase()}</span> : null}</p>
    </div>
  );
}

function BillCard({ item, bill }: { item: FeedItem; bill: Bill }) {
  const j = useJourney();
  const buzz = useHaptics();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'does' | 'costs'>('does');
  const mine = j.feedVotes?.[item.id];
  const [tally, setTally] = useState<Record<string, number> | null>(() => tallyCache.get(item.id) ?? null);
  const site = backendOn();
  const uid = useId();
  useEffect(() => {
    if (!mine || !site || tally) return;
    feedTallies([item.id]).then((t) => { const x = t[item.id] ?? { total: 0 }; tallyCache.set(item.id, x); setTally(x); }).catch(() => {});
  }, [mine, site]); // eslint-disable-line react-hooks/exhaustive-deps
  const vote = async (choice: string) => {
    buzz('tap');
    const before = mine;
    j.feedVote(item.id, choice);
    if (!site) return;
    try {
      await saveFeedVote(item.id, choice);
      const t = (await feedTallies([item.id]))[item.id] ?? { total: 0 };
      tallyCache.set(item.id, t); setTally(t);
    } catch { if (before !== choice) setTally((t) => t); }
  };
  const stage = Math.max(0, STAGES.indexOf(bill.status));
  return (
    <>
      <Head item={item} />
      <PostArt tone="bills" {...billPic(bill)} big={bill.label} small={bill.area || 'Bill in Congress'} />
      <div className="fc-bill-top">
        <span className="fc-status" data-stage={stage} title={bill.latestAction.text}>{bill.status}</span>
        {bill.companion && <span className="fc-billno muted">Twin bill: {bill.companion}</span>}
      </div>
      <h3 className="fc-title">{bill.title}</h3>
      <MovedNote bill={bill} />
      <StageTrack status={bill.status} />
      {bill.sponsor && (
        <p className="fc-sponsor">
          <span className="fc-avatar" aria-hidden="true">{initials(bill.sponsor.name)}</span>
          <span><span className="muted">Sponsor:</span> {sponsorLine(bill.sponsor)}{bill.cosponsors ? <span className="muted"> · {bill.cosponsors} cosponsor{bill.cosponsors === 1 ? '' : 's'}</span> : null}</span>
        </p>
      )}
      <div className="fc-tabs" role="tablist" aria-label="About this bill">
        <button type="button" role="tab" id={`${uid}-a`} aria-selected={tab === 'does'} aria-controls={`${uid}-p`} onClick={() => setTab('does')}>What it does</button>
        <button type="button" role="tab" id={`${uid}-b`} aria-selected={tab === 'costs'} aria-controls={`${uid}-p`} onClick={() => setTab('costs')}>What it costs</button>
      </div>
      <div className="fc-tabpanel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-${tab === 'does' ? 'a' : 'b'}`}>
        {tab === 'does' ? (
          <>
            <div className={'fc-tldr' + (open ? ' is-open' : '')}><Terms>{bill.summary.split('\n').map((p, i) => <p key={i}>{p}</p>)}</Terms></div>
            <button type="button" className="fc-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read summary'}</button>
            {open && <p className="fc-fine">Summary by the Congressional Research Service ({bill.summaryStage.toLowerCase()} version). {bill.summaryCut && <a href={bill.url} target="_blank" rel="noopener noreferrer">The rest is on Congress.gov.</a>}</p>}
          </>
        ) : bill.cbo ? (
          <p>The Congressional Budget Office published a cost estimate on {fmtDate(bill.cbo.date)}: <a href={bill.cbo.url} target="_blank" rel="noopener noreferrer">{bill.cbo.title || 'read it on cbo.gov'}</a>.</p>
        ) : (
          <p>The Congressional Budget Office hasn’t published a cost estimate for this bill yet. CBO usually scores a bill once a committee reports it.</p>
        )}
      </div>
      <FloorVotes bill={bill} />
      <p className="fc-latest"><span className="muted">Latest action{bill.latestAction.date ? `, ${fmtDate(bill.latestAction.date)}` : ''}:</span> {bill.latestAction.text}</p>
      <div className="fc-vote" role="group" aria-label="Would you support this bill?">
        <p className="fc-ask">Would you support this bill?</p>
        <div className="fc-choices">
          {BILL_CHOICES.map((c) => <button key={c.value} type="button" className="fc-choice" aria-pressed={mine === c.value} onClick={() => vote(c.value)}>{c.label}</button>)}
        </div>
        {mine && (tally && tally.total ? <Bars rows={BILL_CHOICES.map((c) => ({ ...c, n: tally[c.value] ?? 0 }))} total={tally.total} mine={mine} />
          : <p className="fc-fine">{site ? 'Saved. Players’ totals appear here as answers come in.' : 'Saved on this device. Players’ totals show on balancethebudget.us.'} Not a scientific poll.</p>)}
      </div>
      <FollowButton bill={bill} />
      <a className="fc-link" href={bill.url} target="_blank" rel="noopener noreferrer">The bill on Congress.gov <Icon d={ICON.ext} size={14} /></a>
    </>
  );
}

// ---- Announcements and deadlines

function NewsCard({ item }: { item: Extract<FeedItem, { kind: 'news' }> }) {
  return (
    <>
      <Head item={item} badge={item.news.source} />
      <PostArt tone="news" glyph="megaphone" big={item.news.source} small={when(item.news.time, item.news.dateOnly)} compact />
      <h3 className="fc-title fc-title-sm">{item.news.title}</h3>
      <a className="fc-link" href={item.news.url} target="_blank" rel="noopener noreferrer">Learn more <Icon d={ICON.ext} size={14} /></a>
    </>
  );
}

/** A one-event calendar file, all day, with the official source in the notes. */
export function icsFor(title: string, date: string, notes: string, url: string) {
  const d = date.replace(/-/g, '');
  const next = new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Help Uncle Sam//Feed//EN', 'BEGIN:VEVENT', `UID:${d}-${title.replace(/\W+/g, '-').toLowerCase()}@balancethebudget.us`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(notes + '\n' + url)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function DeadlineCard({ item }: { item: Extract<FeedItem, { kind: 'deadline' }> }) {
  const d = item.deadline;
  const days = Math.ceil((Date.parse(d.date + 'T23:59:59') - Date.now()) / 86400000);
  const save = () => {
    const blob = new Blob([icsFor(d.kind === 'shutdown' ? 'Federal funding deadline' : 'Debt limit X-date', d.date, d.what, d.source.url)], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `deadline-${d.date}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <>
      <Head item={item} />
      <PostArt tone="news" glyph="calendar" big={days <= 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`} small={`left · ${fmtDate(d.date)}`} />
      <h3 className="fc-title fc-title-sm">{item.title}</h3>
      <p>{d.what}</p>
      <div className="fc-actions">
        {/* The claude.ai viewer can't hand over files, so the artifact copy leaves this out. */}
        {!__ARTIFACT__ && <button type="button" className="btn btn-sm" onClick={save}><Icon d={ICON.calendar} size={16} /> Save to calendar</button>}
        <a className="fc-link" href={d.source.url} target="_blank" rel="noopener noreferrer">Learn more <Icon d={ICON.ext} size={14} /></a>
      </div>
    </>
  );
}

function DailyCard({ item }: { item: FeedItem }) {
  const p = puzzleFor(todayKey());
  return (
    <>
      <Head item={item} badge={`Daily Dollar #${p.n}`} />
      <PostArt tone="news" icon="target" big={`#${p.n}`} small={<span className="fc-art-dots">{[0, 1, 2, 3, 4].map((k) => <span key={k} />)}<span>five rounds</span></span>} />
      <h3 className="fc-title">{p.theme ? `${p.theme.name}: ` : ''}{p.pool.title}</h3>
      <p className="muted">Higher or lower? Five rounds, about a minute, and a new one every day.</p>
      <a className="btn btn-primary fc-cta" href="#daily">Play today’s</a>
    </>
  );
}

// ---- Budget lessons

function Donut({ data, highlight }: { data: Slice[]; highlight?: string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  let a0 = -Math.PI / 2;
  const R = 42, r = 27, C = 50;
  const arc = (a: number, rad: number) => `${(C + rad * Math.cos(a)).toFixed(2)} ${(C + rad * Math.sin(a)).toFixed(2)}`;
  return (
    <svg className="fc-donut" viewBox="0 0 100 100" role="img" aria-label={data.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}>
      {data.map((d) => {
        const a1 = a0 + (d.value / total) * Math.PI * 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const path = `M${arc(a0 + 0.012, R)} A${R} ${R} 0 ${large} 1 ${arc(a1 - 0.012, R)} L${arc(a1 - 0.012, r)} A${r} ${r} 0 ${large} 0 ${arc(a0 + 0.012, r)}Z`;
        a0 = a1;
        return <path key={d.label} d={path} fill={d.color ?? 'var(--c-other)'} opacity={!highlight || d.label === highlight ? 1 : 0.55} />;
      })}
    </svg>
  );
}

function BarsChart({ data, highlight, unit }: { data: Slice[]; highlight?: string; unit: string }) {
  const max = Math.max(...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <svg className="fc-barchart" viewBox="0 0 100 52" preserveAspectRatio="none" role="img" aria-label={data.map((d) => `${d.label}: ${d.value.toFixed(unit === 'trillion' ? 1 : 0)} ${unit}`).join(', ')}>
      {data.map((d, i) => {
        const h = (d.value / max) * 44;
        return <rect key={d.label} x={i * w + w * 0.18} y={46 - h} width={w * 0.64} height={h} rx="1" fill={d.label === highlight ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 38%, transparent)'} />;
      })}
    </svg>
  );
}

function StatCard({ item, stat }: { item: FeedItem; stat: Stat }) {
  const [at, setAt] = useState(0);
  const total = stat.chart.data.reduce((a, b) => a + b.value, 0);
  return (
    <>
      <Head item={item} />
      <h3 className="fc-title">{stat.headline}</h3>
      <div className="fc-stat">
        <div className="fc-stat-num"><strong>{stat.value}</strong><span>{stat.caption}</span></div>
        <div className="fc-stat-chart">
          {stat.chart.kind === 'donut' ? <Donut data={stat.chart.data} highlight={stat.chart.highlight} /> : <BarsChart data={stat.chart.data} highlight={stat.chart.highlight} unit={stat.chart.unit} />}
          {stat.chart.kind === 'bars' && <div className="fc-axis" aria-hidden="true"><span>{stat.chart.data[0].label}</span><span>{stat.chart.data.at(-1)!.label}</span></div>}
        </div>
      </div>
      {stat.chart.kind === 'donut' && (
        <ul className="fc-legend">
          {stat.chart.data.slice(0, 6).map((d) => <li key={d.label}><span className="fc-key" style={{ background: d.color }} aria-hidden="true" />{d.label} <span className="muted">{Math.round((d.value / total) * 100)}%</span></li>)}
        </ul>
      )}
      <div className="fc-slides" tabIndex={0} aria-label="Three cards: swipe for more" onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth * 0.86))); }}>
        {stat.slides.map((s, i) => (
          <div className="fc-slide" key={i} aria-label={`${i + 1} of ${stat.slides.length}`}>
            <span className="fc-slide-n">{i + 1}/{stat.slides.length}</span>
            <strong>{s.title}</strong>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
      <div className="fc-dots" aria-hidden="true">{stat.slides.map((_, i) => <span key={i} data-on={i === Math.min(at, stat.slides.length - 1) || undefined} />)}</div>
    </>
  );
}

function LawCard({ item }: { item: Extract<FeedItem, { kind: 'law' }> }) {
  const l = item.law;
  const up = l.deficitEffect >= 0;
  return (
    <>
      <Head item={item} />
      <PostArt tone="budget" {...(LAW_PIC[l.kind] ?? { icon: 'scale' })} big={`${up ? '+' : '−'}${moneyWords(Math.abs(l.deficitEffect) * 1e9, 2)}`} small={`${up ? 'added to' : 'cut from'} deficits, ${l.window}`} />
      <h3 className="fc-title fc-title-sm">{l.name} <span className="muted">({l.signed.slice(0, 4)})</span></h3>
      <p className="fc-law-num muted">As scored when it passed; signed {fmtDate(l.signed)}.</p>
      <span className="fc-size-bar" data-dir={up ? 'up' : 'down'} role="img" aria-label={`${Math.round((Math.abs(l.deficitEffect) / MAX_LAW) * 100)}% of the biggest effect among the laws in the game`}><span style={{ width: `${Math.max(3, (Math.abs(l.deficitEffect) / MAX_LAW) * 100)}%` }} /></span>
      <p className="fc-clamp">{l.summary}</p>
      <a className="fc-link" href="#laws">All the laws that moved the needle <Icon d={ICON.chevron} size={14} /></a>
    </>
  );
}

// ---- Polls (the CBO's options; the same votes as the game's cards)

const MAX_OPTION = Math.max(...OPTIONS_DATA.options.map((o) => Math.abs(Number(o.savings10))));
const MAX_LAW = Math.max(...laws.map((l) => Math.abs(l.deficitEffect)));

const POLL_TABS = [['does', 'What it does'], ['pays', 'Who pays'], ['gains', 'Who benefits']] as const;

function PollCard({ item }: { item: Extract<FeedItem, { kind: 'poll' }> }) {
  // The playtest's counts: the feed's polls were seen (once a day), and each first answer.
  useEffect(() => { countPlay('poll_view', 'feed', true); }, []);
  const o = item.option;
  const v = useVotes();
  const buzz = useHaptics();
  const [tab, setTab] = useState<'does' | 'pays' | 'gains'>('does');
  const uid = useId();
  const mine = v.mine.options[o.id];
  const t = v.options[o.id] ?? { support: 0, oppose: 0 };
  const saves = o.savings10 >= 0;
  return (
    <>
      <Head item={item} />
      <PostArt tone="polls" icon={o.side === 'revenue' ? 'paycheck' : 'bills'} big={moneyWords(Math.abs(o.savings10) * 1e9, 2)} small={`${saves ? (o.side === 'revenue' ? 'raised' : 'saved') : 'added to deficits'} over 10 years, by ${o.by ? 'JCT’s estimate, as reported by CBO' : 'CBO’s estimate'}`} />
      <p className="fc-ask fc-ask-top">Would you include this in your plan?</p>
      <h3 className="fc-title">{o.name}</h3>
      <p className="fc-fact">Fact: deficits would be about {moneyWords(Math.abs(o.savings10) * 1e9, 2)} {saves ? 'smaller' : 'larger'} over ten years, by {o.by ? 'JCT’s estimate, as reported by CBO' : 'CBO’s estimate'}.</p>
      <div className="fc-size">
        <span className="fc-size-bar" role="img" aria-label={`Size among CBO’s options: ${Math.round((Math.abs(o.savings10) / MAX_OPTION) * 100)}% of the biggest`}><span style={{ width: `${Math.max(3, (Math.abs(o.savings10) / MAX_OPTION) * 100)}%` }} /></span>
        <span className="fc-size-k">compared with the biggest of CBO’s options in the game</span>
      </div>
      <div className="fc-tabs fc-tabs-3" role="tablist" aria-label="About this option">
        {POLL_TABS.map(([k, label]) => <button key={k} type="button" role="tab" id={`${uid}-${k}`} aria-selected={tab === k} aria-controls={`${uid}-p`} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      <div className="fc-tabpanel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-${tab}`}>
        {tab === 'does' ? <p><Terms inline>{o.summary}</Terms></p>
          : tab === 'pays' ? <p>{o.affects}.</p>
          : <p>{o.benefits}. And with less borrowing, less of the budget goes to interest later.</p>}
      </div>
      <div className="fc-vote" role="group" aria-label="Would you include this in your plan?">
        <div className="fc-choices fc-choices-2">
          <button type="button" className="fc-choice" aria-pressed={mine === 1} onClick={() => { buzz('vote'); if (mine == null) countPlay('poll_vote', 'feed'); v.voteOption(o.id, 1); }}>Include it</button>
          <button type="button" className="fc-choice" aria-pressed={mine === -1} onClick={() => { buzz('vote'); if (mine == null) countPlay('poll_vote', 'feed'); v.voteOption(o.id, -1); }}>Leave it out</button>
        </div>
        {mine != null && (v.available && t.support + t.oppose > 0
          ? <Bars rows={[{ value: '1', label: 'Include it', n: t.support }, { value: '-1', label: 'Leave it out', n: t.oppose }]} total={t.support + t.oppose} mine={String(mine)} />
          : <p className="fc-fine">Saved with your other votes. Players’ totals show once they load. Not a scientific poll.</p>)}
      </div>
    </>
  );
}

// ---- Lessons

function CheckCard({ item }: { item: Extract<FeedItem, { kind: 'check' }> }) {
  const j = useJourney();
  const buzz = useHaptics();
  const [pick, setPick] = useState<number | null>(null);
  const q = item.quiz;
  const done = pick != null || j.feedChecks?.[item.id] != null;
  return (
    <>
      <Head item={item} />
      <div className="fc-check-art" data-state={pick == null ? 'ask' : pick === q.correct ? 'right' : 'wrong'}>
        <PostArt tone="lessons" glyph="question" big={pick == null ? 'Quick check' : pick === q.correct ? 'Right!' : 'Not quite'} small={`from ${missionShort(item.stop)}`} />
        {pick === q.correct && <span className="fc-burst" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7].map((k) => <span key={k} style={{ ['--k' as string]: k }}>★</span>)}</span>}
      </div>
      <h3 className="fc-title">{q.question}</h3>
      <div className="fc-choices fc-choices-col" role="group" aria-label="Choices">
        {q.choices.map((c, i) => (
          <button key={i} type="button" className="fc-choice" disabled={pick != null} data-right={pick != null && i === q.correct || undefined} data-wrong={pick === i && i !== q.correct || undefined}
            onClick={() => { setPick(i); buzz(i === q.correct ? 'right' : 'wrong'); j.feedCheck(item.id, i === q.correct); }}>{c}</button>
        ))}
      </div>
      {pick != null && <div className="fc-explain" role="status"><strong>{pick === q.correct ? 'Right.' : 'Not quite.'}</strong> <Terms inline>{q.explain}</Terms></div>}
      {pick == null && done && <p className="fc-fine">You’ve answered this one before; try it again.</p>}
      <a className="fc-link" href={'#' + item.stop.id}>Play {missionShort(item.stop)}: {item.stop.title} <Icon d={ICON.chevron} size={14} /></a>
    </>
  );
}

function TutorialCard({ item }: { item: Extract<FeedItem, { kind: 'tutorial' }> }) {
  const j = useJourney();
  const [open, setOpen] = useState(false);
  const s = item.stop;
  const finished = j.done.includes(s.id);
  const stepCount = item.steps.length;
  return (
    <>
      <Head item={item} />
      <PostArt tone="lessons" figure={<span className="fc-art-seal" data-got={finished || undefined}><Seal icon={s.icon} ring={`MISSION ${s.campaign}.${s.mission} · ${finished ? 'COMPLETE' : s.difficulty.toUpperCase()}`} stars={finished ? j.stars[s.id] ?? 0 : undefined} diff={diffKey(s.difficulty)} size={66} /></span>}
        big={missionShort(s)} small={`${stepCount ? `${stepCount} steps · ` : ''}${s.minutes} min · ${s.difficulty}${finished ? ' · done' : ''}`} />
      <h3 className="fc-title">{s.title}</h3>
      <p className="muted fc-tut-topic">{s.topic}</p>
      {stepCount > 0 && (
        <>
          <button type="button" className="fc-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide the steps' : 'What you’ll do'}</button>
          {open && (
            <>
              <ol className="fc-steps">{item.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
              {item.takeaways.length > 0 && <p className="fc-fine">You’ll come away knowing: {item.takeaways[0]}</p>}
            </>
          )}
        </>
      )}
      <a className="btn btn-primary fc-cta" href={'#' + s.id}>{finished ? 'Play it again' : 'Start the lesson'}</a>
    </>
  );
}

function ChapterCard({ item }: { item: Extract<FeedItem, { kind: 'chapter' }> }) {
  return (
    <>
      <Head item={item} />
      <PostArt tone="lessons" icon={CHAPTER_PIC[item.route] ?? 'capitol'} big="Field guide" small="a chapter to read, every number sourced" />
      <h3 className="fc-title">{item.label}</h3>
      <p>{item.blurb}</p>
      <a className="fc-link" href={'#' + item.route}>Read the chapter <Icon d={ICON.chevron} size={14} /></a>
    </>
  );
}

function TermCard({ item }: { item: Extract<FeedItem, { kind: 'term' }> }) {
  return (
    <>
      <Head item={item} />
      <div className="fc-term">
        <span className="fc-term-letter" aria-hidden="true">{item.term.term.replace(/^[^A-Za-z]+/, '').charAt(0).toUpperCase()}</span>
        <h3 className="fc-title fc-title-sm">{item.term.term}</h3>
      </div>
      <p className="fc-clamp">{item.term.def}</p>
      <a className="fc-link" href="#glossary">The glossary <Icon d={ICON.chevron} size={14} /></a>
    </>
  );
}

// ---- Fun facts and budget history

const LONG = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
function FactCard({ item }: { item: Extract<FeedItem, { kind: 'fact' }> }) {
  const f = item.fact;
  const badge = f.near === 'today' ? 'On this day' : f.near === 'week' ? 'This week in budget history' : f.date ? 'Budget history' : 'Fun fact';
  return (
    <>
      <Head item={item} badge={badge} />
      <PostArt tone="facts" {...(FACT_PIC[item.id.replace(/^fact:/, '')] ?? { glyph: 'book' })} big={f.big ?? f.year ?? 'Fun fact'} small={f.date ? LONG.format(new Date(f.date + 'T12:00:00Z')) : 'Did you know?'} />
      <h3 className="fc-title">{f.title}</h3>
      {f.date && f.near === 'today' && <p className="fc-fact-date">{new Date().getUTCFullYear() - +f.date.slice(0, 4)} years ago today</p>}
      <p>{f.body}</p>
    </>
  );
}

export function FeedCard({ item }: { item: FeedItem }) {
  let body: ReactNode;
  switch (item.kind) {
    case 'bill': body = <BillCard item={item} bill={item.bill} />; break;
    case 'news': body = <NewsCard item={item} />; break;
    case 'deadline': body = <DeadlineCard item={item} />; break;
    case 'daily': body = <DailyCard item={item} />; break;
    case 'stat': body = <StatCard item={item} stat={item.stat} />; break;
    case 'law': body = <LawCard item={item} />; break;
    case 'poll': body = <PollCard item={item} />; break;
    case 'check': body = <CheckCard item={item} />; break;
    case 'tutorial': body = <TutorialCard item={item} />; break;
    case 'chapter': body = <ChapterCard item={item} />; break;
    case 'term': body = <TermCard item={item} />; break;
    case 'fact': body = <FactCard item={item} />; break;
  }
  return <article className="fc card" data-kind={item.kind} data-topic={item.topic} aria-label={`${KIND_LABEL[item.kind] ?? TOPIC_LABEL[item.topic]}: ${item.title}`}>{body}</article>;
}

/** A row to swipe sideways: field-guide chapters, or missions to play. */
export function Carousel({ row }: { row: Extract<FeedRow, { kind: 'carousel' }> }) {
  return (
    <section className="fc-carousel" aria-label={row.title}>
      <h3 className="fc-carousel-title">{row.title}</h3>
      <div className="fc-carousel-track">
        {row.items.map((it) => it.kind === 'fact' ? (
          <div key={it.id} className="fc-mini fc-mini-fact card">
            <span className="fc-mini-year">{it.fact.year}</span>
            <strong>{it.fact.title}</strong>
            <span className="muted">{it.fact.body.split(/(?<=\.)\s/)[0]}</span>
          </div>
        ) : (
          <a key={it.id} className="fc-mini card" href={it.href}>
            {it.kind === 'tutorial' ? <span className="fc-mini-icon" aria-hidden="true"><LevelIcon id={it.stop.icon} size={26} /></span> : <span className="fc-mini-icon" aria-hidden="true"><Icon d={ICON.lesson} size={22} /></span>}
            <strong>{it.title}</strong>
            <span className="muted">{it.kind === 'tutorial' ? `${missionShort(it.stop)} · ${it.stop.minutes} min` : it.kind === 'chapter' ? it.blurb : ''}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CaughtUp({ fresh, fresher, since }: { fresh: number; fresher: number; since: string | null }) {
  return (
    <div className="fc-caughtup" role="note">
      <span className="fc-caughtup-icon" aria-hidden="true"><Icon d={ICON.check} size={18} /></span>
      <span><strong>You’re all caught up</strong>{since
        ? <> on {fresher ? `the ${fresher} new since your last visit (${visitLabel(since)}), and ` : `everything since your last visit (${visitLabel(since)}), and `}the last two weeks’ {fresh} bills and announcements.</>
        : <> on the last two weeks’ {fresh} bills and announcements.</>} Below: lessons, polls and the budget’s numbers.</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="fc card fc-skeleton" aria-hidden="true">
      <span className="sk sk-badge" /><span className="sk sk-title" /><span className="sk sk-line" /><span className="sk sk-line sk-short" />
    </div>
  );
}

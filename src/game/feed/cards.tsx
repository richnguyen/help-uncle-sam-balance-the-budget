import { useEffect, useId, useState, type ReactNode } from 'react';
import { backendOn, feedTallies, saveFeedVote } from '../../lib/backend';
import { moneyWords } from '../../lib/format';
import { useVotes } from '../../lib/votes';
import { puzzleFor, todayKey } from '../daily';
import { useHaptics } from '../haptics';
import { LevelIcon } from '../icons';
import { missionShort } from '../levels';
import { when } from '../news';
import { useJourney } from '../state';
import type { Bill, FeedItem, FeedRow, Slice, Stat, Topic } from './items';

// One card per kind of post. Every card has the same head: what it is, its official source and
// date, and Save. Then its body, and its own one action: vote, swipe, check, start, or read more.

const TOPIC_LABEL: Record<Topic, string> = { bills: 'Bill in Congress', budget: 'Budget lesson', polls: 'Poll', lessons: 'Civic lesson', news: 'Announcement' };
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
};
const TOPIC_ICON: Record<Topic, ReactNode> = { bills: ICON.bill, budget: ICON.chart, polls: ICON.poll, lessons: ICON.lesson, news: ICON.news };

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

function Head({ item, badge }: { item: FeedItem; badge?: string }) {
  const s = item.source;
  const date = item.kind === 'news' ? when(item.news.time, item.news.dateOnly) : s.date ? (item.kind === 'bill' ? `Updated ${fmtDate(s.date)}` : /^\d{4}-\d/.test(s.date) ? fmtDate(s.date) : s.date) : '';
  return (
    <header className="fc-head">
      <span className="fc-badge" data-topic={item.topic}><Icon d={TOPIC_ICON[item.topic]} size={15} />{badge ?? KIND_LABEL[item.kind] ?? TOPIC_LABEL[item.topic]}</span>
      <span className="fc-source">
        {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}
        {date && <> · <time>{date}</time></>}
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

// ---- Bills

const STAGES = ['Introduced', 'In committee', 'Reported by committee', 'Passed House', 'Passed Senate', 'Passed both chambers', 'Sent to President', 'Became law'];
const BILL_CHOICES = [{ value: 'support', label: 'Support' }, { value: 'oppose', label: 'Oppose' }, { value: 'unsure', label: 'Not sure' }];
const tallyCache = new Map<string, Record<string, number>>();

function initials(name: string) {
  const parts = name.replace(/^(Rep|Sen|Del|Resident Commissioner)\.?\s+/i, '').split(/\s+/).filter((w) => /^[A-Z]/.test(w) && !/^[A-Z]\.$/.test(w));
  return ((parts[0]?.[0] ?? '') + (parts.at(-1)?.[0] ?? '')).toUpperCase();
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
      <div className="fc-bill-top">
        <span className="fc-status" data-stage={stage} title={bill.latestAction.text}>{bill.status}</span>
        <span className="fc-billno">{bill.label}{bill.companion ? <span className="muted"> · twin bill {bill.companion}</span> : null}</span>
      </div>
      <h3 className="fc-title">{bill.title}</h3>
      {bill.sponsor && (
        <p className="fc-sponsor">
          <span className="fc-avatar" aria-hidden="true">{initials(bill.sponsor.name)}</span>
          <span><span className="muted">Sponsor:</span> {bill.sponsor.name}{bill.cosponsors ? <span className="muted"> · {bill.cosponsors} cosponsor{bill.cosponsors === 1 ? '' : 's'}</span> : null}</span>
        </p>
      )}
      <div className="fc-tabs" role="tablist" aria-label="About this bill">
        <button type="button" role="tab" id={`${uid}-a`} aria-selected={tab === 'does'} aria-controls={`${uid}-p`} onClick={() => setTab('does')}>What it does</button>
        <button type="button" role="tab" id={`${uid}-b`} aria-selected={tab === 'costs'} aria-controls={`${uid}-p`} onClick={() => setTab('costs')}>What it costs</button>
      </div>
      <div className="fc-tabpanel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-${tab === 'does' ? 'a' : 'b'}`}>
        {tab === 'does' ? (
          <>
            <div className={'fc-tldr' + (open ? ' is-open' : '')}>{bill.summary.split('\n').map((p, i) => <p key={i}>{p}</p>)}</div>
            <button type="button" className="fc-more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read summary'}</button>
            {open && <p className="fc-fine">Summary by the Congressional Research Service ({bill.summaryStage.toLowerCase()} version). {bill.summaryCut && <a href={bill.url} target="_blank" rel="noopener noreferrer">The rest is on Congress.gov.</a>}</p>}
          </>
        ) : bill.cbo ? (
          <p>The Congressional Budget Office published a cost estimate on {fmtDate(bill.cbo.date)}: <a href={bill.cbo.url} target="_blank" rel="noopener noreferrer">{bill.cbo.title || 'read it on cbo.gov'}</a>.</p>
        ) : (
          <p>The Congressional Budget Office hasn’t published a cost estimate for this bill yet. CBO usually scores a bill once a committee reports it.</p>
        )}
      </div>
      <p className="fc-latest"><span className="muted">Latest action{bill.latestAction.date ? `, ${fmtDate(bill.latestAction.date)}` : ''}:</span> {bill.latestAction.text}</p>
      <div className="fc-vote" role="group" aria-label="Would you support this bill?">
        <p className="fc-ask">Would you support this bill?</p>
        <div className="fc-choices">
          {BILL_CHOICES.map((c) => <button key={c.value} type="button" className="fc-choice" aria-pressed={mine === c.value} onClick={() => vote(c.value)}>{c.label}</button>)}
        </div>
        {mine && (tally && tally.total ? <Bars rows={BILL_CHOICES.map((c) => ({ ...c, n: tally[c.value] ?? 0 }))} total={tally.total} mine={mine} />
          : <p className="fc-fine">{site ? 'Saved. Players’ totals appear here as answers come in.' : 'Saved on this device. Players’ totals show on balancethebudget.us.'} Not a scientific poll.</p>)}
      </div>
      <a className="fc-link" href={bill.url} target="_blank" rel="noopener noreferrer">The bill on Congress.gov <Icon d={ICON.ext} size={14} /></a>
    </>
  );
}

// ---- Announcements and deadlines

function NewsCard({ item }: { item: Extract<FeedItem, { kind: 'news' }> }) {
  return (
    <>
      <Head item={item} badge={item.news.source} />
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
      <div className="fc-deadline">
        <span className="fc-deadline-date"><strong>{fmtDate(d.date)}</strong><span>{days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}</span></span>
        <h3 className="fc-title fc-title-sm">{item.title}</h3>
      </div>
      <p>{d.what}</p>
      <div className="fc-actions">
        <button type="button" className="btn btn-sm" onClick={save}><Icon d={ICON.calendar} size={16} /> Save to calendar</button>
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
      <h3 className="fc-title fc-title-sm">{l.name} <span className="muted">({l.signed.slice(0, 4)})</span></h3>
      <p className="fc-law-num"><strong>{up ? '+' : '−'}{moneyWords(Math.abs(l.deficitEffect) * 1e9, 2)}</strong> <span className="muted">{up ? 'added to' : 'cut from'} deficits over {l.window}, as scored when it passed</span></p>
      <p className="fc-clamp">{l.summary}</p>
      <a className="fc-link" href="#laws">All the laws that moved the needle <Icon d={ICON.chevron} size={14} /></a>
    </>
  );
}

// ---- Polls (the CBO's options; the same votes as the game's cards)

function PollCard({ item }: { item: Extract<FeedItem, { kind: 'poll' }> }) {
  const o = item.option;
  const v = useVotes();
  const buzz = useHaptics();
  const [tab, setTab] = useState<'for' | 'against'>('for');
  const uid = useId();
  const mine = v.mine.options[o.id];
  const t = v.options[o.id] ?? { support: 0, oppose: 0 };
  const saves = o.savings10 >= 0;
  return (
    <>
      <Head item={item} />
      <p className="fc-ask fc-ask-top">Would you include this in a plan to shrink the deficit?</p>
      <h3 className="fc-title">{o.name}</h3>
      <p className="fc-chip">{saves ? 'Saves' : 'Costs'} {moneyWords(Math.abs(o.savings10) * 1e9, 2)} over 10 years <span className="muted">(CBO)</span></p>
      <div className="fc-tabs" role="tablist" aria-label="Arguments">
        <button type="button" role="tab" id={`${uid}-a`} aria-selected={tab === 'for'} aria-controls={`${uid}-p`} onClick={() => setTab('for')}>Arguments for</button>
        <button type="button" role="tab" id={`${uid}-b`} aria-selected={tab === 'against'} aria-controls={`${uid}-p`} onClick={() => setTab('against')}>Arguments against</button>
      </div>
      <div className="fc-tabpanel" role="tabpanel" id={`${uid}-p`} aria-labelledby={`${uid}-${tab === 'for' ? 'a' : 'b'}`}>
        {tab === 'for'
          ? <p>{saves ? `It would ${o.side === 'revenue' ? 'raise' : 'save'} about ${moneyWords(o.savings10 * 1e9, 2)} over ten years, by CBO’s estimate, toward closing the gap. ` : ''}{o.summary}</p>
          : <p>Someone bears the cost. Who would feel it, by CBO’s account: {o.affects.charAt(0).toLowerCase() + o.affects.slice(1)}.</p>}
      </div>
      <div className="fc-vote" role="group" aria-label="Would you include this in a plan?">
        <div className="fc-choices fc-choices-2">
          <button type="button" className="fc-choice" aria-pressed={mine === 1} onClick={() => { buzz('vote'); v.voteOption(o.id, 1); }}>Include it</button>
          <button type="button" className="fc-choice" aria-pressed={mine === -1} onClick={() => { buzz('vote'); v.voteOption(o.id, -1); }}>Leave it out</button>
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
      <h3 className="fc-title">{q.question}</h3>
      <div className="fc-choices fc-choices-col" role="group" aria-label="Choices">
        {q.choices.map((c, i) => (
          <button key={i} type="button" className="fc-choice" disabled={pick != null} data-right={pick != null && i === q.correct || undefined} data-wrong={pick === i && i !== q.correct || undefined}
            onClick={() => { setPick(i); buzz(i === q.correct ? 'right' : 'wrong'); j.feedCheck(item.id, i === q.correct); }}>{c}</button>
        ))}
      </div>
      {pick != null && <div className="fc-explain" role="status"><strong>{pick === q.correct ? 'Right.' : 'Not quite.'}</strong> {q.explain}</div>}
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
      <div className="fc-tut">
        <span className="fc-tut-icon" aria-hidden="true"><LevelIcon id={s.icon} size={30} /></span>
        <div>
          <span className="fc-progress">{stepCount ? `${stepCount} steps · ` : ''}{s.minutes} min · {s.difficulty}{finished ? ' · Done ✓' : ''}</span>
          <h3 className="fc-title">{s.title}</h3>
          <p className="muted fc-tut-topic">{s.topic}</p>
        </div>
      </div>
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
      <h3 className="fc-title fc-title-sm">{item.term.term}</h3>
      <p className="fc-clamp">{item.term.def}</p>
      <a className="fc-link" href="#glossary">The glossary <Icon d={ICON.chevron} size={14} /></a>
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
  }
  return <article className="fc card" data-kind={item.kind} data-topic={item.topic} aria-label={`${KIND_LABEL[item.kind] ?? TOPIC_LABEL[item.topic]}: ${item.title}`}>{body}</article>;
}

/** A row to swipe sideways: field-guide chapters, or missions to play. */
export function Carousel({ row }: { row: Extract<FeedRow, { kind: 'carousel' }> }) {
  return (
    <section className="fc-carousel" aria-label={row.title}>
      <h3 className="fc-carousel-title">{row.title}</h3>
      <div className="fc-carousel-track">
        {row.items.map((it) => (
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

export function CaughtUp({ fresh }: { fresh: number }) {
  return (
    <div className="fc-caughtup" role="note">
      <span className="fc-caughtup-icon" aria-hidden="true"><Icon d={ICON.check} size={18} /></span>
      <span><strong>You’re all caught up</strong> on the last two weeks’ {fresh} bills and announcements. Below: lessons, polls and the budget’s numbers.</span>
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

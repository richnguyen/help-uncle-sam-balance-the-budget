import { useEffect, useState } from 'react';
import { PageHead, Section, Seg, Stat } from '../components/ui';
import { backendOn, CHANNELS, LINK_KINDS, type LinkKind, playStats, type PlayStats, rpc } from '../lib/backend';
import { PARTNER_RE, partnerLink, partnerStats, type PartnerStats } from '../lib/partners';
import PARTNERS from '../data/curated/partners.json';
import { geo } from '../data';
import { STOP_BY_ID, missionShort } from './levels';
import { pct } from '../lib/format';
import { PUBLIC_SITE } from './share';

// #stats: how sharing turns into new players, from anonymous counts (supabase/migrations/…_share_stats.sql):
// shares made, shared links opened, and new players whose first visit came through a shared link,
// by channel and by kind of link. Not linked from the game's main menus.

type ByKind = Record<string, Record<string, number>>;
interface Stats { window_days: number; since: string; shares: ByKind; arrivals: ByKind; players: ByKind; players_all: number; daily: { day: string; shares: number; arrivals: number }[]; funnel?: { taken: number; met: number; returned: number } }

const CHANNEL_NAME: Record<string, string> = {
  x: 'X', fa: 'Facebook', li: 'LinkedIn', re: 'Reddit', bl: 'Bluesky', th: 'Threads', wh: 'WhatsApp', em: 'Email',
  sh: 'Phone share sheet', cp: 'Copied link', pu: 'Daily Dollar reminder', direct: 'No shared link',
};
const KIND_NAME: Record<LinkKind, string> = {
  plan: 'Plan challenges', story: 'Budget Story', clip: '10-second clip', daily: 'The Daily Dollar', peoples: 'The People’s Budget',
  room: 'Rooms', chain: 'Pass the budget', level: 'Mission and fact cards', site: 'The game in general',
};
const WINDOWS = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '3650', label: 'All time' }];

const sumAll = (b: ByKind, keep: (ch: string) => boolean = () => true) => Object.values(b).reduce((s, ch) => s + Object.entries(ch).filter(([c]) => keep(c)).reduce((x, [, n]) => x + n, 0), 0);
const byChannel = (b: ByKind, ch: string) => Object.values(b).reduce((s, c) => s + (c[ch] ?? 0), 0);
const byKind = (b: ByKind, k: string, keep: (ch: string) => boolean = () => true) => Object.entries(b[k] ?? {}).filter(([c]) => keep(c)).reduce((s, [, n]) => s + n, 0);
const shared = (ch: string) => ch !== 'direct';
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const fmt = (v: number | null, digits = 2) => (v == null ? '—' : v.toFixed(digits));

export default function StatsPage() {
  const on = backendOn();
  const [win, setWin] = useState('30');
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [rem, setRem] = useState<{ devices: number; sent: number } | 'missing' | null>(null);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    setError('');
    rpc<Stats>('share_stats', { window_days: Number(win) })
      .then((r) => { if (alive) setS(r); })
      .catch(() => { if (alive) setError('Share stats can’t be loaded right now. If the share-stats SQL hasn’t been run yet, run it in Supabase first.'); });
    rpc<{ devices: number; sent: number }>('reminder_stats', { window_days: Number(win) })
      .then((r) => { if (alive) setRem(r); })
      .catch(() => { if (alive) setRem('missing'); });
    return () => { alive = false; };
  }, [on, win]);

  if (!on) {
    return (
      <>
        <PageHead eyebrow="How the game spreads" title="Share stats" lede="Shares, opened links, and the new players they bring, by channel." />
        <p className="small">Share stats come from the public site’s database. <a href={`${PUBLIC_SITE}#stats`} target="_blank" rel="noreferrer">Open them on balancethebudget.us</a>.</p>
      </>
    );
  }

  const S = s ? sumAll(s.shares) : 0;
  const A = s ? sumAll(s.arrivals) : 0;
  const N = s ? sumAll(s.players) : 0;
  const Nc = s ? sumAll(s.players, shared) : 0;
  const sharesPerPlayer = ratio(S, N);
  const playersPerShare = ratio(Nc, S);
  const k = sharesPerPlayer != null && playersPerShare != null ? sharesPerPlayer * playersPerShare : null;
  const channels = [...CHANNELS, 'direct'];

  return (
    <div className="results stats">
      <PageHead eyebrow="How the game spreads" title="Share stats" lede={<>Shares, opened links, and the new players they bring, by channel and by kind of link. All counts are anonymous.{s ? ` Since ${s.since} (UTC).` : ''}</>} />
      <Seg<string> label="Period" value={win} onChange={setWin} options={WINDOWS} />
      {error && <div className="callout small" role="status">{error}</div>}
      {!s && !error && <p className="small muted" role="status">Loading…</p>}
      {s && (
        <>
          <div className="grid-4" style={{ marginTop: 14 }}>
            <Stat label="Shares" value={`${S}`} note="share buttons and network links pressed" />
            <Stat label="Shared links opened" value={`${A}`} note={`${fmt(ratio(A, S), 1)} per share`} />
            <Stat label="New players" value={`${N}`} note={`${Nc} came through a shared link`} />
            <Stat label="Viral coefficient (K)" value={fmt(k)} note="new players each player brings in" />
          </div>
          <div className="callout small stats-k">
            <strong>K = shares per player × new players per share = {fmt(sharesPerPlayer)} × {fmt(playersPerShare)}{k != null ? ` = ${fmt(k)}` : ''}.</strong>{' '}
            Above 1, each player brings in more than one new player and the game grows by itself; below 1, it needs other ways in. {k != null && k < 1 ? `Raising either factor helps: more players sharing, or more of the people who open a link going on to play (${pct(ratio(Nc, A) ?? 0, 0)} now).` : ''}
          </div>

          <Section id="funnel" title="Friend challenges, step by step" sub="Of the people who open a friend’s plan link: how many take the challenge, meet the goal, and send a plan back. Each step is counted once per challenge per browser.">
            {s.funnel ? (() => {
              const opened = byKind(s.arrivals, 'plan');
              const steps = [
                { label: 'Opened a friend’s plan link', n: opened },
                { label: 'Took the challenge', n: s.funnel.taken },
                { label: 'Met the goal', n: s.funnel.met },
                { label: 'Sent a plan back', n: s.funnel.returned },
              ];
              return (
                <>
                  <ol className="rlist">
                    {steps.map((st, i) => {
                      const prev = i ? steps[i - 1].n : 0;
                      return (
                        <li className="rrow" key={st.label}>
                          <span className="rrow-label">{st.label}</span>
                          <span className="rrow-track" aria-hidden="true"><span style={{ width: `${opened ? Math.min(1, st.n / opened) * 100 : 0}%` }} /></span>
                          <span className="rrow-val num">{st.n}{i > 0 ? ` · ${prev ? pct(Math.min(1, st.n / prev), 0) : '—'} of the step before` : ''}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="small muted">{byKind(s.players, 'plan', shared)} new player{byKind(s.players, 'plan', shared) === 1 ? '' : 's'} came in through a plan link. Players who already had the game count in these steps too.</p>
                </>
              );
            })() : <p className="small muted">Run the challenge-funnel SQL in Supabase to see these steps.</p>}
          </Section>

          <Section id="reminders" title="Daily Dollar reminders" sub="Devices that asked for a daily reminder, reminders sent in this period, and how many were tapped to open the game.">
            {rem === 'missing' ? <p className="small muted">Run the Daily Dollar reminders SQL in Supabase to see these.</p> : rem ? (() => {
              const opened = byChannel(s.arrivals, 'pu');
              return (
                <div className="grid-3">
                  <Stat label="Devices with reminders on" value={`${rem.devices}`} note="right now" />
                  <Stat label="Reminders sent" value={`${rem.sent}`} note="at most one a day per device" />
                  <Stat label="Opened from a reminder" value={`${opened}`} note={rem.sent ? `${pct(Math.min(1, opened / rem.sent), 0)} of those sent` : '—'} />
                </div>
              );
            })() : <p className="small muted" role="status">Loading…</p>}
          </Section>

          <Section id="channels" title="By channel" sub="Where links were shared, how often they were opened, and how many new players they brought.">
            <div className="table-wrap">
              <table className="data stats-table">
                <thead><tr><th scope="col">Channel</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th><th scope="col" className="r">New players</th><th scope="col" className="r">Opened → played</th></tr></thead>
                <tbody>
                  {channels.map((ch) => {
                    const sh = byChannel(s.shares, ch), ar = byChannel(s.arrivals, ch), pl = byChannel(s.players, ch);
                    if (!sh && !ar && !pl) return null;
                    const conv = ratio(pl, ar);
                    return <tr key={ch}><th scope="row">{CHANNEL_NAME[ch] ?? ch}</th><td className="r num">{ch === 'direct' ? '—' : sh}</td><td className="r num">{ch === 'direct' ? '—' : ar}</td><td className="r num">{pl}</td><td className="r num">{ch === 'direct' || conv == null ? '—' : pct(Math.min(1, conv), 0)}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="kinds" title="By kind of link" sub="What the shared link opened.">
            <div className="table-wrap">
              <table className="data stats-table">
                <thead><tr><th scope="col">Link</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th><th scope="col" className="r">New players from it</th></tr></thead>
                <tbody>
                  {LINK_KINDS.map((kd) => {
                    const sh = byKind(s.shares, kd), ar = byKind(s.arrivals, kd), pl = byKind(s.players, kd, shared);
                    if (!sh && !ar && !pl) return null;
                    return <tr key={kd}><th scope="row">{KIND_NAME[kd]}</th><td className="r num">{sh}</td><td className="r num">{ar}</td><td className="r num">{pl}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          {s.daily.length > 0 && (
            <Section id="daily" title="Day by day" sub="Shares and opened links per day (UTC).">
              <div className="table-wrap">
                <table className="data stats-table">
                  <thead><tr><th scope="col">Day</th><th scope="col" className="r">Shares</th><th scope="col" className="r">Opened</th></tr></thead>
                  <tbody>{[...s.daily].reverse().map((d) => <tr key={d.day}><th scope="row" className="num">{d.day}</th><td className="r num">{d.shares}</td><td className="r num">{d.arrivals}</td></tr>)}</tbody>
                </table>
              </div>
            </Section>
          )}

          <PlaySection win={Number(win)} />

          <PartnerSection win={Number(win)} />

          <p className="small muted">
            How these are counted: a share is a press of a share button or a social network link (whether or not the post was sent). An opened link is counted once per browser per day for each kind and channel. A new player is someone whose record (a finished level or an answered quick check) was first saved in this period; their channel is the shared link that first brought them, kept in their browser. Links copied by hand, or forwarded without their tag, count as “No shared link”. Share and open counts are anonymous tallies that any browser can add to, so treat small numbers loosely. {s.players_all} players in all.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * How people play (the playtest's counts): desk abandonment, time on the 1.6 ripple round, poll
 * participation, free roam and jump-ahead, and Quick play. Daily totals only, with a CSV of them.
 */
function PlaySection({ win }: { win: number }) {
  const [p, setP] = useState<PlayStats | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true; setErr(false);
    playStats(win).then((r) => { if (alive) setP({ window_days: r?.window_days ?? win, since: r?.since ?? '', totals: r?.totals && typeof r.totals === 'object' ? r.totals : {}, daily: Array.isArray(r?.daily) ? r.daily : [] }); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [win]);
  const t = p?.totals ?? {};
  const n = (m: string, k: string) => t[m]?.[k] ?? 0;
  const sum = (m: string) => Object.values(t[m] ?? {}).reduce((a, x) => a + x, 0);
  const desks = ['level-5', 'level-8', 'level-10'];
  const BUCKETS: [string, string][] = [['lt15', 'under 15 s'], ['15-30', '15–30 s'], ['30-60', '30–60 s'], ['60-120', '1–2 min'], ['gt120', 'over 2 min']];
  const rippleTotal = BUCKETS.reduce((a, [k]) => a + n('ripple_time', k), 0);
  const name = (id: string) => (STOP_BY_ID[id] ? `${missionShort(STOP_BY_ID[id])}` : id);
  const csv = p ? 'day,metric,key,count\n' + p.daily.map((r) => `${r.day},${r.metric},${r.key},${r.n}`).join('\n') + '\n' : '';
  const missions = (m: string) => Object.entries(t[m] ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <Section id="play" title="How people play" sub="Anonymous daily totals for the playtest: where people stop at the budget desks, how long the ripple round takes, how many answer polls, and who skips ahead. Nothing here says who did what.">
      {err && <div className="callout small" role="status">Play counts can’t be loaded right now. If the play-counts SQL (supabase/migrations/20261115000000_play_counts.sql) hasn’t been run yet, run it in Supabase first.</div>}
      {!p && !err && <p className="small muted" role="status">Loading…</p>}
      {p && (
        <>
          <div className="table-wrap">
            <table className="data stats-table" aria-label="The budget desks: opened, started, finished">
              <thead><tr><th scope="col">Desk</th><th scope="col" className="r">Opened</th><th scope="col" className="r" title="Played at least one card">Started</th><th scope="col" className="r" title="Met the goal">Met goal</th><th scope="col" className="r" title="Started but stopped before the goal">Stopped</th></tr></thead>
              <tbody>{desks.map((d) => {
                const play = n('desk_play', d), done = n('desk_done', d);
                return <tr key={d}><th scope="row" aria-label={name(d)}>{name(d).replace(/^Mission /, '')}</th><td className="r num">{n('desk_open', d)}</td><td className="r num">{play}</td><td className="r num">{done}</td><td className="r num">{play ? `${Math.round((Math.max(0, play - done) / play) * 100)}%` : '–'}</td></tr>;
              })}</tbody>
            </table>
          </div>
          <div className="grid-4" style={{ marginTop: 12 }}>
            <Stat label="Polls seen" value={`${n('poll_view', 'feed')}`} note="once per browser per day" />
            <Stat label="Poll answers" value={`${n('poll_vote', 'feed')}`} note={n('poll_view', 'feed') ? `${fmt(n('poll_vote', 'feed') / n('poll_view', 'feed'), 1)} per view` : 'first answers to each poll'} />
            <Stat label="Free roam turned on" value={`${n('free_roam', 'on')}`} note="every mission unlocked" />
            <Stat label="Missions opened ahead" value={`${sum('jump_ahead')}`} note="before the next one in order" />
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data stats-table" aria-label="Time on mission 1.6's ripple ranking round">
              <thead><tr><th scope="col">Time on the 1.6 ripple round</th><th scope="col" className="r">Plays</th><th scope="col" className="r">Share</th></tr></thead>
              <tbody>{BUCKETS.map(([k, label]) => <tr key={k}><th scope="row">{label}</th><td className="r num">{n('ripple_time', k)}</td><td className="r num">{rippleTotal ? `${Math.round((n('ripple_time', k) / rippleTotal) * 100)}%` : '–'}</td></tr>)}</tbody>
            </table>
          </div>
          {(sum('quick_start') > 0 || sum('jump_ahead') > 0) && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="data stats-table" aria-label="Quick play and missions opened ahead, by mission">
                <thead><tr><th scope="col">Mission</th><th scope="col" className="r" title="Quick play started">Quick</th><th scope="col" className="r" title="Quick play finished">Finished</th><th scope="col" className="r" title="Opened ahead of the next mission in order">Ahead</th></tr></thead>
                <tbody>{[...new Set([...missions('quick_start'), ...missions('jump_ahead')].map(([k]) => k))].map((k) => <tr key={k}><th scope="row" aria-label={name(k)}>{name(k).replace(/^Mission /, '')}</th><td className="r num">{n('quick_start', k)}</td><td className="r num">{n('quick_done', k)}</td><td className="r num">{n('jump_ahead', k)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="small" style={{ marginTop: 10 }}>
            <a className="btn btn-sm" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)} download={`play-counts-${p.since}.csv`}>Download the daily counts (CSV)</a>{' '}
            <span className="muted">“Stopped” is the share of players who played a card but didn’t meet the goal that day. One CSV row per day, metric and key; the session guide for moderated playtests is docs/playtest-sessions.md.</span>
          </p>
        </>
      )}
    </Section>
  );
}

/** Where a partner link can lead: the game's front door, a few places in it, or a state's page. */
const PARTNER_DEST: [string, string][] = [
  ['', 'The game (main menu)'], ['#daily', 'Today’s Daily Dollar'], ['#level-3', 'Mission 1.4: federal money where you live'],
  ['#level-5', 'Mission 1.9: the first budget desk'], ['#peoples', 'The People’s Budget'], ['#together', 'Play together (classrooms)'], ['#teach', 'For teachers'],
];

/**
 * Partner codes: for each partner link (?via=code), how many people arrived by it and how far
 * they got. Plus a link maker. Daily totals only, with a CSV of them.
 */
function PartnerSection({ win }: { win: number }) {
  const [p, setP] = useState<PartnerStats | null>(null);
  const [err, setErr] = useState(false);
  const [code, setCode] = useState('');
  const [dest, setDest] = useState('');
  const [st, setSt] = useState('oh');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true; setErr(false);
    partnerStats(win).then((r) => { if (alive) setP(r); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [win]);
  const names = (PARTNERS as { codes: Record<string, string> }).codes;
  const rows = Object.entries(p?.codes ?? {}).map(([c, m]) => ({ c, a: m.arrival ?? 0, pl: m.played ?? 0, f: m.finished ?? 0, r: m.returned ?? 0, s: m.shared ?? 0 })).sort((x, y) => y.a - x.a || x.c.localeCompare(y.c));
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
  const csv = p ? 'day,code,metric,count\n' + p.daily.map((r) => `${r.day},${r.code},${r.metric},${r.n}`).join('\n') + '\n' : '';
  const clean = code.trim().toLowerCase();
  const valid = PARTNER_RE.test(clean);
  const where = dest === 'state' ? `state/${st}/` : dest;
  const link = valid ? partnerLink(clean, where) : '';
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the link is on screen to copy by hand */ } };
  const states = [...geo.states].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Section id="partners" title="Partners" sub="Each newsletter, creator, teacher group or press piece gets its own link. The first partner link a browser arrives by is credited with what that player goes on to do. Anonymous daily totals only.">
      <div className="partner-make card">
        <span className="stat-label">Make a partner link</span>
        <div className="partner-fields">
          <div className="field"><label htmlFor="pc-code">Partner code</label>
            <input id="pc-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. tangle" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={24} aria-describedby="pc-rule" />
          </div>
          <div className="field"><label htmlFor="pc-dest">Leads to</label>
            <select id="pc-dest" className="select" value={dest} onChange={(e) => setDest(e.target.value)}>
              {PARTNER_DEST.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              <option value="state">A state’s page</option>
            </select>
          </div>
          {dest === 'state' && (
            <div className="field"><label htmlFor="pc-st">State</label>
              <select id="pc-st" className="select" value={st} onChange={(e) => setSt(e.target.value)}>{states.map((x) => <option key={x.abbr} value={x.abbr.toLowerCase()}>{x.name}</option>)}</select>
            </div>
          )}
        </div>
        <p className="small muted" id="pc-rule">2 to 24 lowercase letters, digits or hyphens. One code per partner; any new code starts counting on its first visit.</p>
        {code && !valid && <p className="small zip-msg" role="alert">That code won’t count: use 2 to 24 lowercase letters, digits or hyphens, starting with a letter or digit.</p>}
        {link && (
          <div className="partner-link">
            <code className="partner-url">{link}</code>
            <button type="button" className="btn btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
        )}
      </div>
      {err && <div className="callout small" role="status">Partner counts can’t be loaded right now. If the partner SQL (supabase/migrations/20261116000000_partner_counts.sql) hasn’t been run yet, run it in Supabase first.</div>}
      {!p && !err && <p className="small muted" role="status">Loading…</p>}
      {p && (rows.length ? (
        <>
          <div className="table-wrap">
            <table className="data stats-table partner-table" aria-label="Partner links: arrivals and what those players did">
              <thead><tr><th scope="col">Partner</th><th scope="col" className="r" title="Browsers that arrived by this link for the first time">Arrived</th><th scope="col" className="r" title="Finished a mission step or a Daily Dollar">Played</th><th scope="col" className="r" title="Finished a whole mission">Done</th><th scope="col" className="r" title="Came back on a later day">Back</th><th scope="col" className="r" title="Shared something from the game">Shared</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.c}>
                  <th scope="row"><span className="num">{r.c}</span>{names[r.c] ? <span className="small muted"> · {names[r.c]}</span> : null}</th>
                  <td className="r num">{r.a}</td>
                  <td className="r num">{r.pl} <span className="small muted">{pct(r.pl, r.a)}</span></td>
                  <td className="r num">{r.f}</td>
                  <td className="r num">{r.r} <span className="small muted">{pct(r.r, r.a)}</span></td>
                  <td className="r num">{r.s}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            <a className="btn btn-sm" href={'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)} download={`partner-counts-${p.since}.csv`}>Download the daily counts (CSV)</a>{' '}
            <span className="muted">Percentages are of those who arrived. Each player counts once per step, for the first partner they came from; a partner’s players can finish or come back in a later period than they arrived.</span>
          </p>
        </>
      ) : <p className="small muted">No partner links used in this period yet.</p>)}
    </Section>
  );
}

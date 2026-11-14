import { type JSX, useEffect, useState } from 'react';
import { Stars } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { budget } from '../data';
import { moneyWords } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { useCommunity } from '../lib/community';
import { LevelIcon, LockIcon } from './icons';
import { CAMPAIGNS, diffKey, isUnlocked, LEVELS, MAX_STARS, missionShort, rankFor, STOP_BY_ID, STOPS, unlockText } from './levels';
import { span } from './daily';
import { DeficitClock } from './DeficitClock';
import { duckMusic, setMusicWanted, startMusic, stopMusic, useMusicWanted, whenAudioAllowed } from './music';
import { useNarrator } from './voice';
import { when } from './news';
import { MEDALS } from './medals';
import { GAME_NAME, SITE_URL } from './share';
import { ShareButton } from './ShareButton';
import { JOURNEY_LINES } from './script';
import { ReadingSettings } from './Settings';
import { InstallButton } from './install';
import { useJourney } from './state';
import { useDailyStreak } from './streak';
import { useMyName } from './plans';
import { MenuScene } from './MenuScene';
import { RoadPath } from './RoadPath';
import { Seal } from './Seal';
import { balanceOf, starsSpent } from './build/landmarks';
import { setAmbienceWanted, startAmbience, stopAmbience, useAmbienceWanted } from './ambience';
import { SamSays } from './UncleSam';
import { SamMenuSpot } from './samhud';
import { Feed } from './feed/Feed';
import { FollowedBills } from './feed/follow';

export { LockIcon } from './icons';

const hard = (d: string) => d === 'Hard' || d === 'Super hard';
const pillFor = (d: string) => (d === 'Easy' ? 'pill-ok' : d === 'Medium' ? 'pill-warn' : 'pill-crit');

// Uncle Sam greets a returning player by name on screen. His recorded voice says the line without
// it (a name can't be recorded ahead of time).
const byName = (line: string, name: string) => (!name ? line : /^Welcome back/.test(line) ? line.replace(/^Welcome back/, `Welcome back, ${name}`) : /^We did it, partner/.test(line) ? line.replace('partner', name) : line);

// The main menu: one screen to start from and come back to. The scene of the Mall behind; the
// title; Build the Mall, Settings and who you are in the top-right corner; Uncle Sam with what he has
// to say, standing on this year's deficit. The choices are the tab bar along the bottom (TabBar).
function useProgress() {
  const j = useJourney();
  const done = STOPS.filter((s) => j.done.includes(s.id));
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam)) ?? null;
  const minutesLeft = STOPS.filter((s) => !j.done.includes(s.id)).reduce((a, s) => a + s.minutes, 0);
  const total = STOPS.reduce((a, s) => a + s.minutes, 0);
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const rank = rankFor(done.length);
  const finished = done.length === STOPS.length;
  const fresh = !j.started && done.length === 0;
  return { j, done, next, minutesLeft, total, stars, rank, finished, fresh };
}

const isDark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };

export default function Journey() {
  const { j, done, next, stars, rank, finished, fresh } = useProgress();
  const left = balanceOf(j.stars, j.built ?? []);
  const name = useMyName();
  const n = useNarrator();
  const T = budget.receiptsByFY[String(budget.latestFY)]?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const sound = useAmbienceWanted();
  const music = useMusicWanted();
  // The music and the soundscape play only here: once the browser allows sound (the first tap
  // or key), while the tab is in view, and only while the player wants them.
  useEffect(() => {
    if (!music && !sound) return;
    const on = () => { if (music) startMusic(); if (sound) startAmbience(isDark()); };
    const off = () => { stopMusic(); stopAmbience(); };
    const vis = () => (document.hidden ? off() : on());
    const cancel = whenAudioAllowed(() => { if (!document.hidden) on(); });
    document.addEventListener('visibilitychange', vis);
    return () => { cancel(); document.removeEventListener('visibilitychange', vis); off(); };
  }, [music, sound]);
  // The music steps back while Uncle Sam talks.
  useEffect(() => { duckMusic(!!n.speakingId); }, [n.speakingId]);

  const greeting = finished
    ? JOURNEY_LINES.finished
    : fresh
      ? JOURNEY_LINES.fresh(moneyWords(T))
      : next && hard(next.difficulty)
        ? JOURNEY_LINES.hardNext(rank.name.toLowerCase())
        : JOURNEY_LINES.back(rank.name.toLowerCase());
  return (
    <div className="menu">
      <MenuScene />
      {/* The first screen: the choices on the left, the scene behind, who you are and this year's deficit on the right. */}
      <div className="menu-top">
        <header className="menu-head">
          <div className="eyebrow">A civic game about the federal budget</div>
          <h1 className="menu-title">Help Uncle Sam <span>Balance the Budget</span></h1>
        </header>
        <div className="menu-tr">
          {/* Build the Mall, with the stars there are to spend, in marble and gold like the scene. */}
          <a className="menu-mall" href="#mall" aria-label={`Build the Mall: ${left} ${left === 1 ? 'star' : 'stars'} to spend`} title="Build the Mall">
            <MenuIcon id="capitol" size={22} /><span className="menu-mall-stars" aria-hidden="true">★ {left}</span>
          </a>
          <a className="menu-toggle" href="#settings" aria-label="Settings: text size, theme, Uncle Sam’s voice, music" title="Settings"><MenuIcon id="gear" size={20} /></a>
          <a className="menu-profile" href="#guide" aria-label={`Your record: ${rank.name}, ${done.length} of ${STOPS.length} missions, ${j.medals.length} medals`}>
            <span className="mp-badge" aria-hidden="true"><MenuIcon id="record" /></span>
            <span className="mp-text">
              <strong>{name || 'Your record'}</strong>
              <span className="mp-rank">{rank.name}</span>
            </span>
            <span className="mp-stats" aria-hidden="true"><span>{done.length}/{STOPS.length}</span><span><MenuIcon id="medal" size={14} /> {j.medals.length}</span></span>
          </a>
        </div>
        {/* Uncle Sam, close up, with what he has to say, standing on this year's deficit. The
            choices are the tab bar along the bottom. */}
        <div className="menu-main">
          <SamMenuSpot />
          <div className="menu-deficit"><DeficitClock /></div>
        </div>
      </div>
      {/* Below: the feed, every post the game has, official ones first while they're fresh. */}
      <Feed />
      {/* What Uncle Sam says here (he stands above the buttons). */}
      <SamSays mood={finished ? 'cheering' : fresh ? 'happy' : next && hard(next.difficulty) ? 'worried' : 'thinking'} auto say={greeting}>
        {byName(greeting, name)}
      </SamSays>
    </div>
  );
}

type MenuIconId = 'build' | 'play' | 'story' | 'map' | 'together' | 'daily' | 'book' | 'record' | 'medal' | 'gear' | 'chart' | 'doc' | 'sound' | 'mute' | 'back' | 'music' | 'music-off' | 'wind' | 'clock' | 'home' | 'capitol' | 'you';
const MENU_PATHS: Record<MenuIconId, JSX.Element> = {
  build: <><path d="M3.5 9 12 4l8.5 5" /><path d="M4.5 9.5h15M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7M3.5 20h17M4.5 17.8h15" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" fill="currentColor" /></>,
  story: <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6M9 10.5h6M9 14h3.5" /></>,
  map: <><path d="M3.5 6.5 9 4l6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  together: <><circle cx="8.5" cy="8.5" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M3 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14 14.3c.8-.4 1.6-.6 2.5-.6 2.2 0 4 1.5 4.5 4.3" /></>,
  daily: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M12 12.5v5M10 14h3.2a1.3 1.3 0 0 1 0 2.6H10.6" /></>,
  book: <><path d="M4 5.5C6.5 4.3 9.5 4.3 12 6c2.5-1.7 5.5-1.7 8-.5V19c-2.5-1.2-5.5-1.2-8 .5-2.5-1.7-5.5-1.7-8-.5z" /><path d="M12 6v13.5" /></>,
  record: <><circle cx="12" cy="9" r="5.5" /><path d="m9 13.8-1.5 6.7L12 18l4.5 2.5-1.5-6.7" /><path d="m12 6.6.8 1.6 1.7.2-1.3 1.2.4 1.7-1.6-.9-1.6.9.4-1.7-1.3-1.2 1.7-.2z" /></>,
  medal: <><circle cx="12" cy="14" r="6" /><path d="M8.5 3h7L13 9h-2z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  doc: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 15.5h6" /></>,
  sound: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  mute: <><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  music: <><path d="M9 18V5.5l10-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  'music-off': <><path d="M9 18V5.5l10-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /><path d="M3.5 3.5l17 17" /></>,
  wind: <><path d="M3 9h11a3 3 0 1 0-3-3" /><path d="M3 13h15a3 3 0 1 1-3 3" /><path d="M3 17h6" /></>,
  home: <><path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  capitol: <><path d="M12 2.5v2" /><path d="M8 10.5a4 4 0 0 1 8 0" /><path d="M7 10.5h10M7.5 10.5v2.5M16.5 10.5v2.5" /><path d="M3 13h18M4 13v6M8 13v6M12 13v6M16 13v6M20 13v6M2.5 20.5h19" /></>,
  you: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
};
export function MenuIcon({ id, size = 22 }: { id: MenuIconId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MENU_PATHS[id]}</svg>;
}

const ROADMAP_AT = 'ftd:roadmap-at';

/** The road map, as its own page: the three campaigns and their missions, with progress at the top. */
export function LevelsPage() {
  const j = useJourney();
  // Another page may ask for a campaign (the mission list in the top bar); otherwise the path opens at your stop.
  const [at] = useState(() => { try { const v = sessionStorage.getItem(ROADMAP_AT); sessionStorage.removeItem(ROADMAP_AT); return v; } catch { return null; } });
  return (
    <div className="journey journey-path">
      <PageHead eyebrow="Campaigns" title="The road map" />
      <RoadPath scrollTo={at} />
      {j.plans && Object.keys(j.plans).length > 0 && <p className="small"><a href="#story">Your Budget Story</a>: your plans and your budget personality, as cards to share.</p>}
    </div>
  );
}

/** Your record now lives at the top of the Guide tab; the old address goes there. */
export function RecordPage() {
  useEffect(() => { location.replace('#guide'); }, []);
  return null;
}

/**
 * Your record, at the top of the Guide tab: one card with who you are, how far you've got
 * (the progress that used to sit in the top bar), and what you've earned; then your missions as
 * badges that open to what you learned; your ballot, briefly; how everyone played; medals; and
 * the posts you saved from the feed.
 */
export function RecordTop() {
  const { j, done, next, stars, rank, finished } = useProgress();
  const name = useMyName();
  const votes = useVotes();
  const streak = useDailyStreak();
  const left = balanceOf(j.stars, j.built ?? []);
  const polls = Object.keys(votes.mine.options).length + Object.keys(votes.mine.issues).length;
  const bills = Object.keys(j.feedVotes ?? {}).filter((k) => k.startsWith('bill:')).length;
  const checks = Object.keys(j.feedChecks ?? {}).length;
  // Sent here for Settings (the main menu's gear, or #settings): scroll to them once the page is up.
  useEffect(() => {
    let go = false;
    try { go = sessionStorage.getItem('ftd:goto') === 'settings'; } catch { /* private mode */ }
    if (!go) return;
    // The flag is cleared only once the scroll happens (effects can run twice in development).
    const t = setTimeout(() => {
      try { sessionStorage.removeItem('ftd:goto'); } catch { /* private mode */ }
      document.getElementById('settings')?.scrollIntoView({ block: 'start' });
    }, 80);
    return () => clearTimeout(t);
  }, []);
  const right = Object.values(j.feedChecks ?? {}).filter(Boolean).length;
  return (
    <div className="record">
      <section className="card rc-card" aria-labelledby="rc-name">
        <div className="rc-who">
          <span className="rc-badge" aria-hidden="true"><MenuIcon id="record" size={26} /></span>
          <div>
            <h2 className="rc-name" id="rc-name">{name || 'Your record'}</h2>
            <span className="rc-rank">{rank.name}</span>
            <a className="rc-streak" href="#daily" data-on={streak.run > 0 || undefined} aria-label={`Daily Dollar streak: ${streak.run} day${streak.run === 1 ? '' : 's'} in a row; best ${streak.best}`}>
              <span aria-hidden="true">🔥</span> <strong className="num">{streak.run}</strong> {streak.run === 1 ? 'day' : 'days'} in a row{streak.best > streak.run ? <span className="muted"> · best {streak.best}</span> : null}
              {streak.run === 0 && <span className="muted"> · play today’s Daily Dollar to start one</span>}
            </a>
          </div>
        </div>
        <div className="rc-progress">
          <div className="rc-progress-head"><strong className="num">{done.length}</strong><span> of {STOPS.length} missions</span></div>
          <div className="rc-camps">
            {CAMPAIGNS.map((c) => {
              const n = c.missions.filter((m) => j.done.includes(m)).length;
              return (
                <a key={c.n} className="rc-camp" href="#levels" aria-label={`Campaign ${c.n}, ${c.title}: ${n} of ${c.missions.length} missions`}>
                  <span className="rc-camp-k">Campaign {c.n}</span>
                  <span className="rc-camp-bar" aria-hidden="true">{c.missions.map((m) => <span key={m} data-done={j.done.includes(m) || undefined} />)}</span>
                </a>
              );
            })}
          </div>
          <div className="rc-next">
            {next ? <a className="btn btn-primary" href={'#' + next.id}>{done.length ? 'Continue' : 'Start'}: {missionShort(next)}, {next.title}</a> : <span className="small">Every mission done.</span>}
            <a className="btn" href="#levels">Road map</a>
          </div>
        </div>
        <dl className="rc-stats">
          <div><dt>Stars won</dt><dd>★ {stars}<span className="muted">/{MAX_STARS}</span></dd></div>
          <div><dt>To spend</dt><dd><a href="#mall">★ {left}</a></dd></div>
          <div><dt>Medals</dt><dd>{j.medals.length}<span className="muted">/{MEDALS.length}</span></dd></div>
          <div><dt>Polls</dt><dd>{polls}</dd></div>
          <div><dt>Bills</dt><dd>{bills}</dd></div>
          <div><dt>Checks</dt><dd>{right}<span className="muted">/{checks}</span></dd></div>
        </dl>
        <p className="small muted rc-note">Saved in this browser only. Stars spent on the Mall: ★ {starsSpent(j.built ?? [])}.</p>
      </section>

      {Object.keys(j.follows ?? {}).length > 0 && (
        <Section id="following" title="Bills you follow" sub="Where each bill stands now. A bill that moved since you last looked is marked.">
          <FollowedBills />
        </Section>
      )}

      <SettingsBlock />

      <Section id="missions" title="Your missions" sub="A badge for every mission you finish. Tap one to see what you learned.">
        <MissionBadges />
      </Section>

      <Section id="ballot" title="Your budget ballot" sub={votes.available ? 'How you voted, next to everyone who played.' : 'How you voted in the missions.'}>
        <Ballot />
      </Section>

      <EveryonePlayed finished={finished} />

      <Section id="medals" title="Medals" sub={`${j.medals.length} of ${MEDALS.length}. They reward taking part and reading the fine print as much as winning.`}>
        <ul className="rc-medals">
          {MEDALS.map((m) => {
            const got = j.medals.includes(m.id);
            return (
              <li key={m.id} className="rc-medal" data-got={got || undefined} title={m.desc}>
                <span className="medal-disc" aria-hidden="true">{got ? '★' : ''}</span>
                <span><strong>{m.name}</strong><span className="small muted"> {got ? m.desc : 'Not yet'}</span></span>
              </li>
            );
          })}
        </ul>
      </Section>

      {(j.saved ?? []).length > 0 && (
        <Section id="saved" title="Saved for later" sub="Posts you saved from the feed, newest first.">
          <ul className="saved-list">
            {(j.saved ?? []).map((s) => (
              <li key={s.id} className="card saved-item">
                <a href={s.href} {...(/^https?:/.test(s.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><strong>{s.title}</strong><span className="small muted">{s.source}</span></a>
                <button type="button" className="btn btn-sm" onClick={() => j.toggleSaved(s)} aria-label={`Remove from saved: ${s.title}`}>Remove</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {finished && (
        <div className="certificate card">
          <Seal icon="capitol" ring={`INFORMED BUDGET VOTER · ALL ${STOPS.length} MISSIONS`} grand size={110} />
          <div>
            <div className="complete-title">Informed Budget Voter</div>
            <p className="small muted">For learning where federal money comes from and goes, why the government borrows, how Congress budgets, what the future holds for Social Security, and for casting a vote on each.</p>
            {streak.best >= 2 && <p className="small"><span aria-hidden="true">🔥</span> Best Daily Dollar streak: <strong>{streak.best} days</strong></p>}
            <div className="sb-actions" style={{ marginTop: 8 }}><ShareButton kind="level" text={`I finished all ${STOPS.length} missions of “${GAME_NAME}” and earned ${stars} of ${MAX_STARS} stars${streak.best >= 2 ? `, with a ${streak.best}-day Daily Dollar streak 🔥` : ''}. I’m an Informed Budget Voter.`} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Every mission as a badge: its seal once finished, a dashed outline until then. Tapping one opens
 * a sheet with what it taught, so the grid of badges stays put.
 */
function MissionBadges() {
  const j = useJourney();
  const [open, setOpen] = useState<string | null>(null);
  const s = open ? STOP_BY_ID[open] : null;
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [open]);
  return (
    <>
      <ul className="mb-grid">
        {STOPS.map((m) => {
          const got = j.done.includes(m.id);
          const n = j.stars[m.id] ?? 0;
          return (
            <li key={m.id} className="mb-item" data-got={got || undefined}>
              <button type="button" className="mb-tile" aria-haspopup="dialog" aria-pressed={open === m.id} onClick={() => setOpen(m.id)}
                aria-label={`${missionShort(m)}, ${m.title}: ${got ? `complete, ${n} of 3 stars` : 'not finished yet'}. Show details`}>
                {got ? <Seal icon={m.icon} ring={`MISSION ${m.campaign}.${m.mission} · COMPLETE`} stars={n} diff={diffKey(m.difficulty)} size={64} />
                  : <span className="mb-empty" aria-hidden="true"><LevelIcon id={m.icon} size={22} /></span>}
                <span className="mb-code">{m.campaign}.{m.mission}</span>
                <span className="mb-name">{m.badge}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {s && <MissionSheet s={s} close={() => setOpen(null)} />}
    </>
  );
}

function MissionSheet({ s, close }: { s: (typeof STOPS)[number]; close: () => void }) {
  const j = useJourney();
  const got = j.done.includes(s.id);
  const n = j.stars[s.id] ?? 0;
  const lv = LEVELS.find((l) => l.id === s.id);
  return (
    <div className="mb-scrim" onClick={close}>
      <div className="mb-sheet card" role="dialog" aria-modal="true" aria-labelledby="mb-sheet-t" onClick={(e) => e.stopPropagation()}>
        <div className="mb-sheet-head">
          {got ? <Seal icon={s.icon} ring={`MISSION ${s.campaign}.${s.mission} · COMPLETE`} stars={n} diff={diffKey(s.difficulty)} size={84} />
            : <span className="mb-empty mb-empty-lg" aria-hidden="true"><LevelIcon id={s.icon} size={28} /></span>}
          <div>
            <span className="mb-code">{missionShort(s)} · {s.difficulty}{got ? ` · ${'★'.repeat(n)}${'☆'.repeat(3 - n)}` : ''}</span>
            <h3 className="mb-sheet-title" id="mb-sheet-t">{s.badge}</h3>
            <span className="small muted">{s.title}</span>
          </div>
          <button type="button" className="mb-close" onClick={close} aria-label="Close" autoFocus>✕</button>
        </div>
        {got ? (
          <>
            {lv ? <ul className="factcard-list">{lv.takeaways.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="small">A budget-desk mission: you built a plan that met its goal.</p>}
            <div className="factcard-actions">
              {lv && <ShareButton kind="level" className="btn btn-sm" text={`Did you know? ${lv.takeaways[0]} (from “${GAME_NAME}”, built on official U.S. government data)`} url={SITE_URL + '#' + lv.id} />}
              <a className="btn btn-sm" href={'#' + s.id}>Play again</a>
              {lv?.deepDive[0] && <a className="small" href={'#' + lv.deepDive[0].route}>The full chapter</a>}
            </div>
          </>
        ) : (
          <>
            <p className="small">{s.topic}</p>
            <a className="btn btn-primary" href={'#' + s.id}>Play to earn this badge</a>
          </>
        )}
      </div>
    </div>
  );
}

/** How everyone played, in three numbers and a link to the full results and votes. */
function EveryonePlayed({ finished }: { finished: boolean }) {
  const c = useCommunity();
  const v = useVotes();
  const t = c.totals;
  const cast = Object.values(v.options).reduce((a, x) => a + x.support + x.oppose, 0);
  return (
    <section className="card ep-card" aria-labelledby="ep-t">
      <div className="ep-head">
        <h2 className="section-title" id="ep-t">How everyone played</h2>
        <p className="small muted">{finished ? 'You finished. Here’s how everyone else did.' : 'How far players got, what they got right, and how they voted.'}</p>
      </div>
      {c.available || v.available ? (
        <dl className="ep-stats">
          <div><dt>Players</dt><dd>{t.players.toLocaleString()}</dd></div>
          <div><dt>Finished every mission</dt><dd>{t.finishedAll == null ? '—' : t.finishedAll.toLocaleString()}</dd></div>
          <div><dt>Votes on budget ideas</dt><dd>{cast.toLocaleString()}</dd></div>
        </dl>
      ) : <p className="small muted">Everyone’s results show on balancethebudget.us.</p>}
      <a className="btn btn-primary" href="#results">Results and votes</a>
    </section>
  );
}

/** The main menu's music and soundscape. */
function MenuSoundSettings() {
  const music = useMusicWanted();
  const sound = useAmbienceWanted();
  return (
    <section className="card" aria-labelledby="menu-sound-t">
      <h2 className="section-title" id="menu-sound-t">On the main menu</h2>
      <label className="switch"><input type="checkbox" checked={music} onChange={(e) => setMusicWanted(e.target.checked)} /> Music: a soft loop, quieter while Uncle Sam talks</label>
      <label className="switch"><input type="checkbox" checked={sound} onChange={(e) => setAmbienceWanted(e.target.checked)} /> Sounds of the Mall: wind and birdsong, or crickets at night</label>
      <p className="small muted">Both play only on the main menu, start with your first tap or key there, and stop when you leave.</p>
    </section>
  );
}

/** Settings live on the You tab now, under your record; the old address (and the main menu's
 * gear) goes there and scrolls to them. */
export function SettingsPage() {
  useEffect(() => {
    try { sessionStorage.setItem('ftd:goto', 'settings'); } catch { /* private mode */ }
    location.replace('#guide');
  }, []);
  return null;
}

/** Settings, on the You tab: install, reading and sound, voice, and the main menu's music. */
function SettingsBlock() {
  return (
    <Section id="settings" title="Settings" sub="Make the game comfortable to read and hear. Saved in this browser.">
      <div className="settings-block">
        <div className="card"><InstallButton /><ReadingSettings /></div>
        <MenuSoundSettings />
      </div>
    </Section>
  );
}

/** Your ballot, briefly: one row per vote, your answer as a mark, and how everyone split. */
function Ballot() {
  const j = useJourney();
  const votes = useVotes();
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const rows = LEVELS.flatMap((l) => l.steps.filter((s) => s.vote).map((s) => {
    const v = s.vote!;
    if (v.kind === 'option') {
      const o = OPTIONS_DATA.options.find((x) => x.id === v.optionId)!;
      const shared = votes.available ? votes.mine.options[o.id] : undefined;
      const c = shared === 1 ? 'support' : shared === -1 ? 'oppose' : j.choices['option:' + o.id] || '';
      const t = votes.options[o.id];
      const n = t ? t.support + t.oppose : 0;
      return { level: l, q: o.name, a: c === 'support' ? 'Support' : c === 'oppose' ? 'Oppose' : '', mark: c === 'support' ? 'yes' : c === 'oppose' ? 'no' : '', share: n ? { p: Math.round(((c === 'oppose' ? t.oppose : t.support) / n) * 100), n } : null };
    }
    const c = (votes.available ? votes.mine.issues[v.id] : undefined) ?? j.choices[v.id] ?? '';
    const t = votes.issues[v.id];
    const n = t ? Object.values(t).reduce((a, x) => a + x, 0) : 0;
    return { level: l, q: v.question, a: v.choices.find((x) => x.value === c)?.label ?? '', mark: c ? 'pick' : '', share: n && c ? { p: Math.round(((t[c] ?? 0) / n) * 100), n } : null };
  }));
  const cast = rows.filter((r) => r.a);
  const text = [`My budget ballot from “${GAME_NAME}”:`, ...cast.map((r) => `• ${r.q}: ${r.a}`)].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied('done'); } catch { setCopied('manual'); } };
  return (
    <div className="card bl-card">
      <div className="bl-meter" role="img" aria-label={`${cast.length} of ${rows.length} questions answered`}>
        {rows.map((r) => <span key={r.q} data-mark={r.mark || undefined} />)}
      </div>
      <p className="small muted bl-count">{cast.length} of {rows.length} answered{cast.length < rows.length ? ' · the rest are in the missions' : ''}</p>
      {cast.length > 0 && (
        <ul className="bl-list">
          {cast.map((r) => (
            <li key={r.q}>
              <span className="bl-mark" data-mark={r.mark} aria-hidden="true">{r.mark === 'yes' ? '✓' : r.mark === 'no' ? '✕' : '●'}</span>
              <span className="bl-q">{r.q}</span>
              <span className="bl-a">{r.a}</span>
              {r.share && (
                <span className="bl-share" title={`${r.share.p}% of ${r.share.n} players answered the same`}>
                  <span className="bl-share-bar" aria-hidden="true"><span style={{ width: `${r.share.p}%` }} /></span>
                  <span className="small muted">{r.share.p}% agree</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {cast.length > 0 && (
        <div className="sb-actions bl-actions">
          <button type="button" className="btn btn-sm" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy my ballot'}</button>
          <ShareButton kind="level" className="btn btn-sm" text={text} />
        </div>
      )}
      {copied === 'manual' && <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your ballot, ready to copy" />}
    </div>
  );
}


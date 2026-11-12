import { type JSX, useEffect, useRef, useState } from 'react';
import { Stars } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { budget } from '../data';
import { moneyWords } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { LevelIcon, LockIcon } from './icons';
import { CAMPAIGNS, diffKey, isUnlocked, LEVELS, MAX_STARS, missionShort, rankFor, STOP_BY_ID, STOPS, unlockText } from './levels';
import { dayNumber, editionName, loadResults, longDate, nextDeadline, nextTheme, ROUNDS, span, type ThemeId, themeFor, todayKey, untilNext } from './daily';
import { useDebtClock } from './DebtClock';
import { DeficitClock } from './DeficitClock';
import { duckMusic, setMusicWanted, startMusic, stopMusic, useMusicWanted, whenAudioAllowed } from './music';
import { useNarrator } from './voice';
import { mergeNews, when } from './news';
import { useLive } from '../lib/live';
import { backendOn } from '../lib/backend';
import { MEDALS } from './medals';
import { GAME_NAME, SITE_URL } from './share';
import { ShareButton } from './ShareButton';
import { JOURNEY_LINES } from './script';
import { ReadingSettings } from './Settings';
import { InstallButton } from './install';
import { useJourney } from './state';
import { useMyName } from './plans';
import { MenuScene } from './MenuScene';
import { Seal } from './Seal';
import { balanceOf, currentLandmark, doneCount } from './build/landmarks';
import { setAmbienceWanted, startAmbience, stopAmbience, useAmbienceWanted } from './ambience';
import { SamSays } from './UncleSam';
import { SamMenuSpot } from './samhud';

export { LockIcon } from './icons';

const hard = (d: string) => d === 'Hard' || d === 'Super hard';
const pillFor = (d: string) => (d === 'Easy' ? 'pill-ok' : d === 'Medium' ? 'pill-warn' : 'pill-crit');

// Uncle Sam greets a returning player by name on screen. His recorded voice says the line without
// it (a name can't be recorded ahead of time).
const byName = (line: string, name: string) => (!name ? line : /^Welcome back/.test(line) ? line.replace(/^Welcome back/, `Welcome back, ${name}`) : /^We did it, partner/.test(line) ? line.replace('partner', name) : line);

// The main menu: one screen to start from and come back to. Big choices on the left, in the
// order players want them (carry on, pick a level, play with others, today's puzzle, read); who
// you are in the top-right corner; live numbers on the right; small things in the bottom
// corners. Every choice leads to its own page, and every page leads back here.
const NEWS = [
  { date: '2026-11-11', title: 'New mission 3.4: Compared to what?', body: 'The same budget gap, two yardsticks: history and today’s needs. Plus who pays the income tax in your county.', href: '#level-yardstick' },
  { date: '2026-11-10', title: 'Every mission is a game, and four new ones', body: 'Score points in every lesson mission, then learn how Congress really budgets: who does what, the rules, and the brakes.', href: '#levels' },
  { date: '2026-11-09', title: 'Three campaigns, sixteen missions', body: 'Six new missions on how a change hits the economy, who pays, and what grows it, plus plan ideas on every desk.', href: '#levels' },
  { date: '2026-11-08', title: 'Duel a friend on the final mission', body: 'Two plans built blind, three rounds, and fewer cards breaks a tie.', href: '#together' },
  { date: '2026-11-07', title: 'The debt clock is live', body: 'Ticking from the Treasury’s own count, with the room left under the debt limit.', href: '#clock' },
];

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
  const name = useMyName();
  const n = useNarrator();
  const T = budget.receiptsByFY[String(budget.latestFY)]?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const key = todayKey();
  const played = loadResults()[key];
  const theme = themeFor(key);
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
  const primary = next
    ? { href: '#' + next.id, title: fresh ? 'Start the game' : 'Continue', sub: `${missionShort(next)}: ${next.title} · about ${next.minutes} min`, icon: 'play' as const }
    : { href: '#story', title: 'Your Budget Story', sub: 'Your plans and your budget personality, as cards to share', icon: 'story' as const };
  // Build the Mall: the stars to spend, and the landmark going up.
  const built = j.built ?? [];
  const mallCur = currentLandmark(built);
  const mallBal = balanceOf(j.stars, built);
  const mallSub = mallCur ? `★ ${mallBal} to spend · ${mallCur.short}, ${doneCount(mallCur, built)} of ${mallCur.tasks.length} built` : 'The whole Mall is built: see it';
  const items: { href: string; title: string; sub: string; icon: MenuIconId }[] = [
    { href: '#mall', title: 'Build the Mall', sub: mallSub, icon: 'build' },
    { href: '#daily', title: 'The Daily Dollar', sub: played && played.length >= ROUNDS ? `#${dayNumber(key)} done: ${played.filter(Boolean).length} of ${ROUNDS} · next in ${untilNext()}` : `#${dayNumber(key)}${theme ? ` · ${editionName(theme)}` : ''} · five calls, about a minute`, icon: 'daily' },
    { href: '#together', title: 'Play together', sub: 'Duel a friend, start a room, pass the budget', icon: 'together' },
    { href: '#guide', title: 'Field guide', sub: 'Every chapter in full, with sources and methods', icon: 'book' },
  ];
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
          <button type="button" className="menu-toggle" aria-pressed={music} onClick={() => setMusicWanted(!music)} aria-label={music ? 'Music: on. Turn it off' : 'Music: off. Turn it on'} title={music ? 'Music: on' : 'Music: off'}>
            <MenuIcon id={music ? 'music' : 'music-off'} size={20} />
          </button>
          <button type="button" className="menu-toggle" aria-pressed={sound} onClick={() => setAmbienceWanted(!sound)} aria-label={sound ? 'Sounds of the Mall: on. Turn them off' : 'Sounds of the Mall: off. Turn them on'} title={sound ? 'Sounds of the Mall: on' : 'Sounds of the Mall: off'}>
            <MenuIcon id={sound ? 'wind' : 'mute'} size={20} />
          </button>
          {/* Settings: text size, theme, Uncle Sam's voice, music. */}
          <a className="menu-toggle" href="#settings" aria-label="Settings: text size, theme, Uncle Sam’s voice, music" title="Settings"><MenuIcon id="gear" size={20} /></a>
          <a className="menu-profile" href="#record" aria-label={`Your record: ${rank.name}, ${stars} of ${MAX_STARS} stars, ${done.length} of ${STOPS.length} missions, ${j.medals.length} medals`}>
            <span className="mp-badge" aria-hidden="true"><MenuIcon id="record" /></span>
            <span className="mp-text">
              <strong>{name || 'Your record'}</strong>
              <span className="mp-rank">{rank.name}</span>
            </span>
            <span className="mp-stats" aria-hidden="true"><span>★ {stars}</span><span>{done.length}/{STOPS.length}</span><span><MenuIcon id="medal" size={14} /> {j.medals.length}</span></span>
          </a>
        </div>
        <nav className="menu-main" aria-label="Main menu">
          {/* Uncle Sam, close up, right on top of the buttons, with what he has to say. */}
          <SamMenuSpot />
          <div className="menu-continue">
            <MenuItem {...primary} primary />
            <CampaignChips />
          </div>
          {items.map((x) => <MenuItem key={x.href} {...x} />)}
        </nav>
        <div className="menu-deficit"><DeficitClock /></div>
      </div>
      {/* What Uncle Sam says here (he stands above the buttons). */}
      <SamSays mood={finished ? 'cheering' : fresh ? 'happy' : next && hard(next.difficulty) ? 'worried' : 'thinking'} auto say={greeting}>
        {byName(greeting, name)}
      </SamSays>
      <TodayStrip />
    </div>
  );
}

type MenuIconId = 'build' | 'play' | 'story' | 'map' | 'together' | 'daily' | 'book' | 'record' | 'medal' | 'gear' | 'chart' | 'doc' | 'sound' | 'mute' | 'back' | 'music' | 'music-off' | 'wind' | 'clock';
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
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
};
export function MenuIcon({ id, size = 22 }: { id: MenuIconId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MENU_PATHS[id]}</svg>;
}

const ROADMAP_AT = 'ftd:roadmap-at';
/** Inside Continue: the three campaigns; a tap opens the road map at that campaign. */
function CampaignChips() {
  const j = useJourney();
  return (
    <div className="mc-camps" role="group" aria-label="Campaigns">
      {CAMPAIGNS.map((c) => {
        const ms = STOPS.filter((s) => s.campaign === c.n);
        const fin = ms.filter((s) => j.done.includes(s.id)).length;
        const open = isUnlocked(ms[0].id, j.done, j.settings.freeRoam);
        return (
          <a key={c.n} className="mc-camp" href="#levels" data-open={open} data-done={fin === ms.length || undefined}
            onClick={() => { try { sessionStorage.setItem(ROADMAP_AT, 'campaign-' + c.n); } catch { /* the road map opens at the top */ } }}
            title={c.title} aria-label={`Campaign ${c.n}: ${c.title}. ${fin} of ${ms.length} missions done${open ? '' : '. Locked'}`}>
            <span className="mc-k">{open ? null : <LockIcon />}Campaign {c.n}</span>
          </a>
        );
      })}
    </div>
  );
}

function MenuItem({ href, title, sub, icon, primary = false }: { href: string; title: string; sub: string; icon: MenuIconId; primary?: boolean }) {
  return (
    <a className={'menu-item' + (primary ? ' menu-item-primary' : '')} href={href}>
      <span className="mi-icon"><MenuIcon id={icon} size={primary ? 30 : 24} /></span>
      <span className="mi-text"><span className="mi-title">{title}</span><span className="mi-sub">{sub}</span></span>
      <span className="mi-go" aria-hidden="true">›</span>
    </a>
  );
}

/** The road map, as its own page: the three campaigns and their missions, with progress at the top. */
export function LevelsPage() {
  const { j, done, next, minutesLeft, total, stars, rank, finished } = useProgress();
  useEffect(() => {
    let at: string | null = null;
    try { at = sessionStorage.getItem(ROADMAP_AT); sessionStorage.removeItem(ROADMAP_AT); } catch { /* no storage: stay at the top */ }
    if (at && at !== 'campaign-1') requestAnimationFrame(() => document.getElementById(at!)?.scrollIntoView({ block: 'start' }));
  }, []);
  return (
    <div className="journey">
      <PageHead eyebrow="Campaigns" title="The road map" lede="Three campaigns, each with one goal. Missions go from easy to hard, and each one teaches an idea you’ll use at the campaign’s final mission, the budget desk." />
      <div className="card journey-progress" aria-label="Your progress">
        <div className="jp-rank">
          <span className="stat-label">Your title</span>
          <strong>{rank.name}</strong>
        </div>
        <div className="jp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={done.length} aria-label={`${done.length} of ${STOPS.length} missions done`}>
          {STOPS.map((s) => <span key={s.id} data-done={j.done.includes(s.id)} data-desk={s.kind === 'desk'} data-camp-start={(s.mission === 1 && s.campaign > 1) || undefined} />)}
        </div>
        <div className="small"><strong>{done.length} of {STOPS.length}</strong> missions · <strong>★ {stars}</strong> of {MAX_STARS} stars · {finished ? 'all done' : `about ${minutesLeft} of ${total} minutes left`}</div>
      </div>
      {CAMPAIGNS.map((c) => {
        const ms = STOPS.filter((s) => s.campaign === c.n);
        const fin = ms.filter((s) => j.done.includes(s.id)).length;
        return (
          <Section key={c.n} id={'campaign-' + c.n} eyebrow={`Campaign ${c.n} · ${fin} of ${ms.length} missions`} title={c.title} sub={c.blurb}>
            <ol className="roadmap">
              {ms.map((s) => {
                const isDone = j.done.includes(s.id);
                const open = isUnlocked(s.id, j.done, j.settings.freeRoam);
                const st = j.stars[s.id] ?? 0;
                return (
                  <li key={s.id} className="stop" data-done={isDone} data-open={open} data-kind={s.kind} data-hard={hard(s.difficulty)} data-diff={diffKey(s.difficulty)} data-next={s.id === next?.id}>
                    <span className="stop-node" aria-hidden="true">{open || isDone ? <LevelIcon id={s.icon} size={20} /> : <LockIcon />}</span>
                    <div className="stop-body">
                      <div className="stop-meta">
                        <span>{s.final ? `Final mission` : `Mission ${s.campaign}.${s.mission}`}</span>
                        <span className={'pill ' + pillFor(s.difficulty)}>{s.difficulty}{s.kind === 'desk' ? ' · budget desk' : ''}</span>
                        <span className="muted">about {s.minutes} min</span>
                        {isDone && <Stars n={st} size="sm" label={`${st} of 3 stars`} />}
                      </div>
                      <h3 className="stop-title">{open ? <a href={'#' + s.id}>{s.title}</a> : s.title}</h3>
                      <div className="small muted">{open ? s.topic : unlockText(s.id)}</div>
                    </div>
                    {open && <a className={'btn' + (s.id === next?.id ? ' btn-primary' : '')} href={'#' + s.id} aria-label={`${isDone ? 'Replay' : 'Play'} ${missionShort(s)}: ${s.title}`}>{isDone ? 'Replay' : s.id === next?.id ? 'Play' : 'Open'}</a>}
                  </li>
                );
              })}
            </ol>
          </Section>
        );
      })}
      {j.plans && Object.keys(j.plans).length > 0 && <p className="small"><a href="#story">Your Budget Story</a>: your plans and your budget personality, as cards to share.</p>}
      <ActionBar label="Play">
        {next ? <a className="btn btn-primary" href={'#' + next.id}>{done.length ? `Continue: ${missionShort(next)}, ${next.title}` : 'Start mission 1.1'}</a> : <a className="btn btn-primary" href="#story">See your Budget Story</a>}
      </ActionBar>
    </div>
  );
}

/** Your record: fact cards, the ballot, medals, and certificates. */
export function RecordPage() {
  const { j, stars, finished } = useProgress();
  const votes = useVotes();
  return (
    <div className="journey">
      <PageHead eyebrow="Your record" title="Your record" lede="What you’ve learned, how you voted, and what you’ve earned. Saved in this browser only." />
      <Section id="facts" title="Your fact cards" sub="Every chapter you finish adds a card of what you learned, with the source. Share any of them.">
        <div className="factcards">
          {LEVELS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <article key={l.id} className="factcard" data-got={got} data-diff={diffKey(l.difficulty)}>
                <div className="factcard-top"><span className="factcard-icon"><LevelIcon id={l.icon} size={18} /></span><span className="stat-label">{missionShort(STOP_BY_ID[l.id])} · {l.badge}</span></div>
                {got ? (
                  <>
                    <ul className="factcard-list">{l.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
                    <div className="factcard-actions">
                      <ShareButton kind="level" className="btn btn-sm" text={`Did you know? ${l.takeaways[0]} (from “${GAME_NAME}”, built on official U.S. government data)`} url={SITE_URL + '#' + l.id} />
                      {l.deepDive[0] && <a className="small" href={'#' + l.deepDive[0].route}>The full chapter</a>}
                    </div>
                  </>
                ) : (
                  <p className="small muted">Finish {missionShort(STOP_BY_ID[l.id])}, {l.title}, to collect this card.</p>
                )}
              </article>
            );
          })}
        </div>
      </Section>

      <div className="callout results-callout">
        <div className="callout-title">{finished ? 'You finished the game. How did everyone else do?' : 'How is everyone else doing?'}</div>
        <p className="small">See how far players got, how many got each question right, and how everyone voted on every question and policy card. <a href="#results">How everyone played</a></p>
      </div>

      <Section id="ballot" title="Your budget ballot" sub={votes.available ? 'Your votes from each mission, counted with everyone else who opened this page.' : 'Your votes from each mission, saved in this browser.'}>
        <Ballot />
      </Section>

      <Section id="medals" title="Medals" sub={`${j.medals.length} of ${MEDALS.length} earned. Medals reward taking part, reading the fine print, and sharing, as much as winning.`}>
        <div className="medals">
          {MEDALS.map((m) => {
            const got = j.medals.includes(m.id);
            return (
              <div key={m.id} className="medal" data-got={got}>
                <span className="medal-disc" aria-hidden="true">{got ? '★' : ''}</span>
                <div><strong>{m.name}</strong><div className="small muted">{m.desc}</div></div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="awards" title="Certificates" sub="Earn one for each mission you finish. Saved in this browser only.">
        <div className="badges">
          {STOPS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <div key={l.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? <LevelIcon id={l.icon} size={18} /> : `${l.campaign}.${l.mission}`}</span>
                <div><strong>{l.badge}</strong><div className="small muted">{got ? `${missionShort(l)} complete · ${'★'.repeat(j.stars[l.id] ?? 0)}` : `Finish ${missionShort(l)}, ${l.title}`}</div></div>
              </div>
            );
          })}
        </div>
        {finished && (
          <div className="certificate card">
            <Seal icon="capitol" ring={`INFORMED BUDGET VOTER · ALL ${STOPS.length} MISSIONS`} grand size={110} />
            <div>
              <div className="eyebrow">Certificate</div>
              <div className="complete-title">Informed Budget Voter</div>
              <p className="small muted">For learning where federal money comes from and goes, why the government borrows, how Congress budgets, what the future holds for Social Security, and for casting a vote on each.</p>
              <div className="sb-actions" style={{ marginTop: 8 }}><ShareButton kind="level" text={`I finished all ${STOPS.length} missions of “${GAME_NAME}” and earned ${stars} of ${MAX_STARS} stars. I’m an Informed Budget Voter.`} /></div>
            </div>
          </div>
        )}
      </Section>
    </div>
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

/** Settings, as a page of their own (also in the top bar). */
export function SettingsPage() {
  return (
    <>
      <PageHead eyebrow="Settings" title="Settings" lede="Make the game comfortable to read and hear. These are saved in this browser." />
      <div className="card"><InstallButton /><ReadingSettings /></div>
      <MenuSoundSettings />
    </>
  );
}

/** Something new every day, along the bottom of the menu: deadlines, today's Daily Dollar, and the People's Budget move. */
const EDITION_ABOUT: Record<ThemeId, string> = { budget: 'All about the budget', tax: 'All about taxes', shutdown: 'All about what Congress funds each year', debt: 'All about the debt' };
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

function TodayStrip() {
  const key = todayKey();
  const played = loadResults()[key];
  const right = played?.filter(Boolean).length ?? 0;
  const theme = themeFor(key);
  const upcoming = theme ? null : nextTheme(key, 21);
  // Deadlines in the news: a funding lapse coming up, and how much room is left under the debt limit.
  const due = nextDeadline(key, 45);
  const clock = useDebtClock();
  const limitWatch = clock.monthsLeft != null && clock.monthsLeft < 6;
  // The items, once: each a link, in one line.
  const items: { href: string; title: string; body: string; news?: boolean; time?: string }[] = [];
  // Official announcements about spending and taxes, newest first, each with its source and time.
  const live = useLive();
  const official = mergeNews(live.news).slice(0, 8);
  if (due && due.kind === 'shutdown') items.push({ href: '#process', news: true, title: `Shutdown watch: funding runs out ${due.days === 0 ? 'at midnight tonight' : `after ${longDate(due.date)}`} (${inDays(due.days)})`, body: `${due.what}${theme?.id === 'shutdown' ? '' : ' The week before, the Daily Dollar is about what Congress pays for each year.'}` });
  if (limitWatch) items.push({ href: '#clock', news: true, title: `Debt limit watch: ${clock.monthsLeft! < 1 ? 'less than a month' : `about ${Math.round(clock.monthsLeft!)} month${Math.round(clock.monthsLeft!) === 1 ? '' : 's'}`} of room left`, body: `Uncle Sam can borrow about ${moneyWords(clock.room!, 0)} more before he reaches the legal limit. Then the Treasury’s workarounds buy a little time, and Congress has to act.` });
  items.push({ href: '#daily', title: `The Daily Dollar #${dayNumber(key)}${theme ? ` · ${editionName(theme)}` : ''}`, body: `${played && played.length >= ROUNDS ? `You got ${right} of ${ROUNDS}. The next one is ready in ${untilNext()}.` : theme ? `${EDITION_ABOUT[theme.id]} this week. Today’s puzzle: five calls, about a minute.` : 'Today’s puzzle is ready: five higher-or-lower calls, about a minute.'}${upcoming ? ` Coming up: ${upcoming.name}, ${span(upcoming)}.` : ''}` });
  if (backendOn()) items.push({ href: '#peoples', title: 'The People’s Budget', body: 'Your one move for today: push one card in or out of everyone’s budget.' });
  for (const x of NEWS) items.push({ href: x.href, title: x.title, body: x.body, time: x.date });
  // Like a news channel's crawl: one line, right to left, looping without a seam (the line is
  // drawn twice). Its speed stays the same whatever its length. It pauses under the pointer, on
  // keyboard focus, or with the pause button; with less motion asked for, it holds still and
  // scrolls by hand.
  const set = useRef<HTMLSpanElement>(null);
  const run = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = set.current, r = run.current;
    if (!el || !r) return;
    const fit = () => r.style.setProperty('--ticker-s', `${Math.max(20, el.offsetWidth / 70).toFixed(1)}s`);
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  // The deadlines first, then the official news, then today's puzzle and what's new in the game.
  const deadlines = items.filter((x) => x.news), rest = items.filter((x) => !x.news);
  const game = (x: (typeof items)[number], copy: boolean) => (
    <a key={x.href + x.title} className={'ticker-item' + (x.news ? ' today-news' : '')} href={x.href} tabIndex={copy ? -1 : undefined}>
      {x.time && <time className="ticker-when" dateTime={x.time}>{when(x.time + 'T12:00:00-05:00', true)}</time>}
      <strong>{x.title}</strong> <span>{x.body}</span>
    </a>
  );
  const line = (copy: boolean) => (
    <span className="ticker-set" ref={copy ? undefined : set} aria-hidden={copy || undefined}>
      {deadlines.map((x) => game(x, copy))}
      {official.map((x) => (
        <a key={x.id} className="ticker-item ticker-official" href={x.url} target="_blank" rel="noopener noreferrer" tabIndex={copy ? -1 : undefined}>
          <span className="ticker-src">{x.source}</span>
          <time className="ticker-when" dateTime={x.time}>{when(x.time, x.dateOnly)}</time>
          <strong>{x.title}</strong>
        </a>
      ))}
      {rest.map((x) => game(x, copy))}
    </span>
  );
  return (
    <section className="menu-strip ticker" aria-label="Headlines" data-paused={paused || undefined}>
      <span className="strip-label" aria-hidden="true">Headlines</span>
      <div className="ticker-window">
        <div className="ticker-run" ref={run}>{line(false)}{line(true)}</div>
      </div>
      <button type="button" className="ticker-pause" aria-pressed={paused} aria-label={paused ? 'Run the headlines' : 'Pause the headlines'} onClick={() => setPaused(!paused)}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">{paused ? <path d="M3.5 2v10l8-5z" fill="currentColor" /> : <path d="M3.5 2h2.5v10H3.5zM8 2h2.5v10H8z" fill="currentColor" />}</svg>
      </button>
    </section>
  );
}

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
      return { level: l, q: o.name, a: c === 'support' ? 'Support' : c === 'oppose' ? 'Oppose' : '' };
    }
    const c = (votes.available ? votes.mine.issues[v.id] : undefined) ?? j.choices[v.id] ?? '';
    return { level: l, q: v.question, a: v.choices.find((x) => x.value === c)?.label ?? '' };
  }));
  const cast = rows.filter((r) => r.a);
  const text = [`My budget ballot from “${GAME_NAME}”:`, ...cast.map((r) => `• ${r.q}: ${r.a}`)].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied('done'); } catch { setCopied('manual'); } };
  return (
    <div className="card">
      <ul className="ballot-list">
        {rows.map((r) => (
          <li key={r.q} data-cast={!!r.a}>
            <span className="small muted">{missionShort(STOP_BY_ID[r.level.id])}</span>
            <span className="ballot-q">{r.q}</span>
            <span className="ballot-a">{r.a ? <strong>{r.a}</strong> : <a href={'#' + r.level.id}>{j.done.includes(r.level.id) ? 'Not voted' : 'Play to vote'}</a>}</span>
          </li>
        ))}
      </ul>
      <div className="sb-actions" style={{ marginTop: 12 }}>
        <span className="small muted">{cast.length} of {rows.length} questions answered.</span>
        {cast.length > 0 && <button type="button" className="btn" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy my ballot'}</button>}
        {cast.length > 0 && <ShareButton kind="level" text={text} />}
      </div>
      {copied === 'manual' && <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your ballot, ready to copy" />}
    </div>
  );
}


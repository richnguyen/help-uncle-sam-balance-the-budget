import { type JSX, useEffect, useState } from 'react';
import { Stars } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { budget, SOURCES } from '../data';
import { moneyWords } from '../lib/format';
import { OPTIONS_DATA } from '../lib/planData';
import { useVotes } from '../lib/votes';
import { LevelIcon, LockIcon } from './icons';
import { diffKey, isUnlocked, LEVELS, MAX_STARS, rankFor, STOPS, unlockText } from './levels';
import { dayNumber, editionName, loadResults, longDate, nextDeadline, nextTheme, ROUNDS, span, type ThemeId, themeFor, todayKey, untilNext } from './daily';
import { DebtClock, useDebtClock } from './DebtClock';
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
import { setAmbienceWanted, startAmbience, stopAmbience, useAmbienceWanted } from './ambience';
import { SamSays, UncleSam } from './UncleSam';

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
  { date: '2026-11-08', title: 'Duel a friend on level 10', body: 'Two plans built blind, three rounds, and fewer cards breaks a tie.', href: '#together' },
  { date: '2026-11-07', title: 'The debt clock is live', body: 'Ticking from the Treasury’s own count, with the room left under the debt limit.', href: '#clock' },
];
const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const retrieved = SOURCES.map((x) => x.retrieved).filter(Boolean).sort().at(-1);

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
  const T = budget.receiptsByFY[String(budget.latestFY)]?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const key = todayKey();
  const played = loadResults()[key];
  const theme = themeFor(key);
  const sound = useAmbienceWanted();
  // The soundscape plays only here, and only once the player asked for it.
  useEffect(() => {
    if (!sound) return;
    const go = () => { if (!document.hidden) startAmbience(isDark()); else stopAmbience(); };
    go();
    document.addEventListener('visibilitychange', go);
    return () => { document.removeEventListener('visibilitychange', go); stopAmbience(); };
  }, [sound]);

  const greeting = finished
    ? JOURNEY_LINES.finished
    : fresh
      ? JOURNEY_LINES.fresh(moneyWords(T))
      : next && hard(next.difficulty)
        ? JOURNEY_LINES.hardNext(rank.name.toLowerCase(), next.n)
        : JOURNEY_LINES.back(rank.name.toLowerCase());
  const primary = next
    ? { href: '#' + next.id, title: fresh ? 'Start the game' : 'Continue', sub: `Level ${next.n}: ${next.title} · about ${next.minutes} min`, icon: 'play' as const }
    : { href: '#story', title: 'Your Budget Story', sub: 'Your plans and your budget personality, as cards to share', icon: 'story' as const };
  const items: { href: string; title: string; sub: string; icon: MenuIconId }[] = [
    { href: '#levels', title: 'Levels', sub: `The road map · ${done.length} of ${STOPS.length} done · ★ ${stars} of ${MAX_STARS}`, icon: 'map' },
    { href: '#together', title: 'Play together', sub: 'Duel a friend, start a room, pass the budget', icon: 'together' },
    { href: '#daily', title: 'The Daily Dollar', sub: played && played.length >= ROUNDS ? `#${dayNumber(key)} done: ${played.filter(Boolean).length} of ${ROUNDS} · next in ${untilNext()}` : `#${dayNumber(key)}${theme ? ` · ${editionName(theme)}` : ''} · five calls, about a minute`, icon: 'daily' },
    { href: '#overview', title: 'Field guide', sub: 'Every chapter in full, no game needed', icon: 'book' },
  ];
  return (
    <div className="menu">
      <MenuScene />
      {/* The first screen: the choices on the left, the scene on the right, the debt ticking in the corner. */}
      <div className="menu-top">
        <header className="menu-head">
          <div className="eyebrow">A civic game about the federal budget</div>
          <h1 className="menu-title">Help Uncle Sam <span>Balance the Budget</span></h1>
        </header>
        <a className="menu-profile" href="#record" aria-label={`Your record: ${rank.name}, ${stars} of ${MAX_STARS} stars, ${done.length} of ${STOPS.length} levels, ${j.medals.length} medals`}>
          <span className="mp-badge" aria-hidden="true"><MenuIcon id="record" /></span>
          <span className="mp-text">
            <strong>{name || 'Your record'}</strong>
            <span className="mp-rank">{rank.name}</span>
          </span>
          <span className="mp-stats" aria-hidden="true"><span>★ {stars}</span><span>{done.length}/{STOPS.length}</span><span><MenuIcon id="medal" size={14} /> {j.medals.length}</span></span>
        </a>
        {/* Uncle Sam greets the player right under the title, in the menu itself, so nothing covers it. */}
        <div className="menu-sam">
          <SamSays inline compact mood={finished ? 'cheering' : fresh ? 'happy' : next && hard(next.difficulty) ? 'worried' : 'thinking'} auto say={greeting}>
            {byName(greeting, name)}
          </SamSays>
        </div>
        <nav className="menu-main" aria-label="Main menu">
          <MenuItem {...primary} primary />
          {items.map((x) => <MenuItem key={x.href} {...x} />)}
        </nav>
        <div className="menu-clock"><DebtClock compact /></div>
      </div>
      {/* Just below: what's happening in Washington today, and what's new in the game. */}
      <section className="menu-live" aria-label="Live from Washington">
        <Today />
          <section className="card menu-whatsnew" aria-labelledby="whatsnew-t">
          <span className="stat-label" id="whatsnew-t">What’s new</span>
          {NEWS.map((x) => (
            <a key={x.title} className="today-row" href={x.href}>
              <strong>{x.title}</strong>
              <span className="small muted"><time dateTime={x.date}>{shortDate(x.date)}</time> · {x.body}</span>
            </a>
          ))}
        </section>
      </section>
      <footer className="menu-foot">
        <nav className="menu-corner" aria-label="More">
          <a href="#record"><MenuIcon id="record" size={16} /> Your record</a>
          <a href="#settings"><MenuIcon id="gear" size={16} /> Settings</a>
          <a href="#results"><MenuIcon id="chart" size={16} /> How everyone played</a>
        </nav>
        <div className="menu-corner menu-corner-right">
          <button type="button" className="menu-sound" aria-pressed={sound} onClick={() => setAmbienceWanted(!sound)}>
            <MenuIcon id={sound ? 'sound' : 'mute'} size={16} /> {sound ? 'Sounds of the Mall: on' : 'Sounds of the Mall: off'}
          </button>
          <a href="#sources"><MenuIcon id="doc" size={16} /> Sources &amp; methods</a>
          <span className="small muted">Official data from the Treasury, CBO, Census, and SSA{retrieved ? `, updated ${shortDate(retrieved.slice(0, 10))}` : ''}</span>
        </div>
      </footer>
      {/* On phones the same first choice also sits in the bar at the bottom, in reach of a thumb. */}
      <ActionBar label="Play" className="menu-bar">
        <a className="btn btn-primary btn-lg" href={primary.href}>{next ? (fresh ? 'Start level 1' : `Continue: level ${next.n}, ${next.title}`) : 'See your Budget Story'}</a>
      </ActionBar>
    </div>
  );
}

type MenuIconId = 'play' | 'story' | 'map' | 'together' | 'daily' | 'book' | 'record' | 'medal' | 'gear' | 'chart' | 'doc' | 'sound' | 'mute' | 'back';
const MENU_PATHS: Record<MenuIconId, JSX.Element> = {
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
};
export function MenuIcon({ id, size = 22 }: { id: MenuIconId; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{MENU_PATHS[id]}</svg>;
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

/** The road map, as its own page: every level, with progress at the top. */
export function LevelsPage() {
  const { j, done, next, minutesLeft, total, stars, rank, finished } = useProgress();
  return (
    <div className="journey">
      <PageHead eyebrow="Levels" title="The road map" lede="Ten levels. Easy chapters build up to three hard budget-desk levels, so a tough level is always followed by a breather." />
      <div className="card journey-progress" aria-label="Your progress">
        <div className="jp-rank">
          <span className="stat-label">Your title</span>
          <strong>{rank.name}</strong>
        </div>
        <div className="jp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STOPS.length} aria-valuenow={done.length} aria-label={`${done.length} of ${STOPS.length} levels done`}>
          {STOPS.map((s) => <span key={s.id} data-done={j.done.includes(s.id)} data-desk={s.kind === 'desk'} />)}
        </div>
        <div className="small"><strong>{done.length} of {STOPS.length}</strong> levels · <strong>★ {stars}</strong> of {MAX_STARS} stars · {finished ? 'all done' : `about ${minutesLeft} of ${total} minutes left`}</div>
        <p className="small muted">Easy levels explain one part of the budget in a few short steps, a couple of questions, and one vote. Every few levels comes a hard one at the budget desk, where you fix the budget yourself. The full chapters and original documents are always one click away.</p>
      </div>
      <Section id="map" title="Every level">
        <ol className="roadmap">
          {STOPS.map((s) => {
            const isDone = j.done.includes(s.id);
            const open = isUnlocked(s.id, j.done, j.settings.freeRoam);
            const st = j.stars[s.id] ?? 0;
            return (
              <li key={s.id} className="stop" data-done={isDone} data-open={open} data-kind={s.kind} data-hard={hard(s.difficulty)} data-diff={diffKey(s.difficulty)} data-next={s.id === next?.id}>
                <span className="stop-node" aria-hidden="true">{open || isDone ? <LevelIcon id={s.icon} size={20} /> : <LockIcon />}</span>
                <div className="stop-body">
                  <div className="stop-meta">
                    <span>Level {s.n}</span>
                    <span className={'pill ' + pillFor(s.difficulty)}>{s.difficulty}{s.kind === 'desk' ? ' level' : ''}</span>
                    <span className="muted">about {s.minutes} min</span>
                    {isDone && <Stars n={st} size="sm" label={`${st} of 3 stars`} />}
                  </div>
                  <h3 className="stop-title">{open ? <a href={'#' + s.id}>{s.title}</a> : s.title}</h3>
                  <div className="small muted">{open ? s.topic : unlockText(s.id)}</div>
                </div>
                {open && <a className={'btn' + (s.id === next?.id ? ' btn-primary' : '')} href={'#' + s.id} aria-label={`${isDone ? 'Replay' : 'Play'} level ${s.n}: ${s.title}`}>{isDone ? 'Replay' : s.id === next?.id ? 'Play' : 'Open'}</a>}
              </li>
            );
          })}
        </ol>
      </Section>
      {j.plans && Object.keys(j.plans).length > 0 && <p className="small"><a href="#story">Your Budget Story</a>: your plans and your budget personality, as cards to share.</p>}
      <ActionBar label="Play">
        {next ? <a className="btn btn-primary" href={'#' + next.id}>{done.length ? `Continue: level ${next.n}, ${next.title}` : 'Start level 1'}</a> : <a className="btn btn-primary" href="#story">See your Budget Story</a>}
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
                <div className="factcard-top"><span className="factcard-icon"><LevelIcon id={l.icon} size={18} /></span><span className="stat-label">Level {l.n} · {l.badge}</span></div>
                {got ? (
                  <>
                    <ul className="factcard-list">{l.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
                    <div className="factcard-actions">
                      <ShareButton kind="level" className="btn btn-sm" text={`Did you know? ${l.takeaways[0]} (from “${GAME_NAME}”, built on official U.S. government data)`} url={SITE_URL + '#' + l.id} />
                      {l.deepDive[0] && <a className="small" href={'#' + l.deepDive[0].route}>The full chapter</a>}
                    </div>
                  </>
                ) : (
                  <p className="small muted">Finish level {l.n}, {l.title}, to collect this card.</p>
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

      <Section id="ballot" title="Your budget ballot" sub={votes.available ? 'Your votes from each level, counted with everyone else who opened this page.' : 'Your votes from each level, saved in this browser.'}>
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

      <Section id="awards" title="Certificates" sub="Earn one for each level you finish. Saved in this browser only.">
        <div className="badges">
          {STOPS.map((l) => {
            const got = j.done.includes(l.id);
            return (
              <div key={l.id} className="badge" data-got={got}>
                <span className="badge-medal" aria-hidden="true">{got ? <LevelIcon id={l.icon} size={18} /> : l.n}</span>
                <div><strong>{l.badge}</strong><div className="small muted">{got ? `Level ${l.n} complete · ${'★'.repeat(j.stars[l.id] ?? 0)}` : `Finish level ${l.n}, ${l.title}`}</div></div>
              </div>
            );
          })}
        </div>
        {finished && (
          <div className="certificate card">
            <UncleSam mood="proud" size={90} />
            <div>
              <div className="eyebrow">Certificate</div>
              <div className="complete-title">Informed Budget Voter</div>
              <p className="small muted">For learning where federal money comes from and goes, why the government borrows, how Congress budgets, what the future holds for Social Security, and for casting a vote on each.</p>
              <div className="sb-actions" style={{ marginTop: 8 }}><ShareButton kind="level" text={`I finished all ${STOPS.length} levels of “${GAME_NAME}” and earned ${stars} of ${MAX_STARS} stars. I’m an Informed Budget Voter.`} /></div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

/** Settings, as a page of their own (also in the top bar). */
export function SettingsPage() {
  return (
    <>
      <PageHead eyebrow="Settings" title="Settings" lede="Make the game comfortable to read and hear. These are saved in this browser." />
      <div className="card"><InstallButton /><ReadingSettings /></div>
    </>
  );
}

/** Something new every day, for players coming back: today's Daily Dollar and People's Budget move. */
const EDITION_ABOUT: Record<ThemeId, string> = { budget: 'All about the budget', tax: 'All about taxes', shutdown: 'All about what Congress funds each year', debt: 'All about the debt' };
const inDays = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

function Today() {
  const key = todayKey();
  const played = loadResults()[key];
  const right = played?.filter(Boolean).length ?? 0;
  const theme = themeFor(key);
  const upcoming = theme ? null : nextTheme(key, 21);
  // Deadlines in the news: a funding lapse coming up, and how much room is left under the debt limit.
  const due = nextDeadline(key, 45);
  const clock = useDebtClock();
  const limitWatch = clock.monthsLeft != null && clock.monthsLeft < 6;
  return (
    <section className="card today" aria-label="Today">
      <span className="stat-label">Today</span>
      {due && due.kind === 'shutdown' && (
        <a className="today-row today-news" href="#process">
          <strong>Shutdown watch: funding runs out {due.days === 0 ? 'at midnight tonight' : `after ${longDate(due.date)}`} ({inDays(due.days)})</strong>
          <span className="small muted">{due.what}{theme?.id === 'shutdown' ? '' : ' The week before, the Daily Dollar is about what Congress pays for each year.'}</span>
        </a>
      )}
      {limitWatch && (
        <a className="today-row today-news" href="#clock">
          <strong>Debt limit watch: {clock.monthsLeft! < 1 ? 'less than a month' : `about ${Math.round(clock.monthsLeft!)} month${Math.round(clock.monthsLeft!) === 1 ? '' : 's'}`} of room left</strong>
          <span className="small muted">Uncle Sam can borrow about {moneyWords(clock.room!, 0)} more before he reaches the legal limit. After that, the Treasury’s workarounds buy a little time, and then Congress has to act. See the debt clock.</span>
        </a>
      )}
      <a className="today-row" href="#daily">
        <strong>The Daily Dollar #{dayNumber(key)}{theme ? ` · ${editionName(theme)}` : ''}</strong>
        <span className="small muted">{played && played.length >= ROUNDS ? `You got ${right} of ${ROUNDS}. The next one is ready in ${untilNext()}.` : theme ? `${EDITION_ABOUT[theme.id]} this week. Today’s puzzle is ready: five calls, about a minute.` : 'Today’s puzzle is ready: five higher-or-lower calls, about a minute.'}{upcoming ? ` Coming up: ${upcoming.name}, ${span(upcoming)}.` : ''}</span>
      </a>
      {backendOn() && <a className="today-row" href="#peoples">
        <strong>The People’s Budget</strong>
        <span className="small muted">Your one move for today: push one card in or out of everyone’s budget.</span>
      </a>}
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
            <span className="small muted">Level {r.level.n}</span>
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


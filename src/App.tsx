import { lazy, Suspense, useEffect, useRef, type JSX } from 'react';
import { BrandMark } from './components/Guilloche';
import { TooltipProvider } from './components/ui';
import { type Route, useHashRoute } from './lib/router';
import { UnitsProvider } from './lib/units';
import { LiveProvider } from './lib/live';
// The game's own pages load with the app; the field guide, reference pages, and extras load the
// first time they are opened, so a shared link opens fast on a phone.
const Overview = lazy(() => import('./pages/Overview'));
const Spending = lazy(() => import('./pages/Spending'));
const Revenue = lazy(() => import('./pages/Revenue'));
const Gap = lazy(() => import('./pages/Gap'));
const Debt = lazy(() => import('./pages/Debt'));
const Laws = lazy(() => import('./pages/Laws'));
const ProcessPage = lazy(() => import('./pages/Process'));
const StatePage = lazy(() => import('./pages/State'));
const SocialSecurity = lazy(() => import('./pages/SocialSecurity'));
const Receipt = lazy(() => import('./pages/Receipt'));
const Sandbox = lazy(() => import('./pages/Sandbox'));
const Glossary = lazy(() => import('./pages/Glossary'));
const Sources = lazy(() => import('./pages/Sources'));
import { VotesProvider } from './lib/votes';
import { CommunityProvider } from './lib/community';
const Results = lazy(() => import('./game/Results'));
const PlanPage = lazy(() => import('./game/PlanPage'));
const Story = lazy(() => import('./game/Story'));
const Daily = lazy(() => import('./game/Daily'));
const OgCard = lazy(() => import('./game/OgCard'));
const Peoples = lazy(() => import('./game/Peoples'));
const Rooms = lazy(() => import('./game/Rooms'));
const BuildPage = lazy(() => import('./game/build/BuildPage'));
const RoomPage = lazy(() => import('./game/RoomPage'));
const Chain = lazy(() => import('./game/Chain'));
const StatsPage = lazy(() => import('./game/Stats'));
const Teach = lazy(() => import('./game/Teach'));
// The card, the clock and the play-together cards also appear on the home screen and in levels,
// so they load with the app.
import MyShare from './game/MyShare';
import ClockPage from './game/DebtClock';
import Together from './game/Together';
import { activeChallenge } from './game/challenge';
import DuelPage, { DuelsPage } from './game/Duel';
import FieldGuide, { CHAPTER_LEVEL as CHAPTER_LEVEL_MAP } from './game/FieldGuide';
import { activeDuel, DUEL_LEVEL, loadDuels } from './game/duel';
import { activeRoom } from './game/rooms';
import { JourneyProvider, useJourney } from './game/state';
import Journey, { LevelsPage, MenuIcon, RecordPage, SettingsPage } from './game/Journey';
import LevelPage from './game/LevelPage';
import { DESK, isUnlocked, LEVELS, missionLong, missionShort, prevOf, STOP_BY_ID, STOPS } from './game/levels';
import { FIELD_GUIDE, REFERENCE } from './game/nav';
import { ReadingSettings } from './game/Settings';
import { StatusBar } from './game/StatusBar';
import { showsTabs, TabBar } from './game/TabBar';
import { LevelIcon, LockIcon } from './game/icons';
import { NarrationProvider, prefetchVoice, useNarrator } from './game/voice';
import { earnedMedals, MEDALS } from './game/medals';
import { useHaptics } from './game/haptics';
import { noteLevel } from './game/resume';
import { SamDockProvider, useBarHeights } from './game/samdock';
import { Toasts, useToasts } from './components/game';
import { ActionBar } from './components/ActionBar';

const FIELD_GUIDE_ROUTES = ['overview', 'spending', 'revenue', 'receipt', 'state', 'gap', 'debt', 'process', 'laws', 'social-security'];


/** Announces each medal once, the moment it is earned, wherever the player is. */
function MedalWatcher() {
  const j = useJourney();
  const buzz = useHaptics();
  const toasts = useToasts();
  const fresh = earnedMedals(j).filter((id) => !j.medals.includes(id));
  const key = fresh.join();
  const told = useRef(new Set<string>());
  useEffect(() => {
    const news = fresh.filter((id) => !told.current.has(id));
    news.forEach((id) => told.current.add(id));
    if (!fresh.length) return;
    j.award(fresh);
    if (!news.length) return;
    const names = news.map((id) => MEDALS.find((m) => m.id === id)!.name);
    toasts.push(names.length === 1 ? `Medal earned: ${names[0]}` : `${names.length} medals earned: ${names.join(', ')}`);
    buzz('medal');
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Toasts items={toasts.items} />;
}


// Page titles, for the browser tab.
const TITLE: Partial<Record<Route, string>> = Object.fromEntries([
  ...FIELD_GUIDE.map((g) => [g.route, g.label]),
  ...REFERENCE.map((g) => [g.route, g.label]),
  ['results', 'How everyone played'],
  ['plan', 'A plan from a friend'],
  ['story', 'Your Budget Story'],
  ['daily', 'The Daily Dollar'],
  ['peoples', 'The People’s Budget'],
  ['rooms', 'Rooms'],
  ['room', 'A room'],
  ['chain', 'Pass the budget'],
  ['stats', 'Share stats'],
  ['me', 'Your share of Uncle Sam'],
  ['clock', 'The debt clock'],
  ['together', 'Play together'],
  ['teach', 'For teachers'],
  ['duel', 'A budget duel'],
  ['duels', 'Your duels'],
  ['levels', 'The road map'],
  ['record', 'Your record'],
  ['settings', 'Settings'],
  ['guide', 'The field guide'],
  ['mall', 'Build the Mall'],
  ...STOPS.map((l) => [l.id, `${missionShort(l)}: ${l.title}`]),
]);

// Each field-guide chapter belongs to a level, so readers can jump into the game from any page.
const CHAPTER_LEVEL = CHAPTER_LEVEL_MAP as Partial<Record<Route, string>>;

const PAGES: Record<Route, (p: { param: string | null }) => JSX.Element> = {
  journey: () => <Journey />,
  'level-1': () => <LevelPage id="level-1" />,
  'level-2': () => <LevelPage id="level-2" />,
  'level-3': () => <LevelPage id="level-3" />,
  'level-4': () => <LevelPage id="level-4" />,
  'level-5': () => <DeskPage id="level-5" />,
  'level-6': () => <LevelPage id="level-6" />,
  'level-7': () => <LevelPage id="level-7" />,
  'level-8': () => <DeskPage id="level-8" />,
  'level-9': () => <LevelPage id="level-9" />,
  'level-10': () => <DeskPage id="level-10" />,
  'level-economy': () => <LevelPage id="level-economy" />,
  'level-drag': () => <LevelPage id="level-drag" />,
  'level-fairness': () => <LevelPage id="level-fairness" />,
  'level-growth': () => <LevelPage id="level-growth" />,
  'level-investment': () => <LevelPage id="level-investment" />,
  'level-future': () => <LevelPage id="level-future" />,
  'level-spend': () => <LevelPage id="level-spend" />,
  'level-roles': () => <LevelPage id="level-roles" />,
  'level-rules': () => <LevelPage id="level-rules" />,
  'level-brakes': () => <LevelPage id="level-brakes" />,
  'level-yardstick': () => <LevelPage id="level-yardstick" />,
  overview: () => <Overview />,
  spending: () => <Spending />,
  revenue: () => <Revenue />,
  gap: () => <Gap />,
  debt: () => <Debt />,
  laws: () => <Laws />,
  process: () => <ProcessPage />,
  state: ({ param }) => <StatePage param={param} />,
  'social-security': () => <SocialSecurity />,
  receipt: () => <Receipt />,
  glossary: () => <Glossary />,
  sources: ({ param }) => <Sources param={param} />,
  results: () => <Results />,
  plan: ({ param }) => <PlanPage param={param} />,
  story: () => <Story />,
  daily: ({ param }) => <Daily key={param ?? 'today'} param={param} />,
  'og-card': ({ param }) => <OgCard param={param} />,
  peoples: () => <Peoples />,
  rooms: () => <Rooms />,
  room: ({ param }) => <RoomPage param={param} />,
  chain: ({ param }) => <Chain param={param} />,
  stats: () => <StatsPage />,
  me: () => <MyShare />,
  clock: () => <ClockPage />,
  together: () => <Together />,
  teach: () => <Teach />,
  duel: ({ param }) => <DuelPage key={param ?? ''} param={param} />,
  duels: () => <DuelsPage />,
  levels: () => <LevelsPage />,
  record: () => <RecordPage />,
  settings: () => <SettingsPage />,
  guide: () => <FieldGuide />,
  mall: ({ param }) => <BuildPage param={param} />,
};

function DeskPage({ id }: { id: string }) {
  const j = useJourney();
  const d = DESK.find((x) => x.id === id)!;
  // A friend's challenge opens its level straight away.
  // So does the level of the room the player is playing for.
  // And level 10 opens for anyone in a duel (or with one on this device, for a rematch).
  const dueling = id === DUEL_LEVEL && (!!activeDuel() || loadDuels().length > 0);
  if (!isUnlocked(id, j.done, j.settings.freeRoam) && activeChallenge()?.plan.level !== id && activeRoom()?.level !== d.n && !dueling) return <DeskLocked id={id} />;
  return <Sandbox key={id} desk={d} />;
}

function DeskLocked({ id }: { id: string }) {
  const j = useJourney();
  const d = STOP_BY_ID[id];
  const prev = prevOf(id)!;
  return (
    <div className="level">
      <header className="level-head">
        <div className="eyebrow level-eyebrow"><LevelIcon id={d.icon} size={16} /> {missionLong(d)} · {d.difficulty}</div>
        <h1 className="page-title">{d.title}</h1>
      </header>
      <div className="callout">
        <div className="callout-title">Locked for now</div>
        <p className="small">Finish {missionShort(prev)}, {prev.title}, to open this mission. You can also unlock everything with free roam in settings.</p>
        <div className="sb-actions">
          <button type="button" className="btn" onClick={() => j.setSettings({ freeRoam: true })}>Unlock every mission (free roam)</button>
        </div>
        <ActionBar label="Next step"><a className="btn btn-primary" href={'#' + prev.id}>Go to {missionShort(prev)}: {prev.title}</a></ActionBar>
      </div>
    </div>
  );
}

/**
 * The action bar on pages with no action of their own (the field guide, reference pages, results):
 * the level this chapter belongs to, or else the next level to play. Phones and tablets only; on
 * wide screens the top bar's Continue button does this job.
 */
function DefaultActions({ route }: { route: Route }) {
  const j = useJourney();
  const chapter = CHAPTER_LEVEL[route];
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  if (route === 'og-card' || route === 'journey') return null;
  let action: JSX.Element;
  if (chapter) {
    const l = STOP_BY_ID[chapter];
    action = <a className="btn btn-primary" href={'#' + chapter}>{j.done.includes(chapter) ? 'Replay' : 'Play'} {missionShort(l)}: {l.title}</a>;
  } else if (next) {
    action = <a className="btn btn-primary" href={'#' + next.id}>{j.done.length || j.started ? `Continue: ${missionShort(next)}, ${next.title}` : 'Start mission 1.1'}</a>;
  } else {
    action = <a className="btn btn-primary" href="#story">See your Budget Story</a>;
  }
  return <ActionBar className="actionbar-default" phoneOnly label="Next step">{action}</ActionBar>;
}

function ChapterBanner({ route }: { route: Route }) {
  const id = CHAPTER_LEVEL[route];
  const j = useJourney();
  if (!id) return null;
  const l = LEVELS.find((x) => x.id === id)!;
  return (
    <div className="chapter-banner">
      <span className="small"><a href="#guide">Field guide</a> for <strong>{missionShort(STOP_BY_ID[id])}: {l.title}</strong>{j.done.includes(id) ? ' (complete)' : ''}</span>
      <span className="chapter-banner-links small">
        <a href={'#' + id}>{j.done.includes(id) ? 'Replay the mission' : 'Play the mission'}</a>
        <a href="#sources">Sources &amp; methods</a>
      </span>
    </div>
  );
}

export default function App() {
  return (
    <LiveProvider>
      <UnitsProvider>
        <TooltipProvider>
          <JourneyProvider>
            <NarrationProvider>
              <SamDockProvider>
                <VotesProvider>
                  <CommunityProvider>
                    <Shell />
                  </CommunityProvider>
                </VotesProvider>
              </SamDockProvider>
            </NarrationProvider>
          </JourneyProvider>
        </TooltipProvider>
      </UnitsProvider>
    </LiveProvider>
  );
}

function Shell() {
  const { route, param } = useHashRoute();
  const narrator = useNarrator();
  const journey = useJourney();
  useEffect(() => {
    narrator.stop();
    if (FIELD_GUIDE_ROUTES.includes(route)) journey.mark('page:' + route);
    noteLevel(route);
    if (journey.settings.narration) prefetchVoice(route);
    window.scrollTo({ top: 0 });
    document.title = route === 'journey' ? 'Help Uncle Sam Balance the Budget' : `${TITLE[route] ?? ''} · Help Uncle Sam Balance the Budget`;
  }, [route]);
  const Page = PAGES[route];
  useBarHeights();
  return (
    <>
      {/* The main menu is a screen of its own: no top bar, no action bar. */}
      {route !== 'journey' && <StatusBar route={route} title={TITLE[route]} />}
      <main className="main" id="main">
        <div className="page" key={route} data-route={route}>
          {/* Every page off the main menu leads straight back to it (levels have the top bar). */}
          {route !== 'journey' && !route.startsWith('level-') && route !== 'og-card' && (
            <a className="backlink" href="#journey"><MenuIcon id="back" size={16} /> Main menu</a>
          )}
          <ChapterBanner route={route} />
          <Suspense fallback={<p className="small muted page-loading" role="status">Loading…</p>}>
            <Page param={param} />
          </Suspense>
          <footer className="footer">
            <span>Independent civic education project. Not affiliated with any government agency.</span>
          </footer>
        </div>
      </main>
      {/* Outside a mission: the tab bar (it stands in for the default Continue bar). */}
      {showsTabs(route) ? <TabBar route={route} /> : <DefaultActions route={route} />}
      <MedalWatcher />
    </>
  );
}

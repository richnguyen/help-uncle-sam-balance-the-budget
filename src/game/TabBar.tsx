import type { Route } from '../lib/router';
import { useHaptics } from './haptics';
import { MenuIcon } from './Journey';
import { isUnlocked, missionShort, STOPS } from './levels';
import { FIELD_GUIDE, REFERENCE } from './nav';
import { useJourney } from './state';

// The tab bar, along the bottom of every screen: Mission (the next mission to
// play, or the road map once all are done), the Daily Dollar, the feed (the main menu) in the middle, Play
// together, and the Guide (your record and the field guide), all alike. The tab for the screen
// you're on is lit. (Build the Mall is the button at the main menu's top right, and the top
// bar's stars.) It stays in missions too, under the step's own Back / Continue bar.

type TabId = 'mission' | 'daily' | 'menu' | 'together' | 'guide';

const GUIDE = new Set<string>(['guide', 'record', 'sources', 'glossary', ...FIELD_GUIDE.map((g) => g.route), ...REFERENCE.map((g) => g.route)]);
const TOGETHER = new Set<string>(['together', 'rooms', 'room', 'chain', 'duel', 'duels', 'peoples', 'teach']);

/** The tab a screen belongs to, if any. */
export function tabFor(route: Route): TabId | null {
  if (route === 'journey') return 'menu';
  if (route === 'daily') return 'daily';
  if (route === 'levels' || route.startsWith('level-')) return 'mission';
  if (TOGETHER.has(route)) return 'together';
  if (GUIDE.has(route)) return 'guide';
  return null;
}

/** Everywhere but the link-preview card: in a mission, the step's own bar sits just above it. */
export const showsTabs = (route: Route) => route !== 'og-card';

export function TabBar({ route }: { route: Route }) {
  const j = useJourney();
  const buzz = useHaptics();
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  const started = j.done.length > 0 || !!j.started;
  const here = tabFor(route);
  const tabs: { id: TabId; href: string; label: string; icon: Parameters<typeof MenuIcon>[0]['id']; title: string }[] = [
    next
      ? { id: 'mission', href: '#' + next.id, label: 'Mission', icon: 'play', title: `${started ? 'Continue' : 'Start'}: ${missionShort(next)}, ${next.title}` }
      : { id: 'mission', href: '#levels', label: 'Mission', icon: 'play', title: 'Every mission, on the road map' },
    { id: 'daily', href: '#daily', label: 'Daily', icon: 'daily', title: 'The Daily Dollar' },
    { id: 'menu', href: '#journey', label: 'Feed', icon: 'home', title: 'The feed, on the main menu' },
    { id: 'together', href: '#together', label: 'Together', icon: 'together', title: 'Play together' },
    { id: 'guide', href: '#guide', label: 'Guide', icon: 'book', title: 'The field guide' },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <a key={t.id} className="tab" href={t.href} data-tab={t.id} aria-current={here === t.id ? 'page' : undefined} title={t.title} aria-label={t.title} onClick={() => buzz('tap')}>
          <span className="tab-icon"><MenuIcon id={t.icon} size={24} /></span>
          <span className="tab-label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

import type { Route } from '../lib/router';
import { useHaptics } from './haptics';
import { MenuIcon } from './Journey';
import { isUnlocked, missionShort, STOPS } from './levels';
import { FIELD_GUIDE, REFERENCE } from './nav';
import { useJourney } from './state';

// The tab bar, along the bottom of every screen outside a mission: the Mall, the Daily Dollar,
// Continue (in the middle, raised: the next mission), Play together, and the field guide. The
// tab for the screen you're on is lit; the main menu counts as Continue's. It steps aside while
// a mission or the budget desk is played, where the step's own Back / Continue bar is.

type TabId = 'mall' | 'daily' | 'continue' | 'together' | 'guide';

const GUIDE = new Set<string>(['guide', 'sources', 'glossary', ...FIELD_GUIDE.map((g) => g.route), ...REFERENCE.map((g) => g.route)]);
const TOGETHER = new Set<string>(['together', 'rooms', 'room', 'chain', 'duel', 'duels', 'peoples', 'teach']);

/** The tab a screen belongs to, if any. */
export function tabFor(route: Route): TabId | null {
  if (route === 'mall') return 'mall';
  if (route === 'daily') return 'daily';
  if (route === 'journey' || route === 'levels') return 'continue';
  if (TOGETHER.has(route)) return 'together';
  if (GUIDE.has(route)) return 'guide';
  return null;
}

/** Inside a mission (or a desk, or the link-preview card) the tab bar steps aside. */
export const showsTabs = (route: Route) => !route.startsWith('level-') && route !== 'og-card';

export function TabBar({ route }: { route: Route }) {
  const j = useJourney();
  const buzz = useHaptics();
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  const started = j.done.length > 0 || !!j.started;
  const here = tabFor(route);
  const tabs: { id: TabId; href: string; label: string; icon: Parameters<typeof MenuIcon>[0]['id']; title: string }[] = [
    { id: 'mall', href: '#mall', label: 'The Mall', icon: 'build', title: 'Build the Mall' },
    { id: 'daily', href: '#daily', label: 'Daily', icon: 'daily', title: 'The Daily Dollar' },
    next
      ? { id: 'continue', href: '#' + next.id, label: started ? 'Continue' : 'Start', icon: 'play', title: `${started ? 'Continue' : 'Start'}: ${missionShort(next)}, ${next.title}` }
      : { id: 'continue', href: '#story', label: 'Your story', icon: 'story', title: 'Your Budget Story' },
    { id: 'together', href: '#together', label: 'Together', icon: 'together', title: 'Play together' },
    { id: 'guide', href: '#guide', label: 'Guide', icon: 'book', title: 'The field guide' },
  ];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <a key={t.id} className="tab" href={t.href} data-tab={t.id} data-main={t.id === 'continue' || undefined} aria-current={here === t.id ? 'page' : undefined} title={t.title} aria-label={t.title} onClick={() => buzz('tap')}>
          <span className="tab-icon"><MenuIcon id={t.icon} size={t.id === 'continue' ? 30 : 24} /></span>
          <span className="tab-label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

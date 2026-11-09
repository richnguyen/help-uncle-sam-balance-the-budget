import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BrandMark } from '../components/Guilloche';
import { BADGES, loadProgress } from '../lib/game';
import { AwardIcon, BookIcon, CaretIcon, DocIcon, GearIcon, HubIcon, LevelIcon, LockIcon, SpeakerIcon } from './icons';
import { campaignOf, isUnlocked, MAX_STARS, missionLong, missionShort, rankFor, STOP_BY_ID, STOPS } from './levels';
import { MEDALS } from './medals';
import { FIELD_GUIDE } from './nav';
import { ReadingSettings } from './Settings';
import { InstallButton } from './install';
import { useJourney } from './state';
import { useNarrator } from './voice';

// The one bar at the top of every page. Left: the current mission and the track of every mission
// (grouped by campaign); hovering it (or tapping) lists every mission to jump to, plus the field-guide chapters. Then stars and
// accomplishments. Right: continue, Uncle Sam's voice, the glossary, sources & methods,
// settings, and the road map ("Your journey").

/** Budget-desk badges are saved by the desk itself; re-read them whenever it saves. */
function useDeskBadges() {
  const [b, setB] = useState(() => loadProgress().badges);
  useEffect(() => {
    const on = () => setB(loadProgress().badges);
    window.addEventListener('ftd-progress', on);
    return () => window.removeEventListener('ftd-progress', on);
  }, []);
  return b;
}

type Menu = 'levels' | 'acc' | 'settings' | null;

/** A button with a panel; the levels one also opens on hover, with a short grace period. */
function Pop({ id, open, setOpen, hover = false, button, children, className = '' }: { id: Exclude<Menu, null>; open: Menu; setOpen: (m: Menu) => void; hover?: boolean; button: (p: { 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void }) => ReactNode; children: ReactNode; className?: string }) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = open === id;
  const enter = () => { if (!hover) return; if (t.current) clearTimeout(t.current); setOpen(id); };
  const leave = () => { if (!hover) return; t.current = setTimeout(() => setOpen(null), 220); };
  return (
    <div className={'ab-pop ' + className} data-pop={id} onMouseEnter={enter} onMouseLeave={leave}>
      {button({ 'aria-expanded': isOpen, 'aria-controls': 'pop-' + id, onClick: () => setOpen(isOpen ? null : id) })}
      {isOpen && <div className="ab-panel" id={'pop-' + id} role="dialog" aria-label={id === 'levels' ? 'All missions' : id === 'acc' ? 'Accomplishments' : 'Settings'}>{children}</div>}
    </div>
  );
}

export function StatusBar({ route }: { route: string }) {
  const j = useJourney();
  const n = useNarrator();
  const desk = useDeskBadges();
  const [open, setOpen] = useState<Menu>(null);
  const bar = useRef<HTMLElement>(null);
  const done = STOPS.filter((s) => j.done.includes(s.id)).length;
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const next = STOPS.find((s) => !j.done.includes(s.id) && isUnlocked(s.id, j.done, j.settings.freeRoam));
  const here = STOP_BY_ID[route];
  const focus = here ?? next ?? STOPS[STOPS.length - 1];
  const rank = rankFor(done);
  const voiceOn = j.settings.narration;
  const earned = j.medals.length + BADGES.filter((b) => desk.includes(b.id)).length;
  const total = MEDALS.length + BADGES.length;
  const focusDone = j.done.includes(focus.id);

  useEffect(() => { setOpen(null); }, [route]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!bar.current?.contains(e.target as Node)) setOpen(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  const toggleVoice = () => { if (voiceOn) n.stop(); j.setSettings({ narration: !voiceOn }); };

  return (
    <header className="appbar" ref={bar} aria-label="Game bar">
      <div className="ab-inner">
        <a className="ab-brand" href="#journey" aria-label="Help Uncle Sam Balance the Budget: main menu"><BrandMark /></a>

        <Pop id="levels" open={open} setOpen={setOpen} hover className="ab-levels" button={(p) => (
          <div className="ab-levelbar">
            <button type="button" className="ab-level" {...p} aria-label={`${missionLong(focus)}: ${focus.title}. Show all missions`}>
              <span className="stb-icon" data-done={focusDone}><LevelIcon id={focus.icon} size={17} /></span>
              <span className="ab-levelnum"><span className="stb-k">Mission</span> <strong className="num">{focus.campaign}.{focus.mission}</strong></span>
              <CaretIcon />
            </button>
            <span className="stb-track" aria-label={`${done} of ${STOPS.length} missions finished`}>
              {STOPS.map((s) => {
                const ok = isUnlocked(s.id, j.done, j.settings.freeRoam);
                return ok
                  ? <a key={s.id} href={'#' + s.id} data-done={j.done.includes(s.id)} data-here={s.id === focus.id} data-camp-start={(s.mission === 1 && s.campaign > 1) || undefined} title={`${missionShort(s)}: ${s.title}`} aria-label={`${missionShort(s)}: ${s.title}${j.done.includes(s.id) ? ', finished' : ''}`} />
                  : <i key={s.id} data-here={s.id === focus.id} data-camp-start={(s.mission === 1 && s.campaign > 1) || undefined} title={`${missionShort(s)}: ${s.title} (locked)`} />;
              })}
            </span>
          </div>
        )}>
          <div className="ab-panel-head"><strong>All missions</strong><span className="small muted">{done} of {STOPS.length} finished</span></div>
          <ol className="ab-levellist">
            {STOPS.map((s) => {
              const ok = isUnlocked(s.id, j.done, j.settings.freeRoam);
              const fin = j.done.includes(s.id);
              const body = (
                <>
                  <span className="stb-icon" data-done={fin}>{ok || fin ? <LevelIcon id={s.icon} size={15} /> : <LockIcon />}</span>
                  <span className="ab-ll-text"><span className="ab-ll-title">{s.campaign}.{s.mission} {s.title}</span><span className="small muted">{s.difficulty}{s.kind === 'desk' ? ' · budget desk' : ''}{fin ? ((j.stars[s.id] ?? 0) > 0 ? ` · ${'★'.repeat(j.stars[s.id] ?? 0)}` : ' · finished') : ''}</span></span>
                </>
              );
              const head = s.mission === 1 ? <li key={'c' + s.campaign} className="ab-ll-camp"><span className="stat-label">Campaign {s.campaign}</span> {campaignOf(s.id).title}</li> : null;
              return [head, <li key={s.id} data-here={s.id === route}>{ok ? <a href={'#' + s.id} aria-current={s.id === route ? 'page' : undefined}>{body}</a> : <span className="ab-ll-locked" title="Finish the mission before it to unlock">{body}</span>}</li>];
            })}
          </ol>
          <div className="ab-extras">
            <a className="ab-results" href="#daily" aria-current={route === 'daily' ? 'page' : undefined}>The Daily Dollar: today’s puzzle</a>
            <a className="ab-results" href="#peoples" aria-current={route === 'peoples' ? 'page' : undefined}>The People’s Budget: one move a day</a>
            <a className="ab-results" href="#rooms" aria-current={route === 'rooms' || route === 'room' ? 'page' : undefined}>Rooms: play as a class, office, or family</a>
            <a className="ab-results" href="#chain" aria-current={route === 'chain' ? 'page' : undefined}>Pass the budget: one change each</a>
            <a className="ab-results" href="#story" aria-current={route === 'story' ? 'page' : undefined}>Your Budget Story</a>
            <a className="ab-results" href="#results" aria-current={route === 'results' ? 'page' : undefined}>How everyone played: results and votes</a>
          </div>
          <div className="stat-label" style={{ marginTop: 6 }}>Field guide: every chapter in full</div>
          <ul className="ab-guide">
            {FIELD_GUIDE.map((g) => <li key={g.route}><a href={'#' + g.route} aria-current={g.route === route ? 'page' : undefined}>{g.label}</a></li>)}
          </ul>
        </Pop>

        <span className="stb-stars ab-stars" aria-label={`${stars} of ${MAX_STARS} stars`}><span aria-hidden="true">★</span> <strong className="num">{stars}</strong><span className="muted num ab-hide-sm">/{MAX_STARS}</span></span>

        <Pop id="acc" open={open} setOpen={setOpen} button={(p) => (
          <button type="button" className="stb-acc-btn" {...p} aria-label={`Accomplishments: ${earned} of ${total}`}><AwardIcon size={17} /> <strong className="num">{earned}</strong></button>
        )}>
          <div className="ab-panel-head"><strong>Accomplishments</strong><span className="small muted">{earned} of {total} · {rank.name}</span></div>
          <div className="stat-label">Medals</div>
          <ul className="stb-pop-list">
            {MEDALS.map((m) => <li key={m.id} data-got={j.medals.includes(m.id)}><AwardIcon size={14} /><span><strong>{m.name}</strong><span className="small muted"> {m.desc}</span></span></li>)}
          </ul>
          <div className="stat-label">Budget-desk badges</div>
          <ul className="stb-pop-list">
            {BADGES.map((b) => <li key={b.id} data-got={desk.includes(b.id)}><AwardIcon size={14} /><span><strong>{b.name}</strong><span className="small muted"> {b.desc}</span></span></li>)}
          </ul>
          <a className="small" href="#record">Certificates and fact cards are in Your record</a>
        </Pop>

        <div className="ab-right">
          {n.supported && (
            <button type="button" className="ab-icon stb-voice" aria-pressed={voiceOn} aria-label={voiceOn ? 'Turn off Uncle Sam’s voice' : 'Turn on Uncle Sam’s voice'} title={voiceOn ? 'Uncle Sam’s voice is on' : 'Uncle Sam’s voice is off'} onClick={toggleVoice}>
              <SpeakerIcon on={voiceOn} />
            </button>
          )}
          <a className="ab-btn" href="#glossary" aria-current={route === 'glossary' ? 'page' : undefined} title="Glossary"><BookIcon /><span className="ab-label">Glossary</span></a>
          <a className="ab-btn" href="#sources" aria-current={route === 'sources' ? 'page' : undefined} title="Sources & methods"><DocIcon /><span className="ab-label">Methods</span></a>
          <Pop id="settings" open={open} setOpen={setOpen} className="ab-settings" button={(p) => (
            <button type="button" className="ab-btn" {...p} title="Settings"><GearIcon /><span className="ab-label">Settings</span></button>
          )}>
            <InstallButton />
            <div className="ab-more-links">
              <a className="btn" href="#glossary"><BookIcon /> Glossary</a>
              <a className="btn" href="#sources"><DocIcon /> Methods</a>
            </div>
            <div className="ab-panel-head"><strong>Settings</strong><span className="small muted">Saved in this browser</span></div>
            <ReadingSettings />
          </Pop>
          <a className="ab-btn ab-journey" href="#journey" aria-current={route === 'journey' ? 'page' : undefined} title="Main menu"><HubIcon /><span className="ab-label">Main menu</span></a>
        </div>
      </div>
    </header>
  );
}

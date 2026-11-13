import { type ReactNode, useEffect, useRef, useState } from 'react';
import { BADGES, loadProgress } from '../lib/game';
import { AwardIcon, SpeakerIcon } from './icons';
import { MAX_STARS, missionShort, rankFor, STOP_BY_ID, STOPS } from './levels';
import { MEDALS } from './medals';
import { balanceOf } from './build/landmarks';
import { useJourney } from './state';
import { useNarrator } from './voice';
import { SamPortrait, SpeechStrip } from './samhud';

// The one bar at the top of every page. Uncle Sam stands at the left, across both lines. Line one:
// the page's title (in a mission, where it sits in its campaign), then stars and accomplishments
// (the way back to the main menu is the tab bar's Feed tab). Your progress through the missions is in Your record, on the Guide tab. Line two:
// his voice switch, then his words, running beside him.

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

type Menu = 'acc' | 'settings' | null;

/** A button with a panel; the levels one also opens on hover, with a short grace period. */
function Pop({ id, open, setOpen, hover = false, button, children, className = '' }: { id: Exclude<Menu, null>; open: Menu; setOpen: (m: Menu) => void; hover?: boolean; button: (p: { 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void }) => ReactNode; children: ReactNode; className?: string }) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpen = open === id;
  const enter = () => { if (!hover) return; if (t.current) clearTimeout(t.current); setOpen(id); };
  const leave = () => { if (!hover) return; t.current = setTimeout(() => setOpen(null), 220); };
  return (
    <div className={'ab-pop ' + className} data-pop={id} onMouseEnter={enter} onMouseLeave={leave}>
      {button({ 'aria-expanded': isOpen, 'aria-controls': 'pop-' + id, onClick: () => setOpen(isOpen ? null : id) })}
      {isOpen && <div className="ab-panel" id={'pop-' + id} role="dialog" aria-label={id === 'acc' ? 'Accomplishments' : 'Settings'}>{children}</div>}
    </div>
  );
}

export function StatusBar({ route, title }: { route: string; title?: string }) {
  const j = useJourney();
  const n = useNarrator();
  const desk = useDeskBadges();
  const [open, setOpen] = useState<Menu>(null);
  const bar = useRef<HTMLElement>(null);
  const done = STOPS.filter((s) => j.done.includes(s.id)).length;
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  // The stars left to spend on building the Mall (what's been won, less what's been built).
  const left = balanceOf(j.stars, j.built ?? []);
  const here = STOP_BY_ID[route];
  const rank = rankFor(done);
  const voiceOn = j.settings.narration;
  const earned = j.medals.length + BADGES.filter((b) => desk.includes(b.id)).length;
  const total = MEDALS.length + BADGES.length;
  // With no line of his own on a page, the strip names where you are.
  const caption = '';

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
    <header className="appbar hud" ref={bar} aria-label="Game bar">
      <div className="ab-inner hud-inner">
        {/* Uncle Sam stands at the left, across both lines. */}
        <div className="hud-sam"><SamPortrait /></div>
        <div className="hud-main">
        <div className="hud-line">
        {/* Left: the page's title (each page's own heading is for screen readers only). In a
            mission, where the mission's name heads the page, just its number. */}
        <div className="hud-side hud-left">
          <div className="hud-title" aria-hidden="true">{here ? missionShort(here) : title}</div>
        </div>

        {/* Right, in one line: your score, his voice, and the way out. */}
        <div className="hud-side hud-right">
          <div className="hud-row">
            <a className="stb-stars ab-stars" href="#mall" aria-label={`${left} stars to spend on building the Mall (${stars} won)`} title={`${left} stars to spend · ${stars} of ${MAX_STARS} won`}><span aria-hidden="true">★</span> <strong className="num">{left}</strong></a>
            <Pop id="acc" open={open} setOpen={setOpen} button={(p) => (
              <button type="button" className="stb-acc-btn" {...p} aria-label={`Accomplishments: ${earned} of ${total}`}><AwardIcon size={17} /> <strong className="num">{earned}</strong></button>
            )}>
            <div className="ab-panel-head"><strong>Accomplishments</strong><span className="small muted">{earned} of {total} · ★ {left} to spend, {stars} of {MAX_STARS} won · {rank.name}</span></div>
            <div className="stat-label">Medals</div>
            <ul className="stb-pop-list">
              {MEDALS.map((m) => <li key={m.id} data-got={j.medals.includes(m.id)}><AwardIcon size={14} /><span><strong>{m.name}</strong><span className="small muted"> {m.desc}</span></span></li>)}
            </ul>
            <div className="stat-label">Budget-desk badges</div>
            <ul className="stb-pop-list">
              {BADGES.map((b) => <li key={b.id} data-got={desk.includes(b.id)}><AwardIcon size={14} /><span><strong>{b.name}</strong><span className="small muted"> {b.desc}</span></span></li>)}
            </ul>
            <a className="small" href="#guide">Badges and what you learned are in Your record, on the Guide tab</a>
            </Pop>
          </div>
        </div>
        </div>
        {/* Line two: his voice switch, then his words, running beside him. */}
        <div className="hud-talk">
          {n.supported && (
            <button type="button" className="hud-voice" aria-pressed={voiceOn} aria-label="Sound" title={voiceOn ? 'Uncle Sam’s voice is on: tap to turn it off' : 'Uncle Sam’s voice is off: tap to turn it on'} onClick={toggleVoice}>
              <SpeakerIcon on={voiceOn} /><span className="hud-voice-label">{voiceOn ? 'Sound on' : 'Sound off'}</span>
            </button>
          )}
          <SpeechStrip caption={caption} />
        </div>
        </div>
      </div>
    </header>
  );
}

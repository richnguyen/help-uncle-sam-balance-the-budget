import { type JSX } from 'react';
import type { IconId } from './levels';

// One distinct silhouette per level, so the road map reads by shape as well as by number and
// color. Drawn on a 24-pixel grid with a single stroke weight.

const PATHS: Record<IconId, JSX.Element> = {
  paycheck: <><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  bills: <><path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>,
  home: <><path d="M3.5 11 12 4l8.5 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  gap: <><path d="M4 20V10M9.5 20V6M15 20v-7M20.5 20V4" /><path d="M3 4.5h6" strokeDasharray="1.6 1.8" /></>,
  gauge: <><path d="M3.5 17a8.5 8.5 0 1 1 17 0" /><path d="M12 17l4.2-5.5" /><circle cx="12" cy="17" r="1.4" /></>,
  card: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 9.5h19M6 15h4" /></>,
  capitol: <><path d="M12 3v2.5" /><path d="M7.5 11a4.5 4.5 0 0 1 9 0" /><path d="M5.5 11h13M6.5 11v7M10 11v7M14 11v7M17.5 11v7M3.5 20.5h17M4.5 18h15" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  shield: <><path d="M12 3.2 19 6v5.5c0 4.4-3 7.8-7 9.3-4-1.5-7-4.9-7-9.3V6z" /><path d="m8.8 12 2.3 2.3 4.2-4.5" /></>,
  scale: <><path d="M12 4v16M7.5 20.5h9M5 7h14" /><path d="M5 7 2.5 13a2.8 2.8 0 0 0 5 0zM19 7l-2.5 6a2.8 2.8 0 0 0 5 0z" /></>,
  wave: <><path d="M12 3.5v6M9.4 7 12 9.6 14.6 7" /><path d="M2.5 15c1.6-3 3.2-3 4.8 0s3.2 3 4.8 0 3.2-3 4.8 0 3.2 3 4.6 0" /><path d="M5 19.5h14" /></>,
  meter: <><circle cx="12" cy="13.5" r="7" /><path d="m12 13.5 3.2-3.2M10 3h4M12 3v3.5" /></>,
  hands: <><circle cx="8" cy="7" r="2.6" /><circle cx="16.5" cy="8.5" r="2.1" /><path d="M3 19.5c.5-3.6 2.4-5.6 5-5.6s4.5 2 5 5.6M13.4 19.5c.4-2.8 1.6-4.4 3.1-4.4s2.7 1.6 3.1 4.4" /></>,
  sprout: <><path d="M12 21v-9M7 21h10" /><path d="M12 12c0-4 3-6.5 7.5-6.5 0 4.5-3 6.5-7.5 6.5zM12 14.5c0-3-2.5-5-6-5 0 3.5 2.5 5 6 5z" /></>,
  bridge: <><path d="M2.5 9h19M2.5 18h19M5 9v9M19 9v9" /><path d="M5 9c2.5 0 4 2 4 5M19 9c-2.5 0-4 2-4 5M9 14h6" /></>,
  hourglass: <><path d="M6.5 3h11M6.5 21h11" /><path d="M7.5 3v2.5c0 2.5 4.5 4.5 4.5 6.5s-4.5 4-4.5 6.5V21M16.5 3v2.5c0 2.5-4.5 4.5-4.5 6.5s4.5 4 4.5 6.5V21" /></>,
};

export function LevelIcon({ id, size = 20 }: { id: IconId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[id]}
    </svg>
  );
}

export function SpeakerIcon({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none" />
      {on ? <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></> : <path d="m16 9.5 5 5M21 9.5l-5 5" />}
    </svg>
  );
}

export function LockIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2.5" y="6" width="9" height="6.5" rx="1.5" fill="currentColor" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

/** A ribbon medal: accomplishments. */
export function AwardIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8.5 13.5-2 7.5 5.5-3 5.5 3-2-7.5" />
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="m12 6 .9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
/** Top-bar icons: the road map, the glossary, sources & methods, settings, and a menu caret. */
export function MapIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4.5l6 2 5-2v13l-5 2-6-2-5 2z" {...stroke} /><path d="M9 4.5v13M15 6.5v13" {...stroke} /></svg>;
}
/** The main menu: four tiles, a hub. */
export function HubIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" {...stroke} /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" {...stroke} /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" {...stroke} /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" {...stroke} /></svg>;
}
export function BookIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v11.5H8.5A3.5 3.5 0 0 1 5 16z" {...stroke} /><path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19M9 8h6" {...stroke} /></svg>;
}
export function DocIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4v13H7z" {...stroke} /><path d="M14 3.5v4h4M10 12h5M10 15.5h5" {...stroke} /></svg>;
}
export function GearIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" {...stroke} /></svg>;
}
export function CaretIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" {...stroke} /></svg>;
}

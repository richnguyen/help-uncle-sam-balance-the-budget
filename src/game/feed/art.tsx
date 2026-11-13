import { useId, type ReactNode } from 'react';
import { LevelIcon } from '../icons';
import type { IconId } from '../levels';

// The picture at the top of a post: a band in the topic's color with a fine engraved pattern (as
// on a banknote), a large icon on a white disc, and the post's one big figure beside it. All
// drawn here; no photos and no office's logo.

export type Tone = 'bills' | 'budget' | 'polls' | 'lessons' | 'facts' | 'news';

/** A few extra pictures the mission icons don't cover. */
export const ART_GLYPH: Record<string, ReactNode> = {
  coin: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="6.5" strokeDasharray="1.2 1.6" /><path d="M12.6 8.6v6.8M10.8 10.2l1.8-1.6" /><path d="M15.6 14.8a2 2 0 1 1 0-2.6" strokeWidth="1.3" /></>,
  check: <><rect x="2.5" y="6.5" width="19" height="11" rx="1.5" /><path d="M5 10h6M5 13h4M14 13.5h5M16.5 9.5h2.5" /><path d="M13.5 15.5c1-.8 1.6-1.6 2.4-.4.6.9 1.4.1 2.1-.6" strokeWidth="1.3" /></>,
  scroll: <><path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z" /><path d="M10 9h4.5M10 12h4.5M10 15h3" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M8 13h2M11 13h2M14 13h2M8 16.5h2M11 16.5h2" /></>,
  book: <><path d="M4 5.5C6.5 4.3 9.5 4.3 12 6c2.5-1.7 5.5-1.7 8-.5V19c-2.5-1.2-5.5-1.2-8 .5-2.5-1.7-5.5-1.7-8-.5z" /><path d="M12 6v13.5" /></>,
  megaphone: <><path d="M3.5 10v4h3l7 4V6l-7 4z" /><path d="M6.5 14l1.2 4.5h2.3L9 14.6M17 9.5a3.5 3.5 0 0 1 0 5M19.2 7.3a6.5 6.5 0 0 1 0 9.4" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.4 9.4a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.6" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></>,
};

export function PostArt({ tone, icon, glyph, big, small, figure, compact = false }: {
  tone: Tone;
  /** A mission icon, or one of ART_GLYPH. */
  icon?: IconId;
  glyph?: keyof typeof ART_GLYPH;
  /** Or a whole picture (a seal) in place of the icon disc. */
  figure?: ReactNode;
  big: ReactNode;
  small?: ReactNode;
  compact?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  return (
    <div className={'fc-art' + (compact ? ' fc-art-compact' : '')} data-tone={tone} aria-hidden="true">
      <svg className="fc-art-bg" preserveAspectRatio="none" viewBox="0 0 400 120" focusable="false">
        <defs>
          <pattern id={`g${uid}`} width="40" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 C10 0 30 20 40 10 M0 16 C10 6 30 26 40 16 M0 4 C10 -6 30 14 40 4" fill="none" stroke="currentColor" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="400" height="120" fill={`url(#g${uid})`} />
        <circle cx="360" cy="20" r="70" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
        <circle cx="360" cy="20" r="52" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      </svg>
      {figure ? <span className="fc-art-figure">{figure}</span> : (
        <span className="fc-art-disc">
          {glyph ? <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">{ART_GLYPH[glyph]}</svg>
            : icon ? <LevelIcon id={icon} size={34} /> : null}
        </span>
      )}
      <span className="fc-art-text">
        <span className="fc-art-big">{big}</span>
        {small && <span className="fc-art-small">{small}</span>}
      </span>
    </div>
  );
}

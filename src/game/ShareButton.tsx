import { useState } from 'react';
import { useHaptics } from './haptics';
import type { LinkKind } from '../lib/backend';
import { countShare } from '../lib/backend';
import { linkKind, shareText, SITE_URL, socialLinks } from './share';
import { useJourney } from './state';
import { partnerEvent } from '../lib/partners';

/** A Share button (share sheet → clipboard → text to copy) and, on the public site, "Save image". */
export function ShareButton({ text, title, url, card, label = 'Share', className = 'btn', kind, onShare }: { text: string; title?: string; url?: string; card?: () => Promise<Blob | null>; label?: string; className?: string; kind?: LinkKind; onShare?: () => void }) {
  const j = useJourney();
  const buzz = useHaptics();
  const [state, setState] = useState<'idle' | 'copied' | 'shared' | 'manual'>('idle');
  const share = async () => {
    let files: File[] | undefined;
    if (card && typeof navigator.canShare === 'function' && typeof navigator.share === 'function') {
      try { const b = await card(); if (b) files = [new File([b], 'uncle-sam-budget.png', { type: 'image/png' })]; } catch { /* text only */ }
    }
    const r = await shareText({ title, text, url, files, kind });
    if (r === 'cancelled') return;
    if (r !== 'manual') { j.mark('share'); buzz('tap'); onShare?.(); }
    setState(r === 'shared' ? 'shared' : r);
  };
  const save = async () => {
    if (!card) return;
    const b = await card().catch(() => null);
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = 'uncle-sam-budget.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    j.mark('share');
  };
  return (
    <>
      <button type="button" className={className} onClick={share}>{state === 'copied' ? 'Copied to share' : state === 'shared' ? 'Shared' : label}</button>
      {card && !__ARTIFACT__ && <button type="button" className="btn" onClick={save}>Save image</button>}
      {state === 'manual' && <textarea className="input share-manual" readOnly rows={3} value={`${text} ${url ?? SITE_URL}`} onFocus={(e) => e.currentTarget.select()} aria-label="Text to share, ready to copy" />}
    </>
  );
}

/** A row of social networks to post to; each opens that network's own share page in a new tab. */
export function SocialShare({ text, url = SITE_URL, kind, onShare }: { text: string; url?: string; kind?: LinkKind; onShare?: () => void }) {
  const j = useJourney();
  return (
    <div className="social" role="group" aria-label="Share on social media">
      <span className="stat-label">Post it</span>
      <div className="social-links">
        {socialLinks(text, url, kind).map((s) => (
          <a key={s.id} className="social-link" data-net={s.id} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => { j.mark('share'); partnerEvent('shared'); countShare(kind ?? linkKind(url), s.ch); onShare?.(); }}>{s.label}</a>
        ))}
      </div>
    </div>
  );
}

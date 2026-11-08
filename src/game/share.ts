import { countShare, type LinkKind } from '../lib/backend';
// Sharing: the system share sheet where the browser has one, otherwise the clipboard, otherwise a
// box of text to copy by hand. Links always point at the public site.

// The public copy of the game. The public site shares the address it is being viewed at, so links
// survive a domain or repository change; the claude.ai copy (a private page) points here.
const PUBLIC_URL = 'https://balancethebudget.us/';
export const PUBLIC_SITE = PUBLIC_URL;
// A visit that came in through a preview page (/p/<kind>/) still counts as the site's root.
export const SITE_URL = !__ARTIFACT__ && typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
  ? location.origin + location.pathname.replace(/index\.html$/, '').replace(/p\/[^/]+\/?$/, '')
  : PUBLIC_URL;
export const GAME_NAME = 'Help Uncle Sam Balance the Budget';

export type ShareResult = 'shared' | 'copied' | 'manual' | 'cancelled';

/** What a link opens, for the share stats: read from the link itself. */
export function linkKind(url: string): LinkKind {
  if (/\/p\/room\/|[?&]room=/.test(url)) return 'room';
  if (/\/p\/chain\/|[?&]chain(&|=|$)/.test(url)) return 'chain';
  if (/\/p\/peoples\/|[?&]peoples(&|=|$)/.test(url)) return 'peoples';
  if (/[?&]daily(&|=|$)/.test(url)) return 'daily';
  if (/\/p\/[^/]+\/|[?&](p|plan|duel|duelr)=/.test(url)) return 'plan';
  return 'site';
}

export async function shareText(o: { title?: string; text: string; url?: string; files?: File[]; kind?: LinkKind }): Promise<ShareResult> {
  const url = o.url ?? SITE_URL;
  const kind = o.kind ?? linkKind(url);
  const r = await shareTextInner(o, url, kind);
  if (r === 'shared') countShare(kind, 'sh');
  if (r === 'copied') countShare(kind, 'cp');
  return r;
}

async function shareTextInner(o: { title?: string; text: string; files?: File[] }, url: string, kind: LinkKind): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    const data: ShareData = { title: o.title ?? GAME_NAME, text: o.text, url: tagUrl(url, 'sh', kind) };
    if (o.files?.length && typeof navigator.canShare === 'function' && navigator.canShare({ files: o.files })) data.files = o.files;
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Not allowed here (for example inside a frame): fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(`${o.text} ${tagUrl(url, 'cp', kind)}`);
    return 'copied';
  } catch {
    return 'manual';
  }
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * A 1200×630 share card (the size social sites preview) drawn as SVG and turned into a PNG:
 * the level, its stars, one fact, and Uncle Sam. `samSvg` is his drawing taken from the page.
 */
export async function shareCard(o: { eyebrow: string; title: string; stars?: number; fact: string; samSvg?: string; color: string; site?: string }): Promise<Blob | null> {
  const W = 1200, H = 630;
  // Text stays left of Uncle Sam (who starts at x=840): about 19 title and 44 fact characters a line.
  const titleLines = wrap(o.title.toUpperCase(), 19).slice(0, 3);
  const tSize = titleLines.length > 2 ? 52 : 62;
  const tLead = tSize + 6;
  const titleEnd = 172 + (titleLines.length - 1) * tLead;
  const factLines = wrap(o.fact, 44).slice(0, 5);
  const sam = o.samSvg ? o.samSvg.replace(/<svg[^>]*>/, '<svg x="840" y="150" width="300" height="375" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">').replace(/var\(--[^)]+\)/g, '#9aa19c') : '';
  const starRow = o.stars == null ? '' : [0, 1, 2].map((k) => `<text x="${80 + k * 64}" y="${titleEnd + 78}" font-size="56" fill="${k < (o.stars ?? 0) ? '#c9a645' : '#d6dbd5'}">★</text>`).join('');
  const factY = titleEnd + (o.stars == null ? 76 : 136);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#f2f4ef"/>
  <rect width="${W}" height="16" fill="${o.color}"/>
  <text x="80" y="104" font-family="Menlo, Consolas, monospace" font-size="24" letter-spacing="3" fill="#1d5a43">${esc(o.eyebrow.toUpperCase())}</text>
  ${titleLines.map((l, k) => `<text x="80" y="${172 + k * tLead}" font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-weight="800" font-size="${tSize}" fill="#111b16">${esc(l)}</text>`).join('')}
  ${starRow}
  ${factLines.map((l, k) => `<text x="80" y="${factY + k * 40}" font-family="Georgia, serif" font-size="30" fill="#2b3530">${esc(l)}</text>`).join('')}
  <text x="80" y="580" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#47524c">${esc(GAME_NAME)} · official U.S. government data</text>
  <text x="80" y="610" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#1d5a43">${esc((o.site ?? SITE_URL).replace(/^https?:\/\//, '').replace(/\/$/, ''))}</text>
  ${sam}
</svg>`;
  return svgToPng(svg, W, H);
}

export const svgSrc = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** Draws an SVG (as a string) onto a canvas of its size and returns the PNG. */
export async function svgToImage(svg: string) {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('card')); img.src = svgSrc(svg); });
  return img;
}
export async function svgToPng(svg: string, W: number, H: number): Promise<Blob | null> {
  const img = await svgToImage(svg);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, W, H);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

let measurer: CanvasRenderingContext2D | null = null;
/** Wraps text to a pixel width, measured with the same font the card is drawn in. */
export function wrapPx(text: string, font: string, maxWidth: number, maxLines = 99): string[] {
  measurer ??= document.createElement('canvas').getContext('2d');
  const width = (t: string) => { if (!measurer) return t.length * 20; measurer.font = font; return measurer.measureText(t).width; };
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (width(next) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…'; return keep; }
  return lines;
}

/** Puts Uncle Sam's drawing (taken from the page) at a spot in a card, with page colors made literal. */
export const placeSam = (samSvg: string | undefined, x: number, y: number, w: number) =>
  samSvg ? samSvg.replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${w}" height="${w * 1.25}" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg">`).replace(/var\(--[^)]+\)/g, '#9aa19c') : '';

/**
 * Tags a link to this site with the channel it was shared on (?s=x), so the first visit it brings
 * can be counted by channel later. Only links to this site are tagged.
 */
export function tagUrl(url: string, channel: string, kind?: LinkKind) {
  if (!url.startsWith(SITE_URL) && !url.startsWith(PUBLIC_URL)) return url;
  const [head, hash = ''] = url.split('#');
  const q = head.includes('?') ? head.replace(/([?&])s=[^&]*&?/, '$1').replace(/([?&])k=[^&]*&?/, '$1').replace(/[?&]$/, '') : head;
  // The kind goes along only where the link itself can't tell (a Budget Story's plan link, say).
  const k = kind && kind !== linkKind(url) ? `&k=${kind}` : '';
  return `${q}${q.includes('?') ? '&' : '?'}s=${channel}${k}${hash ? '#' + hash : ''}`;
}

/** Share pages of the big social networks: each opens with the post filled in, for the person to send. */
export function socialLinks(text: string, url0: string, kind?: LinkKind) {
  const t = encodeURIComponent(text);
  return [
    { id: 'x', label: 'X', href: (u: string) => `https://x.com/intent/tweet?text=${t}&url=${encodeURIComponent(u)}` },
    { id: 'facebook', label: 'Facebook', href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
    { id: 'linkedin', label: 'LinkedIn', href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
    { id: 'reddit', label: 'Reddit', href: (u: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(u)}&title=${encodeURIComponent(GAME_NAME)}` },
    { id: 'bluesky', label: 'Bluesky', href: (u: string) => `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${u}`)}` },
    { id: 'threads', label: 'Threads', href: (u: string) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${u}`)}` },
    { id: 'whatsapp', label: 'WhatsApp', href: (u: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${u}`)}` },
    { id: 'email', label: 'Email', href: (u: string) => `mailto:?subject=${encodeURIComponent(GAME_NAME)}&body=${encodeURIComponent(`${text}\n\n${u}`)}` },
  ].map((n) => { const ch = n.id === 'x' ? 'x' : n.id.slice(0, 2); return { id: n.id, ch, label: n.label, href: n.href(tagUrl(url0, ch, kind)) }; });
}

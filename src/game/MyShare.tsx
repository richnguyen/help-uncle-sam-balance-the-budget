import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { PageHead } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { receiptFor, STATUS, useWages, WageControls } from '../components/TaxReceipt';
import { debt, POP, tax } from '../data';
import type { FilingStatus } from '../data/types';
import { dollars, people } from '../lib/format';
import { NameField } from './NameField';
import { useMyName } from './plans';
import { esc, GAME_NAME, placeSam, SITE_URL, svgSrc, svgToPng, wrapPx } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { ME_LINES } from './script';
import { useJourney } from './state';
import { SamSays, UncleSam } from './UncleSam';

// "My share of Uncle Sam": the card a player gets at the end of level 1. It is about them, not
// about a position: what their salary pays in federal taxes, the interest Uncle Sam would save if
// ten straight years of it went to paying down the debt, and where their dollars went. Nothing to agree or disagree with, and the same kind of card for
// everyone, so it is safe to post anywhere.

export const YEARS = 10;
/** The Treasury's average interest rate on all its interest-bearing debt, latest month. */
export const RATE = debt.rates.at(-1)!;

/**
 * Interest saved if `amount` paid down the debt at the start of each of `years` years. A dollar
 * paid down j years before the end saves (1 + r)^j − 1 by then (the interest it avoids is borrowed
 * less too, so the saving compounds); summed over the payments:
 *   amount × Σ_{j=1..years} ((1 + r)^j − 1)
 */
export const interestSaved = (amount: number, years = YEARS, rate = RATE.total / 100) => {
  let sum = 0;
  for (let j = 1; j <= years; j++) sum += (1 + rate) ** j - 1;
  return amount * sum;
};

export function myShare(wages: number, status: FilingStatus) {
  const { fy, r, lines } = receiptFor(wages, status);
  const saved = interestSaved(r.total);
  const top = [...lines].sort((a, b) => b.mine - a.mine).slice(0, 3).filter((l) => l.mine >= 1);
  return { fy, total: r.total, saved, top, wages, status };
}
const monthName = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export type MyShareFacts = ReturnType<typeof myShare>;

/** A palette color ("var(--c-ss)") as a plain color, for drawing into an image. */
function cssColor(c: string) {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  if (!m) return c;
  try { return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#2a78d6'; } catch { return '#2a78d6'; }
}

const SANS = 'Arial, Helvetica, sans-serif';
const COND = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'Menlo, Consolas, monospace';
export const ME_W = 1080, ME_H = 1350;

/** The card, as a 1080×1350 SVG (a portrait post), so the page and the shared image match. */
export function meCardSvg(f: MyShareFacts, name: string, samSvg?: string) {
  const X = 80, MAXW = ME_W - 2 * X;
  const out: string[] = [];
  let y = 150;
  out.push(`<text x="${X}" y="${y}" font-family="${MONO}" font-size="32" letter-spacing="4" fill="#1d5a43">${esc((name ? `${name}’s share of Uncle Sam` : 'My share of Uncle Sam').toUpperCase())}</text>`);
  const title = f.total >= 1 ? `${name ? `${name} chips` : 'I chip'} in ${dollars(f.total)} a year` : `${name || 'I'} ${name ? 'is' : 'am'} one of ${people(POP)}`;
  const ts = 92;
  for (const l of wrapPx(title.toUpperCase(), `800 ${ts}px ${COND}`, MAXW, 3)) { y += ts + 4; out.push(`<text x="${X}" y="${y}" font-family='${COND}' font-weight="800" font-size="${ts}" fill="#111b16">${esc(l)}</text>`); }
  if (f.total >= 1) {
    let bs = 132;
    const big = `${dollars(f.saved)} saved`;
    while (bs > 80 && wrapPx(big, `800 ${bs}px ${SANS}`, MAXW).length > 1) bs -= 6;
    y += 40 + bs;
    out.push(`<text x="${X}" y="${y}" font-family="${SANS}" font-weight="800" font-size="${bs}" fill="#1d5a43">${esc(big)}</text>`);
    y += 20;
    for (const l of wrapPx(`in interest, if ${YEARS} straight years of ${name ? 'these' : 'my'} federal taxes paid down Uncle Sam’s debt.`, `44px ${SERIF}`, MAXW, 3)) { y += 58; out.push(`<text x="${X}" y="${y}" font-family='${SERIF}' font-size="44" fill="#2b3530">${esc(l)}</text>`); }
    y += 70;
    out.push(`<text x="${X}" y="${y}" font-family="${MONO}" font-size="28" letter-spacing="3" fill="#47524c">WHERE ${name ? 'THE' : 'MY'} DOLLARS GO</text>`);
    const rowW = MAXW - 330; // Uncle Sam stands to the right of the rows
    for (const r of f.top) {
      y += 66;
      out.push(`<rect x="${X}" y="${y - 30}" width="22" height="22" rx="5" fill="${cssColor(r.color)}"/>`);
      out.push(`<text x="${X + 38}" y="${y - 10}" font-family="${SANS}" font-size="38" fill="#2b3530">${esc(wrapPx(r.short || r.label, `38px ${SANS}`, rowW - 220, 1)[0] ?? r.label)}</text>`);
      out.push(`<text x="${X + rowW}" y="${y - 10}" text-anchor="end" font-family="${SANS}" font-weight="800" font-size="40" fill="#111b16">${esc(dollars(r.mine))}</text>`);
      out.push(`<line x1="${X}" x2="${X + rowW}" y1="${y + 12}" y2="${y + 12}" stroke="#d6dbd5" stroke-width="2"/>`);
    }
  } else {
    y += 60;
    for (const l of wrapPx('Everyone in America is part of Uncle Sam’s household. Here’s where the money comes from, and where it goes.', `44px ${SERIF}`, MAXW, 4)) { y += 58; out.push(`<text x="${X}" y="${y}" font-family='${SERIF}' font-size="44" fill="#2b3530">${esc(l)}</text>`); }
  }
  const note = f.total >= 1
    ? `An estimate: ${dollars(f.wages)} in wages, ${STATUS.find((s) => s.value === f.status)!.label.toLowerCase()}, ${tax.year} IRS rates. ${YEARS} yearly payments toward the debt; interest at the Treasury’s average rate on its debt, ${RATE.total.toFixed(2)}% (${monthName(RATE.date)}), compounding.`
    : `Where the money comes from and where it goes, FY${f.fy} (Treasury).`;
  let ny = 1150;
  for (const l of wrapPx(note, `26px ${SANS}`, MAXW - 330, 3)) { out.push(`<text x="${X}" y="${ny}" font-family="${SANS}" font-size="26" fill="#47524c">${esc(l)}</text>`); ny += 34; }
  const site = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ME_W}" height="${ME_H}" viewBox="0 0 ${ME_W} ${ME_H}">
  <rect width="${ME_W}" height="${ME_H}" fill="#f2f4ef"/>
  <rect width="${ME_W}" height="24" fill="#1d5a43"/>
  ${out.join('\n  ')}
  ${placeSam(samSvg, ME_W - 80 - 300, 860, 300)}
  <line x1="${X}" x2="${X + MAXW}" y1="1236" y2="1236" stroke="#c9d1c8" stroke-width="2"/>
  <text x="${X}" y="1284" font-family="${SANS}" font-weight="700" font-size="32" fill="#111b16">What’s your share? ${esc(GAME_NAME)}</text>
  <text x="${X}" y="1322" font-family="${SANS}" font-size="28" fill="#1d5a43">${esc(site)} · official U.S. government data</text>
</svg>`;
}

export function shareTextFor(f: MyShareFacts) {
  return f.total >= 1
    ? `I chip in about ${dollars(f.total)} a year in federal taxes. Put toward the debt for ${YEARS} straight years, that would save Uncle Sam about ${dollars(f.saved)} in interest. What’s your share?`
    : 'Everyone in America is part of Uncle Sam’s household. Where does the money come from, and where does it go?';
}

/** Uncle Sam drawn off-screen, so the card image can carry him. */
function useSamSvg(mood: 'proud' | 'cheering' = 'proud') {
  const box = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | undefined>();
  useEffect(() => { setSvg(box.current?.querySelector('svg.sam')?.outerHTML); }, []);
  const holder = <div className="sr-only" ref={box} aria-hidden="true"><UncleSam mood={mood} size={120} /></div>;
  return { svg, holder };
}

/**
 * The card with its name box and share buttons. `compact`: inside the level-complete pop-up and
 * the level's last screen, with a link to the full page.
 */
export function MyShareCard({ compact = false, wages, status }: { compact?: boolean; wages?: number; status?: FilingStatus }) {
  const j = useJourney();
  const saved = useWages();
  const name = useMyName();
  const uid = useId();
  const { svg: samSvg, holder } = useSamSvg('proud');
  const f = useMemo(() => myShare(wages ?? saved.wages, status ?? saved.status), [wages, status, saved.wages, saved.status]);
  const svg = useMemo(() => meCardSvg(f, name, samSvg), [f, name, samSvg]);
  const text = shareTextFor(f);
  const url = SITE_URL;
  return (
    <div className={'mecard' + (compact ? ' mecard-compact' : '')}>
      {holder}
      <img className="mecard-img" src={svgSrc(svg)} width={ME_W} height={ME_H} alt={`${name ? name + '’s' : 'My'} share of Uncle Sam: ${text}`} />
      <div className="mecard-side">
        <NameField id={uid + '-name'} label="Put your first name on it (optional)" hint="It stays on this device, and goes only into the cards and links you choose to share." />
        <div className="sb-actions">
          <ShareButton text={text} url={url} card={() => svgToPng(svg, ME_W, ME_H)} label="Share my card" className="btn btn-primary" kind="level" onShare={() => j.mark('share:me')} />
        </div>
        <SocialShare text={text} url={url} kind="level" onShare={() => j.mark('share:me')} />
        {compact && <a className="small" href="#me">Try another salary, or see the whole card</a>}
      </div>
    </div>
  );
}

/** #me: the card on its own page, with the salary controls. */
export default function MyShare() {
  const w = useWages();
  const name = useMyName();
  const f = myShare(w.wages, w.status);
  return (
    <>
      <PageHead eyebrow="Your card" title={name ? `${name}’s share of Uncle Sam` : 'Your share of Uncle Sam'} lede="What your salary pays in federal taxes, how much interest ten years of it would save if it paid down the debt, and where your dollars go. Nothing political about it: just your own numbers, ready to post." />
      <SamSays mood="proud" auto say={ME_LINES.page}>{f.total >= 1 ? <>Put toward my debt for {YEARS} straight years, your taxes would save me about <strong>{dollars(f.saved)}</strong> in interest. Put your name on your card and see what your friends chip in.</> : ME_LINES.page}</SamSays>
      <section className="card me-controls" aria-label="Your salary">
        <WageControls id="me-w" {...w} />
        <p className="small muted">An estimate: {tax.year} IRS rates, the standard deduction, and wages as your only income. The same salary as on level 1 and your tax receipt.</p>
      </section>
      <MyShareCard wages={w.wages} status={w.status} />
      <ActionBar label="Next step"><a className="btn btn-primary" href="#together">Play it with friends</a><a className="btn" href="#levels">Road map</a></ActionBar>
    </>
  );
}

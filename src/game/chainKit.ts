// Pass the budget, the parts that travel: what each move was in a few plain words, the message
// that passes the link on (how far Uncle Sam still is from the goal, what you just did, and a
// nudge for the next person), the turn clock, the link-preview page that matches the chain's
// state, and the "Budget Closer" receipt that credits every hand once the goal is met.
// Moves are described, never judged: "cut Defense", "raised the gas tax", "extended the 2025 tax
// breaks". The tags (Taxed, Cut, Spent, Tax cut, Undid) say what kind of move it was.
import { esc, GAME_NAME, SITE_URL, svgToPng } from './share';

export interface ChainTurn { card: string; add: boolean; by: string }
export type MoveTag = 'Taxed' | 'Cut' | 'Spent' | 'Tax cut' | 'Undid';

/** Each card as something a person did, in the past tense, and the kind of move. */
const MOVE: Record<string, { did: string; tag: MoveTag }> = {
  'income-tax-rates-1pt': { did: 'raised every income tax rate a point', tag: 'Taxed' },
  'corp-rate-1pt': { did: 'raised the corporate tax rate a point', tag: 'Taxed' },
  'ss-tax-earnings-over-250k': { did: 'applied the Social Security tax to pay over $250,000', tag: 'Taxed' },
  'carbon-tax-25': { did: 'taxed carbon emissions', tag: 'Taxed' },
  'vat-5pct': { did: 'added a 5% value-added tax', tag: 'Taxed' },
  'cap-health-exclusion': { did: 'capped the tax break for job-based health insurance', tag: 'Taxed' },
  'limit-itemized-15pct': { did: 'limited itemized deductions', tag: 'Taxed' },
  'gas-tax-15c': { did: 'raised the gas tax 15 cents', tag: 'Taxed' },
  'alcohol-tax': { did: 'raised alcohol taxes', tag: 'Taxed' },
  'carried-interest': { did: 'taxed carried interest as ordinary income', tag: 'Taxed' },
  'medicare-advantage-benchmarks': { did: 'trimmed Medicare Advantage payments', tag: 'Cut' },
  'site-neutral-hospital-outpatient': { did: 'evened out Medicare’s hospital-clinic rates', tag: 'Cut' },
  'part-b-premium-35pct': { did: 'raised Medicare Part B premiums', tag: 'Cut' },
  'medicaid-per-enrollee-caps': { did: 'capped Medicaid spending per enrollee', tag: 'Cut' },
  'raise-full-retirement-age-70': { did: 'raised the retirement age to 70', tag: 'Cut' },
  'chained-cpi': { did: 'slowed yearly benefit increases', tag: 'Cut' },
  'ss-benefits-high-earners': { did: 'trimmed Social Security for future high earners', tag: 'Cut' },
  'cut-defense-budget': { did: 'cut Defense', tag: 'Cut' },
  'cut-transport-education-grants': { did: 'cut transportation and education grants', tag: 'Cut' },
  'crop-insurance-subsidies': { did: 'cut crop insurance subsidies', tag: 'Cut' },
  'extend-aca-credits': { did: 'brought back the larger ACA credits', tag: 'Spent' },
  'extend-obbba-temp-tax': { did: 'made the 2025 temporary tax breaks permanent', tag: 'Tax cut' },
};

/** What a turn did, in a few words ("cut Defense"; "took “…” back out"). */
export function moveLine(t: ChainTurn, names: Record<string, string>) {
  if (!t.add) return `took “${names[t.card] ?? t.card}” back out`;
  return MOVE[t.card]?.did ?? `added “${names[t.card] ?? t.card}”`;
}
export const moveTag = (t: ChainTurn): MoveTag => (!t.add ? 'Undid' : MOVE[t.card]?.tag ?? 'Cut');

/** A hand's name on the receipt: their first name, or their place in the chain. */
export const handName = (t: ChainTurn, i: number) => t.by || `Player ${i + 1}`;

// The turn clock: a link carries the minute it was passed (w, base 36). Four hours is the
// friendly deadline; nothing is enforced, the badge only lets the group chat know who has it.
export const TURN_HOURS = 4;
export const stampNow = (now = Date.now()) => Math.floor(now / 60000).toString(36);
/** Minutes since the link was passed, or null for an old link, a bad stamp, or one from the future. */
export function minutesSince(w: string | null | undefined, now = Date.now()) {
  if (!w || !/^[0-9a-z]{1,9}$/.test(w)) return null;
  const m = Math.floor(now / 60000) - parseInt(w, 36);
  return m >= -5 && m < 60 * 24 * 60 ? Math.max(0, m) : null;
}
const span = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
/** The turn clock in words, for the badge. */
export function clockText(turn: number, mins: number | null) {
  if (mins == null) return { late: false, text: `Turn ${turn} · ${TURN_HOURS}-hour turn clock` };
  const left = TURN_HOURS * 60 - mins;
  return left > 0
    ? { late: false, text: `Turn ${turn} · ${span(left)} left on the ${TURN_HOURS}-hour clock` }
    : { late: true, text: `Turn ${turn} is ${span(-left)} over the ${TURN_HOURS}-hour clock. The group is waiting!` };
}

/** The link-preview page that matches the chain: whose turn it is and how far along, or closed. */
export function previewId(nextTurn: number, progress: number, met: boolean) {
  if (met) return 'chain-done';
  const t = Math.min(10, Math.max(2, nextTurn));
  const p = Math.min(80, Math.floor(Math.max(0, progress) * 5) * 20);
  return `chain-t${t}-p${p}`;
}
export const PREVIEW_TURNS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
export const PREVIEW_PCTS = [0, 20, 40, 60, 80];

/** The message that passes the link on. */
export function passText(o: { gap: string; did: string; nextTurn: number }) {
  return `Uncle Sam is still ${o.gap} short of the goal. I just ${o.did}. Now it’s your turn (Turn ${o.nextTurn}) to make the hard call without wrecking the economy. You’ve got ${TURN_HOURS} hours ⏳ Pass it on:`;
}

/** The whole chain of hands in a line: "Ruth (Taxed) → Sam (Cut) → Ana (Closed the deal!)". */
export function handsLine(turns: ChainTurn[], max = 10) {
  const parts = turns.map((t, i) => `${handName(t, i)} (${i === turns.length - 1 ? 'Closed the deal!' : moveTag(t)})`);
  return parts.length > max ? [...parts.slice(0, 3), `… ${parts.length - max + 3} more …`, ...parts.slice(-(max - 4))].join(' → ') : parts.join(' → ');
}

/** The message for the closed chain. */
export function closerText(turns: ChainTurn[], goal: string) {
  const closer = handName(turns.at(-1)!, turns.length - 1);
  return `🏆 Budget closed! Our chain managed to ${goal} in ${turns.length} turn${turns.length === 1 ? '' : 's'}, and ${closer} made the move that did it. ${handsLine(turns)}. Everyone gets credit:`;
}

const TAG_COLOR: Record<MoveTag | 'Closer', string> = { Taxed: '#2467c4', Cut: '#2f8a57', Spent: '#8a5a12', 'Tax cut': '#7a4fb0', Undid: '#6b7570', Closer: '#c9a645' };

/** The Budget Closer receipt as an image: every hand in order, with the closer's trophy. Taller for long chains. */
export async function closerCard(turns: ChainTurn[], goal: string, names: Record<string, string>): Promise<Blob | null> {
  const W = 1200, PER = 4, ROW = 118;
  const rows = Math.ceil(turns.length / PER);
  const H = Math.max(630, 300 + rows * ROW + 130);
  const font = 'Arial, Helvetica, sans-serif', narrow = 'Arial Narrow, Arial, Helvetica, sans-serif';
  const chipW = 220, gap = 42, x0 = 96;
  const chips = turns.map((t, i) => {
    const r = Math.floor(i / PER), c = i % PER;
    const x = x0 + c * (chipW + gap), y = 300 + r * ROW;
    const last = i === turns.length - 1;
    const tag = last ? 'Closer' : moveTag(t);
    const name = handName(t, i).slice(0, 16);
    const what = (MOVE[t.card]?.did ?? names[t.card] ?? '').replace(/^./, (s) => s.toUpperCase());
    const arrow = last ? '' : c < PER - 1 ? `<text x="${x + chipW + 10}" y="${y + 52}" font-family="${font}" font-size="30" fill="#8a948e">→</text>` : '';
    return `<g><rect x="${x}" y="${y}" width="${chipW}" height="92" rx="14" fill="${last ? '#fff7dc' : '#ffffff'}" stroke="${TAG_COLOR[tag]}" stroke-width="${last ? 5 : 3}"/>
      <text x="${x + 16}" y="${y + 32}" font-family="${font}" font-size="15" font-weight="700" fill="#5d6862">${i + 1}.</text>
      <text x="${x + 44}" y="${y + 33}" font-family="${font}" font-size="24" font-weight="800" fill="#111b16">${esc(name)}</text>
      <rect x="${x + 16}" y="${y + 48}" width="${last ? 168 : 92}" height="28" rx="14" fill="${TAG_COLOR[tag]}"/>
      <text x="${x + 28}" y="${y + 68}" font-family="${font}" font-size="16" font-weight="800" fill="#ffffff">${last ? '🏆 CLOSED IT' : tag.toUpperCase()}</text>
      <title>${esc(what)}</title></g>${arrow}`;
  }).join('\n');
  const closer = handName(turns.at(-1)!, turns.length - 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#1d5a43"/>
  <rect x="48" y="36" width="${W - 96}" height="${H - 72}" rx="18" fill="#fbfcfa"/>
  <text x="96" y="104" font-family="Menlo, Consolas, monospace" font-size="24" letter-spacing="3" fill="#1d5a43">PASS THE BUDGET · BUDGET CLOSER</text>
  <text x="${W - 96}" y="118" text-anchor="end" font-size="72">🏆</text>
  <text x="96" y="178" font-family="${narrow}" font-weight="800" font-size="56" fill="#111b16">${esc(`${closer} closed the deal!`.slice(0, 40))}</text>
  <text x="96" y="230" font-family="${font}" font-size="28" fill="#2b3530">${esc(`The chain managed to ${goal} in ${turns.length} turn${turns.length === 1 ? '' : 's'}.`.slice(0, 80))}</text>
  <line x1="96" y1="264" x2="${W - 96}" y2="264" stroke="#c9d0ca" stroke-width="3" stroke-dasharray="10 10"/>
  ${chips}
  <text x="96" y="${H - 104}" font-family="${font}" font-size="26" font-weight="700" fill="#1d5a43">Everyone in the chain gets credit. Scored with CBO’s numbers.</text>
  <text x="96" y="${H - 64}" font-family="${font}" font-size="22" fill="#47524c">${esc(`${GAME_NAME} · ${SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}`)}</text>
</svg>`;
  return svgToPng(svg, W, H);
}

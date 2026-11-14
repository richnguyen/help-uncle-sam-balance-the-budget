// The plan receipt: the share that makes finishing a budget desk worth showing off. It says what
// the player pulled off (the goal, the stars), how they did it (how hard it hit the economy, how
// many cards, their budget personality), how the savings split between spending cuts and taxes,
// and where the biggest savings came from, then dares a friend to do it better.
// It reports, it doesn't judge: "Biggest moves" names the budget areas that saved the most (a
// fact), never who is hurt, and there are no party or ideology words. How a plan splits cuts and
// taxes is shown only when the player chooses (the switch beside the share buttons).
import type { LeverId } from '../lib/sandbox';
import { esc, GAME_NAME, SITE_URL, svgToPng } from './share';

export type Rating = 'gentle' | 'moderate' | 'steep';
export interface ReceiptCard { lever: LeverId; side: 'revenue' | 'spending'; savings10: number }
export interface ReceiptInput {
  mission: string; // "Mission 1.9"
  done: string; // "cut Uncle Sam’s deficit to 3% of GDP"
  stars: number;
  cards: ReceiptCard[];
  rating: Rating;
  personality?: string; // "The Dealmaker"
  name?: string;
}

const STYLE: Record<Rating, { dot: string; word: string; color: string }> = {
  gentle: { dot: '🟩', word: 'GENTLE', color: '#2f8a57' },
  moderate: { dot: '🟨', word: 'MODERATE', color: '#c99a1e' },
  steep: { dot: '🟥', word: 'STEEP', color: '#c4462f' },
};
/** Budget areas in plain words (the levers' labels are written for the desk). */
const AREA: Record<LeverId, string> = {
  revenues: 'Taxes', socialSecurity: 'Social Security', medicare: 'Medicare', medicaid: 'Medicaid',
  otherMandatory: 'Other benefits', defense: 'Defense', nondefense: 'Federal agencies',
};
const BLOCKS = 5;

/** The receipt's facts, worked out once for the text and the image. */
export function receiptFacts(i: ReceiptInput) {
  const sp = i.cards.filter((c) => c.side === 'spending' && c.savings10 > 0).reduce((s, c) => s + c.savings10, 0);
  const tax = i.cards.filter((c) => c.side === 'revenue' && c.savings10 > 0).reduce((s, c) => s + c.savings10, 0);
  const tot = sp + tax;
  const spBlocks = tot ? Math.round((sp / tot) * BLOCKS) : 0;
  const taxBlocks = tot ? BLOCKS - spBlocks : 0;
  // Where the most was saved, by budget area (the top two).
  const by = new Map<LeverId, number>();
  for (const c of i.cards) if (c.savings10 > 0) by.set(c.lever, (by.get(c.lever) ?? 0) + c.savings10);
  const moves = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([l]) => AREA[l]);
  const n = i.cards.length;
  // The dare: whatever a friend could still do better.
  const dare = i.rating !== 'gentle' ? 'Can you do it more gently?'
    : i.stars < 3 ? 'Can you get all three stars?'
    : n > 1 ? `Can you do it with fewer than ${n} cards?` : 'Can you match it?';
  return { sp, tax, spBlocks, taxBlocks, moves, n, dare, style: STYLE[i.rating] };
}

const bar = (on: number, mark: string) => mark.repeat(on) + '⬜'.repeat(BLOCKS - on);

/** The receipt as text. `mix` adds the cuts-and-taxes lines (the player's choice). */
export function receiptText(i: ReceiptInput, mix = true) {
  const f = receiptFacts(i);
  const who = i.name ? `${i.name}’s plan` : 'My plan';
  const lines = [
    `🇺🇸 ${who} · ${i.mission} · ${'★'.repeat(i.stars)}${'☆'.repeat(3 - i.stars)}`,
    `I ${i.done}.`,
    `Plan style: ${f.style.dot} ${f.style.word} · ${f.n} card${f.n === 1 ? '' : 's'}${i.personality ? ` · ${i.personality}` : ''}`,
    ...(mix && f.sp + f.tax > 0 ? [`✂️ Spending cuts ${bar(f.spBlocks, '🟩')}`, `💵 Taxes ${bar(f.taxBlocks, '🟦')}`] : []),
    ...(f.moves.length ? [`🎯 Biggest moves: ${f.moves.join(' & ')}`] : []),
    `Scored with CBO’s numbers. ${f.dare} 👉`,
  ];
  return lines.join('\n');
}

/** The receipt as a 1200×630 image, for shares that carry a picture. */
export async function receiptCard(i: ReceiptInput, mix = true): Promise<Blob | null> {
  const f = receiptFacts(i);
  const W = 1200, H = 630;
  const font = 'Arial, Helvetica, sans-serif', narrow = 'Arial Narrow, Arial, Helvetica, sans-serif';
  const blocks = (x: number, y: number, on: number, color: string) => Array.from({ length: BLOCKS }, (_, k) =>
    `<rect x="${x + k * 58}" y="${y}" width="48" height="48" rx="8" fill="${k < on ? color : '#ffffff'}" stroke="${k < on ? color : '#c9d0ca'}" stroke-width="3"/>`).join('');
  const rows: string[] = [];
  let y = 330;
  if (mix && f.sp + f.tax > 0) {
    rows.push(`<text x="96" y="${y + 36}" font-family="${font}" font-size="30" font-weight="700" fill="#111b16">✂ Spending cuts</text>${blocks(470, y, f.spBlocks, '#2f8a57')}`);
    y += 70;
    rows.push(`<text x="96" y="${y + 36}" font-family="${font}" font-size="30" font-weight="700" fill="#111b16">$ Taxes</text>${blocks(470, y, f.taxBlocks, '#2467c4')}`);
    y += 76;
  }
  if (f.moves.length) { rows.push(`<text x="96" y="${y + 34}" font-family="${font}" font-size="28" fill="#2b3530">Biggest moves: <tspan font-weight="700">${esc(f.moves.join(' & '))}</tspan></text>`); y += 56; }
  const stars = [0, 1, 2].map((k) => `<text x="${830 + k * 70}" y="128" font-size="64" fill="${k < i.stars ? '#c9a645' : '#d6dbd5'}">★</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#1d5a43"/>
  <rect x="48" y="36" width="${W - 96}" height="${H - 72}" rx="18" fill="#fbfcfa"/>
  <text x="96" y="104" font-family="Menlo, Consolas, monospace" font-size="24" letter-spacing="3" fill="#1d5a43">${esc(`${i.name ? `${i.name.toUpperCase()}’S` : 'MY'} BUDGET PLAN · ${i.mission.toUpperCase()}`)}</text>
  ${stars}
  <text x="96" y="176" font-family="${narrow}" font-weight="800" font-size="50" fill="#111b16">${esc(`I ${i.done}.`.slice(0, 60))}</text>
  <rect x="96" y="210" width="${(STYLE[i.rating].word.length * 22) + 64}" height="52" rx="26" fill="${f.style.color}"/>
  <text x="128" y="246" font-family="${font}" font-size="26" font-weight="800" fill="#ffffff" letter-spacing="2">${f.style.word}</text>
  <text x="${(STYLE[i.rating].word.length * 22) + 184}" y="246" font-family="${font}" font-size="28" fill="#2b3530">${esc(`${f.n} card${f.n === 1 ? '' : 's'}${i.personality ? ` · ${i.personality}` : ''}`)}</text>
  <line x1="96" y1="296" x2="${W - 96}" y2="296" stroke="#c9d0ca" stroke-width="3" stroke-dasharray="10 10"/>
  ${rows.join('\n  ')}
  <text x="96" y="${Math.max(y + 40, 540)}" font-family="${font}" font-size="30" font-weight="700" fill="#1d5a43">${esc(f.dare)}</text>
  <text x="${W - 96}" y="${Math.max(y + 40, 540)}" text-anchor="end" font-family="${font}" font-size="22" fill="#47524c">${esc(`${GAME_NAME} · ${SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}`)}</text>
</svg>`;
  return svgToPng(svg, W, H);
}

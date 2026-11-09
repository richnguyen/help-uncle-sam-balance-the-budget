// Number formatting for a general audience. All inputs are in dollars unless noted.

const MINUS = '−';

/** $7.40T, $412B, $3.2M, $12,345, $87 */
export function money(v: number, digits?: number): string {
  if (!Number.isFinite(v)) return '—';
  const s = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(digits ?? 2)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(digits ?? (a >= 1e11 ? 0 : 1))}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(digits ?? 1)}M`;
  if (a >= 100) return `${s}$${Math.round(a).toLocaleString('en-US')}`;
  return `${s}$${a.toFixed(digits ?? (a < 10 ? 2 : 0))}`;
}

/** "$7.40 trillion" */
export function moneyWords(v: number, digits = 2): string {
  const s = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(digits)} trillion`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)} billion`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)} million`;
  return money(v);
}

/** Whole dollars with separators: $21,734 */
export function dollars(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const s = v < 0 ? MINUS : '';
  return `${s}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}

export function pct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}

export function signedMoney(v: number): string {
  return (v > 0 ? '+' : '') + money(v);
}

export function signedPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return (v > 0 ? '+' : v < 0 ? MINUS : '') + `${Math.abs(v * 100).toFixed(digits)}%`;
}

export function compactAxis(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? MINUS : '';
  if (a >= 1e12) return `${s}$${+(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${s}$${+(a / 1e9).toFixed(0)}B`;
  if (a >= 1e6) return `${s}$${+(a / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `${s}$${+(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a)}`;
}

export function fyRange(fy: number): string {
  return `Oct 1, ${fy - 1} – Sep 30, ${fy}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function monthLabel(iso: string, long = false): string {
  const [y, m] = iso.split('-').map(Number);
  return `${(long ? MONTHS_LONG : MONTHS)[m - 1]} ${y}`;
}

export function monthShort(iso: string): string {
  const m = Number(iso.split('-')[1]);
  return MONTHS[m - 1];
}

export function dateLabel(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

export function int(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

/** 71.2 million, 340 thousand */
export function people(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)} million`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} thousand`;
  return int(v);
}

/** A title used mid-sentence: lowercases its first letter only, so “GDP” and “Social Security” keep their capitals. */
export const lower = (s: string) => s.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());

// Sharing one feed post: what the post says in a line (no spoilers: a quick check shares its
// question, never its answer), and a link that opens the game's feed with that post first,
// marked "Shared with you" (?post=<id>, read once on load by challenge.ts).
import { missionShort } from '../levels';
import { SITE_URL } from '../share';
import type { FeedItem } from './items';

const KEY = 'ftd:shared-post';
/** A post id: its kind, a colon, then letters, digits, dots, hyphens or colons. */
export const POST_RE = /^[a-z]+:[A-Za-z0-9._:-]{1,90}$/;

/** Keeps a shared post's id for the feed to show first (this tab only). */
export function rememberSharedPost(id: string) { try { if (POST_RE.test(id)) sessionStorage.setItem(KEY, id); } catch { /* storage off */ } }
/** The shared post to show first, once. */
export function takeSharedPost(): string | null {
  try { const v = sessionStorage.getItem(KEY); if (v) sessionStorage.removeItem(KEY); return v && POST_RE.test(v) ? v : null; } catch { return null; }
}

/** Where a shared post leads: the Daily Dollar itself, or the feed with that post first. */
export const postUrl = (it: FeedItem) => (it.kind === 'daily' ? `${SITE_URL}?daily` : `${SITE_URL}?post=${encodeURIComponent(it.id)}`);

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, s.lastIndexOf(' ', n - 1) > n * 0.6 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…' : s);
const billions = (b: number) => (Math.abs(b) >= 1000 ? `$${(Math.abs(b) / 1000).toFixed(2).replace(/\.?0+$/, '')} trillion` : `$${Math.round(Math.abs(b)).toLocaleString('en-US')} billion`);

/** The post in a line or two, for a social post. */
export function postShareText(it: FeedItem): string {
  switch (it.kind) {
    case 'bill': return `📜 ${it.bill.label}: ${cut(it.bill.title, 120)} (${it.bill.status}). The plain-English summary from the Congressional Research Service, and where it stands:`;
    case 'news': return `📰 ${cut(it.news.title, 160)} (${it.news.source})`;
    case 'deadline': return `⏳ ${it.title}: the date, what it means, and the official source.`;
    case 'stat': return `📊 ${cut(it.title, 180)}`;
    case 'poll': return `🗳️ Would you include this in your plan? ${it.option.name}. Official estimate: it ${it.option.savings10 >= 0 ? 'saves' : 'adds'} ${billions(it.option.savings10)} over ten years.`;
    case 'check': return `🧠 Quick check: ${cut(it.quiz.question, 180)} Can you get it?`;
    case 'tutorial': return `🎓 ${missionShort(it.stop)}: ${it.stop.title}. A ${it.stop.minutes}-minute mission on real federal numbers.`;
    case 'quick': return `⚡ Quick play: ${it.game.title}. ${cut(it.game.goal, 120)} About a minute.`;
    case 'chapter': return `📖 ${it.label}: ${cut(it.blurb, 160)}`;
    case 'term': return `📘 Word to know: ${it.term.term}. ${cut(it.term.def, 160)}`;
    case 'law': return `🏛️ ${cut(it.title, 160)}: a law that moved the deficit, scored by CBO.`;
    case 'fact': return `💡 ${cut(it.fact.title, 180)}`;
    case 'daily': return '💵 Today’s Daily Dollar: five calls, higher or lower, on real federal numbers. Same puzzle for everyone.';
    default: return cut((it as FeedItem).title, 200);
  }
}

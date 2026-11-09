import newsJson from '../data/generated/news.json';

// Official announcements about spending and taxes, for the main menu's Headlines line (see
// scripts/fetch-news.mjs for the sources and the rules). The site bakes in the latest it fetched
// when it was built (the Pages workflow rebuilds every few hours); in the standalone site the
// browser also checks Congress.gov's floor feeds live (they allow it).

export interface NewsItem { id: string; source: string; title: string; url: string; time: string; dateOnly?: boolean }

export const BAKED: { fetchedAt: string; items: NewsItem[] } = newsJson as { fetchedAt: string; items: NewsItem[] };
const DAYS = 21;

/** About spending or taxes (the same words the build script keeps). */
export const TOPIC = /\b(tax(es|ation|payers?)?|tariffs?|duty|duties|imports?|customs|budget(s|ary)?|appropriations?|appropriate|spending|deficits?|debt|fiscal|revenues?|funding|fund(s|ed)?|shutdown|continuing resolution|rescissions?|sequest\w*|medicare|medicaid|social security|irs|internal revenue|treasury|reconciliation)\b/i;

/** The newest first, live items over baked ones with the same link, nothing older than three weeks. */
export function mergeNews(live: NewsItem[] = [], now = Date.now()): NewsItem[] {
  const seen = new Set<string>();
  return [...live, ...BAKED.items]
    .filter((x) => { if (seen.has(x.url)) return false; seen.add(x.url); return now - Date.parse(x.time) < DAYS * 86400000; })
    .sort((a, b) => b.time.localeCompare(a.time));
}

// Eastern time, as Washington keeps it.
const TZ = 'America/New_York';
const dayKey = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(t);
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const CLOCK = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

/** "12 min ago", "3 hr ago", "Today, 9:05 AM ET", "Yesterday, 4:12 PM ET", "Fri, Nov 6, 2:00 PM ET" (or just the day). */
export function when(iso: string, dateOnly = false, now = Date.now()) {
  const t = Date.parse(iso);
  const mins = (now - t) / 60000;
  if (!dateOnly && mins >= 0 && mins < 60) return `${Math.max(1, Math.round(mins))} min ago`;
  if (!dateOnly && mins >= 0 && mins < 6 * 60) return `${Math.round(mins / 60)} hr ago`;
  const day = dayKey(t) === dayKey(now) ? 'Today' : dayKey(t) === dayKey(now - 86400000) ? 'Yesterday' : DAY.format(t);
  return dateOnly ? day : `${day}, ${CLOCK.format(t)} ET`;
}

/** Congress.gov's RSS (floor activity, bills sent to the President), read in the browser. */
export function parseCongressFeed(xml: string, source: string): NewsItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const channelDate = doc.querySelector('channel > pubDate')?.textContent ?? '';
  return [...doc.querySelectorAll('item')].flatMap((it) => {
    const title = it.querySelector('title')?.textContent?.trim() ?? '';
    const desc = it.querySelector('description')?.textContent?.trim() ?? '';
    const url = it.querySelector('link')?.textContent?.trim() ?? '';
    const t = Date.parse(it.querySelector('pubDate')?.textContent || channelDate);
    if (!title || !url || !Number.isFinite(t) || !TOPIC.test(`${title} ${desc}`)) return [];
    return [{ id: `${source}:${url}`, source, title: desc ? `${title}: ${desc}` : title, url, time: new Date(t).toISOString(), dateOnly: true }];
  });
}

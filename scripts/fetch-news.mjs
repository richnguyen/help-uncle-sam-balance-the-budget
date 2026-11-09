// Official announcements about federal spending and taxes, for the main menu's Headlines line.
// Run before each build (the Pages workflow runs it every few hours, so the line stays timely):
//
//   node scripts/fetch-news.mjs            → src/data/generated/news.json
//
// Sources, all official and all in their own words:
//   - The White House's presidential actions (executive orders, proclamations, memoranda), kept
//     only when they're about taxes, tariffs, spending, the budget or the debt. Its other
//     releases are left out: many are political messaging, and the game doesn't take sides.
//   - The Congressional Budget Office (Congress's nonpartisan budget scorekeeper): cost
//     estimates and reports.
//   - Congress.gov: spending and tax bills on the Senate and House floors today, and bills sent
//     to the President.
// A source that can't be reached is skipped, and if none can, the file is left as it was.

import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../src/data/generated/news.json', import.meta.url);
const UA = 'HelpUncleSamBalanceTheBudget/1.0 (civic education game; +https://balancethebudget.us/)';
const DAYS = 21;
const MAX = 12;

// About spending or taxes: the words that put an item on the line.
const TOPIC = /\b(tax(es|ation|payers?)?|tariffs?|duty|duties|imports?|customs|budget(s|ary)?|appropriations?|appropriate|spending|deficits?|debt|fiscal|revenues?|funding|fund(s|ed)?|shutdown|continuing resolution|rescissions?|sequest\w*|medicare|medicaid|social security|irs|internal revenue|treasury|reconciliation)\b/i;

const SOURCES = [
  { id: 'wh-actions', source: 'White House', url: 'https://www.whitehouse.gov/presidential-actions/feed/', keep: (it) => TOPIC.test(it.title + ' ' + it.description), take: 4 },
  { id: 'cbo', source: 'CBO', url: 'https://www.cbo.gov/publications/all/rss.xml', keep: () => true, take: 4, title: (it) => (/^(H\.\s?R\.|S\.|H\.\s?J\.\s?Res\.|S\.\s?J\.\s?Res\.)\s?\d+/i.test(it.title) ? `Cost estimate: ${it.title}` : it.title) },
  { id: 'senate-floor', source: 'Senate floor', url: 'https://www.congress.gov/rss/senate-floor-today.xml', keep: (it) => TOPIC.test(it.title + ' ' + it.description), take: 3, title: (it) => `${it.title}: ${it.description}`, dateOnly: true },
  { id: 'house-floor', source: 'House floor', url: 'https://www.congress.gov/rss/house-floor-today.xml', keep: (it) => TOPIC.test(it.title + ' ' + it.description), take: 3, title: (it) => `${it.title}: ${it.description}`, dateOnly: true },
  { id: 'to-president', source: 'Sent to the President', url: 'https://www.congress.gov/rss/presented-to-president.xml', keep: (it) => TOPIC.test(it.title + ' ' + it.description), take: 3, title: (it) => `${it.title}: ${it.description}`, dateOnly: true },
];

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

// Presidential actions arrive in capitals ("ADJUSTING IMPORTS OF ..."): title case reads better.
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);
function titleCase(s) {
  if (s !== s.toUpperCase() || !/[A-Z]{3}/.test(s)) return s;
  return s.toLowerCase().split(' ').map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^(\W*)(\w)/, (_, p, c) => p + c.toUpperCase()))).join(' ');
}

function parse(xml) {
  const channelDate = tag(xml.split(/<item[\s>]/i)[0], 'pubDate');
  return [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map((m) => {
    const x = m[1];
    return { title: tag(x, 'title'), link: tag(x, 'link') || tag(x, 'guid'), description: tag(x, 'description'), pubDate: tag(x, 'pubDate') || channelDate };
  });
}

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const now = Date.now();
const items = [];
let reached = 0;
for (const s of SOURCES) {
  try {
    const all = parse(await get(s.url));
    reached++;
    const fresh = all
      .map((it) => ({ ...it, t: Date.parse(it.pubDate) }))
      .filter((it) => it.title && it.link && Number.isFinite(it.t) && now - it.t < DAYS * 86400000 && s.keep(it))
      .slice(0, s.take);
    for (const it of fresh) {
      items.push({ id: `${s.id}:${it.link}`, source: s.source, title: titleCase(s.title ? s.title(it) : it.title), url: it.link, time: new Date(it.t).toISOString(), dateOnly: !!s.dateOnly });
    }
    console.log(`${s.source}: ${all.length} items, ${fresh.length} kept`);
  } catch (e) {
    console.warn(`${s.source}: skipped (${e.message})`);
  }
}
if (!reached) {
  console.warn('No source reached; keeping the news already in', OUT.pathname);
  process.exit(0);
}
items.sort((a, b) => b.time.localeCompare(a.time));
const out = { fetchedAt: new Date(now).toISOString(), items: items.slice(0, MAX) };
let before = '';
try { before = readFileSync(OUT, 'utf8'); } catch { /* first run */ }
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`${out.items.length} items → src/data/generated/news.json${before === JSON.stringify(out, null, 1) + '\n' ? ' (unchanged)' : ''}`);

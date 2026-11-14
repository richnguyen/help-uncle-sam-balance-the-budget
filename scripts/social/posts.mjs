// The brand accounts' daily posts about the Daily Dollar, written from the game's own puzzle and the
// crowd's anonymous counts. Pure functions (no network, no files), so the rules can be tested:
//   - morning (7:30 ET): today's puzzle is live, its topic and the first number (shown to every
//     player at the start, so not a spoiler);
//   - midday (1 PM ET): how the crowd is doing on each call so far, by call number only, never the
//     numbers or what they are;
//   - evening (8 PM ET): yesterday's answers, with the hardest call and the source.
// The tone is a neutral scorekeeper: facts and numbers, no politics, no winners or losers.
// Every link carries a partner code per platform (?via=bot-bluesky), so the stats page shows
// which platform brings players.

/** Below this many answers to a call, the crowd's share isn't posted. */
export const MIN = 20;

/** Each platform's length limit (Bluesky counts graphemes; links are part of the text). */
export const PLATFORMS = {
  bluesky: { limit: 300, via: 'bot-bluesky' },
  mastodon: { limit: 500, via: 'bot-mastodon' },
};

const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
const link = (site, platform) => `${site}?daily&via=${PLATFORMS[platform].via}`;
const shortSource = (p) => (p.chain[0]?.source?.name ?? '').split(',')[0].trim();
const pct = (c) => Math.round((c.right / (c.right + c.wrong)) * 100);
const lowerFirst = (s) => s[0].toLowerCase() + s.slice(1);

/** Pick the richest version that fits the platform's limit. */
function fit(platform, versions) {
  const limit = PLATFORMS[platform].limit;
  for (const v of versions) { const t = v.filter(Boolean).join('\n'); if (graphemes(t) <= limit) return { text: t, length: graphemes(t), limit }; }
  const t = versions.at(-1).filter(Boolean).join('\n');
  return { text: t, length: graphemes(t), limit, error: `over ${limit} characters` };
}

/** Every call has enough answers to post: the crowd's share for each, and the hardest. */
export function crowdOf(stats, min = MIN) {
  if (!stats?.calls?.length) return { ok: false, why: 'no counts yet' };
  const short = stats.calls.find((c) => c.right + c.wrong < min);
  if (short) return { ok: false, why: `call ${short.call} has ${short.right + short.wrong} answers (needs ${min})` };
  const calls = stats.calls.map((c) => ({ call: c.call, pct: pct(c) }));
  const hardest = calls.reduce((a, b) => (b.pct < a.pct ? b : a));
  return { ok: true, calls, hardest };
}

/**
 * The day's three posts for each platform.
 * puzzle / yesterday: { n, title (the pool's), edition (or null), chain: [{ label, shown, value, source }] }
 * stats / yesterdayStats: daily_stats() results, or null.
 */
export function composeDay({ site = 'https://balancethebudget.us/', puzzle, yesterday, stats = null, yesterdayStats = null, min = MIN }) {
  const out = [];
  const first = puzzle.chain[0];
  const topic = lowerFirst(puzzle.title);
  const head = `Daily Dollar #${puzzle.n}${puzzle.edition ? ` · ${puzzle.edition}` : ''}`;

  // Morning: the puzzle is live.
  out.push({ slot: 'morning', time: '7:30 AM ET', posts: Object.fromEntries(Object.keys(PLATFORMS).map((pf) => [pf, fit(pf, [
    [`${head} is live: ${topic}.`, `First number: ${first.label}, ${first.shown}. Is the next one higher or lower? Five calls, about a minute, no sign-up.`, link(site, pf)],
    [`${head} is live: ${topic}.`, `First up: ${first.label}, ${first.shown}. Higher or lower? Five calls.`, link(site, pf)],
    [`${head} is live: ${topic}. Five calls, higher or lower.`, link(site, pf)],
  ])])) });

  // Midday: the crowd so far, by call number only.
  const c = crowdOf(stats, min);
  if (!c.ok) out.push({ slot: 'midday', time: '1:00 PM ET', skip: `not enough answers yet: ${c.why}` });
  else {
    const lines = c.calls.map((x) => `Call ${x.call}: ${x.pct}% right${x.call === c.hardest.call ? ', the trap so far' : ''}`);
    out.push({ slot: 'midday', time: '1:00 PM ET', posts: Object.fromEntries(Object.keys(PLATFORMS).map((pf) => [pf, fit(pf, [
      [`${head}, so far today:`, ...lines, 'No spoilers here. Your turn:', link(site, pf)],
      [`${head} so far: call ${c.hardest.call} is the trap (${c.hardest.pct}% right). Your turn:`, link(site, pf)],
    ])])) });
  }

  // Evening: yesterday's answers (that puzzle is over), the hardest call, the source.
  if (!yesterday) out.push({ slot: 'evening', time: '8:00 PM ET', skip: 'no puzzle yesterday' });
  else {
    const y = yesterday;
    const sorted = [...y.chain].sort((a, b) => b.value - a.value);
    const big = sorted[0], small = sorted.at(-1);
    const yc = crowdOf(yesterdayStats, min);
    let hard = null;
    if (yc.ok) {
      const k = yc.hardest.call, known = y.chain[k - 1], next = y.chain[k];
      hard = `Hardest call: ${next.label} (${next.shown}) was ${next.value > known.value ? 'higher' : 'lower'} than ${known.label} (${known.shown}). ${yc.hardest.pct}% got it.`;
    }
    const src = shortSource(y);
    const tail = (pf) => `Today’s #${puzzle.n}: ${link(site, pf)}`;
    const title = `Yesterday’s Daily Dollar #${y.n}: ${lowerFirst(y.title)}.`, titleShort = `Yesterday’s #${y.n}: ${lowerFirst(y.title)}.`;
    const range = `The six numbers ran from ${small.label}, ${small.shown}, to ${big.label}, ${big.shown}.`;
    const source = src && `Source: ${src}.`;
    // Shorter versions drop the range before the hardest call, and never the source.
    out.push({ slot: 'evening', time: '8:00 PM ET', posts: Object.fromEntries(Object.keys(PLATFORMS).map((pf) => [pf, fit(pf, [
      [title, range, hard, source, tail(pf)],
      [title, hard, source, tail(pf)],
      [titleShort, hard, source, tail(pf)],
      [title, range, source, tail(pf)],
      [titleShort, range, source, tail(pf)],
      [`Yesterday’s #${y.n} ran from ${small.shown} to ${big.shown}.`, source, tail(pf)],
    ])])), note: hard ? undefined : `no hardest call: ${yc.why}` });
  }
  return out;
}

/** The drafts as Markdown, for review. */
export function toMarkdown(day, key, puzzle) {
  const md = [`## Daily Dollar #${puzzle.n} · ${key}${puzzle.edition ? ` · ${puzzle.edition}` : ''}`, '', 'Dry run: nothing is posted.', ''];
  for (const s of day) {
    md.push(`### ${s.slot[0].toUpperCase() + s.slot.slice(1)} · ${s.time}`);
    if (s.skip) { md.push('', `_Skipped: ${s.skip}._`, ''); continue; }
    if (s.note) md.push('', `_${s.note}._`);
    for (const [pf, p] of Object.entries(s.posts)) md.push('', `**${pf}** · ${p.length}/${p.limit}${p.error ? ` · ⚠️ ${p.error}` : ''}`, '', '```text', p.text, '```');
    md.push('');
  }
  return md.join('\n');
}

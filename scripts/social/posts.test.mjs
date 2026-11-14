// The daily posts' rules: no spoilers for today's puzzle, every post within its platform's
// length, each platform's own partner code on the link, crowd numbers only with enough answers,
// and yesterday's hardest call told the right way round.
//   npm run test:social
import { composeDay, crowdOf, MIN, PLATFORMS } from './posts.mjs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const item = (label, value, shown, source = 'Treasury, Monthly Treasury Statement, FY2026 outlays') => ({ label, value, shown, source: { name: source } });

// Puzzle #9 (FY2026 spending) and #8 (CBO's ten-year savings), as the game made them.
const today = { n: 9, title: 'What Washington spent in FY2026', edition: null, chain: [
  item('The FBI', 10.72e9, '$10.7B'), item('Food aid (SNAP, school meals, WIC)', 137.04e9, '$137.0B'), item('The Army Corps of Engineers', 10.78e9, '$10.8B'),
  item('Customs and Border Protection', 28.92e9, '$28.9B'), item('The Forest Service', 12.82e9, '$12.8B'), item('The National Park Service', 3.9e9, '$3.9B')] };
const yesterday = { n: 8, title: 'What CBO’s options would save over ten years', edition: null, chain: [
  item('Create a 5 percent value-added tax', 3380, '$3.38T', 'CBO, Options for Reducing the Deficit'), item('Cut federal transportation and education grants by a third', 339, '$339B', 'CBO'),
  item('Reduce crop insurance subsidies', 47, '$47B', 'CBO'), item('Raise taxes on beer, wine, and liquor', 102, '$102B', 'CBO'),
  item('Cut the Defense Department’s budget', 959, '$959B', 'CBO'), item('Lower Medicare Advantage payment benchmarks', 489, '$489B', 'CBO')] };
const stats = (rights, total = 100) => ({ calls: rights.map((r, i) => ({ call: i + 1, right: r, wrong: total - r })), scores: {}, players: total });

const day = composeDay({ puzzle: today, yesterday, stats: stats([81, 60, 55, 31, 70]), yesterdayStats: stats([90, 75, 29, 66, 58]) });
const [morning, midday, evening] = day;
const texts = (slot) => Object.values(slot.posts ?? {}).map((p) => p.text);
const todaysLabels = today.chain.map((x) => x.label), todaysShown = today.chain.map((x) => x.shown);

ok(day.every((s) => s.skip || Object.values(s.posts).every((p) => !p.error && p.length <= p.limit)), 'every post fits its platform: ' + day.flatMap((s) => Object.entries(s.posts ?? {}).map(([pf, p]) => `${s.slot}/${pf} ${p.length}/${p.limit}`)).join(', '));
ok(day.every((s) => s.skip || Object.entries(s.posts).every(([pf, p]) => p.text.includes(`https://balancethebudget.us/?daily&via=${PLATFORMS[pf].via}`))), 'each platform’s link carries its own partner code');

ok(texts(morning).every((t) => t.includes('The FBI, $10.7B') && todaysLabels.slice(1).every((l) => !t.includes(l)) && todaysShown.slice(1).every((v) => !t.includes(v))), 'morning: the topic and the first number only (shown to every player at the start)');
ok(texts(midday).every((t) => todaysLabels.every((l) => !t.includes(l)) && todaysShown.every((v) => !t.includes(v))), 'midday: no numbers or names from today’s puzzle, only call numbers');
ok(texts(midday).every((t) => /Call 1: 81% right/.test(t) && /Call 4: 31% right, the trap so far/.test(t) && /Call 5: 70% right/.test(t)), 'midday: each call’s share right, and the hardest so far');
ok(texts(evening).every((t) => todaysLabels.every((l) => !t.includes(l))), 'evening: nothing from today’s puzzle, only yesterday’s');
ok(texts(evening).every((t) => t.includes('Hardest call: Raise taxes on beer, wine, and liquor ($102B) was higher than Reduce crop insurance subsidies ($47B). 29% got it.')), 'evening: yesterday’s hardest call (call 3: the 4th number against the 3rd), the right way round, with how many got it');
ok(texts(evening).every((t) => t.includes('Source: CBO.') && t.includes('Today’s #9: https://')), 'evening: the source, and today’s puzzle');

const few = composeDay({ puzzle: today, yesterday, stats: stats([10, 9, 8, 7, 6], MIN - 1), yesterdayStats: null });
ok(few[1].skip && /needs 20/.test(few[1].skip), 'midday is skipped until every call has enough answers: ' + few[1].skip);
ok(!few[2].skip && texts(few[2]).every((t) => !t.includes('Hardest call')) && /no counts/.test(few[2].note), 'evening without counts: the numbers and source, no hardest call');
ok(!crowdOf(null).ok && crowdOf(stats([50, 50, 50, 50, 50])).hardest.call === 1, 'the crowd needs counts; ties go to the earliest call');

// A long themed day still fits, by falling back to a shorter version.
const long = { ...today, edition: 'Shutdown Watch, day 7 of 7', title: 'What Washington spends while Congress decides how to keep the government open past the deadline', chain: today.chain.map((x) => ({ ...x, label: x.label + ' and several related programs across the government' })) };
const ld = composeDay({ puzzle: long, yesterday: long, stats: stats([81, 60, 55, 31, 70]), yesterdayStats: stats([90, 75, 29, 66, 58]) });
ok(ld.every((s) => s.skip || Object.values(s.posts).every((p) => !p.error)), 'very long names still fit, in a shorter version: ' + ld.flatMap((s) => Object.entries(s.posts ?? {}).map(([pf, p]) => `${s.slot}/${pf} ${p.length}`)).join(', '));

const banned = /\b(liberal|conservative|democrat|republican|left|right-wing|woke|radical|socialis|tax-and-spend)\b/i;
ok(day.concat(ld).every((s) => s.skip || Object.values(s.posts).every((p) => !banned.test(p.text))), 'no party or ideology words in any post');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

// Lists every sentence Uncle Sam can say, grouped into recording banks, and writes
// scripts/voice/lines.json for synth.py. Run with the dev server up:
//   npx vite --port 5173 &  node scripts/voice/collect.mjs http://localhost:5173/
// Most lines are listed straight from the game's modules (level steps, every quiz outcome,
// coaching, celebrations, the road map); lines that depend on live calculations (the budget
// desk's opening lines, the first greeting) are captured by visiting those pages.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright is not a project dependency; use a global install (npm i -g playwright) or npx.
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://localhost:5173/';
const out = new URL('./lines.json', import.meta.url);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  // Use a stand-in speech engine (so nothing is recorded twice) and count the page as interacted with.
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [], speak: (u) => window.__spoken.push(u.text), cancel() {}, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: true, isActive: true } });
  if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { voice: 'device', voiceV: 2, narration: true, freeRoam: true } }));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(base + '#sources');
await page.waitForTimeout(500);

const banks = await page.evaluate(async () => {
  const L = await import('/src/game/levels.tsx');
  const S = await import('/src/game/script.ts');
  const U = await import('/src/game/UncleSam.tsx');
  const V = await import('/src/game/voice.tsx');
  const G = await import('/src/game/minigame.tsx');
  const out = {};
  const add = (bank, text) => { for (const s of V.toSentences(text)) (out[bank] ??= []).push(s); };
  for (const l of L.LEVELS) {
    for (const st of l.steps) {
      if (st.sam) add(l.id, U.plain(st.sam));
      // A mission's game: each round's opening line and every way it can be scored.
      if (st.game) for (const t of G.gameLines(st.game)) add(l.id, t);
      if (st.quiz?.guess) {
        // A guess: asked first, then the answer, right or not.
        const q = st.quiz, ex = U.plain(q.explain), Q = S.QUIZ_LINES;
        add(l.id, Q.guessAsk(q.question));
        add(l.id, `${Q.guessRight} ${ex}`);
        add(l.id, `${Q.guessRevealSay(q.choices[q.correct])} ${ex}`);
      } else if (st.quiz) {
        const q = st.quiz, ex = U.plain(q.explain), Q = S.QUIZ_LINES;
        add(l.id, Q.ask(q.question));
        add(l.id, Q.wrong);
        add(l.id, `${Q.right} ${ex}`);
        add(l.id, `${Q.rightLater} ${ex}`);
        add(l.id, `${Q.revealSay(q.choices[q.correct])} ${ex}`);
      }
    }
  }
  for (const s of L.STOPS) add('common', S.lockedLine(L.unlockText(s.id)));
  Object.values(S.CHEER).forEach((t) => add('common', t));
  // What every game says when it ends, and the lines a custom round shares.
  Object.values(G.ROUND_LINES.over).forEach((t) => add('common', t));
  [G.ROUND_LINES.spot, G.ROUND_LINES.close, G.ROUND_LINES.far, G.ROUND_LINES.bonusWrong, 'That one’s tricky. Here’s the answer.'].forEach((t) => add('common', t));
  Object.values(S.DESK_PARTY).forEach((t) => add('desk', t));
  Object.values(S.COACH).forEach((t) => add('desk', t));
  Object.values(S.REACT).forEach((t) => add('desk', t));
  // Level 5's hint: one sentence naming each card, and the star tips. Their own bank, so the
  // other desk levels don't download them.
  const P = await import('/src/lib/planData.ts');
  for (const o of P.OPTIONS_DATA.options) add('hint', S.HINT_LINES.card(o.name));
  for (const k of ['finishes', 'bigShare', 'gentle', 'addTax', 'addCut', 'done']) add('hint', S.HINT_LINES[k]);
  // Shared plans, challenges, the Budget Story, and the Daily Dollar (pages outside the levels).
  Object.values(S.PLAN_LINES).forEach((t) => add('common', t));
  Object.values(S.CHALLENGE_LINES).forEach((t) => add('common', t));
  Object.values(S.STORY_LINES).forEach((t) => add('common', t));
  Object.values(S.PEOPLES_LINES).forEach((t) => add('common', t));
  Object.values(S.ROOM_LINES).forEach((t) => add('common', t));
  Object.values(S.CHAIN_LINES).forEach((t) => add('common', t));
  add('common', S.DAILY_LINES.intro);
  for (const k of ['budgetWeek', 'taxWeek', 'taxDay', 'shutdownWeek', 'shutdownDay', 'debtWeek', 'debtDay', 'calls']) add('common', S.DAILY_LINES[k]);
  // The level 1 card, the debt clock, and playing together.
  Object.values(S.ME_LINES).forEach((t) => add('common', t));
  Object.values(S.CLOCK_LINES).forEach((t) => add('common', t));
  Object.values(S.TOGETHER_LINES).forEach((t) => add('common', t));
  Object.values(S.DUEL_LINES).forEach((t) => add('common', t));
  add('common', S.DAILY_LINES.done);
  S.DAILY_LINES.score.forEach((t) => add('common', t));
  // Build the Mall: each landmark's opening line, every job's fact, the decorations, the
  // postcards' first lines, and the Mall page's lines. Their own bank, loaded on those pages.
  const B = await import('/src/game/build/landmarks.ts');
  add('mall', B.BUILD_LINES.fresh);
  add('mall', B.BUILD_LINES.done);
  for (const l of B.LANDMARKS) {
    add('mall', l.blurb);
    add('mall', l.postcard[0]);
    add('mall', B.BUILD_LINES.next(l.short));
    for (const t of l.tasks) add('mall', t.fact);
    add('mall', l.decor.fact);
  }
  add('common', S.VOICE_TEST);
  add('common', S.JOURNEY_LINES.finished);
  for (const r of L.RANKS) {
    add('common', S.JOURNEY_LINES.back(r.name.toLowerCase()));
    add('common', S.JOURNEY_LINES.hardNext(r.name.toLowerCase()));
  }
  return out;
});

// Lines computed on the page: the first greeting and each budget-desk level's opening.
const capture = async (route, bank) => {
  await page.evaluate(() => { window.__spoken.length = 0; });
  await page.goto(base + '#' + route);
  await page.waitForTimeout(1400);
  for (const s of await page.evaluate(() => window.__spoken.splice(0))) (banks[bank] ??= []).push(s);
};
await page.evaluate(() => localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, settings: { voice: 'device', voiceV: 2, narration: true, freeRoam: true } })));
await capture('journey', 'common');
for (const r of ['level-5', 'level-8', 'level-10']) await capture(r, 'desk');
await browser.close();

// A sentence used in more than one bank moves to "common", which every page loads.
const where = new Map();
for (const [b, list] of Object.entries(banks)) for (const s of new Set(list)) where.set(s, [...(where.get(s) ?? []), b]);
const final = { common: [] };
for (const [s, bs] of where) {
  const b = bs.length > 1 ? 'common' : bs[0];
  (final[b] ??= []).push(s);
}
const total = Object.values(final).reduce((a, l) => a + l.length, 0);
writeFileSync(out, JSON.stringify({ voice: 'am_michael', banks: final }, null, 1) + '\n');
console.log(Object.entries(final).map(([b, l]) => `${b}: ${l.length}`).join(', '), `· ${total} sentences →`, out.pathname);

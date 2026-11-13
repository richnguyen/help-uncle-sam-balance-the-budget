// Sponsors as Congress.gov lists them, and floor votes from the official records, on a bill card and
// on a followed bill, with the player's own state's members once a ZIP is saved. The bill's record
// is injected in the shape the roll-call parser produces (the local bills.json has no votes).
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const OUT = __OUT + '/';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
    localStorage.setItem('ftd:journey', JSON.stringify({ v: 2, done: ['level-1'], settings: { narration: false, voice: 'off', sounds: false } }));
    localStorage.setItem('ftd:zip', JSON.stringify('10001')); // New York
  });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5173/#guide'); await p.waitForTimeout(1000);
  const id = await p.evaluate(async () => {
    const { BILLS } = await import('/src/game/feed/items.ts');
    const bill = BILLS.bills.find((x) => x.id === 'hr1-119') ?? BILLS.bills[0];
    bill.sponsor = { name: 'Rep. Arrington, Jodey C.', display: 'Rep. Arrington, Jodey C. [R-TX-19]', party: 'R', state: 'TX', district: 19 };
    bill.votes = [
      { chamber: 'House', roll: 190, date: '2025-07-03', question: 'On Motion to Concur in the Senate Amendment', result: 'Passed', totals: { yea: 218, nay: 214, present: 0, notVoting: 0 }, url: 'https://clerk.house.gov/Votes/2025190',
        members: [['Adams', 'D', 'NC', 'Nay'], ['Garbarino', 'R', 'NY', 'Yea'], ['Goldman (NY)', 'D', 'NY', 'Nay']] },
      { chamber: 'Senate', roll: 372, date: '2025-07-01', question: 'On Passage of the Bill (H.R. 1 As Amended )', result: 'Bill Passed', totals: { yea: 51, nay: 50, present: 0, notVoting: 0 }, url: 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.htm',
        members: [['Charles Schumer', 'D', 'NY', 'Nay'], ['Kirsten Gillibrand', 'D', 'NY', 'Nay'], ['Jim Banks', 'R', 'IN', 'Yea']] },
    ];
    return bill.id;
  });
  // The feed card.
  await p.evaluate(() => { location.hash = '#menu'; }); await p.waitForTimeout(1200);
  await p.locator('.feed-filters .feed-pill', { hasText: 'Bills' }).first().click(); await p.waitForTimeout(500);
  let row = null;
  for (let i = 0; i < 30 && !row; i++) {
    row = await p.evaluate((id) => { const r = document.querySelector(`.feed-row[data-key="bill:${id}"]`); if (r) { r.scrollIntoView({ block: 'start' }); return r.dataset.key; } scrollBy(0, innerHeight * 0.8); return null; }, id);
    await p.waitForTimeout(200);
  }
  const card = p.locator(`.feed-row[data-key="${row}"]`);
  await p.waitForTimeout(400);
  const sp = await card.locator('.fc-sponsor').textContent();
  ok(/Sponsor:\s*Rep\. Arrington, Jodey C\. \[R-TX-19\]/.test(sp), 'the sponsor reads exactly as Congress.gov lists them: ' + sp.replace(/\s+/g, ' ').trim());
  const flag = card.locator('.fc-sponsor img.st-flag');
  ok(await flag.count() === 1 && await flag.getAttribute('src') === 'flags/TX.png' && await flag.getAttribute('alt') === '' && await flag.evaluate((i) => i.complete && i.naturalWidth > 0), 'the sponsor’s state flag (Texas) sits beside the name, decorative, and loads');
  ok(await card.locator('.fc-avatar').count() === 0, 'no initials avatar');
  const fv = card.locator('.fv');
  ok(await fv.count() === 2 && /House · roll call 190 · Jul 3, 2025/.test(await fv.nth(0).textContent()) && /Yea 218 · Nay 214/.test(await fv.nth(0).textContent()), 'floor votes: the chamber, roll call, date and official totals');
  ok(/Passed/.test(await fv.nth(0).textContent()) && await fv.nth(0).locator('a.fv-src').getAttribute('href') === 'https://clerk.house.gov/Votes/2025190' && /senate\.gov/.test(await fv.nth(1).locator('a.fv-src').getAttribute('href')), 'each vote links to its official record');
  await fv.nth(0).locator('summary').click(); await fv.nth(1).locator('summary').click(); await p.waitForTimeout(200);
  const ny = await card.locator('.fv-mine li').allTextContents();
  ok(ny.length === 4 && ny.some((x) => /Garbarino \(R-NY\): Yea/.test(x)) && ny.some((x) => /Charles Schumer \(D-NY\): Nay/.test(x)) && !ny.some((x) => /Adams|Banks/.test(x)), 'with a New York ZIP saved, how New York’s members voted, and only theirs: ' + ny.join('; '));
  const mflags = await card.locator('.fv-mine li img.st-flag').evaluateAll((l) => l.map((i) => i.getAttribute('src')));
  ok(mflags.length === 4 && mflags.every((x) => x === 'flags/NY.png'), 'every member listed gets their state’s flag, the same way: ' + mflags.join());
  const styles = await card.locator('.fv-mine li').evaluateAll((l) => l.map((x) => getComputedStyle(x).color + getComputedStyle(x).backgroundColor));
  ok(new Set(styles).size === 1, 'no colors by party: every member’s line looks the same');
  await card.locator('.fc-follow-btn').evaluate((e) => e.click()); await p.waitForTimeout(300);
  await card.locator('.fv-wrap').screenshot({ path: OUT + 'floorvotes.png' });
  // Following it: the record (the You tab) shows the votes too.
  await p.evaluate(() => { location.hash = '#guide'; }); await p.waitForTimeout(1200);
  ok(await p.locator('.fb-item .fv').count() === 2, 'a followed bill’s votes show in Your record');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  // Every state and territory a lawmaker can come from has a flag, and Sources credits each file.
  const missing = await p.evaluate(async () => { const out = []; for (const st of ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','GU','VI','AS','MP']) { const r = await fetch('flags/' + st + '.png'); if (!r.ok || !/image\/png/.test(r.headers.get('content-type') || '')) out.push(st); } return out; });
  ok(!missing.length, 'a flag for all 50 states, DC and the five territories' + (missing.length ? ': missing ' + missing.join() : ''));
  await p.evaluate(() => { location.hash = '#sources'; }); await p.waitForTimeout(1200);
  const cred = p.locator('.flag-credits');
  ok(await cred.count() === 1 && await cred.locator('li').count() === 56 && /Wikimedia Commons/.test(await p.locator('#flags').textContent()) && (await cred.locator('li a').first().getAttribute('href')).startsWith('https://commons.wikimedia.org/wiki/File:'), 'Sources credits all 56 flag files, each linked to its Commons page with its license');
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
})();

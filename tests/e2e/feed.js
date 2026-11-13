// The main menu's feed: topics, the 3-1-1 mix, sources on every post, saving, voting, quick
// checks, swipe cards, paging, windowing, coming back to the same place, back to top, the end.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: ['level-1'], stars: { 'level-1': 3 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts) => { const ctx = await b.newContext({ acceptDownloads: true, ...opts }); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
  const p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#journey'); await p.waitForTimeout(1500);
  // Windowing mounts and unmounts posts as the page scrolls: pin one post by its key, centered.
  const pin = async (kind) => {
    const key = await p.evaluate((k) => { const r = document.querySelector(`.feed-row:has(.fc[data-kind="${k}"])`); if (!r) return null; r.scrollIntoView({ block: 'center' }); return r.dataset.key; }, kind);
    await p.waitForTimeout(400);
    return key ? p.locator(`.feed-row[data-key="${key}"] .fc`) : null;
  };
  const toFeed = () => p.evaluate(() => scrollTo(0, document.querySelector('.feed').getBoundingClientRect().top + scrollY));

  // 1. Under Uncle Sam and the deficit, with a sticky row of topics.
  const order = await p.evaluate(() => { const d = document.querySelector('.menu-deficit').getBoundingClientRect().bottom; const f = document.querySelector('.feed').getBoundingClientRect().top; return f > d; });
  ok(order && await p.locator('.menu-mall, .menu-profile, .deficit').count() === 3, 'the feed comes after Uncle Sam, the deficit and the top-right buttons');
  const pills = await p.$$eval('.feed-filters .feed-pill', (l) => l.map((x) => x.textContent));
  ok(pills.join() === 'All,Bills,Budget,Polls,Lessons,Fun facts,News', 'topics: ' + pills.join(' · '));
  await toFeed(); await p.evaluate(() => scrollBy(0, 1600)); await p.waitForTimeout(500);
  const stuck = await p.evaluate(() => { const r = document.querySelector('.feed-filters').getBoundingClientRect(); return { top: Math.round(r.top), pos: getComputedStyle(document.querySelector('.feed-filters')).position }; });
  ok(stuck.pos === 'sticky' && stuck.top <= 2, `the topics stay pinned at the top while scrolling (top ${stuck.top}px)`);
  ok(await p.locator('.tabbar a[data-tab="menu"] .tab-label').textContent() === 'Feed', 'the middle tab is the Feed');

  // 2. The mix: fresh official posts first, then "caught up"; 3-1-1; never three of a kind.
  await toFeed(); await p.waitForTimeout(300);
  const seq = async () => p.$$eval('.feed-row', (l) => l.map((r) => r.querySelector('.fc')?.dataset.kind ?? (r.querySelector('.fc-caughtup') ? 'caughtup' : 'carousel')));
  let kinds = await seq();
  ok(['bill', 'news', 'deadline', 'daily', 'fact'].includes(kinds[0]), `the first post is fresh and official (${kinds[0]})`);
  // Load a few batches to see the pattern.
  for (let k = 0; k < 6; k++) { await p.evaluate(() => scrollBy(0, 1400)); await p.waitForTimeout(350); }
  const caught = await p.locator('.fc-caughtup').count() + (await p.evaluate(() => [...document.querySelectorAll('.feed-row')].length));
  const allKinds = await p.evaluate(() => window.__feedKinds ?? null);
  await toFeed(); await p.waitForTimeout(400);
  kinds = await seq();
  let triple = false; for (let i = 2; i < kinds.length; i++) if (kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2] && kinds[i] !== 'caughtup') triple = true;
  ok(!triple, 'never three posts of the same kind in a row: ' + kinds.slice(0, 14).join(' '));
  ok(caught > 0 && allKinds === null, 'the stream renders rows');

  // 3. Every post: a badge, an official source, a date where there is one, and Save.
  const heads = await p.$$eval('.feed-row .fc', (l) => l.map((c) => ({ kind: c.dataset.kind, badge: !!c.querySelector('.fc-badge'), src: c.querySelector('.fc-source')?.textContent.trim(), save: !!c.querySelector('.fc-save') })));
  const pics = await p.$$eval('.feed-row .fc', (l) => l.map((c) => ({ kind: c.dataset.kind, art: !!c.querySelector('.fc-art, .fc-term-letter, .fc-donut, .fc-barchart') })));
  ok(pics.length > 0 && pics.every((x) => x.art), `every post has a picture or a chart (${pics.map((x) => x.kind).join(' ')})`);
  ok(heads.length > 0 && heads.every((h) => h.badge && h.src && h.save), `every post has its badge, source and Save (${heads.length} checked)`);

  // 4. Bills: status, three-line summary that opens, What it costs, a quick answer kept here.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Bills' }).first().click(); await p.waitForTimeout(500);
  const onlyBills = await p.$$eval('.feed-row .fc', (l) => l.map((c) => c.dataset.kind));
  ok(onlyBills.length > 0 && onlyBills.every((k) => k === 'bill'), `Bills shows only bills (${onlyBills.length})`);
  const bc = await pin('bill');
  const billSrc = await bc.locator('.fc-source').textContent();
  ok(/Congress\.gov · CRS summary · Updated [A-Z][a-z]{2} \d+, 20\d\d/.test(billSrc), 'a bill: Congress.gov · CRS summary · Updated date — ' + billSrc);
  ok(await bc.locator('.fc-status').count() === 1 && /^(Introduced|In committee|Reported by committee|Passed House|Passed Senate|Passed both chambers|Sent to President|Became law|Vetoed)$/.test(await bc.locator('.fc-status').textContent()), 'a status pill: ' + await bc.locator('.fc-status').textContent());
  const clamp = await bc.locator('.fc-tldr').evaluate((e) => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) }));
  ok(clamp.h <= clamp.lh * 3 + 2, `the summary shows three lines at most (${Math.round(clamp.h)}px)`);
  await bc.locator('.fc-more').click(); await p.waitForTimeout(200);
  ok(await bc.locator('.fc-tldr.is-open').count() === 1 && /Congressional Research Service/.test(await bc.textContent()), 'Read summary opens all of it, credited to CRS');
  await bc.locator('[role="tab"]', { hasText: 'What it costs' }).click();
  ok(/Congressional Budget Office/.test(await bc.locator('.fc-tabpanel').textContent()), 'What it costs: CBO’s estimate, or that there isn’t one yet');
  await bc.locator('.fc-choice', { hasText: 'Support' }).click(); await p.waitForTimeout(200);
  ok(await bc.locator('.fc-choice[aria-pressed="true"]').textContent() === 'Support' && /Saved on this device[\s\S]*Not a scientific poll/.test(await bc.locator('.fc-vote').textContent()), 'answering a bill: kept on this device off the real site, and labeled not a scientific poll');
  ok(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ftd:journey')).feedVotes ?? {}).some((k) => k.startsWith('bill:'))), 'the answer is in the player’s record');

  // 5. Polls: arguments for and against, Include it / Leave it out, the same vote as the game's cards.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Polls' }).first().click(); await p.waitForTimeout(500);
  const pc = await pin('poll');
  const tabs = await pc.locator('[role="tab"]').allTextContents();
  ok(tabs.join() === 'What it does,Who pays,Who benefits' && /^\$[\d.]+ (billion|trillion)$/.test(await pc.locator('.fc-art-big').textContent()) && /CBO/.test(await pc.locator('.fc-art-small').textContent()), 'a poll: What it does / Who pays / Who benefits, and CBO’s ten-year number');
  ok(await pc.locator('.fc-ask').textContent() === 'Would you include this in your plan?' && /^Fact: deficits would be about \$[\d.]+ (billion|trillion) (smaller|larger) over ten years, by CBO’s estimate\.$/.test(await pc.locator('.fc-fact').textContent()), 'the question asks about your plan; the deficit effect is stated as a fact');
  await pc.locator('[role="tab"]', { hasText: 'Who pays' }).click(); const pays = await pc.locator('.fc-tabpanel').textContent();
  await pc.locator('[role="tab"]', { hasText: 'Who benefits' }).click(); const gains = await pc.locator('.fc-tabpanel').textContent();
  ok(pays.length > 10 && gains.length > 10 && pays !== gains && /less of the budget goes to interest/.test(gains), 'who pays and who benefits each say whom');
  await pc.locator('.fc-choice', { hasText: 'Include it' }).click(); await p.waitForTimeout(300);
  ok(await pc.locator('.fc-choice[aria-pressed="true"]').textContent() === 'Include it', 'Include it is recorded');

  // 6. Lessons: a quick check answers in place; a mission lists its steps.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Lessons' }).first().click(); await p.waitForTimeout(500);
  for (let k = 0; k < 6 && !(await p.locator('.fc[data-kind="check"]').count()); k++) { await p.evaluate(() => scrollBy(0, 1200)); await p.waitForTimeout(350); }
  const cc = await pin('check');
  await cc.locator('.fc-choice').first().click(); await p.waitForTimeout(200);
  ok(await cc.locator('.fc-explain').count() === 1 && await cc.locator('.fc-choice[data-right]').count() === 1, 'a quick check: the right answer and why, right in the feed');
  await toFeed(); await p.waitForTimeout(300);
  for (let k = 0; k < 6 && !(await p.locator('.fc[data-kind="tutorial"]').count()); k++) { await p.evaluate(() => scrollBy(0, 1200)); await p.waitForTimeout(350); }
  const tc = await pin('tutorial');
  await tc.locator('.fc-more').click(); await p.waitForTimeout(150);
  ok(/steps · \d+ min/.test(await tc.locator('.fc-art-small').textContent()) && await tc.locator('.fc-art .seal').count() === 1 && await tc.locator('.fc-steps li').count() > 2 && /^#level-/.test(await tc.locator('.fc-cta').getAttribute('href')), 'a mission: steps and minutes, its steps listed, and Start the lesson');

  // 7. Budget lessons: a number, a chart, three cards to swipe.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Budget' }).first().click(); await p.waitForTimeout(500);
  const sc = await pin('stat');
  ok(await sc.locator('.fc-donut, .fc-barchart').count() === 1 && await sc.locator('.fc-slide').count() === 3 && /scroll|auto/.test(await sc.locator('.fc-slides').evaluate((e) => getComputedStyle(e).overflowX)), 'a budget lesson: a number, a small chart, and three cards to swipe');
  const slid = await sc.locator('.fc-slides').evaluate(async (e) => { e.scrollLeft = e.clientWidth; await new Promise((r) => setTimeout(r, 300)); return e.scrollLeft > 0; });
  ok(slid && await sc.locator('.fc-dots span[data-on]').count() === 1, 'the cards slide sideways, with dots to show where');

  // 7b. Fun facts: sourced facts and budget history; anniversaries come first.
  await p.locator('.feed-filters .feed-pill', { hasText: 'Fun facts' }).click(); await p.waitForTimeout(500);
  const facts = await p.$$eval('.feed-row .fc', (l) => l.map((c) => ({ kind: c.dataset.kind, badge: c.querySelector('.fc-badge').textContent, src: c.querySelector('.fc-source a')?.getAttribute('href') ?? '', big: c.querySelector('.fc-art-big')?.textContent ?? '' })));
  ok(facts.length > 0 && facts.every((f) => f.kind === 'fact' && /^https:\/\/(www\.|home\.)?([a-z]+\.)*(gov|treasury\.gov)\//.test(f.src) && f.big), `Fun facts: only facts, each with an official .gov source and a big number or year (${facts.length} shown)`);
  ok(/^(On this day|This week in budget history)$/.test(facts[0].badge), 'an anniversary comes first: ' + facts[0].badge);
  await p.locator('.feed-filters .feed-pill', { hasText: 'All' }).click(); await p.waitForTimeout(400);
  let tl = 0;
  for (let k = 0; k < 40 && !tl; k++) { await p.evaluate(() => scrollBy(0, 1400)); await p.waitForTimeout(150); tl = await p.locator('.fc-carousel[aria-label="Budget history, year by year"] .fc-mini-fact').count(); }
  const years = await p.$$eval('.fc-carousel[aria-label="Budget history, year by year"] .fc-mini-year', (l) => l.map((x) => +x.textContent));
  ok(tl >= 10 && years.every((y, i) => !i || y >= years[i - 1]), `a budget-history timeline to swipe, in order: ${years.join(', ')}`);
  await toFeed(); await p.waitForTimeout(300);
  await p.locator('.feed-filters .feed-pill', { hasText: 'Budget' }).click(); await p.waitForTimeout(400);

  // 8. The end of a topic: a clear last card, not a spinner.
  for (let k = 0; k < 30 && !(await p.locator('.feed-end').count()); k++) { await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300); }
  ok(await p.locator('.feed-end').count() === 1 && /That’s everything in Budget/.test(await p.locator('.feed-end').textContent()) && await p.locator('.feed-end .feed-pill').count() >= 3, 'the end: “That’s everything in Budget”, with other topics to try');
  ok(await p.locator('.feed-end a[href="#sources"]').count() === 1, 'the footer links live in the end card');
  await p.locator('.feed-end button', { hasText: 'Show all topics' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.feed-pill[aria-pressed="true"]').first().textContent() === 'All', 'Show all topics goes back to All');

  // 9. Paging and windowing: a batch at a time, skeletons while loading, and only the posts near the screen in the page.
  await toFeed(); await p.waitForTimeout(300);
  const first = await p.locator('.feed-row').count();
  let sawSkeleton = false, maxRows = 0;
  for (let k = 0; k < 40; k++) {
    await p.evaluate(() => scrollBy(0, 900)); await p.waitForTimeout(90);
    sawSkeleton ||= await p.locator('.fc-skeleton').count() > 0;
    maxRows = Math.max(maxRows, await p.locator('.feed-row').count());
  }
  const loadedDeep = await p.evaluate(() => Math.max(...[...document.querySelectorAll('.feed-row')].map((r) => +r.getAttribute('aria-posinset'))));
  ok(first <= 12 && loadedDeep > 40, `loads a batch at a time: ${first} at first, ${loadedDeep} after a long scroll`);
  ok(sawSkeleton, 'skeleton cards show while the next batch loads');
  ok(maxRows < 30, `only the posts near the screen are in the page (at most ${maxRows} at once)`);
  await p.screenshot({ path: out + 'feed-deep.png' });

  // 10. Back to top, after two screens.
  ok(await p.locator('.feed-top').count() === 1, 'a Top button after two screens');
  await p.locator('.feed-top').click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => Math.abs(document.querySelector('.feed').getBoundingClientRect().top) < 20), 'Top goes back to the top of the feed');

  // 11. Open a post and come back: the same place.
  for (let k = 0; k < 5; k++) { await p.evaluate(() => scrollBy(0, 900)); await p.waitForTimeout(250); }
  const before = await p.evaluate(() => { const r = [...document.querySelectorAll('.feed-row')].find((x) => x.getBoundingClientRect().top >= 0); return { id: r.dataset.key, top: Math.round(r.getBoundingClientRect().top), y: Math.round(scrollY) }; });
  await p.evaluate(() => { location.hash = '#glossary'; }); await p.waitForTimeout(900);
  await p.goBack(); await p.waitForTimeout(1500);
  const after = await p.evaluate((id) => { const r = document.querySelector(`.feed-row[data-key="${CSS.escape(id)}"]`); return { found: !!r, top: r ? Math.round(r.getBoundingClientRect().top) : null, y: Math.round(scrollY) }; }, before.id);
  ok(after.found && Math.abs(after.top - before.top) < 40, `Back returns to the same post in the same place (${before.id}: ${before.top}px → ${after.top}px, y ${before.y} → ${after.y})`);

  // 12. Save for later, then find it in Your record.
  const saveKey = await p.evaluate(() => [...document.querySelectorAll('.feed-row')].find((x) => x.getBoundingClientRect().top >= 0 && x.querySelector('.fc-save')).dataset.key);
  const save = p.locator(`.feed-row[data-key="${saveKey}"] .fc-save`);
  const savedTitle = (await save.getAttribute('aria-label')).replace(/^Save for later: /, '');
  await save.click(); await p.waitForTimeout(200);
  ok(await save.getAttribute('aria-pressed') === 'true', 'Save marks the post');
  await p.goto(base + '#guide'); await p.waitForTimeout(900);
  ok(await p.locator('.saved-item').count() === 1 && (await p.locator('.saved-item strong').textContent()) === savedTitle, 'Your record: Saved for later lists it — ' + savedTitle.slice(0, 50));
  const impact = (await p.locator('.rc-stats').innerText()).replace(/\s+/g, ' ');
  ok(/Polls 1/i.test(impact) && /Bills 1/i.test(impact) && /Checks \d\/1/i.test(impact), 'Your record: 1 poll, 1 bill, 1 quick check — ' + impact);
  await p.locator('.saved-item button').click(); await p.waitForTimeout(200);
  ok(await p.locator('.saved-item').count() === 0, 'Remove takes it off the list');

  // 13. A deadline close at hand: Save to calendar gives a calendar file.
  await p.goto(base + '#journey'); await p.waitForTimeout(1200);
  await p.locator('.feed-filters .feed-pill', { hasText: 'News' }).first().click(); await p.waitForTimeout(500);
  const dl = p.locator('.fc[data-kind="deadline"]');
  if (await dl.count()) {
    const [d] = await Promise.all([p.waitForEvent('download'), dl.first().locator('button', { hasText: 'Save to calendar' }).click()]);
    const body = await (await import('node:fs')).promises.readFile(await d.path(), 'utf8');
    ok(/^BEGIN:VCALENDAR/.test(body) && /DTSTART;VALUE=DATE:\d{8}/.test(body) && /SUMMARY:/.test(body) && /\.ics$/.test(d.suggestedFilename()), 'Save to calendar: a .ics file with the date — ' + d.suggestedFilename());
  } else ok(true, 'no deadline within two months, so no calendar card');
  await p.context().close();

  // 14. A wide screen: topics on the left, a readable column, what's coming on the right.
  const w = await mk({ viewport: { width: 1440, height: 900 } });
  await w.goto(base + '#journey'); await w.waitForTimeout(1300);
  await w.evaluate(() => scrollTo(0, document.querySelector('.feed').getBoundingClientRect().top + scrollY));
  await w.waitForTimeout(500);
  const L = await w.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { rail: r('.feed-rail').width, main: r('.feed-main').width, side: r('.feed-side').width, pillsHidden: getComputedStyle(document.querySelector('.feed-filters .feed-pills')).display === 'none' }; });
  ok(L.rail > 150 && L.main >= 600 && L.main <= 680 && L.side > 200 && L.pillsHidden, `wide: rail ${Math.round(L.rail)}px, column ${Math.round(L.main)}px, side ${Math.round(L.side)}px`);
  ok(/Coming up/.test(await w.locator('.feed-side').textContent()) && /Apr 15/.test(await w.locator('.feed-side').textContent()), 'the side column: dates coming up, tax day among them');
  await w.screenshot({ path: out + 'feed-desk.png' });
  await w.context().close();

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });

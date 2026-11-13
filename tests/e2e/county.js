// Mission 1.4's "Your county": the ZIP is asked here, first, and the county comes from it; the
// numbers match the IRS file, cross-county ZIPs offer each county, and the odd cases (merged income
// groups, tiny counties, territories, ZIPs with no area, no ZIP at all) say what they should.
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
const pc = (v) => `${Math.round(v * 100)}%`;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const title = (p) => p.locator('.chart-title').textContent();
  const zipHere = async (p, z) => { await p.fill('#try-zip', z); await p.locator('.county .zip-find').click(); await p.waitForTimeout(700); };

  let p = await mk({ viewport: { width: 1280, height: 900 } });
  // The data files.
  await p.goto(base + '#sources'); await p.waitForTimeout(600);
  const getJson = (f) => p.evaluate((u) => fetch(u).then((r) => r.json()), base + f);
  const va = await getJson('county/VA.json');
  ok(va.ty === 2023 && va.us.r.reduce((s, v) => s + v, 0) === 159009590 && va.counties.length >= 133, 'VA file: tax year 2023, 159,009,590 U.S. returns, every Virginia county and city');

  // 1. The ZIP comes first in the mission, on this step; until there's a ZIP (or a picked state), the figures wait.
  await p.goto(base + '#level-3'); await p.waitForTimeout(900);
  await H.toStep(p, 'Your county'); await p.waitForTimeout(900);
  const labels = await p.locator('.steptrack-seg').evaluateAll((l) => l.map((x) => x.getAttribute('aria-label') || x.title || x.textContent));
  const ci = labels.findIndex((x) => /Your county/.test(x)), si = labels.findIndex((x) => /Your state/.test(x));
  ok(ci >= 0 && si === ci + 1, 'the county step comes right before the state step: ' + labels.join(' | '));
  ok(await p.locator('#try-zip').count() === 1 && /Type your ZIP code, or pick a state/.test(await p.locator('.cty-wait').textContent()) && await p.locator('.cty-chart').count() === 0, 'no ZIP yet: it asks for one (or a state), and shows no one else’s county');
  await p.locator('.zip-picker summary').click(); await p.selectOption('#try-st', 'TX'); await p.waitForTimeout(900);
  ok(/Who paid the income tax in Texas/.test(await title(p)) && await p.locator('#cty-select').inputValue() === 'state', 'picking a state instead shows the whole state, with a county picker');

  // 2. The ZIP finds the county (for this visit only, nothing saved).
  await p.fill('#try-zip', '22301'); await p.locator('.zip-find').click(); await p.waitForTimeout(900);
  const ax = va.counties[va.zips['22301']];
  const R = ax[3].reduce((s, v) => s + v, 0), T = ax[4].reduce((s, v) => s + v, 0);
  const lede = await p.locator('.cty-lede').textContent();
  ok(/Alexandria city/.test(await title(p)) && /^Alexandria city (› )?Virginia (› )?United States$/.test((await p.locator('.zip-place ol').innerText()).replace(/\s+/g, ' ')), '22301 finds Alexandria city, shown before its state and the country');
  ok(lede.includes(`were ${pc(ax[3][4] / R)} of the returns`) && lede.includes(`paid ${pc(ax[4][4] / T)} of its income tax`), 'the $200K+ shares match the IRS file: ' + lede.trim());
  const stats = await p.locator('.cty-stats').innerText();
  ok(stats.includes('$' + Math.round((T * 1000) / R).toLocaleString('en-US')) && stats.includes(R.toLocaleString('en-US')), 'average per return and number of returns match the file');
  ok(!(await p.evaluate(() => localStorage.getItem('ftd:zip'))), 'the ZIP was not saved (saving stays opt-in)');
  // Five bands, five legend entries, tooltips on hover, and a table.
  ok(await p.locator('.cty-chart .segbar').count() === 4 && await p.locator('.chart .legend-item').count() === 5, 'two county bars, two U.S. bars, five income groups in the legend');
  await p.locator('.cty-chart .segbar').first().locator('div').last().hover(); await p.waitForTimeout(200);
  ok(/\$200,000 or more/.test(await p.locator('.tooltip, [role="tooltip"]').first().textContent().catch(() => '')), 'hovering a segment names its income group');
  await p.locator('.chart-foot .link-btn').click(); await p.waitForTimeout(200);
  ok(await p.locator('table.data tbody tr').count() === 5, 'Show as table: one row per income group');
  await p.locator('.chart-foot .link-btn').click();

  // 3. A ZIP that crosses county lines offers each county.
  await zipHere(p, '20110');
  const chips = await p.locator('.cty-chips .chip').allTextContents();
  ok(chips.length === 2 && /Manassas city/.test(chips[0]) && /77%/.test(chips[0]) && /Prince William/.test(chips[1]) && /Manassas city/.test(await title(p)), '20110 crosses county lines: starts with Manassas city (77% of its land), offers Prince William County');
  await p.locator('.cty-chips .chip').nth(1).click(); await p.waitForTimeout(200);
  ok(/Prince William County/.test(await title(p)) && await p.locator('.cty-chips .chip').nth(1).getAttribute('aria-pressed') === 'true', 'picking Prince William County switches the view');
  await p.selectOption('#cty-select', 'state'); await p.waitForTimeout(200);
  ok(/Who paid the income tax in Virginia/.test(await title(p)), 'the picker can show the whole state');

  // 4. Another state from this step's own ZIP box.
  await zipHere(p, '10001');
  ok(/New York County/.test(await title(p)) && (await p.locator('#cty-select option').count()) >= 63, '10001 here finds New York County and lists New York’s counties');

  // 5. Odd cases.
  await zipHere(p, '79754');
  const leg = await p.locator('.chart .legend-item').allTextContents();
  ok(/Loving County/.test(await title(p)) && leg.length < 5 && leg.some((x) => /\+$/.test(x.trim())), 'Loving County, TX: income groups the IRS folded together show as one (' + leg.join(', ') + ')');
  await zipHere(p, '96742');
  ok(/doesn’t publish figures for Kalawao County/.test(await p.locator('.county').innerText()), 'Kalawao County, HI: too few returns, and it says so');
  await zipHere(p, '00901');
  ok(/50 states and DC/.test(await p.locator('.county').innerText()) && await p.locator('.cty-chart').count() === 0, 'Puerto Rico: explains the IRS county figures leave out the territories');
  const dc = await getJson('county/DC.json');
  const noArea = ['20500', '20201', '20202', '20204'].find((z) => !(z in dc.zips));
  await zipHere(p, noArea);
  ok(/no area of its own/.test(await p.locator('.zip-msg').first().textContent()) && /District of Columbia/.test(await title(p)), `${noArea} (a single-address ZIP) has no county: it says so and shows the whole of DC`);

  // 6. A phone: no sideways scroll.
  p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#level-3'); await p.waitForTimeout(900); await H.toStep(p, 'Your county', true); await p.waitForTimeout(600);
  await zipHere(p, '20106');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && await p.locator('.cty-chips .chip').count() === 3, 'phone: 20106 (three counties) fits with no sideways scroll');

  // 7. The state page: the page picks the state; the section picks a county.
  p = await mk({ viewport: { width: 1280, height: 900 } });
  const sec = (q) => p.locator('#income-tax ' + q);
  await p.goto(base + '#state-va'); await p.waitForTimeout(1500);
  ok(/Who paid the income tax in Virginia/.test(await sec('.chart-title').textContent()) && await sec('#st-county').inputValue() === 'state' && await sec('.cty-yours').count() === 0, 'state page, no ZIP: the whole of Virginia, with a county picker');
  await p.selectOption('#st-county', '51059'); await p.waitForTimeout(300);
  ok(/Fairfax County/.test(await sec('.chart-title').textContent()), 'picking Fairfax County on the state page switches the view');
  await p.selectOption('#st-sel', 'NY'); await p.waitForTimeout(1200);
  ok(/Who paid the income tax in New York/.test(await sec('.chart-title').textContent()) && await sec('#st-county').inputValue() === 'state', 'changing the page’s state starts that state whole');
  await p.selectOption('#st-sel', 'PR'); await p.waitForTimeout(800);
  ok(/50 states and DC/.test(await sec('.county').innerText()) && await sec('.cty-chart').count() === 0, 'Puerto Rico on the state page: the territory note, no chart');
  // A ZIP typed in mission 1.4 (not saved) carries to the state page for the rest of the visit.
  await p.goto(base + '#level-3'); await p.waitForTimeout(900); await H.toStep(p, 'Your county');
  await p.fill('#try-zip', '20110'); await p.locator('.zip-find').click(); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#state-va'; }); await p.waitForTimeout(1500);
  ok(/Manassas city/.test(await sec('.chart-title').textContent()) && await sec('.cty-yours').count() === 1, 'a ZIP typed in mission 1.4 this visit: the state page opens on that county and says so');
  if (/localhost/.test(base)) {
    // Off the public site a saved ZIP lives in this browser (on the site it's in the player's ballot).
    await p.evaluate(() => localStorage.setItem('ftd:zip', '"22301"'));
    await p.goto(base + '#state-va'); await p.reload(); await p.waitForTimeout(1500);
    ok(/Alexandria city/.test(await sec('.chart-title').textContent()) && await sec('.cty-yours').count() === 1, 'with a saved ZIP in Virginia, the state page opens on the player’s county and says so');
  }
  p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#state-ca'); await p.waitForTimeout(1500); await sec('.cty-chart').scrollIntoViewIfNeeded();
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && /California/.test(await sec('.chart-title').textContent()), 'phone: the state page’s county section fits with no sideways scroll');

  // 8. The Revenue page: a state picker, then a county picker.
  p = await mk({ viewport: { width: 1280, height: 900 } });
  const rev = (q) => p.locator('#county-tax ' + q);
  await p.goto(base + '#revenue'); await p.waitForTimeout(1500);
  const st0 = await p.evaluate(() => localStorage.getItem('ftd:state'));
  ok(await rev('#rev-state').inputValue() === 'CA' && /Who paid the income tax in California/.test(await rev('.chart-title').textContent()) && await rev('.cty-yours').count() === 0, 'Revenue page, no ZIP: starts with the whole of California (the default state)');
  await p.selectOption('#rev-state', 'VA'); await p.waitForTimeout(1000);
  ok(/Who paid the income tax in Virginia/.test(await rev('.chart-title').textContent()) && await rev('#st-county').inputValue() === 'state', 'picking Virginia shows the whole state');
  await p.selectOption('#st-county', '51059'); await p.waitForTimeout(300);
  ok(/Fairfax County/.test(await rev('.chart-title').textContent()), 'then Fairfax County');
  ok(await p.evaluate(() => localStorage.getItem('ftd:state')) === st0, 'browsing states here doesn’t change the player’s remembered state');
  await p.selectOption('#rev-state', 'PR'); await p.waitForTimeout(800);
  ok(/50 states and DC/.test(await rev('.county').innerText()) && await rev('#rev-state').count() === 1, 'Puerto Rico: the territory note, and the state picker stays so the player can move on');
  await p.goto(base + '#level-3'); await p.waitForTimeout(900); await H.toStep(p, 'Your county');
  await p.fill('#try-zip', '20110'); await p.locator('.zip-find').click(); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#revenue'; }); await p.waitForTimeout(1500);
  ok(await rev('#rev-state').inputValue() === 'VA' && /Manassas city/.test(await rev('.chart-title').textContent()) && await rev('.cty-yours').count() === 1, 'with a ZIP typed this visit, the Revenue page opens on that state and county');
  p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#revenue'); await p.waitForTimeout(1500); await rev('.cty-chart').scrollIntoViewIfNeeded();
  const w = await p.evaluate(() => [document.querySelector('#rev-state').getBoundingClientRect().width, document.querySelector('#st-county').getBoundingClientRect().width]);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) && Math.abs(w[0] - w[1]) < 2, 'phone: no sideways scroll, and both pickers are full width');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });

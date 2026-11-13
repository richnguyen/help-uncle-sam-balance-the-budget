// Mission 1.4's ZIP code: the state comes from the ZIP; saving it with the ballot is opt-in and
// removable; on the site it goes into the ballot (checked against a stand-in database), and the
// state's results show only for 10+ players; elsewhere it stays in the browser.
const { chromium, devices } = require('playwright');
const H = require('./gamehelp');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const writes = []; let stored = null; let area = null;
  const mk = async (opts, site) => {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(([j, site]) => { if (!localStorage.getItem('ftd:journey')) { localStorage.setItem('ftd:journey', j); if (site) localStorage.setItem('ftd:backend', '"on"'); } }, [J, site]);
    if (site) await ctx.route('**/*.supabase.co/**', async (route) => {
      const r = route.request(); const u = new URL(r.url()); const m = r.method();
      const body = r.postData() ? JSON.parse(r.postData()) : null;
      if (u.pathname.endsWith('/auth/v1/signup')) return route.fulfill({ json: { access_token: 'tok', refresh_token: 'tok', expires_in: 3600, user: { id: 'player-1' } } });
      if (u.pathname.endsWith('/rpc/ballot_area_totals')) return area ? route.fulfill({ json: area }) : route.fulfill({ status: 404, json: { message: 'function not found' } });
      if (u.pathname.includes('/rpc/')) return route.fulfill({ json: u.pathname.includes('ballot') ? { voters: 0, options: {}, plans: {}, issues: {} } : u.pathname.includes('player') ? { players: 0, done: {}, stars: {}, firstTry: {}, medals: {} } : [] });
      if (u.pathname.endsWith('/ballots')) {
        if (m === 'GET') return route.fulfill({ json: stored ? [{ ballot: stored }] : [] });
        const bal = Array.isArray(body) ? body[0]?.ballot : body?.ballot;
        writes.push(bal); stored = bal;
        return route.fulfill({ status: 201, body: '' });
      }
      return route.fulfill({ status: 201, body: '' });
    });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p;
  };
  const toZip = async (p) => { await p.goto(base + '#level-3'); await p.waitForTimeout(900); await H.toStep(p, 'Your county'); await p.waitForTimeout(300); };
  const place = async (p) => (await p.locator('.zip-place ol').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const toState = async (p) => { await H.toStep(p, 'Your state'); await p.waitForTimeout(400); };
  const type = async (p, z) => { await p.fill('#try-zip', z); await p.waitForTimeout(80); };

  // 1. The lookup: first three digits, with the few exceptions.
  let p = await mk({ viewport: { width: 1280, height: 900 } }, false);
  await p.goto(base + '#sources'); await p.waitForTimeout(600);
  const look = await p.evaluate(async () => {
    const Z = await import('/src/lib/zip.ts');
    const r = (z) => { const a = Z.areaForZip(z); return a ? (a.kind === 'state' ? a.abbr : a.kind) : 'invalid'; };
    return Object.fromEntries(['22301', '10001', '94105', '60601', '00901', '00802', '96799', '96950', '96910', '20500', '20166', '05501', '73301', '88510', '99501', '09012', '96201', '00100', '2230', 'abcde'].map((z) => [z, r(z)]));
  });
  const want = { 22301: 'VA', 10001: 'NY', 94105: 'CA', 60601: 'IL', '00901': 'PR', '00802': 'VI', 96799: 'AS', 96950: 'MP', 96910: 'GU', 20500: 'DC', 20166: 'VA', '05501': 'MA', 73301: 'TX', 88510: 'TX', 99501: 'AK', '09012': 'military', 96201: 'military', '00100': 'unknown', 2230: 'invalid', abcde: 'invalid' };
  const bad = Object.entries(want).filter(([z, s]) => look[z] !== s);
  ok(!bad.length, 'ZIP → state for 20 cases, including Samoa, the Marianas, DC, IRS ZIPs and military mail' + (bad.length ? ': ' + bad.map(([z]) => `${z}→${look[z]}`).join(' ') : ''));

  // 2. Without the shared database: the state comes from the ZIP; saving is opt-in and stays in the browser.
  await toZip(p);
  ok(await p.locator('#try-zip').count() === 1 && await p.locator('.zip-find').isDisabled() && !(await p.locator('.zip-keep input').isChecked()), 'the step asks for a ZIP; Find waits for five digits; saving is unchecked');
  ok(/stays in this browser/.test(await p.locator('#zip-note').textContent()), 'off the site, it says a saved ZIP stays in the browser');
  await type(p, '09012'); await p.locator('.zip-find').click(); await p.waitForTimeout(200);
  ok(/military ZIP/.test(await p.locator('.zip-msg').first().textContent()) && await p.locator('.zip-picker[open]').count() === 1, 'a military ZIP has no state: the state picker opens instead');
  await type(p, '22301'); await p.locator('.zip-find').click(); await p.waitForTimeout(300);
  const pl = await place(p);
  ok(/^Alexandria city (› )?Virginia (› )?United States$/.test(pl) && await p.locator('.cty .stat, .county .stat').count() > 0, 'after the ZIP, the county comes first, then the state and the country: ' + pl);
  ok(await p.locator('.zip-stamp').count() === 0 && await p.locator('.zip-save').count() === 1, 'nothing is saved until asked');
  const notSaved = await p.evaluate(() => localStorage.getItem('ftd:zip'));
  await p.locator('.zip-save').click(); await p.waitForTimeout(200);
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('ftd:zip') || '""'));
  ok(!JSON.parse(notSaved || '""') && kept === '22301' && /22301/.test(await p.locator('.zip-postmark').innerText()) && /this browser only/.test(await p.locator('.zip-stamp').innerText()), 'after “Save,” the ZIP is stamped and kept in this browser only');
  await toState(p);
  ok(/Virginia/.test(await p.locator('.stat-label', { hasText: 'Federal awards to' }).textContent()) && /From your ZIP code 22301/.test(await p.locator('.zip-from').innerText()), 'the next step zooms out to the state the ZIP found (Virginia), against the whole country');
  await p.locator('.steptrack-seg').nth(2).click(); await p.waitForTimeout(900);
  await p.locator('.zip-remove').click(); await p.waitForTimeout(200);
  ok(!JSON.parse((await p.evaluate(() => localStorage.getItem('ftd:zip'))) || '""') && await p.locator('#try-zip').inputValue() === '', 'Remove my ZIP clears it');

  // 3. On the site (stand-in database): the ZIP is saved with the ballot, and removed from it.
  p = await mk({ viewport: { width: 1280, height: 900 } }, true);
  await toZip(p);
  ok(/only you can see it/.test(await p.locator('#zip-note').textContent()), 'on the site, it says the ZIP goes into the game’s database, where only the player can see it');
  await type(p, '22301'); await p.locator('.zip-find').click(); await p.waitForTimeout(600);
  ok(writes.length === 0, 'finding the county and state alone writes nothing');
  await p.locator('.zip-keep input').check().catch(() => {});
  await p.locator('.zip-save').click().catch(async () => { await p.locator('.zip-find').click(); });
  await p.waitForTimeout(1200);
  const w = writes.at(-1);
  ok(w && w.zip === '22301' && w.state === 'VA' && typeof w.options === 'object' && typeof w.issues === 'object', 'saving writes the ballot with the ZIP and its state: ' + JSON.stringify(w));
  ok(/Only you can see your ZIP/.test(await p.locator('.zip-stamp').innerText()) && /Once 10 or more players in Virginia/.test(await p.locator('.zip-area').innerText()), 'stamped; until the totals function exists (or 10 players save), it says results come later');
  // A vote afterward keeps the ZIP on the ballot.
  await H.toStep(p, 'Your vote'); await p.waitForTimeout(300);
  await p.locator('.vote-btn, .ballot-choice').first().click(); await p.waitForTimeout(1200);
  ok(writes.at(-1)?.zip === '22301' && Object.keys(writes.at(-1)?.options ?? {}).length >= 1, 'a later vote is saved with the ZIP still on the ballot');
  // Coming back: the ZIP is prefilled from the ballot; with 10+ Virginians, their results show.
  area = { min: 10, states: { VA: { voters: 12, options: { 'cut-defense-budget': { support: 8, oppose: 4 }, 'vat-5pct': { support: 2, oppose: 9 } }, issues: {} } }, zip3: {} };
  await p.goto(base + '#levels'); await p.waitForTimeout(500); await p.goto(base + '#level-3'); await p.reload(); await p.waitForTimeout(1500);
  await p.locator('.steptrack-seg').nth(2).click(); await p.waitForTimeout(1800);
  ok(await p.locator('#try-zip').inputValue() === '22301' && /12 players in Virginia/.test(await p.locator('.zip-area').innerText()) && /Cut the Defense Department['’]s budget \(67% support\)/.test(await p.locator('.zip-area').innerText()), 'coming back: the saved ZIP is filled in, and Virginia’s results show: ' + (await p.locator('.zip-area').innerText()));
  await p.locator('.zip-remove').click(); await p.waitForTimeout(1200);
  ok(!('zip' in (writes.at(-1) ?? {})) && !('state' in (writes.at(-1) ?? {})) && Object.keys(writes.at(-1)?.options ?? {}).length >= 1, 'Remove my ZIP takes the ZIP and state off the ballot and keeps the votes');

  // 4. On a phone: no sideways scroll.
  p = await mk({ ...devices['iPhone 13'] }, false);
  await toZip(p); await type(p, '10001'); await p.locator('.zip-find').tap(); await p.waitForTimeout(300);
  const pl2 = await place(p);
  ok(/^New York County (› )?New York (› )?United States$/.test(pl2) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: 10001 is in New York County, New York, United States; no sideways scroll: ' + pl2);
  await toState(p);
  ok(/New York/.test(await p.locator('.stat-label', { hasText: 'Federal awards to' }).textContent()), 'phone: then New York’s federal money');

  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n').slice(0, 4).join(' | ')); process.exit(1); });

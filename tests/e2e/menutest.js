// The main menu: a screen of its own (no top bar, no action bar), Uncle Sam standing on this
// year's deficit, the music and sounds, and the tab bar along the bottom of every screen outside a mission.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (o) => JSON.stringify({ v: 2, done: ['level-1', 'level-2'], stars: { 'level-1': 3, 'level-2': 2 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], settings: { text: 'normal', theme: 'system', freeRoam: false, narration: false, voice: 'off', haptics: false, sounds: false, voiceV: 2 }, ...o });
const num = (t) => Number(String(t).replace(/[^0-9.]/g, ''));
const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);
const { answerAny } = require('./gamehelp');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts, j = J({})) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, j); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

  // 1. On a phone.
  let p = await mk({ ...devices['iPhone 13'] });
  await p.goto(base + '#journey'); await p.waitForTimeout(1200);
  // The choices are the tab bar: five tabs alike, with icons and names, Mission in the middle.
  const tabs = await p.$$eval('.tabbar a.tab', (l) => l.map((a) => { const i = a.querySelector('.tab-icon').getBoundingClientRect(); return { id: a.dataset.tab, href: a.getAttribute('href'), label: a.querySelector('.tab-label').textContent, icon: !!a.querySelector('.tab-icon svg'), size: `${Math.round(i.width)}x${Math.round(i.height)}`, bg: getComputedStyle(a.querySelector('.tab-icon')).backgroundColor, cur: a.getAttribute('aria-current') }; }));
  ok(tabs.map((t) => t.id).join() === 'mission,daily,menu,together,guide' && tabs.every((t) => t.icon && t.label) && tabs[2].label === 'Feed' && tabs[4].label === 'You' && await p.locator('header.hud a[href="#journey"]').count() === 0 && new Set(tabs.map((t) => t.size)).size === 1, 'the tab bar, five tabs alike: ' + tabs.map((t) => t.label).join(' · '));
  ok(tabs[0].href === '#levels' && tabs[2].href === '#journey' && tabs[2].cur === 'page' && tabs.filter((t) => t.cur).length === 1 && tabs.filter((t, k) => k !== 2).every((t) => t.bg === tabs[0].bg), `Roadmap first goes to the road map (${tabs[0].href}); the main menu, in the middle, is lit on the main menu`);
  ok(await p.locator('.menu-item, .mc-camp, .menu-strip, .ticker').count() === 0, 'no menu buttons, campaign chips or headline strip on the main menu');
  const tr = await p.$$eval('.menu-tr > *', (l) => l.map((a) => a.getAttribute('href')));
  ok(tr.join() === '#mall,#settings,#guide' && /★ 5/.test(await p.locator('.menu-mall').textContent()) && /5 stars to spend/.test(await p.locator('.menu-mall').getAttribute('aria-label')), `top right: Build the Mall (with the stars to spend), Settings and Your record (${tr.join(' ')})`);
  const mb = await p.evaluate(() => { const r = document.querySelector('.menu-mall').getBoundingClientRect(); return { h: Math.round(r.height), lines: Math.round(r.height / parseFloat(getComputedStyle(document.querySelector('.menu-mall-stars')).lineHeight || 20)) }; });
  ok(mb.h >= 40 && mb.h <= 44, `the Mall button is one row, ${mb.h}px tall`);
  ok(!/Independent civic education project/.test(await p.locator('body').innerText()), 'no disclaimer on the main menu');
  const shell = await p.evaluate(() => ({ appbar: !!document.querySelector('.appbar'), bars: [...document.querySelectorAll('.actionbar')].filter((e) => getComputedStyle(e).display !== 'none').length, scroll: document.documentElement.scrollWidth, w: innerWidth }));
  ok(!shell.appbar && shell.bars === 0 && shell.scroll <= shell.w, `no top bar (${shell.appbar}), no action bar (${shell.bars}), no sideways scroll (${shell.scroll})`);
  const dock = await p.evaluate(() => { const sam = document.querySelector('.menu-sam .sam-portrait')?.getBoundingClientRect(); const tile = document.querySelector('.menu-main .menu-deficit').getBoundingClientRect(); const bub = document.querySelector('.menu-sam-bubble'); return { onTile: sam ? Math.round(sam.bottom - tile.top) : null, right: sam ? Math.round(tile.right - sam.right) : null, frosted: bub ? getComputedStyle(bub).backdropFilter : null, strip: !!document.querySelector('.menu .sam-strip'), text: document.querySelector('.menu-sam-text')?.textContent }; });
  ok(dock.onTile > 0 && dock.onTile < 40 && dock.right < 30 && (dock.frosted === 'none' || !dock.frosted) && !dock.strip && /Welcome back/.test(dock.text), `Uncle Sam stands close up on this year’s deficit, at the right (overlap ${dock.onTile}px), with a plain bubble: “${(dock.text || '').slice(0, 40)}…”`);
  ok(await p.locator('.menu-foot, .menu-live, .menu-whatsnew').count() === 0 && !/Official data from/.test(await p.locator('main').textContent()), 'no corner links, What’s new card, or data line on the menu');
  // The deficit: red, with spending (blue) and revenue (green), adding up and ticking.
  await p.locator('.deficit').scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -120)); await p.waitForTimeout(700);
  const d1 = await p.evaluate(() => ({ def: document.querySelector('.deficit-num').textContent, sp: document.querySelector('[data-kind="spend"] .clock-tick').textContent, rv: document.querySelector('[data-kind="rev"] .clock-tick').textContent, cDef: getComputedStyle(document.querySelector('.deficit-num')).color, cSp: getComputedStyle(document.querySelector('[data-kind="spend"]')).color, cRv: getComputedStyle(document.querySelector('[data-kind="rev"]')).color, head: document.querySelector('.deficit .clock-label').textContent, year: [...document.querySelectorAll('.deficit-year div')].map((x) => x.textContent) }));
  await p.waitForTimeout(1300);
  const d2 = await p.locator('.deficit-num').textContent();
  const [r1, g1, b1] = rgb(d1.cDef), [r2, g2, b2] = rgb(d1.cSp), [r3, g3, b3] = rgb(d1.cRv);
  ok(r1 > g1 + 60 && b2 > r2 + 60 && g3 > r3 + 40, `colors: deficit ${d1.cDef}, spending ${d1.cSp}, revenue ${d1.cRv}`);
  ok(Math.abs(num(d1.sp) - num(d1.rv) - num(d1.def)) < 2e6 && num(d1.def) > 1e11 && num(d1.def) < 6e11 && num(d2) > num(d1.def), `${d1.head}: ${d1.def} = ${d1.sp} − ${d1.rv}, then ${d2}`);
  ok(d1.year.length === 2 && /share of the deficit\$[\d,]+/.test(d1.year[0]) && /Interest costs\$1\.36 trillion/.test(d1.year[1]), 'each year, two numbers: ' + d1.year.join(' · '));
  const src = await p.locator('.deficit-src').textContent(); const defNow = Number(d1.def.replace(/[^0-9]/g, ''));
  ok(/^Treasury daily figures through [A-Z][a-z]+ \d+, 20\d\d · The debt clock$/.test(src.trim()) && defNow > 380e9 && defNow < 520e9, `this year so far, from the Treasury’s daily figures: ${(defNow / 1e9).toFixed(0)} billion (“${src.slice(0, 60)}…”)`);

  // 2. Hub and spoke.
  for (const [h, sel, n, title] of [['#guide', '.guide-card', 12, 'You'], ['#levels', '.roadmap .stop', 16, null], ['#together', '.tcard', 3, 'Play together'], ['#daily', 'h1', 1, 'The Daily Dollar'], ['#overview', 'h1', 1, null]]) {
    await p.goto(base + h); await p.waitForTimeout(600);
    const T = await p.evaluate(() => ({ bar: document.querySelector('.hud-title')?.textContent ?? '', h1: [...document.querySelectorAll('main h1')].map((x) => ({ t: x.textContent, shown: x.getBoundingClientRect().width > 2 && getComputedStyle(x).position !== 'absolute' })), eyebrow: [...document.querySelectorAll('main .page-head .eyebrow')].length }));
    ok(await p.locator(sel).count() >= n && await p.locator('.backlink').count() === 0 && await p.locator('.appbar').count() === 1 && T.eyebrow === 0 && (!title || T.bar === title) && T.h1.length === 1 && (!title || !T.h1[0].shown),
      `${h}: the title in the top bar (${T.bar}), no small duplicate, no “Main menu” link; the page’s h1 is for screen readers`);
  }
  await p.goto(base + '#record'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => location.hash) === '#guide' && await p.locator('.rc-card').count() === 1, '#record goes to the Guide tab, where the record is on top');
  await p.goto(base + '#settings'); await p.waitForTimeout(900);
  const SB = await p.evaluate(() => { const st = document.getElementById('settings'); const ms = document.getElementById('missions'); const rc = document.querySelector('.rc-card'); const r = st?.getBoundingClientRect(); return { hash: location.hash, order: !!(st && ms && rc && (rc.compareDocumentPosition(st) & 4) && (st.compareDocumentPosition(ms) & 4)), top: r ? Math.round(r.top) : null, lit: document.querySelector('.tabbar a[aria-current="page"]')?.dataset.tab }; });
  ok(SB.hash === '#guide' && SB.order && SB.top != null && SB.top >= 0 && SB.top < 260 && SB.lit === 'guide', `Settings are on the You tab, after your record card and before Your missions; #settings scrolls to them (${SB.top}px from the top)`);
  ok(/On the main menu/.test(await p.locator('main').textContent()) && await p.locator('label.switch', { hasText: 'Music:' }).locator('input').isChecked(), 'Settings: music and the sounds of the Mall');
  await p.locator('.tabbar a[data-tab="menu"]').tap(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => location.hash) === '#journey', 'back to the main menu in one tap, from the tab bar');
  // The field guide holds Sources & methods; every chapter links to it.
  await p.goto(base + '#guide'); await p.waitForTimeout(500);
  ok(await p.locator('.guide-card[href="#sources"]').count() === 1 && await p.locator('.guide-card[href="#glossary"]').count() === 1, 'the field guide holds Sources & methods and the glossary');
  await p.goto(base + '#debt'); await p.waitForTimeout(600);
  ok(await p.locator('.chapter-banner a[href="#sources"]').count() === 1 && await p.locator('.chapter-banner a[href="#guide"]').count() === 1, 'a chapter links to the field guide and to Sources & methods');
  // How everyone played: charts, each with a table view.
  await p.goto(base + '#results'); await p.waitForTimeout(800);
  ok(await p.locator('.rfig').count() === 4 && await p.locator('.rcol').count() >= 20 && await p.locator('.rvote .segbar, .rvote .rvote-empty').count() >= 7 && await p.locator('.rdiv-row').count() === 10 && await p.locator('.chart-foot .link-btn').count() >= 3, 'results: figures, columns, vote bars, support/oppose rows, table views');
  await p.locator('.rcol').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator('.rcol').first().hover(); await p.waitForTimeout(300);
  ok(/Mission 1\.1/.test(await p.locator('.tooltip').textContent().catch(() => '')), 'a column’s tooltip: ' + (await p.locator('.tooltip').textContent().catch(() => 'none')).slice(0, 60));
  // The debt clock now speaks in years, with gross interest.
  await p.goto(base + '#clock'); await p.waitForTimeout(700);
  const stats = await p.$$eval('.clock-stat', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ')));
  ok(stats.length === 4 && stats.every((x) => /a year/.test(x)) && /part of the deficit/.test(stats[0]) && /gross/.test(stats[3]) && !/net interest/.test(stats.join(' ')), 'debt clock, a year at a time: ' + stats.join(' | '));

  // 3. On a wide screen.
  p = await mk({ viewport: { width: 1440, height: 900 } });
  await p.goto(base + '#journey'); await p.waitForTimeout(1200);
  const d = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const nav = r('.menu-main'); const cap = document.querySelector('.ms-capitol .ms-dome').getBoundingClientRect(); const tabs = r('.tabbar'); const first = r('.tabbar .tab'); const last = r('.tabbar .tab:last-child'); return { nav: [nav.left, nav.right, nav.bottom], tr: [r('.menu-tr').right, r('.menu-tr').top], def: [r('.menu-deficit').left, r('.menu-deficit').top, r('.menu-deficit').bottom], cap: [cap.left, cap.right, cap.top], tabTop: tabs.top, row: [first.left, last.right] }; });
  ok(d.nav[0] < 120 && d.nav[1] < 560 && d.def[0] < 120 && d.def[2] <= d.tabTop + 2, `Uncle Sam and the deficit on the left, the deficit clear of the tab bar (ends ${Math.round(d.def[2])}, tabs at ${Math.round(d.tabTop)})`);
  ok(d.tr[0] > 1300 && d.tr[1] < 80, 'top-right: the switches and your record');
  ok(d.cap[0] > d.nav[1] && d.cap[2] > 0, `the Capitol’s dome in clear view beside them (${d.cap.map(Math.round)})`);
  ok(d.row[0] > 300 && d.row[1] < 1140, `on a wide screen the tabs sit in a centered row (${Math.round(d.row[0])}–${Math.round(d.row[1])}px)`);
  // Music: on, then off and remembered.
  await p.mouse.click(700, 300); await p.waitForTimeout(3500);
  // Music and the sounds of the Mall are switched in Settings now.
  await p.locator('.menu-tr a[href="#settings"]').click(); await p.waitForTimeout(600);
  const mus = p.locator('label.switch', { hasText: 'Music:' }).locator('input'), amb = p.locator('label.switch', { hasText: 'Sounds of the Mall' }).locator('input');
  ok(await mus.isChecked() && !(await amb.isChecked()), 'Settings: music on by default, the sounds of the Mall off');
  await mus.click(); await amb.click(); await p.waitForTimeout(300);
  ok(await p.evaluate(() => localStorage.getItem('ftd:music')) === 'false' && await p.evaluate(() => localStorage.getItem('ftd:ambience')) === 'true', 'both switch in Settings, and are remembered');
  ok(await p.evaluate(() => location.hash) === '#guide' && await p.locator('#settings label.switch').count() >= 2, 'the main menu’s gear opens Settings on the You tab');
  await mus.click(); await amb.click();
  // The disclaimer: on the field guide and Your record only, not while playing.
  for (const [h, want] of [['#guide', true], ['#mall', false], ['#daily', false], ['#level-2', false]]) {
    await p.goto(base + h); await p.waitForTimeout(500);
    ok(/Independent civic education project/.test(await p.locator('body').innerText()) === want, `${h}: disclaimer ${want ? 'shown, at the bottom' : 'not shown'}`);
  }

  // 4. Night, less motion, a first visit.
  p = await mk({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  ok(await p.locator('.ms-moon').evaluate((e) => getComputedStyle(e).opacity) === '1', 'dark theme: night, with the moon out');
  p = await mk({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  ok(await p.locator('.ms-drift').first().evaluate((e) => getComputedStyle(e).animationName) === 'none', 'less motion: the scene holds still');
  p = await mk({ ...devices['iPhone 13'] }, J({ done: [], stars: {}, started: null }));
  await p.goto(base + '#journey'); await p.waitForTimeout(900);
  ok(await p.locator('.tabbar a[data-tab="mission"] .tab-label').textContent() === 'Roadmap' && await p.locator('.tabbar a[data-tab="mission"]').getAttribute('href') === '#levels' && /Howdy/.test(await p.locator('.menu-sam-text').textContent()), 'first visit: the Roadmap tab opens the road map, and Uncle Sam’s hello');
  // Every tab goes to its screen and is lit there; it stays in missions too.
  for (const [id, hash] of [['daily', '#daily'], ['together', '#together'], ['guide', '#guide'], ['menu', '#journey']]) {
    await p.locator(`.tabbar a[data-tab="${id}"]`).tap(); await p.waitForTimeout(700);
    const lit = await p.evaluate(() => [...document.querySelectorAll('.tabbar a[aria-current="page"]')].map((a) => a.dataset.tab));
    ok(await p.evaluate(() => location.hash) === hash && lit.join() === id, `the ${id} tab opens ${hash} and is lit there`);
  }
  // With a first name given, it takes the place of "You" on the tab and atop the page.
  await p.evaluate(() => localStorage.setItem('ftd:name', JSON.stringify('Alexandria')));
  await p.goto(base + '#guide'); await p.waitForTimeout(700);
  const nm = await p.evaluate(() => ({ tab: document.querySelector('.tabbar a[data-tab="guide"] .tab-label').textContent, bar: document.querySelector('.hud-title').textContent }));
  ok(nm.tab === 'Alexandria' && nm.bar === 'Alexandria', `a first name replaces “You”: tab “${nm.tab}”, top bar “${nm.bar}”`);
  await p.evaluate(() => localStorage.removeItem('ftd:name')); await p.reload(); await p.waitForTimeout(600);
  ok(await p.locator('.tabbar a[data-tab="guide"] .tab-label').textContent() === 'You', 'without one, it says You');
  for (const [hash, id] of [['#rooms', 'together'], ['#debt', 'guide'], ['#sources', 'guide'], ['#levels', 'mission']]) {
    await p.goto(base + hash); await p.waitForTimeout(600);
    ok((await p.evaluate(() => document.querySelector('.tabbar a[aria-current="page"]')?.dataset.tab)) === id, `${hash} lights the ${id} tab`);
  }
  await p.goto(base + '#mall'); await p.waitForTimeout(700);
  const stack = await p.evaluate(() => { const a = [...document.querySelectorAll('.actionbar')].find((e) => getComputedStyle(e).display !== 'none').getBoundingClientRect(); const t = document.querySelector('.tabbar').getBoundingClientRect(); return { gap: Math.round(t.top - a.bottom), tabBottom: Math.round(innerHeight - t.bottom) }; });
  ok(Math.abs(stack.gap) <= 2 && stack.tabBottom === 0, `a screen’s own action bar sits right on the tab bar (gap ${stack.gap}px)`);
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  await p.locator('.tabbar a[data-tab="mission"]').tap(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => location.hash) === '#levels' && /^Start$/i.test(await p.locator('.stop[data-next="true"] .rp-bubble').innerText()), 'the Roadmap tab opens the road map at the stop to start');
  await p.locator('.stop[data-next="true"] .stop-btn').tap(); await p.waitForTimeout(300); await p.locator('.rp-card-go').tap(); await p.waitForTimeout(900);
  const ms = await p.evaluate(() => { const t = document.querySelector('.tabbar'); const a = [...document.querySelectorAll('.actionbar')].find((e) => getComputedStyle(e).display !== 'none'); return { tab: !!t, lit: t?.querySelector('[aria-current="page"]')?.dataset.tab, gap: t && a ? Math.round(t.getBoundingClientRect().top - a.getBoundingClientRect().bottom) : null, bar: document.querySelector('.hud-title')?.textContent }; });
  ok(await p.evaluate(() => location.hash) === '#level-1' && ms.tab && ms.lit === 'mission' && Math.abs(ms.gap) <= 2 && await p.locator('.level-nav .btn-primary').count() === 1 && ms.bar === 'Mission 1.1', `in a mission the tab bar stays (Roadmap lit), the step’s Back / Continue right on it (gap ${ms.gap}px), and the top bar says ${ms.bar}`);

  // In a mission, "Mission 1.1" opens the road map in the top bar.
  const fs = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.hud-title')).fontSize));
  await p.locator('.hud-title-btn').click(); await p.waitForTimeout(300);
  const rm = await p.evaluate(() => ({ camps: document.querySelectorAll('#pop-levels .ab-ll-camp').length, rows: document.querySelectorAll('#pop-levels .ab-levellist > li:not(.ab-ll-camp)').length, here: !!document.querySelector('#pop-levels li[data-here="true"] a[href="#level-1"]'), full: !!document.querySelector('#pop-levels a[href="#levels"]') }));
  ok(fs >= 24 && rm.camps === 3 && rm.rows === 21 && rm.here && rm.full, `the mission title (${fs}px) opens the road map: 3 campaigns, 21 missions, this one marked, and the full road map a tap away`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(await p.locator('#pop-levels').count() === 0, 'Escape closes it');

  // 5. Uncle Sam lives in the top bar's middle, always there; his line runs across the strip and
  // nothing covers the step, so Continue moves on at once.
  p = await mk({ ...devices['iPhone 13'] }, J({ done: ['level-1'] }));
  await p.goto(base + '#level-2'); await p.waitForSelector('.level-stage'); await p.waitForTimeout(700);
  const hud = await p.evaluate(() => { const bar = document.querySelector('.appbar').getBoundingClientRect(); const sam = document.querySelector('.appbar .sam-portrait-hud')?.getBoundingClientRect(); const strip = document.querySelector('.appbar .sam-strip')?.getBoundingClientRect(); return { left: sam ? Math.round(sam.left) : null, beside: !!(sam && strip && strip.left >= sam.right - 1 && strip.bottom <= bar.bottom), inBar: sam ? sam.top >= bar.top && sam.bottom <= bar.bottom : false, rows: [...document.querySelectorAll('.hud-left .hud-title, .hud-right .hud-row')].length - 1, dock: !!document.querySelector('.samdock'), h: Math.round(bar.height) }; });
  ok(hud.inBar && hud.left <= 30 && hud.beside && hud.rows === 1 && !hud.dock && hud.h <= 134, `top bar: Uncle Sam at the left (${hud.left}px in), his words beside him as the second line, ${hud.h}px tall, no dock`);
  const sx1 = await p.locator('.sam-strip-run').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41).catch(() => null); await p.waitForTimeout(1500);
  const sx2 = await p.locator('.sam-strip-run').evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).m41).catch(() => null);
  ok(sx1 != null && sx2 != null && sx2 < sx1 - 20, `his line runs across the strip (${Math.round(sx1)} → ${Math.round(sx2)}px)`);
  const primary = p.locator('.level-nav .btn-primary');
  const label = (await primary.textContent()).trim(); const step0 = await p.locator('#step-label').textContent();
  await primary.tap(); await p.waitForTimeout(500);
  ok(!/Skip this narrative/.test(label) && (await p.locator('#step-label').textContent()) !== step0, `Continue moves on at once (“${label}”)`);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('sam-act', { detail: 'flag' }))); await p.waitForTimeout(300);
  ok(await p.locator('.sam-portrait-hud .sam').getAttribute('data-act') === 'flag' && await p.locator('.sam-portrait-hud .sam-flag').count() === 1, 'an idle habit: he waves a little flag');
  // A finished level's pop-up opens under the bar, and he cheers from it.
  p = await mk({ ...devices['iPhone 13'] }, J({ done: [] }));
  await p.goto(base + '#level-1'); await p.waitForSelector('.level-stage'); await p.waitForTimeout(400);
  for (let k = 0; k < 40 && !(await p.locator('.celebrate').count()); k++) {
    const btn = p.locator('.level-nav .btn-primary');
    if (!(await btn.isEnabled()) && await p.locator('.quiz-card').count()) { await answerAny(p, true); continue; }
    await btn.tap(); await p.waitForTimeout(300);
  }
  await p.waitForTimeout(1000);
  const cel = await p.evaluate(() => { const box = document.querySelector('.celebrate').getBoundingClientRect(); const bar = document.querySelector('.appbar').getBoundingClientRect(); const top = document.elementFromPoint(innerWidth / 2, bar.top + 20); return { inside: document.querySelectorAll('.celebrate .samsays').length, barOnTop: !!top?.closest('.appbar'), below: box.top >= bar.bottom - 1, mood: document.querySelector('.sam-portrait-hud .sam')?.dataset.mood, text: document.querySelector('.sam-strip .sr-only')?.textContent }; });
  ok(cel.inside === 0 && cel.barOnTop && cel.below && cel.mood === 'cheering', `mission complete: the pop-up opens under the bar, Uncle Sam cheering in it (“${(cel.text || '').slice(0, 30)}…”)`);

  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();

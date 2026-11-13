// The installed app: the manifest (orientation, launch, shortcuts, screenshots) and its images,
// the page's head, the status bar following the theme, touch polish, no pull-to-refresh when
// installed, launches into the open window; and the main menu's rounded buttons and Uncle Sam.
const __OUT = require('path').join(__dirname, 'out'); // screenshots and other output (git-ignored)
for (const d of ['', 'm', 'duel', 'dock']) require('fs').mkdirSync(require('path').join(__OUT, d), { recursive: true });
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const out = __OUT + '/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const J = (theme = 'system') => JSON.stringify({ v: 2, done: ['level-1'], stars: { 'level-1': 3 }, steps: {}, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: [], built: [], decor: [], settings: { theme, freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts, theme) => { const ctx = await b.newContext(opts); await ctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J(theme)); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };

  // 1. The manifest and its images.
  let p = await mk({ viewport: { width: 1280, height: 800 } });
  await p.goto(base + '#journey'); await p.waitForTimeout(1000);
  const M = await p.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const m = await (await fetch(href)).json();
    const url = (s) => new URL(s, href).href;
    const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = url(src); });
    const shots = await Promise.all(m.screenshots.map(async (s) => ({ ...s, got: await load(s.src) })));
    const sc = await Promise.all(m.shortcuts.map(async (s) => ({ name: s.name, url: s.url, got: await load(s.icons[0].src) })));
    return { m, shots, sc };
  });
  ok(M.m.display === 'standalone' && M.m.orientation === 'natural' && M.m.lang === 'en-US' && M.m.scope === './' && M.m.id === './', `manifest: standalone, held its natural way up (${M.m.orientation}), en-US`);
  ok(JSON.stringify(M.m.launch_handler) === JSON.stringify({ client_mode: ['focus-existing', 'auto'] }), 'manifest: reopening brings back the open window (launch_handler)');
  ok(/21 short missions/.test(M.m.description), 'manifest: an up-to-date description, for the install dialog');
  ok(M.sc.length === 4 && M.sc.every((s) => s.got && s.got[0] === 96) && M.sc.map((s) => s.url).join() === './#journey,./#daily,./#mall,./#together', 'four home-screen shortcuts, each with its icon: ' + M.sc.map((s) => s.name).join(', '));
  const narrow = M.shots.filter((s) => s.form_factor === 'narrow'), wide = M.shots.filter((s) => s.form_factor === 'wide');
  ok(narrow.length >= 1 && narrow.length <= 5 && wide.length >= 1 && M.shots.every((s) => s.got && `${s.got[0]}x${s.got[1]}` === s.sizes && s.label), `install screenshots: ${narrow.length} for phones and ${wide.length} for computers, each the size it says and labeled`);
  ok(M.shots.every((s) => { const [w, h] = s.got; return Math.max(w, h) / Math.min(w, h) <= 2.3; }) && new Set(narrow.map((s) => s.sizes)).size === 1 && new Set(wide.map((s) => s.sizes)).size === 1, 'each set shares one shape, no longer than 2.3 to 1');

  // 2. The head.
  const H = await p.evaluate(() => ({
    tc: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m.media, m.content]),
    cs: document.querySelector('meta[name="color-scheme"]')?.content, fd: document.querySelector('meta[name="format-detection"]')?.content,
    apple: !!document.querySelector('link[rel="apple-touch-icon"]') && document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  }));
  ok(H.tc.length === 2 && H.tc.some(([m]) => /light/.test(m)) && H.tc.some(([m]) => /dark/.test(m)), 'the status bar color: one for light, one for dark');
  ok(H.cs === 'light dark' && H.fd === 'telephone=no' && H.apple === 'Uncle Sam', 'color-scheme, no phone-number links, and the home-screen icon and title');

  // 3. The status bar follows the theme picked in Settings.
  const tcNow = () => p.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content).join());
  ok(await tcNow() === '#f2f4ef,#0b100e', 'with the device’s theme: light and dark colors');
  await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('ftd:journey')); j.settings.theme = 'dark'; localStorage.setItem('ftd:journey', JSON.stringify(j)); }); await p.reload(); await p.waitForTimeout(700);
  ok(await tcNow() === '#0b100e,#0b100e', 'the dark theme picked: the status bar goes dark');
  await p.evaluate(() => { const j = JSON.parse(localStorage.getItem('ftd:journey')); j.settings.theme = 'light'; localStorage.setItem('ftd:journey', JSON.stringify(j)); }); await p.reload(); await p.waitForTimeout(700);
  ok(await tcNow() === '#f2f4ef,#f2f4ef', 'the light theme picked: light');
  await p.context().close();

  // 4. A launch into the open window goes to its page without a reload.
  const lctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  // Chrome has its own (read-only) launchQueue; stand in for it so a launch can be sent.
  await lctx.addInitScript(() => { Object.defineProperty(window, 'launchQueue', { configurable: true, value: { setConsumer(f) { window.__launch = f; } } }); });
  await lctx.addInitScript((j) => { if (!localStorage.getItem('ftd:journey')) localStorage.setItem('ftd:journey', j); }, J());
  p = await lctx.newPage();
  await p.goto(base + '#journey'); await p.waitForTimeout(800);
  await p.evaluate(() => { window.__still = 1; });
  await p.evaluate((u) => window.__launch({ targetURL: u }), base + '#daily'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => location.hash) === '#daily' && await p.evaluate(() => window.__still) === 1, 'a shortcut opens its page in the window already open (no reload)');
  await p.evaluate((u) => window.__launch({ targetURL: u }), base); await p.waitForTimeout(300);
  ok(await p.evaluate(() => location.hash) === '#daily', 'reopening the app from its icon stays where the player was');
  await lctx.close();

  // 5. Touch polish on a phone: no tap flash; controls aren't selected by a held finger; text is.
  p = await mk({ ...devices['Pixel 7'] });
  await p.goto(base + '#level-2'); await p.waitForTimeout(1000);
  const T = await p.evaluate(() => ({
    hl: getComputedStyle(document.documentElement).webkitTapHighlightColor,
    btn: getComputedStyle(document.querySelector('.actionbar .btn, button')).userSelect,
    hud: getComputedStyle(document.querySelector('header.hud')).userSelect,
  }));
  await p.goto(base + '#sources'); await p.waitForTimeout(900);
  const textSel = await p.evaluate(() => getComputedStyle(document.querySelector('main p')).userSelect);
  ok(/rgba\(0, 0, 0, 0\)|transparent/.test(T.hl) && T.btn === 'none' && T.hud === 'none' && textSel !== 'none', `phone: no tap flash (${T.hl}); buttons and the top bar aren’t selectable (${T.btn}, ${T.hud}); reading text is (${textSel})`);
  // Installed: no pull-to-refresh or bounce. (Chrome's media emulation can't switch on the
  // installed display mode, so check the rule itself, and that a browser tab keeps its own.)
  const rule = await p.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
    .filter((x) => x.media && /\(display-mode: standalone\)/.test(x.media.mediaText)).map((x) => x.cssRules[0]?.cssText).join(' '));
  const tab = await p.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY);
  ok(/html, body \{ overscroll-behavior: none; \}/.test(rule) && tab === 'auto', `installed: no pull-to-refresh or bounce (${rule}); in a browser tab it's left alone (${tab})`);
  await p.context().close();

  // 6. The main menu: rounded rectangles at the top right; Uncle Sam shows his coat.
  for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['phone', { ...devices['iPhone 13'] }]]) {
    p = await mk(opts);
    await p.goto(base + '#journey'); await p.waitForTimeout(1600);
    const R = await p.evaluate(() => {
      const r = (e) => getComputedStyle(e).borderRadius;
      const sam = document.querySelector('.sam-portrait-menu svg.sam'); const sb = sam.getBoundingClientRect();
      const card = document.querySelector('.menu-main .menu-deficit').getBoundingClientRect();
      return { mall: r(document.querySelector('.menu-tr .menu-mall')), toggles: [...document.querySelectorAll('.menu-tr .menu-toggle')].map(r), vb: sam.getAttribute('viewBox'), shown: (card.top - sb.top) / sb.height, h: Math.round(sb.height) };
    });
    ok(R.toggles.length === 1 && R.toggles[0] === '12px' && R.mall === '12px', `${name}: the top-right Settings and Mall buttons are rounded rectangles (${R.toggles.join(', ')}, ${R.mall})`);
    ok(R.vb === '0 0 120 150' && R.shown > 0.93, `${name}: Uncle Sam stands up out of the deficit card, his coat, bow tie and whole arm showing (${Math.round(R.shown * 100)}% of him above it, ${R.h}px tall)`);
    await p.screenshot({ path: out + `appmode-menu-${name}.png` });
    await p.context().close();
  }
  ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });

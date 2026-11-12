// Draws the launch screens an iPhone shows while the installed app opens, with the dev server up:
//   npx vite --port 5173 &  node scripts/make-launch-images.mjs http://localhost:5173/
// iOS needs one image per screen, at the screen's exact size in pixels, picked by a media query
// on the device's width, height and pixel ratio (and the light or dark setting). Each is the main
// menu's own scene with the whole Mall built (a golden morning in light, a floodlit night in dark),
// with Uncle Sam and the title, so the opening flows straight into the menu. Writes
// public/launch/*.jpg and the matching <link rel="apple-touch-startup-image"> tags into index.html,
// between the launch-images markers. Portrait only: launched sideways, iOS shows the app's
// background color instead.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dir = path.join(root, 'public', 'launch');
mkdirSync(dir, { recursive: true });

// Every iPhone screen in use, in portrait: CSS width × height and pixel ratio (some share one).
const SCREENS = [
  [320, 568, 2, 'iPhone SE (1st gen), 5s'],
  [375, 667, 2, 'iPhone SE (2nd and 3rd gen), 8, 7, 6s'],
  [414, 736, 3, 'iPhone 8 Plus, 7 Plus'],
  [375, 812, 3, 'iPhone X, XS, 11 Pro, 12 mini, 13 mini'],
  [414, 896, 2, 'iPhone XR, 11'],
  [414, 896, 3, 'iPhone XS Max, 11 Pro Max'],
  [390, 844, 3, 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e'],
  [428, 926, 3, 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus'],
  [393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'],
  [430, 932, 3, 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus'],
  [402, 874, 3, 'iPhone 16 Pro, 17, 17 Pro'],
  [440, 956, 3, 'iPhone 16 Pro Max, 17 Pro Max'],
  [420, 912, 3, 'iPhone Air'],
];

const b = await chromium.launch();
// The whole Mall built, so the skyline stands complete; no sound, nothing moving.
const ctx0 = await b.newContext();
const p0 = await ctx0.newPage();
await p0.goto(base + '#sources');
await p0.waitForTimeout(500);
const all = await p0.evaluate(async () => (await import('/src/game/build/landmarks.ts')).ALL_TASKS.map((t) => t.id));
await ctx0.close();

const links = [];
for (const theme of ['light', 'dark']) {
  for (const [w, h, r, names] of SCREENS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r, isMobile: true, hasTouch: true, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript(([j]) => { localStorage.setItem('ftd:journey', j); localStorage.setItem('ftd:music', 'false'); }, [JSON.stringify({ v: 2, done: [], stars: {}, steps: {}, quiz: {}, choices: {}, started: null, marks: [], medals: [], built: all, decor: [], settings: { theme, freeRoam: false, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 } })]);
    const p = await ctx.newPage();
    await p.goto(base + '#journey');
    await p.waitForSelector('.menu-scene svg');
    await p.waitForSelector('.sam-portrait-menu svg.sam');
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    // The launch screen: the menu's scene behind; Uncle Sam and the title in the middle.
    await p.evaluate(() => {
      const scene = document.querySelector('.menu-scene').cloneNode(true);
      const sam = document.querySelector('.sam-portrait-menu svg.sam').cloneNode(true);
      sam.removeAttribute('width'); sam.removeAttribute('height');
      const s = document.createElement('div');
      s.className = 'launch';
      s.innerHTML = '<div class="launch-title">Help Uncle Sam <span>Balance the Budget</span></div><div class="launch-sam"></div>';
      s.prepend(scene);
      s.querySelector('.launch-sam').appendChild(sam);
      // The scene's gradients are found by id: take the menu itself away so the copy's are used.
      document.getElementById('root').remove();
      document.body.appendChild(s);
      const st = document.createElement('style');
      st.textContent = `
        .launch { position: fixed; inset: 0; overflow: hidden; background: var(--paper); z-index: 100; }
        .launch .menu-scene { position: absolute; inset: 0; left: 0; width: 100%; height: 100% !important; transform: none; z-index: 0; }
        .launch .menu-scene::after { display: none; }
        .launch .menu-scene svg { width: 100%; height: 100%; }
        /* the title in the sky; Uncle Sam at the bottom, in front of the Mall */
        .launch-title { position: absolute; left: 0; right: 0; top: 11%; z-index: 1; font-family: var(--font-display); font-weight: 800; text-transform: uppercase; text-align: center; line-height: 0.95; font-size: min(12.5vw, 58px); color: var(--ink); letter-spacing: 0.005em; text-shadow: 0 1px 0 color-mix(in srgb, var(--paper) 60%, transparent); }
        .launch-sam { position: absolute; left: 50%; bottom: 0; width: 62%; transform: translateX(-50%); z-index: 1; filter: drop-shadow(0 -6px 22px rgba(0,0,0,0.22)); }
        .launch-sam svg { width: 100%; height: auto; display: block; }
        .launch-title span { display: block; color: var(--accent); }
        .launch * { animation: none !important; transition: none !important; }
        .toasts, .ts-box { display: none !important; }`;
      document.head.appendChild(st);
    });
    await p.waitForTimeout(250);
    const file = `launch-${w * r}x${h * r}-${theme}.jpg`;
    await p.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 84 });
    const media = `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`;
    links.push(`    <!-- ${names}, ${theme} --><link rel="apple-touch-startup-image" media="${media}" href="./launch/${file}" />`);
    console.log('wrote', file);
    await ctx.close();
  }
}
await b.close();

// The tags, between the markers in index.html.
const html = path.join(root, 'index.html');
const src = readFileSync(html, 'utf8');
const start = '    <!-- launch-images:start (scripts/make-launch-images.mjs) -->', end = '    <!-- launch-images:end -->';
const block = [start, ...links, end].join('\n');
const out = src.includes(start) ? src.replace(new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), block) : src.replace('    <link rel="apple-touch-icon"', `${block}\n    <link rel="apple-touch-icon"`);
writeFileSync(html, out);
console.log(`${links.length} launch screens; index.html updated`);

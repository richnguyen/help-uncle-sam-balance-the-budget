// Draws the installed app's extra images, with the dev server up:
//   npx vite --port 5173 &  node scripts/make-app-images.mjs http://localhost:5173/
// Writes public/icons/shortcut-*.png (96 px, the icons for the home-screen shortcuts in the
// manifest) and public/screens/*.jpg (the screenshots Chrome shows in its install dialog: four
// "narrow" ones for phones at 824×1648 and three "wide" ones for computers at 1280×720; each set
// shares one shape, as Chrome asks).
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(path.join(root, 'screens'), { recursive: true });

const b = await chromium.launch();

// The shortcut icons: the main menu's own icons, white on the app's green.
const ICONS = {
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z" fill="#fff"/>',
  daily: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M12 12.5v5M10 14h3.2a1.3 1.3 0 0 1 0 2.6H10.6"/>',
  build: '<path d="M3.5 9 12 4l8.5 5"/><path d="M4.5 9.5h15M6.5 10.5v7M10 10.5v7M14 10.5v7M17.5 10.5v7M3.5 20h17M4.5 17.8h15"/>',
  together: '<circle cx="8.5" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M14 14.3c.8-.4 1.6-.6 2.5-.6 2.2 0 4 1.5 4.5 4.3"/>',
};
const ip = await b.newPage({ viewport: { width: 96, height: 96 } });
for (const [name, paths] of Object.entries(ICONS)) {
  await ip.setContent(`<body style="margin:0"><div style="width:96px;height:96px;display:grid;place-items:center;background:radial-gradient(circle at 50% 38%, #2a7a5c 0%, #1d5a43 62%, #154533 100%)">
    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></div></body>`);
  await ip.screenshot({ path: path.join(root, 'icons', `shortcut-${name}.png`), clip: { x: 0, y: 0, width: 96, height: 96 } });
  console.log('wrote', `icons/shortcut-${name}.png`);
}

// The screenshots: a player some way in, with Uncle Sam's voice off and no pop-ups.
const stars = { 'level-1': 3, 'level-2': 2, 'level-spend': 3, 'level-3': 2, 'level-4': 3, 'level-economy': 2, 'level-6': 2 };
const state = (extra = {}) => JSON.stringify({ v: 2, done: Object.keys(stars), stars, steps: { 'level-rules': [0] }, quiz: {}, choices: {}, started: '2026-11-01', marks: [], medals: ['first-steps', 'first-vote'], built: ['monument:grounds', 'monument:foundation', 'monument:shaft1', 'monument:shaft2'], decor: [], settings: { theme: 'light', freeRoam: true, narration: false, voice: 'off', sounds: false, haptics: false, voiceV: 2 }, ...extra });
const shots = [
  ['narrow-menu', '#journey'], ['narrow-game', '#level-rules'], ['narrow-mall', '#mall-monument'], ['narrow-desk', '#level-5'],
  ['wide-menu', '#journey'], ['wide-mall', '#mall'], ['wide-game', '#level-rules'],
];
for (const [name, hash] of shots) {
  const narrow = name.startsWith('narrow');
  const ctx = await b.newContext(narrow
    ? { viewport: { width: 412, height: 824 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((j) => { localStorage.setItem('ftd:journey', j); localStorage.setItem('ftd:music', 'false'); }, state());
  const p = await ctx.newPage();
  await p.goto(base + hash);
  await p.waitForTimeout(2600);
  await p.addStyleTag({ content: '.toasts, .ts-box { display: none !important; } *, *::before, *::after { animation-play-state: paused !important; caret-color: transparent !important; }' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(root, 'screens', `${name}.jpg`), type: 'jpeg', quality: 82 });
  console.log('wrote', `screens/${name}.jpg`);
  await ctx.close();
}
await b.close();

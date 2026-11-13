// The iPhone launch screens: every one exists at its screen's exact pixel size, and each iPhone,
// light or dark, matches exactly one (the one its size), the way iOS picks it.
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:5173/';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  // 1. The tags and their images.
  let p = await (await b.newContext()).newPage();
  await p.goto(base); await p.waitForTimeout(800);
  const L = await p.evaluate(async () => Promise.all([...document.querySelectorAll('link[rel="apple-touch-startup-image"]')].map(async (l) => {
    const m = l.media.match(/device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\) and \(prefers-color-scheme: (light|dark)\)/);
    const img = await new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res(null); i.src = l.href; });
    const r = await fetch(l.href); const bytes = (await r.arrayBuffer()).byteLength;
    return { href: l.getAttribute('href'), m: m && m.slice(1), img, bytes, type: r.headers.get('content-type') };
  })));
  ok(L.length === 26 && L.every((x) => x.m), `26 launch screens: 13 iPhone screens, light and dark (${L.length})`);
  ok(L.every((x) => x.img && x.img[0] === +x.m[0] * +x.m[2] && x.img[1] === +x.m[1] * +x.m[2]), 'each image is its screen’s exact size in pixels');
  ok(L.every((x) => /image\/jpeg/.test(x.type) && x.bytes < 200 * 1024), `JPEGs, the largest ${Math.round(Math.max(...L.map((x) => x.bytes)) / 1024)} KB (a phone downloads only its own)`);
  ok(new Set(L.map((x) => x.m.join())).size === 26, 'no two tags for the same screen and theme');
  await p.context().close();
  // 2. Each iPhone picks exactly one, its own size, in light and in dark.
  const phones = Object.keys(devices).filter((d) => /^iPhone/.test(d) && !/landscape/.test(d));
  const seen = [];
  let bad = [];
  for (const d of phones) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ ...devices[d], colorScheme: scheme });
    p = await ctx.newPage();
    await p.goto(base); await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ hits: [...document.querySelectorAll('link[rel="apple-touch-startup-image"]')].filter((l) => matchMedia(l.media).matches).map((l) => l.getAttribute('href')), px: [screen.width * devicePixelRatio, screen.height * devicePixelRatio] }));
    const want = `${r.px[0]}x${r.px[1]}-${scheme}`;
    if (r.hits.length !== 1 || !r.hits[0].includes(want)) bad.push(`${d} ${scheme}: ${r.hits.join(',') || 'none'} (want ${want})`);
    seen.push(d);
    await ctx.close();
  }
  // Older phones this list may lack screens for (iOS 26 runs on the iPhone 11 and later).
  const old = bad.filter((x) => /iPhone (4|5|6|7|8|SE \(1st|SE$)/.test(x));
  bad = bad.filter((x) => !old.includes(x));
  ok(!bad.length, `every iPhone Chrome can emulate (${new Set(seen).size}) matches exactly its own launch screen, light and dark${bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''}`);
  if (old.length) console.log('note: older phones without a launch screen of their own:', [...new Set(old.map((x) => x.split(' light')[0].split(' dark')[0]))].join(', '));
  await b.close();
})().catch((e) => { console.log('FAIL crashed:', e.message.split('\n')[0]); process.exit(1); });

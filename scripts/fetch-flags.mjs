// State and territory flags, as a plain geographic marker beside every lawmaker the game names
// (bill sponsors, and members in floor votes): the same small flag for everyone from a state.
// From Wikimedia Commons, with each file's license and author recorded for the Sources page.
//
//   node scripts/fetch-flags.mjs   → public/flags/XX.png (72 px wide) + src/data/generated/flags.json
//
// Run rarely (flags change about once a decade). Wikimedia asks for a descriptive User-Agent and a
// gentle pace, so requests go one at a time with a pause, and back off if told to slow down.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'BalanceTheBudget-flags/1.0 (educational game; https://balancethebudget.us)';
const NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia (U.S. state)', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'the District of Columbia', PR: 'Puerto Rico', GU: 'Guam',
  VI: 'the United States Virgin Islands', AS: 'American Samoa', MP: 'the Northern Mariana Islands',
};
const file = (abbr) => `Flag of ${NAMES[abbr]}.svg`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, kind) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.ok) return kind === 'json' ? r.json() : Buffer.from(await r.arrayBuffer());
    if (r.status !== 429 && r.status < 500) throw new Error(`${r.status} ${url}`);
    await sleep(5000 * 2 ** i);
  }
  throw new Error(`gave up: ${url}`);
}

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Licenses and authors, 50 files a query.
const abbrs = Object.keys(NAMES);
const meta = {};
for (let i = 0; i < abbrs.length; i += 50) {
  const batch = abbrs.slice(i, i + 50);
  const q = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '120', redirects: '1',
    iiextmetadatafilter: 'LicenseShortName|Artist|DateTimeOriginal', titles: batch.map((a) => 'File:' + file(a)).join('|'),
  });
  const j = await get('https://commons.wikimedia.org/w/api.php?' + q, 'json');
  const back = {}; for (const n of [...(j.query.normalized ?? []), ...(j.query.redirects ?? [])]) back[n.to] = back[n.from] ?? n.from;
  for (const p of j.query.pages) {
    const asked = new Set([p.title]); for (let t = p.title; back[t]; t = back[t]) asked.add(back[t]);
    const a = batch.find((x) => asked.has('File:' + file(x)));
    if (!a || p.missing) throw new Error('missing on Commons: ' + p.title);
    const ii = p.imageinfo[0], em = ii.extmetadata ?? {};
    meta[a] = { file: p.title.replace(/^File:/, ''), thumb: ii.thumburl, page: ii.descriptionurl, license: strip(em.LicenseShortName?.value) || 'see file page', author: strip(em.Artist?.value) || 'see file page' };
  }
  await sleep(1500);
}

// The images: Commons' own 120 px rendering, scaled to 72 px wide (24 CSS px at 3×).
mkdirSync('public/flags', { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'flags-'));
for (const a of abbrs) {
  // Commons now names a thumb.wikimedia.org host; the same path is served from upload.wikimedia.org.
  const url = meta[a].thumb.replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/').replace(/\?.*$/, '');
  delete meta[a].thumb;
  const src = join(tmp, a + '.png');
  writeFileSync(src, await get(url));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-vf', 'scale=72:-1:flags=lanczos', '-pix_fmt', 'rgba', `public/flags/${a}.png`]);
  process.stdout.write(a + ' ');
  await sleep(400);
}
rmSync(tmp, { recursive: true, force: true });
writeFileSync('src/data/generated/flags.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: 'Wikimedia Commons', flags: meta }, null, 1) + '\n');
console.log(`\n${abbrs.length} flags → public/flags, credits → src/data/generated/flags.json`);

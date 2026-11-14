#!/usr/bin/env node
// The browser test suite (Playwright, against the Vite dev server). Faster three ways:
//   1. Parallel: tests run on N workers (default 3), longest first, against one dev server.
//      Anything that fails under load is re-run once on its own, so a timing flake is reported
//      as "flaky", not as a failure.
//   2. Tiers: quick (the default) runs eight smoke tests in about 1.5 minutes; --tier full runs all.
//   3. Change-gated: in a full run, the three slowest tests that guard slow-changing areas (launch
//      screens, the mission games, the budget desks) run only when files in their area changed
//      since the last full run that passed on this machine. --all runs them anyway.
//
//   npm run test:e2e                 the quick tier
//   npm run test:e2e:full            everything (with the change-gated skips)
//   node tests/e2e/run.mjs [--tier quick|full] [--jobs N] [--all] [--only a,b] [--no-server] [--plan]
//   --plan prints what would run (and what is skipped, and why) without running anything.
//
// Needs Playwright with Chromium (require('playwright') must resolve). Writes tests/e2e/.runs/
// (<test>.log, summary.txt, durations.json, last-full-pass.txt) and screenshots to tests/e2e/out/.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(DIR, '../..');
const RUNS = join(DIR, '.runs');
mkdirSync(RUNS, { recursive: true });
const PORT = 5173; // the tests expect the dev server here

// Areas for the change-gated tests: a path prefix that, when touched, means the test must run.
const DATA = ['src/data/', 'src/lib/', 'package.json', 'vite.config.ts'];
const GATES = {
  launch: ['public/launch/', 'scripts/make-launch-images.mjs', 'index.html', 'public/manifest.webmanifest'],
  mgames: ['src/game/minigame.tsx', 'src/game/levels.tsx', 'src/game/LevelPage.tsx', 'src/game/rounds.tsx', 'src/game/rounds2.tsx', 'src/game/concepts.tsx',
    'src/game/guesses.tsx', 'src/game/sims.tsx', 'src/game/process.tsx', 'src/game/yardstick.tsx', 'src/game/county.tsx', 'src/game/state.tsx', 'src/game/medals.ts', ...DATA],
  nohint: ['src/pages/Sandbox.tsx', 'src/game/ideas.tsx', 'src/game/DeskExtras.tsx', 'src/game/Rated.tsx', 'src/game/state.tsx', 'src/game/plans.ts',
    'src/components/game.tsx', ...DATA],
};
const QUICK = ['check', 'cardfit', 'deskui', 'feed', 'zip', 'quick', 'seal', 'voicecheck'];
// Every test (one file each in this folder), with its usual time in seconds on 3 workers, which
// seeds the longest-first schedule until this machine has timed its own runs.
const SEED = {"check": 24, "viral": 40, "chain-test": 47, "rooms-test": 24, "peoples-local": 54, "stats-test": 43, "voicecheck": 2, "nohint": 199, "guess": 17, "hint5": 8, "themes-ui": 16, "dueltest": 82, "menutest": 64, "newfeat": 43, "campaigns": 29, "sims": 34, "sims2": 80, "mgames": 234, "process": 34, "zip": 79, "county": 72, "yardstick": 64, "hudshot": 17, "mline": 42, "build": 71, "nozoom": 21, "appmode": 17, "launch": 102, "samarm": 8, "seal": 36, "feed": 35, "tracker": 37, "starter": 8, "rated": 37, "terms": 136, "twist": 12, "twoway": 13, "deskui": 15, "cardfit": 10, "quick": 19, "playcounts": 22, "floorvotes": 9, "feedquick": 25, "partners": 30, "dailyshare": 35, "streak": 30};
const TESTS = Object.keys(SEED).map((name) => ({ name, file: join(DIR, name + '.js') }));

// ---- options
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const tier = opt('--tier', 'quick'); // quick by default; the full suite only when asked for
const jobs = Math.max(1, Number(opt('--jobs', 3)));
const all = argv.includes('--all');
const only = opt('--only', '')?.split(',').filter(Boolean);
const noServer = argv.includes('--no-server');

const git = (c) => execSync(`git -C ${REPO} ${c}`, { encoding: 'utf8' }).trim();
const head = git('rev-parse HEAD');
const dirty = git('status --porcelain');
const lastPassFile = join(RUNS, 'last-full-pass.txt');
const base = existsSync(lastPassFile) ? readFileSync(lastPassFile, 'utf8').trim() : '';
let changed = null; // null: unknown, so every gated test runs
if (base) {
  try {
    changed = [...git(`diff --name-only ${base}`).split('\n'), ...dirty.split('\n').map((l) => l.slice(3))].filter(Boolean);
  } catch { changed = null; }
}
const touched = (name) => changed === null || changed.some((f) => GATES[name].some((p) => f === p || f.startsWith(p)));

let plan = TESTS.filter((t) => existsSync(t.file));
const skipped = [];
if (only?.length) plan = plan.filter((t) => only.includes(t.name));
else if (tier === 'quick') plan = plan.filter((t) => QUICK.includes(t.name));
else if (!all) plan = plan.filter((t) => { if (GATES[t.name] && !touched(t.name)) { skipped.push(t.name); return false; } return true; });

const durFile = join(RUNS, 'durations.json');
const dur = existsSync(durFile) ? JSON.parse(readFileSync(durFile, 'utf8')) : {};
const weight = (n) => dur[n] ?? SEED[n] ?? 40;
plan.sort((a, b) => weight(b.name) - weight(a.name)); // longest first, so the tail is short

// ---- dev server
let server = null;
async function up() {
  const ok = async () => { try { return (await fetch(`http://localhost:${PORT}/`)).ok; } catch { return false; } };
  if (await ok()) return;
  server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore', detached: true });
  for (let i = 0; i < 120 && !(await ok()); i++) await new Promise((r) => setTimeout(r, 500));
  // Warm the module graph once, so the first wave of tests doesn't all wait on cold transforms.
  await fetch(`http://localhost:${PORT}/src/main.tsx`).catch(() => {});
}
const down = () => { if (server) { try { process.kill(-server.pid); } catch {} } };

// ---- one test
function run(t) {
  const limit = Math.max(300, Math.round(weight(t.name) * 2.5));
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn('timeout', [String(limit), 'node', t.file], { cwd: dirname(t.file) });
    let out = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => {
      writeFileSync(join(RUNS, t.name + '.log'), out);
      const fails = (out.match(/^FAIL.*$/gm) ?? []);
      resolve({ name: t.name, code, secs: Math.round((Date.now() - t0) / 1000), ok: code === 0 && fails.length === 0, fails });
    });
  });
}

const fmt = (s) => (s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`);
const T0 = Date.now();
const announce = () => console.log(`${tier}${all ? ' (all)' : ''}: ${plan.length} tests on ${jobs} workers` + (skipped.length ? ` · skipped, area unchanged since ${base.slice(0, 7)}: ${skipped.join(', ')}` : '') + (tier === 'full' && !all && !base ? ' · no previous full pass recorded here, so nothing is skipped' : ''));
if (argv.includes('--plan')) { announce(); console.log(plan.map((t) => t.name).join(' ')); process.exit(0); }
if (!noServer) await up();
announce();

const results = [];
const queue = [...plan];
await Promise.all(Array.from({ length: jobs }, async () => {
  for (let t; (t = queue.shift());) {
    const r = await run(t); results.push(r);
    console.log(`${r.ok ? 'pass' : 'FAIL'} ${r.name} ${fmt(r.secs)}${r.ok ? '' : ' · ' + (r.fails[0] ?? 'exit ' + r.code).slice(0, 140)}`);
  }
}));
// Failures under parallel load get one quiet re-run on their own.
for (const r of results.filter((x) => !x.ok)) {
  const again = await run(plan.find((t) => t.name === r.name));
  r.retried = true; r.flaky = again.ok;
  if (again.ok) { r.ok = true; r.secs = again.secs; }
  else { r.fails = again.fails; r.code = again.code; }
  console.log(`${again.ok ? 'pass on re-run (flaky under load)' : 'FAIL again'} ${r.name} ${fmt(again.secs)}`);
}
down();

for (const r of results) if (r.ok) dur[r.name] = r.secs;
writeFileSync(durFile, JSON.stringify(dur, null, 1));
writeFileSync(join(RUNS, 'summary.txt'), plan.map((t) => results.find((r) => r.name === t.name)).map((r) => `${r.name} exit ${r.ok ? 0 : r.code || 1}${r.flaky ? ' (flaky)' : ''}`).join('\n') + '\ndone\n');
const bad = results.filter((r) => !r.ok), flaky = results.filter((r) => r.flaky);
const wall = Math.round((Date.now() - T0) / 1000), cpu = results.reduce((s, r) => s + r.secs, 0);
console.log(`\n${results.length - bad.length}/${results.length} passed${flaky.length ? ` (${flaky.length} flaky: ${flaky.map((r) => r.name).join(', ')})` : ''} · ${fmt(wall)} wall, ${fmt(cpu)} of test time`);
for (const r of bad) console.log(`  FAILED ${r.name}: ${r.fails.slice(0, 3).join(' | ') || 'exit ' + r.code} (runs/${r.name}.log)`);
if (tier === 'full' && !only?.length && !bad.length && !dirty) { writeFileSync(lastPassFile, head + '\n'); console.log(`recorded ${head.slice(0, 7)} as the last full pass`); }
else if (tier === 'full' && !bad.length && dirty) console.log('uncommitted changes: not recorded as a full pass (commit, then run again to set the baseline)');
process.exit(bad.length ? 1 : 0);

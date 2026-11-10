// Who pays the federal income tax in each county, by income, and which county a ZIP code is in.
//
//  - IRS Statistics of Income, county data, tax year 2023 (returns filed in calendar 2024), with
//    returns split into eight adjusted gross income (AGI) classes. We keep the number of returns
//    (N1) and income tax after credits (A06500, Form 1040 line 22; amounts in thousands) and fold
//    the eight classes into five: under $25k, $25k–$50k, $50k–$100k, $100k–$200k, $200k or more.
//  - Census Bureau 2020 ZCTA-to-county relationship file: how much of each ZIP Code Tabulation
//    Area's land lies in each county. A ZIP that crosses county lines starts with the county that
//    holds most of its land (the player can pick another).
//  - Connecticut: the IRS now reports its nine planning regions, which replaced its eight counties
//    in 2022. Those regions are made of whole towns, so ZIPs go to towns (the Census ZCTA-to-county-
//    subdivision file) and towns to regions (the Census Connecticut crosswalk).
//
// Writes public/county/<ST>.json (loaded when a player's ZIP or state is known), one per state and
// DC. Run: npm run data:county   (add --refresh to download again)
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getFile, ROOT } from './lib/http.mjs';
import { areaForZip } from '../src/lib/zip.ts';

export const TY = 2023;
export const IRS_URL = 'https://www.irs.gov/pub/irs-soi/23incyallagi.csv';
export const IRS_GUIDE = 'https://www.irs.gov/pub/irs-soi/23incydocguide.docx';
export const ZCTA_COUNTY_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt';
export const ZCTA_COUSUB_URL = 'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_cousub20_natl.txt';
export const CT_URL = 'https://www2.census.gov/geo/docs/reference/ct_change/ct_cou_to_cousub_crosswalk.txt';

/** AGI class (1–8) → one of five groups. Classes 1–3 are under $1, $1–$10k, $10k–$25k. */
const GROUP = { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 2, 7: 3, 8: 4 };
/** Keep the counties that hold at least this share of a ZIP's land (the largest is always kept). */
const MIN_SHARE = 0.05;

const lines = (s) => s.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
function csv(text) {
  const [head, ...rows] = lines(text);
  const h = head.split(',');
  return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [h[i], v])));
}
function pipe(text) {
  const [head, ...rows] = lines(text);
  const h = head.split('|').map((x) => x.replace(/"/g, '').split('\n')[0].trim());
  return rows.map((r) => Object.fromEntries(r.split('|').map((v, i) => [h[i], v])));
}

export async function buildCountyTax() {
  const irsFile = await getFile('irs', IRS_URL, '23incyallagi.csv');
  const relFile = await getFile('census', ZCTA_COUNTY_URL, 'tab20_zcta520_county20_natl.txt');
  const subFile = await getFile('census', ZCTA_COUSUB_URL, 'tab20_zcta520_cousub20_natl.txt');
  const ctFile = await getFile('census', CT_URL, 'ct_cou_to_cousub_crosswalk.txt');

  // ---- IRS: returns and income tax by county and group ----
  const irs = csv(await readFile(irsFile, 'latin1'));
  const counties = new Map(); // fips -> { st, name, r[5], t[5] }
  const us = { r: [0, 0, 0, 0, 0], t: [0, 0, 0, 0, 0] };
  const stateFips = new Map(); // '51' -> 'VA'
  const stateTot = new Map(); // 'VA' -> { r[5], t[5] }
  for (const row of irs) {
    const g = GROUP[Number(row.agi_stub)];
    if (g === undefined) continue;
    const n = Number(row.N1), t = Number(row.A06500);
    stateFips.set(row.STATEFIPS, row.STATE);
    if (row.COUNTYFIPS === '000') {
      us.r[g] += n; us.t[g] += t;
      let sTot = stateTot.get(row.STATE);
      if (!sTot) stateTot.set(row.STATE, (sTot = { r: [0, 0, 0, 0, 0], t: [0, 0, 0, 0, 0] }));
      sTot.r[g] += n; sTot.t[g] += t;
      continue;
    }
    const fips = row.STATEFIPS + row.COUNTYFIPS;
    let c = counties.get(fips);
    if (!c) counties.set(fips, (c = { st: row.STATE, name: row.COUNTYNAME, r: [0, 0, 0, 0, 0], t: [0, 0, 0, 0, 0] }));
    c.r[g] += n; c.t[g] += t;
  }

  // ---- Census: ZIP -> county land shares ----
  const rel = pipe(await readFile(relFile, 'utf8'));
  const zips = new Map(); // zcta -> Map(fips -> land)
  const fullName = new Map();
  const add = (z, fips, land) => {
    let m = zips.get(z);
    if (!m) zips.set(z, (m = new Map()));
    m.set(fips, (m.get(fips) ?? 0) + land);
  };
  for (const r of rel) {
    const z = r.GEOID_ZCTA5_20, fips = r.GEOID_COUNTY_20;
    if (!z || !fips) continue;
    fullName.set(fips, r.NAMELSAD_COUNTY_20);
    if (fips.startsWith('09')) continue; // Connecticut: by town, below
    add(z, fips, Number(r.AREALAND_PART) + Number(r.AREAWATER_PART) * 1e-6);
  }
  // Connecticut: ZIP -> town -> planning region.
  // Its header names wrap onto several lines, so read the data rows by position: state, old county,
  // old county name, new county (region), region name, town, old town GEOID, new town GEOID, ...
  const townToRegion = new Map();
  for (const line of lines(await readFile(ctFile, 'utf8'))) {
    const f = line.split('|');
    if (f[0] !== '09' || !/^\d{10}$/.test(f[6] ?? '')) continue;
    const region = '09' + f[3];
    townToRegion.set(f[6], region);
    fullName.set(region, f[4]);
  }
  const sub = pipe(await readFile(subFile, 'utf8'));
  let ctMissing = 0;
  for (const r of sub) {
    const z = r.GEOID_ZCTA5_20, town = r.GEOID_COUSUB_20;
    if (!z || !town || !town.startsWith('09')) continue;
    const region = townToRegion.get(town);
    if (!region) { ctMissing++; continue; }
    add(z, region, Number(r.AREALAND_PART) + Number(r.AREAWATER_PART) * 1e-6);
  }

  // ---- One file per state: its counties, and its ZIPs (by the ZIP's own state) ----
  const out = new Map(); // st -> { counties: [fips], index: Map, zips: {} }
  const fileFor = (st) => {
    let f = out.get(st);
    if (!f) out.set(st, (f = { list: [], index: new Map(), zips: {} }));
    return f;
  };
  const indexOf = (f, fips) => {
    if (!f.index.has(fips)) { f.index.set(fips, f.list.length); f.list.push(fips); }
    return f.index.get(fips);
  };
  for (const [fips, c] of counties) indexOf(fileFor(c.st), fips);
  let noState = 0, multi = 0;
  for (const [z, m] of zips) {
    const a = areaForZip(z);
    const st = a?.kind === 'state' ? a.abbr : null;
    if (!st || ![...stateFips.values()].includes(st)) { noState++; continue; }
    const f = fileFor(st);
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    const parts = [...m.entries()].sort((x, y) => y[1] - x[1]).filter(([, v], i) => i === 0 || v / total >= MIN_SHARE);
    if (parts.length === 1) f.zips[z] = indexOf(f, parts[0][0]);
    else { multi++; f.zips[z] = parts.map(([fips, v]) => [indexOf(f, fips), Math.round((v / total) * 100)]); }
  }

  await rm(path.join(ROOT, 'public', 'county'), { recursive: true, force: true });
  let bytes = 0;
  for (const [st, f] of out) {
    const rows = f.list.map((fips) => {
      const c = counties.get(fips);
      const name = fullName.get(fips) ?? c?.name ?? fips;
      const cst = c?.st ?? stateFips.get(fips.slice(0, 2)) ?? st;
      // No IRS figures: a county with fewer than 20 returns (the IRS leaves those out).
      return c ? [fips, name, cst, c.r, c.t.map(Math.round)] : [fips, name, cst, null, null];
    });
    const sTot = stateTot.get(st);
    const body = { ty: TY, st, us: { r: us.r, t: us.t.map(Math.round) }, state: { r: sTot.r, t: sTot.t.map(Math.round) }, counties: rows, zips: f.zips };
    const text = JSON.stringify(body);
    await mkdir(path.join(ROOT, 'public', 'county'), { recursive: true });
    await writeFile(path.join(ROOT, 'public', 'county', `${st}.json`), text);
    bytes += text.length;
  }
  const used = new Set([...out.values()].flatMap((f) => f.list));
  const missingIrs = [...used].filter((f) => !counties.has(f)).map((f) => `${f} ${fullName.get(f) ?? ''}`.trim());
  console.log(`[county] TY${TY}: ${counties.size} counties, ${zips.size} ZIPs (${multi} cross county lines; ${noState} outside the 50 states and DC), ${out.size} state files, ~${Math.round(bytes / 1024)} KB`);
  console.log(`[county] U.S. returns ${us.r.reduce((s, v) => s + v, 0).toLocaleString()}, income tax $${Math.round(us.t.reduce((s, v) => s + v, 0) / 1e6).toLocaleString()}B; counties with ZIPs but no IRS figures: ${missingIrs.join(', ') || 'none'}; CT towns unmatched: ${ctMissing}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await buildCountyTax();

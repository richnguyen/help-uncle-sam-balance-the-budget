// Mission 1.4, "Your county": who paid the federal income tax where the player lives, by income,
// next to the whole country. The county comes from the ZIP typed just above it (or picked here);
// the figures are the IRS's county data, one small file per state, loaded only when needed.
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { SegBar } from '../components/charts';
import { ChartFrame, Legend, Stat } from '../components/ui';
import { geo } from '../data';
import { dollars, int, money, pct } from '../lib/format';
import { load } from '../lib/storage';
import { useVotes } from '../lib/votes';
import { areaForZip, isZip } from '../lib/zip';

// The ZIP typed in "Your county", kept only for this visit: saving it is a separate choice there.
let visitZip = '';
export const rememberZip = (z: string) => { visitZip = z; };
export const visitedZip = () => visitZip;

/** [county FIPS, name, state, returns by group, income tax by group ($ thousands)]; null when the IRS leaves a tiny county out. */
type CountyRow = [string, string, string, number[] | null, number[] | null];
interface Tally { r: number[]; t: number[] }
export interface CountyFile {
  ty: number; st: string; us: Tally; state: Tally; counties: CountyRow[];
  /** ZIP → county index, or [index, % of the ZIP's land][] when it crosses county lines. */
  zips: Record<string, number | [number, number][]>;
}

const files = new Map<string, Promise<CountyFile>>();
export function loadCountyFile(st: string): Promise<CountyFile> {
  let p = files.get(st);
  if (!p) {
    p = fetch(`county/${st}.json`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<CountyFile>; });
    p.catch(() => files.delete(st));
    files.set(st, p);
  }
  return p;
}

/** The IRS county data covers the 50 states and DC; returns from the territories are left out. */
const TERRITORIES = new Set(['PR', 'GU', 'VI', 'AS', 'MP']);

// Five income groups (adjusted gross income). Color follows the group: lighter to darker as income rises.
const LOW = [0, 25e3, 50e3, 100e3, 200e3];
const k = (v: number) => `$${v / 1e3}K`;
export interface Band { label: string; short: string; r: number; t: number; ur: number; ut: number; color: string; ink: string }

/**
 * The county's groups beside the nation's. Where fewer than 20 returns fall in a group the IRS
 * folds them into a neighboring one, so a group with no returns here is merged into the next
 * (the last one into the one before), and the nation's groups are merged the same way.
 */
export function bandsFor(here: Tally, us: Tally): Band[] {
  const spans: [number, number][] = [];
  let cur: [number, number] | null = null;
  here.r.forEach((n, i) => {
    cur = cur ? [cur[0], i] : [i, i];
    if (n > 0) { spans.push(cur); cur = null; }
  });
  if (cur) { if (spans.length) spans[spans.length - 1][1] = (cur as [number, number])[1]; else spans.push(cur); }
  const sum = (xs: number[], [a, b]: [number, number]) => xs.slice(a, b + 1).reduce((s, v) => s + v, 0);
  return spans.map((sp) => {
    const lo = LOW[sp[0]], hi = LOW[sp[1] + 1] ?? Infinity;
    const label = lo === 0 ? `Under ${dollars(hi)}` : hi === Infinity ? `${dollars(lo)} or more` : `${dollars(lo)} to ${dollars(hi)}`;
    const short = lo === 0 ? `Under ${k(hi)}` : hi === Infinity ? `${k(lo)}+` : `${k(lo)}–${k(hi)}`;
    const top = sp[1];
    return {
      label, short,
      r: sum(here.r, sp), t: sum(here.t, sp) * 1e3, ur: sum(us.r, sp), ut: sum(us.t, sp) * 1e3,
      color: `var(--seq-${top + 3}00)`, ink: `var(--seq-ink-${top + 2})`,
    };
  });
}

/** A state's county file: undefined while loading, null if it failed (or for a territory, which has none). */
function useCountyFile(st: string, territory: boolean): [CountyFile | null | undefined, () => void] {
  const [file, setFile] = useState<CountyFile | null | undefined>(undefined);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (territory) { setFile(null); return; }
    let alive = true;
    setFile(undefined);
    loadCountyFile(st).then((f) => { if (alive) setFile(f); }).catch(() => { if (alive) setFile(null); });
    return () => { alive = false; };
  }, [st, territory, tries]);
  return [file, () => setTries((n) => n + 1)];
}

/** The chosen county's (or the whole state's) figures, or a plain note saying why there are none. */
function CountyResult({ file, territory, chosen, st, stName, retry }: { file: CountyFile | null | undefined; territory: boolean; chosen: number; st: string; stName: string; retry: () => void }) {
  if (territory) return <p className="small">The IRS’s county figures cover the 50 states and DC; returns filed from Puerto Rico and the territories aren’t in them.</p>;
  if (file === undefined) return <p className="small muted" role="status">Loading county figures…</p>;
  if (file === null) return <p className="small" role="alert">Couldn’t load the county figures. <button type="button" className="link-btn" onClick={retry}>Try again</button></p>;
  const row = chosen >= 0 ? file.counties[chosen] : null;
  const name = row ? row[1] + (row[2] !== st ? `, ${row[2]}` : '') : stName;
  const here: Tally | null = row ? (row[3] && row[4] ? { r: row[3], t: row[4] } : null) : file.state;
  if (!here) return <p className="small">The IRS doesn’t publish figures for {name}: it leaves out counties with fewer than 20 tax returns.</p>;
  return <CountyView name={name} here={here} us={file.us} ty={file.ty} />;
}

const useSavedZip = () => {
  const votes = useVotes();
  return (votes.zipHome === 'database' ? votes.mine.zip : load<string>('zip', '')) || '';
};
const zipParts = (file: CountyFile | null | undefined, zip: string) => {
  const zc = file && isZip(zip) ? file.zips[zip] : undefined;
  return zc === undefined ? [] : typeof zc === 'number' ? [{ i: zc, share: 100 }] : zc.map(([i, share]) => ({ i, share }));
};

/**
 * The county under the ZIP form in mission 1.4: where the ZIP is (county, then state, then the
 * country), and that county's figures. A ZIP that crosses county lines offers each county; any
 * county in the state, or the whole state, can be picked instead.
 */
export function CountyTry({ zip, st }: { zip: string; st: string }) {
  const [pick, setPick] = useState<string | null>(null); // a county FIPS, or 'state'
  useEffect(() => setPick(null), [zip, st]);
  const area = isZip(zip) ? areaForZip(zip) : null;
  const stName = geo.states.find((x) => x.abbr === st)?.name ?? st;
  const territory = TERRITORIES.has(st);
  const [file, retry] = useCountyFile(st, territory);
  const zc = file && isZip(zip) ? file.zips[zip] : undefined;
  const zipCounties = zipParts(file, zip);
  const options = useMemo(() => {
    if (!file) return [];
    const list = file.counties.map((c, i) => ({ c, i })).filter(({ c, i }) => c[2] === st || zipCounties.some((z) => z.i === i));
    return list.sort((a, b) => a.c[1].localeCompare(b.c[1]));
  }, [file, st, zc]); // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = !file ? -1 : pick === 'state' ? -1 : pick ? file.counties.findIndex((c) => c[0] === pick) : zipCounties[0]?.i ?? -1;
  // Where the ZIP is: its county (the one picked, if the ZIP spans several), then its state, then the country.
  const home = file && zipCounties.length ? file.counties[zipCounties.some((z) => z.i === chosen) ? chosen : zipCounties[0].i] : null;
  const zipMsg = !isZip(zip) ? null
    : area?.kind === 'military' ? 'A military ZIP has no county. Pick one below.'
    : file && zc === undefined ? `ZIP ${zip} is a post office box or single-address ZIP with no area of its own, so it has no county here. Pick yours below.`
    : null;

  return (
    <div className="cty-under">
      {isZip(zip) && (territory || home) && (
        <div className="zip-place" role="status">
          <span className="small muted">ZIP {zip} is in</span>
          <ol aria-label={`Where ZIP ${zip} is`}>
            {home && <li><strong>{home[1]}</strong>{home[2] !== st ? `, ${home[2]}` : ''}</li>}
            <li>{stName}</li>
            <li>United States</li>
          </ol>
        </div>
      )}
      {zipMsg && <p className="small zip-msg" role="status">{zipMsg}</p>}
      {file && zipCounties.length > 1 && (
        <div className="cty-chips" role="group" aria-label={`ZIP ${zip} crosses county lines`}>
          <span className="small muted">ZIP {zip} crosses county lines:</span>
          {zipCounties.map(({ i, share }) => (
            <button key={i} type="button" className="chip" aria-pressed={chosen === i} onClick={() => setPick(file.counties[i][0])}>
              {file.counties[i][1]} <span className="muted">{share}% of its land</span>
            </button>
          ))}
        </div>
      )}
      <CountyResult file={file} territory={territory} chosen={chosen} st={st} stName={stName} retry={retry} />
      {file && options.length > 0 && (
        <div className="field cty-pick"><label htmlFor="cty-select">{isZip(zip) ? 'Not your county? Pick another' : 'County'}</label>
          <select id="cty-select" className="select" value={chosen >= 0 ? file.counties[chosen][0] : 'state'} onChange={(e) => setPick(e.target.value)}>
            <option value="state">All of {stName}</option>
            {options.map(({ c }) => <option key={c[0]} value={c[0]}>{c[1]}{c[2] !== st ? `, ${c[2]}` : ''}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

/**
 * The Revenue page's version: no state of its own, so a state picker comes first. It starts with
 * the state of the player's ZIP, or the state they last picked; browsing here doesn't change that.
 */
export function CountyTaxExplorer() {
  const saved = useSavedZip();
  const zip = visitZip || saved;
  const zipArea = isZip(zip) ? areaForZip(zip) : null;
  const [st, setSt] = useState(() => (zipArea?.kind === 'state' ? zipArea.abbr : load<string>('state', 'CA')));
  const states = [...geo.states].sort((a, b) => a.name.localeCompare(b.name));
  const stName = states.find((x) => x.abbr === st)?.name ?? st;
  const picker = (
    <div className="field cty-state">
      <label htmlFor="rev-state">State</label>
      <select id="rev-state" className="select" value={st} onChange={(e) => setSt(e.target.value)}>
        {states.map((x) => <option key={x.abbr} value={x.abbr}>{x.name}</option>)}
      </select>
    </div>
  );
  return <StateCountyTax st={st} stName={stName} lead={picker} />;
}

/**
 * The state page's version: the page picks the state; this picks a county in it, starting with
 * the player's own when their ZIP (typed this visit, or saved) is in that state.
 */
export function StateCountyTax({ st, stName, lead }: { st: string; stName: string; lead?: ReactNode }) {
  const saved = useSavedZip();
  const zip = visitZip || saved;
  const territory = TERRITORIES.has(st);
  const [file, retry] = useCountyFile(st, territory);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [st]);
  const zipArea = isZip(zip) ? areaForZip(zip) : null;
  const mine = zipArea?.kind === 'state' && zipArea.abbr === st ? zipParts(file, zip)[0]?.i : undefined;
  const chosen = !file ? -1 : pick === 'state' ? -1 : pick ? file.counties.findIndex((c) => c[0] === pick) : mine ?? -1;
  const options = file ? file.counties.filter((c) => c[2] === st).sort((a, b) => a[1].localeCompare(b[1])) : [];
  return (
    <div className="county cty-page">
      {(lead || (file && options.length > 0)) && (
        <div className="cty-bar">
          {lead}
          {file && options.length > 0 && (
            <div className="field cty-pick">
              <label htmlFor="st-county">County</label>
              <select id="st-county" className="select" value={chosen >= 0 ? file.counties[chosen][0] : 'state'} onChange={(e) => setPick(e.target.value)}>
                <option value="state">All of {stName}</option>
                {options.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}
              </select>
            </div>
          )}
          {file && mine !== undefined && chosen === mine && <span className="small muted cty-yours">Your county, from your ZIP code</span>}
        </div>
      )}
      <CountyResult file={file} territory={territory} chosen={chosen} st={st} stName={stName} retry={retry} />
    </div>
  );
}

function CountyView({ name, here, us, ty }: { name: string; here: Tally; us: Tally; ty: number }) {
  const bands = bandsFor(here, us);
  const R = bands.reduce((s, b) => s + b.r, 0), T = bands.reduce((s, b) => s + b.t, 0);
  const UR = bands.reduce((s, b) => s + b.ur, 0), UT = bands.reduce((s, b) => s + b.ut, 0);
  const top = bands[bands.length - 1];
  const parts = (pick: (b: Band) => number) => bands.map((b) => ({ label: b.label, value: pick(b), color: b.color, ink: b.ink }));
  return (
    <>
      <div className="stat-row cty-stats">
        <Stat label={`Federal income tax, ${name}`} value={money(T)} note={`on ${int(R)} tax returns for ${ty}`} />
        <Stat label="Average per return" value={dollars(T / R)} note={`U.S. average: ${dollars(UT / UR)}`} />
      </div>
      <p className="cty-lede">
        Returns with incomes of {top.label.toLowerCase()} were <strong>{pct(top.r / R, 0)}</strong> of the returns in {name} and paid <strong>{pct(top.t / T, 0)}</strong> of its income tax.
        {' '}Across the country: {pct(top.ur / UR, 0)} and {pct(top.ut / UT, 0)}.
      </p>
      <ChartFrame
        title={`Who paid the income tax in ${name}`}
        sub={`Shares of tax returns and of federal income tax, by income, tax year ${ty}; the whole country is the thin bar under each`}
        legend={<Legend items={bands.map((b) => ({ label: b.short, color: b.color }))} />}
        sourceIds={['irs-soi-county', 'census-zcta-county']}
        table={{
          columns: [
            { key: 'g', label: 'Income' }, { key: 'r', label: 'Returns here', align: 'r' }, { key: 't', label: 'Income tax here', align: 'r' },
            { key: 'ur', label: 'Returns, U.S.', align: 'r' }, { key: 'ut', label: 'Income tax, U.S.', align: 'r' }, { key: 'a', label: 'Average tax per return here', align: 'r' },
          ],
          rows: bands.map((b) => ({ g: b.label, r: pct(b.r / R), t: pct(b.t / T), ur: pct(b.ur / UR), ut: pct(b.ut / UT), a: b.r ? dollars(b.t / b.r) : '—' })),
        }}
      >
        <div className="cty-chart">
          <div className="cty-group">Tax returns</div>
          <span className="cty-k" title={name}>{name}</span>
          <SegBar parts={parts((b) => b.r)} label={`Tax returns in ${name}, by income`} format={int} valueLabel="Returns" />
          <span className="cty-k muted">U.S.</span>
          <SegBar thin parts={parts((b) => b.ur)} label="Tax returns in the U.S., by income" format={int} valueLabel="Returns" />
          <div className="cty-group">Federal income tax paid</div>
          <span className="cty-k" title={name}>{name}</span>
          <SegBar parts={parts((b) => b.t)} label={`Federal income tax in ${name}, by income`} valueLabel="Income tax" />
          <span className="cty-k muted">U.S.</span>
          <SegBar thin parts={parts((b) => b.ut)} label="Federal income tax in the U.S., by income" valueLabel="Income tax" />
        </div>
      </ChartFrame>
      <p className="small muted">
        IRS figures for returns filed in {ty + 1}, placed by the ZIP code on each return. Income tax here is the tax owed after credits (Form 1040, line 22),
        before refundable credits like the Earned Income Tax Credit, which the IRS pays out separately; payroll taxes for Social Security and Medicare aren’t in it.
        Income groups are by adjusted gross income, and where fewer than 20 returns fall in a group, the IRS counts them in another one.
        A ZIP that crosses county lines starts with the county that holds most of its land.
      </p>
    </>
  );
}

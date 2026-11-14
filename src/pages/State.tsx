import { useEffect, useMemo, useState } from 'react';
import { BarList, SegBar } from '../components/charts';
import { USMap } from '../components/USMap';
import { ChartFrame, DataTable, Legend, PageHead, Section, Seg, Stat, Term } from '../components/ui';
import { geo } from '../data';
import type { AwardType, DistrictRow, StateRow } from '../data/types';
import { dollars, money, pct, signedPct } from '../lib/format';
import { go } from '../lib/router';
import { load, save } from '../lib/storage';
import { StateCountyTax } from '../game/county';

const TYPES: { id: AwardType; label: string; color: string; ink: string; blurb: string }[] = [
  { id: 'grants', label: 'Grants', color: 'var(--c-ss)', ink: '#fff', blurb: 'Money to state and local governments, schools, hospitals, and nonprofits, such as Medicaid and highway funds.' },
  { id: 'directPayments', label: 'Direct payments', color: 'var(--c-medicare)', ink: '#fff', blurb: 'Payments to people and businesses, such as Social Security benefits, SNAP food aid, and farm payments.' },
  { id: 'contracts', label: 'Contracts', color: 'var(--c-health)', ink: '#0b0b0b', blurb: 'Purchases of goods and services, from fighter jets to IT support.' },
  { id: 'loans', label: 'Loans', color: 'var(--c-income)', ink: '#0b0b0b', blurb: 'The estimated cost to taxpayers (subsidy cost) of federal loans, not the face value.' },
  { id: 'other', label: 'Other assistance', color: 'var(--c-veterans)', ink: '#fff', blurb: 'Insurance and other financial assistance.' },
];

type Metric = 'perCapita' | 'total';

export default function StatePage({ param }: { param: string | null }) {
  const states = geo.states;
  // District detail is a separate file, fetched the first time this page opens.
  const [allDistricts, setAllDistricts] = useState<DistrictRow[]>([]);
  useEffect(() => {
    let alive = true;
    import('../data/generated/districts.json').then((m) => { if (alive) setAllDistricts(m.default as DistrictRow[]); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const initial = (param && states.find((s) => s.abbr.toLowerCase() === param)?.abbr) || load<string>('state', 'CA');
  const [abbr, setAbbr] = useState<string>(initial);
  const [metric, setMetric] = useState<Metric>('perCapita');
  const [dist, setDist] = useState<string | null>(null);
  useEffect(() => {
    if (param) {
      const m = states.find((s) => s.abbr.toLowerCase() === param);
      if (m) setAbbr(m.abbr);
    }
  }, [param, states]);
  const choose = (a: string) => {
    setAbbr(a);
    setDist(null);
    save('state', a);
    save('state-picked', true);
    go('state-' + a.toLowerCase());
  };
  const s = states.find((x) => x.abbr === abbr) ?? states[0];
  const ranked = useMemo(() => [...states].filter((x) => Number(x.fips) < 60 && x.fips !== '11').sort((a, b) => b.perCapita - a.perCapita), [states]);
  const rank = ranked.findIndex((x) => x.abbr === s.abbr) + 1;
  const districts = allDistricts.filter((d) => d.state === s.abbr).sort((a, b) => a.code.localeCompare(b.code));
  const d = districts.find((x) => x.code === dist) ?? null;
  const nat = geo.national;
  const fmtMap = metric === 'perCapita' ? (v: number) => dollars(v) : (v: number) => money(v);

  return (
    <>
      <PageHead
        eyebrow="Close to home"
        title="Federal money in your state"
        lede={<>Federal grants, contracts, loans, and direct payments reach every state and congressional district. These figures come from <Term id="usaspending">USAspending.gov</Term>, the official database of federal awards, for FY{geo.fy}, the most recent complete year (agencies are still reporting FY{geo.fy + 1} awards).</>}
      />
      <div className="callout">
        <div className="callout-title">Why Medicare is left out of these figures</div>
        <p>USAspending.gov records Medicare payments ({money(nat.medicare)} in FY{geo.fy}) where the insurance company or claims processor is based, not where patients live. That puts tens of billions of dollars in states like Minnesota, Kentucky, and North Dakota and far too little in others, so state and district figures here exclude Medicare. Social Security, Medicaid, veterans’ benefits, SNAP, and other programs are included.</p>
      </div>
      <div className="toolbar">
        <div className="toolbar-item">
          <label htmlFor="st-sel">State or territory</label>
          <select id="st-sel" className="select" value={s.abbr} onChange={(e) => choose(e.target.value)}>
            {[...states].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.abbr} value={x.abbr}>{x.name}</option>)}
          </select>
        </div>
        {districts.length > 1 && (
          <div className="toolbar-item">
            <label htmlFor="st-dist">District</label>
            <select id="st-dist" className="select" value={dist ?? ''} onChange={(e) => setDist(e.target.value || null)}>
              <option value="">Whole state</option>
              {districts.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
            </select>
          </div>
        )}
        <div className="toolbar-item">
          <span>Map shows</span>
          <Seg<Metric> label="Map metric" value={metric} onChange={setMetric} options={[{ value: 'perCapita', label: 'Per person' }, { value: 'total', label: 'Total' }]} />
        </div>
      </div>
      {/* The state's own page (public/state/<ab>/): a plain page to link to and share, with its own preview card. */}
      {!__ARTIFACT__ && <p className="small state-page-link"><a href={`state/${s.abbr.toLowerCase()}/`}>{s.name} on one page, to share or link to</a></p>}

      <div className="split">
        <div className="card">
          <ChartFrame title={`Federal awards ${metric === 'perCapita' ? 'per person' : 'in total'}, FY${geo.fy}`} sub="Shading follows the scale below the map; states nearer the “Higher” end received more. Select a state to see where its money came from." sourceIds={['usaspending-geo']}
            table={{
              columns: [{ key: 'n', label: 'State' }, { key: 't', label: 'Total awards', align: 'r' }, { key: 'p', label: 'Per person', align: 'r' }, { key: 'pop', label: 'Population', align: 'r' }],
              rows: [...states].sort((a, b) => b.perCapita - a.perCapita).map((x) => ({ n: x.name, t: money(x.total), p: dollars(x.perCapita), pop: x.population ? x.population.toLocaleString() : '—' })),
            }}
          >
            <USMap
              data={states.map((x) => ({ fips: x.fips, abbr: x.abbr, name: x.name, value: metric === 'perCapita' ? x.perCapita : x.total, extra: metric === 'perCapita' ? `${money(x.total)} total` : `${dollars(x.perCapita)} per person` }))}
              selected={s.abbr}
              onSelect={choose}
              format={fmtMap}
              valueLabel={metric === 'perCapita' ? 'Awards per person' : 'Total awards'}
            />
          </ChartFrame>
        </div>
        {d ? <DistrictCard d={d} s={s} /> : <StateCard s={s} rank={rank} n={ranked.length} />}
      </div>

      {!d && (
        <div className="grid-2">
          <div className="card">
            <ChartFrame title={`Which agencies sent money to ${s.name}`} sub={`Top awarding agencies, FY${geo.fy}`} sourceIds={['usaspending-cat']}>
              <BarList items={s.agencies.slice(0, 10).map((a) => ({ id: a.name, label: a.name, value: a.amount, color: 'var(--c-ss)' }))} total={s.total} />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame title={`The biggest programs in ${s.name}`} sub={<>Top federal programs by <Term id="assistance-listing">assistance listing</Term>, FY{geo.fy}</>} sourceIds={['usaspending-cat']}>
              <BarList items={s.programs.slice(0, 10).map((p) => ({ id: p.code, label: p.name, value: p.amount, color: 'var(--c-medicare)' }))} />
            </ChartFrame>
          </div>
        </div>
      )}

      <Section id="income-tax" title={`Who pays the federal income tax in ${s.name}`} sub={`The other side of the ledger: income tax on returns filed from ${s.name}, by county and by income, from the IRS’s figures for tax year 2023. Pick a county, or see the whole state.`}>
        <div className="card">
          <StateCountyTax st={s.abbr} stName={s.name} />
        </div>
      </Section>

      {districts.length > 0 && (
        <Section id="districts" title={`Congressional districts in ${s.name}`} sub="Awards are assigned to the district where the work happens or the recipient is located. Select a district for its top programs.">
          <div className="card">
            <DataTable
              spec={{
                columns: [{ key: 'l', label: 'District' }, { key: 't', label: 'Total awards', align: 'r' }, { key: 'p', label: 'Per person', align: 'r' }, { key: 'g', label: 'Grants', align: 'r' }, { key: 'dp', label: 'Direct payments', align: 'r' }, { key: 'c', label: 'Contracts', align: 'r' }, { key: 'x', label: '' }],
                rows: districts.map((x) => ({
                  l: x.label,
                  t: money(x.total),
                  p: x.population ? dollars(x.perCapita) : '—',
                  g: money(x.byType.grants),
                  dp: money(x.byType.directPayments),
                  c: money(x.byType.contracts),
                  x: <button className="link-btn" onClick={() => { setDist(x.code); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Details</button>,
                })),
              }}
            />
          </div>
        </Section>
      )}

      <Section id="caveats" title="What these numbers include, and what they don’t">
        <div className="prose">
          <p><strong>Included:</strong> federal grants (such as Medicaid and highway funds), contracts, direct payments to people (such as Social Security and SNAP), loans at their estimated cost to taxpayers, and other assistance recorded in USAspending.gov, assigned to the place where the money is used. Together that is {money(nat.total)} in FY{geo.fy}.</p>
          <p><strong>Left out:</strong> Medicare (explained above), federal employees’ pay, and interest on the debt, which are not recorded as awards by place. Amounts are award obligations, which are commitments to spend and can differ from what was paid out that year; some lines are negative where earlier awards were reduced.</p>
          <p><strong>Why some places rank high:</strong> states with large military bases, defense contractors, or national labs, places with many older residents, and small-population places like DC tend to receive more per person. Per-person figures use the population counts USAspending.gov uses (2020 Census).</p>
        </div>
      </Section>
    </>
  );
}

function TypeBreakdown({ byType, total }: { byType: Record<AwardType, number>; total: number }) {
  const parts = TYPES.map((t) => ({ label: t.label, value: Math.max(0, byType[t.id] ?? 0), color: t.color, ink: t.ink })).filter((p) => p.value > 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SegBar label="Awards by type" parts={parts} />
      <Legend items={parts.map((p) => ({ label: `${p.label} · ${money(p.value)} (${pct(p.value / total, 0)})`, color: p.color }))} />
    </div>
  );
}

function StateCard({ s, rank, n }: { s: StateRow; rank: number; n: number }) {
  const nat = geo.national;
  const diff = s.perCapita / nat.perCapita - 1;
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="eyebrow">FY{geo.fy}</div>
        <h2 className="section-title" style={{ marginTop: 4 }}>{s.name}</h2>
      </div>
      <div className="grid-2">
        <Stat label="Federal awards" value={money(s.total)} note={s.priorTotal ? `${signedPct(s.total / s.priorTotal - 1)} vs FY${geo.priorFY}` : undefined} />
        <Stat label="Per person" value={dollars(s.perCapita)} note={`${signedPct(diff, 0)} vs national average of ${dollars(nat.perCapita)}`} />
      </div>
      {rank > 0 && <p className="small muted">Ranks {rank} of {n} states (excluding DC and territories) in awards per person. Population: {s.population.toLocaleString()}.</p>}
      <TypeBreakdown byType={s.byType} total={s.total} />
      <div className="small muted">
        {TYPES.map((t) => <p key={t.id} style={{ marginTop: 4 }}><strong style={{ color: 'var(--ink-2)' }}>{t.label}:</strong> {t.blurb}</p>)}
      </div>
    </div>
  );
}

function DistrictCard({ d, s }: { d: DistrictRow; s: StateRow }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="eyebrow">{s.name} · FY{geo.fy}</div>
        <h2 className="section-title" style={{ marginTop: 4 }}>District {d.label}</h2>
      </div>
      <div className="grid-2">
        <Stat label="Federal awards" value={money(d.total)} />
        <Stat label="Per person" value={d.population ? dollars(d.perCapita) : '—'} note={d.population ? `vs ${dollars(s.perCapita)} statewide` : undefined} />
      </div>
      <TypeBreakdown byType={d.byType} total={d.total} />
      {d.programs && d.programs.length > 0 && (
        <div>
          <div className="chart-title" style={{ marginBottom: 6 }}>Top programs</div>
          <BarList items={d.programs.slice(0, 6).map((p) => ({ id: p.code, label: p.name, value: p.amount, color: 'var(--c-medicare)' }))} />
        </div>
      )}
      {d.agencies && d.agencies.length > 0 && (
        <div>
          <div className="chart-title" style={{ marginBottom: 6 }}>Top agencies</div>
          <BarList items={d.agencies.slice(0, 6).map((a) => ({ id: a.name, label: a.name, value: a.amount, color: 'var(--c-ss)' }))} />
        </div>
      )}
    </div>
  );
}

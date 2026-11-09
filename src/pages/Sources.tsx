import { useEffect } from 'react';
import { PageHead, Section } from '../components/ui';
import { LevelDocs } from '../game/LevelDocs';
import { FIELD_GUIDE } from '../game/nav';
import { useJourney } from '../game/state';
import { OPTIONS_DATA } from '../lib/planData';
import { budget, cbo, geo, SOURCES, ssa } from '../data';
import { dateLabel } from '../lib/format';

export default function Sources({ param }: { param?: string | null }) {
  const groups = [...new Set(SOURCES.map((s) => s.publisher))];
  const j = useJourney();
  useEffect(() => {
    if (!param) return;
    const el = document.getElementById('doc-' + param);
    if (el) requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); });
  }, [param]);
  return (
    <>
      <PageHead
        eyebrow="Reference"
        title="Sources & methods"
        lede="Every number on this site comes from an official U.S. government source. Most data were downloaded by a reproducible script from each agency’s API or published files, with the retrieval date listed below. A few figures (the Social Security trustees’ projections, the cost estimates for major laws, and the budget-process record) come from agencies whose websites block automated downloads; those were read from the agencies’ own pages, and each one links to its page."
      />
      <Section id="start" title="Start here" sub="The full chapters of this site, and the main official documents, unedited.">
        <div className="grid-2">
          <div className="card">
            <div className="chart-title">The field guide</div>
            <p className="small muted">Every chapter of this site, with all charts, data tables, and sources.</p>
            <ul className="link-list">
              {FIELD_GUIDE.map((g) => <li key={g.route}><a href={'#' + g.route}>{g.label}</a></li>)}
              <li><a href="#glossary">The glossary</a></li>
            </ul>
          </div>
          <div className="card">
            <div className="chart-title">The original documents</div>
            <p className="small muted">The official sources the numbers come from.</p>
            <ul className="link-list">
              {[
                ['Monthly Treasury Statement', 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/', 'U.S. Treasury'],
                ['Historical Tables of the U.S. Budget', 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/', 'OMB'],
                ['Debt to the Penny', 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/', 'U.S. Treasury'],
                ['2026 Social Security Trustees Report (PDF)', 'https://www.ssa.gov/oact/TR/2026/tr2026.pdf', 'SSA'],
                [OPTIONS_DATA.volume.title, OPTIONS_DATA.volume.url, 'CBO'],
                ['USAspending.gov', 'https://www.usaspending.gov/', 'federal awards by place'],
              ].map(([t, u, by]) => <li key={u}><a href={u} target="_blank" rel="noreferrer" onClick={() => j.mark('doc')}>{t}</a> <span className="muted">({by})</span></li>)}
            </ul>
          </div>
        </div>
      </Section>
      <div className="callout small" id="figures">
        <div className="callout-title">About the figures</div>
        Figures are nominal dollars for federal fiscal years (October 1 – September 30) unless noted. Every chart links to the official dataset it was drawn from. Official data from the U.S. Treasury, OMB, the Census Bureau, the IRS, and USAspending.gov; Treasury data through {budget.mtsLatestDate}.
      </div>
      <Section id="by-level" title="By mission" sub="For each mission of the game: its full chapter and the original documents behind its numbers.">
        <LevelDocs />
      </Section>
      <Section id="list" title="Datasets and documents">
        {groups.map((g) => (
          <div key={g} className="card" style={{ paddingBlock: 6 }}>
            <div className="eyebrow" style={{ paddingTop: 12 }}>{g}</div>
            <div className="source-list">
              {SOURCES.filter((s) => s.publisher === g).map((s) => (
                <div className="source" key={s.id}>
                  <div>
                    <div className="source-title"><a href={s.url} target="_blank" rel="noreferrer" onClick={() => j.mark('doc')}>{s.title}</a></div>
                    {s.note && <div className="source-meta">{s.note}</div>}
                  </div>
                  <div className="source-meta">{s.retrieved ? `Retrieved ${dateLabel(s.retrieved)}` : ''}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section id="methods" title="Methods and definitions">
        <div className="prose">
          <p><strong>Fiscal years.</strong> The federal fiscal year runs from October 1 to September 30 and is named for the year it ends. FY{budget.latestFY} ran from October 1, {budget.latestFY - 1}, to September 30, {budget.latestFY}.</p>
          <p><strong>Spending, revenue, and deficits</strong> are the Treasury’s official totals from the Monthly Treasury Statement (MTS). Each fiscal year’s figures come from the September statement, whose fiscal-year-to-date column covers the full year. Spending is “net outlays”: payments minus offsetting collections such as Medicare premiums.</p>
          <p><strong>Categories.</strong> Spending categories group the Treasury’s budget functions: Social Security (650), Medicare (570), Medicaid & other health (550), Income security (600), Veterans (700), National defense (050), Net interest (900), and everything else, including undistributed offsetting receipts (950).</p>
          <p><strong>Mandatory, discretionary, and interest</strong> splits and the long-run history (FY{cbo.history[0]?.fy}–FY{cbo.history.at(-1)?.fy}) come from the OMB Historical Tables published with the FY2027 budget (Tables 1.1, 2.1, 7.1, 8.1, 10.1). Projections are the {cbo.vintage}, {cbo.projAssumes}.</p>
          <p><strong>Per person and per household</strong> figures divide national totals by the U.S. resident population ({budget.population.label}) and number of households ({budget.households.label}).</p>
          <p><strong>State and district figures</strong> are federal award obligations in FY{geo.fy} from USAspending.gov, by place of performance. Obligations are commitments to spend and differ from outlays; not all federal spending is recorded as an award.</p>
          <p><strong>Social Security</strong> trust fund history (income, cost, and reserves by fiscal year) comes from the Treasury’s Monthly Treasury Statement, Table 8. Depletion dates, the share of benefits payable afterward, and the changes needed to close the gap are from the {ssa.report} (intermediate assumptions), released {dateLabel(ssa.released)}, and the 2026 Medicare Trustees Report.</p>
          <p><strong>Laws.</strong> Deficit effects are the official CBO or JCT estimates published when each law was enacted, as linked on each entry.</p>
          <p><strong>Proposals in Congress.</strong> Each budget-desk card links to the closest real bill we found that proposes the same policy, and each finished plan (on a shared plan's page and in the Budget Story) to the closest real budget proposal from members of Congress. A bill can be older, broader, or go further than the CBO option it is paired with; each card says how it differs. Bills were confirmed through congress.gov and govinfo records, sponsors’ offices, the Congressional Research Service, and news coverage. Where no bill matches, the card links to a search of congress.gov instead.</p>
          <p><strong>Uncle Sam’s voice</strong> was recorded ahead of time with <a href="https://github.com/hexgrad/kokoro" target="_blank" rel="noreferrer">Kokoro</a>, an open-weight neural text-to-speech model (Apache 2.0 license), using its “am_michael” American English voice, run through <a href="https://github.com/thewh1teagle/kokoro-onnx" target="_blank" rel="noreferrer">kokoro-onnx</a>. Every sentence he says is listed in the project’s <code>scripts/voice/lines.json</code>. If you choose one of your device’s voices in the reading settings, the browser’s own speech is used instead.</p>
          <p><strong>Rounding.</strong> Figures are rounded for readability; totals may not add because of rounding.</p>
        </div>
      </Section>
    </>
  );
}

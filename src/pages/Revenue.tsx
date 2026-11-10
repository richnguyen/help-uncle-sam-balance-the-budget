import { useState } from 'react';
import { BarList, TimeChart } from '../components/charts';
import { ChartFrame, Legend, PageHead, Section, Stat, Term } from '../components/ui';
import { budget, fyTotals } from '../data';
import { REVENUE, REVENUE_BY_ID } from '../lib/categories';
import { money, monthShort, pct, signedPct } from '../lib/format';
import { useUnits } from '../lib/units';
import { UnitsToggle } from './Overview';
import { CountyTaxExplorer } from '../game/county';

export default function Revenue() {
  const years = Object.keys(budget.receiptsByFY).map(Number).sort((a, b) => a - b);
  const [fy, setFy] = useState(budget.latestFY);
  const [sel, setSel] = useState<string | null>(null);
  const u = useUnits();
  const rows = budget.receiptsByFY[String(fy)] ?? [];
  const prev = budget.receiptsByFY[String(fy - 1)] ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const t = fyTotals(fy);
  const items = [...rows].sort((a, b) => b.amount - a.amount).map((r) => ({ id: r.id, label: REVENUE_BY_ID[r.id].label, value: r.amount, color: REVENUE_BY_ID[r.id].color }));
  const amt = (y: number, id: string) => budget.receiptsByFY[String(y)]?.find((r) => r.id === id)?.amount ?? null;
  const customsMonths = budget.monthlyBySource.filter((m) => m.fy >= budget.latestFY - 2);
  const cNow = amt(budget.latestFY, 'customs') ?? 0;
  const cPrev = amt(budget.latestFY - 1, 'customs') ?? 0;
  const cPrev2 = amt(budget.latestFY - 2, 'customs') ?? 0;
  const cust = budget.customs.find((c) => c.fy === budget.latestFY);
  const custPrev = budget.customs.find((c) => c.fy === budget.latestFY - 1);

  return (
    <>
      <PageHead
        eyebrow="Where it comes from"
        title="Where the money comes from"
        lede={<>Almost all federal revenue comes from taxes on what people earn. In FY{fy}, individual income taxes and payroll taxes together brought in {pct(((amt(fy, 'individual') ?? 0) + (amt(fy, 'payroll') ?? 0)) / total, 0)} of all revenue.</>}
      />
      <div className="toolbar">
        <div className="toolbar-item">
          <label htmlFor="rv-fy">Fiscal year</label>
          <select id="rv-fy" className="select" value={fy} onChange={(e) => { setFy(Number(e.target.value)); setSel(null); }}>
            {[...years].reverse().map((y) => <option key={y} value={y}>FY{y}</option>)}
          </select>
        </div>
        <UnitsToggle />
      </div>

      <Section id="sources" title={`FY${fy} revenue by source`} sub={`Total receipts: ${money(t.receipts)}. Select a row to see what each source is.`}>
        <div className="card">
          <BarList
            items={items}
            total={total}
            format={u.fmt}
            selected={sel}
            onSelect={setSel}
            renderDetail={(id) => {
              const cur = rows.find((r) => r.id === id)!.amount;
              const p = prev.find((r) => r.id === id)?.amount;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p>{REVENUE_BY_ID[id as keyof typeof REVENUE_BY_ID].blurb}</p>
                  {p ? <p className="small muted">FY{fy - 1}: {money(p)} · change {signedPct(cur / p - 1)}</p> : null}
                  {id === 'payroll' && fy === budget.latestFY && budget.payroll.length > 0 && (
                    <div>
                      <p className="small" style={{ marginBottom: 6 }}><strong>Where payroll taxes go</strong> (by trust fund)</p>
                      <BarList items={budget.payroll.slice(0, 6).map((p) => ({ id: p.name, label: p.name, value: p.amount, color: 'var(--c-medicare)' }))} format={u.fmt} />
                    </div>
                  )}
                </div>
              );
            }}
          />
        </div>
      </Section>

      <Section id="trend" title="Revenue over time" sub="Receipts by source for each fiscal year. Revenue rises with wages and profits and falls in recessions.">
        <div className="card">
          <ChartFrame
            title="Federal receipts by source"
            legend={<Legend items={REVENUE.map((r) => ({ label: r.label, color: r.color }))} />}
            sourceIds={['mts9']}
            table={{
              columns: [{ key: 'fy', label: 'Fiscal year' }, ...REVENUE.map((r) => ({ key: r.id, label: r.label, align: 'r' as const })), { key: 't', label: 'Total', align: 'r' }],
              rows: years.map((y) => ({ fy: `FY${y}`, ...Object.fromEntries(REVENUE.map((r) => [r.id, money(amt(y, r.id) ?? 0)])), t: money(fyTotals(y)?.receipts ?? 0) })),
            }}
          >
            <TimeChart
              label="Federal receipts by source and fiscal year"
              x={years}
              xLabel={(y) => `’${String(y).slice(2)}`}
              tipTitle={(y) => `FY${y}`}
              height={320}
              series={REVENUE.map((r) => ({ id: r.id, label: r.label, color: r.color, kind: 'bar' as const, stack: 'rev', values: years.map((y) => amt(y, r.id)) }))}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section id="county-tax" title="Who pays the income tax where you live" sub="Individual income tax is the biggest source of federal revenue. Here’s who paid it in each state and county, by income, from the IRS’s figures for tax year 2023, next to the whole country. Pick a state and a county; if you’ve given the game your ZIP code, it starts with yours.">
        <div className="card">
          <CountyTaxExplorer />
        </div>
      </Section>

      <Section
        id="tariffs"
        eyebrow="Spotlight"
        title="Tariff revenue"
        sub={<>Customs duties are taxes on imports, paid by the business that brings the goods into the country; much of that cost can be passed on to buyers through higher prices. Net collections were {money(cPrev2)} in FY{budget.latestFY - 2}, {money(cPrev)} in FY{budget.latestFY - 1}, and {money(cNow)} in FY{budget.latestFY}.</>}
      >
        {cust && (
          <div className="grid-3">
            <div className="card"><Stat label={`Collected, FY${cust.fy}`} value={money(cust.gross)} note="Gross customs duties paid by importers." /></div>
            <div className="card"><Stat label={`Refunded, FY${cust.fy}`} value={money(cust.refunds)} note={custPrev ? `Up from ${money(custPrev.refunds)} in FY${custPrev.fy}.` : undefined} /></div>
            <div className="card"><Stat label={`Kept (net), FY${cust.fy}`} value={money(cust.net)} note="What counts as federal revenue." /></div>
          </div>
        )}
        <p className="small" style={{ maxWidth: 'var(--measure)', color: 'var(--ink-2)' }}>
          On February 20, 2026, the Supreme Court ruled in <a href="https://www.supremecourt.gov/opinions/25pdf/24-1287_4gcj.pdf" target="_blank" rel="noreferrer"><em>Learning Resources, Inc. v. Trump</em></a> that the International Emergency Economic Powers Act does not authorize the President to impose tariffs. Tariffs collected under that law are being refunded to importers, which is why net customs receipts in the Treasury’s monthly statements fell below zero in mid-2026: refunds paid out exceeded new duties collected.
        </p>
        <div className="card">
          <ChartFrame title="Customs duties collected each month" sub={`FY${budget.latestFY - 2} through FY${budget.latestFY}`} sourceIds={['mts9']}
            table={{ columns: [{ key: 'm', label: 'Month' }, { key: 'v', label: 'Customs duties', align: 'r' }], rows: customsMonths.map((m) => ({ m: `${monthShort(m.date)} ${m.date.slice(0, 4)}`, v: money(m.values.customs ?? 0) })) }}
          >
            <TimeChart
              label="Monthly customs duties"
              x={customsMonths.map((m) => m.date)}
              xLabel={(d) => { const s = String(d); return s.slice(5, 7) === '10' ? `Oct ’${s.slice(2, 4)}` : `Apr ’${s.slice(2, 4)}`; }}
              xTicks={customsMonths.map((m, i) => (['10', '04'].includes(m.date.slice(5, 7)) ? i : -1)).filter((i) => i >= 0)}
              zeroLine
              tipTitle={(d) => `${monthShort(String(d))} ${String(d).slice(0, 4)}`}
              height={240}
              series={[{ id: 'customs', label: 'Customs duties', color: 'var(--c-income)', kind: 'bar', values: customsMonths.map((m) => m.values.customs ?? null) }]}
            />
          </ChartFrame>
        </div>
      </Section>

      <Section id="basics" title="Three things to know about federal taxes">
        <div className="facts">
          <div className="fact"><div className="fact-big">Payroll taxes are earmarked</div><p>The 12.4% Social Security tax and 2.9% Medicare tax (split between workers and employers) go into <Term id="trust-fund">trust funds</Term> that can only pay those programs’ benefits.</p></div>
          <div className="fact"><div className="fact-big">Income tax is progressive</div><p>Rates rise from 10% to 37% as taxable income rises, so higher earners pay a larger share of each additional dollar. See your own estimate on the <a href="#receipt">tax receipt</a> page.</p></div>
          <div className="fact"><div className="fact-big">Revenue swings with the economy</div><p>Receipts drop in recessions, when incomes and profits fall, and jump when markets and wages are strong. Tax law changes also move them, as the <a href="#laws">laws page</a> shows.</p></div>
        </div>
      </Section>
    </>
  );
}

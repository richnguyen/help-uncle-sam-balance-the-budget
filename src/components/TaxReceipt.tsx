import { useMemo, useState } from 'react';
import { Popup } from './Popup';
import { budget, debt, fyTotals, POP, tax } from '../data';
import type { FilingStatus } from '../data/types';
import { categoryTotals } from '../lib/derive';
import { dollars, pct } from '../lib/format';
import { load, save } from '../lib/storage';
import { estimateTaxes } from '../lib/tax';

// The federal tax receipt: what a salary pays in federal income and payroll taxes, and where
// those dollars went. Shared by level 1 and the "Your tax receipt" page; the salary and filing
// status are remembered in this browser, so both show the same receipt.

export type Method = 'simple' | 'dedicated';

export const STATUS: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married filing jointly' },
  { value: 'head', label: 'Head of household' },
];

const SLIDER_MAX = 400000;
const cents = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The salary and filing status, saved in this browser. */
export function useWages() {
  const [wages, setWagesState] = useState<number>(() => load('wages', 65000));
  const [status, setStatusState] = useState<FilingStatus>(() => load('status', 'single' as FilingStatus));
  const setWages = (v: number) => {
    const x = Math.max(0, Math.min(10_000_000, Math.round(Number.isFinite(v) ? v : 0)));
    setWagesState(x);
    save('wages', x);
  };
  const setStatus = (s: FilingStatus) => { setStatusState(s); save('status', s); };
  return { wages, setWages, status, setStatus };
}

/** A salary slider (with an exact amount box) and the filing status. */
export function WageControls({ id, wages, setWages, status, setStatus }: { id: string } & ReturnType<typeof useWages>) {
  return (
    <div className="wagectl">
      <div className="field">
        <label htmlFor={id + '-range'}>Your yearly salary: <strong className="num wagectl-value">{dollars(wages)}</strong></label>
        <input id={id + '-range'} className="wagectl-range" type="range" min={0} max={SLIDER_MAX} step={1000} value={Math.min(wages, SLIDER_MAX)} onChange={(e) => setWages(Number(e.target.value))} aria-valuetext={dollars(wages)} />
        <div className="wagectl-ticks" aria-hidden="true"><span>$0</span><span>$100K</span><span>$200K</span><span>$300K</span><span>$400K</span></div>
      </div>
      <div className="wagectl-row">
        <div className="field">
          <label htmlFor={id + '-exact'}>Exact amount</label>
          <input id={id + '-exact'} className="input" type="number" inputMode="numeric" min={0} step={1000} value={wages} onChange={(e) => setWages(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor={id + '-status'}>Filing status</label>
          <select id={id + '-status'} className="select" value={status} onChange={(e) => setStatus(e.target.value as FilingStatus)}>
            {STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

/**
 * What a salary pays in federal income and payroll taxes, and where those dollars went.
 * "simple": every tax dollar is split like total spending. "dedicated": payroll taxes go to their
 * trust-fund programs, and income tax is split across the rest.
 */
export function receiptFor(wages: number, status: FilingStatus, method: Method = 'dedicated') {
  const fy = budget.latestFY;
  const t = fyTotals(fy);
  const cats = categoryTotals(fy);
  const r = estimateTaxes(wages, status, tax);
  const totalOut = cats.reduce((s, c) => s + c.amount, 0);
  let lines;
  if (method === 'simple') lines = cats.map((c) => ({ ...c, mine: (r.total * c.amount) / totalOut }));
  else {
    const dedicated: Record<string, number> = {
      ss: budget.payroll.filter((p) => /OASI|\(DI\)/.test(p.name)).reduce((s, p) => s + p.amount, 0),
      medicare: budget.payroll.filter((p) => /\(HI\)/.test(p.name)).reduce((s, p) => s + p.amount, 0),
    };
    const remaining = cats.map((c) => Math.max(0, c.amount - (dedicated[c.id] ?? 0)));
    const remTotal = remaining.reduce((s, v) => s + v, 0);
    lines = cats.map((c, i) => ({
      ...c,
      mine: (c.id === 'ss' ? r.ssTax : c.id === 'medicare' ? r.medicareTax : 0) + (r.incomeTax * remaining[i]) / remTotal,
    }));
  }
  return { fy, t, r, lines, borrowedOnTop: r.total * (t.deficit / t.receipts) };
}

/** The receipt in a pop-up, printed out of the top like a real one (see Popup). */
export function ReceiptPopup({ wages, status, onClose }: { wages: number; status: FilingStatus; onClose: () => void }) {
  return (
    <Popup title="Your federal tax receipt" onClose={onClose} className="popup-receipt" actions={<a className="btn" href="#receipt" onClick={onClose}>More options</a>}>
      <div className="receipt-print"><TaxReceipt wages={wages} status={status} /></div>
    </Popup>
  );
}

/** A one-line summary of the receipt, with the button that prints the whole thing in a pop-up. */
export function ReceiptTeaser({ wages, status }: { wages: number; status: FilingStatus }) {
  const [open, setOpen] = useState(false);
  const r = estimateTaxes(wages, status, tax);
  return (
    <div className="receipt-teaser">
      <span className="stat-label">You pay in federal taxes</span>
      <strong className="receipt-teaser-num num">{dollars(r.total)} <span>a year</span></strong>
      <span className="small muted">{pct(r.effective)} of your salary: income tax {dollars(r.incomeTax)}, Social Security {dollars(r.ssTax)}, Medicare {dollars(r.medicareTax)}.</span>
      <button type="button" className="btn btn-primary receipt-teaser-btn" onClick={() => setOpen(true)}>Print my receipt</button>
      {open && <ReceiptPopup wages={wages} status={status} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** The receipt itself. */
export function TaxReceipt({ wages, status, method = 'dedicated' }: { wages: number; status: FilingStatus; method?: Method }) {
  const { fy, t, r, lines, borrowedOnTop } = useMemo(() => receiptFor(wages, status, method), [wages, status, method]);
  const debtShare = debt.latest.total / POP;

  return (
    <div className="receipt" role="table" aria-label="Your federal tax receipt">
      <h3>Federal tax receipt</h3>
      <div className="small muted" style={{ textAlign: 'center', marginTop: 4 }}>Based on FY{fy} spending · {STATUS.find((s) => s.value === status)!.label} · {dollars(wages)} salary</div>
      <div className="rule" />
      <div className="receipt-row"><span /><span>Federal income tax</span><span className="v">{cents(r.incomeTax)}</span></div>
      <div className="receipt-row"><span /><span>Social Security tax (6.2%)</span><span className="v">{cents(r.ssTax)}</span></div>
      <div className="receipt-row"><span /><span>Medicare tax (1.45%{r.wages > tax.addlMedicareThreshold[status] ? ' + 0.9%' : ''})</span><span className="v">{cents(r.medicareTax)}</span></div>
      <div className="rule" />
      <div className="receipt-row receipt-total"><span /><span>You paid</span><span className="v">{cents(r.total)}</span></div>
      <div className="small muted" style={{ textAlign: 'right' }}>{pct(r.effective)} of your salary</div>
      <div className="rule" />
      <div className="small muted" style={{ margin: '4px 0 6px' }}>WHERE IT WENT</div>
      {[...lines].sort((a, b) => b.mine - a.mine).map((l) => (
        <div className="receipt-row" key={l.id}>
          <span className="swatch" style={{ background: l.color }} />
          <span>{l.label}</span>
          <span className="v">{cents(l.mine)}</span>
        </div>
      ))}
      <div className="rule" />
      <div className="receipt-row"><span className="swatch" style={{ background: 'repeating-linear-gradient(135deg, var(--c-borrow-ink) 0 2px, transparent 2px 4px)' }} /><span>Also borrowed on your behalf</span><span className="v">{cents(borrowedOnTop)}</span></div>
      <p className="small muted" style={{ marginTop: 8 }}>
        In FY{fy} the government spent {pct(t.outlays / t.receipts - 1, 0)} more than it collected. For every dollar you paid, it borrowed about {Math.round((t.deficit / t.receipts) * 100)}¢ more to cover the gap. Your per-person share of the total debt: {dollars(debtShare)}.
      </p>
    </div>
  );
}

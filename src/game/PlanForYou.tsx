import { useState } from 'react';
import { Popup } from '../components/Popup';
import { useWages, WageControls } from '../components/TaxReceipt';
import { LAST_FY } from '../lib/assess';
import { dollars } from '../lib/format';
import { partOfTheFix, type PersonalEffect, personalEffect } from '../lib/personal';
import type { Levers } from '../lib/sandbox';

// "Your part of the fix", on the budget desk: what the plan changes in the player's own federal
// taxes, set next to what that buys (the borrowing it stops and the interest it saves, per
// household). The cost is never hidden: a tax increase is called one, with each card's amount.
// The salary is the one set on level 1 and the tax receipt page, kept in this browser.

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${dollars(Math.abs(v))}`;
const cents = (v: number) => `$${Math.abs(v).toFixed(2)}`;

// On the desk it is a short summary and a button; the whole thing (the salary, each card's
// amount, what it buys) opens in a pop-up, so the desk stays about the cards.
export function PlanForYou({ ids, lv, gradual }: { ids: string[]; lv: Levers; gradual: boolean }) {
  const w = useWages();
  const [open, setOpen] = useState(false);
  const pe = personalEffect(ids, lv, gradual, w.wages, w.status);
  if (!ids.length && !Object.values(lv).some(Boolean)) return null;
  const fix = partOfTheFix(ids, lv, gradual, pe);
  const up = pe.direct >= 1, down = pe.direct <= -1;
  const headline = up ? <>Your part of the fix: {dollars(pe.direct)} a year</> : down ? <>Your own taxes: {dollars(-pe.direct)} a year less</> : <>Your part of the fix: no change to your own taxes</>;
  return (
    <section className="card planforyou planforyou-teaser" aria-labelledby="pfy-t">
      <div className="eyebrow">What this plan means for you</div>
      <h2 className="section-title" id="pfy-t">{headline}</h2>
      <p className="small">
        {up ? <>About {cents(fix.perDay)} a day in your own federal taxes. </> : down ? <>About {cents(-fix.perDay)} a day less in your own federal taxes. </> : null}
        {fix.borrowingCut > 0 ? <>Your plan cuts what Uncle Sam borrows each year by about {dollars(fix.borrowingCut)} per household by FY{fix.lastFY}.</> : null}
      </p>
      <button type="button" className="btn btn-primary pfy-open" onClick={() => setOpen(true)}>See your part of the fix</button>
      {open && (
        <Popup title={headline} onClose={() => setOpen(false)} className="popup-pfy">
          <PlanForYouDetails pe={pe} fix={fix} w={w} up={up} down={down} />
        </Popup>
      )}
    </section>
  );
}

function PlanForYouDetails({ pe, fix, w, up, down }: { pe: PersonalEffect; fix: ReturnType<typeof partOfTheFix>; w: ReturnType<typeof useWages>; up: boolean; down: boolean }) {
  return (
    <div className="pfy-details">
      <div className="pfy-fix">
        <p>
          {up ? <>That’s about <strong>{cents(fix.perDay)} a day</strong> more in your own federal taxes. </> : down ? <>Your plan lowers your own federal taxes by about {cents(-fix.perDay)} a day. </> : <>Your plan does its work without changing your own income or payroll taxes at this salary. </>}
          {fix.borrowingCut > 0 && <>Together with everyone else’s part, it cuts what Uncle Sam borrows each year by about <strong>{dollars(fix.borrowingCut)} per household</strong> by FY{fix.lastFY}{fix.interestSaved > 1 ? <>, and saves about <strong>{dollars(fix.interestSaved)} per household</strong> in interest that year</> : null}.</>}
        </p>
        <p className="small">For scale: interest on the debt already costs about {dollars(fix.interestToday)} per household a year{fix.interestBeatsDefense ? ', more than national defense' : ''}. Every dollar of borrowing a plan stops is a dollar that doesn’t add to that bill.</p>
      </div>
      <div className="pfy-grid">
        <div>
          <WageControls id="pfy" {...w} />
        </div>
        <div>
          {pe.lines.length ? (
            <>
              <div className="stat-label">Where your part comes from</div>
              <ul className="pfy-lines">{pe.lines.map((l) => <li key={l.id}><span>{l.label}</span><strong className="num">{signed(l.amount)}</strong></li>)}</ul>
            </>
          ) : <p className="small">None of your cards changes your own income or payroll taxes at this salary.</p>}
          {pe.prices.perHousehold > 0 && (
            <p className="small"><strong>Through prices:</strong> {pe.prices.names.join('; ')}. Spread across every household, about {dollars(pe.prices.perHousehold)} a year by FY{LAST_FY}; what you pay depends on what you buy.</p>
          )}
          {pe.breaks.length > 0 && <p className="small"><strong>Tax breaks:</strong> {pe.breaks.join('; ')}.</p>}
          {pe.benefits.length > 0 && <p className="small"><strong>Programs and benefits:</strong> {pe.benefits.join('; ')}. These reach people through benefits and services rather than taxes.</p>}
          <p className="small muted">A wage earner with no other income taking the standard deduction, under current tax rules. Employers pay a matching share of payroll taxes, not shown. Borrowing and interest per household: CBO’s baseline with this plan, divided across all U.S. households.</p>
        </div>
      </div>
    </div>
  );
}

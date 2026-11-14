import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OPTIONS_DATA } from '../lib/planData';
import { MULT } from '../lib/plan';
import { TWISTS } from '../lib/twists';
import { debt, SOURCE_BY_ID } from '../data';

/** Same as MyShare's: the Treasury's latest average rate, and ten years of payments. */
const RATE = debt.rates.at(-1)!;
const YEARS = 10;

// "How this is rated": for every number the game rates on its own (how steep a plan is, how big a
// ripple a card sends through the economy, the interest a payment would save, and the rules of
// thumb in missions 2.5 and 2.6), the method, the official source it rests on, and what it leaves
// out. It opens in place, so the player never leaves the screen to check the fine print.

interface Src { title: string; url: string }
interface Method { title: string; lead?: string; method: ReactNode; sources: Src[]; leaves: ReactNode }

const principle = (id: string): Src => {
  const p = OPTIONS_DATA.principles.find((x) => x.id === id)!;
  return p.source;
};
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
const range = (k: keyof typeof MULT) => `${MULT[k].lo.toFixed(1)}–${MULT[k].hi.toFixed(1)}`;

const OPTIONS_VOLUME: Src = { title: `CBO, ${OPTIONS_DATA.volume.title} (Dec 2024)`, url: OPTIONS_DATA.volume.url };
const RATES: Src = { title: 'U.S. Treasury, Average Interest Rates on U.S. Treasury Securities', url: 'https://fiscaldata.treasury.gov/datasets/average-interest-rates-treasury-securities/average-interest-rates-on-u-s-treasury-securities' };
const INVESTMENT: Src = { title: 'CBO, The Macroeconomic and Budgetary Effects of Federal Investment (June 2016)', url: 'https://www.cbo.gov/publication/51628' };

/** CBO's options carry conventional estimates; the game shows a dynamic one only where CBO or JCT published it. */
export const DYNAMIC_NOTE = <>CBO’s estimates for these options are <em>conventional</em>: they leave out how the change would move the economy and, through it, the budget. CBO and the Joint Committee on Taxation publish <em>dynamic</em> estimates only for some major bills; the game shows one only where they have, and none of the options in the game has one.</>;

/** Built on first use, once the data modules have loaded. */
const methods = () => ({
  steep: {
    title: 'How “gentle, moderate, steep” is rated',
    method: <>Each year, the game adds up how much your plan tightens the budget (new taxes plus spending cuts, from CBO’s estimates for each card) as a share of GDP, and finds the biggest jump from one year to the next. Gentle is 0.5% of GDP or less, moderate up to 1%, steep above that. Phasing in over 3 years starts each change at a third of its full size, then two-thirds, then all of it.</>,
    sources: [principle('gradual'), OPTIONS_VOLUME],
    leaves: <>The thresholds are the game’s own, set in line with the IMF’s advice that a fix be gradual; no agency publishes a “steep” line. It doesn’t weigh which cards you chose (that’s the ripple), or what the Federal Reserve or the rest of the world would do in response.</>,
  },
  ripple: {
    title: 'How the ripple is ranked',
    method: <>Each card belongs to one of CBO’s categories, and each category has a range for how much a dollar of it moves the economy in the first year: for example {range('taxHigh')} for taxes on higher-income people and {range('purchases')} for what the government buys. The game multiplies the dollars by the middle of that range and ranks the cards by the result.</>,
    sources: [principle('multipliers')],
    leaves: <>Where in the range the real effect lands; CBO says it’s larger in a slump than in a boom. Long-run effects on growth (shown separately on each card, from CBO’s description of the option). And the economy’s feedback on the budget itself.</>,
  },
  interest: {
    title: 'How the interest saved is figured',
    method: <>The same payment goes toward the debt at the start of each of {YEARS} years. A dollar paid down <i>j</i> years before the end saves (1 + <i>r</i>)<sup><i>j</i></sup> − 1 by then, because the interest it avoids isn’t borrowed either. <i>r</i> is the Treasury’s average interest rate on all its interest-bearing debt: {pct(RATE.total / 100)} in {new Date(RATE.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</>,
    sources: [RATES],
    leaves: <>Changes in rates over the decade (CBO projects them separately), and any effect a smaller debt would have on rates themselves. Your taxes already pay for this year’s budget; the card shows what the same dollars would save if they went to the debt.</>,
  },
  growth: {
    title: 'How the slice of income is figured',
    method: <>A straight line through one CBO comparison: debt held at about 100% of GDP, instead of rising to CBO’s projected 156% by 2055, leaves income per person about 4% higher. The game reads your slider off that line.</>,
    sources: [principle('debt-growth')],
    leaves: <>Past 156% the line is the game’s extension, not CBO’s. Real effects aren’t a straight line, and they depend on interest rates and on how the debt is brought down.</>,
  },
  investment: {
    title: 'How the bridge is figured',
    method: <>CBO estimates federal investment in infrastructure, education and research returns about 5% a year on average, half the return on private investment. Each year’s cut is investment not made, and every dollar of it stays missing: in each later year the economy loses the 5% it would have returned. The savings are CBO’s estimate for the card, scaled to your cut.</>,
    sources: [INVESTMENT, OPTIONS_VOLUME],
    leaves: <>Wear and tear on what was built, and the lag: the payoff from schools and research can take a decade or more to arrive. Projects vary widely; some return much more, some less.</>,
  },
  ...Object.fromEntries(Object.values(TWISTS).map((t) => [t!.id, {
    title: t!.id === 'rates' ? 'How the rate shock works' : 'How the recession works',
    lead: t!.line,
    method: <>{t!.method}</>,
    sources: t!.sources.map((id) => SOURCE_BY_ID[id]).filter(Boolean).map((x) => ({ title: `${x.publisher}, ${x.title}`, url: x.url })),
    leaves: <>{t!.leaves} It’s a test of the plan, not a forecast; the goal and the stars are judged with the twist in place for everyone on this desk, friends’ challenges and showdowns included.</>,
  }])) as Record<'rates' | 'recession', Method>,
}) satisfies Record<string, Method>;
export type MethodId = keyof ReturnType<typeof methods>;
let cache: ReturnType<typeof methods> | null = null;
export const methodOf = (id: MethodId): Method => (cache ??= methods())[id];

function Body({ m }: { m: Method }) {
  return (
    <>
      {m.lead && <p className="rated-lead">{m.lead}</p>}
      <p><span className="rated-k">Method</span> {m.method}</p>
      <p><span className="rated-k">Leaves out</span> {m.leaves}</p>
      <p className="rated-dyn"><span className="rated-k">Estimates</span> {DYNAMIC_NOTE}</p>
      <p className="rated-src"><span className="rated-k">Sources</span> {m.sources.map((s, i) => <span key={s.url}>{i > 0 && '; '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
    </>
  );
}

/**
 * The scoreboard's version: a small "i" next to a gauge's name. It opens the same method as a
 * sheet over the page (Escape, the close button or a tap outside closes it, and focus goes back to
 * the "i"), so the gauge itself carries no extra words.
 */
function RatedIcon({ id, label }: { id: MethodId; label: string }) {
  const m = methodOf(id);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const uid = useId();
  useEffect(() => {
    if (!open) return;
    sheet.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); btn.current?.focus(); };
  }, [open]);
  return (
    <>
      <button ref={btn} type="button" className="rated-i" data-rated={id} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="10" cy="6.2" r="1.15" fill="currentColor" /><path d="M10 9v5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      {open && createPortal(
        <div className="rated-scrim" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div ref={sheet} className="rated-sheet rated" data-rated={id} role="dialog" aria-modal="true" aria-labelledby={uid} tabIndex={-1}>
            <div className="rated-sheet-head">
              <strong className="rated-title" id={uid}>{m.title}</strong>
              <button type="button" className="icon-btn rated-close" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="rated-body"><Body m={m} /></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** A "How this is rated" link that opens the method, its sources, and what it leaves out. */
export function Rated({ id, label = 'How this is rated', icon = false }: { id: MethodId; label?: string; icon?: boolean }) {
  if (icon) return <RatedIcon id={id} label={label} />;
  const m = methodOf(id);
  return (
    <details className="rated" data-rated={id}>
      <summary>{label}</summary>
      <div className="rated-body">
        <strong className="rated-title">{m.title}</strong>
        <Body m={m} />
      </div>
    </details>
  );
}

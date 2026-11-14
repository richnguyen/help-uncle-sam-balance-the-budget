import { useState } from 'react';

// The filter above a long list of policy cards (Pass the budget, the People's Budget): everything,
// taxes, cuts, or what's in the plan now. Keeps a 24-card list to a screen or two on a phone.

export type CardFilter = 'all' | 'tax' | 'cut' | 'in';
const LABEL: Record<CardFilter, string> = { all: 'All', tax: 'Taxes', cut: 'Spending', in: 'In the plan' };

export function useCardFilter(inCount: number) {
  const [f, setF] = useState<CardFilter>('all');
  // "In the plan" goes away when nothing is in; then the filter falls back to everything.
  const active: CardFilter = f === 'in' && !inCount ? 'all' : f;
  const keep = (o: { side: string }, isIn: boolean) => active === 'all' || (active === 'in' ? isIn : (o.side === 'revenue') === (active === 'tax'));
  const pills = (
    <div className="card-filter" role="group" aria-label="Show which cards">
      {(['all', 'tax', 'cut', 'in'] as const).filter((k) => k !== 'in' || inCount > 0).map((k) => (
        <button key={k} type="button" className="feed-pill" aria-pressed={active === k} onClick={() => setF(k)}>{LABEL[k]}{k === 'in' ? ` (${inCount})` : ''}</button>
      ))}
    </div>
  );
  return { pills, keep, active };
}

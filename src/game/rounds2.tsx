import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useHaptics } from './haptics';
import type { Done } from './minigame';
import { SamSays } from './UncleSam';

// Round types for the budget-process missions: a memory match, referee calls against a spending
// limit, striking what doesn't belong in a bill, running an agency's year so the money lasts, and
// balancing the PAYGO scorecards. Each scores up to 100 points. Where a round uses a made-up
// example to practice a real rule, it says so on screen.

const usd = (b: number) => `${b < 0 ? '−' : ''}$${Math.abs(b)} billion`;
const usdM = (m: number) => `$${m} million`;
const Practice = ({ children }: { children: ReactNode }) => <p className="practice small"><strong>Practice example.</strong> {children}</p>;

// ---------- memory match: flip a "who" and a "what" each turn ----------
export interface MemoryPair { id: string; who: string; what: string }
/** A fixed shuffle, so every play deals the same board (and tests can rely on it). */
const deal = <T,>(xs: T[], seed: number) => { const a = [...xs]; let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function MemoryRound({ pairs, intro, done, prompt }: { pairs: MemoryPair[]; intro: ReactNode; done: Done; prompt: string }) {
  const whos = useMemo(() => deal(pairs.map((p) => p.id), 7), [pairs]);
  const whats = useMemo(() => deal(pairs.map((p) => p.id), 19), [pairs]);
  const [open, setOpen] = useState<{ who?: string; what?: string }>({});
  const [matched, setMatched] = useState<string[]>([]);
  const [turns, setTurns] = useState(0);
  const [miss, setMiss] = useState(false);
  const buzz = useHaptics();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const finished = matched.length === pairs.length;
  const by = (id: string) => pairs.find((p) => p.id === id)!;
  const flip = (side: 'who' | 'what', id: string) => {
    if (finished || matched.includes(id) || miss) return;
    const next = { ...open, [side]: id };
    setOpen(next); buzz('tap');
    if (next.who && next.what) {
      const t = turns + 1; setTurns(t);
      if (next.who === next.what) {
        const m = [...matched, next.who]; setMatched(m); setOpen({}); buzz('right');
        if (m.length === pairs.length) {
          const best = pairs.length + 4; // a few misses are expected even with perfect knowledge
          done(Math.max(20, 100 - 8 * Math.max(0, t - best)), `All ${pairs.length} matched in ${t} turns.`);
        }
      } else {
        setMiss(true); buzz('wrong');
        timer.current = window.setTimeout(() => { setOpen({}); setMiss(false); }, 1100);
      }
    }
  };
  const card = (side: 'who' | 'what', id: string, k: number) => {
    const up = matched.includes(id) || open[side] === id;
    const text = side === 'who' ? by(id).who : by(id).what;
    return (
      <button key={side + id} type="button" className="mem-card" data-side={side} data-up={up || undefined} data-matched={matched.includes(id) || undefined} disabled={matched.includes(id)}
        aria-label={up ? text : `${side === 'who' ? 'Who' : 'What'} card ${k + 1}, face down`} onClick={() => flip(side, id)}>
        <span className="mem-face">{up ? text : side === 'who' ? 'Who?' : 'What?'}</span>
      </button>
    );
  };
  return (
    <div className="quiz">
      <SamSays mood={finished ? 'proud' : miss ? 'thinking' : 'happy'} compact auto>{intro}</SamSays>
      <div className="card quiz-card memory" role="group" aria-labelledby="mem-q">
        <h2 className="quiz-q" id="mem-q">{prompt}</h2>
        <div className="pairs-count small muted">Each turn, flip one “Who?” card and one “What?” card. {matched.length} of {pairs.length} matched · {turns} turns{miss ? ' · not a match' : ''}</div>
        <div className="mem-grid" data-side="who" aria-label="Who cards">{whos.map((id, k) => card('who', id, k))}</div>
        <div className="mem-grid" data-side="what" aria-label="What cards">{whats.map((id, k) => card('what', id, k))}</div>
      </div>
    </div>
  );
}

// ---------- referee calls: each bill against the subcommittee's limit ----------
export interface RefBill { label: string; cost: number; waive?: number }
export function RefereeRound({ limit, bills, intro, done, prompt }: { limit: number; bills: RefBill[]; intro: ReactNode; done: Done; prompt: string }) {
  const [k, setK] = useState(0);
  const [used, setUsed] = useState(0);
  const [call, setCall] = useState<'poo' | 'pass' | null>(null);
  const [right, setRight] = useState(0);
  const buzz = useHaptics();
  const b = bills[k];
  const breach = b.cost > 0 && used + b.cost > limit;
  const waived = breach && (b.waive ?? 0) >= 60;
  const last = k === bills.length - 1;
  const decide = (c: 'poo' | 'pass') => {
    if (call) return;
    setCall(c);
    const ok = (c === 'poo') === breach;
    const r = right + (ok ? 1 : 0); setRight(r);
    buzz(ok ? 'right' : 'wrong');
    if (last) done((100 * r) / bills.length, `${r} of ${bills.length} calls right.`);
  };
  const next = () => {
    if (!breach || waived) setUsed((u) => u + b.cost);
    setK((x) => x + 1); setCall(null); buzz('tap');
  };
  const after = !breach || waived ? used + b.cost : used;
  return (
    <div className="quiz">
      <SamSays mood="happy" compact auto>{intro}</SamSays>
      <div className="card quiz-card referee" role="group" aria-labelledby="ref-q">
        <h2 className="quiz-q" id="ref-q">{prompt}</h2>
        <Practice>A made-up subcommittee and bills. The rule is real: a bill that would push spending past the committee’s allocation is out of order, if a member raises the point.</Practice>
        <div className="ref-meter" role="img" aria-label={`${usd(used)} of the ${usd(limit)} limit used`}>
          <span className="ref-fill" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} data-over={used > limit || undefined} />
          <span className="ref-limit-label small">Limit {usd(limit)} · used {usd(used)} · room {usd(Math.max(0, limit - used))}</span>
        </div>
        <div className="pairs-count small muted">Bill {k + 1} of {bills.length} · {right} right calls</div>
        <div className="ref-bill">
          <strong>{b.label}</strong>
          <span className="num">{b.cost < 0 ? `saves ${usd(-b.cost)}` : `costs ${usd(b.cost)}`}</span>
        </div>
        {!call ? (
          <div className="pairs-row">
            <button type="button" className="pairs-pick ref-call" data-call="poo" onClick={() => decide('poo')}><strong>Point of order!</strong><span className="small muted">It breaks the limit</span></button>
            <button type="button" className="pairs-pick ref-call" data-call="pass" onClick={() => decide('pass')}><strong>Let it through</strong><span className="small muted">It fits</span></button>
          </div>
        ) : (
          <div className="quiz-feedback" data-ok={(call === 'poo') === breach} role="status">
            <strong>{(call === 'poo') === breach ? 'Good call.' : 'Wrong call.'}</strong>{' '}
            {b.cost < 0 ? 'A bill that cuts spending can’t break a spending limit.' : breach ? `It would bring spending to ${usd(used + b.cost)}, past the ${usd(limit)} limit.` : `It fits: spending goes to ${usd(used + b.cost)}.`}
            {breach && (waived ? ` In the Senate, ${b.waive} senators vote to waive the point of order. That’s at least 60, so it goes through anyway.` : ` In the Senate, ${b.waive ?? 'fewer than 60'} senators vote to waive it: short of 60, so it’s out of order.`)}
            {' '}Spending now: {usd(after)}.
            {!last && <> <button type="button" className="btn btn-sm pairs-next" onClick={next}>Next bill</button></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- strike it out: what doesn't belong in a reconciliation bill ----------
export interface Provision { label: string; budget: boolean }
export function StrikeRound({ provisions, intro, done, prompt }: { provisions: Provision[]; intro: ReactNode; done: Done; prompt: string }) {
  const [struck, setStruck] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const buzz = useHaptics();
  const ok = (i: number) => struck.includes(i) === !provisions[i].budget;
  const toggle = (i: number) => { if (locked) return; setStruck((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i])); buzz('tap'); };
  const lock = () => {
    setLocked(true);
    const r = provisions.filter((_, i) => ok(i)).length;
    done((100 * r) / provisions.length, `${r} of ${provisions.length} provisions handled right.`);
  };
  return (
    <div className="quiz">
      <SamSays mood="happy" compact auto>{intro}</SamSays>
      <div className="card quiz-card strike" role="group" aria-labelledby="strike-q">
        <h2 className="quiz-q" id="strike-q">{prompt}</h2>
        <Practice>A made-up reconciliation bill. The rule is real: the Byrd rule strikes provisions that don’t change spending or revenue.</Practice>
        <ol className="strike-bill">
          {provisions.map((p, i) => (
            <li key={p.label}>
              <button type="button" className="strike-line" aria-pressed={struck.includes(i)} disabled={locked} data-ok={locked ? ok(i) : undefined} onClick={() => toggle(i)}>
                <span className="strike-sec num">Sec. {i + 1}.</span>
                <span className="strike-text">{p.label}</span>
                {locked && <span className="strike-why small">{p.budget ? 'changes spending or revenue: it stays' : 'no budget effect: the Byrd rule strikes it'}</span>}
              </button>
            </li>
          ))}
        </ol>
        {!locked && <button type="button" className="btn btn-primary estimate-lock" onClick={lock}>Send it to the floor{struck.length ? ` (${struck.length} struck)` : ''}</button>}
      </div>
    </div>
  );
}

// ---------- manage the money: an agency's year, month by month ----------
export interface Request { month: string; label: string; cost: number }
/** The most an agency could fund from these requests without running short on payroll. */
const bestFunding = (costs: number[], room: number) => {
  const can = new Array(room + 1).fill(false); can[0] = true;
  for (const c of costs) for (let x = room; x >= c; x--) if (can[x - c]) can[x] = true;
  for (let x = room; x >= 0; x--) if (can[x]) return x;
  return 0;
};
export function ApportionRound({ total, payroll, requests, intro, done, prompt }: { total: number; payroll: number; requests: Request[]; intro: ReactNode; done: Done; prompt: string }) {
  const [k, setK] = useState(0);
  const [left, setLeft] = useState(total);
  const [funded, setFunded] = useState(0);
  const [missed, setMissed] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const buzz = useHaptics();
  const room = total - payroll * requests.length;
  const best = useMemo(() => bestFunding(requests.map((r) => r.cost), room), [requests, room]);
  const r = requests[k];
  // Each month: payroll comes first (if the money is there), then this month's request.
  const owedAfter = payroll * (requests.length - k - 1);
  const decide = (yes: boolean) => {
    if (over) return;
    let money = left;
    const miss = [...missed];
    let note = '';
    if (money >= payroll) money -= payroll; else { miss.push(r.month); note = ' Payroll couldn’t be paid: an Antideficiency Act violation.'; money = 0; }
    let f = funded;
    if (yes) { if (money >= r.cost) { money -= r.cost; f += r.cost; } else note += ' Not enough left for the request.'; }
    setLeft(money); setFunded(f); setMissed(miss);
    setLog((l) => [`${r.month}: ${yes ? `funded ${r.label.toLowerCase()}` : 'held off'}.${note}`, ...l].slice(0, 4));
    buzz(note ? 'wrong' : yes ? 'card' : 'tap');
    if (k === requests.length - 1) {
      setOver(true);
      const pts = miss.length ? Math.max(10, 30 - 10 * (miss.length - 1)) : (100 * f) / Math.max(1, best);
      done(pts, miss.length ? `Payroll went unpaid in ${miss.length} month${miss.length === 1 ? '' : 's'} (${miss.join(', ')}): the money ran out.` : `Payroll paid all year, and ${usdM(f)} of the ${usdM(best)} you could have funded went to projects. ${usdM(money)} lapsed on September 30.`);
    } else setK((x) => x + 1);
  };
  return (
    <div className="quiz">
      <SamSays mood={missed.length ? 'worried' : 'happy'} compact auto>{intro}</SamSays>
      <div className="card quiz-card apportion" role="group" aria-labelledby="ap-q">
        <h2 className="quiz-q" id="ap-q">{prompt}</h2>
        <Practice>A made-up agency with {usdM(total)} for the year and {usdM(payroll)} of payroll each month. The rules are real: an agency can’t spend more than Congress provided, and money for one year that isn’t used by September 30 lapses.</Practice>
        <div className="ap-board">
          <div className="ap-stat"><span className="stat-label">Money left</span><strong className="num">{usdM(left)}</strong></div>
          <div className="ap-stat"><span className="stat-label">Payroll still owed</span><strong className="num">{usdM(over ? 0 : payroll * (requests.length - k))}</strong></div>
          <div className="ap-stat"><span className="stat-label">Projects funded</span><strong className="num">{usdM(funded)}</strong></div>
        </div>
        <ol className="ap-months" aria-label="The fiscal year, October to September">
          {requests.map((x, i) => <li key={x.month} data-on={i === k && !over ? true : undefined} data-done={i < k || over ? true : undefined} data-miss={missed.includes(x.month) || undefined}>{x.month}</li>)}
        </ol>
        {!over && (
          <>
            <div className="ref-bill">
              <strong>{r.month}: {r.label}</strong>
              <span className="num">{usdM(r.cost)}</span>
            </div>
            <div className="small muted">After this month’s payroll, {usdM(Math.max(0, left - payroll))} is left; {usdM(owedAfter)} of payroll is still to come.</div>
            <div className="pairs-row">
              <button type="button" className="pairs-pick ap-pick" data-pick="yes" onClick={() => decide(true)}><strong>Fund it</strong></button>
              <button type="button" className="pairs-pick ap-pick" data-pick="no" onClick={() => decide(false)}><strong>Hold off</strong></button>
            </div>
          </>
        )}
        {log.length > 0 && <ul className="ap-log small">{log.map((l) => <li key={l}>{l}</li>)}</ul>}
      </div>
    </div>
  );
}

// ---------- the PAYGO scorecards: offset this session's laws, or face a sequester ----------
export interface Scored { id: string; label: string; five: number; ten: number }
export function BalanceRound({ laws, offsets, pick, intro, done, prompt }: { laws: Scored[]; offsets: Scored[]; pick: number; intro: ReactNode; done: Done; prompt: string }) {
  const [on, setOn] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const buzz = useHaptics();
  const sum = (xs: Scored[], f: 'five' | 'ten') => xs.reduce((a, x) => a + x[f], 0);
  const chosen = offsets.filter((o) => on.includes(o.id));
  const net = { five: sum(laws, 'five') + sum(chosen, 'five'), ten: sum(laws, 'ten') + sum(chosen, 'ten') };
  const toggle = (id: string) => {
    if (locked) return;
    setOn((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < pick ? [...s, id] : s));
    buzz('tap');
  };
  const lock = () => {
    setLocked(true);
    const clear = (net.five <= 0 ? 1 : 0) + (net.ten <= 0 ? 1 : 0);
    done(clear === 2 ? 100 : clear === 1 ? 50 : 20, clear === 2 ? 'Both scorecards show no debit: no sequester.' : `The ${net.five > 0 && net.ten > 0 ? '5-year and 10-year scorecards show' : net.five > 0 ? '5-year scorecard shows' : '10-year scorecard shows'} a debit, so the President must order a sequester: automatic cuts to cover it.`);
  };
  const card = (label: string, v: number) => (
    <div className="paygo-card" data-debit={v > 0 || undefined}>
      <span className="stat-label">{label} scorecard</span>
      <strong className="num">{v > 0 ? `+${usd(v)}` : v === 0 ? '$0' : usd(v)}</strong>
      <span className="small">{v > 0 ? 'adds to the deficit' : 'no debit'}</span>
    </div>
  );
  return (
    <div className="quiz">
      <SamSays mood="thinking" compact auto>{intro}</SamSays>
      <div className="card quiz-card paygo" role="group" aria-labelledby="paygo-q">
        <h2 className="quiz-q" id="paygo-q">{prompt}</h2>
        <Practice>Made-up laws and amounts. The rule is real: under Statutory PAYGO, new tax and mandatory spending laws are tallied on a 5-year and a 10-year scorecard, and a debit on either one at the end of the session triggers automatic cuts.</Practice>
        <div className="paygo-laws small">
          <strong>Already passed this session:</strong>
          <ul>{laws.map((l) => <li key={l.id}>{l.label}: +{usd(l.five)} over 5 years, +{usd(l.ten)} over 10</li>)}</ul>
        </div>
        <div className="sim-two">{card('5-year', net.five)}{card('10-year', net.ten)}</div>
        <div className="small muted">Pick up to {pick} more laws to pass before the session ends ({on.length} picked).</div>
        <div className="paygo-offsets">
          {offsets.map((o) => (
            <button key={o.id} type="button" className="paygo-offset" aria-pressed={on.includes(o.id)} disabled={locked || (!on.includes(o.id) && on.length >= pick)} onClick={() => toggle(o.id)}>
              <strong>{o.label}</strong>
              <span className="small num">5 years: {usd(o.five)}</span>
              <span className="small num">10 years: {usd(o.ten)}</span>
            </button>
          ))}
        </div>
        {!locked && <button type="button" className="btn btn-primary estimate-lock" onClick={lock}>End the session</button>}
      </div>
    </div>
  );
}

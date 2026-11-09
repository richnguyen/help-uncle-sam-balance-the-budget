import { type ReactNode, useEffect, useState } from 'react';
import { ChartFrame, focusPoint, Legend, TipRow, TipTitle, useTooltip, useWidth } from '../components/ui';
import { SegBar } from '../components/charts';
import { PageHead, Section } from '../components/ui';
import { geo } from '../data';
import { backendOn, rpc } from '../lib/backend';
import { pct } from '../lib/format';
import { useCommunity } from '../lib/community';
import { OPTIONS_DATA } from '../lib/planData';
import { load } from '../lib/storage';
import { useVotes } from '../lib/votes';
import { LevelIcon } from './icons';
import { LEVELS, MAX_STARS, missionShort, STOP_BY_ID, STOPS } from './levels';
import { MEDALS } from './medals';
import { useJourney } from './state';

// "How everyone played": totals from every player's anonymous record and every ballot, shown at
// the end of the game, plus rankings of policy cards and states (never of people). Charts first,
// few words: every chart has a tooltip on each mark and a table view with the full numbers, so
// small counts are never mistaken for a poll.

// The categorical order (validated: colorblind-safe, both themes), with the ink each fill takes.
const CAT = [
  { color: 'var(--c-ss)', ink: '#fff' }, { color: 'var(--c-medicare)', ink: '#0b0b0b' }, { color: 'var(--c-health)', ink: '#0b0b0b' },
  { color: 'var(--c-income)', ink: '#0b0b0b' }, { color: 'var(--c-defense)', ink: '#fff' },
];

interface Col { id: string; x: string; value: number; n: number; tip: ReactNode; aria: string; mine?: boolean }
/** Columns from one baseline (0–100%): one hue, 4px rounded caps, the highest and lowest labeled, a tooltip on each. */
function Columns({ items, label, height = 210 }: { items: Col[]; label: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const { show, hide } = useTooltip();
  const W = Math.max(280, w), H = height, ml = 40, mr = 6, mt = 20, mb = 34;
  const iw = W - ml - mr, ih = H - mt - mb;
  const band = iw / Math.max(1, items.length);
  const bw = Math.min(24, band * 0.62);
  const y = (v: number) => mt + ih * (1 - Math.max(0, Math.min(1, v)));
  const counted = items.map((it, i) => ({ it, i })).filter((x) => x.it.n > 0);
  const hi = counted.reduce<number | null>((b, x) => (b == null || x.it.value > items[b].value ? x.i : b), null);
  const lo = counted.reduce<number | null>((b, x) => (b == null || x.it.value < items[b].value ? x.i : b), null);
  return (
    <div ref={ref} className="rcols">
      <svg width={W} height={H} role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} className="rcols-grid" />
            <text x={ml - 6} y={y(t) + 4} textAnchor="end" className="rcols-tick">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = ml + band * (i + 0.5), top = y(it.value), base = y(0), h = base - top, r = Math.min(4, h), x0 = cx - bw / 2;
          const tipAt = (e: { clientX: number; clientY: number }) => show(it.tip, e.clientX, e.clientY);
          return (
            <g key={it.id} className="rcol" tabIndex={0} aria-label={it.aria} onPointerMove={tipAt} onPointerLeave={hide}
              onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(it.tip, pt.x, pt.y); }} onBlur={hide}>
              <rect x={cx - band / 2} y={mt - 10} width={band} height={ih + 10} className="rcol-hit" />
              {h > 0.5 && <path className="rcol-bar" d={`M${x0} ${base} V${top + r} Q${x0} ${top} ${x0 + r} ${top} H${x0 + bw - r} Q${x0 + bw} ${top} ${x0 + bw} ${top + r} V${base} Z`} />}
              {(i === hi || i === lo) && <text x={cx} y={top - 6} textAnchor="middle" className="rcols-val">{Math.round(it.value * 100)}%</text>}
              <text x={cx} y={H - mb + 16} textAnchor="middle" className="rcols-x">{it.x}</text>
              {it.mine && <circle cx={cx} cy={H - mb + 27} r={3.5} className="rcol-mine" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Support (right) and opposition (left) for each card, from a center line; a tooltip on each row. */
function Diverging({ rows }: { rows: { id: string; name: string; side: string; yes: number; no: number; mine: string }[] }) {
  const { show, hide } = useTooltip();
  return (
    <ol className="rdiv">
      {rows.map((r) => {
        const n = r.yes + r.no;
        const tip = <><TipTitle>{r.name}</TipTitle><TipRow color="var(--vote-yes)" line={false} label="Support" value={n ? `${pct(r.yes / n, 0)} (${r.yes})` : '—'} /><TipRow color="var(--vote-no)" line={false} label="Oppose" value={n ? `${pct(r.no / n, 0)} (${r.no})` : '—'} />{r.mine && <TipRow label="You" value={r.mine} />}</>;
        return (
          <li key={r.id} className="rdiv-row" tabIndex={0} aria-label={`${r.name}: ${n ? `${pct(r.yes / n, 0)} support, ${pct(r.no / n, 0)} oppose, ${n} votes` : 'no votes yet'}`}
            onPointerMove={(e) => show(tip, e.clientX, e.clientY)} onPointerLeave={hide}
            onFocus={(e) => { const pt = focusPoint(e.currentTarget); show(tip, pt.x, pt.y); }} onBlur={hide}>
            <span className="rdiv-name"><span className="rcard-kind" data-side={r.side}>{r.side === 'revenue' ? 'Tax' : 'Cut'}</span>{r.name}{r.mine && <span className="rrow-you">you</span>}</span>
            <span className="rdiv-bars" aria-hidden="true">
              <span className="rdiv-left"><span style={{ width: `${n ? (r.no / n) * 100 : 0}%` }} /></span>
              <span className="rdiv-right"><span style={{ width: `${n ? (r.yes / n) * 100 : 0}%` }} /></span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A headline number. */
function Fig({ label, value, note, hero = false }: { label: string; value: ReactNode; note?: ReactNode; hero?: boolean }) {
  return (
    <div className={'rfig' + (hero ? ' rfig-hero' : '')}>
      <span className="rfig-label">{label}</span>
      <strong className="rfig-value">{value}</strong>
      {note && <span className="rfig-note">{note}</span>}
    </div>
  );
}

function Row({ label, share, note, mine, icon }: { label: ReactNode; share: number; note: string; mine?: boolean; icon?: ReactNode }) {
  return (
    <li className="rrow" data-mine={mine || undefined}>
      <span className="rrow-label">{icon}{label}{mine && <span className="rrow-you">you</span>}</span>
      <span className="rrow-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} /></span>
      <span className="rrow-val num">{note}</span>
    </li>
  );
}

interface CardRank { card: string; plans: number; share: number }
interface StateRank { state: string; players: number; avg_levels: number; avg_stars: number }

/** Rankings of cards and states, from the site's shared database. */
function useRankings() {
  const [r, setR] = useState<{ cards: CardRank[]; states: StateRank[] } | null>(null);
  useEffect(() => {
    if (!backendOn()) return;
    let alive = true;
    Promise.all([rpc<CardRank[]>('card_rankings', { lvl: 10 }), rpc<StateRank[]>('state_rankings')])
      .then(([cards, states]) => { if (alive) setR({ cards: cards ?? [], states: states ?? [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return r;
}

const CARD_NAME = Object.fromEntries(OPTIONS_DATA.options.map((o) => [o.id, o]));
const STATE_NAME = Object.fromEntries(geo.states.map((s) => [s.abbr, s.name]));

export default function Results() {
  const j = useJourney();
  const c = useCommunity();
  const v = useVotes();
  const ranks = useRankings();
  // Totals can be minutes old in a long visit; fetch the latest when this page opens.
  useEffect(() => { c.refresh(); v.refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const t = c.totals;
  const n = t.players;
  const share = (k: number) => (n ? k / n : 0);
  const last = STOPS[STOPS.length - 1];
  const finishedAll = t.done[last.id] ?? 0;
  const avgStars = n ? t.starsTotal / n : 0;
  const shared = c.available;
  const where = c.source === 'site' ? 'at balancethebudget.us' : 'on this shared copy of the game';
  const myPlan = j.plans?.[last.id];
  const myState = load<boolean>('state-picked', false) ? load<string>('state', '') : '';

  // Votes: shared tallies where there is a shared database; otherwise just this player's own choices.
  const myOption = (id: string): 'support' | 'oppose' | '' => {
    const m = v.available ? v.mine.options[id] : undefined;
    const local = j.choices['option:' + id];
    return m === 1 ? 'support' : m === -1 ? 'oppose' : local === 'support' || local === 'oppose' ? local : '';
  };
  const optionTally = (id: string) => {
    if (v.available) return v.options[id] ?? { support: 0, oppose: 0 };
    const m = myOption(id);
    return { support: m === 'support' ? 1 : 0, oppose: m === 'oppose' ? 1 : 0 };
  };
  const myIssue = (id: string) => (v.available ? v.mine.issues[id] : undefined) ?? j.choices[id] ?? '';
  const issueTally = (id: string): Record<string, number> => {
    if (v.available) return v.issues[id] ?? {};
    const m = myIssue(id);
    return m ? { [m]: 1 } : {};
  };
  const levelVotes = LEVELS.flatMap((l) => l.steps.filter((s) => s.vote).map((s) => ({ level: l, vote: s.vote! })));
  const cards = [...OPTIONS_DATA.options].map((o) => ({ o, t: optionTally(o.id) })).sort((a, b) => {
    const sa = a.t.support + a.t.oppose ? a.t.support / (a.t.support + a.t.oppose) : -1;
    const sb = b.t.support + b.t.oppose ? b.t.support / (b.t.support + b.t.oppose) : -1;
    return sb - sa;
  });

  const [allCards, setAllCards] = useState(false);
  const quizCols: (Col & { question: string })[] = LEVELS.flatMap((l) => l.steps.filter((st) => st.quiz).map((st, k) => {
    const q = st.quiz!;
    const f = t.firstTry[q.id] ?? { right: 0, n: 0 };
    const me = j.quiz[q.id];
    const v = f.n ? f.right / f.n : 0;
    return { id: q.id, question: q.question, x: `${STOP_BY_ID[l.id].campaign}.${STOP_BY_ID[l.id].mission}${'abcdef'[k]}`, value: v, n: f.n, mine: !!(me?.correct && me.tries === 1), aria: `${missionShort(STOP_BY_ID[l.id])}: ${q.question} ${f.n ? `${pct(v, 0)} right on the first try, of ${f.n}` : 'no answers yet'}`, tip: <><TipTitle>{missionShort(STOP_BY_ID[l.id])}: {q.question}</TipTitle><TipRow color="var(--c-emph)" line={false} label="Right on the first try" value={f.n ? `${pct(v, 0)} of ${f.n}` : 'no answers yet'} /></> };
  }));
  const levelCols: Col[] = STOPS.map((s) => {
    const fin = t.done[s.id] ?? 0;
    const st = t.stars[s.id];
    const avg = st && st.n ? st.sum / st.n : 0;
    return { id: s.id, x: `${s.campaign}.${s.mission}`, value: share(fin), n: n, mine: j.done.includes(s.id), aria: `${missionShort(s)}, ${s.title}: ${pct(share(fin), 0)} of players finished it`, tip: <><TipTitle>{missionShort(s)}: {s.title}</TipTitle><TipRow color="var(--c-emph)" line={false} label="Finished it" value={`${pct(share(fin), 0)} · ${fin}`} /><TipRow label="Average stars" value={fin && st?.n ? `★ ${avg.toFixed(1)}` : '—'} /></> };
  });
  const cardRows = cards.map(({ o, t: tl }) => ({ id: o.id, name: o.name, side: o.side, yes: tl.support, no: tl.oppose, mine: myOption(o.id) }));
  const youDot = <span className="rlegend-you"><span className="rcol-mine-key" aria-hidden="true" /> you</span>;

  return (
    <div className="results">
      <PageHead eyebrow="The game · results" title="How everyone played"
        lede={shared ? <>Everyone who has played {where}, at a glance. Anonymous: no names, ever.</> : <>Your own results, in this browser. Everyone’s are on the public site, balancethebudget.us.</>} />
      {shared && c.canWrite === false && <div className="callout small">You can see everyone’s results; adding yours needs Contributor access to this page.</div>}
      {(c.error || v.error) && <div className="callout small">{c.error ?? v.error}</div>}
      {c.loading && shared && <p className="small muted">Loading results…</p>}

      <div className="rfigs">
        <Fig hero label={shared ? 'Players' : 'Players here'} value={n.toLocaleString('en-US')} note={shared ? undefined : 'just you'} />
        <Fig label="Balanced the budget" value={n ? pct(share(finishedAll), 0) : '—'} note={`${finishedAll} player${finishedAll === 1 ? '' : 's'}`} />
        <Fig label="Average stars" value={n ? avgStars.toFixed(1) : '—'} note={`of ${MAX_STARS}`} />
        <Fig label="Ballots" value={`${v.available ? v.voters : Object.keys(j.choices).filter((k) => j.choices[k]).length ? 1 : 0}`} note={v.available ? 'one per person' : 'yours'} />
      </div>

      <ChartFrame title="How far players got" sub={<>Share of players who finished each mission (1.5 is campaign 1, mission 5) {youDot}</>}
        table={{ columns: [{ key: 'l', label: 'Mission' }, { key: 'f', label: 'Finished', align: 'r' }, { key: 's', label: 'Average stars', align: 'r' }], rows: STOPS.map((s) => { const fin = t.done[s.id] ?? 0; const st = t.stars[s.id]; return { l: `${s.campaign}.${s.mission} ${s.title}`, f: `${pct(share(fin), 0)} (${fin})`, s: fin && st?.n ? (st.sum / st.n).toFixed(1) : '—' }; }) }}>
        <Columns items={levelCols} label={`Share of players who finished each of the ${STOPS.length} missions`} />
      </ChartFrame>

      <ChartFrame title="Right on the first try" sub={<>Each quick check, by mission (1.1a is mission 1.1’s first) {youDot}</>}
        table={{ columns: [{ key: 'q', label: 'Question', wrap: true }, { key: 'r', label: 'First try', align: 'r' }], rows: quizCols.map((c2) => ({ q: <><span className="muted">{c2.x}</span> {c2.question}</>, r: c2.n ? `${pct(c2.value, 0)} of ${c2.n}` : '—' })) }}>
        <Columns items={quizCols} label="Share of players right on the first try, for each quick check" />
      </ChartFrame>

      <Section id="level-votes" title="How everyone voted" sub={v.available ? `${v.voters} ${v.voters === 1 ? 'ballot' : 'ballots'}` : 'Your votes'}>
        <div className="rvotes">
          {levelVotes.map(({ level, vote }) => {
            if (vote.kind === 'option') {
              const o = OPTIONS_DATA.options.find((x) => x.id === vote.optionId)!;
              const tl = optionTally(o.id);
              const tot = tl.support + tl.oppose;
              const parts = [{ label: 'Support', value: tl.support, color: 'var(--vote-yes)', ink: '#fff' }, { label: 'Oppose', value: tl.oppose, color: 'var(--vote-no)', ink: '#0b0b0b' }];
              return (
                <article key={o.id} className="card rvote">
                  <span className="rvote-tag">{missionShort(STOP_BY_ID[level.id])}</span>
                  <h3 className="rvote-q">{o.name}</h3>
                  {tot ? <SegBar parts={parts} label={o.name} format={(x) => `${x} vote${x === 1 ? '' : 's'}`} /> : <div className="rvote-empty">No votes yet</div>}
                  <Legend items={parts.map((p) => ({ label: p.label, color: p.color }))} />
                  <span className="rvote-n">{tot} vote{tot === 1 ? '' : 's'}{myOption(o.id) ? ` · you: ${myOption(o.id)}` : ''}</span>
                </article>
              );
            }
            const tl = issueTally(vote.id);
            const tot = Object.values(tl).reduce((a, b) => a + b, 0);
            const mineV = myIssue(vote.id);
            const parts = vote.choices.map((ch, k) => ({ label: ch.label, value: tl[ch.value] ?? 0, ...CAT[k % CAT.length] }));
            return (
              <article key={vote.id} className="card rvote">
                <span className="rvote-tag">{missionShort(STOP_BY_ID[level.id])}</span>
                <h3 className="rvote-q">{vote.question}</h3>
                {tot ? <SegBar parts={parts.filter((p) => p.value > 0)} label={vote.question} format={(x) => `${x} vote${x === 1 ? '' : 's'}`} /> : <div className="rvote-empty">No votes yet</div>}
                <Legend items={parts.map((p) => ({ label: p.label, color: p.color }))} />
                <span className="rvote-n">{tot} vote{tot === 1 ? '' : 's'}{mineV ? ` · you: ${vote.choices.find((ch) => ch.value === mineV)?.label ?? mineV}` : ''}</span>
              </article>
            );
          })}
        </div>
      </Section>

      <ChartFrame title="Every policy card" sub="Support and opposition, most supported first"
        legend={<Legend items={[{ label: 'Oppose', color: 'var(--vote-no)' }, { label: 'Support', color: 'var(--vote-yes)' }]} />}
        table={{ columns: [{ key: 'c', label: 'Card', wrap: true }, { key: 'y', label: 'Support', align: 'r' }, { key: 'n', label: 'Oppose', align: 'r' }], rows: cardRows.map((r) => ({ c: r.name, y: String(r.yes), n: String(r.no) })) }}>
        <Diverging rows={allCards ? cardRows : cardRows.slice(0, 10)} />
        {cardRows.length > 10 && <button type="button" className="link-btn rdiv-more" onClick={() => setAllCards(!allCards)}>{allCards ? 'Show the top 10' : `Show all ${cardRows.length} cards`}</button>}
      </ChartFrame>

      {ranks && ranks.cards.length > 0 && (
        <Section id="card-ranks" title="In players’ balance-the-budget plans" sub="Share of plans using each card">
          <ol className="rlist">
            {ranks.cards.slice(0, 8).map((r) => {
              const o = CARD_NAME[r.card];
              if (!o) return null;
              return <Row key={r.card} label={<><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{o.name}</>} share={Number(r.share)} note={pct(Number(r.share), 0)} mine={!!myPlan?.ids.includes(r.card)} />;
            })}
          </ol>
        </Section>
      )}

      {ranks && ranks.states.length > 0 && (
        <Section id="state-ranks" title="States as teams" sub="Average missions finished (states with 5 or more players)">
          <ol className="rlist">
            {ranks.states.slice(0, 8).map((r) => <Row key={r.state} label={STATE_NAME[r.state] ?? r.state} share={Number(r.avg_levels) / STOPS.length} note={`${Number(r.avg_levels).toFixed(1)}`} mine={r.state === myState} />)}
          </ol>
        </Section>
      )}

      <Section id="medals" title="Medals" sub="Share of players who earned each">
        <ul className="rmedals">
          {MEDALS.map((m) => {
            const k = t.medals[m.id] ?? 0;
            const got = j.medals.includes(m.id);
            return (
              <li key={m.id} className="rmedal" data-got={got || undefined} title={m.desc}>
                <span className="rmedal-disc" aria-hidden="true">{got ? '★' : ''}</span>
                <span className="rmedal-name">{m.name}</span>
                <span className="rmedal-meter" aria-hidden="true"><span style={{ width: `${share(k) * 100}%` }} /></span>
                <span className="rmedal-val">{n ? pct(share(k), 0) : '—'}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      {c.source === 'site' && <p className="small"><a href="#peoples">The People’s Budget</a> · <a href="#stats">Share stats</a></p>}
      <p className="small muted">An informal tally of people who chose to play, not a survey.</p>
    </div>
  );
}

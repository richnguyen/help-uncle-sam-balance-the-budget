import { useMemo, useState } from 'react';
import { ActionBar } from '../components/ActionBar';
import { EconMeter, GapBar, type GapSegment, SplitBar } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { assess, CTX, LAST_FY } from '../lib/assess';
import { money, pct } from '../lib/format';
import { goalGap } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import { ZERO } from '../lib/sandbox';
import { useHaptics } from './haptics';
import { DESK, missionShort, STOP_BY_ID } from './levels';
import { CARD_CODE, cleanName, myName, setMyName, siteRoot } from './plans';
import { CHAIN_LINES } from './script';
import { ShareButton, SocialShare } from './ShareButton';
import { useJourney } from './state';
import { SamSays } from './UncleSam';

// Pass the budget (#chain?g=5&t=CRk&n=Ruth~Sam): each person makes one change to Uncle Sam's
// budget (adds one policy card or takes one out) and passes the link on. The whole chain lives in
// the link: the goal (g), every turn in order (t: a capital letter adds a card, a small one takes
// it out), and optional first names (n). No server is involved, so it works anywhere.

const OPTIONS = OPTIONS_DATA.options;
const CODE_CARD = Object.fromEntries(Object.entries(CARD_CODE).map(([id, c]) => [c, id]));
const NAME = Object.fromEntries(OPTIONS.map((o) => [o.id, o.name]));
const MAX_TURNS = 30;
const GOAL_TEXT: Record<number, string> = { 5: 'stop Uncle Sam’s debt from outgrowing the economy', 8: 'cut Uncle Sam’s deficit to 3% of GDP', 10: 'balance Uncle Sam’s budget' };

interface Turn { card: string; add: boolean; by: string }
interface ChainState { level: number; turns: Turn[] }

/** Goals the cards alone can reach (balancing the budget also needs across-the-board changes). */
const REACHABLE = DESK.filter((d) => assess(d.goal, OPTIONS.map((o) => o.id), ZERO, true).met);

function decode(param: string | null): ChainState | null {
  const q = new URLSearchParams(param ?? '');
  const level = Number(q.get('g'));
  if (!REACHABLE.some((d) => d.n === level)) return null;
  const names = (q.get('n') ?? '').split('~');
  const turns: Turn[] = [];
  for (const [i, ch] of [...(q.get('t') ?? '')].slice(0, MAX_TURNS).entries()) {
    const card = CODE_CARD[ch.toLowerCase()];
    if (!card) continue;
    turns.push({ card, add: ch !== ch.toLowerCase(), by: cleanName(names[i] ?? '').slice(0, 16) });
  }
  return { level, turns };
}
function encode(c: ChainState) {
  const t = c.turns.map((x) => (x.add ? CARD_CODE[x.card].toUpperCase() : CARD_CODE[x.card])).join('');
  const n = c.turns.map((x) => x.by).join('~').replace(/~+$/, '');
  return `chain&g=${c.level}${t ? `&t=${t}` : ''}${n ? `&n=${encodeURIComponent(n)}` : ''}`;
}
const cardsIn = (turns: Turn[]) => {
  const s = new Set<string>();
  for (const t of turns) { if (t.add) s.add(t.card); else s.delete(t.card); }
  return [...s];
};

export default function Chain({ param }: { param: string | null }) {
  const j = useJourney();
  const buzz = useHaptics();
  const given = useMemo(() => decode(param), [param]);
  const [level, setLevel] = useState(given?.level ?? REACHABLE[0]?.n ?? 5);
  const [name, setName] = useState(myName);
  const [mine, setMine] = useState<Turn | null>(null);
  const before = given?.turns ?? [];
  const chain: ChainState = { level: given?.level ?? level, turns: mine ? [...before, mine] : before };
  const d = DESK.find((x) => x.n === chain.level)!;
  const ids = cardsIn(chain.turns);
  const idsBefore = cardsIn(before);
  const a = assess(d.goal, ids, ZERO, true);
  const wasMet = assess(d.goal, idsBefore, ZERO, true).met && before.length > 0;
  const sum = a.shares.reduce((s, x) => s + Math.max(0, x.share), 0);
  const kk = sum > 0 ? a.progress / sum : 0;
  const segments: GapSegment[] = a.shares.map((x) => ({ id: x.id, label: x.name, share: Math.max(0, x.share) * kk, side: x.side }));
  const still = goalGap(d.goal, a.sim, CTX.startRatio);
  const full = before.length >= MAX_TURNS;
  const link = `${siteRoot()}p/chain/?${encode(chain)}`;
  const hands = new Set(chain.turns.map((t, i) => t.by || `#${i}`)).size;
  const shareText = a.met
    ? `We did it! Our pass-the-budget chain managed to ${GOAL_TEXT[d.n]} in ${chain.turns.length} turns. See how it happened, or keep it going.`
    : `Your turn! Our pass-the-budget chain is ${Math.floor(a.progress * 100)}% of the way to ${GOAL_TEXT[d.n].replace(/^stop/, 'stopping').replace(/^cut/, 'cutting').replace(/^balance/, 'balancing')}. Make one change and pass it on.`;

  const take = (card: string, add: boolean) => {
    buzz('card');
    setMine({ card, add, by: cleanName(name).slice(0, 16) });
    setMyName(name);
    j.mark('chain');
  };

  const sam = mine ? (a.met ? CHAIN_LINES.done : CHAIN_LINES.passed) : given ? (wasMet ? CHAIN_LINES.done : CHAIN_LINES.turn) : CHAIN_LINES.start;

  return (
    <>
      <PageHead
        eyebrow={given ? `Pass the budget · ${before.length} turn${before.length === 1 ? '' : 's'} so far` : 'Pass the budget · a game for a group'}
        title="Pass the budget"
        lede={<>Each person makes one change to Uncle Sam’s budget, adding one policy card or taking one out, then passes the link on. The goal: {GOAL_TEXT[d.n]} by FY{LAST_FY}.</>}
      />
      <SamSays mood={a.met ? 'cheering' : mine ? 'happy' : 'thinking'} auto>{sam}</SamSays>

      {!given && !mine && (
        <section className="card chain-start">
          <div className="field">
            <label htmlFor="chain-goal">The chain’s goal</label>
            <select id="chain-goal" className="select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {REACHABLE.map((x) => <option key={x.id} value={x.n}>{x.title} ({missionShort(STOP_BY_ID[x.id])})</option>)}
            </select>
          </div>
          <p className="small muted">Balancing the budget isn’t offered: the policy cards alone can’t get there. Pick your first card below.</p>
        </section>
      )}

      {chain.turns.length > 0 && (
        <Section id="turns" title={a.met ? `The chain did it in ${chain.turns.length} turn${chain.turns.length === 1 ? '' : 's'}` : 'The chain so far'}>
          <ol className="chain-turns" role="list">
            {chain.turns.map((t, i) => (
              <li key={i} data-mine={mine && i === chain.turns.length - 1 ? true : undefined}>
                <span className="num muted chain-n">{i + 1}.</span>
                <span className="peoples-chip" data-in={t.add}>{t.add ? 'Added' : 'Took out'}</span>
                <span><strong>{t.by || (mine && i === chain.turns.length - 1 ? 'You' : 'Someone')}</strong> {t.add ? 'added' : 'took out'} “{NAME[t.card]}”</span>
              </li>
            ))}
          </ol>
          <p className="small muted">{hands} {hands === 1 ? 'person' : 'people'} so far.</p>
        </Section>
      )}

      <section className="card peoples-board" aria-live="polite">
        <div className="sb-big">{a.met ? 'Goal met!' : `${Math.floor(a.progress * 100)}% of the way`}</div>
        <GapBar segments={segments} progress={a.progress} />
        <div className="small muted">{a.met ? `With ${ids.length} cards, in FY${LAST_FY} debt is ${pct(a.last.debt / a.last.gdp, 0)} of GDP and the deficit ${a.last.deficit <= 0 ? 'is gone' : pct(a.last.deficit / a.last.gdp, 1) + ' of GDP'}.` : `${ids.length} card${ids.length === 1 ? '' : 's'} in. Still needed: ${money(still)} by FY${LAST_FY}.`}</div>
        {ids.length > 0 && (
          <div className="friendplan-bars">
            <div><div className="stat-label">Hit to the economy</div><EconMeter peakStep={a.econ.peakStep} /></div>
            <div><div className="stat-label">Who pays</div><SplitBar revenue={a.revTen} spending={a.spTen} /></div>
          </div>
        )}
      </section>

      {mine ? (
        <section className="card chain-pass" aria-labelledby="pass-t">
          <h2 className="section-title" id="pass-t">{a.met ? 'Share how your chain did it' : 'Now pass it on'}</h2>
          <p className="small">Your change: you {mine.add ? 'added' : 'took out'} “{NAME[mine.card]}”. Send the link to one person, or a few: each one starts their own branch of the chain.</p>
          <ActionBar label="Pass it on">
            <ShareButton text={shareText} url={link} label={a.met ? 'Share the chain' : 'Pass it on'} className="btn btn-primary" />
            <button type="button" className="btn" onClick={() => setMine(null)}>Change my turn</button>
          </ActionBar>
          <SocialShare text={shareText} url={link} />
        </section>
      ) : full ? (
        <div className="callout small">This chain has had its {MAX_TURNS} turns. Start a new one to keep going.</div>
      ) : (
        <Section id="your-turn" title="Your turn" sub="Make one change: add a card that isn’t in yet, or take one out.">
          <div className="field chain-name">
            <label htmlFor="chain-name">Your first name (optional, shown in the chain)</label>
            <input id="chain-name" className="input" maxLength={16} value={name} placeholder="First name" autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </div>
          <ol className="peoples-cards">
            {[...OPTIONS].sort((x, y) => Number(ids.includes(y.id)) - Number(ids.includes(x.id)) || x.name.localeCompare(y.name)).map((o) => {
              const isIn = ids.includes(o.id);
              const own = assess(d.goal, [o.id], ZERO, true).progress;
              return (
                <li key={o.id} className="peoples-card" data-in={isIn}>
                  <div className="peoples-card-head">
                    <span className="peoples-chip" data-in={isIn}>{isIn ? 'In' : 'Out'}</span>
                    <span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>
                    <strong className="peoples-name">{o.name}</strong>
                  </div>
                  <div className="small muted">{o.savings10 < 0 ? <>Adds to the gap · {money(-o.savings10 * 1e9)} more borrowing over ten</> : <>Closes {own >= 1 ? 'the whole gap' : `${Math.max(own > 0 ? 1 : 0, Math.round(own * 100))}%`} on its own · {money(o.savings10 * 1e9)} over ten</>} years</div>
                  <div className="peoples-actions">
                    <button type="button" className="vote-btn" onClick={() => take(o.id, !isIn)}>{isIn ? 'Take it out' : 'Add it'}</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}
      <p className="small muted">The chain lives entirely in its link: nothing is stored anywhere. Scored with CBO’s estimates, phased in over three years, the same way as the budget desk.</p>
    </>
  );
}

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { Stars } from '../components/game';
import { LAST_FY } from '../lib/assess';
import { LEVERS, type Levers } from '../lib/sandbox';
import { cardName } from './ChallengeParts';
import { activeDuel, assessDuel, boardEntry, boardPlanArgs, DUEL_LEVEL, type Duel, type DuelPlan, duelRounds, inviteHash, inviteLink, markRevealed, newDuelId, planKey, readDuelParam, rematchFor, replyLink, resultHash, revealKey, saveDuel, scorecard, sealedRating, sealedText, setActiveDuel, setRematch, splitLabel, standings, useDuels, wasRevealed, type BoardEntry } from './duel';
import { useHaptics } from './haptics';
import { esc, svgToPng } from './share';
import { backendOn, duelBoard, enterDuel } from '../lib/backend';
import { dropChallenge } from './challenge';
import { NameField } from './NameField';
import { cleanName, siteRoot, useMyName } from './plans';
import { ShareButton, SocialShare } from './ShareButton';
import { DUEL_LINES } from './script';
import { SamSays } from './UncleSam';

// The level 10 duel's pages: the invite a friend opens, the comparison after the reveal (for both
// players), and the Duels page with every duel kept in this browser. See duel.ts.

const them = (name?: string) => name || 'your friend';
const Them = (name?: string) => name || 'Your friend';
const flip = (score: string) => score.split('–').reverse().join('–');
type Result = ReturnType<typeof duelRounds>;
/** "Your plan wins 2–1", "Ruth’s plan wins on a gentler economy", "Tied 1–1". */
const headline = (r: Result, theirName?: string) => {
  const how = r.tiebreak && r.tiebreak !== 'tie' ? (r.tiebreakBy === 'economy' ? 'on a gentler economy' : 'on fewer cards') : null;
  return r.outcome === 'tied' ? `Tied ${r.score}` : r.outcome === 'won' ? `Your plan wins ${how ?? r.score}` : `${Them(theirName)}’s plan wins ${how ?? flip(r.score)}`;
};
const winnerLabel = (w: 'me' | 'them' | 'tie', theirName?: string) => (w === 'tie' ? 'Even' : w === 'me' ? 'Your plan wins' : `${Them(theirName)}’s plan wins`);
const sameName = (a?: string, b?: string) => !!a && !!b && cleanName(a).toLowerCase() === cleanName(b).toLowerCase();
const levers = (lv: Levers) => LEVERS.filter((l) => lv[l.id]).map((l) => `${l.label} ${lv[l.id] > 0 ? '+' : ''}${lv[l.id]}%`);
const onDuels = (f: () => void) => { window.addEventListener('ftd-duels', f); return () => window.removeEventListener('ftd-duels', f); };

export function inviteText(name: string, plan: DuelPlan) {
  return sealedText(name, plan);
}

/** The comparison: three rounds revealed one tap at a time like a boxing scorecard, the verdict, then the cards each plan used. */
function Rounds({ id, mine, theirs, theirName }: { id: string; mine: DuelPlan; theirs: DuelPlan; theirName?: string }) {
  const r = useMemo(() => duelRounds(mine, theirs), [mine, theirs]);
  const sc = useMemo(() => scorecard(r), [r]);
  const myName = useMyName();
  const col = theirName || 'Them';
  const key = revealKey(id, mine, theirs);
  const steps = 3 + (r.tiebreak ? 1 : 0);
  const [shown, setShown] = useState(() => (wasRevealed(key) ? steps : 0));
  const done = shown >= steps;
  useEffect(() => { if (done) markRevealed(key); }, [done, key]);
  const buzz = useHaptics();
  const next = () => { buzz('card'); setShown((n) => Math.min(steps, n + 1)); };
  // Level 10 plans often share most of their cards, so the comparison shows what differs.
  const both = mine.ids.filter((id) => theirs.ids.includes(id));
  const side = (p: DuelPlan, other: DuelPlan, who: string, stars: number) => {
    const own = p.ids.filter((id) => !other.ids.includes(id));
    const lv = levers(p.lv);
    return (
      <div>
        <span className="stat-label">{who} · <Stars n={stars} size="sm" label={`${stars} of 3 stars`} /></span>
        <span className="small"><strong>Cards of its own:</strong> {own.length ? '' : 'none'}</span>
        {own.length > 0 && <ul className="small">{own.map((id) => <li key={id}>{cardName(id)}</li>)}</ul>}
        <span className="small"><strong>Across the board:</strong> {lv.length ? lv.join('; ') : 'none'}</span>
        <span className="small muted">{p.gradual ? 'Phased in' : 'All at once'} · {p.ids.length} card{p.ids.length === 1 ? '' : 's'} in all</span>
      </div>
    );
  };
  const sealedRow = (i: number, label: string) => (
    <li key={'sealed-' + i} className="card duel-round-sealed">
      <span className="stat-label">{label}</span>
      {i === shown ? <button type="button" className="btn btn-primary" onClick={next}>Reveal {label.replace(' · ', ': ')}</button> : <span className="small muted">Sealed</span>}
    </li>
  );
  return (
    <>
      <section className="card duel-board-head" aria-label="Scorecard">
        <div className="duel-bout"><span>You</span><span className="muted">vs.</span><span>{col}</span></div>
        <ol className="duel-pts" aria-label="Points by round">
          {r.rounds.map((x, i) => (
            <li key={x.id} data-shown={i < shown || undefined} data-winner={i < shown ? x.winner : undefined}>
              <span className="duel-pts-k">R{i + 1}</span>
              <span className="duel-pts-v num">{i < shown ? `${sc.pts[i][0]}–${sc.pts[i][1]}` : '?'}</span>
            </li>
          ))}
          <li className="duel-pts-total" data-shown={done || undefined}><span className="duel-pts-k">Total</span><span className="duel-pts-v num">{done ? `${sc.total[0]}–${sc.total[1]}` : '?'}</span></li>
        </ol>
        {!done && <button type="button" className="btn btn-sm duel-skip" onClick={() => setShown(steps)}>Skip to the result</button>}
      </section>
      {done && (
        <section className="card duel-score" aria-live="polite">
          <span className="duel-verdict">{sc.verdict}</span>
          <strong className="duel-score-num">{headline(r, theirName)}</strong>
          <span className="small muted">{r.tiebreak && r.tiebreak !== 'tie' ? `Even at ${r.score} after three rounds, so the tie-breaker decides: ${r.tiebreakBy === 'economy' ? 'the gentler steepest year wins' : 'the economy is even too, so fewer cards wins'}.` : 'Best of three rounds; if they come out even, the gentler plan wins, then the one with fewer cards.'} Plans are compared, never people.</span>
          <span className="small duel-balanced">
            {r.balanced.mine && r.balanced.theirs ? 'Both plans balance the budget.' : `${r.balanced.mine ? 'Your plan balances the budget' : 'Your plan doesn’t balance the budget yet'}; ${r.balanced.theirs ? `${them(theirName)}’s does` : `${them(theirName)}’s doesn’t yet`}.`}
          </span>
        </section>
      )}
      <ol className="duel-rounds">
        {r.rounds.map((x, i) => i >= shown ? sealedRow(i, `Round ${i + 1} · ${x.title}`) : (
          <li key={x.id} className="card duel-round" data-winner={x.winner}>
            <div className="duel-round-head">
              <span className="stat-label">Round {i + 1} · {x.title} · <span className="num">{sc.pts[i][0]}–{sc.pts[i][1]}</span></span>
              <span className="duel-round-win">{winnerLabel(x.winner, theirName)}</span>
            </div>
            <strong className="duel-round-q">{x.question}</strong>
            <div className="duel-sides">
              <div data-win={x.winner === 'me' || undefined}><span className="small muted">You</span><strong className="num">{x.mine}</strong></div>
              <div data-win={x.winner === 'them' || undefined}><span className="small muted">{col}</span><strong className="num">{x.theirs}</strong></div>
            </div>
            <p className="small muted">{x.why}</p>
          </li>
        ))}
        {r.tiebreak && shown < 4 && shown >= 3 && sealedRow(3, 'Tie-breaker · The decider')}
        {shown >= 4 && <>
        {r.tiebreak && r.tiebreakBy === 'economy' && (
          <li className="card duel-round duel-tiebreak" data-winner={r.tiebreak} data-by="economy">
            <div className="duel-round-head">
              <span className="stat-label">Tie-breaker · The gentler plan</span>
              <span className="duel-round-win">{winnerLabel(r.tiebreak, theirName)}</span>
            </div>
            <strong className="duel-round-q">The rounds came out even. Whose steepest year is gentler on the economy?</strong>
            <div className="duel-sides">
              <div data-win={r.tiebreak === 'me' || undefined}><span className="small muted">You</span><strong className="num">{(r.steep.mine * 100).toFixed(2)}% of GDP</strong></div>
              <div data-win={r.tiebreak === 'them' || undefined}><span className="small muted">{col}</span><strong className="num">{(r.steep.theirs * 100).toFixed(2)}% of GDP</strong></div>
            </div>
            <p className="small muted">The first tie-breaker, so the scoring never rewards a steeper plan just for using fewer cards.</p>
          </li>
        )}
        {r.tiebreak && r.tiebreakBy === 'cards' && (
          <li className="card duel-round duel-tiebreak" data-winner={r.tiebreak} data-by="cards">
            <div className="duel-round-head">
              <span className="stat-label">Tie-breaker · Fewer cards</span>
              <span className="duel-round-win">{winnerLabel(r.tiebreak, theirName)}</span>
            </div>
            <strong className="duel-round-q">The rounds and the economy came out even. Whose plan does the job with fewer cards?</strong>
            <div className="duel-sides">
              <div data-win={r.tiebreak === 'me' || undefined}><span className="small muted">You</span><strong className="num">{r.cards.mine} card{r.cards.mine === 1 ? '' : 's'}</strong></div>
              <div data-win={r.tiebreak === 'them' || undefined}><span className="small muted">{col}</span><strong className="num">{r.cards.theirs} card{r.cards.theirs === 1 ? '' : 's'}</strong></div>
            </div>
            <p className="small muted">{r.tiebreak === 'tie' ? 'The same number of cards: a true tie.' : 'Policy cards played. Fewer moves for the same job wins.'}</p>
          </li>
        )}
        </>}
      </ol>
      {done && <DuelScorecard r={r} sc={sc} me={myName || 'You'} them={theirName || 'Friend'} />}
      <section className="card duel-cards">
        <h2 className="section-title">How the two plans differ</h2>
        <p className="small">{both.length ? `Both plans use the same ${both.length} card${both.length === 1 ? '' : 's'}; here’s what each does on its own.` : 'The two plans share no cards.'}</p>
        <div className="duel-sides duel-sides-plans">
          {side(mine, theirs, 'Your plan', r.mine.ev.stars)}
          {side(theirs, mine, `${col}’s plan`, r.theirs.ev.stars)}
        </div>
        {both.length > 0 && (
          <details className="duel-both">
            <summary className="small">The {both.length} card{both.length === 1 ? '' : 's'} in both plans</summary>
            <ul className="small">{both.map((id) => <li key={id}>{cardName(id)}</li>)}</ul>
          </details>
        )}
        <p className="small muted">Both plans use CBO’s baseline and options CBO has priced; the debt round looks at FY{LAST_FY}.</p>
      </section>
    </>
  );
}

/** The final scorecard, sized for a phone screen (9:16): made to screenshot for Stories or a group chat. */
function DuelScorecard({ r, sc, me, them: other }: { r: Result; sc: ReturnType<typeof scorecard>; me: string; them: string }) {
  const text = `🥊 Budget duel: ${me} vs. ${other}. ${sc.verdict}, ${sc.total[0]}–${sc.total[1]}. ${r.rounds.map((x, i) => `R${i + 1} ${x.title.replace(/^The /, '')} ${sc.pts[i][0]}–${sc.pts[i][1]}`).join(' · ')}. Plans compared, never people. Think yours can beat both?`;
  return (
    <section className="duel-card-wrap" aria-labelledby="duel-card-t">
      <h2 className="section-title" id="duel-card-t">The scorecard</h2>
      <div className="duel-card" data-outcome={r.outcome}>
        <div className="dc-eyebrow">Budget duel · official scorecard</div>
        <div className="dc-names"><span>{me}</span><span className="dc-vs">vs.</span><span>{other}</span></div>
        <ol className="dc-rounds">
          {r.rounds.map((x, i) => (
            <li key={x.id} data-winner={x.winner}>
              <span className="dc-r">Round {i + 1}</span>
              <span className="dc-t">{x.title}</span>
              <span className="dc-p num">{sc.pts[i][0]}–{sc.pts[i][1]}</span>
            </li>
          ))}
        </ol>
        <div className="dc-total num">{sc.total[0]}–{sc.total[1]}</div>
        <div className="dc-verdict">{sc.verdict}</div>
        <div className="dc-head">{r.outcome === 'tied' ? 'A draw' : r.outcome === 'won' ? `${me}’s plan wins` : `${other}’s plan wins`}</div>
        <div className="dc-foot">Plans compared, never people · CBO numbers<br /><strong>balancethebudget.us</strong></div>
      </div>
      <div className="sb-actions"><ShareButton text={text} url={siteRoot() + '?duel'} label="Share the scorecard" className="btn btn-primary" kind="plan" card={() => scorecardPng(r, sc, me, other)} /></div>
    </section>
  );
}

/** The scorecard as a 1080×1920 image. */
function scorecardPng(r: Result, sc: ReturnType<typeof scorecard>, me: string, other: string) {
  const W = 1080, H = 1920, f = 'Arial, Helvetica, sans-serif', n = 'Arial Narrow, Arial, Helvetica, sans-serif';
  const rows = r.rounds.map((x, i) => {
    const y = 760 + i * 190;
    const win = x.winner === 'me' ? me : x.winner === 'them' ? other : 'Even';
    return `<rect x="90" y="${y}" width="900" height="160" rx="22" fill="#ffffff" stroke="${x.winner === 'tie' ? '#c9d0ca' : '#c9a645'}" stroke-width="5"/>
      <text x="130" y="${y + 66}" font-family="${f}" font-size="34" font-weight="700" fill="#5d6862">ROUND ${i + 1}</text>
      <text x="130" y="${y + 120}" font-family="${n}" font-size="52" font-weight="800" fill="#111b16">${esc(x.title)}</text>
      <text x="950" y="${y + 80}" text-anchor="end" font-family="${f}" font-size="64" font-weight="800" fill="#111b16">${sc.pts[i][0]}–${sc.pts[i][1]}</text>
      <text x="950" y="${y + 128}" text-anchor="end" font-family="${f}" font-size="28" fill="#5d6862">${esc(win.slice(0, 18))}</text>`;
  }).join('');
  const head = r.outcome === 'tied' ? 'A draw' : r.outcome === 'won' ? `${me}’s plan wins` : `${other}’s plan wins`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#14261f"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="36" fill="#f2f4ef"/>
  <text x="${W / 2}" y="190" text-anchor="middle" font-family="${f}" font-size="34" font-weight="800" letter-spacing="6" fill="#b4232f">BUDGET DUEL · SCORECARD</text>
  <text x="${W / 2}" y="370" text-anchor="middle" font-family="${n}" font-size="104" font-weight="800" fill="#111b16">${esc(me.slice(0, 14))}</text>
  <text x="${W / 2}" y="460" text-anchor="middle" font-family="${f}" font-size="44" font-weight="700" fill="#5d6862">vs.</text>
  <text x="${W / 2}" y="580" text-anchor="middle" font-family="${n}" font-size="104" font-weight="800" fill="#111b16">${esc(other.slice(0, 14))}</text>
  <line x1="90" y1="680" x2="990" y2="680" stroke="#c9d0ca" stroke-width="4" stroke-dasharray="14 14"/>
  ${rows}
  <text x="${W / 2}" y="1440" text-anchor="middle" font-family="${f}" font-size="150" font-weight="800" fill="#111b16">${sc.total[0]}–${sc.total[1]}</text>
  <rect x="190" y="1490" width="700" height="110" rx="55" fill="#b4232f"/>
  <text x="${W / 2}" y="1565" text-anchor="middle" font-family="${f}" font-size="52" font-weight="800" fill="#ffffff">${esc(sc.verdict.toUpperCase())}</text>
  <text x="${W / 2}" y="1690" text-anchor="middle" font-family="${f}" font-size="48" font-weight="700" fill="#111b16">${esc(head)}</text>
  <text x="${W / 2}" y="1790" text-anchor="middle" font-family="${f}" font-size="30" fill="#47524c">Plans compared, never people · balancethebudget.us</text>
</svg>`;
  return svgToPng(svg, W, H);
}

/** #duel?…: an invite (from a friend, or my own), or a duel's comparison. */
export default function DuelPage({ param }: { param: string | null }) {
  const d = useMemo(() => readDuelParam(param), [param]);
  const duels = useDuels();
  const name = useMyName();
  const mineAsHost = !!d && duels.some((x) => x.id === d.id && x.role === 'host');
  const mineAsGuest = !!d && duels.some((x) => x.id === d.id && x.role === 'guest' && x.revealed);
  // A reply is seen from the guest's side when this device played it (or the names match);
  // otherwise from the host's: the reply link is sent to the host.
  const iAmGuest = !!d && d.kind === 'reply' && (mineAsGuest || (!mineAsHost && sameName(d.guestName, name)));
  // The host opening a friend's reply: keep it on the Duels page.
  useEffect(() => {
    if (!d || d.kind !== 'reply' || !d.guest || iAmGuest) return;
    saveDuel({ id: d.id, role: 'host', host: d.host, hostName: d.hostName, guest: d.guest, guestName: d.guestName, at: new Date().toISOString(), revealed: true });
  }, [param, iAmGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) {
    return (
      <>
        <PageHead eyebrow="Budget duel" title="This duel link looks incomplete" />
        <SamSays mood="worried" auto>{DUEL_LINES.broken}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href="#duels">Your duels</a><a className="btn" href="#journey">Main menu</a></ActionBar>
      </>
    );
  }

  // A comparison, from my side.
  if (d.kind === 'reply' && d.guest) {
    const mine = iAmGuest ? d.guest : d.host;
    const theirs = iAmGuest ? d.host : d.guest;
    const theirName = iAmGuest ? d.hostName : d.guestName;
    const r = duelRounds(mine, theirs);
    const back: Duel = { id: d.id, role: 'guest', host: d.host, hostName: d.hostName, guest: d.guest, guestName: name || d.guestName, at: '' };
    const how = r.tiebreak && r.tiebreak !== 'tie' ? 'on fewer cards' : null;
    const backText = `${name ? `${name} here. ` : ''}I played your budget duel: ${r.outcome === 'won' ? `my plan wins ${how ?? r.score}` : r.outcome === 'tied' ? `we tied ${r.score}` : `your plan wins ${how ?? flip(r.score)}`}. See the three rounds:`;
    const sendBack = <ShareButton text={backText} url={replyLink(back)} label={`Send it to ${them(d.hostName)}`} className="btn btn-primary" kind="plan" />;
    return (
      <>
        <PageHead eyebrow="Budget duel · the reveal" title={`You vs. ${Them(theirName)}`} />
        <SamSays mood={r.outcome === 'won' ? 'cheering' : r.outcome === 'tied' ? 'happy' : 'thinking'} auto>{DUEL_LINES[r.outcome]}</SamSays>
        <Rounds id={d.id} mine={mine} theirs={theirs} theirName={theirName} />
        <DuelBoard id={d.id} host={d.host} hostName={d.hostName} guest={d.guest} guestName={d.guestName} enter={iAmGuest} />
        {iAmGuest && (
          <section className="card duel-send">
            <h2 className="section-title">Send your plan back to {them(d.hostName)}</h2>
            <p className="small">{Them(d.hostName)} sees the same three rounds from their side.</p>
            <NameField id="duel-back-name" label="Sign it (first name, optional)" />
            <div className="sb-actions">{sendBack}</div>
            <SocialShare text={backText} url={replyLink(back)} kind="plan" />
          </section>
        )}
        <DuelStart plan={mine} compact title={iAmGuest ? 'Duel more friends with your plan' : 'Duel more friends'} />
        <ActionBar label="Next step">
          {iAmGuest ? sendBack : <RematchButton name={theirName} primary />}
          <a className="btn" href="#duels">Your duels</a>
        </ActionBar>
      </>
    );
  }

  // An invite I sent.
  if (mineAsHost) {
    const replies = duels.filter((x) => x.id === d.id && x.role === 'host' && x.guest);
    return (
      <>
        <PageHead eyebrow="Budget duel · your invite" title="Your duel invite" />
        <SamSays mood="proud" auto>{DUEL_LINES.host}</SamSays>
        <DuelStart plan={d.host} title="Send it to more friends" />
        <DuelBoard id={d.id} host={d.host} hostName={d.hostName} />
        {replies.length > 0 ? <DuelList duels={replies} title="Replies so far" /> : <p className="small muted">No replies yet. When a friend sends their plan back, the three rounds show up here and on your Duels page.</p>}
        <ActionBar label="Next step"><a className="btn btn-primary" href="#duels">Your duels</a></ActionBar>
      </>
    );
  }

  // A friend's invite.
  return <Invite d={d} />;
}

function Invite({ d }: { d: NonNullable<ReturnType<typeof readDuelParam>> }) {
  const playing = useSyncExternalStore(onDuels, () => activeDuel()?.id === d.id);
  const accept = () => {
    dropChallenge();
    setRematch(null);
    setActiveDuel({ id: d.id, role: 'guest', host: d.host, hostName: d.hostName, at: new Date().toISOString() });
    location.hash = DUEL_LEVEL;
  };
  const sealed = assessDuel(d.host);
  const label = playing ? 'Back to the duel' : 'Start the duel';
  return (
    <>
      <PageHead eyebrow="Budget duel" title={`${Them(d.hostName)} challenged you to a duel`} lede="Balance Uncle Sam’s budget on the game’s final mission, your way. Their plan stays sealed until you reveal yours; then the two plans go head to head in three rounds." />
      <SamSays mood="surprised" auto>{DUEL_LINES.invite}</SamSays>
      <section className="card duel-invite">
        <ol className="duel-rules">
          <li><strong>The debt.</strong> Whose plan leaves it lower by FY{LAST_FY}.</li>
          <li><strong>The economy.</strong> Whose plan goes easier on it in its steepest year.</li>
          <li><strong>The balance.</strong> Whose split between new taxes and spending cuts is closer to even.</li>
        </ol>
        <p className="small">Even after three rounds? The plan with fewer policy cards wins.</p>
        <div className="duel-folder" aria-label={`${Them(d.hostName)}’s plan, sealed`}>
          <span className="duel-folder-tab">Confidential · budget briefing</span>
          <span className="duel-folder-seal" aria-hidden="true">🔒</span>
          <strong className="duel-folder-title">{Them(d.hostName)} sealed a {sealed.met ? 'Balanced Budget plan' : 'budget plan'}</strong>
          <span className="duel-folder-rating" data-rating={sealedRating(d.host)}>Rating: {sealedRating(d.host)}</span>
          <span className="small">Build yours to unseal theirs. You see it only after you reveal yours.</span>
        </div>
        <button type="button" className="btn btn-primary btn-lg bar-dup" onClick={accept}>{label}</button>
        <span className="small muted">Opens the final mission right away · about 10 minutes · no sign-up</span>
      </section>
      <ActionBar label="Start"><button type="button" className="btn btn-primary" onClick={accept}>{label}</button></ActionBar>
    </>
  );
}

/** The invite for a plan: one link per plan, so every friend's reply lands in one duel. */
export function useDuelInvite(plan: DuelPlan | null) {
  const name = useMyName();
  const duels = useDuels();
  const key = plan ? planKey(plan) : '';
  const existing = plan ? duels.find((x) => x.role === 'host' && !x.guest && planKey(x.host) === key) : undefined;
  const id = useMemo(() => existing?.id ?? newDuelId(), [existing?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!plan) return null;
  const d: Duel = { id, role: 'host', host: plan, hostName: name || undefined, at: existing?.at ?? new Date().toISOString() };
  return { d, url: inviteLink(d), text: inviteText(name, plan), keep: () => { saveDuel(d); setRematch(null); } };
}

const useRematch = () => JSON.parse(useSyncExternalStore(onDuels, () => JSON.stringify(rematchFor()))) as { name?: string } | null;

/** Start a duel with a plan: the name, the invite link, and the ways to send it. One link, many friends. */
export function DuelStart({ plan, compact = false, title = 'Duel a friend on the final mission' }: { plan: DuelPlan; compact?: boolean; title?: string }) {
  const inv = useDuelInvite(plan)!;
  const rematch = useRematch();
  return (
    <section className={'card duel-start' + (compact ? ' compact' : '')} id="duel-start" aria-labelledby="duel-start-t">
      <div className="eyebrow">Budget duel</div>
      <h2 className="section-title" id="duel-start-t">{rematch ? `Rematch: send ${them(rematch.name)} a new duel` : title}</h2>
      <p className="small">Your plan goes in the link, sealed. Each friend balances the budget on their own, then sees three rounds: the debt, the economy, and the balance. Send the same link to as many friends as you like; each reply is its own head-to-head, and they all land on your Duels page.</p>
      <NameField id={'duel-name-' + (compact ? 'c' : 'm')} label="Sign it, so they know it’s from you (first name, optional)" />
      <div className="sb-actions">
        <ShareButton text={inv.text} url={inv.url} label={rematch ? 'Send the rematch' : 'Send the duel'} className="btn btn-primary" kind="plan" onShare={inv.keep} />
        <a className="btn" href={inviteHash(inv.d)} onClick={inv.keep}>See your invite</a>
      </div>
      <SocialShare text={inv.text} url={inv.url} kind="plan" onShare={inv.keep} />
    </section>
  );
}

/** A rematch: build a new plan on level 10, then send it to the same friend. */
function RematchButton({ name, primary = false }: { name?: string; primary?: boolean }) {
  return <a className={primary ? 'btn btn-primary' : 'btn'} href={'#' + DUEL_LEVEL} onClick={() => { setActiveDuel(null); setRematch({ name }); }}>Rematch</a>;
}

function DuelList({ duels, title }: { duels: Duel[]; title: string }) {
  return (
    <Section id={'duel-list-' + title.toLowerCase().replace(/\W+/g, '-')} title={title}>
      <ul className="duel-list">
        {duels.map((x) => {
          const k = `${x.id}:${x.role}:${x.guestName ?? ''}:${x.guest ? planKey(x.guest) : ''}`;
          const mine = x.role === 'host' ? x.host : x.guest;
          const theirs = x.role === 'host' ? x.guest : x.host;
          const theirName = x.role === 'host' ? x.guestName : x.hostName;
          if (!mine || !theirs) {
            return (
              <li key={k} className="duel-row">
                <div><strong>Open invite</strong><span className="small muted"> · sent {new Date(x.at).toLocaleDateString()} · waiting for replies</span></div>
                <span className="duel-row-actions"><a className="btn" href={inviteHash(x)}>Send it again</a></span>
              </li>
            );
          }
          const r = duelRounds(mine, theirs);
          return (
            <li key={k} className="duel-row" data-outcome={r.outcome}>
              <div>
                <strong>You vs. {Them(theirName)}</strong>
                <span className="small muted"> · {r.outcome === 'tied' ? `tied ${r.score}` : `${r.outcome === 'won' ? 'your' : 'their'} plan won ${r.tiebreak && r.tiebreak !== 'tie' ? `on fewer cards (${r.score})` : r.outcome === 'won' ? r.score : flip(r.score)}`} · {new Date(x.at).toLocaleDateString()}</span>
              </div>
              <span className="duel-row-actions">
                <a className="btn" href={resultHash(x)}>See the rounds</a>
                <RematchButton name={theirName} />
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** #duels: every duel kept in this browser, newest first. */
export function DuelsPage() {
  const duels = useDuels();
  const playing = useSyncExternalStore(onDuels, () => activeDuel()?.hostName ?? (activeDuel() ? '' : null));
  const results = duels.filter((x) => x.guest && (x.role === 'host' || x.revealed));
  const open = duels.filter((x) => x.role === 'host' && !x.guest);
  return (
    <>
      <PageHead eyebrow="Budget duels" title="Your duels" lede="Every budget duel you’ve sent or played on this device: your plan next to each friend’s, three rounds each. Plans are compared, never people." />
      <SamSays mood="happy" auto>{DUEL_LINES.list}</SamSays>
      {playing != null && <div className="callout small">You’re in a duel with {them(playing)}. <a href={'#' + DUEL_LEVEL}>Back to the final mission</a> to finish it and reveal both plans.</div>}
      {results.length > 0 && <DuelList duels={results} title="Results" />}
      {open.length > 0 && <DuelList duels={open} title="Open invites" />}
      {!results.length && !open.length && <p className="small">No duels yet. Balance the budget on the final mission, then send a duel to a friend.</p>}
      <ActionBar label="Next step"><a className="btn btn-primary" href={'#' + DUEL_LEVEL}>{results.length || open.length ? 'Play the final mission again' : 'Play the final mission'}</a></ActionBar>
    </>
  );
}

/**
 * Everyone on this link: each friend who finishes a duel link adds their plan (signed with their
 * first name, if they gave one), and every plan plays every other in the same three rounds. Plans
 * are compared, never people. Without the online board, the plans this device knows about.
 */
const entering = new Set<string>();
function DuelBoard({ id, host, hostName, guest, guestName, enter = false }: { id: string; host: DuelPlan; hostName?: string; guest?: DuelPlan; guestName?: string; enter?: boolean }) {
  const duels = useDuels();
  const name = useMyName();
  const [rows, setRows] = useState<BoardEntry[] | null>(null);
  useEffect(() => {
    if (!backendOn()) return;
    let live = true;
    (async () => {
      if (enter && guest) {
        const flag = `ftd:duel-entered:${id}:${planKey(guest)}`;
        let done = false;
        try { done = !!localStorage.getItem(flag); } catch { /* storage off */ }
        if (!done && !entering.has(flag)) {
          entering.add(flag);
          try { await enterDuel(id, { ...boardPlanArgs(host), name: hostName }, { ...boardPlanArgs(guest), name: name || guestName }); try { localStorage.setItem(flag, '1'); } catch { /* storage off */ } } catch { /* the board is a bonus */ }
        }
      }
      try { const b = await duelBoard(id); if (live) setRows(b.map(boardEntry).filter((x): x is BoardEntry => !!x)); } catch { /* offline */ }
    })();
    return () => { live = false; };
  }, [id, enter]); // eslint-disable-line react-hooks/exhaustive-deps
  // Offline (or before the board loads): the host's plan and the replies this device has seen.
  const local: BoardEntry[] = [{ plan: host, name: hostName, host: true, mine: duels.some((x) => x.id === id && x.role === 'host') }];
  for (const x of duels.filter((y) => y.id === id && y.guest)) if (!local.some((e) => planKey(e.plan) === planKey(x.guest!) && e.name === x.guestName)) local.push({ plan: x.guest!, name: x.guestName, host: false, mine: x.role === 'guest' });
  if (guest && !local.some((e) => planKey(e.plan) === planKey(guest))) local.push({ plan: guest, name: guestName, host: false, mine: enter });
  const entries = rows && rows.length >= local.length ? rows : local;
  if (entries.length < 3) return null;
  const table = standings(entries);
  return (
    <Section id="duel-board" title="Everyone on this link" sub={`${entries.length} plans from one duel link, each played against every other in the same three rounds. A win is a point, a draw half. Plans are compared, never people.`}>
      <ol className="duel-table">
        {table.map((e, i) => (
          <li key={i} data-mine={e.mine || undefined}>
            <span className="dt-rank num">{i + 1}</span>
            <span className="dt-who"><strong>{e.mine ? 'Your plan' : `${e.name || (e.host ? 'The host' : 'A friend')}’s plan`}</strong>{e.host && <span className="pill">set the challenge</span>}</span>
            <span className="dt-rec num" aria-label={`${e.w} wins, ${e.l} losses, ${e.t} draws`}>{e.w}–{e.l}{e.t ? `–${e.t}` : ''}</span>
            <span className="dt-stats small muted">Debt {(e.a.last.debt / e.a.last.gdp * 100).toFixed(1)}% of GDP · steepest year {(e.a.econ.peakStep * 100).toFixed(1)}% · {splitLabel(e.a)}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { Stars } from '../components/game';
import { LAST_FY } from '../lib/assess';
import { LEVERS, type Levers } from '../lib/sandbox';
import { cardName } from './ChallengeParts';
import { activeDuel, assessDuel, DUEL_LEVEL, type Duel, type DuelPlan, duelRounds, inviteHash, inviteLink, newDuelId, planKey, readDuelParam, rematchFor, replyLink, resultHash, saveDuel, setActiveDuel, setRematch, useDuels } from './duel';
import { dropChallenge } from './challenge';
import { NameField } from './NameField';
import { cleanName, useMyName } from './plans';
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

export function inviteText(name: string) {
  const body = 'Duel me on the final mission of “Help Uncle Sam Balance the Budget”: we each balance the budget on our own, then compare three rounds: the debt, the economy, and the balance. My plan stays sealed until you finish yours.';
  return name ? `${name} here. ${body}` : body;
}

/** The comparison: three rounds, side by side, then the cards each plan used. */
function Rounds({ mine, theirs, theirName }: { mine: DuelPlan; theirs: DuelPlan; theirName?: string }) {
  const r = useMemo(() => duelRounds(mine, theirs), [mine, theirs]);
  const col = theirName || 'Them';
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
  return (
    <>
      <section className="card duel-score" aria-live="polite">
        <strong className="duel-score-num">{headline(r, theirName)}</strong>
        <span className="small muted">{r.tiebreak && r.tiebreak !== 'tie' ? `Even at ${r.score} after three rounds, so the tie-breaker decides: ${r.tiebreakBy === 'economy' ? 'the gentler steepest year wins' : 'the economy is even too, so fewer cards wins'}.` : 'Best of three rounds; if they come out even, the gentler plan wins, then the one with fewer cards.'} Plans are compared, never people.</span>
        <span className="small duel-balanced">
          {r.balanced.mine && r.balanced.theirs ? 'Both plans balance the budget.' : `${r.balanced.mine ? 'Your plan balances the budget' : 'Your plan doesn’t balance the budget yet'}; ${r.balanced.theirs ? `${them(theirName)}’s does` : `${them(theirName)}’s doesn’t yet`}.`}
        </span>
      </section>
      <ol className="duel-rounds">
        {r.rounds.map((x, i) => (
          <li key={x.id} className="card duel-round" data-winner={x.winner}>
            <div className="duel-round-head">
              <span className="stat-label">Round {i + 1} · {x.title}</span>
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
      </ol>
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
        <Rounds mine={mine} theirs={theirs} theirName={theirName} />
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
        <p className="small">{Them(d.hostName)}’s plan: <span className="duel-sealed">sealed</span>, {sealed.met ? 'and it balances the budget' : 'still short of balancing the budget'}. You see it only after you reveal yours.</p>
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
  return { d, url: inviteLink(d), text: inviteText(name), keep: () => { saveDuel(d); setRematch(null); } };
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

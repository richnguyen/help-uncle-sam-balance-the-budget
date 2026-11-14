import type { ReactNode } from 'react';
import { PageHead } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { backendOn } from '../lib/backend';
import { editionName, loadResults, nextDeadline, nextTheme, themeFor, todayKey } from './daily';
import { activeDuel, DUEL_LEVEL, SHOWDOWN, useDuels } from './duel';
import { siteRoot } from './plans';
import { activeRoom } from './rooms';
import { ShareButton } from './ShareButton';
import { TOGETHER_LINES } from './script';
import { useDailyStreak } from './streak';
import { SamSays } from './UncleSam';

// Play together: the ways to play with other people. Each card says who it's for, how long it
// takes, and has the one button that starts it; the steps sit under "How it works". The Sealed
// Showdown (two plans, sealed, then three rounds) leads; then rooms for a class or a club, the
// Daily Dollar as a group-chat habit, and pass-the-budget chains. Nothing here ranks people:
// groups compare plans and squares, never players.

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICON: Record<string, ReactNode> = {
  // A sealed folder with a lock.
  duel: <><path d="M3.5 8V6.5a1.5 1.5 0 0 1 1.5-1.5h4l1.8 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" {...stroke} /><rect x="9.6" y="11.6" width="4.8" height="3.9" rx="0.9" {...stroke} /><path d="M10.6 11.6v-1a1.4 1.4 0 0 1 2.8 0v1" {...stroke} /></>,
  room: <><circle cx="8" cy="8.5" r="2.6" {...stroke} /><circle cx="16.5" cy="9.5" r="2.1" {...stroke} /><path d="M3 19c.4-3 2.4-4.8 5-4.8s4.6 1.8 5 4.800M14.2 14.600c.7-.3 1.5-.5 2.3-.5 2.2 0 3.8 1.5 4.2 4" {...stroke} /></>,
  daily: <><rect x="4" y="5.5" width="16" height="14" rx="2.2" {...stroke} /><path d="M4 10h16M8.5 3.500v4M15.5 3.500v4" {...stroke} /><path d="m9.2 14.8 2 2 3.8-4" {...stroke} /></>,
  chain: <><path d="M10 13.500a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.700l-1 1" {...stroke} /><path d="M14 10.500a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.700l1-1" {...stroke} /></>,
  peoples: <><path d="M12 3v2.500M7.5 11a4.5 4.5 0 0 1 9 0M4.5 11h15M6 11v7M10 11v7M14 11v7M18 11v7M3.5 20.500h17M4.5 18h15" {...stroke} /></>,
};

function Card({ kind, tag, title, pitch, chips, state, how, compact, children }: { kind: string; tag: string; title: string; pitch: ReactNode; chips: string[]; state?: ReactNode; how: string[]; compact: boolean; children: ReactNode }) {
  return (
    <li className="tcard" data-kind={kind}>
      <div className="tcard-head">
        <span className="tcard-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24">{ICON[kind]}</svg></span>
        <div className="tcard-names">
          <span className="tcard-tag">{tag}</span>
          <strong className="tcard-title">{title}</strong>
        </div>
      </div>
      {!compact && <p className="tcard-pitch">{pitch}</p>}
      <ul className="tcard-chips" aria-label="Who it’s for and how long it takes">{chips.map((c) => <li key={c}>{c}</li>)}</ul>
      {state && <p className="tcard-state small">{state}</p>}
      {!compact && (
        <details className="tcard-how">
          <summary>How it works</summary>
          <ol>{how.map((h) => <li key={h}>{h}</li>)}</ol>
        </details>
      )}
      <span className="tcard-actions">{children}</span>
    </li>
  );
}

export function TogetherCards({ compact = false }: { compact?: boolean }) {
  const key = todayKey();
  const theme = themeFor(key);
  const due = nextDeadline(key, 45);
  const upcoming = theme ? null : nextTheme(key, 45);
  const duels = useDuels();
  const streak = useDailyStreak();
  const playing = activeDuel();
  const room = activeRoom();
  const results = duels.filter((x) => x.guest && (x.role === 'host' || x.revealed)).length;
  const open = duels.filter((x) => x.role === 'host' && !x.guest).length;
  const playedToday = !!loadResults()[key];
  const dailyText = 'Let’s do the Daily Dollar together: five higher-or-lower calls on real federal numbers, the same for everyone, a minute a day. Post your squares here.';
  const chainText = 'Let’s fix Uncle Sam’s budget together: each of us makes one change, then passes it on. I’ll start.';
  const edition = theme ? `This week: ${editionName(theme)}.` : due ? 'Coming up: Shutdown Watch, the week before funding runs out.' : upcoming ? `Coming up: ${upcoming.name}.` : null;
  return (
    <ul className={'together-cards' + (compact ? ' compact' : '')}>
      <Card
        kind="duel" compact={compact} tag="One friend, or the whole chat" title={SHOWDOWN}
        pitch="Seal your plan for the final mission and dare a friend to beat it. They see the rating, never the moves, until they lock in their own."
        chips={['1 link, any number of friends', 'About 10 minutes each', '3 rounds']}
        state={playing ? <>You’re in a showdown with {playing.hostName || 'a friend'}. <a href={'#' + DUEL_LEVEL}>Finish your plan</a> to unseal theirs.</> : results || open ? <>{results ? `${results} showdown${results === 1 ? '' : 's'} played` : ''}{results && open ? ' · ' : ''}{open ? `${open} sealed plan${open === 1 ? '' : 's'} out` : ''}</> : undefined}
        how={['Balance the budget on the final mission, then send your plan as a sealed dossier: your rating, how many cards, and where the debt lands. The moves stay blacked out.', 'Each friend builds a plan on their own, with only your sealed benchmark to aim at.', 'The plans unseal in three rounds, scored like boxing: the debt, the economy, and the balance. Everyone on the same link shares one board. Plans are compared, never people.']}
      >
        <a className="btn btn-primary" href={'#' + DUEL_LEVEL}>{playing ? 'Back to your plan' : 'Build and seal a plan'}</a>
        <a className="btn" href="#duels">Your showdowns</a>
      </Card>
      <Card
        kind="room" compact={compact} tag="Class, club, or office" title="Build one plan as a group"
        pitch="Everyone plays the same budget-desk mission on their own phone, and the room shows the plan the group agrees on."
        chips={['5 to 40 people', 'One class period', 'A 6-character code']}
        state={room ? <>Your room: <a href={'#room?c=' + room.code}><strong>{room.name}</strong> ({room.code})</a></> : undefined}
        how={['Start a room and share its 6-character code. No accounts, and nobody sees who chose what.', 'Each plan joins the room’s: a card is in when more than half the plans use it.', 'End with the big-screen reveal: the group’s budget personality and the card that split the room.']}
      >
        <a className="btn btn-primary" href="#rooms">{room ? 'Rooms' : 'Start a room'}</a>
        <a className="btn" href="#teach">Lesson plan for teachers</a>
      </Card>
      <Card
        kind="daily" compact={compact} tag="Your group chat" title="The Daily Dollar, together"
        pitch={<>Five higher-or-lower calls on real federal numbers, the same puzzle for everyone.{edition ? ' ' + edition : ''}</>}
        chips={['Any size', 'A minute a day', 'Same puzzle for everyone']}
        state={streak.run > 0 ? <>🔥 {streak.run} day{streak.run === 1 ? '' : 's'} in a row{playedToday ? ' · played today' : ' · today’s is waiting'}</> : undefined}
        how={['Play today’s five calls. It takes about a minute.', 'Post your squares to the chat: they show how you did without spoiling the answers.', 'Come back tomorrow. Special editions run for Budget Week, Tax Week, and funding deadlines.']}
      >
        <a className="btn btn-primary" href="#daily">{playedToday ? 'See today’s' : 'Play today’s'}</a>
        <ShareButton text={dailyText} url={siteRoot() + '?daily'} label="Invite the group" kind="daily" />
      </Card>
      <Card
        kind="chain" compact={compact} tag="A few friends or family" title="Pass the budget"
        pitch="One change each, then pass the link on. Whoever meets the goal closes the deal, and everyone in the chain gets credit."
        chips={['3 to 10 people', 'Two minutes a turn', 'One link']}
        how={['Make one change to Uncle Sam’s budget: add a policy card, or take one out.', 'Send the link to the next person. It shows whose turn it is, on a 4-hour clock.', 'The move that meets the goal closes the deal, with a receipt that credits every hand.']}
      >
        <a className="btn btn-primary" href="#chain">Start a chain</a>
        {!compact && <ShareButton text={chainText} url={siteRoot() + '?chain'} label="Send it to the group" kind="chain" />}
      </Card>
      {backendOn() && !compact && (
        <Card
          kind="peoples" compact={compact} tag="Everyone at once" title="The People’s Budget"
          pitch="One budget built by everyone who plays. Each person pushes one card in or out a day."
          chips={['The whole country', 'One move a day']}
          how={['Push one policy card in or out. That’s your move for the day.', 'A card is in the budget when more moves pushed it in than out over the last 30 days.']}
        >
          <a className="btn btn-primary" href="#peoples">Make today’s move</a>
        </Card>
      )}
    </ul>
  );
}

export default function Together() {
  return (
    <>
      <PageHead eyebrow="Play together" title="Play together" lede="Budgets are a group project. Dare a friend with a sealed plan, play with your class or club, or pass Uncle Sam’s budget around until it’s fixed." />
      <SamSays mood="happy" auto>{TOGETHER_LINES.intro}</SamSays>
      <TogetherCards />
      <ActionBar label="Start"><a className="btn btn-primary" href={'#' + DUEL_LEVEL}>Seal a plan</a><a className="btn" href="#rooms">Start a room</a></ActionBar>
    </>
  );
}

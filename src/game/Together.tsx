import { PageHead } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { backendOn } from '../lib/backend';
import { editionName, nextDeadline, nextTheme, themeFor, todayKey } from './daily';
import { siteRoot } from './plans';
import { ShareButton } from './ShareButton';
import { TOGETHER_LINES } from './script';
import { SamSays } from './UncleSam';

// Play together: the three ways to play with other people, each with who it's for, how long it
// takes, and the one button that starts it. Rooms for a class or a club, the Daily Dollar as a
// group-chat habit, and pass-the-budget chains. Nothing here ranks people: groups compare plans
// and squares, never players.

export function TogetherCards({ compact = false }: { compact?: boolean }) {
  const key = todayKey();
  const theme = themeFor(key);
  const due = nextDeadline(key, 45);
  const upcoming = theme ? null : nextTheme(key, 45);
  const dailyText = 'Let’s do the Daily Dollar together: five higher-or-lower calls on real federal numbers, the same for everyone, a minute a day. Post your squares here.';
  const chainText = 'Let’s fix Uncle Sam’s budget together: each of us makes one change, then passes it on. I’ll start.';
  return (
    <ul className={'together-cards' + (compact ? ' compact' : '')}>
      <li className="tcard" data-kind="room">
        <span className="tcard-tag">Class, club, or office</span>
        <strong className="tcard-title">Build one plan as a group</strong>
        <span className="tcard-meta">5 to 40 people · one class period · a 6-character code</span>
        {!compact && <p className="small">Everyone plays the same budget-desk mission on their own phone. Each plan joins the room’s, and the room shows the plan the group agrees on, card by card. No accounts, and nobody sees who chose what. End with the big-screen reveal: the group’s budget personality and the card that split the room.</p>}
        <span className="tcard-actions">
          <a className="btn btn-primary" href="#rooms">Start a room</a>
          <a className="btn" href="#teach">For teachers: a lesson plan</a>
        </span>
      </li>
      <li className="tcard" data-kind="daily">
        <span className="tcard-tag">Your group chat</span>
        <strong className="tcard-title">The Daily Dollar, together</strong>
        <span className="tcard-meta">Any size · a minute a day · same puzzle for everyone</span>
        {!compact && <p className="small">Five higher-or-lower calls on real numbers. Post your squares to the chat and see what surprised everyone.{theme ? ` This week: ${editionName(theme)}.` : due ? ` Coming up: Shutdown Watch, the week before funding runs out.` : upcoming ? ` Coming up: ${upcoming.name}.` : ' Special editions for Budget Week, Tax Week, and funding deadlines.'}</p>}
        <span className="tcard-actions">
          <a className="btn btn-primary" href="#daily">Play today’s</a>
          <ShareButton text={dailyText} url={siteRoot() + '?daily'} label="Invite the group" kind="daily" />
        </span>
      </li>
      <li className="tcard" data-kind="chain">
        <span className="tcard-tag">A few friends or family</span>
        <strong className="tcard-title">Pass the budget</strong>
        <span className="tcard-meta">3 to 10 people · two minutes a turn · one link</span>
        {!compact && <p className="small">One person makes one change to Uncle Sam’s budget, then sends the link to the next. Each turn has a 4-hour clock, and the link shows whose turn it is. The one who meets the goal closes the deal, and everyone in the chain gets credit.</p>}
        <span className="tcard-actions">
          <a className="btn btn-primary" href="#chain">Start a chain</a>
          {!compact && <ShareButton text={chainText} url={siteRoot() + '?chain'} label="Send it to the group" kind="chain" />}
        </span>
      </li>
      <li className="tcard" data-kind="duel">
        <span className="tcard-tag">One friend, or many</span>
        <strong className="tcard-title">Duel on the final mission</strong>
        <span className="tcard-meta">2 plans per duel · about 10 minutes each · one link for many friends</span>
        {!compact && <p className="small">You each balance the budget on your own, with your plans sealed. Then the two plans face off in three rounds, revealed one at a time like a boxing scorecard: the debt, the economy, and the balance. Everyone who plays the same link lands on one board. Plans are compared, never people.</p>}
        <span className="tcard-actions">
          <a className="btn btn-primary" href="#level-10">Build your plan</a>
          <a className="btn" href="#duels">Your duels</a>
        </span>
      </li>
      {backendOn() && !compact && (
        <li className="tcard" data-kind="peoples">
          <span className="tcard-tag">Everyone at once</span>
          <strong className="tcard-title">The People’s Budget</strong>
          <span className="tcard-meta">The whole country · one move a day</span>
          <p className="small">One budget built by everyone who plays: each person pushes one card in or out a day.</p>
          <span className="tcard-actions"><a className="btn" href="#peoples">Make today’s move</a></span>
        </li>
      )}
    </ul>
  );
}

export default function Together() {
  return (
    <>
      <PageHead eyebrow="Play together" title="Play together" lede="Budgets are a group project. Play with your class or club, make the Daily Dollar a group-chat habit, or pass Uncle Sam’s budget around until it’s fixed." />
      <SamSays mood="happy" auto>{TOGETHER_LINES.intro}</SamSays>
      <TogetherCards />
      <ActionBar label="Start"><a className="btn btn-primary" href="#rooms">Start a room</a><a className="btn" href="#daily">Today’s Daily Dollar</a></ActionBar>
    </>
  );
}

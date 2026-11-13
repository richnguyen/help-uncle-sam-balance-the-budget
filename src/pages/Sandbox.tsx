import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TimeChart } from '../components/charts';
import { DragBars, EconMeter, GapBar, type GapSegment, LeverIcon, SIDE_COLOR, SplitBar, Stars, useToasts, useTween } from '../components/game';
import { Carousel } from '../components/Carousel';
import { ActionBar } from '../components/ActionBar';
import { Accomplishments, CongressLink } from '../game/DeskExtras';
import { PlanIdeas } from '../game/ideas';
import { ChartFrame, Legend, PageHead, Section, Seg, Term } from '../components/ui';
import { budget, cbo } from '../data';
import { dateLabel, dollars, lower, money, pct } from '../lib/format';
import { BADGES, earnedBadges, evaluate, loadProgress, MISSIONS, planText, type Progress, saveProgress } from '../lib/game';
import { economics, extraFor, type Goal, goalMet, MULT, mid, optimize, optionPath, type PlanContext, planCost, type Protect, score, shortfall } from '../lib/plan';
import { OPTIONS_DATA, withEcon } from '../lib/planData';
import { LEVERS, type LeverId, type Levers, simulate, ZERO } from '../lib/sandbox';
import { type Choice, useVotes } from '../lib/votes';
import { Celebration } from '../game/Celebrate';
import { DESK, type DeskLevel, isUnlocked, missionLong, missionShort, nextOf, STOP_BY_ID, STOPS } from '../game/levels';
import { useJourney } from '../game/state';
import { SamSays } from '../game/UncleSam';
import type { Mood } from '../game/voice';
import { useHaptics } from '../game/haptics';
import { COACH, DESK_PARTY, HINT_LINES, REACT } from '../game/script';
import { PlanForYou } from '../game/PlanForYou';
import { activeChallenge, type Challenge, dropChallenge } from '../game/challenge';
import { AgreementCard, assessShared, ChallengeShare, challengeText, GOAL_DONE, HeadToHead, headToHead } from '../game/ChallengeParts';
import { CHALLENGE_LINES } from '../game/script';
import { ShareButton } from '../game/ShareButton';
import { countStep } from '../lib/backend';
import { encodePlan } from '../game/plans';
import { ballotFrom, compare, useMyName } from '../game/plans';
import { useShareLink } from '../game/shortlinks';
import { activeRoom, type RoomRef, setActiveRoom } from '../game/rooms';
import { sendRoomPlan } from '../lib/backend';
import { load, save } from '../lib/storage';
import { activeDuel, assessDuel, DUEL_LEVEL, type Duel, rematchFor, resultHash, saveDuel, setActiveDuel, setRematch, splitLabel } from '../game/duel';
import { DuelStart, useDuelInvite } from '../game/Duel';
import { DUEL_LINES } from '../game/script';

type Desk = DeskLevel;

interface Draft { ids: string[]; lv: Levers; gradual: boolean }
const draftKey = (desk: Desk | undefined, c: Challenge | null, duel?: Duel | null) => (desk ? desk.id + (duel ? ':duel:' + duel.id : c ? ':' + encodePlan(c.plan) : '') : '');
function readDraft(key: string): Draft | null {
  if (!key) return null;
  const d = load<Record<string, Draft>>('desk-draft', {})[key];
  if (!d || !Array.isArray(d.ids)) return null;
  const known = new Set(OPTIONS_DATA.options.map((o) => o.id));
  return { ids: d.ids.filter((id) => known.has(id)), lv: { ...ZERO, ...d.lv }, gradual: d.gradual !== false };
}
function writeDraft(key: string, d: Draft | null) {
  if (!key) return;
  const all = load<Record<string, Draft>>('desk-draft', {});
  if (d) all[key] = d; else delete all[key];
  save('desk-draft', Object.fromEntries(Object.entries(all).slice(-12)));
}
// The ground rules for the least-cost plan the efficiency score compares against.
const LEAST_COST_RULES: Protect = { retirees: true, lowIncome: true, investment: true };

const LEVER_NAME: Record<LeverId, string> = {
  revenues: 'Taxes', socialSecurity: 'Social Security', medicare: 'Medicare', medicaid: 'Medicaid',
  otherMandatory: 'Farm and other programs', defense: 'Defense', nondefense: 'Grants and other programs',
};
const dragLevel = (s: number): 1 | 2 | 3 => (s < 0.55 ? 1 : s < 1.15 ? 2 : 3);
type Filter = 'all' | 'revenue' | 'spending';
type Sort = 'impact' | 'gentle';

/** The three stars; hovering, focusing or tapping them shows what earns each one. */
function StarsPopover({ stars, checks, extra }: { stars: number; checks: { id: string; label: string; done: boolean; tip: string }[]; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="starpop" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="starpop-btn" aria-expanded={open} aria-controls="starpop-panel" onClick={() => setOpen((o) => !o)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        <Stars n={stars} size="lg" label={`${stars} of 3 stars. Show what earns each star.`} />
      </button>
      {open && (
        <div className="starpop-panel" id="starpop-panel" role="tooltip">
          <div className="stat-label">How to earn the stars</div>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.id} data-done={c.done}>
                <span className="check-mark" aria-hidden="true">{c.done ? '★' : '☆'}</span>
                <div><strong>{c.label}</strong><div className="small muted">{c.tip}</div></div>
              </li>
            ))}
          </ul>
          {extra}
        </div>
      )}
    </div>
  );
}

export default function Sandbox({ desk }: { desk?: Desk }) {
  const startYear = budget.latestFY;
  const base = useMemo(() => cbo.baseline.filter((b) => b.fy > startYear), [startYear]);
  const start = cbo.baseline.find((b) => b.fy === startYear) ?? cbo.history.find((h) => h.fy === startYear)!;
  const ctx: PlanContext = useMemo(() => ({ baseline: base, startDebt: start.debtPublic, startRatio: start.debtPublic / start.gdp, options: withEcon() }), [base, start]);
  const years = base.map((b) => b.fy);
  const lastFY = years.at(-1)!;
  const HH = budget.households.value;

  const [goal, setGoal] = useState<Goal>(desk?.goal ?? 'stabilize');
  const journey = useJourney();
  const buzz = useHaptics();
  // A level 10 duel the player accepted: a friend's plan, sealed until the player reveals theirs.
  const isDuelLevel = desk?.id === DUEL_LEVEL;
  const [duel, setDuel] = useState<Duel | null>(() => (isDuelLevel ? activeDuel() : null));
  // A friend's challenge for this level, if the player took one (a duel comes first).
  const [challenge, setChallenge] = useState<Challenge | null>(() => { const c = activeChallenge(); return c && desk && c.plan.level === desk.id && !duel ? c : null; });
  // A rematch: the friend the next duel invite is for.
  const [rematch, setRematchState] = useState(() => (isDuelLevel && !duel ? rematchFor() : null));
  // The plan in progress is kept for each level (and each friend's challenge or duel), so a call,
  // a locked screen, or a reload drops the player back exactly where they were.
  const [draft] = useState(() => readDraft(draftKey(desk, challenge, duel)));
  const [gradual, setGradual] = useState(draft?.gradual ?? true);
  const [ids, setIds] = useState<string[]>(draft?.ids ?? []);
  const [lv, setLv] = useState<Levers>(draft?.lv ?? { ...ZERO });
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('impact');
  const [progress, setProgressState] = useState<Progress>(() => loadProgress());
  const [copied, setCopied] = useState<'idle' | 'done' | 'manual'>('idle');
  const votes = useVotes();
  const toasts = useToasts();
  // Uncle Sam's fact about a card, the first time it is played on this visit.
  const [react, setReact] = useState<string | null>(null);
  // Level 5's hint: Uncle Sam's line, and the card he points to (cleared when the plan changes).
  const [hint, setHint] = useState<{ line: string; card?: string } | null>(null);
  const told = useRef(new Set<string>());
  const mission = MISSIONS.find((m) => m.id === goal)!;

  // --- model ---
  const run = (sel: string[], levers: Levers) => simulate(base, ctx.startDebt, levers, { phaseIn: gradual, extra: extraFor(sel, ctx, gradual) });
  const baseline = useMemo(() => simulate(base, ctx.startDebt, ZERO), [base, ctx.startDebt]);
  const lastB = baseline.at(-1)!;
  const short0 = shortfall(goal, baseline, ctx.startRatio);
  const shareOf = useMemo(() => {
    // Each card's share of the gap, measured on its own.
    const m: Record<string, number> = {};
    for (const o of ctx.options) m[o.id] = short0 > 0 ? (short0 - shortfall(goal, run([o.id], ZERO), ctx.startRatio)) / short0 : 0;
    return m;
  }, [goal, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  // Mission 1.9 opens on a starter deck: the three biggest tax cards and the three biggest
  // spending cuts, topped up until they can reach the goal together. The full deck is a tap away
  // (and opens on its own from 2.7). Worked out once, so the cards don't shuffle as the plan changes.
  const starterRef = useRef<Set<string> | null | undefined>(undefined);
  if (starterRef.current === undefined) {
    if (!desk?.hint) starterRef.current = null;
    else {
      const big = (side: 'revenue' | 'spending') => ctx.options.filter((o) => o.side === side && (shareOf[o.id] ?? 0) > 0).sort((a, b) => (shareOf[b.id] ?? 0) - (shareOf[a.id] ?? 0));
      const rev = big('revenue'), sp = big('spending');
      const pick = [...rev.slice(0, 3), ...sp.slice(0, 3)].map((o) => o.id);
      const more = [...rev.slice(3), ...sp.slice(3)].sort((a, b) => (shareOf[b.id] ?? 0) - (shareOf[a.id] ?? 0));
      while (more.length && !goalMet(goal, run(pick, ZERO), ctx.startRatio)) pick.push(more.shift()!.id);
      starterRef.current = new Set(pick);
    }
  }
  const starter = starterRef.current;
  const [showAll, setShowAll] = useState(false);
  const visible = (id: string) => !starter || showAll || starter.has(id) || ids.includes(id);
  const mine = useMemo(() => run(ids, lv), [ids, lv, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardsOnly = useMemo(() => run(ids, ZERO), [ids, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = mine.at(-1)!;
  const prog = short0 > 0 ? (short0 - shortfall(goal, mine, ctx.startRatio)) / short0 : 1;
  const progCards = short0 > 0 ? (short0 - shortfall(goal, cardsOnly, ctx.startRatio)) / short0 : 1;
  const met = goalMet(goal, mine, ctx.startRatio);
  const econ = useMemo(() => economics(ctx, ids, lv, gradual), [ctx, ids, lv, gradual]);
  const selected = ctx.options.filter((o) => ids.includes(o.id));
  const revTen = selected.filter((o) => o.side === 'revenue').reduce((s, o) => s + o.savings10, 0);
  const spTen = selected.filter((o) => o.side === 'spending').reduce((s, o) => s + o.savings10, 0);
  const revenueShare = revTen + spTen ? revTen / (revTen + spTen) : 0;
  const slidersUsed = Object.values(lv).some((v) => v !== 0);
  const crossesRules = selected.some((o) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment'));

  // Segments: each card's own share, scaled so cards together equal their combined progress;
  // across-the-board changes fill whatever they add on top.
  const rawSum = selected.reduce((s, o) => s + Math.max(0, shareOf[o.id] ?? 0), 0);
  const k = rawSum > 0 ? Math.max(0, progCards) / rawSum : 0;
  const segments: GapSegment[] = [
    ...selected.filter((o) => o.side === 'revenue').map((o) => ({ id: o.id, label: o.name, share: Math.max(0, shareOf[o.id]) * k, side: o.side })),
    ...selected.filter((o) => o.side === 'spending').map((o) => ({ id: o.id, label: o.name, share: Math.max(0, shareOf[o.id]) * k, side: o.side })),
    ...(slidersUsed && prog - progCards > 0.001 ? [{ id: 'sliders', label: 'Across-the-board changes', share: prog - progCards, side: (lv.revenues > 0 ? 'revenue' : 'spending') as 'revenue' | 'spending' }] : []),
  ];

  // The least-cost plan: what the efficiency score measures against.
  const econPlan = useMemo(() => optimize(ctx, goal, LEAST_COST_RULES, gradual, 1 / 3), [ctx, goal, gradual]);
  const econCost = econPlan.met ? planCost(ctx, econPlan.ids) : null;
  const myCost = planCost(ctx, ids);
  const efficiency = met && !slidersUsed && econCost != null && myCost > 0 ? Math.min(100, Math.round((econCost / myCost) * 100)) : null;

  // No hints: the player works out the plan. The stars' tips describe what earns each one, never which card to play.
  const ev = evaluate({
    met, econ, revenueShare, count: selected.length, crossesRules,
    heavySide: selected.length ? (revenueShare > 2 / 3 ? 'revenue' : revenueShare < 1 / 3 ? 'spending' : null) : null,
  });
  const voted = Object.keys(votes.mine.options).length > 0 || !!votes.mine.plan;

  // --- rewards: best stars per mission and badges, saved in this browser ---
  const first = useRef(true);
  useEffect(() => {
    const earned = earnedBadges({ goal, ev, count: selected.length, revenueShare, efficiency, voted });
    const fresh = earned.filter((b) => !progress.badges.includes(b));
    const best = Math.max(progress.stars[goal] ?? 0, ev.stars);
    if (fresh.length || best !== (progress.stars[goal] ?? 0)) {
      const next: Progress = { stars: { ...progress.stars, [goal]: best }, badges: [...progress.badges, ...fresh] };
      setProgressState(next);
      saveProgress(next);
      if (!first.current && fresh.length) {
        const names = fresh.map((b) => BADGES.find((x) => x.id === b)?.name).filter(Boolean);
        toasts.push(names.length === 1 ? `Badge unlocked: ${names[0]}` : `${names.length} badges unlocked: ${names.join(', ')}`);
      }
    }
    first.current = false;
  }, [ev.stars, ev.met, ev.gentle, ev.promiseKept, selected.length, revenueShare, efficiency, voted, goal]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- the journey: meeting the goal completes this level ---
  const deskStop = desk ?? DESK.find((d) => d.goal === goal)!;
  const [party, setParty] = useState<number | null>(null);
  const wasMet = useRef(met);
  useEffect(() => {
    const counts = !!desk || isUnlocked(deskStop.id, journey.done, journey.settings.freeRoam);
    if (met && counts && (!journey.done.includes(deskStop.id) || ev.stars > (journey.stars[deskStop.id] ?? 0))) journey.completeLevel(deskStop.id, ev.stars);
    // A friend's challenge shows its result on the page instead (see "You vs …" below).
    // So does a duel: the player reveals both plans when they're ready.
    if (met && desk && !wasMet.current && !challenge && !duel) setParty(ev.stars);
    wasMet.current = met;
  }, [met, ev.stars, deskStop.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextStop = desk ? nextOf(desk.id) : undefined;
  const here = desk ? STOP_BY_ID[desk.id] : undefined;

  // The latest plan that meets the goal is kept, for challenges and the Budget Story.
  useEffect(() => {
    if (!met || !desk) return;
    journey.savePlan(desk.id, { ids, lv, gradual, stars: ev.stars, at: new Date().toISOString() });
  }, [met, ids.join(), Object.values(lv).join(), gradual, ev.stars]); // eslint-disable-line react-hooks/exhaustive-deps
  // Playing for a room: the plan that meets the goal is sent to the room (cards only).
  useEffect(() => { if (desk) writeDraft(draftKey(desk, challenge, duel), ids.length || slidersUsed ? { ids, lv, gradual } : null); }, [ids.join(), Object.values(lv).join(), gradual, challenge, duel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [room, setRoom] = useState<RoomRef | null>(() => { const r = activeRoom(); return r && desk && r.level === desk.n ? r : null; });
  const [roomSent, setRoomSent] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  useEffect(() => {
    if (!met || !room) return;
    setRoomSent('sending');
    const t = setTimeout(() => {
      sendRoomPlan(room.code, ids, ev.stars).then(() => setRoomSent('sent')).catch(() => setRoomSent('failed'));
    }, 1500);
    return () => clearTimeout(t);
  }, [met, room?.code, ids.join(), ev.stars]); // eslint-disable-line react-hooks/exhaustive-deps
  const theirs = challenge ? assessShared(challenge.plan) : null;
  const mineNow = challenge && met ? assessShared({ goal, ids, lv, gradual, stars: ev.stars, at: '' }) : null;
  const challengeBy = challenge?.plan.by || 'Your friend';
  const byShort = challengeBy === 'Your friend' ? 'your friend' : challengeBy;
  const byCol = challengeBy === 'Your friend' ? 'Them' : challengeBy;
  const h2h = mineNow && theirs ? headToHead(mineNow, theirs) : null;
  // Someone who hasn't played anything else yet (they came straight to this level, say from a link).
  const newcomer = !!desk && !journey.done.some((id) => id !== desk.id);
  const challengeKey = challenge ? encodePlan(challenge.plan) : '';
  const returned = () => { if (challenge) countStep('returned', challengeKey); };
  useEffect(() => { if (met && challenge) countStep('met', challengeKey); }, [met, challengeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = useMyName();
  const myLink = useShareLink(desk?.id, met && desk ? { ids, lv, gradual, stars: ev.stars } : null, { by: name || undefined, ballot: ballotFrom(journey.choices) });
  // Level 10 shares a duel invite instead of a challenge.
  const invite = useDuelInvite(isDuelLevel && met && !duel && !challenge ? { ids, lv, gradual } : null);
  const shareText = desk ? challengeText(name, `I ${GOAL_DONE[goal]} with ${ids.length} policy card${ids.length === 1 ? '' : 's'} and ${ev.stars} of 3 stars${h2h?.outcome === 'won' ? `, and beat ${byShort}’s plan` : ''}. Can you beat mine?`) : undefined;
  const challengeResult = (inCard: boolean) => challenge && theirs && mineNow ? (
    <div className="challenge-result">
      <div className="stat-label">Your challenge from {challengeBy}</div>
      <HeadToHead mine={mineNow} theirs={theirs} by={byCol} sam={!inCard} auto={false} />
      <AgreementCard a={compare({ ids, ballot: ballotFrom(journey.choices) }, { ids: challenge.plan.ids, ballot: challenge.plan.ballot })} by={challengeBy === 'Your friend' ? 'your friend' : challengeBy} shareUrl={myLink} />
    </div>
  ) : null;

  // Uncle Sam reacts to the plan as it changes, like a coach at the player's elbow.
  const steep = econ.peakStep > 0.01;
  const cardsCanWin = useMemo(() => goalMet(goal, run(ctx.options.map((o) => o.id), ZERO), ctx.startRatio), [goal, gradual, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const coach: { mood: Mood; line: string } = met
    ? (ev.stars === 3 ? { mood: 'cheering', line: COACH.met3 } : { mood: 'cheering', line: COACH.met })
    : react && ids.includes(react) && !steep && REACT[react]
      ? { mood: 'surprised', line: REACT[react] }
    : prog <= 0.001
      ? { mood: 'worried', line: goal === 'stabilize' ? COACH.startStabilize : COACH.start }
      : steep
        ? { mood: 'surprised', line: COACH.steep }
        : prog >= 0.75 && !cardsCanWin && !slidersUsed
          ? { mood: 'thinking', line: COACH.cardsShort }
        : prog >= 0.75
          ? { mood: 'happy', line: COACH.almost }
          : prog >= 0.4
            ? { mood: 'thinking', line: COACH.partway }
            : { mood: 'thinking', line: COACH.begun };

  // --- actions ---
  const toggle = (id: string) => {
    buzz('card'); setCopied('idle');
    const adding = !ids.includes(id);
    setReact(adding && REACT[id] && !told.current.has(id) ? id : null);
    if (adding) told.current.add(id);
    setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const reset = () => { setIds([]); setLv({ ...ZERO }); setReact(null); setCopied('idle'); setHint(null); };
  // A plan idea goes onto the desk as the player's own plan, to change as they like.
  const loadIdea = (p: { ids: string[]; lv: Levers; gradual: boolean }) => { setIds(p.ids); setLv({ ...p.lv }); setGradual(p.gradual); setReact(null); setCopied('idle'); setHint(null); document.getElementById('game')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  useEffect(() => { setHint(null); }, [ids.join(), Object.values(lv).join(), gradual]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hint (level 5 only): before the goal, the gentlest card that would finish the job on its
  // own, or else the biggest one left (cards that break a protection only when nothing else is
  // left); once the goal is met, what earns the next star. It points; the player still plays it.
  const giveHint = () => {
    buzz('tap');
    if (met) {
      const line = ev.stars >= 3 ? HINT_LINES.done : !ev.gentle ? HINT_LINES.gentle : revenueShare > 2 / 3 ? HINT_LINES.addCut : HINT_LINES.addTax;
      setHint({ line });
      return;
    }
    const remaining = Math.max(0, 1 - prog);
    const crosses = (o: (typeof ctx.options)[number]) => o.econ.tags.some((t) => t === 'retirees' || t === 'lowIncome' || t === 'investment');
    // From the cards on the table (the starter deck on 1.9), or the whole deck once those run out.
    const open = ctx.options.filter((o) => !ids.includes(o.id) && (shareOf[o.id] ?? 0) > 0);
    const left = open.some((o) => visible(o.id)) ? open.filter((o) => visible(o.id)) : (setShowAll(true), open);
    const pool = left.some((o) => !crosses(o)) ? left.filter((o) => !crosses(o)) : left;
    const harm = (o: (typeof ctx.options)[number]) => Math.max(0.01, score(o.econ)) * o.savings10;
    const finisher = pool.filter((o) => (shareOf[o.id] ?? 0) >= remaining * 1.02).sort((a, b) => harm(a) - harm(b))[0];
    const pick = finisher ?? [...pool].sort((a, b) => (shareOf[b.id] ?? 0) - (shareOf[a.id] ?? 0))[0];
    if (!pick) { setHint({ line: COACH.cardsShort }); return; }
    if (filter !== 'all' && filter !== pick.side) setFilter('all');
    setHint({ line: `${HINT_LINES.card(pick.name)} ${finisher ? HINT_LINES.finishes : HINT_LINES.bigShare}`, card: pick.id });
    requestAnimationFrame(() => document.querySelector(`[data-card="${pick.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
  };
  // On phones the hint lives in the bottom action bar; the scoreboard's copy is for wide screens.
  // (once the goal is met the bar holds the next steps, so the scoreboard's Hint gives the star tips).
  const hintButton = desk?.hint ? <button type="button" className={'btn btn-hint' + (met ? '' : ' bar-dup')} onClick={giveHint}>Hint</button> : null;
  const text = planText({ mission, names: selected.map((o) => o.name), deficit: pct(Math.max(0, last.deficit) / last.gdp, 1), debt: pct(last.debt / last.gdp, 0), stars: ev.stars, fy: lastFY });
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied('done'); } catch { setCopied('manual'); }
  };

  const shownProg = useTween(Math.max(0, prog));
  const stillNeeded = Math.max(0, shortfall(goal, mine, ctx.startRatio));
  const neededText = goal === 'stabilize' ? `${money(stillNeeded)} less debt by FY${lastFY}` : `${money(stillNeeded)} less borrowing in FY${lastFY}`;

  const deck = ctx.options
    .filter((o) => visible(o.id))
    .filter((o) => filter === 'all' || o.side === filter)
    .sort((a, b) => (sort === 'impact' ? (shareOf[b.id] ?? 0) - (shareOf[a.id] ?? 0) : score(a.econ) - score(b.econ)));

  const missionFacts = (g: Goal) => {
    if (g === 'stabilize') return `Debt is ${pct(ctx.startRatio, 0)} of GDP today and heads to ${pct(lastB.debt / lastB.gdp, 0)} by FY${lastFY}.`;
    if (g === 'deficit3') return `The deficit is projected at ${pct(lastB.deficit / lastB.gdp, 1)} of GDP in FY${lastFY}.`;
    return `That means closing a ${money(lastB.deficit)} deficit in FY${lastFY}.`;
  };

  // ---- scoreboard pieces (level 10 lays them out across the top; other levels in a side panel) ----
  // Every budget-desk level lays its scoreboard across the top, pinned while you scroll.
  const special = !!desk;
  const introLine = goal === 'stabilize'
    ? `Here’s my budget desk. My debt is growing faster than the economy. ${missionFacts(goal)} Help me pick changes that stop that by FY${lastFY}, without knocking the economy flat or putting the whole load on one group.${desk?.hint ? ` ${HINT_LINES.stuck}` : ''}`
    : goal === 'deficit3'
      ? `Let’s be bolder. ${missionFacts(goal)} Economists often point to about 3% as a level the country can keep up for the long haul. Can you get me there by FY${lastFY}?`
      : `The big one: no borrowing at all. ${missionFacts(goal)} It hasn’t happened since FY2001. Fair warning: ${cardsCanWin ? 'this takes a lot of cards.' : 'even every card on the table isn’t quite enough, so we’ll need some across-the-board changes too.'}`;
  // On level 10 the board's coach also gives the opening line, since the board comes first.
  // A friend's challenge opens with a short line, so the cards come sooner on a phone.
  const said = hint ? { mood: 'thinking' as Mood, line: hint.line } : special && !met && prog <= 0.001 ? (duel ? { mood: 'happy' as Mood, line: DUEL_LINES.playing } : challenge ? { mood: 'happy' as Mood, line: CHALLENGE_LINES.start } : { mood: 'worried' as Mood, line: introLine }) : coach;
  // Uncle Sam coaches from the top bar (samhud.tsx): his line runs across the strip under it.
  const coachBlock = desk ? <SamSays mood={said.mood} auto={party == null && !(met && !wasMet.current)} delay={special ? 300 : 900}>{said.line}</SamSays> : null;
  const progressBlock = (
    <div aria-live="polite" className="sb-progress">
      <div className="sb-big">{met ? 'Mission complete!' : `${Math.min(99, Math.floor(shownProg * 100))}% of the way there`}</div>
      <GapBar segments={segments} progress={Math.max(0, prog)} />
      <div className="small muted">{met ? `You beat the goal: deficit ${last.deficit <= 0 ? 'balanced' : pct(last.deficit / last.gdp, 1) + ' of GDP'} and debt ${pct(last.debt / last.gdp, 0)} of GDP in FY${lastFY}.` : `Still needed: ${neededText}.`}</div>
    </div>
  );
  const checksBlock = (
    <ul className="checks">
      {ev.checks.map((c) => (
        <li key={c.id} data-done={c.done}>
          <span className="check-mark" aria-hidden="true">{c.done ? '★' : '☆'}</span>
          <div><strong>{c.label}</strong><div className="small muted">{c.tip}</div></div>
        </li>
      ))}
    </ul>
  );
  const econBlock = (vertical: boolean) => (
    <div className="sb-block">
      <div className="stat-label">Hit to the economy</div>
      <EconMeter peakStep={econ.peakStep} vertical={vertical} />
      <label className="switch"><input type="checkbox" checked={gradual} onChange={(e) => setGradual(e.target.checked)} /> Phase in over 3 years</label>
    </div>
  );
  const splitBlock = (vertical: boolean) => (
    <div className="sb-block">
      <div className="stat-label">{vertical ? 'Who pays (10-year savings)' : 'Who pays: taxes vs. spending cuts (10-year savings)'}</div>
      <SplitBar revenue={revTen} spending={spTen} vertical={vertical} />
    </div>
  );
  const efficiencyBlock = efficiency != null ? (
    <div className="sb-block small"><strong>Efficiency {efficiency}/100.</strong> {efficiency >= 91 ? 'Your plan is about as gentle on the economy as the least-cost plan.' : `The least-cost plan for this mission does about ${Math.round((1 - efficiency / 100) * 100)}% less economic harm.`}</div>
  ) : null;
  const copyBox = copied === 'manual' ? <textarea className="input" readOnly rows={6} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Your plan, ready to copy" /> : null;
  const nextBlock = desk && met ? (
    <div className="sb-block sb-next">
      <strong>{missionShort(STOP_BY_ID[desk.id])} complete.</strong>
      <div className="sb-actions">
        {nextStop ? <a className="btn btn-primary" href={'#' + nextStop.id}>Play {missionShort(nextStop)}</a> : <a className="btn btn-primary" href="#guide">See your certificate</a>}
        <a className="btn" href="#levels">Road map</a>
      </div>
    </div>
  ) : null;
  const deckTools = (
    <div className="deck-head">
      <h2 className="section-title" id="deck-t">Your policy cards</h2>
      {starter && (
        <p className="deck-starter small">
          {showAll
            ? <>All {ctx.options.length} cards. <button type="button" className="link-btn" onClick={() => setShowAll(false)}>Back to the starter deck</button></>
            : <><strong>A starter deck:</strong> {starter.size} cards, taxes and cuts, that can reach the goal together. <button type="button" className="link-btn" onClick={() => setShowAll(true)}>Show all {ctx.options.length} cards</button></>}
        </p>
      )}
      <div className="deck-tools">
        <Seg<Filter> label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'revenue', label: 'Taxes' }, { value: 'spending', label: 'Spending cuts' }]} />
        <Seg<Sort> label="Sort" value={sort} onChange={setSort} options={[{ value: 'impact', label: 'Biggest impact' }, { value: 'gentle', label: 'Gentlest first' }]} />
      </div>
    </div>
  );
  const deckNote = <p className="small muted">Scroll sideways for more cards. Numbers are CBO’s estimates. “Per household” spreads the FY{lastFY} amount across all {Math.round(HH / 1e6)} million U.S. households; real effects fall on the groups named on each card.</p>;
  const cardEls = (
    deck.map((o) => {
              const on = ids.includes(o.id);
              const y = optionPath(o, base, gradual).at(-1)!;
              const share = shareOf[o.id] ?? 0;
              const t = votes.options[o.id] ?? { support: 0, oppose: 0 };
              const n = t.support + t.oppose;
              const rules = [
                o.econ.tags.includes('retirees') && 'Affects current retirees',
                o.econ.tags.includes('lowIncome') && 'Hits low-income families',
                o.econ.tags.includes('investment') && 'Cuts public investment',
              ].filter(Boolean) as string[];
              return (
                <article key={o.id} className="pcard" data-on={on} data-side={o.side} data-card={o.id} data-hint={hint?.card === o.id || undefined}>
                  {hint?.card === o.id && <span className="pcard-hint">Uncle Sam’s hint</span>}
                  <div className="pcard-top">
                    <span className="pcard-icon" style={{ color: SIDE_COLOR[o.side] }}><LeverIcon lever={o.lever} /></span>
                    <span className="pcard-kind">{o.side === 'revenue' ? 'Tax' : `Spending cut · ${LEVER_NAME[o.lever]}`}</span>
                  </div>
                  <h3 className="pcard-title">{o.name}</h3>
                  <div className="pcard-big">{share >= 1 ? <>Closes <strong>the whole gap</strong>{share >= 1.5 ? ` (${(share).toFixed(1)}× over)` : ''}</> : <>Closes <strong>{share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`}</strong> of the gap</>}</div>
                  <div className="pcard-sub num">{money(y)} in FY{lastFY} · about {dollars(y / HH)} per household</div>
                  <div className="pcard-meta">
                    <DragBars level={dragLevel(score(o.econ))} />
                    {o.econ.growth === 1 && <span className="pill">Helps long-run growth</span>}
                    {o.econ.growth === -1 && <span className="pill">Hurts long-run growth</span>}
                    {rules.map((r) => <span key={r} className="pill pill-warn">{r}</span>)}
                  </div>
                  <button type="button" className={'pcard-add' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggle(o.id)}>
                    {on ? '✓ In your plan' : '+ Add to plan'}
                  </button>
                  <CongressLink id={o.id} topic={o.name} />
                  <details className="pcard-more">
                    <summary>What it does</summary>
                    <p>{o.summary}</p>
                    <p><strong>Who pays:</strong> {o.affects}.</p>
                    <p><strong>Who benefits:</strong> {o.benefits}.</p>
                    <p><strong>Economic effect:</strong> {o.econ.why}</p>
                    {o.obbbaNote && <p className="muted">{o.obbbaNote}</p>}
                    <p><a href={o.source.url} target="_blank" rel="noreferrer">CBO’s estimate: {money(o.savings10 * 1e9)} over 10 years</a></p>
                  </details>
                  {votes.available && (
                    <div className="vote-row">
                      <button type="button" className={'vote-btn' + (votes.mine.options[o.id] === 1 ? ' on' : '')} aria-pressed={votes.mine.options[o.id] === 1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, 1 as Choice)}>Support</button>
                      <button type="button" className={'vote-btn' + (votes.mine.options[o.id] === -1 ? ' on' : '')} aria-pressed={votes.mine.options[o.id] === -1} disabled={votes.canVote === false} onClick={() => votes.voteOption(o.id, -1 as Choice)}>Oppose</button>
                      {n > 0 ? (
                        <span className="vote-tally" aria-label={`${t.support} support, ${t.oppose} oppose`}>
                          <span className="vote-bar"><span style={{ width: `${(t.support / n) * 100}%`, background: 'var(--vote-yes)' }} /><span style={{ width: `${(t.oppose / n) * 100}%`, background: 'var(--vote-no)' }} /></span>
                          <span className="small muted num">{pct(t.support / n, 0)} support · {n}</span>
                        </span>
                      ) : <span className="small muted">No votes yet</span>}
                    </div>
                  )}
                </article>
              );
            })
  );
  const leversBlock = (inline: boolean) => (
    <details className="card more" open={inline || slidersUsed || undefined} id="levers">
      <summary className="chart-title">Across-the-board changes{inline ? '' : ' (advanced)'}</summary>
      {inline && <p className="small"><strong>The cards alone can’t {lower(mission.short)}.</strong> Finish with these across-the-board changes.</p>}
      <p className="small muted">Blunt tools: percentage changes to whole categories, from the {cbo.projShort}. They count toward the goal but not toward the efficiency score.</p>
        {LEVERS.map((l) => (
          <div className="range-row" key={l.id}>
            <label htmlFor={'lv-' + l.id}><span className="swatch" style={{ background: l.color }} />{l.label}</label>
            <input id={'lv-' + l.id} type="range" min={l.min} max={l.max} step={1} value={lv[l.id]} onChange={(e) => setLv((p) => ({ ...p, [l.id]: Number(e.target.value) }))} />
            <output htmlFor={'lv-' + l.id}>{lv[l.id] > 0 ? '+' : ''}{lv[l.id]}%</output>
          </div>
        ))}
      </details>
  );
  const toChallenge = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(isDuelLevel ? 'duel-start' : 'challenge')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const friendLabel = isDuelLevel ? 'Duel a friend' : 'Challenge a friend';
  // The duel's reveal: the player's plan joins the friend's, and both open side by side.
  const reveal = () => {
    if (!duel) return;
    const done: Duel = { ...duel, guest: { ids, lv, gradual }, guestName: name || undefined, revealed: true, at: new Date().toISOString() };
    saveDuel(done);
    setActiveDuel(null);
    setDuel(null);
    location.hash = resultHash(done);
  };
  const leaveDuel = () => { setActiveDuel(null); setDuel(null); };
  const duelBy = duel?.hostName || 'your friend';
  // The bottom bar's actions: the hint before the goal (level 5); after it, the challenge or the next level.
  const barButtons = duel
    ? (met ? <button type="button" className="btn btn-primary" onClick={reveal}>Reveal the duel</button> : null)
    : !met
    ? (desk?.hint ? <button type="button" className="btn btn-hint" onClick={giveHint}>Hint</button> : null)
    : challenge && h2h
      ? <>
          {myLink && shareText && <ShareButton text={shareText} url={myLink} label={`Send it back to ${byShort}`} className={h2h.outcome === 'lost' ? 'btn' : 'btn btn-primary'} kind="plan" onShare={returned} />}
          <button type="button" className={h2h.outcome === 'lost' ? 'btn btn-primary' : 'btn'} onClick={() => setParty(ev.stars)}>I’m done</button>
        </>
      : desk
        ? <>
            <a className="btn" href={isDuelLevel ? '#duel-start' : '#challenge'} onClick={toChallenge}>{friendLabel}</a>
            {nextStop ? <a className="btn btn-primary" href={'#' + nextStop.id}>Play {missionShort(nextStop)}</a> : <a className="btn btn-primary" href="#story">Your Budget Story</a>}
          </>
        : null;
  const bestStars = desk ? Math.max(journey.stars[desk.id] ?? 0, ev.stars) : Math.max(progress.stars[goal] ?? 0, ev.stars);

  return (
    <>
      <PageHead
        eyebrow={`${here ? missionLong(here) : 'Budget desk'} · ${desk?.difficulty} · budget desk`}
        title={desk ? mission.title : 'Can you fix the budget?'}
        lede={challenge || duel ? undefined : desk ? <>Play policy cards, real options the Congressional Budget Office (CBO) has priced, until the bar reaches the goal. Earn stars for going easy on the economy and for balancing tax increases with spending cuts.</> : <>Pick a mission, then play policy cards, real options the Congressional Budget Office (CBO) has priced, until the bar reaches the goal. Earn stars for going easy on the economy and for balancing tax increases with spending cuts.</>}
      />
      {!challenge && !duel && <Accomplishments stars={bestStars} badges={progress.badges} />}



      {room && (
        <div className="challenge-banner" role="note">
          <div>
            <strong>Playing for the room “{room.name}”.</strong> {met
              ? (roomSent === 'sent' ? 'Your plan is in the room’s plan.' : roomSent === 'failed' ? 'Your plan couldn’t be sent to the room yet; it will try again when you change it.' : 'Sending your plan to the room…')
              : 'When you meet the goal, your plan joins the room’s.'} <a href={'#room?c=' + room.code}>See the room</a>
          </div>
          <button type="button" className="btn" onClick={() => { setActiveRoom(null); setRoom(null); }}>Play just for me</button>
        </div>
      )}
      {duel && (
        <div className="challenge-banner duel-banner" role="note">
          <div>
            <strong>Duel with {duelBy}:</strong> {duel.hostName ? `${duel.hostName}’s` : 'their'} plan is <span className="duel-sealed">sealed</span> until you reveal yours.<span className="challenge-banner-more"> Balance the budget your way, then compare three rounds: the debt, the economy, and the balance.</span>
          </div>
          <span className="duel-banner-actions">
            {!met && (ids.length > 0 || slidersUsed) && <button type="button" className="link-btn small" onClick={reveal}>Reveal now</button>}
            <button type="button" className="link-btn small" onClick={leaveDuel}>Leave the duel</button>
          </span>
        </div>
      )}
      {rematch && !duel && (
        <div className="challenge-banner" role="note">
          <div><strong>Rematch with {rematch.name || 'your friend'}:</strong> build a new plan, then send it from “Duel a friend” below the cards.</div>
          <button type="button" className="link-btn small" onClick={() => { setRematch(null); setRematchState(null); }}>Cancel the rematch</button>
        </div>
      )}
      {challenge && theirs && (
        <div className="challenge-banner" role="note">
          <div>
            <strong>Challenge from {challengeBy}:</strong> meet the goal, then beat {challengeBy === 'Your friend' ? 'their' : `${challengeBy}’s`} plan: <Stars n={theirs.ev.stars} size="sm" label={`${theirs.ev.stars} of 3 stars`} /> {theirs.shares.length} card{theirs.shares.length === 1 ? '' : 's'}, {theirs.econ.rating} on the economy.
            <div className="small muted challenge-banner-more">Win on more stars, a gentler economy, or fewer cards.</div>
          </div>
          <button type="button" className="link-btn small" onClick={() => { dropChallenge(); setChallenge(null); }}>Drop the challenge</button>
        </div>
      )}
      <>
          <section className="topboard card" id="game" aria-label="Scoreboard" data-cm={challenge || duel ? true : undefined}>
            {coachBlock}
            <div className="tb-main">
              <div className="tb-head">
                <div className="eyebrow">Campaign {here!.campaign} · final mission · {desk!.difficulty}</div>
                <StarsPopover stars={ev.stars} checks={ev.checks} extra={efficiencyBlock} />
              </div>
              {progressBlock}
              {(challenge || duel) && <div className="small muted tb-cm-line">Economy: {econ.rating} · Who pays: {duel ? splitLabel(assessDuel({ ids, lv, gradual })) : revTen + spTen ? `${Math.round(revenueShare * 100)}% taxes, ${Math.round((1 - revenueShare) * 100)}% cuts` : 'no cards yet'}</div>}
              <div className="sb-actions tb-actions">
                {hintButton}
                <button type="button" className="btn" onClick={reset} disabled={!ids.length && !slidersUsed}>Start over</button>
                {met && duel && <button type="button" className="btn btn-primary bar-dup" onClick={reveal}>Reveal the duel</button>}
                {met && !duel && <a className="btn bar-dup" href={isDuelLevel ? '#duel-start' : '#challenge'} onClick={toChallenge}>{friendLabel}</a>}
                {met && <button type="button" className="btn" onClick={copy}>{copied === 'done' ? 'Copied' : 'Copy my plan'}</button>}
                {met && !duel && (nextStop ? <a className="btn btn-primary bar-dup" href={'#' + nextStop.id}>Play {missionShort(nextStop)}</a> : <a className="btn btn-primary bar-dup" href="#story">See your Budget Story</a>)}
              </div>
              {copyBox}
            </div>
            <div className="tb-side">
              {econBlock(true)}
              {splitBlock(true)}
            </div>
          </section>
          {challenge && theirs && mineNow && h2h && (
            <section className="card challenge-live" id="vs" aria-live="polite">
              <div className="challenge-live-head">
                <strong className="challenge-live-title">{h2h.outcome === 'won' ? `You’re ahead of ${byShort}!` : h2h.outcome === 'tied' ? `Dead even with ${byShort}` : `Goal met, but ${byShort}’s plan is still ahead`}</strong>
                <span className="small muted">{h2h.outcome === 'lost' ? 'Keep going: every row below is a way to win.' : 'Send it back, or keep improving to win by more.'}</span>
              </div>
              <HeadToHead mine={mineNow} theirs={theirs} by={byCol} sam={false} />
              <div className="sb-actions">
                {myLink && shareText && <ShareButton text={shareText} url={myLink} label={`Send it back to ${challengeBy === 'Your friend' ? 'your friend' : challengeBy}`} className={h2h.outcome === 'lost' ? 'btn bar-dup' : 'btn btn-primary bar-dup'} kind="plan" onShare={returned} />}
                <button type="button" className={h2h.outcome === 'lost' ? 'btn btn-primary' : 'btn'} onClick={() => document.getElementById('deck-t')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Keep improving</button>
                <button type="button" className="btn bar-dup" onClick={() => setParty(ev.stars)}>I’m done</button>
              </div>
              <AgreementCard a={compare({ ids, ballot: ballotFrom(journey.choices) }, { ids: challenge.plan.ids, ballot: challenge.plan.ballot })} by={byShort} shareUrl={myLink} />
            </section>
          )}
          <section className="deck deck-wide" aria-labelledby="deck-t">
            <Carousel label="policy cards" count={deck.length} tools={deckTools}>
              {cardEls}
            </Carousel>
            {deckNote}
            <VoteNote votes={votes} />
          </section>
          {!cardsCanWin && leversBlock(true)}
          {!challenge && !duel && <PlanIdeas goal={goal} current={{ ids, lv, gradual }} canLoad={!!desk && (journey.done.includes(desk.id) || journey.settings.freeRoam)} onLoad={loadIdea} />}
      </>
      <PlanForYou ids={ids} lv={lv} gradual={gradual} />
      {met && desk && (isDuelLevel && !challenge
        ? !duel && <DuelStart plan={{ ids, lv, gradual }} />
        : <ChallengeShare level={desk.id} plan={{ ids, lv, gradual, stars: ev.stars, at: '' }} onShare={returned} />)}

      {/* Phones and tablets: where the plan stands, always in view, with this screen's actions. */}
      <ActionBar className="plan-bar" phoneOnly label="Your plan">
        <div className="plan-bar-row" aria-hidden="true">
          <Stars n={ev.stars} size="sm" />
          <span className="plan-bar-track"><span style={{ width: `${Math.min(1, Math.max(0, prog)) * 100}%` }} /></span>
          <span className="num">{met ? 'Goal met' : `${Math.min(99, Math.floor(Math.max(0, prog) * 100))}%`}</span>
        </div>
        {barButtons && <div className="plan-bar-buttons">{barButtons}</div>}
      </ActionBar>


      <Section id="numbers" title="See the numbers" sub={`Your plan compared with the ${cbo.projShort}, which assumes ${cbo.projAssumes.replace(/^assuming /, '')}.`}>
        <div className="grid-2">
          <div className="card">
            <ChartFrame title="Deficit, share of GDP" legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />} sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].deficit / baseline[i].gdp), m: pct(r.deficit / r.gdp) })) }}>
              <TimeChart label="Deficit as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={220} zeroLine yFormat={(v) => `${+(v * 100).toFixed(1)}%`} tipFormat={(v) => pct(v)}
                series={[{ id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.deficit / r.gdp), width: 2.5 }, { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.deficit / r.gdp) }]} />
            </ChartFrame>
          </div>
          <div className="card">
            <ChartFrame title="Debt held by the public, share of GDP" legend={<Legend items={[{ label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line' }, { label: 'Your plan', color: 'var(--c-emph)', kind: 'line' }]} />} sourceIds={[cbo.baselineSourceId]}
              table={{ columns: [{ key: 'fy', label: 'Fiscal year' }, { key: 'b', label: 'Projection', align: 'r' }, { key: 'm', label: 'Your plan', align: 'r' }], rows: mine.map((r, i) => ({ fy: `FY${r.fy}`, b: pct(baseline[i].debt / baseline[i].gdp, 1), m: pct(r.debt / r.gdp, 1) })) }}>
              <TimeChart label="Debt as a share of GDP" x={years} tipTitle={(y) => `FY${y}`} height={220} yFormat={(v) => `${Math.round(v * 100)}%`} tipFormat={(v) => pct(v)}
                yMin={Math.min(...baseline.map((r) => r.debt / r.gdp), ...mine.map((r) => r.debt / r.gdp), ctx.startRatio) - 0.02}
                series={[{ id: 'b', label: cbo.projShort, color: 'var(--c-deemph)', kind: 'line', values: baseline.map((r) => r.debt / r.gdp), width: 2.5 }, { id: 'm', label: 'Your plan', color: 'var(--c-emph)', kind: 'line', values: mine.map((r) => r.debt / r.gdp) }]} />
            </ChartFrame>
          </div>
        </div>
      </Section>

      {cardsCanWin && leversBlock(false)}

      <details className="card more" id="method">
        <summary className="chart-title">How the scoring works</summary>
        <ol className="prose method-list" style={{ marginTop: 10 }}>
          <li><strong>The gap.</strong> Each mission’s gap is the distance between the {cbo.projShort} and the goal in FY{lastFY}. A card’s share is how much of that distance it closes by itself; cards combined can add up to slightly less because they interact through interest costs.</li>
          <li><strong>Drag on the economy.</strong> Each card’s drag is CBO’s estimated short-run effect on output per dollar for its type of policy (for example {MULT.corporate.lo}–{MULT.corporate.hi} for business taxes, {MULT.taxHigh.lo}–{MULT.taxHigh.hi} for taxes on higher earners, {MULT.purchases.lo}–{MULT.purchases.hi} for government purchases), using the midpoint, adjusted by 0.3 for long-run growth effects.</li>
          <li><strong>The economy gauge</strong> shows the plan’s steepest single-year tightening: gentle at 0.5% of GDP or less, moderate up to 1%, steep above that. These thresholds are this site’s, set in line with the IMF’s estimate that debt can be stabilized with roughly 3 to 4.5% of GDP of adjustment over about six years.</li>
          <li><strong>Stars:</strong> one for reaching the goal, one for staying gentle, and one for getting between a third and two-thirds of the savings from each of taxes and spending cuts, as most bipartisan deficit commissions did.</li>
          <li><strong>Efficiency</strong> compares your plan’s total economic cost (dollars saved times drag per dollar) with the least-cost combination of cards that meets the goal while protecting current retirees, low-income families, and public investment, with taxes and cuts each providing at least a third of the savings.</li>
        </ol>
        {OPTIONS_DATA.principles.length > 0 && (
          <div className="facts" style={{ marginTop: 12 }}>
            {OPTIONS_DATA.principles.map((p) => (
              <div className="fact" key={p.id}>
                <p style={{ color: 'var(--ink)' }}>{p.claim}</p>
                {p.detail && <p className="small">{p.detail}</p>}
                {p.source?.url && <a className="small" href={p.source.url} target="_blank" rel="noreferrer">{p.source.title}</a>}
              </div>
            ))}
          </div>
        )}
        <div className="prose small" style={{ marginTop: 12 }}>
          <p><strong>Where the numbers come from.</strong> Each card’s savings is CBO’s ten-year estimate from <a href={OPTIONS_DATA.volume.url} target="_blank" rel="noreferrer"><em>{OPTIONS_DATA.volume.title}</em></a> ({dateLabel(OPTIONS_DATA.volume.published)}), spread over FY{years[0]}–FY{years[0] + 9} in proportion to the economy (phased in when that switch is on). Estimates made before the One Big Beautiful Bill Act of July 2025 may be out of date where that law changed the same policy; those cards say so.</p>
          <p><strong>What the game leaves out.</strong> A full economic model, interactions between options on the same tax, and the long-run gains from lower debt, which CBO finds raise income over time. CBO’s multipliers are largest when the economy is weak and the Federal Reserve cannot offset them. Net interest is recalculated from the size of the debt. <Term id="dynamic">Dynamic effects</Term> are not included.</p>
          <p><strong>Midpoint multipliers used:</strong> {Object.entries(MULT).map(([key, m]) => `${m.label} ${mid(key as keyof typeof MULT).toFixed(2)}`).join('; ')}.</p>
        </div>
      </details>

      {desk && <p className="fineprint-link small">This mission’s full chapters and the original documents are in <a href={'#sources-' + desk.id}>Sources &amp; methods</a>.</p>}
      {party != null && desk && (
        <Celebration stop={STOP_BY_ID[desk.id]} stars={party} onClose={() => setParty(null)}
          line={h2h?.outcome ? CHALLENGE_LINES[h2h.outcome] : DESK_PARTY[party]} share={invite ? { url: invite.url, text: invite.text, duel: true } : myLink && shareText ? { url: myLink, text: shareText } : undefined}
          challenge={challenge && h2h?.outcome ? { outcome: h2h.outcome, by: challengeBy === 'Your friend' ? 'your friend' : challengeBy } : undefined}
          newcomer={newcomer} onShare={() => { returned(); invite?.keep(); }}>
          {challengeResult(true)}
        </Celebration>
      )}
    </>
  );
}

function VoteNote({ votes }: { votes: ReturnType<typeof useVotes> }) {
  if (!votes.available) return null;
  return (
    <p className="small muted">
      {votes.loading ? 'Loading votes…' : `${votes.voters} ${votes.voters === 1 ? 'person has' : 'people have'} voted so far.`}{' '}
      {votes.stale && 'Vote counts can’t be reached yet and may be out of date. '}
      {votes.error && `${votes.error} `}
      {votes.canVote === false && 'You can see the results, but voting needs Contributor access to this page; ask the person who shared it. '}
      Each person has one ballot and can change it at any time. This is an informal poll of people who opened this page, not a scientific survey.
    </p>
  );
}

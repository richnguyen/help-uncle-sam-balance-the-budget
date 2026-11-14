import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionBar } from '../components/ActionBar';
import { EconMeter, GapBar, type GapSegment, SplitBar } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { assess, CTX, LAST_FY } from '../lib/assess';
import { backendOn, type Move, myMoveToday, rpc, saveMove, takeBackMove } from '../lib/backend';
import { money, pct } from '../lib/format';
import { goalGap } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import { ZERO } from '../lib/sandbox';
import { useHaptics } from './haptics';
import { siteRoot } from './plans';
import { PEOPLES_LINES } from './script';
import { PUBLIC_SITE } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { useJourney } from './state';
import { useCardFilter } from './cardFilter';
import { SamSays } from './UncleSam';

// The People's Budget (#peoples): one shared budget, built by everyone who plays. Each player gets
// one move a day: push one policy card in or out. A card is in when, over the last 30 days, more
// moves pushed it in than out. The shared database keeps the moves (supabase/migrations); this
// page reads the totals and scores the result with the same model as the budget desk.

interface Totals { window_days: number; contributors: number; moves: number; today: number; all_time: number; cards: Record<string, { net: number; in: number; out: number }> }
interface Recent { card: string; dir: 1 | -1; at: string }

const OPTIONS = OPTIONS_DATA.options;
const NAME = Object.fromEntries(OPTIONS.map((o) => [o.id, o.name]));
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

export default function Peoples() {
  const j = useJourney();
  const buzz = useHaptics();
  const on = backendOn();
  const [t, setT] = useState<Totals | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [mine, setMine] = useState<Move | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [pb, rc] = await Promise.all([rpc<Totals>('peoples_budget'), rpc<Recent[]>('peoples_recent', { n: 10 })]);
      setT(pb); setRecent(rc ?? []); setLoadError(false);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => {
    if (!on) return;
    void refresh();
    myMoveToday().then(setMine).catch(() => {});
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => clearInterval(iv);
  }, [on, refresh]);

  // The People's Budget right now, scored on all three desk goals.
  const inIds = useMemo(() => OPTIONS.filter((o) => (t?.cards[o.id]?.net ?? 0) > 0).map((o) => o.id), [t]);
  const a = assess('stabilize', inIds, ZERO, true);
  const a3 = assess('deficit3', inIds, ZERO, true);
  const aB = assess('balance', inIds, ZERO, true);
  const sum = a.shares.reduce((s, x) => s + Math.max(0, x.share), 0);
  const k = sum > 0 ? a.progress / sum : 0;
  const segments: GapSegment[] = a.shares.map((x) => ({ id: x.id, label: x.name, share: Math.max(0, x.share) * k, side: x.side }));
  const still = goalGap('stabilize', a.sim, CTX.startRatio);
  const cards = useMemo(() => [...OPTIONS].sort((x, y) => (t?.cards[y.id]?.net ?? 0) - (t?.cards[x.id]?.net ?? 0) || x.name.localeCompare(y.name)), [t]);
  const filter = useCardFilter(cards.filter((o) => (t?.cards[o.id]?.net ?? 0) > 0).length);

  const move = async (card: string, dir: 1 | -1) => {
    setBusy(card + dir); setError('');
    try {
      await saveMove({ card, dir });
      setMine({ card, dir });
      j.mark('peoples');
      buzz('vote');
      await refresh();
    } catch {
      setError('Your move couldn’t be saved. Try again in a moment.');
    }
    setBusy(null);
  };
  const takeBack = async () => {
    setBusy('back'); setError('');
    try { await takeBackMove(); setMine(null); await refresh(); } catch { setError('That didn’t go through. Try again in a moment.'); }
    setBusy(null);
  };

  const shareUrl = `${on ? siteRoot() : PUBLIC_SITE}p/peoples/?peoples`;
  const shareText = a.met
    ? 'Together, players have built a People’s Budget that stops Uncle Sam’s debt from outgrowing the economy. One move a day each. Add yours.'
    : `The People’s Budget is ${Math.floor(a.progress * 100)}% of the way to stopping Uncle Sam’s debt from outgrowing the economy, built one move a day by everyone who plays. Add your move.`;

  if (!on) {
    return (
      <>
        <PageHead eyebrow="Everyone’s budget" title="The People’s Budget" lede="One budget, built by everyone who plays: each person gets one move a day, pushing one policy card in or out." />
        <SamSays mood="happy" auto>{PEOPLES_LINES.offline}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href={`${PUBLIC_SITE}?peoples`} target="_blank" rel="noreferrer">Open the People’s Budget</a></ActionBar>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow={`Everyone’s budget · ${t ? `${t.contributors} ${t.contributors === 1 ? 'person' : 'people'} in the last ${t.window_days} days` : 'loading'}`}
        title="The People’s Budget"
        lede="One budget, built by everyone who plays. Each day you get one move: push one policy card in or out. A card is in when more moves have pushed it in than out over the last 30 days."
      />
      <SamSays mood={mine ? 'happy' : a.met ? 'cheering' : 'thinking'} auto>{mine ? PEOPLES_LINES.moved : a.met ? PEOPLES_LINES.met : PEOPLES_LINES.intro}</SamSays>
      {loadError && <div className="callout small">The People’s Budget can’t be loaded right now. It will try again in a moment.</div>}

      <section className="card peoples-board" aria-live="polite">
        <div className="sb-big">{a.met ? 'Goal met: the debt stops outgrowing the economy' : `${Math.floor(a.progress * 100)}% of the way to stopping the debt from outgrowing the economy`}</div>
        <GapBar segments={segments} progress={a.progress} />
        <div className="small muted">{a.met ? `With ${inIds.length} cards in, debt is ${pct(a.last.debt / a.last.gdp, 0)} of GDP in FY${LAST_FY}.` : `${inIds.length} card${inIds.length === 1 ? '' : 's'} in. Still needed: ${money(still)} less debt by FY${LAST_FY}.`}</div>
        <div className="peoples-goals">
          <div><span className="stat-label">Deficit to 3% of GDP</span><strong className="num">{a3.met ? 'Met' : `${Math.floor(a3.progress * 100)}%`}</strong></div>
          <div><span className="stat-label">Balance the budget</span><strong className="num">{aB.met ? 'Met' : `${Math.floor(aB.progress * 100)}%`}</strong></div>
          <div><span className="stat-label">Moves today</span><strong className="num">{t?.today ?? '—'}</strong></div>
        </div>
        <div className="friendplan-bars">
          <div><div className="stat-label">Hit to the economy</div><EconMeter peakStep={a.econ.peakStep} /></div>
          <div><div className="stat-label">Who pays</div><SplitBar revenue={a.revTen} spending={a.spTen} /></div>
        </div>
      </section>

      <section className="card peoples-mine">
        {mine ? (
          <>
            <strong>Your move today: you pushed “{NAME[mine.card] ?? mine.card}” {mine.dir === 1 ? 'in' : 'out'}.</strong>
            <span className="small muted">You can change it or take it back until the day resets at midnight UTC; tomorrow brings a new move.</span>
            <button type="button" className="btn" onClick={takeBack} disabled={busy != null}>Take back today’s move</button>
          </>
        ) : (
          <>
            <strong>Your move today: push one card in or out.</strong>
            <span className="small muted">One move a day per person. The first one asks a quick, private check that you’re a person.</span>
          </>
        )}
        {error && <span className="small" role="status">{error}</span>}
      </section>

      <Section id="cards" title="The cards" sub="Net pushes over the last 30 days. In the budget when more people pushed a card in than out. Each card’s share is how much of the gap it closes on its own.">
        {filter.pills}
        <ol className="peoples-cards">
          {cards.filter((o) => filter.keep(o, (t?.cards[o.id]?.net ?? 0) > 0)).map((o) => {
            const c = t?.cards[o.id] ?? { net: 0, in: 0, out: 0 };
            const isIn = c.net > 0;
            const own = assess('stabilize', [o.id], ZERO, true).progress;
            const mineHere = mine?.card === o.id ? mine.dir : 0;
            const n = c.in + c.out;
            return (
              <li key={o.id} className="peoples-card" data-in={isIn} data-mine={mineHere !== 0 || undefined}>
                <div className="peoples-card-head">
                  <span className="peoples-chip" data-in={isIn}>{isIn ? 'In' : 'Out'}</span>
                  <span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>
                  <strong className="peoples-name">{o.name}</strong>
                </div>
                <div className="peoples-meta small">
                  <span className="num">{c.net > 0 ? '+' : ''}{c.net} net · {c.in} in, {c.out} out</span>
                  <span className="muted">{o.savings10 < 0 ? <>Adds to the gap · {money(-o.savings10 * 1e9)} more borrowing over ten</> : <>Closes {own >= 1 ? 'the whole gap' : `${Math.max(own > 0 ? 1 : 0, Math.round(own * 100))}%`} on its own · {money(o.savings10 * 1e9)} over ten</>} years</span>
                </div>
                <span className="peoples-split" aria-hidden="true">{n > 0 && <><span className="in" style={{ flex: `${c.in} 0 0` }} /><span className="out" style={{ flex: `${c.out} 0 0` }} /></>}</span>
                <div className="peoples-actions" role="group" aria-label={`Your move on ${o.name}`}>
                  <button type="button" className={'vote-btn' + (mineHere === 1 ? ' on' : '')} aria-pressed={mineHere === 1} disabled={busy != null || mineHere === 1} onClick={() => move(o.id, 1)}>{busy === o.id + 1 ? 'Saving…' : 'Push in'}</button>
                  <button type="button" className={'vote-btn' + (mineHere === -1 ? ' on' : '')} aria-pressed={mineHere === -1} disabled={busy != null || mineHere === -1} onClick={() => move(o.id, -1)}>{busy === o.id + -1 ? 'Saving…' : 'Push out'}</button>
                </div>
              </li>
            );
          })}
        </ol>
        {mine && <p className="small muted">Pushing a different card changes today’s move.</p>}
      </Section>

      {recent.length > 0 && (
        <Section id="recent" title="Latest moves" sub="Anonymous: just the card, the direction, and when.">
          <ul className="peoples-recent">
            {recent.map((r, i) => <li key={i}><span className="peoples-chip" data-in={r.dir === 1}>{r.dir === 1 ? 'In' : 'Out'}</span> Someone pushed <strong>{NAME[r.card] ?? r.card}</strong> {r.dir === 1 ? 'in' : 'out'} <span className="small muted">· {ago(r.at)}</span></li>)}
          </ul>
        </Section>
      )}

      <Section id="share" title="Bring more hands">
        <ActionBar label="Share"><ShareButton text={shareText} url={shareUrl} label="Share the People’s Budget" className="btn btn-primary" /></ActionBar>
        <SocialShare text={shareText} url={shareUrl} />
      </Section>

      <p className="small muted">
        One move per person a day (days reset at midnight UTC), and you can change or take back today’s move. Moves older than {t?.window_days ?? 30} days drop out, so the budget keeps up with the people playing now. The result is scored with CBO’s estimates, phased in over three years, the same way as the budget desk. Moves are anonymous. This is an informal tally of people who chose to play, not a scientific survey. {t ? `${t.all_time} moves so far.` : ''}
      </p>
    </>
  );
}

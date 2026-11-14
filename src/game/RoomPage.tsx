import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActionBar } from '../components/ActionBar';
import { EconMeter, GapBar, type GapSegment, SplitBar } from '../components/game';
import { PageHead, Section } from '../components/ui';
import { assess, CTX, LAST_FY } from '../lib/assess';
import { backendOn, closeRoom, getRoom, joinRoom, leaveRoom, type Membership, myMembership, type Room, ROOM_CODE, rpc } from '../lib/backend';
import { lower, money, pct } from '../lib/format';
import { goalGap } from '../lib/plan';
import { OPTIONS_DATA } from '../lib/planData';
import { ZERO } from '../lib/sandbox';
import { DESK, missionLong, missionShort, STOP_BY_ID, stopForCode, STOPS } from './levels';
import { BALLOT, concentration, encodePlan, siteRoot } from './plans';
import { groupArchetype, mostSplit, splitPct } from './roomReveal';
import { QrCode } from '../components/QrCode';
import { activeRoom, forgetRoom, rememberRoom, setActiveRoom } from './rooms';
import { ROOM_LINES } from './script';
import { PUBLIC_SITE } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { SamSays } from './UncleSam';

// #room?c=K7MQ3P: one room. Members play the room's level; a card is in the room's plan when more
// than half the members' plans use it. Totals only, never who did what.

interface Totals {
  members: number; plans: number; cards: Record<string, number>; stars: Record<string, number>; done: Record<string, number>;
  votes: null | { voters: number; options: Record<string, { support: number; oppose: number }>; issues: Record<string, Record<string, number>> };
}

const OPTIONS = OPTIONS_DATA.options;

function Bar({ label, share, note, mine }: { label: ReactNode; share: number; note: string; mine?: boolean }) {
  return (
    <li className="rrow" data-mine={mine || undefined}>
      <span className="rrow-label">{label}{mine && <span className="rrow-you">you</span>}</span>
      <span className="rrow-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }} /></span>
      <span className="rrow-val num">{note}</span>
    </li>
  );
}

export default function RoomPage({ param }: { param: string | null }) {
  const on = backendOn();
  const code = (new URLSearchParams(param ?? '').get('c') ?? '').toUpperCase();
  const [room, setRoom] = useState<Room | null | 'missing'>(null);
  const [t, setT] = useState<Totals | null>(null);
  const [me, setMe] = useState<Membership | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const refresh = useCallback(async () => {
    if (!ROOM_CODE.test(code)) { setRoom('missing'); return; }
    try {
      const [r, tt] = await Promise.all([getRoom(code), rpc<Totals | null>('room_totals', { room_code: code })]);
      setRoom(r ?? 'missing'); setT(tt);
    } catch { setError('The room can’t be loaded right now. It will try again in a moment.'); }
  }, [code]);
  useEffect(() => {
    if (!on) return;
    void refresh();
    myMembership(code).then(setMe).catch(() => {});
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => clearInterval(iv);
  }, [on, code, refresh]);

  const d = room && room !== 'missing' ? DESK.find((x) => x.n === room.level) : undefined;
  const roomIds = useMemo(() => (t && t.plans ? OPTIONS.filter((o) => (t.cards[o.id] ?? 0) / t.plans > 0.5).map((o) => o.id) : []), [t]);

  if (!on) {
    return (
      <>
        <PageHead eyebrow="Play as a group" title="A room" />
        <SamSays mood="happy" auto>{ROOM_LINES.offline}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href={`${PUBLIC_SITE}?room=${encodeURIComponent(code)}`} target="_blank" rel="noreferrer">Open the room on balancethebudget.us</a></ActionBar>
      </>
    );
  }
  if (room === 'missing') {
    return (
      <>
        <PageHead eyebrow="Play as a group" title="Room not found" />
        <SamSays mood="worried" auto>{ROOM_LINES.missing}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href="#rooms">Start or join a room</a></ActionBar>
      </>
    );
  }
  if (!room || !d) {
    return error
      ? <><PageHead eyebrow="Play as a group" title="A room" /><div className="callout small" role="status">{error}</div></>
      : <p className="small muted" role="status">Opening the room…</p>;
  }

  const a = assess(d.goal, roomIds, ZERO, true);
  const sum = a.shares.reduce((s, x) => s + Math.max(0, x.share), 0);
  const k = sum > 0 ? a.progress / sum : 0;
  const segments: GapSegment[] = a.shares.map((x) => ({ id: x.id, label: x.name, share: Math.max(0, x.share) * k, side: x.side }));
  const still = goalGap(d.goal, a.sim, CTX.startRatio);
  const joined = !!me;
  const ref = { code: room.code, name: room.name, level: room.level };
  const link = `${siteRoot()}p/room/?room=${room.code}`;
  const shareText = `Join our room “${room.name}” in Help Uncle Sam Balance the Budget: play ${missionShort(STOP_BY_ID[d.id])} (${lower(d.title)}) and add your plan to ours. Room code ${room.code}.`;
  const members = t?.members ?? room.members;
  const finished = t?.done[d.id] ?? 0;

  const join = async () => {
    setBusy('join'); setError('');
    try { await joinRoom(room.code); rememberRoom(ref); setMe(await myMembership(room.code)); await refresh(); }
    catch (e) { setError(/full/.test(String((e as Error).message)) ? 'This room is full.' : /too many rooms/.test(String((e as Error).message)) ? 'You’re in the most rooms allowed; leave one first.' : 'Joining didn’t go through. Try again in a moment.'); }
    setBusy(null);
  };
  const leave = async () => {
    setBusy('leave'); setError('');
    try { await leaveRoom(room.code); forgetRoom(room.code); setMe(null); await refresh(); } catch { setError('That didn’t go through. Try again in a moment.'); }
    setBusy(null);
  };
  const close = async () => {
    if (!confirm(`Close “${room.name}” for everyone? Its members and plans are removed.`)) return;
    setBusy('close');
    try { await closeRoom(room.code); forgetRoom(room.code); location.hash = 'rooms'; } catch { setError('The room couldn’t be closed. Try again in a moment.'); setBusy(null); }
  };
  const playing = activeRoom()?.code === room.code;

  return (
    <>
      <PageHead eyebrow={`Room · ${missionLong(STOP_BY_ID[d.id])} · ${d.difficulty}`} title={room.name} lede={<>Everyone in this room plays {missionShort(STOP_BY_ID[d.id])}, {lower(d.title)}. A card is in the room’s plan when more than half the members’ plans use it.</>} />
      <SamSays mood="happy" auto>{joined ? ROOM_LINES.welcome : ROOM_LINES.invited}</SamSays>
      {error && <div className="callout small" role="status">{error}</div>}

      <section className="card room-join">
        <div className="room-code" aria-label={`Room code ${room.code.split('').join(' ')}`}>{room.code}</div>
        <div className="room-join-side">
          <div className="small">{members} {members === 1 ? 'member' : 'members'} · {t?.plans ?? room.plans} plan{(t?.plans ?? room.plans) === 1 ? '' : 's'} sent · join at <strong>balancethebudget.us</strong> with this code</div>
          {joined ? (
            <>
              <ActionBar label="The room">
                <a className="btn btn-primary" href={'#' + d.id} onClick={() => setActiveRoom(ref)}>{me?.cards ? `Play ${missionShort(STOP_BY_ID[d.id])} again` : `Play ${missionShort(STOP_BY_ID[d.id])} for the room`}</a>
                <ShareButton text={shareText} url={link} label="Invite" className="btn" />
              </ActionBar>
              <div className="sb-actions">
                {!playing && <button type="button" className="btn" onClick={() => setActiveRoom(ref)}>Play for this room</button>}
                <button type="button" className="btn" onClick={leave} disabled={busy != null}>Leave the room</button>
              </div>
            </>
          ) : (
            <ActionBar label="The room"><button type="button" className="btn btn-primary" onClick={join} disabled={busy != null}>{busy === 'join' ? 'Joining…' : 'Join this room'}</button></ActionBar>
          )}
          {joined && <div className="small muted">{me?.cards ? `Your plan is in: ${me.cards.length} cards, ${me.stars ?? 0} of 3 stars.` : `When you meet the goal on ${missionShort(STOP_BY_ID[d.id])}, your plan joins the room’s.`}</div>}
          {!joined && <div className="small muted">Joining takes a quick, private check that you’re a person. The room sees totals, never who did what.</div>}
        </div>
      </section>

      <section className="card peoples-board" aria-live="polite">
        <div className="sb-big">{!t?.plans ? 'No plans yet: be the first' : a.met ? `The room’s plan meets the goal: ${lower(d.title)}` : `The room’s plan is ${Math.floor(a.progress * 100)}% of the way`}</div>
        <GapBar segments={segments} progress={a.progress} />
        <div className="small muted">{t?.plans ? (a.met ? `With ${roomIds.length} cards, in FY${LAST_FY}: deficit ${a.last.deficit <= 0 ? 'balanced' : pct(a.last.deficit / a.last.gdp, 1) + ' of GDP'}, debt ${pct(a.last.debt / a.last.gdp, 0)} of GDP.` : `${roomIds.length} card${roomIds.length === 1 ? '' : 's'} have a majority. Still needed: ${money(still)} by FY${LAST_FY}.`) : `Goal: ${d.title.toLowerCase()} by FY${LAST_FY}.`}</div>
        {t?.plans ? (
          <div className="friendplan-bars">
            <div><div className="stat-label">Hit to the economy</div><EconMeter peakStep={a.econ.peakStep} /></div>
            <div><div className="stat-label">Who pays</div><SplitBar revenue={a.revTen} spending={a.spTen} /></div>
          </div>
        ) : null}
      </section>

      {t && t.plans > 0 && (
        <Section id="reveal" title="The reveal" sub="For the end of class or the meeting: the group’s budget personality, the card that split the room, and a dare to beat it. Made to go up on the big screen.">
          <RevealControls code={room.code} host={room.mine} onShow={() => setShow(true)} />
        </Section>
      )}
      {show && t && t.plans > 0 && (
        <RoomReveal
          name={room.name} plans={t.plans} members={members} met={a.met} title={lower(d.title)}
          arch={groupArchetype({ met: a.met, rating: a.econ.rating, top: concentration(a.shares) })}
          split={mostSplit(t.cards, t.plans)} soloUrl={`${siteRoot()}?${encodePlan({ level: d.id, goal: d.goal, ids: roomIds, lv: ZERO, gradual: true, by: room.name })}`}
          onClose={() => setShow(false)}
        />
      )}

      {t && t.plans > 0 && (
        <Section id="cards" title="The cards in members’ plans" sub={`Share of the ${t.plans} plan${t.plans === 1 ? '' : 's'} sent that use each card. More than half puts a card in the room’s plan.`}>
          <ol className="rlist">
            {[...OPTIONS].sort((x, y) => (t.cards[y.id] ?? 0) - (t.cards[x.id] ?? 0)).filter((o) => t.cards[o.id]).map((o) => {
              const n = t.cards[o.id] ?? 0;
              return <Bar key={o.id} label={<><span className="rcard-kind" data-side={o.side}>{o.side === 'revenue' ? 'Tax' : 'Cut'}</span>{o.name}{roomIds.includes(o.id) && <span className="peoples-chip" data-in="true" style={{ marginLeft: 6 }}>In</span>}</>} share={n / t.plans} note={`${pct(n / t.plans, 0)} · ${n}`} mine={!!me?.cards?.includes(o.id)} />;
            })}
          </ol>
        </Section>
      )}

      {t && (
        <Section id="progress" title="How the room is doing" sub="Levels finished by the room’s members.">
          <ol className="rlist">
            {STOPS.map((s) => <Bar key={s.id} label={`${s.n}. ${s.title}`} share={members ? (t.done[s.id] ?? 0) / members : 0} note={`${t.done[s.id] ?? 0} of ${members}`} />)}
          </ol>
          <p className="small muted">{finished} of {members} finished {missionShort(STOP_BY_ID[d.id])}.</p>
        </Section>
      )}

      {t && (
        <Section id="votes" title="How the room voted" sub={t.votes ? `${t.votes.voters} of ${members} members have voted in the game.` : 'Vote breakdowns appear once 3 people have joined, so no one’s answers stand out.'}>
          {t.votes && (
            <div className="rvotes">
              {BALLOT.map((q) => {
                if (q.key.startsWith('option:')) {
                  const v = t.votes!.options[q.key.slice(7)] ?? { support: 0, oppose: 0 };
                  const n = v.support + v.oppose;
                  return <article key={q.key} className="card rvote"><div className="stat-label">{missionShort(stopForCode(q.level)!)} · policy option</div><h3 className="rvote-q">{q.question}</h3><p className="small num">{n ? `${pct(v.support / n, 0)} support · ${pct(v.oppose / n, 0)} oppose · ${n} vote${n === 1 ? '' : 's'}` : 'No votes yet'}</p></article>;
                }
                const tally = t.votes!.issues[q.key] ?? {};
                const tot = Object.values(tally).reduce((x, y) => x + y, 0);
                return (
                  <article key={q.key} className="card rvote">
                    <div className="stat-label">{missionShort(stopForCode(q.level)!)} · question</div>
                    <h3 className="rvote-q">{q.question}</h3>
                    <ol className="rlist">{q.values.map((val, i) => <Bar key={val} label={q.labels[i]} share={tot ? (tally[val] ?? 0) / tot : 0} note={tot ? `${pct((tally[val] ?? 0) / tot, 0)} · ${tally[val] ?? 0}` : '0'} />)}</ol>
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      )}

      <Section id="invite" title="Invite the room">
        <div className="sb-actions"><ShareButton text={shareText} url={link} label="Share the room" className={'btn btn-primary' + (joined ? ' bar-dup' : '')} /></div>
        <SocialShare text={shareText} url={link} />
        {room.mine && <div className="sb-actions" style={{ marginTop: 12 }}><button type="button" className="btn" onClick={close} disabled={busy != null}>Close the room</button><span className="small muted">You started this room. Closing it removes it for everyone.</span></div>}
      </Section>
      <p className="small muted">Rooms keep each member’s latest plan for {missionShort(STOP_BY_ID[d.id])} (cards only) and count members’ progress and votes. Nobody, including whoever started the room, can see who did what. Not a scientific survey.</p>
    </>
  );
}

const NAME_OF = Object.fromEntries(OPTIONS.map((o) => [o.id, o.name]));
const TIMER_KEY = (code: string) => `ftd:room-timer:${code}`;

/** Show the reveal now, or (for whoever started the room) when a class timer runs out. The timer lives on this screen only. */
function RevealControls({ code, host, onShow }: { code: string; host: boolean; onShow: () => void }) {
  const [end, setEnd] = useState<number | null>(() => { try { const v = Number(localStorage.getItem(TIMER_KEY(code))); return v > Date.now() ? v : null; } catch { return null; } });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return;
    const iv = setInterval(() => {
      const n = Date.now(); setNow(n);
      if (n >= end) { setEnd(null); try { localStorage.removeItem(TIMER_KEY(code)); } catch { /* storage off */ } onShow(); }
    }, 500);
    return () => clearInterval(iv);
  }, [end, code, onShow]);
  const start = (min: number) => { const e = Date.now() + min * 60000; setEnd(e); setNow(Date.now()); try { localStorage.setItem(TIMER_KEY(code), String(e)); } catch { /* storage off */ } };
  const stop = () => { setEnd(null); try { localStorage.removeItem(TIMER_KEY(code)); } catch { /* storage off */ } };
  const left = end ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
  return (
    <div className="reveal-controls">
      {end ? (
        <div className="reveal-timer" role="timer" aria-live="off">
          <span className="reveal-clock num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
          <span className="small">until the reveal. Plans sent before then count.</span>
          <button type="button" className="btn btn-sm" onClick={stop}>Stop the timer</button>
        </div>
      ) : host ? (
        <div className="sb-actions" role="group" aria-label="Start a timer for the reveal">
          <span className="small">Reveal in:</span>
          {[5, 10, 15, 20].map((m) => <button key={m} type="button" className="btn btn-sm" onClick={() => start(m)}>{m} min</button>)}
        </div>
      ) : null}
      <div className="sb-actions"><button type="button" className="btn btn-primary" onClick={onShow}>Show the reveal</button></div>
    </div>
  );
}

/** The projector screen: big enough to photograph from the back of the room. */
function RoomReveal({ name, plans, members, met, title, arch, split, soloUrl, onClose }: {
  name: string; plans: number; members: number; met: boolean; title: string;
  arch: ReturnType<typeof groupArchetype>; split: ReturnType<typeof mostSplit>; soloUrl: string; onClose: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    document.body.classList.add('reveal-open');
    return () => { removeEventListener('keydown', esc); document.body.classList.remove('reveal-open'); };
  }, [onClose]);
  const sp = split ? splitPct(split.share) : null;
  const shareText = `Our room “${name}” is ${arch.name}${met ? '' : ' (we failed to pass a budget!)'}.${split && sp ? ` The card that split us: ${sp.yes}% put “${NAME_OF[split.id]}” in their plan; ${sp.no}% left it out.` : ''} Think you can beat the room?`;
  return (
    <div className="room-reveal" role="dialog" aria-modal="true" aria-labelledby="reveal-arch" data-arch={arch.id}>
      <div className="rr-inner">
        <div className="rr-eyebrow">{name} · {plans} plan{plans === 1 ? '' : 's'} from {members} member{members === 1 ? '' : 's'} · Group fiscal archetype</div>
        <div className="rr-arch">
          <span className="rr-emoji" aria-hidden="true">{arch.emoji}</span>
          <h2 id="reveal-arch" className="rr-name">{arch.name}</h2>
        </div>
        <p className="rr-line">{arch.line}{met ? ` Goal: ${title}.` : ''}</p>
        <div className="rr-grid">
          <section className="rr-box rr-split" aria-labelledby="rr-split-t">
            <div className="rr-k" id="rr-split-t">The most controversial card</div>
            {split && sp ? (
              <>
                <div className="rr-card">“{NAME_OF[split.id]}”</div>
                <div className="rr-bar" aria-hidden="true"><span style={{ width: `${sp.yes}%` }}>{sp.yes}%</span><span>{sp.no}%</span></div>
                <p><strong>{sp.yes}%</strong> of this room put it in their plan; <strong>{sp.no}%</strong> left it out. Discuss.</p>
              </>
            ) : <p>Every plan agreed on every card so far. Unanimous, for now.</p>}
          </section>
          <section className="rr-box rr-home" aria-labelledby="rr-home-t">
            <QrCode url={soloUrl} size={168} label="QR code: build your own plan and try to beat the room" />
            <div>
              <div className="rr-k" id="rr-home-t">Take it home</div>
              <p>Think your group blew it? Build your own solo plan in 3 minutes and see if you can beat the room.</p>
              <a className="btn btn-primary" href={soloUrl}>Beat the room</a>
            </div>
          </section>
        </div>
        <div className="rr-foot">
          <ShareButton text={shareText} url={soloUrl} label="Share the result" className="btn" kind="room" />
          <button type="button" className="btn" onClick={onClose}>Back to the room</button>
          <span className="rr-site">balancethebudget.us · plans compared, never people · scored with CBO’s numbers</span>
        </div>
      </div>
    </div>
  );
}

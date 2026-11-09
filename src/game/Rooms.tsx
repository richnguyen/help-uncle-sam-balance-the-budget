import { useState } from 'react';
import { ActionBar } from '../components/ActionBar';
import { PageHead, Section } from '../components/ui';
import { backendOn, createRoom, getRoom, joinRoom, ROOM_CODE } from '../lib/backend';
import { DESK, missionShort, STOP_BY_ID, stopForCode, STOPS } from './levels';
import { myRooms, rememberRoom } from './rooms';
import { ROOM_LINES } from './script';
import { PUBLIC_SITE } from './share';
import { SamSays } from './UncleSam';

// #rooms: start a room for a class, an office, or a family, or join one with its code.

const GOAL_NAME: Record<number, string> = { 5: 'Stop the debt from outgrowing the economy', 8: 'Cut the deficit to 3% of GDP', 10: 'Balance the budget' };

export default function Rooms() {
  const on = backendOn();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(5);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);
  const [error, setError] = useState('');
  const rooms = myRooms();

  if (!on) {
    return (
      <>
        <PageHead eyebrow="Play as a group" title="Rooms" lede="A class, an office, or a family plays together, and the group builds one plan." />
        <SamSays mood="happy" auto>{ROOM_LINES.offline}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href={`${PUBLIC_SITE}#rooms`} target="_blank" rel="noreferrer">Open rooms on balancethebudget.us</a></ActionBar>
      </>
    );
  }

  const start = async () => {
    const n = name.replace(/\s+/g, ' ').trim();
    if (!n) { setError('Give the room a name, like “Ms. Lee’s 3rd period”.'); return; }
    setBusy('start'); setError('');
    try {
      const c = await createRoom(n.slice(0, 40), level);
      if (!c) throw new Error('no code');
      await joinRoom(c);
      rememberRoom({ code: c, name: n.slice(0, 40), level });
      location.hash = 'room?c=' + c;
    } catch (e) {
      setError(/Too many/.test(String((e as Error).message)) ? 'You’ve started the most rooms allowed for today. Try again tomorrow.' : 'The room couldn’t be started. Try again in a moment.');
    }
    setBusy(null);
  };
  const join = async () => {
    const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!ROOM_CODE.test(c)) { setError('Room codes are 6 letters and numbers, like K7MQ3P.'); return; }
    setBusy('join'); setError('');
    const r = await getRoom(c).catch(() => null);
    setBusy(null);
    if (!r) { setError(ROOM_LINES.missing); return; }
    location.hash = 'room?c=' + c;
  };

  return (
    <>
      <PageHead eyebrow="Play as a group" title="Rooms" lede="A class, an office, or a family plays one budget-desk mission together. Everyone’s plan joins the room’s: a card is in the room’s plan when more than half the plans use it." />
      <SamSays mood="happy" auto>{ROOM_LINES.start}</SamSays>
      {error && <div className="callout small" role="status">{error}</div>}
      <div className="grid-2 rooms-forms">
        <section className="card rooms-form" aria-labelledby="start-t">
          <h2 className="section-title" id="start-t">Start a room</h2>
          <div className="field">
            <label htmlFor="room-name">Room name</label>
            <input id="room-name" className="input" maxLength={40} value={name} placeholder="Ms. Lee’s 3rd period" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="room-level">The group’s goal</label>
            <select id="room-level" className="select" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
              {DESK.map((d) => <option key={d.id} value={d.n}>{missionShort(STOP_BY_ID[d.id])}: {GOAL_NAME[d.n]} ({d.difficulty.toLowerCase()})</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={start} disabled={busy != null}>{busy === 'start' ? 'Starting…' : 'Start the room'}</button>
          <p className="small muted">You get a 6-character code to share. The room sees totals for its members, never who did what; vote breakdowns appear once 3 people have joined.</p>
          <p className="small"><a href="#teach">Teachers: a ready 45-minute lesson plan</a></p>
        </section>
        <section className="card rooms-form" aria-labelledby="join-t">
          <h2 className="section-title" id="join-t">Join with a code</h2>
          <div className="field">
            <label htmlFor="room-code">Room code</label>
            <input id="room-code" className="input rooms-code-input" maxLength={8} value={code} placeholder="K7MQ3P" autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
          </div>
          <button type="button" className="btn btn-primary" onClick={join} disabled={busy != null}>{busy === 'join' ? 'Looking…' : 'Find the room'}</button>
        </section>
      </div>
      {rooms.length > 0 && (
        <Section id="mine" title="Your rooms">
          <ul className="rooms-list">
            {rooms.map((r) => <li key={r.code}><a href={'#room?c=' + r.code}><strong>{r.name}</strong></a> <span className="small muted">· {missionShort(stopForCode(r.level) ?? STOPS[0])} · code <span className="num">{r.code}</span></span></li>)}
          </ul>
        </Section>
      )}
    </>
  );
}

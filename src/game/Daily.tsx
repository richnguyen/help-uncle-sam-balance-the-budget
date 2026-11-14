import { useState } from 'react';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { SOURCE_BY_ID } from '../data';
import { ReminderControl } from './reminders';
import { editionName, FINALE_NAME, grid, loadResults, longDate, nextTheme, puzzleFor, ROUNDS, saveResult, span, streak, type Theme, themeBlurb, todayKey, untilNext } from './daily';
import { useHaptics } from './haptics';
import { DAILY_LINES } from './script';
import { SITE_URL } from './share';
import { ShareButton, SocialShare } from './ShareButton';
import { useJourney } from './state';
import { SamSays } from './UncleSam';
import { partnerEvent } from '../lib/partners';

// The Daily Dollar page: one chain of real federal numbers a day; call each next one higher or lower.

const ratio = (a: number, b: number) => {
  const r = b / a;
  return r >= 1 ? `That’s ${r >= 10 ? Math.round(r) : r.toFixed(1)} times the number before.` : `That’s ${r < 0.1 ? 'under a tenth' : `${Math.round(r * 100)}%`} of the number before.`;
};

const themeLine = (t: Theme) => {
  const L = DAILY_LINES;
  const first = t.id === 'tax' ? (t.finale ? L.taxDay : L.taxWeek) : t.id === 'shutdown' ? (t.finale ? L.shutdownDay : L.shutdownWeek) : t.id === 'debt' ? (t.finale ? L.debtDay : L.debtWeek) : L.budgetWeek;
  return `${first} ${L.calls}`;
};

export default function Daily({ param = null }: { param?: string | null }) {
  const j = useJourney();
  const buzz = useHaptics();
  // #daily?d=YYYY-MM-DD previews another day's puzzle; nothing is saved or counted.
  const asked = new URLSearchParams(param ?? '').get('d');
  const preview = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked !== todayKey() ? asked : null;
  const key = preview ?? todayKey();
  const { n, pool, chain, theme } = puzzleFor(key);
  const upcoming = theme ? null : nextTheme(key, 45);
  const [answers, setAnswers] = useState<boolean[]>(() => (preview ? [] : loadResults()[key] ?? []));
  const [revealed, setRevealed] = useState(false);
  const done = answers.length >= ROUNDS;
  const round = Math.min(answers.length, ROUNDS - 1);
  // While a call is showing its answer, stay on that round.
  const i = revealed ? answers.length - 1 : answers.length;
  const known = chain[Math.min(i, ROUNDS - 1)];
  const next = chain[Math.min(i, ROUNDS - 1) + 1];
  const score = answers.filter(Boolean).length;
  const st = streak(loadResults(), key);

  const call = (higher: boolean) => {
    if (revealed || done) return;
    const right = (next.value > known.value) === higher;
    const a = [...answers, right];
    setAnswers(a);
    setRevealed(true);
    buzz(right ? 'right' : 'wrong');
    if (preview) { if (a.length >= ROUNDS && a.every(Boolean)) buzz('win'); return; }
    saveResult(key, a);
    if (a.length >= ROUNDS) { partnerEvent('played'); j.mark('daily'); if (a.every(Boolean)) buzz('win'); }
  };
  const advance = () => setRevealed(false);
  const shareTextStr = `The Daily Dollar #${n}${theme ? ` · ${editionName(theme)}` : ''} · ${score}/${ROUNDS}\n${grid(answers)}\nHigher or lower, on real federal numbers.`;
  const finished = done && !revealed;

  return (
    <>
      <PageHead eyebrow={`The Daily Dollar · #${n}${theme ? ` · ${theme.name}` : ''}`} title={theme ? `The Daily Dollar: ${editionName(theme)}` : 'The Daily Dollar'} lede={<>{preview ? 'That day' : 'Today'}: <strong>{pool.title[0].toLowerCase() + pool.title.slice(1)}</strong>. Five quick calls. Is the next number higher or lower? Same puzzle for everyone {preview ? 'that day' : 'today'}.</>} />
      {preview && <div className="callout small" role="note"><strong>Preview of {longDate(preview)}, {preview.slice(0, 4)}.</strong> Play it to see how it works; nothing is saved or counted. <a href="#daily">Today’s puzzle</a></div>}
      {theme && (
        <div className="daily-theme" data-theme={theme.id} role="note">
          <span className="daily-theme-tag">{theme.finale ? FINALE_NAME[theme.id] : `${theme.name} · day ${theme.day} of ${theme.days}`}</span>
          <span className="small">{themeBlurb(theme)}</span>
        </div>
      )}
      <SamSays mood={finished ? (score >= 4 ? 'cheering' : score >= 2 ? 'happy' : 'thinking') : theme ? 'proud' : 'happy'} auto compact>
        {finished ? DAILY_LINES.score[score] : theme ? themeLine(theme) : DAILY_LINES.intro}
      </SamSays>

      {!finished && (
        <section className="card daily" aria-live="polite">
          <div className="daily-progress" aria-label={`Call ${round + 1} of ${ROUNDS}`}>
            {Array.from({ length: ROUNDS }, (_, k) => <span key={k} data-state={k < answers.length ? (answers[k] ? 'right' : 'wrong') : k === answers.length ? 'now' : ''} />)}
          </div>
          <div className="daily-pair">
            <div className="daily-item">
              <div className="stat-label">Known</div>
              <strong>{known.label}</strong>
              <div className="daily-value num">{known.shown}</div>
            </div>
            <div className="daily-vs" aria-hidden="true">vs.</div>
            <div className="daily-item" data-revealed={revealed}>
              <div className="stat-label">Higher or lower?</div>
              <strong>{next.label}</strong>
              <div className="daily-value num">{revealed ? next.shown : '?'}</div>
              {revealed && <div className="small"><strong>{answers.at(-1) ? 'Right!' : 'Not this time.'}</strong> {ratio(known.value, next.value)}</div>}
            </div>
          </div>
          {!revealed ? (
            <ActionBar className="daily-actions" label={`Is ${next.label} higher or lower than ${known.label}?`}>
              <button type="button" className="btn btn-lg daily-btn" onClick={() => call(true)}>▲ Higher</button>
              <button type="button" className="btn btn-lg daily-btn" onClick={() => call(false)}>▼ Lower</button>
            </ActionBar>
          ) : (
            <ActionBar className="daily-actions" label="Next"><button type="button" className="btn btn-primary btn-lg" onClick={advance} autoFocus>{done ? 'See my result' : 'Next call'}</button></ActionBar>
          )}
          <p className="small muted">Measured as {pool.unit}.</p>
        </section>
      )}

      {finished && (
        <section className="card daily-done">
          <div className="daily-score"><span className="num">{score}</span><span className="small"> of {ROUNDS}</span></div>
          <div className="daily-grid" aria-label={`${score} of ${ROUNDS} right`}>{grid(answers)}</div>
          {preview ? <><p className="small">That was a preview, so it isn’t saved.</p><ActionBar label="Next"><a className="btn btn-primary" href="#daily">Play today’s puzzle</a></ActionBar></> : <>
          <p className="small">{st.run > 1 ? `${st.run} days in a row. ` : ''}You’ve played {st.played} day{st.played === 1 ? '' : 's'} so far. The next puzzle is ready in {untilNext()}.{theme && theme.day < theme.days ? ` ${theme.name} goes on through ${longDate(theme.end)}.` : ''}</p>
          {upcoming && <p className="small daily-upcoming"><strong>Coming up: {upcoming.name}, {span(upcoming)}.</strong> {upcoming.id === 'tax' ? 'A week of puzzles about taxes, ending on Tax Day.' : 'A week of puzzles about the budget, starting the day the President’s budget request is due.'}</p>}
          <ActionBar label="Share">
            <ShareButton text={shareTextStr} url={`${SITE_URL}?daily`} label="Share my result" className="btn btn-primary" />
            <a className="btn" href="#journey">Play the full game</a>
          </ActionBar>
          <SocialShare text={shareTextStr} url={`${SITE_URL}?daily`} />
          <ReminderControl where="daily" />
          </>}
        </section>
      )}

      {(finished || answers.length > 0) && (
        <Section id="numbers" title={preview ? 'That day’s numbers' : 'Today’s numbers'} sub="Every figure, and where it comes from.">
          <ol className="daily-list">
            {chain.slice(0, finished ? ROUNDS + 1 : answers.length + (revealed ? 1 : 0)).map((x) => {
              const src = x.source.id ? SOURCE_BY_ID[x.source.id] : undefined;
              const url = x.source.url ?? src?.url;
              return (
                <li key={x.id}>
                  <strong>{x.label}</strong> <span className="num">{x.shown}</span>
                  <div className="small muted">{url ? <a href={url} target="_blank" rel="noreferrer">{x.source.name}</a> : x.source.name}</div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}
    </>
  );
}

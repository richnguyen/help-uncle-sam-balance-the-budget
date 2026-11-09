import { useState } from 'react';
import { PageHead, Section } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { missionShort, STOPS } from './levels';
import { siteRoot } from './plans';
import { ShareButton } from './ShareButton';
import { TOGETHER_LINES } from './script';
import { SamSays } from './UncleSam';

// For teachers: a ready 45-minute class built from the game's own pieces (the Daily Dollar, the
// first two levels, a room on the budget desk), discussion questions that don't take sides, and
// what students need. Linked from Rooms and Play together, and easy to send to a colleague.

const L = (n: number) => STOPS.find((s) => s.n === n)!;

const PLAN = [
  { min: 5, title: 'Warm-up: today’s Daily Dollar', body: 'Put it on the projector. For each pair of numbers, the class votes higher or lower before you reveal it. Same puzzle for everyone today.' },
  { min: 15, title: `Missions 1.1 and 1.2: ${L(1).title} and ${L(2).title}`, body: 'Students play on their own phones or laptops. Each mission ends with a card; the first one shows what a salary pays in federal taxes, and how much interest ten years of it would save if it paid down the debt.' },
  { min: 20, title: `The budget desk, as a room: ${missionShort(L(5))}`, body: 'Start a room for the first campaign’s final mission and put the 6-character code on the board. Students join and build plans with real options the Congressional Budget Office has priced. The room shows the plan the class agrees on, card by card.' },
  { min: 10, title: 'Discussion', body: 'Use the room’s results and the questions below. The room shows totals only, never who chose what.' },
];

const QUESTIONS = [
  'What surprised you more: how much the government spends, or where the money comes from?',
  'Look at the room’s plan. Which cards did most of the class choose? Which split the class, and why might that be?',
  'Every plan that met the goal asked something of someone. Who carries the load in the class plan: taxpayers, people who use programs, or both?',
  'Why do you think Congress so often needs stopgap funding bills instead of passing the 12 spending bills on time?',
  'If you could ask your member of Congress one question about the budget, what would it be?',
];

export default function Teach() {
  const [copied, setCopied] = useState<'' | 'done' | 'manual'>('');
  const planText = [
    'Help Uncle Sam Balance the Budget: a 45-minute class',
    ...PLAN.map((p, i) => `${i + 1}. ${p.title} (${p.min} min). ${p.body}`),
    'Discussion questions:',
    ...QUESTIONS.map((q) => `- ${q}`),
    `Play free, no accounts: ${siteRoot()}`,
  ].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(planText); setCopied('done'); } catch { setCopied('manual'); } };
  return (
    <>
      <PageHead eyebrow="For teachers" title="Teach the federal budget with a game" lede="A free civics game your students play on their own phones: where the money comes from, where it goes, and how hard it is to fix. Every number comes from official sources, and the class builds one plan together." />
      <SamSays mood="happy" auto>{TOGETHER_LINES.teach}</SamSays>
      <Section id="plan" title="A 45-minute class" sub="Built from the game’s own pieces. Use all of it, or just the room.">
        <ol className="teach-plan">
          {PLAN.map((p) => (
            <li key={p.title}>
              <span className="teach-min">{p.min} min</span>
              <div><strong>{p.title}</strong><p className="small">{p.body}</p></div>
            </li>
          ))}
        </ol>
      </Section>
      <Section id="questions" title="Questions for discussion" sub="They don’t take sides. The game doesn’t either: it shows the trade-offs and rates plans, never people.">
        <ul className="teach-questions">{QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul>
      </Section>
      <Section id="needs" title="What students need">
        <ul className="small teach-needs">
          <li>A phone, tablet, or laptop with a web browser. Nothing to install, and no accounts or email.</li>
          <li>A first name is optional, and stays on the student’s own device.</li>
          <li>Rooms show totals for the group, never who chose what. Vote breakdowns appear once 3 people have joined.</li>
          <li>Each mission takes 4 to 10 minutes, and progress is saved on the device, so students can finish at home.</li>
          <li>Every figure links to its source: the Treasury, the Congressional Budget Office, the Census Bureau, the IRS, and the Social Security trustees.</li>
        </ul>
      </Section>
      <section className="card teach-copy">
        <div className="sb-actions">
          <button type="button" className="btn" onClick={copy}>{copied === 'done' ? 'Copied the lesson plan' : 'Copy the lesson plan'}</button>
          <ShareButton text="A free civics game about the federal budget, with a ready 45-minute class. Students play on their phones and build one plan together:" url={siteRoot() + '#teach'} label="Send this to a teacher" kind="room" />
        </div>
        {copied === 'manual' && <textarea className="input" readOnly rows={8} value={planText} onFocus={(e) => e.currentTarget.select()} aria-label="The lesson plan, ready to copy" />}
      </section>
      <ActionBar label="Start"><a className="btn btn-primary" href="#rooms">Start a room for your class</a><a className="btn" href="#daily">Today’s Daily Dollar</a></ActionBar>
    </>
  );
}

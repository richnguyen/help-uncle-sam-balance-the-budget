import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionBar } from '../components/ActionBar';
import congress from '../data/curated/congress.json';
import { Carousel } from '../components/Carousel';
import { PageHead, Section } from '../components/ui';
import { budget } from '../data';
import { assess, BASELINE, CTX, LAST_FY } from '../lib/assess';
import { dollars, moneyWords, pct } from '../lib/format';
import { partOfTheFix, personalEffect, savedWages } from '../lib/personal';
import { GOAL_DONE, whoPays } from './ChallengeParts';
import { ClipMaker } from './Clip';
import { DESK, MAX_STARS, rankFor, STOPS } from './levels';
import { archetype, ballotFrom, closestPreset, concentration, myName, type SavedPlan } from './plans';
import { useShareLink } from './shortlinks';
import { STORY_LINES } from './script';
import { shareText, svgSrc, svgToPng } from './share';
import { SocialShare } from './ShareButton';
import { useJourney } from './state';
import { type StoryCard, STORY_H, STORY_W, storySvg } from './storyCards';
import { SamSays, UncleSam } from './UncleSam';

// "Your Budget Story": a Wrapped-style set of phone-story cards about the player's own plan,
// drawn from their latest budget-desk plan. Everything is computed in the browser.

type Bill = { bill: string; title: string; year: number };
type ProposalPlan = { name: string };
const CONGRESS = congress as unknown as { options: Record<string, Bill | { none: true }>; plans: Record<string, ProposalPlan | { none: true }> };
const COLORS = { green: '#1d5a43', blue: '#2a78d6', pink: '#c2417a', violet: '#5b45cc', gold: '#9a6f00' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function useStoryPlan() {
  const j = useJourney();
  for (const id of ['level-10', 'level-8', 'level-5']) {
    const p = j.plans?.[id];
    if (p) return { level: id, plan: p };
  }
  return null;
}

function buildCards(level: string, plan: SavedPlan, o: { name: string; stars: number; done: number; rank: string; split: boolean }): StoryCard[] {
  const d = DESK.find((x) => x.id === level)!;
  const a = assess(d.goal, plan.ids, plan.lv, plan.gradual);
  const slidersUsed = Object.values(plan.lv).some((v) => v !== 0);
  const arche = archetype({ top: concentration(a.shares), rating: a.econ.rating, cards: plan.ids.length, slidersUsed });
  const top = a.shares[0];
  const bill = top ? CONGRESS.options[top.id] : undefined;
  const { wages, status } = savedWages();
  const pe = personalEffect(plan.ids, plan.lv, plan.gradual, wages, status);
  const near = closestPreset(plan.ids);
  const proposal = near ? CONGRESS.plans[near.id] : undefined;
  const start = CTX.startRatio;
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${dollars(Math.abs(v))}`;
  const shareOf = (x: number) => (x >= 1 ? 'The whole gap' : `${Math.max(1, Math.round(x * 100))}% of the gap`);
  const cards: StoryCard[] = [
    {
      id: 'cover', color: COLORS.green, sam: true,
      eyebrow: `My Budget Story · ${new Date().getFullYear()}`,
      title: o.name ? `${o.name}’s Budget Story` : 'My Budget Story',
      big: `★ ${o.stars} of ${MAX_STARS}`,
      body: `I helped Uncle Sam with his budget: ${o.done} of ${STOPS.length} levels, every number from official U.S. government data.`,
      chips: [o.rank],
      alt: `My Budget Story. ${o.stars} of ${MAX_STARS} stars, ${o.done} of ${STOPS.length} levels, rank ${o.rank}.`,
    },
    {
      id: 'personality', color: COLORS.blue,
      eyebrow: 'My budget personality',
      title: arche.name,
      body: arche.line,
      // How the plan splits taxes and cuts reads as a political stance, so it is on the card only if the player chooses.
      chips: [...(o.split ? [whoPays(a)] : []), `${cap(a.econ.rating)} on the economy`, `${plan.ids.length} card${plan.ids.length === 1 ? '' : 's'}`, ...(a.ev.promiseKept ? ['Kept every protection'] : [])],
      alt: `My budget personality: ${arche.name}. ${arche.line}`,
    },
  ];
  if (top) {
    cards.push({
      id: 'move', color: top.side === 'revenue' ? COLORS.blue : COLORS.pink,
      eyebrow: 'My biggest move',
      title: top.name,
      big: shareOf(top.share),
      body: `On its own, this card closes ${top.share >= 1 ? 'the whole gap' : `about ${Math.max(1, Math.round(top.share * 100))}% of the gap`} on level ${d.n}. CBO puts it at about ${moneyWords(top.savings10 * 1e9, 1)} over ten years.`,
      note: bill && !('none' in bill) ? `Closest bill in Congress: ${bill.bill}, ${bill.title}, ${bill.year}.` : undefined,
      alt: `My biggest move: ${top.name}, ${shareOf(top.share).toLowerCase()}.`,
    });
  }
  const fix = partOfTheFix(plan.ids, plan.lv, plan.gradual, pe);
  const cut = dollars(Math.max(0, fix.borrowingCut));
  if (o.split) cards.push({
    id: 'receipt', color: COLORS.green,
    eyebrow: 'What my plan means for me',
    title: 'My part of the fix',
    big: Math.abs(pe.direct) < 1 ? 'No change' : `${signed(pe.direct)} a year`,
    body: Math.abs(pe.direct) < 1
      ? `to my own federal taxes. My plan cuts Uncle Sam’s yearly borrowing by about ${cut} per household by FY${fix.lastFY}.`
      : pe.direct > 0
        ? `in my own federal taxes, about ${'$' + fix.perDay.toFixed(2)} a day. Together, it cuts Uncle Sam’s yearly borrowing by about ${cut} per household by FY${fix.lastFY}.`
        : 'in my own federal income and payroll taxes.',
    rows: [
      ...pe.lines.map((l) => ({ label: l.label, value: signed(l.amount) })),
      ...(pe.prices.perHousehold > 0 ? [{ label: `Through prices (${pe.prices.names.length} card${pe.prices.names.length === 1 ? '' : 's'}), average per household`, value: `${dollars(pe.prices.perHousehold)}/yr` }] : []),
    ],
    note: pe.benefits.length ? `My plan also changes ${pe.benefits.length} spending program${pe.benefits.length === 1 ? '' : 's'}, which reach people through benefits and services rather than taxes.` : 'A wage earner taking the standard deduction, under current tax rules.',
    alt: `What my plan means for me: ${Math.abs(pe.direct) < 1 ? 'no change' : signed(pe.direct) + ' a year'} in my own federal taxes.`,
  });
  const baseDebt = [start, ...BASELINE.map((r) => r.debt / r.gdp)];
  const planDebt = [start, ...a.sim.map((r) => r.debt / r.gdp)];
  cards.push({
    id: 'result', color: COLORS.violet,
    eyebrow: `The result by FY${LAST_FY}`,
    title: a.last.deficit <= 0 ? 'Budget balanced' : `Deficit ${pct(a.last.deficit / a.last.gdp, 1)} of GDP`,
    chart: { base: baseDebt, plan: planDebt, first: budget.latestFY, last: LAST_FY, label: 'Debt held by the public, share of GDP' },
    note: 'CBO’s baseline projection with CBO-priced options. Methods and sources are on the site.',
    alt: `The result by FY${LAST_FY}: debt ${pct(planDebt.at(-1)!, 0)} of GDP under my plan, ${pct(baseDebt.at(-1)!, 0)} under current law.`,
  });
  cards.push({
    id: 'challenge', color: COLORS.gold, sam: true,
    eyebrow: 'Can you beat my plan?',
    title: 'Your turn',
    body: proposal && !('none' in proposal) ? `My plan is closest to the real proposal ${proposal.name}. Play free and see if you can do better.` : 'Play free and see if you can do better.',
    chips: ['10 levels', 'Real CBO numbers', 'No sign-up'],
    alt: 'Your turn: can you beat my plan? Play free.',
  });
  return cards;
}

export default function Story() {
  const j = useJourney();
  const sp = useStoryPlan();
  const samBox = useRef<HTMLDivElement>(null);
  const [samSvg, setSamSvg] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // Off unless the player turns it on: how the plan splits taxes and cuts, and what it means for their own taxes.
  const [split, setSplit] = useState(false);
  useEffect(() => { setSamSvg(samBox.current?.querySelector('svg.sam')?.outerHTML); }, []);
  const done = STOPS.filter((s) => j.done.includes(s.id)).length;
  const stars = STOPS.reduce((a, s) => a + (j.stars[s.id] ?? 0), 0);
  const name = myName();
  const cards = useMemo(() => (sp ? buildCards(sp.level, sp.plan, { name, stars, done, rank: rankFor(done).name, split }) : []), [sp?.level, sp?.plan.at, name, stars, done, split]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgs = useMemo(() => cards.map((c) => storySvg(c, samSvg)), [cards, samSvg]);
  const link = useShareLink(sp?.level, sp?.plan ?? null, { by: name || undefined, ballot: ballotFrom(j.choices) }) ?? '';

  if (!sp) {
    const first = DESK[0];
    return (
      <>
        <PageHead eyebrow="Your Budget Story" title="Your Budget Story" lede="Cards about how you’d run Uncle Sam’s books: your budget personality, your biggest move, and the result." />
        <SamSays mood="thinking" auto>{STORY_LINES.locked}</SamSays>
        <ActionBar label="Next step"><a className="btn btn-primary" href={'#' + first.id}>Go to level {first.n}</a></ActionBar>
      </>
    );
  }
  const d = DESK.find((x) => x.id === sp.level)!;
  const arche = cards.find((c) => c.id === 'personality')!.title;
  const text = `My Budget Story: I’m ${arche}. I ${GOAL_DONE[d.goal]} with ${sp.plan.ids.length} policy cards and ${sp.plan.stars} of 3 stars. Can you beat my plan?`;
  const png = async (i: number) => svgToPng(svgs[i], STORY_W, STORY_H);
  const download = (b: Blob, file: string) => {
    const url = URL.createObjectURL(b);
    const el = document.createElement('a');
    el.href = url; el.download = file;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const saveOne = async (i: number) => { const b = await png(i).catch(() => null); if (b) { download(b, `budget-story-${i + 1}-${cards[i].id}.png`); j.mark('share'); } };
  const saveAll = async () => { setBusy(true); for (let i = 0; i < cards.length; i++) await saveOne(i); setBusy(false); };
  const shareAll = async () => {
    setBusy(true); setMsg('');
    let files: File[] | undefined;
    try {
      const blobs = await Promise.all(cards.map((_, i) => png(i)));
      files = blobs.filter(Boolean).map((b, i) => new File([b!], `budget-story-${i + 1}.png`, { type: 'image/png' }));
    } catch { files = undefined; }
    const r = await shareText({ text, url: link, files, kind: 'story' });
    setBusy(false);
    if (r === 'shared' || r === 'copied') j.mark('share');
    setMsg(r === 'copied' ? 'Copied the text and link. Save the images to post them with it.' : r === 'manual' ? `Copy this to share: ${text} ${link}` : '');
  };

  return (
    <>
      <PageHead eyebrow={`Your Budget Story · from level ${d.n}`} title="Your Budget Story" lede="Your budget personality, your biggest move, and the result, as cards sized for a phone story. Built from your latest plan on the budget desk." />
      <div className="sr-only" ref={samBox} aria-hidden="true"><UncleSam mood="cheering" size={120} /></div>
      <SamSays mood="cheering" auto>{STORY_LINES.ready}</SamSays>
      <Section id="cards" title="Your cards" sub="Swipe through. Save any card as an image, or share them all at once.">
        <label className="switch story-split"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Include how my plan splits taxes and cuts, and my part of the fix</label>
        <p className="small muted story-split-note">Off by default: the cards say how you did, not where you stand. Turn it on to share the details too.</p>
        <Carousel label="story cards" count={cards.length}>
          {cards.map((c, i) => (
            <figure className="story-card" key={c.id}>
              <img src={svgSrc(svgs[i])} alt={c.alt} width={STORY_W / 4} height={STORY_H / 4} />
              {!__ARTIFACT__ && <figcaption><button type="button" className="btn" onClick={() => saveOne(i)}>Save image</button></figcaption>}
            </figure>
          ))}
        </Carousel>
        <ActionBar label="Share">
          <button type="button" className="btn btn-primary" onClick={shareAll} disabled={busy}>{busy ? 'Preparing…' : 'Share my story'}</button>
          <a className="btn" href={'#' + sp.level}>Change my plan</a>
        </ActionBar>
        {!__ARTIFACT__ && <div className="sb-actions" style={{ marginTop: 12 }}><button type="button" className="btn" onClick={saveAll} disabled={busy}>Save all {cards.length} images</button></div>}
        {msg && <p className="small" role="status">{msg}</p>}
        <SocialShare text={text} url={link} kind="story" />
        <p className="small muted">The link carries your plan{Object.keys(ballotFrom(j.choices)).length ? ' and your answers to the big questions' : ''}, so friends can try to beat it. Your salary stays in this browser; the cards show only how your own taxes would change (set your salary on the <a href="#receipt">tax receipt</a> page).</p>
      </Section>
      <ClipMaker level={sp.level} plan={sp.plan} samSvg={samSvg} />
    </>
  );
}

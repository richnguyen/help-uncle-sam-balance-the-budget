import { DESK } from './levels';
import { ARCHETYPES, LEGACY_ARCHETYPE } from './plans';

// Link previews for shared plans. Link-preview crawlers read a page's preview tags and ignore the
// query string, so each shared link points at one of a fixed set of small static pages
// (public/p/<kind>/index.html), one per level × stars × budget personality, each with its own
// preview card (public/p/img/<kind>.jpg). The page forwards people to the plan right away.
// Regenerate both with `npm run previews` (scripts/make-previews.mjs) when the wording changes.

export interface PreviewKind { id: string; level: number; stars: 1 | 2 | 3; archetype: string }

export const PREVIEW_KINDS: PreviewKind[] = DESK.flatMap((d) =>
  ([1, 2, 3] as const).flatMap((stars) => Object.keys(ARCHETYPES).map((a) => ({ id: `${d.n}-${stars}-${a}`, level: d.n, stars, archetype: a }))));

/**
 * Links shared before the personalities went lean-neutral (…/p/10-3-revenue-bold/) keep working:
 * each old page now shows the matching new preview (same level and stars, a neutral personality).
 */
export const LEGACY_PREVIEW_KINDS: (PreviewKind & { image: string })[] = DESK.flatMap((d) =>
  ([1, 2, 3] as const).flatMap((stars) => Object.entries(LEGACY_ARCHETYPE).map(([old, a]) => ({ id: `${d.n}-${stars}-${old}`, level: d.n, stars, archetype: a, image: `${d.n}-${stars}-${a}` }))));

/** The kind for a plan, from its level, stars, and personality. */
export const previewKindId = (level: number, stars: number, archetype: string) => `${level}-${Math.min(3, Math.max(1, Math.round(stars)))}-${archetype}`;

// About someone else's plan, so in the third person (the Budget Story speaks to the player).
const LINE: Record<string, string> = {
  'big-gentle': 'One well-chosen move does most of the work, going easy on the economy.',
  'big-bold': 'One big move does most of the work, closing the gap fast.',
  'mix-gentle': 'A few solid moves share the work, phased in gently.',
  'mix-bold': 'A few strong moves share the work and get the job done.',
  'spread-gentle': 'Lots of small moves add up to the fix, each one easy on the economy.',
  'spread-bold': 'A sweeping plan: lots of moves, changing a lot at once.',
};
const GOAL: Record<number, { phrase: string; short: string }> = {
  5: { phrase: 'A plan to stop Uncle Sam’s debt from outgrowing the economy.', short: 'Stop the debt from outgrowing the economy' },
  8: { phrase: 'A plan to cut Uncle Sam’s deficit to 3% of GDP.', short: 'Cut the deficit to 3% of GDP' },
  10: { phrase: 'A plan to balance Uncle Sam’s budget.', short: 'Balance the budget' },
};

/** Previews for the shared pages that aren't plans (public/p/<id>/). */
export interface SpecialPreview { id: string; eyebrow: string; heading: [string, string]; sub: string; boxLabel: string; box: string; title: string; description: string; alt: string; color: string; mood: 'happy' | 'cheering' }
export const SPECIAL_PREVIEWS: SpecialPreview[] = [
  {
    id: 'peoples', color: '#1d5a43', mood: 'happy',
    eyebrow: 'Everyone’s budget · one move a day', heading: ['The People’s', 'Budget'], sub: 'Fix Uncle Sam’s books together',
    boxLabel: 'How it works', box: 'Each day, every player pushes one policy card in or out. A card is in when more people push it in than out. Watch the country close the gap.',
    title: 'The People’s Budget: fix Uncle Sam’s books together',
    description: 'One budget, built by everyone who plays. One move a day: push a policy card in or out, and watch the country close the gap together. Real CBO numbers.',
    alt: 'The People’s Budget: one budget built by everyone, one move a day.',
  },
  {
    id: 'chain', color: '#2467c4', mood: 'cheering',
    eyebrow: 'Pass the budget · your turn', heading: ['It’s your', 'turn'], sub: 'Make one change, then pass it on',
    boxLabel: 'How it works', box: 'Each person adds one policy card to Uncle Sam’s budget or takes one out, then sends the link to the next person. How many hands will it take?',
    title: 'Your turn: pass Uncle Sam’s budget along',
    description: 'A pass-the-budget chain: each person makes one change to Uncle Sam’s budget and passes the link on. Make yours and see how close the chain is. Real CBO numbers.',
    alt: 'Pass the budget: it’s your turn to make one change and pass it on.',
  },
  {
    id: 'room', color: '#5b45cc', mood: 'happy',
    eyebrow: 'Play as a group · join the room', heading: ['Join our', 'room'], sub: 'Build one plan for Uncle Sam together',
    boxLabel: 'How it works', box: 'Everyone in the room plays the same budget-desk level. A card is in the room’s plan when more than half the members’ plans use it.',
    title: 'Join our room: build one plan for Uncle Sam’s budget together',
    description: 'You’ve been invited to a room in Help Uncle Sam Balance the Budget. Play the room’s level, and your plan joins the group’s. Real CBO numbers.',
    alt: 'Join our room: build one plan for Uncle Sam’s budget together.',
  },
];
/** The People's Budget's preview, kept for links made before the others existed. */
export const PEOPLES_PREVIEW = SPECIAL_PREVIEWS[0];

export function previewText(k: PreviewKind) {
  const a = ARCHETYPES[k.archetype];
  const d = DESK.find((x) => x.n === k.level)!;
  const title = `Can you beat ${a.name}’s ${k.stars}-star plan?`;
  const description = `${GOAL[k.level].phrase} ${LINE[k.archetype]} Can you do better? Play free, with real CBO numbers.`;
  return {
    title,
    description,
    goal: GOAL[k.level].short,
    personality: a.name,
    line: LINE[k.archetype],
    level: d.n,
    difficulty: d.difficulty,
    alt: `${title} Level ${d.n}: ${GOAL[k.level].short}. ${k.stars} of 3 stars. Budget personality: ${a.name}.`,
  };
}

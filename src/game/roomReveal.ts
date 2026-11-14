// A room's reveal, for the projector: the group's budget personality (from the plan the room
// agreed on, card by card), the card that split the room most evenly, and an invitation to beat
// the room solo. Like the players' own personalities, the group's names say how big and how fast
// the plan is, never whether it taxes or cuts: nobody is sorted by party.
export interface GroupArchetype { id: string; name: string; line: string; emoji: string }

export const GROUP_ARCHETYPES: Record<string, GroupArchetype> = {
  gridlock: { id: 'gridlock', emoji: '🚧', name: 'Gridlocked Congress', line: 'Failed to pass a budget! No set of cards won enough of the room to meet the goal.' },
  hawks: { id: 'hawks', emoji: '🦅', name: 'The Ruthless Deficit Hawks', line: 'The room’s plan meets the goal, fast, and hits the economy hard on the way.' },
  dealmakers: { id: 'dealmakers', emoji: '🤝', name: 'The Dealmakers', line: 'The room found a plan that gets the job done, with a real but manageable hit to the economy.' },
  precision: { id: 'precision', emoji: '🎯', name: 'The Precision Planners', line: 'A few well-chosen moves meet the goal, and they go easy on the economy.' },
  builders: { id: 'builders', emoji: '🧱', name: 'The Patient Builders', line: 'Lots of small moves add up to the goal, each one easy on the economy.' },
};

/** The group's personality: gridlock if its majority plan falls short; otherwise how hard and how concentrated the plan is. */
export function groupArchetype(o: { met: boolean; rating: 'gentle' | 'moderate' | 'steep'; top: number }): GroupArchetype {
  if (!o.met) return GROUP_ARCHETYPES.gridlock;
  if (o.rating === 'steep') return GROUP_ARCHETYPES.hawks;
  if (o.rating === 'moderate') return GROUP_ARCHETYPES.dealmakers;
  return o.top >= 0.4 ? GROUP_ARCHETYPES.precision : GROUP_ARCHETYPES.builders;
}

/** The card closest to a 50/50 split of the room's plans (at least 2 plans; ties go to the card more plans used). */
export function mostSplit(cards: Record<string, number>, plans: number) {
  if (plans < 2) return null;
  let best: { id: string; yes: number; share: number } | null = null;
  for (const [id, n] of Object.entries(cards)) {
    if (!n || n >= plans) continue;
    const share = n / plans;
    if (!best || Math.abs(share - 0.5) < Math.abs(best.share - 0.5) - 1e-9 || (Math.abs(Math.abs(share - 0.5) - Math.abs(best.share - 0.5)) < 1e-9 && n > best.yes)) best = { id, yes: n, share };
  }
  return best;
}

/** Whole percentages that add to 100 (52% / 48%, never 52% / 47%). */
export function splitPct(share: number) { const yes = Math.round(share * 100); return { yes, no: 100 - yes }; }

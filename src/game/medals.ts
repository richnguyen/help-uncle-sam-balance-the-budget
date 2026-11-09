import { DESK, LEVELS, STOPS } from './levels';
import type { JourneyState } from './state';

// Medals reward taking part (voting, reading the original documents, sharing) as much as winning.
// They are earned from what the player has done; nothing can be bought or lost.

export interface Medal { id: string; name: string; desc: string; earned: (j: JourneyState) => boolean }

const voteIds = LEVELS.flatMap((l) => l.steps.filter((s) => s.vote).map((s) => (s.vote!.kind === 'option' ? 'option:' + s.vote!.optionId : s.vote!.id)));
const votesCast = (j: JourneyState) => voteIds.filter((id) => !!j.choices[id]).length;
const FIELD_GUIDE = ['overview', 'spending', 'revenue', 'receipt', 'state', 'gap', 'debt', 'process', 'laws', 'social-security'];

export const MEDALS: Medal[] = [
  { id: 'first-steps', name: 'First steps', desc: 'Finish mission 1.1.', earned: (j) => j.done.includes('level-1') },
  { id: 'first-vote', name: 'Voice of the people', desc: 'Cast your first vote.', earned: (j) => votesCast(j) >= 1 },
  { id: 'perfect', name: 'Perfect mission', desc: 'Earn three stars on any mission.', earned: (j) => Object.values(j.stars).some((n) => n >= 3) },
  { id: 'fine-print', name: 'Fine-print reader', desc: 'Open one of the original government documents in Sources & methods.', earned: (j) => j.marks.includes('doc') },
  { id: 'explorer', name: 'Field-guide explorer', desc: 'Read five chapters of the field guide.', earned: (j) => FIELD_GUIDE.filter((p) => j.marks.includes('page:' + p)).length >= 5 },
  { id: 'relay', name: 'Relay', desc: 'Take a turn in a pass-the-budget chain.', earned: (j) => j.marks.includes('chain') },
  { id: 'many-hands', name: 'Many hands', desc: 'Make a move in the People’s Budget.', earned: (j) => j.marks.includes('peoples') },
  { id: 'neighbor', name: 'Good neighbor', desc: 'Share your progress or a fact with someone.', earned: (j) => j.marks.includes('share') },
  { id: 'halfway', name: 'Halfway there', desc: 'Finish eight missions.', earned: (j) => STOPS.filter((s) => j.done.includes(s.id)).length >= 8 },
  { id: 'full-ballot', name: 'Full ballot', desc: `Vote on all ${voteIds.length} questions.`, earned: (j) => votesCast(j) >= voteIds.length },
  { id: 'straight-a', name: 'Straight A’s', desc: 'Earn three stars on every learning mission.', earned: (j) => LEVELS.every((l) => (j.stars[l.id] ?? 0) >= 3) },
  { id: 'fixer', name: 'Budget fixer', desc: 'Finish all three campaigns’ final missions.', earned: (j) => DESK.every((d) => j.done.includes(d.id)) },
  { id: 'voter', name: 'Informed Budget Voter', desc: `Finish all ${STOPS.length} missions.`, earned: (j) => STOPS.every((s) => j.done.includes(s.id)) },
];

export const earnedMedals = (j: JourneyState) => MEDALS.filter((m) => m.earned(j)).map((m) => m.id);

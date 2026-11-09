import { useCallback } from 'react';
import { useJourney } from './state';
import { playSound, type Sound } from './sfx';
import { samReact } from './samhud';
import type { SamAct } from './UncleSam';

// Feedback for every player action: a light vibration on phones that support the Vibration API
// (most Android browsers; not iOS Safari) and a short, quiet sound (see sfx.ts), so iPhones get
// feedback too. A tick for a right answer, a soft double tap for a miss, a small flourish for a
// finished level. Each has its own switch in settings.

const PATTERN = {
  tap: 8,
  card: [10],
  step: [6],
  right: [16],
  wrong: [28, 60, 28],
  vote: [12],
  win: [22, 70, 22, 70, 60],
  medal: [14, 50, 14],
} as const satisfies Record<Sound, number | readonly number[]>;
export type Haptic = keyof typeof PATTERN;

// Uncle Sam reacts to each action too, from the top bar: a nod for a card or a step, a thumbs-up
// for a right answer, a scratch of the head for a miss, a hat tip for a vote, a cheer for a win.
const ACT: Record<Haptic, SamAct> = { tap: 'glance', card: 'nod', step: 'nod', right: 'thumbs', wrong: 'oops', vote: 'hattip', win: 'cheer', medal: 'salute' };

export const hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function useHaptics() {
  const { settings } = useJourney();
  return useCallback((kind: Haptic) => {
    samReact(ACT[kind]);
    if (settings.sounds) playSound(kind);
    if (!settings.haptics || !hapticsSupported) return;
    try { navigator.vibrate(PATTERN[kind] as number | number[]); } catch { /* blocked, e.g. inside a frame */ }
  }, [settings.haptics, settings.sounds]);
}

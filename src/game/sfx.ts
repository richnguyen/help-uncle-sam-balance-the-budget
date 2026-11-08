// Short, quiet sound effects, synthesized with the Web Audio API (no files to download): a soft
// tick for a tap or a card, a two-note chime for a right answer, a low tone for a miss, and a
// small rising arpeggio for a finished level. They give feedback on phones that can't vibrate
// (iPhones), and follow the phone's silent switch where the browser does. Off with one switch in
// settings.

export type Sound = 'tap' | 'card' | 'step' | 'right' | 'wrong' | 'vote' | 'win' | 'medal';

type Note = [freq: number, start: number, length: number, gain?: number];
const C6 = 1046.5, E6 = 1318.5, G5 = 784, C5 = 523.25, E5 = 659.25, G4 = 392, A5 = 880;
const SOUNDS: Record<Sound, { wave: OscillatorType; notes: Note[] }> = {
  tap: { wave: 'sine', notes: [[A5, 0, 0.05, 0.5]] },
  card: { wave: 'triangle', notes: [[G5, 0, 0.06], [C6, 0.05, 0.08]] },
  step: { wave: 'sine', notes: [[C6, 0, 0.06, 0.45]] },
  vote: { wave: 'triangle', notes: [[E5, 0, 0.07], [A5, 0.06, 0.09]] },
  right: { wave: 'triangle', notes: [[E6 / 2, 0, 0.09], [G5 * 1.5, 0.08, 0.16]] },
  wrong: { wave: 'sine', notes: [[G4, 0, 0.12, 0.8], [G4 * 0.84, 0.1, 0.16, 0.7]] },
  win: { wave: 'triangle', notes: [[C5, 0, 0.1], [E5, 0.09, 0.1], [G5, 0.18, 0.1], [C6, 0.27, 0.26]] },
  medal: { wave: 'triangle', notes: [[G5, 0, 0.08], [E6, 0.08, 0.2]] },
};
const VOLUME = 0.07;

let ctx: AudioContext | null = null;
/** The one audio context the game's sounds share (the menu's ambience uses it too). */
export const audioContext = () => audio();
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

export const soundsSupported = typeof window !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export function playSound(kind: Sound) {
  const a = audio();
  if (!a) return;
  // Browsers start audio suspended until a tap; every sound here follows one.
  if (a.state === 'suspended') a.resume().catch(() => {});
  const { wave, notes } = SOUNDS[kind];
  const t0 = a.currentTime + 0.005;
  for (const [freq, start, len, g = 1] of notes) {
    const o = a.createOscillator();
    const v = a.createGain();
    o.type = wave;
    o.frequency.value = freq;
    const at = t0 + start;
    v.gain.setValueAtTime(0.0001, at);
    v.gain.exponentialRampToValueAtTime(VOLUME * g, at + 0.008);
    v.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(v).connect(a.destination);
    o.start(at);
    o.stop(at + len + 0.02);
  }
}

/** Stop any sound when the app goes to the background. */
export function suspendSounds() { ctx?.suspend().catch(() => {}); }

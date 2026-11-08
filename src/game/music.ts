import { useSyncExternalStore } from 'react';
import { load, save } from '../lib/storage';
import { audioContext } from './sfx';

// The main menu's music: an original, gentle loop, synthesized with the Web Audio API (nothing to
// download). Sixteen bars in F major at 72 beats a minute, about 53 seconds around: a warm pad
// (F, D minor, B-flat, C; F, A minor, B-flat, C), a soft bass on each chord, a music-box melody,
// a quiet arpeggio, and an echo. It plays only on the main menu, fades in and out, ducks under
// Uncle Sam's voice, stops when the tab is hidden, and has its own switch (on unless turned off).
// Browsers start audio only after a tap or a key, so it begins with the first one.

const KEY = 'music';
export const musicWanted = () => load<boolean>(KEY, true);
const subs = new Set<() => void>();
export function setMusicWanted(on: boolean) { save(KEY, on); subs.forEach((f) => f()); }
export const useMusicWanted = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, musicWanted, () => false);

const BPM = 72, BEAT = 60 / BPM, LOOP = 64; // beats
const VOLUME = 0.55;
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// Chords, two bars each: [first beat, pad notes, bass note] (MIDI numbers).
const CHORDS: [number, number[], number][] = [
  [0, [53, 57, 60], 41], [8, [53, 57, 62], 38], [16, [53, 58, 62], 34], [24, [52, 55, 60], 36],
  [32, [53, 57, 60], 41], [40, [52, 57, 60], 33], [48, [53, 58, 62], 34], [56, [52, 55, 60], 36],
];
// The melody: [beat, note, length in beats].
const MELODY: [number, number, number][] = [
  [0, 69, 1.5], [1.5, 72, 0.5], [2, 74, 1], [3, 72, 1], [4, 69, 2], [6, 67, 1], [7, 65, 1],
  [8, 65, 1.5], [9.5, 69, 0.5], [10, 74, 1.5], [11.5, 72, 0.5], [12, 69, 3],
  [16, 74, 1.5], [17.5, 72, 0.5], [18, 70, 1], [19, 69, 1], [20, 67, 2], [22, 65, 1], [23, 67, 1],
  [24, 67, 1.5], [25.5, 69, 0.5], [26, 72, 2], [28, 67, 3],
  [32, 72, 1.5], [33.5, 74, 0.5], [34, 77, 1], [35, 74, 1], [36, 72, 2], [38, 69, 1], [39, 72, 1],
  [40, 76, 1.5], [41.5, 74, 0.5], [42, 72, 1], [43, 69, 1], [44, 72, 3],
  [48, 74, 1], [49, 72, 1], [50, 70, 1], [51, 69, 1], [52, 67, 1.5], [53.5, 69, 0.5], [54, 70, 2],
  [56, 67, 2], [58, 64, 1], [59, 67, 1], [60, 67, 2], [62, 64, 2],
];

let running: {
  stop: () => void;
  duck: (on: boolean) => void;
} | null = null;

export function startMusic() {
  const a = audioContext();
  if (!a || running) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(VOLUME, a.currentTime + 3);
  master.connect(a.destination);
  // A soft echo for the melody and the arpeggio.
  const echo = a.createDelay(1); echo.delayTime.value = BEAT * 0.5;
  const fb = a.createGain(); fb.gain.value = 0.32;
  const tone = a.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
  const wet = a.createGain(); wet.gain.value = 0.3;
  echo.connect(tone).connect(fb).connect(echo);
  tone.connect(wet).connect(master);
  const padBus = a.createBiquadFilter(); padBus.type = 'lowpass'; padBus.frequency.value = 950; padBus.connect(master);

  const pad = (t: number, notes: number[], len: number) => {
    for (const m of notes) for (const [type, detune] of [['triangle', -5], ['sine', 6]] as const) {
      const o = a.createOscillator(); o.type = type; o.frequency.value = hz(m); o.detune.value = detune;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045, t + 1.4);
      g.gain.setValueAtTime(0.045, t + len - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 1.6);
      o.connect(g).connect(padBus); o.start(t); o.stop(t + len + 1.7);
    }
  };
  const bass = (t: number, m: number, len: number) => {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.06); g.gain.exponentialRampToValueAtTime(0.03, t + len);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.5);
    o.connect(g).connect(master); o.start(t); o.stop(t + len + 0.6);
  };
  const bell = (t: number, m: number, gain: number, decay: number) => {
    // A music box: a pure tone with a little of its octave and twelfth, ringing down.
    for (const [mult, part] of [[1, 1], [2, 0.28], [3, 0.08]]) {
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m) * mult;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * part, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + decay / mult);
      o.connect(g); g.connect(master); g.connect(echo);
      o.start(t); o.stop(t + decay + 0.05);
    }
  };

  // Schedule a little ahead, beat by beat.
  const start = a.currentTime + 0.15;
  let beat = 0;
  const tick = () => {
    while (start + beat * BEAT < a.currentTime + 1.2) {
      const t = start + beat * BEAT, b = beat % LOOP;
      for (const [at, notes, root] of CHORDS) {
        if (at !== b) continue;
        pad(t, notes, 8 * BEAT); bass(t, root, 8 * BEAT);
      }
      for (const [at, m, len] of MELODY) if (at >= b && at < b + 1) bell(t + (at - b) * BEAT, m, 0.075, Math.max(1.4, len * BEAT * 1.4));
      // The arpeggio: one quiet chord tone an octave up on each beat.
      const chord = [...CHORDS].reverse().find(([at]) => at <= b)!;
      const tones = chord[1];
      bell(t, tones[[0, 1, 2, 1][b % 4]] + 12, 0.018, 0.9);
      beat++;
    }
  };
  tick();
  const timer = window.setInterval(tick, 250);
  running = {
    stop: () => {
      clearInterval(timer);
      const t = a.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 1);
      window.setTimeout(() => { master.disconnect(); }, 1100);
    },
    duck: (on: boolean) => {
      const t = a.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(on ? VOLUME * 0.22 : VOLUME, t + (on ? 0.35 : 1.2));
    },
  };
}

export function stopMusic() { running?.stop(); running = null; }
/** Quieter while Uncle Sam is talking. */
export function duckMusic(on: boolean) { running?.duck(on); }

/**
 * Run `go` now if the browser already lets the page play sound, or else on the first tap or key
 * (not one that leaves the page through a link). Returns a cleanup.
 */
export function whenAudioAllowed(go: () => void) {
  const a = audioContext();
  if (!a) return () => {};
  if (a.state === 'running') { go(); return () => {}; }
  const unlock = (e: Event) => {
    if ((e.target as Element | null)?.closest?.('a[href]')) return;
    off();
    a.resume().then(go).catch(() => {});
  };
  const off = () => { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  return off;
}

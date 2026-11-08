import { useSyncExternalStore } from 'react';
import { load, save } from '../lib/storage';
import { audioContext } from './sfx';

// The main menu's soundscape, synthesized with the Web Audio API (nothing to download): a soft
// wind that rises and falls, with birdsong by day or crickets at night. It's off until the player
// turns it on (and browsers only allow it after a tap anyway), it's remembered, and it stops
// whenever the player leaves the menu or the tab goes to the background.

const KEY = 'ambience';
export const ambienceWanted = () => load<boolean>(KEY, false);
const subs = new Set<() => void>();
export function setAmbienceWanted(on: boolean) { save(KEY, on); subs.forEach((f) => f()); }
export const useAmbienceWanted = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, ambienceWanted, () => false);

let running: { stop: () => void } | null = null;

function noise(a: AudioContext) {
  // Brown noise: soft and low, like wind.
  const len = a.sampleRate * 3;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = a.createBufferSource();
  src.buffer = buf; src.loop = true;
  return src;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function startAmbience(night: boolean) {
  const a = audioContext();
  if (!a || running) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(0.6, a.currentTime + 2.5);
  master.connect(a.destination);

  // Wind: noise through a low-pass filter whose cutoff and loudness drift slowly.
  const wind = noise(a);
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
  const wg = a.createGain(); wg.gain.value = 0.05;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.06;
  const lfoAmt = a.createGain(); lfoAmt.gain.value = 220;
  const lfo2 = a.createOscillator(); lfo2.frequency.value = 0.11;
  const lfo2Amt = a.createGain(); lfo2Amt.gain.value = 0.025;
  lfo.connect(lfoAmt).connect(lp.frequency);
  lfo2.connect(lfo2Amt).connect(wg.gain);
  wind.connect(lp).connect(wg).connect(master);
  wind.start(); lfo.start(); lfo2.start();

  // Birds by day: short phrases of two to five chirps, here and there. Crickets at night.
  const timers: number[] = [];
  const chirp = (at: number, f0: number, f1: number, len: number, gain: number, pan: number) => {
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + len);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + len * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    const p = a.createStereoPanner ? a.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(master); } else o.connect(g).connect(master);
    o.start(at); o.stop(at + len + 0.02);
  };
  const bird = () => {
    const t = a.currentTime + 0.05, n = Math.round(rand(2, 5)), base = rand(2400, 4200), pan = rand(-0.8, 0.8);
    for (let i = 0; i < n; i++) { const up = Math.random() < 0.5; chirp(t + i * rand(0.09, 0.16), base * (up ? 0.85 : 1.15), base * (up ? 1.2 : 0.8), rand(0.05, 0.1), 0.02, pan); }
    timers.push(window.setTimeout(bird, rand(2500, 7000)));
  };
  const cricket = () => {
    const t = a.currentTime + 0.05, pan = rand(-0.9, 0.9);
    for (let i = 0; i < 3; i++) chirp(t + i * 0.07, 4600, 4500, 0.03, 0.008, pan);
    timers.push(window.setTimeout(cricket, rand(900, 2200)));
  };
  timers.push(window.setTimeout(night ? cricket : bird, 1200));

  running = {
    stop: () => {
      timers.forEach(clearTimeout);
      const t = a.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      window.setTimeout(() => { try { wind.stop(); lfo.stop(); lfo2.stop(); } catch { /* already stopped */ } master.disconnect(); }, 700);
    },
  };
}

export function stopAmbience() { running?.stop(); running = null; }

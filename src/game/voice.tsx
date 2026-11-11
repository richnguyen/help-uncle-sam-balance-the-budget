import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import manifestJson from '../data/generated/voice.json';
import { suspendSounds } from './sfx';
import { useJourney } from './state';

// Uncle Sam's voice. By default his lines play from recordings made ahead of time with Kokoro,
// an open-weight neural text-to-speech model, in a warm American male voice, so he sounds the
// same on every device. Recordings are grouped into one small audio file per level and fetched
// when needed. If a line has no recording, or the visitor picks one of their device's voices,
// the browser's own speech is used instead (never the old robotic synthesizer voices).

export type Mood = 'happy' | 'proud' | 'worried' | 'thinking' | 'surprised' | 'cheering';

/** Mood shows in pace, not pitch: changing pitch makes natural voices sound synthetic. */
const RATE: Record<Mood, number> = { happy: 1.0, proud: 0.97, worried: 0.93, thinking: 0.96, surprised: 1.05, cheering: 1.06 };

// `env`: how loud the clip is, 15 times a second, as digits 0–3 (scripts/voice/synth.py), so
// Uncle Sam's mouth can follow his voice.
type Clip = [bank: string, offset: number, length: number, seconds: number, env?: string];
const ENV_FPS = 15;
const MANIFEST = manifestJson as unknown as Record<string, Clip>;
export const hasRecordings = Object.keys(MANIFEST).length > 0;

/** FNV-1a (32-bit) over UTF-16 code units; scripts/voice/synth.py uses the same key. */
export function keyOf(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Lines are spoken a sentence at a time. Splits only where punctuation is followed by a space,
// so "$5.40" stays whole.
const sentences = (t: string) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["”’)]?)\s+/).map((x) => x.trim()).filter(Boolean);

const UNIT: Record<string, string> = { T: 'trillion', B: 'billion', M: 'million', K: 'thousand' };
const trim0 = (n: string) => (n.includes('.') ? n.replace(/\.?0+$/, '') : n);
/** Rewrite on-screen shorthand ("$1.90T", "FY2026") the way a person would say it. */
export function speakable(t: string) {
  return t
    .replace(/\$(\d[\d,]*(?:\.\d+)?)\s?([TBMK])\b/g, (_, n, u) => `${trim0(n)} ${UNIT[u]} dollars`)
    .replace(/\$(\d[\d,]*(?:\.\d+)?) (trillion|billion|million|thousand)\b/g, (_, n, u) => `${trim0(n)} ${u} dollars`)
    .replace(/\$(\d[\d,]*(?:\.\d+)?)/g, (_, n) => `${n} dollars`)
    .replace(/\bFY ?(\d{4})[–-]FY ?(\d{4})\b/g, 'fiscal years $1 to $2')
    .replace(/\bFY ?(\d{4})\b/g, 'fiscal year $1')
    .replace(/(\d)–(\d)/g, '$1 to $2')
    .replace(/\bGDP\b/g, 'G D P')
    .replace(/\b(CBO|CRS|TCJA|IRS|JCT|OMB|SNAP)\b/g, (m) => (m === 'SNAP' ? 'snap' : m.split('').join(' ')))
    .replace(/\bU\.S\./g, 'U.S')
    .replace(/\bCRs?\b/g, (m) => (m === 'CRs' ? 'continuing resolutions' : 'continuing resolution'));
}
export const toSentences = (t: string) => sentences(speakable(t));

/** Characters a second when there is no recording to time a sentence by (about 165 words a minute). */
const CHARS_PER_SEC = 15;
/** How long each sentence of a line takes him to say, in seconds: from its recording, or his usual pace. */
function sentenceSeconds(parts: string[], mood: Mood) {
  return parts.map((p) => (MANIFEST[keyOf(p)]?.[3] ?? p.length / CHARS_PER_SEC) / RATE[mood]);
}
/** How long Uncle Sam takes to say a line, in seconds, at his own pace (voice on or off). */
export function lineSeconds(text: string, mood: Mood = 'happy') {
  return sentenceSeconds(toSentences(text), mood).reduce((a, b) => a + b, 0);
}

/** Which recording bank a page's lines live in (scripts/voice/collect.mjs uses the same rule). */
export const DESK_LEVELS = ['level-5', 'level-8', 'level-10'];
export const bankFor = (route: string) => (DESK_LEVELS.includes(route) ? 'desk' : /^level-[a-z0-9]+$/.test(route) ? route : route === 'mall' ? 'mall' : 'common');

const banks = new Map<string, Promise<ArrayBuffer>>();
// Each bank's URL carries a short fingerprint of its clips, so a phone never pairs a cached older
// recording with newer clip offsets (and the offline cache can keep each version safely).
// The claude.ai artifact serves its files as they are, so it skips the fingerprint.
const versions = new Map<string, string>();
function bankVersion(b: string) {
  if (__ARTIFACT__) return '';
  if (!versions.has(b)) versions.set(b, '?v=' + keyOf(JSON.stringify(Object.entries(MANIFEST).filter(([, c]) => c[0] === b))));
  return versions.get(b)!;
}
function loadBank(b: string) {
  let p = banks.get(b);
  if (!p) {
    p = fetch(`voice/${b}.mp3${bankVersion(b)}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); });
    p.catch(() => setTimeout(() => banks.delete(b), 30000)); // allow a retry later
    banks.set(b, p);
  }
  return p;
}
const clipUrls = new Map<string, string>();
async function clipUrl(key: string) {
  const c = MANIFEST[key];
  if (!c) return null;
  const hit = clipUrls.get(key);
  if (hit) return hit;
  const buf = await loadBank(c[0]);
  const url = URL.createObjectURL(new Blob([buf.slice(c[1], c[1] + c[2])], { type: 'audio/mpeg' }));
  clipUrls.set(key, url);
  return url;
}
/** The recorded audio (MP3 bytes) for each sentence of a line, or null if any sentence has no recording. */
export async function lineAudio(text: string): Promise<ArrayBuffer[] | null> {
  const keys = toSentences(text).map(keyOf);
  if (!keys.length || !keys.every((k) => MANIFEST[k])) return null;
  const out: ArrayBuffer[] = [];
  for (const k of keys) { const c = MANIFEST[k]; const buf = await loadBank(c[0]); out.push(buf.slice(c[1], c[1] + c[2])); }
  return out;
}
// Phones won't play sound until the visitor first taps the page, so the recordings wait for that
// tap too: someone who only glances at a shared link downloads none of them.
let waiting: Set<string> | null = null;
const activated = () => {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
};
// Level 5's hint lines live in their own bank, fetched only there.
const extraBanks = (route: string) => (route === 'level-5' && Object.values(MANIFEST).some((c) => c[0] === 'hint') ? ['hint'] : []);
export const prefetchVoice = (route: string) => {
  if (!hasRecordings) return;
  const all = [bankFor(route), ...extraBanks(route)];
  if (activated()) { all.forEach((b) => loadBank(b).catch(() => {})); return; }
  if (!waiting) {
    waiting = new Set();
    const go = () => {
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
      const w = waiting; waiting = null;
      w?.forEach((b) => loadBank(b).catch(() => {}));
    };
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
  }
  all.forEach((b) => waiting!.add(b));
};

// ---------- device voices (fallback, or by choice) ----------
// Novelty and formant-synthesis voices (macOS's Fred, Ralph, Zarvox, the Eloquence set, eSpeak)
// sound robotic, so they are never chosen.
const ROBOTIC = /(fred|ralph|albert|junior|kathy|princess|bad news|good news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|eddy|flo\b|grandma|grandpa|reed|rocko|sandy|shelley|espeak|mbrola)/i;
const FEMALE = /(female|woman|samantha|victoria|karen|moira|tessa|zira|aria|jenny|michelle|emma|ava\b|allison|susan|nicky|joanna|salli|kimberly|ivy|kendra|vicki|agnes|ellen|serena|catherine|fiona|veena|nora|libby|sonia|sara|clara|elizabeth|amy\b|ana\b|monica|paulina|zoe|jane|emily|olivia|sophia|ashley|nancy|linda|hazel|heather|google us english)/i;
const MALE = /(\bmale|guy|david|mark|aaron|alex\b|tom\b|christopher|eric|roger|steffan|andrew|brian|davis|jason|tony|evan|nathan|ryan|matthew|joey|justin|kevin|bruce|daniel|james|john|richard|george|liam|noah|william|steve|michael|ethan|jacob|roy)/i;
const isUS = (v: SpeechSynthesisVoice) => /^en[-_]US/i.test(v.lang);
export const isMaleVoice = (v: SpeechSynthesisVoice) => !FEMALE.test(v.name) && MALE.test(v.name);
export const usableVoice = (v: SpeechSynthesisVoice) => /^en/i.test(v.lang) && !ROBOTIC.test(v.name);

// Uncle Sam is a man: any male English voice beats a female one, then American beats other
// accents, then modern (natural, neural, enhanced) beats older voices. A female voice is used
// only if the device has no male English voice at all.
function score(v: SpeechSynthesisVoice) {
  let s = 0;
  if (FEMALE.test(v.name)) s -= 100;
  else if (MALE.test(v.name)) s += 50;
  if (isUS(v)) s += 20;
  if (/natural|neural|online|enhanced|premium|siri/i.test(v.name)) s += 10;
  return s;
}
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return [...voices].filter(usableVoice).sort((a, b) => score(b) - score(a))[0] ?? null;
}

interface Narrator {
  supported: boolean;
  recorded: boolean; // using the recorded voice
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  speakingId: string | null;
  /** What visitors hear right now, for the settings panel. */
  using: string;
  speak: (id: string, text: string, mood?: Mood) => void;
  stop: (id?: string) => void;
  /** Browsers allow sound only after the person has interacted with the page. */
  canAutoplay: () => boolean;
  /** How far into the line he is (0–1, by characters), many times a second while he speaks. */
  onProgress: (f: (id: string, p: number) => void) => () => void;
}

const Ctx = createContext<Narrator | null>(null);

/** How open Uncle Sam's mouth should be right now (0 closed – 3 wide), for whoever is drawing him. */
export type MouthSubscribe = (f: (level: number) => void) => () => void;
export const MouthContext = createContext<MouthSubscribe | null>(null);

// A one-sample silent WAV, played on the first tap so mobile Safari lets the page play audio.
const SILENT = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

export function NarrationProvider({ children }: { children: ReactNode }) {
  const { settings } = useJourney();
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  const token = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const retry = useRef<(() => void) | null>(null);
  const speakRef = useRef<(id: string, text: string, mood?: Mood) => void>(() => {});
  const recorded = hasRecordings && settings.voice === 'auto';
  // Where he is in the line: which sentence, when it started, and how long each one takes.
  const plan = useRef<{ chars: number[]; secs: number[]; k: number; t0: number }>({ chars: [], secs: [], k: 0, t0: 0 });
  const progSubs = useRef(new Set<(id: string, p: number) => void>());
  const onProgress = useCallback((f: (id: string, p: number) => void) => { progSubs.current.add(f); return () => { progSubs.current.delete(f); }; }, []);
  const tellProgress = useCallback((p: number) => { const id = current.current; if (id) progSubs.current.forEach((f) => f(id, p)); }, []);
  const atSentence = useCallback((k: number) => { plan.current.k = k; plan.current.t0 = performance.now(); }, []);

  // ---- the mouth: follows the recording's loudness, or the device voice's words ----
  const mouthSubs = useRef(new Set<(n: number) => void>());
  const mouthLevel = useRef(0);
  const env = useRef<string | null>(null);
  const lastWord = useRef(0);
  const setMouth = useCallback((n: number) => {
    if (n === mouthLevel.current) return;
    mouthLevel.current = n;
    mouthSubs.current.forEach((f) => f(n));
  }, []);
  const subscribeMouth = useCallback<MouthSubscribe>((f) => {
    mouthSubs.current.add(f);
    f(mouthLevel.current);
    return () => { mouthSubs.current.delete(f); };
  }, []);
  useEffect(() => {
    if (!speakingId) { env.current = null; setMouth(0); return; }
    let raf = 0;
    let flutter = 0;
    const tick = (now: number) => {
      const a = audio.current;
      // How far along the line he is: the recording's own clock, or his usual pace for a device voice.
      const pl = plan.current;
      const total = pl.chars.reduce((x, y) => x + y, 0);
      if (total) {
        const k = Math.min(pl.k, pl.chars.length - 1);
        const before = pl.chars.slice(0, k).reduce((x, y) => x + y, 0);
        const frac = env.current && a && a.duration > 0 && !a.paused ? a.currentTime / a.duration : (now - pl.t0) / 1000 / (pl.secs[k] || 1);
        tellProgress(Math.min(1, (before + Math.min(1, Math.max(0, frac)) * pl.chars[k]) / total));
      }
      if (env.current && a && !a.paused) {
        const e = env.current;
        setMouth(Number(e[Math.min(e.length - 1, Math.floor(a.currentTime * ENV_FPS))] ?? 0));
      } else if (!env.current && now - lastWord.current > 700) {
        // A device voice that doesn't report its words: a gentle, irregular flutter.
        if (now - flutter > 110) { flutter = now; setMouth([0, 1, 2, 1, 2, 3, 1][Math.floor(Math.random() * 7)]); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setMouth(0); };
  }, [speakingId, setMouth, tellProgress]);

  useEffect(() => {
    if (hasRecordings) {
      const a = new Audio();
      a.preload = 'auto';
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      audio.current = a;
      // Mobile Safari lets an audio element play on its own only after it has played once during
      // a tap, so the narrator's element plays a silent sound on the first tap.
      const unlock = () => {
        if (unlocked.current || current.current) return;
        a.src = SILENT;
        a.play().then(() => {
          unlocked.current = true;
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        }).catch(() => {});
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }
    if (!synth) return;
    const s = window.speechSynthesis;
    const load = () => setVoices(s.getVoices().filter(usableVoice));
    load();
    s.addEventListener?.('voiceschanged', load);
    const off = () => { s.cancel(); audio.current?.pause(); };
    window.addEventListener('pagehide', off);
    return () => { s.removeEventListener?.('voiceschanged', load); window.removeEventListener('pagehide', off); off(); };
  }, [synth]);

  const voice = useMemo(() => (settings.voice !== 'auto' && voices.find((v) => v.voiceURI === settings.voice)) || pickVoice(voices), [voices, settings.voice]);

  const halt = useCallback(() => {
    audio.current?.pause();
    if (synth) window.speechSynthesis.cancel();
  }, [synth]);

  const finish = useCallback((my: number) => { if (token.current === my) { tellProgress(1); current.current = null; setSpeakingId(null); } }, [tellProgress]);

  const stop = useCallback((id?: string) => {
    if (id && current.current !== id) return;
    token.current++;
    current.current = null;
    halt();
    setSpeakingId(null);
  }, [halt]);

  const speakDevice = useCallback((my: number, parts: string[], mood: Mood) => {
    if (!synth) { finish(my); return; }
    const s = window.speechSynthesis;
    s.cancel();
    parts.forEach((part, k) => {
      const u = new SpeechSynthesisUtterance(part);
      // Each word opens the mouth, then it settles.
      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        lastWord.current = performance.now();
        setMouth(2);
        setTimeout(() => setMouth(1), 90);
        setTimeout(() => setMouth(0), 190);
      };
      u.onstart = () => atSentence(k);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'en-US';
      u.rate = RATE[mood];
      if (k === parts.length - 1) { u.onend = () => finish(my); u.onerror = () => finish(my); }
      s.speak(u);
    });
  }, [synth, voice, finish, setMouth, atSentence]);

  const speak = useCallback((id: string, text: string, mood: Mood = 'happy') => {
    const parts = toSentences(text);
    if (!parts.length) return;
    halt();
    const my = ++token.current;
    current.current = id;
    plan.current = { chars: parts.map((x) => x.length), secs: sentenceSeconds(parts, mood), k: 0, t0: performance.now() };
    setSpeakingId(id);
    const keys = parts.map(keyOf);
    const a = audio.current;
    if (!recorded || !a || !keys.every((k) => MANIFEST[k])) { speakDevice(my, parts, mood); return; }
    (async () => {
      for (let k = 0; k < keys.length; k++) {
        let url: string | null = null;
        try { url = await clipUrl(keys[k]); } catch { url = null; }
        if (token.current !== my) return;
        if (!url) { plan.current = { ...plan.current, chars: plan.current.chars.slice(k), secs: plan.current.secs.slice(k) }; speakDevice(my, parts.slice(k), mood); return; } // recordings unreachable
        a.src = url;
        a.playbackRate = RATE[mood];
        atSentence(k);
        env.current = MANIFEST[keys[k]][4] ?? null;
        const ok = await new Promise<boolean>((res) => {
          a.onended = () => res(true);
          a.onerror = () => res(false);
          a.play().catch(() => res(false));
        });
        if (token.current !== my) return;
        if (!ok) {
          // The browser blocked sound until the next tap: say the line then, with the same voice.
          const again = () => { window.removeEventListener('pointerdown', again, true); if (retry.current === again) { retry.current = null; speakRef.current(id, text, mood); } };
          if (retry.current) window.removeEventListener('pointerdown', retry.current, true);
          retry.current = again;
          window.addEventListener('pointerdown', again, true);
          break;
        }
      }
      finish(my);
    })();
  }, [recorded, speakDevice, halt, finish, atSentence]);

  speakRef.current = speak;

  // A call, a locked screen, or switching apps: Uncle Sam stops mid-sentence instead of talking on
  // in the background, and the sound effects pause.
  useEffect(() => {
    const vis = () => { if (document.hidden) { stop(); suspendSounds(); } };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [stop]);

  const canAutoplay = useCallback(() => {
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    return ua ? ua.hasBeenActive : true;
  }, []);

  const using = recorded ? 'Uncle Sam’s recorded voice' : voice ? `${voice.name}, a voice on this device` : 'no voice available';
  return (
    <Ctx.Provider value={{ supported: hasRecordings || synth, recorded, voices, voice, speakingId, using, speak, stop, canAutoplay, onProgress }}>
      <MouthContext.Provider value={subscribeMouth}>{children}</MouthContext.Provider>
    </Ctx.Provider>
  );
}

export function useNarrator() {
  const n = useContext(Ctx);
  if (!n) throw new Error('NarrationProvider missing');
  return n;
}

import { useEffect, useRef, useState } from 'react';
import { Section } from '../components/ui';
import { budget } from '../data';
import { assess, baselineFor, CTX, LAST_FY } from '../lib/assess';
import { pct } from '../lib/format';
import { DESK } from './levels';
import { myName, type SavedPlan } from './plans';
import { DESK_PARTY } from './script';
import { GAME_NAME, shareText, SITE_URL, svgToImage } from './share';
import { useJourney } from './state';
import { lineAudio } from './voice';

// A 10-second vertical clip of the player's plan bending the debt curve, with Uncle Sam's recorded
// voice, made in the browser with a canvas and MediaRecorder. Nothing is uploaded.

const W = 1080, H = 1920, SECONDS = 10, FPS = 30;
const TYPES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
export const clipType = () => (typeof MediaRecorder === 'undefined' ? null : TYPES.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) ?? null);

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));
const SANS = 'Arial, Helvetica, sans-serif';
const COND = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';

interface Frame { base: number[]; plan: number[]; years: number[]; title: string; stars: number; met: boolean; deficit: string }

function draw(g: CanvasRenderingContext2D, f: Frame, t: number, sam: HTMLImageElement | null) {
  g.fillStyle = '#f2f4ef'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d5a43'; g.fillRect(0, 0, W, 28);
  // Title
  const a1 = ease(t / 0.8);
  g.globalAlpha = a1;
  g.fillStyle = '#1d5a43'; g.font = `34px Menlo, Consolas, monospace`;
  g.fillText('UNCLE SAM’S DEBT, SHARE OF GDP', 80, 200);
  g.fillStyle = '#111b16'; g.font = `800 112px ${COND}`;
  f.title.split('\n').forEach((l, i) => g.fillText(l, 80, 330 + i * 118));
  g.globalAlpha = 1;
  // Chart
  const top = 640, h = 720, x0 = 110, w = W - 190;
  const all = [...f.base, ...f.plan];
  const lo = Math.min(...all) - 0.04, hi = Math.max(...all) + 0.04;
  const px = (i: number) => x0 + (i / (f.years.length - 1)) * w;
  const py = (v: number) => top + h - ((v - lo) / (hi - lo)) * h;
  g.fillStyle = '#ffffff'; g.fillRect(x0 - 30, top - 30, w + 60, h + 60);
  g.strokeStyle = '#d6dbd5'; g.lineWidth = 2;
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; g.beginPath(); g.moveTo(x0, py(v)); g.lineTo(x0 + w, py(v)); g.stroke(); }
  g.fillStyle = '#47524c'; g.font = `32px ${SANS}`;
  g.fillText(`FY${f.years[0]}`, x0, top + h + 74);
  g.textAlign = 'right'; g.fillText(`FY${f.years.at(-1)}`, x0 + w, top + h + 74); g.textAlign = 'left';
  const prog = ease((t - 1.0) / 6.0) * (f.years.length - 1);
  const path = (vals: number[], color: string, width: number, dash: number[]) => {
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= Math.floor(prog); i++) { const X = px(i), Y = py(vals[i]); if (i === 0) g.moveTo(X, Y); else g.lineTo(X, Y); }
    const fi = Math.floor(prog), fr = prog - fi;
    if (fi < vals.length - 1 && fr > 0) g.lineTo(px(fi) + (px(fi + 1) - px(fi)) * fr, py(vals[fi] + (vals[fi + 1] - vals[fi]) * fr));
    g.stroke(); g.setLineDash([]);
  };
  if (t > 1.0) { path(f.base, '#9aa19c', 9, [20, 14]); path(f.plan, '#1d5a43', 14, []); }
  const at = Math.min(f.years.length - 1, Math.max(0, Math.round(prog)));
  if (t > 1.0) {
    g.font = `700 40px ${SANS}`; g.fillStyle = '#47524c';
    g.fillText(`Current law: ${Math.round(f.base[at] * 100)}%`, 80, 1545);
    g.fillStyle = '#1d5a43'; g.font = `800 56px ${SANS}`;
    g.fillText(`My plan: ${Math.round(f.plan[at] * 100)}%`, 80, 1620);
    g.fillStyle = '#47524c'; g.font = `36px ${SANS}`;
    g.fillText(`FY${f.years[at]}`, 80, 1485);
  }
  // Ending
  const a2 = ease((t - 7.4) / 0.8);
  if (a2 > 0) {
    g.globalAlpha = a2;
    g.fillStyle = '#f2f4ef'; g.fillRect(0, 1450, W, 300);
    g.fillStyle = '#111b16'; g.font = `800 68px ${SANS}`;
    g.fillText(f.met ? 'Goal met.' : 'Getting there.', 80, 1525);
    g.font = `44px ${SANS}`; g.fillStyle = '#2b3530';
    g.fillText(f.deficit, 80, 1590);
    g.fillStyle = '#c9a645'; g.font = `72px ${SANS}`;
    g.fillText('★'.repeat(f.stars) + '☆'.repeat(3 - f.stars), 80, 1690);
    g.globalAlpha = 1;
  }
  if (sam) { const s = 0.92 + 0.08 * ease(t / 0.6); g.globalAlpha = ease(t / 0.6); g.drawImage(sam, W - 80 - 300 * s, 1440, 300 * s, 375 * s); g.globalAlpha = 1; }
  g.fillStyle = '#111b16'; g.font = `700 36px ${SANS}`;
  g.fillText('Can you beat my plan?', 80, 1810);
  g.fillStyle = '#1d5a43'; g.font = `32px ${SANS}`;
  g.fillText(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''), 80, 1862);
}

export function ClipMaker({ level, plan, samSvg }: { level: string; plan: SavedPlan; samSvg?: string }) {
  const j = useJourney();
  const type = clipType();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [left, setLeft] = useState(SECONDS);
  const [video, setVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  const d = DESK.find((x) => x.id === level)!;
  const a = assess(d.goal, plan.ids, plan.lv, plan.gradual);
  const name = myName();
  const frame: Frame = {
    base: [CTX.startRatio, ...baselineFor(d.goal).map((r) => r.debt / r.gdp)],
    plan: [CTX.startRatio, ...a.sim.map((r) => r.debt / r.gdp)],
    years: [budget.latestFY, ...a.sim.map((r) => r.fy)],
    title: `${name ? `${name}’s` : 'My'} plan\nfor Uncle Sam`,
    stars: a.ev.stars,
    met: a.met,
    deficit: a.last.deficit <= 0 ? `Budget balanced by FY${LAST_FY}.` : `Deficit ${pct(a.last.deficit / a.last.gdp, 1)} of GDP by FY${LAST_FY}.`,
  };

  // A still of the last frame, so the page shows what the clip will look like.
  useEffect(() => {
    const c = canvas.current; const g = c?.getContext('2d');
    if (!c || !g || state === 'recording') return;
    let alive = true;
    (async () => {
      const sam = samSvg ? await samImage(samSvg).catch(() => null) : null;
      if (alive) draw(g, frame, SECONDS, sam);
    })();
    return () => { alive = false; };
  }, [samSvg, plan.at, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const record = async () => {
    const c = canvas.current; const g = c?.getContext('2d');
    if (!c || !g || !type) return;
    setState('recording'); setLeft(SECONDS);
    try {
      const sam = samSvg ? await samImage(samSvg).catch(() => null) : null;
      const stream = c.captureStream(FPS);
      let ac: AudioContext | null = null;
      try {
        const clips = await lineAudio(DESK_PARTY[a.ev.stars]);
        if (clips) {
          ac = new AudioContext();
          const dest = ac.createMediaStreamDestination();
          let at = ac.currentTime + 0.9;
          for (const buf of clips) {
            const b = await ac.decodeAudioData(buf.slice(0));
            const src = ac.createBufferSource(); src.buffer = b; src.connect(dest); src.start(at); at += b.duration + 0.15;
          }
          dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
        }
      } catch { /* a silent clip is fine */ }
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
      rec.start(250);
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const tick = () => {
          const t = (performance.now() - t0) / 1000;
          draw(g, frame, Math.min(t, SECONDS), sam);
          setLeft(Math.max(0, Math.ceil(SECONDS - t)));
          if (t < SECONDS) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      rec.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());
      ac?.close().catch(() => {});
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      if (!blob.size) throw new Error('empty');
      if (video) URL.revokeObjectURL(video.url);
      setVideo({ url: URL.createObjectURL(blob), blob, ext: type.includes('mp4') ? 'mp4' : 'webm' });
      setState('done');
    } catch {
      setState('error');
    }
  };
  const save = () => {
    if (!video) return;
    const el = document.createElement('a');
    el.href = video.url; el.download = `uncle-sam-plan.${video.ext}`;
    document.body.appendChild(el); el.click(); el.remove();
    j.mark('share');
  };
  const share = async () => {
    if (!video) return;
    const file = new File([video.blob], `uncle-sam-plan.${video.ext}`, { type: video.blob.type });
    const r = await shareText({ title: GAME_NAME, text: 'My plan for Uncle Sam’s budget. Can you beat it?', files: [file], kind: 'clip' });
    if (r === 'shared' || r === 'copied') j.mark('share');
  };

  return (
    <Section id="clip" title="Make a 10-second clip" sub="Your plan bending the debt curve, with Uncle Sam’s voice, sized for Reels, TikTok, and Shorts. Made in your browser; nothing is uploaded.">
      <div className="clip">
        <canvas ref={canvas} width={W} height={H} className="clip-canvas" aria-label="Preview of the clip" />
        <div className="clip-side">
          {!type && <p className="small">This browser can’t record video. Try a recent Chrome, Edge, Firefox, or Safari.</p>}
          {type && state !== 'recording' && <button type="button" className="btn btn-primary" onClick={record}>{state === 'done' ? 'Make it again' : 'Make my clip'}</button>}
          {state === 'recording' && <p className="small" role="status">Recording… {left} s left. Keep this tab open.</p>}
          {state === 'error' && <p className="small" role="status">The clip couldn’t be made in this browser. The cards above still work.</p>}
          {video && state === 'done' && (
            <>
              <video src={video.url} controls playsInline className="clip-video" />
              <div className="sb-actions">
                {typeof navigator.share === 'function' && <button type="button" className="btn btn-primary" onClick={share}>Share the clip</button>}
                {!__ARTIFACT__ && <button type="button" className="btn" onClick={save}>Save the clip ({video.ext.toUpperCase()})</button>}
              </div>
              {video.ext === 'webm' && <p className="small muted">This browser saves WebM. Most sites accept it; for Instagram, convert it to MP4 or make the clip in Safari or a recent Chrome.</p>}
            </>
          )}
          <p className="small muted">The lines come from CBO’s baseline projection and your plan, scored the same way as the budget desk.</p>
        </div>
      </div>
    </Section>
  );
}

function samImage(samSvg: string) {
  const svg = samSvg.replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="375" viewBox="0 0 120 150">').replace(/var\(--[^)]+\)/g, '#9aa19c');
  return svgToImage(svg);
}

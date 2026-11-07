import { DIFF_COLOR, DESK, STOPS } from './levels';
import { PREVIEW_KINDS, previewText, SPECIAL_PREVIEWS } from './previews';
import { UncleSam } from './UncleSam';

// One link-preview card, drawn at exactly 1200×630 for scripts/make-previews.mjs to photograph
// (#og-card?k=10-3-mix-gentle). Not linked from anywhere in the game.

export default function OgCard({ param }: { param: string | null }) {
  const id = new URLSearchParams(param ?? '').get('k') ?? '';
  const sp = SPECIAL_PREVIEWS.find((x) => x.id === id);
  if (sp) {
    return (
      <div className="ogcard" style={{ ['--og' as string]: sp.color }} data-kind={id}>
        <div className="ogcard-band" />
        <div className="ogcard-main">
          <div className="ogcard-eyebrow">{sp.eyebrow}</div>
          <div className="ogcard-title">{sp.heading[0]}<br />{sp.heading[1]}</div>
          <div className="ogcard-goal">{sp.sub}</div>
          <div className="ogcard-person">
            <div className="ogcard-k">{sp.boxLabel}</div>
            <div className="ogcard-line">{sp.box}</div>
          </div>
          <div className="ogcard-foot"><strong>balancethebudget.us</strong> · Help Uncle Sam Balance the Budget · official U.S. data</div>
        </div>
        <div className="ogcard-sam"><UncleSam mood={sp.mood} size={330} /></div>
      </div>
    );
  }
  const k = PREVIEW_KINDS.find((x) => x.id === id) ?? PREVIEW_KINDS.at(-1)!;
  const t = previewText(k);
  const d = DESK.find((x) => x.n === k.level)!;
  const color = DIFF_COLOR[d.difficulty];
  return (
    <div className="ogcard" style={{ ['--og' as string]: color }} data-kind={k.id}>
      <div className="ogcard-band" />
      <div className="ogcard-main">
        <div className="ogcard-eyebrow">Level {t.level} of {STOPS.length} · {t.difficulty}</div>
        <div className="ogcard-title">Can you beat<br />this plan?</div>
        <div className="ogcard-goal">Goal: {t.goal[0].toLowerCase() + t.goal.slice(1)}</div>
        <div className="ogcard-stars" aria-label={`${k.stars} of 3 stars`}>
          {[1, 2, 3].map((s) => <span key={s} data-on={s <= k.stars}>★</span>)}
        </div>
        <div className="ogcard-person">
          <div className="ogcard-k">Budget personality</div>
          <div className="ogcard-name">{t.personality}</div>
          <div className="ogcard-line">{t.line}</div>
        </div>
        <div className="ogcard-foot"><strong>balancethebudget.us</strong> · Help Uncle Sam Balance the Budget · official U.S. data</div>
      </div>
      <div className="ogcard-sam"><UncleSam mood="cheering" size={330} /></div>
    </div>
  );
}

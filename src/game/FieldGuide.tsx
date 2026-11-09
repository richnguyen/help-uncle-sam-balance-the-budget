import { PageHead } from '../components/ui';
import { ActionBar } from '../components/ActionBar';
import { BookIcon, DocIcon, LevelIcon } from './icons';
import { missionShort, STOP_BY_ID } from './levels';
import { FIELD_GUIDE } from './nav';
import { useJourney } from './state';

// The field guide's front page (#guide): every chapter in full, each with the level it goes
// with, and the reference pages (Sources & methods, the glossary) inside it.

/** Each field-guide chapter belongs to a level, so readers can jump into the game from any page. */
export const CHAPTER_LEVEL: Record<string, string> = {
  revenue: 'level-1', receipt: 'level-1', overview: 'level-2', spending: 'level-2', state: 'level-3',
  gap: 'level-4', debt: 'level-6', process: 'level-7', laws: 'level-7', 'social-security': 'level-9',
};

export default function FieldGuide() {
  const j = useJourney();
  return (
    <>
      <PageHead eyebrow="Field guide" title="The field guide" lede="Every chapter in full, no game needed. Each one goes with a mission, and every number says where it comes from." />
      <ol className="guide-grid">
        {FIELD_GUIDE.map((g, i) => {
          const lv = STOP_BY_ID[CHAPTER_LEVEL[g.route]];
          const read = j.marks?.includes('page:' + g.route);
          return (
            <li key={g.route}>
              <a className="guide-card" href={'#' + g.route} data-read={read || undefined}>
                <span className="guide-icon" aria-hidden="true">{lv ? <LevelIcon id={lv.icon} size={22} /> : <BookIcon />}</span>
                <span className="guide-text">
                  <span className="guide-n">Chapter {i + 1}{read ? ' · read' : ''}</span>
                  <strong>{g.label}</strong>
                  {lv && <span className="small muted">Goes with {missionShort(lv)}: {lv.title}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <section className="guide-ref" aria-labelledby="guide-ref-t">
        <h2 className="section-title" id="guide-ref-t">Sources &amp; methods</h2>
        <div className="guide-grid guide-grid-ref">
          <a className="guide-card" href="#sources">
            <span className="guide-icon" aria-hidden="true"><DocIcon size={22} /></span>
            <span className="guide-text"><strong>Sources &amp; methods</strong><span className="small muted">Every dataset and document behind the numbers, how each figure is worked out, and what the game leaves out.</span></span>
          </a>
          <a className="guide-card" href="#glossary">
            <span className="guide-icon" aria-hidden="true"><BookIcon size={22} /></span>
            <span className="guide-text"><strong>Glossary</strong><span className="small muted">The budget words the game uses, in plain English.</span></span>
          </a>
        </div>
      </section>
      <ActionBar label="Read"><a className="btn btn-primary" href="#overview">Start with the big picture</a><a className="btn" href="#sources">Sources &amp; methods</a></ActionBar>
    </>
  );
}

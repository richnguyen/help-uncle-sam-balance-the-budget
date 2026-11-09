import { SOURCE_BY_ID } from '../data';
import { OPTIONS_DATA } from '../lib/planData';
import { LevelIcon } from './icons';
import { diffKey, LEVELS, missionShort, type Stop, STOPS } from './levels';
import { useJourney } from './state';

// The fine print for each level: its full field-guide chapter and the original government
// documents behind its numbers. Shown on Sources & methods; each level links here.

interface Doc { title: string; url: string; by?: string }

const DESK_DOCS: Doc[] = [
  { title: OPTIONS_DATA.volume.title, url: OPTIONS_DATA.volume.url, by: 'Congressional Budget Office' },
  ...['omb-hist', 'cbo-multiplier-wp'].map((id) => SOURCE_BY_ID[id]).filter(Boolean).map((s) => ({ title: s.title, url: s.url, by: s.publisher })),
  ...OPTIONS_DATA.principles.filter((p) => p.source?.url).map((p) => ({ title: p.source.title, url: p.source.url })),
];

export function docsFor(stop: Stop): { chapters: { route: string; label: string }[]; docs: Doc[] } {
  const l = LEVELS.find((x) => x.id === stop.id);
  if (!l) return { chapters: [{ route: 'gap', label: 'Deficits & the structural gap' }, { route: 'debt', label: 'Debt & interest' }], docs: dedupe(DESK_DOCS) };
  const docs: Doc[] = [
    ...l.sources.map((s) => SOURCE_BY_ID[s]).filter(Boolean).map((d) => ({ title: d.title, url: d.url, by: d.publisher })),
    ...(l.links ?? []),
  ];
  return { chapters: l.deepDive, docs: dedupe(docs) };
}
const dedupe = (d: Doc[]) => d.filter((x, k, a) => a.findIndex((y) => y.url === x.url) === k);

export function LevelDocs() {
  const j = useJourney();
  return (
    <div className="leveldocs">
      {STOPS.map((s) => {
        const { chapters, docs } = docsFor(s);
        return (
          <article key={s.id} id={'doc-' + s.id} className="card leveldoc" data-diff={diffKey(s.difficulty)}>
            <div className="leveldoc-head">
              <span className="factcard-icon"><LevelIcon id={s.icon} size={18} /></span>
              <div><div className="stat-label">{missionShort(s)} · {s.difficulty}</div><a className="leveldoc-title" href={'#' + s.id}>{s.title}</a></div>
            </div>
            <div className="leveldoc-cols">
              <div>
                <div className="stat-label">The full chapter</div>
                <ul className="link-list">{chapters.map((c) => <li key={c.route}><a href={'#' + c.route}>{c.label}</a></li>)}</ul>
              </div>
              <div>
                <div className="stat-label">The original documents</div>
                <ul className="link-list">{docs.map((d) => <li key={d.url}><a href={d.url} target="_blank" rel="noreferrer" onClick={() => j.mark('doc')}>{d.title}</a>{d.by && <span className="muted"> ({d.by})</span>}</li>)}</ul>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

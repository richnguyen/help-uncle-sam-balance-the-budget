import { useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { glossary, SOURCE_BY_ID } from '../data';

export default function Glossary() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...glossary].sort((a, b) => a.term.localeCompare(b.term)).filter((g) => !s || (g.term + ' ' + g.def).toLowerCase().includes(s));
  }, [q]);
  return (
    <>
      <PageHead eyebrow="Reference" title="Budget words, in plain English" lede="The terms used across this site. Dotted-underlined words in the missions, the desk and the feed open these definitions when you tap them. Each one names where it comes from." />
      <div className="field" style={{ maxWidth: 380 }}>
        <label htmlFor="gq">Search the glossary</label>
        <input id="gq" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: reconciliation" />
      </div>
      <dl className="gloss">
        {list.map((g) => (
          <div className="gloss-item" key={g.id} id={'g-' + g.id}>
            <dt>{g.term}</dt>
            <dd>{g.def}{g.source && SOURCE_BY_ID[g.source] && <> <a className="gloss-src small" href={SOURCE_BY_ID[g.source].url} target="_blank" rel="noopener noreferrer">Source: {SOURCE_BY_ID[g.source].publisher}</a></>}</dd>
          </div>
        ))}
      </dl>
      {list.length === 0 && <div className="empty">No terms match “{q}”.</div>}
    </>
  );
}

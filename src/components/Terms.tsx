import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';
import { glossary } from '../data';
import { Term } from './ui';

// Tap-to-define, automatically. <Terms> walks the text it wraps and turns the first use of each
// glossary term (by the phrases in its `aka` list) into a <Term> that opens the definition. It only
// rewrites plain text inside ordinary elements (p, li, strong...): it leaves links, buttons and
// headings alone, and never reaches inside other components, so their own text and behavior stay
// as they are. A term already marked by hand with <Term> counts as used.

const ACRONYM = /^[A-Z]{2,}$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every alias, longest first, so "debt held by the public" wins over shorter matches. */
const ALIASES = glossary
  .flatMap((g) => (g.aka ?? []).map((a) => ({ id: g.id, a })))
  .sort((x, y) => y.a.length - x.a.length);
// Words match in any case, singular or plural; acronyms must match exactly (checked in idOf, since
// inline case flags aren't supported on older phones).
const RE = new RegExp(ALIASES.map(({ a }) => `\\b${esc(a)}${ACRONYM.test(a) ? '' : '(?:e?s)?'}\\b`).join('|'), 'gi');
const idOf = (m: string) => ALIASES.find(({ a }) => (ACRONYM.test(a) ? m === a : new RegExp(`^${esc(a)}(?:e?s)?$`, 'i').test(m)))?.id;

const SKIP = new Set(['a', 'button', 'h1', 'h2', 'h3', 'h4', 'label', 'select', 'option', 'textarea', 'svg', 'code', 'title', 'summary']);

function linkText(text: string, seen: Set<string>): ReactNode {
  const out: ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(RE)) {
    const id = idOf(m[0]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(text.slice(at, m.index), <Term key={`${id}-${m.index}`} id={id}>{m[0]}</Term>);
    at = m.index! + m[0].length;
  }
  if (!out.length) return text;
  out.push(text.slice(at));
  return out;
}

/** Link the first use of each glossary term in `node`, recording what's been linked in `seen`. */
export function termify(node: ReactNode, seen: Set<string>): ReactNode {
  if (typeof node === 'string') return linkText(node, seen);
  if (Array.isArray(node)) return Children.map(node, (c) => termify(c, seen));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode; id?: string }>;
  if (el.type === Term) { if (el.props.id) seen.add(el.props.id); return el; }
  if (el.type !== Fragment && typeof el.type !== 'string') return el;
  if (typeof el.type === 'string' && SKIP.has(el.type)) return el;
  if (el.props.children == null) return el;
  return cloneElement(el, undefined, termify(el.props.children, seen));
}

/**
 * Wraps text so each glossary term's first use is tappable. Use `inline` for a run of text inside
 * a flex or grid container, so the linked pieces stay one item and the line doesn't break apart.
 */
export function Terms({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const out = termify(children, new Set());
  return inline ? <span className="terms">{out}</span> : <>{out}</>;
}

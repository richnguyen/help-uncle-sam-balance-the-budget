// Official roll-call records, read as the two chambers publish them: the House Clerk's XML
// (clerk.house.gov/evs/<year>/roll<n>.xml) and the Senate's (senate.gov/legislative/LIS/...xml).
// Each comes back as the same plain shape: the question, the result, the totals, and every
// member's vote with party and state as the record lists them. Nothing is scored or rated.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' || e[1] === 'X' ? 2 : 1), e[1] === 'x' || e[1] === 'X' ? 16 : 10)) : ENT[e.toLowerCase()] ?? m));
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim() : ''; };
const num = (s) => (s === '' ? 0 : Number(s) || 0);
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** A vote as the game keeps it: the members are [name, party, state, vote] in the record's order. */
export function parseHouse(xml, url) {
  const roll = num(tag(xml, 'rollcall-num'));
  const [d, mon, y] = tag(xml, 'action-date').split('-');
  const totals = xml.match(/<totals-by-vote>([\s\S]*?)<\/totals-by-vote>/)?.[1] ?? '';
  const members = [...xml.matchAll(/<recorded-vote>\s*<legislator([^>]*)>([\s\S]*?)<\/legislator>\s*<vote>([\s\S]*?)<\/vote>/g)].map(([, attrs, name, vote]) => {
    const a = (k) => decode(attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? '');
    return [decode(name).trim(), a('party'), a('state'), decode(vote).trim()];
  });
  const year = Number(y) || Number(url.match(/evs\/(\d{4})\//)?.[1]) || 0;
  return {
    chamber: 'House', roll, date: year && MONTHS[mon?.toLowerCase()] ? ymd(year, MONTHS[mon.toLowerCase()], Number(d)) : '',
    question: tag(xml, 'vote-question'), result: tag(xml, 'vote-result'),
    totals: { yea: num(tag(totals, 'yea-total')), nay: num(tag(totals, 'nay-total')), present: num(tag(totals, 'present-total')), notVoting: num(tag(totals, 'not-voting-total')) },
    url: year ? `https://clerk.house.gov/Votes/${year}${roll}` : url,
    members,
  };
}

export function parseSenate(xml, url) {
  const when = tag(xml, 'vote_date').match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  const count = xml.match(/<count>([\s\S]*?)<\/count>/)?.[1] ?? '';
  const members = [...xml.matchAll(/<member>([\s\S]*?)<\/member>/g)].map(([, m]) => {
    const first = tag(m, 'first_name'), last = tag(m, 'last_name');
    return [first ? `${first} ${last}` : tag(m, 'member_full').replace(/\s*\([^)]*\)\s*$/, ''), tag(m, 'party'), tag(m, 'state'), tag(m, 'vote_cast')];
  });
  return {
    chamber: 'Senate', roll: num(tag(xml, 'vote_number')),
    date: when && MONTHS[when[1].slice(0, 3).toLowerCase()] ? ymd(when[3], MONTHS[when[1].slice(0, 3).toLowerCase()], Number(when[2])) : '',
    question: tag(xml, 'vote_question_text') || tag(xml, 'question'), result: tag(xml, 'vote_result'),
    totals: { yea: num(tag(count, 'yeas')), nay: num(tag(count, 'nays')), present: num(tag(count, 'present')), notVoting: num(tag(count, 'absent')) },
    url: url.replace(/\.xml$/, '.htm'),
    members,
    // A tie the Vice President broke: the counts above are senators only, so 50-50 can pass.
    ...(tag(xml, 'by_whom') ? { tieBreaker: { by: tag(xml, 'by_whom'), vote: tag(xml, 'tie_breaker_vote') } } : {}),
  };
}

/** Parse a record by where it came from. */
export const parseRollCall = (xml, url) => (/clerk\.house\.gov/.test(url) ? parseHouse(xml, url) : parseSenate(xml, url));

// ---- Which votes to keep, from a bill's Congress.gov actions.

// A vote that decides the bill (passage, agreeing to the other chamber's version, a conference
// report, a veto override), as opposed to a procedural one (cloture, motions to proceed or table).
const DECIDES = /\bon passage\b|passed|failed of passage|suspend the rules and pass|concur|agree to the (senate|house) amendment|agree to the conference report|conference report|override|agreed to in (house|senate)/i;
// Procedural: cloture and other motions, waivers and points of order, and votes on amendments.
const PROCEDURAL = /cloture|motion to (proceed|table|commit|recommit|reconsider|waive)|\bwaive|point of order|previous question|providing for consideration|\bS\.?\s?Amdt|\bH\.?\s?Amdt|\bSA \d+|amendment (no\.|sa\b)/i;
const NO_ROLL = /by voice vote|by unanimous consent|without objection/i;

/**
 * The record links to fetch, at most `max`, newest first, with every vote that decided the bill
 * ahead of procedural ones: a bill that took many cloture votes still shows how it passed.
 */
export function pickVoteUrls(actions, hosts, max = 4) {
  const byUrl = new Map();
  for (const a of actions) for (const v of a.recordedVotes ?? []) {
    if (!hosts.test(v.url ?? '')) continue;
    const k = byUrl.get(v.url) ?? { url: v.url, date: v.date ?? a.actionDate ?? '', decides: false };
    if (DECIDES.test(a.text ?? '') && !PROCEDURAL.test(a.text ?? '')) k.decides = true;
    byUrl.set(v.url, k);
  }
  const all = [...byUrl.values()].sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
  return [...all.filter((x) => x.decides), ...all.filter((x) => !x.decides)].slice(0, max).map((x) => x.url);
}

/**
 * Passages with no roll call (voice vote, unanimous consent, without objection), which have no
 * member list: from the Library of Congress's summary actions, one per chamber and day, newest first.
 */
export function passagesWithoutRollCall(actions, max = 3) {
  const notes = [];
  for (const a of actions) {
    const m = (a.text ?? '').match(/^(?:Passed\/agreed to in (House|Senate)|Resolving differences -- (House|Senate) actions):\s*(.*)$/);
    if (!m || !NO_ROLL.test(m[3]) || (a.recordedVotes ?? []).length || PROCEDURAL.test(m[3])) continue;
    const chamber = m[1] || m[2];
    if (notes.some((n) => n.chamber === chamber && n.date === a.actionDate)) continue;
    const how = /voice vote/i.test(m[3]) ? 'voice vote' : /unanimous consent/i.test(m[3]) ? 'unanimous consent' : 'without objection';
    notes.push({ chamber, date: a.actionDate ?? '', how, text: m[3].replace(/\s*\((?:text|consideration)[^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim() });
  }
  return notes.sort((x, y) => y.date.localeCompare(x.date)).slice(0, max);
}

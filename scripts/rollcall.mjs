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
  };
}

/** Parse a record by where it came from. */
export const parseRollCall = (xml, url) => (/clerk\.house\.gov/.test(url) ? parseHouse(xml, url) : parseSenate(xml, url));

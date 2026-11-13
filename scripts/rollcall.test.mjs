// The roll-call parser, on short records written in each chamber's published format.
//   node scripts/rollcall.test.mjs
import { readFileSync } from 'node:fs';
import { parseRollCall, passagesWithoutRollCall, pickVoteUrls } from './rollcall.mjs';

const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

const HOUSE = `<?xml version="1.0" encoding="UTF-8"?>
<rollcall-vote>
<vote-metadata>
<majority>R</majority>
<congress>119</congress>
<session>1st</session>
<chamber>U.S. House of Representatives</chamber>
<rollcall-num>190</rollcall-num>
<legis-num>H R 1</legis-num>
<vote-question>On Motion to Concur in the Senate Amendment</vote-question>
<vote-type>YEA-AND-NAY</vote-type>
<vote-result>Passed</vote-result>
<action-date>3-Jul-2025</action-date>
<action-time time-etz="14:31">2:31 PM</action-time>
<vote-desc>One Big Beautiful Bill Act</vote-desc>
<vote-totals>
<totals-by-party-header><party-header>Party</party-header><yea-header>Yeas</yea-header></totals-by-party-header>
<totals-by-party><party>Republican</party><yea-total>218</yea-total><nay-total>2</nay-total><present-total>0</present-total><not-voting-total>0</not-voting-total></totals-by-party>
<totals-by-vote><total-stub>Totals</total-stub><yea-total>218</yea-total><nay-total>214</nay-total><present-total>0</present-total><not-voting-total>0</not-voting-total></totals-by-vote>
</vote-totals>
</vote-metadata>
<vote-data>
<recorded-vote><legislator name-id="A000370" sort-field="Adams" unaccented-name="Adams" party="D" state="NC" role="legislator">Adams</legislator><vote>Nay</vote></recorded-vote>
<recorded-vote><legislator name-id="A000055" sort-field="Aderholt" unaccented-name="Aderholt" party="R" state="AL" role="legislator">Aderholt</legislator><vote>Yea</vote></recorded-vote>
<recorded-vote><legislator name-id="D000096" sort-field="Davis (IL)" unaccented-name="Davis (IL)" party="D" state="IL" role="legislator">Davis (IL)</legislator><vote>Not Voting</vote></recorded-vote>
</vote-data>
</rollcall-vote>`;

const SENATE = `<?xml version="1.0" encoding="UTF-8"?>
<roll_call_vote>
<congress>119</congress>
<session>1</session>
<congress_year>2025</congress_year>
<vote_number>372</vote_number>
<vote_date>July 1, 2025,  11:51 AM</vote_date>
<vote_question_text>On Passage of the Bill (H.R. 1 As Amended )</vote_question_text>
<vote_document_text>A bill to provide for reconciliation pursuant to title II of H. Con. Res. 14.</vote_document_text>
<vote_result_text>Bill Passed (51-50, VP voted YES)</vote_result_text>
<question>On Passage of the Bill</question>
<vote_title>H.R. 1 As Amended</vote_title>
<majority_requirement>1/2</majority_requirement>
<vote_result>Bill Passed</vote_result>
<count><yeas>50</yeas><nays>50</nays><present></present><absent></absent></count>
<tie_breaker><by_whom>Vice President</by_whom><tie_breaker_vote>Yea</tie_breaker_vote></tie_breaker>
<members>
<member><member_full>Alsobrooks (D-MD)</member_full><last_name>Alsobrooks</last_name><first_name>Angela</first_name><party>D</party><state>MD</state><vote_cast>Nay</vote_cast><lis_member_id>S428</lis_member_id></member>
<member><member_full>Banks (R-IN)</member_full><last_name>Banks</last_name><first_name>Jim</first_name><party>R</party><state>IN</state><vote_cast>Yea</vote_cast><lis_member_id>S433</lis_member_id></member>
</members>
</roll_call_vote>`;

const h = parseRollCall(HOUSE, 'https://clerk.house.gov/evs/2025/roll190.xml');
ok(h.chamber === 'House' && h.roll === 190 && h.date === '2025-07-03', `House: roll 190 on ${h.date}`);
ok(h.question === 'On Motion to Concur in the Senate Amendment' && h.result === 'Passed', 'House: the question and result as the Clerk records them');
ok(h.totals.yea === 218 && h.totals.nay === 214 && h.totals.present === 0 && h.totals.notVoting === 0, 'House: the totals come from the totals row, not a party row');
ok(h.members.length === 3 && h.members[0].join() === 'Adams,D,NC,Nay' && h.members[2].join() === 'Davis (IL),D,IL,Not Voting', 'House: each member with party, state and vote, as listed');
ok(h.url === 'https://clerk.house.gov/Votes/2025190', 'House: the link is the Clerk’s page for the vote');

const s = parseRollCall(SENATE, 'https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.xml');
ok(s.chamber === 'Senate' && s.roll === 372 && s.date === '2025-07-01', `Senate: vote 372 on ${s.date}`);
ok(s.question === 'On Passage of the Bill (H.R. 1 As Amended )' && s.result === 'Bill Passed', 'Senate: the question and result as the Senate records them');
ok(s.totals.yea === 50 && s.totals.nay === 50 && s.totals.present === 0 && s.totals.notVoting === 0, 'Senate: the totals (senators only), with empty counts as zero');
ok(s.tieBreaker?.by === 'Vice President' && s.tieBreaker?.vote === 'Yea', 'Senate: a tie the Vice President broke is kept, with the vote cast');
ok(!('tieBreaker' in parseRollCall(SENATE.replace(/<tie_breaker>[\s\S]*?<\/tie_breaker>/, '<tie_breaker><by_whom></by_whom><tie_breaker_vote></tie_breaker_vote></tie_breaker>'), 'https://www.senate.gov/x.xml')), 'Senate: no tie-breaker when the record names none');
ok(s.members.length === 2 && s.members[0].join() === 'Angela Alsobrooks,D,MD,Nay', 'Senate: each senator with party, state and vote');
ok(s.url.endsWith('vote_119_1_00372.htm'), 'Senate: the link is the Senate’s page for the vote');

const bad = parseRollCall('<html>not a record</html>', 'https://clerk.house.gov/evs/2025/roll1.xml');
ok(bad.members.length === 0 && bad.totals.yea === 0 && bad.question === '', 'a page that isn’t a record gives nothing, not a guess');

// Which votes a bill keeps, from real Congress.gov actions (scripts/fixtures, trimmed).
const HOSTS = /^https:\/\/(clerk\.house\.gov|www\.senate\.gov)\//;
const actionsOf = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}-actions.json`, import.meta.url), 'utf8')).actions;
const a7147 = actionsOf('hr7147');
const urls = pickVoteUrls(a7147, HOSTS);
ok(urls.length === 4 && /clerk\.house\.gov\/evs\/2026\/roll042\.xml$/i.test(urls[0]), `H.R. 7147: the House passage (roll 42, 220-207) comes first, ahead of the Senate's failed cloture votes: ${urls[0]}`);
ok(urls.slice(1).every((u) => /senate\.gov/.test(u)), 'H.R. 7147: then the most recent procedural votes fill the rest');
const n7147 = passagesWithoutRollCall(a7147);
ok(n7147.length === 2 && n7147[0].chamber === 'House' && n7147[0].date === '2026-04-30' && n7147[0].how === 'voice vote' && /concur in the Senate amendment/.test(n7147[0].text) && !/\(text:/.test(n7147[0].text), 'H.R. 7147: the House agreed to the Senate version by voice vote (Apr 30, 2026)');
ok(n7147[1].chamber === 'Senate' && n7147[1].date === '2026-03-27' && n7147[1].how === 'voice vote', 'H.R. 7147: the Senate passed it by voice vote (Mar 27, 2026), once, though Congress.gov lists it twice');
const n9499 = passagesWithoutRollCall(actionsOf('hr9499'));
ok(n9499.length === 1 && n9499[0].chamber === 'House' && n9499[0].how === 'voice vote' && /suspend the rules and pass/.test(n9499[0].text), 'H.R. 9499: passed the House by voice vote, with no roll call');
ok(!passagesWithoutRollCall(a7147).some((n) => /table|cloture|proceed/i.test(n.text)), 'procedural motions agreed to by voice vote are not passages');

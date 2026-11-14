// The Mastodon client against a stand-in (nothing reaches a Mastodon server): the status it posts,
// the token, the idempotency key, recognizing a text already posted from the server's HTML, and
// a token that can't read recent posts still posting.
import { mastodon, plainText } from './mastodon.mjs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const text = 'Daily Dollar #9 is live: what Washington spent in FY2026.\nFirst number: The FBI, $10.7B. Higher or lower?\nhttps://balancethebudget.us/?daily&via=bot-mastodon';
// How a Mastodon server renders that status.
const html = '<p>Daily Dollar #9 is live: what Washington spent in FY2026.<br />First number: The FBI, $10.7B. Higher or lower?<br /><a href="https://balancethebudget.us/?daily&amp;via=bot-mastodon" rel="nofollow noopener" target="_blank"><span class="invisible">https://</span><span class="ellipsis">balancethebudget.us/?daily&amp;v</span><span class="invisible">ia=bot-mastodon</span></a></p>';
ok(plainText(html).replace(/\s+/g, ' ') === text.replace(/\s+/g, ' '), 'the server’s HTML reads back as the text that was posted, link whole');

const calls = [];
const fake = ({ recent = [], canRead = true } = {}) => async (url, init = {}) => {
  calls.push({ url, init });
  const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
  if (init.headers?.Authorization !== 'Bearer tok') return { ok: false, status: 401, text: async () => '{"error":"The access token is invalid"}' };
  if (url.endsWith('/api/v1/accounts/verify_credentials')) return canRead ? j({ id: '42' }) : { ok: false, status: 403, text: async () => '{"error":"This action is outside the authorized scopes"}' };
  if (url.includes('/api/v1/accounts/42/statuses')) return j(recent.map((c) => ({ content: c })));
  if (url.endsWith('/api/v1/statuses')) return j({ id: '111', url: 'https://mastodon.example/@dailydollar/111' });
  return { ok: false, status: 404, text: async () => '' };
};

const m = mastodon({ instance: 'mastodon.example/', token: 'tok', fetchImpl: fake({ recent: [html] }) });
ok(await m.posted(text) === true, 'a text already posted is recognized (so it isn’t posted again)');
const fresh = mastodon({ instance: 'https://mastodon.example', token: 'tok', fetchImpl: fake({ recent: ['<p>Something else</p>'] }) });
ok(await fresh.posted(text) === false, 'a new text isn’t mistaken for a repeat');
calls.length = 0;
const r = await fresh.post(text, 'daily-dollar-2026-11-14-morning');
const sent = calls[0];
const body = JSON.parse(sent.init.body);
ok(sent.url === 'https://mastodon.example/api/v1/statuses' && body.status === text && body.visibility === 'public' && body.language === 'en', 'posts a public status in English, the text as written (server address normalized)');
ok(sent.init.headers['Idempotency-Key'] === 'daily-dollar-2026-11-14-morning' && sent.init.headers.Authorization === 'Bearer tok', 'with the token, and an idempotency key so a retry posts once');
ok(r.web === 'https://mastodon.example/@dailydollar/111', 'returns the post’s web address');
const noRead = mastodon({ instance: 'mastodon.example', token: 'tok', fetchImpl: fake({ canRead: false }) });
ok(await noRead.posted(text) === false, 'a token without read access still posts (the idempotency key guards a retry)');
let err = '';
try { await mastodon({ instance: 'mastodon.example', token: 'wrong', fetchImpl: fake() }).post(text); } catch (e) { err = e.message; }
ok(/\/api\/v1\/statuses: 401/.test(err), 'a wrong token stops with a clear error');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

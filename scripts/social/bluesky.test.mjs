// The Bluesky client against a stand-in (nothing reaches Bluesky): links become clickable at the
// right byte offsets (curly quotes and emoji are several bytes), sign-in, the duplicate check, the
// link card's image, and the post itself.
import { bluesky, linkFacets, postRecord } from './bluesky.mjs';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const enc = new TextEncoder(), dec = new TextDecoder();

const text = 'Yesterday’s Daily Dollar #8 🔥: what CBO’s options would save.\nToday’s #9: https://balancethebudget.us/?daily&via=bot-bluesky';
const f = linkFacets(text);
const bytes = enc.encode(text);
ok(f.length === 1 && dec.decode(bytes.slice(f[0].index.byteStart, f[0].index.byteEnd)) === 'https://balancethebudget.us/?daily&via=bot-bluesky' && f[0].features[0].uri.endsWith('via=bot-bluesky'), 'the link’s facet covers exactly its bytes, after curly quotes and an emoji');
const rec = postRecord(text, null, new Date('2026-11-14T12:30:00Z'));
ok(rec.$type === 'app.bsky.feed.post' && rec.langs[0] === 'en' && rec.createdAt === '2026-11-14T12:30:00.000Z' && !rec.embed, 'a post record: text, facets, English, the time');

// A stand-in Bluesky that records the calls.
const calls = [];
const fake = (recent) => async (url, init) => {
  const m = url.split('/xrpc/')[1].split('?')[0];
  calls.push({ m, init });
  const j = (o) => ({ ok: true, status: 200, text: async () => JSON.stringify(o) });
  if (m === 'com.atproto.server.createSession') return JSON.parse(init.body).password === 'app-pass' ? j({ accessJwt: 'jwt', did: 'did:plc:abc' }) : { ok: false, status: 401, text: async () => '{"error":"AuthenticationRequired"}' };
  if (m === 'com.atproto.repo.listRecords') return j({ records: recent.map((t) => ({ value: { text: t } })) });
  if (m === 'com.atproto.repo.uploadBlob') return j({ blob: { $type: 'blob', ref: { $link: 'bafy' }, mimeType: init.headers['Content-Type'], size: init.body.length } });
  if (m === 'com.atproto.repo.createRecord') return j({ uri: 'at://did:plc:abc/app.bsky.feed.post/3kxyz', cid: 'c' });
  return { ok: false, status: 404, text: async () => '' };
};
const bs = await bluesky({ handle: 'dailydollar.example', password: 'app-pass', fetchImpl: fake(['Daily Dollar #9 is live: …']) });
ok(bs.did === 'did:plc:abc' && JSON.parse(calls[0].init.body).identifier === 'dailydollar.example', 'signs in with the handle and app password');
ok((await bs.recentTexts()).includes('Daily Dollar #9 is live: …') && calls[1].init.headers.Authorization === 'Bearer jwt', 'reads the account’s recent posts (to skip a repeat), signed in');
const blob = await bs.uploadImage(new Uint8Array([1, 2, 3]), 'image/png');
ok(blob.mimeType === 'image/png' && calls[2].init.method === 'POST', 'uploads the link card’s image');
const r = await bs.post(postRecord(text, { $type: 'app.bsky.embed.external', external: { uri: 'https://balancethebudget.us/?daily', title: 't', description: 'd', thumb: blob } }));
const sent = JSON.parse(calls[3].init.body);
ok(sent.repo === 'did:plc:abc' && sent.collection === 'app.bsky.feed.post' && sent.record.facets.length === 1 && sent.record.embed.external.thumb.ref.$link === 'bafy', 'posts the record with its facet and link card');
ok(r.web === 'https://bsky.app/profile/dailydollar.example/post/3kxyz', 'returns the post’s web address: ' + r.web);
let err = '';
try { await bluesky({ handle: 'x', password: 'wrong', fetchImpl: fake([]) }); } catch (e) { err = e.message; }
ok(/createSession: 401/.test(err), 'a wrong app password stops with a clear error, before anything is posted');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

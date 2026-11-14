// A small Bluesky client for the brand account's posts: sign in with an app password, post text
// with its link made clickable (a "facet": Bluesky marks links by their UTF-8 byte range) and a link
// card, and read back recent posts so the same text is never posted twice.
// The fetch function can be swapped for a stand-in, so tests never reach Bluesky.

const enc = new TextEncoder();

/** Each link in the text as a Bluesky link facet, by UTF-8 byte offsets. */
export function linkFacets(text) {
  return [...text.matchAll(/https?:\/\/[^\s]+/g)].map((m) => {
    const byteStart = enc.encode(text.slice(0, m.index)).length;
    return { index: { byteStart, byteEnd: byteStart + enc.encode(m[0]).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] };
  });
}

/** A post record: the text, its link facets, English, and an optional link card. */
export function postRecord(text, embed = null, now = new Date()) {
  return { $type: 'app.bsky.feed.post', text, facets: linkFacets(text), langs: ['en'], createdAt: now.toISOString(), ...(embed ? { embed } : {}) };
}

/** Signs in (app password) and returns what the poster needs. */
export async function bluesky({ handle, password, service = 'https://bsky.social', fetchImpl = fetch }) {
  const call = async (method, { body, token, raw, type } = {}) => {
    const r = await fetchImpl(`${service}/xrpc/${method}`, {
      method: body !== undefined || raw ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(raw ? { 'Content-Type': type } : body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(raw ? { body: raw } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method}: ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };
  const s = await call('com.atproto.server.createSession', { body: { identifier: handle, password } });
  const token = s.accessJwt, did = s.did;
  return {
    did,
    /** The texts of the account's latest posts. */
    async recentTexts(limit = 30) {
      const r = await call(`com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=app.bsky.feed.post&limit=${limit}`, { token });
      return (r.records ?? []).map((x) => x.value?.text ?? '');
    },
    /** Uploads an image for a link card. */
    async uploadImage(bytes, type) { return (await call('com.atproto.repo.uploadBlob', { token, raw: bytes, type })).blob; },
    /** Posts a record; returns its at:// address and its web address. */
    async post(record) {
      const r = await call('com.atproto.repo.createRecord', { token, body: { repo: did, collection: 'app.bsky.feed.post', record } });
      return { uri: r.uri, web: `https://bsky.app/profile/${handle}/post/${r.uri.split('/').pop()}` };
    },
  };
}

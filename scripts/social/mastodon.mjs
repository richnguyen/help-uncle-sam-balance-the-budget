// A small Mastodon client for the brand account's posts: post a status with an access token (the
// server makes the link clickable and fetches its preview card itself), and read back the
// account's recent posts so the same text is never posted twice. The fetch function can be
// swapped for a stand-in, so tests never reach a Mastodon server.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
/** A status's HTML as plain text, the way it was posted (links whole, line breaks as spaces). */
export const plainText = (html) => html
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p>/gi, '\n\n').replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' && e !== '#39' ? String.fromCodePoint(parseInt(e.slice(e[1] === 'x' ? 2 : 1), e[1] === 'x' ? 16 : 10)) : ENT[e.toLowerCase()] ?? m));
const same = (a, b) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();

export function mastodon({ instance, token, fetchImpl = fetch }) {
  const base = instance.replace(/\/+$/, '').replace(/^(?!https?:\/\/)/, 'https://');
  const call = async (path, init = {}) => {
    const r = await fetchImpl(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    const text = await r.text();
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };
  return {
    /** Whether the text is among the account's recent posts (needs read access; false if not allowed). */
    async posted(text) {
      try {
        const me = await call('/api/v1/accounts/verify_credentials');
        const recent = await call(`/api/v1/accounts/${me.id}/statuses?limit=30&exclude_replies=true`);
        return recent.some((s) => same(plainText(s.content ?? ''), text));
      } catch { return false; }
    },
    /** Posts a public status in English. The idempotency key makes a retried request post once. */
    async post(text, idempotencyKey) {
      const r = await call('/api/v1/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
        body: JSON.stringify({ status: text, visibility: 'public', language: 'en' }),
      });
      return { id: r.id, web: r.url };
    },
  };
}

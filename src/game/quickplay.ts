// A Quick play started from somewhere else, such as a feed post: the mission page picks it up
// once, if it opens within a few seconds (so a stale request never starts one later by surprise).
let pending: { id: string; at: number } | null = null;
export const queueQuick = (id: string) => { pending = { id, at: Date.now() }; };
export function takeQuick(id: string) {
  const p = pending;
  if (!p || p.id !== id || Date.now() - p.at > 10000) return false;
  pending = null;
  return true;
}

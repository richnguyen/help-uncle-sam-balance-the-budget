const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://localhost:5173/#sources'); await p.waitForTimeout(500);
  const r = await p.evaluate(async () => {
    const S = await import('/src/game/script.ts'); const V = await import('/src/game/voice.tsx');
    const M = (await import('/src/data/generated/voice.json')).default;
    const lines = [...Object.values(S.PEOPLES_LINES), ...Object.values(S.ROOM_LINES), ...Object.values(S.CHAIN_LINES), ...Object.values(S.REACT), ...Object.values(S.PLAN_LINES), ...Object.values(S.CHALLENGE_LINES), ...Object.values(S.STORY_LINES), S.DAILY_LINES.intro, S.DAILY_LINES.done, ...S.DAILY_LINES.score];
    const missing = lines.flatMap((t) => V.toSentences(t)).filter((s) => !M[V.keyOf(s)]);
    return { checked: lines.length, missing };
  });
  console.log('lines checked:', r.checked, '| sentences without a recording:', r.missing.length ? r.missing : 'none');
  await b.close();
})();

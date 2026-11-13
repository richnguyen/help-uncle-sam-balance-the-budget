// Shared helpers for tests: move through a mission's steps, and play its game's rounds.
// A round is played "as is": sorts go to the first group, sliders and splits are locked where they
// stand, quick-fire picks take the first option, orders are checked as shown, and bonus questions
// take the first choice until one sticks.
const playRound = async (p, tap) => {
  const act = (l) => (tap ? l.tap() : l.click());
  const round = p.locator('.game-round');
  if (!(await round.count()) || await p.locator('.game-banner').count()) return false;
  for (let t = 0; t < 12 && await p.locator('.sort-tray .sort-chip').count(); t++) { await act(p.locator('.sort-tray .sort-chip').first()); await p.waitForTimeout(60); await act(p.locator('.sort-bin-head').first()); await p.waitForTimeout(100); }
  for (let t = 0; t < 12 && await p.locator('.pairs-pick:not([disabled])').count(); t++) { await act(p.locator('.pairs-pick:not([disabled])').first()); await p.waitForTimeout(120); if (await p.locator('.pairs-next').count()) await act(p.locator('.pairs-next')); await p.waitForTimeout(120); }
  for (let t = 0; t < 10 && await p.locator('.tank-chip:not([disabled])').count(); t++) { await act(p.locator('.tank-chip:not([disabled])').first()); await p.waitForTimeout(100); }
  // Memory: try each "who" against each "what" until it matches.
  if (await p.locator('.mem-card').count()) {
    for (let w = 0; w < 8; w++) for (let x = 0; x < 8; x++) {
      if (await p.locator('.game-banner').count()) break;
      const who = p.locator('.mem-grid[data-side="who"] .mem-card').nth(w); if (await who.isDisabled()) break;
      const what = p.locator('.mem-grid[data-side="what"] .mem-card').nth(x); if (await what.isDisabled()) continue;
      await act(who); await act(what); await p.waitForTimeout(120);
      if (await who.isDisabled()) break; await p.waitForTimeout(1150);
    }
  }
  // Referee: let every bill through; the agency's year: fund everything; PAYGO: end as it stands.
  for (let t = 0; t < 14 && await p.locator('.ref-call').count(); t++) { await act(p.locator('.ref-call[data-call="pass"]')); await p.waitForTimeout(120); if (await p.locator('.pairs-next').count()) await act(p.locator('.pairs-next')); await p.waitForTimeout(120); }
  for (let t = 0; t < 14 && await p.locator('.ap-pick').count(); t++) { await act(p.locator('.ap-pick[data-pick="yes"]')); await p.waitForTimeout(100); }
  if (await p.locator('.game-round .estimate-lock:not([disabled])').count()) await act(p.locator('.game-round .estimate-lock').first());
  for (let t = 0; t < 3 && await p.locator('.game-round .quiz-choice:not([disabled])').count() && !(await p.locator('.game-banner').count()); t++) { await act(p.locator('.game-round .quiz-choice:not([disabled])').first()); await p.waitForTimeout(200); }
  await p.waitForTimeout(250);
  return true;
};
/** Play rounds until the one named `label` is up (or the game ends). */
const toRound = async (p, label, tap) => {
  for (let k = 0; k < 8; k++) {
    const l = await p.locator('.game-round-label').textContent().catch(() => '');
    if (l.includes(label) && !(await p.locator('.game-banner').count())) return true;
    if (!(await p.locator('.game-banner').count())) await playRound(p, tap);
    const next = p.locator('.game-next');
    if (!(await next.count())) return false;
    await (tap ? next.tap() : next.click()); await p.waitForTimeout(350);
  }
  return false;
};
/** Play the whole game through. */
const playGame = async (p, tap) => {
  for (let k = 0; k < 8 && await p.locator('.game-round').count() && !(await p.locator('.game-over').count()); k++) {
    await playRound(p, tap);
    const next = p.locator('.game-next');
    if (await next.count()) { await (tap ? next.tap() : next.click()); await p.waitForTimeout(350); }
  }
  return p.locator('.game-over').count();
};
/** Answer whatever blocks Continue: a game, a sort, a slider or a pick. */
const answerAny = async (p, tap) => {
  if (await p.locator('.mgame').count() && !(await p.locator('.game-over').count())) { await playGame(p, tap); return true; }
  const act = (l) => (tap ? l.tap() : l.click());
  for (let k = 0; k < 10 && await p.locator('.sort-tray .sort-chip').count(); k++) { await act(p.locator('.sort-tray .sort-chip').first()); await p.waitForTimeout(80); await act(p.locator('.sort-bin-head').first()); await p.waitForTimeout(150); }
  if (await p.locator('.estimate-lock:not([disabled])').count()) { await act(p.locator('.estimate-lock').first()); await p.waitForTimeout(300); return true; }
  const c = p.locator('.quiz-choice:not([disabled])');
  if (await c.count()) { await act(c.first()); await p.waitForTimeout(250); return true; }
  return false;
};
/** Go forward to the step whose label includes `label`, playing anything in the way. */
const toStep = async (p, label, tap) => {
  const prim = p.locator('.level-nav .btn-primary');
  for (let k = 0; k < 12; k++) {
    if ((await p.locator('#step-label').textContent()).includes(label)) return true;
    if (!(await prim.isEnabled())) await answerAny(p, tap);
    await (tap ? prim.tap() : prim.click()); await p.waitForTimeout(450);
  }
  return false;
};
/** Play a mission from its first step to the celebration. */
const playLevel = async (p, tap) => {
  const prim = p.locator('.level-nav .btn-primary');
  for (let k = 0; k < 30 && !(await p.locator('.celebrate').count()); k++) {
    if (!(await prim.isEnabled())) { await answerAny(p, tap); continue; }
    await (tap ? prim.tap() : prim.click()); await p.waitForTimeout(300);
  }
};
module.exports = { playRound, toRound, playGame, answerAny, toStep, playLevel };

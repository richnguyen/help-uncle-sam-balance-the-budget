// Meets a budget-desk goal without any hint: the biggest cards first, then across-the-board tax increases if the cards run out.
module.exports = async function winByHand(p, { tap = false, maxCards = 25 } = {}) {
  const done = async () => /complete|met/i.test((await p.locator('.sb-big').first().textContent()) || '');
  for (let k = 0; k < maxCards && !(await done()); k++) {
    const add = p.locator('.pcard-add:not(.on)').first();
    if (!(await add.count())) break;
    // Centre the card first: the scoreboard is pinned at the top and would cover a card scrolled just under it.
    await add.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(60);
    if (tap) await add.tap(); else await add.click();
    await p.waitForTimeout(120);
  }
  const s = p.locator('#lv-revenues');
  for (let k = 0; k < 60 && !(await done()) && (await s.count()); k++) { await s.press('ArrowRight'); await p.waitForTimeout(40); }
  await p.waitForTimeout(600);
  return done();
};

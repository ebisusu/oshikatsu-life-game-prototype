import { expect, test } from '@playwright/test';

async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('start-game').click();
}

test('audit: modal owns keyboard focus and traps Tab', async ({ page }) => {
  await start(page);
  const modal = page.getByTestId('tutorial');
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
  const buttons = modal.getByRole('button');
  await buttons.last().focus();
  await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.last()).toBeFocused();
});

test('audit: another tab cannot overwrite newer progress or resurrect a reset', async ({ page, context }) => {
  await start(page);
  await page.getByTestId('tutorial-skip').click();
  const second = await context.newPage();
  await second.goto('/');
  await page.getByTestId('act-work').click();
  await expect(second.getByTestId('st-money')).toContainText('82,000', { timeout: 2000 });
  await second.getByTestId('act-work').click();
  await expect(page.getByTestId('st-money')).toContainText('104,000');
  await page.getByTestId('tab-help').click();
  await page.getByTestId('reset-btn').click();
  await page.getByTestId('reset-yes').click();
  await expect(second.getByTestId('start-game')).toBeVisible();
  await second.reload();
  await expect(second.getByTestId('start-game')).toBeVisible();
});

test('audit: malformed structured LIVE save falls back without a React crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await page.getByTestId('tutorial-skip').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('end-week').click();
  await page.getByTestId('tab-live').click();
  await page.getByTestId('join-free').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  await page.evaluate(() => {
    const key = 'oshikatsu-jinsei-game:save';
    const env = JSON.parse(localStorage.getItem(key)!);
    delete env.state.live.player.song;
    localStorage.setItem(key, JSON.stringify(env));
  });
  await page.reload();
  await expect(page.getByTestId('save-notice')).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId('start-game')).toBeVisible();
  expect(errors).toEqual([]);
});

test('audit: all screens fit and enabled controls can be reached', async ({ page }, info) => {
  await start(page);
  await page.getByTestId('tutorial-skip').click();
  for (const tab of ['home', 'map', 'collection', 'deck', 'live', 'trophy', 'help']) {
    await page.getByTestId(`tab-${tab}`).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), tab).toBeLessThanOrEqual(1);
    if (tab === 'help') await expect(page.locator('.doc')).toContainText('熱量×0.5＋一体感×0.3＋思い出×0.2');
    const buttons = page.locator('.content button, .content [role="button"]');
    for (let i = 0; i < await buttons.count(); i++) {
      const b = buttons.nth(i);
      if (await b.isVisible() && await b.isEnabled()) await b.click({ trial: true, timeout: 4000 });
    }
    await page.evaluate(() => scrollTo(0, 0));
    if (tab === 'map' || tab === 'deck') await page.screenshot({ path: `docs/screenshots/codex-${info.project.name}-${tab}.png`, fullPage: false });
  }
});

test('audit: rapid actions preserve AP and money, names/log text cannot inject HTML', async ({ page }) => {
  await start(page);
  await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('act-work').dblclick();
  await expect(page.getByTestId('st-money')).toContainText('104,000');
  await expect(page.getByTestId('act-work')).toBeDisabled();
  await expect(page.getByTestId('st-ap')).toHaveAttribute('aria-label', 'AP 0/4');
  await page.evaluate(() => {
    const key = 'oshikatsu-jinsei-game:save';
    const env = JSON.parse(localStorage.getItem(key)!);
    env.state.log.push('<img src=x onerror="window.INJECTED=1">');
    localStorage.setItem(key, JSON.stringify(env));
  });
  await page.reload();
  await expect(page.getByTestId('home-log')).toContainText('<img src=x');
  expect(await page.evaluate(() => (window as any).INJECTED)).toBeUndefined();
  expect(await page.locator('#root img').count()).toBe(0);
});

test('audit: production build runs at a GitHub Pages style subpath on a plain static server', async ({ page }) => {
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { resolve, extname, sep } = await import('node:path');
  const root = resolve('dist');
  const prefix = '/oshikatsu-life/';
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname);
      if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
      const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const content = await readFile(file);
      const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(content);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  try {
    const address = server.address() as import('node:net').AddressInfo;
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`http://127.0.0.1:${address.port}${prefix}`);
    await page.getByTestId('start-game').click();
    await page.getByTestId('tutorial-skip').click();
    for (let i = 0; i < 3; i++) await page.getByTestId('end-week').click();
    await page.getByTestId('tab-live').click();
    await page.getByTestId('join-free').click();
    await expect(page.getByTestId('battle')).toBeVisible();
    await page.getByTestId('end-phase').click();
    await page.reload();
    await expect(page.getByTestId('phase-pill')).toContainText('後半');
    for (let i = 0; i < 7; i++) await page.getByTestId('end-phase').click();
    await expect(page.getByTestId('live-result')).toBeVisible();
    await page.getByTestId('claim-reward').click();
    await page.getByTestId('choice-card').first().click();
    await page.getByTestId('tab-home').click();
    await page.getByTestId('end-week').click();
    await page.reload();
    await expect(page.getByTestId('st-week')).toContainText('第5');
    expect(errors).toEqual([]);
  } finally { await new Promise<void>((done, reject) => server.close(err => err ? reject(err) : done())); }
});

test('audit: an explored reward can be equipped, saved, reloaded and brought to LIVE', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('oshi-box').click();
  await page.getByText('詳細設定').click();
  await page.getByTestId('seed-input').fill('codex-reward');
  await page.getByTestId('start-game').click();
  await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('tab-map').click();
  await page.locator('[data-testid^="explore-"]:not([disabled])').first().click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('oshikatsu-jinsei-game:save')!).state);
  const reward = before.pending.options.find((id: string) => before.deck.filter((d: string) => d === id).length < 2);
  expect(reward).toBeTruthy();
  const idx = before.pending.options.indexOf(reward);
  await page.getByTestId('choice-card').nth(idx).click();
  await page.getByTestId('tab-deck').click();
  const oldCount = before.deck.filter((id: string) => id === reward).length;
  const remove = before.deck.find((id: string) => id !== reward);
  await page.getByTestId(`rm-${remove}`).click();
  await page.getByTestId(`add-${reward}`).click();
  await page.getByTestId('deck-save').click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oshikatsu-jinsei-game:save')!).state);
  expect(saved.deck.filter((id: string) => id === reward).length).toBe(oldCount + 1);
  expect(saved.collection[reward]).toBe((before.collection[reward] ?? 0) + 1);
  for (let i = 0; i < 3; i++) await page.getByTestId('end-week').click();
  await page.getByTestId('tab-live').click();
  await page.getByTestId('join-free').click();
  const zones = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('oshikatsu-jinsei-game:save')!).state.live.player;
    return [...s.deck, ...s.hand, ...s.discard];
  });
  expect(zones.filter(id => id === reward).length).toBe(oldCount + 1);
});



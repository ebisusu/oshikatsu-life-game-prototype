import { expect, test, type Page } from '@playwright/test';

// スマホ幅(390x844)で、セットアップ→12週→3公演→最終リザルト、保存復元、リセットまでを実UI操作で通す。

async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, '横スクロールが発生していない').toBeLessThanOrEqual(1);
}

async function pickIfChoice(page: Page) {
  const modal = page.getByTestId('choice-modal');
  if (await modal.isVisible().catch(() => false)) {
    await page.getByTestId('choice-card').first().click();
    await expect(modal).toBeHidden();
  }
}

async function playLive(page: Page, label: string) {
  await page.getByTestId('tab-live').click();
  const join = page.getByTestId('join-onsite');
  const stream = page.getByTestId('join-stream');
  if (await join.isEnabled().catch(() => false)) await join.click();
  else if (await stream.isEnabled().catch(() => false)) await stream.click();
  else await page.getByTestId('join-free').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oshikatsu-jinsei-game:save')!).state);
  await page.reload();
  await expect(page.getByTestId('battle')).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('oshikatsu-jinsei-game:save')!).state);
  expect(restored.live).toEqual(saved.live);
  expect(restored.rng).toEqual(saved.rng);
  await page.evaluate(() => scrollTo(0, 0));
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: 'docs/screenshots/codex-' + label + '-battle.png' });
  let combos = 0;
  for (let guard = 0; guard < 200; guard++) {
    if (await page.getByTestId('live-result').isVisible().catch(() => false)) break;
    await expectNoHorizontalScroll(page);
    const hand = page.getByTestId('hand').locator('button.card');
    const n = await hand.count();
    let played = false;
    for (let i = 0; i < n; i++) {
      const card = hand.nth(i);
      if ((await card.getAttribute('class'))?.includes('blocked')) continue;
      await card.click();
      if (guard === 0) await page.screenshot({ path: 'docs/screenshots/codex-' + label + '-hand.png' });
      const btn = page.getByTestId('play-card');
      if (await btn.isEnabled()) {
        await btn.click();
        played = true;
        break;
      }
    }
    if (!played) await page.getByTestId('end-phase').click();
    if (await page.getByText('コンボ「').first().isVisible().catch(() => false)) combos++;
  }
  await expect(page.getByTestId('live-result')).toBeVisible();
  await expect(page.getByTestId('live-verdict')).toBeVisible();
  await page.getByTestId('claim-reward').click();
  await expect(page.getByTestId('choice-modal')).toBeVisible();
  await page.getByTestId('choice-card').first().click();
  void combos;
}

test('スマホ幅で12週を完走できる', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('推し活');
  await expectNoHorizontalScroll(page);

  // セットアップ：単推し(メンバーC)・福岡・固定シード
  await page.getByTestId('oshi-solo').click();
  await page.getByTestId('member-C').click();
  await page.getByTestId('city-select').selectOption('fukuoka');
  await page.getByText('詳細設定').click();
  await page.getByTestId('seed-input').fill('smoke-2026');
  await page.getByTestId('start-game').click();

  // チュートリアル
  await expect(page.getByTestId('tutorial')).toBeVisible();
  await page.getByTestId('tutorial-next').click();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('st-week')).toContainText('第1');
  await expect(page.getByTestId('st-money')).toContainText('60,000');
  await expectNoHorizontalScroll(page);

  // 週1: 仕事 → マップで探索 → カード獲得 → デッキ画面で差分確認
  await page.getByTestId('act-work').click();
  await expect(page.getByTestId('st-money')).toContainText('82,000');
  await page.getByTestId('tab-map').click();
  await expectNoHorizontalScroll(page);
  await page.locator('[data-testid^="explore-fukuoka"]').first().click();
  await expect(page.getByTestId('choice-modal')).toBeVisible();
  await page.getByTestId('choice-card').first().click();
  await page.getByTestId('tab-deck').click();
  await expect(page.getByTestId('deck-count')).toContainText('20/20');
  await expectNoHorizontalScroll(page);
  // 1枚外すと保存不可になり、自動調整で戻る
  await page.locator('[data-testid^="rm-"]:not([disabled])').first().click();
  await expect(page.getByTestId('deck-count')).toContainText('19/20');
  await expect(page.getByTestId('deck-save')).toBeDisabled();
  await page.getByTestId('deck-auto').click();
  await expect(page.getByTestId('deck-count')).toContainText('20/20');

  // 保存の復元：リロードしても週1・資金が残る
  await page.reload();
  await expect(page.getByTestId('st-week')).toContainText('第1');
  await expect(page.getByTestId('st-money')).not.toContainText('60,000');
  await page.getByTestId('tab-home').click();

  // 週1〜12
  for (let week = 1; week <= 12; week++) {
    await expect(page.getByTestId('st-week')).toContainText(`第${week}`);
    await page.getByTestId('tab-home').click();
    await pickIfChoice(page);
    if (week === 4 || week === 8 || week === 12) {
      await playLive(page, info.project.name + '-week' + week);
      await page.getByTestId('tab-home').click();
    } else if (week % 3 === 2) {
      // 探索を1回挟む（現在地のスポットが残っていれば）
      await page.getByTestId('tab-map').click();
      const ex = page.locator('[data-testid^="explore-"]:not([disabled])').first();
      if (await ex.count()) {
        await ex.click();
        await pickIfChoice(page);
      }
      await page.getByTestId('tab-home').click();
    }
    const work = page.getByTestId('act-work');
    if (week % 2 === 0 && (await work.isEnabled())) await work.click();
    await page.getByTestId('end-week').click();
    const confirm = page.getByTestId('confirm-end-yes');
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    // 週開始アイキャッチ（最終週の終了時は出ない）
    if (week < 12) {
      await expect(page.getByTestId('week-intro')).toBeVisible();
      await page.getByTestId('week-intro-start').click();
      await expect(page.getByTestId('week-intro')).toBeHidden();
    } else {
      await expect(page.getByTestId('week-intro')).toHaveCount(0);
    }
    await pickIfChoice(page);
  }

  // 最終リザルト
  await expect(page.getByTestId('final-result')).toBeVisible();
  await expect(page.getByTestId('final-rank')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/codex-' + info.project.name + '-final.png', fullPage: true });
  await page.getByTestId('tab-trophy').click();
  await expect(page.getByTestId('trophy-finish')).toHaveClass(/on/);
  await expect(page.getByTestId('trophy-dome5')).toHaveClass(/locked/);
  await expectNoHorizontalScroll(page);

  // リセット
  await page.getByTestId('tab-help').click();
  await page.getByTestId('reset-btn').click();
  await page.getByTestId('reset-yes').click();
  await expect(page.getByTestId('start-game')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('start-game')).toBeVisible();

  expect(errors, `ブラウザエラー: ${errors.join('\n')}`).toEqual([]);
});

test('壊れたセーブデータでも新規開始できる', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('oshikatsu-jinsei-game:save', '{broken json');
  });
  await page.goto('/');
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('st-week')).toContainText('第1');
});

test('PC幅でも崩れず表示できる', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByTestId('start-game').click();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('st-week')).toContainText('第1');
  await page.getByTestId('tab-collection').click();
  await expect(page.getByTestId('owned-count')).toBeVisible();
  await expectNoHorizontalScroll(page);
});





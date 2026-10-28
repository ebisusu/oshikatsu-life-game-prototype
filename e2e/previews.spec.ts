import { expect, test, type Page } from '@playwright/test';
import { applyAction, CARDS, newGame, serialize, SAVE_KEY, type Action, type GameState } from '../src/game';

// v0.2 のスマホ実画面スクリーンショットを docs/v02-previews に保存する（実際のゲーム状態を作って撮影）。
// 実行: npx playwright test e2e/previews.spec.ts --project=mobile
const OUT = 'docs/v02-previews';

function step(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`${a.type}: ${r.reason}`);
  return r.state;
}
function pickFirst(s: GameState): GameState {
  return s.pending ? step(s, { type: 'pickCard', cardId: s.pending.options[0]! }) : s;
}

/** 第3週：仕事・訓練・移動・探索を済ませた途中経過。高レアの所持カードも付ける。 */
function midGame(): GameState {
  let s = newGame({ oshi: 'solo', member: 'C', city: 'tokyo', seed: 'v02-preview', name: 'あなた' });
  s = step(s, { type: 'work' });
  s = step(s, { type: 'train', skill: 'h' });
  s = step(s, { type: 'move', to: 'nagoya' });
  s = step(s, { type: 'endWeek' });
  s = step(s, { type: 'endWeek' });
  s = step(s, { type: 'move', to: 'kyoto' });
  s = step(s, { type: 'explore', spotId: 'kyoto-1' });
  s = pickFirst(s);
  const rich = structuredClone(s);
  for (const c of CARDS) if (['SR', 'SSR', 'UR', 'R'].includes(c.rarity)) rich.collection[c.id] = Math.max(rich.collection[c.id] ?? 0, 1);
  for (const c of CARDS.filter((x) => x.rarity === 'N').slice(0, 4)) rich.collection[c.id] = Math.max(rich.collection[c.id] ?? 0, 2);
  rich.newCards = CARDS.filter((c) => c.rarity === 'SSR' || c.rarity === 'UR').map((c) => c.id).slice(0, 2);
  return rich;
}

async function load(page: Page, s: GameState) {
  await page.addInitScript(([key, raw]) => {
    if (!sessionStorage.getItem('v02-seeded')) { localStorage.setItem(key as string, raw as string); sessionStorage.setItem('v02-seeded', '1'); }
    localStorage.setItem('oshikatsu-jinsei-game:tutorial-seen', '1');
  }, [SAVE_KEY, serialize(s)] as const);
  await page.goto('/');
  await expect(page.getByTestId('st-week')).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

test.describe('v0.2 スマホ実画面スクリーンショット', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'mobile', 'スマホのみ'); });

  test('ホーム／マップ／デッキ／トロフィー／収集', async ({ page }) => {
    await load(page, midGame());
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/01-home.png` });
    await page.screenshot({ path: `${OUT}/01-home-full.png`, fullPage: true });

    await page.getByTestId('tab-map').click();
    await page.getByTestId('city-osaka').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/02-map.png` });
    await page.screenshot({ path: `${OUT}/02-map-full.png`, fullPage: true });
    // 移動して到着スタンプ
    await page.getByTestId('move-btn').click();
    await expect(page.getByTestId('arrival-stamp')).toBeVisible();
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT}/03-map-arrival.png` });

    await page.getByTestId('tab-deck').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/04-deck.png` });
    await page.getByTestId('tab-collection').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/05-collection-rarity.png` });
    await page.getByTestId('tab-trophy').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/06-trophies.png` });
  });

  test('ライブ対戦中（カード使用の演出・コンボ・CPU行動）', async ({ page }) => {
    let s = midGame();
    s = pickFirst(s);
    s = step(s, { type: 'endWeek' });
    s = { ...s };
    expect(s.week).toBe(4);
    s = step(s, { type: 'startLive', mode: 'free' });
    await load(page, s);
    await page.getByTestId('tab-live').click();
    await expect(page.getByTestId('battle')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/07-live-start.png` });
    // 使えるカードを1枚ずつ使って演出を撮る
    const hand = page.getByTestId('hand').locator('button.card');
    for (let i = 0; i < await hand.count(); i++) {
      const card = hand.nth(i);
      if ((await card.getAttribute('class'))?.includes('blocked')) continue;
      await card.click();
      if (await page.getByTestId('play-card').isEnabled()) {
        await page.getByTestId('play-card').click();
        break;
      }
    }
    await expect(page.getByTestId('live-fx-play')).toBeVisible();
    await page.waitForTimeout(550);
    await page.screenshot({ path: `${OUT}/08-live-play-fx.png` });
    await page.waitForTimeout(2600);
    await page.getByTestId('end-phase').click();
    await expect(page.getByTestId('live-fx-cpu')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/09-live-cpu-fx.png` });
    await page.waitForTimeout(3000);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${OUT}/10-live-battle-full.png`, fullPage: true });
  });

  test('週開始アイキャッチ／セットアップ', async ({ page }) => {
    await load(page, midGame());
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/11-week-intro.png` });
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByTestId('start-game')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/12-setup.png` });
  });
});

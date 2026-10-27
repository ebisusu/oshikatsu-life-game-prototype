import { expect, test, type Page } from '@playwright/test';
import { CARDS } from '../src/game/data/cards';

// iPhone 実機での「右が切れる」再発防止。
//  - 幅 320/375/390/430px × 文字サイズ 100/125/150/200%（ルート font-size で再現）
//  - documentElement.scrollWidth だけでなく、ボタン/入力と全テキストの getBoundingClientRect が viewport 内かを検証
//  - 週開始アイキャッチの表示・内容・閉じ方・ライブ見送り・最終週・リロード

const SAVE_KEY = 'oshikatsu-jinsei-game:save';
const WIDTHS = [320, 375, 390, 430];
const ZOOMS = [100, 125, 150, 200];

test.describe('独立監査: セットアップと確認画面', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'mobile', '幅をテスト内で指定'); });
  for (const width of WIDTHS) {
    test(`開始前の全操作が ${width}px の文字拡大でも収まる`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await disableWrapSafetyNet(page);
      await page.goto('/');
      await page.getByText('詳細設定').click();
      for (const zoom of ZOOMS) {
        await setZoom(page, zoom);
        await expectFits(page, `${width}px/${zoom}% セットアップ`);
      }
    });
  }
});

interface Offender { what: string; left: number; right: number; text: string }

/** viewport 外にはみ出している操作要素とテキストを列挙する（空配列が正常）。 */
async function findOverflow(page: Page): Promise<{ scrollOver: number; offenders: Offender[] }> {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const out: { what: string; left: number; right: number; text: string }[] = [];
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      for (let p: Element | null = el; p; p = p.parentElement) if (getComputedStyle(p).display === 'none') return false;
      return true;
    };
    const desc = (el: Element) => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''}.${String((el as HTMLElement).className || '').toString().split(' ')[0]}`;
    const check = (what: string, el: Element, r: { left: number; right: number; width: number; height: number }, text: string) => {
      if (r.width === 0 && r.height === 0) return;
      if (r.left < -1 || r.right > vw + 1) out.push({ what: `${what} ${desc(el)}`, left: Math.round(r.left), right: Math.round(r.right), text: text.slice(0, 40) });
    };
    for (const el of Array.from(document.querySelectorAll('button, input, select, textarea, a[href], summary, [role="button"]'))) {
      if (!visible(el)) continue;
      check('control', el, el.getBoundingClientRect(), (el.textContent || el.getAttribute('aria-label') || '').trim());
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      if (!text.trim()) continue;
      const el = n.parentElement;
      if (!el || !visible(el) || el.closest('script, style, noscript')) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) check('text', el, r, text.trim());
    }
    return { scrollOver: document.documentElement.scrollWidth - vw, offenders: out };
  });
}

async function expectFits(page: Page, label: string) {
  const { scrollOver, offenders } = await findOverflow(page);
  expect(offenders, `${label}: viewport外の要素\n${JSON.stringify(offenders, null, 1)}`).toEqual([]);
  expect(scrollOver, `${label}: 横スクロール量`).toBeLessThanOrEqual(1);
}

async function setZoom(page: Page, percent: number) {
  await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, percent);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** 新規開始 → 所持カードを増やした保存を作ってリロード（デッキ行を多く・多様にする） */
/**
 * overflow-wrap:anywhere に頼らず収まることを検証する。iOS 15.4 未満の Safari はこの指定を無視するため、
 * 検証中は打ち消して「構造だけで」折り返し/縮小できているかを見る。
 */
async function disableWrapSafetyNet(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '*, *::before, *::after { overflow-wrap: normal !important; word-break: normal !important; }';
      document.head.appendChild(st);
    });
  });
}

async function startRichGame(page: Page, opts: { money?: number; assets?: string[] } = {}) {
  await disableWrapSafetyNet(page);
  await page.goto('/');
  await page.getByTestId('oshi-solo').click();
  await page.getByTestId('member-C').click();
  await page.getByText('詳細設定').click();
  await page.getByTestId('seed-input').fill('layout-2026');
  await page.getByTestId('start-game').click();
  await page.getByTestId('tutorial-skip').click();
  await page.evaluate(([key, money, assets, ids]) => {
    const env = JSON.parse(localStorage.getItem(key as string)!);
    env.state.money = money;
    env.state.assets = assets;
    env.state.log.push('第1週 とても長いログ文章のテストです。'.repeat(3));
    // 全カードを2枚所持にして、デッキ画面を最大構成にする（デッキ自体は変えない）
    for (const id of ids as string[]) env.state.collection[id] = Math.max(env.state.collection[id] ?? 0, 2);
    localStorage.setItem(key as string, JSON.stringify(env));
  }, [SAVE_KEY, opts.money ?? 49_612_345, opts.assets ?? ['a1', 'a5'], CARDS.map((c) => c.id)] as const);
  await page.reload();
  await expect(page.getByTestId('st-week')).toContainText('第1');
}

async function goTab(page: Page, tab: string) {
  await page.getByTestId(`tab-${tab}`).click();
  await page.evaluate(() => scrollTo(0, 0));
}

test.describe('スマホ幅 × 文字拡大の横切れ回帰', () => {
  // 幅は各テストで明示するため、mobile プロジェクトだけで実行する
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'mobile', 'viewport はテスト内で指定'); });
  for (const width of WIDTHS) {
    test(`全タブとモーダルが ${width}px で 100〜200% 文字でも収まる`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 800 });
      await startRichGame(page);
      // 所持カードを増やすため、探索報酬の代わりに全カードを手元に（上でcollectionを拡張済み）。
      for (const zoom of ZOOMS) {
        await setZoom(page, zoom);
        for (const tab of ['home', 'map', 'collection', 'deck', 'live', 'trophy', 'help']) {
          await goTab(page, tab);
          if ((width === 320 && zoom === 150) || (tab === 'deck' && (zoom === 125 || zoom === 150))) {
            await page.screenshot({ path: test.info().outputPath(tab + '-' + width + '-' + zoom + '.png') });
          }
          await expectFits(page, `${width}px/${zoom}% タブ ${tab}`);
        }
        // デッキ画面：ヘッダー・上限表示・ミニバー・各行の −/＋ が画面内にあり、押せる
        await goTab(page, 'deck');
        await expect(page.getByTestId('deck-minibar')).toBeVisible();
        const rows = page.locator('[data-testid^="deckrow-"]');
        const count = await rows.count();
        expect(count).toBeGreaterThan(5);
        for (const i of [0, Math.floor(count / 2), count - 1]) {
          const row = rows.nth(i);
          await row.scrollIntoViewIfNeeded();
          for (const btn of await row.locator('.stepper button').all()) {
            const box = (await btn.boundingBox())!;
            expect(box.x, `${width}px/${zoom}% ステッパー左`).toBeGreaterThanOrEqual(-1);
            expect(box.x + box.width, `${width}px/${zoom}% ステッパー右`).toBeLessThanOrEqual(width + 1);
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(box.height).toBeGreaterThanOrEqual(44);
          }
        }
        await expectFits(page, `${width}px/${zoom}% デッキ全体`);
        // ヘッダー（週/AP/所持金）が全て見える
        for (const id of ['st-week', 'st-ap', 'st-money', 'st-stamina']) {
          const box = (await page.getByTestId(id).boundingBox())!;
          expect(box.x, `${id} left`).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width, `${width}px/${zoom}% ${id} right`).toBeLessThanOrEqual(width + 1);
        }
        await expect(page.getByTestId('st-money')).toContainText('49,612,345');
        // 固定タブバーのボタンも全て画面内
        for (const tab of ['home', 'map', 'collection', 'deck', 'live', 'trophy', 'help']) {
          const box = (await page.getByTestId(`tab-${tab}`).boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(-1);
          expect(box.x + box.width, `${width}px/${zoom}% タブ ${tab}`).toBeLessThanOrEqual(width + 1);
        }
      }
      await setZoom(page, 100);
    });

    test(`カード選択・遊び方・不参加確認・週開始アイキャッチが ${width}px の文字拡大でも収まる`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width, height: 800 });
      await startRichGame(page, { money: 123_456 });
      for (const zoom of ZOOMS) {
        await page.evaluate((key) => {
          const env = JSON.parse(localStorage.getItem(key)!);
          env.state.week = 4;
          env.state.ap = 4;
          env.state.concerts.live1 = { status: 'pending' };
          env.state.visitedSpots = [];
          localStorage.setItem(key, JSON.stringify(env));
        }, SAVE_KEY);
        await page.reload();
        await setZoom(page, zoom);
        await goTab(page, 'map');
        await page.locator('[data-testid^="explore-"]:not([disabled])').first().click();
        await expect(page.getByTestId('choice-modal')).toBeVisible();
        await expectFits(page, `${width}px/${zoom}% カード選択`);
        await page.getByTestId('choice-card').first().click();
        await goTab(page, 'help');
        await page.getByTestId('open-tutorial').click();
        await expect(page.getByTestId('tutorial')).toBeVisible();
        await expectFits(page, `${width}px/${zoom}% チュートリアル`);
        await page.getByTestId('tutorial-skip').click();
        // 週開始アイキャッチ
        await goTab(page, 'home');
        await page.getByTestId('end-week').click();
        await expect(page.getByTestId('confirm-end')).toBeVisible();
        await expectFits(page, `${width}px/${zoom}% 不参加確認`);
        await page.getByTestId('confirm-end-yes').click();
        const intro = page.getByTestId('week-intro');
        await expect(intro).toBeVisible();
        await expect(intro).toHaveCount(1);
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expectFits(page, `${width}px/${zoom}% 週開始アイキャッチ`);
        if (zoom === 125 || zoom === 150) {
          await page.screenshot({ path: test.info().outputPath(`intro-${width}-${zoom}.png`) });
        }
        const start = page.getByTestId('week-intro-start');
        await start.scrollIntoViewIfNeeded();
        const sb = (await start.boundingBox())!;
        expect(sb.x).toBeGreaterThanOrEqual(-1);
        expect(sb.x + sb.width).toBeLessThanOrEqual(width + 1);
        await start.click();
        await expect(intro).toBeHidden();
      }
      await setZoom(page, 100);
    });
  }

  test('探索のカード選択モーダルが 320px/200% でも収まる', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await startRichGame(page);
    await setZoom(page, 200);
    await goTab(page, 'map');
    await page.locator('[data-testid^="explore-"]:not([disabled])').first().click();
    await expect(page.getByTestId('choice-modal')).toBeVisible();
    await expectFits(page, '320px/200% カード選択');
    await page.getByTestId('choice-card').first().click();
    await expect(page.getByTestId('choice-modal')).toBeHidden();
  });

  test('ライブ画面（バトル中）が 320px/150% でも収まる', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await startRichGame(page);
    // 第4週（公演週）まで進める
    for (let i = 0; i < 3; i++) {
      await goTab(page, 'home');
      await page.getByTestId('end-week').click();
      await page.getByTestId('week-intro-start').click();
    }
    await goTab(page, 'live');
    await page.getByTestId('join-free').click();
    await expect(page.getByTestId('battle')).toBeVisible();
    for (const zoom of [100, 150]) {
      await setZoom(page, zoom);
      await page.evaluate(() => scrollTo(0, 0));
      await expectFits(page, `320px/${zoom}% ライブ`);
    }
    await page.getByTestId('end-phase').click();
    await expectFits(page, '320px/150% ライブ後半');
  });

  test('最終リザルトが 320px/200% でも収まる', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await startRichGame(page);
    await page.evaluate((key) => {
      const env = JSON.parse(localStorage.getItem(key)!);
      const s = env.state;
      s.week = 12; s.ap = 0; s.finished = true;
      for (const id of Object.keys(s.concerts)) s.concerts[id] = { status: 'missed' };
      localStorage.setItem(key, JSON.stringify(env));
    }, SAVE_KEY);
    await page.reload();
    await expect(page.getByTestId('final-result')).toBeVisible();
    for (const zoom of [100, 200]) {
      await setZoom(page, zoom);
      await expectFits(page, `320px/${zoom}% 最終リザルト`);
    }
  });
});

test.describe('週開始アイキャッチ', () => {
  async function begin(page: Page) {
    await page.goto('/');
    await page.getByTestId('oshi-box').click();
    await page.getByText('詳細設定').click();
    await page.getByTestId('seed-input').fill('week-intro');
    await page.getByTestId('start-game').click();
    await page.getByTestId('tutorial-skip').click();
  }
  const readSave = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);

  test('週を終えると WEEK 02 / 12 と収支・体力・AP・次のライブが見え、閉じて次週の行動に移れる', async ({ page }) => {
    await begin(page);
    await page.getByTestId('act-work').click();
    const before = await readSave(page);
    await page.getByTestId('end-week').click();
    const intro = page.getByTestId('week-intro');
    await expect(intro).toBeVisible();
    await expect(intro).toHaveAttribute('role', 'dialog');
    await expect(intro).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByTestId('week-intro-num')).toHaveText('02');
    await expect(page.getByTestId('week-intro-title')).toContainText('第2週 スタート');
    await expect(intro).toHaveAccessibleName(/第2週/);
    const after = await readSave(page);
    const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
    await expect(page.getByTestId('week-intro-income').first()).toContainText('+¥2,000');
    await expect(page.getByTestId('week-intro-money')).toContainText(`${yen(before.money)} → ${yen(after.money)}`);
    await expect(page.getByTestId('week-intro-stamina')).toContainText(`${before.stamina} → ${after.stamina}`);
    await expect(page.getByTestId('week-intro-ap')).toContainText('AP 2 → 4');
    await expect(page.getByTestId('week-intro-event')).toContainText('第4週');
    await expect(page.getByTestId('week-intro-event')).toContainText('あと2週');
    // 背景は操作できない（inert）
    await expect(page.locator('.content')).toHaveAttribute('inert', '');
    await expect(page.getByTestId('end-week')).not.toBeFocused();
    // フォーカスは中で循環する
    const focused = await intro.evaluate((el) => el.contains(document.activeElement));
    expect(focused).toBe(true);
    await page.keyboard.press('Tab');
    expect(await intro.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    // 閉じる → 第2週の行動ができる
    await page.getByTestId('week-intro-start').click();
    await expect(intro).toBeHidden();
    await expect(page.locator('.content')).not.toHaveAttribute('inert', '');
    await expect(page.getByTestId('st-week')).toContainText('第2');
    await page.getByTestId('act-work').click();
    await expect(page.getByTestId('st-ap')).toHaveAttribute('aria-label', 'AP 2/4');
  });

  test('ESC でも閉じられる', async ({ page }) => {
    await begin(page);
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('week-intro')).toBeHidden();
  });

  test('資産収入があれば内訳に別行で出て、合計が資金の増加と一致する', async ({ page }) => {
    await begin(page);
    await page.evaluate((key) => {
      const env = JSON.parse(localStorage.getItem(key)!);
      env.state.assets = ['a1', 'a5'];
      localStorage.setItem(key, JSON.stringify(env));
    }, SAVE_KEY);
    await page.reload();
    const before = await readSave(page);
    await page.getByTestId('end-week').click();
    const rows = page.getByTestId('week-intro-income');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('+¥2,000');
    await expect(rows.nth(1)).toContainText('+¥2,500');
    await expect(rows.nth(2)).toContainText('+¥3,000');
    expect((await readSave(page)).money - before.money).toBe(7500);
  });

  test('ライブ参加を見送って終えても出る（不参加も表示）', async ({ page }) => {
    await begin(page);
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('end-week').click();
      await page.getByTestId('week-intro-start').click();
    }
    await expect(page.getByTestId('st-week')).toContainText('第4');
    await page.getByTestId('end-week').click();
    await page.getByTestId('confirm-end-yes').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    await expect(page.getByTestId('week-intro-num')).toHaveText('05');
    await expect(page.getByTestId('week-intro-missed')).toContainText('春のはじまりライブ');
    await expect(page.getByTestId('week-intro-event')).toContainText('第8週');
    await page.getByTestId('week-intro-start').click();
    await expect(page.getByTestId('week-intro')).toBeHidden();
  });

  test('第4週に入るときは今週のライブを案内する', async ({ page }) => {
    await begin(page);
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('end-week').click();
      await page.getByTestId('week-intro-start').click();
    }
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro-num')).toHaveText('04');
    await expect(page.getByTestId('week-intro-event')).toContainText('春のはじまりライブ');
  });

  test('最終週を終えるときは出さず、結果画面がそのまま見える', async ({ page }) => {
    await begin(page);
    await page.evaluate((key) => {
      const env = JSON.parse(localStorage.getItem(key)!);
      const s = env.state;
      s.week = 12;
      for (const id of Object.keys(s.concerts)) s.concerts[id] = { status: 'missed' };
      s.concerts.live3 = { status: 'pending' };
      localStorage.setItem(key, JSON.stringify(env));
    }, SAVE_KEY);
    await page.reload();
    await expect(page.getByTestId('st-week')).toContainText('第12');
    await page.getByTestId('end-week').click();
    await page.getByTestId('confirm-end-yes').click();
    await expect(page.getByTestId('final-result')).toBeVisible();
    await expect(page.getByTestId('week-intro')).toHaveCount(0);
    await expect(page.locator('.content')).not.toHaveAttribute('inert', '');
  });

  test('リロードや別タブの保存同期では出ない（操作したタブだけ）', async ({ page, context }) => {
    await begin(page);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByTestId('st-week')).toContainText('第1');
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    // 別タブには出ない（保存の同期だけが届く）
    await expect(second.getByTestId('st-week')).toContainText('第2', { timeout: 3000 });
    await expect(second.getByTestId('week-intro')).toHaveCount(0);
    // リロードでも再表示されない
    await page.reload();
    await expect(page.getByTestId('st-week')).toContainText('第2');
    await expect(page.getByTestId('week-intro')).toHaveCount(0);
    // アイキャッチ表示中に別タブが進めても、古い内容は残らない
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    await second.getByTestId('act-work').click();
    await expect(page.getByTestId('week-intro')).toHaveCount(0, { timeout: 3000 });
  });

  test('チュートリアル表示中は競合しない（遊び方を閉じた後に出ることもない）', async ({ page }) => {
    await begin(page);
    await page.getByTestId('tab-help').click();
    await page.getByTestId('open-tutorial').click();
    await expect(page.getByTestId('tutorial')).toBeVisible();
    await expect(page.getByTestId('week-intro')).toHaveCount(0);
    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('week-intro')).toHaveCount(0);
  });

  test('prefers-reduced-motion では演出アニメーションが止まる', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await begin(page);
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    const name = await page.getByTestId('week-intro-num').evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });
});

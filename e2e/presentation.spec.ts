import { expect, test, type Page } from '@playwright/test';
import { CARDS, CITIES } from '../src/game';

// v0.2「GAME FEEL」：PWA・統一アイコン・タブ切替スクロール・差分演出・旅盤面・ライブ演出・レア度フレーム。
const SAVE_KEY = 'oshikatsu-jinsei-game:save';

async function begin(page: Page, seed = 'v02-e2e') {
  await page.goto('/');
  await page.getByTestId('oshi-solo').click();
  await page.getByTestId('member-C').click();
  await page.getByText('詳細設定').click();
  await page.getByTestId('seed-input').fill(seed);
  await page.getByTestId('start-game').click();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('st-week')).toContainText('第1');
}
const readSave = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).state, SAVE_KEY);
async function endWeekAndStart(page: Page) {
  await page.getByTestId('end-week').click();
  await page.getByTestId('week-intro-start').click();
}

test.describe('PWA / ホーム画面追加', () => {
  test('manifest・アイコン・iOS standalone メタが揃い、相対パスで解決できる', async ({ page }) => {
    await page.goto('/');
    const head = await page.evaluate(() => ({
      manifest: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute('href'),
      apple: document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute('href'),
      viewport: document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content,
      capable: document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]')?.content,
      status: document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
      theme: document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content,
    }));
    expect(head.manifest).toBe('manifest.webmanifest'); // 先頭が "/" でない＝サブディレクトリ配信でも壊れない
    expect(head.apple).toMatch(/^icons\/apple-touch-icon\.png$/);
    expect(head.viewport).toContain('viewport-fit=cover');
    expect(head.capable).toBe('yes');
    expect(head.status).toBe('black-translucent');
    expect(head.theme).toBe('#0b0820');

    const res = await page.request.get('manifest.webmanifest');
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(m.name).toContain('推し活');
    const purposes = m.icons.map((i: { purpose: string }) => i.purpose);
    expect(purposes).toContain('maskable');
    for (const icon of m.icons as { src: string; type: string }[]) {
      expect(icon.src.startsWith('/')).toBe(false);
      const r = await page.request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type'], icon.src).toContain(icon.type.split('/')[0]);
    }
    expect((await page.request.get(head.apple!)).status()).toBe(200);
  });

  test('GitHub Pages 風のサブディレクトリ配信でも manifest とアイコンが取得できる', async ({ page }) => {
    const { createServer } = await import('node:http');
    const { readFile } = await import('node:fs/promises');
    const { resolve, extname, sep } = await import('node:path');
    const root = resolve('dist');
    const prefix = '/oshikatsu-life/';
    const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname);
        if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
        const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
        if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
        res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    try {
      const port = (server.address() as import('node:net').AddressInfo).port;
      const base = `http://127.0.0.1:${port}${prefix}`;
      await page.goto(base);
      const manifestUrl = await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href);
      expect(manifestUrl).toBe(`${base}manifest.webmanifest`);
      const m = await (await page.request.get(manifestUrl)).json();
      for (const icon of m.icons as { src: string }[]) {
        expect((await page.request.get(new URL(icon.src, manifestUrl).href)).status(), icon.src).toBe(200);
      }
      const apple = await page.evaluate(() => document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')!.href);
      expect((await page.request.get(apple)).status()).toBe(200);
    } finally { await new Promise<void>((done) => server.close(() => done())); }
  });

  test('safe area（ノッチ・ホームバー）用の指定がCSSに含まれる', async ({ page }) => {
    await page.goto('/');
    const css = await page.evaluate(async () => {
      const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
      return (await Promise.all(links.map((l) => fetch(l.href).then((r) => r.text())))).join('\n');
    });
    expect(css).toContain('safe-area-inset-top');
    expect(css).toContain('safe-area-inset-bottom');
  });
});

test.describe('統一ゲームアイコンとナビ', () => {
  test('ナビは emoji ではなく同じ SVG アイコン体系で、全タブに testid が残る', async ({ page }) => {
    await begin(page);
    for (const tab of ['home', 'map', 'collection', 'deck', 'live', 'trophy', 'help']) {
      const btn = page.getByTestId(`tab-${tab}`);
      await expect(btn.locator('svg.ico')).toHaveCount(1);
      const text = (await btn.innerText()).trim();
      expect(text, `${tab} のラベルに emoji が無い`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    await page.getByTestId('tab-map').click();
    await expect(page.getByTestId('tab-map')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('tab-map')).toHaveClass(/on/);
    // 画面全体に emoji の絵文字アイコンが残っていない
    for (const tab of ['home', 'map', 'collection', 'deck', 'live', 'trophy', 'help']) {
      await page.getByTestId(`tab-${tab}`).click();
      const text = await page.locator('#root').innerText();
      expect(text.match(/\p{Extended_Pictographic}/gu) ?? [], `${tab}`).toEqual([]);
    }
  });
});

test.describe('タブ切替でページ先頭へ戻る', () => {
  test('スクロールしたあとタブを替えると、どのタブも先頭から表示される', async ({ page }) => {
    await begin(page);
    for (const tab of ['map', 'collection', 'deck', 'trophy', 'help', 'home']) {
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      expect(await page.evaluate(() => scrollY), '前の画面を十分スクロールしている').toBeGreaterThan(100);
      await page.getByTestId(`tab-${tab}`).click();
      await expect.poll(() => page.evaluate(() => scrollY), { message: `${tab} は先頭から` }).toBe(0);
    }
    // 先頭のイラスト（ホーム）が見える
    await expect(page.locator('.home-scene')).toBeInViewport();
  });

  test('週開始アイキャッチ・カード選択モーダルとは競合しない（閉じてもスクロール位置を壊さない）', async ({ page }) => {
    await begin(page);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.getByTestId('end-week').click();
    await expect(page.getByTestId('week-intro')).toBeVisible();
    await expect(page.locator('.tabs')).toHaveAttribute('inert', ''); // 背景（タブ）は操作不可
    const y = await page.evaluate(() => scrollY);
    await page.getByTestId('week-intro-start').click();
    await expect(page.getByTestId('week-intro')).toBeHidden();
    expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThan(40);

    // 探索のカード選択を挟んでタブ移動しても先頭に戻る
    await page.getByTestId('tab-map').click();
    await page.locator('[data-testid^="explore-"]:not([disabled])').first().click();
    await expect(page.getByTestId('choice-modal')).toBeVisible();
    await page.getByTestId('choice-card').first().click();
    await expect(page.getByTestId('choice-modal')).toBeHidden();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.getByTestId('tab-deck').click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });
});

test.describe('ホーム＝拠点', () => {
  test('旅の週間ビジュアル・次ライブのチケット・12週トラック・旅券スタンプが出る', async ({ page }) => {
    await begin(page);
    await expect(page.locator('.home-scene')).toBeVisible();
    await expect(page.getByTestId('next-ticket')).toContainText('第4週');
    await expect(page.getByTestId('next-ticket')).toContainText('あと3');
    await expect(page.getByTestId('journey').locator('li')).toHaveCount(12);
    await expect(page.getByTestId('journey').locator('li.now')).toHaveCount(1);
    await expect(page.getByTestId('journey').locator('li.live')).toHaveCount(3);
    await expect(page.getByTestId('passport')).toContainText('旅券 1/12');
    await expect(page.getByTestId('passport').locator('li.got')).toHaveCount(1);
  });

  test('第4週は今週のライブが最優先で出て、ライブ画面へ移れる', async ({ page }) => {
    await begin(page);
    for (let i = 0; i < 3; i++) await endWeekAndStart(page);
    await expect(page.getByTestId('live-banner')).toContainText('LIVE WEEK');
    await expect(page.getByTestId('next-ticket')).toHaveCount(0);
    await page.getByTestId('go-live').click();
    await expect(page.getByTestId('live-join')).toBeVisible();
  });

  test('行動タイル：390px 幅で「マップ」は1行全幅、仕事/休息は2列。コストが明記される', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await begin(page);
    const w = (await page.getByTestId('act-work').boundingBox())!;
    const r = (await page.getByTestId('act-rest').boundingBox())!;
    const m = (await page.getByTestId('act-map').boundingBox())!;
    expect(Math.abs(w.y - r.y), '仕事と休息は同じ行').toBeLessThan(2);
    expect(m.y).toBeGreaterThan(w.y + w.height - 1);
    expect(Math.abs(m.x - w.x), 'マップは左端から').toBeLessThan(2);
    expect(Math.abs(m.x + m.width - (r.x + r.width)), 'マップは右端まで').toBeLessThan(2);
    await expect(page.getByTestId('act-work')).toContainText('2AP');
    await expect(page.getByTestId('act-work')).toContainText('+¥22,000');
    await expect(page.getByTestId('act-work')).toContainText('体力-12');
    await expect(page.getByTestId('act-rest')).toContainText('体力+30');
    for (const k of ['h', 'u', 'm']) await expect(page.getByTestId(`act-train-${k}`)).toContainText('¥800');
  });
});

test.describe('操作結果は実データの差分だけを演出する', () => {
  test('仕事：実際の資金・体力・APの変化と一致し、リロードや別タブでは出ない', async ({ page, context }) => {
    await begin(page);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByTestId('st-week')).toContainText('第1');
    const before = await readSave(page);
    await page.getByTestId('act-work').click();
    const after = await readSave(page);
    const fx = page.getByTestId('fx-delta');
    await expect(fx).toBeVisible();
    await expect(fx.locator('[data-fx="money"]')).toHaveText(new RegExp(`\\+¥${(after.money - before.money).toLocaleString('ja-JP')}`));
    await expect(fx.locator('[data-fx="stamina"]')).toContainText(`-${before.stamina - after.stamina}`);
    await expect(fx.locator('[data-fx="ap"]')).toContainText(`-${before.ap - after.ap}`);
    // 別タブ（同期のみ）には出ない
    await expect(second.getByTestId('st-money')).toContainText('82,000', { timeout: 3000 });
    await expect(second.getByTestId('fx-delta')).toHaveCount(0);
    // 数秒で消える／リロードでは出ない
    await expect(fx).toBeHidden({ timeout: 5000 });
    await page.reload();
    await expect(page.getByTestId('fx-delta')).toHaveCount(0);
  });

  test('実行できない操作（AP不足）では演出を出さない', async ({ page }) => {
    await begin(page);
    await page.getByTestId('act-work').dblclick();
    await expect(page.getByTestId('act-work')).toBeDisabled();
    await expect(page.getByTestId('fx-delta')).toBeVisible();
    await expect(page.getByTestId('fx-delta')).toBeHidden({ timeout: 5000 });
    await page.getByTestId('act-work').click({ force: true, trial: false }).catch(() => undefined);
    await expect(page.getByTestId('fx-delta')).toHaveCount(0);
    expect((await readSave(page)).ap).toBe(0);
  });

  test('訓練：レベルの変化が出る', async ({ page }) => {
    await begin(page);
    await page.getByTestId('act-train-h').click();
    await expect(page.getByTestId('fx-delta').locator('[data-fx="skill-h"]')).toContainText('Lv0 → Lv1');
  });
});

test.describe('全国旅行盤面', () => {
  test('12都市すべて選べ、選択で切符UIが切り替わる（タップ/キーボード）', async ({ page }) => {
    await begin(page);
    await page.getByTestId('tab-map').click();
    await expect(page.getByTestId('board')).toBeVisible();
    for (const c of CITIES) {
      const node = page.getByTestId(`city-${c.id}`);
      await expect(node).toHaveAttribute('role', 'button');
      await node.click();
      await expect(node).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('city-panel')).toContainText(c.name);
    }
    await page.getByTestId('city-osaka').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('city-panel')).toContainText('大阪');
    // 直通でない都市は最短経路が出る
    await page.getByTestId('city-fukuoka').click();
    await expect(page.getByTestId('move-hop-btn')).toBeVisible();
  });

  test('盤面のSVGは巨大な線画などで崩れていない（アイコンのネスト無し・要素が盤面内）', async ({ page }) => {
    await begin(page);
    await page.getByTestId('tab-map').click();
    const report = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="board"]') as SVGSVGElement;
      const b = board.getBoundingClientRect();
      const out: string[] = [];
      for (const el of Array.from(board.querySelectorAll('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.left < b.left - 20 || r.right > b.right + 20 || r.top < b.top - 20 || r.bottom > b.bottom + 20) out.push(`${el.tagName}.${(el as SVGElement).getAttribute('class')} 盤面外`);
        if (r.width > b.width * 0.8 && !['rect', 'g', 'svg', 'path', 'line'].includes(el.tagName)) out.push(`${el.tagName} が巨大 ${Math.round(r.width)}px`);
      }
      const badges = Array.from(board.querySelectorAll('.rt-badge')).map((e) => e.getBoundingClientRect().width);
      return { out, nestedSvg: board.querySelectorAll('svg').length, badges, scale: b.width / 360 };
    });
    expect(report.out).toEqual([]);
    expect(report.nestedSvg, 'SVG内にSVGアイコンをネストしない').toBe(0);
    expect(report.badges.length).toBeGreaterThan(0);
    for (const w of report.badges) expect(w / report.scale, '空路バッジは12px前後').toBeLessThanOrEqual(14);
  });

  test('都市名ラベル同士が重ならない（近接都市）', async ({ page }) => {
    await begin(page);
    await page.getByTestId('tab-map').click();
    const rects = await page.evaluate(() => Object.fromEntries(['tokyo', 'yokohama', 'nagoya', 'kyoto', 'osaka', 'kobe'].map((id) => {
      const r = document.querySelector(`[data-testid="city-${id}"] .bd-label`)!.getBoundingClientRect();
      return [id, { l: r.left, r: r.right, t: r.top, b: r.bottom }];
    })));
    const overlap = (a: { l: number; r: number; t: number; b: number }, b: typeof a) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const ids = Object.keys(rects) as (keyof typeof rects)[];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(overlap(rects[ids[i]!]!, rects[ids[j]!]!), `${ids[i]} と ${ids[j]}`).toBe(false);
  });

  test('移動成功時だけ「○○到着！」が短く出て、タップで閉じる。リロード/別タブ/失敗では出ない', async ({ page, context }) => {
    await begin(page);
    const second = await context.newPage();
    await second.goto('/');
    await page.getByTestId('tab-map').click();
    await second.getByTestId('tab-map').click();
    await page.getByTestId('city-yokohama').click();
    await expect(page.getByTestId('arrival-stamp')).toHaveCount(0);
    await page.getByTestId('move-btn').click();
    const stamp = page.getByTestId('arrival-stamp');
    await expect(stamp).toBeVisible();
    await expect(stamp).toContainText('横浜到着！');
    await expect(page.getByTestId('fx-delta')).toContainText('-¥1,000');
    expect((await readSave(page)).city).toBe('yokohama');
    // 別タブは同期だけで、スタンプなし
    await expect(second.getByTestId('st-money')).toContainText('59,000', { timeout: 3000 });
    await expect(second.getByTestId('arrival-stamp')).toHaveCount(0);
    // タップで閉じる
    await stamp.click();
    await expect(stamp).toHaveCount(0);
    // 自動でも消える
    await page.getByTestId('city-tokyo').click();
    await page.getByTestId('move-btn').click();
    await expect(page.getByTestId('arrival-stamp')).toContainText('東京到着！');
    await expect(page.getByTestId('arrival-stamp')).toBeHidden({ timeout: 6000 });
    // リロードでは出ない
    await page.reload();
    await page.getByTestId('tab-map').click();
    await expect(page.getByTestId('arrival-stamp')).toHaveCount(0);
  });

  test('移動できない（AP不足/資金不足）ときは到着演出を出さない', async ({ page }) => {
    await begin(page);
    await page.evaluate((key) => {
      const env = JSON.parse(localStorage.getItem(key)!);
      env.state.money = 500;
      localStorage.setItem(key, JSON.stringify(env));
    }, SAVE_KEY);
    await page.reload();
    await page.getByTestId('tab-map').click();
    await page.getByTestId('city-yokohama').click();
    await expect(page.getByTestId('move-btn')).toBeDisabled();
    await page.getByTestId('move-btn').click({ force: true }).catch(() => undefined);
    await expect(page.getByTestId('arrival-stamp')).toHaveCount(0);
    expect((await readSave(page)).city).toBe('tokyo');
  });

  test('今週の公演会場が盤面とチケットに出る', async ({ page }) => {
    await begin(page);
    for (let i = 0; i < 3; i++) { await page.getByTestId('tab-home').click(); await endWeekAndStart(page); }
    await page.getByTestId('tab-map').click();
    await expect(page.locator('[data-testid="city-osaka"].venue')).toHaveCount(1);
    await page.getByTestId('city-osaka').click();
    await expect(page.getByTestId('city-panel')).toContainText('今週の公演会場');
  });
});

test.describe('ライブ演出', () => {
  async function toBattle(page: Page) {
    await begin(page);
    for (let i = 0; i < 3; i++) await endWeekAndStart(page);
    await page.getByTestId('tab-live').click();
    await page.getByTestId('join-free').click();
    await expect(page.getByTestId('battle')).toBeVisible();
  }
  const songTenths = (s: { live: { player: { song: { h: number; u: number; m: number } } } }) => 5 * s.live.player.song.h + 3 * s.live.player.song.u + 2 * s.live.player.song.m;

  test('ステージ・ペンライト客席・VS表示・曲トラックがあり、手札にレア度属性が付く', async ({ page }) => {
    await toBattle(page);
    await expect(page.getByTestId('stage')).toBeVisible();
    expect(await page.locator('[data-testid="stage"] .penlight').count()).toBeGreaterThan(20);
    await expect(page.locator('.stage-vs .vs-badge')).toHaveText('VS');
    await expect(page.locator('.songtrack li')).toHaveCount(4);
    await expect(page.locator('.songtrack li.now')).toHaveCount(1);
    const hand = page.getByTestId('hand').locator('button.card');
    for (let i = 0; i < await hand.count(); i++) await expect(hand.nth(i)).toHaveAttribute('data-rarity', /^(N|R|SR|SSR|UR)$/);
    await expect(page.getByTestId('score-player')).toBeVisible();
    await expect(page.getByTestId('score-cpu')).toBeVisible();
  });

  test('カードを使うと、実際のスコア増加分が出る。リロードでは出ず、使えない操作でも出ない', async ({ page }) => {
    await toBattle(page);
    expect(await page.getByTestId('live-fx').count(), '開始直後は自動再生しない').toBe(0);
    await page.getByTestId('play-card').click({ force: true, timeout: 1000 }).catch(() => undefined);
    await expect(page.getByTestId('live-fx')).toHaveCount(0);

    const before = await readSave(page);
    const hand = page.getByTestId('hand').locator('button.card');
    let played = false;
    for (let i = 0; i < await hand.count() && !played; i++) {
      const card = hand.nth(i);
      if ((await card.getAttribute('class'))?.includes('blocked')) continue;
      await card.click();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('sel-info')).toBeVisible();
      if (await page.getByTestId('play-card').isEnabled()) { await page.getByTestId('play-card').click(); played = true; }
    }
    expect(played).toBe(true);
    const after = await readSave(page);
    const delta = songTenths(after) - songTenths(before);
    const fx = page.getByTestId('live-fx-play');
    await expect(fx).toBeVisible();
    await expect(fx.locator('.fx-score')).toContainText(`+${(delta / 10).toFixed(1)}`);
    await expect(fx.locator('.fx-gains')).toContainText(`熱量+${after.live.player.song.h - before.live.player.song.h}`);
    await page.reload();
    await expect(page.getByTestId('battle')).toBeVisible();
    await expect(page.getByTestId('live-fx')).toHaveCount(0);
  });

  test('フェーズを終えるとCPUの行動が独立した通知で出る／後半・曲の進行も出る', async ({ page }) => {
    await toBattle(page);
    let sawCpu = false;
    let sawAdvance = false;
    for (let i = 0; i < 4 && !(sawCpu && sawAdvance); i++) {
      const before = await readSave(page);
      await page.getByTestId('end-phase').click();
      const after = await readSave(page);
      if (!after.live) break;
      const cpuPlayed = after.live.cpu.history.length > before.live.cpu.history.length;
      if (cpuPlayed) {
        await expect(page.getByTestId('live-fx-cpu')).toBeVisible();
        await expect(page.getByTestId('live-fx-cpu')).toContainText('CPU');
        sawCpu = true;
      }
      if (after.live.phase !== before.live.phase || after.live.songIndex !== before.live.songIndex) {
        await expect(page.getByTestId('live-fx-advance')).toBeVisible();
        sawAdvance = true;
      }
    }
    expect(sawAdvance).toBe(true);
  });

  test('スコアが上回った側の強調（leading）が実スコアに連動する', async ({ page }) => {
    await toBattle(page);
    const hand = page.getByTestId('hand').locator('button.card');
    for (let i = 0; i < await hand.count(); i++) {
      const card = hand.nth(i);
      if ((await card.getAttribute('class'))?.includes('blocked')) continue;
      await card.click();
      if (await page.getByTestId('play-card').isEnabled()) { await page.getByTestId('play-card').click(); break; }
    }
    const s = await readSave(page);
    const you = songTenths(s);
    const cpu = 5 * s.live.cpu.song.h + 3 * s.live.cpu.song.u + 2 * s.live.cpu.song.m;
    if (you > cpu) {
      await expect(page.getByTestId('score-player')).toHaveClass(/leading/);
      await expect(page.getByTestId('stage')).toHaveClass(/lead-you/);
    } else if (cpu > you) {
      await expect(page.getByTestId('score-cpu')).toHaveClass(/leading/);
    }
  });
});

test.describe('カードのレア感とトロフィー棚', () => {
  test('N〜UR でフレームが異なり、SR以上は光沢アニメーション、カード名とEPは常に表示される', async ({ page }) => {
    await begin(page);
    await page.evaluate(([key, ids]) => {
      const env = JSON.parse(localStorage.getItem(key as string)!);
      for (const id of ids as string[]) env.state.collection[id] = Math.max(env.state.collection[id] ?? 0, 1);
      localStorage.setItem(key as string, JSON.stringify(env));
    }, [SAVE_KEY, CARDS.map((c) => c.id)] as const);
    await page.reload();
    await page.getByTestId('tab-collection').click();
    const info = await page.evaluate(() => {
      const pick = (r: string) => document.querySelector(`.card[data-rarity="${r}"]`) as HTMLElement;
      return Object.fromEntries(['N', 'R', 'SR', 'SSR', 'UR'].map((r) => {
        const el = pick(r);
        const cs = getComputedStyle(el);
        return [r, { border: cs.borderTopColor, shadow: cs.boxShadow, foil: getComputedStyle(el, '::before').animationName, name: el.querySelector('.card-name')!.textContent, cost: el.querySelector('.cost')!.textContent, art: !!el.querySelector('.card-art') }];
      }));
    });
    expect(info.N.foil).toBe('none');
    expect(info.R.foil).toBe('none');
    for (const r of ['SR', 'SSR', 'UR']) expect(info[r]!.foil, `${r} の光沢`).not.toBe('none');
    expect(new Set(Object.values(info).map((v) => v.shadow)).size, 'レア度ごとに発光が違う').toBeGreaterThanOrEqual(4);
    for (const v of Object.values(info)) { expect(v.name!.length).toBeGreaterThan(0); expect(v.cost).toMatch(/EP$/); expect(v.art).toBe(true); }
    // 同じ見た目をデッキ画面でも使う
    await page.getByTestId('tab-deck').click();
    expect(await page.locator('[data-testid^="deckrow-"] .card[data-rarity="UR"]').count()).toBeGreaterThan(0);
  });

  test('reduced-motion では光沢・ネオンなどの自動アニメーションが止まる', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await begin(page);
    const names = await page.evaluate(() => ({
      cta: getComputedStyle(document.querySelector('.cta-end')!).animationName,
      scene: getComputedStyle(document.querySelector('.hs-star')!).animationName,
    }));
    expect(names.cta).toBe('none');
    expect(names.scene).toBe('none');
  });

  test('トロフィー棚：全トロフィーがメダル付きのバッジで、達成/未達/ロックが区別できる', async ({ page }) => {
    await begin(page);
    await page.getByTestId('tab-trophy').click();
    await expect(page.locator('.trophies.shelf .trophy')).toHaveCount(17);
    await expect(page.locator('.trophies.shelf .medal')).toHaveCount(17);
    await expect(page.getByTestId('trophy-dome5')).toHaveClass(/locked/);
    await expect(page.getByTestId('trophy-count')).toBeVisible();
  });
});

import { describe, expect, it } from 'vitest';
import { botPlayGame, botPlayLive, botPlayWeek, randomOpts } from '../src/game/bot';
import { CARDS } from '../src/game/data/cards';
import { ASSETS, CITIES, SPOTS } from '../src/game/data/world';
import { FUNCTIONAL_TROPHIES, TROPHIES } from '../src/game/data/trophies';
import { isDeckLegal } from '../src/game/deck';
import {
  applyAction, blockReason, finalSummary, liveCostFor, newGame, neighbors, shortestPath,
} from '../src/game/game';
import { AP_PER_WEEK, MAX_STAMINA, type Action, type GameState } from '../src/game/state';
import { rand } from '../src/game/rng';

const mk = (over: Partial<GameState> = {}, city: Parameters<typeof newGame>[0]['city'] = 'tokyo'): GameState => ({
  ...newGame({ oshi: 'box', city, seed: 1 }), ...over,
});
const ok = (s: GameState, a: Action): GameState => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`rejected ${a.type}: ${r.reason}`);
  return r.state;
};
const rejected = (s: GameState, a: Action): string => {
  const r = applyAction(s, a);
  expect(r.ok, `${a.type} は拒否されるべき`).toBe(false);
  return r.ok ? '' : r.reason;
};
const skipTo = (s: GameState, week: number): GameState => {
  let cur = s;
  while (cur.week < week) cur = ok(cur, { type: 'endWeek' });
  return cur;
};

describe('初期状態', () => {
  it('資金60000 / 体力80 / 週1 / AP4 / 12都市 / 合法デッキ', () => {
    const s = newGame({ oshi: 'combo', city: 'osaka', seed: 5 });
    expect([s.money, s.stamina, s.week, s.ap]).toEqual([60000, 80, 1, 4]);
    expect(s.city).toBe('osaka');
    expect(isDeckLegal(s.deck, s.collection)).toBe(true);
    expect(CITIES).toHaveLength(12);
  });
  it('どの開始都市・推しタイプでも初期資金は同じ（公平）', () => {
    for (const c of CITIES) {
      for (const oshi of ['solo', 'combo', 'box'] as const) {
        const s = newGame({ oshi, member: 'B', city: c.id, seed: 2 });
        expect([s.money, s.stamina, s.ap]).toEqual([60000, 80, 4]);
      }
    }
  });
});

describe('資源不足の不変条件（拒否され状態は変わらない）', () => {
  it('AP不足: 仕事(2)/休息(2)/探索(1)/訓練(1)/移動/購入が拒否される', () => {
    const base = mk({ ap: 1, stamina: 50 });
    expect(rejected(base, { type: 'work' })).toContain('AP');
    expect(rejected(base, { type: 'rest' })).toContain('AP');
    const none = mk({ ap: 0 });
    expect(rejected(none, { type: 'train', skill: 'h' })).toContain('AP');
    expect(rejected(none, { type: 'explore', spotId: 'tokyo-1' })).toContain('AP');
    expect(rejected(none, { type: 'move', to: 'yokohama' })).toContain('AP');
    expect(rejected(mk({ ap: 0 }, 'tokyo'), { type: 'buyAsset', assetId: 'a6' })).toBeTruthy();
    // 状態は不変
    const r = applyAction(none, { type: 'work' });
    expect(r.ok).toBe(false);
    expect(none.money).toBe(60000);
  });
  it('資金不足: 移動・探索入場費・訓練・資産購入が拒否される', () => {
    const poor = mk({ money: 0 });
    expect(rejected(poor, { type: 'move', to: 'yokohama' })).toContain('資金');
    expect(rejected(poor, { type: 'explore', spotId: 'tokyo-1' })).toContain('資金');
    expect(rejected(poor, { type: 'train', skill: 'u' })).toContain('資金');
    expect(rejected(mk({ money: 1000 }), { type: 'buyAsset', assetId: 'a6' })).toContain('資金');
  });
  it('体力不足: 仕事・訓練・探索・移動が拒否され、休息は可能', () => {
    const tired = mk({ stamina: 2, ap: 4 });
    expect(rejected(tired, { type: 'work' })).toContain('体力');
    expect(rejected(tired, { type: 'train', skill: 'h' })).toContain('体力');
    expect(rejected(tired, { type: 'explore', spotId: 'tokyo-1' })).toContain('体力');
    expect(rejected(tired, { type: 'move', to: 'yokohama' })).toContain('体力');
    const rested = ok(tired, { type: 'rest' });
    expect(rested.stamina).toBe(32);
    expect(rested.ap).toBe(2);
  });
  it('どの操作を行っても 資金>=0, 体力 0..100, AP 0..4 を保つ（ファズ）', () => {
    const spots = SPOTS.map((s) => s.id);
    for (let seed = 1; seed <= 25; seed++) {
      const box = { rng: seed * 31 };
      let s = newGame(randomOpts(seed));
      for (let step = 0; step < 220 && !s.finished; step++) {
        const roll = rand(box);
        let a: Action;
        if (s.pending) a = { type: 'pickCard', cardId: s.pending.options[0] as string };
        else if (s.live) a = s.live.stage === 'result' ? { type: 'liveClaim' } : rand(box) < 0.6 ? { type: 'livePlay', handIndex: Math.floor(rand(box) * 7) } : { type: 'liveEndPhase' };
        else if (roll < 0.15) a = { type: 'work' };
        else if (roll < 0.25) a = { type: 'rest' };
        else if (roll < 0.4) a = { type: 'explore', spotId: spots[Math.floor(rand(box) * spots.length)] as string };
        else if (roll < 0.55) a = { type: 'move', to: CITIES[Math.floor(rand(box) * 12)]!.id };
        else if (roll < 0.65) a = { type: 'train', skill: (['h', 'u', 'm'] as const)[Math.floor(rand(box) * 3)]! };
        else if (roll < 0.72) a = { type: 'buyAsset', assetId: ASSETS[Math.floor(rand(box) * ASSETS.length)]!.id };
        else if (roll < 0.8) a = { type: 'startLive', mode: (['onsite', 'stream', 'free'] as const)[Math.floor(rand(box) * 3)]! };
        else a = { type: 'endWeek' };
        const r = applyAction(s, a);
        if (r.ok) s = r.state;
        expect(s.money).toBeGreaterThanOrEqual(0);
        expect(s.stamina).toBeGreaterThanOrEqual(0);
        expect(s.stamina).toBeLessThanOrEqual(MAX_STAMINA);
        expect(s.ap).toBeGreaterThanOrEqual(0);
        expect(s.ap).toBeLessThanOrEqual(AP_PER_WEEK);
        expect(isDeckLegal(s.deck, s.collection)).toBe(true);
      }
    }
  });
  it('常に進行可能: 何があっても週を終えるか、ライブ/カード選択を進められる（詰まない）', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = newGame(randomOpts(seed));
      s = { ...s, money: 0, stamina: 0, ap: 0 };
      let guard = 0;
      while (!s.finished && guard++ < 60) {
        if (s.pending) s = ok(s, { type: 'pickCard', cardId: s.pending.options[0] as string });
        else if (s.live) s = botPlayLive(s);
        else s = ok(s, { type: 'endWeek' });
      }
      expect(s.finished).toBe(true);
    }
  });
});

describe('週と収支', () => {
  it('仕事: 2AP消費・収入+22000・体力-12', () => {
    const s = ok(mk(), { type: 'work' });
    expect([s.ap, s.money, s.stamina]).toEqual([2, 82000, 68]);
  });
  it('週末: 資金+2000、体力+10（上限100）、APが4に戻る', () => {
    const a = ok(mk({ stamina: 80, ap: 1 }), { type: 'endWeek' });
    expect([a.week, a.ap, a.money, a.stamina]).toEqual([2, 4, 62000, 90]);
    const b = ok(mk({ stamina: 97 }), { type: 'endWeek' });
    expect(b.stamina).toBe(100);
  });
  it('12週で終了し、以降の操作は拒否される。完走トロフィーが付く', () => {
    let s = mk();
    for (let w = 1; w <= 12; w++) {
      expect(s.week).toBe(w);
      s = ok(s, { type: 'endWeek' });
    }
    expect(s.finished).toBe(true);
    expect(s.week).toBe(12);
    expect(s.trophies).toContain('finish');
    expect(rejected(s, { type: 'work' })).toContain('終了');
    expect(finalSummary(s).rank).toMatch(/[SABC]/);
  });
  it('訓練: レベルが上がりコストが増え、最大5で止まる', () => {
    let s = mk({ money: 999999, stamina: 100, ap: 4 });
    s = ok(s, { type: 'train', skill: 'h' });
    expect(s.skills.h).toBe(1);
    expect(s.money).toBe(999999 - 800);
    s = ok(s, { type: 'train', skill: 'h' });
    expect(s.money).toBe(999999 - 800 - 1600);
    let t = mk({ money: 999999, stamina: 100, skills: { h: 5, u: 0, m: 0 } });
    t = { ...t, ap: 4 };
    expect(rejected(t, { type: 'train', skill: 'h' })).toContain('最大');
  });
  it('資産: 都市の資産だけ購入でき、週末収入が増える', () => {
    const s0 = mk({ money: 100000, city: 'nagoya' });
    expect(rejected(s0, { type: 'buyAsset', assetId: 'a6' })).toContain('東京');
    const s1 = ok(s0, { type: 'buyAsset', assetId: 'a1' });
    expect(s1.assets).toEqual(['a1']);
    expect(s1.money).toBe(70000);
    expect(rejected(s1, { type: 'buyAsset', assetId: 'a1' })).toContain('購入済み');
    const s2 = ok(s1, { type: 'endWeek' });
    expect(s2.money).toBe(70000 + 2000 + 2500);
  });
});

describe('マップ・探索・カード獲得', () => {
  it('経路は双方向で、隣接のみ移動できる。AP/費用/到着都市が反映される', () => {
    expect(neighbors('tokyo').length).toBeGreaterThanOrEqual(3);
    const s = ok(mk(), { type: 'move', to: 'yokohama' });
    expect([s.city, s.ap, s.money]).toEqual(['yokohama', 3, 59000]);
    expect(s.visitedCities).toEqual(['tokyo', 'yokohama']);
    expect(rejected(mk(), { type: 'move', to: 'fukuoka' })).toContain('直通');
    const long = ok(mk({ city: 'sapporo', ap: 4 }), { type: 'move', to: 'tokyo' });
    expect(long.ap).toBe(2); // 2AP経路
    expect(shortestPath('sapporo', 'fukuoka')!.path[0]).toBe('sapporo');
  });
  it('全12都市が経路でつながり、各都市に3スポット以上ある', () => {
    for (const c of CITIES) {
      expect(shortestPath('tokyo', c.id), c.name).not.toBeNull();
      expect(SPOTS.filter((s) => s.city === c.id).length).toBeGreaterThanOrEqual(3);
    }
  });
  it('探索: 1AP・入場費・体力を消費し、三択を提示。選ぶまで他の操作は不可。選ぶとコレクションに増える', () => {
    let s = ok(mk(), { type: 'explore', spotId: 'tokyo-1' });
    expect(s.ap).toBe(3);
    expect(s.money).toBe(60000 - 2500);
    expect(s.pending?.options).toHaveLength(3);
    expect(new Set(s.pending!.options).size).toBe(3);
    expect(s.visitedSpots).toContain('tokyo-1');
    expect(rejected(s, { type: 'work' })).toContain('カード');
    expect(rejected(s, { type: 'endWeek' })).toContain('カード');
    expect(rejected(s, { type: 'pickCard', cardId: 'not-an-option' })).toContain('候補');
    const pick = s.pending!.options[0] as string;
    const before = s.collection[pick] ?? 0;
    s = ok(s, { type: 'pickCard', cardId: pick });
    expect(s.pending).toBeNull();
    expect(s.collection[pick]).toBe(before + 1);
    expect(s.newCards).toContain(pick);
    // 入手分はデッキに入っていない分として差分が見える
    const inDeck = s.deck.filter((id) => id === pick).length;
    expect(s.collection[pick]! - inDeck).toBeGreaterThan(0);
    expect(rejected(s, { type: 'explore', spotId: 'tokyo-1' })).toContain('探索済み');
    expect(rejected(s, { type: 'explore', spotId: 'osaka-1' })).toContain('別の都市');
  });
  it('スポットの傾向（地域・メンバー）がカード抽選に反映される', () => {
    // 札幌のスポット(メンバーE/H)を多数回引くと、E/Hのカードが全体平均より多く出る
    let hits = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = ok(mk({ rng: seed * 977 + 3, money: 100000 }, 'sapporo'), { type: 'explore', spotId: 'sapporo-1' });
      for (const id of s.pending!.options) {
        total++;
        const c = CARDS.find((x) => x.id === id)!;
        if (c.member === 'E' || c.member === 'H') hits++;
      }
    }
    expect(hits / total).toBeGreaterThan(0.25 + 0.05); // 一様なら 2/8=25%
  });
  it('収集が増えるとコレクション種類・トロフィーに反映される', () => {
    let s = mk({ money: 999999, stamina: 100 });
    for (const id of ['tokyo-1', 'tokyo-2', 'tokyo-3']) {
      s = { ...s, ap: 4, stamina: 100 };
      s = ok(s, { type: 'explore', spotId: id });
      s = ok(s, { type: 'pickCard', cardId: s.pending!.options[0] as string });
    }
    expect(s.visitedSpots).toHaveLength(3);
    expect(s.souvenirs).toHaveLength(3);
    expect(s.stats.cardsFound).toBe(3);
  });
});

describe('デッキ編成の操作', () => {
  it('合法デッキだけ保存でき、不正な保存は拒否される。自動調整/リセットは常に合法', () => {
    const s = mk();
    expect(rejected(s, { type: 'setDeck', deck: s.deck.slice(1) })).toContain('20枚');
    expect(rejected(s, { type: 'setDeck', deck: Array(20).fill('c40') as string[] }).length).toBeGreaterThan(0);
    const swapped = [...s.deck];
    swapped[0] = s.deck[1] as string;
    const r = applyAction(s, { type: 'setDeck', deck: swapped });
    if (r.ok) expect(isDeckLegal(r.state.deck, r.state.collection)).toBe(true);
    const broken = { ...s, deck: s.deck.slice(0, 5) };
    const fixed = ok(broken as GameState, { type: 'autoDeck' });
    expect(isDeckLegal(fixed.deck, fixed.collection)).toBe(true);
    const reset = ok(fixed, { type: 'resetDeck' });
    expect(isDeckLegal(reset.deck, reset.collection)).toBe(true);
  });
  it('ライブ中はデッキ編集できない', () => {
    let s = skipTo(mk(), 4);
    s = ok(s, { type: 'startLive', mode: 'free' });
    expect(rejected(s, { type: 'autoDeck' })).toContain('ライブ中');
    expect(rejected(s, { type: 'work' })).toContain('ライブ中');
  });
});

describe('ライブ参加', () => {
  it('公演は週4/8/12のみ。その他の週は参加不可', () => {
    expect(blockReason(mk(), { type: 'startLive', mode: 'free' })).toContain('公演がありません');
    for (const w of [4, 8, 12]) expect(blockReason(skipTo(mk(), w), { type: 'startLive', mode: 'free' })).toBeNull();
  });
  it('距離で現地参加の費用/APが変わり、遠すぎる場合は拒否。無料配信は常に可能', () => {
    const near = skipTo(mk({ city: 'osaka' }), 4);
    const far = skipTo(mk({ city: 'sapporo' }), 4);
    const cn = liveCostFor(near, 'onsite')!;
    const cf = liveCostFor(far, 'onsite')!;
    expect(cf.money).toBeGreaterThan(cn.money);
    expect(cf.ap).toBeGreaterThan(cn.ap);
    expect(rejected(far, { type: 'startLive', mode: 'onsite' })).toContain('AP');
    const broke = { ...far, money: 0, ap: 0, stamina: 0 };
    expect(blockReason(broke, { type: 'startLive', mode: 'free' })).toBeNull();
    expect(blockReason({ ...broke, money: 0 }, { type: 'startLive', mode: 'stream' })).toBeTruthy();
  });
  it('現地参加は会場の都市へ移動し、配信より報酬が大きい', () => {
    let s = skipTo(mk({ city: 'osaka' }), 4);
    const on = ok(s, { type: 'startLive', mode: 'onsite' });
    expect(on.city).toBe('osaka');
    expect(on.ap).toBe(3);
    expect(on.money).toBe(s.money - 6000);
    s = on;
    const done = botPlayLive(s);
    expect(done.concerts.live1?.status).toBe('done');
    expect(done.live).toBeNull();
  });
  it('ライブ終了→報酬(資金)→カード三択→週進行まで通しで動く', () => {
    let s = skipTo(mk(), 4);
    const m0 = s.money;
    s = ok(s, { type: 'startLive', mode: 'free' });
    for (let i = 0; i < 100 && s.live && s.live.stage === 'playing'; i++) s = ok(s, { type: 'liveEndPhase' });
    expect(s.live?.stage).toBe('result');
    expect(rejected(s, { type: 'work' })).toContain('ライブ中');
    s = ok(s, { type: 'liveClaim' });
    expect(s.live).toBeNull();
    expect(s.money).toBeGreaterThan(m0);
    expect(s.pending?.options).toHaveLength(3);
    s = ok(s, { type: 'pickCard', cardId: s.pending!.options[0] as string });
    expect(s.trophies).toContain('first_live');
    s = ok(s, { type: 'endWeek' });
    expect(s.week).toBe(5);
    expect(s.concerts.live1?.status).toBe('done');
  });
  it('不参加で週を終えても詰まらず「不参加」として記録される', () => {
    let s = skipTo(mk(), 4);
    s = ok(s, { type: 'endWeek' });
    expect(s.concerts.live1?.status).toBe('missed');
    expect(s.week).toBe(5);
    expect(blockReason(s, { type: 'startLive', mode: 'free' })).toBeTruthy();
  });
});

describe('トロフィー', () => {
  it('機能するトロフィーが7個以上あり、五大ドームはロックされた構想として取得不可', () => {
    expect(FUNCTIONAL_TROPHIES.length).toBeGreaterThanOrEqual(7);
    const dome = TROPHIES.find((t) => t.id === 'dome5')!;
    expect(dome.locked).toBe(true);
    const s = botPlayGame(randomOpts(5));
    expect(s.trophies).not.toContain('dome5');
    expect(s.trophies).toContain('finish');
  });
  it('各トロフィーの条件が状態から正しく判定される（資産/都市/スポット）', () => {
    let s = mk({ money: 999999, city: 'nagoya' });
    s = ok(s, { type: 'buyAsset', assetId: 'a1' });
    expect(s.trophies).toContain('asset_1');
    expect(s.trophies).not.toContain('asset_3');
    const rich = ok(mk({ money: 160000 }), { type: 'rest' });
    expect(rich.trophies).toContain('rich');
  });
});

describe('通しプレイ（ボット）', () => {
  it('複数シード・全推しタイプで12週を完走し、3公演の記録が残る', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = botPlayGame(randomOpts(seed * 101));
      expect(s.finished).toBe(true);
      expect(Object.values(s.concerts).every((c) => c.status !== 'pending')).toBe(true);
      expect(isDeckLegal(s.deck, s.collection)).toBe(true);
      expect(s.stats.liveAttended).toBeGreaterThanOrEqual(1);
    }
  });
  it('同じシード・同じ操作列なら結果が一致する（再現性）', () => {
    const a = botPlayGame({ oshi: 'solo', member: 'B', city: 'kyoto', seed: 99 });
    const b = botPlayGame({ oshi: 'solo', member: 'B', city: 'kyoto', seed: 99 });
    expect(a).toEqual(b);
  });
  it('1週ずつ進めても週数が単調に進む', () => {
    let s = newGame({ oshi: 'box', city: 'tokyo', seed: 3 });
    let prev = s.week;
    for (let i = 0; i < 12 && !s.finished; i++) {
      s = botPlayWeek(s);
      expect(s.week >= prev).toBe(true);
      prev = s.week;
    }
    expect(s.finished).toBe(true);
  });
});

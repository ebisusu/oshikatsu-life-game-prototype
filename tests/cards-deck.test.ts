import { describe, expect, it } from 'vitest';
import { CARDS, CARD_MAP } from '../src/game/data/cards';
import { describeEffect, effectSignature, EFFECTS } from '../src/game/effects';
import {
  autoFixDeck, countRarities, DECK_SIZE, isDeckLegal, starterCollection, totalCopies, validateDeck,
} from '../src/game/deck';
import { MEMBERS, type OshiType } from '../src/game/types';
import { CONCERTS } from '../src/game/data/world';
import { rand, seedFrom, shuffle } from '../src/game/rng';

describe('カードデータ', () => {
  it('40種で、レア度内訳が N12 / R14 / SR8 / SSR4 / UR2', () => {
    expect(CARDS).toHaveLength(40);
    const n = countRarities(CARDS.map((c) => c.id));
    expect(n).toEqual({ N: 12, R: 14, SR: 8, SSR: 4, UR: 2 });
  });
  it('IDと名前は一意で、全カードにメンバーA-H・曲タイプ・地域・コストがある', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(40);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(40);
    for (const c of CARDS) {
      expect(MEMBERS).toContain(c.member);
      expect(['call', 'unit', 'ballad', 'all']).toContain(c.songType);
      expect(c.region).toBeTruthy();
      expect(c.cost).toBeGreaterThanOrEqual(1);
      expect(c.cost).toBeLessThanOrEqual(3);
    }
  });
  it('4種類の系統がすべて存在し、各メンバーに5枚ずつある', () => {
    expect(new Set(CARDS.map((c) => c.kind))).toEqual(new Set(['action', 'support', 'combo', 'finisher']));
    for (const m of MEMBERS) expect(CARDS.filter((c) => c.member === m)).toHaveLength(5);
  });
  it('40枚すべての効果（署名）と説明文が異なる', () => {
    const sigs = new Set(CARDS.map((c) => effectSignature(c.effect)));
    expect(sigs.size).toBe(40);
    const texts = new Set(CARDS.map((c) => describeEffect(c.effect)));
    expect(texts.size).toBe(40);
  });
  it('効果は30種類以上のハンドラに分散し、全カードの効果IDがレジストリに実在する', () => {
    const ids = new Set(CARDS.map((c) => c.effect.id));
    expect(ids.size).toBeGreaterThanOrEqual(30);
    for (const id of ids) expect(EFFECTS[id]).toBeDefined();
  });
});

describe('デッキ編成ルール', () => {
  const full = Object.fromEntries(CARDS.map((c) => [c.id, 5]));
  it('20枚ちょうどでなければ違法', () => {
    expect(validateDeck(['c01', 'c01'], full).join()).toContain('20枚');
  });
  it('同名は2枚まで', () => {
    const deck = ['c01', 'c01', 'c01', ...CARDS.filter((c) => c.rarity === 'R').slice(0, 10).flatMap((c) => [c.id, c.id]).slice(0, 17)];
    expect(deck).toHaveLength(DECK_SIZE);
    expect(validateDeck(deck, full).some((e) => e.includes('同名2枚まで'))).toBe(true);
  });
  it('SR6 / SSR2 / UR1 の上限を守る', () => {
    const mk = (ids: string[]) => {
      const fill = CARDS.filter((c) => c.rarity === 'N' || c.rarity === 'R').map((c) => c.id);
      const deck = [...ids];
      for (const id of fill) { for (let k = 0; k < 2 && deck.length < DECK_SIZE; k++) deck.push(id); }
      return deck.slice(0, DECK_SIZE);
    };
    const srs = CARDS.filter((c) => c.rarity === 'SR').map((c) => c.id);
    expect(validateDeck(mk(srs.slice(0, 6)), full)).toEqual([]);
    expect(validateDeck(mk(srs.slice(0, 7)), full).some((e) => e.includes('SRは6枚'))).toBe(true);
    expect(validateDeck(mk(['c35', 'c36', 'c37']), full).some((e) => e.includes('SSRは2枚'))).toBe(true);
    expect(validateDeck(mk(['c39', 'c40']), full).some((e) => e.includes('URは1枚'))).toBe(true);
    expect(validateDeck(mk(['c39']), full)).toEqual([]);
  });
  it('所持数を超える編成は違法', () => {
    const col = { c01: 1 };
    const deck = Array(DECK_SIZE).fill('c01') as string[];
    expect(validateDeck(deck, col).length).toBeGreaterThan(0);
  });
  it('未知のIDは違法', () => {
    expect(validateDeck(Array(DECK_SIZE).fill('zzz') as string[])[0]).toContain('不明');
  });
});

describe('初期コレクションと自動調整', () => {
  const types: [OshiType, (typeof MEMBERS)[number] | null][] = [['solo', 'A'], ['solo', 'G'], ['combo', null], ['box', null]];
  for (const [oshi, member] of types) {
    it(`${oshi}${member ?? ''}: 20枚以上のコピーがあり、自動構成が合法`, () => {
      const col = starterCollection(oshi, member);
      expect(totalCopies(col)).toBeGreaterThanOrEqual(20);
      const deck = autoFixDeck(col, [], { oshi, member });
      expect(deck).toHaveLength(DECK_SIZE);
      expect(isDeckLegal(deck, col)).toBe(true);
    });
  }
  it('違法なデッキを渡すと合法部分を残して補完する', () => {
    const col = starterCollection('box', null);
    const bad = Array(DECK_SIZE).fill('c01') as string[];
    const fixed = autoFixDeck(col, bad, { oshi: 'box', member: null });
    expect(isDeckLegal(fixed, col)).toBe(true);
    expect(fixed.filter((id) => id === 'c01').length).toBeLessThanOrEqual(2);
  });
  it('単推しの自動構成は推しメンバーのカードを多く含む', () => {
    const col = starterCollection('solo', 'D');
    const deck = autoFixDeck(col, [], { oshi: 'solo', member: 'D' });
    expect(deck.filter((id) => CARD_MAP[id]?.member === 'D').length).toBeGreaterThanOrEqual(7);
  });
});

describe('公演データ', () => {
  it('3公演（週4,8,12）、CPUデッキは各20枚で合法', () => {
    expect(CONCERTS.map((c) => c.week)).toEqual([4, 8, 12]);
    for (const c of CONCERTS) {
      const deck = Object.entries(c.cpu.deck).flatMap(([id, n]) => Array(n).fill(id) as string[]);
      expect(deck).toHaveLength(DECK_SIZE);
      expect(validateDeck(deck)).toEqual([]);
      expect(c.setlist).toHaveLength(4);
    }
  });
});

describe('seeded RNG', () => {
  it('同じシードなら同じ列、shuffleも決定的', () => {
    const a = { rng: seedFrom(42) };
    const b = { rng: seedFrom(42) };
    expect([rand(a), rand(a), rand(a)]).toEqual([rand(b), rand(b), rand(b)]);
    const x = shuffle({ rng: 7 }, [1, 2, 3, 4, 5, 6]);
    const y = shuffle({ rng: 7 }, [1, 2, 3, 4, 5, 6]);
    expect(x).toEqual(y);
    expect([...x].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

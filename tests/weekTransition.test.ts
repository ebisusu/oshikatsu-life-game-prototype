import { describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/game/game';
import { TOTAL_WEEKS, type Action, type GameState } from '../src/game/state';
import { weekIntroData } from '../src/ui/weekTransition';

const mk = (over: Partial<GameState> = {}): GameState => ({ ...newGame({ oshi: 'box', city: 'tokyo', seed: 1 }), ...over });
const ok = (s: GameState, a: Action): GameState => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`rejected ${a.type}: ${r.reason}`);
  return r.state;
};

describe('weekIntroData（週開始アイキャッチの差分）', () => {
  it('収入・体力・APが endWeek 前後の状態と一致する', () => {
    const prev = ok(mk(), { type: 'work' });
    const next = ok(prev, { type: 'endWeek' });
    const d = weekIntroData(prev, next)!;
    expect(d.fromWeek).toBe(1);
    expect(d.week).toBe(2);
    expect(d.money).toEqual({ before: prev.money, after: next.money });
    expect(d.incomeTotal).toBe(next.money - prev.money);
    expect(d.income.reduce((a, r) => a + r.amount, 0)).toBe(d.incomeTotal);
    expect(d.stamina).toEqual({ before: prev.stamina, after: next.stamina, gain: next.stamina - prev.stamina });
    expect(d.ap).toEqual({ before: 2, after: 4 });
  });

  it('資産収入は内訳として別行になり、合計が実際の資金増加と一致する', () => {
    const prev = mk({ assets: ['a1', 'a5'] });
    const next = ok(prev, { type: 'endWeek' });
    const d = weekIntroData(prev, next)!;
    expect(d.income.map((r) => r.amount)).toEqual([2000, 2500, 3000]);
    expect(d.incomeTotal).toBe(7500);
    expect(d.income.reduce((a, r) => a + r.amount, 0)).toBe(next.money - prev.money);
  });

  it('体力が上限で頭打ちのときは実際の増加量を示す', () => {
    const prev = mk({ stamina: 95 });
    const next = ok(prev, { type: 'endWeek' });
    expect(weekIntroData(prev, next)!.stamina).toEqual({ before: 95, after: 100, gain: 5 });
  });

  it('公演週をスキップすると不参加として扱い、次週が公演週なら今週の予定に出る', () => {
    let s = mk();
    s = ok(s, { type: 'endWeek' });
    s = ok(s, { type: 'endWeek' });
    const prev = ok(s, { type: 'endWeek' });
    expect(prev.week).toBe(4);
    const d4 = weekIntroData(prev, ok(prev, { type: 'endWeek' }))!;
    expect(d4.missed?.name).toBe('春のはじまりライブ');
    expect(d4.thisWeek).toBeNull();
    expect(d4.next?.week).toBe(8);
    expect(d4.next?.weeksAway).toBe(3);
  });

  it('次の週が公演週なら thisWeek に公演名と会場を出す', () => {
    let s = mk();
    s = ok(s, { type: 'endWeek' });
    const prev = ok(s, { type: 'endWeek' });
    const next = ok(prev, { type: 'endWeek' });
    const d = weekIntroData(prev, next)!;
    expect(d.week).toBe(4);
    expect(d.thisWeek?.name).toBe('春のはじまりライブ');
    expect(d.missed).toBeNull();
    expect(d.next?.week).toBe(8);
  });

  it('最終週を終えたとき（結果画面）や週が進まないときは作らない', () => {
    const last = mk({ week: TOTAL_WEEKS, concerts: { ...mk().concerts } });
    for (const k of Object.keys(last.concerts)) last.concerts[k] = { status: 'missed' };
    const done = ok(last, { type: 'endWeek' });
    expect(done.finished).toBe(true);
    expect(weekIntroData(last, done)).toBeNull();
    expect(weekIntroData(done, done)).toBeNull();
  });
});

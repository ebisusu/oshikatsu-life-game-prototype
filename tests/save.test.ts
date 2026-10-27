import { describe, expect, it } from 'vitest';
import { botPlayLive } from '../src/game/bot';
import { applyAction, newGame } from '../src/game/game';
import {
  clearSave, loadGame, parseSave, SAVE_KEY, saveGame, serialize, validateState, type StorageLike,
} from '../src/game/save';
import type { GameState } from '../src/game/state';

class MemStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

const fresh = (): GameState => newGame({ oshi: 'solo', member: 'C', city: 'fukuoka', seed: 11 });
const ok = (s: GameState, a: Parameters<typeof applyAction>[1]): GameState => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
};

describe('セーブ/ロード', () => {
  it('保存して読み込むと完全に同じ状態に戻る', () => {
    const st = new MemStorage();
    let s = fresh();
    s = ok(s, { type: 'work' });
    s = ok(s, { type: 'explore', spotId: 'fukuoka-2' });
    expect(saveGame(st, s)).toBe(true);
    const r = loadGame(st);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.state).toEqual(s);
  });
  it('保存が無ければ none、クリアすると none に戻る', () => {
    const st = new MemStorage();
    expect(loadGame(st).status).toBe('none');
    saveGame(st, fresh());
    expect(loadGame(st).status).toBe('ok');
    clearSave(st);
    expect(loadGame(st).status).toBe('none');
  });
  it('ライブ進行中の状態も保存・復元できる', () => {
    let s = fresh();
    for (let i = 0; i < 3; i++) s = ok(s, { type: 'endWeek' }); // 週4（公演週）へ
    expect(s.week).toBe(4);
    s = ok(s, { type: 'startLive', mode: 'free' });
    s = ok(s, { type: 'liveEndPhase' });
    const st = new MemStorage();
    saveGame(st, s);
    const r = loadGame(st);
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.state.live?.phase).toBe('second');
      const done = botPlayLive(r.state);
      expect(done.concerts.live1?.status).toBe('done');
    }
  });
  it('壊れたJSONは invalid（クラッシュせず新規開始へフォールバックできる）', () => {
    const st = new MemStorage();
    st.setItem(SAVE_KEY, '{not json');
    const r = loadGame(st);
    expect(r.status).toBe('invalid');
    expect(parseSave('').status).toBe('invalid');
    expect(parseSave('null').status).toBe('invalid');
    expect(parseSave('[]').status).toBe('invalid');
  });
  it('バージョン違い・欠損・改ざんしたデータを拒否する', () => {
    const env = JSON.parse(serialize(fresh())) as { version: number; state: Record<string, unknown> };
    const withVersion = { ...env, version: 99 };
    expect(parseSave(JSON.stringify(withVersion)).status).toBe('invalid');
    const missing = { ...env, state: { ...env.state, collection: undefined } };
    expect(parseSave(JSON.stringify(missing)).status).toBe('invalid');
    const badDeck = { ...env, state: { ...env.state, deck: ['c01'] } };
    expect(parseSave(JSON.stringify(badDeck)).status).toBe('invalid');
    const badCity = { ...env, state: { ...env.state, city: 'atlantis' } };
    expect(parseSave(JSON.stringify(badCity)).status).toBe('invalid');
    const badWeek = { ...env, state: { ...env.state, week: 13 } };
    expect(parseSave(JSON.stringify(badWeek)).status).toBe('invalid');
    const negMoney = { ...env, state: { ...env.state, money: -5 } };
    expect(parseSave(JSON.stringify(negMoney)).status).toBe('invalid');
    const unknownCard = { ...env, state: { ...env.state, collection: { zzz: 1 } } };
    expect(parseSave(JSON.stringify(unknownCard)).status).toBe('invalid');
    expect(validateState(fresh())).toBeNull();
  });
  it('ストレージが例外を投げても落ちない', () => {
    const bad: StorageLike = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('quota'); },
      removeItem() { throw new Error('denied'); },
    };
    expect(loadGame(bad).status).toBe('invalid');
    expect(saveGame(bad, fresh())).toBe(false);
    expect(() => clearSave(bad)).not.toThrow();
    expect(loadGame(null).status).toBe('none');
    expect(saveGame(null, fresh())).toBe(false);
  });
  it('リセット相当: clear後に新規ゲームを作ると初期値に戻る', () => {
    const st = new MemStorage();
    saveGame(st, ok(fresh(), { type: 'work' }));
    clearSave(st);
    const s = fresh();
    expect([s.money, s.week, s.ap]).toEqual([60000, 1, 4]);
  });
});

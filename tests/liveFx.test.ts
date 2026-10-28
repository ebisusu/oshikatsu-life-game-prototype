import { describe, expect, it } from 'vitest';
import { applyAction, newGame } from '../src/game/game';
import { playBlockReason } from '../src/game/live';
import type { Action, GameState } from '../src/game/state';
import { weightedTenths } from '../src/game/live';
import { liveFxFor } from '../src/ui/liveFx';

const ok = (s: GameState, a: Action): GameState => {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`rejected ${a.type}: ${r.reason}`);
  return r.state;
};
const liveGame = (seed: number): GameState => {
  let s = newGame({ oshi: 'box', city: 'tokyo', seed });
  for (let i = 0; i < 3; i++) s = ok(s, { type: 'endWeek' });
  return ok(s, { type: 'startLive', mode: 'free' });
};
const playable = (s: GameState): number => s.live!.player.hand.findIndex((id) => !playBlockReason(s.live!, 'player', id));

describe('liveFxFor（ライブ演出の差分）', () => {
  it('カードを使うと、実際に増えた曲スコアとメーター増加量・カード名を返す', () => {
    const s0 = liveGame(11);
    const idx = playable(s0);
    expect(idx).toBeGreaterThanOrEqual(0);
    const s1 = ok(s0, { type: 'livePlay', handIndex: idx });
    const fx = liveFxFor(s0.live!, s1.live!)!;
    expect(fx.play).toBeTruthy();
    const delta = weightedTenths(s1.live!.player.song) - weightedTenths(s0.live!.player.song);
    expect(fx.play!.delta).toBe(delta);
    expect(fx.play!.gains).toEqual({
      h: s1.live!.player.song.h - s0.live!.player.song.h,
      u: s1.live!.player.song.u - s0.live!.player.song.u,
      m: s1.live!.player.song.m - s0.live!.player.song.m,
    });
    expect(fx.cpu).toBeUndefined();
  });

  it('フェーズを終えるとCPUが使ったカードと後半への進行が出る。状態が同じなら null', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s0 = liveGame(seed);
      const s1 = ok(s0, { type: 'liveEndPhase' });
      const fx = liveFxFor(s0.live!, s1.live!);
      expect(fx).not.toBeNull();
      expect(fx!.advance).toBe('後半スタート');
      const newCpu = s1.live!.cpu.history.length - s0.live!.cpu.history.length;
      expect(fx!.cpu?.cards.length ?? 0).toBe(newCpu);
      expect(fx!.play).toBeUndefined();
    }
    const s = liveGame(3);
    expect(liveFxFor(s.live!, s.live!)).toBeNull();
  });

  it('曲が終わると終了ログ（スコア）と次の曲を返す', () => {
    const before = ok(liveGame(5), { type: 'liveEndPhase' });
    const after = ok(before, { type: 'liveEndPhase' });
    const fx = liveFxFor(before.live!, after.live!)!;
    expect(fx.song).toContain('終了');
    expect(fx.advance).toContain('第2曲');
  });
});

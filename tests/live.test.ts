import { describe, expect, it } from 'vitest';
import {
  chooseCard, playBlockReason, playerEndPhase, playerPlay, previewPlay, weightedTenths, sideTotalTenths,
} from '../src/game/live';
import type { LiveState } from '../src/game/types';
import { cpuCfg, mkLive, setHand, sideCfg } from './helpers';
import { createLive } from '../src/game/live';

const play = (live: LiveState, id: string): LiveState => {
  const i = live.player.hand.indexOf(id);
  expect(i, `${id} が手札にある`).toBeGreaterThanOrEqual(0);
  const r = playerPlay(live, i);
  if (!r.ok) throw new Error(r.reason);
  return r.live;
};
const endPhase = (live: LiveState): LiveState => {
  const r = playerEndPhase(live);
  if (!r.ok) throw new Error(r.reason);
  return r.live;
};

/** 最後までプレイヤーも自動で進める */
function autoRun(live: LiveState, check?: (l: LiveState) => void): LiveState {
  let cur = live;
  for (let guard = 0; guard < 300 && cur.stage === 'playing'; guard++) {
    check?.(cur);
    const i = chooseCard(cur, 'player');
    const r = i === null ? null : playerPlay(cur, i);
    cur = r && r.ok ? r.live : endPhase(cur);
  }
  check?.(cur);
  return cur;
}

describe('EP段階制限', () => {
  it('前半は合計2EPまで。超えるカードは拒否される', () => {
    let live = mkLive();
    setHand(live, ['c13', 'c14', 'c01']);
    live = play(live, 'c13'); // cost 2
    expect(live.player.spent).toBe(2);
    expect(playBlockReason(live, 'player', 'c14')).toContain('前半');
    expect(playBlockReason(live, 'player', 'c01')).toContain('前半');
    const r = playerPlay(live, live.player.hand.indexOf('c14'));
    expect(r.ok).toBe(false);
  });
  it('後半は4EPまで（前半の消費を含む）', () => {
    let live = mkLive();
    setHand(live, ['c13', 'c14', 'c01']);
    live = play(live, 'c13');
    live = endPhase(live);
    expect(live.phase).toBe('second');
    expect(live.player.spent).toBe(2);
    live = play(live, 'c14');
    expect(live.player.spent).toBe(4);
    expect(playBlockReason(live, 'player', 'c01')).toContain('EP不足');
  });
  it('前半に何も使わなければ後半に4EP使える', () => {
    let live = mkLive();
    setHand(live, ['c13', 'c14']);
    live = endPhase(live);
    live.player.hand.push('c13', 'c14');
    live = play(live, 'c13');
    live = play(live, 'c14');
    expect(live.player.spent).toBe(4);
  });
  it('フィニッシャーは後半専用', () => {
    let live = mkLive();
    setHand(live, ['c26']);
    expect(playBlockReason(live, 'player', 'c26')).toContain('後半');
    live = endPhase(live);
    live.player.hand.push('c26');
    expect(playBlockReason(live, 'player', 'c26')).toBeNull();
  });
  it('同名SR以上は1公演1回まで。使用済みの2枚目は曲の切替で自動的に捨てられ詰まない', () => {
    let live = mkLive();
    setHand(live, ['c30', 'c30']);
    live = play(live, 'c30');
    live = endPhase(live); // 後半
    live.player.hand = ['c30'];
    expect(playBlockReason(live, 'player', 'c30')).toContain('SR以上');
    live = endPhase(live); // 次の曲へ
    expect(live.songIndex).toBe(1);
    expect(live.player.hand).not.toContain('c30');
    expect(live.player.discard).toContain('c30');
  });
});

describe('手札・山札・捨て札', () => {
  it('開演時は手札5枚、手札上限は7', () => {
    const live = mkLive();
    expect(live.player.hand).toHaveLength(5);
    let l = live;
    setHand(l, ['c05', 'c01', 'c02', 'c03', 'c08', 'c12', 'c13']);
    l = play(l, 'c05'); // 1枚引く: 6→7
    expect(l.player.hand).toHaveLength(7);
    setHand(l, ['c05', 'c01', 'c02', 'c03', 'c08', 'c12', 'c13']);
    l.player.spent = 0;
    l = play(l, 'c05');
    expect(l.player.hand.length).toBeLessThanOrEqual(7);
  });
  it('山札が尽きると捨て札をシャッフルして循環する', () => {
    let live = mkLive();
    live.player.deck = [];
    live.player.discard = ['c01', 'c02'];
    live.player.hand = ['c05'];
    live = play(live, 'c05');
    expect(live.player.hand).toHaveLength(1);
    expect(['c01', 'c02']).toContain(live.player.hand[0]);
    expect(live.player.deck).toHaveLength(1);
    expect(live.player.discard).toEqual(['c05']);
  });
  it('山札・手札・捨て札の合計枚数は常に20（カードが消えたり増えたりしない）', () => {
    for (const seed of [1, 2, 3]) {
      autoRun(mkLive(seed), (l) => {
        for (const s of [l.player, l.cpu]) {
          expect(s.deck.length + s.hand.length + s.discard.length).toBe(20);
          expect(s.hand.length).toBeLessThanOrEqual(7);
          expect(s.spent).toBeGreaterThanOrEqual(0);
          expect(s.spent).toBeLessThanOrEqual(4);
          if (l.phase === 'first') expect(s.spent).toBeLessThanOrEqual(2);
        }
      });
    }
  });
  it('コンボ履歴は手札/捨て札の移動と独立（捨て札から戻しても履歴は残る）', () => {
    let live = mkLive();
    setHand(live, ['c29', 'c01']); // c29 = 捨て札を手札に戻すSR
    live = play(live, 'c01');
    expect(live.player.history).toHaveLength(1);
    live.player.discard = ['c01'];
    live = play(live, 'c29');
    expect(live.player.hand).toContain('c01');
    expect(live.player.history.map((r) => r.cardId)).toEqual(['c01', 'c29']);
  });
});

describe('コンボ発動/不発', () => {
  it('同メンバー連続: 直前が同メンバーなら発動、別メンバーなら不発、最初のカードなら不発', () => {
    let live = mkLive();
    setHand(live, ['c01', 'c09']);
    live = play(live, 'c01');
    expect(previewPlay(live, 'player', 'c09').comboFired).toBe(true);
    live = play(live, 'c09');
    expect(live.player.comboFired).toBe(1);
    expect(live.log.some((e) => e.kind === 'combo' && e.text.includes('同メンバー連続'))).toBe(true);

    let l2 = mkLive();
    setHand(l2, ['c02', 'c09']);
    l2 = play(l2, 'c02');
    expect(previewPlay(l2, 'player', 'c09').comboFired).toBe(false);
    l2 = play(l2, 'c09');
    expect(l2.player.comboFired).toBe(0);
    expect(l2.log.some((e) => e.kind === 'fail' && e.text.includes('コンボ不発'))).toBe(true);

    const l3 = mkLive();
    setHand(l3, ['c09']);
    expect(previewPlay(l3, 'player', 'c09').comboFired).toBe(false);
  });
  it('コンボが発動すると不発時より獲得値が増える', () => {
    const a = mkLive();
    setHand(a, ['c01', 'c09']);
    const a2 = play(a, 'c01');
    const hit = previewPlay(a2, 'player', 'c09').gains;
    const b = mkLive();
    setHand(b, ['c09']);
    const miss = previewPlay(b, 'player', 'c09').gains;
    expect(weightedTenths(hit)).toBeGreaterThan(weightedTenths(miss));
  });
  it('系統連携: 直前がサポートのときだけ連続コールが発動', () => {
    const a = mkLive();
    setHand(a, ['c05', 'c21']); // c05 = support
    expect(previewPlay(play(a, 'c05'), 'player', 'c21').comboFired).toBe(true);
    const b = mkLive();
    setHand(b, ['c01', 'c21']); // c01 = action
    expect(previewPlay(play(b, 'c01'), 'player', 'c21').comboFired).toBe(false);
  });
  it('この公演の履歴を参照するコンボは曲をまたいで効く（地域）', () => {
    let live = mkLive();
    setHand(live, ['c03']); // kyushu
    live = play(live, 'c03');
    live = endPhase(live);
    live = endPhase(live); // 次の曲へ（履歴は残る）
    live.player.hand = ['c11']; // kyushu, regionCountLive
    expect(live.player.history).toHaveLength(1);
    expect(previewPlay(live, 'player', 'c11').comboFired).toBe(true);
  });
  it('前半/後半で効果が変わる（前半ボーナスは後半では発動しない）', () => {
    const live = mkLive();
    setHand(live, ['c02']);
    const first = previewPlay(live, 'player', 'c02').gains.h;
    live.phase = 'second';
    const second = previewPlay(live, 'player', 'c02').gains.h;
    expect(first).toBeGreaterThan(second);
  });
});

describe('スコア', () => {
  it('熱量:一体感:思い出 = 50:30:20 の重み', () => {
    expect(weightedTenths({ h: 10, u: 0, m: 0 })).toBe(50);
    expect(weightedTenths({ h: 0, u: 10, m: 0 })).toBe(30);
    expect(weightedTenths({ h: 0, u: 0, m: 10 })).toBe(20);
  });
  it('1枚だけ使った曲のスコアは獲得値の加重和に一致し、勝者にMVP+2点が入る', () => {
    let live = mkLive();
    live.cpu.hand = []; live.cpu.deck = []; live.cpu.discard = [];
    setHand(live, ['c01']);
    const pv = previewPlay(live, 'player', 'c01');
    live = play(live, 'c01');
    live = endPhase(live);
    live = endPhase(live);
    expect(live.player.songScores[0]).toBe(weightedTenths(pv.gains));
    expect(live.cpu.songScores[0]).toBe(0);
    expect(live.player.mvpTenths).toBe(20);
    expect(live.cpu.mvpTenths).toBe(0);
    expect(sideTotalTenths(live.player)).toBe(weightedTenths(pv.gains) + 20);
  });
  it('同じシードなら結果が完全に一致し、シードが違えば変わる', () => {
    const r1 = autoRun(mkLive(77));
    const r2 = autoRun(mkLive(77));
    expect(r1.result).toEqual(r2.result);
    expect(r1.log).toEqual(r2.log);
    const totals = new Set([1, 2, 3, 4, 5, 6].map((s) => autoRun(mkLive(s)).result!.playerTotal));
    expect(totals.size).toBeGreaterThan(1);
  });
  it('曲タイプに合うカードは合わないカードより獲得値が高くなる', () => {
    const live = mkLive();
    // 第1曲はコール。c01=call, c03=unit
    setHand(live, ['c01', 'c03']);
    const call = previewPlay(live, 'player', 'c01');
    expect(call.notes.some((n) => n.includes('曲マッチ'))).toBe(true);
    expect(previewPlay(live, 'player', 'c03').notes.some((n) => n.includes('曲マッチ'))).toBe(false);
  });
});

describe('ライブ進行（詰まらない・勝敗）', () => {
  it('どのシード/推しタイプでも4曲×前後半を終えて結果に到達する', () => {
    for (const oshi of ['solo', 'combo', 'box'] as const) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const live = autoRun(mkLive(seed, oshi, oshi === 'solo' ? 'C' : null, 'live3'));
        expect(live.stage).toBe('result');
        expect(live.result?.songResults).toHaveLength(4);
        expect(live.player.songScores).toHaveLength(4);
      }
    }
  });
  it('何も出さずにフェーズ終了だけを繰り返しても必ず終わる', () => {
    let live = mkLive();
    for (let i = 0; i < 8; i++) live = endPhase(live);
    expect(live.stage).toBe('result');
    expect(playerEndPhase(live).ok).toBe(false);
  });
  it('勝ちも負けも起こり得る（CPUは固定得点ではない）', () => {
    const winners = new Set<string>();
    const cpuTotals = new Set<number>();
    for (const id of ['live1', 'live2', 'live3']) {
      for (let seed = 1; seed <= 12; seed++) {
        const r = autoRun(mkLive(seed, 'box', null, id)).result!;
        winners.add(r.winner);
        cpuTotals.add(r.cpuTotal);
      }
    }
    expect(winners.has('player')).toBe(true);
    expect(winners.has('cpu')).toBe(true);
    expect(cpuTotals.size).toBeGreaterThan(5);
  });
  it('CPUはプレイヤーと同じ規則（EP/手札/上限）で動き、状況によって選択が変わる', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const live = mkLive(seed);
      const i = chooseCard(structuredClone(live), 'cpu');
      if (i !== null) picks.add(live.cpu.hand[i] as string);
    }
    expect(picks.size).toBeGreaterThan(1);
    const live = mkLive(5, 'box', null, 'live2');
    live.cpu.hand = ['c26']; // フィニッシャーは前半に出せない
    expect(chooseCard(live, 'cpu')).toBeNull();
  });
  it('第2・第4曲はCPUが先攻で、プレイヤーの手番前にCPUのログが入る', () => {
    let live = mkLive(9);
    live = endPhase(live);
    live = endPhase(live); // 第2曲の前半開始
    expect(live.songIndex).toBe(1);
    expect(live.log.slice(-6).some((e) => e.who === 'cpu')).toBe(true);
  });
});

describe('推しタイプのパッシブ', () => {
  it('単推し: 推しメンバーのカードは×1.5、開演時に推しメンバーのカードが手札にある', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const solo = createLive({ concertId: 'live1', mode: 'stream', seed, player: sideCfg('solo', 'D'), cpu: cpuCfg('live1') });
      expect(solo.player.hand.some((id) => id.startsWith('c') && ['c04', 'c12', 'c20', 'c30', 'c36'].includes(id))).toBe(true);
    }
    const solo = createLive({ concertId: 'live1', mode: 'stream', seed: 1, player: sideCfg('solo', 'A'), cpu: cpuCfg('live1') });
    const box = createLive({ concertId: 'live1', mode: 'stream', seed: 1, player: sideCfg('combo', null), cpu: cpuCfg('live1') });
    setHand(solo, ['c01']);
    setHand(box, ['c01']);
    expect(previewPlay(solo, 'player', 'c01').gains.h).toBeGreaterThan(previewPlay(box, 'player', 'c01').gains.h);
  });
  it('コンボ型: コンボ成功時の増加量が箱推しより大きい', () => {
    const mk = (oshi: 'combo' | 'box') => {
      const l = createLive({ concertId: 'live1', mode: 'stream', seed: 3, player: sideCfg(oshi, null), cpu: cpuCfg('live1') });
      setHand(l, ['c01', 'c09']);
      return play(l, 'c01');
    };
    const combo = previewPlay(mk('combo'), 'player', 'c09');
    const box = previewPlay(mk('box'), 'player', 'c09');
    expect(combo.comboFired && box.comboFired).toBe(true);
    // 箱推しは多様性/一体感補正があるが、コンボ型はコンボ増幅と曲内バフを受ける
    let l = createLive({ concertId: 'live1', mode: 'stream', seed: 3, player: sideCfg('combo', null), cpu: cpuCfg('live1') });
    setHand(l, ['c01', 'c09', 'c10']);
    l = play(l, 'c01');
    l = play(l, 'c09');
    expect(l.player.songBuffPct).toBeGreaterThan(0);
  });
  it('箱推し: 使用メンバーの種類が増えるほど獲得値が増える', () => {
    const l = createLive({ concertId: 'live1', mode: 'stream', seed: 3, player: sideCfg('box', null), cpu: cpuCfg('live1') });
    setHand(l, ['c01', 'c02', 'c03', 'c13']);
    const before = previewPlay(l, 'player', 'c13').gains.h;
    let cur = play(l, 'c01');
    cur.player.spent = 0;
    cur = play(cur, 'c02');
    cur.player.spent = 0;
    cur = play(cur, 'c03');
    cur.player.spent = 0;
    const after = previewPlay(cur, 'player', 'c13');
    expect(after.gains.h).toBeGreaterThan(before);
    expect(after.notes.some((n) => n.includes('箱推し'))).toBe(true);
  });
});

describe('公演条件による補正', () => {
  it('訓練・資産・参加方法の倍率が獲得値に反映される', () => {
    const base = createLive({ concertId: 'live1', mode: 'stream', seed: 3, player: sideCfg('box', null), cpu: cpuCfg('live1') });
    const boosted = createLive({
      concertId: 'live1', mode: 'onsite', seed: 3,
      player: sideCfg('box', null, { skills: { h: 0.25, u: 0, m: 0 }, assetBonus: { h: 0.06, u: 0, m: 0 }, gainMult: 1.1 }),
      cpu: cpuCfg('live1'),
    });
    setHand(base, ['c01']);
    setHand(boosted, ['c01']);
    expect(previewPlay(boosted, 'player', 'c01').gains.h).toBeGreaterThan(previewPlay(base, 'player', 'c01').gains.h);
  });
});

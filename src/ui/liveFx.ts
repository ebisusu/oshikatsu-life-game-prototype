// ライブ演出用の差分。操作前後の LiveState（実際のゲーム状態）だけから作る。推測値は使わない。
import { CARD_MAP, METERS, weightedTenths, type Gain3, type LiveState } from '../game';

export interface LiveFx {
  /** 自分のカード使用（livePlay）の結果 */
  play?: { card: string; rarity: string; delta: number; gains: Gain3; combo: string | null; comboMiss: string | null };
  /** CPU がこの操作の間に使ったカード（liveEndPhase 後） */
  cpu?: { cards: { name: string; rarity: string }[]; delta: number | null };
  /** 曲が終わったときの結果ログ */
  song?: string;
  /** 次の曲/後半に進んだ */
  advance?: string;
}

const gainsDiff = (a: Gain3, b: Gain3): Gain3 => ({ h: b.h - a.h, u: b.u - a.u, m: b.m - a.m });

/** before → after で実際に起きたことを要約する。変化が無ければ null。 */
export function liveFxFor(before: LiveState, after: LiveState): LiveFx | null {
  const fx: LiveFx = {};
  const sameSong = before.songIndex === after.songIndex;

  const newP = after.player.history.slice(before.player.history.length);
  if (newP.length) {
    const rec = newP[newP.length - 1]!;
    const logs = after.log.slice(before.log.length).filter((e) => e.who === 'player');
    const comboLog = logs.find((e) => e.kind === 'combo' && e.text.includes('コンボ「'));
    const missLog = logs.find((e) => e.kind === 'fail' && e.text.includes('コンボ不発'));
    const g = gainsDiff(before.player.song, after.player.song);
    fx.play = {
      card: CARD_MAP[rec.cardId]?.name ?? rec.cardId,
      rarity: rec.rarity,
      delta: sameSong ? weightedTenths(after.player.song) - weightedTenths(before.player.song) : weightedTenths(g),
      gains: g,
      combo: comboLog ? comboLog.text.trim() : null,
      comboMiss: missLog ? missLog.text.trim() : null,
    };
  }

  const newC = after.cpu.history.slice(before.cpu.history.length);
  if (newC.length) {
    fx.cpu = {
      cards: newC.map((r) => ({ name: CARD_MAP[r.cardId]?.name ?? r.cardId, rarity: r.rarity })),
      delta: sameSong ? weightedTenths(after.cpu.song) - weightedTenths(before.cpu.song) : null,
    };
  }

  const songEnd = after.log.slice(before.log.length).find((e) => e.kind === 'score' && e.text.includes('終了'));
  if (songEnd) fx.song = songEnd.text;
  if (!sameSong) fx.advance = `第${after.songIndex + 1}曲「${after.setlist[after.songIndex]?.name ?? ''}」`;
  else if (before.phase !== after.phase) fx.advance = '後半スタート';

  return fx.play || fx.cpu || fx.song || fx.advance ? fx : null;
}

export const sumGain = (g: Gain3): number => METERS.reduce((a, k) => a + g[k], 0);

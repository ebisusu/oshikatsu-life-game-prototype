import { autoFixDeck, starterCollection } from '../src/game/deck';
import { createLive, type SideConfig } from '../src/game/live';
import { CONCERT_MAP } from '../src/game/data/world';
import type { LiveState, OshiType } from '../src/game/types';

export function sideCfg(oshi: OshiType = 'box', member: SideConfig['member'] = null, over: Partial<SideConfig> = {}): SideConfig {
  const col = starterCollection(oshi, member);
  return {
    name: 'あなた', oshi, member, deck: autoFixDeck(col, [], { oshi, member }),
    skills: { h: 0, u: 0, m: 0 }, assetBonus: { h: 0, u: 0, m: 0 }, gainMult: 1, startHand: 5, ...over,
  };
}

export function cpuCfg(concertId = 'live1'): SideConfig {
  const c = CONCERT_MAP[concertId]!.cpu;
  const deck: string[] = [];
  for (const [id, n] of Object.entries(c.deck)) for (let i = 0; i < n; i++) deck.push(id);
  return {
    name: 'CPU', oshi: c.oshi, member: c.member, deck, skills: { h: 0, u: 0, m: 0 },
    assetBonus: { h: 0, u: 0, m: 0 }, gainMult: c.gainMult, startHand: 5,
  };
}

export function mkLive(seed = 123, oshi: OshiType = 'box', member: SideConfig['member'] = null, concertId = 'live1'): LiveState {
  return createLive({ concertId, mode: 'stream', seed, player: sideCfg(oshi, member), cpu: cpuCfg(concertId) });
}

/** 手札を指定カードに差し替える（テスト用に状態を直接書き換える） */
export function setHand(live: LiveState, ids: string[]): void {
  live.player.hand = [...ids];
}

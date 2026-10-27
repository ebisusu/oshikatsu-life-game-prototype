// テスト/バランス調整用の自動プレイヤー（UIでは使わない）。エンジンの公開API経由でのみ操作する。
import { getCard, RARITY_ORDER } from './data/cards';
import { SPOTS } from './data/world';
import { autoFixDeck } from './deck';
import { applyAction, currentConcert, liveCostFor, neighbors, newGame, type NewGameOpts } from './game';
import { chooseCard } from './live';
import { rand } from './rng';
import type { Action, GameState } from './state';
import { MEMBERS, type LiveMode, type Meter } from './types';

function must(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`bot action rejected: ${a.type} ${r.reason}`);
  return r.state;
}
const tryDo = (s: GameState, a: Action): GameState => {
  const r = applyAction(s, a);
  return r.ok ? r.state : s;
};

export function botPickCard(s: GameState): GameState {
  if (!s.pending) return s;
  const best = [...s.pending.options].sort((a, b) => {
    const ca = getCard(a);
    const cb = getCard(b);
    const sa = RARITY_ORDER[ca.rarity] * 10 + ((s.collection[a] ?? 0) < 2 ? 5 : 0) + (ca.member === s.oshiMember ? 6 : 0);
    const sb = RARITY_ORDER[cb.rarity] * 10 + ((s.collection[b] ?? 0) < 2 ? 5 : 0) + (cb.member === s.oshiMember ? 6 : 0);
    return sb - sa;
  })[0] as string;
  return must(s, { type: 'pickCard', cardId: best });
}

/** ライブを最後まで進め、報酬を受け取る（カード選択まで） */
export function botPlayLive(s: GameState): GameState {
  let cur = s;
  for (let guard = 0; guard < 200 && cur.live && cur.live.stage === 'playing'; guard++) {
    const i = chooseCard(cur.live, 'player');
    const r = i === null ? null : applyAction(cur, { type: 'livePlay', handIndex: i });
    if (r && r.ok) cur = r.state;
    else cur = must(cur, { type: 'liveEndPhase' });
  }
  if (cur.live?.stage === 'result') cur = must(cur, { type: 'liveClaim' });
  return botPickCard(cur);
}

export function botRefreshDeck(s: GameState): GameState {
  const deck = autoFixDeck(s.collection, [], { oshi: s.oshi, member: s.oshiMember });
  return tryDo(s, { type: 'setDeck', deck });
}

function bestMode(s: GameState): LiveMode {
  for (const mode of ['onsite', 'stream', 'free'] as const) {
    const c = liveCostFor(s, mode);
    if (c && s.ap >= c.ap && s.money >= c.money && s.stamina >= c.stamina) return mode;
  }
  return 'free';
}

/** 1週間を無難に過ごして週を終える */
export function botPlayWeek(s: GameState): GameState {
  let cur = botPickCard(s);
  cur = botRefreshDeck(cur);
  const concert = currentConcert(cur);
  if (concert && cur.concerts[concert.id]?.status === 'pending') {
    cur = must(cur, { type: 'startLive', mode: bestMode(cur) });
    cur = botPlayLive(cur);
  }
  for (let guard = 0; guard < 12 && cur.ap > 0; guard++) {
    const before = cur;
    if (cur.stamina < 25) cur = tryDo(cur, { type: 'rest' });
    else if (cur.week % 2 === 1 && cur.ap >= 2 && cur.stamina >= 12) cur = tryDo(cur, { type: 'work' });
    else {
      const spot = SPOTS.find((sp) => sp.city === cur.city && !cur.visitedSpots.includes(sp.id));
      if (spot) cur = tryDo(cur, { type: 'explore', spotId: spot.id });
      if (cur === before) {
        const train: Meter = (['h', 'u', 'm'] as const)[guard % 3] as Meter;
        cur = tryDo(cur, { type: 'train', skill: train });
      }
      if (cur === before) {
        const next = neighbors(cur.city).find((n) => !cur.visitedCities.includes(n.to)) ?? neighbors(cur.city)[0];
        if (next) cur = tryDo(cur, { type: 'move', to: next.to });
      }
    }
    cur = botPickCard(cur);
    if (cur === before) break;
  }
  return must(cur, { type: 'endWeek' });
}

export function botPlayGame(opts: NewGameOpts): GameState {
  let s = newGame(opts);
  for (let guard = 0; guard < 20 && !s.finished; guard++) s = botPlayWeek(s);
  return s;
}

/** シードからランダムに近い設定を作る（テスト用） */
export function randomOpts(seed: number): NewGameOpts {
  const box = { rng: seed };
  const oshi = (['solo', 'combo', 'box'] as const)[Math.floor(rand(box) * 3)] as NewGameOpts['oshi'];
  const member = MEMBERS[Math.floor(rand(box) * 8)] as NewGameOpts['member'];
  const cities = ['tokyo', 'osaka', 'fukuoka', 'sapporo', 'nagoya'] as const;
  return { oshi, member, city: cities[Math.floor(rand(box) * cities.length)] as NewGameOpts['city'], seed };
}

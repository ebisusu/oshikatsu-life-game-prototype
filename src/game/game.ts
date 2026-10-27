// ゲーム進行ロジック（pure）。UIからは applyAction(state, action) だけを呼ぶ。
// 不足・不正は ok:false で拒否し、状態は変更しない。
import { CARDS, getCard } from './data/cards';
import { evaluateTrophies, TROPHY_MAP } from './data/trophies';
import {
  ASSET_MAP, ASSETS, CITY_MAP, CONCERTS, CONCERT_MAP, ROUTES, SPOT_MAP, SPOTS, type CpuCfg, type RouteDef,
} from './data/world';
import { autoFixDeck, starterCollection, validateDeck } from './deck';
import { createLive, playerEndPhase, playerPlay, type SideConfig } from './live';
import { pickWeighted, rand, seedFrom } from './rng';
import {
  AP_PER_WEEK, BUY_AP, EXPLORE_AP, LIVE_COST, LIVE_GAIN_MULT, LIVE_REWARD_MULT, MAX_STAMINA, MOVE_STAMINA,
  REST_AP, REST_STAMINA, START_MONEY, START_STAMINA, TOTAL_WEEKS, TRAIN_AP, TRAIN_MAX, TRAIN_STAMINA, WEEK_INCOME,
  WEEK_STAMINA, WORK_AP, WORK_INCOME, WORK_STAMINA, trainCost, type Action, type ActionResult, type GameState,
} from './state';
import type { CityId, Gain3, LiveMode, MemberId, Meter, OshiType, RegionId, Rarity, SongType } from './types';
import { MEMBERS, METERS, METER_LABEL } from './types';

export const yen = (n: number): string => `¥${Math.round(n).toLocaleString('ja-JP')}`;

// ---------- 新規ゲーム ----------
export interface NewGameOpts {
  oshi: OshiType;
  member?: MemberId | null;
  city: CityId;
  seed?: number | string;
  name?: string;
}

export function newGame(opts: NewGameOpts): GameState {
  const seed = seedFrom(opts.seed ?? Date.now());
  const member = opts.oshi === 'solo' ? (opts.member && MEMBERS.includes(opts.member) ? opts.member : 'A') : null;
  const collection = starterCollection(opts.oshi, member);
  const deck = autoFixDeck(collection, [], { oshi: opts.oshi, member });
  const concerts: GameState['concerts'] = {};
  for (const c of CONCERTS) concerts[c.id] = { status: 'pending' };
  const s: GameState = {
    version: 1, seed, rng: seed, name: (opts.name ?? '').trim().slice(0, 12) || 'あなた',
    oshi: opts.oshi, oshiMember: member, startCity: opts.city,
    week: 1, ap: AP_PER_WEEK, money: START_MONEY, stamina: START_STAMINA, city: opts.city,
    collection, deck, newCards: [], visitedSpots: [], visitedCities: [opts.city], souvenirs: [], assets: [],
    skills: { h: 0, u: 0, m: 0 }, pending: null, concerts, live: null, trophies: [], log: [],
    stats: {
      worked: 0, explored: 0, moved: 0, trained: 0, rested: 0, combos: 0, bestLiveCombos: 0,
      liveAttended: 0, liveWins: 0, cardsFound: 0, moneyPeak: START_MONEY,
    },
    finished: false,
  };
  note(s, `${CITY_MAP[opts.city].name}から12週間の推し活が始まった！`);
  return s;
}

function note(s: GameState, text: string): void {
  s.log.push(`第${s.week}週 ${text}`);
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
}

// ---------- 経路 ----------
export function neighbors(city: CityId): { to: CityId; route: RouteDef }[] {
  const out: { to: CityId; route: RouteDef }[] = [];
  for (const r of ROUTES) {
    if (r.a === city) out.push({ to: r.b, route: r });
    else if (r.b === city) out.push({ to: r.a, route: r });
  }
  return out;
}

export function routeBetween(a: CityId, b: CityId): RouteDef | null {
  return ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) ?? null;
}

/** AP最小→費用最小の最短経路（ダイクストラ） */
export function shortestPath(from: CityId, to: CityId): { path: CityId[]; ap: number; money: number } | null {
  if (from === to) return { path: [from], ap: 0, money: 0 };
  const cost = (ap: number, money: number) => ap * 1_000_000 + money;
  const best = new Map<CityId, { c: number; ap: number; money: number; prev: CityId | null }>();
  best.set(from, { c: 0, ap: 0, money: 0, prev: null });
  const done = new Set<CityId>();
  for (;;) {
    let cur: CityId | null = null;
    let curC = Infinity;
    for (const [id, v] of best) if (!done.has(id) && v.c < curC) { cur = id; curC = v.c; }
    if (cur === null) break;
    if (cur === to) break;
    done.add(cur);
    const here = best.get(cur) as { ap: number; money: number };
    for (const { to: nx, route } of neighbors(cur)) {
      const ap = here.ap + route.ap;
      const money = here.money + route.money;
      const c = cost(ap, money);
      const old = best.get(nx);
      if (!old || c < old.c) best.set(nx, { c, ap, money, prev: cur });
    }
  }
  const end = best.get(to);
  if (!end) return null;
  const path: CityId[] = [];
  let p: CityId | null = to;
  while (p) { path.unshift(p); p = best.get(p)?.prev ?? null; }
  return { path, ap: end.ap, money: end.money };
}

// ---------- カード抽選 ----------
export type RarityWeights = Record<Rarity, number>;
export const TIER_WEIGHTS: Record<1 | 2 | 3, RarityWeights> = {
  1: { N: 45, R: 40, SR: 12, SSR: 2.5, UR: 0.5 },
  2: { N: 25, R: 40, SR: 25, SSR: 8, UR: 2 },
  3: { N: 10, R: 35, SR: 35, SSR: 15, UR: 5 },
};
export const WIN_REWARD_WEIGHTS: RarityWeights = { N: 0, R: 30, SR: 45, SSR: 20, UR: 5 };
export const LOSE_REWARD_WEIGHTS: RarityWeights = { N: 15, R: 55, SR: 26, SSR: 4, UR: 0 };

export interface ChoiceBias {
  region?: RegionId;
  members?: MemberId[];
  songType?: SongType;
}

/** 重複なしで3枚。地域/メンバー/曲タイプが合うと出やすく、既に2枚持っているカードは出にくい */
export function rollChoices(
  box: { rng: number }, collection: Record<string, number>, weights: RarityWeights, bias: ChoiceBias, n = 3,
): string[] {
  const pool = CARDS.filter((c) => weights[c.rarity] > 0);
  const picked: string[] = [];
  for (let k = 0; k < n; k++) {
    const left = pool.filter((c) => !picked.includes(c.id));
    const ws = left.map((c) => {
      let w = weights[c.rarity];
      if (bias.region && c.region === bias.region) w *= 3;
      if (bias.members?.includes(c.member)) w *= 2.5;
      if (bias.songType && c.songType === bias.songType) w *= 1.8;
      if ((collection[c.id] ?? 0) >= 2) w *= 0.4;
      return w;
    });
    picked.push((left[pickWeighted(box, ws)] ?? (left[0] as { id: string })).id);
  }
  return picked;
}

// ---------- ゲート判定 ----------
export function liveCostFor(s: GameState, mode: LiveMode): { ap: number; money: number; stamina: number; path: CityId[] } | null {
  const base = LIVE_COST[mode];
  if (mode !== 'onsite') return { ap: base.ap, money: base.money, stamina: base.stamina, path: [] };
  const concert = currentConcert(s);
  if (!concert) return null;
  const sp = shortestPath(s.city, concert.city);
  if (!sp) return null;
  return { ap: base.ap + sp.ap, money: base.money + sp.money, stamina: base.stamina + sp.path.length - 1, path: sp.path };
}

export function currentConcert(s: GameState) {
  return CONCERTS.find((c) => c.week === s.week) ?? null;
}

export function blockReason(s: GameState, a: Action): string | null {
  if (a.type === 'markCardsSeen') return null;
  if (s.finished) return '12週が終了しました';
  if (s.pending) return a.type === 'pickCard' ? null : '先に獲得カードを1枚選んでください';
  if (a.type === 'pickCard') return '選択中のカード報酬がありません';
  if (s.live) {
    const liveOk = a.type === 'livePlay' || a.type === 'liveEndPhase' || a.type === 'liveClaim';
    if (!liveOk) return 'ライブ中です。ライブを最後まで進めてください';
  } else if (a.type === 'livePlay' || a.type === 'liveEndPhase' || a.type === 'liveClaim') {
    return 'ライブ中ではありません';
  }
  switch (a.type) {
    case 'work':
      if (s.ap < WORK_AP) return `APが足りません（必要${WORK_AP}）`;
      if (s.stamina < WORK_STAMINA) return `体力が足りません（必要${WORK_STAMINA}）。休息しましょう`;
      return null;
    case 'rest':
      if (s.ap < REST_AP) return `APが足りません（必要${REST_AP}）`;
      if (s.stamina >= MAX_STAMINA) return '体力は満タンです';
      return null;
    case 'train': {
      const lv = s.skills[a.skill];
      if (lv >= TRAIN_MAX) return `${METER_LABEL[a.skill]}は最大レベルです`;
      if (s.ap < TRAIN_AP) return 'APが足りません（必要1）';
      if (s.money < trainCost(lv)) return `資金が足りません（必要${yen(trainCost(lv))}）`;
      if (s.stamina < TRAIN_STAMINA) return `体力が足りません（必要${TRAIN_STAMINA}）`;
      return null;
    }
    case 'move': {
      const r = routeBetween(s.city, a.to);
      if (!r) return 'その都市へは直通経路がありません';
      if (s.ap < r.ap) return `APが足りません（必要${r.ap}）`;
      if (s.money < r.money) return `資金が足りません（必要${yen(r.money)}）`;
      if (s.stamina < MOVE_STAMINA) return `体力が足りません（必要${MOVE_STAMINA}）`;
      return null;
    }
    case 'explore': {
      const sp = SPOT_MAP[a.spotId];
      if (!sp) return '不明なスポットです';
      if (sp.city !== s.city) return 'このスポットは別の都市にあります';
      if (s.visitedSpots.includes(sp.id)) return 'このスポットは探索済みです';
      if (s.ap < EXPLORE_AP) return 'APが足りません（必要1）';
      if (s.money < sp.fee) return `資金が足りません（入場費${yen(sp.fee)}）`;
      if (s.stamina < sp.stamina) return `体力が足りません（必要${sp.stamina}）`;
      return null;
    }
    case 'buyAsset': {
      const as = ASSET_MAP[a.assetId];
      if (!as) return '不明な資産です';
      if (as.city !== s.city) return `この資産は${CITY_MAP[as.city].name}で購入できます`;
      if (s.assets.includes(as.id)) return '購入済みです';
      if (s.ap < BUY_AP) return 'APが足りません（必要1）';
      if (s.money < as.price) return `資金が足りません（必要${yen(as.price)}）`;
      return null;
    }
    case 'endWeek':
      return null;
    case 'setDeck': {
      const errs = validateDeck(a.deck, s.collection);
      return errs.length ? errs[0] as string : null;
    }
    case 'autoDeck':
    case 'resetDeck':
      return null;
    case 'startLive': {
      const concert = currentConcert(s);
      if (!concert) return '今週は公演がありません';
      if ((s.concerts[concert.id]?.status ?? 'pending') !== 'pending') return 'この公演は終了しています';
      const errs = validateDeck(s.deck, s.collection);
      if (errs.length) return `デッキが不正です：${errs[0]}`;
      const cost = liveCostFor(s, a.mode);
      if (!cost) return '会場への経路がありません';
      if (s.ap < cost.ap) return `APが足りません（必要${cost.ap}）`;
      if (s.money < cost.money) return `資金が足りません（必要${yen(cost.money)}）`;
      if (s.stamina < cost.stamina) return `体力が足りません（必要${cost.stamina}）`;
      return null;
    }
    case 'livePlay':
    case 'liveEndPhase':
    case 'liveClaim':
      return null;
    default:
      return '不明な操作です';
  }
}

// ---------- ライブ設定 ----------
function sideAssetBonus(s: GameState): Gain3 {
  const b: Gain3 = { h: 0, u: 0, m: 0 };
  for (const id of s.assets) {
    const as = ASSET_MAP[id];
    if (!as) continue;
    for (const k of METERS) b[k] += as.liveBonus[k] ?? 0;
  }
  return b;
}

export function staminaFit(stamina: number): number {
  return stamina >= 70 ? 1.05 : stamina < 30 ? 0.9 : 1;
}

function cpuSide(cpu: CpuCfg): SideConfig {
  const deck: string[] = [];
  for (const [id, n] of Object.entries(cpu.deck)) for (let i = 0; i < n; i++) deck.push(id);
  return {
    name: 'CPU', oshi: cpu.oshi, member: cpu.member, deck, skills: { h: 0, u: 0, m: 0 },
    assetBonus: { h: 0, u: 0, m: 0 }, gainMult: cpu.gainMult, startHand: 5,
  };
}

// ---------- 週末処理など ----------
function refreshTrophies(s: GameState): void {
  s.stats.moneyPeak = Math.max(s.stats.moneyPeak, s.money);
  const now = evaluateTrophies(s);
  for (const id of now) {
    if (!s.trophies.includes(id)) {
      s.trophies.push(id);
      note(s, `🏆 トロフィー獲得：${TROPHY_MAP[id]?.name}`);
    }
  }
}

function endWeek(s: GameState): void {
  const concert = currentConcert(s);
  if (concert && s.concerts[concert.id]?.status === 'pending') {
    s.concerts[concert.id] = { status: 'missed' };
    note(s, `「${concert.name}」には参加しなかった。`);
  }
  const income = WEEK_INCOME + s.assets.reduce((a, id) => a + (ASSET_MAP[id]?.weeklyIncome ?? 0), 0);
  s.money += income;
  s.stamina = Math.min(MAX_STAMINA, s.stamina + WEEK_STAMINA);
  note(s, `週末：収入${yen(income)}、体力+${WEEK_STAMINA}。`);
  if (s.week >= TOTAL_WEEKS) {
    s.finished = true;
    s.ap = 0;
    note(s, '12週間の推し活が終了した！');
  } else {
    s.week++;
    s.ap = AP_PER_WEEK;
    const next = currentConcert(s);
    if (next) note(s, `今週は「${next.name}」の開催週！ ライブ画面から参加できます。`);
  }
}

// ---------- メイン ----------
export function applyAction(state: GameState, a: Action): ActionResult {
  const reason = blockReason(state, a);
  if (reason) return { ok: false, reason };
  const s = structuredClone(state);
  switch (a.type) {
    case 'work':
      s.ap -= WORK_AP; s.stamina -= WORK_STAMINA; s.money += WORK_INCOME; s.stats.worked++;
      note(s, `仕事をして${yen(WORK_INCOME)}を稼いだ。`);
      break;
    case 'rest':
      s.ap -= REST_AP; s.stamina = Math.min(MAX_STAMINA, s.stamina + REST_STAMINA); s.stats.rested++;
      note(s, `ゆっくり休息した（体力+${REST_STAMINA}）。`);
      break;
    case 'train': {
      const lv = s.skills[a.skill];
      s.ap -= TRAIN_AP; s.stamina -= TRAIN_STAMINA; s.money -= trainCost(lv);
      s.skills[a.skill] = lv + 1; s.stats.trained++;
      note(s, `${METER_LABEL[a.skill]}の応援力を訓練（Lv${lv + 1}）。ライブの${METER_LABEL[a.skill]}+5%。`);
      break;
    }
    case 'move': {
      const r = routeBetween(s.city, a.to) as RouteDef;
      s.ap -= r.ap; s.money -= r.money; s.stamina -= MOVE_STAMINA; s.stats.moved++;
      s.city = a.to;
      if (!s.visitedCities.includes(a.to)) s.visitedCities.push(a.to);
      note(s, `${r.mode}で${CITY_MAP[a.to].name}へ移動（${r.ap}AP・${yen(r.money)}）。`);
      break;
    }
    case 'explore': {
      const sp = SPOT_MAP[a.spotId] as (typeof SPOTS)[number];
      s.ap -= EXPLORE_AP; s.money -= sp.fee; s.stamina -= sp.stamina;
      s.visitedSpots.push(sp.id); s.stats.explored++;
      if (!s.souvenirs.includes(sp.souvenir)) s.souvenirs.push(sp.souvenir);
      if (sp.reward.money) s.money += sp.reward.money;
      if (sp.reward.stamina) s.stamina = Math.min(MAX_STAMINA, s.stamina + sp.reward.stamina);
      const opts = rollChoices(s, s.collection, TIER_WEIGHTS[sp.tier], {
        region: CITY_MAP[sp.city].region, members: sp.members, songType: sp.songType,
      });
      s.pending = { source: `${sp.name}の探索`, options: opts };
      note(s, `「${sp.name}」を探索。収集品「${sp.souvenir}」を入手。`);
      break;
    }
    case 'pickCard': {
      const p = s.pending as NonNullable<GameState['pending']>;
      if (!p.options.includes(a.cardId)) return { ok: false, reason: '候補にないカードです' };
      s.collection[a.cardId] = (s.collection[a.cardId] ?? 0) + 1;
      if (!s.newCards.includes(a.cardId)) s.newCards.push(a.cardId);
      s.stats.cardsFound++;
      s.pending = null;
      note(s, `カード「${getCard(a.cardId).name}」[${getCard(a.cardId).rarity}]を獲得。`);
      break;
    }
    case 'buyAsset': {
      const as = ASSET_MAP[a.assetId] as (typeof ASSETS)[number];
      s.ap -= BUY_AP; s.money -= as.price; s.assets.push(as.id);
      note(s, `ゲーム内資産「${as.name}」を購入（${yen(as.price)}）。※架空の資産です。`);
      break;
    }
    case 'endWeek':
      endWeek(s);
      break;
    case 'setDeck':
      s.deck = [...a.deck];
      note(s, 'デッキを保存した。');
      break;
    case 'autoDeck':
      s.deck = autoFixDeck(s.collection, s.deck, { oshi: s.oshi, member: s.oshiMember });
      note(s, 'デッキを自動調整した。');
      break;
    case 'resetDeck':
      s.deck = autoFixDeck(s.collection, [], { oshi: s.oshi, member: s.oshiMember });
      note(s, 'デッキをおすすめ構成にリセットした。');
      break;
    case 'markCardsSeen':
      s.newCards = [];
      break;
    case 'startLive': {
      const concert = currentConcert(s) as NonNullable<ReturnType<typeof currentConcert>>;
      const cost = liveCostFor(s, a.mode) as NonNullable<ReturnType<typeof liveCostFor>>;
      s.ap -= cost.ap; s.money -= cost.money; s.stamina -= cost.stamina;
      if (a.mode === 'onsite') {
        s.city = concert.city;
        if (!s.visitedCities.includes(concert.city)) s.visitedCities.push(concert.city);
        const sv = `${concert.name}の公演パンフレット`;
        if (!s.souvenirs.includes(sv)) s.souvenirs.push(sv);
      }
      const extraHand = s.assets.reduce((n, id) => n + (ASSET_MAP[id]?.extraHand ?? 0), 0);
      const fit = staminaFit(s.stamina);
      const seed = Math.floor(rand(s) * 4294967296) || 1;
      s.live = createLive({
        concertId: concert.id, mode: a.mode, seed,
        player: {
          name: 'あなた', oshi: s.oshi, member: s.oshiMember, deck: [...s.deck],
          skills: { h: s.skills.h * 0.05, u: s.skills.u * 0.05, m: s.skills.m * 0.05 },
          assetBonus: sideAssetBonus(s), gainMult: LIVE_GAIN_MULT[a.mode] * fit, startHand: 5 + extraHand,
        },
        cpu: cpuSide(concert.cpu),
      });
      note(s, `${LIVE_COST[a.mode].label}で「${concert.name}」に臨む！（体力補正×${fit}）`);
      break;
    }
    case 'livePlay': {
      const r = playerPlay(s.live as NonNullable<GameState['live']>, a.handIndex);
      if (!r.ok) return { ok: false, reason: r.reason };
      s.live = r.live;
      break;
    }
    case 'liveEndPhase': {
      const r = playerEndPhase(s.live as NonNullable<GameState['live']>);
      if (!r.ok) return { ok: false, reason: r.reason };
      s.live = r.live;
      break;
    }
    case 'liveClaim': {
      const live = s.live as NonNullable<GameState['live']>;
      if (live.stage !== 'result' || !live.result) return { ok: false, reason: 'ライブがまだ終わっていません' };
      claimLive(s);
      break;
    }
  }
  refreshTrophies(s);
  return { ok: true, state: s };
}

export function liveMoneyReward(idx: number, winner: 'player' | 'cpu' | 'draw', targetReached: boolean, mode: LiveMode): number {
  let base = winner === 'player' ? 20000 + 8000 * idx : winner === 'draw' ? 10000 + 2000 * idx : 8000 + 2000 * idx;
  if (targetReached) base += 8000;
  return Math.round((base * LIVE_REWARD_MULT[mode]) / 100) * 100;
}

function claimLive(s: GameState): void {
  const live = s.live as NonNullable<GameState['live']>;
  const result = live.result as NonNullable<typeof live.result>;
  const concert = CONCERT_MAP[live.concertId] as (typeof CONCERTS)[number];
  const idx = CONCERTS.findIndex((c) => c.id === concert.id);
  const money = liveMoneyReward(idx, result.winner, result.targetReached, live.mode);
  s.money += money;
  s.stats.liveAttended++;
  if (result.winner === 'player') s.stats.liveWins++;
  s.stats.combos += live.player.comboFired;
  s.stats.bestLiveCombos = Math.max(s.stats.bestLiveCombos, live.player.comboFired);
  s.concerts[concert.id] = {
    status: 'done', mode: live.mode, winner: result.winner,
    playerTotal: result.playerTotal, cpuTotal: result.cpuTotal, targetReached: result.targetReached, moneyReward: money,
  };
  const weights = result.winner === 'player' ? WIN_REWARD_WEIGHTS : LOSE_REWARD_WEIGHTS;
  const opts = rollChoices(s, s.collection, weights, {
    region: CITY_MAP[concert.city].region, members: s.oshiMember ? [s.oshiMember] : undefined,
  });
  s.pending = { source: `${concert.name}の報酬`, options: opts };
  const verdict = result.winner === 'player' ? '勝利' : result.winner === 'draw' ? '引き分け' : '惜敗';
  note(s, `「${concert.name}」${verdict}！ 報酬${yen(money)}${result.targetReached ? '（目標達成ボーナス込み）' : ''}。`);
  s.live = null;
}

// ---------- 最終リザルト ----------
export interface FinalSummary {
  score: number;
  rank: 'S' | 'A' | 'B' | 'C';
  parts: { label: string; value: number }[];
}

export function finalSummary(s: GameState): FinalSummary {
  const owned = Object.values(s.collection).filter((n) => n > 0).length;
  const parts = [
    { label: `トロフィー ${s.trophies.length}個`, value: s.trophies.length * 100 },
    { label: `ライブ勝利 ${s.stats.liveWins}回`, value: s.stats.liveWins * 400 },
    { label: `目標達成 ${Object.values(s.concerts).filter((c) => c.targetReached).length}回`, value: Object.values(s.concerts).filter((c) => c.targetReached).length * 250 },
    { label: `カード ${owned}種類`, value: owned * 20 },
    { label: `収集品 ${s.souvenirs.length}個`, value: s.souvenirs.length * 15 },
    { label: `資産 ${s.assets.length}個`, value: s.assets.length * 120 },
    { label: `最終資金 ${yen(s.money)}`, value: Math.floor(s.money / 1000) },
  ];
  const score = parts.reduce((a, p) => a + p.value, 0);
  const rank = score >= 2600 ? 'S' : score >= 1900 ? 'A' : score >= 1200 ? 'B' : 'C';
  return { score, rank, parts };
}

export function metersOf(g: Gain3): string {
  return METERS.map((k: Meter) => `${METER_LABEL[k]}${g[k]}`).join(' ');
}

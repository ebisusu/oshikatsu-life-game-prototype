// ブラウザ保存（localStorage autosave）。バージョン付き・壊れたデータは新規開始へフォールバック。
import { CARD_MAP } from './data/cards';
import { ASSET_MAP, CITY_MAP, CONCERT_MAP, SPOT_MAP } from './data/world';
import { TROPHY_MAP } from './data/trophies';
import { validateDeck } from './deck';
import { MAX_STAMINA, TOTAL_WEEKS, TRAIN_MAX, type GameState } from './state';
import { MEMBERS } from './types';

export const SAVE_KEY = 'oshikatsu-jinsei-game:save';
export const SAVE_VERSION = 1;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; state: GameState }
  | { status: 'invalid'; reason: string };

interface Envelope {
  version: number;
  savedAt: string;
  state: unknown;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');

const known = (map: object, id: unknown): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(map, id);
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const counter = (n: unknown): n is number => nonnegative(n) && Number.isSafeInteger(n);
const meters = (v: unknown, integral = true): boolean => isObj(v) && ['h', 'u', 'm'].every(k => integral ? counter(v[k]) : nonnegative(v[k]));
const uniqueStrings = (v: unknown): v is string[] => isStrArr(v) && new Set(v).size === v.length;
const modes = ['onsite', 'stream', 'free'];
const winners = ['player', 'cpu', 'draw'];
const statsKeys = ['worked', 'explored', 'moved', 'trained', 'rested', 'combos', 'bestLiveCombos', 'liveAttended', 'liveWins', 'cardsFound', 'moneyPeak'];

/** Validate every field consumed by the engine/UI before accepting untrusted storage. */
export function validateState(x: unknown): string | null {
  if (!isObj(x)) return '保存データがオブジェクトではありません';
  if (x.version !== 1) return '未対応のデータバージョンです';
  if (!isInt(x.seed, 1, 0xffffffff) || !isInt(x.rng, 0, 0xffffffff)) return '乱数状態が不正です';
  if (!['solo', 'combo', 'box'].includes(x.oshi as string)) return '推しタイプが不正です';
  if (x.oshiMember !== null && !MEMBERS.includes(x.oshiMember as never)) return '推しメンバーが不正です';
  if ((x.oshi === 'solo') !== (x.oshiMember !== null)) return '推しタイプとメンバーが一致しません';
  if (!isInt(x.week, 1, TOTAL_WEEKS) || !isInt(x.ap, 0, 4)) return '週・APが不正です';
  if (!counter(x.money) || !isInt(x.stamina, 0, MAX_STAMINA)) return '資金・体力が不正です';
  if (!known(CITY_MAP, x.city) || !known(CITY_MAP, x.startCity)) return '都市が不正です';
  if (typeof x.name !== 'string' || typeof x.finished !== 'boolean') return '基本情報が不正です';
  if (x.finished && (x.week !== TOTAL_WEEKS || x.ap !== 0 || x.live !== null || x.pending !== null)) return '終了状態が不正です';
  if (!isObj(x.collection)) return 'コレクションが不正です';
  for (const [id, n] of Object.entries(x.collection)) {
    if (!known(CARD_MAP, id) || !isInt(n, 0, 99)) return 'カード所持数が不正です';
  }
  if (!isStrArr(x.deck) || x.deck.some(id => !known(CARD_MAP, id))) return 'デッキが不正です';
  if (validateDeck(x.deck, x.collection as Record<string, number>).length) return 'デッキが合法ではありません';
  for (const [key, map] of [['newCards', CARD_MAP], ['visitedSpots', SPOT_MAP], ['visitedCities', CITY_MAP], ['assets', ASSET_MAP], ['trophies', TROPHY_MAP]] as const) {
    const list = x[key];
    if (!uniqueStrings(list) || list.some(id => !known(map, id))) return `${key}が不正です`;
  }
  if ((x.trophies as string[]).some(id => TROPHY_MAP[id]?.locked)) return 'ロック中のトロフィーです';
  if (!(x.visitedCities as string[]).includes(x.city) || !(x.visitedCities as string[]).includes(x.startCity)) return '訪問都市が不正です';
  if (!uniqueStrings(x.souvenirs) || !isStrArr(x.log)) return '収集品・ログが不正です';
  if (!isObj(x.skills) || !['h', 'u', 'm'].every(k => isInt((x.skills as Record<string, unknown>)[k], 0, TRAIN_MAX))) return '訓練レベルが不正です';
  if (x.pending !== null) {
    const p = x.pending;
    if (x.live !== null || !isObj(p) || typeof p.source !== 'string' || !uniqueStrings(p.options) || p.options.length !== 3 || p.options.some(id => !known(CARD_MAP, id))) return 'カード報酬の選択状態が不正です';
  }
  if (!isObj(x.concerts) || Object.keys(x.concerts).length !== Object.keys(CONCERT_MAP).length) return '公演記録が不正です';
  for (const [id, concert] of Object.entries(CONCERT_MAP)) {
    const rec = x.concerts[id];
    if (!isObj(rec) || !['pending', 'done', 'missed'].includes(rec.status as string)) return '公演記録が不正です';
    if ((concert.week < x.week || x.finished) && rec.status === 'pending') return '過去の公演記録が未確定です';
    if (concert.week > x.week && rec.status !== 'pending') return '未来の公演記録が不正です';
    if (rec.status === 'done' && (!modes.includes(rec.mode as string) || !winners.includes(rec.winner as string) || !counter(rec.playerTotal) || !counter(rec.cpuTotal) || typeof rec.targetReached !== 'boolean' || !counter(rec.moneyReward))) return '公演結果が不正です';
    if (rec.status !== 'done' && ['mode', 'winner', 'playerTotal', 'cpuTotal', 'targetReached', 'moneyReward'].some(k => rec[k] !== undefined)) return '未完了の公演結果が不正です';
  }
  if (!isObj(x.stats) || !statsKeys.every(k => counter((x.stats as Record<string, unknown>)[k]))) return '統計が不正です';
  if (x.live !== null) {
    const l = x.live;
    if (!isObj(l) || l.version !== 1 || !known(CONCERT_MAP, l.concertId)) return 'ライブ状態が不正です';
    const concert = CONCERT_MAP[l.concertId]!;
    if (concert.week !== x.week || (x.concerts[l.concertId] as Record<string, unknown>).status !== 'pending') return 'ライブと公演週が一致しません';
    if (!isInt(l.rng, 0, 0xffffffff) || !modes.includes(l.mode as string) || l.target !== concert.target) return 'ライブ設定が不正です';
    if (!isInt(l.songIndex, 0, 3) || !['first', 'second'].includes(l.phase as string) || !['playing', 'result'].includes(l.stage as string)) return 'ライブ進行が不正です';
    if (!Array.isArray(l.setlist) || l.setlist.length !== 4 || !l.setlist.every((s, i) => isObj(s) && s.id === concert.setlist[i]?.id && s.name === concert.setlist[i]?.name && s.type === concert.setlist[i]?.type)) return 'セットリストが不正です';
    if (!Array.isArray(l.log) || !l.log.every(e => isObj(e) && ['player', 'cpu', 'sys'].includes(e.who as string) && typeof e.text === 'string' && ['info', 'play', 'combo', 'fail', 'score'].includes(e.kind as string))) return 'ライブログが不正です';
    for (const who of ['player', 'cpu'] as const) {
      const side = l[who];
      if (!isObj(side) || typeof side.name !== 'string' || !['solo', 'combo', 'box'].includes(side.oshi as string) || (side.oshiMember !== null && !MEMBERS.includes(side.oshiMember as never)) || ((side.oshi === 'solo') !== (side.oshiMember !== null))) return 'ライブの推し情報が不正です';
      const zones: string[] = [];
      for (const zone of ['deck', 'hand', 'discard'] as const) {
        const z = side[zone];
        if (!isStrArr(z) || z.some(id => !known(CARD_MAP, id)) || (zone === 'hand' && z.length > 7)) return 'ライブのカード領域が不正です';
        zones.push(...z);
      }
      const expected = who === 'player' ? x.deck : Object.entries(concert.cpu.deck).flatMap(([id, n]) => Array<string>(n).fill(id));
      if ([...zones].sort().join(',') !== [...expected].sort().join(',')) return 'ライブのカード枚数が一致しません';
      if (!isInt(side.spent, 0, l.phase === 'first' ? 2 : 4) || !meters(side.song) || !meters(side.meters) || !meters(side.skills, false) || !meters(side.assetBonus, false)) return 'ライブのEP・メーターが不正です';
      for (const k of ['mvpTenths', 'mvpWins', 'songBuffPct', 'mvpExtra', 'comboFired', 'comboThisSong']) if (!counter(side[k])) return 'ライブのサイド統計が不正です';
      if (!nonnegative(side.nextMult) || !nonnegative(side.gainMult) || typeof side.comboDrawUsed !== 'boolean') return 'ライブの倍率が不正です';
      const completed = l.stage === 'result' ? 4 : l.songIndex;
      if (!Array.isArray(side.songScores) || side.songScores.length !== completed || !side.songScores.every(counter)) return '曲スコアが不正です';
      if (!Array.isArray(side.history) || !side.history.every(r => {
        if (!isObj(r) || !known(CARD_MAP, r.cardId) || !isInt(r.songIndex, 0, l.songIndex as number) || !['first', 'second'].includes(r.phase as string)) return false;
        const card = CARD_MAP[r.cardId]!;
        return r.member === card.member && r.kind === card.kind && r.rarity === card.rarity && r.songType === card.songType && r.region === card.region && !(r.songIndex === l.songIndex && l.phase === 'first' && r.phase === 'second');
      })) return '使用履歴が不正です';
    }
    if (l.stage === 'playing' && l.result !== null) return '未完了ライブの結果が不正です';
    if (l.stage === 'result') {
      const r = l.result;
      if (l.songIndex !== 3 || l.phase !== 'second' || !isObj(r) || !counter(r.playerTotal) || !counter(r.cpuTotal) || !winners.includes(r.winner as string) || typeof r.targetReached !== 'boolean' || r.target !== l.target || !Array.isArray(r.songResults) || r.songResults.length !== 4) return 'ライブ結果が不正です';
      const p = l.player as Record<string, unknown>;
      const c = l.cpu as Record<string, unknown>;
      const total = (s: Record<string, unknown>) => (s.songScores as number[]).reduce((a, b) => a + b, 0) + (s.mvpTenths as number);
      if (r.playerTotal !== total(p) || r.cpuTotal !== total(c) || r.winner !== (r.playerTotal > r.cpuTotal ? 'player' : r.cpuTotal > r.playerTotal ? 'cpu' : 'draw') || r.targetReached !== (r.playerTotal / 10 >= concert.target)) return 'ライブ合計が不正です';
      if (!r.songResults.every((s, i) => {
        const a = (p.songScores as number[])[i]!;
        const b = (c.songScores as number[])[i]!;
        return isObj(s) && s.song === concert.setlist[i]?.name && s.player === a && s.cpu === b && s.mvp === (a > b ? 'player' : b > a ? 'cpu' : 'none');
      })) return '曲別結果が不正です';
    }
  }
  return null;
}
export function serialize(state: GameState, now: Date = new Date()): string {
  const env: Envelope = { version: SAVE_VERSION, savedAt: now.toISOString(), state };
  return JSON.stringify(env);
}

export function parseSave(raw: string | null): LoadResult {
  if (raw === null) return { status: 'none' };
  let env: unknown;
  try {
    env = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'セーブデータを読み取れませんでした（JSON破損）' };
  }
  if (!isObj(env) || env.version !== SAVE_VERSION) {
    return { status: 'invalid', reason: 'セーブデータの形式バージョンが異なります' };
  }
  const err = validateState(env.state);
  if (err) return { status: 'invalid', reason: err };
  return { status: 'ok', state: env.state as GameState };
}

export function loadGame(storage: StorageLike | null): LoadResult {
  if (!storage) return { status: 'none' };
  try {
    return parseSave(storage.getItem(SAVE_KEY));
  } catch {
    return { status: 'invalid', reason: 'ブラウザ保存を読み出せませんでした' };
  }
}

export function saveGame(storage: StorageLike | null, state: GameState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}


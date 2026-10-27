// 試作カード40種。メンバーA〜Hは仮の架空メンバー。実在人物とは無関係。
// 将来数百種へ拡張する場合は、この配列に追記し EffectParamsMap/EFFECTS に効果を足すだけでよい。
import type {
  CardDef, CardKind, EffectId, EffectParamsMap, EffectSpec, MemberId, RegionId, Rarity, SongType,
} from '../types';

function fx<K extends EffectId>(id: K, params: EffectParamsMap[K]): EffectSpec {
  return { id, params } as EffectSpec;
}

function c(
  id: string, name: string, rarity: Rarity, kind: CardKind, cost: number,
  member: MemberId, songType: SongType, region: RegionId,
  base: [number, number, number], effect: EffectSpec,
): CardDef {
  return { id, name, rarity, kind, cost, member, songType, region, base: { h: base[0], u: base[1], m: base[2] }, effect };
}

export const CARDS: readonly CardDef[] = [
  // ---- N (12) ----
  c('c01', 'ペンライト・ウェーブ', 'N', 'action', 1, 'A', 'call', 'kanto', [4, 1, 0], fx('flat', {})),
  c('c02', 'オープニング・クラップ', 'N', 'action', 1, 'B', 'call', 'chubu', [2, 1, 0], fx('firstHalf', { gain: { h: 3 } })),
  c('c03', 'まっすぐな声援', 'N', 'action', 1, 'C', 'unit', 'kyushu', [1, 3, 0], fx('secondHalf', { gain: { u: 3 } })),
  c('c04', 'うちわの文字', 'N', 'action', 1, 'D', 'ballad', 'kinki', [1, 1, 3], fx('lowestMeter', { amount: 2 })),
  c('c05', '水分補給', 'N', 'support', 1, 'E', 'all', 'hokkaido', [1, 1, 0], fx('draw', { n: 1 })),
  c('c06', '深呼吸', 'N', 'support', 2, 'F', 'ballad', 'tohoku', [0, 2, 3], fx('refund', { n: 1 })),
  c('c07', '差し入れ', 'N', 'support', 1, 'G', 'unit', 'chugoku', [1, 2, 0], fx('handSize', { per: { h: 1 }, cap: 3 })),
  c('c08', 'ファンサ待ち', 'N', 'action', 1, 'H', 'call', 'kanto', [2, 1, 1], fx('behind', { gain: { h: 3 } })),
  c('c09', 'ペアで推す', 'N', 'combo', 1, 'A', 'unit', 'kanto', [1, 2, 0], fx('prevSameMember', { gain: { h: 2, u: 3 } })),
  c('c10', '前列の連帯', 'N', 'combo', 1, 'B', 'unit', 'chubu', [1, 2, 0], fx('kindChain', { prev: 'action', gain: { u: 3 } })),
  c('c11', 'ご当地ソング応援', 'N', 'combo', 1, 'C', 'all', 'kyushu', [2, 1, 1], fx('regionCountLive', { per: { h: 1, u: 1 }, cap: 3 })),
  c('c12', '思い出メモ', 'N', 'support', 1, 'D', 'ballad', 'kinki', [0, 1, 3], fx('discardSize', { per: { m: 1 }, cap: 3 })),
  // ---- R (14) ----
  c('c13', 'ライブ初参戦', 'R', 'action', 2, 'E', 'call', 'tohoku', [5, 2, 1], fx('ahead', { gain: { h: 4, u: 1 } })),
  c('c14', '合いの手', 'R', 'action', 2, 'F', 'call', 'chugoku', [4, 3, 0], fx('chainLength', { per: { h: 1 }, cap: 4 })),
  c('c15', 'ハモりコール', 'R', 'action', 2, 'G', 'unit', 'kanto', [2, 5, 1], fx('secondHalf', { gain: { u: 3, m: 2 } })),
  c('c16', '涙の一曲', 'R', 'action', 2, 'H', 'ballad', 'kyushu', [1, 2, 6], fx('lowestMeter', { amount: 3 })),
  c('c17', 'みんなでジャンプ', 'R', 'action', 2, 'A', 'all', 'chubu', [3, 3, 2], fx('balance', { need: 4, gain: { h: 3, u: 3, m: 3 } })),
  c('c18', '水色のペンライト', 'R', 'support', 2, 'B', 'call', 'kinki', [2, 2, 1], fx('nextMult', { mult: 1.5 })),
  c('c19', 'コール表の暗記', 'R', 'support', 1, 'C', 'call', 'hokkaido', [1, 1, 0], fx('tutor', { kind: 'finisher' })),
  c('c20', 'リフレッシュタイム', 'R', 'support', 2, 'D', 'ballad', 'chugoku', [1, 2, 3], fx('draw', { n: 2 })),
  c('c21', '連続コール', 'R', 'combo', 2, 'E', 'call', 'kanto', [3, 2, 1], fx('kindChain', { prev: 'support', gain: { h: 6 } })),
  c('c22', '推しメン揃い', 'R', 'combo', 2, 'F', 'unit', 'tohoku', [2, 4, 1], fx('memberCountLive', { per: { u: 2 }, cap: 3 })),
  c('c23', '地元愛トーク', 'R', 'combo', 2, 'G', 'unit', 'kyushu', [2, 3, 2], fx('regionCountLive', { per: { u: 2, m: 1 }, cap: 3 })),
  c('c24', '同曲タイプ連携', 'R', 'combo', 2, 'H', 'all', 'kinki', [3, 3, 2], fx('songTypeChain', { gain: { h: 2, u: 2, m: 2 } })),
  c('c25', '全員集合の予感', 'R', 'combo', 2, 'A', 'all', 'kanto', [2, 3, 3], fx('distinctMembersSong', { need: 3, gain: { h: 3, u: 3, m: 3 } })),
  c('c26', 'ラスサビ全力', 'R', 'finisher', 2, 'B', 'call', 'chubu', [4, 3, 2], fx('epLeft', { per: { h: 2, u: 1 } })),
  // ---- SR (8) ----
  c('c27', 'センターの煽り', 'SR', 'action', 2, 'A', 'call', 'kanto', [6, 3, 1], fx('suppress', { pct: 30 })),
  c('c28', 'アンコール前の静寂', 'SR', 'support', 2, 'B', 'ballad', 'kinki', [1, 3, 5], fx('mvpBoost', { pts: 1 })),
  c('c29', 'フォーメーション・チェンジ', 'SR', 'support', 1, 'C', 'unit', 'chubu', [2, 3, 1], fx('recycle', { n: 1 })),
  c('c30', 'ミックスの極み', 'SR', 'combo', 2, 'D', 'call', 'kanto', [4, 3, 2], fx('distinctMembersLive', { per: { h: 1, u: 1 }, cap: 5 })),
  c('c31', '一斉ペンライト', 'SR', 'action', 2, 'E', 'all', 'kyushu', [4, 4, 3], fx('songBuff', { pct: 25 })),
  c('c32', '生歌の震え', 'SR', 'action', 3, 'F', 'ballad', 'tohoku', [3, 4, 8], fx('handSize', { per: { m: 2 }, cap: 4 })),
  c('c33', 'ユニゾン・コール', 'SR', 'combo', 2, 'G', 'unit', 'chugoku', [3, 5, 2], fx('prevTwoSameMember', { gain: { h: 5, u: 6, m: 2 } })),
  c('c34', 'ラスト一音', 'SR', 'finisher', 3, 'H', 'call', 'hokkaido', [6, 4, 3], fx('finisherCombos', { per: { h: 3, u: 2 }, cap: 4 })),
  // ---- SSR (4) ----
  c('c35', '夜明けのアンコール', 'SSR', 'finisher', 3, 'C', 'ballad', 'kyushu', [5, 6, 10], fx('meterSum', { pct: 20 })),
  c('c36', '光の海', 'SSR', 'action', 3, 'D', 'all', 'kinki', [8, 7, 5], fx('doubleMeter', { meter: 'u' })),
  c('c37', '全力コール祭り', 'SSR', 'finisher', 2, 'E', 'call', 'kanto', [6, 4, 2], fx('allIn', { per: { h: 4, u: 2, m: 1 } })),
  c('c38', 'ステージ共鳴', 'SSR', 'combo', 3, 'F', 'unit', 'tohoku', [6, 8, 5], fx('echo', { pct: 80 })),
  // ---- UR (2) ----
  c('c39', 'ミラクル・ツアーファイナル', 'UR', 'finisher', 3, 'G', 'all', 'chugoku', [10, 8, 6], fx('liveTotalPct', { pct: 25 })),
  c('c40', '推しがいる人生', 'UR', 'combo', 2, 'H', 'all', 'hokkaido', [7, 7, 7], fx('distinctKindsSong', { need: 3, gain: { h: 6, u: 6, m: 6 } })),
];

export const CARD_MAP: Readonly<Record<string, CardDef>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, CardDef>, Object.fromEntries(CARDS.map((card) => [card.id, card]))),
);

export function getCard(id: string): CardDef {
  const card = CARD_MAP[id];
  if (!card) throw new Error(`unknown card: ${id}`);
  return card;
}

export const RARITY_ORDER: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3, UR: 4 };
export const isHighRarity = (r: Rarity): boolean => RARITY_ORDER[r] >= RARITY_ORDER.SR;



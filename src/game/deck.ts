// デッキ規則: 20枚固定 / 同名2枚まで / SR 6 / SSR 2 / UR 1 以下 / 所持数以内
import { CARD_MAP, CARDS, RARITY_ORDER } from './data/cards';
import type { MemberId, OshiType, Rarity } from './types';

export const DECK_SIZE = 20;
export const COPY_LIMIT = 2;
export const RARITY_LIMIT: Record<Rarity, number> = { N: DECK_SIZE, R: DECK_SIZE, SR: 6, SSR: 2, UR: 1 };

export type Collection = Record<string, number>;

export function countIds(ids: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  for (const id of ids) out[id] = (out[id] ?? 0) + 1;
  return out;
}

export function countRarities(deck: readonly string[]): Record<Rarity, number> {
  const out: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
  for (const id of deck) {
    const card = CARD_MAP[id];
    if (card) out[card.rarity]++;
  }
  return out;
}

/** 違反メッセージの配列（空なら合法）。collection を渡すと所持数も検証する */
export function validateDeck(deck: readonly string[], collection?: Collection): string[] {
  const errors: string[] = [];
  if (deck.length !== DECK_SIZE) errors.push(`デッキは${DECK_SIZE}枚ちょうど必要です（現在${deck.length}枚）`);
  const counts = countIds(deck);
  for (const [id, n] of Object.entries(counts)) {
    const card = CARD_MAP[id];
    if (!card) {
      errors.push(`不明なカードが含まれています（${id}）`);
      continue;
    }
    if (n > COPY_LIMIT) errors.push(`「${card.name}」は同名${COPY_LIMIT}枚までです（${n}枚）`);
    if (collection && n > (collection[id] ?? 0)) errors.push(`「${card.name}」の所持数を超えています（所持${collection[id] ?? 0}枚）`);
  }
  const r = countRarities(deck);
  (['SR', 'SSR', 'UR'] as const).forEach((rar) => {
    if (r[rar] > RARITY_LIMIT[rar]) errors.push(`${rar}は${RARITY_LIMIT[rar]}枚までです（${r[rar]}枚）`);
  });
  return errors;
}

export const isDeckLegal = (deck: readonly string[], collection?: Collection): boolean =>
  validateDeck(deck, collection).length === 0;

/** 追加しても合法を保てるか（枚数20は別途判定） */
function canAdd(deck: string[], id: string, collection: Collection): boolean {
  const card = CARD_MAP[id];
  if (!card) return false;
  const counts = countIds(deck);
  if ((counts[id] ?? 0) >= COPY_LIMIT) return false;
  if ((counts[id] ?? 0) >= (collection[id] ?? 0)) return false;
  const r = countRarities(deck);
  return r[card.rarity] + 1 <= RARITY_LIMIT[card.rarity];
}

export interface DeckPref {
  oshi: OshiType;
  member: MemberId | null;
}

/** base のうち合法な部分を残し、足りない分を所持カードから好みに沿って補う */
export function autoFixDeck(collection: Collection, base: readonly string[], pref: DeckPref): string[] {
  const deck: string[] = [];
  for (const id of base) {
    if (deck.length < DECK_SIZE && canAdd(deck, id, collection)) deck.push(id);
  }
  while (deck.length < DECK_SIZE) {
    const memberCounts: Record<string, number> = {};
    for (const id of deck) {
      const m = CARD_MAP[id]?.member;
      if (m) memberCounts[m] = (memberCounts[m] ?? 0) + 1;
    }
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const card of CARDS) {
      if (!canAdd(deck, card.id, collection)) continue;
      let score = RARITY_ORDER[card.rarity] * 10 - card.cost * 0.5;
      if (pref.oshi === 'solo' && pref.member === card.member) score += 14;
      if (pref.oshi === 'combo' && card.kind === 'combo') score += 8;
      if (pref.oshi === 'box') score -= (memberCounts[card.member] ?? 0) * 3;
      if (card.kind === 'finisher') score -= (deck.filter((d) => CARD_MAP[d]?.kind === 'finisher').length) * 4;
      if (score > bestScore) {
        bestScore = score;
        best = card.id;
      }
    }
    if (!best) break;
    deck.push(best);
  }
  return deck;
}

// ---------- 初期コレクション ----------
const COMMON: Collection = { c01: 2, c02: 2, c03: 2, c05: 2, c08: 2, c12: 2, c13: 2, c14: 1, c20: 1, c26: 1 };

export function starterCollection(oshi: OshiType, member: MemberId | null): Collection {
  const col: Collection = { ...COMMON };
  const put = (id: string, n: number) => {
    col[id] = Math.max(col[id] ?? 0, n);
  };
  if (oshi === 'solo' && member) {
    for (const card of CARDS) {
      if (card.member !== member) continue;
      if (card.rarity === 'N' || card.rarity === 'R') put(card.id, 2);
      else if (card.rarity === 'SR') put(card.id, 1);
    }
  } else if (oshi === 'combo') {
    put('c09', 2); put('c10', 2); put('c11', 1); put('c21', 1); put('c22', 1); put('c24', 1); put('c25', 1); put('c33', 1);
  } else {
    put('c04', 1); put('c06', 1); put('c07', 2); put('c11', 1); put('c15', 1); put('c16', 1); put('c17', 1); put('c18', 1); put('c30', 1);
  }
  return col;
}

export const totalCopies = (col: Collection): number => Object.values(col).reduce((a, b) => a + b, 0);
export const distinctOwned = (col: Collection): number => Object.values(col).filter((n) => n > 0).length;


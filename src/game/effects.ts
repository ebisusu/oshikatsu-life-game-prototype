// 効果レジストリ。カードは { id, params } だけを持ち、実処理はここに集約する。
// 新しいカード効果を足す場合: types.ts の EffectParamsMap に追記 → ここに1エントリ追加。
import {
  METERS,
  METER_LABEL,
  KIND_LABEL,
  type CardDef,
  type CardKind,
  type EffectId,
  type EffectParamsMap,
  type EffectSpec,
  type Gain,
  type LiveSide,
  type Meter,
  type Phase,
  type PlayedRec,
  type SongDef,
} from './types';

export interface EffectCtx {
  card: CardDef;
  side: LiveSide;
  foe: LiveSide;
  songIndex: number;
  phase: Phase;
  song: SongDef;
  /** この曲で自分が先に使ったカード（古い順） */
  songPlays: PlayedRec[];
  /** この公演で先に使ったカード（コンボ履歴。手札/山札とは独立） */
  livePlays: PlayedRec[];
  prev: PlayedRec | null;
  prevCard: CardDef | null;
  /** このカードを出した後の手札枚数 */
  handAfter: number;
  /** コスト支払い後のこの曲の残りEP */
  epAfter: number;
}

export interface EffectResult {
  bonus?: Gain;
  /** コンボ条件を満たした時の追加値（コンボ型パッシブで増幅される） */
  comboBonus?: Gain;
  combo?: { label: string; fired: boolean; reason?: string };
  extraBase?: Gain;
  doubleMeter?: Meter;
  draw?: number;
  refund?: number;
  nextMult?: number;
  songBuffPct?: number;
  tutor?: { kind?: CardKind; member?: CardDef['member'] };
  recycle?: number;
  suppressPct?: number;
  mvpExtra?: number;
  consumeAllEp?: boolean;
}

export interface EffectDef<P> {
  describe(p: P): string;
  resolve(ctx: EffectCtx, p: P): EffectResult;
}

const fmt = (g: Gain): string =>
  METERS.filter((k) => (g[k] ?? 0) !== 0)
    .map((k) => `${METER_LABEL[k]}+${g[k]}`)
    .join('・');
const mul = (g: Gain, n: number): Gain => ({ h: (g.h ?? 0) * n, u: (g.u ?? 0) * n, m: (g.m ?? 0) * n });
const distinct = <T>(items: T[]): number => new Set(items).size;
const weighted = (s: { h: number; u: number; m: number }): number => 5 * s.h + 3 * s.u + 2 * s.m;

const combo = (_c: EffectCtx, label: string, ok: boolean, gain: Gain, reason: string): EffectResult =>
  ok ? { comboBonus: gain, combo: { label, fired: true } } : { combo: { label, fired: false, reason } };

type Registry = { [K in EffectId]: EffectDef<EffectParamsMap[K]> };

export const EFFECTS: Registry = {
  flat: {
    describe: () => '追加効果なし。基本の応援。',
    resolve: () => ({}),
  },
  firstHalf: {
    describe: (p) => `前半に使うと${fmt(p.gain)}。`,
    resolve: (c, p) => (c.phase === 'first' ? { bonus: p.gain } : {}),
  },
  secondHalf: {
    describe: (p) => `後半に使うと${fmt(p.gain)}。`,
    resolve: (c, p) => (c.phase === 'second' ? { bonus: p.gain } : {}),
  },
  draw: {
    describe: (p) => `カードを${p.n}枚引く。`,
    resolve: (_c, p) => ({ draw: p.n }),
  },
  refund: {
    describe: (p) => `使用したEPを${p.n}回復する（実質コスト軽減）。`,
    resolve: (_c, p) => ({ refund: p.n }),
  },
  nextMult: {
    describe: (p) => `次に使うカードの獲得値が×${p.mult}。`,
    resolve: (_c, p) => ({ nextMult: p.mult }),
  },
  songBuff: {
    describe: (p) => `この曲の以降のカードの獲得値+${p.pct}%。`,
    resolve: (_c, p) => ({ songBuffPct: p.pct }),
  },
  prevSameMember: {
    describe: (p) => `【コンボ】直前に同じメンバーのカードを使っていると${fmt(p.gain)}。`,
    resolve: (c, p) =>
      combo(c, '同メンバー連続', !!c.prev && c.prev.member === c.card.member, p.gain,
        c.prev ? '直前のカードが別メンバー' : 'この曲の最初のカード'),
  },
  prevTwoSameMember: {
    describe: (p) => `【コンボ】この曲で直前2枚が同じメンバーなら${fmt(p.gain)}。`,
    resolve: (c, p) => {
      const last2 = c.songPlays.slice(-2);
      return combo(c, '同メンバー3連', last2.length === 2 && last2.every((r) => r.member === c.card.member), p.gain,
        '直前2枚が同じメンバーではない');
    },
  },
  memberCountLive: {
    describe: (p) => `【コンボ】この公演で既に使った同メンバーのカード1枚ごとに${fmt(p.per)}（最大${p.cap}枚分）。`,
    resolve: (c, p) => {
      const n = c.livePlays.filter((r) => r.member === c.card.member).length;
      return combo(c, '同メンバー積み上げ', n > 0, mul(p.per, Math.min(n, p.cap)), '同メンバーの使用履歴なし');
    },
  },
  distinctMembersSong: {
    describe: (p) => `【コンボ】この曲で${p.need}人以上のメンバーのカードを使っていると${fmt(p.gain)}。`,
    resolve: (c, p) => {
      const n = distinct([...c.songPlays.map((r) => r.member), c.card.member]);
      return combo(c, `メンバー${p.need}人以上`, n >= p.need, p.gain, `この曲で使ったメンバーは${n}人`);
    },
  },
  distinctMembersLive: {
    describe: (p) => `【コンボ】この公演で使ったメンバーの種類数ごとに${fmt(p.per)}（最大${p.cap}人分）。`,
    resolve: (c, p) => {
      const n = distinct([...c.livePlays.map((r) => r.member), c.card.member]);
      return combo(c, 'メンバー多様性', n >= 2, mul(p.per, Math.min(n, p.cap)), '使用メンバーが1人だけ');
    },
  },
  distinctKindsSong: {
    describe: (p) => `【コンボ】この曲で${p.need}種類以上の系統（アクション/サポート/コンボ/フィニッシャー）を使っていると${fmt(p.gain)}。`,
    resolve: (c, p) => {
      const n = distinct([...c.songPlays.map((r) => r.kind), c.card.kind]);
      return combo(c, `系統${p.need}種`, n >= p.need, p.gain, `この曲の系統は${n}種類`);
    },
  },
  kindChain: {
    describe: (p) => `【コンボ】直前に${KIND_LABEL[p.prev]}を使っていると${fmt(p.gain)}。`,
    resolve: (c, p) =>
      combo(c, `${KIND_LABEL[p.prev]}の後`, !!c.prev && c.prev.kind === p.prev, p.gain,
        c.prev ? `直前は${KIND_LABEL[c.prev.kind]}` : 'この曲の最初のカード'),
  },
  regionCountLive: {
    describe: (p) => `【コンボ】この公演で既に使った同じ地域のカード1枚ごとに${fmt(p.per)}（最大${p.cap}枚分）。`,
    resolve: (c, p) => {
      const n = c.livePlays.filter((r) => r.region === c.card.region).length;
      return combo(c, '同地域の連携', n > 0, mul(p.per, Math.min(n, p.cap)), '同じ地域の使用履歴なし');
    },
  },
  songTypeChain: {
    describe: (p) => `【コンボ】直前のカードと曲タイプが同じなら${fmt(p.gain)}。`,
    resolve: (c, p) =>
      combo(c, '曲タイプ連携', !!c.prev && c.prev.songType === c.card.songType, p.gain,
        c.prev ? '直前と曲タイプが違う' : 'この曲の最初のカード'),
  },
  echo: {
    describe: (p) => `【コンボ】直前に使ったカードの基本値の${p.pct}%を追加で得る。`,
    resolve: (c, p) => {
      if (!c.prevCard) return { combo: { label: 'エコー', fired: false, reason: 'この曲の最初のカード' } };
      return {
        comboBonus: mul(c.prevCard.base, p.pct / 100),
        combo: { label: 'エコー', fired: true },
      };
    },
  },
  behind: {
    describe: (p) => `この曲でCPUにリードされているとき${fmt(p.gain)}。`,
    resolve: (c, p) => (weighted(c.side.song) < weighted(c.foe.song) ? { bonus: p.gain } : {}),
  },
  ahead: {
    describe: (p) => `この曲でCPUをリードしているとき${fmt(p.gain)}。`,
    resolve: (c, p) => (weighted(c.side.song) > weighted(c.foe.song) ? { bonus: p.gain } : {}),
  },
  handSize: {
    describe: (p) => `出した後の手札1枚ごとに${fmt(p.per)}（最大${p.cap}枚分）。`,
    resolve: (c, p) => ({ bonus: mul(p.per, Math.min(c.handAfter, p.cap)) }),
  },
  discardSize: {
    describe: (p) => `捨て札1枚ごとに${fmt(p.per)}（最大${p.cap}枚分）。`,
    resolve: (c, p) => ({ bonus: mul(p.per, Math.min(c.side.discard.length, p.cap)) }),
  },
  lowestMeter: {
    describe: (p) => `この曲で最も低いメーターに+${p.amount}。`,
    resolve: (c, p) => {
      let lowest: Meter = 'h';
      for (const k of METERS) if (c.side.song[k] < c.side.song[lowest]) lowest = k;
      return { bonus: { [lowest]: p.amount } };
    },
  },
  balance: {
    describe: (p) => `この曲の熱量・一体感・思い出がすべて${p.need}以上なら${fmt(p.gain)}。`,
    resolve: (c, p) =>
      METERS.every((k) => c.side.song[k] >= p.need) ? { bonus: p.gain } : {},
  },
  chainLength: {
    describe: (p) => `この曲で先に使ったカード1枚ごとに${fmt(p.per)}（最大${p.cap}枚分）。`,
    resolve: (c, p) => ({ bonus: mul(p.per, Math.min(c.songPlays.length, p.cap)) }),
  },
  epLeft: {
    describe: (p) => `【後半専用】使用後の残りEP1ごとに${fmt(p.per)}。`,
    resolve: (c, p) => ({ bonus: mul(p.per, c.epAfter) }),
  },
  allIn: {
    describe: (p) => `【後半専用】残りEPをすべて消費し、消費したEP1ごとに${fmt(p.per)}。`,
    resolve: (c, p) => ({ bonus: mul(p.per, c.epAfter + c.card.cost), consumeAllEp: true }),
  },
  finisherCombos: {
    describe: (p) => `【後半専用】この公演で発動したコンボ1回ごとに${fmt(p.per)}（最大${p.cap}回分）。`,
    resolve: (c, p) => {
      const n = c.side.comboFired;
      return combo(c, 'コンボ総決算', n > 0, mul(p.per, Math.min(n, p.cap)), 'この公演でまだコンボ未発動');
    },
  },
  meterSum: {
    describe: (p) => `【後半専用】この曲の獲得値（熱量+一体感+思い出）の${p.pct}%を熱量に加算。`,
    resolve: (c, p) => {
      const sum = c.side.song.h + c.side.song.u + c.side.song.m;
      return { bonus: { h: Math.floor((sum * p.pct) / 100) } };
    },
  },
  liveTotalPct: {
    describe: (p) => `終了済みの曲の合計スコアの${p.pct}%を、熱量・一体感・思い出すべてに加算。`,
    resolve: (c, p) => {
      const x = Math.round((c.side.songScores.reduce((a, b) => a + b, 0) / 10) * (p.pct / 100));
      return { bonus: { h: x, u: x, m: x } };
    },
  },
  tutor: {
    describe: (p) => {
      const target = p.kind ? KIND_LABEL[p.kind] : p.member ? `メンバー${p.member}` : 'カード';
      return `山札から${target}を1枚手札に加える。`;
    },
    resolve: (_c, p) => ({ tutor: { kind: p.kind, member: p.member } }),
  },
  recycle: {
    describe: (p) => `捨て札からランダムに${p.n}枚を手札に戻す。`,
    resolve: (_c, p) => ({ recycle: p.n }),
  },
  suppress: {
    describe: (p) => `CPUのこの曲の熱量を${p.pct}%減らす。`,
    resolve: (_c, p) => ({ suppressPct: p.pct }),
  },
  mvpBoost: {
    describe: (p) => `この曲でMVPを取ると追加で+${p.pts}点。`,
    resolve: (_c, p) => ({ mvpExtra: p.pts }),
  },
  doubleMeter: {
    describe: (p) => `${METER_LABEL[p.meter]}の獲得量が2倍になる。`,
    resolve: (_c, p) => ({ doubleMeter: p.meter }),
  },
};

export function describeEffect(spec: EffectSpec): string {
  const def = EFFECTS[spec.id] as EffectDef<unknown>;
  return def.describe(spec.params);
}

export function resolveEffect(spec: EffectSpec, ctx: EffectCtx): EffectResult {
  const def = EFFECTS[spec.id] as EffectDef<unknown>;
  return def.resolve(ctx, spec.params);
}

/** 重複検出・テスト用の署名 */
export function effectSignature(spec: EffectSpec): string {
  return `${spec.id}:${JSON.stringify(spec.params)}`;
}


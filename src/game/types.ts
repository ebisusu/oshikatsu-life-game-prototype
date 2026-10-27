// 共通型。UIに依存しない。

export type MemberId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export const MEMBERS: readonly MemberId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export type Meter = 'h' | 'u' | 'm';
export const METERS: readonly Meter[] = ['h', 'u', 'm'];
export const METER_LABEL: Record<Meter, string> = { h: '熱量', u: '一体感', m: '思い出' };
/** 50:30:20 の重み（スコアは10倍整数=tenthsで保持する） */
export const METER_WEIGHT: Record<Meter, number> = { h: 5, u: 3, m: 2 };

export type Gain = { h?: number; u?: number; m?: number };
export type Gain3 = { h: number; u: number; m: number };

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR';
export const RARITIES: readonly Rarity[] = ['N', 'R', 'SR', 'SSR', 'UR'];
export type CardKind = 'action' | 'support' | 'combo' | 'finisher';
export const KIND_LABEL: Record<CardKind, string> = {
  action: 'アクション',
  support: 'サポート',
  combo: 'コンボ',
  finisher: 'フィニッシャー',
};
export type SongType = 'call' | 'unit' | 'ballad' | 'all';
export const SONG_TYPE_LABEL: Record<SongType, string> = {
  call: 'コール',
  unit: 'ユニット',
  ballad: 'バラード',
  all: '全体',
};
export type RegionId = 'hokkaido' | 'tohoku' | 'kanto' | 'chubu' | 'kinki' | 'chugoku' | 'kyushu';
export const REGION_LABEL: Record<RegionId, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '関東',
  chubu: '中部',
  kinki: '近畿',
  chugoku: '中国',
  kyushu: '九州',
};
export type OshiType = 'solo' | 'combo' | 'box';

export type CityId =
  | 'sapporo' | 'sendai' | 'tokyo' | 'yokohama' | 'nagoya' | 'kyoto'
  | 'osaka' | 'kobe' | 'hiroshima' | 'fukuoka' | 'miyazaki' | 'kumamoto';

// ---------- 効果（レジストリ用の型） ----------
export interface EffectParamsMap {
  flat: Record<string, never>;
  firstHalf: { gain: Gain };
  secondHalf: { gain: Gain };
  draw: { n: number };
  refund: { n: number };
  nextMult: { mult: number };
  songBuff: { pct: number };
  prevSameMember: { gain: Gain };
  prevTwoSameMember: { gain: Gain };
  memberCountLive: { per: Gain; cap: number };
  distinctMembersSong: { need: number; gain: Gain };
  distinctMembersLive: { per: Gain; cap: number };
  distinctKindsSong: { need: number; gain: Gain };
  kindChain: { prev: CardKind; gain: Gain };
  regionCountLive: { per: Gain; cap: number };
  songTypeChain: { gain: Gain };
  echo: { pct: number };
  behind: { gain: Gain };
  ahead: { gain: Gain };
  handSize: { per: Gain; cap: number };
  discardSize: { per: Gain; cap: number };
  lowestMeter: { amount: number };
  balance: { need: number; gain: Gain };
  chainLength: { per: Gain; cap: number };
  epLeft: { per: Gain };
  allIn: { per: Gain };
  finisherCombos: { per: Gain; cap: number };
  meterSum: { pct: number };
  liveTotalPct: { pct: number };
  tutor: { kind?: CardKind; member?: MemberId };
  recycle: { n: number };
  suppress: { pct: number };
  mvpBoost: { pts: number };
  doubleMeter: { meter: Meter };
}
export type EffectId = keyof EffectParamsMap;
export type EffectSpec = { [K in EffectId]: { id: K; params: EffectParamsMap[K] } }[EffectId];

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  kind: CardKind;
  /** EPコスト（1曲=4EP） */
  cost: number;
  member: MemberId;
  songType: SongType;
  region: RegionId;
  base: Gain3;
  effect: EffectSpec;
}

// ---------- ライブ ----------
export type Who = 'player' | 'cpu';
export type Phase = 'first' | 'second';
export type LiveMode = 'onsite' | 'stream' | 'free';

export interface SongDef {
  id: string;
  name: string;
  type: SongType;
}

export interface PlayedRec {
  cardId: string;
  songIndex: number;
  phase: Phase;
  member: MemberId;
  songType: SongType;
  region: RegionId;
  kind: CardKind;
  rarity: Rarity;
}

export interface LiveSide {
  name: string;
  oshi: OshiType;
  oshiMember: MemberId | null;
  deck: string[];
  hand: string[];
  discard: string[];
  /** 今の曲で使ったEP */
  spent: number;
  /** 公演累計のメーター */
  meters: Gain3;
  /** 今の曲のメーター */
  song: Gain3;
  /** 終了した曲ごとのスコア(tenths) */
  songScores: number[];
  /** MVP加点(tenths) */
  mvpTenths: number;
  mvpWins: number;
  /** コンボ履歴（手札・山札とは独立） */
  history: PlayedRec[];
  nextMult: number;
  songBuffPct: number;
  mvpExtra: number;
  comboFired: number;
  comboThisSong: number;
  comboDrawUsed: boolean;
  /** 訓練による各メーターの加算率（Lv×5%） */
  skills: Gain3;
  /** 資産による各メーターの加算率 */
  assetBonus: Gain3;
  /** 体力・参加方法・CPU難易度などの全体倍率 */
  gainMult: number;
}

export interface LogEntry {
  who: Who | 'sys';
  text: string;
  kind: 'info' | 'play' | 'combo' | 'fail' | 'score';
}

export interface LiveResult {
  playerTotal: number;
  cpuTotal: number;
  winner: Who | 'draw';
  targetReached: boolean;
  target: number;
  songResults: { song: string; player: number; cpu: number; mvp: Who | 'none' }[];
}

export interface LiveState {
  version: 1;
  rng: number;
  concertId: string;
  mode: LiveMode;
  setlist: SongDef[];
  target: number;
  songIndex: number;
  phase: Phase;
  stage: 'playing' | 'result';
  player: LiveSide;
  cpu: LiveSide;
  log: LogEntry[];
  result: LiveResult | null;
}

export const SONG_EP = 4;
export const FIRST_HALF_EP = 2;
export const HAND_LIMIT = 7;
export const MAX_PLAYS_PER_SONG = 8;
export const SONGS_PER_LIVE = 4;

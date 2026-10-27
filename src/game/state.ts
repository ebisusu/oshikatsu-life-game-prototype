// ゲーム全体の状態型と定数（pure）。
import type { CityId, LiveMode, LiveState, MemberId, Meter, OshiType } from './types';

export const TOTAL_WEEKS = 12;
export const AP_PER_WEEK = 4;
export const START_MONEY = 60000;
export const START_STAMINA = 80;
export const MAX_STAMINA = 100;
export const WORK_AP = 2;
export const WORK_INCOME = 22000;
export const WORK_STAMINA = 12;
export const EXPLORE_AP = 1;
export const TRAIN_AP = 1;
export const TRAIN_STAMINA = 6;
export const TRAIN_MAX = 5;
export const trainCost = (level: number): number => 800 * (level + 1);
export const REST_AP = 2;
export const REST_STAMINA = 30;
export const MOVE_STAMINA = 3;
export const WEEK_INCOME = 2000;
export const WEEK_STAMINA = 10;
export const BUY_AP = 1;

export const LIVE_COST: Record<LiveMode, { ap: number; money: number; stamina: number; label: string }> = {
  onsite: { ap: 1, money: 6000, stamina: 10, label: '現地参加' },
  stream: { ap: 1, money: 1500, stamina: 3, label: '配信視聴' },
  free: { ap: 0, money: 0, stamina: 0, label: '無料ダイジェスト配信' },
};
export const LIVE_GAIN_MULT: Record<LiveMode, number> = { onsite: 1.1, stream: 1.0, free: 0.92 };
export const LIVE_REWARD_MULT: Record<LiveMode, number> = { onsite: 1.5, stream: 1.0, free: 0.5 };

export interface PendingChoice {
  source: string;
  options: string[];
}

export interface ConcertRecord {
  status: 'pending' | 'done' | 'missed';
  mode?: LiveMode;
  winner?: 'player' | 'cpu' | 'draw';
  playerTotal?: number;
  cpuTotal?: number;
  targetReached?: boolean;
  moneyReward?: number;
}

export interface Stats {
  worked: number;
  explored: number;
  moved: number;
  trained: number;
  rested: number;
  combos: number;
  bestLiveCombos: number;
  liveAttended: number;
  liveWins: number;
  cardsFound: number;
  moneyPeak: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rng: number;
  name: string;
  oshi: OshiType;
  oshiMember: MemberId | null;
  startCity: CityId;
  week: number;
  ap: number;
  money: number;
  stamina: number;
  city: CityId;
  collection: Record<string, number>;
  deck: string[];
  /** 入手済みでまだデッキ画面/コレクションで確認していないカード */
  newCards: string[];
  visitedSpots: string[];
  visitedCities: CityId[];
  souvenirs: string[];
  assets: string[];
  skills: Record<Meter, number>;
  pending: PendingChoice | null;
  concerts: Record<string, ConcertRecord>;
  live: LiveState | null;
  trophies: string[];
  log: string[];
  stats: Stats;
  finished: boolean;
}

export type Action =
  | { type: 'work' }
  | { type: 'rest' }
  | { type: 'train'; skill: Meter }
  | { type: 'move'; to: CityId }
  | { type: 'explore'; spotId: string }
  | { type: 'pickCard'; cardId: string }
  | { type: 'buyAsset'; assetId: string }
  | { type: 'endWeek' }
  | { type: 'setDeck'; deck: string[] }
  | { type: 'autoDeck' }
  | { type: 'resetDeck' }
  | { type: 'markCardsSeen' }
  | { type: 'startLive'; mode: LiveMode }
  | { type: 'livePlay'; handIndex: number }
  | { type: 'liveEndPhase' }
  | { type: 'liveClaim' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; reason: string };

// 週末精算 → 新しい週のアイキャッチ用データ。ゲームロジックは変更せず、
// endWeek 直前の状態と直後の状態から差分を算出する（推測値は使わない）。
import { ASSET_MAP, CONCERTS, TOTAL_WEEKS, WEEK_INCOME, type GameState } from '../game';

export interface WeekIntroData {
  /** 終えた週 */
  fromWeek: number;
  /** 始まる週 */
  week: number;
  totalWeeks: number;
  /** 週末収入の内訳（基本収入＋資産ごと） */
  income: { label: string; amount: number }[];
  incomeTotal: number;
  money: { before: number; after: number };
  stamina: { before: number; after: number; gain: number };
  ap: { before: number; after: number };
  /** 参加せずに終えた（不参加になった）前週の公演 */
  missed: { name: string } | null;
  /** 今週開催の公演 */
  thisWeek: { name: string; venue: string } | null;
  /** 今週より後で次に開催される未参加の公演 */
  next: { name: string; week: number; weeksAway: number } | null;
}

/** endWeek 直後だけ意味がある。週が進まない・最終週終了（結果画面へ）の場合は null。 */
export function weekIntroData(prev: GameState, next: GameState): WeekIntroData | null {
  if (next.finished || next.week !== prev.week + 1 || next.week > TOTAL_WEEKS) return null;
  const income: WeekIntroData['income'] = [{ label: '週末の基本収入', amount: WEEK_INCOME }];
  for (const id of prev.assets) {
    const a = ASSET_MAP[id];
    if (a && a.weeklyIncome > 0) income.push({ label: a.name, amount: a.weeklyIncome });
  }
  const missedConcert = CONCERTS.find((c) => c.week === prev.week && prev.concerts[c.id]?.status === 'pending');
  const thisWeek = CONCERTS.find((c) => c.week === next.week);
  const upcoming = CONCERTS.find((c) => c.week > next.week && next.concerts[c.id]?.status === 'pending');
  return {
    fromWeek: prev.week,
    week: next.week,
    totalWeeks: TOTAL_WEEKS,
    income,
    incomeTotal: next.money - prev.money,
    money: { before: prev.money, after: next.money },
    stamina: { before: prev.stamina, after: next.stamina, gain: next.stamina - prev.stamina },
    ap: { before: prev.ap, after: next.ap },
    missed: missedConcert ? { name: missedConcert.name } : null,
    thisWeek: thisWeek && next.concerts[thisWeek.id]?.status === 'pending' ? { name: thisWeek.name, venue: thisWeek.venue } : null,
    next: upcoming ? { name: upcoming.name, week: upcoming.week, weeksAway: upcoming.week - next.week } : null,
  };
}

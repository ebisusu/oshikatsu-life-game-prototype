// トロフィー（実績）。16個が機能し、1個は長期モード向けの「構想（ロック）」表示のみ。
import { CARD_MAP } from './cards';
import { CITIES, CONCERTS } from './world';
import type { GameState } from '../state';

export interface TrophyDef {
  id: string;
  name: string;
  desc: string;
  /** true: 試作版では取得できない構想枠（ロック表示のみ） */
  locked?: boolean;
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => { cur: number; max: number };
}

const doneConcerts = (s: GameState) => Object.values(s.concerts).filter((c) => c.status === 'done');
const owned = (s: GameState) => Object.entries(s.collection).filter(([, n]) => n > 0).map(([id]) => id);
const skillsTotal = (s: GameState) => s.skills.h + s.skills.u + s.skills.m;

export const TROPHIES: readonly TrophyDef[] = [
  { id: 'first_live', name: '初ライブ参加', desc: 'いずれかの公演に参加する。', check: (s) => doneConcerts(s).length >= 1,
    progress: (s) => ({ cur: Math.min(1, doneConcerts(s).length), max: 1 }) },
  { id: 'live_win', name: '初勝利', desc: 'CPUとのライブ対決に勝つ。', check: (s) => s.stats.liveWins >= 1,
    progress: (s) => ({ cur: Math.min(1, s.stats.liveWins), max: 1 }) },
  { id: 'target_clear', name: '目標達成', desc: '公演の目標スコアを達成する。', check: (s) => doneConcerts(s).some((c) => c.targetReached),
    progress: (s) => ({ cur: Math.min(1, doneConcerts(s).filter((c) => c.targetReached).length), max: 1 }) },
  { id: 'all_lives', name: '皆勤賞', desc: `全${CONCERTS.length}公演に参加する。`, check: (s) => doneConcerts(s).length >= CONCERTS.length,
    progress: (s) => ({ cur: doneConcerts(s).length, max: CONCERTS.length }) },
  { id: 'sweep', name: '全公演勝利', desc: `全${CONCERTS.length}公演でCPUに勝つ。`, check: (s) => s.stats.liveWins >= CONCERTS.length,
    progress: (s) => ({ cur: s.stats.liveWins, max: CONCERTS.length }) },
  { id: 'cities_5', name: '遠征の入口', desc: '5都市を訪れる。', check: (s) => s.visitedCities.length >= 5,
    progress: (s) => ({ cur: Math.min(5, s.visitedCities.length), max: 5 }) },
  { id: 'cities_12', name: '全国制覇', desc: `${CITIES.length}都市すべてを訪れる。`, check: (s) => s.visitedCities.length >= CITIES.length,
    progress: (s) => ({ cur: s.visitedCities.length, max: CITIES.length }) },
  { id: 'spots_10', name: 'スポット探検家', desc: '10か所のスポットを探索する。', check: (s) => s.visitedSpots.length >= 10,
    progress: (s) => ({ cur: Math.min(10, s.visitedSpots.length), max: 10 }) },
  { id: 'cards_20', name: 'コレクター', desc: '20種類のカードを所持する。', check: (s) => owned(s).length >= 20,
    progress: (s) => ({ cur: Math.min(20, owned(s).length), max: 20 }) },
  { id: 'ssr_get', name: 'きらめきの一枚', desc: 'SSR以上のカードを入手する。',
    check: (s) => owned(s).some((id) => { const r = CARD_MAP[id]?.rarity; return r === 'SSR' || r === 'UR'; }),
    progress: (s) => ({ cur: owned(s).some((id) => { const r = CARD_MAP[id]?.rarity; return r === 'SSR' || r === 'UR'; }) ? 1 : 0, max: 1 }) },
  { id: 'asset_1', name: '初めての資産', desc: '架空の資産を1つ購入する。', check: (s) => s.assets.length >= 1,
    progress: (s) => ({ cur: Math.min(1, s.assets.length), max: 1 }) },
  { id: 'asset_3', name: '資産オーナー', desc: '架空の資産を3つ購入する。', check: (s) => s.assets.length >= 3,
    progress: (s) => ({ cur: Math.min(3, s.assets.length), max: 3 }) },
  { id: 'combo_5', name: 'コンボマスター', desc: '1回のライブでコンボを5回発動する。', check: (s) => s.stats.bestLiveCombos >= 5,
    progress: (s) => ({ cur: Math.min(5, s.stats.bestLiveCombos), max: 5 }) },
  { id: 'skills_8', name: '応援力アップ', desc: '訓練レベルの合計を8にする。', check: (s) => skillsTotal(s) >= 8,
    progress: (s) => ({ cur: Math.min(8, skillsTotal(s)), max: 8 }) },
  { id: 'rich', name: '推し活貯金', desc: '資金が150,000円に達する。', check: (s) => s.stats.moneyPeak >= 150000,
    progress: (s) => ({ cur: Math.min(150000, s.stats.moneyPeak), max: 150000 }) },
  { id: 'finish', name: '12週完走', desc: '12週間の推し活をやり遂げる。', check: (s) => s.finished,
    progress: (s) => ({ cur: s.finished ? 12 : Math.min(11, s.week - 1), max: 12 }) },
  { id: 'dome5', name: '五大ドーム制覇【構想・ロック中】', desc: '長期モード（未実装）向けの構想。試作版では取得できません。', locked: true, check: () => false },
];

export const TROPHY_MAP: Readonly<Record<string, TrophyDef>> = Object.freeze(
  Object.fromEntries(TROPHIES.map((t) => [t.id, t])),
);

export const FUNCTIONAL_TROPHIES = TROPHIES.filter((t) => !t.locked);

export function evaluateTrophies(s: GameState): string[] {
  return FUNCTIONAL_TROPHIES.filter((t) => t.check(s)).map((t) => t.id);
}

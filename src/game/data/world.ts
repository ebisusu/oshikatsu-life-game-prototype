// 都市・経路・スポット・資産・公演・推しタイプのデータ。
// 都市名は地理上の移動拠点として実在都市名を使うが、メンバーや施設との関連は一切主張しない。
// スポット・施設・資産はすべて架空。
import type { CityId, Gain3, MemberId, OshiType, RegionId, SongDef, SongType } from '../types';

export interface CityDef {
  id: CityId;
  name: string;
  region: RegionId;
  /** 地図の概略座標（模式図。viewBox 0 0 360 520） */
  x: number;
  y: number;
}

export const CITIES: readonly CityDef[] = [
  { id: 'sapporo', name: '札幌', region: 'hokkaido', x: 292, y: 46 },
  { id: 'sendai', name: '仙台', region: 'tohoku', x: 280, y: 150 },
  { id: 'tokyo', name: '東京', region: 'kanto', x: 262, y: 222 },
  { id: 'yokohama', name: '横浜', region: 'kanto', x: 250, y: 262 },
  { id: 'nagoya', name: '名古屋', region: 'chubu', x: 196, y: 250 },
  { id: 'kyoto', name: '京都', region: 'kinki', x: 158, y: 252 },
  { id: 'osaka', name: '大阪', region: 'kinki', x: 150, y: 296 },
  { id: 'kobe', name: '神戸', region: 'kinki', x: 106, y: 288 },
  { id: 'hiroshima', name: '広島', region: 'chugoku', x: 70, y: 330 },
  { id: 'fukuoka', name: '福岡', region: 'kyushu', x: 40, y: 372 },
  { id: 'kumamoto', name: '熊本', region: 'kyushu', x: 52, y: 430 },
  { id: 'miyazaki', name: '宮崎', region: 'kyushu', x: 112, y: 466 },
];
export const CITY_MAP: Readonly<Record<CityId, CityDef>> = Object.freeze(
  Object.fromEntries(CITIES.map((x) => [x.id, x])) as Record<CityId, CityDef>,
);

export interface RouteDef {
  a: CityId;
  b: CityId;
  ap: 1 | 2;
  money: number;
  mode: string;
}
export const ROUTES: readonly RouteDef[] = [
  { a: 'sapporo', b: 'sendai', ap: 2, money: 16000, mode: '飛行機' },
  { a: 'sapporo', b: 'tokyo', ap: 2, money: 22000, mode: '飛行機' },
  { a: 'sendai', b: 'tokyo', ap: 1, money: 9000, mode: '新幹線' },
  { a: 'tokyo', b: 'yokohama', ap: 1, money: 1000, mode: '電車' },
  { a: 'tokyo', b: 'nagoya', ap: 1, money: 10000, mode: '新幹線' },
  { a: 'yokohama', b: 'nagoya', ap: 1, money: 8000, mode: '新幹線' },
  { a: 'nagoya', b: 'kyoto', ap: 1, money: 5000, mode: '新幹線' },
  { a: 'nagoya', b: 'osaka', ap: 1, money: 6000, mode: '新幹線' },
  { a: 'kyoto', b: 'osaka', ap: 1, money: 1500, mode: '電車' },
  { a: 'osaka', b: 'kobe', ap: 1, money: 1000, mode: '電車' },
  { a: 'tokyo', b: 'osaka', ap: 2, money: 14000, mode: '新幹線' },
  { a: 'kobe', b: 'hiroshima', ap: 1, money: 7000, mode: '新幹線' },
  { a: 'osaka', b: 'hiroshima', ap: 1, money: 9000, mode: '新幹線' },
  { a: 'hiroshima', b: 'fukuoka', ap: 1, money: 9000, mode: '新幹線' },
  { a: 'osaka', b: 'fukuoka', ap: 2, money: 17000, mode: '飛行機' },
  { a: 'fukuoka', b: 'kumamoto', ap: 1, money: 4000, mode: '新幹線' },
  { a: 'kumamoto', b: 'miyazaki', ap: 2, money: 6000, mode: '高速バス' },
  { a: 'fukuoka', b: 'miyazaki', ap: 2, money: 9000, mode: '高速バス' },
];

export type SpotType =
  | 'livehouse' | 'shrine' | 'cafe' | 'record' | 'park'
  | 'station' | 'museum' | 'market' | 'aquarium' | 'castle';
export const SPOT_TYPE_LABEL: Record<SpotType, string> = {
  livehouse: 'ライブハウス', shrine: '神社・寺', cafe: 'カフェ', record: 'レコード店', park: '公園',
  station: '駅・港', museum: '博物館', market: '市場', aquarium: '水族館', castle: '城・名所',
};
export const SPOT_TYPE_ICON: Record<SpotType, string> = {
  livehouse: '🎤', shrine: '⛩', cafe: '☕', record: '💿', park: '🌳',
  station: '🚉', museum: '🏛', market: '🛍', aquarium: '🐠', castle: '🏯',
};

export interface SpotDef {
  id: string;
  city: CityId;
  name: string;
  type: SpotType;
  /** 1〜3: 高いほどレア度の高いカードが出やすい */
  tier: 1 | 2 | 3;
  fee: number;
  stamina: number;
  /** 探索の基本報酬 */
  reward: { money?: number; stamina?: number };
  /** カード抽選で出やすくなるメンバー/曲タイプ（地域は都市から決まる） */
  members: [MemberId, MemberId];
  songType: SongType;
  souvenir: string;
  blurb: string;
}

type S = [string, SpotType, 1 | 2 | 3, number, number, { money?: number; stamina?: number }, [MemberId, MemberId], SongType, string, string];
function mk(city: CityId, rows: S[]): SpotDef[] {
  return rows.map((r, i) => ({
    id: `${city}-${i + 1}`, city, name: r[0], type: r[1], tier: r[2], fee: r[3], stamina: r[4],
    reward: r[5], members: r[6], songType: r[7], souvenir: r[8], blurb: r[9],
  }));
}

export const SPOTS: readonly SpotDef[] = [
  ...mk('sapporo', [
    ['雪あかりライブハウス（架空）', 'livehouse', 2, 1500, 6, {}, ['E', 'H'], 'call', '雪あかりチケット', '冬の夜にだけ灯る、架空のライブハウス。'],
    ['時計台カフェ「ミルクのしずく」', 'cafe', 1, 600, 4, { stamina: 5 }, ['C', 'D'], 'ballad', 'ミルクのしずくコースター', '甘い香りで体力が戻る架空カフェ。'],
    ['大通りレコード横丁', 'record', 1, 900, 5, { money: 500 }, ['A', 'B'], 'unit', '試聴済みの針', '店主が推しトークで盛り上がる架空の店。'],
  ]),
  ...mk('sendai', [
    ['七夕の杜ステージ（架空）', 'park', 2, 700, 5, {}, ['F', 'G'], 'unit', '短冊キーホルダー', '願いごとが集まる架空の野外ステージ。'],
    ['青葉の市場通り', 'market', 1, 500, 5, { money: 1200 }, ['E', 'A'], 'call', '笹かまのピック', '買い物上手になれる架空市場。'],
    ['牛タン横丁ジャズ喫茶', 'cafe', 1, 800, 4, { stamina: 4 }, ['B', 'D'], 'ballad', 'ジャズ喫茶のマッチ', '深夜まで音が絶えない架空の喫茶店。'],
  ]),
  ...mk('tokyo', [
    ['ネオンストリート・ホール（架空）', 'livehouse', 3, 2500, 7, {}, ['A', 'H'], 'call', 'ネオンのリストバンド', '大型公演の熱気が残る架空ホール。'],
    ['駅前グッズ交換広場', 'station', 2, 800, 5, { money: 600 }, ['B', 'C'], 'unit', '交換ステッカー', 'ファン同士が交換する架空の広場。'],
    ['下町レコード資料館', 'museum', 2, 1000, 5, {}, ['D', 'G'], 'ballad', '資料館の半券', '架空の音楽資料を展示する館。'],
  ]),
  ...mk('yokohama', [
    ['赤レンガ風ベイステージ（架空）', 'park', 2, 900, 5, {}, ['C', 'F'], 'all', '潮風のチケット', '海風の中で歌が響く架空の広場。'],
    ['港のミュージックバー', 'cafe', 1, 700, 4, { stamina: 4 }, ['E', 'G'], 'ballad', 'バーのコースター', '静かなバラードが流れる架空の店。'],
    ['中華街ふれあい市場', 'market', 1, 500, 5, { money: 1000 }, ['H', 'A'], 'call', '福を呼ぶ小袋', '屋台で元気が出る架空市場。'],
  ]),
  ...mk('nagoya', [
    ['天守の見えるライブ会場（架空）', 'castle', 3, 2000, 7, {}, ['B', 'E'], 'call', '金のしゃちほこピン', '歴史ある名所に併設の架空会場。'],
    ['モーニング喫茶「いちばん星」', 'cafe', 1, 600, 4, { stamina: 6 }, ['C', 'H'], 'unit', '小倉トーストのピンバッジ', '朝から推し活の作戦会議ができる。'],
    ['レコード＆ミシン堂', 'record', 2, 900, 5, { money: 700 }, ['A', 'D'], 'ballad', 'ミシン糸のリボン', '古い音源が眠る架空の店。'],
  ]),
  ...mk('kyoto', [
    ['鴨川ほとりの野外ステージ（架空）', 'park', 2, 800, 5, {}, ['D', 'F'], 'ballad', '鴨川の石', '夕暮れの歌が似合う架空の河原。'],
    ['縁結びの社（架空）', 'shrine', 2, 500, 5, { stamina: 3 }, ['B', 'G'], 'unit', '縁結びのお守り', '同じ推しの人と出会えると噂の架空社。'],
    ['竹林カフェ「しずく」', 'cafe', 1, 700, 4, { stamina: 5 }, ['A', 'C'], 'ballad', '竹の栞', '静けさに包まれる架空カフェ。'],
  ]),
  ...mk('osaka', [
    ['なにわ笑売ホール（架空）', 'livehouse', 3, 2200, 7, {}, ['E', 'G'], 'call', '笑売繁盛のうちわ', 'MCがうまくなる架空のホール。'],
    ['道頓堀ナイト市場', 'market', 1, 600, 5, { money: 1500 }, ['A', 'F'], 'all', 'たこ焼き型消しゴム', '食べ歩きで資金が増える架空市場。'],
    ['水都レコード工房', 'record', 2, 1000, 5, {}, ['B', 'H'], 'unit', '工房のレコード針', '推しの曲を探せる架空工房。'],
  ]),
  ...mk('kobe', [
    ['異人館ミュージックサロン（架空）', 'museum', 2, 1000, 5, {}, ['C', 'D'], 'ballad', 'サロンの絵はがき', '歌声が響く架空の洋館。'],
    ['ハーバーライト展望台', 'station', 1, 500, 4, { stamina: 4 }, ['E', 'H'], 'all', '夜景ポストカード', '夜景で心が整う架空展望台。'],
    ['南京町グッズ横丁', 'market', 1, 500, 5, { money: 1100 }, ['A', 'G'], 'call', '赤い提灯ストラップ', '推しグッズが並ぶ架空の横丁。'],
  ]),
  ...mk('hiroshima', [
    ['瀬戸内ミュージックアクアリウム（架空）', 'aquarium', 2, 1200, 5, {}, ['F', 'B'], 'ballad', 'くらげのガラス玉', '水中コンサートが楽しめる架空水族館。'],
    ['川沿いのお好み焼き横丁', 'market', 1, 600, 5, { money: 1000, stamina: 2 }, ['D', 'H'], 'call', 'へらのキーホルダー', 'ボリューム満点で体力が出る。'],
    ['宮島風の朱の社（架空）', 'shrine', 2, 600, 5, {}, ['C', 'G'], 'unit', '朱色のお守り', '静かに祈れる架空の社。'],
  ]),
  ...mk('fukuoka', [
    ['天神ベイサイド・アリーナ（架空）', 'livehouse', 3, 2400, 7, {}, ['A', 'E'], 'all', 'アリーナの銀テープ', '大規模公演に似た熱気の架空会場。'],
    ['屋台通りの作戦会議', 'market', 1, 700, 5, { money: 900, stamina: 2 }, ['B', 'D'], 'call', '屋台の提灯', '夜通し語れる架空の屋台村。'],
    ['博多駅前ストリートライブ', 'station', 2, 500, 5, {}, ['F', 'H'], 'unit', 'ストリートの投げ銭箱', '無名の歌い手と出会える架空の路上。'],
  ]),
  ...mk('kumamoto', [
    ['阿蘇の風ステージ（架空）', 'park', 2, 800, 6, {}, ['C', 'E'], 'ballad', '阿蘇の風鈴', '雄大な景色で歌う架空の野外会場。'],
    ['お城下の市場通り', 'market', 1, 500, 5, { money: 1200 }, ['G', 'A'], 'unit', '馬刺し型マグネット', '地元の声援が温かい架空市場。'],
    ['ゆるキャラ展示館（架空）', 'museum', 1, 700, 4, { stamina: 3 }, ['B', 'F'], 'all', 'ゆるキャラのバッジ', '見た目はゆるい架空のミュージアム。'],
  ]),
  ...mk('miyazaki', [
    ['南国ビーチ・サンセットステージ（架空）', 'park', 3, 2000, 7, {}, ['D', 'H'], 'ballad', '夕陽のシェル', '南国の夕陽を背に歌う架空ステージ。'],
    ['日向の神話茶屋（架空）', 'shrine', 2, 600, 5, { stamina: 4 }, ['A', 'C'], 'unit', '神話茶屋の湯呑み', '架空の神話にちなむ茶屋。'],
    ['フェニックス並木ドライブイン', 'cafe', 1, 600, 4, { stamina: 4, money: 400 }, ['E', 'G'], 'call', 'ドライブインのコイン', 'ご当地メニューで元気が出る。'],
  ]),
];
export const SPOT_MAP: Readonly<Record<string, SpotDef>> = Object.freeze(
  Object.fromEntries(SPOTS.map((x) => [x.id, x])),
);

// ---------- 資産（すべて架空のゲーム内資産。実在の施設の所有を示すものではない） ----------
export interface AssetDef {
  id: string;
  name: string;
  city: CityId;
  price: number;
  blurb: string;
  weeklyIncome: number;
  /** ライブでの各メーター獲得値への加算率 */
  liveBonus: Partial<Gain3>;
  extraHand: number;
}
export const ASSETS: readonly AssetDef[] = [
  { id: 'a1', name: '架空スタジオ「ネオン工房」', city: 'nagoya', price: 30000, blurb: '毎週のグッズ収益が入る。', weeklyIncome: 2500, liveBonus: {}, extraHand: 0 },
  { id: 'a2', name: '架空ライブハウス「ブルー・ラボ」', city: 'sendai', price: 45000, blurb: 'ライブの熱量+6%。', weeklyIncome: 0, liveBonus: { h: 0.06 }, extraHand: 0 },
  { id: 'a3', name: '架空劇場「ピンク・シアター」', city: 'kyoto', price: 60000, blurb: 'ライブの一体感+6%。', weeklyIncome: 0, liveBonus: { u: 0.06 }, extraHand: 0 },
  { id: 'a4', name: '架空ホール「パープル・ホール」', city: 'hiroshima', price: 80000, blurb: 'ライブの思い出+6%。', weeklyIncome: 0, liveBonus: { m: 0.06 }, extraHand: 0 },
  { id: 'a5', name: '架空アリーナ「オーロラ・アリーナ」', city: 'fukuoka', price: 150000, blurb: '開演時の手札+1、毎週+3,000。', weeklyIncome: 3000, liveBonus: {}, extraHand: 1 },
  { id: 'a6', name: '架空スタジアム「サンプル・スタジアム」', city: 'tokyo', price: 260000, blurb: 'ライブの全メーター+5%、毎週+6,000。', weeklyIncome: 6000, liveBonus: { h: 0.05, u: 0.05, m: 0.05 }, extraHand: 0 },
];
export const ASSET_MAP: Readonly<Record<string, AssetDef>> = Object.freeze(
  Object.fromEntries(ASSETS.map((x) => [x.id, x])),
);

// ---------- 公演（週4/8/12） ----------
export interface CpuCfg {
  name: string;
  oshi: OshiType;
  member: MemberId | null;
  /** カードID→枚数（合法な20枚） */
  deck: Record<string, number>;
  gainMult: number;
}
export interface ConcertDef {
  id: string;
  week: number;
  name: string;
  venue: string;
  city: CityId;
  target: number;
  setlist: SongDef[];
  cpu: CpuCfg;
  blurb: string;
}

export const CONCERTS: readonly ConcertDef[] = [
  {
    id: 'live1', week: 4, name: '春のはじまりライブ', venue: '架空ホール「ブルーベイ」', city: 'osaka', target: 42,
    blurb: '初めてのCPU対戦。まずは基本のコンボを覚えよう。',
    setlist: [
      { id: 's1', name: 'ネオン・コール', type: 'call' },
      { id: 's2', name: 'ふたりの色', type: 'unit' },
      { id: 's3', name: '終電の星空', type: 'ballad' },
      { id: 's4', name: 'みんなのステージ', type: 'all' },
    ],
    cpu: {
      name: 'CPU「ピンクウェーブ隊」', oshi: 'box', member: null, gainMult: 0.97,
      deck: { c01: 2, c02: 2, c03: 1, c05: 2, c06: 1, c07: 2, c08: 1, c09: 1, c11: 1, c12: 1, c13: 1, c14: 1, c15: 1, c17: 1, c18: 1, c20: 1 },
    },
  },
  {
    id: 'live2', week: 8, name: '夏の熱狂フェス', venue: '架空アリーナ「ネオンベイ」', city: 'tokyo', target: 52,
    blurb: 'コール中心のセットリスト。CPUもコンボ型で攻めてくる。',
    setlist: [
      { id: 's5', name: 'サマー・レスポンス', type: 'call' },
      { id: 's6', name: 'ハーモニー・ライン', type: 'unit' },
      { id: 's7', name: '夕凪メモリー', type: 'ballad' },
      { id: 's8', name: 'フェス・オールスターズ', type: 'all' },
    ],
    cpu: {
      name: 'CPU「コンボ団」', oshi: 'combo', member: null, gainMult: 1.14,
      deck: { c09: 2, c10: 2, c21: 2, c22: 2, c24: 1, c25: 2, c11: 1, c05: 1, c19: 1, c13: 1, c26: 1, c33: 1, c30: 1, c27: 1, c31: 1 },
    },
  },
  {
    id: 'live3', week: 12, name: 'ファイナルナイト', venue: '架空スタジアム「オーロラ」', city: 'fukuoka', target: 58,
    blurb: '最終公演。CPUは推しメンバーEに特化したソロ型。',
    setlist: [
      { id: 's9', name: 'ファイナル・コール', type: 'call' },
      { id: 's10', name: 'ふたつの光', type: 'unit' },
      { id: 's11', name: '12週目のバラード', type: 'ballad' },
      { id: 's12', name: 'ありがとうオール', type: 'all' },
    ],
    cpu: {
      name: 'CPU「ブルーパープル・ソロ」', oshi: 'solo', member: 'E', gainMult: 1.1,
      deck: { c05: 2, c13: 2, c21: 2, c31: 1, c37: 1, c18: 2, c20: 1, c26: 1, c14: 1, c16: 1, c19: 1, c27: 1, c28: 1, c34: 1, c36: 1, c32: 1 },
    },
  },
];
export const CONCERT_MAP: Readonly<Record<string, ConcertDef>> = Object.freeze(
  Object.fromEntries(CONCERTS.map((x) => [x.id, x])),
);

// ---------- 推しタイプ ----------
export interface OshiTypeDef {
  id: OshiType;
  name: string;
  tagline: string;
  passive: string;
  strategy: string;
}
export const OSHI_TYPES: readonly OshiTypeDef[] = [
  {
    id: 'solo', name: '単推し',
    tagline: 'ひとりを全力で推す。',
    passive: '推しメンバーのカードの獲得値が×1.5。開演時に推しメンバーのカードを1枚、必ず手札に引き寄せる。',
    strategy: '推しメンバーのカードを多めに編成すると強い。',
  },
  {
    id: 'combo', name: 'コンボ',
    tagline: '流れで魅せる連携派。',
    passive: 'コンボボーナスが×2.2。コンボ成功ごとにその曲の以降の獲得値+6%（最大+30%）。各曲で最初のコンボ成功時にカードを1枚引く。',
    strategy: '同メンバー・系統・地域・曲タイプが連なるデッキが強い。',
  },
  {
    id: 'box', name: '箱推し',
    tagline: 'みんなまとめて応援する。',
    passive: 'この公演で既に使ったメンバーの種類数×4%（最大+24%）全獲得値が増加。一体感が+10%。',
    strategy: '多くのメンバーのカードを混ぜたデッキが強い。',
  },
];
export const OSHI_MAP: Readonly<Record<OshiType, OshiTypeDef>> = Object.freeze(
  Object.fromEntries(OSHI_TYPES.map((x) => [x.id, x])) as Record<OshiType, OshiTypeDef>,
);

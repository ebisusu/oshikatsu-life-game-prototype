import type { Card, City, Effect, FanType, Member, Route, SongType, Values } from './model';
const g=(heat=0,unity=0,memory=0):Effect=>({op:'gain',values:{heat,unity,memory}});
// Explicit, extensible card schema. Each card has a distinct resolved effect/condition combination.
const definitions: [string,Card['rarity'],number,Card['kind'],string,Effect[]][] = [
 ['はじめてのコール','N',1,'action','熱量 +16',[g(16)]],
 ['おそろいの光','N',1,'action','一体感 +18',[g(0,18)]],
 ['帰り道の余韻','N',1,'action','思い出 +22',[g(0,0,22)]],
 ['ペンライト二刀流','N',2,'action','熱量 +28 / 一体感 +8',[g(28,8)]],
 ['手作りネームボード','N',1,'support','熱量 +8。次に使うカードに熱量 +10',[g(8),{op:'next',values:{heat:10}}]],
 ['旅のしおり','N',1,'support','思い出 +7。手札を1枚引く（上限7）',[g(0,0,7),{op:'draw',amount:1}]],
 ['開演前の深呼吸','N',1,'support','前半なら一体感 +24、後半なら思い出 +12',[{...g(0,24),when:{phase:'front'}},{...g(0,0,12),when:{phase:'back'}}]],
 ['ふたりのハーモニー','N',1,'combo','一体感 +8。直前と同じメンバーなら +22',[g(0,8),{...g(0,22),when:{previousMember:true}}]],
 ['今日の一枚','R',1,'action','熱量 +8 / 思い出 +18',[g(8,0,18)]],
 ['会場ウェーブ','R',2,'combo','一体感 +14。この曲で先に2枚使っていたら +34',[g(0,14),{...g(0,34),when:{minPlayed:2}}]],
 ['コール＆レスポンス','R',1,'combo','熱量 +10。直前がactionなら熱量 +20',[g(10),{...g(20),when:{previousKind:'action'}}]],
 ['バラードの涙','R',1,'action','思い出 +12。バラード曲なら +26',[g(0,0,12),{...g(0,0,26),when:{song:'ballad'}}]],
 ['遠征スタンプ','R',1,'support','公演で使った地域数 × 思い出8、熱量 +5',[g(5),{op:'perRegion',values:{memory:8}}]],
 ['ユニットの絆','R',2,'combo','一体感 +16。公演で3人以上使用済なら +32',[g(0,16),{...g(0,32),when:{minMembers:3}}]],
 ['満員の歓声','R',2,'action','手札の残り枚数 × 熱量7、熱量 +10',[g(10),{op:'perHand',values:{heat:7}}]],
 ['アンコール準備','R',1,'support','一体感 +6。次に使うカードに全指標 +8',[g(0,6),{op:'next',values:{heat:8,unity:8,memory:8}}]],
 ['拍手のリレー','R',1,'combo','一体感 +8。この曲の使用枚数 × 一体感7',[g(0,8),{op:'perPlayed',values:{unity:7}}]],
 ['記憶のチケット','R',1,'action','捨て札枚数 × 思い出3、思い出 +10',[g(0,0,10),{op:'perDiscard',values:{memory:3}}]],
 ['青いスポットライト','R',2,'action','熱量 +18。コール曲なら熱量 +30',[g(18),{...g(30),when:{song:'call'}}]],
 ['虹色の客席','R',2,'combo','一体感 +10。公演で使用したメンバー数 × 一体感8',[g(0,10),{op:'perMember',values:{unity:8}}]],
 ['最前列の集中','SR',2,'action','自分の推しメンバーなら熱量 +48、違うなら +24',[{op:'focus',values:{heat:24}}]],
 ['サビの大合唱','SR',2,'combo','熱量 +16。後半なら一体感 +42',[g(16),{...g(0,42),when:{phase:'back'}}]],
 ['旅するフォトブック','SR',2,'support','公演で2地域以上使用済なら思い出 +50。一体感 +12',[g(0,12),{...g(0,0,50),when:{minRegions:2}}]],
 ['全員にありがとう','SR',2,'action','全体曲なら全指標 +22。それ以外は一体感 +18',[g(0,18),{...g(22,4,22),when:{song:'all'}}]],
 ['セットリスト予習','SR',1,'support','山札残り枚数 × 熱量2。手札を1枚引く',[{op:'perDraw',values:{heat:2}},{op:'draw',amount:1}]],
 ['ツアーの軌跡','SR',2,'action','終了した曲数 × 思い出15、熱量 +18',[g(18),{op:'perSong',values:{memory:15}}]],
 ['友情のコール','SR',1,'combo','この曲で使用したaction枚数 × 一体感12、熱量 +8',[g(8),{op:'perKind',values:{unity:12}}]],
 ['ミックスの極意','SR',2,'combo','過去に成功したコンボ数 × 熱量10、一体感 +18',[g(0,18),{op:'perCombo',values:{heat:10}}]],
 ['静寂のペンライト','SR',1,'support','現在最も低い指標に +30',[{op:'balance',amount:30}]],
 ['ふりかえる夏','SR',2,'combo','思い出 +18。前の曲を1枚でも使っていれば +36',[g(0,0,18),{...g(0,0,36),when:{previousSong:true}}]],
 ['光のエコー','SR',2,'combo','直前カードのメンバーが同じなら全指標 +24、熱量 +10',[g(10),{...g(24,24,24),when:{previousMember:true}}]],
 ['推し色の決意','SR',2,'finisher','熱量 +25。公演の推しカード使用枚数 × 熱量8',[g(25),{op:'echo',values:{heat:8}}]],
 ['奇跡のユニゾン','SSR',2,'combo','一体感 +22。ユニット曲かつ3人使用済なら全指標 +30',[g(0,22),{...g(30,30,30),when:{song:'unit',minMembers:3}}]],
 ['星空の約束','SSR',2,'finisher','思い出 +24。バラード後半なら思い出 +64',[g(0,0,24),{...g(0,0,64),when:{song:'ballad',phase:'back'}}]],
 ['全国つながる光','SSR',2,'combo','公演で使用した地域数 × 一体感12 / 思い出8',[{op:'perRegion',values:{unity:12,memory:8}}]],
 ['夢のダブルアンコール','SSR',2,'finisher','最終曲なら熱量 +60 / 思い出 +30。他の曲は熱量 +20',[g(20),{op:'encore',values:{heat:40,memory:30}}]],
 ['空っぽのその先へ','SSR',1,'support','熱量 +18。山札が空なら全指標 +30。2枚引く',[g(18),{...g(30,30,30),when:{emptyDraw:true}},{op:'draw',amount:2}]],
 ['人生のハイライト','UR',2,'finisher','後半かつこの曲2枚使用済なら全指標 +52。それ以外は全指標 +12',[g(12,12,12),{...g(40,40,40),when:{phase:'back',minPlayed:2}}]],
 ['八色の未来','UR',2,'finisher','公演で使用したメンバー数 × 全指標12',[{op:'perMember',values:{heat:12,unity:12,memory:12}}]],
 ['ラスト・カーテン','UR',2,'finisher','最終曲に全指標 +45。次のカードに熱量 +20',[{op:'encore',values:{heat:45,unity:45,memory:45}},{op:'next',values:{heat:20}}]],
];
export const MEMBERS:Member[]=['A','B','C','D','E','F','G','H'];
export const REGIONS=['北海道','東北','関東','中部','近畿','中国','九州'];
export const SONG_TYPES:SongType[]=['call','unit','ballad','all'];
export const SONG_LABELS:Record<SongType,string>={call:'コール',unit:'ユニット',ballad:'バラード',all:'全体'};
export const KIND_LABELS={action:'アクション',support:'サポート',combo:'コンボ',finisher:'フィニッシャー'};
export const METRIC_LABELS={heat:'熱量',unity:'一体感',memory:'思い出'};
export const CARDS:Card[]=definitions.map(([name,rarity,cost,kind,description,effects],i)=>({id:`c${String(i+1).padStart(2,'0')}`,name,rarity,cost,kind,description,effects,member:MEMBERS[i%8],song:SONG_TYPES[i%4],region:REGIONS[i%7]}));
export const CARD:Record<string,Card>=Object.fromEntries(CARDS.map(c=>[c.id,c]));
export const START_DECK=CARDS.slice(0,10).flatMap(c=>[c.id,c.id]);
export const START_COLLECTION=Object.fromEntries(CARDS.slice(0,12).map(c=>[c.id,2]));
export const FAN_TYPES:Record<FanType,{name:string;icon:string;description:string}>={
 solo:{name:'単推し',icon:'♡',description:'推しメンバーのカード使用時、熱量 +12 / 思い出 +4。推しを集中して編成。'},
 combo:{name:'コンボ',icon:'↗',description:'コンボ効果の条件成立時、熱量 +10 / 一体感 +10。使用順とフェーズが鍵。'},
 group:{name:'箱推し',icon:'✦',description:'各曲で初めてのメンバーを使うと一体感 +10 / 思い出 +6。多彩な編成が強み。'},
};
const cityRows:[string,string,string,number,number][]=[
 ['sapporo','札幌','北海道',85,10],['sendai','仙台','東北',78,29],['tokyo','東京','関東',74,47],['yokohama','横浜','関東',73,55],['nagoya','名古屋','中部',56,55],['kyoto','京都','近畿',43,49],['osaka','大阪','近畿',41,61],['kobe','神戸','近畿',31,54],['hiroshima','広島','中国',26,66],['fukuoka','福岡','九州',11,73],['kumamoto','熊本','九州',13,84],['miyazaki','宮崎','九州',25,92],
];
export const CITIES:City[]=cityRows.map(([id,name,region,x,y],i)=>({id,name,region,x,y,spots:[
 {id:`${id}-gallery`,name:`${name}・ひかりギャラリー`,type:'展示スポット（架空）',money:800+(i%3)*200,stamina:8,region,pool:['N','R','R','SR']},
 {id:`${id}-studio`,name:`${name}・おもいでスタジオ`,type:'交流スポット（架空）',money:400+(i%4)*200,stamina:12,region,pool:['R','SR','SR','SSR','UR']},
]}));
const edges:[string,string,number,number][]=[['sapporo','sendai',2,9000],['sendai','tokyo',2,6000],['tokyo','yokohama',1,1000],['tokyo','nagoya',2,6500],['nagoya','kyoto',1,3500],['kyoto','osaka',1,1000],['osaka','kobe',1,1000],['kobe','hiroshima',2,5000],['hiroshima','fukuoka',2,5500],['fukuoka','kumamoto',1,2500],['kumamoto','miyazaki',2,3000],['miyazaki','fukuoka',2,4500],['tokyo','sapporo',2,14000],['osaka','fukuoka',2,9500]];
export const ROUTES:Route[]=edges.flatMap(([from,to,ap,cost])=>[{from,to,ap,cost},{from:to,to:from,ap,cost}]);
export const CITY=Object.fromEntries(CITIES.map(c=>[c.id,c]));
export const SONGS:{name:string;type:SongType;target:Values}[]=[
 {name:'光がはじまる',type:'call',target:{heat:100,unity:70,memory:50}},
 {name:'ふたりの軌道',type:'unit',target:{heat:85,unity:90,memory:55}},
 {name:'帰り道の星',type:'ballad',target:{heat:70,unity:65,memory:100}},
 {name:'またここで会おう',type:'all',target:{heat:100,unity:90,memory:80}},
];
export const CONCERTS:Record<number,{name:string;city:string}>={4:{name:'FIRST LIGHT',city:'tokyo'},8:{name:'CROSSING COLORS',city:'osaka'},12:{name:'OUR FINALE',city:'fukuoka'}};
export const TROPHIES=[
 {id:'first',name:'はじめの一歩',description:'スポットを1回探索'},
 {id:'collector',name:'旅するコレクター',description:'カードを6枚獲得'},
 {id:'traveler',name:'街から街へ',description:'3都市を訪問'},
 {id:'worker',name:'推し活のために',description:'仕事を3回行う'},
 {id:'training',name:'準備も楽しみ',description:'訓練を3回行う'},
 {id:'debut',name:'ライブデビュー',description:'ライブ報酬を1回受け取る'},
 {id:'victory',name:'最高の一日',description:'CPUに勝利'},
 {id:'chain',name:'つながる想い',description:'条件付きコンボを3回成功'},
 {id:'owner',name:'みんなの居場所',description:'架空ゲーム資産を1件購入'},
 {id:'finish',name:'12週間の宝物',description:'12週を終了'},
];

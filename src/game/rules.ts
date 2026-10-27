import { CARD, CARDS, CITIES, CITY, CONCERTS, ROUTES, START_COLLECTION, START_DECK } from './data';
import { deckErrors } from './deck';
import { advancePhase, liveTotal, makeLive, playCard, playError } from './live';
import { random, shuffle } from './rng';
import { VERSION, zero } from './model';
import type { Action, FanType, GameState, Member, Transition } from './model';
export function createGame(type:FanType='solo',member:Member='A',city='tokyo',seed=20261028):GameState{
 return {version:VERSION,seed:seed>>>0,initialSeed:seed>>>0,week:1,status:'playing',money:60000,stamina:80,ap:4,city:CITY[city]?city:'tokyo',visited:[CITY[city]?city:'tokyo'],visitedSpots:[],type,member,collection:{...START_COLLECTION},deck:[...START_DECK],training:zero(),assets:[],pending:null,live:null,resolvedWeeks:[],stats:{explores:0,works:0,trains:0,wins:0,lives:0,combos:0,obtained:0,spent:0},trophies:[],journal:['推し活の12週間がスタート。あなたが旅の主人公。']};
}
export function travelCost(from:string,to:string):number{
 const costs:Record<string,number>=Object.fromEntries(CITIES.map(c=>[c.id,Infinity]));costs[from]=0;const done=new Set<string>();
 while(done.size<CITIES.length){const next=Object.keys(costs).filter(id=>!done.has(id)).sort((a,b)=>costs[a]-costs[b])[0];if(!next||!Number.isFinite(costs[next]))break;done.add(next);for(const r of ROUTES.filter(r=>r.from===next))costs[r.to]=Math.min(costs[r.to],costs[next]+r.cost);}
 return costs[to]??Infinity;
}
export function venueCost(s:GameState):number{const concert=CONCERTS[s.week];return concert?4000+travelCost(s.city,concert.city):Infinity;}
export function liveDue(s:GameState):boolean{return !!CONCERTS[s.week]&&!s.resolvedWeeks.includes(s.week);}
export function checkTrophies(s:GameState):void{
 const flags:Record<string,boolean>={first:s.stats.explores>=1,collector:s.stats.obtained>=6,traveler:s.visited.length>=3,worker:s.stats.works>=3,training:s.stats.trains>=3,debut:s.stats.lives>=1,victory:s.stats.wins>=1,chain:s.stats.combos>=3,owner:s.assets.length>=1,finish:s.status==='finished'};
 for(const [id,on]of Object.entries(flags))if(on&&!s.trophies.includes(id))s.trophies.push(id);
}
export function actionError(s:GameState,a:Action):string|undefined{
 if(s.status==='finished')return '12週間の旅は終了しました。リセットで新しい旅へ';
 if(s.pending&&a.type!=='choose')return '探索報酬のカードを1枚選んでください';
 if(s.live&&s.live.status==='playing'&&!['play','phase'].includes(a.type))return 'ライブのフェーズを進めて終演してください';
 if(s.live&&s.live.status==='result'&&!s.live.rewardClaimed&&a.type!=='claim')return 'ライブの報酬を受け取ってください';
 const cost=(ap:number,money=0,stamina=0)=>s.ap<ap?'APが不足しています':s.money<money?'資金が不足しています':s.stamina<stamina?'体力が不足しています':undefined;
 switch(a.type){
 case 'work':return cost(2,0,12);
 case 'rest':return cost(2);
 case 'train':return cost(1,1000,8);
 case 'move':{const route=ROUTES.find(r=>r.from===s.city&&r.to===a.city);return !route?'直結する経路を選んでください':cost(route.ap,route.cost,route.ap*6);}
 case 'explore':{const spot=CITY[s.city].spots.find(p=>p.id===a.spot);return !spot?'現在の都市のスポットを選んでください':cost(1,0,spot.stamina);}
 case 'choose':return !s.pending||!s.pending.cards.includes(a.card)?'提示されたカードを選んでください':undefined;
 case 'buy':return s.assets.includes(s.city)?'この街の資産は購入済みです':cost(1,28000);
 case 'week':return liveDue(s)?'今週のライブに参加、または見送りを選んでください':undefined;
 case 'skip':return !liveDue(s)?'今週は未解決のライブがありません':undefined;
 case 'startLive':return !liveDue(s)?'今週は未解決のライブがありません':deckErrors(s.deck,s.collection)[0]??(a.mode==='venue'?s.money<venueCost(s)?'現地参加の資金不足です。配信は救済付きで必ず参加できます':s.stamina<8?'現地参加は体力8が必要です。配信なら参加できます':undefined:undefined);
 case 'deck':return deckErrors(a.deck,s.collection)[0];
 case 'play':return !s.live?'開催中のライブがありません':playError(s.live,s.live.player,a.index);
 case 'phase':return !s.live||s.live.status!=='playing'?'開催中のライブがありません':undefined;
 case 'claim':return !s.live||s.live.status!=='result'||s.live.rewardClaimed?'未受取の報酬はありません':undefined;
 }
}
export function act(state:GameState,a:Action):Transition{
 const error=actionError(state,a);if(error)return {state,error};
 const s=structuredClone(state);let message='';
 const spend=(ap:number,money=0,stamina=0)=>{s.ap-=ap;s.money-=money;s.stamina-=stamina;s.stats.spent+=money;};
 switch(a.type){
 case 'work':spend(2,0,12);s.money+=22000;s.stats.works++;message='仕事完了。資金 +22,000 / 体力 −12';break;
 case 'rest':spend(2);s.stamina=Math.min(100,s.stamina+35);message='ゆっくり休息。体力 +35（上限100）';break;
 case 'train':spend(1,1000,8);s.training[a.metric]+=2;s.stats.trains++;message='訓練完了。選んだ指標がライブの各カード使用時 +2';break;
 case 'move':{const r=ROUTES.find(r=>r.from===s.city&&r.to===a.city)!;spend(r.ap,r.cost,r.ap*6);s.city=a.city;if(!s.visited.includes(a.city))s.visited.push(a.city);message=`${CITY[a.city].name}に到着。スポットを探索しよう`;break;}
 case 'explore':{
  const spot=CITY[s.city].spots.find(p=>p.id===a.spot)!;spend(1,0,spot.stamina);s.money+=spot.money;s.stats.explores++;if(!s.visitedSpots.includes(spot.id))s.visitedSpots.push(spot.id);
  const choices:string[]=[];
  for(let i=0;i<3;i++){
   const [r,next]=random(s.seed);s.seed=next;const rarity=spot.pool[Math.floor(r*spot.pool.length)];
   const candidates=CARDS.filter(c=>c.rarity===rarity&&!choices.includes(c.id));
   const local=candidates.filter(c=>c.region===spot.region);const pool=local.length?local:candidates;
   const [mixed,seed]=shuffle(pool,s.seed);s.seed=seed;choices.push(mixed[0].id);
  }
  s.pending={spot:spot.id,cards:choices};message=`${spot.name}を訪問。資金 +${spot.money}。カードを三択から1枚獲得`;break;
 }
 case 'choose':s.collection[a.card]=(s.collection[a.card]??0)+1;s.stats.obtained++;s.pending=null;message=`「${CARD[a.card].name}」を獲得。デッキ画面から編成できます`;break;
 case 'buy':spend(1,28000);s.assets.push(s.city);message='架空のファンラウンジを購入。週末の収入 +1,000';break;
 case 'skip':s.resolvedWeeks.push(s.week);message='今週の公演を見送りました。次の旅へ進めます';break;
 case 'week':s.money+=2000+s.assets.length*1000;s.stamina=Math.min(100,s.stamina+10);if(s.week===12){s.status='finished';s.ap=0;message='12週間の旅が終了！あなたの宝物を振り返ろう';}else{s.week++;s.ap=4;message=`第${s.week}週。週末の収入 +${2000+s.assets.length*1000} / 体力 +10`;}break;
 case 'deck':s.deck=[...a.deck];message='20枚のデッキを保存しました';break;
 case 'startLive':{
  const price=a.mode==='venue'?venueCost(s):Math.min(s.money,1500);const subsidized=a.mode==='stream'&&s.money<1500;
  spend(0,price,a.mode==='venue'?8:0);s.live=makeLive(s,a.mode,CONCERTS[s.week].city,subsidized);s.seed=s.live.seed;message='ライブ開演！手札を選び、前半から後半へ進もう';break;
 }
 case 'play':playCard(s.live!,'player',a.index);s.seed=s.live!.seed;break;
 case 'phase':advancePhase(s.live!);s.seed=s.live!.seed;break;
 case 'claim':{
  const l=s.live!;const win=liveTotal(l,'player')>liveTotal(l,'cpu');const reward=(l.mode==='venue'?10000:l.subsidized?1000:4000)+(win?6000:0);
  s.money+=reward;s.stats.lives++;if(win)s.stats.wins++;
  s.stats.combos+=l.player.history.filter(h=>h.combo).length;
  const pool=CARDS.filter(c=>c.rarity===(win?'SSR':'SR'));const [r,next]=random(s.seed);s.seed=next;const card=pool[Math.floor(r*pool.length)];s.collection[card.id]=(s.collection[card.id]??0)+1;s.stats.obtained++;
  l.rewardClaimed=true;s.resolvedWeeks.push(s.week);message=`${win?'勝利！':'完走！'}資金 +${reward.toLocaleString()}、${card.rarity}「${card.name}」を獲得`;break;
 }
 }
 checkTrophies(s);
 if(message)s.journal=[`W${s.week}｜${message}`,...s.journal].slice(0,60);
 return {state:s,message};
}

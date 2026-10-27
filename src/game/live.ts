import { CARD, CARDS, CITY, METRIC_LABELS, SONGS, START_COLLECTION } from './data';
import { autoDeck } from './deck';
import { shuffle } from './rng';
import { zero } from './model';
import type { Card, Condition, Effect, EffectOp, Fighter, GameState, Live, Member, Metric, Values } from './model';
const METRICS:Metric[]=['heat','unity','memory'];
export function add(to:Values,values:Partial<Values>,scale=1){for(const k of METRICS)to[k]+=(values[k]??0)*scale;}
export function conditionMet(when:Condition|undefined,f:Fighter,c:Card,l:Live):boolean{
 if(!when)return true;
 const previous=f.history.at(-1);const local=f.history.filter(h=>h.song===l.song);
 return (!when.phase||when.phase===l.phase)&&(!when.song||when.song===SONGS[l.song].type)
 &&(!when.previousMember||previous?.member===c.member)
 &&(!when.previousKind||previous?.kind===when.previousKind)
 &&(when.minPlayed===undefined||local.length>=when.minPlayed)
 &&(when.minMembers===undefined||new Set(f.history.map(h=>h.member)).size>=when.minMembers)
 &&(when.minRegions===undefined||new Set(f.history.map(h=>h.region)).size>=when.minRegions)
 &&(!when.previousSong||f.history.some(h=>h.song===l.song-1))
 &&(!when.emptyDraw||f.draw.length===0);
}
export function drawCards(f:Fighter,n:number,l:Live):void{
 for(let i=0;i<n&&f.hand.length<7;i++){
  if(!f.draw.length){if(!f.discard.length)break;[f.draw,l.seed]=shuffle(f.discard,l.seed);f.discard=[];l.log.push('捨て札をシャッフルして山札へ');}
  const id=f.draw.pop();if(id)f.hand.push(id);
 }
}
type Context={f:Fighter;c:Card;l:Live; effect:Effect};
const scaled=(ctx:Context,n:number)=>add(ctx.f.current,ctx.effect.values??{},n);
// Registry is independent from React and can be extended without changing the battle UI.
export const EFFECT_REGISTRY:Record<EffectOp,(ctx:Context)=>void>={
 gain:ctx=>scaled(ctx,1),
 draw:({f,effect,l})=>drawCards(f,effect.amount??1,l),
 next:({f,effect})=>add(f.next,effect.values??{}),
 perPlayed:ctx=>scaled(ctx,ctx.f.history.filter(h=>h.song===ctx.l.song).length),
 perMember:ctx=>scaled(ctx,new Set(ctx.f.history.map(h=>h.member)).size),
 perKind:ctx=>scaled(ctx,ctx.f.history.filter(h=>h.song===ctx.l.song&&h.kind==='action').length),
 perRegion:ctx=>scaled(ctx,new Set(ctx.f.history.map(h=>h.region)).size),
 perDiscard:ctx=>scaled(ctx,ctx.f.discard.length),
 perHand:ctx=>scaled(ctx,ctx.f.hand.length),
 perDraw:ctx=>scaled(ctx,ctx.f.draw.length),
 perSong:ctx=>scaled(ctx,ctx.l.song),
 perCombo:ctx=>scaled(ctx,ctx.f.history.filter(h=>h.combo).length),
 balance:({f,effect,l})=>{const min=METRICS.reduce((a,b)=>f.current[a]<=f.current[b]?a:b);f.current[min]+=effect.amount??0;l.log.push(`${METRIC_LABELS[min]}を補強`);},
 echo:ctx=>scaled(ctx,ctx.f.history.filter(h=>h.member===ctx.f.member).length),
 focus:ctx=>scaled(ctx,ctx.c.member===ctx.f.member?2:1),
 encore:ctx=>{if(ctx.l.song===3)scaled(ctx,1);},
};
export function playError(l:Live,f:Fighter,index:number):string|undefined{
 if(l.status!=='playing')return '公演は終了しています';
 const c=CARD[f.hand[index]];if(!c)return '手札を選んでください';
 if(f.ep<c.cost)return 'この曲のEPが不足しています';
 if(l.phase==='front'&&f.frontSpent+c.cost>2)return '前半は合計2EPまで。後半へ進めます';
 const limit=c.rarity==='SR'?2:c.rarity==='SSR'||c.rarity==='UR'?1:Infinity;
 if((f.used[c.id]??0)>=limit)return `${c.rarity}の公演使用上限（同一カード${limit}回）です`;
 return undefined;
}
export function playCard(l:Live,side:'player'|'cpu',index:number):void{
 const f=l[side];if(playError(l,f,index))return;
 const c=CARD[f.hand[index]];const before={...f.current};
 f.hand.splice(index,1);f.ep-=c.cost;if(l.phase==='front')f.frontSpent+=c.cost;
 add(f.current,f.next);f.next=zero();
 let combo=false;const triggers:string[]=[];
 for(const effect of c.effects){const active=conditionMet(effect.when,f,c,l);if(active){EFFECT_REGISTRY[effect.op]({f,c,l,effect});if(effect.when){triggers.push('条件成立');if(c.kind==='combo')combo=true;}}else if(effect.when)triggers.push('条件不成立');}
 // Scaling combo cards have an implicit, documented history requirement for passive activation.
 if(c.kind==='combo'&&c.effects.some(e=>e.op==='perPlayed'||e.op==='perKind'||e.op==='perCombo'||e.op==='perMember'||e.op==='perRegion')){
 combo ||= c.effects.some(e=> e.op==='perPlayed'?f.history.some(h=>h.song===l.song):e.op==='perKind'?f.history.some(h=>h.song===l.song&&h.kind==='action'):e.op==='perCombo'?f.history.some(h=>h.combo):(e.op==='perMember'||e.op==='perRegion')&&f.history.length>0);
 }
 if(f.type==='solo'&&c.member===f.member){add(f.current,{heat:12,memory:4});triggers.push('単推し');}
 if(f.type==='combo'&&combo){add(f.current,{heat:10,unity:10});triggers.push('コンボ型');}
 if(f.type==='group'&&!f.history.some(h=>h.song===l.song&&h.member===c.member)){add(f.current,{unity:10,memory:6});triggers.push('箱推し');}
 if(c.song===SONGS[l.song].type){f.current.unity+=4;triggers.push('曲属性 +4');}
 if(f.regions.includes(c.region)){f.current.memory+=5;triggers.push('探索地域 +5');}
 add(f.current,f.training);
 f.history.push({id:c.id,member:c.member,kind:c.kind,region:c.region,song:l.song,phase:l.phase,combo});
 f.used[c.id]=(f.used[c.id]??0)+1;f.discard.push(c.id);
 const delta=METRICS.map(k=>`${METRIC_LABELS[k]}+${f.current[k]-before[k]}`).join(' / ');
 l.log.push(`${side==='player'?'あなた':'CPU'}｜${c.name} → ${delta}${triggers.length?`［${triggers.join('・')}］`:''}`);
 l.log=l.log.slice(-160);
}
export function points(values:Values,target:Values):number{
 return Math.round(100*(.5*Math.min(values.heat/target.heat,1.5)+.3*Math.min(values.unity/target.unity,1.5)+.2*Math.min(values.memory/target.memory,1.5))*10)/10;
}
function cpuTurn(l:Live){
 // Greedy one-card lookahead using precisely the same legality/effect functions as the player.
 for(let turn=0;turn<7;turn++){
  const legal=l.cpu.hand.map((_,i)=>i).filter(i=>!playError(l,l.cpu,i));if(!legal.length)break;
  let best=legal[0],bestValue=-Infinity;
  for(const i of legal){const clone=structuredClone(l);playCard(clone,'cpu',i);const c=CARD[l.cpu.hand[i]];const value=(points(clone.cpu.current,SONGS[l.song].target)-points(l.cpu.current,SONGS[l.song].target))/c.cost+(c.kind==='support'?1:0);if(value>bestValue){bestValue=value;best=i;}}
  playCard(l,'cpu',best);
 }
}
export function advancePhase(l:Live):void{
 if(l.status!=='playing')return;
 cpuTurn(l);
 if(l.phase==='front'){
  l.phase='back';drawCards(l.player,2,l);drawCards(l.cpu,2,l);l.log.push('後半へ：残りEPを使用。両者2枚補充（手札上限7）');return;
 }
 const song=SONGS[l.song];const p=points(l.player.current,song.target),c=points(l.cpu.current,song.target);
 const mvp=p>c?'player':c>p?'cpu':'tie';
 l.results.push({name:song.name,player:{...l.player.current},cpu:{...l.cpu.current},playerPoints:p+(mvp==='player'?2:0),cpuPoints:c+(mvp==='cpu'?2:0),mvp});
 add(l.player.total,l.player.current);add(l.cpu.total,l.cpu.current);
 l.log.push(`第${l.song+1}曲終了｜あなた ${p} / CPU ${c}点。${mvp==='tie'?'MVPなし':`${mvp==='player'?'あなた':'CPU'} MVP +2点`}`);
 if(l.song===3){l.status='result';l.log.push('終演。報酬を受け取り、旅を続けよう。');return;}
 l.song++;l.phase='front';
 for(const f of [l.player,l.cpu]){f.current={heat:0,unity:0,memory:f.collectionBonus};f.next=zero();f.ep=4;f.frontSpent=0;drawCards(f,2,l);}
 l.log.push(`第${l.song+1}曲「${SONGS[l.song].name}」開演。EP4に回復`);
}
export function liveTotal(l:Live,side:'player'|'cpu'):number{return Math.round(l.results.reduce((sum,r)=>sum+(side==='player'?r.playerPoints:r.cpuPoints),0)*10)/10;}
export function makeLive(s:GameState,mode:'venue'|'stream',venue:string,subsidized:boolean):Live{
 const cpuCollection={...START_COLLECTION};
 for(const c of CARDS.slice(12,Math.min(40,16+s.week*2)))cpuCollection[c.id]=2;
 const cpuType=(['solo','combo','group'] as const)[Math.floor(s.week/4)-1];
 const cpuMember:Member=(['C','F','H'] as const)[Math.floor(s.week/4)-1];
 const fighter=(deck:string[],type:Fighter['type'],member:Member,training:Values,collectionBonus:number,regions:string[]):Fighter=>({type,member,deck:[...deck],draw:[],hand:[],discard:[],history:[],used:{},ep:4,frontSpent:0,current:{heat:0,unity:0,memory:collectionBonus},total:zero(),next:zero(),training:{...training},collectionBonus,regions:[...regions]});
 const l:Live={week:s.week,mode,venue,subsidized,song:0,phase:'front',status:'playing',seed:s.seed,results:[],log:['開演！ 前半は最大2EP、各曲は合計4EP。曲属性一致で一体感 +4。'],rewardClaimed:false,
 player:fighter(s.deck,s.type,s.member,s.training,Math.min(20,(Object.keys(s.collection).length-12)*2),[...new Set(s.visitedSpots.map(id=>CITY[id.split('-')[0]].region))]),
 cpu:fighter(autoDeck(cpuCollection,cpuType,cpuMember),cpuType,cpuMember,{heat:Math.floor(s.week/4)-1,unity:0,memory:0},Math.floor(s.week/4)*2,[])};
 // Region rewards are derived from actual visited spots, never from geographic member claims.
 for(const f of [l.player,l.cpu]){[f.draw,l.seed]=shuffle(f.deck,l.seed);drawCards(f,5,l);}
 return l;
}

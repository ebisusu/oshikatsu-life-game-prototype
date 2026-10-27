import { CARD, CITY, FAN_TYPES, MEMBERS, TROPHIES } from './data';
import { deckErrors } from './deck';
import { VERSION } from './model';
import type { GameState } from './model';
export const SAVE_KEY='oshitabi.save.v1';
type Obj=Record<string,unknown>;
const obj=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown,max=1e9)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const list=(v:unknown,p:(x:unknown)=>boolean,max=1000):v is unknown[]=>Array.isArray(v)&&v.length<=max&&v.every(p);
const text=(v:unknown)=>typeof v==='string'&&v.length<3000;
const card=(v:unknown)=>typeof v==='string'&&Object.hasOwn(CARD,v);
const city=(v:unknown)=>typeof v==='string'&&Object.hasOwn(CITY,v);
const member=(v:unknown)=>MEMBERS.includes(v as never);
const fan=(v:unknown)=>typeof v==='string'&&Object.hasOwn(FAN_TYPES,v);
const values=(v:unknown)=>obj(v)&&['heat','unity','memory'].every(k=>num(v[k]));
const dictionary=(v:unknown,key:(x:unknown)=>boolean)=>obj(v)&&Object.entries(v).every(([k,n])=>key(k)&&num(n,10000));
const phase=(v:unknown)=>v==='front'||v==='back';
const history=(v:unknown)=>obj(v)&&card(v.id)&&member(v.member)&&['action','support','combo','finisher'].includes(v.kind as string)&&text(v.region)&&num(v.song,3)&&phase(v.phase)&&typeof v.combo==='boolean';
function fighter(v:unknown):boolean{
 if(!obj(v)||!fan(v.type)||!member(v.member)||!list(v.deck,card,20)||v.deck.length!==20||!list(v.hand,card,7)||!list(v.draw,card,20)||!list(v.discard,card,20)||!list(v.history,history,100)||!dictionary(v.used,card)||!num(v.ep,4)||!num(v.frontSpent,2)||!values(v.current)||!values(v.total)||!values(v.next)||!values(v.training)||!num(v.collectionBonus,20)||!list(v.regions,text,7))return false;
 const count=(a:unknown[])=>JSON.stringify([...a].sort());
 return count(v.deck)===count([...v.hand,...v.draw,...v.discard])&&deckErrors(v.deck as string[],Object.fromEntries((v.deck as string[]).map(id=>[id,2]))).length===0;
}
function live(v:unknown):boolean{
 if(!obj(v))return false;
 return [4,8,12].includes(v.week as number)&&['venue','stream'].includes(v.mode as string)&&typeof v.subsidized==='boolean'&&num(v.song,3)&&phase(v.phase)&&['playing','result'].includes(v.status as string)&&fighter(v.player)&&fighter(v.cpu)&&num(v.seed,4294967295)&&city(v.venue)&&typeof v.rewardClaimed==='boolean'&&list(v.log,text,160)&&list(v.results,r=>obj(r)&&text(r.name)&&values(r.player)&&values(r.cpu)&&typeof r.playerPoints==='number'&&Number.isFinite(r.playerPoints)&&r.playerPoints>=0&&r.playerPoints<=152&&typeof r.cpuPoints==='number'&&Number.isFinite(r.cpuPoints)&&r.cpuPoints>=0&&r.cpuPoints<=152&&['player','cpu','tie'].includes(r.mvp as string),4)&& (v.results as unknown[]).length===(v.status==='result'?4:v.song);
}
export function isValidSave(v:unknown):v is GameState{
 if(!obj(v)||v.version!==VERSION||!num(v.seed,4294967295)||!num(v.initialSeed,4294967295)||!num(v.week,12)||(v.week as number)<1||!['playing','finished'].includes(v.status as string)||!num(v.money)||!num(v.stamina,100)||!num(v.ap,4)||!city(v.city)||!list(v.visited,city,12)||!list(v.visitedSpots,id=>typeof id==='string'&&Object.values(CITY).some(c=>c.spots.some(p=>p.id===id)),24)||!fan(v.type)||!member(v.member)||!dictionary(v.collection,card)||!list(v.deck,card,20)||!values(v.training)||!list(v.assets,city,12)||!list(v.resolvedWeeks,w=>[4,8,12].includes(w as number),3)||!list(v.trophies,id=>TROPHIES.some(t=>t.id===id),10)||!list(v.journal,text,60)||!obj(v.stats)||!['explores','works','trains','wins','lives','combos','obtained','spent'].every(k=>num((v.stats as Obj)[k])))return false;
 if(deckErrors(v.deck as string[],v.collection as Record<string,number>).length)return false;
 if(v.pending!==null&&(!obj(v.pending)||!list(v.pending.cards,card,3)||v.pending.cards.length!==3||typeof v.pending.spot!=='string'||!CITY[v.city as string].spots.some(p=>p.id===(v.pending as Obj).spot)))return false;
 if(v.live!==null){
  if(!live(v.live))return false;
  const l=v.live as Obj;
  if((l.week as number)>(v.week as number))return false;
  if(l.rewardClaimed){if(l.status!=='result'||!(v.resolvedWeeks as number[]).includes(l.week as number))return false;}
  else if(l.week!==v.week||(v.resolvedWeeks as number[]).includes(l.week as number)||v.pending!==null)return false;
 }
 if(v.status==='finished'&&(v.week!==12||v.ap!==0||!(v.resolvedWeeks as number[]).includes(12)))return false;
 return true;
}
export function serialize(s:GameState):string{return JSON.stringify({version:VERSION,state:s});}
export function restore(raw:string|null):{state:GameState|null;notice:string}{
 if(!raw)return {state:null,notice:''};
 try{const data:unknown=JSON.parse(raw);if(obj(data)&&data.version===VERSION&&isValidSave(data.state))return {state:data.state,notice:'前回の旅を復元しました'};}catch{/* Corrupt JSON must never crash initialization. */}
 return {state:null,notice:'保存データの形式が異なるか破損しています。新しい旅を開始できます。'};
}

import { CARD, CARDS, START_DECK } from './data';
import type { FanType, Member, Rarity } from './model';
export const RARITY_LIMIT:Partial<Record<Rarity,number>>={SR:6,SSR:2,UR:1};
export function deckErrors(deck:string[], collection:Record<string,number>):string[]{
 const errors:string[]=[];
 if(deck.length!==20)errors.push(`20枚固定です（現在${deck.length}枚）`);
 const counts:Record<string,number>={};const rare:Record<string,number>={};
 for(const id of deck){if(!CARD[id]){errors.push('不明なカード');continue;}counts[id]=(counts[id]??0)+1;rare[CARD[id].rarity]=(rare[CARD[id].rarity]??0)+1;}
 for(const [id,n] of Object.entries(counts)){if(n>2)errors.push(`${CARD[id].name}は同名2枚まで`);if(n>(collection[id]??0))errors.push(`${CARD[id].name}の所持数不足`);}
 for(const [r,limit]of Object.entries(RARITY_LIMIT)){if((rare[r]??0)>limit!)errors.push(`${r}は${limit}枚まで`);}
 return errors;
}
export function autoDeck(collection:Record<string,number>,type:FanType,member:Member):string[]{
 const power:Record<Rarity,number>={N:0,R:2,SR:5,SSR:8,UR:10};
 const sorted=[...CARDS].sort((a,b)=>{
 const value=(c:typeof a)=>power[c.rarity]+(type==='solo'&&c.member===member?8:0)+(type==='combo'&&c.kind==='combo'?5:0)+(c.cost===1?2:0);
 return value(b)-value(a)||a.id.localeCompare(b.id);
 });
 const deck:string[]=[];const rare:Record<string,number>={};const members:Record<string,number>={};
 for(let round=0;round<2;round++)for(const c of sorted){
 if(deck.length===20)break;
 if((collection[c.id]??0)<=round)continue;
 const limit=RARITY_LIMIT[c.rarity];if(limit&&(rare[c.rarity]??0)>=limit)continue;
 // First round diversifies all fan types, particularly the group passive.
 if(type==='group'&&round===0&&(members[c.member]??0)>=2)continue;
 deck.push(c.id);rare[c.rarity]=(rare[c.rarity]??0)+1;members[c.member]=(members[c.member]??0)+1;
 }
 if(deck.length<20){for(const id of START_DECK){if(deck.length===20)break;const n=deck.filter(x=>x===id).length;if(n<2&&n<(collection[id]??0))deck.push(id);}}
 return deck;
}

import { describe, expect, it } from 'vitest';
import { CARD, CARDS, CITY, START_COLLECTION, START_DECK } from './data';
import { autoDeck, deckErrors } from './deck';
import { advancePhase, conditionMet, drawCards, liveTotal, makeLive, playCard, playError, points } from './live';
import type { Action, GameState, Live } from './model';
import { act, actionError, createGame, liveDue } from './rules';
import { restore, serialize } from './save';
import { shuffle } from './rng';
const step=(s:GameState,a:Action)=>{const t=act(s,a);expect(t.error,JSON.stringify(a)).toBeUndefined();return t.state;};
function liveFixture(seed=42){const s=createGame('solo','A','tokyo',seed);s.week=4;return makeLive(s,'stream','tokyo',false);}
function bestPlay(l:Live){
 const legal=l.player.hand.map((_,i)=>i).filter(i=>!playError(l,l.player,i));
 if(!legal.length)return -1;
 return legal.sort((a,b)=>{
 const value=(i:number)=>{const copy=structuredClone(l);playCard(copy,'player',i);return (points(copy.player.current,{heat:100,unity:90,memory:80})-points(l.player.current,{heat:100,unity:90,memory:80}))/CARD[l.player.hand[i]].cost;};
 return value(b)-value(a);
 })[0];
}
function complete(l:Live){for(let guard=0;l.status==='playing'&&guard<60;guard++){const i=bestPlay(l);if(i>=0)playCard(l,'player',i);else advancePhase(l);}expect(l.status).toBe('result');return l;}

describe('world rules and invariants',()=>{
 it('initializes every city fairly with a legal 20-card deck',()=>{for(const city of Object.keys(CITY)){const s=createGame('solo','A',city);expect([s.money,s.stamina,s.ap,s.week]).toEqual([60000,80,4,1]);expect(deckErrors(s.deck,s.collection)).toEqual([]);}});
 it.each([
  [{type:'work'},'ap',1], [{type:'work'},'stamina',11], [{type:'rest'},'ap',1],
  [{type:'train',metric:'heat'},'money',999], [{type:'train',metric:'heat'},'stamina',7], [{type:'train',metric:'heat'},'ap',0],
  [{type:'move',city:'nagoya'},'money',0], [{type:'move',city:'nagoya'},'ap',1], [{type:'move',city:'nagoya'},'stamina',11],
  [{type:'explore',spot:'tokyo-gallery'},'ap',0], [{type:'explore',spot:'tokyo-gallery'},'stamina',7],
  [{type:'buy'},'money',27999], [{type:'buy'},'ap',0],
 ] as [Action,'ap'|'stamina'|'money',number][])('rejects %j when %s=%s without any mutation',(a,k,n)=>{const s=createGame();s[k]=n;const before=serialize(s);const r=act(s,a);expect(r.error).toBeTruthy();expect(r.state).toBe(s);expect(serialize(s)).toBe(before);});
 it('applies work, rest, training, weekly income and stamina caps',()=>{let s=step(createGame(),{type:'work'});expect([s.money,s.stamina,s.ap]).toEqual([82000,68,2]);s=step(s,{type:'rest'});expect(s.stamina).toBe(100);s=step(s,{type:'week'});expect([s.week,s.ap,s.money,s.stamina]).toEqual([2,4,84000,100]);s=step(s,{type:'train',metric:'memory'});expect(s.training.memory).toBe(2);expect([s.money,s.stamina,s.ap]).toEqual([83000,92,3]);});
 it('requires explicit local spots; exploration yields three distinct cards and blocks other actions',()=>{let s=createGame();expect(act(s,{type:'explore',spot:'osaka-gallery'}).error).toBeTruthy();s=step(s,{type:'explore',spot:'tokyo-gallery'});expect(new Set(s.pending!.cards).size).toBe(3);expect(act(s,{type:'week'}).state).toBe(s);expect(act(s,{type:'choose',card:'c40'}).state).toBe(s);const id=s.pending!.cards[0],old=s.collection[id]??0;s=step(s,{type:'choose',card:id});expect(s.collection[id]).toBe(old+1);expect(s.deck).toEqual(START_DECK);expect(s.trophies).toContain('first');});
 it('applies collection and actual visited-region bonuses to live state',()=>{let s=createGame();s=step(s,{type:'explore',spot:'tokyo-studio'});s=step(s,{type:'choose',card:s.pending!.cards[0]});s.week=4;const l=makeLive(s,'stream','tokyo',false);expect(l.player.regions).toContain('関東');expect(l.player.collectionBonus).toBe((Object.keys(s.collection).length-12)*2);});
 it('purchases one fictional asset per city with recurring weekly income',()=>{let s=step(createGame(),{type:'buy'});expect(s.money).toBe(32000);expect(s.assets).toEqual(['tokyo']);expect(act(s,{type:'buy'}).state).toBe(s);s=step(s,{type:'week'});expect(s.money).toBe(35000);expect(s.trophies).toContain('owner');});
 it('allows a broke exhausted fan to finish all 12 weeks through rescue streams',()=>{let s=createGame();s.money=0;s.stamina=0;s.ap=0;for(let w=1;w<=12;w++){expect(s.week).toBe(w);if(liveDue(s)){s.money=0;s.stamina=0;s=step(s,{type:'startLive',mode:'stream'});expect(s.live!.subsidized).toBe(true);for(let p=0;p<8;p++)s=step(s,{type:'phase'});s=step(s,{type:'claim'});expect(s.stats.lives).toBe(Math.floor(w/4));}s=step(s,{type:'week'});}expect(s.status).toBe('finished');expect(s.week).toBe(12);expect(s.ap).toBe(0);expect(s.trophies).toContain('finish');expect(act(s,{type:'week'}).state).toBe(s);});
 it('requires a concert resolution before advancing and permits explicit skip',()=>{let s=createGame();s.week=4;expect(act(s,{type:'week'}).state).toBe(s);s=step(s,{type:'skip'});s=step(s,{type:'week'});expect(s.week).toBe(5);});
 it('awards rewards only once, tracks trophies, and exposes the next concert after an old result',()=>{let s=createGame();s.week=4;s=step(s,{type:'startLive',mode:'stream'});s.live=complete(s.live!);s=step(s,{type:'claim'});const money=s.money;expect(s.stats.lives).toBe(1);expect(s.stats.obtained).toBe(1);expect(s.trophies).toContain('debut');expect(act(s,{type:'claim'}).state).toBe(s);expect(s.money).toBe(money);for(let i=0;i<4;i++)s=step(s,{type:'week'});expect(s.week).toBe(8);expect(actionError(s,{type:'startLive',mode:'stream'})).toBeUndefined();s=step(s,{type:'startLive',mode:'stream'});expect(s.live!.week).toBe(8);});
});

describe('deck construction',()=>{
 const all=Object.fromEntries(CARDS.map(c=>[c.id,2]));
 it('enforces exact size, owned copies, same-name and each rarity cap',()=>{
  expect(deckErrors(START_DECK.slice(1),START_COLLECTION).join()).toContain('20枚');
  expect(deckErrors(['c01','c01','c01',...START_DECK.slice(3)],all).join()).toContain('同名2');
  expect(deckErrors([...START_DECK.slice(0,19),'c40'],START_COLLECTION).join()).toContain('所持数');
  for(const [rarity,n,label]of [['SR',7,'SR'],['SSR',3,'SSR'],['UR',2,'UR']]as const){const rare=CARDS.filter(c=>c.rarity===rarity).slice(0,n).map(c=>c.id);while(rare.length<n)rare.push(rare[0]);const deck=[...rare,...START_DECK.slice(0,20-n)];expect(deckErrors(deck,all).join()).toContain(`${label}は`);}
 });
 it('automatically builds legal decks for all types and preferred members',()=>{for(const collection of [START_COLLECTION,all])for(const type of ['solo','combo','group']as const)for(const member of ['A','H']as const){expect(deckErrors(autoDeck(collection,type,member),collection)).toEqual([]);}});
 it('refuses illegal saved decks without changing the existing one',()=>{const s=createGame();expect(act(s,{type:'deck',deck:[]}).state).toBe(s);});
 it('defines exactly 40 distinct implemented effects and all schemas/attributes',()=>{expect(CARDS).toHaveLength(40);expect(new Set(CARDS.map(c=>JSON.stringify(c.effects))).size).toBe(40);expect(new Set(CARDS.map(c=>c.member)).size).toBe(8);expect(new Set(CARDS.map(c=>c.rarity)).size).toBe(5);});
});

describe('live EP, shuffle, CPU, combos and scoring',()=>{
 it('uses a seeded reproducible shuffle with the actual 20-card deck and five starting cards',()=>{const l=liveFixture();expect(l).toEqual(liveFixture());expect(l.player.hand).toHaveLength(5);expect(l.player.draw).toHaveLength(15);expect([...l.player.hand,...l.player.draw].sort()).toEqual([...START_DECK].sort());expect(shuffle(START_DECK,1)[0]).not.toEqual(shuffle(START_DECK,2)[0]);});
 it('enforces 2EP in front and 4EP overall, with unused front EP carried to back',()=>{const l=liveFixture();l.player.hand=['c01','c01','c01','c01','c01'];playCard(l,'player',0);playCard(l,'player',0);expect(l.player.ep).toBe(2);expect(playError(l,l.player,0)).toContain('前半');advancePhase(l);playCard(l,'player',0);playCard(l,'player',0);expect(l.player.ep).toBe(0);expect(playError(l,l.player,0)).toContain('EP');advancePhase(l);expect(l.player.ep).toBe(4);const unused=liveFixture();advancePhase(unused);expect(unused.player.ep).toBe(4);});
 it('caps hand size and recycles discards without losing copies',()=>{const l=liveFixture();const f=l.player;f.draw=[];f.hand=f.deck.slice(0,4);f.discard=f.deck.slice(4);drawCards(f,5,l);expect(f.hand).toHaveLength(7);expect(f.draw.length+f.discard.length+f.hand.length).toBe(20);expect(l.log.some(x=>x.includes('シャッフル'))).toBe(true);});
 it('limits SR to twice and SSR/UR once per identical card in the performance',()=>{for(const [id,limit]of [['c21',2],['c33',1],['c38',1]]as const){const l=liveFixture();l.player.hand=[id];l.player.used[id]=limit;expect(playError(l,l.player,0)).toContain('上限');l.player.used[id]=limit-1;expect(playError(l,l.player,0)).toBeUndefined();}});
 it('checks combo history before the current card, not against remaining hand',()=>{const l=liveFixture();const f=l.player;expect(conditionMet({previousMember:true},f,CARD.c08,l)).toBe(false);f.hand=['c16','c08'];playCard(l,'player',0);expect(conditionMet({previousMember:true},f,CARD.c08,l)).toBe(true);playCard(l,'player',0);expect(f.history.at(-1)!.combo).toBe(true);expect(f.hand).not.toContain('c16');const no=liveFixture();no.player.hand=['c01','c08'];playCard(no,'player',0);playCard(no,'player',0);expect(no.player.history.at(-1)!.combo).toBe(false);});
 it('requires all phase/song/count conditions, and previous song history',()=>{const l=liveFixture();const f=l.player;expect(conditionMet({phase:'back',minPlayed:2},f,CARD.c38,l)).toBe(false);l.phase='back';expect(conditionMet({phase:'back',minPlayed:2},f,CARD.c38,l)).toBe(false);f.history=[{id:'c01',member:'A',kind:'action',region:'北海道',song:0,phase:'front',combo:false},{id:'c02',member:'B',kind:'action',region:'東北',song:0,phase:'back',combo:false}];expect(conditionMet({phase:'back',minPlayed:2},f,CARD.c38,l)).toBe(true);l.phase='front';expect(conditionMet({phase:'back',minPlayed:2},f,CARD.c38,l)).toBe(false);expect(conditionMet({song:'ballad'},f,CARD.c12,l)).toBe(false);l.song=1;expect(conditionMet({previousSong:true},f,CARD.c30,l)).toBe(true);f.history=[];expect(conditionMet({previousSong:true},f,CARD.c30,l)).toBe(false);});
 it('gives each fan type a different functioning passive',()=>{const play=(type:'solo'|'combo'|'group')=>{const l=liveFixture();l.player.type=type;l.player.hand=['c01'];playCard(l,'player',0);return l.player.current;};expect(play('solo').heat).toBeGreaterThan(play('group').heat);expect(play('group').unity).toBeGreaterThan(play('solo').unity);const combo=liveFixture();combo.player.type='combo';combo.player.hand=['c16','c08'];playCard(combo,'player',0);const before=combo.player.current.unity;playCard(combo,'player',0);expect(combo.player.current.unity-before).toBeGreaterThanOrEqual(40);});
 it('CPU actually spends EP, uses hand cards and records the same effect history',()=>{const l=liveFixture();const before=l.cpu.hand.length;advancePhase(l);expect(l.cpu.history.length).toBeGreaterThan(0);expect(l.cpu.ep).toBeGreaterThanOrEqual(2);expect(l.cpu.frontSpent).toBeLessThanOrEqual(2);expect(l.cpu.hand.length).toBeLessThanOrEqual(before+2);expect(l.log.some(x=>x.startsWith('CPU｜'))).toBe(true);});
 it('calculates weights, caps and deterministic results, with MVP +2',()=>{expect(points({heat:100,unity:100,memory:100},{heat:100,unity:100,memory:100})).toBe(100);expect(points({heat:100,unity:0,memory:0},{heat:100,unity:100,memory:100})).toBe(50);expect(points({heat:1000,unity:1000,memory:1000},{heat:100,unity:100,memory:100})).toBe(150);const a=complete(liveFixture(99)),b=complete(liveFixture(99));expect(a).toEqual(b);expect(a.results).toHaveLength(4);for(const r of a.results){if(r.mvp==='player')expect(r.playerPoints).toBeGreaterThan(r.cpuPoints);}});
 it('supports both winning and losing with real card calculations',()=>{const weak=liveFixture(42);for(let i=0;i<8;i++)advancePhase(weak);expect(liveTotal(weak,'player')).toBeLessThan(liveTotal(weak,'cpu'));const strong=liveFixture(42);strong.player.training={heat:12,unity:10,memory:8};complete(strong);expect(liveTotal(strong,'player')).toBeGreaterThan(liveTotal(strong,'cpu'));});
 it.each(CARDS)('resolves $id $name in every song/phase without invalid scores or hand overflow',card=>{
  for(let song=0;song<4;song++)for(const phase of ['front','back']as const){
   const l=liveFixture();l.song=song;l.phase=phase;l.player.hand=[card.id];
   l.player.history=[{id:'c16',member:'H',kind:'support',region:'関東',song:Math.max(0,song-1),phase:'front',combo:true},{id:'c01',member:'A',kind:'action',region:'北海道',song,phase:'front',combo:false},{id:'c02',member:'B',kind:'action',region:'東北',song,phase:'front',combo:false}];
   playCard(l,'player',0);expect(l.player.history.at(-1)!.id).toBe(card.id);expect(l.player.hand.length).toBeLessThanOrEqual(7);
   for(const n of Object.values(l.player.current))expect(Number.isFinite(n)&&n>=0).toBe(true);
  }
 });
});

describe('versioned saves and recovery',()=>{
 it('round trips setup, pending reward, every battle phase, result and claim',()=>{let s=createGame();expect(restore(serialize(s)).state).toEqual(s);s=step(s,{type:'explore',spot:'tokyo-gallery'});expect(restore(serialize(s)).state).toEqual(s);s=step(s,{type:'choose',card:s.pending!.cards[0]});s.week=4;s=step(s,{type:'startLive',mode:'stream'});expect(restore(serialize(s)).state).toEqual(s);for(let i=0;i<8;i++){s=step(s,{type:'phase'});expect(restore(serialize(s)).state).toEqual(s);}s=step(s,{type:'claim'});expect(restore(serialize(s)).state).toEqual(s);});
 it.each([null,'','{','null','{}','{"version":999,"state":{}}','{"version":1,"state":{"version":1}}'])('recovers safely from %s',raw=>{expect(()=>restore(raw)).not.toThrow();expect(restore(raw).state).toBeNull();});
 it('rejects invalid resources, unknown card ids, broken live card conservation and malformed arrays',()=>{const bads:unknown[]=[];let s=createGame();bads.push({...s,stamina:101},{...s,money:-1},{...s,deck:['oops']},{...s,visitedSpots:['fake']},{...s,training:null});s.week=4;s=step(s,{type:'startLive',mode:'stream'});const broken=structuredClone(s);broken.live!.player.hand=[];bads.push(broken);for(const state of bads)expect(restore(JSON.stringify({version:1,state})).state).toBeNull();});
 it('rejects conflicting pending/live/weekly state instead of restoring an unfinishable game',()=>{let s=createGame();s.week=4;s=step(s,{type:'startLive',mode:'stream'});const a=structuredClone(s);a.pending={spot:'tokyo-gallery',cards:['c01','c02','c03']};const b=structuredClone(s);b.week=8;const c=structuredClone(s);c.live!.rewardClaimed=true;for(const state of [a,b,c])expect(restore(serialize(state)).state).toBeNull();});
});

export const VERSION = 1;
export type Member = 'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H';
export type FanType = 'solo'|'combo'|'group';
export type Rarity = 'N'|'R'|'SR'|'SSR'|'UR';
export type Kind = 'action'|'support'|'combo'|'finisher';
export type SongType = 'call'|'unit'|'ballad'|'all';
export type Metric = 'heat'|'unity'|'memory';
export type Values = Record<Metric, number>;
export type Phase = 'front'|'back';
export type EffectOp = 'gain'|'draw'|'next'|'perPlayed'|'perMember'|'perKind'|'perRegion'|'perDiscard'|'perHand'|'perDraw'|'perSong'|'perCombo'|'balance'|'echo'|'focus'|'encore';
export type Condition = { phase?: Phase; song?: SongType; previousMember?: boolean; previousKind?: Kind; minPlayed?: number; minMembers?: number; minRegions?: number; previousSong?: boolean; emptyDraw?: boolean };
export interface Effect { op: EffectOp; values?: Partial<Values>; amount?: number; when?: Condition }
export interface Card { id:string; name:string; rarity:Rarity; cost:number; kind:Kind; member:Member; song:SongType; region:string; description:string; effects:Effect[] }
export interface Spot { id:string; name:string; type:string; money:number; stamina:number; region:string; pool: Rarity[] }
export interface City { id:string; name:string; region:string; x:number; y:number; spots:Spot[] }
export interface Route { from:string; to:string; ap:number; cost:number }
export interface Played { id:string; member:Member; kind:Kind; region:string; song:number; phase:Phase; combo:boolean }
export interface Fighter {
  type:FanType; member:Member; deck:string[]; draw:string[]; hand:string[]; discard:string[];
  history:Played[]; used:Record<string,number>; ep:number; frontSpent:number;
  current:Values; total:Values; next:Values; training:Values; collectionBonus:number; regions:string[];
}
export interface SongResult { name:string; player:Values; cpu:Values; playerPoints:number; cpuPoints:number; mvp:'player'|'cpu'|'tie' }
export interface Live {
  week:number; mode:'venue'|'stream'; subsidized:boolean; song:number; phase:Phase; status:'playing'|'result';
  player:Fighter; cpu:Fighter; results:SongResult[]; log:string[]; seed:number; venue:string; rewardClaimed:boolean;
}
export interface Pending { spot:string; cards:string[] }
export interface Stats { explores:number; works:number; trains:number; wins:number; lives:number; combos:number; obtained:number; spent:number }
export interface GameState {
  version:number; seed:number; initialSeed:number; week:number; status:'playing'|'finished';
  money:number; stamina:number; ap:number; city:string; visited:string[]; visitedSpots:string[];
  type:FanType; member:Member; collection:Record<string,number>; deck:string[]; training:Values;
  assets:string[]; pending:Pending|null; live:Live|null; resolvedWeeks:number[];
  stats:Stats; trophies:string[]; journal:string[];
}
export type Action = { type:'work' }|{type:'rest'}|{type:'train'; metric:Metric}|{type:'move'; city:string}|{type:'explore'; spot:string}|{type:'choose'; card:string}|{type:'buy'}|{type:'week'}|{type:'skip'}|{type:'startLive'; mode:'venue'|'stream'}|{type:'play'; index:number}|{type:'phase'}|{type:'claim'}|{type:'deck'; deck:string[]};
export interface Transition { state:GameState; error?:string; message?:string }
export const zero = ():Values => ({heat:0,unity:0,memory:0});

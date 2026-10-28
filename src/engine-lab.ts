import Phaser from 'phaser';
import { CITIES, CITY_MAP, ROUTES, routeBetween, shortestPath, newGame, applyAction, validateState, type CityId, type GameState } from './game';

const WIDTH=390, HEIGHT=740;
const STORAGE='oshikatsu-phaser-technical-spike-v1';
const place=(city:CityId)=>({x:23+CITY_MAP[city].x*0.96,y:136+CITY_MAP[city].y*0.78});
const COLOR={ink:0x0a102d,sky:0x0f224c,sea:0x102852,land:0x293d69,landTop:0x46769f,track:0x64caff,coral:0xff79b5,gold:0xffdb87,white:'#eef5ff',muted:'#9caccc'};
let snapshot:GameState;
try{
 const raw=localStorage.getItem(STORAGE);
 const read=raw?JSON.parse(raw) as GameState:null;
 snapshot=validateState(read)===null ? read as GameState : newGame({oshi:'solo',member:'A',city:'fukuoka',seed:20261028});
}catch{snapshot=newGame({oshi:'solo',member:'A',city:'fukuoka',seed:20261028});}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify(snapshot));}catch{/* this is only an isolated rendering test */}}
function elStatus(t:string){const el=document.getElementById('lab-status');if(el)el.textContent=t;}

class JourneyScene extends Phaser.Scene{
 private status!:Phaser.GameObjects.Text;
 private prompt!:Phaser.GameObjects.Text;
 private money!:Phaser.GameObjects.Text;
 private ap!:Phaser.GameObjects.Text;
 private selectedLabel!:Phaser.GameObjects.Text;
 private selectedDetail!:Phaser.GameObjects.Text;
 private currentToken!:Phaser.GameObjects.Container;
 private routeGlow!:Phaser.GameObjects.Graphics;
 private focusRing!:Phaser.GameObjects.Arc;
 private selected:CityId='hiroshima';
 private moving=false;
 private moveButton!:Phaser.GameObjects.Container;
 constructor(){super('JourneyScene');}
 create(){
  // Phaser reuses Scene instances on restart. Reset can be tapped during a tween.
  this.moving=false;
  this.cameras.main.setBackgroundColor('#07102a');
  const backdrop=this.add.graphics();
  for(let i=0;i<HEIGHT;i+=5){const v=i/HEIGHT;backdrop.fillStyle(Phaser.Display.Color.GetColor(8+Math.round(v*9),15+Math.round(v*27),38+Math.round(v*34)));backdrop.fillRect(0,i,WIDTH,5);}
  this.add.rectangle(0,0,WIDTH,126,0x101839,0.87).setOrigin(0);
  this.add.rectangle(0,HEIGHT-110,WIDTH,110,0x0c1433,0.95).setOrigin(0);
  this.add.text(22,17,'OSHI JOURNEY',{fontFamily:'system-ui',fontSize:'13px',color:'#72ceff',fontStyle:'bold',letterSpacing:4});
  this.add.text(22,40,'全国ツアーを、旅しよう。',{fontFamily:'system-ui',fontSize:'25px',color:'#f7e8ff',fontStyle:'bold'});
  this.status=this.add.text(22,85,'',{fontFamily:'system-ui',fontSize:'14px',color:COLOR.muted});
  this.money=this.add.text(368,86,'',{fontFamily:'system-ui',fontSize:'14px',color:'#ffe8a9',fontStyle:'bold'}).setOrigin(1,0);
  this.ap=this.add.text(23,110,'',{fontFamily:'system-ui',fontSize:'12px',color:'#9bdefc'});
  this.add.text(22,HEIGHT-102,'DESTINATION TICKET',{fontFamily:'system-ui',fontSize:'10px',color:'#78cfff',letterSpacing:2});
  this.selectedLabel=this.add.text(22,HEIGHT-84,'',{fontFamily:'system-ui',fontSize:'18px',color:'#f4f6ff',fontStyle:'bold'});
  this.selectedDetail=this.add.text(22,HEIGHT-57,'',{fontFamily:'system-ui',fontSize:'12px',color:'#b0c6e5'});
  this.prompt=this.add.text(20,HEIGHT-130,'',{fontFamily:'system-ui',fontSize:'12px',color:'#ffd48c'}).setDepth(25);
  const stars=this.add.graphics();
  for(let i=0;i<95;i++){const x=((i*137+51)%383)+4;const y=130+((i*193+29)%468);stars.fillStyle(i%3===0?0xc3e8ff:0x638fce,i%5===0?0.6:0.17);stars.fillCircle(x,y,i%4===0?1.5:0.8);}
  const sea=this.add.graphics();sea.lineStyle(1,0x7db9ed,0.11);
  for(let i=0;i<11;i++){const y=160+i*39;sea.beginPath();sea.moveTo(0,y);sea.lineTo(WIDTH,y);sea.strokePath();}
  // Synthetic geography for the early game: not an official geographic map.
  const islands=this.add.graphics();
  islands.lineStyle(4,0x74b4e2,0.27);
  islands.fillStyle(COLOR.land,0.94);
  const polygons=[
   [{x:255,y:143},{x:281,y:123},{x:329,y:130},{x:358,y:155},{x:347,y:188},{x:321,y:207},{x:285,y:191}],
   [{x:296,y:217},{x:326,y:258},{x:320,y:330},{x:289,y:364},{x:258,y:379},{x:218,y:394},{x:190,y:386},{x:177,y:424},{x:132,y:430},{x:102,y:453},{x:70,y:456},{x:53,y:477},{x:27,y:484},{x:17,y:460},{x:65,y:425},{x:125,y:399},{x:160,y:366},{x:199,y:325},{x:234,y:272},{x:257,y:237}],
   [{x:25,y:483},{x:54,y:483},{x:82,y:512},{x:103,y:555},{x:87,y:586},{x:51,y:581},{x:31,y:552},{x:18,y:509}],
   [{x:122,y:468},{x:159,y:469},{x:174,y:484},{x:133,y:495}],
  ];
  for(const p of polygons){const points=p.map(v=>new Phaser.Math.Vector2(v.x,v.y));islands.fillPoints(points,true,true);islands.strokePoints(points,true,true);}
  for(let i=0;i<27;i++){const c=(i*19)%100;const x=(i*61+80)%350,y=155+(i*39)%420;islands.fillStyle(0x669fb8,0.08+c/2000);islands.fillCircle(x,y,5+(i%7)*3);}
  const routes=this.add.graphics();
  for(const r of ROUTES){const a=place(r.a),b=place(r.b);routes.lineStyle(1.2,0x65b5ff,0.31);routes.lineBetween(a.x,a.y,b.x,b.y);}
  this.routeGlow=this.add.graphics().setDepth(6);
  for(const c of CITIES){
   const q=place(c.id);
   this.add.circle(q.x,q.y,12,COLOR.sky,0.8).setStrokeStyle(1.5,0x71cfff,0.65).setDepth(7);
   const button=this.add.circle(q.x,q.y,16,0xffffff,0.001).setInteractive({useHandCursor:true}).setDepth(15);
   const isMajor=['tokyo','osaka','fukuoka','sapporo'].includes(c.id);
   this.add.circle(q.x,q.y,isMajor?5.8:4, isMajor?COLOR.gold:COLOR.track).setDepth(8);
   const delta:Record<string,[number,number]>={
    tokyo:[11,-12],yokohama:[12,7],nagoya:[-48,-11],kyoto:[-45,-22],osaka:[10,10],kobe:[-40,6],kumamoto:[12,4],fukuoka:[9,-18],hiroshima:[-18,-18],sapporo:[12,-4],miyazaki:[11,3],sendai:[11,-11]
   };
   const [dx,dy]=delta[c.id]||[10,-7];
   this.add.text(q.x+dx,q.y+dy,c.name,{fontFamily:'system-ui',fontSize:isMajor?'12px':'10px',color:isMajor?'#ffecbd':'#d4eaff',fontStyle:isMajor?'bold':'normal'}).setDepth(9);
   button.on('pointerdown',()=>this.select(c.id));
  }
  const start=place(snapshot.city);
  this.focusRing=this.add.circle(start.x,start.y,20,0xffffff,0.001).setStrokeStyle(2,COLOR.gold).setDepth(17);
  this.currentToken=this.add.container(start.x,start.y).setDepth(20);
  this.currentToken.add([
   this.add.circle(0,0,17,COLOR.coral,0.12).setStrokeStyle(1,COLOR.coral,0.35),
   this.add.circle(0,0,12,0xfbe1ef,1).setStrokeStyle(3,COLOR.coral),
   this.add.circle(-3,-2,1.3,0x263154),this.add.circle(3,-2,1.3,0x263154),
   this.add.rectangle(0,5,7,2,0xe8619a)
  ]);
  // The sparkles animate without changing hit testing or the game state.
  const shimmer=this.add.circle(start.x,start.y,22,COLOR.coral,0.08).setDepth(16);
  this.tweens.add({targets:shimmer,alpha:0.1,scale:1.3,duration:1100,ease:'Sine.InOut',yoyo:true,repeat:-1});
  const move=this.makeButton(282,HEIGHT-57,94,42,'移動する',()=>this.travel());
  this.moveButton=move;
  this.makeButton(53,HEIGHT-171,92,33,'お仕事',()=>this.perform({type:'work'}));
  this.makeButton(167,HEIGHT-171,104,33,'次の週',()=>this.perform({type:'endWeek'}));
  this.makeButton(304,HEIGHT-171,104,33,'リセット',()=>{snapshot=newGame({oshi:'solo',member:'A',city:'fukuoka',seed:20261028});save();this.scene.restart();});
  this.select(this.selected);
 }
 private makeButton(x:number,y:number,w:number,h:number,text:string,callback:()=>void){
  const box=this.add.rectangle(0,0,w,h,0x29447c,1).setStrokeStyle(1.2,0x78bbff,0.6);
  const label=this.add.text(0,0,text,{fontFamily:'system-ui',fontSize:'13px',color:'#f5f9ff',fontStyle:'bold'}).setOrigin(.5);
  const container=this.add.container(x,y,[box,label]).setDepth(30);
  const hit=this.add.rectangle(x,y,w,h,0xffffff,0.001).setInteractive({useHandCursor:true}).setDepth(31);
  hit.on('pointerdown',callback);
  return container;
 }
 private select(city:CityId){
  if(this.moving)return;
  this.selected=city;
  const src=place(snapshot.city),dst=place(city);
  this.routeGlow.clear();
  const possible=routeBetween(snapshot.city,city);
  this.routeGlow.lineStyle(possible?4:1.7,possible?COLOR.gold:COLOR.track,possible?0.95:0.45);
  this.routeGlow.lineBetween(src.x,src.y,dst.x,dst.y);
  this.selectedLabel.setText(CITY_MAP[city].name);
  const cost=shortestPath(snapshot.city,city);
  this.selectedDetail.setText(city===snapshot.city?'現在地':cost?('最短 '+cost.ap+'AP / ¥'+cost.money.toLocaleString('ja-JP')):'経路なし');
  this.moveButton.setAlpha(possible&&snapshot.ap>=possible.ap&&snapshot.money>=possible.money?1:0.47);
  this.renderHUD();
 }
 private renderHUD(){
  this.status.setText('第'+snapshot.week+'週 / 12　｜　現在地 '+CITY_MAP[snapshot.city].name);
  this.money.setText('¥'+snapshot.money.toLocaleString('ja-JP'));
  this.ap.setText('AP '+snapshot.ap+'/4  ／  体力 '+snapshot.stamina+'/100');
  elStatus('第'+snapshot.week+'週　'+CITY_MAP[snapshot.city].name+'　AP '+snapshot.ap+'　所持金¥'+snapshot.money.toLocaleString('ja-JP'));
 }
 private perform(action:{type:'work'}|{type:'endWeek'}){
  if(this.moving)return;
  const result=applyAction(snapshot,action);
  if(!result.ok){this.message('行動できません：'+result.reason);return;}
  snapshot=result.state;save();this.select(this.selected);
  this.message(action.type==='work'?'お仕事完了！ 資金を獲得':'第'+snapshot.week+'週がスタート！');
 }
 private travel(){
  if(this.moving)return;
  const dest=this.selected;
  const result=applyAction(snapshot,{type:'move',to:dest});
  if(!result.ok){this.message('移動できません：'+result.reason);return;}
  this.moving=true;
  snapshot=result.state;save();
  const end=place(dest);
  this.message(CITY_MAP[dest].name+'へ移動中…');
  this.tweens.add({targets:this.currentToken,x:end.x,y:end.y,duration:950,ease:'Sine.InOut',
   onComplete:()=>{
    this.moving=false;
    this.focusRing.setPosition(end.x,end.y);
    this.routeGlow.clear();
    this.select(dest);
    this.message(CITY_MAP[dest].name+'に到着！ 旅の思い出が増えた！');
    this.cameras.main.flash(280,255,216,153,true);
   }
  });
 }
 private message(s:string){this.prompt.setText(s);this.time.delayedCall(2300,()=>{if(this.prompt.text===s)this.prompt.setText('');});}
}
const game=new Phaser.Game({type:Phaser.AUTO,parent:'phaser',width:WIDTH,height:HEIGHT,backgroundColor:'#09102b',
 scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},render:{pixelArt:false,antialias:true},
 scene:[JourneyScene]});
window.addEventListener('pagehide',()=>game.destroy(true),{once:true});

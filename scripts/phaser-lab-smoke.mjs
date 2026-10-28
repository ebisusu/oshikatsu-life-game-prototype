import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 const response=await page.goto('http://127.0.0.1:5208/engine-lab.html',{waitUntil:'networkidle',timeout:30000});
 assert.equal(response.status(),200);
 await page.waitForTimeout(450);
 const box=await page.locator('#phaser canvas').boundingBox();
 assert.ok(box && box.width>300 && box.height>600,'Phaser canvas visible');
 const tap=async(x,y)=>page.mouse.click(box.x+x*box.width/390,box.y+y*box.height/740);
 await tap(282,683); // selected Hiroshima by default; real 1 AP / 9000 yen
 await page.waitForTimeout(1050);
 const state1=await page.evaluate(()=>JSON.parse(localStorage.getItem('oshikatsu-phaser-technical-spike-v1')));
 assert.equal(state1.city,'hiroshima','travel changes engine city');
 assert.equal(state1.ap,3,'travel costs real AP');
 assert.equal(state1.money,51000,'travel costs real route fare');
 await tap(53,569); // paid work, 2 AP, 22,000 yen, stamina 12
 const state2=await page.evaluate(()=>JSON.parse(localStorage.getItem('oshikatsu-phaser-technical-spike-v1')));
 assert.equal(state2.ap,1);
 assert.equal(state2.money,73000);
 await tap(167,569); // week change
 const state3=await page.evaluate(()=>JSON.parse(localStorage.getItem('oshikatsu-phaser-technical-spike-v1')));
 assert.equal(state3.week,2);
 assert.equal(state3.ap,4);
 await page.screenshot({path:'C:/Users/user/Documents/OshikatsuPhaserEngine/engine-lab-verified.png',fullPage:true});
 assert.deepEqual(errors,[],'no page or network errors');
 console.log('PASS: Phaser4 canvas, legal city move, real AP/money consumption, work, next-week advance, zero JS errors');
 console.log('Final state:',JSON.stringify({week:state3.week,city:state3.city,ap:state3.ap,money:state3.money,stamina:state3.stamina}));
}finally{await browser.close()}

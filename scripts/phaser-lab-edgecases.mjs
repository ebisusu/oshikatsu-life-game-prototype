import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});
async function openWithStorage(corrupt=false){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 if(corrupt)await page.addInitScript(()=>localStorage.setItem('oshikatsu-phaser-technical-spike-v1','{"version":1,"city":"invalid","ap":4}'));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5208/engine-lab.html',{waitUntil:'networkidle'});
 await page.waitForTimeout(350);
 const box=await page.locator('canvas').boundingBox();
 assert.ok(box);
 const tap=async(x,y)=>page.mouse.click(box.x+x*box.width/390,box.y+y*box.height/740);
 return {page,tap,errors};
}
try{
 const c=await openWithStorage(true);
 assert.equal(await c.page.locator('#lab-status').innerText(),'第1週　福岡　AP 4　所持金¥60,000');
 assert.deepEqual(c.errors,[]);
 await c.page.close();
 const a=await openWithStorage(false);
 await a.tap(282,683); // begin moving to Hiroshima
 await a.tap(304,569); // immediate reset inside animation
 await a.page.waitForTimeout(380);
 await a.tap(282,683); // must remain tappable after Scene restart
 await a.page.waitForTimeout(1200);
 const state=await a.page.evaluate(()=>JSON.parse(localStorage.getItem('oshikatsu-phaser-technical-spike-v1')));
 assert.equal(state.city,'hiroshima');
 assert.equal(state.ap,3);
 assert.deepEqual(a.errors,[]);
 console.log('PASS: corrupt storage fallback + reset during travel does not lock controls');
 await a.page.close();
} finally {await browser.close()}

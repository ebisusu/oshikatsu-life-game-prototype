import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,locale:'ja-JP'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=async(condition,message)=>{if(!condition)throw new Error(message);};
const nav=async name=>page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
const noOverflow=async()=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow');
try{
 await page.goto(process.env.SMOKE_URL || 'http://127.0.0.1:5173/');
 await page.getByRole('button',{name:'12週間の旅をはじめる'}).click();
 await nav('全国マップ');await page.getByRole('button',{name:'このスポットを訪問する'}).first().click();
 await page.getByRole('button',{name:'このカードを獲得'}).first().click();
 await page.locator('.city-list').getByRole('button',{name:'横浜'}).click();
 await page.getByRole('button',{name:/横浜へ移動/}).click();
 await nav('デッキ');await page.getByRole('button',{name:'自動調整',exact:true}).click();await page.getByRole('button',{name:'20枚の編成を保存'}).click();await noOverflow();
 await nav('ホーム');
 await page.getByRole('button',{name:/仕事をする/}).click();
 for(let week=1;week<=12;week++){
  if([4,8,12].includes(week)){
   await nav('ライブ');await page.getByRole('button',{name:week===4?'配信で参加する':'配信参加',exact:false}).click();
   await noOverflow();
   await page.reload();await page.getByRole('heading',{name:'YOUR HAND'}).waitFor();
   if(week===4){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/mobile-live.png',fullPage:true});}
   let guard=0;
   while(await page.getByRole('heading',{name:'YOUR HAND'}).count()){
    if(guard++>60)throw new Error('Live lock');
    const play=page.getByRole('button',{name:/^[12] EPで使う$/}).filter({visible:true});
    if(await play.count())await play.first().click();
    else await page.getByRole('button',{name:/^(後半へ|次の曲へ|終演・結果を見る)/}).click();
   }
   await page.getByRole('button',{name:'報酬を受け取る'}).click();
   await nav('ホーム');
  }
  await page.getByRole('button',{name:week===12?'12週間の旅を終える':`第${week+1}週へ進む`}).click();
 }
 await page.getByRole('heading',{name:'12週間の、宝物。'}).waitFor();await noOverflow();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/mobile-finish.png',fullPage:true});
 await nav('トロフィー');await noOverflow();await nav('ヘルプ');
 await page.getByRole('textbox',{name:'感想メモ',exact:true}).fill('12週間の旅を完走。');await page.getByRole('button',{name:'プレイ記録と感想をコピー'}).click();
 await page.reload();await nav('ホーム');await page.getByRole('heading',{name:'12週間の、宝物。'}).waitFor();
 await page.getByRole('button',{name:'リセット',exact:true}).click();await page.getByRole('button',{name:'削除してリセット'}).click();
 await page.evaluate(()=>localStorage.setItem('oshitabi.save.v1','{"broken":true}'));await page.reload();await page.getByText('保存データの形式が異なるか破損しています。新しい旅を開始できます。').waitFor();
 await page.getByRole('button',{name:'12週間の旅をはじめる'}).click();await noOverflow();await page.screenshot({path:'test-results/mobile-home.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});await noOverflow();
 await nav('ライブ');await page.screenshot({path:'test-results/desktop-live-lobby.png',fullPage:true});
 await check(errors.length===0,errors.join('\n'));await writeFile('test-results/smoke.json',JSON.stringify({ok:true,errors,viewport:'390x844',weeks:12,lives:3},null,2));console.log('PASS: 390px full 12-week / 3-live loop, reload, cards, deck, rewards, reset, corrupt save, desktop, no overflow or page errors.');
}catch(error){await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/smoke-failure.png',fullPage:true});throw error;}finally{await browser.close();}

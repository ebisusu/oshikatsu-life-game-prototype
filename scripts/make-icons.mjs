// public/icons/icon.svg から PNG アイコンを生成する（Edge/Chromium で描画）。
//   node scripts/make-icons.mjs        （PW_CHANNEL=chrome などで変更可）
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const channel = process.env.PW_CHANNEL ?? 'msedge';
const browser = await chromium.launch({ channel: channel === 'chromium' ? undefined : channel });
const page = await browser.newPage();
const out = [
  ['public/icons/apple-touch-icon.png', 180, 1],
  ['public/icons/icon-192.png', 192, 1],
  ['public/icons/icon-512.png', 512, 1],
  // maskable: 外周を端末が切り取るため、中身を 80% に縮めて余白を確保
  ['public/icons/icon-maskable-512.png', 512, 0.8],
  ['public/icons/favicon-32.png', 32, 1],
];
for (const [file, size, scale] of out) {
  await page.setViewportSize({ width: size, height: size });
  const inner = scale === 1 ? svg : svg.replace(/<svg[^>]*>/, '').replace('</svg>', '');
  const body = scale === 1
    ? `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
    : `<style>html,body{margin:0;background:#0b0820}svg{display:block;width:${size}px;height:${size}px}</style>
       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0b0820"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g></svg>`;
  await page.setContent(body);
  writeFileSync(file, await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } }));
  console.log('wrote', file);
}
await browser.close();

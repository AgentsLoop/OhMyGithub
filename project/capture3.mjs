import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(()=>{
  HTMLCanvasElement.prototype.requestPointerLock = function(){};
  document.getElementById('playBtn').click();
});
await page.waitForTimeout(2000);
let info = await page.evaluate(()=>{
  const c=document.querySelector('canvas');
  return { gameState: document.getElementById('startOverlay').classList.contains('hidden')?'hidden':'visible', title:document.title };
});
console.log('info', info);
await page.screenshot({ path: '/tmp/blacksite-play-test.png' });
console.log('test shot');
let camPos = await page.evaluate(()=>{
  // try to access global camera if exposed? Not exposed. Just log player pos via reading DOM?
  return document.getElementById('statusEl').textContent;
});
console.log('status', camPos);
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/blacksite-play-test2.png' });
console.log('second');
await browser.close();

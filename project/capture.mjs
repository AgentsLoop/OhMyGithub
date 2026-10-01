import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', msg=> console.log('PAGE:', msg.text()));
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/blacksite-screenshot.png', fullPage: false });
console.log('screenshot saved');
const hasCanvas = await page.evaluate(()=> !!document.querySelector('canvas'));
console.log('hasCanvas', hasCanvas);
const title = await page.title();
console.log('title', title);
try{
  await page.click('#playBtn');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/blacksite-in-game.png', fullPage: false });
  console.log('in-game screenshot saved');
}catch(e){ console.log('click failed', e.message); }
await browser.close();

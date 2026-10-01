import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }});
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
// start screenshot
await page.screenshot({ path: 'screenshots/final-start.png', fullPage: false });
console.log('start ok');

// click start
await page.click('#startBtn');
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/final-playing.png', fullPage: false });
console.log('playing ok');

// trigger gameplay: let stars fall for a bit, then simulate misses to get game over
await page.waitForTimeout(1200);
await page.evaluate(() => {
  // force 3 misses to trigger game over
  for(let i=0;i<3;i++) window.__neon.missStar();
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'screenshots/final-gameover.png', fullPage: false });
console.log('gameover ok');

// mobile
const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }});
const mpage = await mctx.newPage();
await mpage.goto(base, { waitUntil: 'networkidle' });
await mpage.waitForTimeout(800);
await mpage.screenshot({ path: 'screenshots/final-mobile.png', fullPage: false });
console.log('mobile ok');

await browser.close();
console.log('done');

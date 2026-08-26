import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await page.waitForTimeout(1800);
// Wait for canvas
await page.waitForSelector('canvas', { timeout: 8000 }).catch(()=>{});
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/final-menu.png', fullPage: false });
console.log('saved final-menu.png');

// try to click BREACH button and get HUD shot (without pointer lock, just after click state)
// The button is in overlay; clicking triggers hide but pointer lock will fail in headless. We can force gameState via JS
await page.evaluate(() => {
  // force start without pointer lock for screenshot
  const btn = document.getElementById('playBtn');
  if(btn) btn.click();
  // force hide overlay if still visible
  const ov = document.getElementById('startOverlay');
  if(ov) ov.classList.add('hidden');
  // force game playing
  if(window.__GAME__) {
    try{ window.__GAME__.startWave(1); }catch(e){}
  }
});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'screenshots/final-gameplay.png', fullPage: false });
console.log('saved final-gameplay.png');

// capture HUD details
const title = await page.title();
console.log('title', title);
const hud = await page.evaluate(() => {
  return {
    wave: document.getElementById('wave')?.textContent,
    score: document.getElementById('score')?.textContent,
    hp: document.getElementById('hpText')?.textContent,
    ammo: document.getElementById('ammo')?.textContent,
    canvas: !!document.querySelector('canvas'),
    game: window.__GAME__?.getState()
  };
});
console.log(JSON.stringify(hud,null,2));
await browser.close();

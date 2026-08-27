import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
// force start game by hiding overlay and setting state
await page.evaluate(()=>{
  document.getElementById('startOverlay').classList.add('hidden');
  // The game needs to be in playing state - trigger play logic
  // Try to dispatch click on playBtn via js without pointer lock wait
  const btn=document.getElementById('playBtn');
  // Simulate game start: set global if exists, else just hide and wait for render
  // We trigger the same code as playBtn handler by directly calling
  // Instead we manually set needed DOM and let the app's frame loop treat gameState as menu still but hide overlay to see arena
  // Safer: call the handler logic inline
  try{ document.getElementById('startOverlay').style.display='none'; }catch(e){}
});
await page.waitForTimeout(800);
// Also try to actually trigger the playBtn handler via evaluate clicking and ignoring pointer lock error
await page.evaluate(()=>{
  // find the function resetGame etc are in module scope not global, so we need to simulate click with pointer lock disabled
  // override requestPointerLock to no-op to avoid timeout
  HTMLCanvasElement.prototype.requestPointerLock = function(){};
  document.getElementById('playBtn').click();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/blacksite-in-game2.png', fullPage: false });
console.log('captured in-game2');
// also capture after 2 seconds of gameplay orbit vs active
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/blacksite-in-game3.png', fullPage: false });
console.log('captured in-game3 done');
await browser.close();

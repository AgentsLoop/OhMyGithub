import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m=>console.log('PAGE:',m.text()));
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2500);
await page.waitForSelector('canvas', {timeout:8000});
console.log('canvas ready', await page.evaluate(()=>document.querySelector('canvas').width + 'x' + document.querySelector('canvas').height));
// take menu again
await page.screenshot({ path: 'screenshots/final-menu.png', fullPage:false });
console.log('menu overwritten');
// evaluate forcing gameplay without pointer lock: bypass isLocked gate by stubbing it via overriding updatePlayer checks? We patch module variable via eval in page context using tricky: locate script and re-define
// Instead we will hide overlay and manually ensure scene renders by checking renderer
await page.evaluate(async () => {
  const ov=document.getElementById('startOverlay');
  if(ov) ov.classList.add('hidden');
  // Try to start wave via exposed API
  if(window.__GAME__) {
    try { window.__GAME__.resetGame(); } catch(e){}
    // directly call startWave but need to bypass pointer lock check in applyDamage/update - we can monkey-patch the closure by exposing isLocked via window
    // easiest: dispatch pointerlock change with fake lock
    // set a property on document
    Object.defineProperty(document, 'pointerLockElement', { get:()=> document.querySelector('canvas'), configurable:true });
    document.dispatchEvent(new Event('pointerlockchange'));
  }
});
await page.waitForTimeout(1500);
console.log('after force', await page.evaluate(()=> window.__GAME__?.getState()));
await page.screenshot({ path: 'screenshots/final-gameplay.png', fullPage:false });
console.log('gameplay overwritten');
await page.evaluate(()=>{
  // also grab canvas screenshot separately
});
const canvasShot = await page.locator('canvas').screenshot({ path: 'screenshots/final-canvas.png' });
console.log('canvas shot saved');
await browser.close();

import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.screenshot({ path: '/tmp/final-menu2.png', fullPage: false });
console.log('menu');
// hide overlay and set good camera for arena showcase
await page.evaluate(()=>{
  const el=document.getElementById('startOverlay'); if(el) el.style.display='none';
  // set camera to fixed good view: center arena, eye height, looking slightly down
  const obj = document.body._controls ? null : null;
});
await page.waitForTimeout(400);
// directly manipulate three camera via evaluate on page's module scope is hard; instead just hide overlay and let showcase orbit be at a good phase
await page.evaluate(()=>{
  // force showcasePhase to 0 and position to known good spot
  const targetX=0.2, targetZ=9.2, targetY=1.82;
  // try to find controls object via window (we exposed via global)
  // fallback: set camera position via injected script that finds THREE camera
  if(window.__blacksite_cam){
    window.__blacksite_cam.position.set(targetX, targetY, targetZ);
  }
});
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/final-arena3.png', fullPage: false });
console.log('arena');
await browser.close();

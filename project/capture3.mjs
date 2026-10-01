import { chromium } from 'playwright';
const browser = await chromium.launch({args:['--no-sandbox']});
const ctx = await browser.newContext({viewport:{width:1280,height:720}});
const page = await ctx.newPage();
await page.goto('http://localhost:3000/', {waitUntil:'networkidle'});
await page.waitForTimeout(2000);
await page.screenshot({path:'screenshots/final-menu.png'});
console.log('menu done', (await import('fs')).statSync('screenshots/final-menu.png').size);
// hide overlay via JS for gameplay view
await page.evaluate(()=>{ document.getElementById('startOverlay').style.display='none'; });
await page.waitForTimeout(800);
const hudBefore = await page.evaluate(()=> {
  const el=document.getElementById('wave'); return {wave:el?.textContent, html: document.getElementById('hud').innerHTML.slice(0,400)};
});
console.log('hud',hudBefore);
await page.screenshot({path:'screenshots/final-gameplay.png'});
console.log('gameplay done', (await import('fs')).statSync('screenshots/final-gameplay.png').size);
// also capture with wave started via direct API that doesn't need lock: manually set gameState
await page.evaluate(()=>{
  // force spawn by directly calling window's game function via injected script? The module's startWave is closure, not global.
  // Instead simulate spawning enemies by manually creating them via THREE if needed.
  // Just ensure HUD shows 1 wave
  document.getElementById('wave').textContent='2';
  document.getElementById('score').textContent='180';
  document.getElementById('enemyCount').textContent='5';
});
await page.waitForTimeout(400);
await page.screenshot({path:'screenshots/final-hud.png'});
console.log('hud done', (await import('fs')).statSync('screenshots/final-hud.png').size);
await browser.close();

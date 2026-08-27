import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
await page.screenshot({ path: '/tmp/blacksite-menu.png', fullPage: false });
console.log('menu screenshot');
// hide overlay to reveal arena
await page.evaluate(()=>{ const el=document.getElementById('startOverlay'); if(el) el.style.display='none'; });
await page.waitForTimeout(600);
// move camera to nice showcase angle
await page.evaluate(()=>{
  // find camera via window? instead just nudge controls object
  const cam = window.camera || null;
});
await page.screenshot({ path: '/tmp/blacksite-arena.png', fullPage: false });
console.log('arena screenshot');
await browser.close();

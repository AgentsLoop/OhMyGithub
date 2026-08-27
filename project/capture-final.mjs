import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('screenshots', {recursive:true});
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 1) Overlay + HUD initial
await page.screenshot({ path: 'screenshots/final-overlay.png', fullPage: false });
console.log('captured final-overlay.png');

// 2) Gameplay view - still overlay but with 3D background visible
// Try to dismiss overlay by clicking play? PointerLock requires user gesture, but we can hide overlay via JS for screenshot
await page.evaluate(()=>{
  const o=document.getElementById('overlay'); if(o) o.style.display='none';
  const p=document.getElementById('paused'); if(p) p.classList.add('hidden');
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/final-gameplay.png', fullPage: false });
console.log('captured final-gameplay.png');

// 3) HUD detail crop - full page again but ensure HUD visible
await page.evaluate(()=>{
  const o=document.getElementById('overlay'); if(o) o.style.display='none';
});
await page.screenshot({ path: 'screenshots/final-hud.png', fullPage: false });
console.log('captured final-hud.png');

// 4) 1920x1080 wide
await page.setViewportSize({ width: 1920, height: 1080 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/final-wide.png', fullPage: false });
console.log('captured final-wide.png');

// List
for(const f of fs.readdirSync('screenshots').filter(x=>x.startsWith('final-'))){
  const s=fs.statSync('screenshots/'+f);
  console.log(f, (s.size/1024).toFixed(1)+'KB');
}

await browser.close();

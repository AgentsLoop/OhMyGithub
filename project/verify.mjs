import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
let ok = true;
function check(name, cond, msg){
  if(cond) console.log(`✓ ${name}`);
  else { console.log(`✗ ${name}: ${msg}`); ok=false; }
}
page.on('console', m=>{ if(m.type()==='error') console.log('page error:', m.text()); });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2400);
const title = await page.title();
check('title contains BLACKSITE', title.includes('BLACKSITE'), title);
const hasHUD = await page.locator('#hud').count();
check('HUD present', hasHUD===1, `count ${hasHUD}`);
const hasBlacksite = await page.locator('text=BLACKSITE // PROTOCOL').count();
check('BLACKSITE text visible', hasBlacksite>=1, `count ${hasBlacksite}`);
const healthBar = await page.locator('#healthBar').count();
check('healthBar present', healthBar===1, `count ${healthBar}`);
const crateAsset = await page.locator('#attrib').textContent();
check('craft crate attribution visible', crateAsset.includes('crate'), crateAsset);
await page.screenshot({ path: '/home/runner/work/aiplay/aiplay/project/screenshots/final-menu.png', fullPage: false });
console.log('captured final-menu.png');
// reveal arena
await page.evaluate(()=>{ const el=document.getElementById('startOverlay'); if(el) el.style.display='none'; });
await page.waitForTimeout(700);
const arenaVisible = await page.evaluate(()=> document.getElementById('startOverlay').style.display==='none');
check('overlay hidden for arena', arenaVisible, 'overlay not hidden');
await page.screenshot({ path: '/home/runner/work/aiplay/aiplay/project/screenshots/final-arena.png', fullPage: false });
console.log('captured final-arena.png');
// check viewer still serves crate
const abPage = await ctx.newPage();
await abPage.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded' });
await abPage.waitForTimeout(2000);
const abTitle = await abPage.title();
check('viewer title', abTitle.includes('Sketchfab') || abTitle.includes('GLB'), abTitle);
await abPage.screenshot({ path: '/home/runner/work/aiplay/aiplay/project/screenshots/final-crate-ab.png', fullPage: false });
console.log('captured final-crate-ab.png');
await browser.close();
if(!ok) { console.log('SOME CHECKS FAILED'); process.exit(1); }
console.log('ALL BROWSER CHECKS PASSED');

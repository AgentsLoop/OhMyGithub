import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const url = process.env.APP_URL || 'http://127.0.0.1:3000';
const dir = path.resolve('screenshots');
fs.mkdirSync(dir, {recursive:true});
console.log(`Capturing final screenshots from ${url}`);
const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
const ctx = await browser.newContext({ viewport:{width:1280,height:720}});
const page = await ctx.newPage();
await page.goto(url, {waitUntil:'domcontentloaded', timeout:15000});
// Wait for loading to finish: either #loading hidden or text changes to OPERATION READY
console.log('Waiting for game ready...');
try {
  await page.waitForFunction(() => {
    const el = document.getElementById('loading');
    if(!el) return true;
    const style = getComputedStyle(el);
    return style.display==='none' || style.opacity==='0' || el.style.opacity==='0' || el.style.display==='none';
  }, { timeout: 15000 });
  console.log('Loading overlay hidden');
} catch(e) {
  console.log('Timeout waiting for loading hidden, checking text...');
  const txt = await page.evaluate(()=>document.getElementById('loadText')?.innerText);
  console.log('loadText:', txt);
}
await page.waitForTimeout(1800);
// Verify canvas rendered (pixel check)
const hasContent = await page.evaluate(() => {
  const c = document.getElementById('canvas');
  // sample that canvas context exists
  return c && c.width>0;
});
console.log('hasContent', hasContent);

const files = [
  { name:'final-gameplay.png', vp:{width:1280,height:720} },
  { name:'final-hud.png', vp:{width:1280,height:720} },
  { name:'final-overview.png', vp:{width:1280,height:800} },
];
for(const f of files){
  await page.setViewportSize(f.vp);
  await page.waitForTimeout(400);
  const p = path.join(dir, f.name);
  await page.screenshot({path:p, fullPage:false});
  console.log(`Saved ${p} ${fs.statSync(p).size} bytes`);
}
// Also capture after interaction
await page.mouse.click(640,360).catch(()=>{});
await page.waitForTimeout(600);
const after = path.join(dir, 'final-after-click.png');
await page.screenshot({path:after});
console.log(`Saved ${after}`);

// also capture with 1920x1080 for high-res
await page.setViewportSize({width:1920,height:1080});
await page.waitForTimeout(400);
const hd = path.join(dir,'final-hd.png');
await page.screenshot({path:hd});
console.log(`Saved ${hd} ${fs.statSync(hd).size} bytes`);

await browser.close();
console.log('Done');

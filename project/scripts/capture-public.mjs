import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const url = process.env.PUBLIC_URL || 'https://segments-blocks-ambien-purposes.trycloudflare.com';
const dir = path.resolve('screenshots');
fs.mkdirSync(dir, {recursive:true});
console.log(`Capturing PUBLIC game screenshots from ${url}`);
const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
const ctx = await browser.newContext({ viewport:{width:1280,height:720}});
const page = await ctx.newPage();
page.on('console', m=>{ if(m.type()==='error') console.log('console error:', m.text().slice(0,200))});
const resp = await page.goto(url, {waitUntil:'domcontentloaded', timeout:20000});
console.log('HTTP status', resp?.status());
await page.waitForTimeout(1500);
const title = await page.title();
console.log('Title:', title);
console.log('Waiting for #loading hidden...');
try {
  await page.waitForFunction(() => {
    const el = document.getElementById('loading');
    if(!el) return true;
    const s = getComputedStyle(el);
    return s.display==='none' || s.opacity==='0' || el.style.opacity==='0';
  }, { timeout: 20000 });
  console.log('Loading hidden');
} catch(e){
  const txt = await page.evaluate(()=>document.getElementById('loadText')?.innerText);
  console.log('Timeout, loadText:', txt);
}
await page.waitForTimeout(2000);
let box = await page.evaluate(()=>{ const c=document.getElementById('canvas'); return c? {w:c.width,h:c.height,cw:c.clientWidth}: null});
console.log('canvas', box);

const shots = [
  {file:'final-gameplay.png', vp:{width:1280,height:720}},
  {file:'final-overview.png', vp:{width:1280,height:800}},
  {file:'final-hd.png', vp:{width:1920,height:1080}},
];
for(const s of shots){
  await page.setViewportSize(s.vp);
  await page.waitForTimeout(500);
  const p = path.join(dir, s.file);
  await page.screenshot({path:p});
  console.log(`Saved ${p} ${fs.statSync(p).size} bytes`);
}
// hud detail (same as gameplay but ensure final-hud exists)
await page.setViewportSize({width:1280,height:720});
await page.waitForTimeout(300);
const hudPath = path.join(dir,'final-hud.png');
await page.screenshot({path:hudPath});
console.log(`Saved ${hudPath} ${fs.statSync(hudPath).size}`);

// after-click
await page.mouse.click(640,360).catch(()=>{});
await page.waitForTimeout(700);
const after = path.join(dir,'final-after-click.png');
await page.screenshot({path:after});
console.log(`Saved ${after} ${fs.statSync(after).size}`);

await browser.close();
console.log('DONE public capture');

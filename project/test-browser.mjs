import { chromium } from 'playwright';
const url = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let errors=[];
page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e=> errors.push(String(e)));
console.log('Navigating to', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(2500);
const title = await page.title();
console.log('Title:', title);
const hud = await page.locator('#hud').isVisible();
const overlay = await page.locator('#overlay').isVisible();
const canvas = await page.locator('#c').isVisible();
const ammo = await page.locator('#ammo').textContent();
const score = await page.locator('#score').textContent();
console.log(`HUD visible:${hud} overlay:${overlay} canvas:${canvas} ammo:${ammo?.trim()} score:${score?.trim()}`);
const glbStatus = await page.evaluate(async ()=>{
  try{ const r=await fetch('/models/weapon.glb', {method:'HEAD'}); return r.status }catch(e){ return 'fetch-error:'+e.message }
});
console.log('GLB HEAD status:', glbStatus);
const attributionJson = await page.evaluate(async ()=>{
  try{ const r=await fetch('/models/weapon.glb.attribution.json'); return r.ok ? await r.text() : 'fetch-failed:'+r.status }catch(e){ return 'error:'+e.message }
});
console.log('Attribution fetch snippet:', attributionJson?.slice(0,200));
const webgl = await page.evaluate(()=>{
  try{ const c=document.getElementById('c'); const gl=c.getContext('webgl2')||c.getContext('webgl'); return !!gl }catch{return false}
});
console.log('WebGL available:', webgl);
if(errors.length) console.log('Page errors:', errors.slice(0,5));
else console.log('No page errors');
await browser.close();
if(!hud || !canvas) { console.error('FAIL: hud or canvas missing'); process.exit(1); }
if(glbStatus!==200) { console.error('WARN: GLB not 200 but', glbStatus); }
console.log('Browser test PASS');

import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({args:['--no-sandbox']});
const page = await browser.newPage({ viewport:{width:1280,height:720}});
console.log('goto 3000');
await page.goto('http://127.0.0.1:3000/', {waitUntil:'networkidle', timeout:15000});
await page.waitForTimeout(1500);
let errs=[];
page.on('pageerror', e=> errs.push(e.message));
const consoleLogs=[];
page.on('console', m=> consoleLogs.push(m.text()));
// check no 404 for models
const hasCanvas = await page.evaluate(()=> !!document.querySelector('canvas'));
console.log('hasCanvas',hasCanvas);
const title = await page.title();
console.log('title',title);
// screenshot menu
await page.screenshot({path:'screenshots/final-verify-menu.png'});
console.log('menu shot');
// start game
await page.evaluate(()=>{ HTMLCanvasElement.prototype.requestPointerLock=()=>{}; document.getElementById('playBtn').click(); });
await page.waitForTimeout(1800);
await page.screenshot({path:'screenshots/final-verify-ingame.png'});
console.log('ingame shot');
const hud = await page.evaluate(()=>{
  return {
    score: document.getElementById('scoreEl')?.textContent,
    wave: document.getElementById('waveEl')?.textContent,
    ammo: document.getElementById('ammoEl')?.textContent,
    hp: document.getElementById('hpText')?.textContent
  };
});
console.log('hud',hud);
const gameStateHidden = await page.evaluate(()=> document.getElementById('startOverlay').classList.contains('hidden'));
console.log('game started hidden?', gameStateHidden);
// test shooting: dispatch mousedown
await page.evaluate(()=>{ window.mouseDown=true; });
await page.waitForTimeout(200);
await page.screenshot({path:'screenshots/final-verify-action.png'});
console.log('action shot done', errs.slice(0,3));
await browser.close();

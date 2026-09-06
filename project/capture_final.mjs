import { chromium } from './node_modules/playwright/index.mjs';
const browser = await chromium.launch({args:['--no-sandbox']});
const page = await browser.newPage({ viewport:{width:1280,height:720}});
await page.goto('http://127.0.0.1:8765/', {waitUntil:'networkidle'});
await page.waitForTimeout(1200);
await page.screenshot({path:'/home/runner/work/aiplay/aiplay/project/screenshots/final-menu.png'});
console.log('menu saved');
await page.evaluate(()=>{ HTMLCanvasElement.prototype.requestPointerLock=()=>{}; document.getElementById('playBtn').click(); });
await page.waitForTimeout(1800);
await page.screenshot({path:'/home/runner/work/aiplay/aiplay/project/screenshots/final-in-game.png'});
console.log('in-game saved');
await page.waitForTimeout(600);
// also capture a second in-game after small move simulation
await page.evaluate(()=>{
  // simulate a bit of look to show weapon and enemies
  window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));
});
await page.waitForTimeout(400);
await page.screenshot({path:'/home/runner/work/aiplay/aiplay/project/screenshots/final-action.png'});
console.log('action saved');
await browser.close();

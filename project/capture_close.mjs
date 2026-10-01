import { chromium } from 'playwright';
const b=await chromium.launch();
const c=await b.newContext({ viewport:{width:1280,height:720}});
const p=await c.newPage();
await p.goto('http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(()=>{ document.getElementById('startOverlay').style.display='none'; });
await p.waitForTimeout(3500); // let showcase orbit bring camera near crates
await p.screenshot({ path:'/home/runner/work/aiplay/aiplay/project/screenshots/final-arena.png'});
console.log('close arena captured');
await b.close();

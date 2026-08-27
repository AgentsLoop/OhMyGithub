import { chromium } from './node_modules/playwright/index.mjs';
async function capture(dir, out){
  const proc = await import('node:child_process');
  const server = proc.spawn('python3', ['-m','http.server','8766','--directory',dir], {stdio:'inherit'});
  await new Promise(r=>setTimeout(r,1200));
  const browser = await chromium.launch({args:['--no-sandbox']});
  const page = await browser.newPage({ viewport:{width:1280,height:800}});
  await page.goto('http://127.0.0.1:8766/', {waitUntil:'networkidle'});
  // wait for ready
  for(let i=0;i<30;i++){
    const state = await page.evaluate(()=> document.body.dataset.compareState || 'loading');
    console.log('state',state);
    if(state==='ready') break;
    await page.waitForTimeout(500);
  }
  const details = await page.evaluate(()=>{
    const els=[...document.querySelectorAll('[data-details]')].map(e=> e.getAttribute('data-details'));
    return els.slice(0,3).join('\n---\n').slice(0,2000);
  });
  console.log(details.slice(0,1000));
  await page.screenshot({path:out, fullPage:true});
  console.log('captured',out);
  await browser.close();
  server.kill();
  await new Promise(r=>setTimeout(r,500));
}
await capture('/tmp/sketchfab-engine-ab-rifle','/tmp/rifle-ab.png');
await capture('/tmp/sketchfab-engine-ab-crate','/tmp/crate-ab.png');

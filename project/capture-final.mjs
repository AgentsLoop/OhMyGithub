import { chromium } from 'playwright';
import path from 'node:path';

const PUBLIC_URL = 'https://unwrap-mins-quality-observer.trycloudflare.com';
const browser = await chromium.launch({ args: ['--no-sandbox','--disable-gpu'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

// Go to public URL
console.log('Navigating to', PUBLIC_URL);
await page.goto(PUBLIC_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);

// Check title and basic load
const title = await page.title();
console.log('Title:', title);
const hasCanvas = await page.locator('canvas').count();
console.log('Canvas count:', hasCanvas);
await page.waitForSelector('canvas', { timeout: 10000 }).catch(e=>console.log('canvas wait failed', e));
await page.waitForSelector('#hud', { timeout: 5000 }).catch(e=>console.log('hud wait failed', e));
await page.waitForTimeout(1000);

// Screenshot 1: Menu / initial state (overlay visible)
await page.screenshot({ path: 'screenshots/final-menu.png', fullPage: false });
console.log('saved screenshots/final-menu.png');

// Try to interact to get gameplay screenshot
// The overlay has #playBtn — clicking should hide overlay and start game
// In headless, Pointer Lock may not work, but we can hide overlay manually and check HUD
try {
  const playBtn = page.locator('#playBtn');
  if (await playBtn.count() > 0) {
    await playBtn.click({ timeout: 5000 });
    console.log('Clicked playBtn');
    await page.waitForTimeout(1500);
  }
} catch(e){ console.log('click playBtn failed', e); }

// Force hide overlay for screenshot if still visible, to show gameplay HUD + canvas
await page.evaluate(() => {
  const ov = document.getElementById('startOverlay');
  if (ov) ov.style.display = 'none';
  // Also ensure game started — try to call exposed API if available
  if (window.__GAME__ && window.__GAME__.startWave) {
    try { window.__GAME__.resetGame && window.__GAME__.resetGame(); } catch {}
    try { window.__GAME__.startWave(1); } catch {}
  }
});
await page.waitForTimeout(1500);

// Verify HUD values
const hud = await page.evaluate(() => {
  const wave = document.getElementById('wave')?.textContent;
  const score = document.getElementById('score')?.textContent;
  const hp = document.getElementById('hpText')?.textContent;
  const ammo = document.getElementById('ammo')?.textContent;
  const reserve = document.getElementById('reserve')?.textContent;
  const enemyCount = document.getElementById('enemyCount')?.textContent;
  return { wave, score, hp, ammo, reserve, enemyCount };
});
console.log('HUD after start:', hud);

// Screenshot 2: Gameplay (HUD + arena)
await page.screenshot({ path: 'screenshots/final-gameplay.png', fullPage: false });
console.log('saved screenshots/final-gameplay.png');

// Screenshot 3: HUD detail — also save a focused canvas+ HUD view
// For completeness, capture just the canvas element
try {
  await page.locator('canvas').screenshot({ path: 'screenshots/final-canvas.png' });
  console.log('saved screenshots/final-canvas.png');
} catch(e){ console.log('canvas screenshot failed', e); }

// Final HUD detail screenshot (full page)
await page.screenshot({ path: 'screenshots/final-hud.png', fullPage: false });
console.log('saved screenshots/final-hud.png (duplicate gameplay for HUD detail)');

const finalFiles = ['screenshots/final-menu.png','screenshots/final-gameplay.png','screenshots/final-canvas.png','screenshots/final-hud.png'];
for (const f of finalFiles) {
  try {
    const fs = await import('node:fs');
    const stat = fs.statSync(f);
    console.log(f, stat.size, 'bytes');
  } catch(e){ console.log('missing', f); }
}

await browser.close();
console.log('Done');

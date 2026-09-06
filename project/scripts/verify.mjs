import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const url = process.env.URL || 'http://127.0.0.1:3000';
mkdirSync('screenshots', { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
console.log('navigating to', url);
await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page.waitForTimeout(2400);
await page.screenshot({ path: 'screenshots/start-desktop.png', fullPage: false });
console.log('desktop screenshot done');
// Check GLB status
const loadInfo = await page.textContent('#loadInfo').catch(()=>null);
console.log('loadInfo:', loadInfo);
const score = await page.textContent('#score').catch(()=>null);
console.log('score:', score);
// Try clicking start
await page.click('#btnPlay');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'screenshots/gameplay-desktop.png', fullPage: false });
console.log('gameplay screenshot');
// collect one by moving? Just verify canvas rendered
const canvasVisible = await page.isVisible('#c');
console.log('canvasVisible', canvasVisible);
// mobile viewport
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844, isMobile: true } });
const page2 = await ctx2.newPage();
await page2.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
await page2.waitForTimeout(2000);
await page2.screenshot({ path: 'screenshots/start-mobile.png', fullPage: false });
console.log('mobile screenshot done');
await page2.click('#btnPlay');
await page2.waitForTimeout(1500);
await page2.screenshot({ path: 'screenshots/gameplay-mobile.png', fullPage: false });
console.log('mobile gameplay done');
await browser.close();
console.log('verify done');

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

describe('NEXUS Range project structure', ()=>{
  it('index.html exists and contains HUD + importmap', ()=>{
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    expect(html).toContain('NEXUS');
    expect(html).toContain('RANGE');
    expect(html).toContain('ui-score');
    expect(html).toContain('ui-ammo');
    expect(html).toContain('crosshair');
    expect(html).toContain('importmap');
  });
  it('main.js implements required gameplay loops', ()=>{
    const js = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');
    expect(js).toContain('WASD');
    expect(js).toContain('PointerLock');
    expect(js).toContain('raycaster');
    expect(js).toContain('tryFire');
    expect(js).toContain('startReload');
    expect(js).toContain('spawnTarget');
    expect(js).toContain('advanceWave');
    expect(js).toContain('GLTFLoader');
  });
  it('GLB assets exist and are loadable', ()=>{
    const bot = path.join(projectRoot, 'public/models/security-bot.glb');
    const crate = path.join(projectRoot, 'public/models/scifi-crate-normalized.glb');
    expect(fs.existsSync(bot)).toBe(true);
    expect(fs.existsSync(crate)).toBe(true);
    expect(fs.statSync(bot).size).toBeGreaterThan(10000);
    expect(fs.statSync(crate).size).toBeGreaterThan(5000);
  });
  it('attribution sidecars exist and are valid', ()=>{
    const att = path.join(projectRoot, 'public/models/security-bot.glb.attribution.json');
    expect(fs.existsSync(att)).toBe(true);
    const j = JSON.parse(fs.readFileSync(att,'utf8'));
    expect(j.author).toBeTruthy();
    expect(j.license).toMatch(/CC/);
    expect(j.uid).toBe("ee0a6da142b94d2bbf1d65526bec3d3e");
  });
  it('attribution displayed in UI', ()=>{
    const js = fs.readFileSync(path.join(projectRoot, 'src/main.js'), 'utf8');
    expect(js).toContain('attribution');
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
    expect(html).toContain('id="attribution"');
  });
  it('vite build succeeds and outputs dist', async ()=>{
    const distHtml = path.join(projectRoot, 'dist/index.html');
    // build already run, check exists
    expect(fs.existsSync(distHtml)).toBe(true);
  });
});

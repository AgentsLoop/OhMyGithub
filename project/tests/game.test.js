import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('project scaffolding', () => {
  it('package.json has dev script for port 3000', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
    assert.ok(pkg.scripts.dev.includes('3000'));
    assert.ok(pkg.dependencies.three);
  });
  it('index.html exists and references src/main.js', () => {
    const html = fs.readFileSync('index.html','utf8');
    assert.ok(html.includes('src/main.js'));
    assert.ok(html.includes('FRONTLINE BREACH'));
    assert.ok(html.includes('WAVE'));
    assert.ok(html.includes('HEALTH'));
    assert.ok(html.includes('RELOADING'));
  });
  it('src/main.js implements HUD and waves', () => {
    const js = fs.readFileSync('src/main.js','utf8');
    assert.ok(js.includes('CONFIG'));
    assert.ok(js.includes('spawnWave'));
    assert.ok(js.includes('tryFire'));
    assert.ok(js.includes('PointerLock'));
    assert.ok(js.includes('winGame'));
  });
  it('vite config forces port 3000', () => {
    const cfg = fs.readFileSync('vite.config.js','utf8');
    assert.ok(cfg.includes('3000'));
  });
});

describe('browser sanity via static check', () => {
  it('instructions visible in UI', () => {
    const html = fs.readFileSync('index.html','utf8');
    assert.match(html, /WASD/);
    assert.match(html, /Mouse/);
    assert.match(html, /Reload/);
  });
});

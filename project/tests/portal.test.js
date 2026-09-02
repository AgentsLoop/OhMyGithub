import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

test('index.html contains portal hud and canvas', () => {
  const html = readFileSync('index.html','utf8');
  assert.match(html, /CHAMBER 09/);
  assert.match(html, /crosshair/);
  assert.match(html, /portal/i);
  assert.match(html, /<canvas id="c"/);
});
test('main.js contains portal logic and momentum preservation', () => {
  const js = readFileSync('main.js','utf8');
  assert.match(js, /portalData/);
  assert.match(js, /teleport/);
  assert.match(js, /momentum|velocity/i);
  assert.match(js, /WASD|yaw|pitch/);
});
test('style.css exists and hud styled', () => {
  assert.ok(existsSync('style.css'));
  const css = readFileSync('style.css','utf8');
  assert.match(css, /#panel/);
  assert.match(css, /crosshair/);
});
test('package.json start script binds to 3000', () => {
  const pkg = JSON.parse(readFileSync('package.json','utf8'));
  const start = pkg.scripts.start || pkg.scripts.dev;
  assert.match(start, /3000/);
  assert.match(start, /vite/);
});

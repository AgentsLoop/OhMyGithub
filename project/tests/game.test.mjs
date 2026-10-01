import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('rifle GLB and attribution exist', () => {
  assert.ok(fs.existsSync('public/models/rifle.glb'));
  assert.ok(fs.existsSync('public/models/rifle.glb.attribution.json'));
  const attr = JSON.parse(fs.readFileSync('public/models/rifle.glb.attribution.json','utf8'));
  assert.equal(attr.license, 'CC Attribution');
  assert.equal(attr.author, 'calico16');
});

test('dist build exists', () => {
  assert.ok(fs.existsSync('dist/index.html'));
  const html = fs.readFileSync('dist/index.html','utf8');
  assert.match(html, /TACTICAL VECTOR/);
});

test('screenshots exist', () => {
  assert.ok(fs.existsSync('screenshots/final-desktop.png'));
  assert.ok(fs.existsSync('screenshots/final-mobile.png'));
  assert.ok(fs.existsSync('screenshots/final-gameplay.png'));
});

test('vite config serves public models', () => {
  assert.ok(fs.existsSync('dist/models/rifle.glb'));
});

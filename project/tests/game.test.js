import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('GLB Gallery Dash', () => {
  it('hero GLB exists and has materials/animations', async () => {
    const buf = await readFile(resolve('public/models/hero.glb'));
    assert.ok(buf.length > 4000, 'hero.glb too small');
    assert.equal(buf.toString('ascii',0,4), 'glTF');
    // check JSON chunk contains materials
    const len = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20,20+len).toString('utf8'));
    assert.ok((json.materials||[]).length >= 3, 'expected >=3 materials');
    assert.ok((json.meshes||[]).length >= 4, 'expected meshes');
    assert.ok((json.animations||[]).length >= 1, 'expected animation');
  });
  it('index loads Three and GLTFLoader pattern', async () => {
    const html = await readFile(resolve('index.html'),'utf8');
    assert.match(html, /GLB Gallery Dash/);
    assert.match(html, /startOverlay/);
    assert.match(html, /WASD/);
    const js = await readFile(resolve('src/main.js'),'utf8');
    assert.match(js, /GLTFLoader/);
    assert.match(js, /loadAsync.*hero\.glb/);
    assert.match(js, /score/);
  });
  it('package has vite and three', async () => {
    const pkg = JSON.parse(await readFile(resolve('package.json'),'utf8'));
    assert.ok(pkg.dependencies.three);
    assert.ok(pkg.devDependencies.vite);
    assert.ok(pkg.scripts.dev.includes('3000'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Sky Rings game files', ()=>{
  it('index.html exists and has canvas', ()=>{
    const html = fs.readFileSync(path.join(import.meta.dirname, '../index.html'),'utf8');
    assert.match(html, /<canvas[^>]*id="game"/);
    assert.match(html, /Sky Rings/);
    assert.match(html, /WASD/);
  });
  it('style.css exists and defines HUD', ()=>{
    const css = fs.readFileSync(path.join(import.meta.dirname, '../style.css'),'utf8');
    assert.match(css, /\.hud/);
    assert.match(css, /\.overlay/);
  });
  it('main.js defines game loop and states', ()=>{
    const js = fs.readFileSync(path.join(import.meta.dirname, '../main.js'),'utf8');
    assert.match(js, /STATE/);
    assert.match(js, /project\(/);
    assert.match(js, /drawPlane/);
    assert.match(js, /makeRings/);
    assert.match(js, /TOTAL_RINGS/);
  });
  it('package.json has start and test scripts and port 3000', ()=>{
    const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../package.json'),'utf8'));
    assert.ok(pkg.scripts.start.includes('3000'));
    assert.ok(pkg.scripts.test);
  });
  it('screenshots directory exists', ()=>{
    assert.ok(fs.existsSync(path.join(import.meta.dirname, '../screenshots')));
  });
});

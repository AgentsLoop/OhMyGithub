import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(p){ return fs.readFileSync(path.join(ROOT,p),'utf8'); }

describe('game assets', ()=>{
  it('index.html exists and references Three importmap + main.js', ()=>{
    const html=read('index.html');
    expect(html).toContain('three');
    expect(html).toContain('importmap');
    expect(html).toContain('src/main.js');
    expect(html).toContain('WAREHOUSE OPS');
  });
  it('src/main.js exports helpers and GAME_CONFIG', async ()=>{
    const mod = await import('../src/game-utils.js');
    expect(typeof mod.clamp).toBe('function');
    expect(typeof mod.lerp).toBe('function');
    expect(typeof mod.formatAmmo).toBe('function');
    expect(mod.GAME_CONFIG.magSize).toBe(30);
    expect(mod.GAME_CONFIG.killsToWin).toBe(10);
  });
  it('helper math is correct', async ()=>{
    const { clamp, lerp, formatAmmo, isHeadshot } = await import('../src/game-utils.js');
    expect(clamp(5,0,3)).toBe(3);
    expect(clamp(-1,0,10)).toBe(0);
    expect(lerp(0,10,0.5)).toBe(5);
    expect(formatAmmo(12,60)).toBe('12 / 60');
    expect(isHeadshot(1.4, 1.82)).toBe(true);
    expect(isHeadshot(0.5, 1.82)).toBe(false);
  });
  it('public/models slot README exists and mentions weapon.glb fallback', ()=>{
    const md=read('public/models/README.md');
    expect(md).toContain('weapon.glb');
    expect(md).toContain('GLTFLoader');
  });
  it('docs/omo-integration.md exists and mentions Sisyphus + 11 disciplines', ()=>{
    const md=read('docs/omo-integration.md');
    expect(md).toContain('Sisyphus');
    expect(md).toContain('11');
  });
  it('.omo/omo.jsonc is valid JSONC-ish and contains $schema + [opencode]', ()=>{
    const txt=read('.omo/omo.jsonc');
    expect(txt).toContain('$schema');
    expect(txt).toContain('[opencode]');
    expect(txt).toContain('sisyphus');
  });
  it('oh-my-openagent summary snapshot exists', ()=>{
    expect(fs.existsSync(path.join(ROOT,'docs/oh-my-openagent-summary/examples/default.jsonc'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT,'docs/oh-my-openagent-summary/omo-json-reference.md'))).toBe(true);
  });
  it('index.html has required HUD elements (crosshair, health, ammo, minimap, killfeed)', ()=>{
    const html=read('index.html');
    for(const id of ['crosshair','healthFill','ammoCount','minimap','killfeed','vignette','hitmarker']){
      expect(html).toContain(id);
    }
  });
});

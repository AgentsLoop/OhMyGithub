import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Lightweight unit tests for GLB assets and game config
describe('GLB assets', () => {
  const models = [
    { path: 'public/models/player.glb', maxKB: 200, minBytes: 1000 },
    { path: 'public/models/collectible.glb', maxKB: 200, minBytes: 1000 },
    { path: 'public/models/asteroid.glb', maxKB: 200, minBytes: 500 },
  ];
  for (const m of models) {
    it(`${m.path} exists and is lightweight`, () => {
      const full = resolve(m.path);
      expect(existsSync(full)).toBe(true);
      const s = statSync(full);
      expect(s.size).toBeGreaterThan(m.minBytes);
      expect(s.size).toBeLessThan(m.maxKB * 1024);
      const buf = readFileSync(full);
      expect(buf.subarray(0,4).toString()).toBe('glTF');
    });
  }
  it('attribution sidecars exist', () => {
    for (const m of models.slice(0,2)) {
      expect(existsSync(resolve(m.path + '.attribution.json'))).toBe(true);
      const j = JSON.parse(readFileSync(resolve(m.path + '.attribution.json'), 'utf8'));
      expect(j.license).toMatch(/CC0/);
      expect(j.glbBytes).toBeGreaterThan(500);
    }
  });
});

describe('game config invariants', () => {
  it('target score and time are reasonable', async () => {
    const src = readFileSync(resolve('src/main.js'), 'utf8');
    expect(src).toMatch(/targetScore:\s*15/);
    expect(src).toMatch(/timeLimit:\s*60/);
    expect(src).toMatch(/GLTFLoader/);
    expect(src).toMatch(/fallback/i);
  });
  it('index.html has required UI elements', () => {
    const html = readFileSync(resolve('index.html'), 'utf8');
    expect(html).toMatch(/id="overlayStart"/);
    expect(html).toMatch(/id="score"/);
    expect(html).toMatch(/id="btnPlay"/);
    expect(html).toMatch(/NEON HARVEST/);
    expect(html).toMatch(/collectible\.glb/);
  });
  it('dist build exists', () => {
    expect(existsSync(resolve('dist/index.html'))).toBe(true);
  });
});

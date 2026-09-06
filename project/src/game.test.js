import { describe, it, expect } from 'vitest';
import { createInitialState, clamp, checkCollision, levelFromGates, gapForLevel, speedForLevel, nextGapX, CONFIG, renderGameToText } from './game.js';

describe('core logic', () => {
  it('creates initial state', () => {
    const s = createInitialState();
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
    expect(s.level).toBe(1);
    expect(s.status).toBe('start');
  });
  it('clamp', () => {
    expect(clamp(5,0,10)).toBe(5);
    expect(clamp(-5,0,10)).toBe(0);
    expect(clamp(15,0,10)).toBe(10);
  });
  it('level progression', () => {
    expect(levelFromGates(0)).toBe(1);
    expect(levelFromGates(9)).toBe(1);
    expect(levelFromGates(10)).toBe(2);
    expect(levelFromGates(25)).toBe(3);
  });
  it('gap narrows with level', () => {
    expect(gapForLevel(1)).toBeGreaterThan(gapForLevel(4));
    expect(gapForLevel(7)).toBe(CONFIG.gapMin);
  });
  it('speed increases with level', () => {
    expect(speedForLevel(2)).toBeGreaterThan(speedForLevel(1));
  });
  it('collision detection', () => {
    const gate = { gapX: 260, gap: 120 };
    // centered inside gap => no collision
    expect(checkCollision(260, gate)).toBe(false);
    // near edge but inside
    expect(checkCollision(260+50, gate)).toBe(false);
    // outside gap
    expect(checkCollision(100, gate)).toBe(true);
    expect(checkCollision(400, gate)).toBe(true);
  });
  it('nextGapX stays in bounds', () => {
    for(let i=0;i<50;i++){
      const v=nextGapX(260, 120);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(CONFIG.canvasW);
    }
  });
  it('render_game_to_text deterministic', () => {
    const s = createInitialState();
    s.score=450; s.lives=2; s.level=3; s.gateCount=22; s.speed=3.5; s.status='playing';
    const t = renderGameToText(s);
    expect(t).toContain('score:450');
    expect(t).toContain('level:3');
    expect(t).toContain('playing');
  });
});

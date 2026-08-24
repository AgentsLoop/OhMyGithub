import { describe, it, expect } from 'vitest';
import { createState, moveLane, takeDamage, updateDistance, isColliding, formatSpeed } from '../src/gameLogic.js';

describe('relic runner logic', ()=>{
  it('creates initial state', ()=>{
    const s = createState();
    expect(s.distance).toBe(0);
    expect(s.lane).toBe(1);
    expect(s.hp).toBe(100);
    expect(s.maxDistance).toBe(140);
  });
  it('moves lane bounded', ()=>{
    const s = createState();
    expect(moveLane(s, -1)).toBe(0);
    expect(moveLane(s, -1)).toBe(0);
    expect(moveLane(s, 2)).toBe(2);
    expect(moveLane(s, 1)).toBe(2);
  });
  it('takes damage and marks lost at 0 hp', ()=>{
    const s = createState();
    takeDamage(s, 34); expect(s.hp).toBe(66); expect(s.lost).toBe(false);
    takeDamage(s, 34); takeDamage(s, 34); expect(s.lost).toBe(true);
  });
  it('advances distance and wins', ()=>{
    const s = createState();
    s.maxDistance = 10;
    updateDistance(s, 1);
    expect(s.distance).toBeGreaterThan(10);
    expect(s.won).toBe(true);
  });
  it('detects collision', ()=>{
    expect(isColliding(0,0,0,0)).toBe(true);
    expect(isColliding(0,0,5,0)).toBe(false);
    expect(isColliding(0,0,0.5,0.5,1.05)).toBe(true);
  });
  it('formats speed', ()=>{
    expect(formatSpeed(12)).toBe(Math.round(12*3.6));
  });
});

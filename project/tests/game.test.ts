import { describe, it, expect } from 'vitest';
import { aabb, circleRect, difficulty, createGate, playerRect, scoreForCell, scoreForGate } from '../src/game';

describe('aabb', ()=>{
  it('detects overlap', ()=>{
    expect(aabb({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10})).toBe(true);
    expect(aabb({x:0,y:0,w:10,h:10},{x:11,y:0,w:10,h:10})).toBe(false);
  });
  it('edge touching is not overlap', ()=>{
    expect(aabb({x:0,y:0,w:10,h:10},{x:10,y:0,w:10,h:10})).toBe(false);
  });
});

describe('circleRect', ()=>{
  it('inside', ()=> expect(circleRect(5,5,2,{x:0,y:0,w:10,h:10})).toBe(true));
  it('outside', ()=> expect(circleRect(20,20,2,{x:0,y:0,w:10,h:10})).toBe(false));
  it('touching edge', ()=> expect(circleRect(10,5,1,{x:0,y:0,w:10,h:10})).toBe(true));
});

describe('difficulty', ()=>{
  it('starts easy', ()=>{
    const d = difficulty(0);
    expect(d.speedMult).toBeCloseTo(1);
    expect(d.gateGap).toBe(180);
    expect(d.gateIntervalMs).toBe(1700);
  });
  it('gets harder over time', ()=>{
    const d0 = difficulty(0);
    const d60 = difficulty(60);
    expect(d60.speedMult).toBeGreaterThan(d0.speedMult);
    expect(d60.gateGap).toBeLessThan(d0.gateGap);
    expect(d60.gateIntervalMs).toBeLessThan(d0.gateIntervalMs);
  });
  it('clamps values', ()=>{
    const d = difficulty(999);
    expect(d.speedMult).toBeLessThanOrEqual(3.2);
    expect(d.gateGap).toBeGreaterThanOrEqual(92);
    expect(d.gateIntervalMs).toBeGreaterThanOrEqual(520);
  });
});

describe('createGate', ()=>{
  it('creates gate within bounds', ()=>{
    const g = createGate(960, 0);
    expect(g.x).toBeGreaterThan(960);
    expect(g.gapY).toBeGreaterThanOrEqual(24);
    expect(g.gapY + g.gapH).toBeLessThanOrEqual(540-24);
  });
  it('gap shrinks over time', ()=>{
    const g0 = createGate(960, 0);
    const gLong = createGate(960, 80);
    expect(gLong.gapH).toBeLessThanOrEqual(g0.gapH);
  });
});

describe('playerRect', ()=>{
  it('centers hitbox', ()=>{
    const r = playerRect(100,100);
    expect(r.x).toBe(84);
    expect(r.w).toBe(32);
  });
});

describe('scoring', ()=>{
  it('cell 50', ()=> expect(scoreForCell()).toBe(50));
  it('gate 10', ()=> expect(scoreForGate()).toBe(10));
});

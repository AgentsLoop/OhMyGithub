import { describe, it, expect } from 'vitest';
import { clamp, dist, circleRectCollide, lineRectIntersect, hasLineOfSight, zoneDamagePerSecond, zoneRadiusAt, computePhases, ammoAfterShot, reloadResult, lerp } from './gameLogic.js';

describe('core helpers',()=>{
  it('clamp works',()=>{ expect(clamp(5,0,10)).toBe(5); expect(clamp(-1,0,10)).toBe(0); expect(clamp(15,0,10)).toBe(10); });
  it('lerp',()=> expect(lerp(0,10,0.5)).toBe(5));
  it('dist',()=> expect(dist({x:0,y:0},{x:3,y:4})).toBe(5));
  it('circleRectCollide',()=>{
    expect(circleRectCollide(5,5,2, 0,0,10,10)).toBe(true);
    expect(circleRectCollide(20,20,2, 0,0,10,10)).toBe(false);
  });
  it('lineRectIntersect',()=>{
    expect(lineRectIntersect(0,0,10,10, 5,5,2,2)).toBe(true);
    expect(lineRectIntersect(0,0,4,0, 5,5,2,2)).toBe(false);
  });
  it('hasLineOfSight blocked',()=>{
    const obs=[{x:5,y:-1,w:2,h:2}];
    expect(hasLineOfSight(0,0,10,0,obs)).toBe(false);
    expect(hasLineOfSight(0,0,10,0,[])).toBe(true);
  });
});

describe('zone',()=>{
  it('damage inside zero',()=> expect(zoneDamagePerSecond(0,2)).toBe(0));
  it('damage outside scales',()=>{
    const d1=zoneDamagePerSecond(10,1);
    const d2=zoneDamagePerSecond(400,1);
    expect(d2>d1).toBe(true);
  });
  it('higher phase higher damage',()=>{
    expect(zoneDamagePerSecond(50,3)>zoneDamagePerSecond(50,1)).toBe(true);
  });
  it('zone radius phases interpolate',()=>{
    const phases=computePhases();
    expect(zoneRadiusAt(0,phases)).toBe(1200);
    expect(zoneRadiusAt(22,phases)).toBeGreaterThan(800);
    expect(zoneRadiusAt(22,phases)).toBeLessThan(1200);
    expect(zoneRadiusAt(100,phases)).toBe(120);
  });
});

describe('ammo',()=>{
  it('after shot decrements',()=> expect(ammoAfterShot(5)).toBe(4));
  it('reload fills correctly',()=>{
    const r=reloadResult(10,30);
    expect(r.mag).toBe(30); expect(r.reserve).toBe(10);
  });
  it('reload partial when low reserve',()=>{
    const r=reloadResult(10,5);
    expect(r.mag).toBe(15); expect(r.reserve).toBe(0);
  });
  it('reload no-op when full',()=>{
    const r=reloadResult(30,50);
    expect(r.mag).toBe(30); expect(r.reserve).toBe(50);
  });
});

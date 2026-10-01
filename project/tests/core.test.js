import { describe, it, expect } from 'vitest';
import { clamp, lerp, FlightState, updateFlight, checkCrash, formatTime, canFire, scoreForKill, damageCalc, enemyDamage, isLocked } from '../src/flightModel.js';

describe('flightModel',()=>{
  it('clamp',()=>{ expect(clamp(5,0,10)).toBe(5); expect(clamp(-1,0,10)).toBe(0); expect(clamp(15,0,10)).toBe(10); });
  it('lerp',()=>{ expect(lerp(0,10,0.5)).toBe(5); });
  it('throttle clamp low/high',()=>{
    let s=new FlightState(); s.throttle=0.5;
    let n=updateFlight(s,{throttleDelta:10},1); expect(n.throttle).toBe(1);
    n=updateFlight(s,{throttleDelta:-10},1); expect(n.throttle).toBe(0.10);
  });
  it('speed approaches target',()=>{
    let s=new FlightState(); s.speed=60; s.throttle=1;
    let n=updateFlight(s,{pitch:0},0.5);
    expect(n.speed).toBeGreaterThan(60);
    expect(n.speed).toBeLessThan(267);
  });
  it('altitude climb with pitch up',()=>{
    let s=new FlightState(); s.altitude=200; s.speed=150;
    let n=updateFlight(s,{pitch:-1},1);
    expect(n.altitude).toBeGreaterThan(200);
    let n2=updateFlight(s,{pitch:1},1);
    expect(n2.altitude).toBeLessThan(200);
  });
  it('checkCrash',()=>{ expect(checkCrash(10)).toBe(true); expect(checkCrash(100)).toBe(false); });
  it('formatTime',()=>{ expect(formatTime(65)).toBe('01:05'); expect(formatTime(120)).toBe('02:00'); expect(formatTime(0)).toBe('00:00'); });
  it('canFire cooldown',()=>{ expect(canFire(0,100,78)).toBe(true); expect(canFire(0,50,78)).toBe(false); expect(canFire(0,100)).toBe(true); });
  it('scoreForKill combo',()=>{ expect(scoreForKill(0)).toBe(100); expect(scoreForKill(4)).toBe(200); expect(scoreForKill(10)).toBe(250); });
  it('damageCalc',()=>{ expect(damageCalc(100,30)).toBe(70); expect(damageCalc(10,20)).toBe(0); });
  it('enemyDamage distance',()=>{ expect(enemyDamage(10)).toBe(22); expect(enemyDamage(30)).toBe(8); expect(enemyDamage(100)).toBe(0); });
  it('isLocked',()=>{ expect(isLocked(300,30)).toBe(true); expect(isLocked(500,30)).toBe(false); });
});

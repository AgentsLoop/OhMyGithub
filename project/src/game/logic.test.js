import { describe, it, expect } from 'vitest';
import {
  CONFIG, clamp, lerp, throttleToSpeed, speedToThrottle,
  updateHealth, addScore, canFireGun, canFireMissile, computeLockProgress, isLocked,
  dot, len, normalize, sub, dist, angleBetween, findLockTarget, checkBulletHit,
  evaluateMissionState, getNextWaveIndex, flightUpdate, createWaves, computeLeadPosition
} from './logic.js';

describe('clamp & lerp', ()=>{
  it('clamps', ()=>{ expect(clamp(5,0,10)).toBe(5); expect(clamp(-1,0,10)).toBe(0); expect(clamp(20,0,10)).toBe(10); });
  it('lerp', ()=>{ expect(lerp(0,10,0.5)).toBe(5); expect(lerp(10,20,0)).toBe(10); });
});

describe('throttleToSpeed', ()=>{
  it('maps extremes', ()=>{
    expect(throttleToSpeed(0)).toBeCloseTo(CONFIG.minSpeed,0);
    expect(throttleToSpeed(100)).toBeCloseTo(CONFIG.maxSpeed,0);
  });
  it('monotonic', ()=>{
    expect(throttleToSpeed(50)).toBeGreaterThan(throttleToSpeed(0));
    expect(throttleToSpeed(100)).toBeGreaterThan(throttleToSpeed(50));
  });
  it('roundtrip', ()=>{
    const th = 73; const sp = throttleToSpeed(th); const th2 = speedToThrottle(sp);
    expect(th2).toBeCloseTo(th,0);
  });
});

describe('health & score', ()=>{
  it('updateHealth clamps', ()=>{
    expect(updateHealth(100,30)).toBe(70);
    expect(updateHealth(10,20)).toBe(0);
    expect(updateHealth(90,-10)).toBe(100);
  });
  it('addScore', ()=>{
    expect(addScore(0,'kill')).toBe(500);
    expect(addScore(100,'hit')).toBe(125);
    expect(addScore(0,'unknown')).toBe(0);
  });
});

describe('weapons', ()=>{
  it('canFireGun respects cooldown', ()=>{
    expect(canFireGun(0,0.05,0.08)).toBe(false);
    expect(canFireGun(0,0.08,0.08)).toBe(true);
    expect(canFireGun(1,1.1,0.08)).toBe(true);
  });
  it('canFireMissile checks', ()=>{
    expect(canFireMissile({ammo:0,lastFire:0,now:10,isLocked:true}).ok).toBe(false);
    expect(canFireMissile({ammo:2,lastFire:0,now:10,isLocked:false}).reason).toBe('no_lock');
    expect(canFireMissile({ammo:2,lastFire:9.5,now:10,isLocked:true,cooldown:1.2}).reason).toBe('cooldown');
    expect(canFireMissile({ammo:2,lastFire:0,now:10,isLocked:true}).ok).toBe(true);
  });
  it('lock progress', ()=>{
    let p=0; p=computeLockProgress(p,0.5,true,1.0); expect(p).toBeCloseTo(0.5);
    p=computeLockProgress(p,0.6,true,1.0); expect(p).toBe(1);
    expect(isLocked(p)).toBe(true);
    p=computeLockProgress(p,0.5,false,1.0); expect(p).toBeLessThan(1);
  });
});

describe('vector helpers', ()=>{
  it('dot/len/normalize', ()=>{
    expect(dot({x:1,y:0,z:0},{x:0,y:1,z:0})).toBe(0);
    expect(len({x:3,y:4,z:0})).toBe(5);
    const n=normalize({x:0,y:0,z:10}); expect(n.z).toBeCloseTo(1);
  });
  it('angleBetween', ()=>{
    expect(angleBetween({x:1,y:0,z:0},{x:1,y:0,z:0})).toBeCloseTo(0);
    expect(angleBetween({x:1,y:0,z:0},{x:0,y:1,z:0})).toBeCloseTo(90);
  });
});

describe('targeting', ()=>{
  it('finds closest in cone', ()=>{
    const enemies = [
      {id:1,pos:{x:0,y:0,z:500},alive:true},
      {id:2,pos:{x:0,y:0,z:300},alive:true},
      {id:3,pos:{x:1000,y:0,z:0},alive:true},
    ];
    const t = findLockTarget(enemies,{x:0,y:0,z:0},{x:0,y:0,z:1},1000,20);
    expect(t.id).toBe(2);
  });
  it('ignores dead or out of range/angle', ()=>{
    const enemies=[{id:1,pos:{x:0,y:0,z:5000},alive:true},{id:2,pos:{x:500,y:0,z:100},alive:true},{id:3,pos:{x:0,y:0,z:400},alive:false}];
    const t=findLockTarget(enemies,{x:0,y:0,z:0},{x:0,y:0,z:1},1000,10);
    expect(t).toBeNull();
  });
  it('bullet hit', ()=>{
    expect(checkBulletHit({x:0,y:0,z:0},{x:10,y:0,z:0},28)).toBe(true);
    expect(checkBulletHit({x:0,y:0,z:0},{x:100,y:0,z:0},28)).toBe(false);
  });
});

describe('mission', ()=>{
  it('won when all dead', ()=>{
    expect(evaluateMissionState({enemiesAlive:0,totalEnemies:5,playerHealth:80,altitude:500,elapsed:10})).toBe('won');
  });
  it('lost on health', ()=>{
    expect(evaluateMissionState({enemiesAlive:3,totalEnemies:5,playerHealth:0,altitude:500,elapsed:10})).toBe('lost');
  });
  it('crashed on low altitude', ()=>{
    expect(evaluateMissionState({enemiesAlive:3,totalEnemies:5,playerHealth:80,altitude:10,elapsed:10})).toBe('crashed');
  });
  it('lost on timeout', ()=>{
    expect(evaluateMissionState({enemiesAlive:2,totalEnemies:5,playerHealth:80,altitude:500,elapsed:200,timeLimit:150})).toBe('lost');
  });
  it('playing otherwise', ()=>{
    expect(evaluateMissionState({enemiesAlive:2,totalEnemies:5,playerHealth:80,altitude:500,elapsed:10})).toBe('playing');
  });
  it('waves', ()=>{
    expect(getNextWaveIndex(0,3)).toBe(1);
    expect(getNextWaveIndex(2,3)).toBe(-1);
    const w=createWaves(7); const sum=w.reduce((a,c)=>a+c.count,0); expect(sum).toBe(7);
  });
});

describe('flightUpdate', ()=>{
  it('throttle clamps and moves', ()=>{
    let s={pitch:0,roll:0,yaw:0,throttle:50,speed:150,pos:{x:0,y:500,z:0},vel:{x:0,y:0,z:150}};
    s=flightUpdate(s,{pitch:1,roll:0,yaw:0,throttleDelta:1},0.1);
    expect(s.pitch).toBeGreaterThan(0);
    expect(s.throttle).toBeGreaterThan(50);
    expect(s.pos.z).toBeDefined();
  });
  it('roll auto levels', ()=>{
    let s={pitch:0,roll:30,yaw:0,throttle:50,speed:150,pos:{x:0,y:500,z:0},vel:{x:0,y:0,z:150}};
    s=flightUpdate(s,{pitch:0,roll:0,yaw:0,throttleDelta:0},0.5);
    expect(Math.abs(s.roll)).toBeLessThan(30);
  });
  it('keeps within world and altitude', ()=>{
    let s={pitch:90,roll:0,yaw:0,throttle:100,speed:400,pos:{x:0,y:10,z:0},vel:{x:0,y:0,z:400}};
    s=flightUpdate(s,{pitch:0,roll:0,yaw:0,throttleDelta:0},0.1);
    expect(s.pos.y).toBeGreaterThan(CONFIG.crashAltitude);
  });
});

describe('lead position', ()=>{
  it('predicts forward', ()=>{
    const lead=computeLeadPosition({x:0,y:0,z:1000},{x:100,y:0,z:0},{x:0,y:0,z:0},500);
    expect(lead.x).toBeGreaterThan(0);
    expect(lead.z).toBeCloseTo(1000,0);
  });
});

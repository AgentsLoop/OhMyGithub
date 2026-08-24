import { describe, it, expect } from 'vitest';
import { isInAttackCone, waveEnemyCount } from '../game.js';

describe('Gauntlet Loop core', ()=>{
  it('wave scaling', ()=>{
    expect(waveEnemyCount(1)).toBe(5);
    expect(waveEnemyCount(2)).toBe(7);
    expect(waveEnemyCount(5)).toBe(13);
    expect(waveEnemyCount(10)).toBe(18);
    expect(waveEnemyCount(99)).toBe(18);
  });
  it('attack cone detects', ()=>{
    const cone = 120*Math.PI/180;
    // facing right (0)
    expect(isInAttackCone(0,0,0, 50,0,68,cone)).toBe(true);
    expect(isInAttackCone(0,0,0, -50,0,68,cone)).toBe(false);
    expect(isInAttackCone(0,0,0, 30,30,68,cone)).toBe(true);
    expect(isInAttackCone(0,0,0, 10,0,68,cone)).toBe(true); // close omnidirectional
    expect(isInAttackCone(0,0,0, 200,0,68,cone)).toBe(false); // out of range
  });
  it('close range hits regardless of angle',()=>{
    const cone = 120*Math.PI/180;
    expect(isInAttackCone(0,0,0, -10,0,68,cone)).toBe(true);
  });
});

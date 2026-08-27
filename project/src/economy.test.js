import { describe, it, expect } from 'vitest';
import { canAfford, pay, miningTick } from './economy.js';
import { COST } from './gameConfig.js';

describe('S2 insufficient resources', ()=>{
  it('blocks barracks when minerals 0', ()=>{
    const res={minerals:0, gas:0, supplyUsed:0, supplyCap:10};
    expect(canAfford(res, COST.barracks)).toBe(false);
    expect(pay(res, COST.barracks)).toBe(false);
    expect(res.minerals).toBe(0);
  });
  it('allows barracks at 600 minerals', ()=>{
    const res={minerals:600, gas:0, supplyUsed:0, supplyCap:10};
    expect(canAfford(res, COST.barracks)).toBe(true);
    expect(pay(res, COST.barracks)).toBe(true);
    expect(res.minerals).toBe(450);
  });
  it('blocks due to supply cap', ()=>{
    const res={minerals:600, gas:0, supplyUsed:10, supplyCap:10};
    expect(canAfford(res, COST.marine)).toBe(false);
  });
});
describe('S5 mining loop', ()=>{
  it('mines 8 per tick and depletes field', ()=>{
    const field={amount:20};
    expect(miningTick(field,0)).toBe(8);
    expect(field.amount).toBe(12);
    expect(miningTick(field,0)).toBe(8);
    expect(miningTick(field,0)).toBe(4);
    expect(field.amount).toBe(0);
  });
  it('handles gas geyser similarly', ()=>{
    const g={amount:2000}; const a=miningTick(g,0); expect(a).toBe(8); expect(g.amount).toBe(1992);
  });
});

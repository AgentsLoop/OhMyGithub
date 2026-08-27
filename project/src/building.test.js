import { describe, it, expect } from 'vitest';
import { canPlace, isInsideMap, footprintCollides } from './building.js';

describe('S3 placement collision & bounds', ()=>{
  it('blocks overlapping placement', ()=>{
    const existing=[{x:0,z:0,size:4}];
    expect(footprintCollides({x:1,z:0},4,existing)).toBe(true);
    expect(canPlace({x:1,z:0},4,existing)).toBe(false);
  });
  it('allows distant placement', ()=>{
    const existing=[{x:0,z:0,size:4}];
    expect(canPlace({x:10,z:10},4,existing)).toBe(true);
  });
  it('blocks outside map', ()=>{
    expect(isInsideMap(49,0,4)).toBe(false);
    expect(isInsideMap(0,0,4)).toBe(true);
    expect(canPlace({x:60,z:60},4,[])).toBe(false);
  });
  it('ghost color helper conceptual (green when can, red when cannot)', ()=>{
    expect(canPlace({x:0,z:0},4,[])).toBe(true);
    expect(canPlace({x:0,z:0},4,[{x:0,z:0,size:6}])).toBe(false);
  });
});
describe('S1 happy placement', ()=>{
  it('happy path place succeeds inside and not colliding', ()=>{
    expect(canPlace({x:5,z:-12},4,[])).toBe(true);
  });
});

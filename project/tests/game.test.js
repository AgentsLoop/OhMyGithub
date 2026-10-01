import { describe, it, expect } from 'vitest';
import { canPickup, shipZone, nextObjective, isWin } from '../src/gameLogic.js';

describe('pirate treasure logic', ()=>{
  it('pickup within radius',()=>{ expect(canPickup({x:0,z:0},{x:2,z:0})).toBe(true); expect(canPickup({x:0,z:0},{x:10,z:0})).toBe(false); });
  it('ship zone',()=>{ expect(shipZone({x:0,z:28},{x:0,z:30})).toBe(true); expect(shipZone({x:20,z:20},{x:0,z:30})).toBe(false); });
  it('objective strings',()=>{ expect(nextObjective(0,false)).toMatch(/Find chest 1/); expect(nextObjective(3,false)).toMatch(/Return to your ship/); expect(nextObjective(3,true)).toMatch(/Victory/); });
  it('win condition',()=>{ expect(isWin(3,true)).toBe(true); expect(isWin(2,true)).toBe(false); expect(isWin(3,false)).toBe(false); });
});

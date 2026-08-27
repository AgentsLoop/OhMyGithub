import { describe, it, expect } from 'vitest';
import { isRevealed } from './fog.js';
describe('Fog of War S4 regression', ()=>{
  it('reveals around friendly unit', ()=>{
    const revealed = isRevealed(5,5, [{x:0,z:0, vision:12}]);
    expect(revealed).toBe(true);
  });
  it('hides far from friendlies', ()=>{
    const revealed = isRevealed(50,50, [{x:0,z:0, vision:12}]);
    expect(revealed).toBe(false);
  });
});

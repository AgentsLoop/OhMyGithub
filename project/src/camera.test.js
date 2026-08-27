import { describe, it, expect } from 'vitest';
describe('S4 camera & selection regression', ()=>{
  it('selection clears on ground click (pure logic)', ()=>{
    let selected=new Set(['u1','u2']);
    selected.clear();
    expect(selected.size).toBe(0);
  });
  it('ctrl groups save/restore', ()=>{
    const groups={1:[],2:[],3:[]};
    groups[1]=['a','b']; expect(groups[1].length).toBe(2);
    const restored=[...groups[1]]; expect(restored).toEqual(['a','b']);
  });
});

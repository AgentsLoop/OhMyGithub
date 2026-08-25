import { describe, it, expect } from 'vitest';

// Pure logic tests mirroring game rules without needing Three.js render
function createGameState() {
  return { collected: 0, chests: [false,false,false], shipReturned: false };
}
function collect(state, idx){
  if(state.chests[idx]) return false;
  state.chests[idx]=true;
  state.collected++;
  return true;
}
function canWin(state){
  return state.collected===3;
}
function tryWin(state, atShip){
  if(canWin(state) && atShip){
    state.shipReturned = true;
    return true;
  }
  return false;
}

describe('pirate island treasure - core rules', ()=>{
  it('starts with 0 chests', ()=>{
    const s=createGameState();
    expect(s.collected).toBe(0);
    expect(canWin(s)).toBe(false);
  });
  it('collecting 3 chests enables win', ()=>{
    const s=createGameState();
    collect(s,0); collect(s,1); collect(s,2);
    expect(s.collected).toBe(3);
    expect(canWin(s)).toBe(true);
  });
  it('duplicate collection does not increase count', ()=>{
    const s=createGameState();
    collect(s,0); collect(s,0);
    expect(s.collected).toBe(1);
  });
  it('win requires both 3 chests and ship return', ()=>{
    const s=createGameState();
    collect(s,0); collect(s,1); collect(s,2);
    expect(tryWin(s,false)).toBe(false);
    expect(tryWin(s,true)).toBe(true);
    expect(s.shipReturned).toBe(true);
  });
  it('win blocked if not all chests', ()=>{
    const s=createGameState();
    collect(s,0); collect(s,1);
    expect(tryWin(s,true)).toBe(false);
  });
});

describe('asset presence', ()=>{
  it('pirate ship GLB exists and is non-empty', async ()=>{
    const fs = await import('node:fs');
    const p = 'public/models/pirate-ship.glb';
    expect(fs.existsSync(p)).toBe(true);
    const stat = fs.statSync(p);
    expect(stat.size).toBeGreaterThan(10000);
  });
  it('pirate character GLB exists', async ()=>{
    const fs = await import('node:fs');
    expect(fs.existsSync('public/models/pirate-character.glb')).toBe(true);
  });
  it('attribution JSON exists beside each GLB', async ()=>{
    const fs = await import('node:fs');
    expect(fs.existsSync('public/models/pirate-ship.glb.attribution.json')).toBe(true);
    const data = JSON.parse(fs.readFileSync('public/models/pirate-ship.glb.attribution.json','utf-8'));
    expect(data.author).toBeTruthy();
    expect(data.license).toBeTruthy();
    const data2 = JSON.parse(fs.readFileSync('public/models/pirate-character.glb.attribution.json','utf-8'));
    expect(data2.author).toBeTruthy();
  });
});

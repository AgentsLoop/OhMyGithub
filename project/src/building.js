import { MAP_SIZE } from './gameConfig.js';
export function isInsideMap(x,z, size=4){
  const half = MAP_SIZE/2 - size/2 - 1;
  return x>=-half && x<=half && z>=-half && z<=half;
}
export function footprintCollides(pos, size, buildings){
  for(const b of buildings){
    const dx = Math.abs(b.x - pos.x);
    const dz = Math.abs(b.z - pos.z);
    const min = (b.size + size)/2 + 0.5;
    if(dx < min && dz < min) return true;
  }
  return false;
}
export function canPlace(pos, size, buildings){
  if(!isInsideMap(pos.x, pos.z, size)) return false;
  if(footprintCollides(pos,size,buildings)) return false;
  return true;
}
export function ghostColor(can){ return can ? 0x4caf50 : 0xe53935; }

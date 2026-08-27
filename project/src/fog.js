export function isRevealed(x,z, friendlies){
  for(const f of friendlies){
    const d=Math.hypot(f.x - x, f.z - z);
    if(d <= (f.vision||12)) return true;
  }
  return false;
}

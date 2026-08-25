// Pure logic for testing — no Three.js
export function distance2D(a,b){ return Math.hypot(a.x-b.x, a.z-b.z); }
export function canPickup(playerPos, chestPos, radius=3.2){ return distance2D(playerPos, chestPos) <= radius; }
export function shipZone(playerPos, shipPos, radius=6){ return distance2D(playerPos, shipPos) <= radius; }
export function nextObjective(collected, atShip){
  if(collected < 3) return `Find chest ${collected+1} of 3 — ${3-collected} remaining`;
  if(!atShip) return `All 3 chests! Return to your ship at the south dock!`;
  return `Victory! You escaped with the plunder!`;
}
export function isWin(collected, atShip){ return collected===3 && atShip; }

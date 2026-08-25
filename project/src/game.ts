export type Rect = { x:number; y:number; w:number; h:number };
export type Vec = { x:number; y:number };

export function clamp(v:number, lo:number, hi:number){ return Math.max(lo, Math.min(hi, v)); }

export function aabb(a:Rect, b:Rect){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRect(cx:number, cy:number, r:number, rect:Rect){
  const closestX = clamp(cx, rect.x, rect.x + rect.w);
  const closestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx*dx + dy*dy <= r*r;
}

// Difficulty curves - pure and testable
export function difficulty(timeSec:number){
  // timeSec = seconds survived
  const speedMult = clamp(1 + timeSec * 0.035, 1, 3.2);
  const gateGap = clamp(180 - timeSec * 1.8, 92, 180); // px gap between laser bars
  const gateIntervalMs = clamp(1700 - timeSec * 22, 520, 1700);
  const cellChance = clamp(0.62 + timeSec * 0.004, 0.62, 0.85);
  return { speedMult, gateGap, gateIntervalMs, cellChance };
}

export function baseGateSpeed(){ return 220; } // px/s base

export type Gate = {
  x:number;
  gapY:number;
  gapH:number;
  w:number;
  passed:boolean;
};

export type Cell = { x:number; y:number; r:number; collected:boolean; pulse:number };

export function createGate(canvasW:number, timeSec:number):Gate{
  const { gateGap } = difficulty(timeSec);
  const margin = 24;
  const gapH = gateGap;
  const gapY = margin + Math.random() * (540 - margin*2 - gapH);
  return { x: canvasW + 40, gapY, gapH, w: 28, passed:false };
}

export function createCell(gate:Gate|null, canvasW:number, canvasH:number):Cell | null{
  // place near gate gap or random
  if (gate && Math.random() < 0.7){
    return { x: gate.x + gate.w/2 + (Math.random()*30-15), y: gate.gapY + gate.gapH/2 + (Math.random()*60-30), r: 12, collected:false, pulse: Math.random()*Math.PI*2 };
  }
  if (Math.random() < 0.35){
    return { x: canvasW + 20, y: 40 + Math.random()*(canvasH-80), r:12, collected:false, pulse:0 };
  }
  return null;
}

export function playerRect(x:number, y:number){
  // drone 36x22 with slight hitbox reduction for fairness
  return { x: x-16, y: y-10, w:32, h:20 } as Rect;
}

export function scoreForCell(){ return 50; }
export function scoreForGate(){ return 10; }

export function lerp(a:number,b:number,t:number){ return a + (b-a)*t; }

// Pure logic helpers — testable without DOM
export function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
export function lerp(a,b,t){ return a + (b-a)*t; }
export function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
export function dist2(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
export function angleBetween(ax,ay,bx,by){ return Math.atan2(by-ay, bx-ax); }

// Circle-rect collision: circle at cx,cy,r vs rect x,y,w,h
export function circleRectCollide(cx,cy,r, rx,ry,rw,rh){
  const closestX = clamp(cx, rx, rx+rw);
  const closestY = clamp(cy, ry, ry+rh);
  const dx = cx-closestX;
  const dy = cy-closestY;
  return (dx*dx+dy*dy) < r*r;
}
export function lineSegmentIntersect(ax,ay,bx,by, cx,cy,dx,dy){
  // segments AB vs CD
  const den = (ax-bx)*(cy-dy) - (ay-by)*(cx-dx);
  if(Math.abs(den) < 1e-9) return false;
  const t = ((ax-cx)*(cy-dy) - (ay-cy)*(cx-dx))/den;
  const u = ((ax-cx)*(ay-by) - (ay-cy)*(ax-bx))/den;
  return t>=0 && t<=1 && u>=0 && u<=1;
}
export function lineRectIntersect(ax,ay,bx,by, rx,ry,rw,rh){
  const edges = [
    [rx,ry,rx+rw,ry],
    [rx+rw,ry,rx+rw,ry+rh],
    [rx+rw,ry+rh,rx,ry+rh],
    [rx,ry+rh,rx,ry]
  ];
  for(const [cx,cy,dx,dy] of edges){
    if(lineSegmentIntersect(ax,ay,bx,by,cx,cy,dx,dy)) return true;
  }
  // inside rect
  if(bx>=rx && bx<=rx+rw && by>=ry && by<=ry+rh) return true;
  return false;
}
// LOS blocked check
export function hasLineOfSight(ax,ay,bx,by, obstacles){
  for(const o of obstacles){
    if(lineRectIntersect(ax,ay,bx,by, o.x,o.y,o.w,o.h)) return false;
  }
  return true;
}
// Zone logic
export function zoneDamagePerSecond(distanceOutside, phase){
  // phase 0..4
  if(distanceOutside <= 0) return 0;
  const base = [0, 6, 10, 16, 26][phase] ?? 26;
  // scale with how far outside (up to 2x at 400 outside)
  const mult = clamp(1 + distanceOutside/400, 1, 2);
  return base * mult;
}
export function zoneRadiusAt(time, phases){
  // phases: array of {t0,t1,r0,r1}
  for(const p of phases){
    if(time >= p.t0 && time <= p.t1){
      const tt = (time - p.t0)/(p.t1-p.t0);
      return lerp(p.r0, p.r1, tt);
    }
    if(time < p.t0) return p.r0;
  }
  return phases[phases.length-1].r1;
}
export function computePhases(totalTime=90){
  // 5 phases: stable then shrink
  // Phase 0: 0-12s stable 1200->1200
  // Phase1: 12-32 shrink 1200->800
  // Phase2: 32-52 shrink 800->500
  // Phase3: 52-72 shrink 500->260
  // Phase4: 72-90 shrink 260->120
  return [
    {t0:0, t1:12, r0:1200, r1:1200},
    {t0:12, t1:32, r0:1200, r1:800},
    {t0:32, t1:52, r0:800, r1:500},
    {t0:52, t1:72, r0:500, r1:260},
    {t0:72, t1:90, r0:260, r1:120},
  ];
}
export function ammoCanShoot(mag, reloading){ return mag>0 && !reloading; }
export function ammoAfterShot(mag){ return Math.max(0, mag-1); }
export function reloadResult(mag, reserve){
  const need = 30 - mag;
  if(need<=0 || reserve<=0) return {mag, reserve, reloaded:0};
  const take = Math.min(need, reserve);
  return {mag: mag+take, reserve: reserve-take, reloaded:take};
}

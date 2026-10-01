// Pure flight math for tests — no Three dependency
export function clamp(v,min,max){return Math.max(min, Math.min(max,v));}
export function lerp(a,b,t){return a+(b-a)*t;}

export class FlightState{
  constructor(){
    this.throttle=0.5;
    this.speed=120; // knots conceptual
    this.altitude=320; // feet
    this.health=100;
    this.score=0;
    this.kills=0;
  }
}

// Compute new state given inputs and dt. Pure function for testing — synced to game.js runtime (throttle 0.10-1, speed 62+throttle*205)
export function updateFlight(state, inputs, dt){
  // inputs: {pitch, roll, yaw, throttleDelta}
  const s = {...state};
  s.throttle = clamp(s.throttle + (inputs.throttleDelta||0)*dt*0.55, 0.10, 1);
  const targetSpeed = 62 + s.throttle*205; // 62..267 matches game.js
  s.speed = lerp(s.speed, targetSpeed, dt*1.2);
  // altitude change from pitch (simplified): pitch -1..1
  const pitch = clamp(inputs.pitch||0,-1,1);
  const climbRate = -pitch * s.speed * 0.9; // pitch up = climb
  s.altitude = Math.max(12, s.altitude + climbRate*dt);
  // health doesn't change here
  return s;
}

export function checkCrash(altitude){
  return altitude < 18;
}

export function formatTime(sec){
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = (sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

export function canFire(lastFire, now, cooldown=78){
  return (now - lastFire) >= cooldown;
}

export function scoreForKill(combo){
  return 100 + Math.min(150, combo*25);
}

export function damageCalc(hp, dmg){
  return Math.max(0, hp - dmg);
}

// enemy helpers
export function enemyDamage(distance){
  // closer = more damage if colliding
  if(distance < 18) return 22;
  if(distance < 35) return 8;
  return 0;
}

export function isLocked(targetDist, reticleRadius=42){
  // simplified lock if target near center and within range
  return targetDist < 420 && reticleRadius < 50;
}

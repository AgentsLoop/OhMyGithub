// Pure game logic for SkyStrike Ace - testable without Three.js
export const CONFIG = {
  minSpeed: 35,
  maxSpeed: 420,
  minThrottle: 0,
  maxThrottle: 100,
  gunCooldown: 0.08,
  missileCooldown: 1.2,
  missileAmmo: 6,
  missileSpeed: 520,
  bulletSpeed: 900,
  lockAngleDeg: 18,
  lockDistance: 2400,
  lockTime: 1.1,
  hitRadius: 28,
  enemyHP: 100,
  playerHP: 100,
  gunDamage: 14,
  missileDamage: 100,
  timeLimit: 150, // 2.5 min
  stallSpeed: 55,
  crashAltitude: 20,
  worldRadius: 6000,
};

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function lerp(a,b,t){ return a + (b-a)*t; }

export function throttleToSpeed(throttle){
  // 0-> CONFIG.minSpeed, 100-> CONFIG.maxSpeed, non-linear slightly
  const t = clamp(throttle,0,100)/100;
  return lerp(CONFIG.minSpeed, CONFIG.maxSpeed, Math.pow(t, 1.05));
}
export function speedToThrottle(speed){
  const t = (clamp(speed, CONFIG.minSpeed, CONFIG.maxSpeed)-CONFIG.minSpeed)/(CONFIG.maxSpeed-CONFIG.minSpeed);
  return Math.pow(t, 1/1.05)*100;
}

export function updateHealth(health, damage){
  return clamp(health - damage, 0, 100);
}
export function addScore(score, type){
  const table = { kill: 500, hit: 25, missile_hit: 300, wave: 250 };
  return score + (table[type] ?? 0);
}

export function canFireGun(lastFire, now, cooldown = CONFIG.gunCooldown){
  return (now - lastFire) >= cooldown;
}
export function canFireMissile({ ammo, lastFire, now, isLocked, cooldown = CONFIG.missileCooldown }){
  if (ammo <= 0) return { ok:false, reason:'no_ammo' };
  if (!isLocked) return { ok:false, reason:'no_lock' };
  if ((now - lastFire) < cooldown) return { ok:false, reason:'cooldown' };
  return { ok:true, reason:'ready' };
}

export function computeLockProgress(progress, dt, hasTarget, lockTime = CONFIG.lockTime){
  if (!hasTarget) return Math.max(0, progress - dt*1.8);
  return clamp(progress + dt / lockTime, 0, 1);
}
export function isLocked(progress){ return progress >= 1 - 1e-6; }

// vector helpers plain objects {x,y,z}
export function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
export function len(v){ return Math.hypot(v.x, v.y, v.z); }
export function normalize(v){
  const l = len(v) || 1; return { x:v.x/l, y:v.y/l, z:v.z/l };
}
export function sub(a,b){ return { x:a.x-b.x, y:a.y-b.y, z:a.z-b.z }; }
export function dist(a,b){ return len(sub(a,b)); }
export function angleBetween(a,b){
  const da = normalize(a), db = normalize(b);
  const d = clamp(dot(da,db), -1, 1);
  return Math.acos(d) * 180 / Math.PI;
}

export function findLockTarget(enemies, playerPos, playerForward, maxDist = CONFIG.lockDistance, maxAngle = CONFIG.lockAngleDeg){
  // enemies: [{id, pos:{x,y,z}, alive}]
  let best = null;
  let bestScore = Infinity;
  const fwd = normalize(playerForward);
  for (const e of enemies){
    if (!e.alive) continue;
    const to = sub(e.pos, playerPos);
    const d = len(to);
    if (d > maxDist) continue;
    const ang = angleBetween(fwd, to);
    if (ang > maxAngle) continue;
    // score favors closer + more centered
    const score = d * 0.6 + ang * 18;
    if (score < bestScore){ bestScore = score; best = e; }
  }
  return best;
}

export function checkBulletHit(bulletPos, targetPos, radius = CONFIG.hitRadius){
  return dist(bulletPos, targetPos) <= radius;
}

export function evaluateMissionState({ enemiesAlive, totalEnemies, playerHealth, altitude, elapsed, timeLimit = CONFIG.timeLimit }){
  if (playerHealth <= 0) return 'lost';
  if (altitude <= CONFIG.crashAltitude) return 'crashed';
  if (elapsed >= timeLimit) return 'lost';
  if (totalEnemies > 0 && enemiesAlive === 0) return 'won';
  return 'playing';
}

export function getNextWaveIndex(currentWave, totalWaves){
  if (currentWave + 1 >= totalWaves) return -1;
  return currentWave + 1;
}

export function flightUpdate(state, inputs, dt){
  // state: { pitch, roll, yaw, throttle, speed, pos:{x,y,z}, vel:{x,y,z}}
  // inputs: { pitch: -1..1, roll: -1..1, yaw: -1..1, throttleDelta: -1..1 }
  const s = { ...state, pos:{...state.pos}, vel:{...state.vel} };
  // angular rates degrees per second
  const pitchRate = 62, rollRate = 92, yawRate = 42;
  s.pitch = clamp(s.pitch + inputs.pitch * pitchRate * dt, -88, 88);
  s.roll = clamp(s.roll + inputs.roll * rollRate * dt, -85, 85);
  // auto level roll when no input
  if (Math.abs(inputs.roll) < 0.02) s.roll = lerp(s.roll, 0, dt*1.1);
  if (Math.abs(inputs.pitch) < 0.02) s.pitch = lerp(s.pitch, 0, dt*0.9);
  s.yaw += inputs.yaw * yawRate * dt;

  s.throttle = clamp(s.throttle + (inputs.throttleDelta||0) * 38 * dt, CONFIG.minThrottle, CONFIG.maxThrottle);
  const targetSpeed = throttleToSpeed(s.throttle);
  // speed lags behind throttle
  s.speed = lerp(s.speed, targetSpeed, dt*1.6);
  // gravity effect when pitch up
  const pitchRad = s.pitch * Math.PI/180;
  s.speed = clamp(s.speed - Math.sin(pitchRad) * 9 * dt, CONFIG.minSpeed*0.6, CONFIG.maxSpeed);
  // stall penalty
  if (s.speed < CONFIG.stallSpeed){
    s.pitch = lerp(s.pitch, -8, dt*0.7);
  }
  // compute forward vector from Euler (yaw, pitch, roll) simplified yaw+ pitch
  const yawRad = s.yaw * Math.PI/180;
  const forward = {
    x: Math.sin(yawRad) * Math.cos(pitchRad),
    y: Math.sin(pitchRad),
    z: Math.cos(yawRad) * Math.cos(pitchRad),
  };
  // integrate position
  s.pos.x += forward.x * s.speed * dt;
  s.pos.y += forward.y * s.speed * dt;
  s.pos.z += forward.z * s.speed * dt;

  // keep within world radius horizontally, wrap or clamp
  const horiz = Math.hypot(s.pos.x, s.pos.z);
  if (horiz > CONFIG.worldRadius){
    const scale = CONFIG.worldRadius / horiz;
    s.pos.x *= scale; s.pos.z *= scale;
  }
  // altitude clamp
  s.pos.y = clamp(s.pos.y, CONFIG.crashAltitude+1, 2800);
  s.vel = { x: forward.x*s.speed, y: forward.y*s.speed, z: forward.z*s.speed };
  return s;
}

export function createWaves(total = 7){
  // returns array of wave configs
  const waves = [
    { id:0, count:2, pattern:'line', radius:900 },
    { id:1, count:3, pattern:'vee', radius:1200 },
    { id:2, count:2, pattern:'pair', radius:900 },
  ];
  let sum = waves.reduce((a,w)=>a+w.count,0);
  // if total larger, add extra wave
  if (sum < total){
    waves.push({ id:3, count: total - sum, pattern:'swarm', radius:1400 });
  }
  return waves;
}

export function computeLeadPosition(targetPos, targetVel, shooterPos, projectileSpeed){
  // simple lead: time = distance / speed, predict
  const to = sub(targetPos, shooterPos);
  const d = len(to);
  const t = d / projectileSpeed;
  return {
    x: targetPos.x + targetVel.x * t * 0.7,
    y: targetPos.y + targetVel.y * t * 0.7,
    z: targetPos.z + targetVel.z * t * 0.7,
  };
}

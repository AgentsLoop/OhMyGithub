// Neon Courier — 2D Canvas Game (seeded randomization edition)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const elScore = document.getElementById('score');
const elBeacons = document.getElementById('beacons');
const elTimer = document.getElementById('timer');
const elStatus = document.getElementById('status');
const overlayStart = document.getElementById('overlay-start');
const overlayPause = document.getElementById('overlay-pause');
const overlayEnd = document.getElementById('overlay-end');
const elEndTitle = document.getElementById('end-title');
const elEndMsg = document.getElementById('end-msg');
const elEndScore = document.getElementById('end-score');
const elEndTime = document.getElementById('end-time');
const elEndBeacons = document.getElementById('end-beacons');

const W = 960, H = 640;
const PLAYER_R = 14;
const BEACON_R = 12;
const PULSE_R = 18;
const EXIT_W = 80, EXIT_H = 100;
const GAME_TIME = 60;
const BEACON_COUNT = 5;
const PULSE_COUNT = 6;

// --- Seeded randomization system ---
let currentSeed = (Date.now() & 0xffffffff) >>> 0;
if (currentSeed === 0) currentSeed = 123456789;

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(currentSeed);

function seededRand(a, b) { return rng() * (b - a) + a; }
function seededRandInt(a, b) { return Math.floor(rng() * (b - a + 1)) + a; }

function generateNewSeed() {
  // Use Date.now() mixed with Math.random for strong variety
  const t = Date.now() >>> 0;
  const r = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
  currentSeed = (t ^ r ^ Math.floor(Math.random() * 1e9)) >>> 0;
  if (currentSeed === 0) currentSeed = 0x9E3779B9;
  rng = mulberry32(currentSeed);
  updateSeedDisplay();
}

function setSeed(newSeed) {
  currentSeed = newSeed >>> 0;
  if (currentSeed === 0) currentSeed = 1;
  rng = mulberry32(currentSeed);
  updateSeedDisplay();
}

function updateSeedDisplay() {
  const el = document.getElementById('seed-value');
  if (el) el.textContent = String(currentSeed);
  const el2 = document.getElementById('seed-value-start');
  if (el2) el2.textContent = String(currentSeed);
  const el3 = document.getElementById('seed-card-value');
  if (el3) el3.textContent = String(currentSeed);
}

// expose currentSeed globally for debugging/tests
let state = 'start'; // start, playing, paused, won, lost
let score = 0;
let timeLeft = GAME_TIME;
let beacons = [];
let pulses = [];
let particles = [];
let floaters = []; // +100 / -50 floating text
let trail = []; // drone trail positions
let shake = 0;
let hitFlash = 0;
let exit = { x: W-90, y: H/2-50, open:false };
let drone = { x: 80, y: H/2, vx:0, vy:0, angle:0, hitCooldown:0, shieldTime:0 };

const keys = new Set();
let touchDir = {x:0, y:0};

function rand(a,b){ return Math.random()*(b-a)+a; }

// power-ups: shield (temporary invuln, cyan) and time bonus (+5s, yellow)
let powerUps = [];
let powerUpTimer = 0;
let nextSpawnInterval = 9;

const POWERUP_R = 13;

// walls — multiple layout variants (randomly pick one per game)
const WALL_VARIANTS = [
  // Variant 0 — original dense maze
  [
    {x:0,y:0,w:W,h:10},
    {x:0,y:H-10,w:W,h:10},
    {x:0,y:0,w:10,h:H},
    {x:W-10,y:0,w:10,h:H},
    {x:150,y:90,w:180,h:14},
    {x:420,y:50,w:14,h:130},
    {x:520,y:120,w:190,h:14},
    {x:740,y:90,w:14,h:140},
    {x:100,y:200,w:14,h:120},
    {x:190,y:300,w:180,h:14},
    {x:470,y:200,w:14,h:120},
    {x:390,y:250,w:140,h:14},
    {x:600,y:290,w:160,h:14},
    {x:160,y:400,w:14,h:100},
    {x:120,y:460,w:180,h:14},
    {x:380,y:400,w:160,h:14},
    {x:620,y:400,w:14,h:130},
    {x:420,y:520,w:260,h:14},
    {x:800,y:380,w:14,h:150},
    {x:40,y:380,w:90,h:14},
  ],
  // Variant 1 — open grid (sparse, faster lanes)
  [
    {x:0,y:0,w:W,h:10},
    {x:0,y:H-10,w:W,h:10},
    {x:0,y:0,w:10,h:H},
    {x:W-10,y:0,w:10,h:H},
    {x:180,y:100,w:220,h:14},
    {x:550,y:80,w:14,h:180},
    {x:120,y:280,w:240,h:14},
    {x:500,y:320,w:240,h:14},
    {x:200,y:440,w:14,h:120},
    {x:380,y:480,w:300,h:14},
    {x:760,y:300,w:14,h:170},
    {x:60,y:400,w:110,h:14},
    {x:400,y:170,w:14,h:100},
    {x:650,y:130,w:140,h:14},
  ],
  // Variant 2 — canyon vertical channels
  [
    {x:0,y:0,w:W,h:10},
    {x:0,y:H-10,w:W,h:10},
    {x:0,y:0,w:10,h:H},
    {x:W-10,y:0,w:10,h:H},
    {x:140,y:70,w:14,h:180},
    {x:140,y:70,w:220,h:14},
    {x:500,y:50,w:210,h:14},
    {x:700,y:50,w:14,h:170},
    {x:100,y:340,w:260,h:14},
    {x:450,y:260,w:14,h:210},
    {x:620,y:360,w:210,h:14},
    {x:620,y:360,w:14,h:170},
    {x:180,y:500,w:230,h:14},
    {x:750,y:300,w:14,h:150},
    {x:360,y:140,w:14,h:90},
    {x:760,y:200,w:100,h:14},
  ],
  // Variant 3 — fragmented blocks (extra variety)
  [
    {x:0,y:0,w:W,h:10},
    {x:0,y:H-10,w:W,h:10},
    {x:0,y:0,w:10,h:H},
    {x:W-10,y:0,w:10,h:H},
    {x:130,y:110,w:160,h:14},
    {x:360,y:70,w:14,h:150},
    {x:500,y:90,w:170,h:14},
    {x:720,y:100,w:14,h:200},
    {x:110,y:260,w:14,h:110},
    {x:180,y:340,w:150,h:14},
    {x:430,y:270,w:180,h:14},
    {x:620,y:220,w:14,h:120},
    {x:140,y:430,w:14,h:110},
    {x:100,y:480,w:200,h:14},
    {x:400,y:430,w:140,h:14},
    {x:640,y:430,w:14,h:130},
    {x:460,y:540,w:220,h:14},
    {x:800,y:400,w:14,h:120},
  ],
];

let walls = WALL_VARIANTS[0].map(w=>({...w}));
let wallVariantIndex = 0;

function rectCollideCircle(rx,ry,rw,rh, cx,cy, r){
  const nx = Math.max(rx, Math.min(cx, rx+rw));
  const ny = Math.max(ry, Math.min(cy, ry+rh));
  const dx=cx-nx, dy=cy-ny;
  return dx*dx+dy*dy < r*r;
}

function beaconOverlapsWalls(x,y){
  for(const w of walls){
    if(rectCollideCircle(w.x,w.y,w.w,w.h, x,y, BEACON_R+10)) return true;
  }
  return false;
}

function resetGame(){
  // deterministic reseed — reproducible per seed
  rng = mulberry32(currentSeed);
  score = 0;
  timeLeft = GAME_TIME;
  beacons = [];
  pulses = [];
  particles = [];
  floaters = [];
  trail = [];
  shake = 0;
  hitFlash = 0;
  drone = { x: 80, y: H/2, vx:0, vy:0, angle:0, hitCooldown:0, shieldTime:0 };
  exit = { x: W-90, y: H/2-50, open:false };
  powerUps = [];
  powerUpTimer = 0;
  nextSpawnInterval = seededRand(8,10);

  // wall variant selection (seeded)
  wallVariantIndex = seededRandInt(0, WALL_VARIANTS.length-1);
  walls = WALL_VARIANTS[wallVariantIndex].map(w=>({...w}));

  const spawnX = 80, spawnY = H/2;
  const exitCX = exit.x + EXIT_W/2, exitCY = exit.y + EXIT_H/2;

  // beacons random but not too close to spawn or exit, and avoid wall overlaps — seeded RNG
  for(let i=0;i<BEACON_COUNT;i++){
    let x,y,tries=0;
    do{
      x = seededRand(160, W-160);
      y = seededRand(80, H-80);
      tries++;
      const nearOther = beacons.some(b=>Math.hypot(b.x-x,b.y-y)<90);
      const nearSpawn = Math.hypot(x-spawnX, y-spawnY) < 70;
      const nearExit = Math.hypot(x-exitCX, y-exitCY) < 80;
      const onWall = beaconOverlapsWalls(x,y);
      if(!nearOther && !nearSpawn && !nearExit && !onWall) break;
      // if wall overlap forced, try again until tries exhausted
    } while(tries<80);
    beacons.push({x,y,collected:false, pulse: seededRand(0, Math.PI*2)});
  }
  // pulses: traffic — use seeded RNG for positions, lanes/speeds
  const laneYs = [110, 190, 290, 380, 460, 520];
  for(let i=0;i<PULSE_COUNT;i++){
    const ang = seededRand(0, Math.PI*2);
    const spd = seededRand(1.4, 2.2);
    pulses.push({
      x: seededRand(220, W-140),
      y: laneYs[i % laneYs.length] + seededRand(-16,16),
      vx: Math.cos(ang)*spd,
      vy: Math.sin(ang)*spd,
      phase: seededRand(0, Math.PI*2),
      baseX: 0,
      baseY: 0
    });
    pulses[i].baseX = pulses[i].x;
    pulses[i].baseY = pulses[i].y;
  }
  updateHUD();
  updateSeedDisplay();
}

const elBeaconDots = document.getElementById('beacon-dots');
const elStatusWrap = document.getElementById('status-wrap');
function ensureDots(){
  if(!elBeaconDots) return;
  if(elBeaconDots.childNodes.length !== BEACON_COUNT){
    elBeaconDots.innerHTML='';
    for(let i=0;i<BEACON_COUNT;i++){
      const d=document.createElement('i');
      elBeaconDots.appendChild(d);
    }
  }
}
function triggerScorePop(){
  elScore.classList.remove('pop');
  void elScore.offsetWidth;
  elScore.classList.add('pop');
  setTimeout(()=>elScore.classList.remove('pop'),300);
}
function updateHUD(){
  elScore.textContent = score;
  const collected = beacons.filter(b=>b.collected).length;
  elBeacons.textContent = `${collected} / ${BEACON_COUNT}`;
  ensureDots();
  if(elBeaconDots){
    [...elBeaconDots.children].forEach((dot,i)=>{
      dot.className = i < collected ? 'on' : (i===collected ? 'next' : '');
    });
  }
  elTimer.textContent = timeLeft.toFixed(1);
  if(state==='playing'){
    if(!exit.open) elStatus.textContent = `COLLECT`;
    else elStatus.textContent = `EXIT OPEN`;
    elStatus.style.color = exit.open ? 'var(--green)' : 'var(--cyan)';
    if(elStatusWrap) elStatusWrap.classList.toggle('exit-open', exit.open);
    elStatus.classList.toggle('status-exit', exit.open);
  } else if(state==='paused') { elStatus.textContent='PAUSED'; elStatus.classList.remove('status-exit'); if(elStatusWrap) elStatusWrap.classList.remove('exit-open'); }
  else if(state==='won') { elStatus.textContent='DELIVERED'; elStatus.classList.remove('status-exit'); }
  else if(state==='lost') { elStatus.textContent='FAILED'; elStatus.classList.remove('status-exit'); }
  else { elStatus.textContent='READY'; elStatus.classList.remove('status-exit'); }
  // urgency
  if(timeLeft<12 && state==='playing'){
    elTimer.style.color = 'var(--magenta)';
    elTimer.style.textShadow='0 0 10px rgba(255,46,122,0.9)';
    elTimer.classList.add('urgent');
  } else {
    elTimer.style.color='';
    elTimer.style.textShadow='';
    elTimer.classList.remove('urgent');
  }
  updateSeedDisplay();
}

function spawnParticles(x,y,color,count=10){
  for(let i=0;i<count;i++){
    particles.push({x,y,vx:rand(-3,3),vy:rand(-3,3), life:1, decay: rand(0.02,0.05), color, r: rand(2,5)});
  }
}
function spawnFloater(x,y,text,color){
  floaters.push({x,y,text,color, life:1, vy:-42});
}

// --- Power-up helpers ---
function isPowerUpPosValid(x,y){
  // avoid walls, spawn, exit
  for(const w of walls){
    if(rectCollideCircle(w.x,w.y,w.w,w.h, x,y, POWERUP_R+8)) return false;
  }
  if(Math.hypot(x-drone.x, y-drone.y) < 60) return false;
  if(Math.hypot(x-(exit.x+EXIT_W/2), y-(exit.y+EXIT_H/2)) < 70) return false;
  if(beacons.some(b=> !b.collected && Math.hypot(b.x-x, b.y-y)< 60)) return false;
  if(powerUps.some(p=> Math.hypot(p.x-x, p.y-y)< 70)) return false;
  return true;
}

function spawnRandomPowerUp(){
  if(powerUps.length >= 2) return;
  let x,y,tries=0;
  do{
    x = seededRand(140, W-140);
    y = seededRand(70, H-70);
    // also use Math.random as fallback for extra variety if seeded loop exhausted
    if(tries>40){
      x = rand(140, W-140);
      y = rand(70, H-70);
    }
    tries++;
  } while(!isPowerUpPosValid(x,y) && tries<80);
  const type = rng() < 0.5 ? 'shield' : 'time';
  // ensure at least one of each if only one left? random is fine
  powerUps.push({x,y, type, phase: seededRand(0, Math.PI*2)});
  spawnParticles(x,y, type==='shield' ? '#38e6ff' : '#ffd93d', 10);
}

// Input
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys.add(k);
  if(k==='p' && state==='playing'){ setState('paused'); }
  else if(k==='p' && state==='paused'){ setState('playing'); }
  if(k==='r'){ randomizeAndRestart(); }
  if(k===' ' || k==='enter'){
    if(state==='start' || state==='won' || state==='lost') startPlaying();
    else if(state==='paused') setState('playing');
  }
});
window.addEventListener('keyup', e=> keys.delete(e.key.toLowerCase()));
document.getElementById('btn-start').onclick = ()=> startPlaying();
document.getElementById('btn-resume').onclick = ()=> setState('playing');
document.getElementById('btn-restart').onclick = ()=> startPlaying();

// randomize button
const btnRandomize = document.getElementById('btn-randomize');
if(btnRandomize){
  btnRandomize.onclick = ()=> randomizeAndRestart();
}
const btnRandomizeStart = document.getElementById('btn-randomize-start');
if(btnRandomizeStart){
  btnRandomizeStart.onclick = ()=> randomizeAndRestart();
}

// Touch
const touchWrap=document.getElementById('touch');
function updateTouchVisibility(){
  if(window.innerWidth<=960) touchWrap.classList.remove('hidden');
  else touchWrap.classList.add('hidden');
}
updateTouchVisibility();
window.addEventListener('resize', updateTouchVisibility);
touchWrap.querySelectorAll('button').forEach(b=>{
  const dir=b.dataset.dir;
  const set = (v)=>{
    if(dir==='up') touchDir.y = v ? -1 : 0;
    if(dir==='down') touchDir.y = v ? 1 : 0;
    if(dir==='left') touchDir.x = v ? -1 : 0;
    if(dir==='right') touchDir.x = v ? 1 : 0;
  };
  b.addEventListener('touchstart', e=>{e.preventDefault(); set(true);});
  b.addEventListener('touchend', e=>{e.preventDefault(); set(false);});
  b.addEventListener('mousedown', ()=>set(true));
  b.addEventListener('mouseup', ()=>set(false));
  b.addEventListener('mouseleave', ()=>set(false));
});

function setState(s){
  state=s;
  overlayStart.classList.toggle('hidden', s!=='start');
  overlayPause.classList.toggle('hidden', s!=='paused');
  overlayEnd.classList.toggle('hidden', !(s==='won' || s==='lost'));
  updateHUD();
}
function startPlaying(){
  resetGame();
  setState('playing');
}
function randomizeAndRestart(){
  generateNewSeed();
  resetGame();
  setState('playing');
}

let last=performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now-last)/1000);
  last=now;
  if(state==='playing') update(dt);
  render(now);
}
function update(dt){
  // timer
  timeLeft -= dt;
  if(timeLeft<=0){
    timeLeft=0;
    fail('Time expired — signal lost');
    return;
  }
  // shield timer
  if(drone.shieldTime>0){
    drone.shieldTime -= dt;
    if(drone.shieldTime<0) drone.shieldTime=0;
  }
  // power-up spawning: every ~8-10s if <2 on field
  powerUpTimer += dt;
  if(powerUpTimer >= nextSpawnInterval){
    powerUpTimer = 0;
    nextSpawnInterval = seededRand(8,10);
    if(powerUps.length < 2){
      // 70% chance to spawn when timer elapses to keep randomness
      if(rng() < 0.85) spawnRandomPowerUp();
    }
  }
  // input
  let ax=0, ay=0;
  if(keys.has('w')||keys.has('arrowup')) ay-=1;
  if(keys.has('s')||keys.has('arrowdown')) ay+=1;
  if(keys.has('a')||keys.has('arrowleft')) ax-=1;
  if(keys.has('d')||keys.has('arrowright')) ax+=1;
  ax += touchDir.x;
  ay += touchDir.y;
  const mag=Math.hypot(ax,ay) || 1;
  if(ax||ay){ ax/=mag; ay/=mag; }
  const accel= 1200;
  const friction= 0.92;
  // apply accel
  drone.vx += ax * accel * dt;
  drone.vy += ay * accel * dt;
  drone.vx *= Math.pow(friction, dt*60);
  drone.vy *= Math.pow(friction, dt*60);
  // clamp speed
  const spd=Math.hypot(drone.vx, drone.vy);
  const maxSpd= 220;
  if(spd>maxSpd){ drone.vx*=maxSpd/spd; drone.vy*=maxSpd/spd; }
  // move with wall collision
  let nx = drone.x + drone.vx*dt;
  let ny = drone.y + drone.vy*dt;
  // simple wall pushback
  for(const w of walls){
    if(rectCollideCircle(w.x,w.y,w.w,w.h, nx, drone.y, PLAYER_R)){
      drone.vx*=-0.4;
      nx = drone.x;
    }
    if(rectCollideCircle(w.x,w.y,w.w,w.h, drone.x, ny, PLAYER_R)){
      drone.vy*=-0.4;
      ny = drone.y;
    }
  }
  drone.x = Math.max(PLAYER_R+10, Math.min(W-10-PLAYER_R, nx));
  drone.y = Math.max(PLAYER_R+10, Math.min(H-10-PLAYER_R, ny));
  if(Math.hypot(drone.vx, drone.vy)>8) drone.angle = Math.atan2(drone.vy, drone.vx);

  // beacons
  beacons.forEach(b=>{
    b.pulse+=dt*3;
    if(!b.collected && Math.hypot(b.x-drone.x, b.y-drone.y) < BEACON_R+PLAYER_R){
      b.collected=true;
      const bonus = timeLeft>40 ? 25 : 0;
      score+=100+bonus;
      spawnParticles(b.x,b.y,'#38e6ff',16);
      // extra ring burst
      for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; particles.push({x:b.x,y:b.y,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2, life:1, decay:0.045, color:'#b6f6ff', r:2.2}); }
      spawnFloater(b.x, b.y-18, bonus?`+100 +${bonus}`:'+100', '#38e6ff');
      shake = Math.max(shake, 4);
      triggerScorePop();
      if(beacons.every(x=>x.collected)){
        exit.open=true;
        spawnParticles(exit.x+EXIT_W/2, exit.y+EXIT_H/2,'#3cff8a',24);
        spawnFloater(exit.x+EXIT_W/2, exit.y-12, 'EXIT OPEN', '#3cff8a');
        shake = Math.max(shake, 7);
      }
      updateHUD();
    }
  });

  // power-up collection
  powerUps.forEach((p, idx)=>{
    p.phase += dt*2.2;
    if(Math.hypot(p.x-drone.x, p.y-drone.y) < POWERUP_R + PLAYER_R){
      if(p.type==='shield'){
        drone.shieldTime = 5;
        score += 50;
        spawnParticles(p.x,p.y,'#38e6ff',18);
        spawnFloater(p.x, p.y-18, 'SHIELD +50', '#38e6ff');
        shake = Math.max(shake,5);
      } else {
        timeLeft += 5;
        // cap to avoid infinite stacking but allow bonus
        if(timeLeft > GAME_TIME + 15) timeLeft = GAME_TIME + 15;
        score += 25;
        spawnParticles(p.x,p.y,'#ffd93d',18);
        spawnFloater(p.x, p.y-18, '+5s +25', '#ffd93d');
        shake = Math.max(shake,3);
      }
      triggerScorePop();
      powerUps.splice(idx,1);
      updateHUD();
    }
  });

  // pulses movement — faster drift + light chase when near player
  pulses.forEach(p=>{
    // light homing when within 190px (makes them feel alive without being unfair)
    const dx = drone.x - p.x, dy = drone.y - p.y;
    const dist = Math.hypot(dx,dy);
    if(dist < 190 && dist>12){
      const steer = 0.85; // gentle steering
      p.vx += (dx/dist)*steer * dt;
      p.vy += (dy/dist)*steer * dt;
      // clamp pulse speed
      const ps = Math.hypot(p.vx,p.vy);
      const maxPS = 2.6;
      if(ps>maxPS){ p.vx*=maxPS/ps; p.vy*=maxPS/ps; }
    }
    p.x += p.vx * 60 * dt;
    p.y += (p.vy + Math.sin(nowTick*0.001 + p.phase)*0.3) * 60 * dt;
    // bounce off walls/bounds
    if(p.x < 20 || p.x > W-20) p.vx*=-1;
    if(p.y < 20 || p.y > H-20) p.vy*=-1;
    // bounce off inner walls (reflect)
    for(const w of walls){
      if(rectCollideCircle(w.x,w.y,w.w,w.h, p.x,p.y,PULSE_R)){
        p.vx*=-1; p.vy*=-1;
        p.x+=p.vx*2; p.y+=p.vy*2;
      }
    }
  });

  // drone vs pulses (shield grants invuln)
  if(drone.hitCooldown>0) drone.hitCooldown-=dt;
  if(hitFlash>0) hitFlash-=dt;
  const isShielded = drone.shieldTime > 0;
  pulses.forEach(p=>{
    if(Math.hypot(p.x-drone.x, p.y-drone.y) < PULSE_R+PLAYER_R -2){
      if(drone.hitCooldown<=0){
        if(isShielded){
          // shield blocks damage, just bounce and particles
          spawnParticles(p.x,p.y,'#38e6ff',10);
          const ang=Math.atan2(drone.y-p.y, drone.x-p.x);
          drone.vx+=Math.cos(ang)*180;
          drone.vy+=Math.sin(ang)*180;
          drone.hitCooldown=0.35;
          return;
        }
        score=Math.max(0, score-50);
        timeLeft=Math.max(0, timeLeft-2);
        spawnParticles(drone.x, drone.y, '#ff2e7a',12);
        for(let k=0;k<6;k++){ const a=Math.random()*Math.PI*2; particles.push({x:drone.x,y:drone.y,vx:Math.cos(a)*3.5,vy:Math.sin(a)*3.5, life:1, decay:0.05, color:'#ff8fb6', r:2}); }
        spawnFloater(drone.x, drone.y-16, '-50  -2s', '#ff2e7a');
        shake = Math.max(shake, 11);
        hitFlash = 0.22;
        triggerScorePop();
        drone.hitCooldown=0.8;
        // knockback
        const ang=Math.atan2(drone.y-p.y, drone.x-p.x);
        drone.vx+=Math.cos(ang)*300;
        drone.vy+=Math.sin(ang)*300;
        updateHUD();
        if(timeLeft<=0) fail('Traffic EMP hit — time lost');
      }
    }
  });

  // exit check
  if(exit.open){
    const ex=exit.x+EXIT_W/2, ey=exit.y+EXIT_H/2;
    if(Math.hypot(ex-drone.x, ey-drone.y) < 38){
      win();
    }
  }

  // trail — keep last 10
  trail.push({x:drone.x, y:drone.y, a:drone.angle});
  if(trail.length>10) trail.shift();
  // shake decay
  shake *= Math.pow(0.12, dt); // fast decay, frame-rate independent-ish
  if(shake<0.12) shake=0;

  // particles
  particles.forEach(pt=>{
    pt.x+=pt.vx;
    pt.y+=pt.vy;
    pt.vy+=0.06;
    pt.vx*=0.99;
    pt.life-=pt.decay;
  });
  particles = particles.filter(p=>p.life>0);
  // floaters
  floaters.forEach(f=>{ f.y += f.vy*dt; f.vy += 28*dt; f.life -= dt*1.15; });
  floaters = floaters.filter(f=>f.life>0);

  updateHUD();
}
let nowTick=0;
function win(){
  state='won';
  elEndTitle.textContent='DELIVERED';
  elEndTitle.style.color='var(--green)';
  elEndMsg.textContent='All beacons delivered — exit reached!';
  elEndScore.textContent=score + Math.floor(timeLeft*2);
  score+=Math.floor(timeLeft*2);
  elEndTime.textContent=timeLeft.toFixed(1)+'s';
  elEndBeacons.textContent=`${beacons.filter(b=>b.collected).length}/${BEACON_COUNT}`;
  setState('won');
}
function fail(reason){
  state='lost';
  elEndTitle.textContent='SIGNAL LOST';
  elEndTitle.style.color='var(--magenta)';
  elEndMsg.textContent=reason;
  elEndScore.textContent=score;
  elEndTime.textContent=timeLeft.toFixed(1)+'s';
  elEndBeacons.textContent=`${beacons.filter(b=>b.collected).length}/${BEACON_COUNT}`;
  setState('lost');
}

function render(t){
  nowTick=t;
  // screen shake
  ctx.save();
  if(shake>0){
    const sx=(Math.random()-0.5)*shake*2;
    const sy=(Math.random()-0.5)*shake*2;
    ctx.translate(sx,sy);
  }
  // clear
  ctx.clearRect(-12,-12,W+24,H+24);
  // bg grid + neon city
  ctx.save();
  // subtle vignette
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0c1024'); g.addColorStop(1,'#070a14');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
  // grid — additive bloom (Geometry Wars HDR feel)
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.strokeStyle='rgba(56,230,255,0.09)';
  ctx.lineWidth=1;
  for(let x=0;x<W;x+=48){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for(let y=0;y<H;y+=48){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  // second bloom pass
  ctx.strokeStyle='rgba(56,230,255,0.04)';
  ctx.lineWidth=2;
  for(let x=24;x<W;x+=48){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  ctx.restore();
  // building silhouettes
  ctx.fillStyle='rgba(14,18,40,0.9)';
  const buildings=[
    [40,0,120,140],[160,0,90,90],[300,0,140,110],[500,0,110,160],[680,0,140,100],[830,0,120,180],
    [0,520,160,120],[200,560,180,80],[420,540,200,100],[660,500,150,140],[840,540,110,100]
  ];
  buildings.forEach(([x,y,w,h])=>{ ctx.fillRect(x,y,w,h); // top
    ctx.fillRect(x, H-h, w, h);
  });
  // window lights
  ctx.fillStyle='rgba(56,230,255,0.35)';
  for(let i=0;i<160;i++){
    const bx = (i*137)%W, by=(i*211)%H;
    if(i%3===0) ctx.fillRect(bx%W, by%H, 2, 6);
  }
  ctx.restore();

  // walls — neon edges
  walls.forEach(w=>{
    ctx.fillStyle='#0f1533';
    ctx.fillRect(w.x,w.y,w.w,w.h);
    ctx.strokeStyle='rgba(124,92,255,0.9)';
    ctx.lineWidth=2;
    ctx.shadowColor='rgba(124,92,255,0.8)';
    ctx.shadowBlur=10;
    ctx.strokeRect(w.x,w.y,w.w,w.h);
    ctx.shadowBlur=0;
  });

  // exit gate
  ctx.save();
  if(exit.open){
    ctx.shadowColor='#3cff8a'; ctx.shadowBlur=18;
    ctx.fillStyle='rgba(60,255,138,0.14)';
    ctx.strokeStyle='#3cff8a';
  } else {
    ctx.shadowColor='rgba(255,255,255,0.15)'; ctx.shadowBlur=6;
    ctx.fillStyle='rgba(255,255,255,0.04)';
    ctx.strokeStyle='rgba(200,210,255,0.35)';
  }
  ctx.lineWidth=2;
  ctx.fillRect(exit.x, exit.y, EXIT_W, EXIT_H);
  ctx.strokeRect(exit.x, exit.y, EXIT_W, EXIT_H);
  // stripes
  ctx.fillStyle= exit.open ? 'rgba(60,255,138,0.9)' : 'rgba(200,210,255,0.25)';
  for(let i=0;i<4;i++) ctx.fillRect(exit.x+12, exit.y+18+i*20, EXIT_W-24, 8);
  ctx.fillStyle= exit.open ? '#00140a' : '#c8d0f0';
  ctx.font='700 13px JetBrains Mono,monospace';
  ctx.textAlign='center';
  ctx.shadowBlur=0;
  ctx.fillText(exit.open?'EXIT OPEN':'LOCKED', exit.x+EXIT_W/2, exit.y+EXIT_H-12);
  // arrow
  if(exit.open){
    ctx.fillStyle='#3cff8a';
    ctx.beginPath(); ctx.moveTo(exit.x+EXIT_W/2-10, exit.y+EXIT_H/2-12); ctx.lineTo(exit.x+EXIT_W/2+10, exit.y+EXIT_H/2); ctx.lineTo(exit.x+EXIT_W/2-10, exit.y+EXIT_H/2+12); ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // beacons — Pac-Man collect clarity: high-contrast + breathing ring
  beacons.forEach(b=>{
    if(b.collected) return;
    const bob=Math.sin(b.pulse)*3;
    const isNext = beacons.findIndex(x=>!x.collected) === beacons.indexOf(b);
    ctx.save();
    // outer beacon field — stronger when next
    ctx.shadowColor='#38e6ff'; ctx.shadowBlur=isNext?22:16;
    ctx.fillStyle=isNext?'rgba(56,230,255,0.24)':'rgba(56,230,255,0.16)';
    ctx.beginPath(); ctx.arc(b.x, b.y+bob, 26,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(56,230,255,0.10)';
    ctx.beginPath(); ctx.arc(b.x, b.y+bob, 36+Math.sin(b.pulse)*2,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=18;
    ctx.fillStyle='#38e6ff';
    // double glow for Geometry Wars punch
    ctx.beginPath(); ctx.arc(b.x, b.y+bob, BEACON_R+2,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#eaffff';
    ctx.beginPath(); ctx.arc(b.x-2.5, b.y+bob-2.5, 3.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#001018';
    ctx.font='700 9px JetBrains Mono,monospace';
    ctx.textAlign='center';
    ctx.fillText('◈', b.x, b.y+bob+3);
    // breathing ring + next-beacon arrow hint
    ctx.strokeStyle=isNext?'rgba(255,217,61,0.95)':'rgba(56,230,255,0.75)';
    ctx.lineWidth=isNext?2:1.5;
    ctx.shadowColor=isNext?'#ffd93d':'#38e6ff'; ctx.shadowBlur=isNext?10:6;
    ctx.beginPath(); ctx.arc(b.x, b.y+bob, 18+ Math.sin(b.pulse*1.5)*2.5,0,Math.PI*2); ctx.stroke();
    if(isNext){
      ctx.shadowBlur=0;
      const ddx=drone.x-b.x, ddy=drone.y-b.y; const dist=Math.hypot(ddx,ddy);
      if(dist>90){
        const ang=Math.atan2(ddy,ddx);
        ctx.fillStyle='rgba(56,230,255,0.85)';
        ctx.beginPath(); ctx.arc(b.x+Math.cos(ang+Math.PI)*22, b.y+bob+Math.sin(ang+Math.PI)*22, 3,0,Math.PI*2); ctx.fill();
      }
    }
    ctx.restore();
  });

  // power-ups
  powerUps.forEach(p=>{
    const bob = Math.sin(p.phase)*4;
    ctx.save();
    const isShield = p.type==='shield';
    const col = isShield ? '#38e6ff' : '#ffd93d';
    const glow = isShield ? 'rgba(56,230,255,0.9)' : 'rgba(255,217,61,0.9)';
    ctx.shadowColor = glow; ctx.shadowBlur = 18;
    ctx.fillStyle = isShield ? 'rgba(56,230,255,0.18)' : 'rgba(255,217,61,0.18)';
    ctx.beginPath(); ctx.arc(p.x, p.y+bob, POWERUP_R+10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = col;
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(p.x, p.y+bob, POWERUP_R,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.font='700 13px JetBrains Mono,monospace';
    ctx.textAlign='center';
    ctx.fillText(isShield ? '◈' : '+', p.x, p.y+bob+4.5);
    // outer ring pulse
    ctx.strokeStyle = isShield ? 'rgba(56,230,255,0.55)' : 'rgba(255,217,61,0.55)';
    ctx.lineWidth=1.7;
    ctx.beginPath(); ctx.arc(p.x, p.y+bob, POWERUP_R+6+Math.sin(p.phase*1.6)*2,0,Math.PI*2); ctx.stroke();
    // label tiny
    ctx.font='600 7px JetBrains Mono,monospace';
    ctx.fillStyle = isShield ? '#b6f6ff' : '#fff3a0';
    ctx.fillText(isShield ? 'SHIELD' : '+5S', p.x, p.y+bob+POWERUP_R+12);
    ctx.restore();
  });

  // pulses — Geometry Wars double-glow for instant hazard read
  pulses.forEach(p=>{
    ctx.save();
    // outer danger field
    ctx.shadowColor='#ff2e7a'; ctx.shadowBlur=18;
    ctx.fillStyle='rgba(255,46,122,0.18)';
    ctx.beginPath(); ctx.arc(p.x,p.y, PULSE_R+12,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=14;
    ctx.fillStyle='rgba(255,46,122,0.26)';
    ctx.beginPath(); ctx.arc(p.x,p.y, PULSE_R+7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ff2e7a';
    ctx.beginPath(); ctx.arc(p.x,p.y, PULSE_R,0,Math.PI*2); ctx.fill();
    // inner core + highlight
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.96)';
    ctx.beginPath(); ctx.arc(p.x-4.5,p.y-4.5,4.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(p.x,p.y, PULSE_R-6,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.2; ctx.stroke();
    // motion trail
    ctx.strokeStyle='rgba(255,46,122,0.40)';
    ctx.lineWidth=2.2;
    ctx.shadowColor='rgba(255,46,122,0.7)'; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(p.x - p.vx*7, p.y - p.vy*7); ctx.lineTo(p.x, p.y); ctx.stroke();
    // pulsing ring — threat breathing
    ctx.shadowBlur=0;
    ctx.strokeStyle=`rgba(255,46,122,${0.18 + Math.sin(nowTick*0.004 + p.phase)*0.12})`;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(p.x,p.y, PULSE_R+10+Math.sin(nowTick*0.005+p.phase)*3,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  });

  // drone trail — velocity ribbon (Pac-Man clarity: your vector is readable)
  if(trail.length>1){
    for(let i=0;i<trail.length;i++){
      const pt=trail[i];
      const a = (i+1)/trail.length; // 0..1
      ctx.save();
      ctx.globalAlpha = a*0.28;
      ctx.fillStyle='#38e6ff';
      ctx.shadowColor='#38e6ff'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4 + a*4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // connecting line
    ctx.save();
    ctx.strokeStyle='rgba(56,230,255,0.22)';
    ctx.lineWidth=2;
    ctx.shadowColor='#38e6ff'; ctx.shadowBlur=8;
    ctx.beginPath();
    trail.forEach((pt,i)=>{ if(i===0) ctx.moveTo(pt.x,pt.y); else ctx.lineTo(pt.x,pt.y); });
    ctx.stroke();
    ctx.restore();
  }

  // drone
  ctx.save();
  ctx.translate(drone.x, drone.y);
  ctx.rotate(drone.angle);
  // glow — shield adds cyan halo
  if(drone.shieldTime>0){
    ctx.shadowColor='#38e6ff'; ctx.shadowBlur=22;
    ctx.strokeStyle='rgba(56,230,255,0.85)';
    ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.arc(0,0, PLAYER_R+10 + Math.sin(nowTick*0.008)*2,0,Math.PI*2); ctx.stroke();
    ctx.shadowBlur=0;
  }
  ctx.shadowColor='#38e6ff'; ctx.shadowBlur=18;
  ctx.fillStyle= drone.hitCooldown>0 ? 'rgba(255,100,100,0.9)' : (drone.shieldTime>0 ? '#b6f6ff' : '#eaf6ff');
  // body
  ctx.beginPath();
  // drone shape: hexagon + wings
  ctx.moveTo(16,0); ctx.lineTo(6,10); ctx.lineTo(-10,10); ctx.lineTo(-16,0); ctx.lineTo(-10,-10); ctx.lineTo(6,-10); ctx.closePath();
  ctx.fill();
  ctx.shadowBlur=0;
  // cockpit
  ctx.fillStyle= drone.shieldTime>0 ? '#38e6ff' : '#38e6ff';
  ctx.beginPath(); ctx.arc(6,0,5,0,Math.PI*2); ctx.fill();
  if(drone.shieldTime>0){
    ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=1; ctx.stroke();
  }
  // thruster
  const thrust = Math.hypot(drone.vx,drone.vy)/220;
  ctx.fillStyle=`rgba(56,230,255,${0.4+thrust*0.6})`;
  ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-22- thrust*8, -6); ctx.lineTo(-22- thrust*8, 6); ctx.closePath(); ctx.fill();
  // hit flash
  if(drone.hitCooldown>0 && drone.shieldTime<=0){
    ctx.strokeStyle='rgba(255,46,122,0.9)'; ctx.lineWidth=2; ctx.stroke();
  }
  ctx.restore();

  // particles
  particles.forEach(p=>{
    ctx.globalAlpha=p.life;
    ctx.fillStyle=p.color;
    ctx.shadowColor=p.color; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  // floaters
  floaters.forEach(f=>{
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle=f.color;
    ctx.shadowColor=f.color; ctx.shadowBlur=10;
    ctx.font='800 13px JetBrains Mono,monospace';
    ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });

  // hit flash vignette
  if(hitFlash>0){
    ctx.save();
    ctx.globalAlpha = hitFlash*0.22;
    ctx.fillStyle='#ff2e7a';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = hitFlash*0.9;
    ctx.strokeStyle='#ff2e7a'; ctx.lineWidth=6; ctx.strokeRect(4,4,W-8,H-8);
    ctx.restore();
  }

  // shield vignette subtle
  if(drone.shieldTime>0){
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(nowTick*0.008)*0.03;
    ctx.strokeStyle='#38e6ff'; ctx.lineWidth=10;
    ctx.strokeRect(0,0,W,H);
    ctx.restore();
  }

  // timer bar — urgency pulse
  const pct=Math.max(0, timeLeft/GAME_TIME);
  ctx.fillStyle='rgba(0,0,0,0.55)';
  ctx.fillRect(14, H-14, W-28, 6);
  // tick marks
  ctx.fillStyle='rgba(255,255,255,0.08)';
  for(let i=1;i<4;i++) ctx.fillRect(14+(W-28)*i/4, H-14, 1, 6);
  ctx.fillStyle= pct<0.25 ? '#ff2e7a' : pct<0.5 ? '#ffd93d' : '#38e6ff';
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur= pct<0.25 ? 14*Math.abs(Math.sin(nowTick*0.01))+6 : 8;
  ctx.fillRect(14, H-14, (W-28)*pct, 6);
  ctx.shadowBlur=0;
  // scanline subtle
  ctx.fillStyle='rgba(255,255,255,0.03)';
  for(let y=0;y<H;y+=4) ctx.fillRect(0,y,W,1);

  ctx.restore(); // shake restore
}

resetGame();
setState('start');
requestAnimationFrame(loop);

// expose for tests
window.__game = { resetGame, getState:()=>state, getScore:()=>score, getBeacons:()=>beacons, W,H, getSeed:()=>currentSeed, setSeed, generateNewSeed, getWalls:()=>walls, getWallVariant:()=>wallVariantIndex, getPowerUps:()=>powerUps, WALL_VARIANTS, mulberry32 };
updateSeedDisplay();

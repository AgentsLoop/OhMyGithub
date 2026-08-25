/* Sky Rings — lightweight arcade flight (canvas 2.5D) */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);

// DOM
const $score = document.getElementById('scoreVal');
const $rings = document.getElementById('ringsVal');
const $combo = document.getElementById('comboVal');
const $lives = document.getElementById('livesVal');
const $progressFill = document.getElementById('progressFill');
const $progressText = document.getElementById('progressText');
const $speedFill = document.getElementById('speedFill');
const $centerMsg = document.getElementById('centerMsg');
const overStart = document.getElementById('overlay-start');
const overPause = document.getElementById('overlay-pause');
const overCrash = document.getElementById('overlay-crash');
const overWin   = document.getElementById('overlay-win');
const helpPanel = document.getElementById('helpPanel');

// Buttons
document.getElementById('startBtn').onclick = startGame;
document.getElementById('mobileStart').onclick = startGame;
document.getElementById('resumeBtn').onclick = ()=> setPaused(false);
document.getElementById('retryBtn').onclick = resetGame;
document.getElementById('retryBtn2').onclick = resetGame;
document.getElementById('playAgainBtn').onclick = resetGame;
document.getElementById('helpBtn').onclick = ()=> helpPanel.classList.toggle('hidden');
document.getElementById('closeHelp').onclick = ()=> helpPanel.classList.add('hidden');
document.getElementById('muteBtn').onclick = toggleMute;

let muted=false;
function toggleMute(){
  muted=!muted;
  document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
  if(!muted && !audioCtx) initAudio();
}

// Audio (WebAudio procedural)
let audioCtx;
function initAudio(){
  try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch{}
}
function beep(freq, dur=0.12, type='sine', gain=0.18){
  if(muted || !audioCtx) return;
  if(audioCtx.state==='suspended') audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  o.connect(g); g.connect(audioCtx.destination);
  g.gain.value=gain;
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
  o.start(); o.stop(audioCtx.currentTime+dur);
}
function chord(){
  beep(880,0.14,'sine',0.22);
  setTimeout(()=>beep(1175,0.14,'sine',0.16),90);
}
function crashSound(){
  beep(120,0.35,'square',0.22);
  setTimeout(()=>beep(80,0.35,'sawtooth',0.16),120);
}
let engineOsc, engineGain;
function startEngineHum(){
  if(muted || !audioCtx) return;
  if(engineOsc) return;
  engineOsc = audioCtx.createOscillator();
  engineGain = audioCtx.createGain();
  engineOsc.type='triangle';
  engineOsc.frequency.value=68;
  engineGain.gain.value=0.0;
  engineOsc.connect(engineGain); engineGain.connect(audioCtx.destination);
  engineOsc.start();
  // fade in
  engineGain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime+0.6);
}
function setEnginePitch(speedFactor){
  if(!engineOsc || muted) return;
  engineOsc.frequency.linearRampToValueAtTime(64 + speedFactor*28, audioCtx.currentTime+0.1);
  engineGain.gain.linearRampToValueAtTime(0.035 + speedFactor*0.025, audioCtx.currentTime+0.1);
}
function stopEngine(){ try{engineOsc&&engineOsc.stop()}catch{} engineOsc=null; }

// Game state
const STATE = { READY:'ready', PLAYING:'playing', PAUSED:'paused', CRASHED:'crashed', WIN:'win' };
let state = STATE.READY;
let score=0, ringsCleared=0, combo=0, bestCombo=0, lives=3;
const TOTAL_RINGS=20;
let speed=0; // 0..1
let t=0;

// Plane
const plane = { x:0, y:0, tx:0, ty:0, roll:0, pitch:0, prop:0, vy:0, vx:0, shake:0 };
const input = { up:false, down:false, left:false, right:false };
const BOUNDS = { x: 285, y: 175 };

// Rings & hazards
let rings=[]; let hazards=[]; let clouds=[]; let particles=[];
let spawnIndex=0;

// Projection helpers
const FOV=380;
const CX=640, CY=360;
function project(x,y,z){
  // z distance ahead; scale
  const s = FOV / (FOV + z);
  return { x: CX + x*s, y: CY + y*s, s };
}

// Build clouds (3 layers)
function makeClouds(){
  clouds=[];
  const layers = [
    { count:10, zMin:200, zMax:1500, size: 30, alpha:0.55, speed:0.55, tint: 'far' },
    { count:14, zMin:120, zMax:1200, size: 42, alpha:0.72, speed:0.9,  tint: 'mid' },
    { count:9,  zMin:60,  zMax:900,  size: 58, alpha:0.95, speed:1.35, tint:'near' },
  ];
  for(const L of layers){
    for(let i=0;i<L.count;i++){
      const x = (Math.random()*2-1)*520;
      const y = (Math.random()*2-1)*260 + (L.tint==='far'? -30:0);
      const z = L.zMin + Math.random()*(L.zMax-L.zMin);
      const puffs = 3 + Math.floor(Math.random()*3);
      const offs=[];
      for(let p=0;p<puffs;p++) offs.push({ dx:(Math.random()*2-1)*L.size*0.7, dy:(Math.random()*2-1)*L.size*0.35, r: L.size*(0.45+Math.random()*0.5)});
      clouds.push({ x,y,z, layer:L, puffs:offs, wob:Math.random()*Math.PI*2 });
    }
  }
  clouds.sort((a,b)=>b.z-a.z);
}

// Build rings path - gentle weaving course
function makeRings(){
  rings=[];
  hazards=[];
  spawnIndex=0;
  let curX=0, curY=0;
  for(let i=0;i<TOTAL_RINGS;i++){
    // weaving path
    const phase = i*0.62;
    const targetX = Math.sin(phase)*170 + Math.sin(phase*0.5)*60;
    const targetY = Math.cos(phase*0.83)*86 + Math.sin(i*0.33)*22;
    curX += (targetX - curX)*0.55;
    curY += (targetY - curY)*0.55;
    const z = 650 + i* 360; // spaced
    const r = 52 + Math.sin(i*1.1)*6;
    rings.push({ x:curX, y:curY, z, r, passed:false, state:'ahead' });
    // intersperse hazards occasionally between rings
    if(i>0 && i%3===0){
      const hz = Math.random()<0.5 ? 'storm' : 'balloon';
      const hx = curX + (Math.random()*2-1)*140;
      const hy = curY + (Math.random()*2-1)*90;
      const hzDist = z - 160 - Math.random()*90;
      hazards.push({ x:hx, y:hy, z:hzDist, type:hz, hit:false, wob:Math.random()*Math.PI*2 });
    }
  }
  // extra random hazards
  for(let i=0;i<6;i++){
    hazards.push({ x:(Math.random()*2-1)*360, y:(Math.random()*2-1)*140, z: 900+Math.random()*5000, type: Math.random()<0.6?'storm':'balloon', hit:false, wob:Math.random()*6 });
  }
}

function resetGame(){
  score=0; ringsCleared=0; combo=0; bestCombo=0; lives=3; speed=0.55; t=0;
  plane.x=0; plane.y=0; plane.tx=0; plane.ty=0; plane.roll=0; plane.pitch=0; plane.shake=0;
  makeClouds(); makeRings(); particles=[];
  state=STATE.READY;
  updateHUD();
  hideAllOverlays();
  overStart.classList.remove('hidden');
  stopEngine();
  flashCenter('Ready to fly — Hit START', 2200);
}

function startGame(){
  if(state===STATE.WIN || state===STATE.CRASHED) resetGame();
  if(!audioCtx) initAudio();
  startEngineHum();
  state=STATE.PLAYING;
  hideAllOverlays();
  flashCenter('Go! Go! Go!', 900);
  chord();
}
function hideAllOverlays(){
  overStart.classList.add('hidden');
  overPause.classList.add('hidden');
  overCrash.classList.add('hidden');
  overWin.classList.add('hidden');
}
function setPaused(p){
  if(state===STATE.CRASHED||state===STATE.WIN) return;
  if(p){ state=STATE.PAUSED; overPause.classList.remove('hidden'); }
  else { state=STATE.PLAYING; overPause.classList.add('hidden'); }
}
function flashCenter(text, ms=1200){
  $centerMsg.textContent=text;
  $centerMsg.classList.remove('hidden');
  clearTimeout(flashCenter._tid);
  flashCenter._tid=setTimeout(()=> $centerMsg.classList.add('hidden'), ms);
}

function triggerCrash(reason){
  state=STATE.CRASHED;
  lives=0;
  plane.shake=18;
  crashSound();
  // particles explosion
  for(let i=0;i<28;i++) particles.push({ x: CX, y: CY+plane.y*0.5, vx:(Math.random()*2-1)*320, vy:(Math.random()*2-1)*260, life:1, decay: 0.9+Math.random()*0.6, size: 3+Math.random()*5, color: i%2?'#ff5a3d':'#ffb84d'});
  updateHUD();
  document.getElementById('crashTitle').textContent = reason.includes('Ground')||reason.includes('Ceiling') ? 'Out of Bounds!' : 'Crashed!';
  document.getElementById('crashDesc').textContent = reason;
  document.getElementById('crashScore').textContent = score;
  document.getElementById('crashRings').textContent = `${ringsCleared}/${TOTAL_RINGS}`;
  setTimeout(()=> overCrash.classList.remove('hidden'), 420);
  stopEngine();
}
function triggerWin(){
  state=STATE.WIN;
  document.getElementById('winScore').textContent = score;
  document.getElementById('winCombo').textContent = `x${bestCombo}`;
  document.getElementById('winDesc').textContent = `Rings ${ringsCleared}/${TOTAL_RINGS} · Missed ${TOTAL_RINGS-ringsCleared} · Score ${score}`;
  // confetti
  for(let i=0;i<44;i++) particles.push({ x: CX+(Math.random()*2-1)*200, y: CY-120, vx:(Math.random()*2-1)*240, vy: -Math.random()*280 -60, life:1, decay:0.75, size:4+Math.random()*4, color: ['#ff5a3d','#3b82f6','#22c55e','#facc15'][i%4]});
  overWin.classList.remove('hidden');
  beep(880,0.18,'sine',0.22); setTimeout(()=>beep(1100,0.22,'sine',0.22),160); setTimeout(()=>beep(1320,0.34,'sine',0.22),320);
  stopEngine();
}

// Input handling
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','w'].includes(k)) input.up=true;
  if(['arrowdown','s'].includes(k)) input.down=true;
  if(['arrowleft','a'].includes(k)) input.left=true;
  if(['arrowright','d'].includes(k)) input.right=true;
  if(k===' '){ e.preventDefault(); if(state===STATE.PLAYING) setPaused(true); else if(state===STATE.PAUSED) setPaused(false); else if(state===STATE.READY) startGame(); }
  if(k==='r'){ resetGame(); if(state===STATE.READY) startGame(); }
  if(k==='h'){ helpPanel.classList.toggle('hidden'); }
  if(k==='p'){ if(state===STATE.PLAYING) setPaused(true); else if(state===STATE.PAUSED) setPaused(false); }
  // immediate start with space on ready
  if(state===STATE.READY && (k==='enter')) startGame();
});
window.addEventListener('keyup', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','w'].includes(k)) input.up=false;
  if(['arrowdown','s'].includes(k)) input.down=false;
  if(['arrowleft','a'].includes(k)) input.left=false;
  if(['arrowright','d'].includes(k)) input.right=false;
});
// Mobile dpad
document.querySelectorAll('.mbtn').forEach(btn=>{
  const dir=btn.dataset.dir;
  const set = (v)=>{
    if(dir==='up') input.up=v;
    if(dir==='down') input.down=v;
    if(dir==='left') input.left=v;
    if(dir==='right') input.right=v;
  };
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); set(true); });
  btn.addEventListener('touchend', e=>{ e.preventDefault(); set(false); });
  btn.addEventListener('mousedown', ()=>set(true));
  btn.addEventListener('mouseup', ()=>set(false));
  btn.addEventListener('mouseleave', ()=>set(false));
});

// Canvas scaling
function resize(){
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  canvas.width = Math.round(1280*DPR);
  canvas.height = Math.round(720*DPR);
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

// HUD
function updateHUD(){
  $score.textContent = score;
  $rings.textContent = ringsCleared;
  $combo.textContent = combo>1 ? `x${combo} 🔥` : '—';
  $combo.style.color = combo>2 ? '#ff5a3d' : '#3b82f6';
  $lives.textContent = '♥ '.repeat(lives).trim() + (lives<3 ? ' ♡'.repeat(3-lives).trim() : '');
  const pct = Math.round((ringsCleared/TOTAL_RINGS)*100);
  $progressFill.style.width = pct+'%';
  $progressText.textContent = pct+'%';
  $speedFill.style.width = Math.round(speed*100)+'%';
}

//Particles
function spawnRingParticles(x,y, perfect){
  const n = perfect? 22:14;
  const col = perfect? '#ffd84d' : '#7ee6ff';
  for(let i=0;i<n;i++){
    const ang = (i/n)*Math.PI*2;
    const sp = perfect? 180:120;
    particles.push({ x, y, vx: Math.cos(ang)*sp*(0.5+Math.random()*0.5), vy: Math.sin(ang)*sp*(0.5+Math.random()*0.5), life:1, decay: 1.2+Math.random()*0.6, size: 2+Math.random()*3, color:col });
  }
}

// Main loop
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now-last)/1000);
  last=now;
  t += dt;
  update(dt);
  render();
}
function update(dt){
  if(state===STATE.PLAYING){
    // input -> target
    const accel = 620;
    if(input.up) plane.ty -= accel*dt;
    if(input.down) plane.ty += accel*dt;
    if(input.left) plane.tx -= accel*dt;
    if(input.right) plane.tx += accel*dt;
    // friction / return to center when no input?
    if(!input.up && !input.down) plane.ty *= 0.92;
    if(!input.left && !input.right) plane.tx *= 0.92;
    plane.tx = Math.max(-BOUNDS.x, Math.min(BOUNDS.x, plane.tx));
    plane.ty = Math.max(-BOUNDS.y, Math.min(BOUNDS.y, plane.ty));
    // lerp actual pos to target
    const lerp=  7*dt;
    plane.x += (plane.tx - plane.x) * Math.min(1, lerp*1.2);
    plane.y += (plane.ty - plane.y) * Math.min(1, lerp*1.2);
    // roll/pitch based on velocity
    const vx = (plane.tx - plane.x) * 0.02;
    const vy = (plane.ty - plane.y) * 0.02;
    plane.roll += ( -vx*0.9 - plane.roll) * 6*dt;
    plane.pitch += ( vy*0.6 - plane.pitch) * 6*dt;
    plane.prop += dt* 46 * (0.7+speed*0.6);
    // auto speed ramp
    const targetSpeed = 0.62 + Math.sin(t*0.23)*0.05 + (ringsCleared/TOTAL_RINGS)*0.18;
    speed += (targetSpeed - speed)* 0.8*dt;
    setEnginePitch(speed);
    // boundaries check — ceiling/ground
    if(plane.y < -BOUNDS.y+2){
      lives--; plane.shake=12; beep(160,0.2,'square',0.18);
      plane.ty = -BOUNDS.y+18; plane.y=-BOUNDS.y+18;
      flashCenter('Ceiling! Pull down ↓', 900);
      if(lives<=0) triggerCrash('You stalled at the ceiling.');
    }
    if(plane.y > BOUNDS.y-6){
      lives--; plane.shake=12; beep(160,0.22,'square',0.18);
      plane.ty = BOUNDS.y-22; plane.y=BOUNDS.y-22;
      flashCenter('Ground! Pull up ↑', 900);
      if(lives<=0) triggerCrash('You scraped the ground.');
    }
    // move world forward (rings approach)
    const forward = 520 * speed * dt * 60; // scale: ~310 per frame at 60fps? adjust: 520*speed*dt*60 => 520*0.6*0.016*60~300
    // Actually use dt* 900*speed
    const fwd = 780 * speed * dt;
    // We'll not move clouds/plane z; instead move rings/hazards z -= fwd
    for(const r of rings){
      if(r.passed) continue;
      r.z -= fwd* 420 * 0.01 * 60; // tune: make ~ 420*? Let's directly: fwd already includes speed, so rings need faster
    }
    // Simplify: move all by constant
    // Reset above miscalc: Let's do straightforward per frame shift
  }
  // Independent motion even when paused/ready for aesthetics? keep clouds drifting only when playing
  if(state===STATE.PLAYING){
    const drift = 520 * speed * dt; // world units per frame
    for(const r of rings) r.z -= drift * 1.8;
    for(const h of hazards) h.z -= drift * 1.8;
    // clouds
    for(const c of clouds){
      c.z -= drift * c.layer.speed * 0.9;
      c.wob += dt*0.8;
      if(c.z < 18){
        // respawn far
        c.z = 900 + Math.random()*600;
        c.x = (Math.random()*2-1)*520;
        c.y = (Math.random()*2-1)*260;
      }
    }
    clouds.sort((a,b)=>b.z-a.z);
    // check ring pass
    for(const r of rings){
      if(r.passed) continue;
      if(r.z <= 18 && r.z > -70){
        // collision check at plane position
        // project radius to world check: use distance in world plane
        const dx = r.x - plane.x;
        const dy = r.y - plane.y;
        const dist = Math.hypot(dx,dy);
        const hitRadius = r.r;
        if(dist < hitRadius*0.92){
          const perfect = dist < hitRadius*0.34;
          r.passed=true; r.state='cleared';
          ringsCleared++; combo++; bestCombo=Math.max(bestCombo,combo);
          const pts = perfect ? 75 : 25;
          const comboBonus = combo>1 ? (combo-1)*10 : 0;
          score += pts + comboBonus;
          updateHUD();
          const p = project(r.x, r.y, Math.max(18, r.z));
          spawnRingParticles(p.x, p.y, perfect);
          flashCenter(perfect? `PERFECT! +${pts+comboBonus}` : `+${pts+comboBonus}`, 700);
          chord();
          if(perfect) plane.shake = 2;
          if(ringsCleared>=TOTAL_RINGS){ triggerWin(); }
        } else if(r.z <= -28){
          // missed without passing? mark as missed when z passes far behind
          if(!r.passed){
            r.passed=true; r.state='missed';
            combo=0; updateHUD();
            flashCenter('Missed!', 600);
            beep(220,0.16,'sine',0.15);
            // missed penalty shake small
            plane.shake = 5;
          }
        }
      } else if(r.z < -90 && !r.passed){
        // auto miss if it went behind without trigger (fallback)
        r.passed=true; r.state='missed'; combo=0; updateHUD();
      }
    }
    // hazards collision
    for(const h of hazards){
      if(h.hit) continue;
      if(h.z < 42 && h.z > -18){
        const dx = h.x - plane.x;
        const dy = h.y - plane.y;
        const hr = h.type==='balloon' ? 48 : 62;
        if(Math.hypot(dx,dy) < hr*0.62){
          h.hit=true;
          lives--; combo=0; updateHUD();
          plane.shake = 14;
          score = Math.max(0, score - 15);
          flashCenter(h.type==='balloon'?'Pop! -15':'Storm! -15', 700);
          crashSound();
          // hazard particles
          const p = project(h.x,h.y, h.z);
          for(let i=0;i<12;i++) particles.push({ x:p.x, y:p.y, vx:(Math.random()*2-1)*220, vy:(Math.random()*2-1)*220, life:1, decay:1.1, size:3, color: h.type==='balloon'?'#ff6b6b':'#6b7280'});
          if(lives<=0){
            triggerCrash(h.type==='balloon'?'Popped too many balloons!':'Lost in storm clouds.');
          }
        }
      }
      if(h.z < -60 && !h.hit){
        // recycle
        h.z = 900 + Math.random()*800;
        h.x = (Math.random()*2-1)*380;
        h.y = (Math.random()*2-1)*150;
        h.hit=false;
      }
    }
    // decay shake
    plane.shake *= 0.88;
    if(Math.abs(plane.shake)<0.2) plane.shake=0;
  } else {
    // gentle idle bob
    plane.prop += dt*12;
    plane.shake *= 0.92;
  }
  // particles update always
  for(const p of particles){
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 420*dt; p.life -= dt * p.decay;
  }
  particles = particles.filter(p=> p.life>0);
  updateHUD();
}

function render(){
  // shake offset
  const sx = (Math.random()*2-1)*(plane.shake*0.35);
  const sy = (Math.random()*2-1)*(plane.shake*0.35);
  ctx.save();
  ctx.translate(sx,sy);
  // Sky gradient
  const grad = ctx.createLinearGradient(0,0,0,720);
  grad.addColorStop(0,'#5eb8f0');
  grad.addColorStop(0.42,'#b8e2fb');
  grad.addColorStop(0.62,'#dff1ff');
  grad.addColorStop(0.76,'#fff6d6');
  grad.addColorStop(1,'#cfe8ff');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,1280,720);

  // Sun
  ctx.save();
  ctx.globalAlpha=0.95;
  const sunGrad = ctx.createRadialGradient(1020,132,14,1020,132,74);
  sunGrad.addColorStop(0,'#fffef5');
  sunGrad.addColorStop(0.45,'#ffef9a');
  sunGrad.addColorStop(1,'rgba(255,239,154,0)');
  ctx.fillStyle=sunGrad;
  ctx.beginPath(); ctx.arc(1020,132,74,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fffef0';
  ctx.beginPath(); ctx.arc(1020,132,22,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Distant mountains / horizon haze
  ctx.fillStyle='rgba(120,160,196,0.22)';
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.bezierCurveTo(180, 382, 320, 405, 520, 398);
  ctx.bezierCurveTo(720, 390, 840, 418, 1020, 402);
  ctx.bezierCurveTo(1120, 395, 1200, 410, 1280, 398);
  ctx.lineTo(1280, 465); ctx.lineTo(0,465); ctx.closePath(); ctx.fill();

  ctx.fillStyle='rgba(90,130,170,0.18)';
  ctx.beginPath();
  ctx.moveTo(0,430); ctx.lineTo(210,388); ctx.lineTo(340,422); ctx.lineTo(560,372); ctx.lineTo(740,418); ctx.lineTo(920,378); ctx.lineTo(1080,430); ctx.lineTo(1280,398); ctx.lineTo(1280,470); ctx.lineTo(0,470); ctx.closePath(); ctx.fill();

  // Horizon line
  ctx.strokeStyle='rgba(255,255,255,0.55)';
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(0, 442); ctx.lineTo(1280, 442); ctx.stroke();

  // Ground haze
  const ggrad = ctx.createLinearGradient(0,442,0,720);
  ggrad.addColorStop(0,'rgba(208,233,255,0.9)');
  ggrad.addColorStop(1,'rgba(167,205,240,0.95)');
  ctx.fillStyle=ggrad;
  ctx.fillRect(0,442,1280,278);

  // Subtle ground grid (perspective lines)
  ctx.strokeStyle='rgba(255,255,255,0.22)';
  ctx.lineWidth=1;
  for(let i=-6;i<=6;i++){
    const gx = CX + i*86;
    ctx.beginPath(); ctx.moveTo(gx,442); ctx.lineTo(CX + i*260,720); ctx.stroke();
  }
  for(let y=470; y<720; y+=36){
    const t = (y-442)/(720-442);
    const alpha = 0.14*(1-t);
    ctx.strokeStyle=`rgba(255,255,255,${alpha})`;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1280,y); ctx.stroke();
  }

  // Clouds (back to front already sorted)
  for(const c of clouds){
    const p = project(c.x, c.y, c.z);
    if(p.s<0.025 || p.s>2) continue;
    // don't draw clouds that are too close behind plane (z < 18)
    if(c.z<22) continue;
    const alpha = c.layer.alpha * Math.min(1, p.s*1.9) * 0.95;
    // shadow
    ctx.fillStyle=`rgba(26,35,64,${alpha*0.08})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+14*p.s, c.layer.size*1.1*p.s, c.layer.size*0.45*p.s, 0,0,Math.PI*2); ctx.fill();
    // puffs
    for(const puff of c.puffs){
      const px = p.x + puff.dx * p.s;
      const py = p.y + puff.dy * p.s + Math.sin(c.wob + puff.dx*0.01)*2*p.s;
      const r = puff.r * p.s;
      // puff gradient
      const pg = ctx.createRadialGradient(px-r*0.3, py-r*0.3, r*0.2, px, py, r);
      pg.addColorStop(0, `rgba(255,255,255,${alpha})`);
      pg.addColorStop(1, `rgba(230,244,255,${alpha*0.95})`);
      ctx.fillStyle=pg;
      ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
      // highlight top
      ctx.fillStyle=`rgba(255,255,255,${alpha*0.45})`;
      ctx.beginPath(); ctx.ellipse(px-r*0.18, py-r*0.22, r*0.42, r*0.32, 0,0,Math.PI*2); ctx.fill();
    }
  }

  // Rings & hazards (together sorted by z far -> near for correct overlap)
  const drawables = [];
  for(const r of rings) if(!r.passed && r.z>10 && r.z<1700) drawables.push({kind:'ring', z:r.z, obj:r});
  for(const h of hazards) if(!h.hit && h.z>10 && h.z<1700) drawables.push({kind:'haz', z:h.z, obj:h});
  drawables.sort((a,b)=> b.z - a.z);
  for(const d of drawables){
    if(d.kind==='ring') drawRing(d.obj);
    else drawHazard(d.obj);
  }

  // Plane shadow on ground
  const shadowP = project(plane.x, 0, 55);
  // ground shadow only if plane is over ground region visually
  ctx.fillStyle='rgba(26,35,64,0.13)';
  ctx.beginPath();
  const shScale = 0.38 + Math.max(0, (plane.y)/420)* -0.14;
  ctx.ellipse(CX + plane.x*0.28, 522, 44*shScale, 12*shScale, 0,0,Math.PI*2); ctx.fill();

  // Airplane sprite
  drawPlane(CX + plane.x*1.07, CY + plane.y*0.95);

  // Particles
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // Vignette
  const vig = ctx.createRadialGradient(640,360,420,640,360,820);
  vig.addColorStop(0,'rgba(0,0,0,0)');
  vig.addColorStop(1,'rgba(26,35,64,0.13)');
  ctx.fillStyle=vig;
  ctx.fillRect(0,0,1280,720);

  // Boundary warning flash
  if(state===STATE.PLAYING && (plane.y < -150 || plane.y > 150)){
    ctx.fillStyle=`rgba(255,90,61,${0.09 + Math.abs(Math.sin(t*9))*0.07})`;
    ctx.fillRect(0,0,1280,720);
    ctx.strokeStyle='rgba(255,90,61,0.55)';
    ctx.lineWidth=4;
    ctx.strokeRect(4,4,1272,712);
  }

  ctx.restore();
}

function drawRing(r){
  const p = project(r.x, r.y, r.z);
  if(p.s < 0.015) return;
  const rad = r.r * p.s;
  // culling tiny far rings: fade
  const alpha = Math.min(1, Math.max(0.12, 1 - (r.z-1100)/700));
  // depth cue: slightly darker far
  ctx.save();
  ctx.globalAlpha = alpha;
  // glow outer
  ctx.shadowColor='rgba(255,214,80,0.55)';
  ctx.shadowBlur = 16 * p.s;
  // ring torus: two circles with thickness
  ctx.strokeStyle='#ffd84d';
  ctx.lineWidth = Math.max(2, 7 * p.s);
  ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;
  // inner highlight
  ctx.strokeStyle='rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(1, 2.2 * p.s);
  ctx.beginPath(); ctx.arc(p.x, p.y, rad, -0.85*Math.PI, 0.15*Math.PI); ctx.stroke();
  // thickness inner ring (chevron)
  ctx.strokeStyle='rgba(255,140,60,0.9)';
  ctx.lineWidth = Math.max(1.2, 4.2 * p.s);
  ctx.beginPath(); ctx.arc(p.x, p.y, rad*0.92, 0, Math.PI*2); ctx.stroke();

  // arrow chevrons on ring (indicates fly-through)
  ctx.fillStyle=`rgba(255,255,255,${0.9*alpha})`;
  const chev = 10 * p.s;
  for(let i=0;i<4;i++){
    const a = (i/4)*Math.PI*2 + t*1.2;
    const x = p.x + Math.cos(a)*rad;
    const y = p.y + Math.sin(a)*rad;
    ctx.save(); ctx.translate(x,y); ctx.rotate(a+Math.PI/2);
    ctx.beginPath(); ctx.moveTo(0,-chev); ctx.lineTo(chev*0.7, chev*0.6); ctx.lineTo(-chev*0.7, chev*0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // distance label for far rings
  if(r.z>420 && rad>14){
    ctx.fillStyle=`rgba(26,35,64,${0.72*alpha})`;
    ctx.font=`700 ${Math.max(10, 11*p.s)}px Fredoka`;
    ctx.textAlign='center';
    ctx.fillText(`${Math.round(r.z/10)}m`, p.x, p.y - rad - 10*p.s);
  }
  ctx.restore();
}

function drawHazard(h){
  const p = project(h.x, h.y, h.z);
  if(p.s<0.02) return;
  const s=p.s;
  ctx.save();
  if(h.type==='balloon'){
    // string
    ctx.strokeStyle='rgba(26,35,64,0.35)';
    ctx.lineWidth=1.5*s;
    ctx.beginPath(); ctx.moveTo(p.x, p.y+ 18*s); ctx.lineTo(p.x, p.y+ 44*s); ctx.stroke();
    // balloon body
    const grad = ctx.createRadialGradient(p.x-8*s, p.y-9*s, 4*s, p.x, p.y, 22*s);
    grad.addColorStop(0,'#ff8a8a');
    grad.addColorStop(0.55,'#ff3b3b');
    grad.addColorStop(1,'#a81a1a');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 18*s, 22*s, 0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.42)';
    ctx.beginPath(); ctx.ellipse(p.x-6*s, p.y-8*s, 5*s, 7*s, -0.4,0,Math.PI*2); ctx.fill();
    // knot
    ctx.fillStyle='#8a1a1a';
    ctx.beginPath(); ctx.moveTo(p.x-3*s, p.y+18*s); ctx.lineTo(p.x+3*s, p.y+18*s); ctx.lineTo(p.x, p.y+22*s); ctx.closePath(); ctx.fill();
    // subtle shadow
    ctx.fillStyle='rgba(26,35,64,0.10)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y+14*s, 10*s, 4*s, 0,0,Math.PI*2); ctx.fill();
  } else {
    // storm cloud - dark and spiky
    const r = 38*s;
    ctx.fillStyle='rgba(26,35,64,0.12)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y+12*s, r*1.1, r*0.45, 0,0,Math.PI*2); ctx.fill();
    const cols = ['#4b5563','#374151','#6b7280'];
    for(let i=0;i<3;i++){
      const cx = p.x + (i-1)*12*s;
      const cy = p.y + Math.sin(h.wob+i)*2*s;
      const rr = (18 - i*2)*s;
      ctx.fillStyle=cols[i];
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.fill();
    }
    // lightning hint occasionally
    if(Math.sin(t*2.2 + h.wob*2) > 0.92){
      ctx.strokeStyle='rgba(250,255,120,0.95)';
      ctx.lineWidth=2*s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y+4*s); ctx.lineTo(p.x+4*s, p.y+16*s); ctx.lineTo(p.x-2*s, p.y+28*s); ctx.stroke();
    }
    // warning outline
    ctx.strokeStyle='rgba(255,90,61,0.28)';
    ctx.lineWidth=1.5*s;
    ctx.beginPath(); ctx.arc(p.x, p.y, 32*s, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawPlane(cx, cy){
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll*0.45);
  // Scale with pitch subtle
  const pitchScale = 1 + plane.pitch*0.18;
  ctx.scale(1, pitchScale);

  // shadow under plane
  ctx.fillStyle='rgba(26,35,64,0.14)';
  ctx.beginPath(); ctx.ellipse(4, 18, 34, 7, 0,0,Math.PI*2); ctx.fill();

  // fuselage shadow
  // wings
  ctx.fillStyle='#e6efff';
  ctx.strokeStyle='#1a2340';
  ctx.lineWidth=2.2;
  // bottom wing
  ctx.beginPath();
  ctx.moveTo(-28, 6); ctx.lineTo(18, 4); ctx.lineTo(22, 10); ctx.lineTo(-22, 12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // top wing
  ctx.beginPath();
  ctx.moveTo(-22, -6); ctx.lineTo(16, -8); ctx.lineTo(20, -2); ctx.lineTo(-18, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // struts
  ctx.strokeStyle='#1a2340'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(-8, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(6, 6); ctx.stroke();

  // fuselage
  const fusGrad = ctx.createLinearGradient(-36,0,36,0);
  fusGrad.addColorStop(0,'#ff7a5a');
  fusGrad.addColorStop(0.5,'#ff3b3b');
  fusGrad.addColorStop(1,'#d92020');
  ctx.fillStyle=fusGrad;
  ctx.strokeStyle='#1a2340'; ctx.lineWidth=2.2;
  ctx.beginPath();
  // nose to tail
  ctx.moveTo(38, 0);
  ctx.bezierCurveTo(30, -9, 10, -10, -14, -6);
  ctx.lineTo(-32, -5);
  ctx.lineTo(-36, 0);
  ctx.lineTo(-32, 5);
  ctx.lineTo(-14, 6);
  ctx.bezierCurveTo(10, 10, 30, 9, 38, 0);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // cockpit
  ctx.fillStyle='#bfe6ff';
  ctx.strokeStyle='#1a2340'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.ellipse(8, -5.5, 14, 7.5, 0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.72)';
  ctx.beginPath(); ctx.ellipse(3, -7.5, 6, 3.2, -0.2,0,Math.PI*2); ctx.fill();

  // tail fin
  ctx.fillStyle='#ff3b3b'; ctx.strokeStyle='#1a2340'; ctx.lineWidth=1.8;
  ctx.beginPath(); ctx.moveTo(-28, -4); ctx.lineTo(-36, -18); ctx.lineTo(-22, -18); ctx.lineTo(-20, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
  // tail stripe
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(-30, -12); ctx.lineTo(-26, -12); ctx.lineTo(-24, -9); ctx.lineTo(-30, -9); ctx.closePath(); ctx.fill();

  // propeller blur
  const propX = 38;
  ctx.save(); ctx.translate(propX, 0);
  // hub
  ctx.fillStyle='#1a2340'; ctx.beginPath(); ctx.arc(0,0,4.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd84d'; ctx.beginPath(); ctx.arc(0,0,2.2,0,Math.PI*2); ctx.fill();
  // blades (blur disc when spinning)
  if(state===STATE.PLAYING || plane.prop>0){
    const a = plane.prop;
    ctx.strokeStyle='rgba(26,35,64,0.22)';
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.ellipse(0,0, 28, 5, a, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,0, 28, 5, a+Math.PI/2, 0, Math.PI*2); ctx.stroke();
    // motion streak
    ctx.fillStyle='rgba(255,255,255,0.26)';
    ctx.beginPath(); ctx.ellipse(0,0,26,9,0,0,Math.PI*2); ctx.fill();
  } else {
    ctx.strokeStyle='#1a2340'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(-22,0); ctx.lineTo(22,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(0,22); ctx.stroke();
  }
  ctx.restore();

  // engine exhaust puff when boosting
  if(state===STATE.PLAYING && speed>0.62){
    ctx.fillStyle=`rgba(255,220,120,${0.18 + speed*0.1})`;
    ctx.beginPath(); ctx.ellipse(-38, 0, 10, 4, 0,0,Math.PI*2); ctx.fill();
  }

  // wind streaks
  ctx.strokeStyle='rgba(255,255,255,0.55)';
  ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-44, -2); ctx.lineTo(-54, -2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-40, 3); ctx.lineTo(-50, 3); ctx.stroke();

  ctx.restore();
}

// Init
resetGame();
requestAnimationFrame(frame);

// Expose for tests
window.__game = {
  get state(){ return state; },
  get score(){ return score; },
  get ringsCleared(){ return ringsCleared; },
  get lives(){ return lives; },
  get TOTAL_RINGS(){ return TOTAL_RINGS; },
  project,
  plane,
  rings,
  hazards,
  clouds,
  resetGame, startGame, triggerCrash, triggerWin,
};

// Tidepool Tangle — canvas game
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudScore = document.getElementById('score-text');
const hudTimer = document.getElementById('timer-text');
const hudTimerPill = document.getElementById('hud-timer');
const hudStatus = document.getElementById('status-text');

const overlayStart = document.getElementById('overlay-start');
const overlayWin = document.getElementById('overlay-win');
const overlayLose = document.getElementById('overlay-lose');

const W = 920, H = 540;
const CRAB_R = 18;
const SPEED = 220; // px/s
const SHELL_COUNT = 5;
const STARFISH_COUNT = 2;
const TOTAL_TIME = 60;

let state = 'start'; // start, playing, won, lost
let timeLeft = TOTAL_TIME;
let score = 0;
let keys = new Set();
let crab = { x: 80, y: H - 70, vx:0, vy:0, angle:0, invuln:0, submerged:0, pushVy:0 };
let shells = [];
let starfish = [];
let particles = [];
let safeRock = { x: W - 150, y: 22, w: 130, h: 76, r: 18 };
let wave = { y: H + 40, active:false, phase:0, cooldown: 2.2, speed: 0, peak: 195 };
let lastTime = 0;
let collected = 0;

// DPR crisp canvas
const dpr = Math.min(window.devicePixelRatio||1, 2);
(function setupDPR(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr,0,0,dpr,0,0);
})();

// Audio (WebAudio, no external files)
let audioCtx=null;
function getAudio(){ if(!audioCtx) try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch{} return audioCtx; }
function beep(freq=520, dur=0.12, vol=0.18, type='sine'){
  const ac=getAudio(); if(!ac) return;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type; o.frequency.value=freq; g.gain.value=vol;
  o.connect(g); g.connect(ac.destination);
  o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur); o.stop(ac.currentTime+dur);
}
function whoosh(intensity=1){
  const ac=getAudio(); if(!ac) return;
  const o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
  f.type='lowpass'; f.frequency.value=900*intensity;
  o.type='sawtooth'; o.frequency.setValueAtTime(120, ac.currentTime); o.frequency.linearRampToValueAtTime(60, ac.currentTime+0.9);
  g.gain.setValueAtTime(0.12*intensity, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime+0.9);
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime+0.95);
}
let waveSoundPhase=-1;

function rand(a,b){ return a + Math.random()*(b-a); }

function resetGame(){
  timeLeft = TOTAL_TIME;
  score = 0; collected = 0;
  crab = { x: 90, y: H - 58, vx:0, vy:0, angle:0, invuln:0, submerged:0, pushVy:0 };
  waveSoundPhase=-1;
  shells = [];
  // place shells in tidepool area avoiding rock and start zone
  for(let i=0;i<SHELL_COUNT;i++){
    let tries=0;
    while(tries<80){
      const x = rand(140, W-80);
      const y = rand(110, H-120);
      const dRock = Math.hypot(x - (safeRock.x+safeRock.w/2), y - (safeRock.y+safeRock.h/2));
      const dCrab = Math.hypot(x-crab.x, y-crab.y);
      if(dRock>90 && dCrab>70){
        // avoid overlap with other shells
        let ok=true;
        for(const s of shells){ if(Math.hypot(s.x-x,s.y-y)<55) ok=false; }
        if(ok){ shells.push({x,y,r:16,collected:false, bob: rand(0,Math.PI*2)}); break; }
      }
      tries++;
    }
  }
  // ensure 5
  while(shells.length<SHELL_COUNT){
    shells.push({x:rand(200,W-200),y:rand(140,H-140),r:16,collected:false,bob:0});
  }
  starfish = [];
  for(let i=0;i<STARFISH_COUNT;i++){
    starfish.push({
      x: rand(260, W-220),
      y: rand(160, H-160),
      vx: (i===0? 70: -65) * (Math.random()>0.5?1:-1),
      vy: (i===0? 38: -42) * (Math.random()>0.5?1:-1),
      r: 22, rot: rand(0,Math.PI*2), rotSpeed: rand(-0.9,0.9),
      patrol: i===0 ? {minX:180,maxX:W-170,minY:130,maxY:H-130} : {minX:200,maxX:W-120,minY:150,maxY:H-110}
    });
  }
  particles=[];
  // randomize peak so low tide leaves beach walkable (190-250)
  const peak = 190 + Math.random()*60;
  wave = { y: H + 40, active:true, phase:0, cooldown: 2.6, speed: 0, peak, dir: -1 };
  updateHUD();
  updateWaveHUD(0);
}

function setState(s){
  state = s;
  overlayStart.classList.toggle('hidden', s!=='start');
  overlayWin.classList.toggle('hidden', s!=='won');
  overlayLose.classList.toggle('hidden', s!=='lost');
  if(s==='playing') lastTime = performance.now();
}

function updateHUD(){
  hudScore.textContent = `${collected} / ${SHELL_COUNT} shells`;
  hudTimer.textContent = `${timeLeft.toFixed(1)}s`;
  if(timeLeft<12) { hudTimerPill.classList.add('danger'); hudTimerPill.classList.remove('warn'); }
  else if(timeLeft<22) { hudTimerPill.classList.add('warn'); hudTimerPill.classList.remove('danger'); }
  else hudTimerPill.classList.remove('warn','danger');
  if(collected>=SHELL_COUNT) hudStatus.textContent = '→ Go to the safe rock!';
  else hudStatus.textContent = collected===0 ? 'Collect shells!' : `${SHELL_COUNT-collected} left`;
  if(state==='won') hudStatus.textContent = 'You won! 🎉';
  if(state==='lost') hudStatus.textContent = 'Game over';
}
const hudWave = document.getElementById('hud-wave');
const hudWaveText = document.getElementById('wave-text');
const hudWaveFill = document.getElementById('wave-bar-fill');
const canvasShell = document.getElementById('canvas-shell');
function updateWaveHUD(tRatio){
  // t is wave cycle progress normalized 0-1; we map to phases for display
  const t = wave.phase % 6.2;
  let label='Calm', cls='', fill=0;
  if(t < 0.8){ label='Calm'; fill=6; }
  else if(t < 2.0){ label='Swell building…'; cls='rising'; fill=((t-0.8)/1.2)*42; }
  else if(t < 3.6){ label='🌊 Wave rising!'; cls='warning'; fill=42 + ((t-2.0)/1.6)*40; }
  else if(t < 4.4){ label='🌊 Peak — stay high!'; cls='danger'; fill=82 + ((t-3.6)/0.8)*18; }
  else { label='Receding'; cls='rising'; fill=100 - ((t-4.4)/1.8)*94; }
  hudWaveText.textContent = label;
  hudWave.className='hud-pill wave-pill '+(cls||'');
  hudWaveFill.style.width = Math.max(4, Math.min(100, fill))+'%';
  // shake intensity at peak
  if(cls==='danger' && state==='playing' && t>3.7 && t<4.3 && Math.random()<0.09){
    canvasShell.classList.remove('shake'); void canvasShell.offsetWidth; canvasShell.classList.add('shake');
    setTimeout(()=>canvasShell.classList.remove('shake'), 340);
  }
}

// Input
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(k)){
    keys.add(k);
    if(state==='playing') e.preventDefault();
  }
  if(k===' '||k==='enter'){
    if(state==='start'){ startGame(); e.preventDefault(); }
    else if(state==='won'||state==='lost'){ startGame(); e.preventDefault(); }
  }
  if(k==='r' && (state==='won'||state==='lost')) startGame();
});
window.addEventListener('keyup', e=>{
  keys.delete(e.key.toLowerCase());
});
// touch dpad
document.querySelectorAll('.dpad button').forEach(btn=>{
  const dir=btn.dataset.dir;
  const map={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
  const k=map[dir];
  const down=(ev)=>{ ev.preventDefault(); keys.add(k); if(state==='start') startGame(); };
  const up=(ev)=>{ ev.preventDefault(); keys.delete(k); };
  btn.addEventListener('touchstart',down,{passive:false});
  btn.addEventListener('touchend',up,{passive:false});
  btn.addEventListener('mousedown',down);
  btn.addEventListener('mouseup',up);
  btn.addEventListener('mouseleave',up);
});
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-again-win').addEventListener('click', startGame);
document.getElementById('btn-again-lose').addEventListener('click', startGame);
document.getElementById('btn-share-win').addEventListener('click', ()=>{
  const t=`I rescued the crab in Tidepool Tangle! 🦀🐚 ${collected}/5 shells in ${(TOTAL_TIME-timeLeft).toFixed(1)}s`;
  if(navigator.clipboard) navigator.clipboard.writeText(t);
  const el=document.getElementById('win-text');
  el.textContent = t + ' — copied!';
  setTimeout(()=> el.textContent=`You reached the safe rock with all 5 shells!`, 1800);
});

function startGame(){
  const ac=getAudio(); if(ac && ac.state==='suspended') ac.resume();
  resetGame();
  setState('playing');
  // small kick to avoid immediate wave hit at spawn
  crab.invuln = 0.8;
  beep(620,0.09,0.14,'sine');
}

function lose(reason, title){
  if(state!=='playing') return;
  state='lost';
  overlayLose.classList.remove('hidden');
  document.getElementById('lose-title').textContent = title || 'Game Over';
  document.getElementById('lose-text').textContent = reason;
  document.getElementById('lose-stats').textContent = `Shells: ${collected}/${SHELL_COUNT} • Time left: ${timeLeft.toFixed(1)}s`;
  document.getElementById('lose-hint').textContent = collected>=SHELL_COUNT ? 'You had all shells — just needed the rock!' : 'Try skirting the wave foam and keeping distance from starfish.';
  updateHUD();
  spawnBurst(crab.x,crab.y,'#4fc3d8',14);
}

function win(){
  if(state!=='playing') return;
  state='won';
  overlayWin.classList.remove('hidden');
  document.getElementById('win-stats').textContent = `Time: ${(TOTAL_TIME-timeLeft).toFixed(1)}s • Score: ${score} • Flawless crab!`;
  updateHUD();
  for(let i=0;i<22;i++) spawnBurst(safeRock.x+safeRock.w/2, safeRock.y+safeRock.h/2, i%2?'#ffd166':'#ff6b35', 8);
}

function spawnBurst(x,y,color,n=8){
  for(let i=0;i<n;i++){
    particles.push({x,y,vx: rand(-140,140), vy: rand(-180,-20), life: rand(0.45,0.9), t:0, r: rand(3,6), color, ay: 320});
  }
}
function spawnShellPop(x,y){
  for(let i=0;i<10;i++) particles.push({x,y,vx:rand(-120,120),vy:rand(-160,-10),life:rand(0.5,0.85),t:0,r:rand(2,5),color:'#ffd166', ay:280});
  beep(880,0.08,0.12,'triangle'); setTimeout(()=>beep(1100,0.07,0.08,'triangle'), 70);
}

// Game loop
function update(dt){
  if(state!=='playing') return;
  timeLeft -= dt;
  if(timeLeft<=0){ timeLeft=0; updateHUD(); lose('Time ran out! The tide swallowed the beach.', 'Time’s Up ⏱'); return; }

  // crab movement
  let mx=0,my=0;
  if(keys.has('arrowup')||keys.has('w')) my-=1;
  if(keys.has('arrowdown')||keys.has('s')) my+=1;
  if(keys.has('arrowleft')||keys.has('a')) mx-=1;
  if(keys.has('arrowright')||keys.has('d')) mx+=1;
  if(mx!==0||my!==0){
    const len=Math.hypot(mx,my)||1; mx/=len; my/=len;
    crab.vx = mx*SPEED; crab.vy = my*SPEED;
    crab.angle = Math.atan2(my,mx);
  } else {
    crab.vx *= 0.82; crab.vy *= 0.82;
    if(Math.hypot(crab.vx,crab.vy)<8){ crab.vx=0; crab.vy=0; }
  }
  // apply wave push if submerged
  if(crab.pushVy) { crab.y += crab.pushVy*dt; crab.pushVy *= 0.90; if(Math.abs(crab.pushVy)<6) crab.pushVy=0; }
  crab.x += crab.vx*dt;
  crab.y += crab.vy*dt;
  crab.x = Math.max(CRAB_R+6, Math.min(W - CRAB_R - 6, crab.x));
  crab.y = Math.max(CRAB_R+10, Math.min(H - CRAB_R - 10, crab.y));
  if(crab.invuln>0) crab.invuln -= dt;

  // wave cycle: every ~6s a wave sweeps
  wave.phase += dt;
  const CYCLE = 6.2; // seconds per full cycle
  const t = wave.phase % CYCLE;
  // timeline: 0-0.8 wait low, 0.8-3.6 rise, 3.6-4.4 hold at peak, 4.4-6.2 recede
  let targetY;
  if(t < 0.8) targetY = H + 42;
  else if(t < 3.6) {
    const k = (t-0.8)/2.8; // 0..1
    const ease = 1 - Math.pow(1-k, 2.2);
    targetY = (H+42) - ease * ((H+42) - wave.peak - Math.sin(t*6)*4);
  } else if(t < 4.4) targetY = wave.peak + Math.sin(t*7)*3;
  else {
    const k=(t-4.4)/1.8;
    const ease = Math.pow(k, 1.6);
    targetY = wave.peak + ease * ((H+42)-wave.peak);
  }
  // smooth
  wave.y += (targetY - wave.y) * Math.min(1, dt*6);
  updateWaveHUD();
  // audio telegraph: whoosh at rise start (t ~0.9) and peak
  const phaseBucket = t<0.8?0: t<2.0?1: t<3.6?2: t<4.4?3:4;
  if(phaseBucket===1 && waveSoundPhase!==1){ waveSoundPhase=1; whoosh(0.55); }
  if(phaseBucket===2 && waveSoundPhase!==2){ waveSoundPhase=2; whoosh(0.95); }
  if(phaseBucket===0 && waveSoundPhase!==0) waveSoundPhase=0;

  // starfish
  for(const s of starfish){
    s.x += s.vx*dt; s.y += s.vy*dt;
    s.rot += s.rotSpeed*dt;
    if(s.x < s.patrol.minX){ s.x=s.patrol.minX; s.vx = Math.abs(s.vx); }
    if(s.x > s.patrol.maxX){ s.x=s.patrol.maxX; s.vx = -Math.abs(s.vx); }
    if(s.y < s.patrol.minY){ s.y=s.patrol.minY; s.vy = Math.abs(s.vy); }
    if(s.y > s.patrol.maxY){ s.y=s.patrol.maxY; s.vy = -Math.abs(s.vy); }
    // slight randomness
    if(Math.random()<0.015){ s.vx += rand(-18,18); s.vy += rand(-18,18); s.vx=Math.max(-90,Math.min(90,s.vx)); s.vy=Math.max(-75,Math.min(75,s.vy)); }
  }

  // shell collection
  for(const sh of shells){
    sh.bob += dt*2.4;
    if(sh.collected) continue;
    const d=Math.hypot(crab.x-sh.x, crab.y-sh.y);
    if(d < CRAB_R + sh.r -2){
      sh.collected=true; collected++; score+=100; updateHUD(); spawnShellPop(sh.x,sh.y);
      // brief safe flash
      crab.invuln = 0.35;
    }
  }

  // wave collision — push instead of instant kill (fair telegraph)
  const overRock = crab.x > safeRock.x-10 && crab.y < safeRock.y+safeRock.h+18;
  const inWater = crab.y + 8 > wave.y - 10 && !overRock;
  if(inWater){
    if(crab.invuln<=0){
      // push crab down with wave, tint and splash
      const push = (wave.y < H*0.55) ? 140 : 85;
      crab.pushVy = push;
      crab.submerged += dt;
      crab.invuln = 0.22;
      if(crab.submerged < 0.35) spawnBurst(crab.x, wave.y, 'rgba(255,255,255,0.9)', 3);
      // shake burst when first hitting
      if(crab.submerged < 0.18){
        canvasShell.classList.remove('shake'); void canvasShell.offsetWidth; canvasShell.classList.add('shake');
        setTimeout(()=>canvasShell.classList.remove('shake'), 280);
      }
      // only die if submerged >1.15s continuously or pushed off bottom
      if(crab.submerged > 1.15 || crab.y >= H - CRAB_R - 11){
        lose('The tide held you under too long — keep to high ground when the foam rises!', 'Swept Away 🌊');
        return;
      }
    }
  } else {
    crab.submerged = Math.max(0, crab.submerged - dt*3);
    crab.pushVy *= 0.92;
  }

  // starfish collision — bounce with invuln instead of instant kill if lightly grazed? Keep kill but with feedback
  if(crab.invuln<=0){
    for(const s of starfish){
      const d=Math.hypot(crab.x-s.x, crab.y-s.y);
      if(d < CRAB_R + s.r - 3){
        // if moving fast into starfish, bounce back first, then kill on second hit
        if(crab.invuln<=0 && Math.hypot(crab.vx,crab.vy)>80){
          // knockback
          const nx=(crab.x-s.x)/(d||1), ny=(crab.y-s.y)/(d||1);
          crab.x += nx*12; crab.y += ny*12;
          crab.vx = nx*180; crab.vy = ny*180;
          crab.pushVy = ny*60;
          crab.invuln=0.55;
          spawnBurst(s.x,s.y,'#ff7a6b',6);
          beep(180,0.18,0.16,'square');
          // still lose — but now with visible bounce so player sees why
          // delay 0.12s to show bounce before overlay
          setTimeout(()=>{ if(state==='playing') lose('A spiky starfish blocked your path!', 'Starfish Sting ⭐'); }, 110);
          return;
        }
        lose('A spiky starfish blocked your path!', 'Starfish Sting ⭐');
        return;
      }
    }
  }

  // win: on safe rock with all shells
  if(collected>=SHELL_COUNT){
    const inRock = crab.x > safeRock.x+8 && crab.x < safeRock.x+safeRock.w-8 && crab.y > safeRock.y+8 && crab.y < safeRock.y+safeRock.h-4;
    if(inRock){
      score += Math.round(timeLeft*10);
      win();
      return;
    }
  }

  // particles
  for(const p of particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.ay*dt; p.vx*=0.99; }
  particles = particles.filter(p=> p.t < p.life);

  updateHUD();
}

function draw(){
  // background: sand + tidepool + sea bottom
  // sky gradient strip at top is css, but canvas top is beach
  ctx.clearRect(0,0,W,H);

  // sand base
  const sandGrad = ctx.createLinearGradient(0,0,0,H);
  sandGrad.addColorStop(0, '#fdf3d0');
  sandGrad.addColorStop(0.22, '#f6e7c2');
  sandGrad.addColorStop(0.55, '#e8c99a');
  sandGrad.addColorStop(1, '#d7b67e');
  ctx.fillStyle=sandGrad; ctx.fillRect(0,0,W,H);

  // subtle sand speckles
  ctx.fillStyle='rgba(0,0,0,0.06)';
  for(let i=0;i<90;i++){
    const x=(i*97)%W, y=(i*53)%H;
    ctx.beginPath(); ctx.arc(x, y, (i%3)+0.6,0,Math.PI*2); ctx.fill();
  }

  // tidepool ellipse (center)
  ctx.save();
  ctx.fillStyle='#7fd8e6';
  // outer pool
  ctx.beginPath(); ctx.ellipse(W/2, H/2+18, 360, 176, 0, 0, Math.PI*2); ctx.fill();
  // inner deeper
  const poolGrad = ctx.createRadialGradient(W/2, H/2+10, 60, W/2, H/2+18, 360);
  poolGrad.addColorStop(0,'#baf0f7'); poolGrad.addColorStop(0.5,'#7fd8e6'); poolGrad.addColorStop(1,'#4fc3d8');
  ctx.fillStyle=poolGrad;
  ctx.beginPath(); ctx.ellipse(W/2, H/2+22, 340, 162, 0,0,Math.PI*2); ctx.fill();
  // pool border sand rim
  ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=3; ctx.stroke();
  ctx.restore();

  // decorative pebbles around pool
  ctx.fillStyle='rgba(138,122,106,0.22)';
  const pebs=[[120,120],[180,90],[720,110],[800,140],[160,420],[780,400],[260,470],[640,470]];
  pebs.forEach(([x,y])=>{ ctx.beginPath(); ctx.ellipse(x,y,14,9, rand(-0.4,0.4),0,Math.PI*2); ctx.fill(); });

  // safe rock (top right)
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.22)'; ctx.shadowBlur=12; ctx.shadowOffsetY=6;
  // shadow base
  ctx.fillStyle='#8a7a6a';
  roundRect(safeRock.x, safeRock.y, safeRock.w, safeRock.h, safeRock.r);
  ctx.fill();
  // highlight
  ctx.shadowColor='transparent';
  ctx.fillStyle='#a99a8a';
  roundRect(safeRock.x+8, safeRock.y+8, safeRock.w-22, safeRock.h-26, 12);
  ctx.fill();
  // safe flag
  ctx.fillStyle='#ff6b35';
  ctx.fillRect(safeRock.x+safeRock.w/2-1, safeRock.y-18, 3, 22);
  ctx.fillStyle='#ffd166';
  ctx.beginPath(); ctx.moveTo(safeRock.x+safeRock.w/2+2, safeRock.y-18); ctx.lineTo(safeRock.x+safeRock.w/2+22, safeRock.y-12); ctx.lineTo(safeRock.x+safeRock.w/2+2, safeRock.y-6); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='700 10px system-ui, sans-serif'; ctx.fillText('SAFE', safeRock.x+safeRock.w/2+5, safeRock.y-8);
  // rock texture dots
  ctx.fillStyle='rgba(0,0,0,0.1)';
  [[-28,12],[-8,18],[18,10],[32,22]].forEach(([dx,dy])=>{ ctx.beginPath(); ctx.arc(safeRock.x+safeRock.w/2+dx, safeRock.y+safeRock.h/2+dy, 3,0,Math.PI*2); ctx.fill(); });
  ctx.restore();
  // label
  ctx.fillStyle='#5a4a3a'; ctx.font='700 11px system-ui, sans-serif'; ctx.textAlign='center';
  ctx.fillText('SAFE ROCK', safeRock.x+safeRock.w/2, safeRock.y+safeRock.h+13);
  ctx.textAlign='left';

  // shells
  for(const sh of shells){
    if(sh.collected) continue;
    const bob = Math.sin(sh.bob)*4;
    const y = sh.y + bob;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y+16, 14, 6, 0,0,Math.PI*2); ctx.fill();
    // shell body
    ctx.save(); ctx.translate(sh.x,y);
    ctx.rotate(Math.sin(sh.bob*0.6)*0.18);
    // outer
    ctx.fillStyle='#ffd166'; ctx.strokeStyle='#e8a93a'; ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(0,-14);
    ctx.bezierCurveTo(12,-10,14,6,0,13);
    ctx.bezierCurveTo(-14,6,-12,-10,0,-14);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // ridges
    ctx.strokeStyle='rgba(232,169,58,0.65)'; ctx.lineWidth=1.1;
    for(let r=-7;r<=7;r+=4){ ctx.beginPath(); ctx.moveTo(r*0.9,-10); ctx.lineTo(r*0.55,9); ctx.stroke(); }
    // shine
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(-4,-6,3.2,4.5,-0.4,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // sparkle
    if(Math.sin(sh.bob*2.2)>0.85){
      ctx.fillStyle='rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(sh.x+10, y-10, 1.8,0,Math.PI*2); ctx.fill();
    }
  }

  // starfish
  for(const s of starfish){
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(s.rot);
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.beginPath(); ctx.ellipse(4,10,18,9,0,0,Math.PI*2); ctx.fill();
    // body
    ctx.fillStyle='#ff7a6b'; ctx.strokeStyle='#d94f3f'; ctx.lineWidth=2;
    drawStar(0,0,5, s.r, s.r*0.48);
    ctx.fill(); ctx.stroke();
    // center
    ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(0,0,5.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-3,-4,1.9,0,Math.PI*2); ctx.fill();
    // tiny dots
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(6,2,1.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // crab (drawn BEFORE wave so wave can wash over — fixes floating-crab lie)
  ctx.save(); ctx.translate(crab.x, crab.y);
  const isSubmerged = crab.y + 6 > wave.y - 6 && !(crab.x > safeRock.x-10 && crab.y < safeRock.y+safeRock.h+18);
  // shadow (hidden when submerged deep)
  if(!isSubmerged || crab.submerged < 0.5){
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(2,14,18,8,0,0,Math.PI*2); ctx.fill();
  }
  // invuln flash + submerged tint
  const flash = crab.invuln>0 && Math.floor(crab.invuln*14)%2===0;
  if(flash) ctx.globalAlpha=0.45;
  if(isSubmerged){
    // blue wash when under water
    ctx.globalAlpha = Math.max(0.35, (flash?0.45:1) * (1 - crab.submerged*0.32));
  }
  // legs
  ctx.strokeStyle= isSubmerged ? '#6a9fb0' : '#c94a1e'; ctx.lineWidth=3.2; ctx.lineCap='round';
  for(let side of [-1,1]){
    for(let i=-1;i<=1;i++){
      ctx.beginPath();
      ctx.moveTo(side*10, 2+i*4);
      ctx.lineTo(side*20 + i*2, 6+i*5);
      ctx.stroke();
    }
  }
  // body
  ctx.fillStyle= isSubmerged ? '#6ab0c6' : '#ff6b35';
  ctx.beginPath(); ctx.ellipse(0,2, CRAB_R+2, CRAB_R-4, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle= isSubmerged ? '#8ac8d6' : '#ff8c52'; ctx.beginPath(); ctx.ellipse(-3,-1, 10,7, -0.2,0,Math.PI*2); ctx.fill();
  // eyes stalks
  ctx.fillStyle= isSubmerged ? '#6ab0c6' : '#ff6b35';
  ctx.fillRect(-10,-16,4,12); ctx.fillRect(6,-16,4,12);
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-8,-16,8,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(8,-16,8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a1a1a'; ctx.beginPath(); ctx.arc(-8 + Math.cos(crab.angle)*1.5,-16 + Math.sin(crab.angle)*1.2,4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(8 + Math.cos(crab.angle)*1.5,-16 + Math.sin(crab.angle)*1.2,4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-6.5,-18,1.6,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(9.5,-18,1.6,0,Math.PI*2); ctx.fill();
  // claws
  ctx.fillStyle= isSubmerged ? '#5a8f9e' : '#e85d2a';
  ctx.beginPath(); ctx.ellipse(-18, 4, 9,7, -0.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(18, 4, 9,7, 0.6,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.ellipse(-21,7,2.2,2.8,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(21,7,2.2,2.8,0,0,Math.PI*2); ctx.fill();
  // smile when near win
  if(collected>=SHELL_COUNT){
    ctx.strokeStyle='#7a2b12'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(0,6,4,0.15,Math.PI-0.15); ctx.stroke();
  }
  // submerged bubble
  if(isSubmerged && crab.submerged>0.25){
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(10,-22 - (crab.submerged*9)%10, 3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(14,-28 - (crab.submerged*13)%12, 1.8,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // wave water (below wave.y) — drawn AFTER crab so crab appears to be washed under
  if(wave.y < H+30){
    ctx.save();
    const grad = ctx.createLinearGradient(0,wave.y,0,H);
    grad.addColorStop(0,'rgba(79,195,216,0.88)');
    grad.addColorStop(0.35,'rgba(49,160,184,0.86)');
    grad.addColorStop(1,'rgba(26,122,138,0.90)');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(0, wave.y);
    for(let x=0;x<=W;x+=14){
      const wy = wave.y + Math.sin(x*0.025 + wave.phase*3.2)*6 + Math.cos(x*0.015 - wave.phase*2.1)*4;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(W, H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
    // foam line — thicker when rising (telegraph)
    const tPhase = wave.phase % 6.2;
    const foamThick = tPhase>0.8 && tPhase<3.6 ? 5 + (tPhase-0.8)*1.2 : 3;
    ctx.strokeStyle='rgba(255,255,255,0.97)'; ctx.lineWidth=foamThick;
    ctx.beginPath();
    for(let x=0;x<=W;x+=10){
      const wy = wave.y + Math.sin(x*0.025 + wave.phase*3.2)*6 + Math.cos(x*0.015 - wave.phase*2.1)*4;
      if(x===0) ctx.moveTo(x, wy); else ctx.lineTo(x, wy);
    }
    ctx.stroke();
    // second foam highlight (only when rising — telegraph)
    if(tPhase>0.8 && tPhase<3.6){
      ctx.strokeStyle='rgba(255,255,255,0.45)'; ctx.lineWidth=9;
      ctx.beginPath();
      for(let x=0;x<=W;x+=10){
        const wy = wave.y + Math.sin(x*0.025 + wave.phase*3.2)*6 + Math.cos(x*0.015 - wave.phase*2.1)*4;
        if(x===0) ctx.moveTo(x, wy+4); else ctx.lineTo(x, wy+4);
      }
      ctx.stroke();
    }
    // foam bubbles
    ctx.fillStyle='rgba(255,255,255,0.9)';
    for(let x=22;x<W;x+=44){
      const wy = wave.y + Math.sin(x*0.025 + wave.phase*3.2)*6;
      const r = 3 + Math.sin(x+wave.phase)*1.2;
      ctx.beginPath(); ctx.arc(x, wy+2, Math.max(1.5,r),0,Math.PI*2); ctx.fill();
    }
    // danger text when high
    if(wave.y < H*0.62){
      ctx.fillStyle='rgba(255,255,255,0.98)'; ctx.font='800 13px system-ui, sans-serif';
      ctx.fillText('🌊 WAVE RISING — move up!', 14, wave.y+18);
      ctx.font='700 10px system-ui, sans-serif'; ctx.fillStyle='rgba(255,255,255,0.85)';
      ctx.fillText('Hold high ground 1.2s to avoid being swept', 14, wave.y+30);
    } else if(wave.y < H*0.82 && (wave.phase%6.2) > 0.8 && (wave.phase%6.2) < 2.2){
      ctx.fillStyle='rgba(255,255,255,0.92)'; ctx.font='700 11px system-ui, sans-serif';
      ctx.fillText('↑ swell incoming — head up the beach', 14, wave.y-10);
    }
    ctx.restore();
  }

  // particles
  for(const p of particles){
    const a = 1 - p.t/p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // vignette border
  ctx.strokeStyle='rgba(0,0,0,0.07)'; ctx.lineWidth=2; ctx.strokeRect(0.5,0.5,W-1,H-1);
}

function drawStar(cx,cy,points,outerR,innerR){
  let rot = -Math.PI/2;
  const step = Math.PI/points;
  ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const r = i%2===0 ? outerR : innerR;
    const a = rot + i*step;
    const x = cx + Math.cos(a)*r, y = cy + Math.sin(a)*r;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// loop
function frame(now){
  const dt = Math.min(0.033, (now - lastTime)/1000 || 0);
  lastTime = now;
  if(state==='playing') update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// initial draw
resetGame();
draw();
updateHUD();

// keyboard focus hint
canvas.tabIndex=0;
canvas.addEventListener('click', ()=>{ if(state==='start') startGame(); canvas.focus(); });

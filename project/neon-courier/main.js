// Lantern Catch — falling fireflies
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const elScore = document.getElementById('score');
const elCaught = document.getElementById('caught');
const elMissed = document.getElementById('missed');
const elTimer = document.getElementById('timer');
const overlayStart = document.getElementById('overlay-start');
const overlayPause = document.getElementById('overlay-pause');
const overlayEnd = document.getElementById('overlay-end');
const elEndTitle = document.getElementById('end-title');
const elEndMsg = document.getElementById('end-msg');
const elEndScore = document.getElementById('end-score');
const elEndCaught = document.getElementById('end-caught');
const elEndMissed = document.getElementById('end-missed');
const elFeedback = document.getElementById('feedback');

const W = 960, H = 600;
const GAME_TIME = 60;
const LANTERN_W = 72, LANTERN_H = 84;
const CATCH_R = 46; // glow radius for catch
const GROUND_Y = H - 26;

let state = 'start'; // start, playing, paused, ended
let score = 0, caught = 0, missed = 0;
let timeLeft = GAME_TIME;
let fireflies = [];
let particles = [];
let floaters = [];
let shake = 0;
let hitFlash = 0; // miss flash
let catchFlash = 0;
let spawnTimer = 0;
let spawnInterval = 0.72;
let lantern = { x: W/2, y: GROUND_Y - 42, vx:0, targetX: W/2 };

const keys = new Set();
let mouseX = W/2;

function rand(a,b){ return Math.random()*(b-a)+a; }

function resetGame(){
  score=0; caught=0; missed=0; timeLeft=GAME_TIME;
  fireflies=[]; particles=[]; floaters=[]; shake=0; hitFlash=0; catchFlash=0;
  spawnTimer=0; spawnInterval=0.72;
  lantern.x=W/2; lantern.targetX=W/2; lantern.vx=0;
  updateHUD();
}

function ensureHUD(){}

function triggerPop(el){
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  setTimeout(()=>el.classList.remove('pop'),300);
}

function updateHUD(){
  elScore.textContent = score;
  elCaught.textContent = caught;
  elMissed.textContent = missed;
  elTimer.textContent = timeLeft.toFixed(1);
  if(timeLeft < 12 && state==='playing'){
    elTimer.classList.add('urgent');
  } else {
    elTimer.classList.remove('urgent');
  }
}

function spawnParticles(x,y,color,count=10, spread=3){
  for(let i=0;i<count;i++){
    particles.push({x,y, vx:rand(-spread,spread), vy:rand(-spread,spread)-1, life:1, decay: rand(0.025,0.055), color, r: rand(2,4.5)});
  }
}
function spawnFloater(x,y,text,color){
  floaters.push({x,y,text,color, life:1, vy:-46});
}
function showFeedback(text, type){
  const s=document.createElement('span');
  s.textContent=text; s.className=type;
  elFeedback.appendChild(s);
  setTimeout(()=>s.remove(), 750);
}

function spawnFirefly(){
  const isGolden = Math.random() < 0.18;
  const x = rand(28, W-28);
  const baseSpeed = isGolden ? rand(115,165) : rand(78,128);
  // increase speed slightly over time
  const timeFactor = 1 + (1 - timeLeft/GAME_TIME)*0.35;
  fireflies.push({
    x, y: -16,
    vx: rand(-22,22),
    vy: baseSpeed * timeFactor,
    sway: rand(0, Math.PI*2),
    swaySpeed: rand(1.2,2.4),
    swayAmp: rand(10,18),
    r: isGolden ? 9 : 7,
    golden: isGolden,
    rot: rand(0,Math.PI*2),
    rotSpeed: rand(-1.2,1.2),
    life:1
  });
}

// Input
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys.add(k);
  if(k==='p' && state==='playing') setState('paused');
  else if(k==='p' && state==='paused') setState('playing');
  if(k==='r'){ startPlaying(); }
  if(k===' ' || k==='enter'){
    if(state==='start' || state==='ended') startPlaying();
    else if(state==='paused') setState('playing');
  }
});
window.addEventListener('keyup', e=> keys.delete(e.key.toLowerCase()));

document.getElementById('btn-start').onclick = ()=> startPlaying();
document.getElementById('btn-resume').onclick = ()=> setState('playing');
document.getElementById('btn-restart').onclick = ()=> startPlaying();

// Pointer handling — unified mouse + touch, works on canvas wrap and survives leaving canvas
const wrap = document.getElementById('wrap');
function canvasToX(clientX){
  const rect = canvas.getBoundingClientRect();
  if(rect.width===0) return mouseX;
  const sx = W / rect.width;
  return (clientX - rect.left) * sx;
}
function setTargetFromClientX(clientX){
  mouseX = canvasToX(clientX);
  lantern.targetX = Math.max(LANTERN_W/2+6, Math.min(W-LANTERN_W/2-6, mouseX));
}
// pointermove on canvas + wrap + window while dragging/playing
canvas.addEventListener('pointermove', e=>{
  setTargetFromClientX(e.clientX);
});
wrap.addEventListener('pointermove', e=>{
  // wrap may be larger than canvas (padding); still track
  if(e.target!==canvas) setTargetFromClientX(e.clientX);
});
// also track when pointer leaves canvas during play (desktop fast moves)
window.addEventListener('pointermove', e=>{
  if(state!=='playing') return;
  // only track if pointer is near canvas rect vertically
  const rect = canvas.getBoundingClientRect();
  if(e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40){
    setTargetFromClientX(e.clientX);
  }
});
canvas.addEventListener('touchmove', e=>{
  e.preventDefault();
  if(e.touches[0]) setTargetFromClientX(e.touches[0].clientX);
},{passive:false});
wrap.addEventListener('touchmove', e=>{
  e.preventDefault();
  if(e.touches[0]) setTargetFromClientX(e.touches[0].clientX);
},{passive:false});
canvas.addEventListener('pointerdown', e=>{
  setTargetFromClientX(e.clientX);
  if(state==='start' || state==='ended'){ startPlaying(); }
  // capture pointer so dragging outside still moves lantern on mobile
  try{ canvas.setPointerCapture(e.pointerId); }catch{}
});
wrap.addEventListener('pointerdown', e=>{
  if(e.target!==canvas){
    setTargetFromClientX(e.clientX);
    if(state==='start' || state==='ended') startPlaying();
  }
});
canvas.addEventListener('touchstart', e=>{
  if(e.touches[0]) setTargetFromClientX(e.touches[0].clientX);
  if(state==='start' || state==='ended'){ startPlaying(); }
},{passive:false});
canvas.addEventListener('click', ()=>{
  if(state==='start' || state==='ended') startPlaying();
});

function setState(s){
  state=s;
  overlayStart.classList.toggle('hidden', s!=='start');
  overlayPause.classList.toggle('hidden', s!=='paused');
  overlayEnd.classList.toggle('hidden', s!=='ended');
  // accessibility: hide inactive overlays from AT
  overlayStart.setAttribute('aria-hidden', s!=='start' ? 'true' : 'false');
  overlayPause.setAttribute('aria-hidden', s!=='paused' ? 'true' : 'false');
  overlayEnd.setAttribute('aria-hidden', s!=='ended' ? 'true' : 'false');
  updateHUD();
  // cursor
  canvas.style.cursor = (s==='playing') ? 'none' : 'auto';
  // focus management for keyboard users
  if(s==='start') document.getElementById('btn-start')?.focus({preventScroll:true});
  else if(s==='paused') document.getElementById('btn-resume')?.focus({preventScroll:true});
  else if(s==='ended') document.getElementById('btn-restart')?.focus({preventScroll:true});
}
function startPlaying(){
  resetGame();
  setState('playing');
  // ensure immediate HUD repaint (no one-frame lag)
  updateHUD();
}

let last=performance.now();
let nowTick=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now-last)/1000);
  last=now;
  nowTick=now;
  if(state==='playing') update(dt);
  render(now);
}
function update(dt){
  timeLeft -= dt;
  if(timeLeft<=0){ timeLeft=0; endGame(); return; }

  // lantern movement: blend mouse target + keyboard
  let kdx=0;
  if(keys.has('arrowleft')||keys.has('a')) kdx-=1;
  if(keys.has('arrowright')||keys.has('d')) kdx+=1;
  if(kdx!==0){
    lantern.targetX += kdx * 420 * dt;
  } else {
    // slight lerp to mouse even when no keys
  }
  lantern.targetX = Math.max(LANTERN_W/2+6, Math.min(W-LANTERN_W/2-6, lantern.targetX));
  // smooth follow
  const diff = lantern.targetX - lantern.x;
  lantern.vx = diff * 10;
  lantern.x += lantern.vx * dt;
  // clamp
  lantern.x = Math.max(LANTERN_W/2+6, Math.min(W-LANTERN_W/2-6, lantern.x));

  // spawn
  spawnTimer += dt;
  // difficulty ramp: interval shortens over time
  const prog = 1 - timeLeft/GAME_TIME;
  const curInterval = Math.max(0.38, spawnInterval - prog*0.28);
  if(spawnTimer > curInterval){
    spawnTimer=0;
    spawnFirefly();
    // occasional double spawn later
    if(prog>0.5 && Math.random()<0.28) spawnFirefly();
  }

  // update fireflies
  for(let i=fireflies.length-1;i>=0;i--){
    const f=fireflies[i];
    f.sway += dt * f.swaySpeed;
    f.x += f.vx*dt + Math.sin(f.sway)* f.swayAmp * dt;
    f.y += f.vy*dt;
    f.rot += f.rotSpeed*dt;
    // wall bounce slightly
    if(f.x < 16 || f.x > W-16) f.vx*=-1;

    // catch check: lantern glow at lantern center slightly above base
    const lx = lantern.x;
    const ly = lantern.y - 6;
    const dx = f.x - lx, dy = f.y - ly;
    const dist = Math.hypot(dx,dy);
    const catchDist = f.golden ? CATCH_R+6 : CATCH_R;
    if(dist < catchDist + f.r){
      // caught
      const pts = f.golden ? 25 : 10;
      score += pts; caught++;
      spawnParticles(f.x,f.y, f.golden ? '#ffd34d' : '#ffea7a', f.golden? 18:14, 3.5);
      // ring
      for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; particles.push({x:f.x,y:f.y,vx:Math.cos(a)*4,vy:Math.sin(a)*4, life:1, decay:0.05, color: f.golden?'#ffe9a8':'#ffffc2', r:2}); }
      spawnFloater(f.x, f.y-18, `+${pts}`, f.golden ? '#ffd34d' : '#ffea7a');
      showFeedback(f.golden ? `GOLDEN +${pts}!` : `+${pts}`, 'catch');
      triggerPop(elScore);
      triggerPop(elCaught);
      catchFlash = 0.18;
      shake = Math.max(shake, f.golden? 6:3);
      fireflies.splice(i,1);
      updateHUD();
      continue;
    }

    // miss check: hit ground
    if(f.y > GROUND_Y + 4){
      missed++;
      spawnParticles(f.x, GROUND_Y, 'rgba(255,107,122,0.95)', 10, 2.8);
      spawnFloater(f.x, GROUND_Y-12, 'MISS', '#ff6b7a');
      showFeedback('MISSED', 'miss');
      // flash + shake
      hitFlash = 0.24;
      shake = Math.max(shake, 8);
      triggerPop(elMissed);
      fireflies.splice(i,1);
      updateHUD();
    }
  }

  // particles
  particles.forEach(pt=>{
    pt.x+=pt.vx;
    pt.y+=pt.vy;
    pt.vy+=0.14;
    pt.vx*=0.99;
    pt.life-=pt.decay;
  });
  particles = particles.filter(p=>p.life>0);
  floaters.forEach(f=>{ f.y += f.vy*dt; f.vy += 32*dt; f.life -= dt*1.2; });
  floaters = floaters.filter(f=>f.life>0);

  shake *= Math.pow(0.12, dt);
  if(shake<0.12) shake=0;
  if(hitFlash>0) hitFlash-=dt;
  if(catchFlash>0) catchFlash-=dt;

  updateHUD();
}

function endGame(){
  state='ended';
  elEndScore.textContent = score;
  elEndCaught.textContent = caught;
  elEndMissed.textContent = missed;
  const best = caught>0 ? Math.round(caught/(caught+missed)*100) : 0;
  if(score >= 300) { elEndTitle.textContent='RADIANT NIGHT'; elEndTitle.style.color='var(--gold)'; elEndMsg.textContent=`Amazing — ${caught} caught, ${best}% accuracy.`; }
  else if(score >= 180) { elEndTitle.textContent='GLOWING'; elEndTitle.style.color='#7be1ff'; elEndMsg.textContent=`Nice haul — ${caught} fireflies in the lantern.`; }
  else if(caught===0) { elEndTitle.textContent='DARK NIGHT'; elEndTitle.style.color='var(--miss)'; elEndMsg.textContent='No catches — try following with the mouse!'; }
  else { elEndTitle.textContent="TIME'S UP"; elEndTitle.style.color='var(--text)'; elEndMsg.textContent=`You caught ${caught} fireflies. Try again?`; }
  setState('ended');
}

function render(t){
  ctx.save();
  if(shake>0){
    const sx=(Math.random()-0.5)*shake*2;
    const sy=(Math.random()-0.5)*shake*2;
    ctx.translate(sx,sy);
  }
  ctx.clearRect(-12,-12,W+24,H+24);

  // sky gradient
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0a1433'); g.addColorStop(0.45,'#121d4a'); g.addColorStop(1,'#0b1028');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  // stars
  ctx.fillStyle='rgba(255,255,255,0.9)';
  for(let i=0;i<120;i++){
    const x=(i*137.5 + i*i*7)%W;
    const y=(i*211)% (H*0.62);
    const a= 0.35 + 0.5*Math.sin(t*0.001 + i);
    const s= (i%3===0)?1.6:1;
    ctx.globalAlpha= a*0.9;
    ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // moon
  ctx.save();
  ctx.shadowColor='rgba(255,244,180,0.7)'; ctx.shadowBlur=22;
  ctx.fillStyle='#fff3b0';
  ctx.beginPath(); ctx.arc(W-92, 86, 34,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.09)';
  ctx.beginPath(); ctx.arc(W-84, 78, 7,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(W-102, 96, 5,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // distant trees silhouette
  ctx.fillStyle='#0a0f2a';
  ctx.beginPath();
  ctx.moveTo(0, H*0.42);
  for(let x=0;x<=W;x+=38){
    const h = 28 + 18*Math.sin(x*0.012) + 10*Math.sin(x*0.031 + 7);
    ctx.lineTo(x, H*0.42 - h);
  }
  ctx.lineTo(W, H*0.42); ctx.lineTo(W, GROUND_Y); ctx.lineTo(0,GROUND_Y); ctx.closePath(); ctx.fill();
  // closer trees darker
  ctx.fillStyle='#070b22';
  ctx.beginPath();
  ctx.moveTo(0, H*0.52);
  for(let x=0;x<=W;x+=44){
    const h = 34 + 16*Math.sin(x*0.015+2) + 12*Math.sin(x*0.04);
    ctx.lineTo(x, H*0.52 - h);
  }
  ctx.lineTo(W,H*0.52); ctx.lineTo(W,GROUND_Y); ctx.lineTo(0,GROUND_Y); ctx.closePath(); ctx.fill();

  // ground
  const groundGrad=ctx.createLinearGradient(0,GROUND_Y,0,H);
  groundGrad.addColorStop(0,'#1a2a14'); groundGrad.addColorStop(1,'#0f1a0e');
  ctx.fillStyle=groundGrad;
  ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  // grass blades
  ctx.strokeStyle='rgba(90,140,70,0.35)'; ctx.lineWidth=1;
  for(let x=6;x<W;x+=14){
    const h=6+ 6*Math.sin(x*0.08);
    ctx.beginPath(); ctx.moveTo(x,GROUND_Y); ctx.lineTo(x+ (Math.sin(t*0.001 + x)*2), GROUND_Y - h); ctx.stroke();
  }
  // lantern glow on ground
  ctx.save();
  ctx.globalAlpha=0.22;
  const glowGrad=ctx.createRadialGradient(lantern.x, GROUND_Y-2, 6, lantern.x, GROUND_Y-2, 140);
  glowGrad.addColorStop(0,'rgba(255,222,122,0.55)'); glowGrad.addColorStop(1,'rgba(255,222,122,0)');
  ctx.fillStyle=glowGrad;
  ctx.beginPath(); ctx.ellipse(lantern.x, GROUND_Y-2, 140, 18, 0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // fireflies
  fireflies.forEach(f=>{
    const bob = Math.sin(f.sway)*2;
    ctx.save();
    // glow
    ctx.shadowColor = f.golden ? '#ffd34d' : '#ffea7a';
    ctx.shadowBlur = f.golden ? 20 : 16;
    ctx.fillStyle = f.golden ? 'rgba(255,211,77,0.28)' : 'rgba(255,234,122,0.22)';
    ctx.beginPath(); ctx.arc(f.x, f.y+bob, f.r+13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = f.golden ? 'rgba(255,211,77,0.16)' : 'rgba(255,255,150,0.14)';
    ctx.beginPath(); ctx.arc(f.x, f.y+bob, f.r+22,0,Math.PI*2); ctx.fill();
    // body
    ctx.shadowBlur = f.golden ? 14 : 10;
    ctx.fillStyle = f.golden ? '#ffd34d' : '#ffea7a';
    ctx.beginPath(); ctx.ellipse(f.x, f.y+bob, f.r, f.r+1, f.rot, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    // wing shimmer
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(f.x-3, f.y+bob-1, 3,1.2, f.rot+0.6,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f.x+3, f.y+bob+1, 3,1.2, f.rot-0.6,0,Math.PI*2); ctx.fill();
    // core highlight
    ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.arc(f.x-1.5, f.y+bob-1.5, 1.8,0,Math.PI*2); ctx.fill();
    // trail
    ctx.strokeStyle= f.golden ? 'rgba(255,211,77,0.38)' : 'rgba(255,234,122,0.32)';
    ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(f.x, f.y+bob); ctx.lineTo(f.x - f.vx*0.06, f.y+bob - f.vy*0.06); ctx.stroke();
    ctx.restore();
  });

  // lantern
  {
    const lx=lantern.x, ly=lantern.y;
    const hover = Math.sin(t*0.0025)*3;
    ctx.save();
    ctx.translate(lx, ly+hover);
    // outer glow
    const lg=ctx.createRadialGradient(0,-6, 8, 0,-6, CATCH_R+24);
    lg.addColorStop(0,'rgba(255,222,122,0.45)'); lg.addColorStop(0.55,'rgba(255,180,60,0.18)'); lg.addColorStop(1,'rgba(255,180,60,0)');
    ctx.fillStyle=lg;
    ctx.beginPath(); ctx.arc(0,-6, CATCH_R+18,0,Math.PI*2); ctx.fill();
    // catch radius hint dashed
    ctx.strokeStyle='rgba(255,222,122,0.22)';
    ctx.setLineDash([6,7]); ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(0,-6, CATCH_R,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    // lantern body
    ctx.shadowColor='rgba(255,211,77,0.6)'; ctx.shadowBlur=16;
    // top cap
    ctx.fillStyle='#2b1f0a';
    ctx.fillRect(-18, -38, 36, 10);
    ctx.fillStyle='#3d2b12';
    ctx.fillRect(-14, -46, 28, 10);
    // handle
    ctx.strokeStyle='#3d2b12'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0, -46, 12, Math.PI, 0); ctx.stroke();
    // glass
    const glassGrad=ctx.createLinearGradient(-22,-32,22,22);
    glassGrad.addColorStop(0,'rgba(255,246,180,0.95)'); glassGrad.addColorStop(0.5,'rgba(255,220,100,0.95)'); glassGrad.addColorStop(1,'rgba(255,160,40,0.88)');
    ctx.fillStyle=glassGrad;
    ctx.beginPath();
    ctx.moveTo(-22,-32); ctx.lineTo(22,-32); ctx.lineTo(18,22); ctx.lineTo(-18,22); ctx.closePath(); ctx.fill();
    // glass highlight
    ctx.fillStyle='rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(-16,-29); ctx.lineTo(-4,-29); ctx.lineTo(-8,18); ctx.lineTo(-18,18); ctx.closePath(); ctx.fill();
    // inner flame
    ctx.shadowBlur=12; ctx.shadowColor='#fff3a0';
    ctx.fillStyle='#fffbe6';
    ctx.beginPath(); ctx.ellipse(0,-4,8,12,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffad2b';
    ctx.beginPath(); ctx.ellipse(0,2,4,6,0,0,Math.PI*2); ctx.fill();
    // bottom base
    ctx.shadowBlur=0;
    ctx.fillStyle='#2b1f0a';
    ctx.fillRect(-20,22,40,8);
    // feet
    ctx.fillStyle='#1e1608';
    ctx.fillRect(-18,30,6,6); ctx.fillRect(12,30,6,6);
    ctx.restore();
  }

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
    ctx.globalAlpha=Math.max(0,f.life);
    ctx.fillStyle=f.color;
    ctx.shadowColor=f.color; ctx.shadowBlur=10;
    ctx.font='800 14px JetBrains Mono,monospace';
    ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });

  // hit flash (miss)
  if(hitFlash>0){
    ctx.save();
    ctx.globalAlpha= hitFlash*0.22;
    ctx.fillStyle='#ff6b7a';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha= hitFlash*0.85;
    ctx.strokeStyle='#ff6b7a'; ctx.lineWidth=5; ctx.strokeRect(3,3,W-6,H-6);
    // ground puff line
    ctx.globalAlpha= hitFlash*0.9;
    ctx.fillStyle='#ff6b7a';
    ctx.fillRect(0,GROUND_Y,W,3);
    ctx.restore();
  }
  if(catchFlash>0){
    ctx.save();
    ctx.globalAlpha= catchFlash*0.14;
    ctx.fillStyle='#ffd34d';
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // timer bar at bottom
  const pct=Math.max(0,timeLeft/GAME_TIME);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(14,H-12, W-28,6);
  ctx.fillStyle='rgba(255,255,255,0.07)';
  for(let i=1;i<4;i++) ctx.fillRect(14+(W-28)*i/4, H-12,1,6);
  ctx.fillStyle= pct<0.25 ? '#ff6b7a' : pct<0.5 ? '#ffd34d' : '#ffea7a';
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur= pct<0.25? 12:8;
  ctx.fillRect(14,H-12,(W-28)*pct,6);
  ctx.shadowBlur=0;

  ctx.restore();
}

resetGame();
setState('start');
requestAnimationFrame(loop);

// pause on tab hidden / window blur (prevents timer cheating & respects user)
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden && state==='playing') setState('paused');
});
window.addEventListener('blur', ()=>{
  if(state==='playing') setState('paused');
});
// prevent context menu / long-press selection on canvas (mobile polish)
canvas.addEventListener('contextmenu', e=> e.preventDefault());
wrap.addEventListener('contextmenu', e=> e.preventDefault());

// expose for tests
window.__game = { resetGame, getState:()=>state, getScore:()=>score, getCaught:()=>caught, getMissed:()=>missed, W,H, GAME_TIME };

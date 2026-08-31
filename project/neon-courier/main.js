// Lantern Catch — catch falling fireflies with mouse / arrow keys
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
const elEndAcc = document.getElementById('end-acc');
const elEndRank = document.getElementById('end-rank');
const elEndBadge = document.getElementById('end-badge');
const wrap = document.getElementById('wrap');

const W = 960, H = 640;
const GAME_TIME = 60;

let state = 'start'; // start, playing, paused, ended
let score = 0;
let caught = 0;
let missed = 0;
let timeLeft = GAME_TIME;
let combo = 0;
let bestCombo = 0;

let lantern = { x: W/2, y: H-90, w: 78, h: 92, targetX: W/2, targetY: H-90, vx:0 };

// fireflies
let fireflies = [];
let particles = [];
let floaters = [];
let missFlashes = []; // recent misses for feedback
let shake = 0;
let hitFlash = 0; // catch flash
let missShake = 0;

const keys = new Set();
let mouseX = W/2;
let mouseActive = false;

function rand(a,b){ return Math.random()*(b-a)+a; }

function resetGame(){
  score=0; caught=0; missed=0; timeLeft=GAME_TIME;
  combo=0; bestCombo=0;
  fireflies=[]; particles=[]; floaters=[]; missFlashes=[];
  shake=0; hitFlash=0; missShake=0;
  lantern.x=W/2; lantern.y=H-90; lantern.targetX=W/2; lantern.targetY=H-90; lantern.vx=0;
  spawnTimer=0;
  spawnInterval=0.65;
  mouseActive=false;
  updateHUD();
}

let spawnTimer=0;
let spawnInterval=0.65;

function spawnFirefly(){
  const x = rand(40, W-40);
  const y = -20;
  const isGolden = Math.random() < 0.14;
  const baseSpeed = isGolden ? rand(95,135) : rand(70,115);
  // difficulty ramp: speed increases slightly over time
  const tProgress = 1 - timeLeft/GAME_TIME;
  const speed = baseSpeed * (1 + tProgress*0.35);
  fireflies.push({
    x, y,
    vx: rand(-28,28),
    vy: speed,
    r: isGolden ? 11 : 8,
    golden: isGolden,
    sway: rand(0, Math.PI*2),
    swayAmp: rand(14,26),
    swaySpeed: rand(1.8,3.2),
    rot: rand(0,Math.PI*2),
    life:1
  });
}

function spawnParticles(x,y,color,count=10){
  for(let i=0;i<count;i++){
    particles.push({x,y,vx:rand(-3.5,3.5),vy:rand(-4, -0.5), life:1, decay: rand(0.025,0.045), color, r: rand(2,5)});
  }
}
function spawnFloater(x,y,text,color){
  floaters.push({x,y,text,color, life:1, vy:-38, scale:1});
}

function setState(s){
  state=s;
  overlayStart.classList.toggle('hidden', s!=='start');
  overlayPause.classList.toggle('hidden', s!=='paused');
  overlayEnd.classList.toggle('hidden', s!=='ended');
  updateHUD();
}
function startPlaying(){
  resetGame();
  setState('playing');
}
function pauseToggle(){
  if(state==='playing') setState('paused');
  else if(state==='paused') setState('playing');
}
function endGame(){
  state='ended';
  const total = caught+missed;
  const acc = total? Math.round(caught/total*100):0;
  elEndScore.textContent = score;
  elEndCaught.textContent = caught;
  elEndMissed.textContent = missed;
  elEndAcc.textContent = acc+'%';
  let rank='WANDERER';
  let msg='The forest remembers your light.';
  if(acc>=95 && caught>=35){ rank='⭐ LANTERN LEGEND'; msg='Flawless — the whole forest glows for you!'; }
  else if(acc>=80 && caught>=28){ rank='🌟 NIGHT KEEPER'; msg='Brilliant gathering — few lights escaped.'; }
  else if(acc>=60 && caught>=18){ rank='✨ FIREFLY FRIEND'; msg='Lovely work — the night feels warmer.'; }
  else if(caught>=10){ rank='🏮 GLOW SEEKER'; msg='Good start — chase a higher combo next time!'; }
  else { rank='🌙 FIRST LIGHT'; msg='The fireflies are shy — keep practicing!'; }
  if(bestCombo>=5) rank += ` · ${bestCombo}× COMBO`;
  elEndRank.textContent = rank;
  elEndMsg.textContent = msg;
  elEndTitle.textContent = acc>=80 ? 'LUMINOUS!' : acc>=50 ? 'NIGHT COMPLETE' : 'DUSK FADES';
  elEndBadge.textContent = `BEST COMBO ×${bestCombo}`;
  setState('ended');
}

function triggerScorePop(){
  elScore.classList.remove('pop');
  void elScore.offsetWidth;
  elScore.classList.add('pop');
  setTimeout(()=>elScore.classList.remove('pop'),280);
}

function updateHUD(){
  elScore.textContent = score;
  elCaught.textContent = caught;
  elMissed.textContent = missed;
  elTimer.textContent = timeLeft.toFixed(1);
  if(timeLeft<12 && state==='playing'){
    elTimer.style.color='var(--magenta)';
    elTimer.style.textShadow='0 0 12px rgba(255,77,109,0.9)';
    elTimer.classList.add('urgent');
  } else {
    elTimer.style.color='';
    elTimer.style.textShadow='';
    elTimer.classList.remove('urgent');
  }
  // missed red flash on hud when recent miss
  if(missShake>0.11){
    elMissed.style.color='var(--magenta)';
    elMissed.style.textShadow='0 0 10px rgba(255,77,109,0.8)';
  } else {
    elMissed.style.color='';
    elMissed.style.textShadow='';
  }
}

// Input
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  keys.add(k);
  if(k==='p' && (state==='playing' || state==='paused')) pauseToggle();
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

// Mouse control — lantern follows mouse inside canvas
function getCanvasPos(e){
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return {x,y};
}
function setMouseFromPoint(p){
  mouseX = p.x;
  lantern.targetY = Math.max(H-160, Math.min(H-70, p.y));
  mouseActive=true;
}
wrap.addEventListener('mousemove', e=>{
  const p=getCanvasPos(e);
  setMouseFromPoint(p);
});
wrap.addEventListener('mousedown', e=>{
  const p=getCanvasPos(e);
  setMouseFromPoint(p);
});
wrap.addEventListener('mouseleave', ()=>{ mouseActive=false; });
function handleTouch(e){
  if(e.touches[0]){
    const p=getCanvasPos(e.touches[0]);
    setMouseFromPoint(p);
    e.preventDefault();
  }
}
wrap.addEventListener('touchstart', handleTouch, {passive:false});
wrap.addEventListener('touchmove', handleTouch, {passive:false});

// Touch dpad fallback for narrow screens
const touchWrap=document.getElementById('touch');
function updateTouchVisibility(){
  if(window.innerWidth<=960) touchWrap.classList.remove('hidden');
  else touchWrap.classList.add('hidden');
}
updateTouchVisibility();
window.addEventListener('resize', updateTouchVisibility);
let touchDir=0;
touchWrap.querySelectorAll('button').forEach(b=>{
  const dir=b.dataset.dir;
  const set = (v)=>{
    touchDir = v ? (dir==='left'? -1 : 1) : 0;
  };
  b.addEventListener('touchstart', e=>{e.preventDefault(); set(true);});
  b.addEventListener('touchend', e=>{e.preventDefault(); set(false);});
  b.addEventListener('mousedown', ()=>set(true));
  b.addEventListener('mouseup', ()=>set(false));
  b.addEventListener('mouseleave', ()=>set(false));
});

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

  // spawn logic — accelerate slightly over time
  spawnTimer += dt;
  const tProg = 1 - timeLeft/GAME_TIME;
  const interval = Math.max(0.28, 0.68 - tProg*0.30 - Math.min(0.12, caught*0.006));
  if(spawnTimer > interval){
    spawnTimer=0;
    spawnFirefly();
    // occasional double spawn when ahead
    if(tProg>0.4 && Math.random()<0.22) spawnFirefly();
  }

  // lantern movement — keyboard has priority over mouse (spec: mouse AND arrow keys)
  let inputX=0, inputY=0;
  if(keys.has('a')||keys.has('arrowleft')) inputX-=1;
  if(keys.has('d')||keys.has('arrowright')) inputX+=1;
  if(keys.has('w')||keys.has('arrowup')) inputY-=1;
  if(keys.has('s')||keys.has('arrowdown')) inputY+=1;
  inputX += touchDir;
  const hasKeyInput = inputX!==0 || inputY!==0;
  if(hasKeyInput) mouseActive=false;

  if(hasKeyInput){
    const speed= 420;
    lantern.x += inputX * speed * dt;
    lantern.y += inputY * 220 * dt;
    // reset velocity so mouse lerp resumes smoothly later
    lantern.vx *= Math.pow(0.5, dt*10);
  } else if(mouseActive){
    // smooth lerp to mouseX
    const dx = mouseX - lantern.x;
    lantern.vx += dx * 8 * dt;
    lantern.vx *= Math.pow(0.12, dt*2.2); // damp
    lantern.x += lantern.vx * dt * 60;
    // vertical lerp
    lantern.y += (lantern.targetY - lantern.y) * 6 * dt;
  } else {
    // friction when idle but mouse not active
    lantern.vx *= Math.pow(0.5, dt*10);
    // drift back to center vertical
    lantern.y += ( (H-90) - lantern.y) * 2 * dt;
  }
  // clamp
  lantern.x = Math.max(lantern.w/2+8, Math.min(W-lantern.w/2-8, lantern.x));
  lantern.y = Math.max(H-170, Math.min(H-60, lantern.y));

  // update fireflies
  for(let i=fireflies.length-1;i>=0;i--){
    const f=fireflies[i];
    f.sway += f.swaySpeed*dt;
    f.x += f.vx*dt + Math.sin(f.sway)*0.9;
    f.y += f.vy*dt;
    f.rot += dt*1.2;

    // catch test — lantern glow ellipse + basket
    // lantern catch zone: expanded with combo
    const glowBonus = Math.min(18, combo*2.2);
    const catchW = lantern.w/2 + 22 + glowBonus;
    const catchH = 36;
    const lx = lantern.x, ly = lantern.y - 6; // center of glow
    const dx = f.x - lx;
    const dy = f.y - ly;
    // ellipse catch
    const inCatch = (dx*dx)/(catchW*catchW) + (dy*dy)/(catchH*catchH) < 1;
    // also if very close to lantern body (vertical)
    const inBody = Math.abs(dx) < lantern.w/2+8 && f.y > lantern.y-42 && f.y < lantern.y+18 && f.y < H-24;

    if((inCatch||inBody) && f.y > lantern.y-50){
      // caught!
      const pts = f.golden ? 25 : 10;
      const comboBonus = combo>=3 ? Math.min(12, Math.floor(combo*1.2)) : 0;
      score += pts + comboBonus;
      caught++;
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      spawnParticles(f.x, f.y, f.golden?'#ffcc4d':'#ffeeb3', f.golden?18:12);
      if(f.golden){
        for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; particles.push({x:f.x,y:f.y,vx:Math.cos(a)*3.8,vy:Math.sin(a)*3.8, life:1, decay:0.038, color:'#ff9f1c', r:2.6});}
      }
      const txt = combo>=3 ? `+${pts}${comboBonus?` +${comboBonus}`:''}  ×${combo}` : `+${pts}`;
      spawnFloater(f.x, f.y-16, txt, f.golden?'#ffcc4d':'#ffeeb3');
      hitFlash = 0.18;
      shake = Math.max(shake, f.golden? 5:3);
      triggerScorePop();
      fireflies.splice(i,1);
      updateHUD();
      continue;
    }

    // miss — fell past bottom
    if(f.y > H + 24){
      missed++;
      combo=0;
      missFlashes.push({x:f.x, life:1, y:H-10});
      spawnParticles(f.x, H-14, 'rgba(255,77,109,0.9)', 8);
      spawnFloater(f.x, H-28, 'MISS', '#ff4d6d');
      missShake = 0.35;
      shake = Math.max(shake, 7);
      fireflies.splice(i,1);
      updateHUD();
    }
  }

  // decays
  if(hitFlash>0) hitFlash-=dt*3;
  if(missShake>0) missShake-=dt*2.2;
  shake *= Math.pow(0.08, dt*1.6);
  if(shake<0.12) shake=0;
  if(hitFlash<0) hitFlash=0;
  if(missShake<0) missShake=0;

  // particles
  particles.forEach(p=>{
    p.x+=p.vx;
    p.y+=p.vy;
    p.vy+=0.14;
    p.vx*=0.99;
    p.life-=p.decay;
  });
  particles = particles.filter(p=>p.life>0);
  floaters.forEach(f=>{ f.y += f.vy*dt; f.vy+=24*dt; f.life-=dt*1.15; });
  floaters = floaters.filter(f=>f.life>0);
  missFlashes.forEach(m=> m.life-=dt*1.8);
  missFlashes = missFlashes.filter(m=>m.life>0);

  updateHUD();
}

function drawBackground(){
  // deep night sky
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0c1430');
  g.addColorStop(0.55,'#0a1028');
  g.addColorStop(1,'#080c20');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  // stars
  ctx.save();
  ctx.globalAlpha=0.9;
  for(let i=0;i<120;i++){
    const sx=(i*137.5)%W, sy=(i*211+ i%7*13)% (H*0.62);
    const a = 0.25 + (Math.sin(nowTick*0.001 + i)*0.15+0.15);
    ctx.globalAlpha=a;
    ctx.fillStyle= i%9===0 ? '#ffcc4d' : '#eef2ff';
    const r = i%9===0 ? 1.4 : 0.9;
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // subtle aurora band
  ctx.save();
  ctx.globalAlpha=0.08;
  const ag=ctx.createLinearGradient(0,0,0,220);
  ag.addColorStop(0,'rgba(110,231,255,0.9)');
  ag.addColorStop(0.5,'rgba(180,160,255,0.7)');
  ag.addColorStop(1,'transparent');
  ctx.fillStyle=ag;
  ctx.beginPath();
  ctx.moveTo(0,40);
  ctx.bezierCurveTo(W*0.3, 80, W*0.6, 10, W, 50);
  ctx.lineTo(W,0); ctx.lineTo(0,0); ctx.closePath(); ctx.fill();
  ctx.restore();

  // distant forest silhouette
  ctx.fillStyle='rgba(8,12,30,0.95)';
  ctx.beginPath();
  ctx.moveTo(0, H*0.58);
  for(let x=0;x<=W;x+=18){
    const h = 34 + Math.sin(x*0.02)*18 + Math.sin(x*0.05+2)*10 + (x%90===0?18:0);
    ctx.lineTo(x, H*0.58 - h);
  }
  ctx.lineTo(W, H*0.58); ctx.lineTo(W, H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();

  // ground — mossy clearing
  const gg=ctx.createLinearGradient(0,H-120,0,H);
  gg.addColorStop(0,'#141f3a'); gg.addColorStop(0.5,'#101a32'); gg.addColorStop(1,'#0d142c');
  ctx.fillStyle=gg;
  ctx.fillRect(0,H-82,W,82);
  // ground texture dots
  ctx.fillStyle='rgba(255,204,77,0.06)';
  for(let i=0;i<80;i++){
    const gx=(i*89)%W, gy=H-70 + (i*53)%60;
    ctx.beginPath(); ctx.arc(gx,gy,1.2,0,Math.PI*2); ctx.fill();
  }
  // subtle vignette
  const vg=ctx.createRadialGradient(W/2,H/2, 320, W/2,H/2, 900);
  vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,0,0.38)');
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,W,H);
}

function drawLantern(){
  const x=lantern.x, y=lantern.y;
  const comboGlow = Math.min(22, combo*3.2);
  // outer glow
  ctx.save();
  ctx.globalAlpha=0.18;
  ctx.fillStyle='#ffcc4d';
  ctx.shadowColor='#ffcc4d'; ctx.shadowBlur=22+comboGlow;
  ctx.beginPath(); ctx.ellipse(x, y-6, 72+comboGlow, 52+comboGlow*0.5, 0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=0.12;
  ctx.beginPath(); ctx.ellipse(x, y-6, 110+comboGlow*1.4, 72, 0,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // catch zone hint (very subtle dashed ellipse)
  if(state==='playing'){
    ctx.save();
    ctx.globalAlpha=0.18;
    ctx.strokeStyle= combo>=3 ? '#ffcc4d' : 'rgba(255,204,77,0.55)';
    ctx.lineWidth=1.2;
    ctx.setLineDash(combo>=3?[6,4]:[4,6]);
    ctx.shadowColor='#ffcc4d'; ctx.shadowBlur=combo>=3?8:0;
    const gw = lantern.w/2+22+Math.min(18,combo*2.2);
    ctx.beginPath(); ctx.ellipse(x, y-6, gw, 36, 0,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // lantern body
  ctx.save();
  ctx.translate(x,y);
  // sway with movement
  const sway = Math.sin(nowTick*0.003)*1.2 + lantern.vx*0.02;
  ctx.rotate(sway*0.04);

  // top cap + handle
  ctx.strokeStyle='#2a2f55'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,-46); ctx.lineTo(0,-62); ctx.stroke();
  ctx.fillStyle='#ffcc4d'; ctx.shadowColor='#ffcc4d'; ctx.shadowBlur=8;
  ctx.beginPath(); ctx.arc(0,-62,4,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  // cap
  ctx.fillStyle='#1e264d';
  ctx.strokeStyle='rgba(255,204,77,0.6)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(-22,-46,44,10,4); ctx.fill(); ctx.stroke();
  // glass body
  const glassGrad=ctx.createLinearGradient(-26,-36,26,28);
  glassGrad.addColorStop(0,'rgba(255,244,210,0.95)');
  glassGrad.addColorStop(0.5,'rgba(255,214,102,0.92)');
  glassGrad.addColorStop(1,'rgba(255,159,28,0.88)');
  ctx.fillStyle=glassGrad;
  ctx.shadowColor='rgba(255,204,77,0.6)'; ctx.shadowBlur=16;
  ctx.beginPath(); ctx.roundRect(-26,-36,52,64,6); ctx.fill();
  ctx.shadowBlur=0;
  // glass highlight
  ctx.fillStyle='rgba(255,255,255,0.72)';
  ctx.beginPath(); ctx.roundRect(-20,-30,8,48,4); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.roundRect(-8,-30,3,48,2); ctx.fill();
  // flame inner
  const flick = Math.sin(nowTick*0.012)*2;
  ctx.fillStyle='#fff7cc';
  ctx.shadowColor='#ffcc4d'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.ellipse(0,-4+flick*0.3, 8, 11, 0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff9f1c';
  ctx.beginPath(); ctx.ellipse(0,2+flick*0.2, 5, 7, 0,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // bottom rim
  ctx.fillStyle='#1e264d';
  ctx.strokeStyle='rgba(255,204,77,0.55)'; ctx.lineWidth=1.3;
  ctx.beginPath(); ctx.roundRect(-24,28,48,11,4); ctx.fill(); ctx.stroke();
  // bottom glow spill
  ctx.fillStyle='rgba(255,204,77,0.18)';
  ctx.beginPath(); ctx.ellipse(0,42, 26, 7, 0,0,Math.PI*2); ctx.fill();

  ctx.restore();

  // combo indicator above lantern
  if(combo>=2 && state==='playing'){
    ctx.save();
    ctx.globalAlpha=0.92;
    ctx.fillStyle= combo>=5 ? '#ffcc4d' : '#ffeeb3';
    ctx.shadowColor=combo>=5?'#ffcc4d':'#ffeeb3'; ctx.shadowBlur=8;
    ctx.font='800 13px JetBrains Mono,monospace';
    ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3;
    ctx.strokeText(`×${combo} COMBO`, x, y-72);
    ctx.fillText(`×${combo} COMBO`, x, y-72);
    ctx.restore();
  }
}

function drawFireflies(){
  fireflies.forEach(f=>{
    ctx.save();
    const wob = Math.sin(f.sway)*2;
    // outer glow
    ctx.shadowColor= f.golden ? '#ffcc4d' : '#ffe27a';
    ctx.shadowBlur= f.golden ? 16 : 12;
    ctx.globalAlpha=0.95;
    // body glow
    ctx.fillStyle= f.golden ? 'rgba(255,204,77,0.32)' : 'rgba(255,232,150,0.26)';
    ctx.beginPath(); ctx.arc(f.x+wob, f.y, f.r+10,0,Math.PI*2); ctx.fill();
    // core
    const pulse = 0.85 + Math.sin(nowTick*0.008 + f.sway)*0.15;
    ctx.globalAlpha=1;
    ctx.fillStyle= f.golden ? '#ffcc4d' : '#ffeea8';
    ctx.beginPath(); ctx.arc(f.x+wob, f.y, f.r*pulse,0,Math.PI*2); ctx.fill();
    // highlight
    ctx.fillStyle='#ffffff';
    ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.arc(f.x+wob-2.2, f.y-2.2, f.golden?3.2:2.2,0,Math.PI*2); ctx.fill();
    // golden ring
    if(f.golden){
      ctx.globalAlpha=0.9;
      ctx.strokeStyle='rgba(255,204,77,0.85)';
      ctx.lineWidth=1.8;
      ctx.shadowBlur=6;
      ctx.beginPath(); ctx.arc(f.x+wob, f.y, f.r+5 + Math.sin(nowTick*0.01+f.sway)*1.5,0,Math.PI*2); ctx.stroke();
      // inner star
      ctx.fillStyle='#fff';
      ctx.font='700 9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('✦', f.x+wob, f.y+3);
    }
    // wings hint (tiny)
    ctx.globalAlpha=0.45;
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(f.x+wob-5, f.y-1, 4, 2.2, -0.3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f.x+wob+5, f.y-1, 4, 2.2, 0.3,0,Math.PI*2); ctx.fill();
    // trail
    ctx.globalAlpha=0.22;
    ctx.strokeStyle= f.golden ? '#ffcc4d' : '#ffe27a';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(f.x+wob, f.y-10); ctx.lineTo(f.x+wob*0.3, f.y-4); ctx.stroke();
    ctx.restore();
  });
}

function render(t){
  nowTick=t;
  ctx.save();
  if(shake>0){
    ctx.translate((Math.random()-0.5)*shake*2, (Math.random()-0.5)*shake*2);
  }
  ctx.clearRect(-20,-20,W+40,H+40);
  drawBackground();
  drawFireflies();
  drawLantern();

  // particles
  particles.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.life);
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
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=3.5;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });

  // miss flashes at bottom
  missFlashes.forEach(m=>{
    ctx.save();
    ctx.globalAlpha=m.life*0.45;
    ctx.fillStyle='#ff4d6d';
    ctx.shadowColor='#ff4d6d'; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.ellipse(m.x, H-6, 28*m.life+8, 7, 0,0,Math.PI*2); ctx.fill();
    // X mark
    ctx.globalAlpha=m.life*0.9;
    ctx.strokeStyle='#ff4d6d'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(m.x-7, H-22); ctx.lineTo(m.x+7, H-10); ctx.moveTo(m.x+7, H-22); ctx.lineTo(m.x-7, H-10); ctx.stroke();
    ctx.restore();
  });

  // hit flash vignette (catch) — warm
  if(hitFlash>0){
    ctx.save();
    ctx.globalAlpha=hitFlash*0.18;
    ctx.fillStyle='#ffcc4d';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=hitFlash*0.7;
    ctx.strokeStyle='#ffcc4d'; ctx.lineWidth=4;
    ctx.strokeRect(6,6,W-12,H-12);
    ctx.restore();
  }
  // miss flash vignette — red
  if(missShake>0){
    ctx.save();
    ctx.globalAlpha=missShake*0.22;
    ctx.fillStyle='#ff4d6d';
    ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=missShake*0.85;
    ctx.strokeStyle='#ff4d6d'; ctx.lineWidth=5;
    ctx.strokeRect(4,4,W-8,H-8);
    ctx.restore();
  }

  // timer bar
  const pct=Math.max(0,timeLeft/GAME_TIME);
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(14,H-14,W-28,7);
  // ticks
  ctx.fillStyle='rgba(255,255,255,0.07)';
  for(let i=1;i<4;i++) ctx.fillRect(14+(W-28)*i/4, H-14, 1,7);
  const barColor = pct<0.25 ? '#ff4d6d' : pct<0.5 ? '#ffcc4d' : '#ffeeb3';
  ctx.fillStyle=barColor;
  ctx.shadowColor=barColor; ctx.shadowBlur= pct<0.25 ? 14*Math.abs(Math.sin(nowTick*0.01))+6 : 8;
  // rounded bar
  ctx.beginPath();
  ctx.roundRect(14,H-14,(W-28)*pct,7,3);
  ctx.fill();
  ctx.shadowBlur=0;

  // scanline subtle
  ctx.fillStyle='rgba(255,255,255,0.02)';
  for(let y=0;y<H;y+=4) ctx.fillRect(0,y,W,1);

  ctx.restore();
}

resetGame();
setState('start');
requestAnimationFrame(loop);

// expose for tests
window.__game = { resetGame, getState:()=>state, getScore:()=>score, W,H, GAME_TIME };

import { CONFIG, createInitialState, clamp, spawnGate, nextGapX, checkCollision, levelFromGates, gapForLevel, speedForLevel, renderGameToText } from './game.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const hudScore = document.getElementById('hudScore');
const hudLevel = document.getElementById('hudLevel');
const hudSpeed = document.getElementById('hudSpeed');
const gateBar = document.getElementById('gateBar');
const gateLabel = document.getElementById('gateLabel');
const speedBar = document.getElementById('speedBar');
const speedLabel = document.getElementById('speedLabel');
const streakEl = document.getElementById('streak');
const overlay = document.getElementById('overlay');
const startCard = document.getElementById('startCard');
const pauseCard = document.getElementById('pauseCard');
const gameOverCard = document.getElementById('gameOverCard');

let state = createInitialState();
let animId = null;
let lastTs = 0;

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),1900);
}

function updateHUD(){
  scoreEl.textContent = state.score;
  bestEl.textContent = state.best;
  levelEl.textContent = state.level;
  livesEl.textContent = '●'.repeat(state.lives) + '○'.repeat(CONFIG.lives - state.lives);
  livesEl.style.color = state.lives===1 ? '#ff4444' : '#ffdf85';
  hudScore.textContent = state.score.toString().padStart(4,'0');
  hudLevel.textContent = `Lv ${state.level}`;
  hudSpeed.textContent = `${(state.speed*22).toFixed(0)} km/s`;
  const prog = state.gateCount % CONFIG.gatesPerLevel;
  gateBar.style.width = `${prog/CONFIG.gatesPerLevel*100}%`;
  gateLabel.textContent = `${prog}/${CONFIG.gatesPerLevel}`;
  const spdPct = clamp((state.speed - CONFIG.baseSpeed)/ (speedForLevel(8)-CONFIG.baseSpeed)*100, 0,100);
  speedBar.style.width = `${20+spdPct*0.8}%`;
  speedLabel.textContent = `×${(state.speed/CONFIG.baseSpeed).toFixed(2)}`;
  streakEl.textContent = state.streak>0 ? `Streak: ${state.streak} — Pure gold! ✨` : 'Streak: 0 — keep it clean!';
  if(state.streak>=5) streakEl.style.color='#ffd24a'; else streakEl.style.color='#ffdf85';
}

function resetGame(){
  const best = state.best;
  state = createInitialState();
  state.best = best;
  state.status='playing';
  state.gates=[];
  // seed gates
  let gapX = CONFIG.canvasW/2;
  let gap = gapForLevel(1);
  for(let i=0;i<4;i++){
    gapX = i===0 ? gapX : nextGapX(gapX, gap);
    state.gates.push(spawnGate(-i*CONFIG.gateSpacing - 80, gap, gapX));
  }
  hideOverlay();
  showToast('Run started!');
  // keep window refs in sync (state is reassigned)
  window.__gg_state = state;
  window.render_game_to_text = () => renderGameToText(state);
}

function hideOverlay(){ overlay.classList.add('hidden'); startCard.classList.add('hidden'); pauseCard.classList.add('hidden'); gameOverCard.classList.add('hidden'); }
function showStart(){ state.status='start'; overlay.classList.remove('hidden'); startCard.classList.remove('hidden'); pauseCard.classList.add('hidden'); gameOverCard.classList.add('hidden'); }
function showPause(){ state.status='paused'; overlay.classList.remove('hidden'); pauseCard.classList.remove('hidden'); startCard.classList.add('hidden'); gameOverCard.classList.add('hidden'); }
function showOver(msg){
  state.status='over';
  overlay.classList.remove('hidden');
  gameOverCard.classList.remove('hidden');
  startCard.classList.add('hidden'); pauseCard.classList.add('hidden');
  document.getElementById('finalScore').textContent = `${state.score} pts — Level ${state.level}`;
  document.getElementById('gameOverTitle').textContent = state.score >= state.best && state.score>0 ? 'NEW BEST!' : 'GATE CLOSED';
  document.getElementById('finalMsg').textContent = msg;
  if(state.score > state.best){
    state.best = state.score;
    localStorage.setItem('gg_best', state.best);
  }
  updateHUD();
}

function triggerShake(intensity=8){
  state.shake = intensity;
}

// input
let keys={};
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k===' ' || k==='p'){ e.preventDefault(); togglePause(); }
  if(k==='r' && state.status==='over'){ resetGame(); }
  if(k==='enter' && state.status==='start'){ resetGame(); }
});
window.addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);

function handleTarget(clientX){
  const rect=canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * CONFIG.canvasW;
  state.targetX = clamp(x, 18, CONFIG.canvasW-18);
}
canvas.addEventListener('mousemove', e=>{ if(state.status==='playing') handleTarget(e.clientX); });
canvas.addEventListener('touchmove', e=>{ if(state.status==='playing'){ handleTarget(e.touches[0].clientX); e.preventDefault(); }},{passive:false});
canvas.addEventListener('touchstart', e=>{ if(state.status==='playing'){ handleTarget(e.touches[0].clientX);} });
canvas.addEventListener('click', ()=>{ if(state.status==='start') resetGame(); });

let leftHold=false,rightHold=false;
document.getElementById('leftBtn').addEventListener('touchstart',e=>{leftHold=true;e.preventDefault()});
document.getElementById('leftBtn').addEventListener('touchend',()=>leftHold=false);
document.getElementById('rightBtn').addEventListener('touchstart',e=>{rightHold=true;e.preventDefault()});
document.getElementById('rightBtn').addEventListener('touchend',()=>rightHold=false);
document.getElementById('leftBtn').addEventListener('mousedown',()=>leftHold=true);
document.getElementById('leftBtn').addEventListener('mouseup',()=>leftHold=false);
document.getElementById('rightBtn').addEventListener('mousedown',()=>rightHold=true);
document.getElementById('rightBtn').addEventListener('mouseup',()=>rightHold=false);

document.getElementById('startBtn').onclick=resetGame;
document.getElementById('restartBtn').onclick=resetGame;
document.getElementById('restartBtn2').onclick=resetGame;
document.getElementById('resumeBtn').onclick=()=>{ if(state.status==='paused'){ state.status='playing'; hideOverlay(); }};
document.getElementById('pauseBtn').onclick=togglePause;
function togglePause(){
  if(state.status==='playing') showPause();
  else if(state.status==='paused'){ state.status='playing'; hideOverlay(); }
}
document.getElementById('howBtn').onclick=()=>document.getElementById('howModal').classList.remove('hidden');
document.getElementById('closeHow').onclick=()=>document.getElementById('howModal').classList.add('hidden');
document.getElementById('howModal').addEventListener('click',e=>{ if(e.target.id==='howModal') e.currentTarget.classList.add('hidden')});

function spawnParticles(x,y,color, n=10){
  for(let i=0;i<n;i++){
    state.particles.push({
      x,y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6 -2,
      life:1, decay:0.04+Math.random()*0.05, r:2+Math.random()*3, color
    });
  }
}

function update(dt){
  if(state.status!=='playing') return;
  // keyboard steering
  const dir = (keys['arrowright']||keys['d'] ? 1:0) + (keys['arrowleft']||keys['a'] ? -1:0) + (rightHold?1:0) + (leftHold?-1:0);
  if(dir!==0){
    state.targetX = clamp(state.targetX + dir* 6 * dt/16, 18, CONFIG.canvasW-18);
  }
  // lerp player
  const prevX = state.playerX;
  const diff = state.targetX - state.playerX;
  const k = 1 - Math.pow(0.001, dt/16);
  state.playerX += diff * k * 0.55;
  state.playerX = clamp(state.playerX, 18, CONFIG.canvasW-18);

  // move gates
  for(const g of state.gates){
    g.y += state.speed * dt/16 * 6; // scale
  }
  // check passing / collision when gate around player Y
  const playerY = CONFIG.playerY;
  for(const g of state.gates){
    if(g.passed || g.hit) continue;
    const gateTop = g.y;
    const gateBot = g.y + CONFIG.gateHeight;
    if(gateBot >= playerY - 14 && gateTop <= playerY + 14){
      // overlapping vertically -> test collision
      if(checkCollision(state.playerX, g)){
        // hit
        g.hit=true;
        state.lives -=1;
        state.streak=0;
        triggerShake(12);
        spawnParticles(state.playerX, playerY, '#ff3b30', 14);
        showToast(state.lives>0 ? `Hit! ${state.lives} lives left` : 'Crash!');
        if(state.lives<=0){
          showOver('You clipped the gold. The aperture won this time.');
          return;
        }
      }
    }
    if(!g.passed && !g.hit && g.y > playerY + 18){
      g.passed=true;
      state.score += 100 + Math.floor(state.streak*18);
      state.streak +=1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.gateCount +=1;
      // level up?
      const nl = levelFromGates(state.gateCount);
      if(nl!==state.level){
        state.level = nl;
        state.speed = speedForLevel(nl);
        showToast(`Level ${nl} — aperture tightens!`);
        spawnParticles(CONFIG.canvasW/2, 120, '#ffd24a', 12);
      }
      spawnParticles(g.gapX, g.y+10, '#ffdf85', 6);
    }
  }
  // recycle gates
  state.gates = state.gates.filter(g=> g.y < CONFIG.canvasH+60);
  while(state.gates.length < 6){
    const last = state.gates[state.gates.length-1];
    const gap = gapForLevel(state.level);
    const nx = nextGapX(last ? last.gapX : CONFIG.canvasW/2, gap);
    const y = (last ? last.y : 0) - CONFIG.gateSpacing;
    state.gates.push(spawnGate(y, gap, nx));
  }
  // particles
  for(const p of state.particles){ p.x+=p.vx; p.y+=p.vy; p.vy+=0.18; p.life-=p.decay; p.vx*=0.98; }
  state.particles = state.particles.filter(p=> p.life>0);
  if(state.shake>0) state.shake *= 0.85;
  if(state.shake<0.3) state.shake=0;
  state.distance += state.speed;
  updateHUD();
}

function draw(){
  const w=CONFIG.canvasW, h=CONFIG.canvasH;
  ctx.save();
  if(state.shake){
    ctx.translate((Math.random()-0.5)*state.shake, (Math.random()-0.5)*state.shake);
  }
  // bg
  ctx.clearRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#0e0c08');
  grad.addColorStop(0.5,'#09090a');
  grad.addColorStop(1,'#050507');
  ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
  // subtle gold vignette
  const vg=ctx.createRadialGradient(w/2,h*0.35,w*0.2,w/2,h*0.35,w*0.9);
  vg.addColorStop(0,'rgba(255,210,80,0.06)');
  vg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h);
  // lane markers
  ctx.strokeStyle='rgba(255,210,90,0.07)'; ctx.lineWidth=1; ctx.setLineDash([8,14]);
  for(let x= w*0.25; x< w; x+= w*0.25){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  ctx.setLineDash([]);
  // track center glow
  ctx.fillStyle='rgba(255,200,60,0.04)'; ctx.fillRect(w/2-1,0,2,h);

  // gates
  for(const g of state.gates){
    const gapL = g.gapX - g.gap/2;
    const gapR = g.gapX + g.gap/2;
    // left chevron block
    drawChevronGate(gapL, g.y, 'left', g.hit, g.passed);
    drawChevronGate(gapR, g.y, 'right', g.hit, g.passed);
    // top glow line when near
    if(g.y > 80 && g.y < h-80){
      ctx.fillStyle='rgba(255,200,60,0.03)'; ctx.fillRect(0,g.y,w,2);
    }
  }
  // particles
  for(const p of state.particles){
    ctx.globalAlpha = Math.max(0,p.life);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r* p.life,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
  // player
  drawPlayer(state.playerX, CONFIG.playerY, state.status==='playing');

  // trail
  ctx.restore();
}

function drawChevronGate(edgeX, y, side, isHit, isPassed){
  const h=CONFIG.gateHeight;
  const isLeft = side==='left';
  // bracket body extends to edge
  const blockW = isLeft ? edgeX : CONFIG.canvasW - edgeX;
  const x = isLeft ? 0 : edgeX;
  // base metal
  const grad=ctx.createLinearGradient(x,y, x,y+h);
  if(isHit){ grad.addColorStop(0,'#ff5a3a'); grad.addColorStop(1,'#8a1a00'); }
  else if(isPassed){ grad.addColorStop(0,'#2a2410'); grad.addColorStop(1,'#141208'); }
  else { grad.addColorStop(0,'#ffe9a0'); grad.addColorStop(0.5,'#ffb700'); grad.addColorStop(1,'#7a4d00'); }
  ctx.fillStyle=grad;
  ctx.fillRect(x,y, blockW, h);
  // bevel highlight top
  ctx.fillStyle = isHit ? 'rgba(255,180,160,.4)' : 'rgba(255,255,220,.55)';
  ctx.fillRect(x,y, blockW, 3);
  // inner shadow bottom
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(x,y+h-3, blockW,3);
  // chevron tip
  ctx.fillStyle=grad;
  ctx.beginPath();
  if(isLeft){
    const tip = edgeX + 18;
    ctx.moveTo(edgeX, y);
    ctx.lineTo(tip, y+h/2);
    ctx.lineTo(edgeX, y+h);
    ctx.lineTo(edgeX-14, y+h);
    ctx.lineTo(tip-14, y+h/2);
    ctx.lineTo(edgeX-14, y);
    ctx.closePath();
  } else {
    const tip = edgeX - 18;
    ctx.moveTo(edgeX, y);
    ctx.lineTo(edgeX+14, y);
    ctx.lineTo(tip+14, y+h/2);
    ctx.lineTo(edgeX+14, y+h);
    ctx.lineTo(edgeX, y+h);
    ctx.lineTo(tip, y+h/2);
    ctx.closePath();
  }
  ctx.fill();
  // outer glow
  if(!isHit && !isPassed){
    ctx.shadowColor='rgba(255,180,0,.9)'; ctx.shadowBlur=14;
    ctx.fill();
    ctx.shadowBlur=0;
  }
  // side frame line
  ctx.strokeStyle='rgba(255,220,120,.35)'; ctx.lineWidth=1;
  ctx.strokeRect(x+0.5,y+0.5, blockW-1, h-1);
}

function drawPlayer(x,y, alive){
  // shadow
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(x, y+16, 18, 7, 0,0,Math.PI*2); ctx.fill();
  // body diamond
  ctx.save();
  ctx.translate(x,y);
  // glow
  ctx.shadowColor='rgba(255,210,60,.9)'; ctx.shadowBlur=18;
  const g=ctx.createLinearGradient(-12,-12,12,12);
  g.addColorStop(0,'#fff6cc');
  g.addColorStop(0.45,'#ffcc33');
  g.addColorStop(1,'#b47a00');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(0,-16); ctx.lineTo(14,-1); ctx.lineTo(10,14); ctx.lineTo(-10,14); ctx.lineTo(-14,-1); ctx.closePath();
  ctx.fill();
  ctx.shadowBlur=0;
  // inner highlight
  ctx.fillStyle='rgba(255,255,255,.82)'; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(7,-2); ctx.lineTo(0,2); ctx.lineTo(-6,-2); ctx.closePath(); ctx.fill();
  // cockpit dot
  ctx.fillStyle='#1a1200'; ctx.beginPath(); ctx.arc(0,4,3.5,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function loop(ts){
  const dt = Math.min(32, ts - lastTs || 16);
  lastTs=ts;
  update(dt);
  draw();
  animId=requestAnimationFrame(loop);
}

// boot
updateHUD();
showStart();
draw();
loop(0);

// expose for tests / tooling
window.__gg_state = state;
window.render_game_to_text = () => renderGameToText(state);
window.__gg_reset = resetGame;
window.__gg_CONFIG = CONFIG;

// PWA-ish: hide overlay when playing via space

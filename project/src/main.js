import { createInitialState, update, moveBasket, setBasketPosition, CONFIG, getLevelFromScore } from './game.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvasWrap');
const scoreEl = document.getElementById('scoreEl');
const levelEl = document.getElementById('levelEl');
const levelProgress = document.getElementById('levelProgress');
const livesEl = document.getElementById('livesEl');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayDesc = document.getElementById('overlayDesc');
const overlayIcon = document.getElementById('overlayIcon');
const overlayStats = document.getElementById('overlayStats');
const startBtn = document.getElementById('startBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const soundBtn = document.getElementById('soundBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtnMobile = document.getElementById('restartBtnMobile');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const bestScoreEl = document.getElementById('bestScoreEl');
const caughtEl = document.getElementById('caughtEl');
const bombsEl = document.getElementById('bombsEl');
const footerScore = document.getElementById('footerScore');

const STATE = createInitialState(CONFIG.width, CONFIG.height);
let lastTime = 0;
let running = false;
let paused = false;
let inputLeft = false;
let inputRight = false;
let dragging = false;
let soundOn = true;
let bestScore = Number(localStorage.getItem('cc_best') || 0);
let particles = [];
let popTexts = [];
let shake = 0;

bestScoreEl.textContent = String(bestScore);

// high DPI
function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  // Keep logical size 480x720, but scale for DPR
  canvas.width = CONFIG.width * dpr;
  canvas.height = CONFIG.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // store rect for input mapping
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Audio - simple beeps
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function beep(freq, dur, type='sine', gain=0.12) {
  if (!soundOn) return;
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
function soundCatch(type) {
  const map = { blue: [440, 660], purple: [554, 831], cyan: [659, 988], gold: [880, 1320] };
  const [a,b] = map[type] || [500,800];
  beep(a, .12, 'sine', 0.14);
  setTimeout(()=>beep(b, .14, 'triangle', 0.12), 70);
}
function soundBomb(){ beep(180,.18,'square',0.18); setTimeout(()=>beep(90,.25,'sawtooth',0.09),120); }
function soundGameOver(){ beep(220,.2,'sine',0.14); setTimeout(()=>beep(165,.3,'sine',0.12),180); setTimeout(()=>beep(110,.5,'sine',0.09),400); }

function showOverlay(mode) {
  // mode: 'start' | 'gameover'
  if (mode === 'gameover') {
    overlayIcon.textContent = '💥';
    overlayTitle.textContent = 'Run Complete';
    overlayDesc.innerHTML = `You caught <b>${STATE.caught}</b> crystals and dodged the shadows.<br>Score <b>${STATE.score}</b> • Level <b>${STATE.level}</b>`;
    overlayStats.innerHTML = `
      <div class="stat"><span>Final Score</span><strong>${STATE.score}</strong></div>
      <div class="stat"><span>Best Score</span><strong>${Math.max(bestScore, STATE.score)}</strong></div>
      <div class="stat"><span>Level Reached</span><strong>${STATE.level}</strong></div>
      <div class="stat"><span>Crystals</span><strong>${STATE.caught}</strong></div>`;
    startBtn.textContent = 'Play Again ↻';
  } else {
    overlayIcon.textContent = '◆';
    overlayTitle.textContent = 'Crystal Catcher';
    overlayDesc.innerHTML = 'Catch the falling crystals. Avoid the bombs.<br>Use <b>← →</b> or <b>A D</b>. Drag the basket on mobile.';
    overlayStats.innerHTML = `
      <div class="stat"><span>Blue</span><strong style="color:#38bdf8">10 pts</strong></div>
      <div class="stat"><span>Purple</span><strong style="color:#a78bfa">20 pts</strong></div>
      <div class="stat"><span>Cyan</span><strong style="color:#22d3ee">30 pts</strong></div>
      <div class="stat"><span>Gold</span><strong style="color:#facc15">50 pts ★</strong></div>`;
    startBtn.textContent = 'Play Now →';
  }
  overlay.classList.remove('hidden');
}
function hideOverlay(){ overlay.classList.add('hidden'); }

function resetGame() {
  particles = []; popTexts=[]; shake=0;
  const fresh = createInitialState(CONFIG.width, CONFIG.height);
  Object.assign(STATE, fresh);
  // preserve best
  paused = false; pauseOverlay.classList.add('hidden');
  updateHUD();
  hideOverlay();
  if (!running) { running = true; lastTime = performance.now(); requestAnimationFrame(loop); }
}

function updateHUD(){
  scoreEl.textContent = String(STATE.score);
  levelEl.textContent = String(STATE.level);
  footerScore.textContent = `${STATE.score} pts`;
  const progress = ((STATE.score % CONFIG.levelScoreStep) / CONFIG.levelScoreStep) * 100;
  levelProgress.style.width = `${progress}%`;
  // lives
  livesEl.innerHTML = '';
  for (let i=0;i<CONFIG.initialLives;i++){
    const h = document.createElement('div');
    h.className = 'heart' + (i < STATE.lives ? '' : ' empty');
    h.textContent = i < STATE.lives ? '♥' : '♡';
    livesEl.appendChild(h);
  }
  bestScoreEl.textContent = String(Math.max(bestScore, STATE.score));
  caughtEl.textContent = String(STATE.caught);
  bombsEl.textContent = String(STATE.bombsHit);
}

function addParticles(x,y,color, count=10, bomb=false){
  for(let i=0;i<count;i++){
    particles.push({
      x,y,
      vx: (Math.random()-0.5)* (bomb? 380: 260),
      vy: (Math.random()-0.5)* (bomb? 380: 260) - 40,
      life: 0,
      max: bomb? 0.6 : 0.7,
      size: bomb? 4+Math.random()*5 : 3+Math.random()*4,
      color,
      bomb
    });
  }
}
function addPop(x,y,text,color){
  popTexts.push({ x,y, vy:-60, life:0, max:0.9, text, color, alpha:1 });
}

function handleEvents(events){
  for(const c of events.caught){
    soundCatch(c.type);
    const cx = c.x + c.width/2;
    const cy = c.y + c.height/2;
    const col = crystalColor(c.type);
    addParticles(cx, cy, col, c.type==='gold'?18:12, false);
    addPop(cx, cy-10, `+${c.value}`, col);
    if(c.type==='gold') shake = 6;
    else shake = Math.max(shake, 2);
  }
  for(const b of events.bombHits){
    soundBomb();
    addParticles(b.x+b.width/2, b.y+b.height/2, '#fb7185', 18, true);
    addPop(b.x+b.width/2, b.y, '-1 ♥', '#fb7185');
    shake = 12;
    if(events.gameOver){
      soundGameOver();
      bestScore = Math.max(bestScore, STATE.score);
      localStorage.setItem('cc_best', String(bestScore));
      bestScoreEl.textContent = String(bestScore);
      showOverlay('gameover');
      running = false;
    }
  }
}

function crystalColor(type){
  if(type==='blue') return '#38bdf8';
  if(type==='purple') return '#a78bfa';
  if(type==='cyan') return '#22d3ee';
  if(type==='gold') return '#facc15';
  return '#fff';
}

// Input: keyboard
const keys = new Set();
window.addEventListener('keydown', e=>{
  if(['ArrowLeft','a','A'].includes(e.key)) { keys.add('left'); inputLeft=true; e.preventDefault(); }
  if(['ArrowRight','d','D'].includes(e.key)) { keys.add('right'); inputRight=true; e.preventDefault(); }
  if(e.key===' ' || e.key==='p' || e.key==='P'){ togglePause(); }
  if(e.key==='r' || e.key==='R'){ resetGame(); }
  // start on any key if overlay visible
  if(!overlay.classList.contains('hidden') && (e.key==='Enter' || e.key===' ')) {
    ensureAudio(); resetGame();
  }
});
window.addEventListener('keyup', e=>{
  if(['ArrowLeft','a','A'].includes(e.key)) { keys.delete('left'); inputLeft = keys.has('left'); }
  if(['ArrowRight','d','D'].includes(e.key)) { keys.delete('right'); inputRight = keys.has('right'); }
});

// pointer drag on canvas
function canvasXFromClient(clientX){
  const rect = wrap.getBoundingClientRect();
  // map clientX to logical width 480
  const scale = CONFIG.width / rect.width;
  return (clientX - rect.left) * scale;
}
function onPointerMove(x){
  setBasketPosition(STATE, x);
}
wrap.addEventListener('pointerdown', e=>{
  if(overlay.classList.contains('hidden')===false && e.target.closest('.overlay-card')) return;
  dragging = true; wrap.setPointerCapture(e.pointerId);
  onPointerMove(canvasXFromClient(e.clientX));
  e.preventDefault();
});
wrap.addEventListener('pointermove', e=>{
  if(!dragging) return;
  onPointerMove(canvasXFromClient(e.clientX));
});
wrap.addEventListener('pointerup', e=>{ dragging=false; });
wrap.addEventListener('pointercancel', ()=> dragging=false);
wrap.addEventListener('touchmove', e=>{ if(dragging) e.preventDefault(); }, {passive:false});

// buttons hold
function bindHold(btn, dir){
  let holding=false;
  let raf=null;
  const start=(e)=>{ e.preventDefault(); holding=true; if(dir<0) inputLeft=true; else inputRight=true; };
  const end=()=>{ holding=false; if(dir<0) inputLeft=false; else inputRight=false; };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointerleave', end);
  btn.addEventListener('pointercancel', end);
}
bindHold(leftBtn, -1);
bindHold(rightBtn, 1);

// clicks
startBtn.addEventListener('click', ()=>{ ensureAudio(); if(STATE.gameOver || STATE.score===0 && STATE.caught===0){ resetGame(); } else { hideOverlay(); if(!running){running=true; lastTime=performance.now(); requestAnimationFrame(loop);} } });
restartBtn.addEventListener('click', resetGame);
restartBtnMobile.addEventListener('click', resetGame);
pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
soundBtn.addEventListener('click', ()=>{
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? '🔊' : '🔈';
  if(soundOn) ensureAudio();
});
function togglePause(){
  if(STATE.gameOver) return;
  if(overlay.classList.contains('hidden')===false) return; // don't pause during start overlay
  paused = !paused;
  pauseBtn.textContent = paused ? '▶' : '⏸';
  if(paused) pauseOverlay.classList.remove('hidden');
  else { pauseOverlay.classList.add('hidden'); lastTime = performance.now(); }
}

// game loop
function loop(now){
  if(!running) { draw(); return; }
  if(paused){ draw(); requestAnimationFrame(loop); lastTime = now; return; }
  const delta = Math.min(32, now - lastTime);
  lastTime = now;

  // input movement
  const dir = (inputRight?1:0) + (inputLeft?-1:0);
  if(dir!==0) moveBasket(STATE, dir, delta/1000);

  const events = update(STATE, delta);
  handleEvents(events);
  updateHUD();

  // update particles
  const dt = delta/1000;
  for(const p of particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+= 620*dt; p.life+=dt; p.vx*=0.99; }
  particles = particles.filter(p=>p.life < p.max);
  for(const t of popTexts){ t.y+=t.vy*dt; t.life+=dt; t.alpha = 1 - t.life/t.max; }
  popTexts = popTexts.filter(t=>t.life < t.max);
  if(shake>0) shake -= dt*30;
  if(shake<0) shake=0;

  draw();
  if(!STATE.gameOver) requestAnimationFrame(loop);
  else {
    // draw one last time with overlay
  }
}

// Rendering
function draw(){
  // clear
  ctx.save();
  if(shake>0){
    const sx = (Math.random()-0.5)*shake;
    const sy = (Math.random()-0.5)*shake;
    ctx.translate(sx, sy);
  }
  // background
  const g = ctx.createLinearGradient(0,0,0,CONFIG.height);
  g.addColorStop(0,'#0b1226');
  g.addColorStop(0.35,'#131c3a');
  g.addColorStop(1,'#0a0f1e');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CONFIG.width, CONFIG.height);

  // stars / bokeh
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const stars = [[40,80],[120,60],[200,110],[320,70],[410,95],[80,180],[360,210],[50,300],[440,330],[30,420],[180,380],[300,450],[400,500],[90,560],[240,600]];
  for(const [x,y] of stars){
    const tw = 0.6+ Math.sin(performance.now()/800 + x)*0.4;
    ctx.globalAlpha = 0.35*tw;
    ctx.beginPath(); ctx.arc(x,y,1.2,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // subtle cave vignette
  const vg = ctx.createRadialGradient(CONFIG.width/2, CONFIG.height/2, 280, CONFIG.width/2, CONFIG.height/2, 520);
  vg.addColorStop(0,'transparent');
  vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,CONFIG.width, CONFIG.height);

  // grid glow at bottom
  ctx.fillStyle = 'rgba(110,231,255,0.06)';
  ctx.fillRect(0, CONFIG.height-80, CONFIG.width, 80);
  ctx.strokeStyle = 'rgba(110,231,255,0.08)';
  ctx.lineWidth = 1;
  for(let x=0;x<CONFIG.width;x+=40){ ctx.beginPath(); ctx.moveTo(x, CONFIG.height-80); ctx.lineTo(x-20, CONFIG.height); ctx.stroke(); }

  // draw objects
  for(const obj of STATE.objects){
    if(obj.type==='bomb') drawBomb(obj);
    else drawCrystal(obj);
  }

  // basket
  drawBasket(STATE.basket);

  // particles
  for(const p of particles){
    const a = 1 - p.life/p.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.bomb? 12:8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size*a, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha=1;
  // pop texts
  ctx.font = '700 16px Space Grotesk, Outfit, sans-serif';
  ctx.textAlign='center';
  for(const t of popTexts){
    ctx.globalAlpha = t.alpha;
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 6;
    ctx.fillText(t.text, t.x, t.y);
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
  ctx.textAlign='left';
  ctx.restore();

  // top shimmer line
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.fillRect(0,0,CONFIG.width,1);
}

function drawBasket(b){
  const x=b.x, y=b.y, w=b.width, h=b.height;
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x+w/2, y+h+8, w/2.2, 8, 0,0,Math.PI*2); ctx.fill();
  // base gradient
  const grad = ctx.createLinearGradient(x,y,x,y+h);
  grad.addColorStop(0,'#c9a86a');
  grad.addColorStop(0.45,'#8c6230');
  grad.addColorStop(1,'#5a3a1a');
  ctx.fillStyle=grad;
  // basket shape with curved bottom
  ctx.beginPath();
  ctx.moveTo(x+6, y);
  ctx.lineTo(x+w-6, y);
  ctx.lineTo(x+w-2, y+h-6);
  ctx.quadraticCurveTo(x+w/2, y+h+4, x+2, y+h-6);
  ctx.closePath();
  ctx.fill();
  // rim highlight
  ctx.fillStyle='#e6c99a';
  ctx.fillRect(x, y-6, w, 8);
  ctx.fillStyle='rgba(255,255,255,0.25)';
  ctx.fillRect(x, y-6, w, 2);
  // weave lines
  ctx.strokeStyle='rgba(60,30,10,0.35)';
  ctx.lineWidth=1;
  for(let i=1;i<4;i++){
    const yy = y + (h/4)*i;
    ctx.beginPath(); ctx.moveTo(x+8, yy); ctx.lineTo(x+w-8, yy); ctx.stroke();
  }
  for(let i=1;i<6;i++){
    const xx = x + (w/6)*i;
    ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx-4, y+h); ctx.stroke();
  }
  // inner glow when catching
  ctx.strokeStyle='rgba(110,231,255,0.35)';
  ctx.lineWidth=2;
  ctx.strokeRect(x+4, y+2, w-8, h-4);
  // handle highlight
  ctx.fillStyle='rgba(255,255,255,0.45)';
  ctx.fillRect(x+w/2-18, y-6, 36, 2);
}

function drawCrystal(o){
  const x=o.x, y=o.y, w=o.width, h=o.height;
  const cx = x+w/2, cy=y+h/2;
  const col = crystalColor(o.type);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(o.rotation);
  // glow
  ctx.shadowColor = col;
  ctx.shadowBlur = o.type==='gold'? 18: 14;
  ctx.fillStyle = col;
  // diamond shape (octagon-ish crystal)
  ctx.beginPath();
  const r = w/2;
  // faceted diamond path
  ctx.moveTo(0, -r);
  ctx.lineTo(r*0.6, -r*0.35);
  ctx.lineTo(r*0.85, 0);
  ctx.lineTo(r*0.45, r*0.85);
  ctx.lineTo(0, r);
  ctx.lineTo(-r*0.45, r*0.85);
  ctx.lineTo(-r*0.85, 0);
  ctx.lineTo(-r*0.6, -r*0.35);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // inner highlight
  const grad = ctx.createLinearGradient(-r*0.5, -r, r*0.5, r);
  grad.addColorStop(0,'rgba(255,255,255,0.85)');
  grad.addColorStop(0.3,'rgba(255,255,255,0.25)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -r*0.85);
  ctx.lineTo(r*0.35, -r*0.2);
  ctx.lineTo(0, r*0.15);
  ctx.lineTo(-r*0.35, -r*0.2);
  ctx.closePath();
  ctx.fill();
  // edge lines
  ctx.strokeStyle='rgba(255,255,255,0.35)';
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(0,-r); ctx.lineTo(0,r); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r*0.85,0); ctx.lineTo(r*0.85,0); ctx.stroke();
  // small sparkle
  ctx.fillStyle='white';
  ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.arc(r*0.28, -r*0.45, 2.2,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  ctx.restore();
}

function drawBomb(o){
  const x=o.x, y=o.y, w=o.width, h=o.height;
  const cx=x+w/2, cy=y+h/2;
  ctx.save();
  ctx.translate(cx, cy);
  // rotate a bit but bomb orientation stays
  ctx.rotate(o.rotation*0.3);
  // glow red
  ctx.shadowColor='rgba(251,113,133,0.55)';
  ctx.shadowBlur=14;
  // body
  const grad = ctx.createRadialGradient(-w*0.2, -h*0.25, 4, 0,0, w*0.6);
  grad.addColorStop(0,'#3a3f55');
  grad.addColorStop(0.5,'#1a1f2e');
  grad.addColorStop(1,'#0b0f1a');
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.arc(0,2,w/2-1,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // highlight
  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-w*0.18, -h*0.22, w*0.22, h*0.18, -0.6, 0,Math.PI*2); ctx.fill();
  // fuse
  ctx.strokeStyle='#facc15';
  ctx.lineWidth=3;
  ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(0, -h/2+2);
  ctx.quadraticCurveTo(6, -h/2 -6, 10, -h/2 -8);
  ctx.stroke();
  // spark
  const t = performance.now()/120;
  const sx = 10 + Math.sin(t)*1.2;
  const sy = -h/2 -8 + Math.cos(t*1.3)*1.2;
  ctx.fillStyle='#fde68a';
  ctx.shadowColor='#facc15'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(sx, sy, 3.5 + Math.sin(t*2)*0.8, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // skull-ish face (simple)
  ctx.fillStyle='rgba(251,113,133,0.9)';
  ctx.beginPath(); ctx.arc(-5,1,2.2,0,Math.PI*2); ctx.arc(5,1,2.2,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(251,113,133,0.9)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.arc(0,6,4,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
  ctx.restore();
}

// initial state
showOverlay('start');
updateHUD();
draw();
resizeCanvas();

// expose for tests/debug
window.__STATE = STATE;

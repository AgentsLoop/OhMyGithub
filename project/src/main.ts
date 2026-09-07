import { aabb, circleRect, difficulty, baseGateSpeed, createGate, createCell, playerRect, scoreForCell, scoreForGate } from './game';
import type { Gate, Cell } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const W = 960, H = 540;

const overlayStart = document.getElementById('overlay-start')!;
const overlayPause = document.getElementById('overlay-pause')!;
const overlayOver = document.getElementById('overlay-over')!;

const elScore = document.getElementById('score')!;
const elBest = document.getElementById('best')!;
const elCells = document.getElementById('cells')!;
const elSpeed = document.getElementById('speed')!;
const elFinalScore = document.getElementById('final-score')!;
const elFinalCells = document.getElementById('final-cells')!;
const elFinalTime = document.getElementById('final-time')!;
const elFinalBest = document.getElementById('final-best')!;
const elReason = document.getElementById('crash-reason')!;
const announce = document.getElementById('sr-announce')!;

const btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
const btnHow = document.getElementById('btn-how') as HTMLButtonElement;
const btnResume = document.getElementById('btn-resume') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnRestartPause = document.getElementById('btn-restart-pause') as HTMLButtonElement;
const btnMenu = document.getElementById('btn-menu') as HTMLButtonElement;

type State = 'menu'|'playing'|'paused'|'over';
let state: State = 'menu';

let player = { x: 180, y: H/2, vx:0, vy:0 };
let gates: Gate[] = [];
let cells: Cell[] = [];
let particles: {x:number,y:number,vx:number,vy:number,life:number, col:string}[] = [];
let stars: {x:number,y:number,s:number,sp:number}[] = [];

let score = 0;
let cellsCollected = 0;
let time = 0;
let best = Number(localStorage.getItem('ngr-best')||'0');
let gateTimer = 0;
let keys = new Set<string>();
let last = 0;
let animId = 0;

elBest.textContent = String(best);

function initStars(){
  stars = Array.from({length: 90}, ()=>({x: Math.random()*W, y: Math.random()*H, s: Math.random()*1.4+0.3, sp: Math.random()*20+10}));
}
initStars();

function reset(){
  player = { x: 180, y: H/2, vx:0, vy:0 };
  gates=[]; cells=[]; particles=[];
  score=0; cellsCollected=0; time=0; gateTimer=0;
  updateHUD();
}

function setState(s: State){
  state=s;
  overlayStart.classList.toggle('hidden', s!=='menu');
  overlayPause.classList.toggle('hidden', s!=='paused');
  overlayOver.classList.toggle('hidden', s!=='over');
  if(s==='menu') btnPlay.focus();
  if(s==='over') btnRestart.focus();
  if(s==='paused') btnResume.focus();
}

function updateHUD(){
  elScore.textContent = String(Math.floor(score));
  elCells.textContent = String(cellsCollected);
  const { speedMult } = difficulty(time);
  elSpeed.textContent = speedMult.toFixed(1)+'x';
  elBest.textContent = String(Math.floor(best));
}

function announceMsg(m:string){ announce.textContent=m; }

function spawnGate(){
  const g = createGate(W, time);
  gates.push(g);
  const maybe = createCell(g, W, H);
  if(maybe) cells.push(maybe);
  else {
    const extra = createCell(null, W, H);
    if(extra && Math.random()<0.8) cells.push(extra);
  }
}

// Input
window.addEventListener('keydown', (e)=>{
  const k = e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k) || k==='r' || k==='escape'){
    // prevent scrolling with arrows/space
    if(['arrowup','arrowdown',' ','arrowleft','arrowright'].includes(k)) e.preventDefault();
  }
  keys.add(k);
  if(k===' '){
    if(state==='menu'){ start(); }
    else if(state==='playing'){ pause(); }
    else if(state==='paused'){ resume(); }
    else if(state==='over'){ restart(); }
  }
  if(k==='p' && state==='playing') pause();
  if(k==='escape'){
    if(state==='playing') pause();
    else if(state==='paused') resume();
  }
  if(k==='r'){
    if(state==='playing' || state==='over' || state==='paused') restart();
  }
  if(k==='enter'){
    if(state==='menu') start();
    if(state==='over') restart();
  }
});
window.addEventListener('keyup', (e)=> keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', ()=> keys.clear());

// Touch
document.querySelectorAll<HTMLButtonElement>('.tbtn').forEach(b=>{
  const dir = b.dataset.dir!;
  const press = ()=> keys.add('arrow'+dir);
  const release = ()=> keys.delete('arrow'+dir);
  b.addEventListener('touchstart', (e)=>{e.preventDefault(); press();});
  b.addEventListener('touchend', (e)=>{e.preventDefault(); release();});
  b.addEventListener('mousedown', press);
  b.addEventListener('mouseup', release);
  b.addEventListener('mouseleave', release);
});

btnPlay.addEventListener('click', start);
btnHow.addEventListener('click', ()=>{
  announceMsg('Use arrow keys or WASD to move, dodge gates, collect cells');
  // gentle shake hint
  btnPlay.focus();
});
btnResume.addEventListener('click', resume);
btnRestart.addEventListener('click', restart);
btnRestartPause.addEventListener('click', restart);
btnMenu.addEventListener('click', ()=>{ setState('menu'); reset(); });
document.getElementById('link-pause')?.addEventListener('click', (e)=>{e.preventDefault(); if(state==='playing') pause(); else if(state==='paused') resume();});
document.getElementById('link-restart')?.addEventListener('click', (e)=>{e.preventDefault(); restart();});

function start(){
  if(state==='over' || state==='menu' || state==='paused'){
    reset();
    setState('playing');
    last = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
    announceMsg('Run started');
  }
}
function pause(){
  if(state!=='playing') return;
  setState('paused');
  announceMsg('Paused');
}
function resume(){
  if(state!=='paused') return;
  setState('playing');
  last = performance.now();
  animId = requestAnimationFrame(loop);
}
function restart(){
  reset();
  setState('playing');
  last = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
  announceMsg('Restarted');
}
function gameOver(reason:string){
  setState('over');
  const finalScore = Math.floor(score);
  elFinalScore.textContent = String(finalScore);
  elFinalCells.textContent = String(cellsCollected);
  elFinalTime.textContent = time.toFixed(1)+'s';
  if(finalScore>best){ best=finalScore; localStorage.setItem('ngr-best', String(best)); }
  elFinalBest.textContent = String(Math.floor(best));
  elReason.textContent = reason;
  elBest.textContent = String(Math.floor(best));
  // burst particles
  for(let i=0;i<28;i++) particles.push({x:player.x, y:player.y, vx:(Math.random()-0.5)*300, vy:(Math.random()-0.5)*300, life:0.6, col: i%2?'#00f0ff':'#ff1a8f'});
  announceMsg(`Game over ${reason} score ${score}`);
}

function loop(now:number){
  if(state!=='playing') return;
  const dt = Math.min(0.033, (now-last)/1000);
  last = now;
  time += dt;
  update(dt);
  render(dt);
  updateHUD();
  animId = requestAnimationFrame(loop);
}

function update(dt:number){
  const { speedMult, gateIntervalMs } = difficulty(time);
  const speed = baseGateSpeed()*speedMult;

  // player physics - smooth acceleration
  const accel = 900;
  const maxV = 360;
  const friction = 0.88; // decay when no input
  let ax=0, ay=0;
  if(keys.has('arrowup')||keys.has('w')) ay -=1;
  if(keys.has('arrowdown')||keys.has('s')) ay +=1;
  if(keys.has('arrowleft')||keys.has('a')) ax -=1;
  if(keys.has('arrowright')||keys.has('d')) ax +=1;
  // normalize diagonal
  if(ax!==0 && ay!==0){ ax*=0.71; ay*=0.71; }
  player.vx += ax*accel*dt;
  player.vy += ay*accel*dt;
  if(ax===0) player.vx *= Math.pow(friction, dt*60);
  if(ay===0) player.vy *= Math.pow(friction, dt*60);
  player.vx = Math.max(-maxV, Math.min(maxV, player.vx));
  player.vy = Math.max(-maxV, Math.min(maxV, player.vy));
  player.x += player.vx*dt;
  player.y += player.vy*dt;
  // bounds
  const pr = playerRect(player.x, player.y);
  if(player.x -16 < 6){ player.x = 22; player.vx=0; }
  if(player.x +16 > W-6){ player.x = W-22; player.vx=0; }
  if(player.y -10 < 8){ player.y = 18; player.vy=0; }
  if(player.y +10 > H-8){ player.y = H-18; player.vy=0; }

  // gates movement
  gateTimer += dt*1000;
  if(gateTimer > gateIntervalMs){ gateTimer=0; spawnGate(); }
  for(const g of gates) g.x -= speed*dt;
  gates = gates.filter(g=> g.x + g.w > -60);

  // cells movement
  for(const c of cells){ c.x -= speed*dt; c.pulse += dt*6; }
  cells = cells.filter(c=> !c.collected && c.x + c.r > -20);

  // collisions - gates
  const pRect = playerRect(player.x, player.y);
  // wall collision with top/bottom? already bounded
  for(const g of gates){
    const top: import('./game').Rect = {x:g.x, y:0, w:g.w, h:g.gapY};
    const bot: import('./game').Rect = {x:g.x, y:g.gapY+g.gapH, w:g.w, h:H-(g.gapY+g.gapH)};
    if(aabb(pRect, top) || aabb(pRect, bot)){
      gameOver('Impact with laser gate — gate breach');
      return;
    }
    if(!g.passed && g.x + g.w < player.x){
      g.passed=true;
      score += scoreForGate();
      // small pass effect
      particles.push({x:g.x+g.w/2, y: g.gapY+g.gapH/2, vx:0, vy:-40, life:0.4, col:'#00ff9d'});
    }
  }
  // collisions - cells
  for(const c of cells){
    if(!c.collected && circleRect(c.x, c.y, c.r, pRect)){
      c.collected=true;
      score += scoreForCell();
      cellsCollected++;
      // particles
      for(let i=0;i<10;i++) particles.push({x:c.x, y:c.y, vx:(Math.random()-0.5)*180, vy:(Math.random()-0.5)*180, life:0.5, col:'#ffd60a'});
    }
  }
  cells = cells.filter(c=> !c.collected);
  // ambient score tick - keep float, HUD floors
  score += dt*6*speedMult;

  // particles
  for(const p of particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+= 300*dt; p.life-=dt; }
  particles = particles.filter(p=> p.life>0);

  // stars parallax
  for(const s of stars){ s.x -= s.sp*speedMult*dt*0.35; if(s.x<0){ s.x=W+10; s.y=Math.random()*H; } }
}

function render(dt:number){
  // clear
  ctx.clearRect(0,0,W,H);

  // background gradient
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#070d20');
  grad.addColorStop(0.5,'#0a1430');
  grad.addColorStop(1,'#05081a');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  // grid floor perspective
  ctx.save();
  ctx.strokeStyle='rgba(0,240,255,0.14)';
  ctx.lineWidth=1;
  // horizontal lines with perspective spacing
  for(let y= H*0.55; y<H; y+= 14 + (y-H*0.55)*0.06){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  // vertical vanishing lines
  ctx.strokeStyle='rgba(0,240,255,0.07)';
  for(let i=-1;i<22;i++){
    const x = (W/2) + (i-10)*38 + (i-10)*2*Math.sin(time*0.3);
    ctx.beginPath();
    ctx.moveTo(x, H*0.55);
    ctx.lineTo(W/2 + (x-W/2)*2.2, H);
    ctx.stroke();
  }
  ctx.restore();

  // stars
  for(const s of stars){
    ctx.fillStyle = `rgba(230,250,255,${0.5 + Math.sin(time*2 + s.x)*0.2})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI*2); ctx.fill();
  }

  // gates
  for(const g of gates){
    const topH = g.gapY;
    const botY = g.gapY+g.gapH;
    // laser bars with glow
    drawGateBar(g.x, 0, g.w, topH, '#00f0ff');
    drawGateBar(g.x, botY, g.w, H-botY, '#ff1a8f');
    // gap indicators
    ctx.fillStyle='rgba(0,240,255,0.08)';
    ctx.fillRect(g.x-4, g.gapY, g.w+8, g.gapH);
    // moving scanner line
    const scan = (time*120) % g.gapH;
    ctx.fillStyle='rgba(255,255,255,0.09)';
    ctx.fillRect(g.x, g.gapY+scan, g.w, 2);
  }

  // cells
  for(const c of cells){
    const pulse = 0.9 + Math.sin(c.pulse)*0.18;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(pulse, pulse);
    // outer glow
    ctx.shadowColor='#ffd60a'; ctx.shadowBlur=18;
    ctx.fillStyle='#ffd60a';
    ctx.beginPath(); ctx.roundRect(-12,-12,24,24,4); ctx.fill();
    ctx.shadowBlur=0;
    // inner core
    ctx.fillStyle='#fff8c0';
    ctx.beginPath(); ctx.roundRect(-6,-6,12,12,2); ctx.fill();
    // icon
    ctx.fillStyle='#7a5a00'; ctx.font='10px JetBrains Mono'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('◈', 0, 0.5);
    // orbit ring
    ctx.strokeStyle='rgba(255,214,10,0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,17, c.pulse*0.5, c.pulse*0.5+ Math.PI*1.4); ctx.stroke();
    ctx.restore();
  }

  // player drone
  ctx.save();
  ctx.translate(player.x, player.y);
  const tilt = player.vx*0.012 + Math.sin(time*6)*0.03;
  const bob = Math.sin(time*3)*1.2;
  ctx.rotate(tilt);
  ctx.translate(0,bob);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 14, 18, 6, 0, 0, Math.PI*2); ctx.fill();
  // thruster flame
  const flame = 8 + Math.abs(player.vx)*0.02 + Math.random()*4;
  ctx.fillStyle='#ff8a00';
  ctx.shadowColor='#ff4d00'; ctx.shadowBlur=12;
  ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(-18-flame, -5); ctx.lineTo(-18-flame,5); ctx.closePath(); ctx.fill();
  ctx.shadowBlur=0;
  // body
  ctx.fillStyle='#e6faff';
  ctx.strokeStyle='#00f0ff'; ctx.lineWidth=1.5;
  ctx.shadowColor='#00f0ff'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.roundRect(-16,-10,32,20,7); ctx.fill(); ctx.stroke();
  ctx.shadowBlur=0;
  // cockpit
  ctx.fillStyle='#0a1a2a';
  ctx.beginPath(); ctx.roundRect(-6,-7,12,14,4); ctx.fill();
  ctx.fillStyle='#00f0ff';
  ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
  // wing lights
  ctx.fillStyle='#ff1a8f'; ctx.beginPath(); ctx.arc(-10,-8,2.2,0,Math.PI*2); ctx.arc(10,-8,2.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#00f0ff'; ctx.beginPath(); ctx.arc(-10,8,2.2,0,Math.PI*2); ctx.arc(10,8,2.2,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // particles
  for(const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/0.6);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.8, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // vignette + scanlines
  const vig = ctx.createRadialGradient(W/2,H/2, W*0.3, W/2,H/2, W*0.9);
  vig.addColorStop(0,'transparent'); vig.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(0,240,255,0.03)';
  for(let y=0;y<H;y+=4) ctx.fillRect(0,y,W,1);

  // speed lines when fast
  const { speedMult } = difficulty(time);
  if(speedMult>1.6 && state==='playing'){
    ctx.strokeStyle=`rgba(0,240,255,${(speedMult-1.6)*0.08})`;
    ctx.lineWidth=1;
    for(let i=0;i<6;i++){
      const x = (time*600 + i*140) % (W+80) -40;
      ctx.beginPath(); ctx.moveTo(x, H*0.3 + i*14); ctx.lineTo(x-40, H*0.3 + i*14); ctx.stroke();
    }
  }
}

function drawGateBar(x:number,y:number,w:number,h:number, col:string){
  if(h<=0) return;
  ctx.save();
  ctx.shadowColor=col; ctx.shadowBlur=18;
  ctx.fillStyle=col;
  // main bar with gradient
  const g = ctx.createLinearGradient(x,0,x+w,0);
  g.addColorStop(0, col);
  g.addColorStop(0.5, '#ffffff');
  g.addColorStop(1, col);
  ctx.fillStyle=g;
  ctx.fillRect(x,y,w,h);
  ctx.shadowBlur=0;
  // inner highlight line
  ctx.fillStyle='rgba(255,255,255,0.9)';
  ctx.fillRect(x+ w/2 -0.5, y, 1, h);
  // top cap
  ctx.fillStyle= col;
  ctx.fillRect(x-3, y + (h>60?0:0), w+6, 3);
  ctx.fillRect(x-3, y+h-3, w+6, 3);
  ctx.restore();
}

// handle resize -> canvas already fixed logical size, CSS scales
// start loop for menu background animation
let menuAnim: number;
function menuLoop(now:number){
  if(state==='menu'){
    // animate stars/grid slightly even in menu
    time += 0.016;
    // update stars only
    for(const s of stars){ s.x -= s.sp*0.35*0.016; if(s.x<0) s.x=W+10; }
    render(0.016);
    menuAnim = requestAnimationFrame(menuLoop);
  }
}
menuLoop(performance.now());

// focus handling for accessibility
canvas.setAttribute('tabindex','0');
canvas.addEventListener('focus', ()=>{ if(state==='menu') btnPlay.focus(); });

// initial draw
render(0);
setState('menu');
updateHUD();

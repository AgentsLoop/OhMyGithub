import { DIRS, DIR_VECTORS, COLORS, COLOR_HEX, JUNCTION_TYPES, rotatedConnections, hasConnection, opposite, tracePath, stepPulse } from './routing.js';
import { createScoreState, onDelivered, onFailed, tickCombo, LEVELS, getLevel, COMBO_WINDOW_MS } from './scoring.js';
import { generateLevel } from './levels.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const levelLabel = document.getElementById('levelLabel');
const scoreLabel = document.getElementById('scoreLabel');
const comboLabel = document.getElementById('comboLabel');
const timeLabel = document.getElementById('timeLabel');
const goalLabel = document.getElementById('goalLabel');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const queueEl = document.getElementById('queue');
const receiverInfo = document.getElementById('receiverInfo');
const comboToast = document.getElementById('comboToast');
const levelToast = document.getElementById('levelToast');
const overlay = document.getElementById('overlay');
const gameOver = document.getElementById('gameOver');
const overTitle = document.getElementById('overTitle');
const overDesc = document.getElementById('overDesc');
const pulseInfoEl = document.getElementById('pulseInfo');
const canvasWrap = document.querySelector('.canvasWrap');

let levelIdx = 0;
let level = getLevel(0);
let grid = [];
let scoreState = createScoreState();
let timeLeftSec = level.time;
let elapsed = 0;
let lastTs = 0;
let pulseTimer = 0;
let pulses = []; // active visual pulses: { color, path, t, speed, delivered/false}
let particles = [];
let selected = { x: 1, y: 1 };
let hovered = null;
let running = false;
let pausedForModal = true;
let deliveredCount = 0;
let seed = 42;

function initLevel(idx) {
  levelIdx = idx;
  level = getLevel(idx);
  grid = generateLevel(idx, seed + idx * 1337);
  scoreState = createScoreState();
  deliveredCount = 0;
  timeLeftSec = level.time;
  elapsed = 0;
  pulseTimer = 0;
  pulses = [];
  particles = [];
  selected = { x: 1, y: 1 };
  hovered = null;
  colorCursor = 0;
  updateHUD();
  renderQueuePreview();
  showLevelToast(`LEVEL ${level.id} — ${level.name.toUpperCase()}`);
  running = true;
  pausedForModal = false;
  overlay.style.display = 'none';
  gameOver.style.display = 'none';
  resetCanvasSize();
  if (pulseInfoEl) pulseInfoEl.textContent = `◉ ${pulses.length} active`;
}

function resetCanvasSize(){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.min(rect.width || 700, 700);
  // keep square
  const target = Math.round(cssSize * dpr);
  if (canvas.width !== target || canvas.height !== target){
    canvas.width = target;
    canvas.height = target;
  }
}
window.addEventListener('resize', resetCanvasSize);
// compute which junctions are on a live lit route (color-coded)
function computeLitMap(){
  const map = new Map();
  for(let y=0;y<grid.length;y++) for(let x=0;x<grid[0].length;x++){
    const c=grid[y][x]; if(c && c.kind==='emitter'){
      const tp = tracePath(grid, x,y,c.dir,c.color, 80);
      const col = c.color;
      for(const p of tp.path){
        const key=`${p.x},${p.y}`;
        if(!map.has(key)) map.set(key,col);
      }
    }
  }
  return map;
}

function updateHUD(){
  levelLabel.textContent = `${level.id} — ${level.name}`;
  scoreLabel.textContent = scoreState.score;
  comboLabel.textContent = scoreState.combo > 1 ? `x${scoreState.combo}` : '—';
  comboLabel.classList.toggle('combo-on', scoreState.combo>1);
  timeLabel.textContent = `${Math.ceil(timeLeftSec)}s`;
  timeLabel.style.color = timeLeftSec < 10 ? '#ff5a5a' : '';
  timeLabel.style.textShadow = timeLeftSec < 10 ? '0 0 12px rgba(255,90,90,.7)' : '';
  if (timeLeftSec < 10) timeLabel.animate && timeLabel.animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],{duration:380});
  goalLabel.textContent = `${deliveredCount} / ${level.goal}`;
  progressBar.style.width = `${Math.min(100, deliveredCount/level.goal*100)}%`;
  if (pulseInfoEl) pulseInfoEl.textContent = pulses.length ? `◉ ${pulses.length} en route` : '◉ idle';
}

function showCombo(text){
  comboToast.textContent = text;
  // juicy color per combo tier
  if (scoreState.combo >= 4) comboToast.style.color = '#ffb700';
  else if (scoreState.combo === 3) comboToast.style.color = '#ff7ae8';
  else if (scoreState.combo === 2) comboToast.style.color = '#7af0ff';
  else comboToast.style.color = COLOR_HEX[text.includes('CYAN') ? 'cyan' : text.includes('MAGENTA') ? 'magenta' : 'amber'] || '#00e5ff';
  comboToast.classList.remove('show');
  // force reflow for restart
  void comboToast.offsetWidth;
  comboToast.classList.add('show');
  // canvas micro-shake on high combo
  if (scoreState.combo >= 3 && canvasWrap) {
    canvasWrap.style.transform = 'translateX(1px)';
    setTimeout(()=> canvasWrap.style.transform='', 90);
  }
  clearTimeout(showCombo._t);
  showCombo._t = setTimeout(()=> comboToast.classList.remove('show'), 820);
}
function showLevelToast(text){
  levelToast.textContent = text;
  levelToast.classList.add('show');
  setTimeout(()=> levelToast.classList.remove('show'), 1250);
}

function renderQueuePreview(){
  queueEl.innerHTML='';
  const upcoming = nextColors(4);
  upcoming.forEach(c=>{
    const d=document.createElement('div'); d.className='qitem '+c; d.textContent='●'; d.title=c;
    queueEl.appendChild(d);
  });
  // receiver info
  const recs = [];
  for(let y=0;y<grid.length;y++) for(let x=0;x<grid[0].length;x++){
    const cell=grid[y][x]; if(cell && cell.kind==='receiver') recs.push({x,y,color:cell.color});
  }
  receiverInfo.innerHTML = recs.map(r=>`<div><span class="dot ${r.color}"></span> <b>${r.color}</b> at (${r.x},${r.y})</div>`).join('');
}

let colorCursor=0;
function nextColors(n){
  const cols = COLORS.slice(0, level.colors);
  const out=[];
  for(let i=0;i<n;i++) out.push(cols[(colorCursor+i)%cols.length]);
  return out;
}

function spawnPulse(){
  // find emitters
  const emitters=[];
  for(let y=0;y<grid.length;y++) for(let x=0;x<grid[0].length;x++){
    const c=grid[y][x]; if(c && c.kind==='emitter') emitters.push({x,y,dir:c.dir,color:c.color});
  }
  if(!emitters.length) return;
  // round-robin by colorCursor
  const cols = COLORS.slice(0, level.colors);
  const color = cols[colorCursor % cols.length];
  colorCursor++;
  // pick emitter matching color
  let em = emitters.find(e=>e.color===color) || emitters[colorCursor%emitters.length];
  const pathInfo = tracePath(grid, em.x, em.y, em.dir, color);
  // Even if path fails, we still spawn visual pulse that will travel until failure point
  // Build point list for animation
  const pts = pathInfo.path.map(p=>({x:p.x,y:p.y}));
  // speed from level
  const speed = level.pulseSpeed; // pixels per sec ~ will be normalized to grid steps
  pulses.push({ color, pts, t:0, speed, pathInfo, em, failedReason: pathInfo.status==='failed'?pathInfo.reason:null });
  renderQueuePreview();
}

function popPulseResult(p){
  const info = p.pathInfo;
  if(info.status==='delivered'){
    const now = performance.now();
    scoreState = onDelivered(scoreState, now);
    deliveredCount++;
    addParticles(p.pts[p.pts.length-1].x, p.pts[p.pts.length-1].y, p.color, 18);
    // extra burst for combo
    if (scoreState.combo >= 3) addParticles(p.pts[p.pts.length-1].x, p.pts[p.pts.length-1].y, p.color, 10);
    updateHUD();
    if(deliveredCount >= level.goal){
      levelComplete();
    } else {
      // juicy delivery toast with color
      showCombo(`+${scoreState.pointsEarned} ${p.color.toUpperCase()}${scoreState.combo>=2 ? ` ×${scoreState.combo}`:''}`);
      statusText.textContent = `Delivered ${p.color} — combo x${scoreState.combo}!`;
    }
  } else {
    scoreState = onFailed(scoreState);
    addParticles(p.pts[p.pts.length-1].x, p.pts[p.pts.length-1].y, '#ff4d6a', 10, true);
    updateHUD();
    if(p.failedReason) statusText.textContent = `Miss — ${p.failedReason}. Rotate to fix path!`;
    if(navigator.vibrate) navigator.vibrate(60);
    // briefly flash combo toast for miss
    comboToast.textContent = 'BREAK';
    comboToast.style.color = '#ff5a5a';
    comboToast.classList.add('show');
    setTimeout(()=> comboToast.classList.remove('show'), 500);
  }
}

function addParticles(gx,gy,color,count, fail=false){
  const {px,py,cell} = gridToPixel(gx,gy);
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = fail ? (Math.random()*80+20) : (Math.random()*90+30);
    particles.push({
      x:px, y:py,
      vx:Math.cos(ang)*spd,
      vy:Math.sin(ang)*spd - (fail?0:24),
      life:0, max: fail?0.5:0.72,
      color: fail? '#ff5a5a' : COLOR_HEX[color] || color,
      size: Math.random()*3+2.2
    });
  }
}

function levelComplete(){
  running=false;
  showLevelToast(`CLEARED! +${deliveredCount*10} bonus`);
  scoreState.score += 200;
  updateHUD();
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.style.display = levelIdx < LEVELS.length-1 ? 'inline-block' : 'none';
  statusText.textContent = `Level ${level.id} cleared! Score ${scoreState.score}`;
  // show modal after delay
  setTimeout(()=> {
    if(levelIdx >= LEVELS.length-1){
      overTitle.textContent='You Beat Prism Relay!';
      overDesc.textContent=`Final score ${scoreState.score} • Max combo x${scoreState.maxCombo}`;
      gameOver.style.display='grid';
      document.getElementById('overNextBtn').style.display='none';
    } else {
      // enable next level button in overlay
      overTitle.textContent='Level Cleared!';
      overDesc.textContent=`Delivered ${deliveredCount}/${level.goal} in ${level.time - Math.ceil(timeLeftSec)}s • Score ${scoreState.score}`;
      gameOver.style.display='grid';
      document.getElementById('overNextBtn').style.display='inline-block';
    }
  }, 700);
}

function gameOverFail(){
  running=false;
  overTitle.textContent='Time Expired';
  overDesc.textContent=`You delivered ${deliveredCount}/${level.goal} • Score ${scoreState.score} • Max combo x${scoreState.maxCombo}`;
  document.getElementById('overNextBtn').style.display='none';
  gameOver.style.display='grid';
}

// Input – pointer with hover
canvas.addEventListener('pointermove', e=>{
  const rect=canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left)*scaleX;
  const y = (e.clientY - rect.top)*scaleY;
  const g = pixelToGrid(x,y);
  hovered = g;
  if (g) {
    const cell = grid[g.y]?.[g.x];
    if (cell && cell.kind==='junction' && cell.type!=='block' && cell.type!=='cross') canvas.style.cursor='pointer';
    else if (cell) canvas.style.cursor='pointer';
    else canvas.style.cursor='default';
  } else {
    canvas.style.cursor='default';
  }
});
canvas.addEventListener('pointerleave', ()=> { hovered=null; canvas.style.cursor='default'; });

canvas.addEventListener('pointerdown', e=>{
  if(pausedForModal || !running) return;
  const rect=canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left)*scaleX;
  const y = (e.clientY - rect.top)*scaleY;
  const g = pixelToGrid(x,y);
  if(!g) return;
  const cell = grid[g.y]?.[g.x];
  if(cell && cell.kind==='junction' && cell.type!=='block' && cell.type!=='cross'){
    rotateAt(g.x,g.y);
    selected={x:g.x,y:g.y};
  } else if(cell){
    selected={x:g.x,y:g.y};
  }
});

function rotateAt(x,y){
  const c=grid[y][x];
  if(!c || c.kind!=='junction') return;
  if(c.type==='cross' || c.type==='block') return;
  c.rotation = (c.rotation+1)%4;
  addParticles(x,y, '#ffffff', 7);
  statusText.textContent = `Rotated (${x},${y}) → ${c.rotation*90}°`;
  // haptic
  if(navigator.vibrate) navigator.vibrate(18);
}

window.addEventListener('keydown', e=>{
  if(e.key==='r' || e.key==='R' || e.key===' ' || e.key==='Enter'){
    if(pausedForModal){
      overlay.style.display='none'; pausedForModal=false; running=true; lastTs=performance.now();
      e.preventDefault(); return;
    }
    if(!running && gameOver.style.display!=='none'){
      // restart
      if(e.key==='Enter' && levelIdx < LEVELS.length-1 && deliveredCount>=level.goal){ goNextLevel(); }
      else { initLevel(levelIdx); }
      e.preventDefault(); return;
    }
    const c=grid[selected.y]?.[selected.x];
    if(c && c.kind==='junction'){ rotateAt(selected.x, selected.y); e.preventDefault();}
  }
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D'].includes(e.key)){
    const moves={ ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0], w:[0,-1], s:[0,1], a:[-1,0], d:[1,0], W:[0,-1], S:[0,1], A:[-1,0], D:[1,0]};
    const [dx,dy]=moves[e.key]||[0,0];
    const nx=Math.max(0,Math.min(grid[0].length-1, selected.x+dx));
    const ny=Math.max(0,Math.min(grid.length-1, selected.y+dy));
    selected={x:nx,y:ny};
    e.preventDefault();
  }
  if(e.key==='Escape'){
    if(overlay.style.display!=='none'){ overlay.style.display='none'; pausedForModal=false; running=true; lastTs=performance.now();}
    else if(gameOver.style.display!=='none'){ gameOver.style.display='none'; }
  }
});

// Buttons
document.getElementById('tutorialBtn').addEventListener('click', ()=>{ overlay.style.display='grid'; pausedForModal=true; });
document.getElementById('startBtn').addEventListener('click', ()=>{ overlay.style.display='none'; pausedForModal=false; running=true; lastTs=performance.now(); });
document.getElementById('dismissBtn').addEventListener('click', ()=>{ overlay.style.display='none'; pausedForModal=false; running=true; lastTs=performance.now(); });
// backdrop click to dismiss tutorial
overlay.addEventListener('click', (e)=>{ if(e.target===overlay){ overlay.style.display='none'; pausedForModal=false; running=true; lastTs=performance.now(); }});
gameOver.addEventListener('click', (e)=>{ if(e.target===gameOver) gameOver.style.display='none'; });
document.getElementById('restartBtn').addEventListener('click', ()=> initLevel(levelIdx));
document.getElementById('nextBtn').addEventListener('click', ()=> goNextLevel());
document.getElementById('againBtn').addEventListener('click', ()=> initLevel(levelIdx));
document.getElementById('overNextBtn').addEventListener('click', ()=> goNextLevel());
function goNextLevel(){
  if(levelIdx < LEVELS.length-1){ initLevel(levelIdx+1); gameOver.style.display='none'; document.getElementById('nextBtn').style.display='none'; }
  else { initLevel(0); }
}

// Geometry helpers
function gridToPixel(gx,gy){
  const W=canvas.width, H=canvas.height;
  const pad=24;
  const gw=grid[0].length, gh=grid.length;
  const cell = Math.min((W-pad*2)/gw, (H-pad*2)/gh);
  const ox=(W - cell*gw)/2, oy=(H - cell*gh)/2;
  return { px: ox+gx*cell+cell/2, py: oy+gy*cell+cell/2, cell, ox, oy };
}
function pixelToGrid(px,py){
  const gw=grid[0].length, gh=grid.length;
  const W=canvas.width, H=canvas.height; const pad=24;
  const cell=Math.min((W-pad*2)/gw,(H-pad*2)/gh);
  const ox=(W-cell*gw)/2, oy=(H-cell*gh)/2;
  const gx=Math.floor((px-ox)/cell), gy=Math.floor((py-oy)/cell);
  if(gx<0||gy<0||gx>=gw||gy>=gh) return null;
  return {x:gx,y:gy};
}

// Rendering
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!grid.length) return;
  const gw=grid[0].length, gh=grid.length;
  const {cell,ox,oy}=gridToPixel(0,0);
  // grid background glow
  ctx.save();
  ctx.fillStyle='rgba(255,255,255,0.015)';
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){
    ctx.fillRect(ox+x*cell+1, oy+y*cell+1, cell-2, cell-2);
  }
  ctx.restore();
  // subtle vignette
  ctx.save();
  ctx.strokeStyle='rgba(122,92,255,.06)';
  ctx.lineWidth=0.5;
  for(let i=0;i<gw;i++){
    ctx.beginPath(); ctx.moveTo(ox+i*cell, oy); ctx.lineTo(ox+i*cell, oy+gh*cell); ctx.stroke();
  }
  for(let i=0;i<gh;i++){
    ctx.beginPath(); ctx.moveTo(ox, oy+i*cell); ctx.lineTo(ox+gw*cell, oy+i*cell); ctx.stroke();
  }
  ctx.restore();
  const litMap = computeLitMap();
  // draw persistent lit tubes (additive, under cells)
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){
    const key=`${x},${y}`;
    const col=litMap.get(key);
    if(!col) continue;
    const c=grid[y][x];
    if(!c || c.kind!=='junction' || c.type==='block') continue;
    const {px,py}=gridToPixel(x,y);
    const conns=rotatedConnections(c.type,c.rotation);
    const hex=COLOR_HEX[col]||'#fff';
    ctx.strokeStyle=hex;
    ctx.shadowBlur=18; ctx.shadowColor=hex;
    ctx.lineWidth=Math.max(5, cell*0.14);
    ctx.lineCap='round'; ctx.globalAlpha=0.38;
    if(conns.length===2 && ((conns.includes(0)&&conns.includes(2))||(conns.includes(1)&&conns.includes(3)))){
      ctx.beginPath();
      if(conns.includes(0)){ ctx.moveTo(px, py - cell*0.42); ctx.lineTo(px, py + cell*0.42); }
      else { ctx.moveTo(px - cell*0.42, py); ctx.lineTo(px + cell*0.42, py); }
      ctx.stroke();
    } else if(conns.length){
      conns.forEach(d=>{
        const [dx,dy]=DIR_VECTORS[d];
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px+dx*cell*0.38, py+dy*cell*0.38); ctx.stroke();
      });
    }
  }
  ctx.restore();
  // draw cells
  for(let y=0;y<gh;y++) for(let x=0;x<gw;x++){
    const c=grid[y][x];
    const {px,py}=gridToPixel(x,y);
    const isSel = selected.x===x && selected.y===y;
    const isHover = hovered && hovered.x===x && hovered.y===y;
    const litColor = litMap.get(`${x},${y}`) || null;
    drawCell(c, px,py, cell, isSel, isHover, litColor);
  }
  // draw pulses with trails (additive)
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  pulses.forEach(p=>{
    if(p.pts.length<2) return;
    const total = p.pts.length-1;
    const t = Math.min(total, p.t);
    const seg = Math.floor(t);
    const frac = t - seg;
    if(seg>=total){ return; }
    function interp(at){
      const s = Math.floor(Math.max(0, at));
      const f = at - s;
      if(s>=total) return null;
      if(s+1>=p.pts.length) return null;
      const a = gridToPixel(p.pts[s].x, p.pts[s].y);
      const b = gridToPixel(p.pts[s+1].x, p.pts[s+1].y);
      return { x: a.px + (b.px - a.px)*f, y: a.py + (b.py - a.py)*f };
    }
    const head = interp(t);
    if(!head) return;
    const hex = COLOR_HEX[p.color]||'#fff';
    // trail – 4 fading ghosts behind
    const trailSteps = 4;
    for(let i=trailSteps;i>=1;i--){
      const at = t - i*0.28;
      if(at < 0) continue;
      const tp = interp(at);
      if(!tp) continue;
      const alpha = (1 - i/(trailSteps+1)) * 0.52;
      const r = Math.max(2, cell*0.08) * (1 - i*0.11);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur=14; ctx.shadowColor=hex;
      ctx.fillStyle=hex;
      ctx.beginPath(); ctx.arc(tp.x,tp.y, r,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    // outer neon glow
    ctx.save();
    ctx.shadowBlur=22; ctx.shadowColor=hex;
    ctx.fillStyle=hex;
    ctx.globalAlpha=0.9;
    ctx.beginPath(); ctx.arc(head.x,head.y, Math.max(5.5, cell*0.12),0,Math.PI*2); ctx.fill();
    // bright core
    ctx.shadowBlur=0; ctx.fillStyle='#ffffff';
    ctx.globalAlpha=1;
    ctx.beginPath(); ctx.arc(head.x,head.y,2.6,0,Math.PI*2); ctx.fill();
    // second inner halo
    ctx.fillStyle=hex; ctx.globalAlpha=0.95;
    ctx.beginPath(); ctx.arc(head.x,head.y,1.2,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
  ctx.restore();
  // particles
  particles.forEach(pt=>{
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - pt.life/pt.max);
    ctx.fillStyle=pt.color;
    ctx.shadowBlur=9; ctx.shadowColor=pt.color;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.size,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
  // border
  ctx.save();
  ctx.strokeStyle='rgba(122,92,255,.22)';
  ctx.lineWidth=1;
  ctx.strokeRect(ox-2, oy-2, cell*gw+4, cell*gh+4);
  // inner soft glow
  ctx.strokeStyle='rgba(0,229,255,.07)';
  ctx.lineWidth=6;
  ctx.globalAlpha=0.5;
  ctx.strokeRect(ox-2, oy-2, cell*gw+4, cell*gh+4);
  ctx.restore();
}

function drawCell(c, px,py, cell, isSel, isHover, litColor=null){
  if(!c){
    return;
  }
  ctx.save();
  ctx.translate(px,py);
  const s = cell*0.86;
  const half=s/2;
  // selection / hover halo
  if(isSel){
    ctx.shadowBlur=18; ctx.shadowColor='rgba(122,160,255,.7)';
    ctx.strokeStyle='rgba(170,200,255,.9)'; ctx.lineWidth=1.45;
    ctx.beginPath(); ctx.roundRect(-half-4,-half-4,s+8,s+8,11); ctx.stroke();
    ctx.shadowBlur=0;
  } else if(isHover){
    ctx.shadowBlur=14; ctx.shadowColor='rgba(255,255,255,.28)';
    ctx.strokeStyle='rgba(255,255,255,.38)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(-half-3,-half-3,s+6,s+6,10); ctx.stroke();
    ctx.shadowBlur=0;
  }
  if(c.kind==='emitter'){
    // diamond emitter with stronger neon
    ctx.shadowBlur=18; ctx.shadowColor=COLOR_HEX[c.color]||'#fff';
    ctx.fillStyle=COLOR_HEX[c.color]||'#fff';
    ctx.beginPath();
    ctx.moveTo(0,-half*0.7); ctx.lineTo(half*0.7,0); ctx.lineTo(0,half*0.7); ctx.lineTo(-half*0.7,0); ctx.closePath(); ctx.fill();
    // inner highlight
    ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(0,-half*0.35); ctx.lineTo(half*0.3,0); ctx.lineTo(0,half*0.28); ctx.lineTo(-half*0.3,0); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.35)'; ctx.font=`${Math.round(cell*0.22)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('◉',1,1);
    ctx.fillStyle='#fff'; ctx.fillText('◉',0,0);
    // label with glow
    ctx.shadowBlur=8; ctx.shadowColor=COLOR_HEX[c.color];
    ctx.fillStyle=COLOR_HEX[c.color]; ctx.font=`bold ${Math.round(cell*0.16)}px monospace`; ctx.fillText(c.color.toUpperCase(),0,half+13);
    ctx.restore(); return;
  }
  if(c.kind==='receiver'){
    ctx.shadowBlur=16; ctx.shadowColor=COLOR_HEX[c.color]||'#fff';
    ctx.strokeStyle=COLOR_HEX[c.color]||'#fff'; ctx.lineWidth=2.4;
    ctx.beginPath(); ctx.roundRect(-half*0.66,-half*0.66, s*0.66, s*0.66, 6); ctx.stroke();
    // inner fill with subtle glow
    ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(-half*0.5,-half*0.5,s*0.5,s*0.5);
    // pulsing inner if hovered/selected
    if(isSel||isHover){
      ctx.shadowBlur=10; ctx.shadowColor=COLOR_HEX[c.color];
      ctx.strokeStyle=COLOR_HEX[c.color]; ctx.lineWidth=1.1; ctx.globalAlpha=0.6;
      ctx.strokeRect(-half*0.5,-half*0.5,s*0.5,s*0.5);
      ctx.globalAlpha=1;
    }
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff'; ctx.font=`${Math.round(cell*0.2)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⬡',0,0);
    ctx.shadowBlur=8; ctx.shadowColor=COLOR_HEX[c.color];
    ctx.fillStyle=COLOR_HEX[c.color]; ctx.font=`bold ${Math.round(cell*0.15)}px monospace`; ctx.fillText(c.color.toUpperCase(),0,half+13);
    ctx.restore(); return;
  }
  // junction
  if(c.type==='block'){
    ctx.fillStyle='#0d1020'; ctx.strokeStyle='#232a54'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(-half,-half,s,s,10); ctx.fill(); ctx.stroke();
    // diagonal hatch subtle
    ctx.strokeStyle='rgba(42,47,90,.5)'; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(-half+4,-half+4); ctx.lineTo(half-4,half-4); ctx.moveTo(half-4,-half+4); ctx.lineTo(-half+4,half-4); ctx.stroke();
    ctx.fillStyle='#2a2f5a'; ctx.font=`${Math.round(cell*0.18)}px monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✕',0,0);
    ctx.restore(); return;
  }
  // base plate with hover lift
  const baseHoverBoost = isHover ? 0.06 : 0;
  ctx.fillStyle = isSel ? '#18204a' : isHover ? '#131a3a' : '#0f1430';
  if(isHover) { ctx.shadowBlur=12; ctx.shadowColor='rgba(70,90,255,.22)'; }
  ctx.strokeStyle = isSel ? '#4b5bff' : isHover ? '#3446c8' : '#232a54';
  ctx.lineWidth= isSel ? 1.4 : 1.15;
  ctx.beginPath(); ctx.roundRect(-half,-half,s,s,10); ctx.fill(); ctx.stroke();
  ctx.shadowBlur=0;
  // subtle inner bevel
  ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(-half+1,-half+1,s-2,s-2,9); ctx.stroke();
  // inner glow for connected paths – color-coded persistent glow
  const conns = rotatedConnections(c.type, c.rotation);
  const lineHex = litColor ? (COLOR_HEX[litColor]||'#5a6bff') : '#5a6bff';
  const lineGlow = litColor ? (COLOR_HEX[litColor]||'#5a6bff') : 'rgba(90,120,255,.75)';
  // draw path lines with neon glow
  ctx.save();
  ctx.strokeStyle=lineHex;
  ctx.shadowBlur= litColor ? 14 : 10;
  ctx.shadowColor=lineGlow;
  ctx.lineWidth= Math.max(3.2, cell*0.095);
  ctx.lineCap='round'; ctx.lineJoin='round';
  if(conns.length===2 && ((conns.includes(0)&&conns.includes(2))||(conns.includes(1)&&conns.includes(3)))){
    // straight
    if(conns.includes(0)){ // N-S
      ctx.beginPath(); ctx.moveTo(0,-half); ctx.lineTo(0,half); ctx.stroke();
      // inner bright core
      ctx.shadowBlur=0; ctx.strokeStyle= litColor ? '#ffffff' : '#b5c1ff'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(0,-half+6); ctx.lineTo(0,half-6); ctx.stroke();
       ctx.fillStyle= litColor ? (COLOR_HEX[litColor]||'#d0dbff') : '#d0dbff'; ctx.beginPath(); ctx.arc(0,0,3.2,0,Math.PI*2); ctx.fill();
    } else {
       ctx.beginPath(); ctx.moveTo(-half,0); ctx.lineTo(half,0); ctx.stroke();
       ctx.shadowBlur=0; ctx.strokeStyle= litColor ? '#ffffff' : '#b5c1ff'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.moveTo(-half+6,0); ctx.lineTo(half-6,0); ctx.stroke();
       ctx.fillStyle= litColor ? (COLOR_HEX[litColor]||'#d0dbff') : '#d0dbff'; ctx.beginPath(); ctx.arc(0,0,3.2,0,Math.PI*2); ctx.fill();
    }
  } else if(conns.length===2){
    // elbow - corner
    ctx.beginPath();
    conns.forEach(d=>{
      const [dx,dy]=DIR_VECTORS[d];
      ctx.moveTo(0,0); ctx.lineTo(dx*half*0.9, dy*half*0.9);
    });
    ctx.stroke();
    // highlight corner
    ctx.shadowBlur=0; ctx.fillStyle='#c8d3ff'; ctx.beginPath(); ctx.arc(0,0,2.8,0,Math.PI*2); ctx.fill();
  } else {
    // tee / cross
    conns.forEach(d=>{
      const [dx,dy]=DIR_VECTORS[d];
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dx*half*0.85, dy*half*0.85); ctx.stroke();
    });
    // inner bright core for cross
    ctx.shadowBlur=0; ctx.fillStyle='#d0dbff'; ctx.beginPath(); ctx.arc(0,0,4.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8ea0ff'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  // rotation indicator tiny dot at top edge + glow
  ctx.fillStyle = isSel ? '#7a8bff' : 'rgba(255,255,255,.42)'; ctx.shadowBlur= isSel?6:0; ctx.shadowColor='#7a8bff';
  ctx.beginPath(); ctx.arc(0,-half+5.5,2.1,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

// Game loop
function loop(ts){
  requestAnimationFrame(loop);
  if(!lastTs) lastTs=ts;
  const dt = Math.min(64, ts - lastTs)/1000;
  lastTs=ts;
  if(pausedForModal) { draw(); return; }
  if(!running){ draw(); return; }
  elapsed += dt;
  timeLeftSec = Math.max(0, level.time - elapsed);
  // combo decay check
  scoreState = tickCombo(scoreState, ts);
  if(scoreState.combo===0 && comboLabel.textContent!=='—') updateHUD();
  // pulse spawning - ensure at least one pending visual pulse moving
  pulseTimer += dt*1000;
  const interval = level.pulseInterval - Math.min(400, deliveredCount*12); // slightly faster as you deliver
  if(pulseTimer >= interval){
    pulseTimer=0;
    spawnPulse();
  }
  // advance pulses
  pulses.forEach(p=>{
    p.t += dt * (level.pulseSpeed/60); // tuned
  });
  // collect completed
  const done=[];
  pulses.forEach((p,i)=>{
    if(p.t >= p.pts.length-1){
      done.push(i);
    }
  });
  // pop in reverse to avoid index shift
  done.reverse().forEach(idx=>{
    const p = pulses[idx];
    popPulseResult(p);
    pulses.splice(idx,1);
  });
  // particles
  particles.forEach(pt=>{
    pt.x += pt.vx*dt;
    pt.y += pt.vy*dt;
    pt.vy += 80*dt;
    pt.life += dt;
    pt.vx *= 0.99;
  });
  particles = particles.filter(pt=> pt.life < pt.max);
  // time check
  if(timeLeftSec<=0){
    if(deliveredCount >= level.goal) levelComplete(); else gameOverFail();
  }
  // status tick
  if(Math.floor(elapsed*2)%2===0) timeLabel.textContent = `${Math.ceil(timeLeftSec)}s`;
  if(pulseInfoEl) pulseInfoEl.textContent = pulses.length ? `◉ ${pulses.length} en route • next in ${Math.max(0, Math.round((interval-pulseTimer)/100)/10)}s` : '◉ idle — rotating frees path';
  draw();
}

// Init
initLevel(0);
pausedForModal=true;
overlay.style.display='grid';
lastTs=performance.now();
requestAnimationFrame(loop);
draw();
updateHUD();

// expose for tests / debug
window.__prism={ grid, level, scoreState, initLevel };

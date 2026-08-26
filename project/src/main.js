const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const streakEl = document.getElementById('streak');
const bestEl = document.getElementById('highScoreLabel');
const caughtLabel = document.getElementById('caughtLabel');
const missedLabel = document.getElementById('missedLabel');
const speedBar = document.getElementById('speedBar');
const speedLabel = document.getElementById('speedLabel');
const hudScore = document.getElementById('hudScore');
const hudLives = document.getElementById('hudLives');
const hudCenter = document.getElementById('hudCenter');

const overlay = document.getElementById('overlay');
const startCard = document.getElementById('startCard');
const pauseCard = document.getElementById('pauseCard');
const gameOverCard = document.getElementById('gameOverCard');
const finalScoreEl = document.getElementById('finalScore');
const finalMsgEl = document.getElementById('finalMsg');

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtn2 = document.getElementById('restartBtn2');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const soundBtn = document.getElementById('soundBtn');
const toast = document.getElementById('toast');

let soundOn = true;
let audioCtx = null;
function beep(freq, dur=0.08, type='sine', vol=0.18){
  if(!soundOn) return;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    o.start(); o.stop(audioCtx.currentTime+dur);
  }catch{}
}
function beepCatch(rare){
  if(!soundOn) return;
  if(rare){ beep(880,0.08,'sine',0.18); setTimeout(()=>{beep(1175,0.12,'square',0.16); beep(660,0.14,'triangle',0.08)},70); }
  else { beep(720,0.07,'sine',0.17); setTimeout(()=>beep(980,0.09,'sine',0.13),60); }
}

const W = canvas.width;
const H = canvas.height;

const CATCHER_W = 110;
const CATCHER_H = 22;
const CATCHER_Y = H - 52;
const CATCHER_SPEED = 520; // px per sec

const STAR_SIZE = 18;
const PARTICLES = [];

let state = 'start'; // start | playing | paused | over
let score = 0;
let lives = 3;
let level = 1;
let caught = 0;
let missed = 0;
let streak = 0;
let best = Number(localStorage.getItem('neon-best')||0);
let catcherX = (W - CATCHER_W)/2;
let stars = [];
let spawnTimer = 0;
let spawnInterval = 0.75;
let fallSpeed = 160;
let keys = { left:false, right:false };
let touchLeft=false, touchRight=false;
let lastT = 0;
let shake = 0;
let hitStopUntil = 0;
let catcherPulse = 0;
let flashAlpha = 0;
let flashColor = '#00f0ff';
let catcherVX = 0;
let animId = null;

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1400);
}

function updateHUD(){
  scoreEl.textContent = score;
  bestEl.textContent = 'BEST ' + best;
  const heart = lives>=3 ? '● ● ●' : '● '.repeat(lives) + '○ '.repeat(3-lives);
  livesEl.textContent = heart;
  livesEl.style.opacity = lives===1 ? '0.9' : '1';
  if(lives===1) livesEl.animate?.([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:280});
  levelEl.textContent = level;
  progressLabel.textContent = `${caught % 10} / 10`;
  progressBar.style.width = `${((caught%10)/10)*100}%`;
  streakEl.textContent = streak>=3 ? `Streak ${streak} 🔥` : streak>0 ? `Streak ${streak} — keep catching!` : `Streak 0 — keep catching!`;
  streakEl.style.background = streak>=5 ? 'rgba(255,46,147,0.14)' : streak>=3 ? 'rgba(255,213,74,0.14)' : 'rgba(0,240,255,0.08)';
  hudScore.textContent = score;
  hudLives.textContent = '♥'.repeat(lives) + '♡'.repeat(3-lives);
  hudCenter.textContent = state==='playing' ? `Lv ${level} • ${Math.round(fallSpeed)}` : 'NEON CATCHER';
  caughtLabel.textContent = caught;
  missedLabel.textContent = `${missed} / 3`;
  const sp = Math.min(100, ((fallSpeed-160)/260)*100);
  speedBar.style.width = `${18 + sp*0.82}%`;
  speedLabel.textContent = `×${(fallSpeed/160).toFixed(2)}`;
}

function resetGame(){
  score=0; lives=3; level=1; caught=0; missed=0; streak=0;
  catcherX=(W-CATCHER_W)/2;
  stars=[];
  PARTICLES.length=0;
  spawnTimer=0;
  spawnInterval=0.78;
  fallSpeed=160;
  shake=0;
  hitStopUntil=0;
  catcherPulse=0;
  flashAlpha=0;
  updateHUD();
}

function setState(n){
  state=n;
  startCard.classList.toggle('hidden', state!=='start');
  pauseCard.classList.toggle('hidden', state!=='paused');
  gameOverCard.classList.toggle('hidden', state!=='over');
  overlay.classList.toggle('hidden', state==='playing');
  pauseBtn.textContent = state==='paused' ? '▶ Resume' : '⏸ Pause';
  if(state==='playing') overlay.style.pointerEvents='none';
  else overlay.style.pointerEvents='auto';
}

function spawnStar(){
  const x = 18 + Math.random()*(W-36);
  const y = -28;
  const size = STAR_SIZE + (Math.random()*6-3);
  const rot = Math.random()*Math.PI*2;
  const rotSpeed = (Math.random()*1.6+0.6)*(Math.random()<0.5?1:-1);
  const drift = (Math.random()*40-20);
  const rare = Math.random()<0.12;
  stars.push({x,y,size,rot,rotSpeed,drift, vy: fallSpeed*(0.9+Math.random()*0.25), rare, alpha:1, spawnScale:0});
}

// --- JUICE: Fruit Ninja style burst + Tron bloom ---
function createBurst(x,y, color='#ffd54a', n=14, opts={}){
  const rare = opts.rare || false;
  // shock ring (expanding stroke) — Tron bloom
  PARTICLES.push({type:'ring', x,y, life:0, max:0.32, r0:6, r1: rare?54:42, color: rare?'#ff2e93':'#00f0ff', width: rare?3.5:2.6});
  PARTICLES.push({type:'ring', x,y, life:0, max:0.22, r0:2, r1: rare?30:22, color:'#ffffff', width:1.8, alphaM:0.55});
  // core flash
  PARTICLES.push({type:'flash', x,y, life:0, max:0.14, r: rare?26:20, color:'#ffffff'});
  PARTICLES.push({type:'flash', x,y, life:0, max:0.20, r: rare?32:24, color: color});

  // spark particles — varied colors for bloom
  const colors = rare ? ['#ffd54a','#ff8cf0','#ffffff','#00f0ff'] : ['#ffd54a','#ffeaa0','#ffffff','#7afcff'];
  for(let i=0;i<n;i++){
    const ang = (Math.PI*2*i/n) + Math.random()*0.55 -0.27;
    const sp = (rare? 130:90) + Math.random()*(rare?200:170);
    const c = colors[i % colors.length];
    PARTICLES.push({
      type:'spark', x,y, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp - 60 - Math.random()*90,
      life:0, max: 0.48+Math.random()*0.42, r: 1.8+Math.random()*2.8, color:c, alpha:1,
      rot: Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*12
    });
  }
  // shard triangles — extra crunch
  const shardN = rare?7:5;
  for(let i=0;i<shardN;i++){
    const ang = Math.random()*Math.PI*2;
    const sp = 140 + Math.random()*160;
    PARTICLES.push({
      type:'shard', x,y, vx: Math.cos(ang)*sp, vy: Math.sin(ang)*sp - 20,
      life:0, max:0.42+Math.random()*0.25, r: 5+Math.random()*4, color: rare?'#ff2e93':'#ffd54a', alpha:1,
      rot: Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*18
    });
  }
  // floating score text — Fruit Ninja juice
  const pts = opts.points || (rare?30:10);
  const txt = streak>=5 ? `+${pts} × STREAK!` : streak>=3 ? `+${pts} 🔥` : `+${pts}`;
  PARTICLES.push({
    type:'text', x, y:y-14, vx: (Math.random()-0.5)*30, vy:-70,
    life:0, max:0.72, text: txt, color: rare?'#ff8cf0':'#ffd54a', alpha:1, scale: rare?1.15:1
  });
  // extra upward glint for rare
  if(rare){
    for(let i=0;i<3;i++){
      const ang = -Math.PI/2 + (Math.random()-0.5)*0.9;
      const sp = 90+Math.random()*80;
      PARTICLES.push({type:'spark', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:0, max:0.6, r:1.2, color:'#ffffff', alpha:1});
    }
  }
}
function createMissBurst(x,y){
  // downward dust + sad ring
  PARTICLES.push({type:'ring', x,y, life:0, max:0.28, r0:4, r1:28, color:'#ff2e93', width:2.2});
  for(let i=0;i<7;i++){
    const ang = Math.PI*0.2 + Math.random()*Math.PI*0.6; // downward cone
    const sp = 70+Math.random()*110;
    PARTICLES.push({type:'spark', x,y, vx:Math.cos(ang)*sp*(Math.random()<0.5?1:-1), vy: Math.sin(ang)*sp*0.6 + 20, life:0, max:0.5, r:2+Math.random()*2, color:'#ff2e93', alpha:1});
  }
  PARTICLES.push({type:'text', x,y:y-10, vx:0, vy:-45, life:0, max:0.6, text:'MISS', color:'#ff2e93', alpha:1, scale:0.9});
}

function catchStar(s){
  const base = s.rare ? 25 : 10;
  const rareBonus = s.rare?5:0;
  let add = base + rareBonus;
  if(streak>=3) add+= Math.min(15, streak*2);
  // streak update before burst so text can show streak
  caught++; streak++;
  score += add;
  // finalize add after streak calc (above needs prev streak? use updated — fine, slightly more juice)
  if(caught % 10 ===0){
    level++;
    fallSpeed = Math.min(420, fallSpeed + 22);
    spawnInterval = Math.max(0.32, spawnInterval - 0.06);
    beep(880,0.12,'square',0.12); setTimeout(()=>beep(1100,0.12,'square',0.12),120);
    showToast(`Level ${level}! Faster!`);
    // level pulse
    flashColor='#ffd54a'; flashAlpha=0.18;
  } else {
    beepCatch(s.rare);
  }
  // juice triggers
  const pts = add;
  createBurst(s.x, s.y-6, s.rare? '#ff8cf0':'#ffd54a', s.rare?20:14, {rare:s.rare, points:pts});
  shake = s.rare ? 10 : 6.5;
  catcherPulse = s.rare ? 1.0 : 0.82;
  flashAlpha = s.rare ? 0.22 : 0.14;
  flashColor = s.rare ? '#ff8cf0' : '#00f0ff';
  hitStopUntil = performance.now() + (s.rare?110:78);
  // haptics
  try{ if(navigator.vibrate) navigator.vibrate(s.rare? [18,20,30]:12);}catch{}
  if(score>best){ best=score; localStorage.setItem('neon-best', String(best)); }
  updateHUD();
}

function missStar(){
  missed++; lives--; streak=0;
  shake = 11;
  catcherPulse = 0.4;
  flashAlpha = 0.12;
  flashColor = '#ff2e93';
  beep(180,0.22,'square',0.2); setTimeout(()=>beep(120,0.18,'square',0.12),140);
  createMissBurst(catcherX + CATCHER_W/2, CATCHER_Y+10);
  try{ if(navigator.vibrate) navigator.vibrate([28,40,28]);}catch{}
  updateHUD();
  if(lives<=0){
    state='over';
    finalScoreEl.textContent = `Score ${score} • Level ${level}`;
    const msg = score>=best && score>0 ? 'New best! Neon legend.' : score>80 ? 'Sharp catching!' : score>40 ? 'Nice run — push for 100!' : 'Keep your eye on the fall.';
    finalMsgEl.textContent = msg;
    setState('over');
    showToast('Game over — 3 misses');
  }
}

// input
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(k==='arrowleft' || k==='a') keys.left=true;
  if(k==='arrowright' || k==='d') keys.right=true;
  if(k===' ' || k==='p'){
    e.preventDefault();
    if(state==='playing') { state='paused'; setState('paused'); }
    else if(state==='paused'){ state='playing'; setState('playing'); lastT=performance.now(); requestAnimationFrame(loop); }
  }
  if(k==='enter' && state==='start'){ startGame(); }
  if(k==='r' && state==='over'){ startGame(); }
});
window.addEventListener('keyup', e=>{
  const k=e.key.toLowerCase();
  if(k==='arrowleft' || k==='a') keys.left=false;
  if(k==='arrowright' || k==='d') keys.right=false;
});

leftBtn.addEventListener('touchstart', e=>{e.preventDefault(); touchLeft=true;});
leftBtn.addEventListener('touchend', e=>{e.preventDefault(); touchLeft=false;});
rightBtn.addEventListener('touchstart', e=>{e.preventDefault(); touchRight=true;});
rightBtn.addEventListener('touchend', e=>{e.preventDefault(); touchRight=false;});
leftBtn.addEventListener('mousedown', ()=>touchLeft=true);
leftBtn.addEventListener('mouseup', ()=>touchLeft=false);
leftBtn.addEventListener('mouseleave', ()=>touchLeft=false);
rightBtn.addEventListener('mousedown', ()=>touchRight=true);
rightBtn.addEventListener('mouseup', ()=>touchRight=false);
rightBtn.addEventListener('mouseleave', ()=>touchRight=false);

// mouse drag on canvas
let dragging=false;
canvas.addEventListener('pointerdown', e=>{
  dragging=true; canvas.setPointerCapture(e.pointerId);
  moveCatcherTo(e);
});
canvas.addEventListener('pointermove', e=>{
  if(dragging) moveCatcherTo(e);
});
canvas.addEventListener('pointerup', ()=>dragging=false);
canvas.addEventListener('pointerleave', ()=>dragging=false);
function moveCatcherTo(e){
  if(state!=='playing') return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const x = (e.clientX - rect.left)*scaleX;
  const target = Math.max(0, Math.min(W-CATCHER_W, x - CATCHER_W/2));
  // direct lerp feel — snappy like Fruit Ninja slice
  catcherVX = (target - catcherX) * 10;
  catcherX = target;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
restartBtn2.addEventListener('click', startGame);
resumeBtn.addEventListener('click', ()=>{
  if(state==='paused'){ state='playing'; setState('playing'); lastT=performance.now(); requestAnimationFrame(loop); }
});
pauseBtn.addEventListener('click', ()=>{
  if(state==='playing'){ state='paused'; setState('paused'); }
  else if(state==='paused'){ state='playing'; setState('playing'); lastT=performance.now(); requestAnimationFrame(loop); }
});
soundBtn.addEventListener('click', ()=>{
  soundOn=!soundOn;
  soundBtn.textContent = soundOn ? '🔊 Sound' : '🔇 Sound';
  showToast(soundOn?'Sound on':'Sound off');
});

function startGame(){
  resetGame();
  state='playing';
  setState('playing');
  lastT=performance.now();
  spawnTimer=0;
  if(animId) cancelAnimationFrame(animId);
  requestAnimationFrame(loop);
  beep(520,0.1,'sine',0.15); setTimeout(()=>beep(660,0.1,'sine',0.15),100);
}

// rendering helpers
function drawStar(x,y,size,rot, rare, spawnScale){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rot);
  const scale = spawnScale!=null ? spawnScale : 1;
  if(scale!==1) ctx.scale(scale,scale);
  const fill = rare ? '#ffd54a' : '#ffeaa0';
  const stroke = rare ? '#ff2e93' : '#00f0ff';
  // === Tron double-pass bloom ===
  // pass 1: big soft glow
  ctx.shadowColor = rare ? '#ff2e93' : '#00f0ff';
  ctx.shadowBlur = rare ? 28 : 22;
  ctx.fillStyle = fill;
  ctx.globalAlpha = 0.95;
  drawStarShape(0,0,size);
  ctx.fill();
  // pass 2: tight bright core
  ctx.shadowColor = rare ? '#ffd54a' : '#ffffff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  // stroke crisp
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.45;
  drawStarShape(0,0,size);
  ctx.stroke();
  // inner highlight
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(-size*0.18, -size*0.22, size*0.18, 0, Math.PI*2);
  ctx.fill();
  // rare extra cross glint
  if(rare){
    ctx.strokeStyle='rgba(255,255,255,0.55)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-size*0.55,0); ctx.lineTo(size*0.55,0); ctx.moveTo(0,-size*0.55); ctx.lineTo(0,size*0.55); ctx.stroke();
  }
  ctx.restore();

  // falling trail — subtle motion streak
  if(state==='playing'){
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = rare ? '#ff2e93' : '#ffd54a';
    ctx.shadowColor = rare ? '#ff2e93' : '#ffd54a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(x, y - size*0.9, size*0.45, size*0.75, 0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}
function drawStarShape(cx,cy, r){
  const spikes=5;
  const outer=r;
  const inner=r*0.45;
  ctx.beginPath();
  for(let i=0;i<spikes*2;i++){
    const rad = (Math.PI/spikes)*i - Math.PI/2;
    const rad2 = i%2===0 ? outer : inner;
    const x = cx + Math.cos(rad)*rad2;
    const y = cy + Math.sin(rad)*rad2;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
}

function drawCatcher(x, squash=0, tilt=0, pulse=0){
  const y = CATCHER_Y + squash*6 - pulse*4;
  const w = CATCHER_W;
  const h = CATCHER_H;
  ctx.save();
  // tilt transform
  ctx.translate(x+w/2, y+h/2);
  ctx.rotate(tilt*0.12);
  ctx.translate(-(x+w/2), -(y+h/2));
  // stretch based on pulse (squash/stretch like Fruit Ninja)
  const sx = 1 + pulse*0.10;
  const sy = 1 - pulse*0.14;
  ctx.translate(x+w/2, y+h/2);
  ctx.scale(sx, sy);
  ctx.translate(-(x+w/2), -(y+h/2));

  // ground shadow
  ctx.fillStyle='rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(x+w/2, y+h+10 + pulse*2, w*0.42, 7, 0,0,Math.PI*2);
  ctx.fill();
  // outer glow — Tron multi-layer
  ctx.shadowColor='#00f0ff';
  ctx.shadowBlur= 26 + pulse*18;
  // tray shape
  ctx.beginPath();
  ctx.moveTo(x+2, y+4);
  ctx.lineTo(x+w-2, y+4);
  ctx.quadraticCurveTo(x+w, y+4, x+w, y+8);
  ctx.lineTo(x+w-6, y+h+4);
  ctx.quadraticCurveTo(x+w-6, y+h+6, x+w-10, y+h+6);
  ctx.lineTo(x+10, y+h+6);
  ctx.quadraticCurveTo(x+6, y+h+6, x+6, y+h+4);
  ctx.lineTo(x+2, y+8);
  ctx.quadraticCurveTo(x+2, y+4, x+2, y+4);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0,'#7afcff');
  g.addColorStop(0.32,'#00f0ff');
  g.addColorStop(0.62,'#7a5cff');
  g.addColorStop(1,'#ff2e93');
  ctx.fillStyle=g;
  ctx.fill();
  // second pass for intensified inner bloom
  ctx.shadowBlur=0;
  ctx.globalAlpha = 0.55 + pulse*0.2;
  ctx.fill();
  ctx.globalAlpha = 1;
  // stroke rim with neon
  ctx.shadowColor='rgba(255,255,255,0.9)';
  ctx.shadowBlur= 8 + pulse*8;
  ctx.strokeStyle= pulse>0.3 ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth= 2 + pulse*0.6;
  ctx.stroke();
  ctx.shadowBlur=0;
  // inner highlight
  ctx.fillStyle='rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.roundRect(x+10, y+8, w-20, 6, 6);
  ctx.fill();
  // catch flash line
  if(pulse>0.2){
    ctx.fillStyle=`rgba(255,255,255,${0.55*pulse})`;
    ctx.fillRect(x+14, y+4, w-28, 2);
    ctx.fillStyle=`rgba(255,213,74,${0.45*pulse})`;
    ctx.beginPath(); ctx.ellipse(x+w/2, y+h/2, w*0.45*pulse, 10, 0,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawBackground(t){
  ctx.save();
  ctx.globalAlpha=0.07;
  ctx.strokeStyle='#00f0ff';
  ctx.lineWidth=1;
  for(let y= (t*0.06)%42; y<H; y+=42){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  for(let x= (t*0.04)%42; x<W; x+=42){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  ctx.restore();
  const grad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, 560);
  grad.addColorStop(0,'rgba(0,240,255,0.16)');
  grad.addColorStop(0.35,'rgba(122,92,255,0.08)');
  grad.addColorStop(0.65,'rgba(255,46,147,0.05)');
  grad.addColorStop(1,'transparent');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,W,380);
  // subtle vignette inside canvas
  const vg = ctx.createRadialGradient(W/2,H/2, 260, W/2,H/2, 520);
  vg.addColorStop(0,'transparent');
  vg.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,W,H);
}

function loop(now){
  if(state!=='playing') return;
  // hit-stop micro freeze — Fruit Ninja impact pause
  if(now < hitStopUntil){
    animId = requestAnimationFrame(loop);
    return;
  }
  const dt = Math.min(0.033, (now - lastT)/1000);
  lastT = now;
  // input with velocity tracking for tilt
  let dir = 0;
  if(keys.left || touchLeft) dir -=1;
  if(keys.right || touchRight) dir +=1;
  let prevX = catcherX;
  if(dir!==0){
    catcherX += dir * CATCHER_SPEED * dt;
    catcherX = Math.max(0, Math.min(W - CATCHER_W, catcherX));
  }
  catcherVX = (catcherX - prevX)/dt;
  // smooth decay of velocity when idle (for tilt)
  if(dir===0) catcherVX *= Math.pow(0.0005, dt);

  // spawn
  spawnTimer += dt;
  if(spawnTimer >= spawnInterval){
    spawnTimer = 0;
    spawnStar();
    if(Math.random()<0.18 && level>2) setTimeout(spawnStar, 120);
  }
  // update stars — spawn pop + fall
  for(let i=stars.length-1;i>=0;i--){
    const s=stars[i];
    s.y += s.vy * dt;
    s.x += s.drift * dt;
    s.rot += s.rotSpeed * dt;
    if(s.spawnScale<1) s.spawnScale = Math.min(1, s.spawnScale + dt*6);
    if(s.x < 14 || s.x > W-14) s.drift *= -1;
    s.x = Math.max(14, Math.min(W-14, s.x));
    const cx = catcherX + CATCHER_W/2;
    const caughtNow = s.y + s.size*0.6 >= CATCHER_Y && s.y - s.size*0.6 <= CATCHER_Y + CATCHER_H && Math.abs(s.x - cx) < (CATCHER_W/2 - 6);
    if(caughtNow){
      catchStar(s);
      stars.splice(i,1);
      continue;
    }
    if(s.y > H + 30){
      stars.splice(i,1);
      missStar();
      if(state==='over') break;
    }
  }
  // particles — handle all types
  for(let i=PARTICLES.length-1;i>=0;i--){
    const p=PARTICLES[i];
    p.life+=dt;
    if(p.type==='ring' || p.type==='flash' || p.type==='text'){
      // no physics
    } else {
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      if(p.type==='spark' || p.type==='shard') p.vy+= 520*dt;
      if(p.rotSpeed) p.rot += p.rotSpeed*dt;
      p.alpha=1 - p.life/p.max;
    }
    if(p.type==='ring' || p.type==='flash'){
      p.alpha = 1 - p.life/p.max;
    }
    if(p.type==='text'){
      p.alpha = 1 - p.life/p.max;
      p.y += p.vy*dt;
      p.vy += 28*dt;
    }
    if(p.life>=p.max) PARTICLES.splice(i,1);
  }
  if(shake>0) shake *= Math.pow(0.18, dt*7);
  if(catcherPulse>0) catcherPulse = Math.max(0, catcherPulse - dt*3.2);
  if(flashAlpha>0) flashAlpha = Math.max(0, flashAlpha - dt*3.5);

  // render
  ctx.clearRect(0,0,W,H);
  ctx.save();
  if(shake>0.5){
    ctx.translate( (Math.random()*2-1)*shake, (Math.random()*2-1)*shake );
  }
  drawBackground(now);
  // flash overlay — screen bloom on catch
  if(flashAlpha>0){
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    const fg = ctx.createRadialGradient(W/2, CATCHER_Y+10, 0, W/2, CATCHER_Y+10, 320);
    fg.addColorStop(0, flashColor);
    fg.addColorStop(0.45, flashColor+'66');
    fg.addColorStop(1,'transparent');
    ctx.fillStyle=fg;
    ctx.fillRect(0, CATCHER_Y-160, W, 220);
    // top spill
    ctx.globalAlpha = flashAlpha*0.55;
    ctx.fillStyle = flashColor;
    ctx.fillRect(0,0,W, 3);
    ctx.restore();
  }
  // catcher with tilt + pulse
  const tilt = Math.max(-1, Math.min(1, catcherVX/520));
  const idleSquash = Math.sin(now*0.012)*0.10;
  drawCatcher(catcherX, dir!==0 ? Math.sin(now*0.02)*0.35 : idleSquash, tilt, catcherPulse);
  // stars with spawn scale
  for(const s of stars){
    drawStar(s.x, s.y, s.size, s.rot, s.rare, s.spawnScale);
  }
  // particles — additive bloom like Tron light trails
  ctx.save();
  for(const p of PARTICLES){
    if(p.type==='ring'){
      const t = p.life/p.max;
      const r = p.r0 + (p.r1 - p.r0)*t;
      ctx.globalAlpha = Math.max(0, p.alpha * (1-t)*0.95);
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.lineWidth = p.width * (1 - t*0.35);
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
      ctx.shadowBlur=0;
    } else if(p.type==='flash'){
      const t = p.life/p.max;
      ctx.globalAlpha = Math.max(0, (1-t)*0.85* (p.alphaM||1));
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(1-t*0.3),0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    } else if(p.type==='text'){
      const t = p.life/p.max;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.color;
      ctx.font = `900 ${13 + p.scale*4}px Orbitron, monospace`;
      ctx.textAlign='center';
      ctx.lineWidth=3;
      ctx.strokeStyle='rgba(7,11,30,0.85)';
      // outline for readability at any viewport
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur=0;
    } else if(p.type==='shard'){
      ctx.globalAlpha = Math.max(0,p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot||0);
      ctx.beginPath();
      ctx.moveTo(0, -p.r*0.7); ctx.lineTo(-p.r*0.55, p.r*0.6); ctx.lineTo(p.r*0.55, p.r*0.6); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur=0;
    } else {
      // spark circle with bloom
      ctx.globalAlpha = Math.max(0,p.alpha);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      // additive lighter for overlapping bloom
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*(0.7+0.3*(1-p.life/p.max)),0,Math.PI*2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur=0;
    }
  }
  ctx.restore();
  ctx.restore();

  animId = requestAnimationFrame(loop);
}

// init
updateHUD();
setState('start');
bestEl.textContent='BEST '+best;
document.getElementById('buildInfo').textContent='build ok • neon v2 — burst+bloom';

// expose for tests
window.__neon = {
  get state(){return state},
  get score(){return score},
  get lives(){return lives},
  get missed(){return missed},
  get caught(){return caught},
  get level(){return level},
  startGame, resetGame, spawnStar, catchStar, missStar,
  canvas, ctx
};

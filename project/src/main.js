import { clamp, lerp, dist, dist2, angleBetween, circleRectCollide, lineRectIntersect, hasLineOfSight, zoneDamagePerSecond, zoneRadiusAt, computePhases, ammoAfterShot, reloadResult } from './gameLogic.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('mini');
const mctx = mini.getContext('2d');
const hpBar = document.getElementById('hpBar');
const hpText = document.getElementById('hpText');
const armorBar = document.getElementById('armorBar');
const armorText = document.getElementById('armorText');
const magEl = document.getElementById('mag');
const reserveEl = document.getElementById('reserve');
const reloadText = document.getElementById('reloadText');
const reloadBar = document.getElementById('reloadBar');
const zoneLabel = document.getElementById('zoneLabel');
const zoneTime = document.getElementById('zoneTime');
const zoneSub = document.getElementById('zoneSub');
const zoneBar = document.getElementById('zoneBar');
const elimEl = document.getElementById('elim');
const aliveEl = document.getElementById('alive');
const compassText = document.getElementById('compassText');
const posText = document.getElementById('posText');
const toast = document.getElementById('toast');
const hitVig = document.getElementById('hitVig');
const zoneVig = document.getElementById('zoneVig');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const endTitle = document.getElementById('endTitle');
const endSub = document.getElementById('endSub');
const endBrand = document.getElementById('endBrand');
const endIcon = document.getElementById('endIcon');
const rElim = document.getElementById('rElim');
const rAlive = document.getElementById('rAlive');
const rTime = document.getElementById('rTime');
const rDetail = document.getElementById('rDetail');
const crosshairEl = document.getElementById('crosshair');
const hitMarkerEl = document.getElementById('hitMarker');
const killConfirmEl = document.getElementById('killConfirm');
const ammoCard = document.getElementById('ammoCard');

// --- Map ---
const MAP_W = 2400, MAP_H = 2400;
const MAP_CX = MAP_W/2, MAP_CY = MAP_H/2;

// obstacles
const obstacles = [];
function addRect(x,y,w,h,type='building'){ obstacles.push({x,y,w,h,type}); }
// Generated coherent city layout
(() => {
  // perimeter walls
  const thick=24;
  addRect(0,0,MAP_W,thick,'wall');
  addRect(0,MAP_H-thick,MAP_W,thick,'wall');
  addRect(0,0,thick,MAP_H,'wall');
  addRect(MAP_W-thick,0,thick,MAP_H,'wall');
  // districts
  const seeds = [
    [300,300,160,120], [560,340,120,160], [320,620,180,100], [600,620,140,140],
    [300,880,200,120], [620,880,160,120], [320,1120,140,140], [560,1140,160,100],
    [900,320,180,140], [1140,280,160,180], [920,620,200,120], [1180,640,140,160],
    [900,940,160,140], [1120,920,180,120], [920,1200,200,140], [1180,1240,140,120],
    [1500,300,160,160], [1760,340,140,120], [1520,600,180,120], [1760,620,160,140],
    [1500,900,140,160], [1720,920,180,120], [1500,1200,160,140], [1760,1180,140,160],
    [700,1500,220,140], [1040,1520,180,160], [700,1760,160,140], [980,1780,200,120],
    [1380,1520,160,140], [1620,1540,180,120], [1380,1780,200,140], [1660,1760,140,160],
    // central cross
    [980,980,240,180],
    // scattered rocks/crates
    [420,1400,40,40],[480,1420,30,30],[520,1380,36,36],[1800,1400,50,50],[1840,1480,40,40],
    [400,1800,60,30],[600,200,50,50],[2000,600,40,60],[2000,1800,60,40],[200,2000,50,50],
  ];
  seeds.forEach(([x,y,w,h])=> addRect(x,y,w,h, (w<60||h<60)?'rock':'building'));
  // walls / barriers
  addRect(800,500,12,220,'wall');
  addRect(1400,800,220,12,'wall');
  addRect(800,1300,220,12,'wall');
  addRect(1300,1400,12,220,'wall');
})();

let state = 'menu'; // menu, playing, won, lost
let time = 0;
let phaseIdx = 0;
const phases = computePhases(90);
let zone = { x: MAP_CX+120, y: MAP_CY-80, r: 1200, targetR:1200 };
let nextZone = { x: MAP_CX-60, y: MAP_CY+40, r: 120 };

let player = {
  x: MAP_CX, y: MAP_CY+520, r:16,
  hp:100, maxHp:100, armor:0,
  mag:30, reserve:90,
  reloading:false, reloadT:0,
  angle: -Math.PI/2,
  vx:0, vy:0,
  speed: 260,
  sprintMult:1.55,
  eliminations:0,
  pickups:0,
  shooting:false,
  shootCd:0,
  invuln:0,
};

let enemies = [];
let pickups = [];
let bullets = [];
let particles = [];
let decals = [];
let messages = [];
let casings = [];
let floatTexts = [];
let muzzleFlashes = [];
// PUBG-like gunplay state
const WEAPON = { name:'M416', magSize:30, fireRate:0.095, dmg:24, bulletSpeed:1320, spreadBase:0.016, spreadMoveAdd:0.018, spreadSprintAdd:0.04, recoilPerShot:0.11, maxSpread:0.095, reloadSec:1.35 };
let gunState = { recoil:0, spreadAccum:0, shotsInBurst:0, lastShotAt:-999, heat:0 };
let hitMarkerT=0, hitMarkerKill=false, killConfirmT=0;
let dmgShake=0;
let audioCtx=null;

function getAudio(){
  if(audioCtx) return audioCtx;
  try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; }
  return audioCtx;
}
function playSound(kind){
  const ac=getAudio(); if(!ac) return;
  if(ac.state==='suspended') ac.resume();
  const now=ac.currentTime;
  const o=ac.createOscillator(), g=ac.createGain();
  o.connect(g); g.connect(ac.destination);
  if(kind==='shoot'){
    o.type='square'; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(85, now+0.08);
    g.gain.setValueAtTime(0.22, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.12);
    o.start(now); o.stop(now+0.13);
    // click transient
    const o2=ac.createOscillator(), g2=ac.createGain();
    o2.connect(g2); g2.connect(ac.destination);
    o2.type='square'; o2.frequency.setValueAtTime(900, now); g2.gain.setValueAtTime(0.12, now); g2.gain.exponentialRampToValueAtTime(0.001, now+0.04);
    o2.start(now); o2.stop(now+0.05);
  } else if(kind==='hit'){
    o.type='sine'; o.frequency.setValueAtTime(920, now); o.frequency.setValueAtTime(1400, now+0.03);
    g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.11);
    o.start(now); o.stop(now+0.12);
  } else if(kind==='kill'){
    o.type='triangle'; o.frequency.setValueAtTime(600, now); o.frequency.linearRampToValueAtTime(900, now+0.12);
    g.gain.setValueAtTime(0.28, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.22);
    o.start(now); o.stop(now+0.24);
  } else if(kind==='empty'){
    o.type='square'; o.frequency.setValueAtTime(120, now); g.gain.setValueAtTime(0.12, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.08); o.start(now); o.stop(now+0.09);
  } else if(kind==='reload'){
    o.type='sine'; o.frequency.setValueAtTime(300, now); o.frequency.linearRampToValueAtTime(440, now+0.18); g.gain.setValueAtTime(0.14, now); g.gain.exponentialRampToValueAtTime(0.001, now+0.2); o.start(now); o.stop(now+0.21);
  }
}

const keys = {};
let mouse = { x: innerWidth/2, y: innerHeight/2, down:false };
let aimAngle = -Math.PI/2;
let touchMove = { x:0, y:0, active:false };
let sprintHeld = false;

function resetGame(){
  time=0; phaseIdx=0;
  zone = { x: MAP_CX+120, y: MAP_CY-80, r:1200 };
  player = {
    x: MAP_CX + (Math.random()*200-100), y: MAP_CY+520, r:16,
    hp:100, maxHp:100, armor:0,
    mag:30, reserve:90,
    reloading:false, reloadT:0,
    angle: -Math.PI/2,
    vx:0, vy:0,
    speed:260, sprintMult:1.55,
    eliminations:0, pickups:0,
    shooting:false, shootCd:0, invuln:0,
  };
  enemies=[];
  for(let i=0;i<11;i++){
    const angle = (i/11)*Math.PI*2;
    const rad = 700 + Math.random()*600;
    const ex = MAP_CX + Math.cos(angle)*rad + (Math.random()*200-100);
    const ey = MAP_CY + Math.sin(angle)*rad + (Math.random()*200-100);
    enemies.push({
      id:i, x: clamp(ex, 80, MAP_W-80), y: clamp(ey, 80, MAP_H-80), r:14,
      hp: 70, maxHp:70,
      angle: Math.random()*Math.PI*2,
      state:'wander', stateT: 1+Math.random()*2,
      vx:0, vy:0,
      shootCd: 0.4+Math.random()*0.8,
      speed: 140 + Math.random()*40,
      alive:true,
      wanderTarget:null,
      lastSeen:0,
    });
  }
  pickups=[];
  const types = ['health','ammo','ammo','health','armor','ammo','health','ammo','health','ammo','armor','ammo','health','ammo'];
  for(let i=0;i<14;i++){
    let px,py, tries=0;
    do{
      px = 120 + Math.random()*(MAP_W-240);
      py = 120 + Math.random()*(MAP_H-240);
      tries++;
    } while(obstacles.some(o=> circleRectCollide(px,py,28, o.x-10,o.y-10,o.w+20,o.h+20)) && tries<30);
    pickups.push({ x:px, y:py, type: types[i%types.length], taken:false, respawn:0, pulse: Math.random()*Math.PI*2 });
  }
  bullets=[]; particles=[]; decals=[]; messages=[]; casings=[]; floatTexts=[]; muzzleFlashes=[];
  gunState={ recoil:0, spreadAccum:0, shotsInBurst:0, lastShotAt:-999, heat:0 };
  hitMarkerT=0; killConfirmT=0; camKick=0; cam.shake=0; dmgShake=0;
  if(crosshairEl) crosshairEl.style.setProperty('--gap','10px');
  updateAmmoHud();
  state='playing';
  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  // prime audio on gesture
  getAudio();
  showToast('DEPLOYED — M416 READY • HOLD FIRE FOR AUTO', 2600);
}

function showToast(text, dur=1800){
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toast.classList.remove('show'), dur);
}
function damageEntity(ent, dmg, from){
  let remaining = dmg;
  if(ent.armor){
    const abs = Math.min(ent.armor, remaining*0.5);
    ent.armor -= abs;
    remaining -= abs*0.6;
  }
  ent.hp -= remaining;
  if(ent.hp<=0){
    ent.hp=0;
    return true;
  }
  return false;
}

function tryCollideMove(ent, nx, ny){
  let canX = true, canY = true;
  for(const o of obstacles){
    if(circleRectCollide(nx, ent.y, ent.r, o.x,o.y,o.w,o.h)) canX=false;
    if(circleRectCollide(ent.x, ny, ent.r, o.x,o.y,o.w,o.h)) canY=false;
  }
  if(canX) ent.x = clamp(nx, ent.r+24, MAP_W-ent.r-24);
  if(canY) ent.y = clamp(ny, ent.r+24, MAP_H-ent.r-24);
}

function spawnParticle(x,y,opts={}){
  particles.push({
    x,y, vx:(Math.random()-0.5)*(opts.spread||120), vy:(Math.random()-0.5)*(opts.spread||120),
    life: opts.life||0.45, t:0, size: opts.size||3, color: opts.color||'#ffcc55', alpha:1
  });
  if(particles.length>140) particles.splice(0, particles.length-140);
}
function spawnHit(x,y,crit=false){
  const col = crit ? '#ff2d1a' : '#ffd23f';
  for(let i=0;i< (crit?12:7); i++) spawnParticle(x,y,{spread: crit?260:200, life:0.32+Math.random()*0.28, size: 2+Math.random()*2.8, color: i%3===0? '#fff8cc': col});
  // spark on crit
  if(crit){ for(let i=0;i<6;i++) spawnParticle(x,y,{spread:320, life:0.22, size:1.5, color:'#ff8a4a'}); }
  decals.push({x,y, t:0, life:4.5, r: crit?14+Math.random()*7: 10+Math.random()*6});
  if(decals.length>60) decals.shift();
}
function spawnCasing(x,y,angle){
  const perp = angle + Math.PI/2;
  const vx = Math.cos(perp)*(140+Math.random()*80) + Math.cos(angle)*(-30);
  const vy = Math.sin(perp)*(140+Math.random()*80) + Math.sin(angle)*(-30);
  casings.push({ x, y, vx, vy, rot: Math.random()*Math.PI*2, vr:(Math.random()-0.5)*18, life:0, maxLife:0.85, bounce:0 });
  if(casings.length>24) casings.shift();
}
function triggerHitMarker(isKill=false, dmg=0, wx=0, wy=0){
  hitMarkerT=0.18; hitMarkerKill=isKill;
  hitMarkerEl.classList.remove('kill');
  if(isKill) hitMarkerEl.classList.add('kill');
  hitMarkerEl.classList.add('on');
  clearTimeout(triggerHitMarker._t);
  triggerHitMarker._t=setTimeout(()=> hitMarkerEl.classList.remove('on'), 140);
  if(isKill){ killConfirmT=1.1; killConfirmEl.classList.add('on'); clearTimeout(triggerHitMarker._k); triggerHitMarker._k=setTimeout(()=> killConfirmEl.classList.remove('on'), 950); playSound('kill'); }
  else playSound('hit');
  dmgShake = isKill? 7 : 4;
  // floating damage number
  if(dmg>0){
    floatTexts.push({ x:wx, y:wy, vy:-42, t:0, life:0.75, text: isKill? `-${dmg} ✕` : `-${dmg}`, crit:isKill, alpha:1 });
    if(floatTexts.length>10) floatTexts.shift();
  }
  // crosshair punch
  if(crosshairEl){
    crosshairEl.style.setProperty('--gap','18px');
    setTimeout(()=> { if(crosshairEl) crosshairEl.style.setProperty('--gap',''); }, 90);
  }
}
function updateGunplay(dt){
  // decay recoil / spread
  gunState.recoil = Math.max(0, gunState.recoil - dt*3.2);
  gunState.heat = Math.max(0, gunState.heat - dt*2.5);
  if(time - gunState.lastShotAt > 0.38){
    gunState.spreadAccum = Math.max(0, gunState.spreadAccum - dt*0.28);
    gunState.shotsInBurst = Math.max(0, gunState.shotsInBurst - dt*6);
  }
  // hit marker timer
  if(hitMarkerT>0){ hitMarkerT-=dt; if(hitMarkerT<=0) hitMarkerEl.classList.remove('on'); }
  if(killConfirmT>0){ killConfirmT-=dt; if(killConfirmT<=0) killConfirmEl.classList.remove('on'); }
}

function shoot(from, angle, isPlayer=false){
  // spread calculation
  let spread = 0;
  if(isPlayer){
    const moving = Math.hypot(keys['w']||keys['a']||keys['s']||keys['d'] ? 1 : 0, 0) >0 || touchMove.active;
    // more accurate moving detection via actual velocity
    const vel = Math.hypot(player.vx||0, player.vy||0);
    const isMoving = vel>36 || moving;
    const isSprint = (keys['shift']||sprintHeld) && isMoving;
    spread = WEAPON.spreadBase;
    if(isMoving) spread += WEAPON.spreadMoveAdd * Math.min(1, vel/260);
    if(isSprint) spread += WEAPON.spreadSprintAdd;
    spread += gunState.spreadAccum;
    spread += gunState.recoil*0.11;
    spread = clamp(spread, 0, WEAPON.maxSpread);
    // apply random spread
    const off = (Math.random()-0.5)* spread * 2.2;
    angle += off;
    // vertical recoil contribution (PUBG pulls up with bursts)
    angle += gunState.recoil*0.035;
  } else {
    // enemy slight inaccuracy
    angle += (Math.random()-0.5)*0.07;
  }
  const muzzleX = from.x + Math.cos(angle)*(from.r+10);
  const muzzleY = from.y + Math.sin(angle)*(from.r+10);
  // light the muzzle
  muzzleFlashes.push({ x:muzzleX, y:muzzleY, a:angle, t:0, life:0.075, isPlayer });
  for(let i=0;i<3;i++) spawnParticle(muzzleX, muzzleY,{spread:55, life:0.06+Math.random()*0.05, size: 4+Math.random()*3, color: i===0?'#fffbe0':'#ffcc55'});
  // casing
  if(isPlayer) spawnCasing(from.x + Math.cos(angle+Math.PI/2)*6, from.y + Math.sin(angle+Math.PI/2)*6, angle);
  const spd = isPlayer? WEAPON.bulletSpeed : 1080;
  bullets.push({
    x:muzzleX, y:muzzleY,
    vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd,
    angle, life:1.25, owner: isPlayer?'player':'enemy', dmg: isPlayer?WEAPON.dmg:16,
    trail:[{x:muzzleX,y:muzzleY}]
  });
  if(isPlayer){
    gunState.recoil = clamp(gunState.recoil + WEAPON.recoilPerShot, 0, 0.85);
    gunState.spreadAccum = clamp(gunState.spreadAccum + 0.012, 0, 0.08);
    gunState.shotsInBurst += 1;
    gunState.heat = clamp(gunState.heat + 0.14, 0, 1);
    gunState.lastShotAt = time;
    camKick = 3.8 + Math.random()*1.4;
    dmgShake = 1.2;
    playSound('shoot');
    // dynamic crosshair kick
    if(crosshairEl){ crosshairEl.classList.add('shooting'); clearTimeout(shoot._ct); shoot._ct=setTimeout(()=> crosshairEl.classList.remove('shooting'), 110); }
  } else {
    // subtle enemy kick
  }
}

function doReload(){
  if(player.reloading || player.mag===WEAPON.magSize || player.reserve<=0) return;
  player.reloading=true; player.reloadT=0;
  reloadText.textContent=`RELOADING ${WEAPON.name}…`;
  playSound('reload');
}
function updateReload(dt){
  if(!player.reloading) return;
  player.reloadT+=dt;
  const dur=WEAPON.reloadSec;
  const p = clamp(player.reloadT/dur,0,1);
  reloadBar.style.width = (p*100)+'%';
  // color shift near end like PUBG
  reloadBar.style.background = p>0.92 ? 'linear-gradient(90deg,#00e5a0,#e2ff3f)' : 'linear-gradient(90deg,var(--accent),#c6e000)';
  if(player.reloadT>=dur){
    const res = reloadResult(player.mag, player.reserve);
    player.mag=res.mag; player.reserve=res.reserve;
    player.reloading=false; player.reloadT=0;
    reloadBar.style.width='0%';
    reloadText.textContent=`${WEAPON.name} • 5.56MM • AUTO`;
    if(res.reloaded>0) showToast(`RELOADED +${res.reloaded} • ${player.mag}/${player.reserve}`, 1300);
    updateAmmoHud();
  } else {
    reloadText.textContent=`RELOADING ${(p*100).toFixed(0)}% — ${WEAPON.name}`;
  }
}
function updateAmmoHud(){
  magEl.textContent = String(player.mag);
  reserveEl.textContent = String(player.reserve);
  const low = player.mag<=8 && player.mag>0;
  const empty = player.mag===0;
  ammoCard.classList.toggle('low', low||empty);
  magEl.style.color = empty?'#ff3b30': low?'#ffb020':'';
  // fire mode hint
  const fm = document.getElementById('fireModeText');
  if(fm) fm.innerHTML = player.reloading ? `<span style="color:var(--warn)">↻ RELOADING ${(player.reloadT/WEAPON.reloadSec*100|0)}%</span>` : `TAP / HOLD TO FIRE • <span style="color:var(--accent)">● AUTO</span> ${low?'• <span style="color:#ffb020">LOW</span>':''} ${empty?'• <span style="color:var(--danger)">EMPTY — PRESS R</span>':''}`;
}

let cam = { x: MAP_CX, y: MAP_CY, shake:0 };
let camKick=0;

function resize(){
  const dpr = Math.min(window.devicePixelRatio||1, 1.9);
  canvas.width = innerWidth*dpr; canvas.height = innerHeight*dpr;
  canvas.style.width = innerWidth+'px'; canvas.style.height = innerHeight+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  mini.width=140*dpr; mini.height=140*dpr;
  mctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize); resize();

// Input
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k==='r' && state==='playing') doReload();
  if(k===' ' && state==='playing'){ mouse.down=true; }
  if(k==='r' && state!=='playing' && endOverlay.classList.contains('hidden')===false){
    // handled via button
  }
});
addEventListener('keyup', e=>{
  keys[e.key.toLowerCase()]=false;
  if(e.key===' ') mouse.down=false;
  if(e.key.toLowerCase()==='shift') sprintHeld=false;
});
canvas.addEventListener('mousemove', e=>{
  mouse.x=e.clientX; mouse.y=e.clientY;
  const world = screenToWorld(e.clientX,e.clientY);
  aimAngle = angleBetween(player.x,player.y, world.x, world.y);
});
canvas.addEventListener('mousedown', e=>{
  if(e.button===0 && state==='playing'){
    mouse.down=true;
  }
});
addEventListener('mouseup', e=>{ if(e.button===0) mouse.down=false; });
canvas.addEventListener('contextmenu', e=> e.preventDefault());

// Touch
const stick = document.getElementById('stick');
const knob = document.getElementById('knob');
let stickActive=false, stickOrigin={x:0,y:0}, stickVec={x:0,y:0};
function stickPos(e){
  const t=e.touches?e.touches[0]:e;
  const rect=stick.getBoundingClientRect();
  return { x: t.clientX - rect.left - rect.width/2, y: t.clientY - rect.top - rect.height/2, rect };
}
stick.addEventListener('touchstart', e=>{
  e.preventDefault(); stickActive=true; touchMove.active=true;
  const p=stickPos(e); stickOrigin={x:p.rect.width/2, y:p.rect.height/2};
},{passive:false});
stick.addEventListener('touchmove', e=>{
  e.preventDefault();
  if(!stickActive) return;
  const p=stickPos(e);
  const max=42;
  const len=Math.hypot(p.x,p.y);
  const cl=len>max?max/len:1;
  const sx=p.x*cl, sy=p.y*cl;
  stickVec.x=sx/max; stickVec.y=sy/max;
  knob.style.transform=`translate(${sx}px,${sy}px)`;
  touchMove.x=stickVec.x; touchMove.y=stickVec.y;
},{passive:false});
function endStick(e){
  stickActive=false; touchMove.x=0; touchMove.y=0; touchMove.active=false;
  knob.style.transform='translate(0,0)';
}
stick.addEventListener('touchend', endStick);
stick.addEventListener('touchcancel', endStick);
document.getElementById('mFire').addEventListener('touchstart', e=>{ e.preventDefault(); mouse.down=true; });
document.getElementById('mFire').addEventListener('touchend', e=>{ e.preventDefault(); mouse.down=false; });
document.getElementById('mFire').addEventListener('mousedown', ()=> mouse.down=true);
document.getElementById('mFire').addEventListener('mouseup', ()=> mouse.down=false);
document.getElementById('mReload').addEventListener('touchstart', e=>{ e.preventDefault(); doReload(); });
document.getElementById('mReload').addEventListener('click', doReload);
document.getElementById('mSprint').addEventListener('touchstart', e=>{ e.preventDefault(); sprintHeld=true; });
document.getElementById('mSprint').addEventListener('touchend', e=>{ e.preventDefault(); sprintHeld=false; });

document.getElementById('playBtn').addEventListener('click', resetGame);
document.getElementById('restartBtn').addEventListener('click', resetGame);
document.getElementById('reviewBtn').addEventListener('click', ()=> endOverlay.classList.add('hidden'));

function screenToWorld(sx,sy){
  return {
    x: cam.x + (sx - innerWidth/2),
    y: cam.y + (sy - innerHeight/2)
  };
}
function worldToScreen(wx,wy){
  return {
    x: wx - cam.x + innerWidth/2,
    y: wy - cam.y + innerHeight/2
  };
}

// Game loop
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min((now-last)/1000, 0.033);
  last=now;
  if(state==='playing') update(dt);
  render(dt);
}
requestAnimationFrame(frame);

function update(dt){
  time+=dt;
  // zone
  const r = zoneRadiusAt(time, phases);
  zone.r = r;
  // zone center drift slightly toward nextZone over time
  const t = clamp(time/90,0,1);
  zone.x = lerp(MAP_CX+120, MAP_CX-60, t*0.9);
  zone.y = lerp(MAP_CY-80, MAP_CY+40, t*0.9);
  // phase index
  let ph=0;
  for(let i=0;i<phases.length;i++) if(time>=phases[i].t0 && time<=phases[i].t1) ph=i;
  if(time>90) ph=4;
  phaseIdx=ph;

  // player input
  let ix=0, iy=0;
  if(keys['w']||keys['arrowup']) iy-=1;
  if(keys['s']||keys['arrowdown']) iy+=1;
  if(keys['a']||keys['arrowleft']) ix-=1;
  if(keys['d']||keys['arrowright']) ix+=1;
  if(touchMove.active){ ix=touchMove.x; iy=touchMove.y; }
  const mag = Math.hypot(ix,iy);
  if(mag>0){ ix/=mag; iy/=mag; }
  const isSprint = (keys['shift']||sprintHeld) && mag>0;
  const speed = player.speed * (isSprint? player.sprintMult:1) * (player.reloading?0.85:1);
  const nx = player.x + ix*speed*dt;
  const ny = player.y + iy*speed*dt;
  tryCollideMove(player, nx, ny);
  player.angle = aimAngle;

   // shooting — PUBG tuned: hold to auto, with recoil/spread
  player.shootCd = Math.max(0, player.shootCd - dt);
  if(mouse.down && state==='playing' && !player.reloading){
    if(player.shootCd<=0){
      if(player.mag>0){
        shoot(player, player.angle, true);
        player.mag = ammoAfterShot(player.mag);
        player.shootCd = WEAPON.fireRate;
        updateAmmoHud();
        if(player.mag===0){
          showToast('MAG EMPTY — PRESS R TO RELOAD', 1400);
          // auto-reload tap hint
          if(player.reserve>0) setTimeout(()=> { if(player.mag===0 && !player.reloading) doReload(); }, 180);
        } else if(player.mag<=8){
          // subtle low warning handled via HUD pulse, no spam toast
        }
      } else {
        // empty click — punchy feedback
        if(player.shootCd<=0){
          playSound('empty');
          cam.shake = Math.max(cam.shake, 2.5);
          if(player.reserve>0) doReload(); else showToast('NO AMMO — FIND A CRATE', 1200);
          player.shootCd = 0.22;
        }
      }
    }
  }
  updateReload(dt);
  updateGunplay(dt);
  // track velocity for spread calc next frame
  player.vx = ix*speed; player.vy = iy*speed;

  // zone damage + graduated threat (critic fix: zone must feel dangerous before outside)
  const dToCenter = dist2(player.x,player.y, zone.x, zone.y);
  const outside = Math.max(0, dToCenter - zone.r);
  // graduated vignette: creep in when within 340 of edge, full when outside
  const distToSafe = outside>0 ? outside : zone.r - dToCenter;
  // distToSafe is distance to edge from inside (positive when safe). Invert for vignette.
  const edgeDist = outside>0 ? -outside : (zone.r - dToCenter); // positive inside, negative outside
  // vignette intensity: 0 when 400+ inside, rising to 0.65 near edge, 1 when outside
  let vigOpacity = 0;
  if(outside>0){
    vigOpacity = clamp(0.45 + outside/260, 0.45, 0.92);
    zoneVig.classList.add('on');
    zoneVig.style.opacity = String(vigOpacity);
  } else {
    const nearEdge = 340;
    const closeness = clamp(1 - edgeDist/nearEdge, 0, 1); // 1 at edge, 0 at 340 inside
    vigOpacity = closeness * (0.18 + phaseIdx*0.11); // stronger later phases
    if(vigOpacity>0.06){
      zoneVig.classList.add('on');
      zoneVig.style.opacity = String(vigOpacity);
    } else {
      zoneVig.classList.remove('on');
      zoneVig.style.opacity = '0';
    }
  }
  if(outside>0){
    const dps = zoneDamagePerSecond(outside, phaseIdx);
    player.hp -= dps*dt;
  }
  // distance HUD + tick beeps (PUBG pressure)
  const zoneDistEl = document.getElementById('zoneDist');
  if(zoneDistEl){
    if(outside>0){
      const brg = Math.round(((angleBetween(player.x,player.y, zone.x, zone.y)*180/Math.PI)+360)%360);
      const arrow = brg>=337||brg<23?'↑ N': brg<68?'↗ NE': brg<113?'→ E': brg<158?'↘ SE': brg<203?'↓ S': brg<248?'↙ SW': brg<293?'← W':'↖ NW';
      zoneDistEl.textContent = `⚠ ${Math.round(outside)}m OUTSIDE — ${arrow} ${brg}° TO SAFE`;
      zoneDistEl.style.color = '#ff3b30';
      zoneTime.style.color = '#ff3b30';
    } else {
      const toEdge = Math.round(zone.r - dToCenter);
      const brg = Math.round(((angleBetween(player.x,player.y, zone.x, zone.y)*180/Math.PI)+360)%360);
      const arrow = brg>=337||brg<23?'↑': brg<68?'↗': brg<113?'→': brg<158?'↘': brg<203?'↓': brg<248?'↙': brg<293?'←':'↖';
      if(toEdge<180){
        zoneDistEl.textContent = `${arrow} ${toEdge}m TO EDGE • ${brg}°`;
        zoneDistEl.style.color = toEdge<80?'#ffb020': '#6ea8ff';
        zoneTime.style.color = toEdge<80?'#ffb020':'';
      } else {
        zoneDistEl.textContent = `● SAFE — ${toEdge}m to edge`;
        zoneDistEl.style.color = 'var(--accent-2)';
        zoneTime.style.color = '';
      }
    }
    // pulse when near edge in final phases
    zoneDistEl.style.opacity = (outside>0 && Math.floor(time*4)%2===0) ? '0.85' : '1';
  }
  // phase tick beeps last 10s of each shrink phase
  {
    const ph = phases[phaseIdx];
    if(ph){
      const remaining = ph.t1 - time;
      if(remaining>0 && remaining<=10 && phaseIdx>0){
        const tickInterval = remaining<=3 ? 0.45 : remaining<=5 ? 0.7 : 1.0;
        if(!update._lastTick) update._lastTick=0;
        if(time - update._lastTick > tickInterval){
          update._lastTick=time;
          // soft tick
          playSound('empty'); // reuse subtle tick
          // flash zone bar
          zoneBar.style.filter = 'brightness(1.6)';
          setTimeout(()=> zoneBar.style.filter='', 120);
        }
      }
    }
  }
  if(player.hp<=0){
    player.hp=0;
    triggerEnd(false);
    return;
  }
  player.invuln = Math.max(0, player.invuln - dt);

  // pickups
  pickups.forEach(p=>{
    if(p.taken){
      p.respawn-=dt;
      if(p.respawn<=0){ p.taken=false; p.pulse=0; }
      return;
    }
    p.pulse+=dt*3;
    if(dist2(player.x,player.y, p.x,p.y) < 34){
      p.taken=true; p.respawn=14 + Math.random()*8;
      player.pickups++;
      if(p.type==='health'){
        const before=player.hp;
        player.hp = clamp(player.hp+45, 0, 100);
        showToast(`MEDKIT +${Math.round(player.hp-before)} HP`, 1400);
        for(let i=0;i<8;i++) spawnParticle(p.x,p.y,{color:'#ff8a4a', spread:140, life:0.5});
      } else if(p.type==='ammo'){
        const need = 30 - player.mag;
        const fromReserve = Math.min(30, player.reserve < 60 ? 30 : 20);
        // give reserve + mag
        player.reserve += 30;
        if(player.mag<30){
          const add = Math.min(12, 30-player.mag);
          player.mag+=add;
        }
        showToast('AMMO CRATE +30 reserve', 1200);
        for(let i=0;i<8;i++) spawnParticle(p.x,p.y,{color:'#4affc8', spread:140, life:0.5});
      } else if(p.type==='armor'){
        player.armor = clamp(player.armor+36, 0, 50);
        showToast('ARMOR PLATE +36', 1200);
        for(let i=0;i<8;i++) spawnParticle(p.x,p.y,{color:'#6ea8ff', spread:140, life:0.5});
      }
    }
  });

  // enemies AI
  enemies.forEach(e=>{
    if(!e.alive) return;
    e.shootCd = Math.max(0, e.shootCd - dt);
    e.stateT -= dt;
    const dToPlayer = dist(e, player);
    const canSee = dToPlayer < 560 && hasLineOfSight(e.x,e.y, player.x, player.y, obstacles);
    if(canSee) e.lastSeen = 0; else e.lastSeen += dt;

    // FSM
    if(e.hp<=0){
      e.alive=false;
      player.eliminations++;
      aliveEl.textContent = String(enemies.filter(x=>x.alive).length);
      spawnHit(e.x,e.y,true);
      showToast(`ELIMINATED HOSTILE • ${player.eliminations} total`, 1500);
      // chance drop pickup near death
      if(Math.random()<0.45){
        pickups.push({ x:e.x+(Math.random()*40-20), y:e.y+(Math.random()*40-20), type: Math.random()<0.5?'ammo':'health', taken:false, respawn:0, pulse:0 });
      }
      if(enemies.every(x=>!x.alive)){
        triggerEnd(true);
        return;
      }
      return;
    }

    // zone damage for bots too (they try to move to zone)
    const ed = dist2(e.x,e.y, zone.x, zone.y);
    const eOut = Math.max(0, ed - zone.r);
    if(eOut>0){
      e.hp -= zoneDamagePerSecond(eOut, phaseIdx)*dt*0.9;
      // force move to center
      e.state='chase';
      e.stateT=1.2;
    }

    if(eOut>120){
      // rush to zone
      const ang = angleBetween(e.x,e.y, zone.x, zone.y);
      const nx2 = e.x + Math.cos(ang)*e.speed*dt*1.1;
      const ny2 = e.y + Math.sin(ang)*e.speed*dt*1.1;
      tryCollideMove(e, nx2, ny2);
      e.angle = ang;
    } else if(canSee && dToPlayer < 520){
      // combat
      e.state='combat';
      // aim at player with slight inaccuracy
      const targetAng = angleBetween(e.x,e.y, player.x, player.y);
      e.angle = lerp(e.angle, targetAng, 0.18) + (Math.random()-0.5)*0.08;
      // strafe + keep distance 180-260
      const desired = 220;
      const diff = dToPlayer - desired;
      const approach = clamp(diff*0.6, -e.speed, e.speed);
      const strafe = Math.sin(time*0.9 + e.id) * 40;
      const moveAng = e.angle + Math.PI/2 * Math.sign(strafe);
      // mix approach and strafe
      const mx = Math.cos(e.angle)*approach*0.5 + Math.cos(moveAng)*strafe*0.4;
      const my = Math.sin(e.angle)*approach*0.5 + Math.sin(moveAng)*strafe*0.4;
      tryCollideMove(e, e.x + mx*dt, e.y + my*dt);
      if(e.shootCd<=0 && dToPlayer<480 && Math.random()<0.55){
        shoot(e, e.angle, false);
        e.shootCd = 0.42 + Math.random()*0.55;
      }
    } else {
      // wander / search
      if(e.stateT<=0 || !e.wanderTarget){
        // pick new wander near player or random
        if(e.lastSeen<4 && dToPlayer<800){
          const ang = angleBetween(e.x,e.y, player.x, player.y) + (Math.random()-0.5)*0.9;
          const distW = 200+Math.random()*200;
          e.wanderTarget = { x: clamp(player.x+Math.cos(ang)*distW, 80, MAP_W-80), y: clamp(player.y+Math.sin(ang)*distW, 80, MAP_H-80)};
        } else {
          e.wanderTarget = { x: 80+Math.random()*(MAP_W-160), y: 80+Math.random()*(MAP_H-160)};
        }
        e.stateT = 2.5+Math.random()*2.5;
      }
      if(e.wanderTarget){
        const ang = angleBetween(e.x,e.y, e.wanderTarget.x, e.wanderTarget.y);
        e.angle = lerp(e.angle, ang, 0.08);
        const nx2 = e.x + Math.cos(e.angle)*e.speed*dt*0.8;
        const ny2 = e.y + Math.sin(e.angle)*e.speed*dt*0.8;
        // avoid obstacles by slight steer
        let willCollide=false;
        for(const o of obstacles) if(circleRectCollide(nx2,ny2,e.r,o.x,o.y,o.w,o.h)) willCollide=true;
        if(willCollide){
          e.angle+= Math.PI*0.35;
        } else {
          tryCollideMove(e, nx2, ny2);
        }
        if(dist(e, e.wanderTarget)<24) e.wanderTarget=null;
      }
    }
    // separation from other enemies
    for(const other of enemies){
      if(other===e || !other.alive) continue;
      const d = dist(e, other);
      if(d<36){
        const ang = angleBetween(other.x,other.y, e.x,e.y);
        tryCollideMove(e, e.x + Math.cos(ang)*28*dt*8, e.y + Math.sin(ang)*28*dt*8);
      }
    }
    // separation from player
    const dp = dist(e, player);
    if(dp<40){
      const ang = angleBetween(player.x,player.y, e.x,e.y);
      tryCollideMove(e, e.x + Math.cos(ang)*30, e.y + Math.sin(ang)*30);
    }
  });

   // bullets — tighter PUBG-like tracers + wall spark + hit confirm
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.trail.push({x:b.x, y:b.y});
    if(b.trail.length>7) b.trail.shift();
    const nx = b.x + b.vx*dt;
    const ny = b.y + b.vy*dt;
    let hit=false;
    // wall hit — small spark and tangible decal
    for(const o of obstacles){
      if(lineRectIntersect(b.x,b.y,nx,ny,o.x,o.y,o.w,o.h)){
        hit=true;
        for(let k=0;k<4;k++) spawnParticle(nx,ny,{color: k%2?'#cbd5d6':'#ffe9a0', spread:90, life:0.16+Math.random()*0.14, size:1.8});
        spawnParticle(nx,ny,{color:'#9aa8a8', spread:40, life:0.12, size:2.2});
        decals.push({x:nx,y:ny, t:0, life:3.5, r:6+Math.random()*4});
        break;
      }
    }
    if(hit){ bullets.splice(i,1); continue; }
    // entity hit
    if(b.owner==='player'){
      for(const e of enemies){
        if(!e.alive) continue;
        if(dist2(nx,ny,e.x,e.y) < (e.r+7)*(e.r+7)){
          const willKill = e.hp - b.dmg <= 0;
          e.hp -= b.dmg;
          bullets.splice(i,1); hit=true;
          // flesh hit: blood + white core spray (PUBG style)
          spawnHit(e.x,e.y, willKill);
          if(willKill) { for(let k=0;k<5;k++) spawnParticle(e.x,e.y,{color:'#ff3b30', spread:180, life:0.28, size:3}); }
          triggerHitMarker(willKill, b.dmg, e.x, e.y);
          // impulse kick on enemy
          const hk = angleBetween(e.x,e.y, nx,ny);
          tryCollideMove(e, e.x + Math.cos(hk)*6, e.y + Math.sin(hk)*6);
          cam.shake = Math.max(cam.shake, willKill? 5: 2.5);
          break;
        }
      }
      if(hit) continue;
    } else {
      if(dist2(nx,ny, player.x, player.y) < (player.r+7)*(player.r+7)){
        if(player.invuln<=0){
          const died = damageEntity(player, b.dmg);
          player.invuln=0.13;
          bullets.splice(i,1);
          hit=true;
          hitVig.classList.add('on'); setTimeout(()=>hitVig.classList.remove('on'), 140);
          cam.shake=9; dmgShake=6;
          spawnHit(player.x,player.y,false);
          // red flash on HUD bar
          hpBar.style.filter='brightness(1.6)'; setTimeout(()=> hpBar.style.filter='', 120);
          if(died){ triggerEnd(false); return; }
        } else {
          bullets.splice(i,1); hit=true;
        }
        if(hit) continue;
      }
    }
    b.x=nx; b.y=ny;
    b.life-=dt;
    if(b.life<=0) bullets.splice(i,1);
    // bounds
    if(b.x<0||b.x>MAP_W||b.y<0||b.y>MAP_H) bullets.splice(i,1);
  }

  // particles + casings + muzzle flashes + floats
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+= 260*dt; p.vx*= (1 - dt*0.9); p.alpha=1 - p.t/p.life;
    if(p.t>=p.life) particles.splice(i,1);
  }
  for(let i=casings.length-1;i>=0;i--){
    const c=casings[i]; c.life+=dt; c.x+=c.vx*dt; c.y+=c.vy*dt; c.vy+= 620*dt; c.vx*= (1 - dt*2.2); c.rot+=c.vr*dt;
    // bounce once
    if(c.y>0 && c.life>0.12 && c.bounce===0){ c.vy*=-0.42; c.vx*=0.7; c.bounce=1; }
    if(c.life>=c.maxLife) casings.splice(i,1);
  }
  for(let i=muzzleFlashes.length-1;i>=0;i--){ const m=muzzleFlashes[i]; m.t+=dt; if(m.t>=m.life) muzzleFlashes.splice(i,1); }
  for(let i=floatTexts.length-1;i>=0;i--){
    const f=floatTexts[i]; f.t+=dt; f.y+= f.vy*dt; f.vy+= 36*dt; f.alpha=1 - f.t/f.life;
    if(f.t>=f.life) floatTexts.splice(i,1);
  }
  for(let i=decals.length-1;i>=0;i--){
    decals[i].t+=dt;
    if(decals[i].t>decals[i].life) decals.splice(i,1);
  }

  // camera follow — tighter, plus damage shake additive
  const targetCamX = clamp(player.x, innerWidth/2, MAP_W - innerWidth/2);
  const targetCamY = clamp(player.y, innerHeight/2, MAP_H - innerHeight/2);
  cam.x = lerp(cam.x, targetCamX, 0.15);
  cam.y = lerp(cam.y, targetCamY, 0.15);
  if(cam.shake>0) cam.shake = Math.max(0, cam.shake - dt*30);
  if(dmgShake>0) dmgShake = Math.max(0, dmgShake - dt*22);
  if(camKick>0) camKick = Math.max(0, camKick - dt*20);

  // dynamic crosshair gap based on spread + movement (PUBG bloom)
  if(crosshairEl && !crosshairEl.classList.contains('shooting')){
    const vel = Math.hypot(player.vx||0, player.vy||0);
    const moveBloom = clamp(vel/260,0,1)*7 + gunState.spreadAccum*80 + gunState.recoil*22;
    const gap = 9 + moveBloom;
    const clamped = clamp(gap, 8, 26);
    crosshairEl.style.setProperty('--gap', clamped+'px');
    crosshairEl.classList.toggle('low-acc', clamped>18);
  }

  // HUD
  aliveEl.textContent = String(enemies.filter(e=>e.alive).length);
  elimEl.textContent = String(player.eliminations);
  const hpPct = clamp(player.hp,0,100);
  hpBar.style.width = hpPct+'%';
  hpBar.className='bar-fill' + (hpPct<30?' low': hpPct<60?' mid':'');
  hpText.textContent = Math.ceil(player.hp)+' HP';
  armorBar.style.width = (player.armor/50*100)+'%';
  armorText.textContent = Math.round(player.armor);
  updateAmmoHud();
  if(!player.reloading) reloadBar.style.width='0%';
  const mins = Math.floor(Math.max(0, 90-time)/1);
  const secs = Math.floor(Math.max(0, 90-time)%60);
  const rem = Math.max(0, 90-time);
  zoneTime.textContent = `${String(Math.floor(rem/60)).padStart(2,'0')}:${String(Math.floor(rem%60)).padStart(2,'0')}`;
  const phaseNames = ['Stable','Collapsing','Tightening','Critical','Final'];
  zoneLabel.textContent = `Safe Zone — ${rem<=0?'CLOSED':phaseNames[phaseIdx]}`;
  zoneSub.textContent = `${enemies.filter(e=>e.alive).length} opponents • Phase ${phaseIdx+1} / 5`;
  zoneBar.style.width = (zone.r/1200*100)+'%';
  zoneBar.style.background = phaseIdx>=3 ? 'linear-gradient(90deg,#ff6b30,#ff3b30)' : 'linear-gradient(90deg,#6ea8ff,#00e5a0)';
  compassText.textContent = `N • ${Math.round(((player.angle*180/Math.PI)+360)%360)}°`;
  posText.textContent = `X ${Math.round(player.x)} • Y ${Math.round(player.y)}`;
}

function triggerEnd(won){
  state = won? 'won':'lost';
  endOverlay.classList.remove('hidden');
  endTitle.textContent = won? 'YOU SURVIVED' : 'ELIMINATED';
  endTitle.style.color = won? 'var(--accent)' : '#ff3b30';
  endBrand.textContent = won? 'MISSION REPORT — VICTORY' : 'MISSION REPORT — DEFEAT';
  endSub.textContent = won? 'You outlasted 11 hostiles and claimed the last drop. Clean run.' : 'You were caught outside position or outgunned. Redeploy and control the zone earlier.';
  endIcon.textContent = won? '◆' : '✕';
  rElim.textContent = String(player.eliminations);
  rAlive.textContent = String(enemies.filter(e=>e.alive).length);
  rTime.textContent = `${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
  rDetail.textContent = `Zone final radius ${Math.round(zone.r)} • ${player.pickups} pickups • ${player.hp>0? Math.round(player.hp)+' HP remaining':'no HP remaining'} • Tap REDEPLOY to drop again.`;
}

function render(dt){
  // clear
  ctx.fillStyle='#0c1112';
  ctx.fillRect(0,0,innerWidth,innerHeight);

  ctx.save();
  // apply camera + shake
  let sx = Math.round(cam.x - innerWidth/2);
  let sy = Math.round(cam.y - innerHeight/2);
  const totalShake = cam.shake + dmgShake;
  if(totalShake>0){
    sx += (Math.random()-0.5)*totalShake;
    sy += (Math.random()-0.5)*totalShake;
  }
  if(camKick>0){
    const kickAng = player.angle;
    sx -= Math.cos(kickAng)*camKick;
    sy -= Math.sin(kickAng)*camKick;
  }
  ctx.translate(-sx, -sy);

  // ground
  ctx.fillStyle='#121a1c';
  ctx.fillRect(0,0,MAP_W,MAP_H);
  // grid
  ctx.strokeStyle='rgba(255,255,255,0.025)';
  ctx.lineWidth=1;
  for(let x=0;x<MAP_W;x+=120){
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,MAP_H); ctx.stroke();
  }
  for(let y=0;y<MAP_H;y+=120){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(MAP_W,y); ctx.stroke();
  }
  // zone visuals — PUBG-like electric wall (critic fix)
  ctx.save();
  // outside: much more readable pressure + desaturation
  ctx.fillStyle='rgba(60,90,255,0.16)';
  ctx.beginPath();
  ctx.rect(0,0,MAP_W,MAP_H);
  ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2, true);
  ctx.fill('evenodd');
  // heavy outside dark overlay for dread late-game
  if(phaseIdx>=2){
    ctx.fillStyle=`rgba(6,10,18,${0.14 + phaseIdx*0.04})`;
    ctx.beginPath(); ctx.rect(0,0,MAP_W,MAP_H); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2, true); ctx.fill('evenodd');
  }
  // inner safe tint
  ctx.fillStyle='rgba(110,160,255,0.07)';
  ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2); ctx.fill();
  // electric wall: outer glow + inner core + moving dash
  // outer glow
  ctx.strokeStyle='rgba(80,130,255,0.32)';
  ctx.lineWidth=12;
  ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2); ctx.stroke();
  // inner bright core
  ctx.strokeStyle='rgba(140,185,255,1)';
  ctx.lineWidth=2.6;
  ctx.setLineDash([16,14]);
  ctx.lineDashOffset = (-time*70)%30;
  ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2); ctx.stroke();
  // white highlight dash
  ctx.strokeStyle='rgba(255,255,255,0.75)';
  ctx.lineWidth=1.2;
  ctx.setLineDash([4,18]);
  ctx.lineDashOffset = (-time*110)%22;
  ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  // electric particles sliding along circumference (cheap but readable)
  const eCount = phaseIdx>=3 ? 28 : 18;
  for(let i=0;i<eCount;i++){
    const ang = (i/eCount)*Math.PI*2 + time*0.9 + (i%2?0.2:-0.2);
    const x = zone.x + Math.cos(ang)*zone.r;
    const y = zone.y + Math.sin(ang)*zone.r;
    // cull far outside view
    if(x < sx-60 || x > sx+innerWidth+60 || y < sy-60 || y > sy+innerHeight+60) continue;
    const flick = 0.55 + Math.sin(time*9 + i*1.3)*0.35;
    ctx.fillStyle=`rgba(180,210,255,${0.85*flick})`;
    ctx.shadowColor='rgba(110,160,255,0.9)'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(x,y, 2.4 + flick*1.2,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(x,y, 0.9,0,Math.PI*2); ctx.fill();
  }
  // inner safe ring hint when shrinking
  if(phaseIdx>=2){
    ctx.strokeStyle='rgba(255,255,255,0.28)';
    ctx.lineWidth=1.2;
    ctx.setLineDash([6,10]);
    ctx.lineDashOffset = (time*30)%16;
    ctx.beginPath(); ctx.arc(zone.x, zone.y, Math.max(0, zone.r-20), 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // decals (bullet marks)
  decals.forEach(d=>{
    const a = 1 - d.t/d.life;
    ctx.fillStyle=`rgba(50,60,62,${a*0.5})`;
    ctx.beginPath(); ctx.arc(d.x,d.y, d.r,0,Math.PI*2); ctx.fill();
  });

  // obstacles
  obstacles.forEach(o=>{
    if(o.x+o.w < sx-200 || o.x > sx+innerWidth+200 || o.y+o.h < sy-200 || o.y > sy+innerHeight+200) return;
    if(o.type==='wall'){
      ctx.fillStyle='#1e2f33';
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle='#253a3f';
      ctx.fillRect(o.x,o.y,o.w,6);
      ctx.strokeStyle='#0a1517';
      ctx.lineWidth=1.5; ctx.strokeRect(o.x,o.y,o.w,o.h);
    } else if(o.type==='rock'){
      ctx.fillStyle='#2a3537';
      ctx.beginPath();
      ctx.roundRect(o.x,o.y,o.w,o.h, 8);
      ctx.fill();
      ctx.fillStyle='#34474a';
      ctx.beginPath(); ctx.ellipse(o.x+o.w*0.35,o.y+o.h*0.35, o.w*0.22, o.h*0.22, 0,0,Math.PI*2); ctx.fill();
    } else {
      // building
      ctx.fillStyle='#1a2a2e';
      ctx.fillRect(o.x,o.y,o.w,o.h);
      ctx.fillStyle='#22383c';
      ctx.fillRect(o.x+6,o.y+6,o.w-12,o.h-12);
      ctx.fillStyle='#0f1a1c';
      // windows
      ctx.fillStyle='#0a1315';
      for(let wx=o.x+14; wx<o.x+o.w-14; wx+=28){
        for(let wy=o.y+18; wy<o.y+o.h-14; wy+=22){
          if(Math.random()<0.9) {} // keep deterministic look: use pattern
          ctx.fillRect(wx,wy,14,10);
          ctx.fillStyle='rgba(110,160,255,0.08)';
          ctx.fillRect(wx,wy,14,6);
          ctx.fillStyle='#0a1315';
        }
      }
      ctx.strokeStyle='#0e1e21';
      ctx.lineWidth=2; ctx.strokeRect(o.x,o.y,o.w,o.h);
      // roof detail
      ctx.fillStyle='rgba(255,255,255,0.04)';
      ctx.fillRect(o.x,o.y,o.w,8);
    }
  });

  // pickups
  pickups.forEach(p=>{
    if(p.taken) return;
    if(p.x < sx-80 || p.x > sx+innerWidth+80 || p.y < sy-80 || p.y > sy+innerHeight+80) return;
    const bob = Math.sin(p.pulse)*4;
    const y = p.y + bob;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y+18, 18, 8, 0,0,Math.PI*2); ctx.fill();
    // crate
    let col = p.type==='health'?'#ff6b30' : p.type==='ammo'?'#4affc8' : '#6ea8ff';
    ctx.fillStyle='#0f1a1c';
    ctx.strokeStyle=col;
    ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.roundRect(p.x-18, y-14, 36, 28, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle=col;
    ctx.font='700 14px JetBrains Mono';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.type==='health'?'+': p.type==='ammo'?'◉':'◆', p.x, y+1);
    // pulse ring
    const pr = 6 + (Math.sin(p.pulse*1.7)+1)*4;
    ctx.strokeStyle=`rgba(${p.type==='health'?'255,107,48': p.type==='ammo'?'74,255,200':'110,168,255'},${0.35 + Math.sin(p.pulse)*0.15})`;
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(p.x, y, 26+pr, 0, Math.PI*2); ctx.stroke();
    // label
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.font='700 9px JetBrains Mono';
    ctx.fillText(p.type.toUpperCase(), p.x, y+22);
  });

  // enemies
  enemies.forEach(e=>{
    if(!e.alive) return;
    if(e.x < sx-100 || e.x > sx+innerWidth+100 || e.y < sy-100 || e.y > sy+innerHeight+100) {
      // still need offscreen indicator handled in minimap, not main
    }
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y+10, 16, 7,0,0,Math.PI*2); ctx.fill();
    // body
    ctx.fillStyle='#c0392b';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#922b21';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r-4,0,Math.PI*2); ctx.fill();
    // direction
    ctx.strokeStyle='rgba(255,255,255,0.95)';
    ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x+Math.cos(e.angle)*18, e.y+Math.sin(e.angle)*18); ctx.stroke();
    // health
    const hpPct = clamp(e.hp/e.maxHp,0,1);
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(e.x-18, e.y-24, 36, 5);
    ctx.fillStyle= hpPct<0.3?'#ff3b30':'#ffcc55';
    ctx.fillRect(e.x-18, e.y-24, 36*hpPct,5);
    // hostility dot
    ctx.fillStyle='#ff3b30';
    ctx.beginPath(); ctx.arc(e.x, e.y-18, 3,0,Math.PI*2); ctx.fill();
  });

  // player — PUBG clean silhouette + directional cue
  {
    const p=player;
    // shadow
    ctx.fillStyle='rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y+12, 18,8,0,0,Math.PI*2); ctx.fill();
    // outer ring (team color)
    const isLow = p.hp<30;
    ctx.strokeStyle = isLow ? 'rgba(255,59,48,0.9)' : 'rgba(226,255,63,0.92)';
    ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.arc(p.x,p.y, p.r+2,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle= isLow ? '#ff3b30' : '#e2ff3f';
    ctx.beginPath(); ctx.arc(p.x,p.y, p.r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#0c1112';
    ctx.beginPath(); ctx.arc(p.x,p.y, p.r-5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle= isLow ? '#ff6b30' : '#eaff6b';
    ctx.beginPath(); ctx.arc(p.x,p.y, 6.5,0,Math.PI*2); ctx.fill();
    // barrel — slimmer, longer, like PUBG AR
    ctx.strokeStyle= isLow ? 'rgba(255,59,48,0.96)' : 'rgba(226,255,63,0.98)';
    ctx.lineWidth=2.8;
    ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x+Math.cos(p.angle)*30, p.y+Math.sin(p.angle)*30); ctx.stroke();
    ctx.lineCap='butt';
    // muzzle device dot
    ctx.fillStyle= '#0c1112';
    ctx.beginPath(); ctx.arc(p.x+Math.cos(p.angle)*30, p.y+Math.sin(p.angle)*30, 2.2,0,Math.PI*2); ctx.fill();
    // inner dot
    ctx.fillStyle='#0c1112';
    ctx.beginPath(); ctx.arc(p.x,p.y,2.6,0,Math.PI*2); ctx.fill();
    // low HP pulse ring
    if(p.hp<45){
      const pr = 0.5 + Math.sin(time*6)*0.35;
      ctx.strokeStyle=`rgba(255,59,48,${pr})`;
      ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.arc(p.x,p.y, p.r+8+Math.sin(time*7)*2,0,Math.PI*2); ctx.stroke();
    }
    // reload/progress ring hint (when reloading)
    if(p.reloading){
      const prog = clamp(p.reloadT/WEAPON.reloadSec,0,1);
      ctx.strokeStyle='rgba(226,255,63,0.85)';
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(p.x,p.y, p.r+10, -Math.PI/2, -Math.PI/2 + Math.PI*2*prog); ctx.stroke();
    }
  }

  // muzzle flashes — short starburst like PUBG
  muzzleFlashes.forEach(m=>{
    const a = 1 - m.t/m.life;
    const len = 18*a + 6;
    const cx=m.x, cy=m.y, ang=m.a;
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(ang);
    ctx.globalAlpha = a;
    // core
    ctx.fillStyle='#fff9c0';
    ctx.beginPath(); ctx.arc(0,0, 5*a+2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(0,0, 2.2,0,Math.PI*2); ctx.fill();
    // cross flare
    ctx.strokeStyle='rgba(255,233,120,0.9)';
    ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(-len,0); ctx.lineTo(len,0); ctx.moveTo(0,-6); ctx.lineTo(0,6); ctx.stroke();
    // glow halo
    ctx.fillStyle=`rgba(255,220,80,${0.18*a})`;
    ctx.beginPath(); ctx.arc(0,0, 18*a+4,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // casings — tiny brass tumble
  casings.forEach(c=>{
    const a = 1 - c.life/c.maxLife;
    ctx.save();
    ctx.translate(c.x,c.y); ctx.rotate(c.rot);
    ctx.globalAlpha = clamp(a*0.9+0.1,0,1);
    ctx.fillStyle='#d4b45a';
    ctx.fillRect(-3, -1.6, 6, 3.2);
    ctx.fillStyle='#ffe9a0';
    ctx.fillRect(2, -1.1, 1.6, 2.2);
    ctx.restore();
  });

  // bullets + PUBG tracers — bright streak + bloom
  bullets.forEach(b=>{
    // stretched tracer
    const trailLen = Math.min(b.trail.length, 5);
    if(trailLen>1){
      const head = b;
      const tail = b.trail[Math.max(0, b.trail.length - trailLen)];
      // outer bloom
      ctx.strokeStyle= b.owner==='player'?'rgba(226,255,63,0.16)':'rgba(255,107,48,0.14)';
      ctx.lineWidth=8;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      // core streak
      ctx.strokeStyle= b.owner==='player'?'rgba(255,252,180,0.96)':'rgba(255,180,120,0.96)';
      ctx.lineWidth=2.3;
      ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y); ctx.stroke();
      // inner white hot
      ctx.strokeStyle='rgba(255,255,255,0.92)';
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(head.x - Math.cos(b.angle)*6, head.y - Math.sin(b.angle)*6); ctx.lineTo(head.x, head.y); ctx.stroke();
      ctx.lineCap='butt';
    } else {
      ctx.fillStyle= b.owner==='player'?'#fffbe0':'#ff8a4a';
      ctx.beginPath(); ctx.arc(b.x,b.y, 3.4,0,Math.PI*2); ctx.fill();
    }
    // head dot
    ctx.fillStyle= b.owner==='player'?'#fffef2':'#fff2e0';
    ctx.shadowColor= b.owner==='player'?'rgba(226,255,63,0.9)':'rgba(255,107,48,0.9)';
    ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(b.x,b.y, 2.2,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,1)';
    ctx.beginPath(); ctx.arc(b.x,b.y, 0.9,0,Math.PI*2); ctx.fill();
  });

  // particles — soft bloom
  particles.forEach(p=>{
    ctx.globalAlpha = clamp(p.alpha,0,1);
    ctx.fillStyle=p.color;
    ctx.shadowColor=p.color; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.arc(p.x,p.y, p.size,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
  });
  ctx.globalAlpha=1;

  // floating damage numbers — PUBG hit feedback
  floatTexts.forEach(f=>{
    const a = clamp(f.alpha,0,1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(f.x, f.y);
    ctx.font = f.crit ? '700 15px JetBrains Mono' : '700 13px JetBrains Mono';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    // bg pill
    const tw = ctx.measureText(f.text).width;
    ctx.fillStyle = f.crit ? `rgba(255,59,48,${0.92*a})` : `rgba(0,0,0,${0.58*a})`;
    ctx.beginPath(); 
    // @ts-ignore roundRect compat
    if(ctx.roundRect) ctx.roundRect(-tw/2-7, -10, tw+14, 18, 9); else { ctx.rect(-tw/2-7,-10,tw+14,18); }
    ctx.fill();
    ctx.strokeStyle = f.crit ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(f.text, 0, 0);
    ctx.restore();
  });

  // arena border
  ctx.strokeStyle='rgba(255,255,255,0.06)';
  ctx.lineWidth=2;
  ctx.strokeRect(1,1,MAP_W-2,MAP_H-2);

  ctx.restore();

  // minimap
  renderMinimap();
}

function renderMinimap(){
  const s = 140;
  const scale = s / MAP_W; // map fits
  mctx.clearRect(0,0,s,s);
  // bg
  mctx.fillStyle='#0e1a1c';
  mctx.fillRect(0,0,s,s);
  // zone
  mctx.fillStyle='rgba(110,160,255,0.12)';
  mctx.beginPath(); mctx.arc(zone.x*scale, zone.y*scale, zone.r*scale,0,Math.PI*2); mctx.fill();
  mctx.strokeStyle='rgba(110,160,255,0.9)';
  mctx.lineWidth=1.2;
  mctx.beginPath(); mctx.arc(zone.x*scale, zone.y*scale, zone.r*scale,0,Math.PI*2); mctx.stroke();
  // obstacles faint
  mctx.fillStyle='rgba(255,255,255,0.18)';
  obstacles.forEach(o=>{
    if(o.type==='rock') return;
    mctx.fillRect(o.x*scale, o.y*scale, o.w*scale, o.h*scale);
  });
  // pickups
  pickups.forEach(p=>{
    if(p.taken) return;
    mctx.fillStyle= p.type==='health'?'#ff6b30': p.type==='ammo'?'#4affc8':'#6ea8ff';
    mctx.beginPath(); mctx.arc(p.x*scale, p.y*scale, 2.2,0,Math.PI*2); mctx.fill();
  });
  // enemies
  enemies.forEach(e=>{
    if(!e.alive) return;
    mctx.fillStyle='#ff3b30';
    mctx.beginPath(); mctx.arc(e.x*scale, e.y*scale, 2.6,0,Math.PI*2); mctx.fill();
  });
  // player
  mctx.fillStyle='#e2ff3f';
  mctx.beginPath(); mctx.arc(player.x*scale, player.y*scale, 3.2,0,Math.PI*2); mctx.fill();
  mctx.strokeStyle='#0c1112';
  mctx.lineWidth=1;
  mctx.stroke();
  // view rect
  const vx = (cam.x - innerWidth/2)*scale;
  const vy = (cam.y - innerHeight/2)*scale;
  const vw = innerWidth*scale;
  const vh = innerHeight*scale;
  mctx.strokeStyle='rgba(255,255,255,0.7)';
  mctx.lineWidth=1;
  mctx.strokeRect(vx,vy,vw,vh);
  // border
  mctx.strokeStyle='rgba(255,255,255,0.14)';
  mctx.lineWidth=1;
  mctx.strokeRect(0.5,0.5,s-1,s-1);
}

// expose for tests — keep live refs after reset
export { player, enemies, pickups, zone, phases, MAP_W, MAP_H, resetGame, showToast };
if(typeof window!=='undefined'){
  window.__GAME__={
    get player(){ return player; }, set player(v){ player=v; },
    get enemies(){ return enemies; }, set enemies(v){ enemies=v; },
    get pickups(){ return pickups; },
    get zone(){ return zone; },
    get bullets(){ return bullets; },
    resetGame, getState:()=>state, getTime:()=>time,
    get phaseIdx(){ return phaseIdx; }
  };
  // also keep old direct props for compat
  window.__GAME__.player = player;
}

// initial render
render(0);

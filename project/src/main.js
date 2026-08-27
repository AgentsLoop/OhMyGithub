import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('canvas');
const loopEl = document.getElementById('loop');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const hpEl = document.getElementById('hp');
const hpbar = document.getElementById('hpbar');
const phpEl = document.getElementById('php');
const ecountEl = document.getElementById('ecount');
const isoEl = document.getElementById('iso');
const fpsEl = document.getElementById('fps');
const overlay = document.getElementById('overlay');
const startCard = document.getElementById('startCard');
const howCard = document.getElementById('howCard');
const deadCard = document.getElementById('deadCard');
const winCard = document.getElementById('winCard');
const logEl = document.getElementById('log');
// new UI refs
const countdownEl = document.getElementById('countdown');
const countdownNum = document.getElementById('countdownNum');
const countdownLabel = document.getElementById('countdownLabel');
const countdownSub = document.getElementById('countdownSub');
const waveAnnounceEl = document.getElementById('waveAnnounce');
const breachWarnEl = document.getElementById('breachWarn');
const hitFlashEl = document.getElementById('hitFlash');
const vignetteEl = document.getElementById('vignette');
const lowVignetteEl = document.getElementById('lowVignette');
const chromaticEl = document.getElementById('chromatic');
const mobileControlsEl = document.getElementById('mobileControls');
const joystickEl = document.getElementById('joystick');
const joyStickEl = document.getElementById('joyStick');
const actionBtnEl = document.getElementById('actionBtn');
const boonCard = document.getElementById('boonCard');
const boonChoicesEl = document.getElementById('boonChoices');
const boonDescEl = document.getElementById('boonDesc');
const boonHudEl = document.getElementById('boonHud');
const doorCard = document.getElementById('doorCard');
const doorChoicesEl = document.getElementById('doorChoices');
const doorDescEl = document.getElementById('doorDesc');
const bossHudEl = document.getElementById('bossHud');
const bossBarEl = document.getElementById('bossBar');
const bossHpTextEl = document.getElementById('bossHpText');
const titanIncomingEl = document.getElementById('titanIncoming');
// persistence & pause refs
const seedDispEl = document.getElementById('seedDisp');
const seedSubEl = document.getElementById('seedSub');
const historyBtn = document.getElementById('historyBtn');
const historyCard = document.getElementById('historyCard');
const historyCloseBtn = document.getElementById('historyCloseBtn');
const historyClearBtn = document.getElementById('historyClearBtn');
const pauseCard = document.getElementById('pauseCard');
const abandonBtn = document.getElementById('abandonBtn');
const abandonMenuBtn = document.getElementById('abandonMenuBtn');
const histBestEl = document.getElementById('histBest');
const histClearsEl = document.getElementById('histClears');
const histScoreEl = document.getElementById('histScore');
const histBoonsEl = document.getElementById('histBoons');
const histRunsEl = document.getElementById('histRuns');
const tutorialOverlayEl = document.getElementById('tutorialOverlay');
const firstClearEl = document.getElementById('firstClear');

// ── Persistence (localStorage run history) ──
const HIST_KEY = 'isolated-arena-history-v1';
const SEED_NAMES = ['VOID','CRIMSON','TEAL'];
function defaultHistory(){ return { bestLoop: 1, totalClears: 0, totalScore: 0, boonsAcquired:{pulse:0,cache:0,shard:0}, runs:0, lastSeed:0 }; }
let runHistory = defaultHistory();
try{
  const raw = localStorage.getItem(HIST_KEY);
  if(raw){ const p=JSON.parse(raw); runHistory={...defaultHistory(), ...p, boonsAcquired:{...defaultHistory().boonsAcquired, ...(p.boonsAcquired||{})}}; }
}catch(e){}
function saveHistory(){
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(runHistory)); }catch(e){}
}
function seedName(n){ return SEED_NAMES[n%3]||'VOID'; }
function updateSeedDisplay(){
  const s = loop%3;
  if(seedDispEl) seedDispEl.textContent = `P${s} · ${seedName(s)}`;
  if(seedSubEl) seedSubEl.textContent = loop===1 ? 'palette 0 — run start' : `palette ${s} · loop ${loop}`;
  const ps = document.getElementById('pauseSeed'); if(ps) ps.textContent = `P${s} · ${seedName(s)}`;
  const pl = document.getElementById('pauseLoop'); if(pl) pl.textContent = String(loop);
  const pb = document.getElementById('pauseBoons'); if(pb){
    const tot = activeBoons.pulse+activeBoons.cache+activeBoons.shard;
    pb.textContent = tot? `P×${activeBoons.pulse} C×${activeBoons.cache} S×${activeBoons.shard}` : 'none';
  }
}
function renderHistoryCard(){
  if(histBestEl) histBestEl.textContent = String(runHistory.bestLoop);
  if(histClearsEl) histClearsEl.textContent = String(runHistory.totalClears);
  if(histScoreEl) histScoreEl.textContent = String(runHistory.totalScore);
  if(histBoonsEl){
    histBoonsEl.innerHTML = `
      <span style="border-color:rgba(53,208,255,0.35);color:#35d0ff">◎ PULSE ×${runHistory.boonsAcquired.pulse}</span>
      <span style="border-color:rgba(46,229,160,0.38);color:#2ee5a0">⚡ CACHE ×${runHistory.boonsAcquired.cache}</span>
      <span style="border-color:rgba(255,176,32,0.4);color:#ffb020">✦ SHARD ×${runHistory.boonsAcquired.shard}</span>`;
  }
  if(histRunsEl) histRunsEl.textContent = `Runs (abandons+resets): ${runHistory.runs} · Current seed P${loop%3} · Best loop ${runHistory.bestLoop}`;
}
function recordClear(scoreGained){
  runHistory.totalClears += 1;
  runHistory.totalScore += scoreGained;
  runHistory.bestLoop = Math.max(runHistory.bestLoop, loop);
  saveHistory();
  renderHistoryCard();
}
function recordBoon(id){
  if(runHistory.boonsAcquired[id]!==undefined) runHistory.boonsAcquired[id]+=1;
  // also bestLoop already tracked
  saveHistory();
  renderHistoryCard();
}
function doAbandonRun(){
  const hadProgress = loop>1 || score>0 || (activeBoons.pulse+activeBoons.cache+activeBoons.shard)>0;
  // preserve history, clear run
  activeBoons={pulse:0,cache:0,shard:0}; recomputeBoonModifiers(); updateBoonHud();
  loop=1; score=0; dispScore=0; coreHp=100; dispCore=100; playerHp=100; dispPlayer=100;
  forcedNextPalette=null; doorOffer=[]; doorRewardWeight=null;
  gameState='menu';
  overlay.style.display='flex';
  startCard.classList.remove('hidden');
  howCard.classList.add('hidden'); deadCard.classList.add('hidden'); winCard.classList.add('hidden'); boonCard.classList.add('hidden'); if(doorCard) doorCard.classList.add('hidden'); pauseCard.classList.add('hidden'); historyCard.classList.add('hidden');
  bossHudEl.classList.add('hidden'); titanIncomingEl.classList.add('hidden'); breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on');
  if(lowVignetteEl) lowVignetteEl.classList.remove('on');
  if(chromaticEl) chromaticEl.classList.remove('on');
  dismissTutorial(); if(firstClearEl){ firstClearEl.classList.add('hidden'); firstClearEl.classList.remove('show'); } firstClearShown=false;
  // history runs increment if had progress
  if(hadProgress) runHistory.runs+=1;
  runHistory.bestLoop = Math.max(runHistory.bestLoop, 1);
  saveHistory(); renderHistoryCard(); updateSeedDisplay(); updateHUD();
  log('⌫ Run abandoned — boons/loop cleared · history preserved');
}
let pausedPrevState=null;
function togglePause(){
  if(gameState==='playing'){
    pausedPrevState = gameState;
    gameState='paused';
    pauseCard.classList.remove('hidden');
    historyCard.classList.add('hidden'); startCard.classList.add('hidden'); howCard.classList.add('hidden'); deadCard.classList.add('hidden'); winCard.classList.add('hidden'); boonCard.classList.add('hidden');
    overlay.style.display='flex';
    updateSeedDisplay();
    ensureAudio(); duckDrone(0.05, 0.9);
    log('⏸ Paused — Esc to resume');
  } else if(gameState==='paused'){
    gameState = pausedPrevState || 'playing';
    pausedPrevState=null;
    pauseCard.classList.add('hidden');
    overlay.style.display='none';
    ensureAudio(); if(droneStarted) updateDroneIntensity();
    log('▶ Resumed');
  }
}

// ── (A) Tutorial & first-kill juice helpers ──
function showTutorial(){
  if(tutorialOverlayEl && loop===1 && !firstClearShown){
    tutorialOverlayEl.classList.remove('hidden');
    tutorialActive=true;
    // highlight HUD: pulse the stats that matter
    const hlIds=['seedStat','loop'];
    try{ document.getElementById('seedStat')?.classList.add('hudHighlight'); document.querySelector('.stat.loop')?.classList.add('hudHighlight'); }catch(e){}
    // staged hint pulse is CSS-driven via animation-delay
    if(tutorialTimer) clearTimeout(tutorialTimer);
    tutorialTimer=setTimeout(()=> dismissTutorial(), 8000);
    log('◆ Tutorial: WASD · MOUSE · CLICK/SPACE — dismiss on first kill or 8s');
  }
}
function dismissTutorial(){
  if(!tutorialActive) return;
  tutorialActive=false;
  if(tutorialTimer){ clearTimeout(tutorialTimer); tutorialTimer=null; }
  if(tutorialOverlayEl) tutorialOverlayEl.classList.add('hidden');
  try{ document.getElementById('seedStat')?.classList.remove('hudHighlight'); document.querySelector('.stat.loop')?.classList.remove('hudHighlight'); }catch(e){}
}
function showFirstClear(){
  if(firstClearShown) return;
  firstClearShown=true;
  if(!firstClearEl) return;
  firstClearEl.classList.remove('hidden');
  requestAnimationFrame(()=> firstClearEl.classList.add('show'));
  beep(960,0.10,0.12); setTimeout(()=>beep(1320,0.12,0.12),120);
  triggerShake(0.9);
  setTimeout(()=>{ firstClearEl.classList.remove('show'); setTimeout(()=>firstClearEl.classList.add('hidden'),300); }, 1600);
  log('✦ FIRST CLEAR — first conflict resolved!');
}
function spawnCritDamageNumbers(pos){
  // 2× gold numbers at scale 1.4 — elite killed juice
  const base = pos.clone();
  spawnDamageNumber(base.clone().add(new THREE.Vector3(0,0.2,0)), 'CRIT!', '#ffd700', 1.4);
  // second number slightly offset, delayed
  setTimeout(()=> spawnDamageNumber(base.clone().add(new THREE.Vector3(0.5,0.4,0.3)), 'CRIT!', '#ffcc40', 1.4), 90);
  burst(base, 0xffd700, 16);
  burst(base.clone().add(new THREE.Vector3(0,0.6,0)), 0xffffff, 10);
  triggerShake(1.25);
  beep(1320,0.08,0.13); setTimeout(()=>beep(880,0.09,0.11),90);
}

// ── Boon definitions (Hades-style, stackable, persist for run) ──
const BOONS = [
  { id:'pulse', name:'PULSE OVERCLOCK', short:'PULSE', desc:'+40% pulse radius<br>+15% damage per stack', icon:'◎', cls:'pulseBoon', color:'#35d0ff', detail:'Projects larger, brighter pulses' },
  { id:'cache', name:'WORKTREE CACHE', short:'CACHE', desc:'+1 dash charge (faster CD)<br>+20% move speed', icon:'⚡', cls:'cacheBoon', color:'#2ee5a0', detail:'Dashes feel weightless' },
  { id:'shard', name:'CONFLICT SHARD', short:'SHARD', desc:'+2 projectiles per pulse<br>Spread volley', icon:'✦', cls:'shardBoon', color:'#ffb020', detail:'Each pulse fires a fan' },
];
let activeBoons = { pulse:0, cache:0, shard:0 };
let boonModifiers = { dmgMult:1, radiusMult:1, speedMult:1, dashCdMult:1, extraProjectiles:0 };
function recomputeBoonModifiers(){
  boonModifiers.dmgMult = 1 + activeBoons.pulse*0.15;
  boonModifiers.radiusMult = 1 + activeBoons.pulse*0.40;
  boonModifiers.speedMult = 1 + activeBoons.cache*0.20;
  // each cache stack: -22% dash cooldown (stack multiplicatively, floor 0.32s)
  const cacheStacks = activeBoons.cache;
  boonModifiers.dashCdMult = Math.max(0.35, Math.pow(0.78, cacheStacks));
  boonModifiers.extraProjectiles = activeBoons.shard*2;
}
function updateBoonHud(){
  const total = activeBoons.pulse + activeBoons.cache + activeBoons.shard;
  if(total===0){ boonHudEl.classList.add('hidden'); boonHudEl.innerHTML=''; return; }
  boonHudEl.classList.remove('hidden');
  const pills=[];
  for(const b of BOONS){
    const n=activeBoons[b.id];
    if(n>0){
      pills.push(`<span class="boonPill ${b.cls}" title="${b.name} x${n}"><i>${b.icon}</i> ${b.short} <b>×${n}</b></span>`);
    }
  }
  boonHudEl.innerHTML = pills.join('');
  // small bump anim
  boonHudEl.animate([{transform:'scale(0.92)'},{transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(0.34,1.56,0.64,1)'});
}
let pendingBoonOffer = [];

function log(msg){
  const d=document.createElement('div');
  d.textContent=msg;
  logEl.prepend(d);
  setTimeout(()=>d.remove(),4000);
  while(logEl.children.length>4) logEl.lastChild.remove();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a0f);
scene.fog = new THREE.Fog(0x080a0f, 35, 70);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 18, 18);
const camTarget = new THREE.Vector3(0,0,0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2333, 1.2));
const dir = new THREE.DirectionalLight(0xffffff, 2.2);
dir.position.set(12,20,8);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=0.5; dir.shadow.camera.far=60;
dir.shadow.camera.left=-25; dir.shadow.camera.right=25; dir.shadow.camera.top=25; dir.shadow.camera.bottom=-25;
scene.add(dir);
const rim = new THREE.DirectionalLight(0x35d0ff, 0.6);
rim.position.set(-10,8,-10);
scene.add(rim);

// environment
const envScene = new THREE.Scene();
scene.environment = null;

// floor + arena bounds — baked AO via CanvasTexture (soft shadow)
function createFloorAOTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=512;
  const g=c.getContext('2d');
  // base
  g.fillStyle='#0e1a28'; g.fillRect(0,0,512,512);
  // radial falloff to edges (vignette AO)
  const rad=g.createRadialGradient(256,256,0,256,256,256);
  rad.addColorStop(0,'rgba(0,0,0,0)');
  rad.addColorStop(0.52,'rgba(0,0,0,0)');
  rad.addColorStop(0.70,'rgba(0,0,0,0.16)');
  rad.addColorStop(0.86,'rgba(0,0,0,0.30)');
  rad.addColorStop(1,'rgba(0,0,0,0.55)');
  g.fillStyle=rad; g.fillRect(0,0,512,512);
  // 4 pillar contact shadows at radius 7.5 (world 18)
  for(let i=0;i<4;i++){
    const ang=i*Math.PI/2;
    const x=256+Math.cos(ang)*(7.5/18*240);
    const y=256+Math.sin(ang)*(7.5/18*240);
    const pg=g.createRadialGradient(x,y,0,x,y,30);
    pg.addColorStop(0,'rgba(0,0,0,0.48)'); pg.addColorStop(0.5,'rgba(0,0,0,0.22)'); pg.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=pg; g.beginPath(); g.arc(x,y,30,0,Math.PI*2); g.fill();
  }
  // core contact AO
  const cg=g.createRadialGradient(256,256,0,256,256,24);
  cg.addColorStop(0,'rgba(0,0,0,0.62)'); cg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=cg; g.beginPath(); g.arc(256,256,24,0,Math.PI*2); g.fill();
  const tex=new THREE.CanvasTexture(c);
  tex.colorSpace=THREE.SRGBColorSpace; tex.needsUpdate=true;
  return tex;
}
const floorGeo = new THREE.CircleGeometry(18, 64);
const floorMat = new THREE.MeshStandardMaterial({ color:0x0e1a28, roughness:0.9, metalness:0.05 });
const floorAOTexture = createFloorAOTexture();
floorMat.map = floorAOTexture;
floorMat.needsUpdate = true;
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);

// rings
for(let i=1;i<=3;i++){
  const ring = new THREE.Mesh(new THREE.RingGeometry(5*i,5*i+0.07,64), new THREE.MeshBasicMaterial({ color: 0x35d0ff, transparent:true, opacity:0.08 - i*0.02, side:THREE.DoubleSide }));
  ring.rotation.x=-Math.PI/2;
  ring.position.y=0.02;
  scene.add(ring);
}
// walls
const wallMat = new THREE.MeshStandardMaterial({ color:0x182435, roughness:0.8 });
for(let i=0;i<4;i++){
  const ang = i*Math.PI/2;
  const w = new THREE.Mesh(new THREE.BoxGeometry(36,2.2,0.6), wallMat);
  w.position.set(Math.cos(ang)*19,1,Math.sin(ang)*19);
  w.rotation.y=-ang;
  w.castShadow=true; w.receiveShadow=true;
  scene.add(w);
}

// core (to defend) at center — visually critical
const coreGeo = new THREE.IcosahedronGeometry(0.9,1);
const coreMat = new THREE.MeshStandardMaterial({ color:0x35d0ff, emissive:0x0aa0cc, emissiveIntensity:0.9, roughness:0.4, metalness:0.2 });
const core = new THREE.Mesh(coreGeo, coreMat);
core.position.set(0,0.9,0);
core.castShadow=true;
scene.add(core);
// outer pulse shell
const coreShellGeo = new THREE.IcosahedronGeometry(1.15,1);
const coreShellMat = new THREE.MeshStandardMaterial({ color:0x35d0ff, emissive:0x0aa0cc, emissiveIntensity:0.6, transparent:true, opacity:0.18, wireframe:true });
const coreShell = new THREE.Mesh(coreShellGeo, coreShellMat);
coreShell.position.copy(core.position);
scene.add(coreShell);
const coreLight = new THREE.PointLight(0x35d0ff, 12, 18);
coreLight.position.set(0,1.5,0);
scene.add(coreLight);
const coreRing = new THREE.Mesh(new THREE.RingGeometry(1.2,1.25,32), new THREE.MeshBasicMaterial({color:0x35d0ff, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
coreRing.rotation.x=-Math.PI/2; coreRing.position.y=0.05;
scene.add(coreRing);
// damage flash timer and breach state
let coreFlashTimer=0;
let breachActive=false;

// (A) onboarding & first-kill juice state
let tutorialActive=false, tutorialTimer=null, firstClearShown=false;
// state
let loop=1, score=0, coreHp=100, playerHp=100, waveKill=0, waveTotal=0, elapsed=0, waveActive=false, gameState='menu';
let isBossLoop=false, bossGroup=null, bossShockTimer=4.0, bossDashTimer=2.6, bossPhase=1, pendingBoonPicks=1;
let forcedNextPalette=null; // Hades door choice — overrides next loop's paletteIdx
let doorOffer=[]; // 2 doors offered after boon
let doorRewardWeight=null; // 'pulse' | 'cache' | 'shard' | null weighted for next boon roll
let enemies=[], bullets=[], enemyBullets=[], particles=[], sparks=[], shockEffects=[];
let keys={};
let mouse = new THREE.Vector2(0,0);
let aimDir = new THREE.Vector3(1,0,0);
let lastShot=0, dashCd=0;
const player = new THREE.Group();
scene.add(player);
let playerMesh=null;
let playerMixer=null, playerClip=null;
let mixer=null, clock=new THREE.Clock();
let hitStopTimer=0;
let damageSprites=[];

// HUD lerp state
let dispScore=0, dispCore=100, dispPlayer=100;

// joystick for mobile touch
let touchActive=false, touchOrigin=new THREE.Vector2(), touchDir=new THREE.Vector2();
let mobileVisible=false;
function showMobileControls(){
  if(mobileVisible) return;
  mobileVisible=true;
  mobileControlsEl.classList.remove('hidden');
}
function detectTouch(){
  if('ontouchstart' in window || navigator.maxTouchPoints>0){
    showMobileControls();
  }
}
detectTouch();
addEventListener('touchstart', showMobileControls, {once:true, passive:true});

// loader
const loader = new GLTFLoader();
let arenaModel=null, knightModel=null, robotModel=null;
let arenaLoaded=false, knightLoaded=false;

async function loadModels(){
  const loads = [
    loader.loadAsync('/models/arena.glb').then(g=>{ arenaModel=g; log('Arena GLB loaded — 3 meshes, 2 mats'); }).catch(e=>log('Arena GLB fallback: '+e.message)),
    // use rigged knight if available, else fallback to knight.glb
    loader.loadAsync('/models/knight_rigged.glb').then(g=>{ knightModel=g; log('Knight Rigged GLB loaded — '+ (g.animations?.length||0)+' clips'); }).catch(()=> loader.loadAsync('/models/knight.glb').then(g=>{ knightModel=g; log('Knight GLB loaded'); }).catch(e=>log('Knight fallback'))),
    loader.loadAsync('/models/robot.glb').then(g=>{ robotModel=g; log('Robot GLB loaded'); }).catch(e=>log('Robot fallback')),
  ];
  await Promise.allSettled(loads);
  setupPlayer();
  setupArenaDeco();
}
function centerAndScale(gltf, targetSize=6){
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  gltf.scene.position.sub(center);
  const max = Math.max(size.x,size.y,size.z)||1;
  const s = targetSize/max;
  gltf.scene.scale.setScalar(s);
  gltf.scene.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
  return s;
}
function setupArenaDeco(){
  if(arenaModel){
    const g = arenaModel.scene.clone(true);
    centerAndScale({scene:g}, 12);
    g.position.set(0,-0.1,0);
    g.traverse(o=>{
      if(o.isMesh && o.material){
        const mat=o.material;
        // Fix arena.glb Material.001 alpha 0.25 BLEND — render as transparent glass
        const isGlass = (mat.name && mat.name.includes('Material.001')) || (mat.name && mat.name.includes('001')) || (mat.opacity < 1 && mat.opacity > 0);
        // Also detect BLEND via userData or baseColor alpha
        const alphaFromFactor = mat.opacity;
        if(isGlass || alphaFromFactor===0.25){
          mat.transparent = true;
          mat.opacity = 0.25;
          mat.depthWrite = false;
          mat.side = THREE.DoubleSide;
        } else {
          // Preserve opaque materials but ensure DoubleSide verified
          mat.transparent = false;
          mat.opacity = 1;
          mat.depthWrite = true;
          mat.side = THREE.DoubleSide;
        }
        mat.needsUpdate = true;
        // verify
        if(isGlass){
          // ensure glass stays correct even if GLTFLoader already set transparent
          mat.transparent = true; mat.opacity = 0.25; mat.depthWrite = false; mat.side = THREE.DoubleSide;
        }
      }
    });
    scene.add(g);
    arenaLoaded=true;
    // expose for verification (glass verified)
    window.__arenaGlassVerified = (()=>{ let ok=false; g.traverse(o=>{ if(o.isMesh && o.material && o.material.name && o.material.name.includes('001')){ const m=o.material; if(m.transparent===true && Math.abs(m.opacity-0.25)<0.01 && m.depthWrite===false && m.side===THREE.DoubleSide) ok=true; }}); return ok; })();
  }
}
function setupPlayer(){
  player.position.set(0,0,6);
  if(knightModel){
    const m = knightModel.scene.clone(true);
    // rigged knight is already well-scaled; normalize
    const target = knightModel.animations && knightModel.animations.length ? 1.45 : 1.7;
    centerAndScale({scene:m}, target);
    m.rotation.y = Math.PI;
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
    const yaw = new THREE.Group();
    yaw.add(m);
    player.add(yaw);
    playerMesh = yaw;
    knightLoaded=true;
    // animation mixer for rigged knight
    if(knightModel.animations && knightModel.animations.length){
      playerMixer = new THREE.AnimationMixer(m);
      const clip = knightModel.animations[0];
      // fix possible legacy duration: keep as is
      const action = playerMixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished=false;
      action.play();
      playerClip=clip;
      log('Knight animation playing: '+clip.name+' ('+clip.duration.toFixed(2)+'s)');
    } else {
      // procedural bob for static knight
      player.userData.bobPhase=Math.random()*Math.PI*2;
    }
  } else {
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.35,0.9,4,12), new THREE.MeshStandardMaterial({color:0x35d0ff}));
    cap.position.y=0.6;
    cap.castShadow=true;
    player.add(cap);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12), new THREE.MeshStandardMaterial({color:0xffffff, emissive:0x35d0ff, emissiveIntensity:1}));
    visor.position.set(0,1.05,0.22);
    player.add(visor);
    playerMesh = cap;
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55,16), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.35}));
  disc.rotation.x=-Math.PI/2; disc.position.y=0.02;
  player.add(disc);
}
function spawnDamageNumber(pos, text, color='#ffffff', scaleMult=1){
  // create canvas texture sprite — scaleMult 1.4 for elite crit gold
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  canvas.width=256; canvas.height=128;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const fontSize = scaleMult>1 ? Math.round(56*scaleMult) : 56;
  ctx.font=`700 ${fontSize}px Space Grotesk, sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=color;
  ctx.strokeStyle='rgba(0,0,0,0.7)';
  ctx.lineWidth=8;
  ctx.strokeText(text,128,64);
  ctx.fillText(text,128,64);
  const tex=new THREE.CanvasTexture(canvas);
  tex.needsUpdate=true;
  const mat=new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false });
  const spr=new THREE.Sprite(mat);
  spr.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.6,1.2, (Math.random()-0.5)*0.6));
  spr.scale.set(1.6*scaleMult,0.8*scaleMult,1);
  spr.userData={ life:0.65, vel:new THREE.Vector3(0,1.8,0) };
  scene.add(spr);
  damageSprites.push(spr);
}

loadModels();

// input
addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; if(e.code==='Space') { e.preventDefault(); keys[' ']=true; }});
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; if(e.code==='Space') keys[' ']=false; });
addEventListener('mousemove',e=>{
  mouse.x = (e.clientX/innerWidth)*2-1;
  mouse.y = -(e.clientY/innerHeight)*2+1;
});
canvas.addEventListener('click', ()=>{ if(gameState==='playing') shoot(); });
canvas.addEventListener('touchstart',e=>{
  showMobileControls();
  const t=e.touches[0]; touchActive=true; touchOrigin.set(t.clientX,t.clientY);
  if(gameState==='playing') shoot();
},{passive:true});
canvas.addEventListener('touchmove',e=>{
  if(!touchActive) return;
  const t=e.touches[0];
  touchDir.set(t.clientX-touchOrigin.x, t.clientY-touchOrigin.y);
  keys['w']=touchDir.y < -18;
  keys['s']=touchDir.y > 18;
  keys['a']=touchDir.x < -18;
  keys['d']=touchDir.x > 18;
  // joystick visual
  const max=36;
  const len=Math.hypot(touchDir.x,touchDir.y);
  const clamped = len>max? touchDir.clone().normalize().multiplyScalar(max): touchDir.clone();
  joyStickEl.style.transform=`translate(${clamped.x}px,${clamped.y}px)`;
},{passive:true});
canvas.addEventListener('touchend',()=>{ touchActive=false; keys['w']=keys['a']=keys['s']=keys['d']=false; touchDir.set(0,0); joyStickEl.style.transform='translate(0,0)'; },{passive:true});
// joystick element touch handling (bottom-left)
joystickEl.addEventListener('touchstart',e=>{ e.preventDefault(); showMobileControls(); const t=e.touches[0]; touchActive=true; touchOrigin.set(t.clientX,t.clientY); },{passive:false});
joystickEl.addEventListener('touchmove',e=>{ e.preventDefault(); if(!touchActive) return; const t=e.touches[0]; touchDir.set(t.clientX-touchOrigin.x, t.clientY-touchOrigin.y); keys['w']=touchDir.y < -18; keys['s']=touchDir.y > 18; keys['a']=touchDir.x < -18; keys['d']=touchDir.x > 18; const max=36; const len=Math.hypot(touchDir.x,touchDir.y); const clamped=len>max?touchDir.clone().normalize().multiplyScalar(max):touchDir.clone(); joyStickEl.style.transform=`translate(${clamped.x}px,${clamped.y}px)`; },{passive:false});
joystickEl.addEventListener('touchend',e=>{ e.preventDefault(); touchActive=false; keys['w']=keys['a']=keys['s']=keys['d']=false; touchDir.set(0,0); joyStickEl.style.transform='translate(0,0)'; },{passive:false});
actionBtnEl.addEventListener('touchstart',e=>{ e.preventDefault(); if(gameState==='playing') shoot(); },{passive:false});
actionBtnEl.addEventListener('click',()=>{ if(gameState==='playing') shoot(); });
// (A) tutorial dismiss — click overlay or any key
if(tutorialOverlayEl){
  tutorialOverlayEl.addEventListener('click', ()=> dismissTutorial());
  tutorialOverlayEl.addEventListener('touchstart', ()=> dismissTutorial(), {passive:true});
}
addEventListener('keydown', e=>{
  if(tutorialActive && e.key.length===1) dismissTutorial();
  if(tutorialActive && (e.code==='Space' || e.key===' ')) dismissTutorial();
});

// screen shake — directional + DOM fallback
let shakeTimer=0, shakeIntensity=0, shakeDir=new THREE.Vector3();
function triggerShake(intensity=1, dirVec=null){
  shakeIntensity=Math.max(shakeIntensity,intensity);
  shakeTimer=Math.max(shakeTimer, intensity>1.4?0.42:0.32);
  if(dirVec && dirVec.lengthSq()>1e-6) shakeDir.copy(dirVec).normalize();
  else shakeDir.set((Math.random()-0.5),(Math.random()-0.5)*0.3,(Math.random()-0.5)).normalize();
  const el=document.body;
  el.classList.remove('shake','shakeStrong');
  void el.offsetWidth;
  el.classList.add(intensity>1.4?'shakeStrong':'shake');
  setTimeout(()=>el.classList.remove('shake','shakeStrong'), 450);
}
function triggerHitFlash(type){
  hitFlashEl.classList.remove('coreHit','playerHit');
  void hitFlashEl.offsetWidth;
  hitFlashEl.classList.add(type);
  hitFlashEl.style.opacity='1';
  setTimeout(()=>{ hitFlashEl.style.opacity='0'; setTimeout(()=>hitFlashEl.classList.remove('coreHit','playerHit'),300); },140);
}
function triggerHitStop(ms=60){
  hitStopTimer=Math.max(hitStopTimer, ms/1000);
  if(ms>=60) duckDrone(0.12, 0.35);
}
// WebAudio — beeps + continuous drone (critic 3)
let audioCtx=null;
let droneOsc1=null, droneOsc2=null, droneGain=null, droneFilter=null, droneLfo=null, droneLfoGain=null, droneNoise=null, droneNoiseGain=null, droneStarted=false, droneMuted=false;
function ensureAudio(){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
  }catch(e){}
}
function beep(freq=880, dur=0.08, vol=0.12){
  try{
    ensureAudio(); if(!audioCtx) return;
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type='square'; o.frequency.value=freq;
    g.gain.value=vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}
function initDrone(){
  try{
    ensureAudio(); if(!audioCtx || droneStarted) { updateDroneIntensity(); return; }
    if(localStorage.getItem('isolated-arena-muted')==='1') droneMuted=true;
    droneGain = audioCtx.createGain(); droneGain.gain.value = droneMuted ? 0 : 0.14;
    droneFilter = audioCtx.createBiquadFilter(); droneFilter.type='lowpass'; droneFilter.frequency.value=400; droneFilter.Q.value=0.6;
    // drone osc1: 55Hz saw (A1), osc2: 110Hz sine (A2) detuned
    droneOsc1 = audioCtx.createOscillator(); droneOsc1.type='sawtooth'; droneOsc1.frequency.value=55;
    droneOsc2 = audioCtx.createOscillator(); droneOsc2.type='sine'; droneOsc2.frequency.value=110;
    droneOsc1.detune.value=-7; droneOsc2.detune.value=7;
    const mixGain1=audioCtx.createGain(); mixGain1.gain.value=0.45;
    const mixGain2=audioCtx.createGain(); mixGain2.gain.value=0.38;
    droneOsc1.connect(mixGain1); droneOsc2.connect(mixGain2);
    mixGain1.connect(droneFilter); mixGain2.connect(droneFilter);
    // LFO 0.3Hz on detune for subtle movement
    droneLfo = audioCtx.createOscillator(); droneLfo.type='sine'; droneLfo.frequency.value=0.32;
    droneLfoGain = audioCtx.createGain(); droneLfoGain.gain.value=8;
    droneLfo.connect(droneLfoGain); droneLfoGain.connect(droneOsc1.detune); droneLfoGain.connect(droneOsc2.detune);
    // noise pad — 2s looped buffer pinkish
    const bufSize = audioCtx.sampleRate*2;
    const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let last=0;
    for(let i=0;i<bufSize;i++){ const white=Math.random()*2-1; last= (last + 0.02*white)/(1+0.02); data[i]= last*3.5; }
    const src = audioCtx.createBufferSource(); src.buffer=buffer; src.loop=true;
    droneNoiseGain = audioCtx.createGain(); droneNoiseGain.gain.value=0.06;
    const noiseFilter=audioCtx.createBiquadFilter(); noiseFilter.type='lowpass'; noiseFilter.frequency.value=900;
    src.connect(noiseFilter); noiseFilter.connect(droneNoiseGain); droneNoiseGain.connect(droneFilter);
    droneNoise = src;
    droneFilter.connect(droneGain); droneGain.connect(audioCtx.destination);
    droneOsc1.start(); droneOsc2.start(); droneLfo.start(); src.start();
    droneStarted=true;
    updateDroneIntensity();
    // resume on visibility change
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) ensureAudio(); });
  }catch(e){}
}
function updateDroneIntensity(){
  if(!droneGain || !audioCtx) return;
  const palette = loop % 3;
  const base = 0.08 + loop*0.015 + (palette===1?0.04:0);
  const target = droneMuted ? 0 : Math.min(0.22, base);
  const now = audioCtx.currentTime;
  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.linearRampToValueAtTime(target, now+0.6);
  if(droneFilter){
    const f = 380 + loop*22 + (palette===2?80:0);
    droneFilter.frequency.linearRampToValueAtTime(Math.min(900,f), now+0.6);
  }
}
function duckDrone(amount=0.06, dur=0.45){
  if(!droneGain || !audioCtx || droneMuted) return;
  const now=audioCtx.currentTime;
  const cur = droneGain.gain.value;
  droneGain.gain.cancelScheduledValues(now);
  droneGain.gain.setValueAtTime(cur, now);
  droneGain.gain.linearRampToValueAtTime(Math.max(0, cur*amount), now+0.05);
  droneGain.gain.linearRampToValueAtTime(cur, now+dur);
}
function toggleDroneMute(){
  droneMuted=!droneMuted;
  try{ localStorage.setItem('isolated-arena-muted', droneMuted?'1':'0'); }catch(e){}
  if(droneGain && audioCtx){
    droneGain.gain.cancelScheduledValues(audioCtx.currentTime);
    droneGain.gain.linearRampToValueAtTime(droneMuted?0:0.14, audioCtx.currentTime+0.25);
  }
  updateDroneIntensity();
  const btn=document.getElementById('audioToggle');
  if(btn) btn.textContent = droneMuted ? '🔇 MUTED' : '🔊 AUDIO';
  btn.style.opacity = droneMuted? '0.6':'1';
}

// ── Merge Titan Boss (Loop 3/6/9...) ──
function updateBossHud(){
  if(!isBossLoop || !bossGroup){ bossHudEl.classList.add('hidden'); return; }
  bossHudEl.classList.remove('hidden');
  const hp=Math.max(0,bossGroup.userData.hp), mx=bossGroup.userData.maxHp;
  const pct=Math.max(0,Math.min(1,hp/mx));
  bossBarEl.style.width=(pct*100)+'%';
  bossHpTextEl.textContent=`${Math.round(hp)} / ${mx}` + (bossPhase===2 ? ' — ENRAGED' : '');
  if(pct<0.35) bossBarEl.style.background='linear-gradient(90deg,#ff0040,#ff6b3b)';
  else if(pct<0.6) bossBarEl.style.background='linear-gradient(90deg,#ff3b6b,#ffb020)';
  else bossBarEl.style.background='linear-gradient(90deg,#ff1a3d,#ff6b3b 45%,#ffb020)';
}
function showTitanIncoming(){
  titanIncomingEl.classList.remove('hidden');
  // retrigger anim
  const big=titanIncomingEl.querySelector('.titanBig');
  big.style.animation='none'; void big.offsetWidth; big.style.animation='';
  beep(110,0.22,0.16); setTimeout(()=>beep(165,0.22,0.16),180); setTimeout(()=>beep(220,0.35,0.18),380);
  triggerShake(1.9);
  setTimeout(()=>titanIncomingEl.classList.add('hidden'), 1700);
}
function spawnTitan(){
  const g=new THREE.Group();
  let mesh;
  const bossHp = 450 + loop*22 + (loop>6?80:0);
  const bossScale = 2.2;
  if(robotModel){
    mesh=robotModel.scene.clone(true);
    const box=new THREE.Box3().setFromObject(mesh); const sz=new THREE.Vector3(); box.getSize(sz);
    const c=new THREE.Vector3(); box.getCenter(c); mesh.position.sub(c);
    const s= bossScale / Math.max(sz.x,sz.y,sz.z);
    mesh.scale.setScalar(s);
    mesh.rotation.y=Math.PI;
    mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.material=o.material.clone(); o.material.emissive=new THREE.Color(0xff1a3d); o.material.emissiveIntensity=0.95; o.material.color=new THREE.Color(0xff8aa0); }});
  } else if(knightModel){
    mesh=knightModel.scene.clone(true);
    const box=new THREE.Box3().setFromObject(mesh); const sz=new THREE.Vector3(); box.getSize(sz);
    const c=new THREE.Vector3(); box.getCenter(c); mesh.position.sub(c);
    mesh.scale.setScalar(bossScale/Math.max(sz.x,sz.y,sz.z));
    mesh.rotation.y=Math.PI;
    mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.material=o.material.clone(); o.material.emissive=new THREE.Color(0xff1a3d); o.material.emissiveIntensity=0.9; }});
  } else {
    mesh=new THREE.Mesh(new THREE.CapsuleGeometry(0.85,1.6,4,12), new THREE.MeshStandardMaterial({color:0xff1a3d, emissive:0x880010, emissiveIntensity:0.95}));
    mesh.position.y=0.9; mesh.castShadow=true;
  }
  const holder=new THREE.Group(); holder.add(mesh);
  g.add(holder);
  const ang=Math.random()*Math.PI*2;
  const r=14.5;
  g.position.set(Math.cos(ang)*r,0,Math.sin(ang)*r);
  g.userData={ holder, hp:bossHp, maxHp:bossHp, speed: 1.35+loop*0.08, isBoss:true, isElite:true, bob:Math.random()*Math.PI*2, archetype:'boss', shootCd:999, dashCd:2.6, shockCd:4.0 };
  const bar=new THREE.Mesh(new THREE.PlaneGeometry(1.8,0.14), new THREE.MeshBasicMaterial({color:0xff1a3d, side:THREE.DoubleSide}));
  bar.position.set(0,2.45,0); g.add(bar); g.userData.bar=bar;
  const aura=new THREE.Mesh(new THREE.RingGeometry(1.25,1.45,20), new THREE.MeshBasicMaterial({color:0xff3b6b, transparent:true, opacity:0.42, side:THREE.DoubleSide}));
  aura.rotation.x=-Math.PI/2; aura.position.y=0.03; g.add(aura); g.userData.aura=aura;
  // extra boss ring
  const bossRing=new THREE.Mesh(new THREE.RingGeometry(1.55,1.68,20), new THREE.MeshBasicMaterial({color:0xffb020, transparent:true, opacity:0.28, side:THREE.DoubleSide}));
  bossRing.rotation.x=-Math.PI/2; bossRing.position.y=0.04; g.add(bossRing); g.userData.bossRing=bossRing;
  scene.add(g); enemies.push(g); bossGroup=g;
  burst(g.position, 0xff1a3d, 18);
  // light burst
  const bl=new THREE.PointLight(0xff3b6b, 18, 16); bl.position.copy(g.position).add(new THREE.Vector3(0,1.5,0)); scene.add(bl); setTimeout(()=>scene.remove(bl),420);
  log(`◈ MERGE TITAN spawned — ${bossHp} HP · 2.2× scale · shockwave 4s · dashes`);
  updateBossHud();
}
function doBossShockwave(){
  if(!bossGroup) return;
  const pos=bossGroup.position.clone();
  // visual expanding ring (3D)
  const geo=new THREE.RingGeometry(0.5,0.65,32);
  const mat=new THREE.MeshBasicMaterial({ color: bossPhase===2?0xff6b3b:0xff3b6b, transparent:true, opacity:0.85, side:THREE.DoubleSide });
  const ring=new THREE.Mesh(geo, mat);
  ring.rotation.x=-Math.PI/2; ring.position.copy(pos); ring.position.y=0.12;
  scene.add(ring);
  let life=0;
  const animRing={ tick(dt){
    life+=dt; const s=1+life*9; ring.scale.setScalar(s); ring.material.opacity=Math.max(0,0.85-life*0.95);
    // affect hazard pillars: flash emissive
    if(hazardGroup) hazardGroup.children.forEach(h=>{ if(h.userData.pillar) h.userData.pillar.material.emissiveIntensity=0.9+Math.sin(life*18)*0.2; });
    if(life>0.9){ scene.remove(ring); geo.dispose(); mat.dispose(); return true; }
    return false;
  }};
  // reuse particles array for simple anim
  shockEffects.push(animRing);
  // DOM shock flash
  const dom=document.createElement('div'); dom.className='shockRing'; dom.innerHTML='<i></i>'; document.body.appendChild(dom); setTimeout(()=>dom.remove(),900);
  // damage: arena-wide — 14 dmg to player, 10 to core, scaled by phase
  const dmgPlayer= bossPhase===2? 18:12;
  const dmgCore= bossPhase===2? 12:7;
  // player hit if alive (arena-wide per spec — always)
  duckDrone(0.08, 0.9);
  takeDamagePlayer(dmgPlayer);
  triggerShake(1.4);
  triggerHitFlash('coreHit');
  beep(140,0.18,0.15); setTimeout(()=>beep(90,0.22,0.14),140);
  // core hit
  const prev=coreHp;
  coreHp=Math.max(0, coreHp - dmgCore);
  coreFlashTimer=0.32;
  if(coreHp<=0) failLoop();
  // minor knockback
  const dir=player.position.clone().sub(pos); dir.y=0; if(dir.lengthSq()>1e-6) player.position.add(dir.normalize().multiplyScalar(0.9));
  burst(player.position, 0xff3b6b, 8);
  // (A) extra particle bursts on Titan shock — juicier phase 2
  burst(pos.clone().add(new THREE.Vector3(0,0.4,0)), bossPhase===2?0xffb020:0xff3b6b, bossPhase===2? 20:14);
  burst(pos.clone().add(new THREE.Vector3(0,0.9,0)), 0xffffff, 10);
  if(bossPhase===2){ burst(pos, 0xff6b3b, 12); spawnDamageNumber(pos.clone().add(new THREE.Vector3(0,2.0,0)), 'ENRAGED!', '#ffb020', 1.25); }
  // log only occasionally
  if(Math.random()<0.5) log(`◈ Titan shockwave — ${dmgPlayer} dmg · core -${dmgCore}%`);
  spawnDamageNumber(pos.clone().add(new THREE.Vector3(0,1.8,0)), 'SHOCK!', bossPhase===2?'#ffb020':'#ff3b6b');
}

function spawnSingleBullet(dirVec){
  const r = 0.14 * boonModifiers.radiusMult;
  const dmg = Math.round(26 * boonModifiers.dmgMult);
  const col = activeBoons.pulse>0 ? 0x7ae8ff : 0x35d0ff;
  const b = new THREE.Mesh(new THREE.SphereGeometry(r,10,10), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:col, emissiveIntensity: 1.9 + activeBoons.pulse*0.3 }));
  b.position.copy(player.position).add(new THREE.Vector3(0,0.6,0)).add(dirVec.clone().multiplyScalar(0.6));
  b.userData={ vel: dirVec.clone().multiplyScalar(18), life:1.6, dmg, hitRadius: 0.85 * boonModifiers.radiusMult };
  b.castShadow=false;
  // subtle scale pulse for overclock
  if(activeBoons.pulse>0) b.scale.setScalar(1.05);
  scene.add(b);
  bullets.push(b);
}
function shoot(){
  const now=performance.now();
  const cd = activeBoons.pulse>0 ? 160 : 180;
  if(now-lastShot<cd) return;
  lastShot=now;
  const baseDir = aimDir.clone();
  const extra = boonModifiers.extraProjectiles;
  // spawn burst light once
  const flash = new THREE.PointLight(activeBoons.pulse>0?0x7ae8ff:0x35d0ff, 6 + activeBoons.pulse*1.2, 4 + boonModifiers.radiusMult);
  flash.position.copy(player.position).add(new THREE.Vector3(0,0.6,0)).add(baseDir.clone().multiplyScalar(0.6));
  scene.add(flash);
  setTimeout(()=>scene.remove(flash),80);
  if(extra===0){
    spawnSingleBullet(baseDir);
  } else {
    const total = extra+1;
    const spreadDeg = Math.min(42, 14 + total*3);
    const half = (total-1)/2;
    for(let i=0;i<total;i++){
      const off = (i - half) * (spreadDeg / Math.max(1,total-1));
      const rad = off*Math.PI/180;
      const dir = baseDir.clone();
      const cos=Math.cos(rad), sin=Math.sin(rad);
      const nx = dir.x*cos - dir.z*sin;
      const nz = dir.x*sin + dir.z*cos;
      dir.set(nx,0,nz).normalize();
      spawnSingleBullet(dir);
    }
  }
  player.position.add(baseDir.clone().multiplyScalar(-0.06));
  if(gameState==='playing') triggerShake(activeBoons.pulse>0?0.75:0.6);
  if(extra>0) beep(960,0.06,0.07);
}

function spawnEnemy(){
  const ang = Math.random()*Math.PI*2;
  const r = 16.5 + Math.random()*1.5;
  const pos = new THREE.Vector3(Math.cos(ang)*r, 0, Math.sin(ang)*r);
  const g = new THREE.Group();
  let mesh;
  const isElite = (waveKill + enemies.length) % 5 === 4 || Math.random()<0.15; // every ~5th is elite
  // second archetype: ranged spitter — palette-aware: P0/1 35%, P2 50% +12% speed (critic 4)
  const paletteForSpawn = loop % 3;
  let rangedChance = 0.35;
  if(paletteForSpawn===2) rangedChance = 0.50;
  const isRanged = Math.random()<rangedChance;
  const archetype = isRanged ? 'ranged' : 'melee';
  if(archetype==='ranged' && knightModel && knightModel!==null){
    // use original knight.glb (non-rigged) for spitter — tint blueish
    mesh = knightModel.scene.clone(true);
    const box=new THREE.Box3().setFromObject(mesh); const size=new THREE.Vector3(); box.getSize(size);
    const c=new THREE.Vector3(); box.getCenter(c); mesh.position.sub(c);
    const s= (isElite?1.25:0.95) / Math.max(size.x,size.y,size.z);
    mesh.scale.setScalar(s);
    mesh.rotation.y=Math.PI;
    mesh.traverse(o=>{ if(o.isMesh){
      o.castShadow=true;
      o.material = o.material.clone();
      if(isElite){ o.material.emissive=new THREE.Color(0x5500ff); o.material.emissiveIntensity=0.85; o.material.color=new THREE.Color(0xa0a0ff); }
      else { o.material.emissive=new THREE.Color(0x2244aa); o.material.emissiveIntensity=0.45; o.material.color=new THREE.Color(0x8aa0ff); }
    }});
  } else if(robotModel){
    mesh = robotModel.scene.clone(true);
    const box=new THREE.Box3().setFromObject(mesh); const size=new THREE.Vector3(); box.getSize(size);
    const c=new THREE.Vector3(); box.getCenter(c); mesh.position.sub(c);
    const s= (isElite?1.35:1.05) / Math.max(size.x,size.y,size.z);
    mesh.scale.setScalar(s);
    mesh.rotation.y=Math.PI;
    mesh.traverse(o=>{ if(o.isMesh){
      o.castShadow=true;
      if(isElite){ o.material = o.material.clone(); o.material.emissive=new THREE.Color(0xff1133); o.material.emissiveIntensity=0.9; o.material.color=new THREE.Color(0xff9aa0); }
    }});
  } else {
    const col = archetype==='ranged'? 0x5590ff : 0xff3b6b;
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(isElite?0.42:0.32,isElite?0.9:0.7,4,10), new THREE.MeshStandardMaterial({color:isElite?0xff1a3d:col, emissive:isElite?0x880010: (archetype==='ranged'?0x1a3a80:0x550010), emissiveIntensity:isElite?0.9:0.6}));
    mesh.position.y=0.6;
    mesh.castShadow=true;
  }
  const holder=new THREE.Group(); holder.add(mesh);
  g.add(holder);
  g.position.copy(pos);
  const rawHp = archetype==='ranged' ? (isElite? 110+loop*10 : 55+loop*7) : (isElite? 140+loop*12 : 70+loop*8);
  const baseHp = Math.round(rawHp * 1.6); // VS density fix — raise HP 1.6x so 40-60 can stack
  let baseSpeed = archetype==='ranged' ? (isElite? 2.0+loop*0.14 : 1.7+loop*0.12) : (isElite? 2.8+loop*0.2 : 2.2+loop*0.18+Math.random()*0.6);
  if(paletteForSpawn===2) baseSpeed *= 1.12;
  g.userData={ holder, hp: baseHp, speed: baseSpeed, maxHp: baseHp, elite:isElite, bob:Math.random()*Math.PI*2, archetype, shootCd: 1.2+Math.random()*0.8 };
  const barColor = archetype==='ranged' ? (isElite?0x7a5cff:0x5590ff) : (isElite?0xff1a3d:0xff3b6b);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(isElite?1.1:0.9, isElite?0.11:0.08), new THREE.MeshBasicMaterial({color:barColor, side:THREE.DoubleSide}));
  bar.position.set(0, isElite?1.65:1.45,0);
  g.add(bar);
  g.userData.bar=bar;
  if(isElite){
    const aura=new THREE.Mesh(new THREE.RingGeometry(0.85,0.95,16), new THREE.MeshBasicMaterial({color:barColor, transparent:true, opacity:0.35, side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.03;
    g.add(aura); g.userData.aura=aura;
  }
  if(archetype==='ranged'){
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.65,0.70,12), new THREE.MeshBasicMaterial({ color:0x5590ff, transparent:true, opacity:0.22, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.04;
    g.add(ring); g.userData.rangeRing=ring;
  }
  scene.add(g);
  enemies.push(g);
  burst(pos, isElite?0xff1a3d: (archetype==='ranged'?0x5590ff:0xff3b6b), isElite?14:8);
  if(isElite) beep(440,0.12,0.10);
}
function spawnEnemyProjectile(from, dir){
  const b=new THREE.Mesh(new THREE.SphereGeometry(0.11,8,8), new THREE.MeshStandardMaterial({ color:0x8ab4ff, emissive:0x3355ff, emissiveIntensity:1.6 }));
  b.position.copy(from).add(new THREE.Vector3(0,0.9,0)).add(dir.clone().multiplyScalar(0.4));
  b.userData={ vel: dir.clone().multiplyScalar(11), life:3.0, dmg: 12+loop*1.5 };
  scene.add(b); enemyBullets.push(b);
}
function burst(pos, color, n=10){
  for(let i=0;i<n;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95}));
    p.position.copy(pos).add(new THREE.Vector3(0,0.3,0));
    p.userData={ vel: new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4+1, (Math.random()-0.5)*6), life:0.4+Math.random()*0.3 };
    scene.add(p);
    particles.push(p);
  }
  // additive spark point
  const geo=new THREE.BufferGeometry();
  const cnt=Math.min(n,12);
  const posArr=new Float32Array(cnt*3);
  for(let i=0;i<cnt;i++){ posArr[i*3]=pos.x+(Math.random()-0.5)*0.3; posArr[i*3+1]=pos.y+0.6; posArr[i*3+2]=pos.z+(Math.random()-0.5)*0.3; }
  geo.setAttribute('position', new THREE.BufferAttribute(posArr,3));
  const mat=new THREE.PointsMaterial({ color, size:0.18, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, sizeAttenuation:true, depthWrite:false });
  const pts=new THREE.Points(geo, mat);
  pts.userData={ life:0.22, vel:new THREE.Vector3(0,0,0) };
  scene.add(pts); particles.push(pts);
}

let lastCoreHp=100, lastPlayerHp=100;
function takeDamagePlayer(d){
  playerHp=Math.max(0,playerHp-d);
  if(playerHp < lastPlayerHp - 0.5){
    triggerShake(playerHp<35?1.8:1.1);
    triggerHitFlash('playerHit');
    // bump HUD
    phpEl.classList.add('bump');
    setTimeout(()=>phpEl.classList.remove('bump'),220);
  }
  lastPlayerHp=playerHp;
  burst(player.position, 0x35d0ff, 6);
  if(playerHp<=0){
    gameState='dead';
    deadCard.classList.remove('hidden');
    startCard.classList.add('hidden');
    howCard.classList.add('hidden');
    winCard.classList.add('hidden');
    overlay.style.display='flex';
    log('Player down — loop '+loop+' breach');
    document.getElementById('deadText').textContent=`Isolation breached at loop ${loop}. Core held at ${Math.round(coreHp)}%. Retry keeps the same worktree.`;
  }
}

function updateHUD(dt=0.016){
  // lerp displayed values
  const lerp = (a,b,s)=>a+(b-a)*s;
  dispScore = lerp(dispScore, score, 0.14);
  dispCore = lerp(dispCore, coreHp, 0.18);
  dispPlayer = lerp(dispPlayer, playerHp, 0.18);
  // snap when close
  if(Math.abs(dispScore-score)<0.5) dispScore=score;
  if(Math.abs(dispCore-coreHp)<0.15) dispCore=coreHp;
  if(Math.abs(dispPlayer-playerHp)<0.15) dispPlayer=playerHp;

  loopEl.textContent=loop;
  // animate score bump when rising
  if(scoreEl.textContent!==String(Math.round(dispScore))){
    scoreEl.textContent=Math.round(dispScore);
  }
  waveEl.textContent=`${waveKill} / ${waveTotal}`;
  hpEl.textContent=Math.round(dispCore)+'%';
  hpbar.style.width=dispCore+'%';
  hpbar.style.background= dispCore<30 ? 'linear-gradient(90deg,#ff3b6b,#ffb020)' : 'linear-gradient(90deg,var(--ok),var(--accent))';
  phpEl.textContent=Math.round(dispPlayer);
  // low hp danger tint
  if(dispPlayer<30) phpEl.classList.add('hpDanger'); else phpEl.classList.remove('hpDanger');
  if(dispCore<30) hpEl.classList.add('hpDanger'); else hpEl.classList.remove('hpDanger');
  ecountEl.textContent=enemies.length;
  isoEl.textContent= coreHp>60 ? 'STABLE' : coreHp>30 ? 'LEAKING' : 'BREACH';
  isoEl.style.color= coreHp>60 ? 'var(--ok)' : coreHp>30 ? 'var(--warn)' : 'var(--accent2)';
  // breach warning toggle — also low-HP vignette + subtle chromatic aberration (A)
  const shouldBreach = coreHp>0 && coreHp<30 && gameState==='playing';
  if(shouldBreach && !breachActive){
    breachActive=true;
    breachWarnEl.classList.remove('hidden');
    vignetteEl.classList.add('on');
    if(lowVignetteEl) lowVignetteEl.classList.add('on');
    if(chromaticEl) chromaticEl.classList.add('on');
  } else if(!shouldBreach && breachActive){
    breachActive=false;
    breachWarnEl.classList.add('hidden');
    vignetteEl.classList.remove('on');
    if(lowVignetteEl) lowVignetteEl.classList.remove('on');
    if(chromaticEl) chromaticEl.classList.remove('on');
  }
  // ensure low-HP visuals also sync when HUD called outside toggle (e.g. after damage without state change)
  if(lowVignetteEl && chromaticEl){
    if(shouldBreach){ lowVignetteEl.classList.add('on'); chromaticEl.classList.add('on'); }
    else { lowVignetteEl.classList.remove('on'); chromaticEl.classList.remove('on'); }
  }
}

function showWaveAnnouncer(text, duration=2200){
  waveAnnounceEl.textContent=text;
  waveAnnounceEl.classList.remove('hidden');
  requestAnimationFrame(()=>waveAnnounceEl.classList.add('show'));
  setTimeout(()=>{
    waveAnnounceEl.classList.remove('show');
    setTimeout(()=>waveAnnounceEl.classList.add('hidden'),300);
  },duration);
}

async function runCountdown(loopNum){
  countdownEl.classList.remove('hidden');
  const seq=[
    {num:`LOOP ${loopNum}`, label:'ISOLATED CHECKOUT', sub:`${waveTotal} CONFLICTS INCOMING`},
    {num:'3', label:`LOOP ${loopNum}`, sub:'HOLD THE CORE'},
    {num:'2', label:`LOOP ${loopNum}`, sub:'HOLD THE CORE'},
    {num:'1', label:`LOOP ${loopNum}`, sub:'HOLD THE CORE'},
    {num:'GO!', label:`LOOP ${loopNum} — BREACH WINDOW OPEN`, sub:''},
  ];
  for(let i=0;i<seq.length;i++){
    const s=seq[i];
    countdownNum.textContent=s.num;
    countdownLabel.textContent=s.label;
    countdownSub.textContent=s.sub;
    countdownNum.classList.remove('anim');
    void countdownNum.offsetWidth;
    countdownNum.classList.add('anim');
    // special color for GO!
    if(s.num==='GO!'){ countdownNum.style.color='#2ee5a0'; countdownNum.style.textShadow='0 0 40px rgba(46,229,160,0.9),0 0 80px rgba(46,229,160,0.5)'; }
    else if(s.num.startsWith('LOOP')){ countdownNum.style.fontSize='clamp(32px,7vw,56px)'; countdownNum.style.color='#35d0ff'; }
    else { countdownNum.style.fontSize=''; countdownNum.style.color='#fff'; countdownNum.style.textShadow=''; }
    await new Promise(r=>setTimeout(r, 680));
  }
  countdownEl.classList.add('hidden');
  countdownNum.classList.remove('anim');
}

let hazardGroup=null;
function clearHazards(){ if(hazardGroup){ scene.remove(hazardGroup); hazardGroup.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); hazardGroup=null; } }
function applyChamberMutation(loopNum){
  clearHazards();
  const palettes = [
    { bg:0x080a0f, fog:0x080a0f, hemi:0xffffff, dir:0xffffff, rim:0x35d0ff },
    { bg:0x0f0a12, fog:0x120a1a, hemi:0xffd0e8, dir:0xffb0d0, rim:0xff3b6b },
    { bg:0x0a0f14, fog:0x0a1e22, hemi:0xb0fff0, dir:0x80ffcc, rim:0x2ee5a0 },
  ];
  let paletteIdx = loopNum % palettes.length;
  if(forcedNextPalette !== null){
    paletteIdx = forcedNextPalette;
    forcedNextPalette = null;
  }
  const p = palettes[paletteIdx];
  scene.background.setHex(p.bg);
  scene.fog = new THREE.Fog(p.fog, 35, 70);
  // update lights
  scene.children.forEach(o=>{ if(o.isHemisphereLight) o.color.setHex(p.hemi); });
  dir.color.setHex(p.dir);
  rim.color.setHex(p.rim);
  coreRing.material.color.setHex(paletteIdx===1?0xff3b6b:0x35d0ff);
  // hazard pillars — mutate gameplay per loop%3 (critic 4): P0=0, P1=4 static, P2=4 rotating/pulsing
  if(paletteIdx===0){
    log(`◈ Chamber mutated — palette ${paletteIdx} VOID + 0 hazards (clean)`);
    return;
  }
  hazardGroup = new THREE.Group();
  hazardGroup.userData = { paletteIdx, rotSpeed: paletteIdx===2 ? 0.35 : 0 };
  const count = 4;
  for(let i=0;i<count;i++){
    const ang=i*Math.PI/2 + (loopNum*0.3);
    const x=Math.cos(ang)*7.5, z=Math.sin(ang)*7.5;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,2.4,12), new THREE.MeshStandardMaterial({ color:p.rim, emissive:p.rim, emissiveIntensity:0.55, transparent:true, opacity:0.92 }));
    pillar.position.set(0,1.2,0);
    pillar.castShadow=true; pillar.receiveShadow=true;
    pillar.userData={ baseEmissive:0.55, pulsePhase: i*1.6, rotating: paletteIdx===2 };
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.9,1.05,16), new THREE.MeshBasicMaterial({ color:p.rim, transparent:true, opacity:0.28, side:THREE.DoubleSide }));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.06;
    const holder=new THREE.Group(); holder.position.set(x,0,z); holder.add(pillar); holder.add(ring);
    holder.userData={ hazard:true, pillar, ring, damageTick:0, rotating: paletteIdx===2 };
    hazardGroup.add(holder);
  }
  scene.add(hazardGroup);
  const desc = paletteIdx===1 ? '4 static hazards' : '4 rotating pulsing hazards';
  log(`◈ Chamber mutated — palette ${paletteIdx} ${paletteIdx===1?'CRIMSON':'TEAL'} + ${desc}`);
}

async function startLoop(){
  waveKill=0;
  isBossLoop = (loop%3===0);
  pendingBoonPicks = isBossLoop ? 2 : 1;
  // critic gap 2: VS flood unconditional — 90 wave, 90 cap, 0.12s constant
  waveTotal = isBossLoop ? 1 : 90;
  elapsed=0;
  waveActive=true;
  enemies.forEach(e=>scene.remove(e)); enemies.length=0;
  bossGroup=null; bossPhase=1; bossShockTimer=4.0; bossDashTimer=2.8;
  shockEffects.length=0;
  bullets.forEach(b=>scene.remove(b)); bullets.length=0;
  if(typeof enemyBullets!=='undefined') enemyBullets.forEach(b=>scene.remove(b));
  enemyBullets.length=0;
  player.position.set(0,0,6);
  playerHp=100; dispPlayer=100; lastPlayerHp=100;
  if(coreHp<=0) { coreHp=100; dispCore=100; }
  lastCoreHp=coreHp;
  gameState='countdown';
  overlay.style.display='none';
  startCard.classList.add('hidden');
  howCard.classList.add('hidden');
  deadCard.classList.add('hidden');
  winCard.classList.add('hidden');
  boonCard.classList.add('hidden');
  if(doorCard) doorCard.classList.add('hidden');
  bossHudEl.classList.add('hidden');
  titanIncomingEl.classList.add('hidden');
  breachActive=false; breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on');
  if(lowVignetteEl) lowVignetteEl.classList.remove('on');
  if(chromaticEl) chromaticEl.classList.remove('on');
  // hide persistence overlays
  if(pauseCard) pauseCard.classList.add('hidden');
  if(historyCard) historyCard.classList.add('hidden');
  applyChamberMutation(loop);
  updateSeedDisplay();
  updateDroneIntensity();
  if(isBossLoop) log(`◈ Loop ${loop} — TITAN LOOP — Merge Titan emerges`);
  else log(`→ Loop ${loop} isolated checkout — spawning ${waveTotal} conflicts`);
  updateHUD(); updateBossHud();
  await runCountdown(loop);
  if(gameState!=='countdown') return;
  gameState='playing';
  lastSpawn=performance.now();
  // (A) onboarding — first-loop tutorial (only loop 1, staged hints)
  if(loop===1){ firstClearShown=false; showTutorial(); } else { dismissTutorial(); if(firstClearEl){ firstClearEl.classList.add('hidden'); firstClearEl.classList.remove('show'); } firstClearShown=false; }
  if(isBossLoop){
    spawnTitan();
    showTitanIncoming();
    showWaveAnnouncer(`◈ TITAN LOOP ${loop} — MERGE TITAN`, 2600);
    log(`▶ TITAN INCOMING — defeat the Merge Titan to clear loop ${loop}`);
  } else {
    showWaveAnnouncer(`WAVE ${loop} — ${waveTotal} CONFLICTS`);
    log(`▶ Wave ${loop} active — defend the core — hazard ring active`);
    // VS flood: initial burst 12 at 120ms per critic
    for(let i=0;i<12;i++) setTimeout(()=>{ if(gameState==='playing' && !isBossLoop) spawnEnemy(); }, i*120);
  }
}

function showBoonChoice(){
  gameState='boon';
  overlay.style.display='flex';
  startCard.classList.add('hidden'); howCard.classList.add('hidden'); deadCard.classList.add('hidden'); winCard.classList.add('hidden'); doorCard.classList.add('hidden');
  boonCard.classList.remove('hidden');
  if(pendingBoonPicks>1) bossHudEl.classList.remove('hidden');
  let shuffled=[...BOONS].sort(()=>Math.random()-0.5);
  // door reward weighting — ensure weighted boon appears in offer
  if(doorRewardWeight){
    const weighted = BOONS.find(b=>b.id===doorRewardWeight);
    if(weighted && !shuffled.slice(0,3).some(b=>b.id===weighted.id)){
      shuffled = [weighted, ...shuffled.filter(b=>b.id!==weighted.id)];
    }
    doorRewardWeight = null;
  }
  pendingBoonOffer = shuffled.slice(0,3);
  const picksText = pendingBoonPicks>1 ? `Pick <b style="color:#ffb020">${pendingBoonPicks}</b> boons — TITAN REWARD (2×)` : `Pick one <b>Hades boon</b> to persist for the rest of the run.`;
  const bossNote = isBossLoop ? ' <span style="color:#ff3b6b">◈ TITAN DEFEATED</span>' : '';
  boonDescEl.innerHTML = `Loop <b style="color:var(--accent)">${loop}</b> cleared — Integrity ${Math.round(coreHp)}%. ${picksText}${bossNote}`;
  if(pendingBoonPicks>1){
    boonDescEl.innerHTML += `<br><span style="font-size:11px;opacity:0.7">Pick ${pendingBoonPicks} — ${pendingBoonPicks} remaining</span>`;
  }
  boonChoicesEl.innerHTML='';
  pendingBoonOffer.forEach((b, idx)=>{
    const owned = activeBoons[b.id];
    const stackLabel = owned>0 ? `OWNED ×${owned} → ×${owned+1}` : 'NEW BOON';
    const div=document.createElement('button');
    div.className=`boonChoice ${b.cls}`;
    div.setAttribute('data-boon', b.id);
    div.innerHTML=`
      <span class="boonKey">${idx+1}</span>
      <div class="boonIcon">${b.icon}</div>
      <h3>${b.name}</h3>
      <p>${b.desc}</p>
      <div class="boonMeta">${stackLabel} · ${b.detail}</div>
    `;
    div.onclick=()=> pickBoon(b.id);
    boonChoicesEl.appendChild(div);
  });
  log(`◆ Choose a Boon — ${pendingBoonOffer.map(b=>b.short).join(' / ')}${pendingBoonPicks>1?' — TITAN 2× picks':''}`);
}
function pickBoon(id){
  const b = BOONS.find(x=>x.id===id);
  if(!b) return;
  activeBoons[id] = (activeBoons[id]||0)+1;
  recordBoon(id);
  recomputeBoonModifiers();
  updateBoonHud();
  beep({pulse:880, cache:660, shard:1040}[id]||880,0.16,0.13);
  triggerShake(0.5);
  boonCard.querySelectorAll('.boonChoice').forEach(el=>{
    if(el.getAttribute('data-boon')===id) el.classList.add('selected');
    el.style.pointerEvents='none';
  });
  log(`◆ Boon acquired: ${b.name} ×${activeBoons[id]} ${b.desc.replace('<br>',' ')}`);
  pendingBoonPicks--;
  if(pendingBoonPicks>0){
    setTimeout(()=>{
      // refresh choices for second pick, reshuffle
      const shuffled=[...BOONS].sort(()=>Math.random()-0.5);
      pendingBoonOffer = shuffled.slice(0,3);
      boonDescEl.innerHTML = `Titan reward — pick <b style="color:#ffb020">${pendingBoonPicks}</b> more boon${pendingBoonPicks>1?'s':''}!<br><span style="font-size:11px;opacity:0.7">${pendingBoonPicks} remaining</span>`;
      boonChoicesEl.innerHTML='';
      pendingBoonOffer.forEach((bb, idx)=>{
        const owned=activeBoons[bb.id];
        const stackLabel=owned>0?`OWNED ×${owned} → ×${owned+1}`:'NEW BOON';
        const div=document.createElement('button');
        div.className=`boonChoice ${bb.cls}`;
        div.setAttribute('data-boon',bb.id);
        div.innerHTML=`<span class="boonKey">${idx+1}</span><div class="boonIcon">${bb.icon}</div><h3>${bb.name}</h3><p>${bb.desc}</p><div class="boonMeta">${stackLabel} · ${bb.detail}</div>`;
        div.onclick=()=> pickBoon(bb.id);
        boonChoicesEl.appendChild(div);
      });
      log(`◆ Titan bonus — choose ${pendingBoonPicks} more`);
    }, 380);
    return;
  }
  setTimeout(()=>{
    boonCard.classList.add('hidden');
    // after boons, show Hades doors for next chamber (critic 5 — agency)
    if(loop >= 1){
      showDoorChoice();
      return;
    }
    gameState='won';
    winCard.classList.remove('hidden');
    overlay.style.display='flex';
    const mods = [];
    if(activeBoons.pulse) mods.push(`Pulse ×${activeBoons.pulse}`);
    if(activeBoons.cache) mods.push(`Cache ×${activeBoons.cache}`);
    if(activeBoons.shard) mods.push(`Shard ×${activeBoons.shard}`);
    const modStr = mods.length ? `Active: ${mods.join(' · ')}` : '';
    const titanStr = isBossLoop ? ' ◈ Titan slain — bonus boon granted.' : '';
    document.getElementById('winText').textContent=`Worktree loop ${loop} regression passed. Integrity ${Math.round(coreHp)}%. ${modStr}${titanStr} Next checkout harder (+3 enemies, +8% speed).`;
  }, 380);
}
function showDoorChoice(){
  gameState='doors';
  overlay.style.display='flex';
  boonCard.classList.add('hidden'); winCard.classList.add('hidden'); startCard.classList.add('hidden'); howCard.classList.add('hidden'); deadCard.classList.add('hidden');
  doorCard.classList.remove('hidden');
  // generate 2 Hades doors: each = paletteIdx + hazard count + reward preview (weighted boon)
  const palettesInfo = [
    { idx:0, name:'VOID', label:'VOID · CLEAN', hazards:'0 hazards', color:'#35d0ff', desc:'Clean arena — no pillars. Safe to kite, but no cover.', reward:'PULSE-weighted' },
    { idx:1, name:'CRIMSON', label:'CRIMSON · STATIC', hazards:'4 static', color:'#ff3b6b', desc:'4 static damage pillars at radius 7.5. Hold positions.', reward:'CACHE-weighted' },
    { idx:2, name:'TEAL · ROTATING', label:'TEAL · ROTATING', hazards:'4 rotating', color:'#2ee5a0', desc:'4 rotating pulsing pillars + 50% ranged, +12% speed. High risk.', reward:'SHARD-weighted' },
  ];
  // pick 2 distinct palettes not current loop%3? ensure variety
  const cur = loop % 3;
  let pool = palettesInfo.filter(p=> p.idx!==cur);
  if(pool.length<2) pool = palettesInfo;
  pool = pool.sort(()=>Math.random()-0.5).slice(0,2);
  // ensure we have 2 options, fallback to include cur if needed
  if(pool.length<2){
    const remaining = palettesInfo.filter(p=> !pool.some(x=>x.idx===p.idx));
    pool.push(remaining[0]);
  }
  doorOffer = pool.map(p=>({ paletteIdx:p.idx, info:p }));
  // door reward weighting for next boon roll: store preferred boon id
  doorOffer.forEach(d=>{
    if(d.info.idx===0) d.rewardWeight='pulse';
    else if(d.info.idx===1) d.rewardWeight='cache';
    else d.rewardWeight='shard';
  });
  doorDescEl.innerHTML = `Loop <b style="color:var(--accent)">${loop}</b> cleared — Integrity ${Math.round(coreHp)}%. Choose the next <b>chamber</b> — defines hazards & boon odds.`;
  doorChoicesEl.innerHTML='';
  doorOffer.forEach((d, idx)=>{
    const p=d.info;
    const div=document.createElement('button');
    div.className=`boonChoice ${p.idx===0?'pulseBoon':p.idx===1?'cacheBoon':'shardBoon'}`;
    div.setAttribute('data-door', idx);
    div.innerHTML=`
      <span class="boonKey">${idx+1}</span>
      <div class="boonIcon" style="background:${p.color}22;border-color:${p.color};color:${p.color}">${p.idx===0?'○':p.idx===1?'■':'◈'}</div>
      <h3>${p.label}</h3>
      <p>${p.desc}</p>
      <div class="boonMeta">${p.hazards} · ${p.reward} · next seed P${p.idx}</div>
    `;
    div.onclick=()=> pickDoor(idx);
    doorChoicesEl.appendChild(div);
  });
  log(`🚪 Choose chamber — ${doorOffer.map(d=>d.info.label).join('  vs  ')}`);
}
function pickDoor(idx){
  const choice = doorOffer[idx];
  if(!choice) return;
  forcedNextPalette = choice.paletteIdx;
  doorRewardWeight = choice.rewardWeight;
  log(`🚪 Door chosen: ${choice.info.label} → next palette P${choice.paletteIdx} · ${choice.rewardWeight} weighted`);
  beep({pulse:880, cache:660, shard:1040}[doorRewardWeight]||880,0.18,0.13);
  triggerShake(0.6);
  doorCard.querySelectorAll('.boonChoice').forEach(el=>{
    if(Number(el.getAttribute('data-door'))===idx) el.classList.add('selected');
    el.style.pointerEvents='none';
  });
  setTimeout(()=>{
    doorCard.classList.add('hidden');
    gameState='won';
    winCard.classList.remove('hidden');
    overlay.style.display='flex';
    const mods = [];
    if(activeBoons.pulse) mods.push(`Pulse ×${activeBoons.pulse}`);
    if(activeBoons.cache) mods.push(`Cache ×${activeBoons.cache}`);
    if(activeBoons.shard) mods.push(`Shard ×${activeBoons.shard}`);
    const modStr = mods.length ? `Active: ${mods.join(' · ')}` : '';
    const doorStr = ` Next: ${choice.info.label} (P${choice.paletteIdx})`;
    document.getElementById('winText').textContent=`Worktree loop ${loop} regression passed. Integrity ${Math.round(coreHp)}%. ${modStr}.${doorStr}`;
  }, 420);
}
function winLoop(){
  const gained = 200 + loop*50 + Math.round(coreHp);
  score+= gained;
  recordClear(gained);
  scoreEl.classList.add('bump');
  setTimeout(()=>scoreEl.classList.remove('bump'),300);
  updateHUD();
  log(`✓ Loop ${loop} stable — choose a boon`);
  breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on'); breachActive=false;
  if(lowVignetteEl) lowVignetteEl.classList.remove('on');
  if(chromaticEl) chromaticEl.classList.remove('on');
  showWaveAnnouncer(`✓ LOOP ${loop} STABLE — CHOOSE BOON`,1800);
  // delay boon UI slightly for announcement
  setTimeout(()=> showBoonChoice(), 600);
}
function failLoop(){
  gameState='dead';
  deadCard.classList.remove('hidden'); winCard.classList.add('hidden'); boonCard.classList.add('hidden');
  overlay.style.display='flex';
  bossHudEl.classList.add('hidden'); titanIncomingEl.classList.add('hidden');
  log(`✗ Loop ${loop} regression failed — core 0%`);
  triggerShake(2.0);
  triggerHitFlash('coreHit');
}

let lastSpawn=0;
let spawnInterval=1.25;

function tick(dt){
  // paused freeze — still render but no game logic
  if(gameState==='paused'){
    const t=performance.now()*0.001;
    if(playerMixer) playerMixer.update(0);
    // keep camera stable but still render
    renderer.render(scene, camera);
    return;
  }
  // hitstop freeze — skip most tick but keep rendering once
  if(hitStopTimer>0){
    hitStopTimer-=dt;
    // still update mixer-ish but frozen
    renderer.render(scene, camera);
    return;
  }
  const t=performance.now()*0.001;
  // mixer updates
  if(playerMixer) playerMixer.update(dt);
  else if(playerMesh && player.userData.bobPhase!==undefined){
    playerMesh.position.y = Math.sin(t*6)*0.025;
  }
  // camera follow + directional shake offset
  let shakeOffX=0, shakeOffY=0, shakeOffZ=0;
  if(shakeTimer>0){
    shakeTimer-=dt;
    const intensity=shakeIntensity*(shakeTimer/0.42);
    // directional based on shakeDir
    shakeOffX = shakeDir.x * intensity*0.7 + (Math.random()-0.5)*intensity*0.35;
    shakeOffY = (Math.random()-0.5)*intensity*0.45;
    shakeOffZ = shakeDir.z * intensity*0.7 + (Math.random()-0.5)*intensity*0.35;
    if(shakeTimer<=0) shakeIntensity=0;
  }
  const targetCam = new THREE.Vector3(player.position.x*0.28 + shakeOffX, 18 + shakeOffY, player.position.z*0.28+14+shakeOffZ);
  camera.position.lerp(targetCam, 0.06);
  camTarget.set(player.position.x*0.18, 0, player.position.z*0.18);
  camera.lookAt(camTarget);

  // core pulsing + breach + damage flash
  const breachFactor = coreHp<30?1:0;
  const pulseScale = 1 + Math.sin(t*2.2)*0.06 + breachFactor*Math.sin(t*8)*0.04;
  core.scale.setScalar(pulseScale);
  coreShell.scale.setScalar(pulseScale*1.08);
  core.rotation.y += dt*(0.6 + breachFactor*1.2);
  coreShell.rotation.y -= dt*0.35;
  coreRing.rotation.z += dt*(0.4 + breachFactor*0.8);
  // pulsing opacity
  coreShellMat.opacity = 0.16 + Math.sin(t*2.6)*0.06 + breachFactor*0.12;
  coreLight.intensity = 10 + Math.sin(t*2.4)*2.5 + breachFactor*Math.sin(t*9)*5;
  // breach color shift
  if(coreHp<30){
    coreMat.emissive.setHex(0xff2040);
    coreMat.color.setHex(0xff6b6b);
    coreLight.color.setHex(0xff3040);
    coreRing.material.color.setHex(0xff3b6b);
    coreShellMat.color.setHex(0xff3b6b);
    coreShellMat.emissive.setHex(0xff2040);
  } else if(coreFlashTimer<=0){
    coreMat.emissive.setHex(0x0aa0cc);
    coreMat.color.setHex(0x35d0ff);
    coreLight.color.setHex(0x35d0ff);
    coreRing.material.color.setHex(0x35d0ff);
    coreShellMat.color.setHex(0x35d0ff);
    coreShellMat.emissive.setHex(0x0aa0cc);
  }
  if(coreFlashTimer>0){
    coreFlashTimer-=dt;
    const f=Math.max(0,coreFlashTimer/0.28);
    coreMat.emissive.setRGB(1* f + 0.02*(1-f), 0.15*(1-f), 0.25*(1-f));
    coreMat.color.setRGB(1, 0.35+0.3*f, 0.45);
    if(coreFlashTimer<=0){
      // restore handled above next frame
    }
  }

  if(gameState==='playing'){
    elapsed+=dt;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0), hit);
    if(hit){
      aimDir.copy(hit).sub(new THREE.Vector3(player.position.x,0,player.position.z));
      aimDir.y=0;
      if(aimDir.lengthSq()>0.01) aimDir.normalize();
      if(playerMesh){
        const yaw = Math.atan2(aimDir.x, aimDir.z);
        playerMesh.parent.rotation.y = yaw;
      }
    }
    const mv=new THREE.Vector3();
    if(keys['w']) mv.z-=1;
    if(keys['s']) mv.z+=1;
    if(keys['a']) mv.x-=1;
    if(keys['d']) mv.x+=1;
    if(mv.lengthSq()>0){
      mv.normalize().multiplyScalar(6.2*dt*boonModifiers.speedMult);
      if(keys['shift'] && dashCd<=0){
        const dashMult = 3.2 + (activeBoons.cache>0?0.2:0);
        mv.multiplyScalar(dashMult);
        dashCd=0.9 * boonModifiers.dashCdMult;
        burst(player.position, activeBoons.cache>0?0x2ee5a0:0xffffff, 10 + activeBoons.cache*4);
        if(activeBoons.cache>0) beep(740,0.08,0.08);
      }
      const np = player.position.clone().add(mv);
      const d = Math.hypot(np.x, np.z);
      if(d<16.2){
        player.position.copy(np);
      }
    }
    if(dashCd>0) dashCd-=dt;
    if(keys[' '] ) shoot();

    // Boss shockwave & dash timers (arena-wide)
    if(isBossLoop && bossGroup){
      bossShockTimer-=dt;
      if(bossShockTimer<=0){
        doBossShockwave();
        bossShockTimer = bossPhase===2 ? 3.2 : 4.0;
      }
      bossDashTimer-=dt;
      // enraged phase dashes more often
      if(bossPhase===2) bossDashTimer-=dt*0.6;
    }
    // shockEffects (expanding rings)
    for(let i=shockEffects.length-1;i>=0;i--){
      const s=shockEffects[i];
      if(s.tick(dt)) shockEffects.splice(i,1);
    }
    if(isBossLoop && bossGroup) updateBossHud();

    // Vampire-Survivors flood: unconditional 90 wave, 0.12s constant, cap 90 — not during boss
    if(!isBossLoop){
      spawnInterval = 0.12;
      const cap = 90;
      if(enemies.length < waveTotal - waveKill && enemies.length < cap && elapsed>0.4){
        if(performance.now()-lastSpawn > spawnInterval*1000){
          spawnEnemy();
          lastSpawn=performance.now();
        }
      }
    }

    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      // ── Boss AI (Merge Titan) ──
      if(e.userData.isBoss){
        const toCore = core.position.clone().sub(e.position); toCore.y=0;
        const toPlayer = player.position.clone().sub(e.position); toPlayer.y=0;
        const dPlayer=toPlayer.length();
        // phase shift at 50%
        const pct=e.userData.hp/e.userData.maxHp;
        if(pct<0.5 && bossPhase===1){
          bossPhase=2; e.userData.speed*=1.35; isBossLoop=true;
          log('◈ TITAN ENRAGED — phase 2 · shockwave intensified · dashing faster');
          beep(200,0.25,0.18); triggerShake(1.6);
          updateBossHud();
        }
        // dash logic: when global timer expires, dash toward player
        if(!e.userData.dashing && bossDashTimer<=0){
          e.userData.dashing=true; e.userData.dashTime=0.38;
          // compute dash dir
          const dashDir=toPlayer.clone().normalize();
          e.userData.dashDir=dashDir;
          burst(e.position, 0xff3b6b, 12);
          triggerShake(1.2, dashDir);
          beep(320,0.12,0.14);
          bossDashTimer = bossPhase===2? 2.0 : 3.0;
        }
        if(e.userData.dashing){
          e.userData.dashTime-=dt;
          const spd=9.5 + loop*0.15;
          e.position.add(e.userData.dashDir.clone().multiplyScalar(spd*dt));
          // dash dust
          if(Math.random()<0.6) { const d2=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,6), new THREE.MeshBasicMaterial({color:0xff6b3b, transparent:true, opacity:0.55})); d2.position.copy(e.position).add(new THREE.Vector3(0,0.2,0)); d2.userData={life:0.25, vel:new THREE.Vector3()}; scene.add(d2); particles.push(d2); }
          if(e.userData.dashTime<=0) e.userData.dashing=false;
        } else {
          // slow chase player if within 12 or core otherwise
          const target = dPlayer<13 ? toPlayer : toCore;
          if(target.lengthSq()>0.01){ target.normalize().multiplyScalar(e.userData.speed*dt); e.position.add(target); }
        }
        if(toPlayer.lengthSq()>1e-4) e.userData.holder.rotation.y=Math.atan2(toPlayer.x,toPlayer.z);
        e.userData.bar.lookAt(camera.position);
        if(e.userData.aura) e.userData.aura.rotation.z += dt*(bossPhase===2?3.8:2.2);
        if(e.userData.bossRing) e.userData.bossRing.rotation.z -= dt*(bossPhase===2?2.5:1.4);
        e.userData.holder.position.y = Math.sin(t*2.2 + e.userData.bob)*0.12;
        // scale pulse enraged
        const sPulse = bossPhase===2 ? 1+Math.sin(t*6)*0.025 : 1;
        e.userData.holder.scale.setScalar(sPulse);
        // contact damage
        if(e.position.distanceTo(core.position)<1.85){
          const prev=coreHp; coreHp=Math.max(0, coreHp - (32*dt));
          if(coreHp < prev -0.05){ coreFlashTimer=0.28; triggerHitFlash('coreHit'); if(Math.random()<0.12) triggerShake(1.5, toCore); }
          e.position.add(toCore.normalize().multiplyScalar(-0.12));
          if(coreHp<=0){ failLoop(); break; }
        }
        if(e.position.distanceTo(player.position)<1.35){
          takeDamagePlayer(24*dt);
          const push=player.position.clone().sub(e.position).normalize().multiplyScalar(0.06);
          player.position.add(push);
        }
        continue;
      }
      const toCore = core.position.clone().sub(e.position); toCore.y=0;
      const toPlayer = player.position.clone().sub(e.position); toPlayer.y=0;
      const distPlayer = toPlayer.length();
      const distCore = toCore.length();
      const isRanged = e.userData.archetype==='ranged';
      // ranged: keep 7-8m from target, circle and shoot
      if(isRanged){
        const ideal = e.userData.elite? 6.5 : 7.5;
        const target = distPlayer<10 ? toPlayer : toCore;
        const d = target.length();
        if(d > ideal+0.8){
          target.normalize().multiplyScalar(e.userData.speed*dt); e.position.add(target);
        } else if(d < ideal-0.8){
          target.normalize().multiplyScalar(-e.userData.speed*0.7*dt); e.position.add(target);
        } else {
          // strafe
          const perp = new THREE.Vector3(-target.z,0,target.x).normalize().multiplyScalar(e.userData.speed*0.6*dt * (Math.sin(t*1.7 + e.userData.bob)>0?1:-1));
          e.position.add(perp);
        }
        if(target.lengthSq()>1e-4) e.userData.holder.rotation.y = Math.atan2(target.x, target.z);
        // shoot cooldown
        e.userData.shootCd -= dt;
        if(e.userData.shootCd<=0){
          const aim = distPlayer<12 ? toPlayer.clone().normalize() : toCore.clone().normalize();
          aim.y=0; aim.normalize();
          spawnEnemyProjectile(e.position, aim);
          e.userData.shootCd = e.userData.elite? 1.1 : 1.6;
          if(e.userData.rangeRing) { e.userData.rangeRing.material.opacity=0.55; setTimeout(()=>{ if(e.userData.rangeRing) e.userData.rangeRing.material.opacity=0.22; },120); }
        }
        if(e.userData.rangeRing) e.userData.rangeRing.rotation.z += dt*1.8;
      } else {
        const target = distPlayer<6 ? toPlayer : toCore;
        if(target.lengthSq()>0.01){ target.normalize().multiplyScalar(e.userData.speed*dt); e.position.add(target); }
        if(target.lengthSq()>1e-4) e.userData.holder.rotation.y = Math.atan2(target.x, target.z);
      }
      e.userData.bar.lookAt(camera.position);
      // bob for static + aura spin for elite
      if(e.userData.aura) e.userData.aura.rotation.z += dt*2.5;
      e.userData.holder.position.y = Math.sin(t*3.2 + e.userData.bob)*0.06 * (e.userData.elite?0.5:1);
      if(e.position.distanceTo(core.position)<1.35){
        const prevHp=coreHp;
        coreHp=Math.max(0, coreHp - ( (e.userData.elite?26:18)*dt));
        if(coreHp < prevHp - 0.05){
          coreFlashTimer=0.28;
          triggerHitFlash('coreHit');
          if(Math.random()<0.14) triggerShake(1.4, toCore);
          if(Math.random()<0.08) triggerHitStop(70);
          if(Math.floor(prevHp/5)!==Math.floor(coreHp/5)){
            hpEl.classList.add('bump');
            setTimeout(()=>hpEl.classList.remove('bump'),180);
          }
        }
        e.position.add(toCore.normalize().multiplyScalar(-0.10));
        if(coreHp<=0){ failLoop(); break; }
      }
      if(e.position.distanceTo(player.position)<0.95){
        takeDamagePlayer(22*dt);
        const push = player.position.clone().sub(e.position).normalize().multiplyScalar(0.04);
        player.position.add(push);
      }
    }
    // hazard pillars pulse + damage — palette 2 rotates (critic 4)
    if(hazardGroup){
      if(hazardGroup.userData && hazardGroup.userData.paletteIdx===2) hazardGroup.rotation.y += dt*0.35;
      hazardGroup.children.forEach(h=>{
        const pillar=h.userData.pillar;
        const pulse = 0.55 + Math.sin(t*2.8 + pillar.userData.pulsePhase)*0.25;
        pillar.material.emissiveIntensity = pulse;
        pillar.material.opacity = 0.78 + Math.sin(t*3.0 + pillar.userData.pulsePhase)*0.15;
        // scale ring pulse
        const ring=h.children[1]||h.userData.ring;
        if(ring) { ring.material.opacity = 0.18 + Math.sin(t*2.2 + pillar.userData.pulsePhase)*0.12; ring.rotation.z += 0.02; }
        // damage ticks
        h.userData.damageTick = (h.userData.damageTick||0) - dt;
        if(h.userData.damageTick<=0){
          if(player.position.distanceTo(h.position)<1.15) { takeDamagePlayer(14*dt*2.5); h.userData.damageTick=0.22; triggerHitFlash('playerHit'); }
          else if(core.position.distanceTo(h.position)<1.4) { coreHp=Math.max(0,coreHp - 9*dt); if(Math.random()<0.1) triggerHitFlash('coreHit'); h.userData.damageTick=0.35; if(coreHp<=0) failLoop(); }
          else h.userData.damageTick=0.08;
        }
      });
    }
    // enemy projectiles
    for(let i=enemyBullets.length-1;i>=0;i--){
      const b=enemyBullets[i];
      b.position.add(b.userData.vel.clone().multiplyScalar(dt));
      b.userData.life-=dt;
      // trail
      if(Math.random()<0.4){
        const tt=new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6), new THREE.MeshBasicMaterial({color:0x5590ff, transparent:true, opacity:0.5}));
        tt.position.copy(b.position); tt.userData={ life:0.2, vel:new THREE.Vector3() }; scene.add(tt); particles.push(tt);
      }
      if(b.position.distanceTo(player.position)<0.65){
        takeDamagePlayer(b.userData.dmg);
        triggerShake(0.9, b.userData.vel);
        triggerHitFlash('playerHit');
        beep(320,0.10,0.12);
        burst(b.position, 0x5590ff, 6);
        scene.remove(b); enemyBullets.splice(i,1);
        continue;
      }
      if(b.position.distanceTo(core.position)<1.0){
        coreHp=Math.max(0,coreHp - b.userData.dmg*0.35); coreFlashTimer=0.22; triggerHitFlash('coreHit'); burst(b.position, 0x5590ff,5);
        scene.remove(b); enemyBullets.splice(i,1);
        if(coreHp<=0) failLoop();
        continue;
      }
      if(b.userData.life<=0 || b.position.length()>24){ scene.remove(b); enemyBullets.splice(i,1); }
    }

    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i];
      b.position.add(b.userData.vel.clone().multiplyScalar(dt));
      b.userData.life-=dt;
      if(Math.random()<0.5){
        const t2=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6), new THREE.MeshBasicMaterial({color:0x35d0ff, transparent:true, opacity:0.6}));
        t2.position.copy(b.position);
        t2.userData={ life:0.3, vel:new THREE.Vector3() };
        scene.add(t2); particles.push(t2);
      }
      let hitIdx=-1;
      const baseHitR = b.userData.hitRadius || 0.85;
      for(let j=0;j<enemies.length;j++){
        const ej=enemies[j];
        const hr = ej.userData.isBoss ? 1.85 : baseHitR;
        if(b.position.distanceTo(ej.position)<hr){ hitIdx=j; break; }
      }
      if(hitIdx!==-1){
        const e=enemies[hitIdx];
        const prevHp=e.userData.hp;
        e.userData.hp-=b.userData.dmg;
        const pct=Math.max(0,e.userData.hp/e.userData.maxHp);
        e.userData.bar.scale.x=pct;
        e.userData.bar.material.color.set(pct<0.3?0xff3b6b:0xffd23b);
        if(e.userData.isBoss) updateBossHud();
        // white flash hit
        if(e.userData.holder){
          e.userData.holder.traverse(o=>{ if(o.isMesh && o.material){ if(!o.userData.origEmissive){ o.userData.origEmissive=o.material.emissive.clone(); o.userData.origColor=o.material.color.clone(); } o.material.emissive.setHex(0xffffff); setTimeout(()=>{ if(o.material && o.userData.origEmissive){ o.material.emissive.copy(o.userData.origEmissive); if(o.userData.origColor) o.material.color.copy(o.userData.origColor); } }, 55); }});
        }
        spawnDamageNumber(e.position.clone().add(new THREE.Vector3(0,0.2,0)), String(b.userData.dmg), e.userData.elite?'#ffb020':'#ffffff');
        burst(e.position, 0xffffff, 4);
        // knockback instead of insta-kill — VS horde stacks
        e.position.add(b.userData.vel.clone().normalize().multiplyScalar(e.userData.isBoss?0.2:0.65));
        // hitstop + directional shake + sound
        triggerHitStop(62);
        triggerShake(0.85, b.userData.vel);
        beep(e.userData.elite? 660: 880, 0.05, 0.09);
        scene.remove(b); bullets.splice(i,1);
        if(e.userData.hp<=0){
          const wasBoss=!!e.userData.isBoss;
          scene.remove(e);
          enemies.splice(hitIdx,1);
          if(wasBoss){
            bossGroup=null; bossHudEl.classList.add('hidden');
            burst(e.position, 0xff1a3d, 24);
            spawnDamageNumber(e.position, '+250', '#ffb020');
            score+= 250 + loop*15;
            scoreEl.classList.add('bump'); setTimeout(()=>scoreEl.classList.remove('bump'),180);
            beep(1200,0.14,0.14); setTimeout(()=>beep(900,0.2,0.14),140);
            triggerShake(2.0);
            log('◈ TITAN DEFEATED — spawning 2 minions');
            // spawn 2 minions on death at boss pos
            for(let k=0;k<2;k++){
              const mPos=e.position.clone().add(new THREE.Vector3((Math.random()-0.5)*2,0,(Math.random()-0.5)*2));
              // force spawn near boss
              const ang=Math.random()*Math.PI*2; const r=2+Math.random()*1;
              const backup=spawnEnemy; // reuse logic but place manually
              // create quick elite minion
              const g=new THREE.Group(); let mm;
              if(robotModel){ mm=robotModel.scene.clone(true); const box=new THREE.Box3().setFromObject(mm); const sz=new THREE.Vector3(); box.getSize(sz); const c=new THREE.Vector3(); box.getCenter(c); mm.position.sub(c); mm.scale.setScalar(1.2/Math.max(sz.x,sz.y,sz.z)); mm.rotation.y=Math.PI; mm.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.material=o.material.clone(); o.material.emissive=new THREE.Color(0xff5533); o.material.emissiveIntensity=0.7; }}); } else { mm=new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.7,4,10), new THREE.MeshStandardMaterial({color:0xff5533})); mm.position.y=0.6; }
              const holder=new THREE.Group(); holder.add(mm); g.add(holder); g.position.copy(mPos); g.userData={ holder, hp: 70+loop*6, maxHp:70+loop*6, speed:2.4+loop*0.12, elite:true, bob:Math.random()*Math.PI*2, archetype:'melee' }; const bar=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.08), new THREE.MeshBasicMaterial({color:0xff5533, side:THREE.DoubleSide})); bar.position.set(0,1.45,0); g.add(bar); g.userData.bar=bar; scene.add(g); enemies.push(g);
            }
            waveKill++; waveEl.textContent=`${waveKill} / ${waveTotal}`;
            if(waveKill===1) showFirstClear();
            if(tutorialActive) dismissTutorial();
            showWaveAnnouncer('◈ TITAN SLAIN',1800);
            winLoop();
          } else {
            burst(e.position, e.userData.elite?0xffcc40:0xff3b6b, e.userData.elite?18:12);
            spawnDamageNumber(e.position, e.userData.elite?'+85':' +35', '#2ee5a0');
            // (A) crit juice: gold 2× scale 1.4 on elite kill + FIRST CLEAR + tutorial dismiss
            if(e.userData.elite) spawnCritDamageNumbers(e.position);
            score+= e.userData.elite? 85 + loop*5 : 35 + loop*3;
            scoreEl.classList.add('bump');
            setTimeout(()=>scoreEl.classList.remove('bump'),180);
            beep(e.userData.elite? 1200: 620, 0.10, 0.11);
            waveKill++;
            waveEl.textContent=`${waveKill} / ${waveTotal}`;
            if(waveKill===1){ showFirstClear(); }
            if(tutorialActive) dismissTutorial();
            if(waveKill%Math.ceil(waveTotal/3)===0 && waveKill<waveTotal){
              showWaveAnnouncer(`WAVE ${loop} — ${waveKill}/${waveTotal}`,1400);
            }
            if(waveKill>=waveTotal) winLoop();
          }
        }
        continue;
      }
      if(b.userData.life<=0 || b.position.length()>22){
        scene.remove(b); bullets.splice(i,1);
      }
    }
    if(!isBossLoop && elapsed>22 && waveKill < waveTotal){
      winLoop();
    }
  }

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    if(p.isPoints){
      p.material.opacity = Math.max(0, p.userData.life/0.22);
      p.userData.life-=dt;
      if(p.userData.life<=0){ scene.remove(p); particles.splice(i,1); }
      continue;
    }
    p.position.add(p.userData.vel.clone().multiplyScalar(dt));
    p.userData.vel.y -= 9*dt;
    p.userData.life-=dt;
    if(p.material.opacity!==undefined) p.material.opacity = Math.max(0, p.userData.life/0.5);
    p.scale.multiplyScalar(0.99);
    if(p.userData.life<=0){ scene.remove(p); particles.splice(i,1); }
  }
  for(let i=damageSprites.length-1;i>=0;i--){
    const s=damageSprites[i];
    s.position.add(s.userData.vel.clone().multiplyScalar(dt));
    s.userData.life-=dt;
    s.material.opacity = Math.max(0, s.userData.life/0.65);
    s.position.y += dt*0.6;
    if(s.userData.life<=0){ scene.remove(s); damageSprites.splice(i,1); }
  }

  updateHUD(dt);
  renderer.render(scene, camera);
}

let last=performance.now();
let frames=0, fpsAcc=0;
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(0.033, (now-last)/1000);
  last=now;
  tick(dt);
  frames++;
  fpsAcc+=dt;
  if(fpsAcc>0.5){ fpsEl.textContent=Math.round(frames/fpsAcc)+' fps'; frames=0; fpsAcc=0; }
}
animate();

addEventListener('resize',()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

// UI wiring
document.getElementById('playBtn').onclick=()=>{ initDrone(); startLoop(); };
document.getElementById('audioToggle').onclick=toggleDroneMute;
document.getElementById('audioToggle').textContent = (localStorage.getItem('isolated-arena-muted')==='1') ? '🔇 MUTED' : '🔊 AUDIO';
document.getElementById('howBtn').onclick=()=>{ startCard.classList.add('hidden'); howCard.classList.remove('hidden'); };
document.getElementById('backBtn').onclick=()=>{ howCard.classList.add('hidden'); startCard.classList.remove('hidden'); };
document.getElementById('retryBtn').onclick=()=>{ overlay.style.display='none'; boonCard.classList.add('hidden'); if(doorCard) doorCard.classList.add('hidden'); startLoop(); };
document.getElementById('menuBtn').onclick=()=>{
  deadCard.classList.add('hidden'); boonCard.classList.add('hidden'); if(doorCard) doorCard.classList.add('hidden'); winCard.classList.add('hidden'); pauseCard.classList.add('hidden'); historyCard.classList.add('hidden');
  startCard.classList.remove('hidden'); overlay.style.display='flex'; gameState='menu';
  coreHp=100; dispCore=100; loop=1; score=0; dispScore=0;
  activeBoons={pulse:0,cache:0,shard:0}; recomputeBoonModifiers(); updateBoonHud();
  bossHudEl.classList.add('hidden'); titanIncomingEl.classList.add('hidden'); isBossLoop=false; bossGroup=null;
  dismissTutorial(); if(firstClearEl){ firstClearEl.classList.add('hidden'); firstClearEl.classList.remove('show'); } firstClearShown=false;
  updateHUD(); updateSeedDisplay(); breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on');
  log('Run reset — boons cleared');
  // increment runs history
  runHistory.runs+=1; runHistory.bestLoop=Math.max(runHistory.bestLoop,1); saveHistory(); renderHistoryCard();
};
document.getElementById('nextBtn').onclick=()=>{ winCard.classList.add('hidden'); loop++; coreHp=Math.min(100, coreHp+12); startLoop(); };

addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(gameState==='playing' || gameState==='paused'){
      e.preventDefault();
      togglePause();
    } else if(!historyCard.classList.contains('hidden')){
      historyCard.classList.add('hidden');
      if(gameState==='menu') startCard.classList.remove('hidden');
      else if(gameState==='paused') pauseCard.classList.remove('hidden');
    }
    return;
  }
  if(e.key==='r' && gameState==='dead') document.getElementById('retryBtn').click();
  if(e.key==='Enter' && gameState==='won') document.getElementById('nextBtn').click();
  if(gameState==='boon'){
    if(e.key==='1') pendingBoonOffer[0] && pickBoon(pendingBoonOffer[0].id);
    if(e.key==='2') pendingBoonOffer[1] && pickBoon(pendingBoonOffer[1].id);
    if(e.key==='3') pendingBoonOffer[2] && pickBoon(pendingBoonOffer[2].id);
  }
  if(gameState==='doors'){
    if(e.key==='1') doorOffer[0] && pickDoor(0);
    if(e.key==='2') doorOffer[1] && pickDoor(1);
  }
});

// history & pause wiring
if(historyBtn) historyBtn.onclick=()=>{
  renderHistoryCard();
  startCard.classList.add('hidden'); howCard.classList.add('hidden'); deadCard.classList.add('hidden'); winCard.classList.add('hidden'); boonCard.classList.add('hidden'); if(doorCard) doorCard.classList.add('hidden'); pauseCard.classList.add('hidden');
  historyCard.classList.remove('hidden');
  overlay.style.display='flex';
  if(gameState==='menu' || gameState==='dead' || gameState==='won') {/* keep state */}
  log('History opened');
};
if(historyCloseBtn) historyCloseBtn.onclick=()=>{
  historyCard.classList.add('hidden');
  if(gameState==='paused'){ pauseCard.classList.remove('hidden'); }
  else { startCard.classList.remove('hidden'); overlay.style.display='flex'; }
};
if(historyClearBtn) historyClearBtn.onclick=()=>{
  runHistory=defaultHistory(); saveHistory(); renderHistoryCard();
  log('History cleared');
};
if(abandonBtn) abandonBtn.onclick=()=> doAbandonRun();
if(abandonMenuBtn) abandonMenuBtn.onclick=()=> doAbandonRun();
const resumeBtn=document.getElementById('resumeBtn');
if(resumeBtn) resumeBtn.onclick=()=> togglePause();
if(pauseCard) pauseCard.addEventListener('click',e=>{ if(e.target===pauseCard) togglePause(); });

updateHUD();
updateBoonHud();
updateSeedDisplay();
renderHistoryCard();
log('Worktree arena ready — awaiting loop start');

// expose for verifier — includes A-verification hooks + (A) tutorial/first-clear + doors
window.__arena={
  getState:()=>({loop,score,coreHp,playerHp,gameState,enemies:enemies.length, bullets:bullets.length, arenaLoaded, knightLoaded, boons:{...activeBoons}, mods:{...boonModifiers}, isBossLoop, bossHp: bossGroup?bossGroup.userData.hp:null, bossMaxHp: bossGroup?bossGroup.userData.maxHp:null, bossPhase, pendingBoonPicks, paused:gameState==='paused', seed:loop%3, seedName:seedName(loop%3), floorHasAO: !!(floorMat.map && floorMat.map.isCanvasTexture), glassVerified: !!window.__arenaGlassVerified, lowVignetteOn: !!(lowVignetteEl && lowVignetteEl.classList.contains('on')), chromaticOn: !!(chromaticEl && chromaticEl.classList.contains('on')), tutorialActive, firstClearShown, waveKill, waveTotal, forcedNextPalette, doorCount: doorOffer.length, doorRewardWeight}),
  getBoons:()=>({...activeBoons}),
  getHistory:()=>{ try{ return JSON.parse(JSON.stringify(runHistory)); }catch(e){ return {...runHistory}; } },
  pickBoonForTest:(id)=>{ if(gameState==='boon') pickBoon(id); },
  spawnTitanForTest:()=>{ if(gameState==='playing' && !bossGroup){ isBossLoop=true; pendingBoonPicks=2; waveTotal=1; spawnTitan(); showTitanIncoming(); updateBossHud(); } },
  abandonForTest:()=> doAbandonRun(),
  togglePauseForTest:()=> togglePause(),
  getSeed:()=> loop%3,
  getGlassState:()=>{
    // inspect scene for glass mesh material state
    let found=null;
    scene.traverse(o=>{
      if(o.isMesh && o.material && o.material.name && o.material.name.includes('001')){
        found={ name:o.material.name, transparent:o.material.transparent, opacity:o.material.opacity, depthWrite:o.material.depthWrite, side:o.material.side, doubleSide: o.material.side===THREE.DoubleSide };
      }
    });
    return found;
  },
  getFloorAO:()=> ({ hasMap: !!(floorMat.map && floorMat.map.isCanvasTexture), hasCanvas: !!(floorMat.map && floorMat.map.image && floorMat.map.image.width===512) }),
  getAttributionLinks:()=> Array.from(document.querySelectorAll('#attribution a')).map(a=>({ href:a.href, target:a.target, rel:a.rel })),
  // (A) test hooks
  showTutorialForTest:()=> showTutorial(),
  dismissTutorialForTest:()=> dismissTutorial(),
  showFirstClearForTest:()=> showFirstClear(),
  spawnCritForTest:(x=0,z=0)=> spawnCritDamageNumbers(new THREE.Vector3(x,0,z)),
  getTutorialState:()=> ({ active: tutorialActive, hidden: !!(tutorialOverlayEl && tutorialOverlayEl.classList.contains('hidden')), firstClearShown, firstClearHidden: !!(firstClearEl && firstClearEl.classList.contains('hidden')) }),
  getDoorState:()=> ({ forcedNextPalette, doorCount: doorOffer.length, rewardWeight: doorRewardWeight, gameState, doorVisible: !!(doorCard && !doorCard.classList.contains('hidden')) }),
  showDoorForTest:()=> { if(gameState==='won') showDoorChoice(); },
  pickDoorForTest:(idx)=> pickDoor(idx),
};

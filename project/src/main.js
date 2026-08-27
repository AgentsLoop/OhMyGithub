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
const mobileControlsEl = document.getElementById('mobileControls');
const joystickEl = document.getElementById('joystick');
const joyStickEl = document.getElementById('joyStick');
const actionBtnEl = document.getElementById('actionBtn');

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

// floor + arena bounds
const floorGeo = new THREE.CircleGeometry(18, 64);
const floorMat = new THREE.MeshStandardMaterial({ color:0x0e1a28, roughness:0.9, metalness:0.05 });
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

// state
let loop=1, score=0, coreHp=100, playerHp=100, waveKill=0, waveTotal=0, elapsed=0, waveActive=false, gameState='menu';
let enemies=[], bullets=[], particles=[], sparks=[];
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
    g.traverse(o=>{ if(o.isMesh && o.material){ o.material.transparent=false; o.material.opacity=1; if(o.material.color) o.material.side=THREE.DoubleSide; }});
    scene.add(g);
    arenaLoaded=true;
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
function spawnDamageNumber(pos, text, color='#ffffff'){
  // create canvas texture sprite
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  canvas.width=256; canvas.height=128;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font='700 56px Space Grotesk, sans-serif';
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
  spr.scale.set(1.6,0.8,1);
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
}
// cheap beep via WebAudio
let audioCtx=null;
function beep(freq=880, dur=0.08, vol=0.12){
  try{
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
    o.type='square'; o.frequency.value=freq;
    g.gain.value=vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+dur);
    o.stop(audioCtx.currentTime+dur);
  }catch(e){}
}

function shoot(){
  const now=performance.now();
  if(now-lastShot<180) return;
  lastShot=now;
  const dir = aimDir.clone();
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.14,10,10), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0x35d0ff, emissiveIntensity:2 }));
  b.position.copy(player.position).add(new THREE.Vector3(0,0.6,0)).add(dir.clone().multiplyScalar(0.6));
  b.userData={ vel: dir.multiplyScalar(18), life:1.6, dmg: 26 };
  b.castShadow=false;
  scene.add(b);
  bullets.push(b);
  const flash = new THREE.PointLight(0x35d0ff, 6, 4);
  flash.position.copy(b.position);
  scene.add(flash);
  setTimeout(()=>scene.remove(flash),80);
  player.position.add(dir.clone().multiplyScalar(-0.06));
  // subtle shoot shake
  if(gameState==='playing') triggerShake(0.6);
}

function spawnEnemy(){
  const ang = Math.random()*Math.PI*2;
  const r = 16.5 + Math.random()*1.5;
  const pos = new THREE.Vector3(Math.cos(ang)*r, 0, Math.sin(ang)*r);
  const g = new THREE.Group();
  let mesh;
  const isElite = (waveKill + enemies.length) % 5 === 4 || Math.random()<0.15; // every ~5th is elite
  if(robotModel){
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
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(isElite?0.42:0.32,isElite?0.9:0.7,4,10), new THREE.MeshStandardMaterial({color:isElite?0xff1a3d:0xff3b6b, emissive:isElite?0x880010:0x550010, emissiveIntensity:isElite?0.9:0.6}));
    mesh.position.y=0.6;
    mesh.castShadow=true;
  }
  const holder=new THREE.Group(); holder.add(mesh);
  g.add(holder);
  g.position.copy(pos);
  g.userData={ holder, hp: isElite? 140+loop*12 : 70+loop*8, speed: isElite? 2.8+loop*0.2 : 2.2+loop*0.18+Math.random()*0.6, maxHp: isElite?140+loop*12:70+loop*8, elite:isElite, bob:Math.random()*Math.PI*2 };
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(isElite?1.1:0.9, isElite?0.11:0.08), new THREE.MeshBasicMaterial({color:isElite?0xff1a3d:0xff3b6b, side:THREE.DoubleSide}));
  bar.position.set(0, isElite?1.65:1.45,0);
  g.add(bar);
  g.userData.bar=bar;
  if(isElite){
    const aura=new THREE.Mesh(new THREE.RingGeometry(0.85,0.95,16), new THREE.MeshBasicMaterial({color:0xff3b6b, transparent:true, opacity:0.35, side:THREE.DoubleSide}));
    aura.rotation.x=-Math.PI/2; aura.position.y=0.03;
    g.add(aura); g.userData.aura=aura;
  }
  scene.add(g);
  enemies.push(g);
  burst(pos, isElite?0xff1a3d:0xff3b6b, isElite?14:8);
  if(isElite) beep(440,0.12,0.10);
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
  // breach warning toggle
  const shouldBreach = coreHp>0 && coreHp<30 && gameState==='playing';
  if(shouldBreach && !breachActive){
    breachActive=true;
    breachWarnEl.classList.remove('hidden');
    vignetteEl.classList.add('on');
  } else if(!shouldBreach && breachActive){
    breachActive=false;
    breachWarnEl.classList.add('hidden');
    vignetteEl.classList.remove('on');
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

async function startLoop(){
  waveKill=0;
  waveTotal = Math.min(28, 6 + loop*3);
  elapsed=0;
  waveActive=true;
  enemies.forEach(e=>scene.remove(e)); enemies.length=0;
  bullets.forEach(b=>scene.remove(b)); bullets.length=0;
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
  breachActive=false; breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on');
  log(`→ Loop ${loop} isolated checkout — spawning ${waveTotal} conflicts`);
  updateHUD();
  await runCountdown(loop);
  if(gameState!=='countdown') return;
  gameState='playing';
  lastSpawn=performance.now();
  showWaveAnnouncer(`WAVE ${loop} — ${waveTotal} CONFLICTS`);
  log(`▶ Wave ${loop} active — defend the core`);
  for(let i=0;i<3;i++) setTimeout(()=>{ if(gameState==='playing') spawnEnemy(); }, i*420);
}

function winLoop(){
  gameState='won';
  winCard.classList.remove('hidden');
  startCard.classList.add('hidden'); howCard.classList.add('hidden'); deadCard.classList.add('hidden');
  overlay.style.display='flex';
  score+= 200 + loop*50 + Math.round(coreHp);
  // bump score
  scoreEl.classList.add('bump');
  setTimeout(()=>scoreEl.classList.remove('bump'),300);
  updateHUD();
  document.getElementById('winText').textContent=`Worktree loop ${loop} regression passed. Integrity ${Math.round(coreHp)}%. Next checkout gets harder (+3 enemies, +8% speed).`;
  log(`✓ Loop ${loop} stable — advancing`);
  breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on'); breachActive=false;
  showWaveAnnouncer(`✓ LOOP ${loop} STABLE`,1800);
}
function failLoop(){
  gameState='dead';
  deadCard.classList.remove('hidden'); winCard.classList.add('hidden');
  overlay.style.display='flex';
  log(`✗ Loop ${loop} regression failed — core 0%`);
  triggerShake(2.0);
  triggerHitFlash('coreHit');
}

let lastSpawn=0;
let spawnInterval=1.25;

function tick(dt){
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
      mv.normalize().multiplyScalar(6.2*dt);
      if(keys['shift'] && dashCd<=0){
        mv.multiplyScalar(3.2);
        dashCd=0.9;
        burst(player.position, 0xffffff, 10);
      }
      const np = player.position.clone().add(mv);
      const d = Math.hypot(np.x, np.z);
      if(d<16.2){
        player.position.copy(np);
      }
    }
    if(dashCd>0) dashCd-=dt;
    if(keys[' '] ) shoot();

    // Vampire-Survivors density: 40 cap, accelerating curve per loop
    spawnInterval = Math.max(0.38, 1.1 * Math.pow(0.88, waveKill) - loop*0.04);
    const cap = Math.min(40, 14 + Math.floor(loop*2.2));
    if(performance.now()-lastSpawn > spawnInterval*1000){
      if(enemies.length < waveTotal - waveKill && enemies.length < cap){
        if(Math.random()<0.92){
          spawnEnemy();
          lastSpawn=performance.now();
        }
      }
    }

    for(let i=enemies.length-1;i>=0;i--){
      const e=enemies[i];
      const toCore = core.position.clone().sub(e.position); toCore.y=0;
      const toPlayer = player.position.clone().sub(e.position); toPlayer.y=0;
      const distPlayer = toPlayer.length();
      const target = distPlayer<6 ? toPlayer : toCore;
      if(target.lengthSq()>0.01){ target.normalize().multiplyScalar(e.userData.speed*dt); e.position.add(target); }
      if(target.lengthSq()>1e-4) e.userData.holder.rotation.y = Math.atan2(target.x, target.z);
      e.userData.bar.lookAt(camera.position);
      // bob for static robots + aura spin for elite
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
      for(let j=0;j<enemies.length;j++){
        if(b.position.distanceTo(enemies[j].position)<0.85){ hitIdx=j; break; }
      }
      if(hitIdx!==-1){
        const e=enemies[hitIdx];
        const prevHp=e.userData.hp;
        e.userData.hp-=b.userData.dmg;
        const pct=Math.max(0,e.userData.hp/e.userData.maxHp);
        e.userData.bar.scale.x=pct;
        e.userData.bar.material.color.set(pct<0.3?0xff3b6b:0xffd23b);
        // white flash hit
        if(e.userData.holder){
          e.userData.holder.traverse(o=>{ if(o.isMesh && o.material){ if(!o.userData.origEmissive){ o.userData.origEmissive=o.material.emissive.clone(); o.userData.origColor=o.material.color.clone(); } o.material.emissive.setHex(0xffffff); setTimeout(()=>{ if(o.material && o.userData.origEmissive){ o.material.emissive.copy(o.userData.origEmissive); if(o.userData.origColor) o.material.color.copy(o.userData.origColor); } }, 55); }});
        }
        spawnDamageNumber(e.position.clone().add(new THREE.Vector3(0,0.2,0)), String(b.userData.dmg), e.userData.elite?'#ffb020':'#ffffff');
        burst(e.position, 0xffffff, 4);
        // hitstop + directional shake + sound
        triggerHitStop(62);
        triggerShake(0.85, b.userData.vel);
        beep(e.userData.elite? 660: 880, 0.05, 0.09);
        scene.remove(b); bullets.splice(i,1);
        if(e.userData.hp<=0){
          scene.remove(e);
          enemies.splice(hitIdx,1);
          burst(e.position, e.userData.elite?0xffcc40:0xff3b6b, e.userData.elite?18:12);
          spawnDamageNumber(e.position, e.userData.elite?'+85':' +35', '#2ee5a0');
          score+= e.userData.elite? 85 + loop*5 : 35 + loop*3;
          scoreEl.classList.add('bump');
          setTimeout(()=>scoreEl.classList.remove('bump'),180);
          beep(e.userData.elite? 1200: 620, 0.10, 0.11);
          waveKill++;
          waveEl.textContent=`${waveKill} / ${waveTotal}`;
          if(waveKill%Math.ceil(waveTotal/3)===0 && waveKill<waveTotal){
            showWaveAnnouncer(`WAVE ${loop} — ${waveKill}/${waveTotal}`,1400);
          }
          if(waveKill>=waveTotal) winLoop();
        }
        continue;
      }
      if(b.userData.life<=0 || b.position.length()>22){
        scene.remove(b); bullets.splice(i,1);
      }
    }
    if(elapsed>22 && waveKill < waveTotal){
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
document.getElementById('playBtn').onclick=startLoop;
document.getElementById('howBtn').onclick=()=>{ startCard.classList.add('hidden'); howCard.classList.remove('hidden'); };
document.getElementById('backBtn').onclick=()=>{ howCard.classList.add('hidden'); startCard.classList.remove('hidden'); };
document.getElementById('retryBtn').onclick=()=>{ overlay.style.display='none'; startLoop(); };
document.getElementById('menuBtn').onclick=()=>{ deadCard.classList.add('hidden'); startCard.classList.remove('hidden'); overlay.style.display='flex'; gameState='menu'; coreHp=100; dispCore=100; loop=1; score=0; dispScore=0; updateHUD(); breachWarnEl.classList.add('hidden'); vignetteEl.classList.remove('on'); };
document.getElementById('nextBtn').onclick=()=>{ loop++; coreHp=Math.min(100, coreHp+12); startLoop(); };

addEventListener('keydown',e=>{
  if(e.key==='r' && gameState==='dead') document.getElementById('retryBtn').click();
  if(e.key==='Enter' && gameState==='won') document.getElementById('nextBtn').click();
});

updateHUD();
log('Worktree arena ready — awaiting loop start');

// expose for verifier
window.__arena={ getState:()=>({loop,score,coreHp,playerHp,gameState,enemies:enemies.length, bullets:bullets.length, arenaLoaded, knightLoaded }) };

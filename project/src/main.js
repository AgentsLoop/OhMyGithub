import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp, GAME_CONFIG } from './game-utils.js';

// DOM
const canvas = document.getElementById('c');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const hitmarker = document.getElementById('hitmarker');
const vignette = document.getElementById('vignette');
const hpEl = document.getElementById('hp');
const healthFill = document.getElementById('healthFill');
const ammoCountEl = document.getElementById('ammoCount');
const scoreEl = document.getElementById('score');
const killsEl = document.getElementById('kills');
const waveEl = document.getElementById('wave');
const killfeed = document.getElementById('killfeed');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const deadOverlay = document.getElementById('deadOverlay');
const winOverlay = document.getElementById('winOverlay');

let renderer, scene, camera, clock;
let weaponGroup, muzzleFlash, muzzleLight, weaponMesh;
let enemies = [], bullets = [], particles = [], decals = [], shells = [];
let colliders = []; // AABBs {min:Vector3,max:Vector3}
let keys = {}, mouseDown=false, rightDown=false;
let yaw=0, pitch=0;
let health=100, mag=30, reserve=90, score=0, kills=0, wave=1;
let isLocked=false, isDead=false, isWon=false, isReloading=false;
let lastShoot=0, recoilY=0, recoilX=0, adsT=0, sprintT=0, bobT=0;
let spawnTimer=0, gameTime=0;
let hitFlashT=0, damageT=0, shakeT=0, shakeAmp=0;
let audioCtx=null;

const player = { pos: new THREE.Vector3(0,1.7,14), vel:new THREE.Vector3(), onGround:true };
const MAP_BOUNDS = 32;
const ENEMY_SPEED = 2.2;
const ENEMY_ATTACK_RANGE = 1.9;
const ENEMY_DAMAGE = 9;

// ---- shared enemy materials/geometries (reused for 60fps) ----
let _enemyMats=null;
function getEnemyMats(){
  if(_enemyMats) return _enemyMats;
  // camo canvas for uniform
  const camoTex = makeCanvasTexture(128,128,(g,w,h)=>{
    g.fillStyle='#3e4638'; g.fillRect(0,0,w,h);
    for(let i=0;i<28;i++){
      const x=Math.random()*w, y=Math.random()*h, r=6+Math.random()*10;
      g.fillStyle = Math.random()<0.33?'#2b3326': Math.random()<0.5?'#4a5a3a':'#1e2520';
      g.globalAlpha=0.55;
      g.beginPath(); g.ellipse(x,y,r,r*0.7, Math.random()*Math.PI,0,Math.PI*2); g.fill();
    }
    g.globalAlpha=1;
    g.fillStyle='rgba(0,0,0,0.12)';
    for(let i=0;i<40;i++) g.fillRect(Math.random()*w,Math.random()*h,1,2);
  });
  camoTex.wrapS=camoTex.wrapT=THREE.RepeatWrapping;
  camoTex.repeat.set(1,1);
  const uniformMat = new THREE.MeshStandardMaterial({ map:camoTex, roughness:0.92, metalness:0.02 });
  const vestMat = new THREE.MeshStandardMaterial({ color:0x232a20, roughness:0.78, metalness:0.08 });
  const pouchMat = new THREE.MeshStandardMaterial({ color:0x2e3528, roughness:0.88 });
  const skinMat = new THREE.MeshStandardMaterial({ color:0x8d7a62, roughness:0.85 });
  const maskMat = new THREE.MeshStandardMaterial({ color:0x141a14, roughness:0.95 });
  const helmetMat = new THREE.MeshStandardMaterial({ color:0x2f362e, roughness:0.72, metalness:0.12 });
  const strapMat = new THREE.MeshStandardMaterial({ color:0x1a1f1a, roughness:0.9 });
  const armMat = uniformMat;
  const legMat = new THREE.MeshStandardMaterial({ color:0x343c2e, roughness:0.9 });
  const gloveMat = new THREE.MeshStandardMaterial({ color:0x181c16, roughness:0.88 });
  const bootMat = new THREE.MeshStandardMaterial({ color:0x0e1110, roughness:0.82 });
  _enemyMats={camoTex, uniformMat, vestMat, pouchMat, skinMat, maskMat, helmetMat, strapMat, armMat, legMat, gloveMat, bootMat};
  return _enemyMats;
}

function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function beep(freq, dur, vol=0.18, type='square'){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.type=type; o.frequency.value=freq; o.connect(g); g.connect(audioCtx.destination);
  g.gain.value=vol; o.start();
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
  o.stop(audioCtx.currentTime+dur);
}
function playShoot(){ beep(180,0.06,0.22,'square'); setTimeout(()=>beep(90,0.08,0.12,'triangle'),18); }
function playHit(){ beep(900,0.07,0.16,'square'); }
function playReload(){ beep(500,0.12,0.1,'sine'); }
function playEmpty(){ beep(120,0.2,0.15,'square'); }
function playHurt(){ beep(160,0.18,0.2,'sawtooth'); }

function aabbContains(x,z,aabb){ return x>=aabb.min.x && x<=aabb.max.x && z>=aabb.min.z && z<=aabb.max.z; }
function collides(x,z,r=0.42){
  for(const b of colliders){
    if(x+r > b.min.x && x-r < b.max.x && z+r > b.min.z && z-r < b.max.z) return true;
  }
  if(Math.abs(x)>MAP_BOUNDS || Math.abs(z)>MAP_BOUNDS) return true;
  return false;
}

function init(){
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1319);
  scene.fog = new THREE.Fog(0x0e1319, 18, 62);

  camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 120);
  clock = new THREE.Clock();

  // lights — MWIII dark military: cold key + warm fill
  scene.add(new THREE.HemisphereLight(0xdfe8f5, 0x151a1e, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.35);
  sun.position.set(18,28,10);
  sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.near=0.5; sun.shadow.camera.far=80;
  sun.shadow.camera.left=-36; sun.shadow.camera.right=36; sun.shadow.camera.top=36; sun.shadow.camera.bottom=-36;
  sun.shadow.bias=-0.0006;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6ea8ff, 0.35);
  rim.position.set(-16,10,-14); scene.add(rim);
  const pointA = new THREE.PointLight(0xff8a2a, 0.9, 26); pointA.position.set(0,6,0); scene.add(pointA);
  const pointB = new THREE.PointLight(0x2a9cff, 0.45, 22); pointB.position.set(-12,3,-12); scene.add(pointB);

  buildMap();
  buildWeapon();

  // enemies
  spawnWave(4);
  updateHUD();

  // events
  addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', e=> keys[e.code]=false);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', e=>{ if(e.button===0) mouseDown=false; if(e.button===2) rightDown=false; });
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);

  document.getElementById('playBtn').addEventListener('click', ()=>{ ensureAudio(); lock(); });
  document.getElementById('resumeBtn').addEventListener('click', lock);
  document.getElementById('retryBtn').addEventListener('click', resetGame);
  document.getElementById('againBtn').addEventListener('click', resetGame);

  // also clicking overlay locks
  startOverlay.addEventListener('click', e=>{ if(e.target===startOverlay) lock(); });

  animate();
}

function makeCanvasTexture(w,h, draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d'); draw(g,w,h);
  const tex=new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=4;
  return tex;
}
function buildMap(){
  // PBR: fallback canvas → real tileable textures via TextureLoader (critic gap fix 172-203)
  const texLoader = new THREE.TextureLoader();
  texLoader.setCrossOrigin('anonymous');
  function applyPBR(map, opts={}){ if(!map) return; map.wrapS=map.wrapT=THREE.RepeatWrapping; if(opts.repeat) map.repeat.set(...opts.repeat); map.anisotropy = Math.min(8, renderer ? renderer.capabilities.getMaxAnisotropy() : 8); map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate=true; }
  // fallback canvases (instant, no network) — overwritten when CDN loads
  const floorTex = makeCanvasTexture(256,256, (g,w,h)=>{
    g.fillStyle='#2b333c'; g.fillRect(0,0,w,h);
    g.fillStyle='rgba(255,255,255,0.04)'; for(let i=0;i<120;i++) g.fillRect(Math.random()*w,Math.random()*h, 2, 28);
    g.strokeStyle='rgba(100,120,140,0.08)'; g.lineWidth=1;
    for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(0,i*h/8); g.lineTo(w,i*h/8); g.stroke(); }
    g.fillStyle='rgba(0,0,0,0.18)'; for(let i=0;i<6;i++){ const x=Math.random()*w, y=Math.random()*h; g.beginPath(); g.arc(x,y, 8+Math.random()*18,0,Math.PI*2); g.fill(); }
  });
  floorTex.repeat.set(6,6);
  const floorBump = makeCanvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#808080'; g.fillRect(0,0,w,h);
    for(let i=0;i<400;i++){ const v=120+Math.random()*40; g.fillStyle=`rgb(${v},${v},${v})`; g.fillRect(Math.random()*w,Math.random()*h,1,1); }
  });
  floorBump.repeat.set(6,6);
  // floor — fallback mat, upgraded async by CDN
  const floorGeo = new THREE.PlaneGeometry(80,80);
  const floorMat = new THREE.MeshStandardMaterial({map: floorTex, bumpMap: floorBump, bumpScale:0.04, roughness:0.92, metalness:0.04});
  floorTex.needsUpdate=true;
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  // subtle grid overlay via lines (fake)
  const grid = new THREE.GridHelper(80, 40, 0x1a222c, 0x1e2a36);
  grid.position.y=0.02; scene.add(grid);
  // async upgrade: real warehouse floor (concrete) — CDN tileable, graceful fallback if offline
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/hardwood2_diffuse.jpg', (m)=>{ applyPBR(m,{repeat:[6,6]}); floorMat.map=m; floorMat.needsUpdate=true; }, undefined, ()=>{});
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/hardwood2_roughness.jpg', (m)=>{ applyPBR(m,{repeat:[6,6]}); m.colorSpace=THREE.NoColorSpace; floorMat.roughnessMap=m; floorMat.needsUpdate=true; }, undefined, ()=>{});

  // outer walls — textured fallback, upgraded to tileable brick/concrete
  const wallTex = makeCanvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#3a444f'; g.fillRect(0,0,w,h);
    g.fillStyle='rgba(0,0,0,0.12)'; for(let i=0;i<40;i++) g.fillRect(0,Math.random()*h,w, 1+Math.random()*3);
    g.fillStyle='rgba(255,255,255,0.04)'; for(let i=0;i<60;i++) g.fillRect(Math.random()*w,Math.random()*h, 2, 6);
  });
  wallTex.repeat.set(4,1);
  const wallMat = new THREE.MeshStandardMaterial({map: wallTex, roughness:0.88, metalness:0.06});
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/brick_diffuse.jpg', (m)=>{ applyPBR(m,{repeat:[4,1]}); wallMat.map=m; wallMat.needsUpdate=true; }, undefined, ()=>{});
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/brick_bump.jpg', (m)=>{ applyPBR(m,{repeat:[4,1]}); m.colorSpace=THREE.NoColorSpace; wallMat.bumpMap=m; wallMat.bumpScale=0.08; wallMat.needsUpdate=true; }, undefined, ()=>{});
  const wallH=6.5;
  const walls=[
    {p:[0,wallH/2, -MAP_BOUNDS-1], s:[80,wallH,2]},
    {p:[0,wallH/2, MAP_BOUNDS+1], s:[80,wallH,2]},
    {p:[-MAP_BOUNDS-1,wallH/2,0], s:[2,wallH,80]},
    {p:[MAP_BOUNDS+1,wallH/2,0], s:[2,wallH,80]},
  ];
  for(const w of walls){
    const m=new THREE.Mesh(new THREE.BoxGeometry(...w.s), wallMat);
    m.position.set(...w.p); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    addCollider(m.position, w.s);
  }

  // warehouse crates / pillars / containers — textured crates (fallback + CDN upgrade)
  const crateTex = makeCanvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#6b5a44'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(0,0,0,0.22)'; g.lineWidth=3; g.strokeRect(4,4,w-8,h-8); g.strokeRect(w*0.33,4,w*0.33,h-8);
    g.fillStyle='rgba(0,0,0,0.16)'; for(let i=0;i<8;i++) g.fillRect(Math.random()*w,Math.random()*h,14,3);
    g.fillStyle='#2b1a0e'; g.font='10px monospace'; g.fillText('◼', 18, 20);
  });
  crateTex.repeat.set(1,1);
  const crateBump = makeCanvasTexture(128,128,(g,w,h)=>{
    g.fillStyle='#808080'; g.fillRect(0,0,w,h);
    g.strokeStyle='#a0a0a0'; g.lineWidth=2; g.strokeRect(0,0,w,h);
  });
  const boxMat = new THREE.MeshStandardMaterial({map: crateTex, bumpMap: crateBump, bumpScale:0.03, roughness:0.86});
  const metalTex = makeCanvasTexture(256,256,(g,w,h)=>{
    g.fillStyle='#46505c'; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(255,255,255,0.09)'; g.lineWidth=1;
    for(let i=0;i<12;i++){ g.beginPath(); g.moveTo(0,i*h/12); g.lineTo(w,i*h/12); g.stroke(); }
    g.fillStyle='rgba(0,0,0,0.10)'; for(let i=0;i<30;i++) g.fillRect(Math.random()*w,Math.random()*h, 8,1);
  });
  metalTex.repeat.set(1,1);
  const metalMat = new THREE.MeshStandardMaterial({map: metalTex, roughness:0.55, metalness:0.42});
  // async CDN upgrades — wood crate + brushed metal
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/hardwood2_diffuse.jpg', (m)=>{ applyPBR(m,{repeat:[1,1]}); boxMat.map=m; boxMat.needsUpdate=true; }, undefined, ()=>{});
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/metal_diffuse.jpg', (m)=>{ // fallback to triangle pattern if metal missing
    applyPBR(m,{repeat:[1,1]}); metalMat.map=m; metalMat.metalness=0.45; metalMat.needsUpdate=true;
  }, undefined, ()=>{});
  // try roughness for metal from same set if available — graceful ignore if 404
  texLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/brick_roughness.jpg', (m)=>{ applyPBR(m,{repeat:[1,1]}); m.colorSpace=THREE.NoColorSpace; boxMat.roughnessMap=m; boxMat.needsUpdate=true; }, undefined, ()=>{});
  const cratePositions=[
    // central cover cluster
    [0,0.9,2, 3.2,1.8,1.2, boxMat], [4,0.7,0, 2,1.4,2, boxMat], [-4,0.7,0, 2,1.4,2, boxMat],
    [0,0.7,-4, 6,1.4,1, boxMat], [0,0.7,-8, 2.5,1.4,2, metalMat],
    // flanks
    [-10,1.2,6, 4,2.4,2, metalMat], [10,1.2,6, 4,2.4,2, metalMat],
    [-11,1.0,-8, 5,2,2, boxMat], [11,1.0,-8, 5,2,2, boxMat],
    [-6,0.9,10, 2,1.8,2, boxMat], [6,0.9,10, 2,1.8,2, boxMat],
    // containers (long)
    [-16,1.6,0, 7,3.2,2.4, metalMat], [16,1.6,0, 7,3.2,2.4, metalMat],
    // inner pillars
  ];
  for(const [x,y,z,w,h,d,mat] of cratePositions){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    addCollider(m.position, [w,h,d]);
  }
  // pillars (cyl)
  const pillarGeo=new THREE.CylinderGeometry(0.45,0.45,6.2,10);
  const pillarMat=new THREE.MeshStandardMaterial({color:0x2f3842, roughness:0.7, metalness:0.2});
  const pillarPos=[[-12,-12],[12,-12],[-12,12],[12,12],[0,-14],[0,14]];
  for(const [x,z] of pillarPos){
    const p=new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x,3.1,z); p.castShadow=true; scene.add(p);
    addCollider(p.position,[0.9,6.2,0.9]);
  }
  // overhead truss beams (visual)
  const beamMat=new THREE.MeshStandardMaterial({color:0x1e252e, roughness:0.6, metalness:0.5});
  for(let i=-2;i<=2;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(36,0.28,0.28), beamMat);
    b.position.set(0,6.8,i*7); scene.add(b);
  }
  // crates scattered small
  for(let i=0;i<10;i++){
    const s= 1+Math.random()*0.8;
    const x=(Math.random()-0.5)*22, z=(Math.random()-0.5)*22;
    if(Math.hypot(x,z)<3) continue;
    const m=new THREE.Mesh(new THREE.BoxGeometry(s,s,s), Math.random()<0.5?boxMat:metalMat);
    m.position.set(x,s/2,z); m.rotation.y=Math.random()*Math.PI; m.castShadow=true; scene.add(m);
    addCollider(m.position,[s,s,s]);
  }
  // industrial decals on floor (dark patches)
  const patchGeo=new THREE.CircleGeometry(2.2,16);
  const patchMat=new THREE.MeshStandardMaterial({color:0x1a2028, roughness:1, transparent:true, opacity:.45});
  for(let i=0;i<6;i++){
    const pm=new THREE.Mesh(patchGeo,patchMat);
    pm.rotation.x=-Math.PI/2; pm.position.set((Math.random()-0.5)*24,0.03,(Math.random()-0.5)*24); scene.add(pm);
  }

  // sky / fog color already
  // add some emissive strips (warehouse lights)
  for(let i=0;i<4;i++){
    const lg=new THREE.Mesh(new THREE.BoxGeometry(3,0.12,0.12), new THREE.MeshStandardMaterial({color:0xfff2d6, emissive:0xfff2d6, emissiveIntensity:1.8}));
    lg.position.set(0,6.5,i*8-12); scene.add(lg);
    const lp=new THREE.PointLight(0xfff0c8,0.7,14); lp.position.copy(lg.position); lp.position.y-=0.8; scene.add(lp);
  }
}

function addCollider(pos, size){
  const hx=size[0]/2, hy=size[1]/2, hz=size[2]/2;
  colliders.push({min:new THREE.Vector3(pos.x-hx, pos.y-hy, pos.z-hz), max:new THREE.Vector3(pos.x+hx, pos.y+hy, pos.z+hz)});
}

function buildWeapon(){
  weaponGroup=new THREE.Group();
  // procedural rifle (fallback). GLTF will replace if present.
  const matBody=new THREE.MeshStandardMaterial({color:0x1a1f26, roughness:0.58, metalness:0.28});
  const matBarrel=new THREE.MeshStandardMaterial({color:0x0f141a, roughness:0.42, metalness:0.62});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.11,0.46), matBody); body.position.set(0,0,0);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.024,0.62,12), matBarrel);
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.03,-0.46);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.16,0.08), matBody); grip.position.set(0,-0.09,0.12); grip.rotation.x=0.35;
  const magMesh=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.09), new THREE.MeshStandardMaterial({color:0x11161c, roughness:0.7}));
  magMesh.position.set(0,-0.11,0.04);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.04,0.08), new THREE.MeshStandardMaterial({color:0x0b0e12}));
  sight.position.set(0,0.08,-0.08);
  // hand guard
  const guard=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.07,0.32), new THREE.MeshStandardMaterial({color:0x242c36, roughness:0.6}));
  guard.position.set(0,0.02,-0.28);
  weaponGroup.add(body,barrel,grip,magMesh,sight,guard);

  // — MWIII viewmodel upgrade: gloved hands + forearms (FOV 74→52 ADS, hands sell scale) —
  const gloveMat = new THREE.MeshStandardMaterial({ color:0x1b1e1c, roughness:0.92, metalness:0.02 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color:0x2a332e, roughness:0.88 });
  // right hand gripping pistol grip
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.09), gloveMat);
  rHand.position.set(0.02,-0.08,0.14);
  // fingers wrapping grip
  const rFingers = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.06,0.05), gloveMat);
  rFingers.position.set(0.02,-0.06,0.18); rFingers.rotation.x=0.6;
  // forearm
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,0.32,8), sleeveMat);
  rArm.rotation.x=Math.PI/2.15; rArm.position.set(0.04,-0.11,0.34);
  // left hand on handguard
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.088,0.082,0.09), gloveMat);
  lHand.position.set(0,-0.02,-0.26);
  const lFingers = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.045,0.08), gloveMat);
  lFingers.position.set(0,0.03,-0.27); lFingers.rotation.x=0.12;
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.062,0.30,8), sleeveMat);
  lArm.rotation.x=Math.PI/2.05; lArm.position.set(-0.06,-0.05,-0.06);
  // watch/strap detail
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.015,0.06), new THREE.MeshStandardMaterial({color:0x0e1210}));
  strap.position.set(0.04,-0.08,0.44);
  weaponGroup.add(rHand,rFingers,rArm,lHand,lFingers,lArm,strap);

  // muzzle flash — multi-layer additive (MWIII bloom) + point light
  muzzleFlash=new THREE.Group();
  const flashCore = new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.16), new THREE.MeshBasicMaterial({color:0xfff8d0, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
  flashCore.name='core';
  const flashGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.26), new THREE.MeshBasicMaterial({color:0xff9a2a, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
  flashGlow.name='glow';
  const flashStar = new THREE.Mesh(new THREE.PlaneGeometry(0.20,0.20), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending}));
  flashStar.name='star';
  // cross star shape via scaled planes
  const flashH = new THREE.Mesh(new THREE.PlaneGeometry(0.32,0.06), new THREE.MeshBasicMaterial({color:0xffe8a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide}));
  flashH.name='h';
  const flashV = new THREE.Mesh(new THREE.PlaneGeometry(0.06,0.32), new THREE.MeshBasicMaterial({color:0xffe8a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide}));
  flashV.name='v';
  [flashCore,flashGlow,flashStar,flashH,flashV].forEach(m=>{ m.position.set(0,0.03,-0.78); });
  muzzleFlash.add(flashCore,flashGlow,flashStar,flashH,flashV);
  weaponGroup.add(muzzleFlash);
  muzzleLight = new THREE.PointLight(0xffb45a, 0, 3.2);
  muzzleLight.position.set(0,0.03,-0.78);
  weaponGroup.add(muzzleLight);

  // red dot
  const dot=new THREE.Mesh(new THREE.CircleGeometry(0.006,8), new THREE.MeshBasicMaterial({color:0xff3b30}));
  dot.position.set(0,0.10,-0.09); dot.rotation.y=Math.PI;
  weaponGroup.add(dot);

  // try load GLB slot — Sketchfab M4 (szaw, CC-BY), 6081 tris, 8 mats
  // Vite serves public/ at root (/models/...), python http.server serves at /public/models/...
  const loader=new GLTFLoader();
  const glbUrls=['/models/weapon.glb','public/models/weapon.glb','./public/models/weapon.glb','models/weapon.glb'];
  let glbIndex=0;
  function tryLoadGLB(){
    if(glbIndex>=glbUrls.length) { console.log('[FPS] weapon.glb not found, procedural fallback active'); return; }
    const url=glbUrls[glbIndex++];
    loader.load(url, gltf=>{
      try{
        // keep hands + muzzle system: remove only rifle meshes, not hands
        const keep = new Set([rHand,rFingers,rArm,lHand,lFingers,lArm,strap, muzzleFlash, muzzleLight, dot]);
        for(const c of [...weaponGroup.children]){ if(!keep.has(c)) weaponGroup.remove(c); }
        const glb=gltf.scene;
        const box=new THREE.Box3().setFromObject(glb);
        const size=new THREE.Vector3(); box.getSize(size);
        const maxDim=Math.max(size.x,size.y,size.z);
        const scale = maxDim>0 ? 0.62/maxDim : 0.4;
        glb.scale.setScalar(scale);
        const box2=new THREE.Box3().setFromObject(glb);
        const ctr=new THREE.Vector3(); box2.getCenter(ctr);
        glb.position.sub(ctr);
        glb.position.y += 0.04; glb.position.z += 0.08;
        glb.rotation.y = Math.PI;
        glb.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; if(o.material) o.material.needsUpdate=true; }});
        weaponGroup.add(glb);
        // reposition muzzle to new barrel tip
        [flashCore,flashGlow,flashStar,flashH,flashV].forEach(m=> m.position.set(0,0.02,-0.55));
        muzzleLight.position.set(0,0.02,-0.55);
        console.log('[FPS] weapon.glb loaded via '+url+' — Low-poly M4 by szaw (CC-BY) 6081 tris');
      }catch(e){ console.warn('[FPS] weapon glb post-process fail', e); }
    }, undefined, ()=>{ tryLoadGLB(); });
  }
  tryLoadGLB();

  scene.add(weaponGroup);
}

function spawnWave(n){
  const slots=[[-14,14],[14,14],[-14,-14],[14,-14],[0,-15],[9,11],[-9,11]];
  for(let i=0;i<n;i++){
    const [x,z]=slots[(kills+i)%slots.length];
    const jx=x+(Math.random()-0.5)*3, jz=z+(Math.random()-0.5)*3;
    spawnEnemy(jx,jz);
  }
}
function spawnEnemy(x,z){
  const mats=getEnemyMats();
  const group=new THREE.Group();
  group.position.set(x,0,z);
  group.userData.isEnemy=true;

  // root offset so feet at y=0
  const h=1.82;
  // legs (capsule approx via cylinder + sphere caps)
  const legGeo=new THREE.CylinderGeometry(0.11,0.10,0.82,8);
  const legL=new THREE.Mesh(legGeo, mats.legMat); legL.position.set(-0.14,0.41,0); legL.castShadow=true;
  const legR=new THREE.Mesh(legGeo, mats.legMat); legR.position.set(0.14,0.41,0); legR.castShadow=true;
  const bootGeo=new THREE.BoxGeometry(0.16,0.10,0.24);
  const bootL=new THREE.Mesh(bootGeo, mats.bootMat); bootL.position.set(-0.14,0.06,0.04); bootL.castShadow=true;
  const bootR=new THREE.Mesh(bootGeo, mats.bootMat); bootR.position.set(0.14,0.06,0.04); bootR.castShadow=true;

  // torso — uniform
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.52,0.26), mats.uniformMat); torso.position.set(0,1.16,0); torso.castShadow=true; torso.receiveShadow=true;
  // plate carrier vest — protruding, with pouches
  const vest=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.40,0.30), mats.vestMat); vest.position.set(0,1.18,0.03); vest.castShadow=true;
  const pouchL=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.06), mats.pouchMat); pouchL.position.set(-0.14,1.10,0.18);
  const pouchR=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.06), mats.pouchMat); pouchR.position.set(0.14,1.10,0.18);
  const pouchC=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.10,0.05), mats.pouchMat); pouchC.position.set(0,1.24,0.18);
  // shoulder pads
  const padL=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.08,0.18), mats.vestMat); padL.position.set(-0.28,1.36,0);
  const padR=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.08,0.18), mats.vestMat); padR.position.set(0.28,1.36,0);

  // arms
  const armGeo=new THREE.CylinderGeometry(0.075,0.065,0.42,8);
  const armL=new THREE.Mesh(armGeo, mats.armMat); armL.position.set(-0.32,1.12,0.06); armL.rotation.z=-0.18; armL.rotation.x=0.45; armL.castShadow=true;
  const armR=new THREE.Mesh(armGeo, mats.armMat); armR.position.set(0.32,1.12,0.06); armR.rotation.z=0.18; armR.rotation.x=0.45; armR.castShadow=true;
  const gloveL=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.09), mats.gloveMat); gloveL.position.set(-0.32,0.88,0.16);
  const gloveR=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.09), mats.gloveMat); gloveR.position.set(0.32,0.88,0.16);

  // head — balaclava + helmet silhouette ( MWIII operator )
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,10), mats.maskMat); head.position.set(0,1.62,0); head.castShadow=true;
  // face plate slightly forward
  const face=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.16,0.08), mats.maskMat); face.position.set(0,1.60,0.12);
  // helmet dome
  const helm=new THREE.Mesh(new THREE.SphereGeometry(0.21,14,10,0,Math.PI*2,0,Math.PI*0.62), mats.helmetMat); helm.position.set(0,1.68,0); helm.rotation.x=0.12; helm.castShadow=true;
  helm.scale.set(1,0.85,1);
  // helmet rim
  const helmRim=new THREE.Mesh(new THREE.CylinderGeometry(0.215,0.215,0.06,14), mats.helmetMat); helmRim.position.set(0,1.61,0);
  // NVG mount block
  const nvg=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.07,0.08), new THREE.MeshStandardMaterial({color:0x111412})); nvg.position.set(0,1.69,0.16);
  // goggles strap
  const strap=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.04,0.42), mats.strapMat); strap.position.set(0,1.66,0); strap.scale.set(1,1,1);
  // glowing lens slit (subtle)
  const visor=new THREE.Mesh(new THREE.PlaneGeometry(0.14,0.03), new THREE.MeshBasicMaterial({color:0x6ea8ff, transparent:true, opacity:0.22, side:THREE.DoubleSide}));
  visor.position.set(0,1.60,0.18); visor.rotation.y=Math.PI;

  // rifle — held at chest, diagonal
  const gun = new THREE.Group(); gun.position.set(0.12,1.08,0.18); gun.rotation.y=0.18; gun.rotation.z=-0.08;
  const gunBody=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.48), new THREE.MeshStandardMaterial({color:0x11161c, roughness:0.6, metalness:0.3})); gunBody.position.set(0,0, -0.04);
  const gunBarrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.32,8), new THREE.MeshStandardMaterial({color:0x0a0e12, metalness:0.6, roughness:0.4})); gunBarrel.rotation.x=Math.PI/2; gunBarrel.position.set(0,0.02,-0.32);
  const gunMag=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.06), new THREE.MeshStandardMaterial({color:0x1a1f1a})); gunMag.position.set(0,-0.08,0.06);
  gun.add(gunBody,gunBarrel,gunMag);

  group.add(legL,legR,bootL,bootR,torso,vest,pouchL,pouchR,pouchC,padL,padR,armL,armR,gloveL,gloveR,head,face,helm,helmRim,nvg,strap,visor,gun);
  // tag meshes for raycast filtering
  group.traverse(o=>{ if(o.isMesh) o.userData.isEnemy=true; });
  scene.add(group);
  enemies.push({group, hp:GAME_CONFIG.enemyHP, maxHp:GAME_CONFIG.enemyHP, x, z, y:h/2, state:'patrol', t:Math.random()*10, lastShot:0, dead:false, vel:new THREE.Vector2(), baseY:0, headY:1.62});
}

function onResize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }
function onKeyDown(e){
  keys[e.code]=true;
  if(e.code==='KeyR') tryReload();
  if(e.code==='Escape'){
    if(isLocked) document.exitPointerLock();
  }
}
function onMouseDown(e){
  if(!isLocked || isDead || isWon) return;
  if(e.button===0){ mouseDown=true; ensureAudio(); tryShoot(); }
  if(e.button===2) rightDown=true;
}
function onMouseMove(e){
  if(!isLocked || isDead || isWon) return;
  const sens = 0.0022 * (rightDown?0.55:1);
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = clamp(pitch, -1.45, 1.45);
}
function onLockChange(){
  isLocked = document.pointerLockElement===canvas;
  if(isLocked){
    startOverlay.style.display='none';
    pauseOverlay.style.display='none';
    hud.classList.remove('hidden');
  } else {
    if(!isDead && !isWon && health>0 && gameTime>0.5){
      pauseOverlay.style.display='flex';
    }
  }
}
function lock(){ canvas.requestPointerLock(); }

function tryReload(){
  if(isReloading || mag===GAME_CONFIG.magSize || reserve<=0 || isDead || isWon) return;
  isReloading=true;
  playReload();
  const need=GAME_CONFIG.magSize-mag;
  const take=Math.min(need, reserve);
  // animate weapon dip during reload
  setTimeout(()=>{
    mag+=take; reserve-=take;
    isReloading=false;
    updateHUD();
  }, GAME_CONFIG.reloadMs);
}

function fireMuzzleFlash(){
  if(!muzzleFlash || !muzzleLight) return;
  // layered bloom: core bright, glow soft, star spikes
  const opacities = { core:1, glow:0.85, star:0.92, h:0.78, v:0.78 };
  for(const ch of muzzleFlash.children){
    const m=ch.material;
    if(ch.name==='core') m.opacity=opacities.core;
    else if(ch.name==='glow') m.opacity=opacities.glow;
    else if(ch.name==='star'){ m.opacity=opacities.star; ch.rotation.z=Math.random()*Math.PI; ch.scale.set(0.9+Math.random()*0.35,0.9+Math.random()*0.35,1); }
    else if(ch.name==='h'||ch.name==='v') m.opacity=0.75 + Math.random()*0.18;
    // random scale jitter for organic bloom
    const s=0.92+Math.random()*0.28;
    if(ch.name!=='star') ch.scale.set(s,s,1);
  }
  muzzleLight.intensity=3.2;
  muzzleLight.distance=4.5;
  // decay in next frames via updateWeapon
  setTimeout(()=>{
    for(const ch of muzzleFlash.children) ch.material.opacity=0;
    if(muzzleLight) muzzleLight.intensity=0;
  }, 55);
}

function tryShoot(){
  const now=performance.now();
  if(now-lastShoot < GAME_CONFIG.shootCooldown) return;
  if(isReloading) return;
  if(mag<=0){ playEmpty(); if(reserve>0) tryReload(); return; }
  lastShoot=now;
  mag--;
  updateHUD();
  playShoot();
  // recoil
  recoilY += 0.9 + Math.random()*0.7;
  recoilX += (Math.random()-0.5)*0.7;
  shakeT=0.12; shakeAmp=0.07;
  // muzzle flash — MWIII layered
  fireMuzzleFlash();

  // shell
  spawnShell();

  // tracer + raycast
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  // spread: ADS tight, hip wider, sprint wider
  const spread = rightDown?0.003:0.012 + sprintT*0.006;
  dir.x += (Math.random()-0.5)*spread;
  dir.y += (Math.random()-0.5)*spread;
  dir.z += (Math.random()-0.5)*spread;
  dir.normalize();

  const ray = new THREE.Raycaster(origin, dir, 0, 80);
  const hits = ray.intersectObjects(scene.children, true);
  // filter for enemy groups: check enemies AABB via manual
  let hitEnemy=null, hitDist=999, hitHead=false, hitPoint=null;
  let wallDist=80;
  for(const b of colliders){
    const invDir=new THREE.Vector3(1/dir.x,1/dir.y,1/dir.z);
  }
  // enemy hit: sphere/box approximation — use group world pos (feet at 0, headY ~1.62)
  for(const e of enemies){
    if(e.dead) continue;
    const toE = new THREE.Vector3(e.group.position.x - origin.x, e.group.position.y+0.3 - origin.y, e.group.position.z - origin.z);
    const proj = toE.dot(dir);
    if(proj<0 || proj>60) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(proj));
    const d = closest.distanceTo(new THREE.Vector3(e.group.position.x, e.group.position.y+1.0, e.group.position.z));
    if(d<0.62 && proj<hitDist){
      hitDist=proj; hitEnemy=e; hitPoint=closest.clone();
      const headY = e.group.position.y+1.62;
      hitHead = closest.y > headY-0.16;
    }
  }

  // wall hit: check hits array for non-enemy
  let wallHit=null;
  if(hits.length){
    for(const h of hits){
      let belongs=false;
      for(const e of enemies){ if(h.object.parent===e.group || h.object===e.group || h.object.userData.isEnemy) belongs=true; }
      if(belongs) continue;
      if(h.distance < wallDist){ wallHit=h; wallDist=h.distance; break; }
    }
  }

  let endPoint;
  if(hitEnemy && hitDist < wallDist){
    const dmg = hitHead ? 50 : 25;
    hitEnemy.hp -= dmg;
    endPoint=hitPoint;
    spawnImpact(hitPoint, hitHead?0xff3b30:0xffe8a0, true, hitHead);
    addHitMarker(hitHead);
    playHit();
    if(hitEnemy.hp<=0){
      killEnemy(hitEnemy, hitHead);
    } else {
      hitEnemy.group.position.x += dir.x*0.08;
      hitEnemy.group.position.z += dir.z*0.08;
    }
  } else if(wallHit){
    endPoint=wallHit.point;
    spawnImpact(wallHit.point, 0x9aa8c0, false, false);
    spawnDecal(wallHit.point, wallHit.face ? wallHit.face.normal : new THREE.Vector3(0,1,0));
  } else {
    endPoint = origin.clone().add(dir.clone().multiplyScalar(50));
  }
  spawnTracer(origin, endPoint);
}

function killEnemy(e, head){
  e.dead=true;
  // death slump: quick scale-down + fade
  const start=performance.now();
  const dur=320;
  function slump(){
    const t=(performance.now()-start)/dur;
    if(t<1 && e.group.parent){
      e.group.scale.y = 1 - t*0.85;
      e.group.position.y -= t*0.02;
      e.group.rotation.z = t*1.1*(Math.random()<0.5?-1:1);
      requestAnimationFrame(slump);
    } else {
      e.group.visible=false;
    }
  }
  slump();
  kills++; score+= head?150:100;
  if(kills%5===0){ score+=200; }
  killsEl.textContent=kills;
  scoreEl.textContent=score;
  addKillFeed(head? 'HEADSHOT':'ELIMINATED', head);
  if(kills>=GAME_CONFIG.killsToWin && !isWon){
    winGame();
    return;
  }
  wave=Math.floor(kills/3)+1;
  waveEl.textContent=wave;
  updateHUD();
  setTimeout(()=>{
    const idx=enemies.indexOf(e);
    if(idx>=0){ scene.remove(e.group); enemies.splice(idx,1); }
    const n = wave>=3?2:1;
    spawnWave(n);
  }, 900);
}

function winGame(){
  isWon=true;
  document.exitPointerLock();
  document.getElementById('winScore').textContent=score;
  document.getElementById('winTime').textContent=Math.floor(gameTime)+'s';
  winOverlay.style.display='flex';
}
function loseGame(){
  isDead=true;
  document.exitPointerLock();
  document.getElementById('deadScore').textContent=score;
  document.getElementById('deadKills').textContent=kills;
  deadOverlay.style.display='flex';
}
function resetGame(){
  health=100; mag=30; reserve=90; score=0; kills=0; wave=1; isDead=false; isWon=false; isReloading=false;
  player.pos.set(0,1.7,14); player.vel.set(0,0,0);
  for(const e of enemies) scene.remove(e.group);
  enemies=[]; spawnWave(4);
  gameTime=0;
  deadOverlay.style.display='none'; winOverlay.style.display='none'; pauseOverlay.style.display='none'; startOverlay.style.display='none';
  hud.classList.remove('hidden');
  updateHUD();
  lock();
}

function addHitMarker(head){
  hitmarker.classList.remove('show'); void hitmarker.offsetWidth; hitmarker.classList.add('show');
  crosshair.classList.add('hit'); setTimeout(()=>crosshair.classList.remove('hit'),160);
  hitFlashT=0.14;
  if(head) beep(1200,0.05,0.2,'square');
}
function addKillFeed(text, head){
  const el=document.createElement('div');
  el.className='kill';
  el.style.borderLeftColor=head?'#ffd23b':'#ff3b30';
  el.textContent=`${head?'◆ ':''}${text}  +${head?150:100}`;
  killfeed.prepend(el);
  setTimeout(()=>el.remove(), 2200);
}

function spawnTracer(a,b){
  const geo=new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const mat=new THREE.LineBasicMaterial({color:0xffe8a0, transparent:true, opacity:0.9});
  const line=new THREE.Line(geo, mat);
  scene.add(line);
  bullets.push({mesh:line, t:0, dur:0.07});
}
function spawnImpact(p, color, isEnemy, isHead){
  // MWIII refinement: enemy hit gets blood mist + bone spark, wall hit gets dust + sparks
  const count = isEnemy ? (isHead?13:10) : 7;
  for(let i=0;i<count;i++){
    const geo = isEnemy ? new THREE.SphereGeometry(isHead?0.045:0.032,6,6) : new THREE.SphereGeometry(0.028,5,5);
    const matColor = isEnemy ? (isHead?0xff3b30:0xc94a2a) : 0xd8d2c0;
    const s=new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: matColor, transparent:true, opacity:isEnemy?0.92:0.78}));
    s.position.copy(p);
    const v=new THREE.Vector3((Math.random()-0.5)*7, Math.random()*4+0.6, (Math.random()-0.5)*7);
    if(!isEnemy) v.y=Math.abs(v.y)*0.9;
    else if(isHead) v.y+=1.2;
    s.userData.baseScale = 1;
    scene.add(s);
    particles.push({mesh:s, vel:v, life:isEnemy?0.52+Math.random()*0.28:0.38+Math.random()*0.18, t:0, drag:isEnemy?0.92:0.88});
  }
  // extra spark flecks for wall
  if(!isEnemy){
    for(let i=0;i<4;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4), new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0.95}));
      s.position.copy(p);
      const v=new THREE.Vector3((Math.random()-0.5)*9, Math.random()*5+1.2, (Math.random()-0.5)*9);
      scene.add(s);
      particles.push({mesh:s, vel:v, life:0.22+Math.random()*0.14, t:0, drag:0.9});
    }
  }
}
function spawnDecal(pos, normal){
  // refined decal: triple layer — crater dark + soot ring + micro chips
  const group=new THREE.Group();
  const layers=[
    {r:0.11, color:0x11161c, opacity:0.92},
    {r:0.16, color:0x1e2420, opacity:0.42},
    {r:0.045, color:0x0a0e10, opacity:1},
  ];
  for(const l of layers){
    const g=new THREE.CircleGeometry(l.r,12);
    const m=new THREE.MeshBasicMaterial({color:l.color, transparent:true, opacity:l.opacity, side:THREE.DoubleSide, depthWrite:false});
    const d=new THREE.Mesh(g,m);
    d.position.copy(pos).add(normal.clone().multiplyScalar(0.02+Math.random()*0.012));
    const look=new THREE.Vector3().copy(pos).add(normal);
    d.lookAt(look);
    // random rotation
    d.rotateZ(Math.random()*Math.PI);
    group.add(d);
  }
  // spark chips 3 small dots
  for(let i=0;i<3;i++){
    const chip=new THREE.Mesh(new THREE.CircleGeometry(0.015,6), new THREE.MeshBasicMaterial({color:0x6a6e68, transparent:true, opacity:0.7, side:THREE.DoubleSide}));
    const off=new THREE.Vector3((Math.random()-0.5)*0.14, (Math.random()-0.5)*0.14, (Math.random()-0.5)*0.14);
    chip.position.copy(pos).add(normal.clone().multiplyScalar(0.025)).add(off);
    chip.lookAt(pos.clone().add(normal));
    group.add(chip);
  }
  scene.add(group);
  decals.push({mesh:group, t:0});
  if(decals.length>28){ const old=decals.shift(); scene.remove(old.mesh); }
}
function spawnShell(){
  const g=new THREE.CylinderGeometry(0.018,0.018,0.05,8);
  const m=new THREE.MeshStandardMaterial({color:0xd8c07a, metalness:0.6, roughness:0.4});
  const s=new THREE.Mesh(g,m);
  const camPos=camera.position.clone();
  const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  s.position.copy(camPos).add(new THREE.Vector3(0,-0.18,0)).add(right.clone().multiplyScalar(0.28)).add(new THREE.Vector3(0,0,-0.3).applyQuaternion(camera.quaternion));
  s.rotation.z=Math.random()*Math.PI;
  scene.add(s);
  const vel=new THREE.Vector3(right.x*1.2+ (Math.random()-0.5)*0.6, 1.6+Math.random()*0.8, right.z*1.2);
  shells.push({mesh:s, vel, life:1.2, t:0, rot:new THREE.Vector3(Math.random()*8,Math.random()*8,Math.random()*8)});
}

function updateHUD(){
  hpEl.textContent=Math.max(0,Math.round(health));
  healthFill.style.width=clamp(health,0,100)+'%';
  healthFill.style.background = health>55?'linear-gradient(90deg,#ff3b30,#ff6a30)': health>25?'linear-gradient(90deg,#ff9a00,#ffd23b)':'linear-gradient(90deg,#ff0030,#ff3b30)';
  ammoCountEl.innerHTML=`${mag} <small>/ ${reserve}</small>`;
  scoreEl.textContent=score;
  killsEl.textContent=kills;
  waveEl.textContent=wave;
  if(reserve===0 && mag===0) ammoCountEl.style.color='#ff3b30'; else ammoCountEl.style.color='#e8eef4';
}

function updateMinimap(){
  const s=150, cx=s/2, cy=s/2, scale=3.2;
  mctx.clearRect(0,0,s,s);
  mctx.fillStyle='#0c1218'; mctx.fillRect(0,0,s,s);
  mctx.strokeStyle='rgba(100,120,140,.18)'; mctx.lineWidth=1;
  for(let i=0;i<=4;i++){ mctx.beginPath(); mctx.moveTo(i*s/4,0); mctx.lineTo(i*s/4,s); mctx.stroke(); mctx.beginPath(); mctx.moveTo(0,i*s/4); mctx.lineTo(s,i*s/4); mctx.stroke(); }
  mctx.fillStyle='rgba(90,110,130,.85)';
  for(const b of colliders){
    const cx0=(b.min.x*scale)+s/2, cz0=(b.min.z*scale)+s/2;
    const w=(b.max.x-b.min.x)*scale, h=(b.max.z-b.min.z)*scale;
    mctx.fillRect(cx0, cz0, w, h);
    mctx.strokeStyle='rgba(200,220,255,.14)'; mctx.strokeRect(cx0,cz0,w,h);
  }
  for(const e of enemies){
    if(e.dead) continue;
    const ex=(e.group.position.x*scale)+s/2, ez=(e.group.position.z*scale)+s/2;
    mctx.save(); mctx.translate(ex,ez); mctx.rotate(Math.atan2(e.group.position.x-player.pos.x, e.group.position.z-player.pos.z));
    mctx.fillStyle='#ff3b30'; mctx.beginPath(); mctx.moveTo(0,-5); mctx.lineTo(-4,4); mctx.lineTo(4,4); mctx.closePath(); mctx.fill();
    mctx.restore();
  }
  const px=(player.pos.x*scale)+s/2, pz=(player.pos.z*scale)+s/2;
  mctx.save(); mctx.translate(px,pz); mctx.rotate(yaw);
  mctx.fillStyle='#50ff78'; mctx.beginPath(); mctx.moveTo(0,-6); mctx.lineTo(-4,4); mctx.lineTo(4,4); mctx.closePath(); mctx.fill();
  mctx.strokeStyle='rgba(80,255,120,.5)'; mctx.beginPath(); mctx.moveTo(0,-6); mctx.lineTo(0,-18); mctx.stroke();
  mctx.restore();
  mctx.strokeStyle='rgba(200,220,255,.12)'; mctx.strokeRect(0.5,0.5,s-1,s-1);
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(), 0.033);
  gameTime+=dt;

  if(!isDead && !isWon){
    updatePlayer(dt);
    updateEnemies(dt);
  }
  updateWeapon(dt);
  updateParticles(dt);
  updateMinimap();
  if(hitFlashT>0){ hitFlashT-=dt; crosshair.style.filter = hitFlashT>0?'drop-shadow(0 0 8px #ff3b30)':''; }
  if(damageT>0){ damageT-=dt; vignette.classList.toggle('show', damageT>0); }
  if(shakeT>0){ shakeT-=dt; const s=shakeT/0.12; camera.position.x += (Math.random()-0.5)*shakeAmp*s; camera.position.y += (Math.random()-0.5)*shakeAmp*s; }

  renderer.render(scene, camera);
}

function updatePlayer(dt){
  const forward=new THREE.Vector3(), right=new THREE.Vector3();
  const speedBase = keys['ShiftLeft']||keys['ShiftRight'] ? 6.2 : 3.6;
  const sprinting = (keys['ShiftLeft']||keys['ShiftRight']) && (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']);
  sprintT = lerp(sprintT, sprinting?1:0, dt*6);
  let mvX=0, mvZ=0;
  if(keys['KeyW']) mvZ-=1;
  if(keys['KeyS']) mvZ+=1;
  if(keys['KeyA']) mvX-=1;
  if(keys['KeyD']) mvX+=1;
  const len=Math.hypot(mvX,mvZ);
  if(len>0){ mvX/=len; mvZ/=len; }

  const sin=Math.sin(yaw), cos=Math.cos(yaw);
  let dx = mvX*cos + mvZ*sin;
  let dz = mvX*-sin + mvZ*cos;
  dx*=speedBase; dz*=speedBase;

  let nx = player.pos.x + dx*dt;
  if(!collides(nx, player.pos.z)) player.pos.x=nx;
  let nz = player.pos.z + dz*dt;
  if(!collides(player.pos.x, nz)) player.pos.z=nz;

  if(recoilY>0){ pitch += recoilY*0.004; recoilY = lerp(recoilY,0, dt*9); }
  if(recoilX!==0){ yaw += recoilX*0.002; recoilX = lerp(recoilX,0, dt*7); }

  const targetAds = rightDown?1:0;
  adsT = lerp(adsT, targetAds, dt*10);
  camera.fov = lerp(74, 52, adsT);
  camera.updateProjectionMatrix();
  crosshair.classList.toggle('ads', adsT>0.5);
  if(adsT>0.5) crosshair.style.opacity='0.18'; else crosshair.style.opacity='0.92';

  const moving = len>0.1;
  bobT += dt * (moving? (sprinting?10:6) : 1.2);
  const bobAmp = moving ? (sprinting?0.08:0.04) : 0.012;
  const bobX = Math.sin(bobT)*bobAmp*(1-adsT*0.85);
  const bobY = Math.abs(Math.cos(bobT))*bobAmp*0.6*(1-adsT*0.9);

  camera.position.set(player.pos.x + bobX*0.16, player.pos.y + bobY, player.pos.z);
  camera.rotation.order='YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  if(mouseDown && isLocked){ tryShoot(); }
}

function updateWeapon(dt){
  if(!weaponGroup) return;
  const adsPos = new THREE.Vector3(0, -0.14, -0.42);
  const hipPos = new THREE.Vector3(0.28, -0.22, -0.48);
  const sprintOffset = new THREE.Vector3(0.06, -0.10, -0.18);
  let pos = new THREE.Vector3().lerpVectors(hipPos, adsPos, adsT);
  if(sprintT>0.1){
    pos.x += sprintOffset.x*sprintT;
    pos.y += sprintOffset.y*sprintT;
    pos.z += sprintOffset.z*sprintT;
  }
  const bobX = Math.sin(bobT)*0.02*(1-adsT);
  const bobY = Math.cos(bobT*2)*0.012*(1-adsT);
  pos.x+=bobX; pos.y+=bobY;
  pos.z += Math.max(0,recoilY)*0.008;
  pos.y += Math.max(0,recoilY)*0.004;

  const camQuat=camera.quaternion.clone();
  const offset=pos.clone().applyQuaternion(camQuat);
  weaponGroup.position.copy(camera.position).add(offset);
  weaponGroup.quaternion.copy(camQuat);
  weaponGroup.rotateX(-pitch*0.02);
  if(isReloading){
    weaponGroup.rotateX(-0.22);
    weaponGroup.rotateZ(0.12);
  }
  // fade muzzle light quickly (bloom decay)
  if(muzzleLight && muzzleLight.intensity>0){
    muzzleLight.intensity = lerp(muzzleLight.intensity, 0, dt*22);
    if(muzzleLight.intensity<0.02) muzzleLight.intensity=0;
  }
}

function updateEnemies(dt){
  spawnTimer+=dt;
  for(const e of enemies){
    if(e.dead) continue;
    const dx=player.pos.x - e.group.position.x;
    const dz=player.pos.z - e.group.position.z;
    const dist=Math.hypot(dx,dz);
    const dirX=dx/(dist||1), dirZ=dz/(dist||1);
    let speed=ENEMY_SPEED * (0.85+Math.random()*0.3);
    if(dist>9){
      tryMoveEnemy(e, dirX, dirZ, speed, dt);
    } else if(dist>ENEMY_ATTACK_RANGE){
      const t=performance.now()*0.0006 + e.t;
      const strafe=Math.sin(t*1.3 + e.x)*0.55;
      const px=-dirZ*strafe, pz=dirX*strafe;
      tryMoveEnemy(e, dirX*0.88+px, dirZ*0.88+pz, speed*0.9, dt);
    } else {
      if(performance.now()-e.lastShot > 820+Math.random()*500){
        e.lastShot=performance.now();
        if(Math.random()<0.46){
          health -= ENEMY_DAMAGE * (Math.random()*0.4+0.8);
          health=clamp(health,0,100);
          damageT=0.22; shakeT=0.16; shakeAmp=0.12;
          playHurt();
          updateHUD();
          if(health<=0) loseGame();
        }
        const fl=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.12), new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0.9, side:THREE.DoubleSide}));
        fl.position.copy(e.group.position); fl.position.y+=1.15; fl.position.x+=dirX*0.42; fl.position.z+=dirZ*0.42;
        fl.lookAt(camera.position);
        scene.add(fl);
        const flLight=new THREE.PointLight(0xffb45a, 1.2, 2.5); flLight.position.copy(fl.position); scene.add(flLight);
        setTimeout(()=>{ scene.remove(fl); scene.remove(flLight); }, 48);
      }
    }
    e.group.rotation.y = Math.atan2(dx, -dz) + Math.PI;
    // idle breathing + stride bob (MWIII operator weight)
    e.t+=dt;
    const moving = dist>ENEMY_ATTACK_RANGE+0.2;
    const bob = moving ? Math.sin(e.t*6.2)*0.045 : Math.sin(e.t*1.1)*0.012;
    e.group.position.y = bob;
    // subtle leg swing when moving (scale legs)
    if(moving){
      const swing=Math.sin(e.t*6.2);
      // legs are children 0,1 — swing via z offset
      if(e.group.children[0]) e.group.children[0].position.z = swing*0.06;
      if(e.group.children[1]) e.group.children[1].position.z = -swing*0.06;
    }
  }
}
function tryMoveEnemy(e, dx, dz, speed, dt){
  const nx=e.group.position.x + dx*speed*dt;
  const nz=e.group.position.z + dz*speed*dt;
  const canX=!collides(nx, e.group.position.z, 0.35);
  const canZ=!collides(e.group.position.x, nz, 0.35);
  if(canX) e.group.position.x=nx;
  if(canZ) e.group.position.z=nz;
  for(const o of enemies){
    if(o===e||o.dead) continue;
    const ddx=e.group.position.x-o.group.position.x, ddz=e.group.position.z-o.group.position.z;
    const d=Math.hypot(ddx,ddz);
    if(d<1.0 && d>0.01){ e.group.position.x+=ddx/d*0.015; e.group.position.z+=ddz/d*0.015; }
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.t+=dt;
    p.vel.y -= 9.8*dt;
    if(p.drag) p.vel.multiplyScalar(p.drag);
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.mesh.material.opacity = 1 - p.t/p.life;
    if(p.mesh.scale) p.mesh.scale.setScalar(1 - p.t/p.life*0.45);
    if(p.t>p.life){ scene.remove(p.mesh); particles.splice(i,1); }
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i]; b.t+=dt; b.mesh.material.opacity=1-b.t/b.dur;
    if(b.t>b.dur){ scene.remove(b.mesh); bullets.splice(i,1); }
  }
  for(let i=shells.length-1;i>=0;i--){
    const s=shells[i]; s.t+=dt;
    s.vel.y-=9.8*dt;
    s.mesh.position.add(s.vel.clone().multiplyScalar(dt));
    s.mesh.rotation.x+=s.rot.x*dt; s.mesh.rotation.y+=s.rot.y*dt; s.mesh.rotation.z+=s.rot.z*dt;
    if(s.mesh.position.y<0.03){ s.mesh.position.y=0.03; s.vel.y*= -0.28; s.vel.x*=0.6; s.vel.z*=0.6; s.rot.multiplyScalar(0.7); }
    if(s.t>s.life){ scene.remove(s.mesh); shells.splice(i,1); }
  }
}

// init when DOM ready
init();

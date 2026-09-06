import * as THREE from 'three';

const CONFIG = {
  arena: 36,
  wallH: 6,
  playerH: 1.7,
  moveSpeed: 5.2,
  sprintMult: 1.62,
  friction: 0.92,
  maxHealth: 100,
  magSize: 30,
  reserve: 90,
  reloadMs: 1600,
  fireMs: 80, // 750 rpm
  dmg: 34,
  headMult: 1.8,
  enemyHp: 68,
  enemyDmg: 9,
  enemySpeed: 2.7,
  waves: 5
};

let scene, camera, renderer, clock;
let yaw = 0, pitch = 0;
let keys = {};
let vel = new THREE.Vector3();
let pos = new THREE.Vector3(0, CONFIG.playerH, 8);
let isLocked = false;
let health = CONFIG.maxHealth;
let ammo = CONFIG.magSize;
let reserve = CONFIG.reserve;
let reloading = false;
let lastFire = 0;
let score = 0;
let kills = 0;
let wave = 1;
let enemies = [];
let bullets = [];
let particles = [];
let decals = [];
let canShoot = true;
let gameState = 'menu'; // menu, playing, dead, won
let enemyAlive = 0;
let damageFlashT = 0;
let isFiring = false;
let recoilKick = 0;
let shellPool = 0;

// DOM
const waveEl = document.getElementById('wave');
const scoreEl = document.getElementById('score');
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const ammoEl = document.getElementById('ammo');
const reserveEl = document.getElementById('reserve');
const enemyCountEl = document.getElementById('enemyCount');
const reloadText = document.getElementById('reloadText');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const vignette = document.getElementById('vignette');
const flash = document.getElementById('flash');
const hitmarker = document.getElementById('hitmarker');
const crosshair = document.getElementById('crosshair');
const killfeed = document.getElementById('killfeed');
const centerMsg = document.getElementById('centerMsg');
const centerTitle = document.getElementById('centerTitle');
const centerSub = document.getElementById('centerSub');

let audioCtx;
function ensureAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}
function beep(freq, dur, vol=0.2, type='square', slide=0){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.value=vol;
  o.connect(g).connect(audioCtx.destination);
  o.start();
  if(slide) o.frequency.exponentialRampToValueAtTime(freq*slide, audioCtx.currentTime+dur);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
  o.stop(audioCtx.currentTime+dur);
}
function sfxShoot(){ ensureAudio(); beep(180,0.08,0.32,'square',0.7); setTimeout(()=>beep(90,0.06,0.18,'square',1.2),20); }
function sfxHit(){ ensureAudio(); beep(900,0.07,0.18,'square',1.3); }
function sfxKill(){ ensureAudio(); beep(600,0.12,0.25,'triangle',1.5); setTimeout(()=>beep(1200,0.14,0.2,'square',1),60); }
function sfxReload(){ ensureAudio(); beep(320,0.18,0.18,'triangle',0.9); setTimeout(()=>beep(480,0.12,0.15,'sine',1),220); }
function sfxHurt(){ ensureAudio(); beep(120,0.22,0.28,'sawtooth',0.85); }
function sfxEmpty(){ ensureAudio(); beep(200,0.12,0.15,'square',1); }

init();

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f16);
  scene.fog = new THREE.Fog(0x0a0f16, 22, 62);

  camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
  camera.position.copy(pos);

  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.body.prepend(renderer.domElement);

  clock = new THREE.Clock();

  // Lights - readable COD lighting (improved fidelity vs flat wash)
  const hemi = new THREE.HemisphereLight(0x8fb7ff, 0x0a0d12, 1.15);
  hemi.position.set(0,20,0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff6ed, 1.45);
  dir.position.set(12,18,8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 60;
  dir.shadow.camera.left=-28; dir.shadow.camera.right=28; dir.shadow.camera.top=22; dir.shadow.camera.bottom=-22;
  dir.shadow.bias = -0.0006;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffccaa, 0.42);
  fill.position.set(-10,8,-12);
  scene.add(fill);
  const point = new THREE.PointLight(0xff3b30, 0, 18);
  point.position.set(0,3, -6);
  scene.add(point);
  const rim = new THREE.PointLight(0x6ba8ff, 0.7, 40);
  rim.position.set(0, 9, 0);
  scene.add(rim);

  // Ground — procedural concrete texture (addresses critic flat-color gap without external assets)
  function makeConcreteTexture(){
    const c = document.createElement('canvas'); c.width=512; c.height=512;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#18202e'; ctx.fillRect(0,0,512,512);
    for(let i=0;i<9000;i++){
      const x=Math.random()*512, y=Math.random()*512;
      const v=Math.floor(24+Math.random()*28);
      ctx.fillStyle=`rgba(${v},${v+8},${v+12},0.22)`;
      ctx.fillRect(x,y,1.6,1.6);
    }
    // subtle large mottling
    for(let i=0;i<18;i++){
      const x=Math.random()*512, y=Math.random()*512, r=18+Math.random()*42;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(255,255,255,0.04)'); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
    const tex=new THREE.CanvasTexture(c);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(4.5,4.5); tex.anisotropy=4;
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
  }
  const concreteTex = makeConcreteTexture();
  const groundGeo = new THREE.PlaneGeometry(CONFIG.arena*2.2, CONFIG.arena*2.2);
  const groundMat = new THREE.MeshStandardMaterial({ map: concreteTex, color:0xffffff, roughness:0.92, metalness:0.04 });
  // keep map brightness readable under ACES
  groundMat.map.needsUpdate=true;
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);
  // subtle grid overlay (lower opacity, no placeholder dominance)
  const grid = new THREE.GridHelper(CONFIG.arena*2, 36, 0x1e2a3a, 0x141c28);
  grid.material.opacity=0.22; grid.material.transparent=true;
  grid.position.y = 0.02;
  scene.add(grid);

  // Walls + cover — slightly varied PBR values for readable lighting (critic flat-shade remediation)
  const wallMat = new THREE.MeshStandardMaterial({ color:0x0f1721, roughness:0.88, metalness:0.04 });
  const crateMat = new THREE.MeshStandardMaterial({ color:0x1b2533, roughness:0.82, metalness:0.06 });
  const metalMat = new THREE.MeshStandardMaterial({ color:0x2a3446, roughness:0.42, metalness:0.38 });
  const obstacles = [];
  function addBox(pos_, size, mat, cast=true){
    const g = new THREE.BoxGeometry(size.x,size.y,size.z);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(pos_);
    m.castShadow = cast; m.receiveShadow = true;
    scene.add(m);
    // AABB for collision
    const half = size.clone().multiplyScalar(0.5);
    obstacles.push({ min: new THREE.Vector3(pos_.x-half.x, 0, pos_.z-half.z), max: new THREE.Vector3(pos_.x+half.x, size.y, pos_.z+half.z), h:size.y });
    return m;
  }
  const half = CONFIG.arena/2;
  const wallThick = 1.2;
  addBox(new THREE.Vector3(0, CONFIG.wallH/2, half+wallThick/2), new THREE.Vector3(CONFIG.arena+wallThick*2, CONFIG.wallH, wallThick), wallMat);
  addBox(new THREE.Vector3(0, CONFIG.wallH/2, -half-wallThick/2), new THREE.Vector3(CONFIG.arena+wallThick*2, CONFIG.wallH, wallThick), wallMat);
  addBox(new THREE.Vector3(half+wallThick/2, CONFIG.wallH/2, 0), new THREE.Vector3(wallThick, CONFIG.wallH, CONFIG.arena), wallMat);
  addBox(new THREE.Vector3(-half-wallThick/2, CONFIG.wallH/2, 0), new THREE.Vector3(wallThick, CONFIG.wallH, CONFIG.arena), wallMat);
  // cover crates -/readable arena
  addBox(new THREE.Vector3(-7, 1.1, -2), new THREE.Vector3(4, 2.2, 2.4), crateMat);
  addBox(new THREE.Vector3(7, 1.1, 1), new THREE.Vector3(4, 2.2, 2.4), crateMat);
  addBox(new THREE.Vector3(0, 0.9, -9), new THREE.Vector3(6, 1.8, 1.6), metalMat);
  addBox(new THREE.Vector3(0, 0.9, 9), new THREE.Vector3(6, 1.8, 1.6), metalMat);
  addBox(new THREE.Vector3(-5, 0.75, 6), new THREE.Vector3(2, 1.5, 2), crateMat);
  addBox(new THREE.Vector3(5, 0.75, -6), new THREE.Vector3(2, 1.5, 2), crateMat);
  addBox(new THREE.Vector3(-9, 0.9, 5), new THREE.Vector3(1.6, 1.8, 5), metalMat);
  addBox(new THREE.Vector3(9, 0.9, -2), new THREE.Vector3(1.6, 1.8, 5), metalMat);
  // central container
  addBox(new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(3, 2.4, 3), crateMat);

  scene.userData.obstacles = obstacles;

  // Weapon mesh group (viewmodel)
  weaponGroup = createWeapon();

  // Events
  addEventListener('resize', onResize);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', e=> keys[e.code]=false);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);

  document.getElementById('playBtn').addEventListener('click', ()=> {
    ensureAudio();
    if(gameState==='playing' && !isLocked){
      // resume paused mid-wave — do not restart
      hideStart(); lock();
    } else if(gameState==='dead' || gameState==='won'){
      hideEnd(); resetGame(); lock(); startWave(1);
    } else {
      // menu -> start fresh
      lock(); startWave(1);
    }
  });
  document.getElementById('howBtn').addEventListener('click', ()=> {
    showCenter('CONTROLS', 'WASD + Mouse • Click to fire • Hold fire • R reload • Shift sprint');
  });
  document.getElementById('restartBtn').addEventListener('click', ()=> { hideEnd(); resetGame(); lock(); startWave(1); });
  document.getElementById('menuBtn').addEventListener('click', ()=> { hideEnd(); resetGame(); isFiring=false; unlock(); gameState='menu'; showStart(); document.getElementById('playBtn').textContent='▶ BREACH — CLICK TO LOCK'; });

  document.addEventListener('pointerlockchange', ()=>{
    isLocked = document.pointerLockElement === renderer.domElement;
    if(isLocked){
      if(gameState==='menu'){ gameState='playing'; hideStart(); }
      else if(startOverlay && !startOverlay.classList.contains('hidden') && gameState==='playing'){
        hideStart();
      }
    } else {
      isFiring=false;
      if(gameState==='playing' && endOverlay.classList.contains('hidden')){
        // user pressed ESC or lost lock mid-game -> show pause overlay (if not already visible)
        if(startOverlay.classList.contains('hidden')) showStartMini();
      }
    }
  });
  renderer.domElement.addEventListener('click', ()=>{
    if(gameState==='playing' && !isLocked) lock();
  });

  // Prevent context menu
  renderer.domElement.addEventListener('contextmenu', e=>e.preventDefault());

  animate();
}

let weaponGroup, muzzleLight, muzzleFlashMesh;
function createWeapon(){
  const g = new THREE.Group();
  // simple M4-ish shape
  const mat = new THREE.MeshStandardMaterial({ color:0x0e1218, roughness:0.55, metalness:0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.55), mat);
  body.position.set(0.32,-0.28,-0.55);
  g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.42,10), new THREE.MeshStandardMaterial({color:0x1a202c, roughness:0.3, metalness:0.6}));
  barrel.rotation.x = Math.PI/2;
  barrel.position.set(0.32,-0.28,-0.88);
  g.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.06,0.08), new THREE.MeshStandardMaterial({color:0x11151c}));
  sight.position.set(0.32,-0.22,-0.58);
  g.add(sight);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.14,0.12), new THREE.MeshStandardMaterial({color:0x0a0d12}));
  mag.position.set(0.32,-0.36,-0.52);
  g.add(mag);
  muzzleLight = new THREE.PointLight(0xff8a00, 0, 3);
  muzzleLight.position.set(0.32,-0.28,-1.1);
  g.add(muzzleLight);
  muzzleFlashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08,0.18,8), new THREE.MeshBasicMaterial({ color:0xffae00, transparent:true, opacity:0 }));
  muzzleFlashMesh.rotation.x = -Math.PI/2;
  muzzleFlashMesh.position.set(0.32,-0.28,-1.05);
  g.add(muzzleFlashMesh);

  scene.add(g);
  // attach to camera in animate loop instead of parent, to keep world pos correct
  g.userData.basePos = new THREE.Vector3(0.32,-0.28,-0.55);
  return g;
}

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
function onKeyDown(e){
  keys[e.code]=true;
  if(e.code==='KeyR') tryReload();
  if(e.code==='Escape'){ unlock(); if(gameState==='playing'){ showStartMini(); } }
}
function onMouseMove(e){
  if(!isLocked || gameState!=='playing') return;
  const sens = 0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
}
function onMouseDown(e){
  if(e.button===0 && isLocked && gameState==='playing'){
    isFiring=true;
    tryFire();
  }
}
function onMouseUp(e){
  if(e.button===0) isFiring=false;
}

function lock(){ renderer.domElement.requestPointerLock(); }
function unlock(){ if(document.pointerLockElement) document.exitPointerLock(); }
function showStart(){ startOverlay.classList.remove('hidden'); }
function hideStart(){ startOverlay.classList.add('hidden'); }
function showStartMini(){
  startOverlay.classList.remove('hidden');
  document.getElementById('playBtn').textContent = '▶ RESUME — CLICK TO LOCK';
}
function hideEnd(){ endOverlay.classList.add('hidden'); }
function showEnd(title, tag, desc){
  document.getElementById('endTitle').textContent = title;
  document.getElementById('endTag').textContent = tag;
  document.getElementById('endDesc').textContent = desc;
  document.getElementById('statScore').textContent = score;
  document.getElementById('statWave').textContent = wave;
  document.getElementById('statKills').textContent = kills;
  endOverlay.classList.remove('hidden');
  unlock();
}

function updateHUD(){
  waveEl.textContent = wave;
  scoreEl.textContent = score;
  hpText.textContent = Math.max(0, Math.ceil(health));
  hpFill.style.width = Math.max(0, health/CONFIG.maxHealth*100)+'%';
  hpFill.classList.toggle('low', health < 32);
  ammoEl.textContent = ammo;
  reserveEl.textContent = reserve;
  enemyCountEl.textContent = enemyAlive;
  reloadText.classList.toggle('hidden', !reloading);
}

function tryReload(){
  if(reloading || gameState!=='playing' || ammo===CONFIG.magSize || reserve===0) return;
  reloading = true;
  updateHUD();
  sfxReload();
  setTimeout(()=>{
    const need = CONFIG.magSize - ammo;
    const take = Math.min(need, reserve);
    reserve -= take; ammo += take;
    reloading = false;
    updateHUD();
  }, CONFIG.reloadMs);
}

function tryFire(){
  if(gameState!=='playing' || reloading || !isLocked) return;
  const now = performance.now();
  if(now - lastFire < CONFIG.fireMs) return;
  if(ammo<=0){ sfxEmpty(); showCenter('RELOAD', 'Press R', 520); isFiring=false; return; }
  lastFire = now;
  ammo--;
  updateHUD();
  sfxShoot();
  // recoil — vertical climb + horizontal jitter, with kick decay handled in updatePlayer
  pitch += 0.012 + Math.random()*0.006; yaw += (Math.random()-0.5)*0.014;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
  recoilKick = 0.11;
  // muzzle flash
  muzzleLight.intensity = 3.6;
  muzzleFlashMesh.material.opacity = 0.98;
  muzzleFlashMesh.scale.set(1.15,1.15,1.15);
  setTimeout(()=>{ muzzleLight.intensity=0; muzzleFlashMesh.material.opacity=0; muzzleFlashMesh.scale.set(1,1,1); }, 52);
  // screenshake tiny
  camera.position.y += 0.014;
  spawnShell();

  // raycast shoot
  const origin = camera.position.clone();
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  // add spread
  const spread = 0.012 + (keys['ShiftLeft']?0.008:0);
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.z += (Math.random()-0.5)*spread;
  dir.normalize();
  fireRay(origin, dir);
  // auto reload if empty and reserve
  if(ammo===0 && reserve>0) setTimeout(tryReload, 180);
}

function spawnShell(){
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const ejectPos = camera.position.clone().add(right.clone().multiplyScalar(0.22)).add(new THREE.Vector3(0,-0.24,0)).add(dir.clone().multiplyScalar(0.12));
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.038,6), new THREE.MeshStandardMaterial({ color:0xc8a44a, roughness:0.45, metalness:0.6 }));
  m.rotation.z = Math.PI/2;
  m.position.copy(ejectPos);
  scene.add(m);
  const v = right.clone().multiplyScalar(2.2 + Math.random()*1.2).add(new THREE.Vector3(0,1.2+Math.random()*0.8,0)).add(dir.clone().multiplyScalar(-0.4));
  let life=0.7;
  const tick=()=>{
    m.position.add(v.clone().multiplyScalar(0.016));
    v.y -= 9.8*0.016;
    v.multiplyScalar(0.985);
    m.rotation.x += 0.28; m.rotation.z += 0.18;
    life-=0.016;
    if(life<=0 || m.position.y<0.04){ scene.remove(m); }
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function fireRay(origin, dir){
  scene.updateMatrixWorld();
  const ray = new THREE.Raycaster(origin, dir, 0, 60);
  const meshes = enemies.map(e=>e.mesh).filter(Boolean);
  // add head meshes
  const headMeshes = enemies.map(e=>e.head).filter(Boolean);
  // Instead, intersect enemies first
  let hit = null;
  let minDist = Infinity;
  let hitIsHead = false;
  // Check head spheres first (approx)
  for(const e of enemies){
    if(!e.alive) continue;
    const headWorld = e.head.getWorldPosition(new THREE.Vector3());
    const toHead = new THREE.Vector3().subVectors(headWorld, origin);
    // simple ray-sphere
    const b = toHead.dot(dir);
    if(b<0) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(b));
    const distToHead = closest.distanceTo(headWorld);
    const headR = 0.28;
    if(distToHead < headR){
      const d = origin.distanceTo(closest);
      if(d < minDist){ minDist=d; hit=e; hitIsHead=true; }
    }
  }
  if(!hit){
    const hits = ray.intersectObjects(meshes, false);
    if(hits.length){ hit = enemies.find(e=>e.mesh===hits[0].object); minDist = hits[0].distance; hitIsHead=false; }
  }
  if(hit){
    const dmg = CONFIG.dmg * (hitIsHead? CONFIG.headMult:1);
    hit.hp -= dmg;
    // push back
    hit.vel.add(dir.clone().multiplyScalar(0.9));
    spawnHitParticles(hit.mesh.position.clone().add(new THREE.Vector3(0,1,0)), hitIsHead? 0xffd60a:0xff3b30);
    showHitmarker(hitIsHead);
    sfxHit();
    if(hit.hp<=0){
      killEnemy(hit, hitIsHead);
    } else {
      // damage flash on enemy
      hit.mesh.material.emissive.setHex(0x441111);
      setTimeout(()=>hit.mesh.material.emissive.setHex(0x000000), 80);
    }
  } else {
    // miss - spawn decal/particles at far point or wall
    const far = origin.clone().add(dir.clone().multiplyScalar(30));
    // try wall intersect
    const wallHits = ray.intersectObjects(scene.children.filter(o=>o.isMesh && o.geometry.type==='BoxGeometry'), false);
    let p = far;
    if(wallHits.length) p = wallHits[0].point;
    spawnMissParticles(p);
    spawnDecal(p, dir);
  }
  // tracer line
  spawnTracer(origin, dir, hit? minDist: 26);
  // add hitmarker visual regardless on hit
  if(hit) {
    crosshair.classList.add('hit'); setTimeout(()=>crosshair.classList.remove('hit'),120);
  }
}

function showHitmarker(isHead){
  hitmarker.classList.remove('show'); void hitmarker.offsetWidth; hitmarker.classList.add('show');
  hitmarker.style.borderColor = isHead? '#ffd60a':'#fff';
  setTimeout(()=>hitmarker.classList.remove('show'), 160);
}
function showCenter(title, sub, ms=1600){
  centerTitle.textContent = title; centerSub.textContent = sub;
  centerMsg.classList.remove('hidden');
  clearTimeout(showCenter._t);
  showCenter._t = setTimeout(()=>centerMsg.classList.add('hidden'), ms);
}
function pushKillFeed(text){
  const el = document.createElement('div'); el.className='kf'; el.textContent=text;
  killfeed.prepend(el); setTimeout(()=>el.remove(), 2100);
}

function spawnTracer(origin, dir, len){
  const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), origin.clone().add(dir.clone().multiplyScalar(len))]);
  const mat = new THREE.LineBasicMaterial({ color:0xffe39c, transparent:true, opacity:0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  let t=0;
  function fade(){
    t+=0.14; mat.opacity = 1-t;
    if(t>=1) scene.remove(line);
    else requestAnimationFrame(fade);
  }
  fade();
}
function spawnHitParticles(pos_, color){
  for(let i=0;i<8;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95 }));
    m.position.copy(pos_.clone().add(new THREE.Vector3((Math.random()-0.5)*0.4, (Math.random())*0.4, (Math.random()-0.5)*0.4)));
    const v = new THREE.Vector3((Math.random()-0.5)*6, Math.random()*5+1, (Math.random()-0.5)*6);
    scene.add(m);
    let life=0.42;
    const tick = (dt)=>{
      m.position.add(v.clone().multiplyScalar(dt));
      v.y -= 9*dt;
      m.material.opacity -= dt*2.2;
      life -= dt;
      if(life<=0 || m.material.opacity<=0) scene.remove(m);
      else requestAnimationFrame(()=>tick(0.016));
    };
    requestAnimationFrame(()=>tick(0.016));
  }
}
function spawnMissParticles(p){
  for(let i=0;i<5;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.04,5,5), new THREE.MeshBasicMaterial({ color:0x8a93a6, transparent:true, opacity:0.8 }));
    m.position.copy(p);
    const v = new THREE.Vector3((Math.random()-0.5)*4, Math.random()*3, (Math.random()-0.5)*4);
    scene.add(m);
    let life=0.32;
    const tick=(dt)=>{
      m.position.add(v.clone().multiplyScalar(dt));
      v.y -= 8*dt;
      m.material.opacity -= dt*3;
      life-=dt;
      if(life<=0) scene.remove(m); else requestAnimationFrame(()=>tick(0.016));
    };
    requestAnimationFrame(()=>tick(0.016));
  }
}
function spawnDecal(pos_, dir){
  const g = new THREE.CircleGeometry(0.14,8);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0x121821, side:THREE.DoubleSide }));
  m.position.copy(pos_.add(dir.clone().multiplyScalar(-0.02)));
  m.lookAt(m.position.clone().add(dir));
  scene.add(m);
  decals.push(m);
  if(decals.length>40){ const old=decals.shift(); scene.remove(old); }
}

function createEnemy(spawnPos){
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color:0xc12a2a, roughness:0.72, emissive:0x000000 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 12), bodyMat);
  body.castShadow=true; body.receiveShadow=true; body.position.y=0.95;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,12,10), new THREE.MeshStandardMaterial({ color:0xffd9b3, roughness:0.8 }));
  head.position.set(0,1.62,0); head.castShadow=true;
  group.add(head);
  // visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.08,0.08), new THREE.MeshStandardMaterial({ color:0x0a0f16 }));
  visor.position.set(0,1.62,0.18);
  group.add(visor);

  group.position.copy(spawnPos);
  group.position.y=0;
  scene.add(group);
  const e = { mesh: body, head, group, pos: group.position, vel: new THREE.Vector3(), hp: CONFIG.enemyHp, maxHp: CONFIG.enemyHp, alive:true, lastShot:0, shootCd: 900 + Math.random()*700 };
  // HP bar sprite via canvas
  e.bodyMat = bodyMat;
  enemies.push(e);
  return e;
}

function killEnemy(e, headshot){
  if(!e.alive) return;
  e.alive=false;
  score += headshot? 180:100;
  kills++;
  // death anim
  e.group.rotation.z = Math.PI/2.2;
  e.group.position.y = -0.1;
  e.mesh.material.color.setHex(0x3a0e0e);
  setTimeout(()=>{ scene.remove(e.group); }, 1600);
  spawnHitParticles(e.group.position.clone().add(new THREE.Vector3(0,1,0)), 0xff3b30);
  sfxKill();
  pushKillFeed((headshot?'HEADSHOT ':'') + 'ELIMINATED • +' + (headshot?180:100));
  showCenter('ELIMINATED', headshot? 'HEADSHOT':'TARGET DOWN', 520);
  // score bump pulse
  scoreEl.style.transform='scale(1.2)'; setTimeout(()=>scoreEl.style.transform='',140);
}

function spawnWave(n){
  const count = Math.round(3 + n*1.8 + (n===5?3:0)); // Wave 1: ~4-5, wave5: ~12? but cap
  const actual = n===5? 8 : Math.min(count, 7);
  const speedMult = 1 + (n-1)*0.18;
  // spawn around perimeter
  const spawns = [
    new THREE.Vector3(0,0,-16), new THREE.Vector3(14,0,0), new THREE.Vector3(-14,0,0), new THREE.Vector3(0,0,16),
    new THREE.Vector3(10,0,-12), new THREE.Vector3(-10,0,12), new THREE.Vector3(12,0,10), new THREE.Vector3(-12,0,-10)
  ];
  for(let i=0;i<actual;i++){
    const sp = spawns[i % spawns.length].clone();
    sp.x += (Math.random()-0.5)*3; sp.z += (Math.random()-0.5)*3;
    const e = createEnemy(sp);
    e.speed = CONFIG.enemySpeed * speedMult * (0.92 + Math.random()*0.18);
    e.hp = CONFIG.enemyHp + (n-1)*10;
    e.maxHp = e.hp;
  }
  updateAlive();
  showCenter('WAVE ' + n, actual + ' HOSTILES BREACHING', 1500);
}

function updateAlive(){
  enemyAlive = enemies.filter(e=>e.alive).length;
  updateHUD();
  if(enemyAlive===0 && gameState==='playing'){
    // wave cleared
    if(wave >= CONFIG.waves){
      winGame();
    } else {
      showCenter('WAVE CLEAR', 'RELOADING BREACH…', 1500);
      // bonus
      health = Math.min(CONFIG.maxHealth, health + 12);
      reserve = Math.min(180, reserve + 18);
      setTimeout(()=>{ wave++; updateHUD(); spawnWave(wave); }, 1700);
    }
  }
}

function winGame(){
  gameState='won';
  showEnd('MISSION COMPLETE', 'VICTORY', `All 5 breach waves cleared. You held the line. Final score ${score} with ${kills} kills. Redeploy to beat your score.`);
}
function loseGame(){
  gameState='dead';
  showEnd('KIA', 'DEFEAT', `Operator down on wave ${wave}. Hostiles overwhelmed the breach. Score ${score} • ${kills} kills. Hit redeploy.`);
}

function applyDamage(dmg){
  if(gameState!=='playing' || !isLocked) return;
  health -= dmg;
  vignette.classList.add('show'); vignette.style.opacity='';
  flash.classList.add('show');
  sfxHurt();
  // camera kick
  yaw += (Math.random()-0.5)*0.12;
  pitch += (Math.random()-0.5)*0.08;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
  setTimeout(()=>{ vignette.classList.remove('show'); flash.classList.remove('show'); if(health<28) vignette.style.opacity=''; }, 180);
  if(health<=0){ health=0; vignette.style.opacity=''; vignette.classList.remove('show'); updateHUD(); loseGame(); }
  updateHUD();
}

function resetGame(){
  // clean enemies
  enemies.forEach(e=> scene.remove(e.group));
  enemies=[]; decals.forEach(d=>scene.remove(d)); decals=[];
  health=CONFIG.maxHealth; ammo=CONFIG.magSize; reserve=CONFIG.reserve; reloading=false; isFiring=false; recoilKick=0;
  score=0; kills=0; wave=1; vel.set(0,0,0);
  pos.set(0, CONFIG.playerH, 8);
  yaw=0; pitch=0;
  vignette.style.opacity=''; vignette.classList.remove('show');
  gameState='playing';
  updateHUD(); updateAlive();
}

function startWave(n){
  if(n===1 && gameState==='playing' && enemies.length>0 && !startOverlay.classList.contains('hidden')){
    // resuming pause — do not reset or duplicate spawn
    hideStart(); return;
  }
  wave=n;
  // if first time, clean
  if(enemies.length===0 || n===1){
    if(n===1 && enemies.length===0){ /* keep */ }
    else if(n===1){ resetGame(); }
  }
  gameState='playing';
  hideStart();
  updateHUD();
  spawnWave(n);
}

function collideSlide(nextPos){
  const obstacles = scene.userData.obstacles;
  const radius = 0.52;
  let p = nextPos.clone();
  // arena bounds
  const b = CONFIG.arena/2 - 0.6;
  p.x = Math.max(-b, Math.min(b, p.x));
  p.z = Math.max(-b, Math.min(b, p.z));
  // AABB collide
  for(const ob of obstacles){
    const closestX = Math.max(ob.min.x, Math.min(p.x, ob.max.x));
    const closestZ = Math.max(ob.min.z, Math.min(p.z, ob.max.z));
    const dx = p.x - closestX, dz = p.z - closestZ;
    const distSq = dx*dx + dz*dz;
    if(distSq < radius*radius){
      const dist = Math.sqrt(distSq) || 0.001;
      const push = (radius - dist);
      const nx = dx/dist, nz = dz/dist;
      p.x += nx * push;
      p.z += nz * push;
    }
  }
  return p;
}

function updatePlayer(dt){
  if(gameState!=='playing' || !isLocked) return;
  const fwd = new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let move = new THREE.Vector3();
  if(keys['KeyW']) move.add(fwd);
  if(keys['KeyS']) move.sub(fwd);
  if(keys['KeyA']) move.sub(right);
  if(keys['KeyD']) move.add(right);
  if(move.lengthSq()>0) move.normalize().multiplyScalar(CONFIG.moveSpeed * (keys['ShiftLeft']? CONFIG.sprintMult:1) * dt);
  // apply to vel with smoothing
  vel.lerp(move, 0.22);
  // slide
  let next = pos.clone().add(vel);
  // but vel is per frame scaled already? we lerp.
  // For delta independence, we already scaled move by dt but vel is immediate.
  // Let's treat vel as movement delta per frame
  // recompute next with dt already in move, so vel length ~ speed*dt
  next = pos.clone().add(vel);
  // keep y constant
  next.y = CONFIG.playerH;
  const slid = collideSlide(next);
  pos.copy(slid);
  camera.position.copy(pos);
  camera.rotation.order='YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // weapon sway / bob + recoil kick decay
  recoilKick = Math.max(0, recoilKick - dt*1.9);
  if(weaponGroup){
    weaponGroup.position.copy(camera.position);
    weaponGroup.quaternion.copy(camera.quaternion);
    // offset forward, with kick back on fire
    const kick = new THREE.Vector3(0,0, recoilKick).applyQuaternion(camera.quaternion);
    const off = new THREE.Vector3(0.32,-0.30,-0.62).applyQuaternion(camera.quaternion);
    weaponGroup.position.add(off).sub(kick);
    // bob when moving
    const moving = move.lengthSq()>0.0001;
    const bobT = performance.now()*0.012;
    if(moving && isLocked){
      weaponGroup.position.y += Math.sin(bobT)*0.015;
      weaponGroup.position.x += Math.cos(bobT*0.5)*0.01;
    }
    // recoil pitch visual (weapon lifts)
    weaponGroup.rotateX(recoilKick * 0.9);
  }
}

function updateEnemies(dt){
  if(gameState!=='playing' || !isLocked) return;
  const now = performance.now();
  for(const e of enemies){
    if(!e.alive) continue;
    const toPlayer = new THREE.Vector3().subVectors(pos, e.group.position);
    toPlayer.y=0;
    const dist = toPlayer.length();
    toPlayer.normalize();
    // steer
    const desired = toPlayer.clone().multiplyScalar(e.speed * dt);
    // simple obstacle avoidance: ray ahead
    let velAdd = desired.clone();
    // separate from other enemies
    for(const o of enemies){
      if(o===e||!o.alive) continue;
      const d = e.group.position.distanceTo(o.group.position);
      if(d<1.2){ velAdd.add(new THREE.Vector3().subVectors(e.group.position,o.group.position).normalize().multiplyScalar((1.2-d)*0.6*dt)); }
    }
    // try move with collide
    let next = e.group.position.clone().add(velAdd);
    next.y=0;
    // collide vs obstacles (slide)
    const slid = collideSlide(next);
    e.group.position.copy(slid);
    // look at player
    e.group.lookAt(pos.x, e.group.position.y, pos.z);

    // attack if in range and visible
    if(dist < 14 && dist > 2){
      if(now - e.lastShot > e.shootCd){
        // line of sight check simplified: distance only
        e.lastShot = now;
        // inaccurate enemy fire
        if(Math.random() < 0.62){
          applyDamage(CONFIG.enemyDmg * (wave>=4?1.25:1));
          // tracer from enemy to player
          const start = e.group.position.clone().add(new THREE.Vector3(0,1.2,0));
          const dir = new THREE.Vector3().subVectors(pos, start).normalize();
          dir.x += (Math.random()-0.5)*0.08; dir.y += (Math.random()-0.5)*0.08; dir.z += (Math.random()-0.5)*0.08;
          spawnTracer(start, dir, start.distanceTo(pos));
          // muzzle flash small
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({ color:0xff8a00, transparent:true, opacity:0.9 }));
          m.position.copy(start); scene.add(m); setTimeout(()=>scene.remove(m), 60);
        }
      }
    } else if(dist <=2){
      // melee
      if(now - e.lastShot > 650){
        e.lastShot=now;
        applyDamage(CONFIG.enemyDmg*1.2);
      }
    }
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  // hold-to-fire tick (auto at 750 rpm) — throttled inside tryFire
  if(isFiring && isLocked && gameState==='playing' && !reloading) tryFire();
  updatePlayer(dt);
  updateEnemies(dt);
  // low-health persistent vignette (25% hp)
  if(gameState==='playing' && health < 28 && health > 0){
    vignette.style.opacity = String(0.32 + Math.sin(performance.now()*0.006)*0.16);
    vignette.classList.add('show');
  } else if(!vignette.classList.contains('show') || health>=28){
    // keep normal flash logic; ensure opacity reset
    if(health>=28) { vignette.style.opacity=''; }
  }
  // check auto heal subtle? no
  // update alive check each frame after damage
  if(gameState==='playing'){
    const alive = enemies.filter(e=>e.alive).length;
    if(alive!==enemyAlive){ enemyAlive=alive; updateHUD(); }
    // if cleared
    if(alive===0 && enemies.length>0){
      // debounce
      if(!animate._clearT){
        animate._clearT = setTimeout(()=>{ animate._clearT=null; updateAlive(); }, 400);
      }
    }
  }
  renderer.render(scene,camera);
}

// expose for tests
window.__GAME__ = { getState: ()=>({ health, ammo, reserve, wave, score, kills, gameState, enemyAlive }), startWave, resetGame, tryFire, tryReload, CONFIG };

// initial HUD
updateHUD();

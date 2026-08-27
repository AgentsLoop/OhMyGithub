import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- Config (Gauntlet bar: CoD MWIII/Warzone) ---
const BAR = 'Call of Duty: Modern Warfare III (2023) — Warzone facility infiltration';
const ENEMY_COUNT = 8;
const PLAYER_MAX_HEALTH = 100;
const MAG_SIZE = 30;
const RESERVE_AMMO = 90;

// --- DOM ---
const canvas = document.getElementById('c');
const hud = document.getElementById('hud');
const menuEl = document.getElementById('menu');
const victoryEl = document.getElementById('victory');
const defeatEl = document.getElementById('defeat');
const playBtn = document.getElementById('playBtn');
const againBtn = document.getElementById('againBtn');
const retryBtn = document.getElementById('retryBtn');
const menuBtnV = document.getElementById('menuBtnV');
const menuBtnD = document.getElementById('menuBtnD');
const healthBar = document.getElementById('healthBar');
const healthText = document.getElementById('healthText');
const ammoEl = document.getElementById('ammo');
const objCount = document.getElementById('objCount');
const timerEl = document.getElementById('timer');
const crosshair = document.getElementById('crosshair');
const hitmarker = document.getElementById('hitmarker');
const damageVignette = document.getElementById('damageVignette');
const killfeed = document.getElementById('killfeed');
const notifEl = document.getElementById('notif');
const attributionEl = document.getElementById('attribution');
const miniCanvas = document.getElementById('mini');

// --- Three setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a121e);
scene.fog = new THREE.Fog(0x0a121e, 28, 78);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 10);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Lights — AAA attempt: key + fill + rim + emissive
scene.add(new THREE.HemisphereLight(0x8ec8ff, 0x0a121e, 0.55));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(18, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x6ba7ff, 0.55);
fill.position.set(-12, 10, -14);
scene.add(fill);
const rimLight = new THREE.PointLight(0x00e5ff, 12, 30);
rimLight.position.set(0, 6, -18);
scene.add(rimLight);

// Environment map subtle
const pmrem = new THREE.WebGLCubeRenderTarget(256);
scene.environment = pmrem.texture;

// Ground & level
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.92, metalness: 0.06 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);
// Grid overlay
const grid = new THREE.GridHelper(80, 40, 0x1e2a3a, 0x1e2a3a);
grid.position.y = 0.02;
scene.add(grid);

// Materials palette
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4558, roughness: 0.85, metalness: 0.08 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x7a8799, roughness: 0.42, metalness: 0.62 });
const crateMat = new THREE.MeshStandardMaterial({ color: 0x8f7a5a, roughness: 0.9, metalness: 0.02 });
const crateMat2 = new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.78, metalness: 0.22 });
const emissiveMat = new THREE.MeshStandardMaterial({ color: 0x0e2a3a, emissive: 0x00e5ff, emissiveIntensity: 0.6, roughness: 0.6 });

// Level colliders: array of Box3 for simple AABB
const colliders = [];
function addBox(pos, size, mat, castShadow=true, receiveShadow=true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
  m.position.copy(pos);
  m.castShadow = castShadow; m.receiveShadow = receiveShadow;
  scene.add(m);
  const box = new THREE.Box3().setFromCenterAndSize(pos, size);
  colliders.push(box);
  return m;
}

// Perimeter walls
const W = 36, H = 6;
addBox(new THREE.Vector3(0, H/2, -W/2), new THREE.Vector3(W, H, 1), wallMat);
addBox(new THREE.Vector3(0, H/2, W/2), new THREE.Vector3(W, H, 1), wallMat);
addBox(new THREE.Vector3(-W/2, H/2, 0), new THREE.Vector3(1, H, W), wallMat);
addBox(new THREE.Vector3(W/2, H/2, 0), new THREE.Vector3(1, H, W), wallMat);

// Inner structures — industrial facility
addBox(new THREE.Vector3(-9, 1.1, -6), new THREE.Vector3(6, 2.2, 3), crateMat);
addBox(new THREE.Vector3(10, 1.4, -4), new THREE.Vector3(5, 2.8, 2.5), crateMat2);
addBox(new THREE.Vector3(0, 1.0, 6), new THREE.Vector3(8, 2, 2), crateMat);
addBox(new THREE.Vector3(6, 0.9, 9), new THREE.Vector3(3, 1.8, 3), crateMat2);
addBox(new THREE.Vector3(-7, 1.2, 10), new THREE.Vector3(4, 2.4, 4), crateMat);
addBox(new THREE.Vector3(-12, 1.6, 2), new THREE.Vector3(2.2, 3.2, 6), metalMat);
addBox(new THREE.Vector3(12, 1.6, 5), new THREE.Vector3(2.2, 3.2, 7), metalMat);
// Platforms
addBox(new THREE.Vector3(-4, 0.4, -11), new THREE.Vector3(10, 0.8, 6), metalMat);
addBox(new THREE.Vector3(8, 0.4, -11), new THREE.Vector3(6, 0.8, 6), metalMat);
// Pillars
for (let i=0;i<4;i++){
  const x = -10 + i*7;
  addBox(new THREE.Vector3(x, 2.2, 0), new THREE.Vector3(0.7, 4.4, 0.7), metalMat);
}
// Container stacks
addBox(new THREE.Vector3(-2, 1.1, -2), new THREE.Vector3(2.2, 2.2, 2.2), new THREE.MeshStandardMaterial({color:0xc94a2a, roughness:0.7, metalness:0.18}));
addBox(new THREE.Vector3(2, 1.1, -2), new THREE.Vector3(2.2, 2.2, 2.2), new THREE.MeshStandardMaterial({color:0x2a9d8f, roughness:0.7, metalness:0.18}));

// Lights fixtures (emissive)
for (let i=0;i<4;i++){
  const lightBox = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 0.5), emissiveMat);
  lightBox.position.set(-8 + i*6, 5.5, -8 + (i%2)*14);
  scene.add(lightBox);
  const pl = new THREE.PointLight(0x8de6ff, 8, 12);
  pl.position.copy(lightBox.position); pl.position.y -= 0.6;
  scene.add(pl);
}

// Spawn points
const playerStart = new THREE.Vector3(0, 1.7, 14);
const enemySpawns = [
  new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 0, -12), new THREE.Vector3(-12, 0, 6),
  new THREE.Vector3(12, 0, -2), new THREE.Vector3(0, 0, -8), new THREE.Vector3(-6, 0, 2),
  new THREE.Vector3(8, 0, 8), new THREE.Vector3(3, 0, -13)
];

// --- Audio (WebAudio synth) ---
let audioCtx;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function playGunshot(){
  ensureAudio(); const t=audioCtx.currentTime;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain(), f=audioCtx.createBiquadFilter();
  o.type='square'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(40,t+0.08);
  f.type='bandpass'; f.frequency.value=1200;
  g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.18);
  o.connect(f); f.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.2);
  // noise
  const buf=audioCtx.createBuffer(1, Math.floor(0.12*audioCtx.sampleRate), audioCtx.sampleRate);
  for(let i=0;i<buf.length;i++) buf.getChannelData(0)[i]=(Math.random()*2-1)*Math.pow(1-i/buf.length,2);
  const ns=audioCtx.createBufferSource(); ns.buffer=buf; const ng=audioCtx.createGain(); ng.gain.setValueAtTime(0.28,t); ng.gain.exponentialRampToValueAtTime(0.01,t+0.12); ns.connect(ng); ng.connect(audioCtx.destination); ns.start(t);
}
function playHit(){ ensureAudio(); const t=audioCtx.currentTime; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(1400,t+0.07); g.gain.setValueAtTime(0.28,t); g.gain.linearRampToValueAtTime(0,t+0.12); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.13); }
function playReload(){ ensureAudio(); const t=audioCtx.currentTime; [220,330,440].forEach((freq,i)=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq; g.gain.setValueAtTime(0.12,t+i*0.11); g.gain.linearRampToValueAtTime(0,t+i*0.11+0.09); o.connect(g); g.connect(audioCtx.destination); o.start(t+i*0.11); o.stop(t+i*0.11+0.1); }); }

// --- Weapon viewmodel ---
let rifleRoot = new THREE.Group();
let muzzleFlash, weaponMixer;
let isADS = false;
let adsProgress = 0;
const defaultPos = new THREE.Vector3(0.32, -0.22, -0.62);
const adsPos = new THREE.Vector3(0, -0.18, -0.52);
const loader = new GLTFLoader();
let weaponLoaded = false;

function setupFallbackWeapon(){
  // procedural fallback if GLB fails — still looks like a sci-fi rifle
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.12,0.62), new THREE.MeshStandardMaterial({color:0x18202c, roughness:0.5, metalness:0.7}));
  body.position.set(0,0,-0.1); grp.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.55,12), new THREE.MeshStandardMaterial({color:0x2a3442, metalness:0.8, roughness:0.35}));
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.55); grp.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.14), new THREE.MeshStandardMaterial({color:0x0a0f1a, roughness:0.4, metalness:0.9}));
  sight.position.set(0,0.11,-0.18); grp.add(sight);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.18,0.14), new THREE.MeshStandardMaterial({color:0x0f1824, roughness:0.6, metalness:0.5}));
  mag.position.set(0,-0.14,-0.06); grp.add(mag);
  // add to rifleRoot
  grp.scale.set(1,1,1);
  rifleRoot.add(grp);
  weaponLoaded = true;
}

async function loadWeapon(){
  try{
    const gltf = await loader.loadAsync('/models/rifle.glb');
    const model = gltf.scene;
    // Compute bounds and normalize
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    // Scale to viewmodel size: target length ~1.2 units
    const maxDim = Math.max(size.x,size.y,size.z);
    const scale = 0.95 / maxDim;
    model.scale.setScalar(scale*1.6);
    // Orientation: many rifles face +Z, rotate to point -Z (forward)
    model.rotation.y = Math.PI;
    model.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; if(o.material){ o.material.roughness = Math.min(0.85, o.material.roughness ?? 0.7); o.material.envMapIntensity = 0.8; } }});
    rifleRoot.add(model);
    weaponLoaded = true;
    attributionEl.textContent = 'Weapon: CC-AR2 (Sci-fi rifle) by hoti28 (CC Attribution) — Sketchfab';
  }catch(e){
    console.warn('Rifle GLB failed', e);
    setupFallbackWeapon();
    attributionEl.textContent = 'Weapon: procedural fallback (GLB load failed) — hoti28 CC-AR2 intended';
  }
  // muzzle flash
  muzzleFlash = new THREE.PointLight(0xffcc66, 0, 6);
  muzzleFlash.position.set(0,0.02,-0.85);
  rifleRoot.add(muzzleFlash);
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 8), new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0}));
  flashMesh.rotation.x = Math.PI/2;
  flashMesh.position.copy(muzzleFlash.position);
  flashMesh.position.z -= 0.06;
  flashMesh.name='flashMesh';
  rifleRoot.add(flashMesh);
}
loadWeapon();

// Attach rifle to camera
camera.add(rifleRoot);
rifleRoot.position.copy(defaultPos);
rifleRoot.rotation.set(0,0,0);
scene.add(camera); // ensure camera is in scene for controls

// --- Enemies ---
let droneTemplate = null;
async function loadDroneTemplate(){
  try{
    const gltf = await loader.loadAsync('/models/drone.glb');
    droneTemplate = gltf.scene;
    droneTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
  }catch(e){ console.warn('drone load failed',e); droneTemplate=null; }
}
loadDroneTemplate();

class Enemy {
  constructor(pos, idx){
    this.idx=idx;
    this.maxHp=100; this.hp=100; this.alive=true;
    this.pos = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random()*Math.PI*2;
    this.shootCooldown = 1.2 + Math.random()*1.0;
    this.moveTimer = 0;
    this.targetPos = pos.clone();
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.position.y = 0.95;
    // visual
    if(droneTemplate){
      const inst = droneTemplate.clone(true);
      const b=new THREE.Box3().setFromObject(inst); const s=b.getSize(new THREE.Vector3()); const c=b.getCenter(new THREE.Vector3());
      inst.position.sub(c);
      const sc = 1.1 / Math.max(s.x,s.y,s.z);
      inst.scale.setScalar(sc*1.4);
      inst.rotation.y = Math.PI;
      this.group.add(inst);
      this.mesh = inst;
    }else{
      // fallback: hovering drone shape
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48,16,12), new THREE.MeshStandardMaterial({color:0xff2a2a, roughness:0.5, metalness:0.4, emissive:0x330000, emissiveIntensity:0.4}));
      body.scale.set(1,0.7,1);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62,0.06,8,20), new THREE.MeshStandardMaterial({color:0x182030, roughness:0.6, metalness:0.7}));
      ring.rotation.x=Math.PI/2;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12,10,8), new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:2}));
      eye.position.set(0,0.08,0.38);
      this.group.add(body,ring,eye);
      this.mesh = body;
    }
    // health bar sprite
    const canvasHB = document.createElement('canvas'); canvasHB.width=128; canvasHB.height=16;
    const tex = new THREE.CanvasTexture(canvasHB);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprMat = new THREE.SpriteMaterial({ map: tex, transparent:true });
    const sprite = new THREE.Sprite(sprMat);
    sprite.scale.set(1.2,0.15,1);
    sprite.position.y = 1.05;
    this.group.add(sprite);
    this.hbCanvas=canvasHB; this.hbTex=tex; this.hbSprite=sprite;
    this.updateHB();
    // collider
    this.radius=0.6;
    scene.add(this.group);
    // shadow helper ground circle
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55,16), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.28}));
    shadow.rotation.x=-Math.PI/2; shadow.position.y=0.02;
    this.group.add(shadow);
  }
  updateHB(){
    const ctx=this.hbCanvas.getContext('2d');
    ctx.clearRect(0,0,128,16);
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,128,16);
    const pct=this.hp/this.maxHp;
    ctx.fillStyle= pct>0.5? '#2ecc71' : pct>0.25? '#f1c40f' : '#e74c3c';
    ctx.fillRect(2,2,124*pct,12);
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.strokeRect(0.5,0.5,127,15);
    this.hbTex.needsUpdate=true;
  }
  takeDamage(amt, hitPos){
    if(!this.alive) return false;
    this.hp -= amt;
    this.updateHB();
    // hit effect
    spawnHitEffect(hitPos, this.group.position);
    if(this.hp<=0){
      this.alive=false;
      this.group.visible=false;
      spawnExplosion(this.group.position.clone());
      addKillFeed(`+100 ELIMINATED DRONE ${String(this.idx+1).padStart(2,'0')}`);
      showNotif('ELIMINATED', 450);
      // camera kick already done by shooter
      return true;
    }else{
      // flinch
      this.group.position.y += 0.08;
      setTimeout(()=>{ if(this.group) this.group.position.y=0.95; }, 80);
    }
    return false;
  }
  update(dt, playerPos){
    if(!this.alive) return;
    // hover bob
    this.group.position.y = 0.95 + Math.sin(performance.now()*0.002 + this.idx)*0.12;
    this.hbSprite.position.y = 1.05;
    // simple AI: move toward player if far, strafe
    const toPlayer = new THREE.Vector3().subVectors(playerPos, this.group.position);
    toPlayer.y=0; const dist=toPlayer.length();
    this.moveTimer -= dt;
    if(this.moveTimer<=0){
      // pick new target near player or random
      if(dist>12){
        this.targetPos.copy(playerPos).add(new THREE.Vector3((Math.random()-0.5)*4,0,(Math.random()-0.5)*4));
      }else{
        this.targetPos.copy(this.group.position).add(new THREE.Vector3((Math.random()-0.5)*6,0,(Math.random()-0.5)*6));
      }
      this.targetPos.x = THREE.MathUtils.clamp(this.targetPos.x, -17, 17);
      this.targetPos.z = THREE.MathUtils.clamp(this.targetPos.z, -17, 17);
      this.moveTimer = 1.2 + Math.random()*1.2;
    }
    const toTarget = new THREE.Vector3().subVectors(this.targetPos, this.group.position);
    toTarget.y=0; if(toTarget.length()>0.2){ toTarget.normalize().multiplyScalar(1.8*dt); this.group.position.add(toTarget); }
    // face player
    const ang = Math.atan2(toPlayer.x, toPlayer.z);
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, ang, dt*4);
    // shooting
    this.shootCooldown -= dt;
    if(dist<22 && dist>2 && this.shootCooldown<=0){
      // line of sight: simple ray check against walls? approximate by distance
      const canSee = true; // for vertical slice keep simple
      if(canSee){
        enemyShoot(this, playerPos);
        this.shootCooldown = 1.5 + Math.random()*1.2;
      }
    }
    // keep inside
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -17, 17);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -17, 17);
  }
}

let enemies = [];
function spawnEnemies(){
  enemies.forEach(e=> scene.remove(e.group));
  enemies = [];
  enemySpawns.forEach((p,i)=> {
    if(i<ENEMY_COUNT) enemies.push(new Enemy(p,i));
  });
  updateObjective();
}

// Particles & effects
const tmpVec = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const hitDecals = [];
function spawnHitEffect(pos, enemyPos){
  // sparks
  for(let i=0;i<6;i++){
    const geo = new THREE.SphereGeometry(0.03,4,4);
    const mat = new THREE.MeshBasicMaterial({color:0xffcc66});
    const m = new THREE.Mesh(geo,mat);
    m.position.copy(pos);
    m.userData.vel = new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4, (Math.random()-0.5)*6);
    m.userData.life=0.3;
    scene.add(m);
    const animate = (dt)=>{
      m.userData.life-=dt; if(m.userData.life<=0){ scene.remove(m); return false; }
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.vel.y -= 9*dt;
      return true;
    };
    activeEffects.push({ update: animate });
  }
}
function spawnExplosion(pos){
  const geo = new THREE.SphereGeometry(0.5,12,10);
  const mat = new THREE.MeshBasicMaterial({color:0xff6a2a, transparent:true, opacity:0.85});
  const m=new THREE.Mesh(geo,mat); m.position.copy(pos); m.position.y=0.9; scene.add(m);
  let t=0; activeEffects.push({ update:(dt)=>{
    t+=dt; m.scale.setScalar(1+t*4); mat.opacity=0.85 - t*1.8; if(mat.opacity<=0){ scene.remove(m); return false; } return true;
  }});
}
function spawnTracer(from, to){
  const pts=[from.clone(), to.clone()];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({color:0xffe9a8, transparent:true, opacity:0.9});
  const line=new THREE.Line(geo,mat); scene.add(line);
  let t=0; activeEffects.push({ update:(dt)=>{
    t+=dt; mat.opacity=0.9 - t*4; if(mat.opacity<=0){ scene.remove(line); geo.dispose(); return false; } return true;
  }});
}
function spawnMuzzleFlash(){
  if(!muzzleFlash) return;
  muzzleFlash.intensity=14;
  const flashMesh=rifleRoot.getObjectByName('flashMesh');
  if(flashMesh){ flashMesh.material.opacity=1; flashMesh.scale.set(1,1,1); }
  setTimeout(()=>{ muzzleFlash.intensity=0; if(flashMesh) flashMesh.material.opacity=0; }, 45);
}
function spawnImpactDecal(pos, normal){
  const decal = new THREE.Mesh(new THREE.CircleGeometry(0.14,12), new THREE.MeshBasicMaterial({color:0x1a1f2a, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
  decal.position.copy(pos).addScaledVector(normal,0.02);
  decal.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
  scene.add(decal);
  hitDecals.push(decal);
  if(hitDecals.length>30){ const old=hitDecals.shift(); scene.remove(old); }
}

let activeEffects=[];
function enemyShoot(enemy, playerPos){
  // enemy bullet tracer toward player with slight inaccuracy
  const from = enemy.group.position.clone(); from.y=0.95;
  const to = playerPos.clone(); to.x+=(Math.random()-0.5)*0.7; to.z+=(Math.random()-0.5)*0.7; to.y=1.6;
  spawnTracer(from,to);
  // damage if close and aimed
  const dist = from.distanceTo(to);
  // raycast to player body? simple distance check
  if(dist<28){
    // 30% chance to hit per shot when in range
    const hitChance = THREE.MathUtils.clamp(1 - dist/28, 0.2, 0.65);
    if(Math.random() < hitChance){
      damagePlayer(12 + Math.floor(Math.random()*10));
      // impact near camera
      spawnHitEffect(to, from);
    }
  }
}

// --- Player ---
let playerHealth=PLAYER_MAX_HEALTH;
let ammoInMag=MAG_SIZE, reserve=RESERVE_AMMO;
let isReloading=false, reloadTimer=0;
let isSprinting=false, isCrouching=false;
let velocity = new THREE.Vector3();
let moveInput = { f:0,b:0,l:0,r:0 };
let canJump=false;
let playerPos = new THREE.Vector3().copy(playerStart);
let killCount=0, startTime=0, elapsed=0;
let gameState='menu'; // menu, playing, victory, defeat

function resetPlayer(){
  playerHealth=PLAYER_MAX_HEALTH;
  ammoInMag=MAG_SIZE; reserve=RESERVE_AMMO;
  isReloading=false; reloadTimer=0;
  killCount=0;
  playerPos.copy(playerStart);
  controls.getObject().position.copy(playerPos);
  velocity.set(0,0,0);
  updateHUD();
}

function damagePlayer(amt){
  if(gameState!=='playing') return;
  playerHealth = Math.max(0, playerHealth - amt);
  updateHUD();
  damageVignette.classList.add('show');
  // camera shake
  camera.position.x += (Math.random()-0.5)*0.08;
  setTimeout(()=> damageVignette.classList.remove('show'), 180);
  // low health vignette persistent
  if(playerHealth<=30){
    damageVignette.style.opacity='0.42';
    setTimeout(()=>{ if(playerHealth>0) damageVignette.style.opacity='0'; }, 400);
  }
  if(playerHealth<=0){
    gameState='defeat';
    defeatEl.classList.remove('hidden');
    hud.classList.add('hidden');
    controls.unlock();
    document.getElementById('defeatStats').textContent = `Eliminated ${killCount} / ${ENEMY_COUNT} hostiles in ${formatTime(elapsed)}.`;
  }
}

function updateHUD(){
  healthBar.style.width = (playerHealth/PLAYER_MAX_HEALTH*100)+'%';
  healthText.innerHTML = `${Math.ceil(playerHealth)} <small>/ 100</small>`;
  if(playerHealth<30) healthBar.style.background='linear-gradient(90deg,#ff1a1a,#ff4400)';
  else healthBar.style.background='linear-gradient(90deg,#ff2a2a,#ff7a00)';
  ammoEl.innerHTML = `${String(ammoInMag).padStart(2,'0')} <small>/ ${String(reserve).padStart(2,'0')}</small>`;
  if(isReloading) ammoEl.style.color='#ffd166';
  else if(ammoInMag===0) ammoEl.style.color='#ff3b3b';
  else ammoEl.style.color='#fff';
}
function updateObjective(){
  const alive = enemies.filter(e=> e.alive).length;
  const dead = ENEMY_COUNT - alive;
  objCount.textContent = `${dead} / ${ENEMY_COUNT}`;
  if(dead===ENEMY_COUNT && gameState==='playing'){
    gameState='victory';
    victoryEl.classList.remove('hidden');
    hud.classList.add('hidden');
    controls.unlock();
    document.getElementById('victoryStats').textContent = `Sector cleared in ${formatTime(elapsed)} with ${reserve} rounds remaining. Health ${Math.ceil(playerHealth)}%.`;
  }
}
function addKillFeed(text){
  const d=document.createElement('div'); d.className='kill'; d.textContent=text; killfeed.appendChild(d);
  setTimeout(()=> d.remove(), 2600);
  killCount++;
}
function showNotif(text, dur=700){
  notifEl.textContent=text; notifEl.classList.add('show'); setTimeout(()=> notifEl.classList.remove('show'), dur);
}
function formatTime(s){ const m=Math.floor(s/60); const sec=Math.floor(s%60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` }

// --- Input ---
const keys={};
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && gameState==='playing') tryReload();
  if(e.code==='KeyC' && gameState==='playing'){ isCrouching=!isCrouching; }
  if(e.code==='Escape'){ /* pointer lock handles */ }
});
addEventListener('keyup', e=> keys[e.code]=false);

canvas.addEventListener('click', ()=>{
  if(gameState==='playing' && !controls.isLocked) controls.lock();
});
controls.addEventListener('lock', ()=>{
  if(gameState==='playing') hud.classList.remove('hidden');
});
controls.addEventListener('unlock', ()=>{
  if(gameState==='playing'){
    // show pause hint? keep hud
  }
});

addEventListener('mousedown', e=>{
  if(gameState!=='playing') return;
  if(!controls.isLocked) return;
  if(e.button===0) tryShoot();
  if(e.button===2) isADS=true;
});
addEventListener('mouseup', e=>{ if(e.button===2) isADS=false; });
addEventListener('contextmenu', e=> e.preventDefault());

let lastShoot=0;
function tryShoot(){
  const now=performance.now();
  if(now - lastShoot < 95) return; // 630 RPM ~95ms
  if(isReloading) return;
  if(ammoInMag<=0){ showNotif('RELOAD',400); playHit(); return; }
  ammoInMag--; lastShoot=now;
  updateHUD();
  playGunshot();
  spawnMuzzleFlash();
  // recoil
  rifleRoot.position.z += 0.09;
  setTimeout(()=> rifleRoot.position.z -= 0.09, 55);
  camera.rotation.x -= 0.006; // tiny kick handled via controls? we do via camera
  // raycast
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  // check enemy hits first
  let hitEnemy=null, hitDist=Infinity, hitPoint=null;
  enemies.forEach(en=>{
    if(!en.alive) return;
    const sph = new THREE.Sphere(en.group.position.clone(), en.radius);
    const intersect = raycaster.ray.intersectSphere(sph, tmpVec);
    if(intersect){
      const dist = raycaster.ray.origin.distanceTo(intersect);
      if(dist < hitDist){ hitDist=dist; hitEnemy=en; hitPoint=intersect.clone(); }
    }
  });
  // world hit
  const worldHits = raycaster.intersectObjects(scene.children, true);
  // filter out weapon and enemy sprites?
  let worldHit=null;
  for(const h of worldHits){
    if(h.object.parent===rifleRoot || h.object===rifleRoot) continue;
    if(h.object.isSprite) continue;
    if(h.distance < hitDist){ worldHit=h; break; }
  }
  let tracerEnd;
  if(hitEnemy && (!worldHit || hitDist < worldHit.distance)){
    tracerEnd = hitPoint;
    const killed = hitEnemy.takeDamage(34 + Math.floor(Math.random()*16), hitPoint);
    // hitmarker
    hitmarker.classList.add('show');
    crosshair.classList.add('hit');
    setTimeout(()=>{ hitmarker.classList.remove('show'); crosshair.classList.remove('hit'); }, 120);
    playHit();
    if(killed) updateObjective();
    // tracer
    spawnTracer(camera.position.clone(), tracerEnd);
  }else if(worldHit){
    tracerEnd = worldHit.point;
    spawnImpactDecal(worldHit.point, worldHit.face? worldHit.face.normal.clone().transformDirection(worldHit.object.matrixWorld).normalize() : new THREE.Vector3(0,1,0));
    spawnHitEffect(worldHit.point, worldHit.point);
    spawnTracer(camera.position.clone(), tracerEnd);
    hitmarker.classList.remove('show');
  }else{
    // miss into sky
    tracerEnd = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 60);
    spawnTracer(camera.position.clone(), tracerEnd);
  }
  // ammo check auto reload hint
  if(ammoInMag===0 && reserve>0){
    showNotif('RELOAD [R]', 900);
  }
}
function tryReload(){
  if(isReloading) return;
  if(ammoInMag===MAG_SIZE) return;
  if(reserve<=0) { showNotif('NO AMMO', 600); return; }
  isReloading=true; reloadTimer=1.35;
  showNotif('RELOADING', 900);
  playReload();
  updateHUD();
}

// --- Movement ---
const playerHeightStand=1.7, playerHeightCrouch=1.15;
let currentHeight=playerHeightStand;

function handleMovement(dt){
  if(gameState!=='playing') return;
  const speedBase = 4.2;
  const sprintMult = (keys['ShiftLeft']||keys['ShiftRight']) ? 1.65 : 1;
  const crouchMult = isCrouching ? 0.55 : 1;
  const speed = speedBase * sprintMult * crouchMult;

  const forward = Number(keys['KeyW']||keys['KeyArrowUp']) - Number(keys['KeyS']||keys['KeyArrowDown']);
  const strafe = Number(keys['KeyD']||keys['KeyArrowRight']) - Number(keys['KeyA']||keys['KeyArrowLeft']);

  const dir = new THREE.Vector3();
  if(forward!==0 || strafe!==0){
    // get camera forward on XZ plane
    const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y=0; camDir.normalize();
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0)).normalize().negate();
    // Actually right = camDir x up
    // correct:
    const up = new THREE.Vector3(0,1,0);
    const camRight = new THREE.Vector3().crossVectors(camDir, up).negate();
    // Use camRight for strafe, camDir for forward
    if(forward) dir.addScaledVector(camDir, forward);
    if(strafe) dir.addScaledVector(camRight, -strafe); // D is +right
    if(dir.length()>0) dir.normalize().multiplyScalar(speed*dt);
  }

  // gravity & jump
  velocity.y -= 14 * dt;
  if(keys['Space'] && canJump){
    velocity.y = 6.2;
    canJump=false;
  }

  // apply XZ
  let nextPos = controls.getObject().position.clone().add(dir);
  // simple collider check: AABB vs boxes
  const playerBox = new THREE.Box3().setFromCenterAndSize(nextPos.clone().setY(nextPos.y - currentHeight/2 + 0.4), new THREE.Vector3(0.6, currentHeight, 0.6));
  let blocked=false;
  for(const b of colliders){
    if(playerBox.intersectsBox(b)){ blocked=true; break; }
  }
  if(!blocked){
    // clamp inside perimeter
    nextPos.x = THREE.MathUtils.clamp(nextPos.x, -17.2, 17.2);
    nextPos.z = THREE.MathUtils.clamp(nextPos.z, -17.2, 17.2);
    controls.getObject().position.x = nextPos.x;
    controls.getObject().position.z = nextPos.z;
  }
  // Y
  controls.getObject().position.y += velocity.y * dt;
  if(controls.getObject().position.y < currentHeight){
    controls.getObject().position.y = currentHeight;
    velocity.y=0;
    canJump=true;
  }
  if(controls.getObject().position.y > 10){ controls.getObject().position.y=10; velocity.y=0; }

  // crouch lerp height
  const targetH = isCrouching ? playerHeightCrouch : playerHeightStand;
  currentHeight = THREE.MathUtils.lerp(currentHeight, targetH, dt*9);
  // ADS lerp
  const targetAds = isADS ? 1 : 0;
  adsProgress = THREE.MathUtils.lerp(adsProgress, targetAds, dt*12);
  rifleRoot.position.lerpVectors(defaultPos, adsPos, adsProgress);
  // subtle ADS FOV
  camera.fov = THREE.MathUtils.lerp(74, 58, adsProgress);
  camera.updateProjectionMatrix();
  // weapon sway / bob
  const t=performance.now()*0.001;
  const isMoving = dir.length()>0.001;
  const bobAmp = isMoving ? (isADS?0.003:0.015) : 0.004;
  const bobFreq = isMoving ? (sprintMult>1? 9:6) : 2;
  rifleRoot.position.x += Math.sin(t*bobFreq)*bobAmp*0.2;
  rifleRoot.position.y += Math.cos(t*bobFreq*0.5)*bobAmp;
  rifleRoot.rotation.z = THREE.MathUtils.lerp(rifleRoot.rotation.z, strafe* -0.06 + Math.sin(t*1.2)*0.01, dt*8);
  rifleRoot.rotation.x = THREE.MathUtils.lerp(rifleRoot.rotation.x, forward*0.04, dt*8);
  // sprint FOV
  const sprintFovAdd = (sprintMult>1 && isMoving && !isADS) ? 6 : 0;
  camera.fov = THREE.MathUtils.lerp(camera.fov, 74 + sprintFovAdd - adsProgress*16, dt*6);
  camera.updateProjectionMatrix();

  playerPos.copy(controls.getObject().position);
}

// --- Minimap ---
function drawMinimap(){
  const ctx=miniCanvas.getContext('2d');
  ctx.clearRect(0,0,140,140);
  ctx.fillStyle='#0a121e'; ctx.fillRect(0,0,140,140);
  ctx.strokeStyle='rgba(120,200,255,0.18)'; ctx.lineWidth=1;
  ctx.strokeRect(0.5,0.5,139,139);
  // walls
  ctx.fillStyle='#3a4558';
  // scale world 36 -> 140, center 70,70
  const toMini = (x,z)=> [70 + x/36*120, 70 + z/36*120];
  // draw crates
  ctx.fillStyle='#5a6a7a';
  colliders.forEach(b=>{
    const c=b.getCenter(new THREE.Vector3()); const s=b.getSize(new THREE.Vector3());
    if(s.y<1) return; // ignore ground
    const [mx, mz]=toMini(c.x,c.z);
    const w=s.x/36*120, h=s.z/36*120;
    ctx.fillRect(mx-w/2, mz-h/2, w, h);
  });
  // enemies
  enemies.forEach(e=>{
    if(!e.alive) return;
    const [mx,mz]=toMini(e.group.position.x, e.group.position.z);
    ctx.fillStyle='#ff2a2a'; ctx.beginPath(); ctx.arc(mx,mz,3.5,0,Math.PI*2); ctx.fill();
  });
  // player
  const [px,pz]=toMini(playerPos.x, playerPos.z);
  ctx.fillStyle='#00e5ff'; ctx.beginPath(); ctx.arc(px,pz,4,0,Math.PI*2); ctx.fill();
  // direction
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  ctx.strokeStyle='#00e5ff'; ctx.beginPath(); ctx.moveTo(px,pz); ctx.lineTo(px+dir.x*10, pz+dir.z*10); ctx.stroke();
}

// --- Loop ---
let lastT=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min((now-lastT)/1000, 0.033);
  lastT=now;
  if(gameState==='playing'){
    elapsed = (now - startTime)/1000;
    timerEl.textContent=formatTime(elapsed);
    handleMovement(dt);
    enemies.forEach(e=> e.update(dt, playerPos));
    // reload timer
    if(isReloading){
      reloadTimer -= dt;
      if(reloadTimer<=0){
        const need=MAG_SIZE - ammoInMag;
        const take=Math.min(need, reserve);
        ammoInMag+=take; reserve-=take;
        isReloading=false; updateHUD(); showNotif('READY', 400);
      }
    }
    // health regen after 4 sec no damage? CoD style: don't regen, keep tactical
    // minimap
    drawMinimap();
  }
  // effects
  activeEffects = activeEffects.filter(e=> e.update(dt));
  renderer.render(scene, camera);
}
animate();

// --- Game flow ---
function startGame(){
  resetPlayer();
  spawnEnemies();
  gameState='playing';
  startTime=performance.now();
  elapsed=0;
  menuEl.classList.add('hidden');
  victoryEl.classList.add('hidden');
  defeatEl.classList.add('hidden');
  hud.classList.remove('hidden');
  controls.lock();
  updateHUD();
  drawMinimap();
}
playBtn.addEventListener('click', startGame);
againBtn.addEventListener('click', startGame);
retryBtn.addEventListener('click', startGame);
menuBtnV.addEventListener('click', ()=>{ victoryEl.classList.add('hidden'); menuEl.classList.remove('hidden'); hud.classList.add('hidden'); gameState='menu'; controls.unlock(); });
menuBtnD.addEventListener('click', ()=>{ defeatEl.classList.add('hidden'); menuEl.classList.remove('hidden'); hud.classList.add('hidden'); gameState='menu'; controls.unlock(); });

// resize
addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// initial hud attribution + preload
attributionEl.textContent='Loading assets…';
Promise.all([loadWeapon(), loadDroneTemplate()]).then(()=> {
  // ensure fallback already handled
  if(!attributionEl.textContent.includes('Weapon')) attributionEl.textContent='CC-AR2 by hoti28 (CC Attribution) • Drone by n0stardust (CC Attribution) — Sketchfab';
});

// Expose for verification
window.__FPS_READY = true;
console.log(`[COVERT VECTOR] vertical slice ready — bar: ${BAR}`);

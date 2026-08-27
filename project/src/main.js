import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const hpEl = document.getElementById('hp');
const hpbar = document.getElementById('hpbar');
const shieldEl = document.getElementById('shield');
const shieldbar = document.getElementById('shieldbar');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const enemiesEl = document.getElementById('enemies');
const waveBanner = document.getElementById('waveBanner');
const hitEl = document.getElementById('hit');
const overlay = document.getElementById('overlay');
const deadScreen = document.getElementById('dead');
const wonScreen = document.getElementById('won');
const attrib = document.getElementById('attrib');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0e182e, 38, 72);
scene.background = new THREE.Color(0x060a14);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
let camRig = new THREE.Group();
let camHolder = new THREE.Group();
scene.add(camRig);
camRig.add(camHolder);
camHolder.add(camera);
camera.position.set(0,1.7,0);
camRig.position.set(0,1.7,8);

let yaw = 0, pitch = 0;
let pointerLocked = false;

const loader = new GLTFLoader();
let robotTemplate = null;
let crateTemplate = null;
let weaponTemplate = null;

async function loadModels(){
  const loads = [];
  loads.push(loader.loadAsync('/models/robot.glb').then(g=>{ robotTemplate=g.scene; robotTemplate.traverse(m=>{ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; }}); }).catch(()=>{}));
  loads.push(loader.loadAsync('/models/crate.glb').then(g=>{ crateTemplate=g.scene; }).catch(()=>{}));
  // try normalized crate if exists
  loads.push(loader.loadAsync('/models/weapon.glb').then(g=>{ weaponTemplate=g.scene; }).catch(()=>{}));
  await Promise.allSettled(loads);
  // fallback check normalized crate
  if(!crateTemplate){
    try{ const g=await loader.loadAsync('/models/crate-normalized.glb'); crateTemplate=g.scene; }catch{}
  }
}
 // keep weapon fallback handled later

// lights — Halo-like: strong directional sun + soft hemi AO, limited point accents (readability over color soup)
scene.add(new THREE.HemisphereLight(0xd8e6ff, 0x0e1828, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 2.6);
dir.position.set(14,20,10);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=0.5; dir.shadow.camera.far=60;
dir.shadow.camera.left=-30; dir.shadow.camera.right=30; dir.shadow.camera.top=30; dir.shadow.camera.bottom=-30;
dir.shadow.bias=-0.0008;
scene.add(dir);
const rim = new THREE.PointLight(0x7af2ff, 8, 40);
rim.position.set(0,10,0);
scene.add(rim);
const pink = new THREE.PointLight(0xff3b82, 6, 24);
pink.position.set(10,3,-10);
scene.add(pink);
const blue2 = new THREE.PointLight(0x7a7aff, 5, 24);
blue2.position.set(-10,3,10);
scene.add(blue2);

// arena — Halo trim-sheet style: higher albedo floor with procedural panel texture, clean walls, limited neon wayfinding
const arenaRadius = 19;
// procedural floor texture (panel lines + grit) — avoids flat plastic
function makeFloorTexture(){
  const c=document.createElement('canvas'); c.width=1024; c.height=1024;
  const g=c.getContext('2d');
  g.fillStyle='#1a2a48'; g.fillRect(0,0,1024,1024);
  g.strokeStyle='rgba(122,242,255,0.09)'; g.lineWidth=2;
  for(let i=0;i<1024;i+=128){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,1024); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(1024,i); g.stroke(); }
  g.strokeStyle='rgba(255,255,255,0.06)'; g.lineWidth=1;
  for(let i=64;i<1024;i+=128){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,1024); g.stroke(); }
  // subtle noise
  for(let i=0;i<6000;i++){ const x=Math.random()*1024, y=Math.random()*1024; g.fillStyle=`rgba(255,255,255,${Math.random()*0.04})`; g.fillRect(x,y,1,1); }
  // center ring highlight
  g.strokeStyle='rgba(122,242,255,0.18)'; g.lineWidth=3; g.beginPath(); g.arc(512,512, 320, 0, Math.PI*2); g.stroke();
  g.strokeStyle='rgba(255,59,130,0.12)'; g.beginPath(); g.arc(512,512, 420, 0, Math.PI*2); g.stroke();
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1,1); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4;
  return tex;
}
const floorTex = makeFloorTexture();
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(arenaRadius, 64),
  new THREE.MeshStandardMaterial({ map: floorTex, color:0xffffff, roughness:0.78, metalness:0.12 })
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);
// subtle grid - reduced to not scream prototype
const grid = new THREE.GridHelper(arenaRadius*2, 20, 0x24405f, 0x1a2f4a);
grid.position.y = 0.015;
grid.material.opacity=0.18; grid.material.transparent=true;
scene.add(grid);
// outer ring - cleaner, higher albedo
const ringGeo = new THREE.TorusGeometry(arenaRadius-0.1, 0.16, 16, 96);
const ringMat = new THREE.MeshStandardMaterial({ color:0xdbe6ff, emissive:0x7af2ff, emissiveIntensity:0.35, roughness:0.45, metalness:0.35 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI/2;
ring.position.y = 0.16;
scene.add(ring);
// walls (hexagonal)
const wallGroup = new THREE.Group();
scene.add(wallGroup);
for(let i=0;i<6;i++){
  const ang = i*Math.PI/3;
  const r = arenaRadius-0.6;
  const x = Math.cos(ang)*r, z=Math.sin(ang)*r;
  const w = 12, h=5.5;
  // two-tone wall: darker base + light cap for Halo clean read
  const baseColor = i%2===0 ? 0x2a3f66 : 0x1f3154;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshStandardMaterial({ color: baseColor, roughness:0.62, metalness:0.22 }));
  mesh.position.set(x, h/2, z);
  mesh.lookAt(0, h/2, 0);
  mesh.castShadow=true; mesh.receiveShadow=true;
  wallGroup.add(mesh);
  // light cap trim (top 0.4m)
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, 0.62), new THREE.MeshStandardMaterial({ color:0xdbe6ff, roughness:0.45, metalness:0.18 }));
  cap.position.set(x, h-0.21, z);
  cap.lookAt(0, h-0.21, 0);
  wallGroup.add(cap);
  // neon strip — only on 2 opposite spawns for wayfinding, not every wall
  if(i===0 || i===3){
    const col = i===0 ? 0x7af2ff : 0xff3b82;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w-0.8, 0.07, 0.14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity:1.4 }));
    strip.position.set(x, 1.15, z);
    strip.lookAt(0,1.15,0);
    strip.translateZ(0.34);
    scene.add(strip);
  }
  // pillar with metal trim
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48, h, 12), new THREE.MeshStandardMaterial({ color:0x162540, roughness:0.6, metalness:0.35 }));
  pillar.position.set(Math.cos(ang+Math.PI/6)*(r-1.2), h/2, Math.sin(ang+Math.PI/6)*(r-1.2));
  pillar.castShadow=true;
  wallGroup.add(pillar);
}
// central reactor
const reactor = new THREE.Group();
const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2, 16), new THREE.MeshStandardMaterial({ color:0x0a1f3d, emissive:0x00e0ff, emissiveIntensity:0.6, metalness:0.7, roughness:0.3 }));
core.position.y=1.1;
reactor.add(core);
const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,2.4, 16), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.5, transparent:true, opacity:0.9 }));
coreGlow.position.y=1.2;
reactor.add(coreGlow);
const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6,0.08,12,32), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff3b82, emissiveIntensity:1.2 }));
halo.rotation.x=Math.PI/2; halo.position.y=0.5;
reactor.add(halo);
const halo2 = halo.clone(); halo2.position.y=1.9; halo2.scale.set(1.15,1.15,1);
reactor.add(halo2);
scene.add(reactor);

// crates as cover
const crates = [];
function addCrate(pos, scale=1){
  let mesh;
  if(crateTemplate){
    mesh = crateTemplate.clone(true);
    mesh.scale.setScalar(0.015*scale*1.2); // crate is tiny original -> scale up
    // normalize spec gloss already converted; ensure materials respond
    mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.needsUpdate=true; } }});
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2*scale,1.1*scale,1.2*scale), new THREE.MeshStandardMaterial({ color:0x2a3a5a, emissive:0x00c8ff, emissiveIntensity:0.15, roughness:0.7, metalness:0.4 }));
  }
  mesh.position.copy(pos);
  mesh.position.y = 0.55*scale;
  // add collision radius
  mesh.userData.radius = 0.9*scale;
  scene.add(mesh);
  crates.push(mesh);
  // removed per-crate point light soup — kept for 2 largest crates only for subtle wayfinding
  if(scale>1.3){
    const l = new THREE.PointLight(0x7af2ff, 1.2, 5);
    l.position.copy(pos); l.position.y=1.1;
    scene.add(l);
  }
}
const cratePositions = [
  new THREE.Vector3(6,0,5), new THREE.Vector3(-5,0,7), new THREE.Vector3(8,0,-4),
  new THREE.Vector3(-7,0,-5), new THREE.Vector3(0,0,9), new THREE.Vector3(0,0,-9),
  new THREE.Vector3(9,0,0), new THREE.Vector3(-9,0,0), new THREE.Vector3(4,0,-7),
  new THREE.Vector3(-4,0,7)
];
cratePositions.forEach(p=>addCrate(p, 0.9+Math.random()*0.4));
addCrate(new THREE.Vector3(3,0,0),1.6);
addCrate(new THREE.Vector3(-3,0,-2),1.4);

// weapon viewmodel — Halo Infinite ref: low, center-right, strong silhouette, readable against bright arena
const viewWeapon = new THREE.Group();
camera.add(viewWeapon);
viewWeapon.position.set(0.42, -0.28, -0.52);
viewWeapon.rotation.set(0, -0.08, 0);
let weaponMesh=null;
// Halo-grade weapon feel state
let recoilKick=0, recoilYaw=0, flashTime=0, shakeTime=0;
let muzzleFlash=null, muzzleLight=null, muzzleCore=null;
const baseWeaponPos = new THREE.Vector3(0.42, -0.28, -0.52);
const baseWeaponRot = new THREE.Euler(0, -0.08, 0);
function setupWeapon(){
  if(weaponTemplate){
    weaponMesh = weaponTemplate.clone(true);
    weaponMesh.scale.setScalar(0.12);
    weaponMesh.rotation.set(0, Math.PI, 0);
    weaponMesh.position.set(0, -0.05, 0);
    weaponMesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; }});
    viewWeapon.add(weaponMesh);
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0.05,-1.1);
  } else {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.55), new THREE.MeshStandardMaterial({ color:0x1a2a44, metalness:0.7, roughness:0.35 }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.65,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:0.6, metalness:0.8, roughness:0.2 }));
    barrel.rotation.x=Math.PI/2; barrel.position.set(0,0,-0.55);
    g.add(body); g.add(barrel);
    viewWeapon.add(g);
    weaponMesh=g;
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0,-0.9);
  }
  // subtle emissive glow
  const glow = new THREE.PointLight(0x7af2ff, 6, 3);
  glow.position.set(0,0,-0.7);
  viewWeapon.add(glow);
  // Halo-style muzzle flash: additive cone + core sprite + point light at barrel tip
  muzzleFlash = new THREE.Group();
  muzzleFlash.position.set(0, -0.02, -0.88);
  viewWeapon.add(muzzleFlash);
  const coneGeo = new THREE.ConeGeometry(0.11, 0.26, 12, 1, true);
  coneGeo.rotateX(-Math.PI/2);
  coneGeo.translate(0,0,-0.13);
  muzzleCore = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color:0xfff0a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
  muzzleFlash.add(muzzleCore);
  const ringGeo = new THREE.RingGeometry(0.03, 0.085, 12);
  // ring faces forward
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
  ring.position.set(0,0,-0.18);
  ring.lookAt(0,0,-1);
  ring.userData.isRing=true;
  muzzleFlash.add(ring);
  muzzleLight = new THREE.PointLight(0x8ef0ff, 0, 4.5);
  muzzleLight.intensity=0;
  muzzleLight.position.set(0,0,-0.88);
  viewWeapon.add(muzzleLight);
}

// game state
let health=100, shield=50, score=0, wave=1, enemiesAlive=0, alive=true, started=false, time=0;
let heat=0, overheat=false;
const maxHealth=100, maxShield=50;
let kills=0, damageDealt=0;
let keys={}, sprint=false;
let velocity = new THREE.Vector3();
let dashCooldown=0, dashTime=0;
let enemyList=[], bulletList=[], particleList=[], pickupList=[];
let waveTimer=60, spawnCooldown=0;

function updateHUD(){
  hpEl.textContent=Math.ceil(health);
  shieldEl.textContent=Math.ceil(shield);
  hpbar.style.width = (health/maxHealth*100)+'%';
  shieldbar.style.width = (shield/maxShield*100)+'%';
  scoreEl.textContent=score;
  waveEl.textContent=wave;
  enemiesEl.textContent=enemyList.length;
}

function flashHit(){ hitEl.classList.remove('show'); void hitEl.offsetWidth; hitEl.classList.add('show'); }

// input
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=true;
  if(e.code==='KeyR') resetGame();
  if(e.code==='Space'){ e.preventDefault(); tryDash(); }
});
addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=false;
});
canvas.addEventListener('click', ()=>{
  if(!started) return;
  if(!pointerLocked) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', ()=>{
  pointerLocked = document.pointerLockElement===canvas;
});
addEventListener('mousemove', e=>{
  if(!started) return;
  const sens=0.0022;
  if(pointerLocked){
    yaw -= e.movementX*sens;
    pitch -= e.movementY*sens;
  } else if(e.buttons===1 && /Mobi|Android/i.test(navigator.userAgent)){
    yaw -= e.movementX*sens*1.2;
    pitch -= e.movementY*sens*1.2;
  }
  pitch=Math.max(-1.35,Math.min(1.35,pitch));
});

// mobile joystick
const joy=document.getElementById('joy'), stick=document.getElementById('stick'), mFire=document.getElementById('mFire'), mDash=document.getElementById('mDash'), mobileWrap=document.getElementById('mobile');
let joyVec={x:0,y:0}, joyActive=false, touchLookId=null, lastTouchX=0, lastTouchY=0;
function isMobile(){ return /Mobi|Android/i.test(navigator.userAgent) || innerWidth<700; }
if(isMobile()){ mobileWrap.style.display='flex'; }
function joyPos(e){
  const r=joy.getBoundingClientRect(); const t=e.touches?e.touches[0]:e;
  const x=t.clientX-(r.left+r.width/2), y=t.clientY-(r.top+r.height/2);
  const d=Math.hypot(x,y), max=44; const c=Math.min(1,d/max);
  const nx=d?x/d:0, ny=d?y/d:0;
  joyVec.x=nx*c; joyVec.y=ny*c;
  stick.style.transform=`translate(calc(-50% + ${nx*c*max}px), calc(-50% + ${ny*c*max}px))`;
}
joy.addEventListener('touchstart', e=>{ joyActive=true; joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchmove', e=>{ if(joyActive) joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchend', ()=>{ joyActive=false; joyVec={x:0,y:0}; stick.style.transform='translate(-50%,-50%)'; });
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){
    const t=e.touches[0];
    if(t.clientX>innerWidth*0.35) { lastTouchX=t.clientX; lastTouchY=t.clientY; touchLookId=t.identifier; }
  }
});
canvas.addEventListener('touchmove', e=>{
  for(const t of e.touches){ if(t.identifier===touchLookId){
    const dx=t.clientX-lastTouchX, dy=t.clientY-lastTouchY;
    yaw -= dx*0.004; pitch -= dy*0.004; pitch=Math.max(-1.3,Math.min(1.3,pitch));
    lastTouchX=t.clientX; lastTouchY=t.clientY;
  }}
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend', e=>{
  for(const t of e.changedTouches) if(t.identifier===touchLookId) touchLookId=null;
});
let fireHeld=false;
mFire.addEventListener('touchstart', e=>{ fireHeld=true; e.preventDefault(); },{passive:false});
mFire.addEventListener('touchend', ()=> fireHeld=false);
mDash.addEventListener('touchstart', e=>{ tryDash(); e.preventDefault(); },{passive:false});

// utility
function clampToArena(v){
  const d=Math.hypot(v.x,v.z);
  if(d>arenaRadius-1.1){
    const s=(arenaRadius-1.1)/d; v.x*=s; v.z*=s;
  }
  // crate collision simple push
  for(const c of crates){
    const dx=v.x-c.position.x, dz=v.z-c.position.z;
    const dist=Math.hypot(dx,dz);
    const min = 1.0 + c.userData.radius;
    if(dist<min && dist>0.01){
      const push=(min-dist)/dist;
      v.x += dx*push*0.9; v.z += dz*push*0.9;
    }
  }
}

function tryDash(){
  if(dashCooldown>0 || !alive || !started) return;
  const dir=new THREE.Vector3();
  if(keys['KeyW']) dir.z-=1; if(keys['KeyS']) dir.z+=1; if(keys['KeyA']) dir.x-=1; if(keys['KeyD']) dir.x+=1;
  if(joyVec.x||joyVec.y){ dir.x=joyVec.x; dir.z=joyVec.y; }
  if(dir.length()<0.1){
    dir.set(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-1);
  }
  dir.normalize();
  // apply yaw
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const world = new THREE.Vector3().addScaledVector(right, dir.x).addScaledVector(fwd, dir.z);
  world.normalize();
  dashTime=0.22; dashCooldown=1.1;
  velocity.addScaledVector(world, 18);
  // i-frame hint
  camHolder.position.y=1.75;
  setTimeout(()=> camHolder.position.y=1.7, 120);
}

function spawnEnemy(){
  const ang=Math.random()*Math.PI*2;
  const r= arenaRadius-2.5;
  const pos=new THREE.Vector3(Math.cos(ang)*r,0, Math.sin(ang)*r);
  let mesh;
  if(robotTemplate){
    mesh = robotTemplate.clone(true);
    mesh.scale.setScalar(0.85);
    mesh.rotation.y=ang+Math.PI;
  } else {
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45,1.1,8,12), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff1a5a, emissiveIntensity:0.35, roughness:0.5 }));
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:2 }));
    eye.position.set(0,0.55,0.35); mesh.add(eye);
  }
  const g=new THREE.Group();
  g.add(mesh);
  g.position.copy(pos);
  g.position.y=0.7;
  // shadow blob
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.55,16), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.35 }));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=-0.68;
  g.add(shadow);
  g.userData={ hp: 3 + Math.floor(wave*0.7), maxHp:3+Math.floor(wave*0.7), speed: 2.1 + wave*0.18 + Math.random()*0.6, mesh, ang, hitFlash:0 };
  scene.add(g);
  enemyList.push(g);
}

function spawnPickup(pos, type){
  const geo = new THREE.IcosahedronGeometry(0.28,0);
  const mat = new THREE.MeshStandardMaterial({ color: type==='shield'?0x7af2ff:0xff5a8f, emissive: type==='shield'?0x00c8ff:0xff1a5a, emissiveIntensity:1.2, metalness:0.4, roughness:0.3 });
  const m=new THREE.Mesh(geo,mat);
  m.position.copy(pos); m.position.y=0.5;
  m.userData={ type, t:0, bob:Math.random()*Math.PI*2 };
  const light=new THREE.PointLight(mat.color, 6, 5);
  light.position.copy(m.position);
  m.userData.light=light;
  scene.add(m); scene.add(light);
  pickupList.push(m);
}

function shoot(){
  if(!alive || !started) return;
  if(overheat) return;
  if(heat>0.92) { overheat=true; setTimeout(()=> overheat=false, 900); return; }
  heat = Math.min(1, heat+0.085);
  // Halo-like recoil + view kick (crunchy, recoverable)
  recoilKick = 1.0;
  recoilYaw = (Math.random()-0.5)*0.12;
  pitch = Math.max(-1.35, Math.min(1.35, pitch + 0.008));
  flashTime = 0.09;
  shakeTime = 0.09;
  if(muzzleLight) muzzleLight.intensity = 18;
  if(muzzleCore){ muzzleCore.material.opacity=1; muzzleCore.scale.set(0.9+Math.random()*0.25,0.9+Math.random()*0.25,1); }
  if(muzzleFlash){
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing){ c.material.opacity=0.95; c.scale.setScalar(0.85+Math.random()*0.2); }});
    muzzleFlash.rotation.z = Math.random()*Math.PI;
  }
  // ray
  const origin = new THREE.Vector3().copy(camRig.position); origin.y=1.7;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0))).normalize();
  // bullet tracer — Halo bright additive streak
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,1.4,6), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending }));
  const mid = origin.clone().addScaledVector(dir, 5.5);
  tracer.position.copy(mid);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  tracer.scale.y=5.2;
  tracer.userData={ life:0.06, vel:new THREE.Vector3(0,0,0) };
  scene.add(tracer); particleList.push(tracer);
  // eject brass (tiny) — view space
  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.07,6), new THREE.MeshStandardMaterial({ color:0xc8a44a, metalness:0.6, roughness:0.4 }));
  brass.position.copy(origin).addScaledVector(dir, 0.3).add(new THREE.Vector3(0.16,-0.12,0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0))));
  brass.userData={ vel:new THREE.Vector3((Math.random()-0.5)*2+0.6, 2+Math.random()*1.2, (Math.random()-0.5)*1.2), life:0.55, isBrass:true };
  scene.add(brass); particleList.push(brass);
  // hit test enemies
  let hit=null, hitDist=1e9, hitPos=null;
  for(const e of enemyList){
    const to = new THREE.Vector3().subVectors(e.position, origin);
    const proj = to.dot(dir);
    if(proj<0 || proj>42) continue;
    const closest = origin.clone().addScaledVector(dir, proj);
    const dist = closest.distanceTo(e.position);
    if(dist<0.85 && proj<hitDist){ hit=e; hitDist=proj; hitPos=closest; }
  }
  // wall hit fallback
  if(hit){
    hit.userData.hp -=1;
    hit.userData.hitFlash=0.18;
    damageDealt+=1;
    // knockback
    hit.position.addScaledVector(dir, 0.35);
    flashHit();
    score+= (hit.userData.hp<=0? 50:10);
    if(hit.userData.hp<=0){
      // death
      kills++;
      score+=20;
      // explosion
      for(let i=0;i<8;i++){
        const p=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshStandardMaterial({ color:0xff8a3b, emissive:0xff3b82, emissiveIntensity:1 }));
        p.position.copy(hit.position); p.position.y+=0.5;
        p.userData={ vel:new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4+1, (Math.random()-0.5)*6), life:0.5+Math.random()*0.4 };
        scene.add(p); particleList.push(p);
      }
      if(Math.random()<0.35) spawnPickup(hit.position.clone(), Math.random()<0.5?'shield':'health');
      scene.remove(hit); enemyList.splice(enemyList.indexOf(hit),1);
      // ring pulse
      reactor.scale.set(1.2,1.2,1.2); setTimeout(()=> reactor.scale.set(1,1,1), 120);
    }
    // Halo hitmarker + impact sparks at hitPos
    const isKill = hit.userData.hp<=0;
    // show crosshair hit feedback
    hitEl.textContent = isKill ? 'ELIMINATED' : 'HIT';
    hitEl.style.color = isKill ? '#ffd166' : '#7af2ff';
    flashHit();
    // spark burst
    for(let i=0;i<5;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.035,5,5), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.95 }));
      s.position.copy(hitPos);
      const spread = new THREE.Vector3((Math.random()-0.5)*1, (Math.random()-0.5)*1 +0.3, (Math.random()-0.5)*1);
      spread.addScaledVector(dir, -0.5 + Math.random()*0.5);
      s.userData={ vel: spread.multiplyScalar(3.5), life:0.22+Math.random()*0.12, isSpark:true };
      scene.add(s); particleList.push(s);
    }
    // impact ring decal
    const decal = new THREE.Mesh(new THREE.RingGeometry(0.12,0.18,12), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    decal.position.copy(hitPos);
    decal.lookAt(hitPos.clone().add(dir));
    decal.userData={ life:0.14, isDecal:true };
    scene.add(decal); particleList.push(decal);
  } else {
    const far = origin.clone().addScaledVector(dir, 18);
    if(far.length()>arenaRadius) far.normalize().multiplyScalar(arenaRadius-0.3);
    // wall spark burst
    for(let i=0;i<4;i++){
      const sp=new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.9 }));
      sp.position.copy(far); sp.position.y=0.22;
      sp.userData={ vel:new THREE.Vector3((Math.random()-0.5)*3, Math.random()*2, (Math.random()-0.5)*3).addScaledVector(dir, -0.8), life:0.2+Math.random()*0.1, isSpark:true };
      scene.add(sp); particleList.push(sp);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.1,0.16,12), new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
    ring.position.copy(far); ring.position.y=0.04; ring.rotation.x=-Math.PI/2;
    ring.userData={ life:0.18, isDecal:true };
    scene.add(ring); particleList.push(ring);
  }
  updateHUD();
}

// firing loop
let fireCooldown=0;
addEventListener('mousedown', e=>{ if(e.button===0 && started) { if(!pointerLocked) canvas.requestPointerLock?.(); else shoot(); }});
let isMouseDown=false;
addEventListener('mousedown', e=>{ if(e.button===0) isMouseDown=true; });
addEventListener('mouseup', e=>{ if(e.button===0) isMouseDown=false; });

function handleInput(dt){
  if(!alive || !started) return;
  const speed = sprint? 5.6: 3.4;
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let move=new THREE.Vector3();
  if(keys['KeyW']) move.addScaledVector(fwd, -1);
  if(keys['KeyS']) move.addScaledVector(fwd, 1);
  if(keys['KeyA']) move.addScaledVector(right, -1);
  if(keys['KeyD']) move.addScaledVector(right, 1);
  if(joyVec.x||joyVec.y){
    move.addScaledVector(right, joyVec.x);
    move.addScaledVector(fwd, joyVec.y);
  }
  if(move.length()>0) move.normalize().multiplyScalar(speed*dt);
  // dash
  if(dashTime>0){ move.addScaledVector(velocity, dt); dashTime-=dt; }
  // apply
  const next = camRig.position.clone().add(move);
  next.y=1.7;
  clampToArena(next);
  camRig.position.copy(next);
  // heat decay
  heat = Math.max(0, heat - dt*0.55);
  if(heat<0.15) overheat=false;
  // recoil spring (Halo snap + recover)
  recoilKick = Math.max(0, recoilKick - dt*6.5);
  recoilYaw *= Math.pow(0.85, dt*60);
  flashTime = Math.max(0, flashTime - dt);
  shakeTime = Math.max(0, shakeTime - dt);
  if(muzzleLight){
    muzzleLight.intensity = flashTime>0 ? 16*(flashTime/0.09) : 0;
    if(muzzleCore) muzzleCore.material.opacity = flashTime>0 ? Math.pow(flashTime/0.09, 0.7) : 0;
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing) c.material.opacity = flashTime>0 ? (flashTime/0.09) : 0; });
  }
  // subtle screenshake on fire
  if(shakeTime>0){
    camera.position.x = (Math.random()-0.5)*0.025*(shakeTime/0.09);
    camera.position.y = (Math.random()-0.5)*0.02*(shakeTime/0.09);
  } else {
    camera.position.set(0,1.7,0);
  }
  // view bob + recoil offset (viewmodel stays grounded like Halo)
  const moving = move.length()>0.001;
  const kickZ = recoilKick * 0.14;
  const kickY = recoilKick * 0.035;
  const kickPitch = recoilKick * 0.22;
  viewWeapon.position.x = baseWeaponPos.x + Math.sin(time*9)*(moving?0.012:0.004) + recoilYaw*0.08;
  viewWeapon.position.y = baseWeaponPos.y + Math.abs(Math.sin(time*18))*(moving?0.012:0.003) - kickY;
  viewWeapon.position.z = baseWeaponPos.z - kickZ;
  viewWeapon.rotation.x = baseWeaponRot.x - kickPitch + (overheat ? -0.15 : 0);
  viewWeapon.rotation.y = baseWeaponRot.y + recoilYaw*0.6;
  viewWeapon.rotation.z = Math.sin(time*6)*(moving?0.03:0.01) - recoilYaw*0.4;
}

function updateEnemies(dt){
  for(const e of enemyList){
    const toPlayer = new THREE.Vector3().subVectors(camRig.position, e.position);
    toPlayer.y=0;
    const dist=toPlayer.length();
    if(dist>0.1){ toPlayer.normalize().multiplyScalar(e.userData.speed*dt); }
    // simple avoidance among enemies
    for(const o of enemyList) if(o!==e){
      const d=e.position.distanceTo(o.position);
      if(d<1.2){ const push=new THREE.Vector3().subVectors(e.position,o.position).normalize().multiplyScalar((1.2-d)*dt*2); e.position.add(push); }
    }
    // move towards player but respect crates
    const next = e.position.clone().add(toPlayer);
    // crate push
    for(const c of crates){
      const dx=next.x-c.position.x, dz=next.z-c.position.z;
      const dd=Math.hypot(dx,dz);
      if(dd<1.05 + c.userData.radius){
        const nx=dx/(dd||1), nz=dz/(dd||1);
        next.x = c.position.x + nx*(1.05+c.userData.radius);
        next.z = c.position.z + nz*(1.05+c.userData.radius);
      }
    }
    const nd=Math.hypot(next.x,next.z);
    if(nd<arenaRadius-1) e.position.copy(next);
    else e.position.addScaledVector(toPlayer, -0.5*dt);
    // face player
    e.lookAt(camRig.position.x, e.position.y, camRig.position.z);
    e.rotation.y+=Math.PI;
    // hit flash
    if(e.userData.hitFlash>0){
      e.userData.hitFlash-=dt;
      e.traverse?.(o=>{ if(o.isMesh && o.material) { o.material.emissiveIntensity = e.userData.hitFlash>0?1.2:0.35; }});
    }
    // attack if close
    if(dist<1.35 && dashTime<=0){
      // damage with cooldown per enemy
      e.userData.cooldown = (e.userData.cooldown||0)-dt;
      if(e.userData.cooldown<=0){
        const dmg = 8 + wave*1.2;
        if(shield>0){ const absorb=Math.min(shield,dmg); shield-=absorb; const rem=dmg-absorb; health-=rem; } else health-=dmg;
        e.userData.cooldown=0.9;
        camHolder.position.x = (Math.random()-0.5)*0.12;
        setTimeout(()=> camHolder.position.x=0, 80);
        // hurt vignette via flash
        document.body.style.boxShadow='inset 0 0 80px rgba(255,59,130,.6)';
        setTimeout(()=> document.body.style.boxShadow='', 120);
        updateHUD();
        if(health<=0){ health=0; alive=false; deadScreen.style.display='flex'; document.getElementById('deadStats').textContent=`Score ${score} · Wave ${wave} · Kills ${kills} · Time ${Math.floor(time)}s`; document.exitPointerLock?.(); }
      }
    }
  }
}

function updatePickups(dt){
  for(let i=pickupList.length-1;i>=0;i--){
    const p=pickupList[i];
    p.userData.t+=dt;
    p.rotation.y+=dt*2.2;
    p.position.y=0.5+Math.sin(p.userData.t*2.6 + p.userData.bob)*0.18;
    p.userData.light.position.copy(p.position);
    const d=p.position.distanceTo(camRig.position);
    if(d<1.1){
      if(p.userData.type==='health'){ health=Math.min(maxHealth, health+28); }
      else { shield=Math.min(maxShield, shield+22); }
      score+=15;
      scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); updateHUD();
      // pickup flash
      const f=new THREE.Mesh(new THREE.RingGeometry(0.5,0.7,16), new THREE.MeshBasicMaterial({ color: p.userData.type==='health'?0xff5a8f:0x7af2ff, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
      f.rotation.x=-Math.PI/2; f.position.copy(camRig.position); f.position.y=0.05; scene.add(f);
      let t=0; const iv=setInterval(()=>{ t+=0.05; f.scale.setScalar(1+t*2); f.material.opacity-=0.07; if(f.material.opacity<=0){ scene.remove(f); clearInterval(iv);} },16);
    }
    if(p.userData.t>14){ scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); }
  }
}

function updateParticles(dt){
  for(let i=particleList.length-1;i>=0;i--){
    const p=particleList[i];
    if(p.userData.vel){
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y -= 9.8*dt*0.6;
      p.userData.vel.multiplyScalar(0.98);
      if(p.userData.isBrass) p.rotation.x += dt*12;
    }
    p.userData.life-=dt;
    if(p.material){
      p.material.transparent=true;
      if(p.userData.isDecal){
        p.material.opacity = Math.max(0, p.userData.life*3.5);
        p.scale.setScalar(1 + (0.18 - p.userData.life)*1.2);
      } else if(p.userData.isSpark){
        p.material.opacity = Math.max(0, p.userData.life*4);
      } else {
        p.material.opacity = Math.max(0, p.userData.life*1.5);
        if(!p.userData.isBrass) p.scale.setScalar(1 - p.userData.life*0.2);
      }
    }
    if(p.userData.life<=0){ scene.remove(p); particleList.splice(i,1); }
  }
}

function updateWave(dt){
  waveTimer-=dt;
  spawnCooldown-=dt;
  if(spawnCooldown<=0 && enemyList.length < 3+wave*1.8){
    spawnEnemy();
    spawnCooldown= 1.6 - Math.min(1.0, wave*0.12) + Math.random()*0.7;
  }
  if(waveTimer<=0){
    wave++;
    waveTimer=60;
    waveEl.textContent=wave;
    waveBanner.textContent=`WAVE ${wave} — REINFORCEMENTS INBOUND`;
    waveBanner.style.background='rgba(255,59,130,.18)';
    waveBanner.style.borderColor='rgba(255,59,130,.5)';
    waveBanner.style.color='#ff8a8f';
    setTimeout(()=>{ waveBanner.style.background=''; waveBanner.style.borderColor=''; waveBanner.style.color=''; waveBanner.textContent=`WAVE ${wave}`; },2200);
    updateHUD();
    if(wave>3){
      alive=false; wonScreen.style.display='flex'; document.getElementById('wonStats').textContent=`Score ${score} · Kills ${kills} · Perfect arena hold — extraction ready.`;
      document.exitPointerLock?.();
    }
  } else {
    waveBanner.textContent=`WAVE ${wave} — ${Math.ceil(waveTimer)}s`;
  }
  // reactor pulse
  const s=1+Math.sin(time*2.2)*0.03;
  reactor.scale.set(s,s,s);
  coreGlow.material.emissiveIntensity=1.2+Math.sin(time*3)*0.3;
  // rotate point lights subtle
  pink.intensity=12+Math.sin(time*1.3)*2;
  blue2.intensity=10+Math.cos(time*1.1)*1.5;
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.033, (performance.now()-(animate._last||performance.now()))/1000);
  animate._last=performance.now();
  if(started && alive) time+=dt;
  // camera rig rotation
  camRig.rotation.y=yaw;
  camera.rotation.x=pitch;
  camera.rotation.y=0; camera.rotation.z=0;
  if(started && alive){
    handleInput(dt);
    // auto fire if held
    fireCooldown-=dt;
    if((isMouseDown || fireHeld) && fireCooldown<=0){ shoot(); fireCooldown=0.11; }
    if(dashCooldown>0) dashCooldown-=dt;
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateWave(dt);
  }
  renderer.render(scene,camera);
}

function resetGame(){
  health=100; shield=50; score=0; wave=1; time=0; heat=0; overheat=false; alive=true;
  kills=0; waveTimer=60; enemyList.forEach(e=>scene.remove(e)); enemyList=[]; particleList.forEach(p=>scene.remove(p)); particleList=[]; pickupList.forEach(p=>{scene.remove(p); scene.remove(p.userData.light)}); pickupList=[];
  camRig.position.set(0,1.7,8); yaw=0; pitch=0;
  deadScreen.style.display='none'; wonScreen.style.display='none';
  updateHUD();
}

// attribution
async function setAttrib(){
  try{
    const [r,c,w]=await Promise.all([
      fetch('/models/robot.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/crate.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/weapon.glb.attribution.json').then(r=>r.json()).catch(()=>null),
    ]);
    const parts=[];
    if(r) parts.push(`Enemy: "${r.name}" by ${r.author} — <a href="${r.modelUrl}" target="_blank">${r.license}</a>`);
    if(c) parts.push(`Crate: "${c.name}" by ${c.author} — <a href="${c.modelUrl}" target="_blank">${c.license}</a>`);
    if(w) parts.push(`Weapon: "${w.name}" by ${w.author} — <a href="${w.modelUrl}" target="_blank">${w.license}</a>`);
    attrib.innerHTML=parts.join('<br>');
  }catch{}
}

// init
(async()=>{
  await loadModels();
  setupWeapon();
  setAttrib();
  updateHUD();
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  animate();
  document.getElementById('playBtn').addEventListener('click', ()=>{
    started=true; overlay.style.display='none';
    canvas.requestPointerLock?.();
    // spawn initial
    for(let i=0;i<2;i++) spawnEnemy();
  });
  document.getElementById('howBtn').addEventListener('click', ()=>{
    const h=document.getElementById('how'); h.style.display=h.style.display==='none'?'block':'none';
  });
  // allow click on overlay to start as well
  overlay.addEventListener('click', e=>{ if(e.target===overlay) document.getElementById('playBtn').click(); });
})();

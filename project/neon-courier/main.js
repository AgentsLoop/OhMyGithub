import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ----- DOM -----
const hudScore = document.getElementById('hud-score');
const hudKills = document.getElementById('hud-kills');
const hudTimer = document.getElementById('hud-timer');
const hudHealth = document.getElementById('hud-health');
const hudAmmo = document.getElementById('hud-ammo');
const hudReserve = document.getElementById('hud-reserve');
const healthBar = document.getElementById('health-bar');
const healthBarDamage = document.getElementById('health-bar-damage');
const reloadBar = document.getElementById('reload-bar');
const reloadProgress = document.getElementById('reload-progress');
const hitmarker = document.getElementById('hitmarker');
const hitmarkerKill = document.getElementById('hitmarker-kill');
const damageVignette = document.getElementById('damage-vignette');
const bloodOverlay = document.getElementById('blood-overlay');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
const centerMsg = document.getElementById('center-msg');
const killfeed = document.getElementById('killfeed');
const streakDots = document.getElementById('streak-dots');
const overlayStart = document.getElementById('overlay-start');
const overlayPause = document.getElementById('overlay-pause');
const overlayEnd = document.getElementById('overlay-end');
const objText = document.getElementById('obj-text');
const endTitle = document.getElementById('end-title');
const endDesc = document.getElementById('end-desc');
const endKills = document.getElementById('end-kills');
const endScoreEl = document.getElementById('end-score');
const endAcc = document.getElementById('end-acc');
const endTime = document.getElementById('end-time');

const GAME_TIME = 60;
const KILL_TARGET = 15;
const MAP_SIZE = 80;

// ----- Three setup -----
const wrap = document.getElementById('game-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1e);
scene.fog = new THREE.FogExp2(0x0a0f1e, 0.016);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth/window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 8);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

// Lighting — COD style: soft sky + strong sun + fill
scene.add(new THREE.HemisphereLight(0x6a8cff, 0x0a0a0a, 1.05));
const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
sun.position.set(30, 40, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 120;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x3a5bff, 0.55);
fill.position.set(-20, 18, -22);
scene.add(fill);
// volumetric-ish point lights for atmosphere
const bulb1 = new THREE.PointLight(0xff3c00, 18, 22); bulb1.position.set(12, 4.5, -8); scene.add(bulb1);
const bulb2 = new THREE.PointLight(0x00e5ff, 12, 18); bulb2.position.set(-16, 5, 14); scene.add(bulb2);

// Controls
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

// ----- Map geometry & colliders -----
const colliders = []; // { box: Box3, mesh: Mesh}
const shootTargets = []; // meshes raycastable (buildings + props)

function addCollider(mesh){
  mesh.updateMatrixWorld();
  const box = new THREE.Box3().setFromObject(mesh);
  // expand a bit for player radius
  box.expandByScalar(0.35);
  colliders.push({ box, mesh });
  shootTargets.push(mesh);
}

// Ground — large PBR concrete with subtle grid via canvas texture
function makeGroundTexture(){
  const c = document.createElement('canvas'); c.width=512; c.height=512;
  const g=c.getContext('2d');
  g.fillStyle='#1a1f2e'; g.fillRect(0,0,512,512);
  g.strokeStyle='rgba(255,255,255,0.04)'; g.lineWidth=1;
  for(let i=0;i<512;i+=64){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,512); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(512,i); g.stroke(); }
  // noise
  for(let i=0;i<6000;i++){ g.fillStyle=`rgba(255,255,255,${Math.random()*0.03})`; g.fillRect(Math.random()*512,Math.random()*512,1,1); }
  // stains
  g.fillStyle='rgba(255,60,0,0.04)'; g.beginPath(); g.ellipse(180,300,90,40,0.3,0,Math.PI*2); g.fill();
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(8,8); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4;
  return tex;
}
const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness:0.92, metalness:0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE*1.6, MAP_SIZE*1.6), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);
shootTargets.push(ground);

// Buildings — urban killhouse: perimeter + inner blocks with windows
const buildingMats = [];
function makeBuilding(x,z,w,d,h, color='#1b2236'){
  const geo=new THREE.BoxGeometry(w,h,d);
  const mat=new THREE.MeshStandardMaterial({ color, roughness:0.88, metalness:0.06 });
  const mesh=new THREE.Mesh(geo, mat);
  mesh.position.set(x, h/2, z);
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh);
  addCollider(mesh);
  buildingMats.push(mesh);
  // windows — emissive planes
  const winMat = new THREE.MeshStandardMaterial({ color: 0x15223a, emissive: 0x223a66, emissiveIntensity:0.35, roughness:0.5 });
  // add window rows on front/back faces
  for(let side of [-1,1]){
    for(let r=0;r< Math.floor(h/1.8); r++){
      for(let c0=0;c0< Math.floor(w/1.6); c0++){
        if(Math.random()>0.38) continue;
        const wp=new THREE.PlaneGeometry(0.85,0.85);
        const wm=new THREE.Mesh(wp, winMat);
        wm.position.set(x + (c0 - Math.floor(w/1.6)/2 +0.5)*1.6, 1.2 + r*1.8, z + side*(d/2+0.02));
        wm.rotation.y = side>0?0:Math.PI;
        scene.add(wm);
      }
    }
  }
  return mesh;
}
// Perimeter skyline
makeBuilding(0, -MAP_SIZE/2 -6, MAP_SIZE+28, 6, 18, '#151a2c');
makeBuilding(0,  MAP_SIZE/2 +6, MAP_SIZE+28, 6, 18, '#151a2c');
makeBuilding(-MAP_SIZE/2 -6, 0, 6, MAP_SIZE, 16, '#151a2c');
makeBuilding( MAP_SIZE/2 +6, 0, 6, MAP_SIZE, 16, '#151a2c');
// Inner urban blocks — BO6 Nuketown-ish but larger
makeBuilding(-18, -16, 14, 14, 6.5);
makeBuilding(16, -14, 12, 18, 7.2);
makeBuilding(-14, 18, 18, 10, 5.8);
makeBuilding(18, 16, 14, 12, 8.0);
makeBuilding(0, 0, 10, 6, 3.2); // central low cover block
makeBuilding(-26, 4, 6, 20, 4.2);
makeBuilding(26, -2, 6, 22, 4.6);
makeBuilding(0, -28, 22, 6, 4.0);

// Cover props — concrete barriers, containers, cars
function addBox(x,z,w,h,d,color='#2a2f42'){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshStandardMaterial({color, roughness:0.75, metalness:0.12}));
  m.position.set(x, h/2, z); m.castShadow=true; m.receiveShadow=true; scene.add(m); addCollider(m); shootTargets.push(m); return m;
}
function addCylinder(x,z,r,h){
  const g=new THREE.CylinderGeometry(r,r,h,12);
  const m=new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:0x3a425c, roughness:0.7}));
  m.position.set(x,h/2,z); m.castShadow=true; scene.add(m); addCollider(m); shootTargets.push(m);
}
addBox(-8, -9, 3, 1.2, 1.1, '#3a3f52');
addBox(-6, -11, 3, 1.2, 1.1, '#3a3f52');
addBox(10, 8, 4, 1.3, 1.6, '#3d4458');
addBox(12, 10, 4, 1.3, 1.6, '#3d4458');
addBox(-12, 9, 1.2, 1.6, 6, '#2e3448');
addBox(9, -2, 6, 1.0, 1.2, '#2e3448');
addBox(4, 18, 5, 1.4, 1.3, '#33394e');
addBox(-2, -20, 7, 1.1, 1.4, '#33394e');
addCylinder(-20, 10, 0.7, 1.8);
addCylinder(21, -9, 0.7, 1.8);
// shipping container
addBox(-28, -18, 8, 2.8, 2.4, '#b23c1a');
addBox(-28, -15, 8, 2.8, 2.4, '#1d4a7a');
// car wrecks simplified
addBox(6, -5, 3.8, 1.1, 1.8, '#1a1e2a'); addBox(6,-5,3.6,0.6,1.6, '#2a8a9a');

// Skybox-ish large box for ambient
const skyGeo=new THREE.BoxGeometry(260,90,260);
const skyMat=new THREE.MeshBasicMaterial({ color:0x0a0f1e, side:THREE.BackSide });
const skyBox=new THREE.Mesh(skyGeo, skyMat); skyBox.position.y=46; scene.add(skyBox);

// ----- Weapon viewmodel -----
const weaponGroup = new THREE.Group();
let weaponMeshGroup = new THREE.Group();
let muzzlePos = new THREE.Vector3(0, -0.12, -1.45);
let muzzleLight = new THREE.PointLight(0xffaa44, 0, 6);
muzzleLight.position.set(0, -0.12, -1.45);
weaponGroup.add(muzzleLight);
const muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 8), new THREE.MeshBasicMaterial({ color:0xffd27a, transparent:true, opacity:0 }));
muzzleFlash.rotation.x = Math.PI/2; muzzleFlash.position.copy(muzzlePos); muzzleFlash.visible=false;
weaponGroup.add(muzzleFlash);

// Procedural weapon builder (M4-style)
function buildProceduralWeapon(){
  const g=new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color:0x191c22, roughness:0.42, metalness:0.72 });
  const dark = new THREE.MeshStandardMaterial({ color:0x0e1116, roughness:0.6, metalness:0.35 });
  const poly = new THREE.MeshStandardMaterial({ color:0x1e232e, roughness:0.72, metalness:0.08 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.13,0.52), metal); receiver.position.set(0,-0.06,-0.22); g.add(receiver);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.10,0.42), dark); handguard.position.set(0,-0.06,-0.62); g.add(handguard);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.58,10), metal); barrel.rotation.x=Math.PI/2; barrel.position.set(0,-0.04,-0.92); g.add(barrel);
  const gas = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.38,8), metal); gas.rotation.x=Math.PI/2; gas.position.set(0,0.02,-0.72); g.add(gas);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.12,0.32), poly); stock.position.set(0,-0.05,0.18); g.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.18,0.09), poly); grip.position.set(0,-0.16,-0.08); grip.rotation.x=0.18; g.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.20,0.12), dark); mag.position.set(0,-0.18,-0.22); mag.rotation.x=0.06; g.add(mag);
  const sightBase=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.045,0.14), metal); sightBase.position.set(0,0.06,-0.28); g.add(sightBase);
  const sightLens=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.038,0.08), new THREE.MeshStandardMaterial({color:0x142030, roughness:0.18, metalness:0.5, emissive:0x00c8ff, emissiveIntensity:0.18})); sightLens.position.set(0,0.065,-0.28); g.add(sightLens);
  const comp = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.028,0.10,10), new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:0.35, metalness:0.8})); comp.rotation.x=Math.PI/2; comp.position.set(0,-0.04,-1.22); g.add(comp);
  // light on sight
  const dot=new THREE.Mesh(new THREE.SphereGeometry(0.006,6,6), new THREE.MeshBasicMaterial({color:0xff1a1a})); dot.position.set(0,0.066,-0.26); g.add(dot);
  // add some edge highlight via small white strips (fake AO)
  g.traverse(m=>{ if(m.isMesh){ m.castShadow=true; }});
  return g;
}
weaponMeshGroup = buildProceduralWeapon();
weaponGroup.add(weaponMeshGroup);
weaponGroup.position.set(0.34, -0.28, -0.48);
weaponGroup.rotation.set(0, 0.02, 0);
camera.add(weaponGroup);

// Try GLB override
const loader=new GLTFLoader();
loader.load('/models/weapon.glb',
  (gltf)=>{
    // replace procedural with GLB, preserve muzzle pos
    weaponGroup.remove(weaponMeshGroup);
    const glb=gltf.scene;
    glb.scale.set(0.18,0.18,0.18);
    glb.position.set(0, -0.18, -0.55);
    glb.rotation.y=Math.PI;
    glb.traverse(n=>{ if(n.isMesh){ n.castShadow=true; n.material && (n.material.roughness=0.45); }});
    weaponGroup.add(glb);
    weaponMeshGroup=glb;
    muzzlePos.set(0,-0.08,-1.35);
    muzzleFlash.position.copy(muzzlePos);
    muzzleLight.position.copy(muzzlePos);
  },
  undefined,
  ()=>{ /* keep procedural fallback */ }
);

// ----- Game state -----
let state='start'; // start, playing, paused, ended
let health=100;
let maxHealth=100;
let ammo=30, reserve=90, magSize=30;
let score=0, kills=0;
let timeLeft=GAME_TIME;
let shotsFired=0, shotsHit=0;
let killStreak=0;
let isReloading=false, reloadT=0, reloadDur=1.62;
let lastShot=0, fireRate=0.095;
let playerVel=new THREE.Vector3();
let onGround=true;
let canJump=true;
let damageFlashT=0;
let hitmarkerT=0, killHitT=0;
let shakeT=0, shakeAmp=0;
let centerMsgT=0;
let keys={};
let mouseX=0;
let sprinting=false, crouching=false, isCrouch=false;
let targetHeight=1.72, curHeight=1.72;
let bobPhase=0;

// Player collider position (camera base)
const playerPos = new THREE.Vector3(0, 1.72, 14);
camera.position.copy(playerPos);
controls.getObject().position.copy(playerPos);

// Enemies
const enemies=[];
const enemyGroup=new THREE.Group(); scene.add(enemyGroup);
let enemyShootCooldown=[];

// Particles / tracers / impacts
const tracers=[]; // {mesh, t}
const impacts=[]; // {mesh, t, vel}
const decals=[]; // bullet holes
const sparks=[]; // point sparks

// Raycaster
const raycaster=new THREE.Raycaster();
const clock=new THREE.Clock();

// HUD streak
function rebuildStreak(){
  streakDots.innerHTML='';
  for(let i=0;i<5;i++){ const el=document.createElement('i'); if(i<killStreak) el.className='on'; streakDots.appendChild(el); }
}

// Kill feed helper
function pushKillFeed(text, isHeadshot=false){
  const el=document.createElement('div'); el.className='kill-entry';
  el.innerHTML=`<b>YOU</b> <span>→</span> <em>${text}</em> ${isHeadshot?'<span style="color:var(--yellow)">HEADSHOT</span>':''} <span style="margin-left:6px;color:var(--yellow)">+100</span>`;
  killfeed.prepend(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(8px)'; setTimeout(()=>el.remove(),400); }, 3400);
}
function showCenter(text, dur=1200, color='#fff'){
  centerMsg.textContent=text; centerMsg.style.color=color; centerMsg.style.opacity='1';
  centerMsgT=dur/1000;
}

// Enemy factory
function makeEnemy(pos){
  const g=new THREE.Group();
  // body — tactical vest
  const bodyMat=new THREE.MeshStandardMaterial({ color:0x1a2736, roughness:0.82 });
  const vestMat=new THREE.MeshStandardMaterial({ color:0x2e3a4a, roughness:0.78 });
  const skinMat=new THREE.MeshStandardMaterial({ color:0xc9a88a, roughness:0.6 });
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.62,0.28), vestMat); body.position.y=0.62; body.castShadow=true; g.add(body);
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.72,0.30), bodyMat); torso.position.y=0.62; // under vest (slightly bigger)
  // head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.23,10,10), skinMat); head.position.set(0,1.12,0); head.castShadow=true; g.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(0.25,10,10,0,Math.PI*2,0,Math.PI/1.7), new THREE.MeshStandardMaterial({color:0x223045, roughness:0.55, metalness:0.35})); helmet.position.set(0,1.16,0); g.add(helmet);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.08,0.14), new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:0.2, metalness:0.7})); visor.position.set(0,1.10,0.14); g.add(visor);
  // arms
  const armL=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.62,0.14), bodyMat); armL.position.set(-0.36,0.62,0); g.add(armL);
  const armR=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.62,0.14), bodyMat); armR.position.set(0.36,0.62,0); g.add(armR);
  // legs
  const legMat=new THREE.MeshStandardMaterial({color:0x222a36, roughness:0.85});
  const legL=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.62,0.22), legMat); legL.position.set(-0.15,0.08,0); g.add(legL);
  const legR=new THREE.Mesh(new THREE.BoxGeometry(0.20,0.62,0.22), legMat); legR.position.set(0.15,0.08,0); g.add(legR);
  // rifle
  const rifle=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.07,0.62), new THREE.MeshStandardMaterial({color:0x0a0d11, roughness:0.5, metalness:0.6})); rifle.position.set(0.22,0.62,0.26); rifle.rotation.y=0.12; g.add(rifle);
  g.position.copy(pos);
  g.userData={ health:100, max:100, dead:false, target:pos.clone(), state:'patrol', head, body, rifle, lastShot: Math.random()*1.2, nextMove:0, hitT:0 };
  enemyGroup.add(g);
  // raycast targets: head and body seperate for headshot
  head.userData.enemy=g; body.userData.enemy=g; torso.userData.enemy=g;
  enemies.push(g);
  return g;
}

function spawnEnemies(n=7){
  // clear old
  enemies.length=0; enemyGroup.clear();
  const pts=[
    new THREE.Vector3(-18,0,-16), new THREE.Vector3(16,0,-14), new THREE.Vector3(-14,0,18),
    new THREE.Vector3(18,0,16), new THREE.Vector3(-26,0,4), new THREE.Vector3(26,0,-2),
    new THREE.Vector3(0,0, -28), new THREE.Vector3(-10,0,10), new THREE.Vector3(10,0,-6)
  ];
  for(let i=0;i<n;i++){
    let p=pts[i%pts.length].clone(); p.x+=(Math.random()-0.5)*6; p.z+=(Math.random()-0.5)*6;
    // ensure not inside building — simple check: if collides, nudge
    let tries=0; while(tries<12 && isInsideCollider(p)){ p.x+=(Math.random()-0.5)*8; p.z+=(Math.random()-0.5)*8; tries++; }
    makeEnemy(p);
  }
}
function isInsideCollider(p){
  const test=new THREE.Box3(new THREE.Vector3(p.x-0.35,0,p.z-0.35), new THREE.Vector3(p.x+0.35,2,p.z+0.35));
  for(const c of colliders){ if(test.intersectsBox(c.box)) return true; }
  return false;
}

// ----- Input -----
window.addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k==='r' && state==='playing' && !isReloading && ammo<magSize && reserve>0){ startReload(); }
  if(k==='r' && (state==='ended' || state==='start')) restart();
  if(k===' ' && state==='playing'){ if(canJump && onGround){ playerVel.y=7.2; onGround=false; canJump=false; } }
  if(k==='escape' && state==='playing'){ /* pointerlock will fire unlock */ }
});
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; if(e.key===' ') canJump=true; });
window.addEventListener('mousemove', e=>{ mouseX += Math.abs(e.movementX); });

// Pointer lock
renderer.domElement.addEventListener('click', ()=>{
  if(state==='start' || state==='ended'){ startGame(); return; }
  if(state==='playing' && !controls.isLocked) controls.lock();
  if(state==='paused' && !controls.isLocked) controls.lock();
});
controls.addEventListener('lock', ()=>{
  if(state==='start') startGame();
  else if(state==='paused'){ setState('playing'); }
  else if(state==='ended'){ /* ignore */ }
});
controls.addEventListener('unlock', ()=>{
  if(state==='playing'){ setState('paused'); }
});

document.getElementById('btn-play').onclick=()=> startGame();
document.getElementById('btn-resume').onclick=()=> controls.lock();
document.getElementById('btn-restart').onclick=()=> restart();

// Shooting via mouse down (hold for auto)
let isFiring=false;
renderer.domElement.addEventListener('mousedown', e=>{ if(e.button===0){ isFiring=true; }});
window.addEventListener('mouseup', e=>{ if(e.button===0) isFiring=false; });

// ----- Reload -----
function startReload(){
  if(isReloading || ammo===magSize || reserve<=0) return;
  isReloading=true; reloadT=0; reloadBar.classList.remove('hidden');
  weaponGroup.userData.reloadStart=performance.now();
  // anim kick
}
function finishReload(){
  const need=magSize-ammo;
  const take=Math.min(need, reserve);
  reserve-=take; ammo+=take;
  isReloading=false; reloadBar.classList.add('hidden');
  reloadProgress.style.width='0%';
  updateHUD();
  showCenter('RELOADED', 600, '#ffb700');
}

// ----- Damage / Healing -----
function damagePlayer(amt, fromPos){
  if(state!=='playing') return;
  health=Math.max(0, health-amt);
  damageFlashT=0.42;
  shakeT=0.32; shakeAmp=Math.min(0.22, amt*0.015);
  bloodOverlay.style.opacity = `${Math.min(0.55, (1-health/100)*0.65 + 0.12)}`;
  damageVignette.style.opacity='0.72';
  setTimeout(()=> damageVignette.style.opacity='0', 120);
  updateHUD();
  if(health<=0){ die(); }
  // directional hit indicator could be added
}
function die(){
  setState('ended');
  endTitle.textContent='KIA — MISSION FAILED';
  endTitle.style.color='#ff1a3c';
  endDesc.textContent='You were eliminated. Hostiles secured the killhouse.';
}
function healTick(dt){
  // slow regen after 4s without damage — COD style
}

// ----- Utility: line tracer -----
function spawnTracer(start, end, color=0xffe7a0, width=1.6){
  const geo=new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const mat=new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.95 });
  const line=new THREE.Line(geo, mat); line.material.linewidth=width;
  scene.add(line);
  tracers.push({ mesh:line, t:0, dur:0.06 });
  // also second thinner core
  const geo2=new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
  const mat2=new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85 });
  const line2=new THREE.Line(geo2, mat2); scene.add(line2);
  tracers.push({ mesh:line2, t:0, dur:0.045 });
}
function spawnImpact(pos, normal, isFlesh=false){
  // particles
  const count=isFlesh? 10: 7;
  for(let i=0;i<count;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(isFlesh?0.04:0.03,4,4), new THREE.MeshBasicMaterial({ color: isFlesh?0xff1a2a:0x9aa0b0 }));
    p.position.copy(pos);
    const dir=new THREE.Vector3((Math.random()-0.5)*1.2, Math.random()*0.9+0.2, (Math.random()-0.5)*1.2);
    if(normal) dir.add(normal.clone().multiplyScalar(0.6));
    dir.normalize();
    const spd=isFlesh? (3+Math.random()*4) : (4+Math.random()*6);
    p.userData.vel=dir.multiplyScalar(spd);
    p.userData.t=0; p.userData.life= isFlesh? 0.42: 0.32;
    scene.add(p); impacts.push(p);
  }
  // decal simple
  if(!isFlesh){
    const decalGeo=new THREE.CircleGeometry(0.07,6);
    const decalMat=new THREE.MeshStandardMaterial({ color:0x1a1d24, roughness:0.9, transparent:true, opacity:0.92, side:THREE.DoubleSide });
    const decal=new THREE.Mesh(decalGeo, decalMat);
    decal.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.02)));
    // orient to normal
    const up=new THREE.Vector3(0,0,1);
    decal.quaternion.setFromUnitVectors(up, normal.clone().normalize());
    scene.add(decal); decals.push({mesh:decal, t:0});
    setTimeout(()=>{ scene.remove(decal); }, 8000);
  }
}
function doMuzzleFlash(){
  muzzleFlash.visible=true; muzzleFlash.material.opacity=1;
  muzzleLight.intensity=22;
  muzzleFlash.scale.set(1,1,1);
  setTimeout(()=>{ muzzleFlash.visible=false; muzzleLight.intensity=0; }, 58);
  // weapon kick
  weaponGroup.userData.kickT=1;
}

// ----- Shooting -----
function tryShoot(){
  const now=performance.now()/1000;
  if(now - lastShot < fireRate) return;
  if(isReloading) return;
  if(ammo<=0){
    // click empty + auto reload
    if(reserve>0) startReload();
    else showCenter('NO AMMO', 500, '#ff1a3c');
    lastShot=now;
    return;
  }
  lastShot=now;
  ammo--; shotsFired++;
  updateHUD();
  doMuzzleFlash();
  // recoil shake
  shakeT=0.10; shakeAmp=0.045;
  // spread: slight while moving/sprinting
  const moving = keys['w']||keys['a']||keys['s']||keys['d'];
  const spread = sprinting? 0.022 : moving? 0.012 : 0.006;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  dir.x += (Math.random()-0.5)*spread;
  dir.y += (Math.random()-0.5)*spread;
  dir.z += (Math.random()-0.5)*spread;
  dir.normalize();
  const origin = camera.position.clone();
  raycaster.set(origin, dir);
  // test enemies first (head priority)
  const enemyMeshes=[];
  enemies.forEach(g=>{ if(!g.userData.dead){ g.traverse(m=>{ if(m.isMesh && m.userData.enemy) enemyMeshes.push(m); }); }});
  let hitEnemy=null, hitPoint=null, isHead=false;
  const enHits=raycaster.intersectObjects(enemyMeshes, false);
  let enemyDist=Infinity;
  if(enHits.length){
    const h=enHits[0];
    const enemyGroupHit=h.object.userData.enemy;
    if(enemyGroupHit && !enemyGroupHit.userData.dead){
      hitEnemy=enemyGroupHit; hitPoint=h.point.clone(); isHead=(h.object===enemyGroupHit.userData.head || h.object.geometry.type==='SphereGeometry' && h.object.position.y>1);
      // refine headshot: if distance to head <0.32 => headshot
      const headPos=new THREE.Vector3(); hitEnemy.userData.head.getWorldPosition(headPos);
      isHead = headPos.distanceTo(hitPoint) < 0.33;
      enemyDist=h.distance;
    }
  }
  // world hits
  const worldHits=raycaster.intersectObjects(shootTargets, false);
  let worldHit=null, worldDist=Infinity;
  if(worldHits.length){ worldHit=worldHits[0]; worldDist=worldHit.distance; }

  // decide closest
  let finalPoint=null;
  let hitFlesh=false;
  if(hitEnemy && enemyDist < worldDist){
    finalPoint=hitPoint;
    const dmg=isHead? 72 : 36;
    hitFlesh=true;
    // damage enemy
    hitEnemy.userData.health -= dmg;
    hitEnemy.userData.hitT=0.22;
    shotsHit++;
    if(hitEnemy.userData.health<=0 && !hitEnemy.userData.dead){
      hitEnemy.userData.dead=true;
      hitEnemy.userData.deathT=0;
      kills++; score+= isHead? 150:100; killStreak++;
      rebuildStreak();
      pushKillFeed(`HOSTILE ${kills}`, isHead);
      hitmarkerKill.classList.remove('hidden'); killHitT=0.42;
      showCenter(isHead? 'HEADSHOT +150' : 'ELIMINATED +100', 700, isHead? '#ffb700' : '#fff');
      spawnImpact(finalPoint, worldHit? worldHit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hitEnemy.matrixWorld)) : dir.clone().multiplyScalar(-1), true);
      // bonus time
      timeLeft=Math.min(60, timeLeft+1.2);
      updateHUD();
      // respawn if needed
      if(kills>=KILL_TARGET){ setTimeout(()=> win(), 220); }
      else {
        // schedule new enemy after short delay
        setTimeout(()=>{
          if(state==='playing' && kills<KILL_TARGET){
            // spawn at far edge
            const ang=Math.random()*Math.PI*2; const r=26+Math.random()*10;
            const p=new THREE.Vector3(Math.cos(ang)*r,0,Math.sin(ang)*r);
            if(isInsideCollider(p)) { p.x*=0.7; p.z*=0.7; }
            makeEnemy(p);
          }
        }, 1600);
      }
    } else {
      // hit but not dead
      spawnImpact(finalPoint, new THREE.Vector3(0,1,0), true);
    }
    hitmarker.classList.remove('hidden'); hitmarkerT=0.13;
  } else if(worldHit){
    finalPoint=worldHit.point.clone();
    spawnImpact(finalPoint, worldHit.face.normal.clone().transformDirection(worldHit.object.matrixWorld).normalize(), false);
    // light hitmarker tick (no score)
    // keep subtle
  } else {
    finalPoint=origin.clone().add(dir.clone().multiplyScalar(80));
  }
  // tracer from muzzle to hit
  const muzzleWorld=new THREE.Vector3(); muzzleFlash.getWorldPosition(muzzleWorld);
  // offset muzzle world closer to camera if GLB not loaded: use camera pos forward 0.4
  if(muzzleWorld.length()<0.1){ muzzleWorld.copy(origin).add(dir.clone().multiplyScalar(0.42)); }
  spawnTracer(muzzleWorld, finalPoint, hitFlesh? 0xffd7a0: 0xffe9a0);
  // camera recoil
  camera.rotation.x -= 0.0045; // pitch up handled via controls? we simulate via controls object pitch
  // controls pitch
  // Use controls yaw/pitch via private? Instead nudge weapon
  weaponGroup.position.z += 0.045;
  weaponGroup.rotation.x -= 0.08;
}

function win(){
  setState('ended');
  endTitle.textContent='MISSION COMPLETE';
  endTitle.style.color='#2eff7a';
  endDesc.textContent='Killhouse secured — all hostiles eliminated. Outstanding, Courier.';
}
function lose(reason){
  setState('ended');
  endTitle.textContent='MISSION FAILED';
  endTitle.style.color='#ff3c00';
  endDesc.textContent=reason || 'Time expired — hostiles remain.';
}

// ----- State -----
function setState(s){
  state=s;
  if(s==='playing'){
    overlayStart.classList.add('hidden');
    overlayPause.classList.add('hidden');
    overlayEnd.classList.add('hidden');
  } else if(s==='paused'){
    overlayPause.classList.remove('hidden');
  } else if(s==='ended'){
    overlayEnd.classList.remove('hidden');
    controls.unlock();
    // stats
    endKills.textContent=`${kills} / ${KILL_TARGET}`;
    endScoreEl.textContent=score;
    const acc=shotsFired? Math.round(shotsHit/shotsFired*100):0;
    endAcc.textContent=acc+'%';
    endTime.textContent=timeLeft.toFixed(1)+'s';
    endDesc.textContent = kills>=KILL_TARGET ? 'All targets eliminated with time to spare.' : `Eliminated ${kills}/${KILL_TARGET} hostiles.`;
  } else if(s==='start'){
    overlayStart.classList.remove('hidden');
    overlayPause.classList.add('hidden');
    overlayEnd.classList.add('hidden');
  }
  updateHUD();
}
function startGame(){ setState('playing'); controls.lock(); }
function restart(){
  // reset all
  health=100; ammo=30; reserve=90; score=0; kills=0; killStreak=0; timeLeft=GAME_TIME;
  shotsFired=0; shotsHit=0; isReloading=false; reloadBar.classList.add('hidden');
  playerPos.set(0,1.72,14); camera.position.copy(playerPos); controls.getObject().position.copy(playerPos);
  playerVel.set(0,0,0); onGround=true; curHeight=targetHeight=1.72;
  spawnEnemies(7);
  tracers.forEach(t=>scene.remove(t.mesh)); tracers.length=0;
  impacts.forEach(m=>scene.remove(m)); impacts.length=0;
  decals.forEach(d=>scene.remove(d.mesh)); decals.length=0;
  rebuildStreak(); updateHUD(); centerMsg.style.opacity='0';
  bloodOverlay.style.opacity='0';
  setState('playing'); controls.lock();
}

// HUD
function updateHUD(){
  hudScore.textContent=score;
  hudKills.textContent=`${kills} / ${KILL_TARGET}`;
  hudTimer.textContent=timeLeft.toFixed(1);
  if(timeLeft<12) hudTimer.classList.add('urgent'); else hudTimer.classList.remove('urgent');
  hudHealth.textContent=Math.ceil(health);
  const pct=Math.max(0, health/maxHealth);
  healthBar.style.width=(pct*100)+'%';
  healthBarDamage.style.width=(pct*100)+'%';
  healthBar.style.filter= pct<0.3? 'hue-rotate(-10deg) brightness(1.2)': '';
  if(pct<0.28) healthBar.style.background='linear-gradient(90deg,#ff0033,#ff4d00)';
  else healthBar.style.background='linear-gradient(90deg,#ff1a3c,#ff6a00)';
  hudAmmo.textContent=ammo; hudReserve.textContent=reserve;
  if(ammo<=6) hudAmmo.style.color='#ff3c00'; else hudAmmo.style.color='#fff';
  objText.textContent = kills>=KILL_TARGET? 'KILLHOUSE SECURED' : `ELIMINATE HOSTILES — ${KILL_TARGET - kills} REMAINING`;
  objText.style.color = kills>=KILL_TARGET? '#2eff7a' : '#00e5ff';
}

// ----- Collision helper: slide against boxes -----
function collideAndSlide(pos, radius=0.38, height=1.72){
  // check X then Z separately for sliding
  // we have colliders expanded by radius already, but we treat player as point foot + head check
  // Use Box3 intersection with player capsule approximated as box
  const playerBox=new THREE.Box3(
    new THREE.Vector3(pos.x-radius, pos.y - curHeight, pos.z-radius),
    new THREE.Vector3(pos.x+radius, pos.y+0.2, pos.z+radius)
  );
  for(const c of colliders){
    if(playerBox.intersectsBox(c.box)){
      // resolve: push out by smallest axis
      const center=new THREE.Vector3(); c.box.getCenter(center);
      const dx=pos.x-center.x, dz=pos.z-center.z;
      if(Math.abs(dx) > Math.abs(dz)){
        pos.x += dx>0? 0.08 : -0.08;
      } else {
        pos.z += dz>0? 0.08 : -0.08;
      }
      // after push, break and recheck next frame
    }
  }
  // keep inside map bounds
  pos.x=Math.max(-MAP_SIZE/2+1, Math.min(MAP_SIZE/2-1, pos.x));
  pos.z=Math.max(-MAP_SIZE/2+1, Math.min(MAP_SIZE/2-1, pos.z));
}

// ----- Enemy AI update -----
function updateEnemies(dt){
  const playerEye=camera.position.clone();
  for(const e of enemies){
    if(e.userData.dead){
      e.userData.deathT+=dt;
      e.rotation.z = Math.min(Math.PI/2, e.userData.deathT*2.2);
      e.position.y = Math.max(-0.2, -e.userData.deathT*0.6);
      // fade after 3.5s
      if(e.userData.deathT>3.5){ e.visible=false; }
      continue;
    }
    const dist= e.position.distanceTo(playerEye);
    // LOS check via raycast to player
    let hasLOS=false;
    if(dist<42){
      raycaster.set(e.position.clone().add(new THREE.Vector3(0,1.0,0)), playerEye.clone().sub(e.position).normalize());
      const hits=raycaster.intersectObjects(shootTargets, false);
      const enemyHitDist=hits.length? hits[0].distance : Infinity;
      // if first hit is close to player distance, LOS true
      if(enemyHitDist > dist - 1.2) hasLOS=true;
    }
    // state machine
    if(hasLOS && dist<35){
      e.userData.state='attack';
    } else if(e.userData.state==='attack' && (!hasLOS || dist>38)){
      e.userData.state='chase';
      e.userData.target=playerEye.clone();
    } else if(e.userData.state==='chase' && dist<2){
      e.userData.state='patrol';
    }
    // movement
    let moveDir=null;
    if(e.userData.state==='attack'){
      // strafe and face player
      const toPlayer=playerEye.clone().sub(e.position); toPlayer.y=0; toPlayer.normalize();
      e.lookAt(playerEye.x, e.position.y, playerEye.z);
      // strafe occasionally
      const strafe=Math.sin(performance.now()*0.001 + e.position.x)*0.7;
      moveDir=toPlayer.clone().multiplyScalar(0.2).add(new THREE.Vector3(toPlayer.z,0,-toPlayer.x).multiplyScalar(strafe*0.45));
      // keep distance ~8-14
      if(dist<8) moveDir.add(toPlayer.clone().multiplyScalar(-0.6));
      else if(dist>14) moveDir.add(toPlayer.clone().multiplyScalar(0.5));
      // shooting
      e.userData.lastShot+=dt;
      const shootInterval = 0.65 + Math.random()*0.7;
      if(e.userData.lastShot>shootInterval && hasLOS){
        e.userData.lastShot=0;
        // enemy tracer to player, damage
        const start=e.position.clone().add(new THREE.Vector3(0,0.62,0.26).applyQuaternion(e.quaternion));
        const end=playerEye.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, 0));
        spawnTracer(start, end, 0xff3c00);
        // hit chance based on distance
        const acc = dist<12? 0.62 : dist<20? 0.38 : 0.22;
        if(Math.random()<acc){
          damagePlayer(7 + Math.random()*7, e.position);
          // flash hitmarker on player? vignette does
        }
        // muzzle flash for enemy (tiny point light)
        const flash=new THREE.PointLight(0xffaa44, 10, 5); flash.position.copy(start); scene.add(flash);
        setTimeout(()=>scene.remove(flash), 60);
      }
    } else {
      // patrol / chase: move towards target
      if(e.userData.nextMove<performance.now()/1000){
        // pick new target near cover or player
        if(e.userData.state==='chase'){
          e.userData.target=playerEye.clone().add(new THREE.Vector3((Math.random()-0.5)*8,0,(Math.random()-0.5)*8));
        } else {
          e.userData.target=new THREE.Vector3((Math.random()-0.5)*(MAP_SIZE-10),0,(Math.random()-0.5)*(MAP_SIZE-10));
        }
        e.userData.nextMove=performance.now()/1000 + 2 + Math.random()*2.5;
      }
      const toTarget=e.userData.target.clone().sub(e.position); toTarget.y=0;
      const d=toTarget.length();
      if(d>0.6){
        toTarget.normalize();
        e.lookAt(e.position.x+toTarget.x, e.position.y, e.position.z+toTarget.z);
        moveDir=toTarget.clone();
      }
    }
    if(moveDir){
      moveDir.y=0; if(moveDir.length()>0.01) moveDir.normalize();
      const speed = e.userData.state==='attack'? 1.9 : 2.7;
      const nextPos=e.position.clone().add(moveDir.multiplyScalar(speed*dt));
      // simple obstacle check: ray ahead
      raycaster.set(e.position.clone().add(new THREE.Vector3(0,0.5,0)), moveDir);
      const ahead=raycaster.intersectObjects(shootTargets, false);
      if(!ahead.length || ahead[0].distance>1.2){
        // also not inside collider
        if(!isInsideCollider(nextPos)){
          e.position.copy(nextPos);
        } else {
          // turn
          e.rotation.y+= (Math.random()-0.5)*1.2;
        }
      } else {
        e.rotation.y+=0.9*dt*3;
      }
    }
    // bob while walking
    e.position.y = Math.sin(performance.now()*0.004 + e.position.x)*0.06;
    // hit flash
    if(e.userData.hitT>0){
      e.userData.hitT-=dt;
      e.traverse(m=>{ if(m.isMesh && m.material) m.material.emissive && (m.material.emissive.setHex(e.userData.hitT>0?0x441111:0x000000)); });
      // simpler: tint
      if(e.userData.hitT>0) e.children.forEach(ch=>{ if(ch.isMesh) ch.material.color && ch.material.color.offsetHSL?.(0,0,0); });
    }
  }
}

// ----- Minimap -----
function drawMinimap(){
  const s=140, pad=7, scale= (s-pad*2)/MAP_SIZE;
  mctx.clearRect(0,0,s,s);
  mctx.fillStyle='#0a0e1a'; mctx.fillRect(0,0,s,s);
  // grid
  mctx.strokeStyle='rgba(255,255,255,0.04)'; mctx.lineWidth=1;
  for(let i=0;i<MAP_SIZE;i+=8){
    const x=pad + (i+MAP_SIZE/2)*scale; mctx.beginPath(); mctx.moveTo(x,pad); mctx.lineTo(x,s-pad); mctx.stroke();
    const y=pad + (i+MAP_SIZE/2)*scale; mctx.beginPath(); mctx.moveTo(pad,y); mctx.lineTo(s-pad,y); mctx.stroke();
  }
  // buildings
  mctx.fillStyle='#1d2436';
  for(const c of colliders){
    // c.box expanded; shrink to get original building approx size: we stored expanded by 0.35, but use its mesh position if building
    // approximate by box
    const b=c.box;
    const x0=pad + (b.min.x+MAP_SIZE/2)*scale, y0=pad + (b.min.z+MAP_SIZE/2)*scale;
    const w=(b.max.x-b.min.x)*scale, h=(b.max.z-b.min.z)*scale;
    // only draw large buildings (w> 3*scale)
    if(w>5 && h>5){ mctx.fillRect(x0,y0,w,h); mctx.strokeStyle='rgba(255,255,255,0.07)'; mctx.strokeRect(x0,y0,w,h); }
  }
  // enemies red
  for(const e of enemies){
    if(e.userData.dead) continue;
    const x=pad + (e.position.x+MAP_SIZE/2)*scale, y=pad + (e.position.z+MAP_SIZE/2)*scale;
    mctx.fillStyle='#ff1a3c'; mctx.shadowColor='#ff1a3c'; mctx.shadowBlur=6;
    mctx.beginPath(); mctx.arc(x,y,3.2,0,Math.PI*2); mctx.fill(); mctx.shadowBlur=0;
    // facing line
    mctx.strokeStyle='rgba(255,30,60,0.6)'; mctx.lineWidth=1.2; mctx.beginPath(); mctx.moveTo(x,y); mctx.lineTo(x+Math.sin(e.rotation.y)*7, y+Math.cos(e.rotation.y)*7); mctx.stroke();
  }
  // player
  const px=pad + (camera.position.x+MAP_SIZE/2)*scale, pz=pad + (camera.position.z+MAP_SIZE/2)*scale;
  mctx.fillStyle='#00e5ff'; mctx.shadowColor='#00e5ff'; mctx.shadowBlur=8;
  mctx.beginPath(); mctx.arc(px,pz,4,0,Math.PI*2); mctx.fill(); mctx.shadowBlur=0;
  // facing cone
  const yaw = controls.getObject().rotation.y; // actually not reliable; use camera quaternion
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const ang=Math.atan2(dir.x, dir.z);
  mctx.fillStyle='rgba(0,229,255,0.22)'; mctx.beginPath(); mctx.moveTo(px,pz); mctx.arc(px,pz,28, ang-0.45, ang+0.45); mctx.closePath(); mctx.fill();
  // direction triangle
  mctx.save(); mctx.translate(px,pz); mctx.rotate(-ang+Math.PI); mctx.fillStyle='#fff'; mctx.beginPath(); mctx.moveTo(0,-6); mctx.lineTo(3,3); mctx.lineTo(-3,3); mctx.closePath(); mctx.fill(); mctx.restore();
  // border
  mctx.strokeStyle='rgba(255,60,0,0.22)'; mctx.lineWidth=1.5; mctx.strokeRect(0.5,0.5,s-1,s-1);
}

// ----- Main loop -----
let lastTime=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(0.033, (now-lastTime)/1000);
  lastTime=now;

  if(state==='playing'){
    timeLeft-=dt;
    if(timeLeft<=0){ timeLeft=0; lose('TIME EXPIRED — hostiles remain in killhouse.'); }

    // input movement
    const moveSpeed= crouching? 2.2 : sprinting? 6.4 : 4.5;
    const forward = (keys['w']?1:0) - (keys['s']?1:0);
    const strafe  = (keys['d']?1:0) - (keys['a']?1:0);
    const input=new THREE.Vector3(strafe,0,-forward);
    if(input.length()>0) input.normalize();
    const camDir=new THREE.Vector3(); camera.getWorldDirection(camDir); camDir.y=0; camDir.normalize();
    const right=new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0)).normalize();
    // Actually right = camDir x up => need correct: right = cross(camDir, up) gives left? use method:
    // simpler: use controls move
    const wish=new THREE.Vector3();
    if(input.z!==0) wish.addScaledVector(camDir, -input.z);
    if(input.x!==0){
      const r=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), camDir).normalize(); // alternative
      // fallback to camera right
      const camRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); camRight.y=0; camRight.normalize();
      wish.addScaledVector(camRight, input.x);
    }
    if(wish.length()>0) wish.normalize();

    sprinting = !!keys['shift'] && forward>0 && !crouching && !isReloading && wish.length()>0.1;
    crouching = !!keys['control'] || !!keys['c'];
    targetHeight = crouching? 1.15 : 1.72;
    curHeight += (targetHeight - curHeight) * Math.min(1, dt*10);
    // apply gravity / jump
    if(!onGround){
      playerVel.y -= 22*dt;
    }
    const flatWish=wish.clone().multiplyScalar(moveSpeed);
    // lerp velocity XZ
    playerVel.x += (flatWish.x - playerVel.x) * Math.min(1, dt*12);
    playerVel.z += (flatWish.z - playerVel.z) * Math.min(1, dt*12);
    if(wish.length()<0.01){
      playerVel.x *= Math.pow(0.02, dt); // fast damp
      playerVel.z *= Math.pow(0.02, dt);
      if(Math.abs(playerVel.x)<0.02) playerVel.x=0;
      if(Math.abs(playerVel.z)<0.02) playerVel.z=0;
    }
    // integrate
    const nextPos=camera.position.clone();
    nextPos.x += playerVel.x*dt;
    nextPos.z += playerVel.z*dt;
    collideAndSlide(nextPos);
    camera.position.x=nextPos.x; camera.position.z=nextPos.z;
    controls.getObject().position.x=nextPos.x; controls.getObject().position.z=nextPos.z;
    // vertical
    camera.position.y += playerVel.y*dt;
    if(camera.position.y < curHeight){
      camera.position.y=curHeight; playerVel.y=0; onGround=true;
    } else {
      // check ceiling? not needed
    }
    controls.getObject().position.y=camera.position.y;

    // FOV sprint
    const targetFov = sprinting? 82 : crouching? 72 : 74;
    if(Math.abs(camera.fov - targetFov)>0.1){ camera.fov += (targetFov-camera.fov)*Math.min(1, dt*6); camera.updateProjectionMatrix(); }

    // weapon sway / bob / sprint anim
    const movingLen=Math.hypot(playerVel.x, playerVel.z);
    bobPhase += dt * (sprinting? 12 : movingLen>0.3? 9 : 4) * (movingLen>0.1?1:0.2);
    const bobAmp = sprinting? 0.055 : movingLen>0.6? 0.028 : 0.012;
    const swayX=Math.sin(bobPhase)*bobAmp;
    const swayY=Math.abs(Math.cos(bobPhase))*bobAmp*0.7;
    // breathing
    const breath=Math.sin(now*0.0012)*0.008;
    weaponGroup.position.x = 0.34 + swayX*0.5;
    weaponGroup.position.y = -0.28 + swayY + breath;
    weaponGroup.position.z = -0.48 + (sprinting? -0.12 + Math.sin(bobPhase)*0.06 : 0);
    weaponGroup.rotation.z = swayX*0.6;
    weaponGroup.rotation.x = swayY*0.5 + (isReloading? Math.sin(reloadT*3.2)*0.12 : 0);
    if(sprinting){
      weaponGroup.rotation.x += 0.22;
      weaponGroup.position.y -= 0.04;
    }
    // recoil recovery
    if(weaponGroup.userData.kickT>0){
      weaponGroup.userData.kickT-=dt*7;
      if(weaponGroup.userData.kickT<0) weaponGroup.userData.kickT=0;
    }
    const kick=weaponGroup.userData.kickT||0;
    weaponGroup.position.z += kick*0.18;
    weaponGroup.rotation.x -= kick*0.35;

    // auto fire
    if(isFiring && controls.isLocked) tryShoot();

    // reload progress
    if(isReloading){
      reloadT+=dt/reloadDur;
      reloadProgress.style.width=(Math.min(1,reloadT)*100)+'%';
      if(reloadT>=1) finishReload();
    }

    // enemies
    updateEnemies(dt);

    // tracers decay
    for(let i=tracers.length-1;i>=0;i--){
      const t=tracers[i]; t.t+=dt;
      t.mesh.material.opacity = 1 - t.t/t.dur;
      if(t.t>=t.dur){ scene.remove(t.mesh); tracers.splice(i,1); }
    }
    // impacts physics
    for(let i=impacts.length-1;i>=0;i--){
      const p=impacts[i];
      p.userData.t+=dt;
      p.userData.vel.y -= 9.8*dt;
      p.position.add(p.userData.vel.clone().multiplyScalar(dt));
      p.material.opacity = 1 - p.userData.t/p.userData.life;
      if(p.material.opacity<=0.15) p.scale.multiplyScalar(0.96);
      if(p.userData.t>=p.userData.life){ scene.remove(p); impacts.splice(i,1); }
    }

    // damage flash decay
    if(damageFlashT>0){
      damageFlashT-=dt;
      const a=Math.max(0, damageFlashT/0.42);
      damageVignette.style.opacity = (a*0.72).toString();
      if(health>70) bloodOverlay.style.opacity = (a*0.18).toString();
      else bloodOverlay.style.opacity = (0.08 + (1-health/100)*0.42 + a*0.12).toString();
      if(damageFlashT<=0){ damageVignette.style.opacity='0'; if(health>75) bloodOverlay.style.opacity='0'; }
    }
    // hitmarker decay
    if(hitmarkerT>0){ hitmarkerT-=dt; if(hitmarkerT<=0) hitmarker.classList.add('hidden'); }
    if(killHitT>0){ killHitT-=dt; if(killHitT<=0) hitmarkerKill.classList.add('hidden'); }
    // shake
    if(shakeT>0){
      shakeT-=dt; const s=shakeAmp*(shakeT/0.32);
      camera.position.x += (Math.random()-0.5)*s;
      camera.position.y += (Math.random()-0.5)*s*0.6;
      weaponGroup.position.x += (Math.random()-0.5)*s*0.2;
    }
    // center msg
    if(centerMsgT>0){ centerMsgT-=dt; centerMsg.style.opacity = Math.min(1, centerMsgT*3).toString(); if(centerMsgT<=0) centerMsg.style.opacity='0'; }

    // win check time? already
    updateHUD();
  }

  drawMinimap();
  renderer.render(scene,camera);
}
animate();

window.addEventListener('resize', ()=>{
  camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// initial state
spawnEnemies(7);
rebuildStreak();
updateHUD();
setState('start');

// expose for tests
window.__fps = { getKills:()=>kills, getHealth:()=>health, getAmmo:()=>ammo };


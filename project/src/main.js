import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('canvas');
const barFill = document.getElementById('barFill');
const loadText = document.getElementById('loadText');
const loadingEl = document.getElementById('loading');
const scoreVal = document.getElementById('scoreVal');
const enemiesVal = document.getElementById('enemiesVal');
const timeVal = document.getElementById('timeVal');
const healthVal = document.getElementById('healthVal');
const healthBar = document.getElementById('healthBar');
const ammoVal = document.getElementById('ammoVal');
const ammoBar = document.getElementById('ammoBar');
const hitmarker = document.getElementById('hitmarker');
const damageVig = document.getElementById('damageVignette');
const centerText = document.getElementById('centerText');
const killFeed = document.getElementById('killFeed');
const crosshair = document.getElementById('crosshair');
const pauseEl = document.getElementById('pause');
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');

let progress = 0;
function setProgress(p, t){ progress=p; barFill.style.width=p+'%'; if(t) loadText.textContent=t; }

setProgress(10,'LOADING THREE.JS...');

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1420, 0.015);
scene.background = new THREE.Color(0x0a1420);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Camera
const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 400);
camera.position.set(0, 1.65, 12);

// Lighting — COD style: cool sky + warm fill + strong directional sun
scene.add(new THREE.HemisphereLight(0x8ec8ff, 0x1a2a1a, 1.1));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 180;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0005;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8ec8ff, 0.6);
fill.position.set(-20, 20, -30); scene.add(fill);

// Weapon viewmodel scene (always rendered on top, no fog, no shadows)
const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.01, 10);
weaponCamera.position.set(0,0,0);

// Ground — PBR concrete
const groundGeo = new THREE.PlaneGeometry(180,180, 1,1);
const groundMat = new THREE.MeshStandardMaterial({ color:0x2a3338, roughness:0.92, metalness:0.04 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
// grid decal texture via repeat
const gridGeo = new THREE.PlaneGeometry(180,180);
const gridMat = new THREE.MeshStandardMaterial({ color:0x1a2226, roughness:0.9, metalness:0.02, transparent:true, opacity:0.35 });
const gridHelper = new THREE.Mesh(gridGeo, gridMat); gridHelper.rotation.x=-Math.PI/2; gridHelper.position.y=0.02; scene.add(gridHelper);
// add subtle grid lines using LineSegments
const gridLines = new THREE.GridHelper(180, 36, 0x2a3a42, 0x1e2e36); gridLines.position.y=0.03; scene.add(gridLines);

// Level geometry — shipping yard / warehouse arena
const wallMat = new THREE.MeshStandardMaterial({ color:0x3a444c, roughness:0.85, metalness:0.08 });
const metalMat = new THREE.MeshStandardMaterial({ color:0x6a767c, roughness:0.35, metalness:0.72 });
const crateMat = new THREE.MeshStandardMaterial({ color:0x7a5a3a, roughness:0.9, metalness:0.0 });
const containerMat = new THREE.MeshStandardMaterial({ color:0x1d4a5a, roughness:0.75, metalness:0.25 });

const colliders = []; // AABB {min,max}
function addBox(pos,size,mat, castShadow=true){
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos); m.castShadow=castShadow; m.receiveShadow=true; scene.add(m);
  colliders.push({ min: new THREE.Vector3(pos.x-size.x/2, pos.y-size.y/2, pos.z-size.z/2), max: new THREE.Vector3(pos.x+size.x/2, pos.y+size.y/2, pos.z+size.z/2) });
  return m;
}
// Perimeter walls
addBox(new THREE.Vector3(0,4,-42), new THREE.Vector3(90,8,2), wallMat);
addBox(new THREE.Vector3(0,4,42), new THREE.Vector3(90,8,2), wallMat);
addBox(new THREE.Vector3(-45,4,0), new THREE.Vector3(2,8,84), wallMat);
addBox(new THREE.Vector3(45,4,0), new THREE.Vector3(2,8,84), wallMat);
// Cover objects — crates, barriers, containers
addBox(new THREE.Vector3(-10,1,-10), new THREE.Vector3(4,2,2), crateMat);
addBox(new THREE.Vector3(-12,1,-8), new THREE.Vector3(2,2,4), crateMat);
addBox(new THREE.Vector3(12,1.5,6), new THREE.Vector3(6,3,2), containerMat);
addBox(new THREE.Vector3(8,1,-18), new THREE.Vector3(3,2,3), crateMat);
addBox(new THREE.Vector3(-18,1.5,10), new THREE.Vector3(8,3,2), containerMat);
addBox(new THREE.Vector3(0,1, -2), new THREE.Vector3(2,2,2), crateMat);
addBox(new THREE.Vector3(18,1, -6), new THREE.Vector3(2,2,10), crateMat);
addBox(new THREE.Vector3(-20,1, -20), new THREE.Vector3(12,2,2), metalMat);
addBox(new THREE.Vector3(22,1.2,18), new THREE.Vector3(10,2.4,2), wallMat);
addBox(new THREE.Vector3(-6,0.9,14), new THREE.Vector3(2,1.8,6), crateMat);
addBox(new THREE.Vector3(6,0.9, -14), new THREE.Vector3(6,1.8,1), crateMat);
// Elevated platforms
addBox(new THREE.Vector3(-28,1, 0), new THREE.Vector3(10,2,14), wallMat);
addBox(new THREE.Vector3(28,1, 0), new THREE.Vector3(10,2,14), wallMat);
// Light poles
for(let i=0;i<4;i++){
  const x = (i<2?-38:38), z = (i%2? -28: 28);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,10,8), metalMat);
  pole.position.set(x,5,z); pole.castShadow=true; scene.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4,12,8), new THREE.MeshStandardMaterial({color:0xffffcc, emissive:0xffffaa, emissiveIntensity:2}));
  lamp.position.set(x,9.5,z); scene.add(lamp);
  const pl = new THREE.PointLight(0xffeeaa, 20, 30); pl.position.set(x,9,z); scene.add(pl);
}

// Sky dome gradient + distant mountains silhouette
const skyGeo = new THREE.SphereGeometry(200, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vPos; void main(){ float h=clamp(vPos.y/200.0,0.0,1.0); vec3 top=vec3(0.06,0.12,0.22); vec3 mid=vec3(0.18,0.28,0.38); vec3 col=mix(mid, top, pow(h,0.55)); gl_FragColor=vec4(col,1.);}',
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

setProgress(30,'BUILDING ARENA...');
let weaponGroup = new THREE.Group();
let weaponLoaded = false;
let weaponMesh = null;
let muzzleFlash = null;
let muzzleLight = null;
// Audio — Web Audio synthesis (no external files, COD-like)
let audioCtx=null;
function ensureAudio(){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function playGunshot(){
  ensureAudio(); const t=audioCtx.currentTime;
  const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); const f=audioCtx.createBiquadFilter();
  o.type='square'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(45,t+0.08);
  f.type='bandpass'; f.frequency.value=1200; f.Q.value=1.2;
  g.gain.setValueAtTime(0.55,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.18);
  o.connect(f); f.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.18);
  // click transient
  const o2=audioCtx.createOscillator(); const g2=audioCtx.createGain();
  o2.type='square'; o2.frequency.value=900; g2.gain.setValueAtTime(0.25,t); g2.gain.exponentialRampToValueAtTime(0.01,t+0.04);
  o2.connect(g2); g2.connect(audioCtx.destination); o2.start(t); o2.stop(t+0.04);
}
function playHit(){ ensureAudio(); const t=audioCtx.currentTime; const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.frequency.value=1200; g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.01,t+0.12); o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.12); }
function playReload(){ ensureAudio(); const t=audioCtx.currentTime; for(let i=0;i<2;i++){ const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.frequency.value= 300+i*80; g.gain.setValueAtTime(0.12,t+i*0.18); g.gain.exponentialRampToValueAtTime(0.01,t+i*0.18+0.12); o.connect(g); g.connect(audioCtx.destination); o.start(t+i*0.18); o.stop(t+i*0.18+0.12);} }

setProgress(40,'LOADING WEAPON GLB...');
const loader = new GLTFLoader();
loader.load('/models/weapon.glb', (gltf)=>{
  weaponMesh = gltf.scene;
  // Normalize weapon: center, scale to viewmodel size
  const box = new THREE.Box3().setFromObject(weaponMesh);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  weaponMesh.position.sub(center);
  const maxDim = Math.max(size.x,size.y,size.z);
  const scale = 2.15 / maxDim;
  weaponMesh.scale.setScalar(scale);
  weaponMesh.rotation.y = Math.PI;
  weaponMesh.rotation.x = 0.02;
  weaponMesh.traverse(o=>{
    if(o.isMesh){ o.castShadow=false; o.frustumCulled=false; if(o.material) o.material.needsUpdate=true; }
  });
  weaponGroup.add(weaponMesh);
  // Muzzle position guess: front of rifle
  const muzzle = new THREE.Group();
  muzzle.position.set(0, -0.06, 0.85);
  // Flash sprite (procedural disc)
  const flashCanvas = document.createElement('canvas'); flashCanvas.width=128; flashCanvas.height=128;
  const fctx = flashCanvas.getContext('2d');
  const g = fctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,200,1)'); g.addColorStop(0.25,'rgba(255,180,40,0.9)'); g.addColorStop(0.5,'rgba(255,80,10,0.5)'); g.addColorStop(1,'rgba(0,0,0,0)');
  fctx.fillStyle=g; fctx.fillRect(0,0,128,128);
  const flashTex = new THREE.CanvasTexture(flashCanvas);
  const flashMat = new THREE.SpriteMaterial({ map: flashTex, transparent:true, opacity:0, depthWrite:false });
  muzzleFlash = new THREE.Sprite(flashMat); muzzleFlash.scale.set(0.22,0.22,1); muzzle.add(muzzleFlash);
  muzzleLight = new THREE.PointLight(0xffaa44, 0, 3); muzzle.add(muzzleLight);
  weaponGroup.add(muzzle);
  weaponGroup.userData.muzzle = muzzle;
  weaponLoaded = true;
  setProgress(70,'WEAPON READY');
}, (ev)=>{
  if(ev.lengthComputable) setProgress(40+ Math.round(ev.loaded/ev.total*20), 'LOADING WEAPON...');
}, (err)=>{
  console.warn('weapon load fail', err);
  // Fallback: procedural rifle
  const fbGeo = new THREE.BoxGeometry(0.08,0.08,0.7);
  const fbMat = new THREE.MeshStandardMaterial({color:0x2a2e33, roughness:0.4, metalness:0.7});
  weaponMesh = new THREE.Mesh(fbGeo, fbMat); weaponGroup.add(weaponMesh);
  weaponLoaded=true;
});

// Weapon group positioned for FPS viewmodel
weaponGroup.position.set(0.28, -0.22, -0.55);
weaponGroup.rotation.set(0, 0, 0);
weaponScene.add(weaponGroup);
// Add soft fill light for weapon
weaponScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const wLight = new THREE.DirectionalLight(0xffffff, 1.5); wLight.position.set(2,3,2); weaponScene.add(wLight);

// Controls state
const keys = {};
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='KeyR') tryReload(); if(e.code==='KeyC') crouching=!crouching; });
addEventListener('keyup', e=> keys[e.code]=false);

// Pointer lock
let locked=false, yaw=0, pitch=0;
canvas.addEventListener('click', ()=>{ if(!locked) renderer.domElement.requestPointerLock?.(); else shoot(); });
document.addEventListener('pointerlockchange', ()=>{
  locked = document.pointerLockElement===canvas;
  pauseEl.classList.toggle('show', !locked && state!=='loading');
  if(locked) yaw = camera.rotation.y; // sync
});
document.addEventListener('mousemove', e=>{
  if(!locked) return;
  const sens = 0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});
document.getElementById('resumeBtn').addEventListener('click', ()=> canvas.requestPointerLock());

let crouching=false, sprinting=false;
let vel = new THREE.Vector3();
let onGround=true;
const playerHeight = 1.65;
const crouchHeight = 1.05;
let health=100, score=0, kills=0, ammo=30, reserve=90, reloading=false;
let isADS=false;

// Shooting state
let lastShot=0, fireRate=110, spread=0, recoilY=0, recoilX=0;
let hitFlashTime=0, damageTime=0;

function tryReload(){
  if(reloading || ammo===30 || reserve<=0) return;
  reloading=true; showCenter('RELOADING', 900); playReload();
  setTimeout(()=>{
    const need=30-ammo; const take=Math.min(need,reserve);
    ammo+=take; reserve-=take; reloading=false; updateHUD();
  }, 1350);
}
function showCenter(t, ms=700){ centerText.textContent=t; centerText.classList.add('show'); setTimeout(()=>centerText.classList.remove('show'), ms); }
function addKillFeed(t){ const d=document.createElement('div'); d.className='killItem'; d.textContent=t; killFeed.prepend(d); setTimeout(()=>d.remove(), 2200); }

function updateHUD(){
  scoreVal.textContent=score; enemiesVal.textContent=kills;
  healthVal.innerHTML = Math.max(0,Math.round(health))+'<span> / 100</span>';
  healthBar.style.width = Math.max(0,health)+'%';
  ammoVal.innerHTML = ammo+'<span> / '+reserve+'</span>';
  ammoBar.style.width = (ammo/30*100)+'%';
  ammoBar.style.background = ammo===0 ? '#ff2a2a' : ammo<10 ? '#ffaa00' : 'linear-gradient(90deg,#00ff88,#00d4ff)';
}

// Raycast helpers
const raycaster = new THREE.Raycaster();
const decalGroup = new THREE.Group(); scene.add(decalGroup);
function spawnDecal(pos, normal){
  const geo = new THREE.CircleGeometry(0.09, 8);
  const mat = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.9, transparent:true, opacity:0.85, polygonOffset:true, polygonOffsetFactor:-1 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos).addScaledVector(normal, 0.02);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
  // random rotation
  m.rotateZ(Math.random()*Math.PI*2);
  decalGroup.add(m);
  setTimeout(()=>{ m.material.opacity=0; setTimeout(()=>decalGroup.remove(m),400); }, 6000);
}
function spawnImpactParticles(pos, color=0xaaaaaa){
  const g = new THREE.BufferGeometry();
  const n=10; const arr=new Float32Array(n*3);
  for(let i=0;i<n;i++){ arr[i*3]=pos.x+(Math.random()-0.5)*0.25; arr[i*3+1]=pos.y+(Math.random()-0.5)*0.25; arr[i*3+2]=pos.z+(Math.random()-0.5)*0.25; }
  g.setAttribute('position', new THREE.BufferAttribute(arr,3));
  const mat = new THREE.PointsMaterial({ color, size:0.11, sizeAttenuation:true, transparent:true, opacity:0.95 });
  const pts = new THREE.Points(g, mat); scene.add(pts);
  const id=setInterval(()=>{ pts.position.y-=0.03; mat.opacity-=0.09; if(mat.opacity<=0){ clearInterval(id); scene.remove(pts);} },16);
}
function spawnShell(){
  const geo=new THREE.CylinderGeometry(0.015,0.015,0.04,6);
  const mat=new THREE.MeshStandardMaterial({color:0xc8a86a, roughness:0.35, metalness:0.85});
  const m=new THREE.Mesh(geo, mat);
  const ejectPos=new THREE.Vector3(0.18,-0.08,-0.1).applyMatrix4(weaponGroup.matrixWorld);
  m.position.copy(ejectPos);
  m.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
  scene.add(m);
  const velShell=new THREE.Vector3(0.6+Math.random()*0.6, 1.2+Math.random()*0.5, (Math.random()-0.5)*0.3);
  const start=performance.now();
  function tick(){
    const dt=0.016; velShell.y-=4.5*dt; m.position.addScaledVector(velShell, dt); m.rotation.x+=8*dt; m.rotation.z+=6*dt;
    if(performance.now()-start>900 || m.position.y<0.05){ m.material.opacity=0; setTimeout(()=>scene.remove(m),300); return; }
    requestAnimationFrame(tick);
  } requestAnimationFrame(tick);
}
function spawnTracer(start, end){
  const pts=[start.clone(), end.clone()];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({color:0xffd27a, transparent:true, opacity:0.85});
  const line=new THREE.Line(geo, mat); scene.add(line);
  let o=0.85; const id=setInterval(()=>{ o-=0.18; mat.opacity=o; if(o<=0){ clearInterval(id); scene.remove(line);} },16);
}

// Enemies — stylized hostile targets (mannequin-like with PBR)
const enemies=[];
function createEnemy(pos){
  const group = new THREE.Group();
  group.position.copy(pos);
  // body capsule
  const bodyMat = new THREE.MeshStandardMaterial({ color:0x2b3a44, roughness:0.65, metalness:0.12 });
  const headMat = new THREE.MeshStandardMaterial({ color:0xd8c8b8, roughness:0.7, metalness:0 });
  const vestMat = new THREE.MeshStandardMaterial({ color:0x3a4a2a, roughness:0.85, metalness:0.05 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.85,4,12), bodyMat); body.position.y=1.05; body.castShadow=true; group.add(body);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.65,0.55,0.38), vestMat); vest.position.y=1.12; vest.castShadow=true; group.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26,12,10), headMat); head.position.y=1.78; head.castShadow=true; group.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3,12,10,0,Math.PI*2,0,Math.PI*0.62), new THREE.MeshStandardMaterial({color:0x2a3320, roughness:0.5, metalness:0.3})); helmet.position.y=1.85; helmet.rotation.x=Math.PI; group.add(helmet);
  // arms
  const armGeo = new THREE.CapsuleGeometry(0.1,0.5,4,8);
  const lArm = new THREE.Mesh(armGeo, bodyMat); lArm.position.set(-0.42,1.05,0); lArm.rotation.z=0.2; group.add(lArm);
  const rArm = new THREE.Mesh(armGeo, bodyMat); rArm.position.set(0.42,1.05,0); rArm.rotation.z=-0.2; group.add(rArm);
  // health bar sprite
  group.userData = { health:100, max:100, alive:true, vel:new THREE.Vector3(), lastShot:0, group };
  // bounding for raycast
  group.userData.headPos = new THREE.Vector3(0,1.78,0);
  scene.add(group);
  enemies.push(group);
  return group;
}
function respawnEnemy(e){
  e.position.set( (Math.random()-0.5)*60, 0, (Math.random()-0.5)*60 );
  // keep inside arena and away from player
  if(e.position.length()<10) e.position.multiplyScalar(2);
  // clamp to walls
  e.position.x = Math.max(-42, Math.min(42, e.position.x));
  e.position.z = Math.max(-38, Math.min(38, e.position.z));
  e.userData.health=100; e.userData.alive=true; e.visible=true;
  e.rotation.y = Math.random()*Math.PI*2;
  e.position.y=0; e.scale.set(1,1,1);
}
for(let i=0;i<7;i++) createEnemy(new THREE.Vector3((Math.random()-0.5)*40,0,(Math.random()-0.5)*40));

// Collision vs AABB
function collide(pos, radius=0.4){
  const min = new THREE.Vector3(pos.x-radius, pos.y-1.6, pos.z-radius);
  const max = new THREE.Vector3(pos.x+radius, pos.y+0.3, pos.z+radius);
  for(const b of colliders){
    if(min.x<=b.max.x && max.x>=b.min.x && min.y<=b.max.y && max.y>=b.min.y && min.z<=b.max.z && max.z>=b.min.z) return true;
  }
  return false;
}

function shoot(){
  if(!locked || reloading) return;
  const now=performance.now();
  if(now-lastShot<fireRate) return;
  if(ammo<=0){ showCenter('RELOAD [R]',600); return; }
  lastShot=now; ammo--; updateHUD(); ensureAudio(); playGunshot(); spawnShell();
  spread = Math.min(0.04, spread+0.006);
  recoilY += 0.045 + Math.random()*0.02;
  recoilX += (Math.random()-0.5)*0.02;
  pitch += 0.008; pitch=Math.min(1.35,pitch);
  if(muzzleFlash){ muzzleFlash.material.opacity=1; muzzleLight.intensity=7; muzzleFlash.scale.set(0.38+Math.random()*0.16,0.38+Math.random()*0.16,1); setTimeout(()=>{ muzzleFlash.material.opacity=0; muzzleLight.intensity=0; }, 48); }
  weaponGroup.position.z += 0.09; weaponGroup.position.y -= 0.023;
  setTimeout(()=>{ weaponGroup.position.z-=0.09; weaponGroup.position.y+=0.023; }, 72);

  // hitscan
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  // add spread
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.normalize();
  raycaster.set(camera.position, dir);
  // test enemies first
  let hitEnemy=null, hitDist=Infinity, hitPoint=null, isHead=false;
  for(const e of enemies){
    if(!e.userData.alive) continue;
    // simple sphere checks: head and body
    const headWorld = e.position.clone().add(new THREE.Vector3(0,1.78,0));
    const bodyWorld = e.position.clone().add(new THREE.Vector3(0,1.05,0));
    const toHead = headWorld.clone().sub(camera.position);
    const projH = toHead.dot(dir); if(projH<0.3) continue;
    const closestH = camera.position.clone().addScaledVector(dir, projH);
    const dH = closestH.distanceTo(headWorld);
    if(dH<0.34 && projH<hitDist){ hitEnemy=e; hitDist=projH; hitPoint=closestH.clone(); isHead=true; }
    const toBody = bodyWorld.clone().sub(camera.position);
    const projB = toBody.dot(dir); if(projB<0.3) continue;
    const closestB = camera.position.clone().addScaledVector(dir, projB);
    const dB = closestB.distanceTo(bodyWorld);
    if(dB<0.48 && projB<hitDist && !isHead){ hitEnemy=e; hitDist=projB; hitPoint=closestB.clone(); }
  }
  // test world
  const worldHits = raycaster.intersectObjects(scene.children, true);
  // filter out weaponScene not in scene, but scene.children includes ground + colliders + enemies
  let worldDist = Infinity, worldPoint=null, worldNormal=null;
  for(const h of worldHits){
    if(h.object===ground || colliders.some(c=>h.object.parent && false)) {} // placeholder
    if(h.distance < worldDist && h.distance>0.11 && h.object!==ground){ /* keep as fallback */ }
    // we keep closest non-enemy hit
    if(h.distance < worldDist && h.distance>0.2){
      // ignore enemy meshes (they are in enemies groups)
      let isEnemyMesh=false;
      for(const e of enemies) if(h.object.parent===e || h.object===e){ isEnemyMesh=true; break; }
      // crude: check if object is part of enemies group via traversing parents
      let p=h.object; while(p){ if(enemies.includes(p)) { isEnemyMesh=true; break; } p=p.parent; }
      if(isEnemyMesh) continue;
      worldDist=h.distance; worldPoint=h.point.clone(); worldNormal=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize(): new THREE.Vector3(0,1,0);
      break;
    }
  }
  // also ground hit
  const groundHit = raycaster.intersectObject(ground);
  if(groundHit[0] && groundHit[0].distance < worldDist){ worldDist=groundHit[0].distance; worldPoint=groundHit[0].point.clone(); worldNormal=new THREE.Vector3(0,1,0); }

  const muzzleWorld = weaponGroup.userData.muzzle ? weaponGroup.userData.muzzle.getWorldPosition(new THREE.Vector3()) : camera.position.clone();
  if(hitEnemy && hitDist < worldDist){
    const dmg = isHead? 100 : 34;
    hitEnemy.userData.health -= dmg;
    hitFlashTime=performance.now(); playHit();
    hitmarker.classList.add('show'); setTimeout(()=>hitmarker.classList.remove('show'), 90);
    hitEnemy.position.addScaledVector(dir, 0.09);
    spawnTracer(muzzleWorld, hitPoint);
    spawnImpactParticles(hitPoint, isHead?0xff3333:0xcc2222);
    if(isHead) { showCenter('HEADSHOT', 500); score+=150; } else { score+=25; }
    if(hitEnemy.userData.health<=0){
      hitEnemy.userData.alive=false;
      const dead=hitEnemy; dead.userData.deathTime=performance.now();
      kills++; score+=100; showCenter('ELIMINATED', 600); addKillFeed((isHead?'HEADSHOT • ':'')+'ENEMY DOWN +100');
      const fall=setInterval(()=>{
        const t=(performance.now()-dead.userData.deathTime)/420; if(t>=1){ clearInterval(fall); dead.visible=false; setTimeout(()=>respawnEnemy(dead), 900); return; }
        dead.rotation.z = t*1.45; dead.position.y = -t*0.9; dead.scale.y = 1 - t*0.5;
      },16);
    }
    updateHUD();
  } else if(worldPoint){
    spawnTracer(muzzleWorld, worldPoint);
    spawnDecal(worldPoint, worldNormal);
    spawnImpactParticles(worldPoint, 0x8a8a8a);
    const tracer = new THREE.Mesh(new THREE.SphereGeometry(0.018,6,6), new THREE.MeshBasicMaterial({color:0xffaa44}));
    tracer.position.copy(worldPoint); scene.add(tracer); setTimeout(()=>scene.remove(tracer), 110);
  } else {
    const far=camera.position.clone().addScaledVector(dir, 60); spawnTracer(muzzleWorld, far);
  }
}

// Game state
let state='loading';
let timeLeft=180;
let lastTime=performance.now();

// Minimap draw
function drawMinimap(){
  const w=140,h=140;
  mapCtx.clearRect(0,0,w,h);
  mapCtx.fillStyle='#0a151c'; mapCtx.fillRect(0,0,w,h);
  // grid
  mapCtx.strokeStyle='rgba(255,255,255,0.06)'; mapCtx.lineWidth=1;
  for(let i=0;i<=7;i++){ mapCtx.beginPath(); mapCtx.moveTo(i*w/7,0); mapCtx.lineTo(i*w/7,h); mapCtx.stroke(); mapCtx.beginPath(); mapCtx.moveTo(0,i*h/7); mapCtx.lineTo(w,i*h/7); mapCtx.stroke(); }
  // walls
  mapCtx.fillStyle='rgba(100,110,120,0.9)';
  for(const b of colliders){
    const x = (b.min.x+45)/90*w, y = (b.min.z+42)/84*h, ww=(b.max.x-b.min.x)/90*w, hh=(b.max.z-b.min.z)/84*h;
    mapCtx.fillRect(x,y,Math.max(2,ww),Math.max(2,hh));
  }
  // enemies
  for(const e of enemies){
    if(!e.userData.alive) continue;
    const x=(e.position.x+45)/90*w, y=(e.position.z+42)/84*h;
    mapCtx.fillStyle='#ff3b3b'; mapCtx.beginPath(); mapCtx.arc(x,y,3,0,Math.PI*2); mapCtx.fill();
  }
  // player
  const px=(camera.position.x+45)/90*w, py=(camera.position.z+42)/84*h;
  mapCtx.fillStyle='#00ff88'; mapCtx.beginPath(); mapCtx.arc(px,py,4,0,Math.PI*2); mapCtx.fill();
  // dir
  mapCtx.strokeStyle='#00ff88'; mapCtx.lineWidth=2; mapCtx.beginPath(); mapCtx.moveTo(px,py); mapCtx.lineTo(px+Math.sin(yaw)*12, py - Math.cos(yaw)*12); mapCtx.stroke();
}

addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  weaponCamera.aspect=innerWidth/innerHeight; weaponCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Movement loop
let bobPhase=0;
function update(dt){
  if(state==='loading') return;
  if(!locked){ drawMinimap(); return; }

  // input
  sprinting = keys['ShiftLeft']||keys['ShiftRight'];
  isADS = keys['ControlLeft']||keys['ControlRight']|| (locked && false);
  const speed = sprinting? 5.2 : crouching? 1.8 : 3.4;
  const forward = new THREE.Vector3(Math.sin(yaw),0, Math.cos(yaw)).multiplyScalar(-1);
  const right = new THREE.Vector3(Math.sin(yaw+Math.PI/2),0, Math.cos(yaw+Math.PI/2));
  let move = new THREE.Vector3();
  if(keys['KeyW']) move.add(forward);
  if(keys['KeyS']) move.sub(forward);
  if(keys['KeyA']) move.sub(right);
  if(keys['KeyD']) move.add(right);
  if(move.lengthSq()>0){ move.normalize().multiplyScalar(speed*dt); }
  // gravity & jump
  if(keys['Space'] && onGround){ vel.y=5.1; onGround=false; }
  vel.y -= 14*dt;
  let next = camera.position.clone().add(move);
  next.y += vel.y*dt;
  // ground collision
  if(next.y < (crouching?crouchHeight:playerHeight)){
    next.y = crouching?crouchHeight:playerHeight; vel.y=0; onGround=true;
  } else onGround=false;
  // wall collision (XZ only)
  const tryPos = new THREE.Vector3(next.x, camera.position.y, next.z);
  if(collide(tryPos, 0.42)){
    // slide: try X only then Z only
    const tryX = new THREE.Vector3(next.x, camera.position.y, camera.position.z);
    const tryZ = new THREE.Vector3(camera.position.x, camera.position.y, next.z);
    if(!collide(tryX,0.42)) next.z = camera.position.z;
    else if(!collide(tryZ,0.42)) next.x = camera.position.x;
    else { next.x=camera.position.x; next.z=camera.position.z; }
  }
  camera.position.copy(next);
  // clamp inside arena
  camera.position.x = Math.max(-43, Math.min(43, camera.position.x));
  camera.position.z = Math.max(-40, Math.min(40, camera.position.z));

  // camera rotation
  camera.rotation.order='YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // weapon bob & sway
  const moving = move.lengthSq()>0.0001;
  if(moving) bobPhase += dt * (sprinting? 11 : 7);
  const bobY = Math.sin(bobPhase)* (moving? (sprinting?0.028:0.015):0);
  const bobX = Math.cos(bobPhase*0.5)* (moving? (sprinting?0.02:0.012):0);
  // weapon sway based on look
  const swayX = - (yaw - camera.rotation.y) * 0; // yaw already
  weaponGroup.position.x = 0.28 + bobX*0.3;
  weaponGroup.position.y = -0.22 + bobY + (crouching? -0.05:0) + (sprinting? -0.04:0);
  // ADS lerp
  const adsT = isADS? 1:0;
  weaponGroup.position.lerp(new THREE.Vector3(isADS?0.0:-0.0, isADS?-0.12:-0.22, isADS?-0.38:-0.55), 0.12);
  // recoil decay
  spread = Math.max(0, spread - dt*0.08);
  recoilY *= 0.86; recoilX *=0.86;
  // crosshair spread
  const sp = Math.round(spread*320);
  crosshair.style.transform = 'translate(-50%,-50%) scale('+(1+spread*10)+')';
  // enemy simple AI: move toward player slowly, strafe
  for(const e of enemies){
    if(!e.userData.alive) continue;
    const toPlayer = camera.position.clone().sub(e.position); toPlayer.y=0;
    const dist = toPlayer.length();
    if(dist>1.2 && dist<36){
      toPlayer.normalize().multiplyScalar(0.85*dt);
      const np = e.position.clone().add(toPlayer);
      if(!collide(new THREE.Vector3(np.x,1,np.z),0.45)) e.position.copy(np);
      e.lookAt(camera.position.x, e.position.y, camera.position.z);
    }
    // bob head slightly when far
    e.position.y = Math.sin(performance.now()*0.002 + e.position.x)*0.02;
  }

  // timer
  timeLeft -= dt; if(timeLeft<0) timeLeft=0;
  const mm=String(Math.floor(timeLeft/60)).padStart(2,'0'), ss=String(Math.floor(timeLeft%60)).padStart(2,'0');
  timeVal.textContent = mm+':'+ss;
  if(timeLeft<=0 && state==='playing'){ state='ended'; showCenter('EXERCISE COMPLETE', 4000); }

  // damage vignette fade
  if(performance.now()-damageTime<420) damageVig.classList.add('show'); else damageVig.classList.remove('show');
  if(performance.now()-hitFlashTime<120) crosshair.classList.add('hit'); else crosshair.classList.remove('hit');

  drawMinimap();
}

function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now-lastTime)/1000); lastTime=now;
  update(dt);
  // render main scene
  renderer.setClearColor(0x0a1420,1);
  renderer.render(scene, camera);
  // weapon overlay (clear depth, render on top)
  renderer.autoClear=false;
  renderer.clearDepth();
  weaponCamera.position.copy(camera.position);
  weaponCamera.quaternion.copy(camera.quaternion);
  // keep weaponCamera FOV sync but offset handled via weaponGroup
  renderer.render(weaponScene, camera);
  renderer.autoClear=true;
}
requestAnimationFrame(loop);

// Start
let assetsReady=false;
function tryStart(){
  if(weaponLoaded){
    setProgress(100,'OPERATION READY — CLICK TO DEPLOY');
    setTimeout(()=>{ loadingEl.style.opacity='0'; setTimeout(()=>loadingEl.style.display='none',600); state='playing'; }, 600);
    updateHUD(); drawMinimap();
  } else setTimeout(tryStart,100);
}
setTimeout(tryStart, 900);
setProgress(55,'AWAITING WEAPON...');

// Take damage if enemy too close (melee)
setInterval(()=>{
  if(!locked || state!=='playing') return;
  for(const e of enemies){
    if(!e.userData.alive) continue;
    if(e.position.distanceTo(camera.position)<1.4){
      health-= 18; damageTime=performance.now(); updateHUD();
      if(health<=0){ health=0; updateHUD(); showCenter('KIA — PRESS [R] TO REDEPLOY',2000); setTimeout(()=>{ health=100; camera.position.set(0,1.65,12); yaw=0; pitch=0; updateHUD(); },1200); }
      break;
    }
  }
}, 700);

// ADS right click
canvas.addEventListener('mousedown', e=>{ if(e.button===2) isADS=true; });
canvas.addEventListener('mouseup', e=>{ if(e.button===2) isADS=false; });
canvas.addEventListener('contextmenu', e=>e.preventDefault());

// Auto sprint FOV
let baseFov=74;
setInterval(()=>{
  const target = sprinting && (keys['KeyW']) ? 78 : isADS? 62 : 74;
  camera.fov += (target - camera.fov)*0.12; camera.updateProjectionMatrix();
  weaponCamera.fov = camera.fov; weaponCamera.updateProjectionMatrix();
},16);

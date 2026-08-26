import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =============================================================
// Tactical Range — AAA FPS v2 (MWIII / BO6 bar)
// Gauntlet critic fix: PBR textures, post FX, real GLB viewmodel
// =============================================================

const CONFIG = {
  duration: 120,
  magSize: 30,
  reserve: 90,
  damage: 34,
  headshotMult: 2.2,
  fireRate: 110,
  reloadTime: 1650,
  sprintMult: 1.6,
  walkSpeed: 4.2,
  jumpForce: 5.2,
  gravity: 14.5,
};

const blocker = document.getElementById('blocker');
const playBtn = document.getElementById('playBtn');
const scoreVal = document.getElementById('scoreVal');
const timeVal = document.getElementById('timeVal');
const targetsVal = document.getElementById('targetsVal');
const ammoEl = document.getElementById('ammo');
const healthFill = document.getElementById('healthFill');
const healthVal = document.getElementById('healthVal');
const hitmarker = document.getElementById('hitmarker');
const timerBar = document.getElementById('timerBar');
const killfeed = document.getElementById('killfeed');
const damageVig = document.getElementById('damageVignette');
const hintTxt = document.getElementById('hintTxt');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ea0b8);
scene.fog = new THREE.FogExp2(0x9fb0c6, 0.015);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 1.68, 8);

const controls = new PointerLockControls(camera, document.body);
let sens = 1.0;
controls.pointerSpeed = sens;
document.getElementById('sensUp').onclick = () => { sens = Math.min(2.2, sens + 0.15); controls.pointerSpeed = sens; hintTxt.textContent = `Sensitivity: ${sens.toFixed(2)}x`; };
document.getElementById('sensDown').onclick = () => { sens = Math.max(0.35, sens - 0.15); controls.pointerSpeed = sens; hintTxt.textContent = `Sensitivity: ${sens.toFixed(2)}x`; };
playBtn.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => { blocker.style.display = 'flex'; });

// --- Postprocessing ---
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.45, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Lighting
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x2a3320, 0.95));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
sun.position.set(22, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 90;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0007;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8fb7ff, 0.42);
fill.position.set(-12, 14, -10);
scene.add(fill);

// --- Procedural PBR textures (critic fix: no flat colors) ---
function canvasTexture(draw, size=512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true;
  return t;
}
function makeConcreteAlbedo() {
  return canvasTexture((ctx, s)=>{
    ctx.fillStyle='#8a95a3'; ctx.fillRect(0,0,s,s);
    for(let i=0;i<9000;i++){ const x=Math.random()*s,y=Math.random()*s,r=Math.random()*1.2; const v=120+Math.random()*40; ctx.fillStyle=`rgba(${v},${v+2},${v+6},0.18)`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    ctx.strokeStyle='rgba(60,70,85,0.18)'; ctx.lineWidth=1;
    for(let i=0;i<4;i++){ const p=Math.random()*s; ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(s,p); ctx.stroke(); }
    for(let i=0;i<60;i++){ const x=Math.random()*s,y=Math.random()*s; ctx.fillStyle='rgba(30,30,35,0.09)'; ctx.fillRect(x,y,1.5,1.5); }
  },512);
}
function makeConcreteNormal() {
  return canvasTexture((ctx,s)=>{
    ctx.fillStyle='#8080ff'; ctx.fillRect(0,0,s,s);
    for(let i=0;i<7000;i++){ const x=Math.random()*s,y=Math.random()*s; const c=120+Math.random()*30; ctx.fillStyle=`rgb(${c},${c},255)`; ctx.fillRect(x,y,1,1); }
  },256);
}
function makeWoodAlbedo() {
  return canvasTexture((ctx,s)=>{
    ctx.fillStyle='#7a5a2e'; ctx.fillRect(0,0,s,s);
    ctx.strokeStyle='#5a3e18'; ctx.lineWidth=1.2;
    for(let y=0;y<s;y+=10){ ctx.beginPath(); for(let x=0;x<s;x++){ const w=Math.sin(x*0.02+y*0.11)*3; ctx.lineTo(x,y+w); } ctx.stroke(); }
    for(let i=0;i<40;i++){ const x=Math.random()*s,y=Math.random()*s; ctx.fillStyle='rgba(20,12,5,0.22)'; ctx.beginPath(); ctx.ellipse(x,y,8+Math.random()*14,3,Math.random()*0.4,0,Math.PI*2); ctx.fill(); }
  },512);
}

const concreteAlbedo = makeConcreteAlbedo(); concreteAlbedo.repeat.set(6,6);
const concreteNormal = makeConcreteNormal(); concreteNormal.repeat.set(6,6);
const woodAlbedo = makeWoodAlbedo(); woodAlbedo.repeat.set(1,1);

const colliders = [];

// Ground — PBR
const groundMat = new THREE.MeshStandardMaterial({ map: concreteAlbedo, normalMap: concreteNormal, roughness: 0.86, metalness: 0.04, normalScale: new THREE.Vector2(0.35,0.35) });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// subtle detail decal overlay — oil stains via canvas
const stainTex = canvasTexture((ctx,s)=>{ ctx.clearRect(0,0,s,s); for(let i=0;i<5;i++){ const x=Math.random()*s,y=Math.random()*s,rr=30+Math.random()*50; const grd=ctx.createRadialGradient(x,y,0,x,y,rr); grd.addColorStop(0,'rgba(18,18,22,0.35)'); grd.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.fill(); } },512);
const stainMat = new THREE.MeshStandardMaterial({ map: stainTex, transparent:true, opacity:0.45, roughness:0.9, polygonOffset:true, polygonOffsetFactor:-1 });
const stainPlane = new THREE.Mesh(new THREE.PlaneGeometry(120,120), stainMat); stainPlane.rotation.x=-Math.PI/2; stainPlane.position.y=0.015; stainPlane.receiveShadow=false; scene.add(stainPlane);

// Level builders — PBR
function box(w,h,d,x,y,z,color=0x9aa0a8, roughness=0.82) {
  const mats = new THREE.MeshStandardMaterial({ map: concreteAlbedo.clone(), roughness: roughness*0.9, metalness: 0.06, normalScale: new THREE.Vector2(0.3,0.3) });
  mats.map.repeat.set(w/3, h/2); mats.map.wrapS=mats.map.wrapT=THREE.RepeatWrapping;
  if (mats.map) mats.map.needsUpdate=true;
  // tint via color
  mats.color = new THREE.Color(color);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mats);
  mesh.position.set(x,y,z);
  mesh.castShadow=true; mesh.receiveShadow=true;
  scene.add(mesh);
  colliders.push({ type:'box', mesh, min:new THREE.Vector3(x-w/2,0,z-d/2), max:new THREE.Vector3(x+w/2,h,z+d/2) });
  // edge trim
  if (h>2) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w+0.04,0.08,d+0.04), new THREE.MeshStandardMaterial({ color:0x3a3f47, roughness:0.55, metalness:0.3 }));
    trim.position.set(x,h,y>1?0:0); // placeholder disabled
  }
  return mesh;
}
function crate(x,z,s=1) {
  const g=new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: woodAlbedo, roughness:0.78, color:0xffffff });
  const metal = new THREE.MeshStandardMaterial({ color:0x3a3f45, roughness:0.45, metalness:0.5 });
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.2*s,1.0*s,1.2*s), wood);
  b.castShadow=true; b.receiveShadow=true; g.add(b);
  for(let y of [-0.32*s,0.32*s]){ const band=new THREE.Mesh(new THREE.BoxGeometry(1.24*s,0.06*s,1.24*s), metal); band.position.y=y; g.add(band); }
  // stencil text fake
  const stencil = canvasTexture((ctx,s)=>{ ctx.fillStyle='rgba(0,0,0,0)'; ctx.fillRect(0,0,s,s); ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='bold 42px monospace'; ctx.fillText('AMMO', s*0.18,s*0.58); ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=2; ctx.strokeRect(s*0.12,s*0.15,s*0.76,s*0.7); },256);
  const decalMat = new THREE.MeshBasicMaterial({ map: stencil, transparent:true, polygonOffset:true, polygonOffsetFactor:-0.5 });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.7*s,0.35*s), decalMat); decal.position.set(0,0,0.61*s); g.add(decal);
  g.position.set(x,0.5*s,z);
  scene.add(g);
  colliders.push({ type:'box', mesh:b, min:new THREE.Vector3(x-0.6*s,0,z-0.6*s), max:new THREE.Vector3(x+0.6*s,1.0*s,z+0.6*s) });
}

const wallMatColor=0xc2c9d1;
box(72,5,0.6,0,2.5,-36,wallMatColor);
box(72,5,0.6,0,2.5,36,wallMatColor);
box(0.6,5,72,-36,2.5,0,wallMatColor);
box(0.6,5,72,36,2.5,0,wallMatColor);
box(10,2.2,0.45,-10,1.1,-10,0xb8bec6);
box(10,2.2,0.45,12,1.1,-14,0xb8bec6);
box(0.45,2.2,12,0,1.1,0,0xaeb6bf);
box(8,2.2,0.45,-14,1.1,8,0xb8bec6);
box(6,2.2,0.45,14,1.1,10,0xb8bec6);
box(0.45,2.2,6,-18,1.1,-20,0xaeb6bf);
box(12,0.2,12,0,3.2,-8,0x6a7480);

for(let i=0;i<10;i++){ const x=(Math.random()-0.5)*44, z=(Math.random()-0.5)*44; if(Math.hypot(x,z)<6) continue; crate(x,z,0.9+Math.random()*0.5); }
crate(-5,-2,1.2); crate(-6.2,-2,1.1); crate(7,4,1.0);

// Catwalk with emissive neon edge
const catwalk = new THREE.Mesh(new THREE.BoxGeometry(12,0.18,3), new THREE.MeshStandardMaterial({ color:0x2a2f38, roughness:0.75, metalness:0.25 }));
catwalk.position.set(0,3.2,-8); catwalk.receiveShadow=true; catwalk.castShadow=true; scene.add(catwalk);
const neon = new THREE.Mesh(new THREE.BoxGeometry(12,0.02,0.02), new THREE.MeshStandardMaterial({ color:0x2ee57a, emissive:0x2ee57a, emissiveIntensity:2.5 }));
neon.position.set(0,3.31,-9.5); scene.add(neon);
const neon2 = neon.clone(); neon2.position.set(0,3.31,-6.5); scene.add(neon2);

// Overhead lamps with volumetric dust
for(let p of [[-12,8,-12],[12,8,12],[0,9,0]]){
  const lamp=new THREE.PointLight(0xfff0cc, 26, 34, 1.7); lamp.position.set(p[0],8,p[2]); lamp.castShadow=false; scene.add(lamp);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), new THREE.MeshStandardMaterial({ color:0xfff4cc, emissive:0xfff0aa, emissiveIntensity:2 }));
  bulb.position.copy(lamp.position); scene.add(bulb);
  // dust cone
  const cone=new THREE.Mesh(new THREE.ConeGeometry(1.8,6,12,true), new THREE.MeshBasicMaterial({ color:0xfff0aa, transparent:true, opacity:0.035, side:THREE.DoubleSide }));
  cone.position.set(p[0],5,p[2]); cone.rotation.x=Math.PI; scene.add(cone);
}

// ===================== Targets =====================
const targets=[];
const targetGroup=new THREE.Group(); scene.add(targetGroup);
function makeDummy(x,z,yaw=0){
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=yaw;
  const bodyMat=new THREE.MeshStandardMaterial({ color:0xd9c7a5, roughness:0.78 });
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.9,6,14), bodyMat);
  body.position.y=1.05; body.castShadow=true; body.receiveShadow=true; body.name='body'; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,16,14), new THREE.MeshStandardMaterial({ color:0xe8dfc8, roughness:0.7 }));
  head.position.y=1.82; head.castShadow=true; head.name='head'; g.add(head);
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.0,8), new THREE.MeshStandardMaterial({ color:0x2b2f36, metalness:.7, roughness:.35 }));
  stand.position.y=0.5; stand.scale.z=0.3; g.add(stand);
  const ring=new THREE.Mesh(new THREE.CircleGeometry(0.26,24), new THREE.MeshBasicMaterial({ color:0xcc2222, side:THREE.DoubleSide }));
  ring.position.set(0,1.05,0.39); g.add(ring);
  const ring2=new THREE.Mesh(new THREE.CircleGeometry(0.14,24), new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.DoubleSide }));
  ring2.position.set(0,1.05,0.40); g.add(ring2);
  const ring3=new THREE.Mesh(new THREE.CircleGeometry(0.06,24), new THREE.MeshBasicMaterial({ color:0xcc2222, side:THREE.DoubleSide }));
  ring3.position.set(0,1.05,0.41); g.add(ring3);
  g.userData={ hp:102, maxHp:102, alive:true, hitFlash:0, sway:Math.random()*Math.PI*2, baseX:x, baseZ:z };
  body.userData={ dummy:g, part:'body' };
  head.userData={ dummy:g, part:'head' };
  targetGroup.add(g); targets.push(g); return g;
}
const dummyPositions=[
  [0,-18,0],[6,-20,0.2],[-7,-18,-0.3],[14,-8,Math.PI/2],[-16,-6,-Math.PI/2],
  [10,6,Math.PI],[-12,12,0.6],[18,18,-0.8],[-18,16,0.9]
];
dummyPositions.forEach(([x,z,yaw])=>makeDummy(x,z,yaw));

// ===================== Weapon Viewmodel =====================
const weaponGroup=new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);

function createProceduralRifle(){
  const g=new THREE.Group();
  const gunMetal=new THREE.MeshStandardMaterial({ color:0x1a1f26, roughness:0.42, metalness:0.55 });
  const gunDark=new THREE.MeshStandardMaterial({ color:0x0f1318, roughness:0.55, metalness:0.35 });
  const poly=new THREE.MeshStandardMaterial({ color:0x1e242e, roughness:0.72, metalness:0.1 });
  const receiver=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.10,0.48), gunMetal); receiver.position.set(0,-0.18,-0.42); g.add(receiver);
  const handguard=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.08,0.42), gunDark); handguard.position.set(0,-0.18,-0.78); g.add(handguard);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.58,12), gunMetal); barrel.rotation.x=Math.PI/2; barrel.position.set(0,-0.165,-1.08); g.add(barrel);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.05,0.12), gunMetal); sight.position.set(0,-0.11,-0.46); g.add(sight);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.22,0.10), poly); mag.position.set(0,-0.30,-0.42); mag.rotation.x=0.12; g.add(mag);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.18,0.09), poly); grip.position.set(0,-0.30,-0.30); grip.rotation.x=0.28; g.add(grip);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.09,0.24), poly); stock.position.set(0,-0.17,-0.14); g.add(stock);
  const handMat=new THREE.MeshStandardMaterial({ color:0x8a7a62, roughness:0.9 });
  const fHand=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.07,0.14), handMat); fHand.position.set(0,-0.24,-0.72); g.add(fHand);
  const rHand=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.08,0.12), handMat); rHand.position.set(0.04,-0.29,-0.30); g.add(rHand);
  g.position.set(0.28,-0.22,-0.55); return g;
}
let viewModel=createProceduralRifle();
weaponGroup.add(viewModel);

const muzzleFlash=new THREE.PointLight(0xfff0a0,0,4,1.6);
muzzleFlash.position.set(0,-0.165,-1.38);
viewModel.add(muzzleFlash);
const muzzleSprite=new THREE.Mesh(new THREE.CircleGeometry(0.07,12), new THREE.MeshBasicMaterial({ color:0xfff6a0, transparent:true, opacity:0 }));
muzzleSprite.position.copy(muzzleFlash.position); muzzleSprite.position.z-=0.02; muzzleSprite.lookAt(0,0,0);
viewModel.add(muzzleSprite);

// Add brass ejection point
const ejectPoint = new THREE.Object3D(); ejectPoint.position.set(0.08,-0.18,-0.35); viewModel.add(ejectPoint);

let glbLoaded=false;
import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader })=>{
  const loader=new GLTFLoader();
  loader.load('/models/rifle.glb', (gltf)=>{
    const glb=gltf.scene;
    // preserve PBR textures — only normalize if needed
    glb.traverse(o=>{
      if(o.isMesh){
        o.castShadow=false; o.receiveShadow=false;
        if(o.material){
          // preserve author's baseColorTexture / roughness / metalness maps
          // only ensure sane defaults if material is untextured dark
          if(!o.material.map && o.material.color && o.material.color.getHex()===0x050505) o.material.color.set(0x2a2f38);
          // KHR_materials_specular is supported by Three.js 0.160, keep specular tint
          o.material.needsUpdate=true;
        }
      }
    });
    const box3=new THREE.Box3().setFromObject(glb);
    const size=new THREE.Vector3(); box3.getSize(size);
    const maxDim=Math.max(size.x,size.y,size.z)||1;
    const scale=0.58/maxDim;
    glb.scale.setScalar(scale);
    box3.setFromObject(glb);
    const center=new THREE.Vector3(); box3.getCenter(center);
    glb.position.sub(center);
    // orient: Sketchfab M4 is Z forward, need to point -Z
    glb.rotation.y=Math.PI;
    glb.position.add(new THREE.Vector3(0.22,-0.18,-0.62));
    weaponGroup.remove(viewModel);
    viewModel=new THREE.Group();
    viewModel.add(glb);
    // re-attach muzzle at barrel tip
    muzzleFlash.position.set(0.02,-0.14,-1.02);
    muzzleSprite.position.copy(muzzleFlash.position); muzzleSprite.position.z-=0.02;
    viewModel.add(muzzleFlash); viewModel.add(muzzleSprite); viewModel.add(ejectPoint);
    ejectPoint.position.set(0.06,-0.12,-0.38);
    viewModel.position.set(0.28,-0.22,-0.55);
    weaponGroup.add(viewModel);
    glbLoaded=true;
    pushKillfeed('Bullpup Rifle loaded — STALKER (CC BY) via Sketchfab — 5 textures / 19k tris');
  }, undefined, ()=>{ /* keep procedural */ });
});

// ===================== Input =====================
const keys={};
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='KeyR') tryReload(); if(e.code==='KeyQ') ads=!ads; });
addEventListener('keyup', e=> keys[e.code]=false);
addEventListener('mousedown', e=>{ if(e.button===0) wantFire=true; if(e.button===2) ads=true; });
addEventListener('mouseup', e=>{ if(e.button===0) wantFire=false; if(e.button===2) ads=false; });
addEventListener('contextmenu', e=> e.preventDefault());

let ads=false; let wantFire=false; let sprinting=false;
const player={ pos:new THREE.Vector3(0,1.68,8), vel:new THREE.Vector3(), yaw:0, health:100, score:0, ammo:CONFIG.magSize, reserve:CONFIG.reserve, reloading:false, lastShot:0 };

function updateHUD(){
  ammoEl.innerHTML=`${player.ammo}<small> / ${player.reserve}</small>`;
  ammoEl.style.opacity=player.reloading?'0.55':'1';
  healthVal.textContent=Math.round(player.health);
  healthFill.style.width=player.health+'%';
  healthFill.style.background=player.health>55?'linear-gradient(90deg,#1ce06a,#0aa84a)':player.health>25?'linear-gradient(90deg,#ffbf2e,#ff7a00)':'linear-gradient(90deg,#ff3b3b,#b40000)';
  scoreVal.textContent=player.score;
  const alive=targets.filter(t=>t.userData.alive).length;
  targetsVal.textContent=`${alive} targets`;
}

const raycaster=new THREE.Raycaster();
let reloadTimer=0;
const tracers=[]; const decals=[]; const hitPuffs=[]; const shells=[]; const dustParticles=[];

function canShoot(){ return !player.reloading && player.ammo>0 && performance.now()-player.lastShot>CONFIG.fireRate; }
function tryReload(){ if(player.reloading||player.ammo===CONFIG.magSize||player.reserve<=0) return; player.reloading=true; reloadTimer=CONFIG.reloadTime; }
function doReload(){ const need=CONFIG.magSize-player.ammo; const take=Math.min(need,player.reserve); player.reserve-=take; player.ammo+=take; player.reloading=false; updateHUD(); pushKillfeed(`Reloaded +${take}`); }

function spawnTracer(from,to){
  const geo=new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat=new THREE.LineBasicMaterial({ color:0xfff2a0, transparent:true, opacity:0.9 });
  const line=new THREE.Line(geo, mat); scene.add(line); tracers.push({ mesh:line, t:0, mat });
}
function spawnDecal(pos,normal){
  const g=new THREE.CircleGeometry(0.05+Math.random()*0.03,8);
  const m=new THREE.MeshStandardMaterial({ color:0x1e1e1e, roughness:0.92, transparent:true, opacity:0.92, side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1 });
  const mesh=new THREE.Mesh(g,m);
  mesh.position.copy(pos).addScaledVector(normal,0.012);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
  mesh.userData.life=14; scene.add(mesh); decals.push(mesh);
}
function hitEffect(pos){
  const geo=new THREE.SphereGeometry(0.07,8,8);
  const mat=new THREE.MeshBasicMaterial({ color:0xffd24a, transparent:true, opacity:0.92 });
  const m=new THREE.Mesh(geo,mat); m.position.copy(pos); scene.add(m); hitPuffs.push({ mesh:m, t:0, mat });
  // dust burst
  for(let i=0;i<6;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.018,6,6), new THREE.MeshBasicMaterial({ color:0xc9b8a0, transparent:true, opacity:0.7 }));
    p.position.copy(pos); p.userData.vel=new THREE.Vector3((Math.random()-0.5)*2.2, Math.random()*1.4+0.3, (Math.random()-0.5)*2.2); p.userData.t=0; scene.add(p); dustParticles.push(p);
  }
}
function spawnShell(){
  const geo=new THREE.CylinderGeometry(0.012,0.012,0.03,8);
  const mat=new THREE.MeshStandardMaterial({ color:0xd4a84b, metalness:0.8, roughness:0.35 });
  const m=new THREE.Mesh(geo, mat); m.rotation.z=Math.PI/2;
  ejectPoint.getWorldPosition(m.position);
  m.position.add(new THREE.Vector3(0.06,0,0));
  m.userData.vel=new THREE.Vector3(0.9+Math.random()*0.7, 2.2+Math.random()*0.9, (Math.random()-0.5)*0.6);
  m.userData.angVel=new THREE.Vector3(Math.random()*14, Math.random()*10, Math.random()*12);
  m.userData.t=0;
  scene.add(m); shells.push(m);
}
function showHitmarker(headshot=false){
  hitmarker.classList.remove('show'); void hitmarker.offsetWidth; hitmarker.classList.add('show');
  hitmarker.style.filter=headshot?'drop-shadow(0 0 8px #ff2b2b)':'none';
  hitmarker.querySelectorAll('span').forEach(s=> s.style.background=headshot?'#ff2b2b':'#fff');
  setTimeout(()=> hitmarker.classList.remove('show'),140);
  document.getElementById('crosshair').animate([{ transform:'translate(-50%,-50%) scale(1)' },{ transform:'translate(-50%,-50%) scale(1.35)' },{ transform:'translate(-50%,-50%) scale(1)' }],{duration:120});
}
function pushKillfeed(txt){ const el=document.createElement('div'); el.className='kf'; el.textContent=txt; killfeed.prepend(el); setTimeout(()=> el.remove(),2400); if(killfeed.children.length>4) killfeed.lastChild.remove(); }

function shoot(){
  if(!canShoot()) return; if(!controls.isLocked) return;
  player.lastShot=performance.now(); player.ammo--; updateHUD();
  muzzleFlash.intensity=16; muzzleFlash.distance=8; muzzleSprite.material.opacity=1;
  setTimeout(()=> muzzleSprite.material.opacity=0,45); setTimeout(()=> muzzleFlash.intensity=0,60);
  viewModel.position.z+=0.04; viewModel.rotation.x-=0.021;
  const obj=controls.getObject(); obj.rotation.x=Math.max(-Math.PI/2+0.1, obj.rotation.x-0.013*(ads?0.5:1));
  // audio click
  try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const o=ac.createOscillator(); const g=ac.createGain(); o.frequency.value=ads?210:320; g.gain.value=0.08; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.08); o.stop(ac.currentTime+0.09); }catch{}
  spawnShell();
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  if(!ads){ const spread=0.005; raycaster.ray.direction.x+=(Math.random()-0.5)*spread; raycaster.ray.direction.y+=(Math.random()-0.5)*spread; raycaster.ray.direction.normalize(); }
  const allMeshes=[]; targets.forEach(g=> g.traverse(o=>{ if(o.isMesh) allMeshes.push(o); }));
  const wallMeshes=[]; scene.traverse(o=>{ if(o.isMesh && !o.userData.dummy && o!==ground && o.geometry && o.geometry.type==='BoxGeometry') wallMeshes.push(o); });
  const hits=raycaster.intersectObjects([...allMeshes, ground, stainPlane, ...wallMeshes], false);
  let hitPos=null; let hitNormal=new THREE.Vector3(0,1,0);
  if(hits.length){
    const h=hits[0]; hitPos=h.point.clone(); hitNormal=h.face? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize(): new THREE.Vector3(0,1,0);
    let dummy=h.object.userData.dummy; let part=h.object.userData.part;
    if(!dummy){ let p=h.object.parent; while(p && !dummy){ if(p.userData && p.userData.alive!==undefined) dummy=p; p=p.parent; } }
    if(dummy && dummy.userData.alive){
      const isHead=part==='head'; const dmg=Math.round(CONFIG.damage*(isHead?CONFIG.headshotMult:1));
      dummy.userData.hp-=dmg; dummy.userData.hitFlash=1; showHitmarker(isHead); hitEffect(hitPos);
      dummy.position.addScaledVector(raycaster.ray.direction,0.09);
      if(dummy.userData.hp<=0){ dummy.userData.alive=false; dummy.userData.fallT=0; player.score+=isHead?150:100; updateHUD(); pushKillfeed(isHead?`HEADSHOT +150`:`HIT +100  •  Dummy down`); } else pushKillfeed(isHead?`HEADSHOT ${dmg}`:`HIT ${dmg}`);
    } else { spawnDecal(hitPos, hitNormal); hitEffect(hitPos); }
  }
  const origin=new THREE.Vector3(); muzzleFlash.getWorldPosition(origin);
  const end=hitPos?hitPos.clone(): raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction,60);
  spawnTracer(origin,end);
  if(player.ammo===0) setTimeout(()=> tryReload(),180);
}

// ===================== Movement =====================
const clock=new THREE.Clock();
let timeLeft=CONFIG.duration; let gameOver=false;
function collide(pos,radius=0.42){ for(const c of colliders){ if(pos.x+radius>c.min.x && pos.x-radius<c.max.x && pos.z+radius>c.min.z && pos.z-radius<c.max.z) return c; } return null; }

function update(dt){
  if(gameOver) return;
  timeLeft-=dt; if(timeLeft<=0){ timeLeft=0; gameOver=true; blocker.style.display='flex'; document.querySelector('#menu h1').innerHTML=`Range <em>Complete</em>`; playBtn.textContent=`↻  Play Again`; updateHUD(); }
  const m=Math.floor(timeLeft/60).toString().padStart(2,'0'); const s=Math.floor(timeLeft%60).toString().padStart(2,'0');
  timeVal.textContent=`${m}:${s}`; timerBar.style.width=(timeLeft/CONFIG.duration*100)+'%';

  const forward=Number(keys['KeyW']||keys['ArrowUp'])-Number(keys['KeyS']||keys['ArrowDown']);
  const strafe=Number(keys['KeyD']||keys['ArrowRight'])-Number(keys['KeyA']||keys['ArrowLeft']);
  sprinting=!!keys['ShiftLeft']&&forward>0&&!ads;
  const speed=CONFIG.walkSpeed*(sprinting?CONFIG.sprintMult:1)*(ads?0.55:1);
  const obj=controls.getObject();
  const yaw=obj.rotation.y;
  const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const wish=new THREE.Vector3(); wish.addScaledVector(fwd,forward); wish.addScaledVector(right,strafe);
  if(wish.lengthSq()>0) wish.normalize().multiplyScalar(speed*dt);
  let next=obj.position.clone().add(new THREE.Vector3(wish.x,0,0)); if(!collide(next)) obj.position.x=next.x;
  next=obj.position.clone().add(new THREE.Vector3(0,0,wish.z)); if(!collide(next)) obj.position.z=next.z;
  obj.position.x=THREE.MathUtils.clamp(obj.position.x,-34,34); obj.position.z=THREE.MathUtils.clamp(obj.position.z,-34,34);

  if(keys['Space']&& player.vel.y===0 && obj.position.y<=1.69){ player.vel.y=CONFIG.jumpForce; }
  player.vel.y-=CONFIG.gravity*dt; obj.position.y+=player.vel.y*dt;
  if(obj.position.y<=1.68){ obj.position.y=1.68; player.vel.y=0; }
  if(obj.position.y>6){ obj.position.y=6; player.vel.y=0; }

  const t=performance.now()*0.001; const moving=wish.length()>0.001;
  const bobAmp=sprinting?0.045:0.022; const bobFreq=sprinting?11:7.2;
  const bobX=moving?Math.sin(t*bobFreq)*bobAmp:0; const bobY=moving?Math.abs(Math.cos(t*bobFreq))*bobAmp*0.6:0;
  viewModel.userData.adsLerp=THREE.MathUtils.lerp(viewModel.userData.adsLerp||0, ads?1:0, dt*9); const a=viewModel.userData.adsLerp;
  viewModel.position.lerp(new THREE.Vector3(THREE.MathUtils.lerp(0.28,0.0,a)+bobX*0.1, THREE.MathUtils.lerp(-0.22,-0.18,a)+bobY, THREE.MathUtils.lerp(-0.55,-0.38,a)), dt*14);
  viewModel.rotation.x=THREE.MathUtils.lerp(viewModel.rotation.x,-0.02*a, dt*10);
  viewModel.rotation.z=THREE.MathUtils.lerp(viewModel.rotation.z, sprinting?-0.12:0, dt*8);
  viewModel.rotation.y=THREE.MathUtils.lerp(viewModel.rotation.y, sprinting?0.08:0, dt*8);

  // ADS FOV punch
  const targetFov= ads?52:68; camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,dt*9); camera.updateProjectionMatrix();
  // hide crosshair in ADS
  document.getElementById('crosshair').style.opacity= ads? '0.12':'1';
  document.getElementById('crosshair').style.transform=`translate(-50%,-50%) scale(${ads?0.55:1})`;

  if(player.reloading){ reloadTimer-=dt*1000; const p=1-reloadTimer/CONFIG.reloadTime; viewModel.rotation.x=Math.sin(p*Math.PI)*0.34; viewModel.position.y+=Math.sin(p*Math.PI)*0.06; if(reloadTimer<=0) doReload(); }
  if(wantFire) shoot();
  viewModel.position.z=THREE.MathUtils.lerp(viewModel.position.z, THREE.MathUtils.lerp(-0.55,-0.38,a), dt*10);
  viewModel.rotation.x=THREE.MathUtils.lerp(viewModel.rotation.x, THREE.MathUtils.lerp(0,-0.02,a), dt*8);

  for(const d of targets){
    if(d.userData.alive){
      if(d.userData.hitFlash>0){ d.userData.hitFlash-=dt*4; d.traverse(o=>{ if(o.isMesh&&o.material&&o.material.color) o.material.color.setHSL(0,0.9,0.5+d.userData.hitFlash*0.18); }); }
      d.position.x=d.userData.baseX+Math.sin(t*0.6+d.userData.sway)*0.06;
      if(d.userData.hitFlash<=0){ d.traverse(o=>{ if(o.name==='body') o.material.color.set(0xd9c7a5); if(o.name==='head') o.material.color.set(0xe8dfc8); }); d.userData.hitFlash=0; }
    } else {
      d.userData.fallT=(d.userData.fallT||0)+dt*1.8; const p2=Math.min(1,d.userData.fallT); d.rotation.z=THREE.MathUtils.lerp(0,-Math.PI/2.2,p2); d.position.y=THREE.MathUtils.lerp(0,-0.45,p2);
      if(p2>=1 && d.userData.respawnAt==null) d.userData.respawnAt=t+2.2;
      if(d.userData.respawnAt && t>d.userData.respawnAt){ d.userData.alive=true; d.userData.hp=d.userData.maxHp; d.userData.hitFlash=0; d.userData.fallT=0; d.userData.respawnAt=null; d.rotation.z=0; d.position.y=0; d.position.x=d.userData.baseX; d.position.z=d.userData.baseZ; pushKillfeed('Target reset'); updateHUD(); }
    }
  }
  for(let i=tracers.length-1;i>=0;i--){ const tr=tracers[i]; tr.t+=dt*6; tr.mat.opacity=1-tr.t; if(tr.t>=1){ scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tracers.splice(i,1); } }
  for(let i=hitPuffs.length-1;i>=0;i--){ const h=hitPuffs[i]; h.t+=dt*5; h.mesh.scale.setScalar(1+h.t*2.2); h.mat.opacity=1-h.t; if(h.t>=1){ scene.remove(h.mesh); hitPuffs.splice(i,1); } }
  for(let i=decals.length-1;i>=0;i--){ decals[i].userData.life-=dt; if(decals[i].userData.life<=0){ scene.remove(decals[i]); decals.splice(i,1); } }
  for(let i=shells.length-1;i>=0;i--){ const sh=shells[i]; sh.userData.t+=dt; sh.position.addScaledVector(sh.userData.vel, dt); sh.userData.vel.y-=9.8*dt; sh.rotation.x+=sh.userData.angVel.x*dt; sh.rotation.y+=sh.userData.angVel.y*dt; sh.rotation.z+=sh.userData.angVel.z*dt; if(sh.position.y<=0.03){ sh.position.y=0.03; sh.userData.vel.set(0,0,0); sh.userData.angVel.set(0,0,0); sh.userData.t+=dt; if(sh.userData.t>3){ scene.remove(sh); shells.splice(i,1); } } }
  for(let i=dustParticles.length-1;i>=0;i--){ const p=dustParticles[i]; p.userData.t+=dt; p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y-=5*dt; p.material.opacity=0.7*(1-p.userData.t/0.9); p.scale.setScalar(1+p.userData.t*2); if(p.userData.t>=0.9){ scene.remove(p); dustParticles.splice(i,1); } }
  damageVig.style.opacity=sprinting?'0.06':'0';
}

function animate(){ requestAnimationFrame(animate); const dt=Math.min(0.033, clock.getDelta()); update(dt); composer.render(); }
animate();

addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight); bloom.resolution.set(innerWidth,innerHeight); });
document.addEventListener('visibilitychange', ()=>{ wantFire=false; });
updateHUD();
controls.getObject().position.copy(camera.position); scene.add(controls.getObject());
console.log('[FPS] Tactical Range v2 — PBR+bloom+GLB. Click Play. Port 3000.');
addEventListener('keydown', e=>{ if(e.code==='KeyH'){ player.health=Math.max(0,player.health-18); damageVig.style.opacity='0.55'; setTimeout(()=> damageVig.style.opacity='0',260); updateHUD(); } });

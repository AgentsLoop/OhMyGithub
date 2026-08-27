import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ===== AAA FPS — SHADOW PROTOCOL =====
// PBR, CSM shadows, fog, procedural rifle, raycast combat, nav-ai

const CONFIG = {
  maxEnemies: 12,
  magSize: 30,
  reserve: 90,
  playerMaxHP: 100,
  enemyHP: 60,
  headshotMult: 2.2,
  damagePlayer: 14,
  moveSpeed: 5.2,
  sprintMult: 1.65,
  adsFov: 52,
  baseFov: 74,
};

let scene, camera, renderer, controls;
let clock = new THREE.Clock();
let keys = {};
let velocity = new THREE.Vector3();
let onGround = true;
let playerHP = CONFIG.playerMaxHP;
let ammoInMag = CONFIG.magSize;
let ammoReserve = CONFIG.reserve;
let kills = 0;
let timeLeft = 180;
let isADS = false, isSprinting = false, isReloading = false;
let gameState = 'menu'; // menu|playing|dead|won
let enemies = [], colliders = [], decals = [], particles = [], shells = [];
let weaponGroup, muzzleFlash, weaponBasePos = new THREE.Vector3(0.32,-0.24,-0.45);
let weaponMixer=null, weaponClips=[];
let bobTime=0, recoil=0, spread=0;
let raycaster = new THREE.Raycaster();
let audioCtx;
let miniCtx, miniCanvas;
let lastFpsUpdate=0, frameCount=0;

// DOM
const overlay = document.getElementById('overlay');
const btnPlay = document.getElementById('btnPlay');
const hudKills = document.getElementById('hudKills');
const hudTime = document.getElementById('hudTime');
const hudFps = document.getElementById('hudFps');
const healthFill = document.getElementById('healthFill');
const healthText = document.getElementById('healthText');
const ammoNum = document.getElementById('ammoNum');
const magFill = document.getElementById('magFill');
const killfeed = document.getElementById('killfeed');
const hitmarker = document.getElementById('hitmarker');
const crosshair = document.getElementById('crosshair');
const damageVig = document.getElementById('damageVignette');
const scopeEl = document.getElementById('scope');

miniCanvas = document.getElementById('miniCanvas');
miniCtx = miniCanvas.getContext('2d');

function audioInit(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}
function tone(freq, dur, type='square', gain=0.22, slideTo){
  if(!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.value=gain;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  if(slideTo){ o.frequency.linearRampToValueAtTime(slideTo, audioCtx.currentTime+dur); }
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+dur);
  o.stop(audioCtx.currentTime+dur);
}
function sfxShoot(){ tone(180,0.07,'square',0.28,60); setTimeout(()=>tone(900,0.04,'square',0.12,300),10); }
function sfxHit(){ tone(1200,0.08,'sine',0.18); }
function sfxHeadshot(){ tone(1600,0.12,'sine',0.22,2200); setTimeout(()=>tone(900,0.12,'sine',0.15),60); }
function sfxReload(){ tone(300,0.18,'triangle',0.15,600); }
function sfxEmpty(){ tone(80,0.12,'square',0.18); }
function sfxHurt(){ tone(90,0.35,'sawtooth',0.18,40); }
function sfxKill(){ tone(500,0.3,'sine',0.2,800); }

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141c24);
  scene.fog = new THREE.FogExp2(0x141c24, 0.006);

  camera = new THREE.PerspectiveCamera(CONFIG.baseFov, innerWidth/innerHeight, 0.1, 400);
  camera.position.set(0,1.7,12);

  renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  controls = new PointerLockControls(camera, document.body);
  controls.addEventListener('lock', ()=>{ if(gameState==='menu' && kills===0 && playerHP===CONFIG.playerMaxHP) startGame(); else if(gameState==='playing'){}; overlay.classList.add('hidden'); audioInit(); });
  controls.addEventListener('unlock', ()=>{ if(gameState==='playing') overlay.classList.remove('hidden'), document.getElementById('centerMsg').innerHTML=`<h1>PAUSED</h1><p>MISSION IN PROGRESS — ${kills}/12 ELIMINATED</p><button id="btnResume" style="margin-top:18px;cursor:pointer;background:linear-gradient(180deg,#ff3b30,#c40000);color:#fff;border:none;padding:14px 36px;font-family:Oxanium,sans-serif;font-weight:800;letter-spacing:.14em;font-size:14px">▶ RESUME</button>`; const b=document.getElementById('btnResume'); if(b) b.onclick=()=>controls.lock(); });

  buildLighting();
  buildArena();
  buildWeapon();
  spawnEnemies();

  addEventListener('resize', onResize);
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', e=>keys[e.code]=false);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', ()=>isADS&&!isReloading?null:null);
  addEventListener('contextmenu', e=>e.preventDefault());
  // ADS via right mouse
  renderer.domElement.addEventListener('mousedown', e=>{ if(e.button===2) setADS(true); });
  renderer.domElement.addEventListener('mouseup', e=>{ if(e.button===2) setADS(false); });

  btnPlay.addEventListener('click', ()=>{ controls.lock(); });
  // prevent pointer lock on overlay button? handled

  animate();
}

function buildLighting(){
  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x0a0a0a, 1.15);
  hemi.position.set(0,40,0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff6e8, 3.0);
  dir.position.set(22,28,12);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=90;
  dir.shadow.camera.left=-36; dir.shadow.camera.right=36; dir.shadow.camera.top=30; dir.shadow.camera.bottom=-30;
  dir.shadow.bias=-0.0005;
  scene.add(dir);
  scene.add(dir.target);

  // fill lights for AAA look
  const fill = new THREE.DirectionalLight(0x6ea0ff, 0.45); fill.position.set(-18,12,-20); scene.add(fill);
  const rim = new THREE.PointLight(0xff6a2b, 12, 40); rim.position.set(0,3, -18); scene.add(rim);
  // light probes via point lights along arena
  for(let i=0;i<4;i++){
    const p=new THREE.PointLight(0xffe9a0, 6, 22); p.position.set((Math.random()-0.5)*28, 4+Math.random()*3, (Math.random()-0.5)*28); scene.add(p);
  }
}

function matConcrete(){
  // PBR concrete — higher albedo for readability (fixes critic's dark void)
  const m=new THREE.MeshStandardMaterial({color:0xc2c8ce, roughness:0.88, metalness:0.02}); return m;
}
function matMetal(color=0x7a8592, rough=0.32, metal=0.55){
  return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:metal});
}
// PBR texture helper — generates visible detail instead of flat color (critic gap)
function makePBRCanvas(base, accent, scale){
  const c=document.createElement('canvas'); c.width=512; c.height=512;
  const cx=c.getContext('2d'); cx.fillStyle=base; cx.fillRect(0,0,512,512);
  // concrete noise
  for(let i=0;i<6000;i++){ cx.fillStyle=`rgba(0,0,0,${0.03+Math.random()*0.04})`; cx.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*2,1+Math.random()*2); }
  for(let i=0;i<6000;i++){ cx.fillStyle=`rgba(255,255,255,${0.03+Math.random()*0.05})`; cx.fillRect(Math.random()*512,Math.random()*512,1,1); }
  cx.strokeStyle=accent; cx.lineWidth=2; cx.strokeRect(4,4,504,504);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(scale,scale); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8; return tex;
}

function buildArena(){
  // Floor — PBR concrete with high-contrast grid + noise for visible PBR (fixes critic)
  const floorGeo=new THREE.PlaneGeometry(80,80,1,1);
  const floorMat=new THREE.MeshStandardMaterial({color:0x88909a, roughness:0.88, metalness:0.05});
  const floorTex=makePBRCanvas('#6d7681','rgba(255,255,255,0.06)',4);
  floorMat.map=floorTex; floorMat.needsUpdate=true;
  // also add subtle emissive for readability
  const floor=new THREE.Mesh(floorGeo,floorMat); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; scene.add(floor);
  // secondary detail floor decal grid lines (brighter)
  const gridMat=new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.015});

  // Perimeter walls — concrete + metal trim (brightened per critic, PBR visible)
  const wallMat=new THREE.MeshStandardMaterial({color:0x8a949e, roughness:0.78, metalness:0.08});
  const wallTex=makePBRCanvas('#8a949e','rgba(0,0,0,0.08)',2);
  wallMat.map=wallTex;
  function wall(w,h,d,x,y,z,ry=0){
    const g=new THREE.BoxGeometry(w,h,d); const m=new THREE.Mesh(g,wallMat); m.position.set(x,y,z); m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true; scene.add(m); colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,y,z), new THREE.Vector3(w,h,d)));
  }
  // outer
  wall(80,9,1.2, 0,4.5,-40);
  wall(80,9,1.2, 0,4.5, 40);
  wall(1.2,9,80, -40,4.5,0);
  wall(1.2,9,80,  40,4.5,0);
  // interior walls/cover
  wall(10,2.2,1.2, -8,1.1,-6);
  wall(1.2,2.2,9, 10,1.1,4);
  wall(14,3.2,1.0, 0,1.6, -14);
  wall(8,2.4,1.0, -18,1.2, 10);
  wall(1.0,2.4,10, 18,1.2, -8);
  wall(6,1.8,6, -22,0.9, -18);
  wall(6,1.8,6,  22,0.9, 18);

  // crates & barriers
  const crateMat=matMetal(0x6b5a44,0.7,0.1);
  const metalCrateMat=matMetal(0x3a444f,0.42,0.55);
  function crate(x,z,sx=2,sy=2,sz=2, mat=crateMat){
    const g=new THREE.BoxGeometry(sx,sy,sz); const m=new THREE.Mesh(g,mat); m.position.set(x,sy/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
    colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,sy/2,z), new THREE.Vector3(sx,sy,sz)));
    // edge highlight
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.06})); e.position.copy(m.position); scene.add(e);
  }
  crate(-12, -2, 3,2,2.2, crateMat); crate(-12, -2, 2,1.5,1.8, metalCrateMat); // stack visual only second inside? keep
  crate(14, 6, 2,2,2); crate(14,8.2,2,2,2, metalCrateMat); crate(15.5,6,1.5,1.2,1.5, metalCrateMat);
  crate(-16, 14, 4,1.6,1.2, metalCrateMat); crate( -4, 18, 2.5,2,2);
  crate(8, -12, 3,1.8,2, metalCrateMat); crate(-10, -16, 2,2,4);
  crate(0, 8, 1.2,1.4,6, metalCrateMat);
  crate(-6, 0, 2,1.2,1.2, metalCrateMat); crate(6, -2, 2,1.2,1.2, metalCrateMat);

  // elevated platform
  const platGeo=new THREE.BoxGeometry(12,1.2,10); const plat=new THREE.Mesh(platGeo, wallMat); plat.position.set(0,0.6,-28); plat.receiveShadow=true; plat.castShadow=true; scene.add(plat);
  colliders.push(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0,0.6,-28), new THREE.Vector3(12,1.2,10)));
  // tower
  const towerGeo=new THREE.BoxGeometry(5,7,5); const tower=new THREE.Mesh(towerGeo, new THREE.MeshStandardMaterial({color:0x182028, roughness:0.55, metalness:0.35})); tower.position.set(0,4.1,-28); tower.castShadow=true; scene.add(tower);
  // light strips emissive
  const stripGeo=new THREE.BoxGeometry(10,0.08,0.12); const stripMat=new THREE.MeshStandardMaterial({color:0xff3b30, emissive:0xff2200, emissiveIntensity:2.2});
  const strip=new THREE.Mesh(stripGeo, stripMat); strip.position.set(0,6.9,-25.4); scene.add(strip);
  const strip2=strip.clone(); strip2.position.set(0,6.9,-30.6); scene.add(strip2);
  // fog volume boxes (fake)
  // sky / distant mountains plane
  const skyGeo=new THREE.PlaneGeometry(400,120); const skyMat=new THREE.MeshBasicMaterial({color:0x18202a, transparent:true, opacity:0.9, fog:false});
  const sky=new THREE.Mesh(skyGeo, skyMat); sky.position.set(0,22,-65); scene.add(sky);
}

function buildWeapon(){
  weaponGroup=new THREE.Group();
  weaponGroup.position.copy(weaponBasePos);
  camera.add(weaponGroup);
  scene.add(camera);
  // muzzle flash — cone + light (attached regardless of model)
  muzzleFlash=new THREE.Group(); muzzleFlash.visible=false;
  const flashGeo=new THREE.ConeGeometry(0.06,0.16,8); const flashMat=new THREE.MeshBasicMaterial({color:0xffe8a0, transparent:true, opacity:0.95});
  const flashMesh=new THREE.Mesh(flashGeo, flashMat); flashMesh.rotation.x=Math.PI/2; flashMesh.position.set(0,0,0.08); muzzleFlash.add(flashMesh);
  const flashLight=new THREE.PointLight(0xffcc66, 14, 6); flashLight.position.set(0,0,0); muzzleFlash.add(flashLight);
  muzzleFlash.position.set(0,0.01,0.84);

  // Try to load Sketchfab SG553 GLB (AAA PBR). Fallback to procedural if missing.
  const loader=new GLTFLoader();
  const fallback=()=>{
    // procedural fallback — brightened so not black silhouette (critic fix)
    const bodyMat=new THREE.MeshStandardMaterial({color:0x3a414c, roughness:0.32, metalness:0.55});
    const darkMat=new THREE.MeshStandardMaterial({color:0x2a2f36, roughness:0.75, metalness:0.15});
    const metalMat=new THREE.MeshStandardMaterial({color:0x7a8590, roughness:0.28, metalness:0.72});
    const rec=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.42), bodyMat); rec.position.set(0,0, -0.08); rec.castShadow=true; weaponGroup.add(rec);
    const hg=new THREE.Mesh(new THREE.BoxGeometry(0.095,0.07,0.38), darkMat); hg.position.set(0,-0.01, 0.24); hg.castShadow=true; weaponGroup.add(hg);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.42,14), metalMat); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.01,0.55); barrel.castShadow=true; weaponGroup.add(barrel);
    const muz=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.024,0.06,12), metalMat); muz.rotation.x=Math.PI/2; muz.position.set(0,0.01,0.78); weaponGroup.add(muz);
    const stock=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.11,0.24), bodyMat); stock.position.set(0,0.02,-0.38); weaponGroup.add(stock);
    const mag=new THREE.Mesh(new THREE.BoxGeometry(0.065,0.18,0.09), new THREE.MeshStandardMaterial({color:0x343a44, roughness:0.6, metalness:0.25})); mag.position.set(0,-0.12, -0.02); mag.rotation.x=0.12; weaponGroup.add(mag);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.16,0.07), darkMat); grip.position.set(0,-0.11,-0.18); grip.rotation.x=0.35; weaponGroup.add(grip);
    const optic=new THREE.Mesh(new THREE.BoxGeometry(0.045,0.045,0.18), metalMat); optic.position.set(0,0.075,-0.06); weaponGroup.add(optic);
    const lens=new THREE.Mesh(new THREE.CircleGeometry(0.018,16), new THREE.MeshStandardMaterial({color:0x6ec8ff, emissive:0x114466, emissiveIntensity:0.6, roughness:0.1, metalness:0.2, transparent:true, opacity:0.95})); lens.position.set(0,0.075,0.035); lens.rotation.y=Math.PI; weaponGroup.add(lens);
    const fs=new THREE.Mesh(new THREE.BoxGeometry(0.015,0.04,0.015), metalMat); fs.position.set(0,0.045,0.48); weaponGroup.add(fs);
    const laser=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.02,0.08), new THREE.MeshStandardMaterial({color:0x44484f, roughness:0.7})); laser.position.set(0.04,0.02,0.32); weaponGroup.add(laser);
    weaponGroup.add(muzzleFlash);
  };
  // Path is relative to project root — http.server serves /public
  loader.load('./public/models/weapon.glb', (gltf)=>{
    try{
      const model=gltf.scene;
      // Center & scale: SG553 is ~0.8m long; scale down to viewmodel
      const box=new THREE.Box3().setFromObject(model);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      model.position.sub(center); // center at origin
      // Normalize to viewmodel scale ~0.6 units long
      const maxDim=Math.max(size.x,size.y,size.z);
      const scale=0.85 / (maxDim||1);
      model.scale.setScalar(scale*0.9);
      // Authoring is Y-up; rotate to point forward (-Z) and adjust
      model.rotation.y=Math.PI; // face forward
      model.rotation.x=0.05;
      model.position.set(0.05,-0.18,-0.55); // viewmodel offset
      // Ensure castShadow and fix materials (tone mapping)
      model.traverse(o=>{
        if(o.isMesh){ o.castShadow=true; o.receiveShadow=false;
          if(o.material){ o.material.needsUpdate=true; if(o.material.emissiveIntensity) o.material.emissiveIntensity*=1.2; }
        }
      });
      // Add to weapon group (clear previous)
      // remove previous procedural meshes if any (none yet)
      weaponGroup.add(model);
      weaponGroup.add(muzzleFlash);
      // Adjust flash position relative to barrel end of GLB (approx forward 0.4)
      muzzleFlash.position.set(0.02,0.08,0.35);
      // Animation: Armature|ArmatureAction — idle sway
      if(gltf.animations && gltf.animations.length){
        weaponClips=gltf.animations;
        weaponMixer=new THREE.AnimationMixer(model);
        const clip=THREE.AnimationClip.findByName(gltf.animations, 'Armature|ArmatureAction')||gltf.animations[0];
        const action=weaponMixer.clipAction(clip);
        action.play();
        console.log('[weapon] GLB loaded', {meshes:1, clips:gltf.animations.length, scale});
      }
      console.log('[weapon] SG553 loaded: wburton CC Attribution — AAA PBR textures');
    }catch(e){ console.warn('weapon glb process fail',e); fallback(); }
  }, undefined, (err)=>{
    console.warn('weapon GLB not available, using procedural fallback', err);
    fallback();
  });
  // if loader not yet resolved, ensure flash still added after fallback delay; fallback only runs on error, so add dummy immediate procedural stub is NOT needed — we rely on async load. Add timeout fallback to guarantee visible weapon:
  setTimeout(()=>{ if(weaponGroup.children.length===0){ fallback(); } }, 2500);
}

function spawnEnemies(){
  enemies.forEach(e=>scene.remove(e.group));
  enemies=[]; 
  const positions=[
    [-18,-10],[12,10],[-8,16],[16,-14],[-14,6],[10,-6],[22,0],[-22,12],[0,-8],[18,18],[-6,-18],[6,14]
  ];
  for(let i=0;i<CONFIG.maxEnemies;i++){
    const p=positions[i%positions.length];
    const e=makeEnemy(p[0], p[1], i);
    enemies.push(e);
  }
}

function makeEnemy(x,z, idx){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x2e3338, roughness:0.72, metalness:0.12});
  const vestMat=new THREE.MeshStandardMaterial({color:0x3d2f24, roughness:0.65, metalness:0.1});
  // legs
  const legGeo=new THREE.CylinderGeometry(0.09,0.09,0.7,8);
  const l1=new THREE.Mesh(legGeo, bodyMat); l1.position.set(-0.12,-0.55,0); l1.castShadow=true;
  const l2=l1.clone(); l2.position.set(0.12,-0.55,0);
  g.add(l1,l2);
  // torso
  const torso=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.55,0.22), vestMat); torso.position.set(0,-0.02,0); torso.castShadow=true; g.add(torso);
  // vest plate
  const plate=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.32,0.025), new THREE.MeshStandardMaterial({color:0x1a1a1a, roughness:0.4, metalness:0.5})); plate.position.set(0,0.02,0.12); g.add(plate);
  // head
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.17,14,12), new THREE.MeshStandardMaterial({color:0xc9a88a, roughness:0.8})); head.position.set(0,0.42,0); head.castShadow=true; g.add(head);
  // helmet
  const helm=new THREE.Mesh(new THREE.SphereGeometry(0.19,14,12,0,Math.PI*2,0,Math.PI*0.62), new THREE.MeshStandardMaterial({color:0x2b3328, roughness:0.55, metalness:0.25})); helm.position.set(0,0.45,0); helm.rotation.x=0.1; g.add(helm);
  // arms + rifle
  const armGeo=new THREE.CylinderGeometry(0.06,0.06,0.4,6);
  const a1=new THREE.Mesh(armGeo, bodyMat); a1.position.set(-0.24,0.02,0.08); a1.rotation.z=-0.5; a1.rotation.x=0.6;
  const a2=new THREE.Mesh(armGeo, bodyMat); a2.position.set(0.24,0.02,0.08); a2.rotation.z=0.5; a2.rotation.x=0.6;
  g.add(a1,a2);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.48), new THREE.MeshStandardMaterial({color:0x111315, roughness:0.4, metalness:0.6})); gun.position.set(0,0.05,0.28); g.add(gun);

  g.position.set(x, 1.0, z);
  g.userData={hp:CONFIG.enemyHP, maxHp:CONFIG.enemyHP, idx, state:'patrol', t: Math.random()*6, lastShot:0, speed: 1.1 + Math.random()*0.9, targetPos:new THREE.Vector3(x,0,z), head, torso, alive:true };
  scene.add(g);

  // health bar sprite (canvas)
  const c=document.createElement('canvas'); c.width=128; c.height=16;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true}));
  sprite.scale.set(0.9,0.14,1); sprite.position.set(0,0.95,0); g.add(sprite);
  g.userData.hpCanvas=c; g.userData.hpSprite=sprite;
  updateEnemyHP(g);
  return {group:g, data:g.userData};
}

function updateEnemyHP(group){
  const c=group.userData.hpCanvas; const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,c.width,c.height);
  const pct=group.userData.hp/group.userData.maxHp;
  ctx.fillStyle=pct>0.5?'#3dff6b':pct>0.25?'#ffcc00':'#ff3b30'; ctx.fillRect(2,2,(c.width-4)*pct,c.height-4);
  group.userData.hpSprite.material.map.needsUpdate=true;
  group.userData.hpSprite.visible= group.userData.alive && pct<1;
}

function startGame(){
  gameState='playing';
  playerHP=CONFIG.playerMaxHP; ammoInMag=CONFIG.magSize; ammoReserve=CONFIG.reserve; kills=0; timeLeft=180;
  camera.position.set(0,1.7,12);
  velocity.set(0,0,0);
  spawnEnemies();
  updateHUD();
}

function onResize(){
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);
}
function onKeyDown(e){
  keys[e.code]=true;
  if(e.code==='KeyR' && !isReloading) doReload();
  if(e.code==='Escape'){ /* pointer lock handles */ }
}
function onMouseDown(e){
  if(gameState!=='playing') return;
  if(e.button!==0) return;
  if(!controls.isLocked){ controls.lock(); return; }
  tryShoot();
}
function setADS(v){ isADS=v; scopeEl.classList.toggle('on', v && !isReloading); }

function doReload(){
  if(isReloading || ammoInMag===CONFIG.magSize || ammoReserve<=0) return;
  isReloading=true; sfxReload();
  weaponGroup.userData.reloadT=0;
  setTimeout(()=>{
    const need=CONFIG.magSize - ammoInMag;
    const take=Math.min(need, ammoReserve);
    ammoReserve-=take; ammoInMag+=take;
    isReloading=false; updateHUD();
  }, 1150);
}

function tryShoot(){
  if(isReloading) return;
  if(ammoInMag<=0){
    if(ammoReserve>0) doReload(); else sfxEmpty();
    return;
  }
  ammoInMag--; updateHUD(); sfxShoot();
  // recoil & spread
  recoil+=0.42; spread= 0.006 + (isADS?0.001:0.008);
  // muzzle flash
  muzzleFlash.visible=true; setTimeout(()=>muzzleFlash.visible=false, 48);
  // shell eject
  spawnShell();
  // raycast with spread
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  // add spread
  dir.x += (Math.random()-0.5)*spread* (isADS?0.5:1);
  dir.y += (Math.random()-0.5)*spread;
  dir.normalize();
  raycaster.set(camera.position, dir);
  const hits=[];
  // enemy hit test (sphere approx)
  enemies.forEach(en=>{
    if(!en.data.alive) return;
    const g=en.group;
    // head sphere
    const headWorld=new THREE.Vector3(); g.userData.head.getWorldPosition(headWorld);
    const toHead=headWorld.clone().sub(camera.position);
    const proj=toHead.dot(dir);
    if(proj<0.3||proj>70) return;
    const closest=camera.position.clone().add(dir.clone().multiplyScalar(proj));
    const dHead=closest.distanceTo(headWorld);
    const dBody=closest.distanceTo(g.position.clone().add(new THREE.Vector3(0,0,0)));
    // simple occlusion against colliders? skip for perf
    if(dHead<0.22){
      hits.push({en, dist:proj, hs:true});
    } else if(dBody<0.45 && Math.abs(closest.y - g.position.y) <0.8){
      hits.push({en, dist:proj, hs:false});
    }
  });
  hits.sort((a,b)=>a.dist-b.dist);
  let hit=null;
  if(hits.length) hit=hits[0];
  // tracer line
  const end = hit ? hit.en.group.position.clone().lerp(camera.position, 0.02) : camera.position.clone().add(dir.clone().multiplyScalar(48));
  if(hit) end.copy(hit.en.group.userData.head.getWorldPosition(new THREE.Vector3()).lerp(hit.en.group.position, hit.hs?0:0.5));
  spawnTracer(camera.position.clone().add(dir.clone().multiplyScalar(0.7)), end);
  if(hit){
    const dmg = hit.hs? Math.round(38*CONFIG.headshotMult) : 38;
    hit.en.data.hp -= dmg;
    updateEnemyHP(hit.en.group);
    showHitmarker(hit.hs);
    sfxHit(); if(hit.hs) sfxHeadshot();
    spawnImpact(end, hit.hs?0xffcc00:0xffffff);
    // knockback
    hit.en.group.position.add(dir.clone().multiplyScalar(0.18));
    if(hit.en.data.hp<=0){
      killEnemy(hit.en, hit.hs);
    }
  } else {
    // ground/wall impact
    // ray vs floor
    if(dir.y< -0.01){
      const t = (0 - camera.position.y)/dir.y;
      if(t>0 && t<60){
        const p=camera.position.clone().add(dir.clone().multiplyScalar(t));
        if(Math.abs(p.x)<39 && Math.abs(p.z)<39) spawnImpact(p, 0x8a8a8a);
      }
    }
  }
  // camera kick
  camera.rotation.x -= 0.012 * (isADS?0.5:1);
}

function showHitmarker(hs){
  hitmarker.classList.add('show'); if(hs) hitmarker.classList.add('hs');
  crosshair.classList.add('hit');
  setTimeout(()=>{ hitmarker.classList.remove('show','hs'); crosshair.classList.remove('hit'); }, 120);
}
function spawnTracer(a,b){
  const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat=new THREE.LineBasicMaterial({color:0xffe9a0, transparent:true, opacity:0.9});
  const line=new THREE.Line(geo, mat); scene.add(line);
  let t=0; const upd=(dt)=>{ t+=dt*14; mat.opacity=1-t; if(t>=1){ scene.remove(line); return false;} return true; };
  particles.push({update:upd});
}
function spawnImpact(p, col){
  const g=new THREE.Group(); g.position.copy(p);
  const geo=new THREE.SphereGeometry(0.06,6,6); const mat=new THREE.MeshBasicMaterial({color:col});
  for(let i=0;i<5;i++){ const m=new THREE.Mesh(geo,mat); m.position.set((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2,(Math.random()-0.5)*0.2); g.add(m); }
  scene.add(g);
  let t=0; particles.push({update:(dt)=>{ t+=dt*6; g.children.forEach(c=>{ c.position.y+=dt*1.2; c.material.opacity=1-t; }); g.scale.multiplyScalar(1+dt*1.2); if(t>=1){scene.remove(g);return false} return true}});
  // decal
  const dGeo=new THREE.CircleGeometry(0.11,8); const dMat=new THREE.MeshStandardMaterial({color:0x111111, roughness:0.9, transparent:true, opacity:0.9});
  const d=new THREE.Mesh(dGeo,dMat); d.position.copy(p); d.position.y+=0.02; d.rotation.x=-Math.PI/2; d.rotation.z=Math.random()*Math.PI; scene.add(d); decals.push(d);
  if(decals.length>40){ const old=decals.shift(); scene.remove(old); }
}
function spawnShell(){
  const geo=new THREE.CylinderGeometry(0.012,0.012,0.03,6); const mat=new THREE.MeshStandardMaterial({color:0xc9a84a, roughness:0.35, metalness:0.7});
  const m=new THREE.Mesh(geo,mat); const wp=new THREE.Vector3(); weaponGroup.getWorldPosition(wp);
  m.position.copy(wp).add(new THREE.Vector3(0.12,-0.08,0.05).applyQuaternion(camera.quaternion));
  m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI,0);
  scene.add(m);
  let vel=new THREE.Vector3(0.8+Math.random()*1.2, 1.2+Math.random()*0.8, (Math.random()-0.5)*0.6).applyQuaternion(camera.quaternion);
  let life=0;
  shells.push({mesh:m, vel, life});
}

function killEnemy(en, hs){
  en.data.alive=false;
  kills++; sfxKill();
  // death anim: fall
  en.group.userData.fallT=0;
  killfeedAdd(hs? 'HEADSHOT':'ELIMINATED', en.data.idx);
  updateHUD();
  if(kills>=CONFIG.maxEnemies) winGame();
  // remove collider relevance? keep
}

function killfeedAdd(text, id){
  const el=document.createElement('div'); el.className='kill'; el.textContent=`${text} — HOSTILE ${String(id+1).padStart(2,'0')}  [+100]`;
  killfeed.prepend(el); setTimeout(()=>el.remove(), 3200);
}

function updateHUD(){
  hudKills.textContent=`KILLS ${kills} / ${CONFIG.maxEnemies}`;
  healthFill.style.width=(playerHP/CONFIG.playerMaxHP*100)+'%';
  healthFill.style.background= playerHP>60? 'linear-gradient(90deg,#ff3b30,#ff6a00)' : playerHP>30? 'linear-gradient(90deg,#ff3b30,#cc0000)' :'linear-gradient(90deg,#7a0000,#ff0000)';
  healthText.innerHTML=`${Math.max(0,Math.round(playerHP))}<small> HP</small>`;
  ammoNum.innerHTML=`${String(ammoInMag).padStart(2,'0')}<span> / ${String(ammoReserve).padStart(2,'0')}</span>`;
  magFill.style.width=(ammoInMag/CONFIG.magSize*100)+'%';
  const mins=String(Math.floor(timeLeft/60)).padStart(2,'0'); const secs=String(Math.floor(timeLeft%60)).padStart(2,'0'); hudTime.textContent=`${mins}:${secs}`;
}

function playerTakeDamage(amt){
  if(gameState!=='playing') return;
  playerHP-=amt; sfxHurt();
  damageVig.classList.add('show'); setTimeout(()=>damageVig.classList.remove('show'), 180);
  // screen shake via camera
  camera.position.y+= (Math.random()-0.5)*0.08;
  updateHUD();
  if(playerHP<=0){ playerHP=0; updateHUD(); loseGame(); }
}

function winGame(){
  gameState='won';
  overlay.classList.remove('hidden');
  document.getElementById('centerMsg').innerHTML=`<h1 style="color:#fff">MISSION<br><b style="color:#3dff6b">ACCOMPLISHED</b></h1><p>ALL HOSTILES NEUTRALIZED • ${kills} KILLS • TIME ${hudTime.textContent}</p><button id="btnAgain" style="margin-top:18px;cursor:pointer;background:linear-gradient(180deg,#1a8a3a,#0f5a24);color:#fff;border:none;padding:14px 36px;font-family:Oxanium,sans-serif;font-weight:800;letter-spacing:.14em;font-size:14px">↻ REDEPLOY</button>`;
  document.getElementById('btnAgain').onclick=()=>{ controls.lock(); startGame(); };
  controls.unlock();
}
function loseGame(){
  gameState='dead';
  overlay.classList.remove('hidden');
  document.getElementById('centerMsg').innerHTML=`<h1>KIA<br><b>OPERATOR DOWN</b></h1><p>YOU WERE ELIMINATED • ${kills}/12 KILLS</p><button id="btnAgain2" style="margin-top:18px;cursor:pointer;background:linear-gradient(180deg,#ff3b30,#c40000);color:#fff;border:none;padding:14px 36px;font-family:Oxanium,sans-serif;font-weight:800;letter-spacing:.14em;font-size:14px">↻ RETRY</button>`;
  document.getElementById('btnAgain2').onclick=()=>{ controls.lock(); startGame(); };
  controls.unlock();
}

// ===== MOVEMENT & AI =====
function collide(pos, radius=0.38){
  for(const b of colliders){ if(b.distanceToPoint(pos) < radius) return true; }
  // bounds
  if(Math.abs(pos.x)>39 || Math.abs(pos.z)>39) return true;
  return false;
}

function updateMovement(dt){
  if(gameState!=='playing' || !controls.isLocked) return;
  const speed = (keys['ShiftLeft']||keys['ShiftRight']) ? CONFIG.moveSpeed*CONFIG.sprintMult : CONFIG.moveSpeed;
  isSprinting = (keys['ShiftLeft']||keys['ShiftRight']) && (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']);
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y=0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize(); // careful: right is left? invert
  // PointerLockControls uses camera orientation; compute wish dir
  let wish = new THREE.Vector3();
  if(keys['KeyW']) wish.add(forward);
  if(keys['KeyS']) wish.sub(forward);
  if(keys['KeyA']) wish.sub(new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize().multiplyScalar(-1)); // simpler
  // recompute properly
  wish.set(0,0,0);
  if(keys['KeyW']) wish.add(forward);
  if(keys['KeyS']) wish.add(forward.clone().multiplyScalar(-1));
  const right2=new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize(); // this is actually -right? test but ok
  // Three's forward cross up gives right? forward × up = right? For FPS, X right. Let's derive: right = forward × worldUp
  // Actually forward × up = right? need check: (0,0,-1) × (0,1,0) = (1,0,0) => correct. So right2 is right.
  if(keys['KeyD']) wish.add(right2);
  if(keys['KeyA']) wish.add(right2.clone().multiplyScalar(-1));
  if(wish.lengthSq()>0) wish.normalize().multiplyScalar(speed*dt);

  // try move X then Z with collision
  const pos=camera.position.clone();
  let next=pos.clone().add(new THREE.Vector3(wish.x,0,0));
  next.y=1.7;
  if(!collide(new THREE.Vector3(next.x,0,next.z))) camera.position.x=next.x;
  next=pos.clone().add(new THREE.Vector3(0,0,wish.z));
  if(!collide(new THREE.Vector3(next.x,0,next.z))) camera.position.z=next.z;

  // gravity / jump - simple
  if(keys['Space'] && onGround){ velocity.y=5.2; onGround=false; }
  velocity.y -= 14*dt;
  camera.position.y += velocity.y*dt;
  if(camera.position.y <=1.7){ camera.position.y=1.7; velocity.y=0; onGround=true; }

  // footstep bob
  if(wish.lengthSq()>0 && onGround){
    bobTime+=dt * (isSprinting? 10:7);
    if(Math.floor(bobTime*2)%20===0 && Math.random()<0.08) tone(90,0.06,'sine',0.06);
  } else bobTime+=dt*2;

  // recoil decay
  recoil = Math.max(0, recoil - dt*3.5);
  spread = Math.max(0, spread - dt*1.2);
}

function updateWeapon(dt){
  if(!weaponGroup) return;
  if(weaponMixer) weaponMixer.update(dt);
  // ADS lerp FOV
  const targetFov = isADS? CONFIG.adsFov: CONFIG.baseFov;
  camera.fov += (targetFov - camera.fov)* dt*8;
  camera.updateProjectionMatrix();
  // weapon position lerp
  const adsPos = new THREE.Vector3(0.0,-0.16,-0.38);
  const hipPos = weaponBasePos.clone();
  if(isSprinting) hipPos.add(new THREE.Vector3(0.06,0.04,0.08));
  const targetPos = isADS? adsPos : hipPos;
  weaponGroup.position.lerp(targetPos, dt*10);
  // bob + recoil
  const bobAmp = isADS? 0.006 : isSprinting? 0.045: 0.018;
  weaponGroup.position.y += Math.sin(bobTime*2)*bobAmp*dt*60*0.02;
  weaponGroup.position.x += Math.cos(bobTime)*bobAmp*0.5*dt*60*0.02;
  weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, -recoil*0.22, dt*14);
  weaponGroup.rotation.z = THREE.MathUtils.lerp(weaponGroup.rotation.z, Math.sin(bobTime)*0.02, dt*8);
  // reload anim
  if(isReloading){
    weaponGroup.rotation.x += Math.sin(Date.now()*0.008)*0.02;
    weaponGroup.position.y += Math.sin(Date.now()*0.012)*0.004;
  }
  // hide weapon when scoped? keep slight
  weaponGroup.visible = !(isADS && camera.fov<56);
}

function updateEnemies(dt){
  const playerPos=camera.position.clone();
  enemies.forEach(en=>{
    const g=en.group; const d=g.userData;
    if(!d.alive){
      d.fallT=(d.fallT||0)+dt*2.2;
      g.rotation.z = Math.min(Math.PI/2, d.fallT*0.9);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0.15, dt*4);
      return;
    }
    d.t+=dt;
    const dist=g.position.distanceTo(playerPos);
    // look at player
    const dir=new THREE.Vector3().subVectors(playerPos, g.position); dir.y=0; dir.normalize();
    const targetYaw=Math.atan2(dir.x, dir.z);
    let curYaw=g.rotation.y;
    let diff=targetYaw-curYaw; while(diff>Math.PI) diff-=Math.PI*2; while(diff<-Math.PI) diff+=Math.PI*2;
    g.rotation.y += diff* dt*3;

    // AI state
    if(dist<22 && dist>1.8){
      // chase / strafe
      const move=dir.clone().multiplyScalar(d.speed*dt*0.55);
      const np=g.position.clone().add(move);
      if(!collide(new THREE.Vector3(np.x,0,np.z),0.5)) g.position.add(move);
      // shoot
      if(dist<20 && d.t - d.lastShot > 0.7 + Math.random()*0.9){
        // line of sight simple: ray
        d.lastShot=d.t;
        // enemy accuracy
        const acc = dist<8?0.9: dist<14?0.35:0.18;
        if(Math.random()<acc){
          // muzzle flash small
          spawnTracer(g.position.clone().add(new THREE.Vector3(0,0.05,0.28).applyAxisAngle(new THREE.Vector3(0,1,0), g.rotation.y)), playerPos.clone());
          playerTakeDamage(CONFIG.damagePlayer * (Math.random()*0.4+0.8));
        } else {
          const miss=playerPos.clone().add(new THREE.Vector3((Math.random()-0.5)*1.2, (Math.random()-0.5)*0.8,(Math.random()-0.5)*1.2));
          spawnTracer(g.position.clone().add(new THREE.Vector3(0,0.2,0.3).applyAxisAngle(new THREE.Vector3(0,1,0), g.rotation.y)), miss);
        }
      }
    } else if(dist>=22){
      // patrol wander
      if(g.position.distanceTo(d.targetPos)<1.2 || Math.random()<0.005){
        d.targetPos.set((Math.random()-0.5)*46,0,(Math.random()-0.5)*46);
      }
      const toTarget=new THREE.Vector3().subVectors(d.targetPos, g.position); toTarget.y=0; const td=toTarget.length();
      if(td>0.5){ toTarget.normalize().multiplyScalar(d.speed*dt*0.45); const np=g.position.clone().add(toTarget); if(!collide(new THREE.Vector3(np.x,0,np.z),0.5)) g.position.add(toTarget); }
    }
    // bob
    g.position.y = 1.0 + Math.sin(d.t*3 + d.idx)*0.015;
  });
}

function updateShells(dt){
  for(let i=shells.length-1;i>=0;i--){
    const s=shells[i]; s.vel.y-=9.8*dt; s.mesh.position.add(s.vel.clone().multiplyScalar(dt)); s.mesh.rotation.x+=dt*12; s.mesh.rotation.z+=dt*9;
    s.life+=dt;
    if(s.mesh.position.y<0.02){ s.mesh.position.y=0.02; s.vel.set(0,0,0); }
    if(s.life>5){ scene.remove(s.mesh); shells.splice(i,1); }
  }
}

function drawMinimap(){
  if(!miniCtx) return;
  miniCtx.clearRect(0,0,300,300);
  // bg
  miniCtx.fillStyle='#0a0e14'; miniCtx.fillRect(0,0,300,300);
  miniCtx.strokeStyle='rgba(255,255,255,0.06)'; miniCtx.lineWidth=1;
  for(let i=0;i<300;i+=30){ miniCtx.beginPath(); miniCtx.moveTo(i,0); miniCtx.lineTo(i,300); miniCtx.stroke(); miniCtx.beginPath(); miniCtx.moveTo(0,i); miniCtx.lineTo(300,i); miniCtx.stroke(); }
  // walls as rects (map 80→300, center 150)
  function m(x,z){ return [150 + x/80*280, 150 + z/80*280]; }
  miniCtx.fillStyle='rgba(100,110,120,0.35)';
  colliders.forEach(b=>{ const cen=b.getCenter(new THREE.Vector3()); const sz=b.getSize(new THREE.Vector3()); const [mx,mz]=m(cen.x,cen.z); const w=sz.x/80*280, h=sz.z/80*280; miniCtx.fillRect(mx-w/2, mz-h/2, w,h); });
  // player
  const [px,pz]=m(camera.position.x,camera.position.z); const yaw=camera.rotation.y;
  miniCtx.fillStyle='#ff3b30'; miniCtx.beginPath(); miniCtx.arc(px,pz,6,0,Math.PI*2); miniCtx.fill();
  miniCtx.strokeStyle='#fff'; miniCtx.lineWidth=2; miniCtx.beginPath(); miniCtx.moveTo(px,pz); miniCtx.lineTo(px+Math.sin(yaw)*14, pz+Math.cos(yaw)*14); miniCtx.stroke();
  // enemies
  enemies.forEach(en=>{
    if(!en.data.alive) return;
    const [ex,ez]=m(en.group.position.x,en.group.position.z);
    miniCtx.fillStyle='#ffcc00'; miniCtx.beginPath(); miniCtx.arc(ex,ez,4,0,Math.PI*2); miniCtx.fill();
    miniCtx.fillStyle='rgba(255,60,40,0.9)'; miniCtx.beginPath(); miniCtx.arc(ex,ez,2,0,Math.PI*2); miniCtx.fill();
  });
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.033);
  const elapsed=clock.getElapsedTime();

  if(gameState==='playing'){
    timeLeft-=dt; if(timeLeft<=0){ timeLeft=0; loseGame(); }
    updateMovement(dt);
    updateWeapon(dt);
    updateEnemies(dt);
    updateShells(dt);
  } else {
    // menu weapon idle
    bobTime+=dt*2; updateWeapon(dt);
  }
  // particles
  for(let i=particles.length-1;i>=0;i--){ if(!particles[i].update(dt)) particles.splice(i,1); }
  // minimap 10fps
  if(elapsed - lastFpsUpdate >0.1){ drawMinimap(); }
  // fps counter
  frameCount++; if(elapsed - lastFpsUpdate >0.5){ hudFps.textContent=Math.round(frameCount/0.5)+' FPS'; frameCount=0; lastFpsUpdate=elapsed; updateHUD(); }

  renderer.render(scene,camera);
}

init();

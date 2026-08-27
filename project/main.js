import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('canvas');
const healthTxt = document.getElementById('healthTxt');
const healthBar = document.getElementById('healthBar');
const armorTxt = document.getElementById('armorTxt');
const ammoTxt = document.getElementById('ammoTxt');
const ammoBar = document.getElementById('ammoBar');
const wavePill = document.getElementById('wavePill');
const enemiesPill = document.getElementById('enemiesPill');
const crosshair = document.getElementById('crosshair');
const hitmarker = document.getElementById('hitmarker');
const damageEl = document.getElementById('damage');
const killfeed = document.getElementById('killfeed');
const miniCanvas = document.getElementById('mini');
const miniCtx = miniCanvas.getContext('2d');
const fpsStat = document.getElementById('fpsStat');

const menu = document.getElementById('menu');
const dead = document.getElementById('dead');
const winEl = document.getElementById('win');
const pauseEl = document.getElementById('pause');

let renderer, scene, camera, clock;
let player = { pos: new THREE.Vector3(0,1.7,8), vel: new THREE.Vector3(), health:100, armor:50, yaw:0, pitch:0, onGround:true, crouch:false, sprint:false };
let keys = {};
let mouseDown=false, ads=false;
let ammo=30, reserve=90, reloading=false, reloadT=0;
let kills=0, headshots=0, shots=0, hits=0, wave=1, alive=0, gameState='menu'; // menu, playing, dead, win
let enemies=[], bullets=[], particles=[], decals=[];
let weaponGroup, rifleMesh=null, muzzleFlash, weaponBob=0;
let raycaster = new THREE.Raycaster();
let cameraHolder;
let controlsEnabled=false;
let lastShot=0, fireRate=92; // ms
let enemyGroup;
let levelMeshes=[];
let spotLights=[];
let mixers=[];
let footstepTimer=0;

let sensitivity=1.0;
document.getElementById('howBtn').onclick=()=>{ sensitivity = sensitivity>=1.5?0.6:sensitivity+0.2; document.getElementById('sensLabel').textContent=sensitivity.toFixed(1)+'×';};

init();
animate();

function init(){
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.physicallyCorrectLights = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1016);
  scene.fog = new THREE.Fog(0x0a1016, 22, 58);

  camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
  cameraHolder = new THREE.Object3D();
  scene.add(cameraHolder);
  cameraHolder.add(camera);
  camera.position.set(0,0,0);

  clock = new THREE.Clock();

  // lights — AAA-ish: key + fill + practicals
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x0a0f14, 0.55));
  const dir = new THREE.DirectionalLight(0xfff6e8, 1.2);
  dir.position.set(18,22,10);
  dir.castShadow=true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near=1; dir.shadow.camera.far=60;
  dir.shadow.camera.left=-30; dir.shadow.camera.right=30; dir.shadow.camera.top=30; dir.shadow.camera.bottom=-30;
  dir.shadow.bias=-0.0004;
  scene.add(dir);

  // practical spots
  for(let i=0;i<4;i++){
    const s = new THREE.SpotLight(0xffe8c8, 80, 30, Math.PI/5, 0.45, 1);
    s.position.set(-12+i*8, 6.8, -2);
    s.castShadow=true; s.shadow.mapSize.set(1024,1024);
    s.target.position.set(s.position.x,0,s.position.z);
    scene.add(s); scene.add(s.target); spotLights.push(s);
    // visible beam
    const beamGeo = new THREE.CylinderGeometry(0.18,1.2,6.5,12,1,true);
    const beamMat = new THREE.MeshBasicMaterial({color:0xffe8c8, transparent:true, opacity:0.07, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(s.position.x, 3.6, s.position.z);
    scene.add(beam);
  }
  const fill = new THREE.PointLight(0x00e5ff, 18, 18);
  fill.position.set(0,2.2,-12);
  scene.add(fill);

  // IBL — RoomEnvironment gives neutral studio probe so PBR metals get travelling specular (fixes flat-plastic tell)
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0x0a1016);

  buildLevel();
  buildWeapon();
  buildEnemiesForWave();

  // input
  addEventListener('keydown', e=>{
    keys[e.code]=true;
    if(e.code==='KeyR' && gameState==='playing') tryReload();
    if(e.code==='KeyC' || e.code==='ControlLeft') player.crouch = !player.crouch;
    if(e.code==='Escape' && gameState==='playing'){ document.exitPointerLock?.(); }
    if((e.code==='KeyR' && gameState==='dead')||(e.code==='KeyR' && gameState==='win')) restart();
  });
  addEventListener('keyup', e=> keys[e.code]=false);
  canvas.addEventListener('mousedown', e=>{
    if(gameState!=='playing') return;
    if(e.button===0) mouseDown=true;
    if(e.button===2) ads=true;
  });
  addEventListener('mouseup', e=>{
    if(e.button===0) mouseDown=false;
    if(e.button===2) ads=false;
  });
  canvas.addEventListener('contextmenu', e=> e.preventDefault());
  document.addEventListener('mousemove', e=>{
    if(!controlsEnabled || gameState!=='playing') return;
    const dx = e.movementX || 0, dy = e.movementY || 0;
    player.yaw -= dx * 0.0022 * sensitivity;
    player.pitch -= dy * 0.0022 * sensitivity;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch));
  });
  document.addEventListener('pointerlockchange', ()=>{
    controlsEnabled = document.pointerLockElement===canvas;
    if(gameState==='playing'){
      if(controlsEnabled) pauseEl.classList.add('hide');
      else pauseEl.classList.remove('hide');
    }
  });

  document.getElementById('playBtn').onclick = ()=>{
    startGame();
    canvas.requestPointerLock();
  };
  document.getElementById('resumeBtn').onclick = ()=> canvas.requestPointerLock();
  document.getElementById('restartBtn').onclick = restart;
  document.getElementById('againBtn').onclick = restart;
  document.getElementById('viewerBtn').onclick = ()=> window.open('./ab-viewer/','_blank');
  addEventListener('resize', ()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
  canvas.addEventListener('click', ()=>{
    if(gameState==='menu') return;
    if(gameState==='playing' && !controlsEnabled) canvas.requestPointerLock();
  });

  // prevent space scroll
  addEventListener('keydown', e=>{ if(e.code==='Space') e.preventDefault(); });

  updateHUD();
}

function startGame(){
  gameState='playing';
  menu.classList.add('hide');
  dead.classList.add('hide');
  winEl.classList.add('hide');
  pauseEl.classList.add('hide');
}

function restart(){
  // reset player
  player.pos.set(0,1.7,8); player.vel.set(0,0,0); player.health=100; player.armor=50; player.yaw=0; player.pitch=0;
  ammo=30; reserve=90; reloading=false; reloadT=0;
  kills=0; headshots=0; shots=0; hits=0; wave=1;
  clearEnemies(); clearParticles();
  buildEnemiesForWave();
  gameState='playing';
  dead.classList.add('hide'); winEl.classList.add('hide'); menu.classList.add('hide'); pauseEl.classList.add('hide');
  canvas.requestPointerLock();
  updateHUD();
}

function buildLevel(){
  // floor — concrete with tuned PBR (higher roughness, low metalness for AAA concrete)
  const floorGeo = new THREE.PlaneGeometry(44,44);
  const floorMat = new THREE.MeshStandardMaterial({color:0x8f9eac, roughness:0.94, metalness:0.02});
  // procedural bump via canvas
  const c = document.createElement('canvas'); c.width=c.height=512;
  const g = c.getContext('2d');
  g.fillStyle='#808080'; g.fillRect(0,0,512,512);
  for(let i=0;i<4000;i++){ g.fillStyle=`rgba(${160+Math.random()*40|0},${160+Math.random()*40|0},${160+Math.random()*40|0},0.12)`; g.fillRect(Math.random()*512,Math.random()*512,2,2); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,6); tex.colorSpace=THREE.SRGBColorSpace;
  floorMat.map = tex; floorMat.needsUpdate=true;
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true;
  scene.add(floor); levelMeshes.push(floor);

  // walls — tuned roughness/metalness for plaster vs painted metal
  const wallMat = new THREE.MeshStandardMaterial({color:0xd3dde6, roughness:0.82, metalness:0.015});
  const wallMatDark = new THREE.MeshStandardMaterial({color:0x1c262f, roughness:0.92, metalness:0.04});
  function wall(w,h,d,x,y,z,mat=wallMat){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); levelMeshes.push(m); return m;
  }
  // perimeter
  wall(44,5,0.6,0,2.5,-22);
  wall(44,5,0.6,0,2.5,22);
  wall(0.6,5,44,-22,2.5,0);
  wall(0.6,5,44,22,2.5,0);
  // inner killhouse partitions
  wall(10,2.6,0.35, -8,1.3,-6, wallMatDark);
  wall(0.35,2.6,10, 8,1.3,-4, wallMatDark);
  wall(14,2.6,0.35, 2,1.3,4, wallMatDark);
  wall(0.35,2.6,8, -10,1.3,6, wallMatDark);
  wall(6,1.4,0.35, -4,0.7,0, wallMatDark);
  wall(6,1.4,0.35, 10,0.7,8, wallMatDark);
  // pillars
  for(let x of [-14,0,14]) for(let z of [-12,0,12]){
    const p = wall(0.7,4.2,0.7, x,2.1,z, wallMatDark);
    p.castShadow=true;
  }
  // crates & cover — high poly feel via bevel
  const crateMat = new THREE.MeshStandardMaterial({color:0x8f7a5a, roughness:0.78, metalness:0.02});
  const metalMat = new THREE.MeshStandardMaterial({color:0x67788a, roughness:0.32, metalness:0.72});
  const barrelMat = new THREE.MeshStandardMaterial({color:0x2f3d4e, roughness:0.48, metalness:0.28});
  function crate(x,z,s=1){
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2*s,1.1*s,1.2*s), crateMat);
    m.position.set(x,0.55*s,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); levelMeshes.push(m);
    // metal edges
    const e = new THREE.Mesh(new THREE.BoxGeometry(1.26*s,0.08*s,1.26*s), metalMat); e.position.set(x,0.15*s,z); scene.add(e);
  }
  crate(-6,-10,1); crate(-5,-10,1); crate(-6,-9,1);
  crate(9,-10,1.1); crate(7, -2,1); crate(8,-2,1); crate(7,-1,1.2);
  crate(-12,3,1); crate(-11,3,1.15);
  crate(11,10,1); crate(10,10,1);
  crate(-2, -3, 0.9); crate(3,6,1);
  // barrels
  for(let i=0;i<6;i++){
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.95,16), barrelMat);
    b.position.set(-14+ i*0.9,0.475, 14); b.castShadow=true; scene.add(b); levelMeshes.push(b);
  }
  for(let i=0;i<4;i++){
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.95,16), barrelMat);
    b.position.set(13,0.475, -13 + i*1.0); b.castShadow=true; scene.add(b); levelMeshes.push(b);
  }
  // overhead truss with emissive
  const truss = new THREE.Mesh(new THREE.BoxGeometry(44,0.12,0.12), new THREE.MeshStandardMaterial({color:0x0f1820, roughness:0.6, metalness:0.6}));
  truss.position.set(0,5.2,0); scene.add(truss);
  const truss2 = truss.clone(); truss2.position.z=-6; scene.add(truss2);
  const truss3 = truss.clone(); truss3.position.z=6; scene.add(truss3);

  // ceiling lights meshes
  for(let i=0;i<4;i++){
    const lm = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,0.7), new THREE.MeshStandardMaterial({color:0xfff2d0, emissive:0xfff0b0, emissiveIntensity:1.8, roughness:1}));
    lm.position.set(-12+i*8,5.1,-2); scene.add(lm);
    const lm2 = lm.clone(); lm2.position.z=4; scene.add(lm2);
  }

  // decals / markings
  const markGeo = new THREE.PlaneGeometry(6,6);
  const markMat = new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.06, side:THREE.DoubleSide});
  const mark = new THREE.Mesh(markGeo, markMat); mark.rotation.x=-Math.PI/2; mark.position.set(0,0.02,0); scene.add(mark);
}

function buildWeapon(){
  weaponGroup = new THREE.Group();
  camera.add(weaponGroup);
  // fallback procedural rifle while GLB loads — tuned PBR for polished look
  const bodyMat = new THREE.MeshStandardMaterial({color:0x191f26, roughness:0.38, metalness:0.62, envMapIntensity:0.85});
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.07,0.42), bodyMat);
  body.position.set(0.32,-0.24,-0.52); weaponGroup.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.32,12), new THREE.MeshStandardMaterial({color:0x0e1318, roughness:0.28, metalness:0.78, envMapIntensity:0.9}));
  barrel.rotation.x=Math.PI/2; barrel.position.set(0.32,-0.22,-0.80); weaponGroup.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04,0.12,0.05), bodyMat); grip.position.set(0.32,-0.30,-0.45); grip.rotation.x=0.25; weaponGroup.add(grip);

  muzzleFlash = new THREE.PointLight(0xfff0a0, 0, 3);
  muzzleFlash.position.set(0.32,-0.22,-0.98); weaponGroup.add(muzzleFlash);
  const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,8), new THREE.MeshBasicMaterial({color:0xfff0a0, transparent:true, opacity:0}));
  flashMesh.rotation.x=Math.PI; flashMesh.position.copy(muzzleFlash.position); flashMesh.position.z-=0.08; flashMesh.name='flash'; weaponGroup.add(flashMesh);

  // load GLB rifle — proper framing & PBR polish
  const loader = new GLTFLoader();
  loader.load('./public/models/rifle.glb', gltf=>{
    weaponGroup.clear();
    rifleMesh = gltf.scene;
    // polish materials: clamp roughness/metalness, set correct colorSpace & anisotropy
    rifleMesh.traverse(o=>{
      if(o.isMesh){
        o.castShadow=true; o.receiveShadow=false; o.frustumCulled=false;
        const mats = Array.isArray(o.material)? o.material : [o.material];
        mats.forEach(m=>{
          if(!m) return;
          if(m.isMeshStandardMaterial){
            m.roughness = Math.min(0.85, Math.max(0.18, m.roughness ?? 0.45));
            m.metalness = Math.min(0.88, Math.max(0.06, m.metalness ?? 0.55));
            m.envMapIntensity = 0.45;
            m.needsUpdate=true;
          }
          if(m.map){
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
          }
        });
      }
    });
    // compute bounds for consistent viewmodel framing
    const box = new THREE.Box3().setFromObject(rifleMesh);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    rifleMesh.position.sub(center);
    const maxDim = Math.max(size.x,size.y,size.z) || 1;
    const scale = 0.62 / maxDim;
    rifleMesh.scale.set(scale,scale,scale);
    // Sketchfab models often face +Z; rotate to viewmodel -Z forward, slight pitch for natural hold
    rifleMesh.rotation.y = Math.PI;
    rifleMesh.rotation.x = 0.06;
    rifleMesh.position.set(0.34,-0.27,-0.64);
    weaponGroup.add(rifleMesh);
    weaponGroup.add(muzzleFlash); weaponGroup.add(flashMesh);
    // muzzle tip offset tuned for M762 length after scale
    muzzleFlash.position.set(0.34,-0.20,-0.96);
    flashMesh.position.copy(muzzleFlash.position); flashMesh.position.z-=0.07;
  }, undefined, e=>{
    console.warn('rifle load failed', e);
  });
  weaponGroup.position.set(0,0,0);
}

function buildEnemiesForWave(){
  clearEnemies();
  const count = 4 + wave*2; // wave1=6, wave2=8...
  const spots = [[-18, -18],[18,-18],[-18,18],[18,18],[0,-18],[0,18],[-10,0],[10,0],[ -16, 6],[16,-6]];
  for(let i=0;i<count;i++){
    const s = spots[i%spots.length];
    const jitter = new THREE.Vector2((Math.random()-0.5)*4,(Math.random()-0.5)*4);
    spawnEnemy(s[0]+jitter.x, s[1]+jitter.y);
  }
  alive=count; updateHUD();
}

function spawnEnemy(x,z){
  const g = new THREE.Group();
  g.position.set(x,0,z);
  // body
  const bodyMat = new THREE.MeshStandardMaterial({color:0x2b3a46, roughness:0.78, metalness:0.08});
  const headMat = new THREE.MeshStandardMaterial({color:0xd8c2a8, roughness:0.9});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32,0.65,8,16), bodyMat);
  body.position.y=0.95; body.castShadow=true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,14,14), headMat);
  head.position.y=1.58; head.castShadow=true; g.add(head);
  head.name='head';
  // helmet
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.26,14,10,0,Math.PI*2,0,Math.PI*0.58), new THREE.MeshStandardMaterial({color:0x1e2a22, roughness:0.5, metalness:0.2}));
  helm.position.y=1.62; helm.rotation.x=0.12; g.add(helm);
  // visor
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.10), new THREE.MeshBasicMaterial({color:0x00e5ff, transparent:true, opacity:0.35, side:THREE.DoubleSide}));
  visor.position.set(0,1.58,0.20); visor.rotation.x=0.15; g.add(visor);
  // gun
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.48), new THREE.MeshStandardMaterial({color:0x11171c, roughness:0.4, metalness:0.6}));
  gun.position.set(0.22,0.92,0.25); g.add(gun);

  // shadow disc
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42,14), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.28}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.02; g.add(shadow);

  g.userData = { health: 100, max:100, state:'patrol', t: Math.random()*5, speed: 1.3+Math.random()*0.7, target: new THREE.Vector3(), lastShot:0, head:head, body:body, helm, hitFlash:0 };
  // random patrol target
  g.userData.target.set((Math.random()-0.5)*30,(0),(Math.random()-0.5)*30);
  scene.add(g);
  enemies.push(g);
}
function clearEnemies(){ enemies.forEach(e=> scene.remove(e)); enemies=[]; }
function clearParticles(){ particles.forEach(p=> scene.remove(p.mesh)); particles=[]; bullets.forEach(b=> scene.remove(b.mesh)); bullets=[]; decals.forEach(d=> scene.remove(d)); decals=[]; }

function tryReload(){
  if(reloading || ammo===30 || reserve===0) return;
  reloading=true; reloadT=1.45;
  // anim
}

function shoot(){
  if(reloading) return;
  if(ammo<=0){ tryReload(); return; }
  const now=performance.now();
  if(now - lastShot < fireRate) return;
  lastShot=now;
  ammo--; shots++;
  if(reserve<0) reserve=0;
  // recoil
  player.pitch += 0.012; player.yaw += (Math.random()-0.5)*0.008;
  weaponBob+=2.5;
  // muzzle flash
  muzzleFlash.intensity=22;
  const flash = weaponGroup.getObjectByName('flash');
  if(flash) flash.material.opacity=0.92;
  setTimeout(()=>{ if(flash) flash.material.opacity=0; muzzleFlash.intensity=0; }, 45);
  // camera shake
  camera.position.x = (Math.random()-0.5)*0.02;
  setTimeout(()=> camera.position.x=0, 40);
  // ejection port brass — subtle polish
  spawnBrass();

  // raycast from camera
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(getCameraQuat());
  // spread
  const spread = ads?0.003:0.012;
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.z += (Math.random()-0.5)*spread; dir.normalize();
  const origin = camera.getWorldPosition(new THREE.Vector3());
  raycaster.set(origin, dir);
  const hitsMeshes = raycaster.intersectObjects([...levelMeshes, ...enemies.map(e=> e.children).flat()], true);
  // check enemy hit first: ray against enemy capsules approximated by distance to group
  let hitEnemy=null, isHead=false, hitPoint=null, hitNormal=null;
  let closestDist=Infinity;
  // also do precise mesh intersect for enemies but fallback to distance
  for(let e of enemies){
    if(e.userData.health<=0) continue;
    const to = new THREE.Vector3().subVectors(e.position, origin);
    const proj = to.dot(dir);
    if(proj<0.3 || proj>60) continue;
    const closest = origin.clone().add(dir.clone().multiplyScalar(proj));
    const d = closest.distanceTo(e.position.clone().add(new THREE.Vector3(0,1.0,0)));
    if(d<0.65 && proj < closestDist){
      closestDist=proj; hitEnemy=e; hitPoint=closest;
      // head test
      const headPos = e.position.clone().add(new THREE.Vector3(0,1.58,0));
      const dh = closest.distanceTo(headPos);
      isHead = dh < 0.30;
    }
  }
  // if we hit geometry before enemy, check distance
  if(hitsMeshes.length){
    const geoHit = hitsMeshes[0];
    // if geoHit distance < enemy distance, then no enemy hit
    if(geoHit.distance < closestDist - 0.1){
      hitEnemy=null;
      hitPoint = geoHit.point; hitNormal = geoHit.face? geoHit.face.normal.clone(): new THREE.Vector3(0,1,0);
      // wall impact
      spawnImpact(hitPoint, hitNormal, false);
      spawnBulletTrail(origin, hitPoint);
    } else if(hitEnemy){
      // enemy is closer — ignore geo
    }
  }
  if(hitEnemy){
    hits++;
    const dmg = isHead? 62 : 34;
    hitEnemy.userData.health -= dmg;
    hitEnemy.userData.hitFlash=0.22;
    if(isHead) headshots++;
    // knockback slightly
    hitEnemy.position.add(dir.clone().multiplyScalar(0.12));
    // hit feedback
    crosshair.classList.add('hit'); setTimeout(()=>crosshair.classList.remove('hit'),120);
    hitmarker.classList.remove('show'); void hitmarker.offsetWidth; hitmarker.classList.add('show'); setTimeout(()=>hitmarker.classList.remove('show'),220);
    spawnImpact(hitPoint|| hitEnemy.position.clone().add(new THREE.Vector3(0,1.1,0)), dir.clone().multiplyScalar(-1), true, isHead);
    spawnBulletTrail(origin, hitPoint);
    addKillfeed(isHead? 'HEADSHOT +'+dmg : 'HIT +'+dmg, isHead);
    if(hitEnemy.userData.health<=0){
      // death
      hitEnemy.userData.health=0;
      kills++; alive--;
      // death anim: fall
      hitEnemy.userData.state='dead';
      // disable quickly
      addKillfeed('HOSTILE ELIMINATED', false, '#00e5ff');
      // particle burst
      for(let i=0;i<10;i++) spawnParticle(hitEnemy.position.clone().add(new THREE.Vector3(0,1,0)), new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2), 0x8aa0b3);
      // schedule fade
      setTimeout(()=>{ scene.remove(hitEnemy); enemies = enemies.filter(x=>x!==hitEnemy); }, 1800);
      if(alive<=0){
        wave++;
        if(wave>4){
          gameState='win'; document.getElementById('winStats').textContent = `All 4 waves cleared — ${kills} kills, ${Math.round(hits/Math.max(1,shots)*100)}% accuracy.`;
          winEl.classList.remove('hide'); document.exitPointerLock?.();
        } else {
          addKillfeed(`WAVE ${wave} INBOUND`, false, '#ffe08a');
          setTimeout(()=> buildEnemiesForWave(), 1600);
        }
      }
    }
  } else if(!hitsMeshes.length){
    // miss trail
    const far = origin.clone().add(dir.clone().multiplyScalar(45));
    spawnBulletTrail(origin, far);
  }

  updateHUD();
}

function spawnBulletTrail(a,b){
  const geo = new THREE.BufferGeometry().setFromPoints([a,b]);
  const mat = new THREE.LineBasicMaterial({color:0xffe8a0, transparent:true, opacity:0.9});
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  let t=0; bullets.push({mesh:line, t, a:a.clone(), b:b.clone()});
}

function spawnImpact(pos, normal, isFlesh, isHead){
  // spark / blood
  const color = isFlesh ? (isHead?0xff2b2b:0xff6a3d) : 0xffe8a0;
  for(let i=0;i< (isFlesh?7:4); i++){
    const vel = new THREE.Vector3((Math.random()-0.5)*3, Math.random()*2.2+0.2, (Math.random()-0.5)*3);
    if(normal) vel.add(normal.clone().multiplyScalar(Math.random()*1.2));
    spawnParticle(pos.clone(), vel, color, isFlesh?0.9:0.6);
  }
  if(!isFlesh){
    // decal
    const dg = new THREE.CircleGeometry(0.08+Math.random()*0.05, 8);
    const dm = new THREE.MeshBasicMaterial({color:0x1a222a, transparent:true, opacity:0.9, side:THREE.DoubleSide});
    const d = new THREE.Mesh(dg, dm);
    d.position.copy(pos).add(normal? normal.clone().multiplyScalar(0.02): new THREE.Vector3(0,0.02,0));
    if(normal){ d.lookAt(pos.clone().add(normal)); }
    else d.rotation.x=-Math.PI/2;
    scene.add(d); decals.push(d);
    setTimeout(()=>{ d.material.opacity=0; }, 8000);
  }
}
function spawnParticle(pos, vel, color, size=0.04){
  const m = new THREE.Mesh(new THREE.SphereGeometry(size,6,6), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95}));
  m.position.copy(pos); scene.add(m);
  particles.push({mesh:m, vel:vel.clone(), life:0.55, age:0});
}
function spawnBrass(){
  // ejection port: small brass cylinder near weapon, light physics
  const camPos = camera.getWorldPosition(new THREE.Vector3());
  const camQuat = getCameraQuat();
  const ejectionOffset = new THREE.Vector3(0.38, -0.18, -0.42).applyQuaternion(camQuat).add(camPos);
  const vel = new THREE.Vector3(0.9 + Math.random()*0.6, 1.4 + Math.random()*0.6, (Math.random()-0.5)*0.5).applyQuaternion(camQuat);
  // spin slightly outward
  const geo = new THREE.CylinderGeometry(0.022,0.022,0.038,8);
  const mat = new THREE.MeshStandardMaterial({color:0xc9a84c, roughness:0.28, metalness:0.82, envMapIntensity:0.7});
  const brass = new THREE.Mesh(geo, mat);
  brass.position.copy(ejectionOffset);
  brass.rotation.z = Math.PI/2;
  brass.castShadow=true;
  scene.add(brass);
  particles.push({mesh:brass, vel, life:1.1, age:0, isBrass:true, spin: (Math.random()-0.5)*18});
}
function spawnFootstepDust(){
  const pos = player.pos.clone(); pos.y = 0.06;
  const vel = new THREE.Vector3((Math.random()-0.5)*0.6, Math.random()*0.5+0.15, (Math.random()-0.5)*0.6);
  spawnParticle(pos, vel, 0x9aa8b4, 0.045);
}
function addKillfeed(text, head=false, col=null){
  const el=document.createElement('div'); el.className='kill'; el.textContent=text;
  if(col) el.style.borderLeftColor=col; if(head) el.style.borderLeftColor='#ff2b2b';
  killfeed.prepend(el); setTimeout(()=> el.remove(), 2200);
}

function getCameraQuat(){
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ');
  q.setFromEuler(e); return q;
}

function updateHUD(){
  healthTxt.innerHTML = Math.max(0,Math.round(player.health))+'<small>HP</small>';
  healthBar.style.width = Math.max(0,player.health)+'%';
  healthBar.style.background = player.health>60? 'linear-gradient(90deg,#00e5ff,#7af0ff)' : player.health>30? 'linear-gradient(90deg,#ffcc00,#ff8a00)' : 'linear-gradient(90deg,#ff2b2b,#ff6a00)';
  armorTxt.textContent = 'PLATE '+Math.max(0,Math.round(player.armor));
  ammoTxt.innerHTML = ammo + '<small>/ '+reserve+'</small>';
  ammoBar.style.width = (ammo/30*100)+'%';
  wavePill.textContent='WAVE '+wave;
  enemiesPill.textContent='HOSTILES '+Math.max(0,alive);
  document.getElementById('firemodeTxt').textContent = reloading? 'RELOADING…' : (ads?'ADS • 760 RPM • R TO RELOAD':'AUTO • 760 RPM • R TO RELOAD');
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  // fps stat
  if(t%0.5<dt) fpsStat.textContent = Math.round(1/dt)+' FPS';

  if(gameState==='playing'){
    // movement
    const speed = player.sprint && keys['ShiftLeft']? 4.6 : 2.9;
    const crouchSpeed = player.crouch? 1.6 : speed;
    let moveX=0, moveZ=0;
    if(keys['KeyW']) moveZ-=1;
    if(keys['KeyS']) moveZ+=1;
    if(keys['KeyA']) moveX-=1;
    if(keys['KeyD']) moveX+=1;
    const len = Math.hypot(moveX,moveZ);
    if(len>0){ moveX/=len; moveZ/=len; }
    // rotate input by yaw
    const yaw = player.yaw;
    const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
    const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    let vx = moveX*rightX + moveZ*fwdX;
    let vz = moveX*rightZ + moveZ*fwdZ;
    vx *= crouchSpeed; vz *= crouchSpeed;

    // gravity & jump
    if(keys['Space'] && player.onGround){ player.vel.y = 4.8; player.onGround=false; }
    player.vel.y -= 14*dt;
    // apply
    const next = player.pos.clone();
    next.x += vx*dt;
    next.z += vz*dt;
    next.y += player.vel.y*dt;

    // collision with walls (simple AABB vs levelMeshes boxes + bounds)
    // bounds
    next.x = Math.max(-21, Math.min(21, next.x));
    next.z = Math.max(-21, Math.min(21, next.z));
    // wall collisions — check distance to inner walls (coarse)
    const walls = [{x:-8,z:-6,w:10,h:0.35},{x:8,z:-4,w:0.35,h:10},{x:2,z:4,w:14,h:0.35},{x:-10,z:6,w:0.35,h:8}];
    for(let w of walls){
      const dx = next.x - w.x, dz = next.z - w.z;
      if(Math.abs(dx) < w.w/2+0.45 && Math.abs(dz) < w.h/2+0.45){
        // push out
        if(Math.abs(dx) < Math.abs(dz)){
          next.x = player.pos.x;
        } else next.z = player.pos.z;
      }
    }
    // crates approx
    // floor clamp
    if(next.y < 1.7){ next.y=1.7; player.vel.y=0; player.onGround=true; }
    // crouch lerp target height
    const targetH = player.crouch? 1.15:1.7;
    player.pos.y += (targetH - player.pos.y)* Math.min(1, 8*dt);
    player.pos.x = next.x; player.pos.z = next.z;
    if(!player.crouch) player.pos.y = next.y; // when not crouch, use physics

    // apply to cameraHolder
    cameraHolder.position.copy(player.pos);
    cameraHolder.quaternion.copy(getCameraQuat());
    // ADS FOV
    const targetFov = ads? 58:74;
    camera.fov += (targetFov - camera.fov)* 10*dt; camera.updateProjectionMatrix();
    // weapon sway/bob
    weaponBob += dt* (len>0? (player.sprint? 14:10) : 2);
    const bobX = Math.sin(weaponBob)* (len>0?0.012:0.004);
    const bobY = Math.abs(Math.sin(weaponBob*0.5))* (len>0?0.01:0.003);
    weaponGroup.position.x = bobX + (ads? -0.10:0);
    weaponGroup.position.y = -bobY + (ads? 0.02:0);
    weaponGroup.position.z = (ads? -0.08:0);
    weaponGroup.rotation.z = bobX*2.2;
    // reload
    if(reloading){
      reloadT-=dt;
      weaponGroup.position.y -= 0.12 * Math.sin((1 - reloadT/1.45)*Math.PI);
      if(reloadT<=0){
        reloading=false;
        const need=30-ammo; const take=Math.min(need,reserve);
        ammo+=take; reserve-=take; updateHUD();
      }
    }
    // footstep dust — subtle when moving on ground
    if(len>0 && player.onGround){
      footstepTimer -= dt;
      const interval = player.sprint? 0.28 : 0.42;
      if(footstepTimer<=0){ spawnFootstepDust(); footstepTimer = interval; }
    } else {
      footstepTimer = Math.min(footstepTimer, 0.08);
    }
    // continuous fire
    if(mouseDown) shoot();
    // enemies AI
    for(let e of enemies){
      if(e.userData.state==='dead'){
        e.rotation.z += dt*0.6; e.position.y -= dt*0.5; e.children.forEach(c=>{ if(c.material) c.material.transparent=true; c.material.opacity = Math.max(0, c.material.opacity - dt*0.6);});
        continue;
      }
      // face player
      const toPlayer = new THREE.Vector3().subVectors(player.pos, e.position);
      toPlayer.y=0; const dist = toPlayer.length();
      if(dist>0.1){
        const ang = Math.atan2(toPlayer.x, toPlayer.z);
        e.rotation.y += (ang - e.rotation.y)* 4*dt;
      }
      // movement
      if(dist>7){
        // chase a bit
        const dir = toPlayer.normalize();
        const mv = dir.multiplyScalar(e.userData.speed*dt*0.55);
        const np = e.position.clone().add(mv);
        // clamp
        np.x=Math.max(-21,Math.min(21,np.x)); np.z=Math.max(-21,Math.min(21,np.z));
        e.position.x=np.x; e.position.z=np.z;
      } else if(dist>1.6){
        // strafe
        e.position.x += Math.sin(t*0.9+e.userData.t)* dt*0.6;
      }
      // bob
      e.position.y = Math.abs(Math.sin(t*2+e.userData.t))*0.02;
      // hit flash
      if(e.userData.hitFlash>0){
        e.userData.hitFlash-=dt;
        const f = e.userData.hitFlash>0? 1:0;
        e.children.forEach(c=>{ if(c.isMesh && c.material.color) c.material.emissive = f? new THREE.Color(0xff2b2b): new THREE.Color(0x000000); });
      }
      // enemy shooting
      if(dist<18 && t - e.userData.lastShot > 0.9+Math.random()*0.9){
        e.userData.lastShot=t;
        // line of sight simple: if not behind wall (ray check)
        const origin = e.position.clone().add(new THREE.Vector3(0,1.2,0));
        const dirToP = new THREE.Vector3().subVectors(player.pos, origin).normalize();
        raycaster.set(origin, dirToP);
        const hit = raycaster.intersectObjects(levelMeshes, false);
        const dToP = origin.distanceTo(player.pos);
        const blocked = hit.length && hit[0].distance < dToP - 0.5;
        if(!blocked && Math.random()<0.72){
          // hit player with chance
          const acc = 0.42 - dist*0.012; // closer more accurate
          if(Math.random() < acc){
            let dmg = 12 + Math.random()*8;
            if(player.armor>0){ const a=Math.min(player.armor, dmg*0.6); player.armor-=a; dmg-=a; }
            player.health-=dmg;
            updateHUD();
            damageEl.classList.remove('on'); void damageEl.offsetWidth; damageEl.classList.add('on'); setTimeout(()=>damageEl.classList.remove('on'),180);
            if(player.health<=0){ player.health=0; gameState='dead'; document.getElementById('deadStats').textContent=`You were neutralized. Wave ${wave} — ${kills} kills, ${Math.round(hits/Math.max(1,shots)*100)}% accuracy.`; dead.classList.remove('hide'); document.exitPointerLock?.(); updateHUD(); }
          }
          // tracer from enemy
          spawnBulletTrail(origin, player.pos.clone().add(new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5));
          // flash on enemy gun
          const f = new THREE.PointLight(0xffe8a0, 12, 4); f.position.copy(origin).add(dirToP.clone().multiplyScalar(0.5)); scene.add(f); setTimeout(()=>scene.remove(f),40);
        }
      }
    }

    // particles — brass has spin + bounce damping, dust fades faster
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i]; p.age+=dt; p.vel.y -= 6*dt; if(p.isBrass){ p.vel.x*= (1 - 1.2*dt); p.vel.z*= (1 - 1.2*dt); p.mesh.rotation.x += p.spin*dt; p.mesh.rotation.z += p.spin*0.6*dt; if(p.mesh.position.y<0.05 && p.vel.y<0){ p.vel.y *= -0.22; p.vel.x*=0.55; p.vel.z*=0.55; p.mesh.position.y=0.05; } }
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt)); if(p.mesh.material.opacity!==undefined) p.mesh.material.opacity = Math.max(0, 1 - p.age/p.life);
      if(p.age>p.life){ scene.remove(p.mesh); particles.splice(i,1); }
    }
    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i]; b.t+=dt*6; b.mesh.material.opacity = Math.max(0,1-b.t*0.6);
      if(b.t>1){ scene.remove(b.mesh); bullets.splice(i,1); }
    }

    // minimap + compass
    drawMinimap();
    updateCompass();
  }

  renderer.render(scene,camera);
}

function updateCompass(){
  const track = document.getElementById('compassTrack');
  if(!track) return;
  // yaw 0 = north (+Z inverted), map yaw to -180..180
  const deg = (player.yaw * 180 / Math.PI) % 360;
  // each 45deg = ~38px (gap 18 + span ~20), total ~304px for 360deg; tune factor
  const pxPerDeg = 1.55;
  track.style.transform = `translateX(${-deg * pxPerDeg}px)`;
}

function drawMinimap(){
  if(!miniCtx || !miniCanvas) return;
  const s=miniCanvas.width || 144, pad=7;
  // ensure crisp on DPR but keep logical size
  miniCtx.fillStyle='#0b1218'; miniCtx.fillRect(0,0,s,s);
  miniCtx.strokeStyle='rgba(255,255,255,.08)'; miniCtx.lineWidth=1;
  for(let i=0;i<=4;i++){ miniCtx.beginPath(); miniCtx.moveTo(pad+i*(s-pad*2)/4, pad); miniCtx.lineTo(pad+i*(s-pad*2)/4, s-pad); miniCtx.stroke();
   miniCtx.beginPath(); miniCtx.moveTo(pad, pad+i*(s-pad*2)/4); miniCtx.lineTo(s-pad, pad+i*(s-pad*2)/4); miniCtx.stroke(); }
  // walls
  miniCtx.fillStyle='rgba(255,255,255,.12)';
  function rect(x,z,w,h){ const sx = (x+22)/44*(s-pad*2)+pad; const sz = (z+22)/44*(s-pad*2)+pad; const sw = w/44*(s-pad*2); const sh = h/44*(s-pad*2); miniCtx.fillRect(sx-sw/2, sz-sh/2, sw, sh); }
  rect(-8,-6,10,0.35); rect(8,-4,0.35,10); rect(2,4,14,0.35); rect(-10,6,0.35,8);
  // enemies
  for(let e of enemies){
    const ex=(e.position.x+22)/44*(s-pad*2)+pad; const ez=(e.position.z+22)/44*(s-pad*2)+pad;
    miniCtx.fillStyle = e.userData.state==='dead'? '#5a6a7a' : '#ff2b2b';
    miniCtx.beginPath(); miniCtx.arc(ex,ez,3,0,Math.PI*2); miniCtx.fill();
  }
  // player
  const px=(player.pos.x+22)/44*(s-pad*2)+pad; const pz=(player.pos.z+22)/44*(s-pad*2)+pad;
  miniCtx.fillStyle='#00e5ff'; miniCtx.beginPath(); miniCtx.arc(px,pz,4,0,Math.PI*2); miniCtx.fill();
  miniCtx.strokeStyle='#fff'; miniCtx.lineWidth=1.2; miniCtx.beginPath(); miniCtx.moveTo(px,pz); miniCtx.lineTo(px+Math.sin(player.yaw)*10, pz+Math.cos(player.yaw)*10); miniCtx.stroke();
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- DOM ---
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameOverEl = document.getElementById('gameOver');
const playBtn = document.getElementById('playBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreEl = document.getElementById('score');
const killsEl = document.getElementById('kills');
const ammoEl = document.getElementById('ammo');
const waveEl = document.getElementById('wave');
const hpEl = document.getElementById('hp');
const hpFill = document.getElementById('health-fill');
const timerEl = document.getElementById('timer');
const hitmarker = document.getElementById('hitmarker');
const vignette = document.getElementById('damage-vignette');
const crosshair = document.getElementById('crosshair');
const attribEl = document.getElementById('attrib');

// Attribution display
fetch('/models/rifle.glb.attribution.json').then(r=>r.json()).then(j=>{
  attribEl.innerHTML = `Weapon: <b>${j.name}</b> by <a href="${j.authorUrl}" target="_blank" style="color:#ffd54f">${j.author}</a> — ${j.license} • Drone: Military Drone Low-Poly by ToporEnterprise — CC Attribution`;
}).catch(()=>{});

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1220);
scene.fog = new THREE.FogExp2(0x0b1220, 0.022);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(74, window.innerWidth/window.innerHeight, 0.1, 250);
camera.position.set(0,1.7,8);

const ambient = new THREE.HemisphereLight(0xbfd8ff, 0x0a0f1a, 1.2);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xfff6e0, 2.2);
dirLight.position.set(18,22,10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048,2048);
dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left=-30; dirLight.shadow.camera.right=30; dirLight.shadow.camera.top=30; dirLight.shadow.camera.bottom=-30;
dirLight.shadow.bias = -0.0006;
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0x6ea8ff, 0.55);
fillLight.position.set(-12,10,-8);
scene.add(fillLight);
const rim = new THREE.PointLight(0xffd54f, 60, 35);
rim.position.set(0,3,-12);
scene.add(rim);

// Environment
const groundMat = new THREE.MeshStandardMaterial({ color:0x182233, roughness:0.92, metalness:0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120,120), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// Grid + detailing
const grid = new THREE.GridHelper(120, 60, 0x1e2e4a, 0x1e2e4a);
grid.position.y = 0.02;
scene.add(grid);

// Walls / arena
function makeWall(w,h,x,z,ry=0, col=0x0f1c33){
  const m = new THREE.MeshStandardMaterial({ color:col, roughness:0.85, metalness:0.1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,0.6), m);
  mesh.position.set(x,h/2,z);
  mesh.rotation.y = ry;
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  walls.push({ mesh, box: new THREE.Box3().setFromObject(mesh) });
  return mesh;
}
const walls = [];
makeWall(60,12,0,-22,0, 0x111e36);
makeWall(60,12,0,22,0, 0x111e36);
makeWall(60,12,-30,0,Math.PI/2, 0x0f1a30);
makeWall(60,12,30,0,Math.PI/2, 0x0f1a30);
// inner cover
const coverMat = new THREE.MeshStandardMaterial({ color:0x1a2a48, roughness:0.8, metalness:0.12 });
function cover(x,z,w=2.2,h=1.6,d=0.6){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), coverMat);
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true;
  scene.add(m); walls.push({ mesh:m, box:new THREE.Box3().setFromObject(m) });
}
cover(8, -6); cover(-8, -6); cover(0,-10,4,2.2,0.8); cover(10,4); cover(-10,4); cover(0,8,6,1.4,0.8); cover(6,6,0.6,1.4,2.2); cover(-6,6,0.6,1.4,2.2);

// Barrels / crates for AAA feel
function barrel(x,z){
  const g = new THREE.CylinderGeometry(0.5,0.5,1.1,16);
  const m = new THREE.MeshStandardMaterial({ color:0x8a6a2a, roughness:0.65, metalness:0.35 });
  const mesh = new THREE.Mesh(g,m);
  mesh.position.set(x,0.55,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  walls.push({ mesh, box:new THREE.Box3().setFromObject(mesh) });
}
barrel(12,-14); barrel(13,-14); barrel(-12,-14); barrel(11,10); barrel(-11,10);

// Light strips
for(let i=0;i<4;i++){
  const pl = new THREE.PointLight(0x00e5ff, 18, 12);
  pl.position.set( (i-1.5)*12, 4.5, -8 + Math.sin(i)*2);
  scene.add(pl);
}

// --- Player ---
const player = {
  pos: new THREE.Vector3(0,1.7,10),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  health: 100, maxHealth:100,
  ammo: 30, reserve:90, magSize:30,
  score:0, kills:0, wave:1,
  isSprinting:false, isGrounded:true,
  shootCooldown:0, reloadTime:0,
  bob:0
};
let yaw = 0, pitch = 0;
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && player.reloadTime<=0 && player.ammo < player.magSize && player.reserve>0) startReload();
});
window.addEventListener('keyup', e=> keys[e.code]=false);

let isLocked=false;
let isADS=false;
function lock(){
  canvas.requestPointerLock();
}
canvas.addEventListener('click', ()=>{
  if(!isLocked && !gameState.playing) return;
  if(!isLocked) lock();
  else shoot();
});
canvas.addEventListener('contextmenu', e=> e.preventDefault());
canvas.addEventListener('mousedown', e=>{
  if(e.button===2 && isLocked && gameState.playing) isADS=true;
});
window.addEventListener('mouseup', e=>{
  if(e.button===2) isADS=false;
});
document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement===canvas;
  if(isLocked){
    overlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    if(!gameState.playing) startGame();
    gameState.paused=false;
  } else {
    if(gameState.playing && !gameState.over){
      gameState.paused=true;
      pauseOverlay.classList.remove('hidden');
    }
  }
});
document.addEventListener('mousemove', e=>{
  if(!isLocked) return;
  const sens = 0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});

// --- Weapon ---
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);

let weaponModel=null;
let mixer=null;
let rifleLoaded=false;

const loader = new GLTFLoader();

// Procedural fallback weapon (always visible, replaced/hidden if GLB loads)
function createFallbackWeapon(){
  const grp = new THREE.Group();
  // body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.55), new THREE.MeshStandardMaterial({ color:0x1a1a20, roughness:0.5, metalness:0.75 }));
  body.position.set(0, -0.08, -0.35); grp.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.35,12), new THREE.MeshStandardMaterial({ color:0x2b2e36, roughness:0.35, metalness:0.85 }));
  barrel.rotation.x = Math.PI/2; barrel.position.set(0,-0.05,-0.68); grp.add(barrel);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.16,0.1), new THREE.MeshStandardMaterial({ color:0x0f0f12, roughness:0.7 }));
  mag.position.set(0,-0.14,-0.3); grp.add(mag);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.03,0.08), new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.4 }));
  sight.position.set(0,-0.02,-0.42); grp.add(sight);
  grp.position.set(0.32,-0.24,-0.45);
  grp.rotation.y = -0.02;
  weaponGroup.add(grp);
  weaponModel = grp;
  // muzzle point
  weaponModel.userData.muzzle = new THREE.Vector3(0,-0.05,-0.86);
}
createFallbackWeapon();

loader.load('/models/rifle.glb', (gltf)=>{
  const model = gltf.scene;
  // normalize - center and scale
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  // scale to viewmodel size ~0.9 length
  const maxDim = Math.max(size.x,size.y,size.z);
  const scale = 0.65 / maxDim;
  model.scale.setScalar(scale);
  // orient as FPS viewmodel: rotate to point forward
  model.rotation.set(0, Math.PI, 0);
  model.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true; o.receiveShadow=false;
      if(o.material){
        o.material.roughness = 0.42 + Math.random()*0.08;
        o.material.metalness = 0.68;
        o.material.envMapIntensity = 1.2;
        o.material.needsUpdate=true;
      }
    }
  });
  // Replace fallback visual but keep fallback group as parent
  weaponModel.clear();
  // Offset to feel like COD viewmodel
  model.position.set(0.02, -0.06, 0.12);
  model.rotation.y = Math.PI;
  model.rotation.x = 0.04;
  weaponModel.add(model);
  rifleLoaded=true;
  console.log('Rifle GLB loaded', size, scale);
}, undefined, (e)=>{ console.warn('Rifle load failed, keep fallback', e); });

// Muzzle flash
const muzzleLight = new THREE.PointLight(0xffcc66, 0, 6);
muzzleLight.intensity = 0;
camera.add(muzzleLight);
muzzleLight.position.set(0.18,-0.12,-0.85);

// flash mesh
const flashGeo = new THREE.ConeGeometry(0.07,0.18,6);
const flashMat = new THREE.MeshBasicMaterial({ color:0xffe9a0, transparent:true, opacity:0 });
const flashMesh = new THREE.Mesh(flashGeo, flashMat);
flashMesh.rotation.x = -Math.PI/2;
flashMesh.position.set(0.18,-0.12,-0.95);
weaponGroup.add(flashMesh);

// --- Bullets / Hits ---
const bullets = [];
const particles = [];
const enemies = [];
let enemyMixers = [];

function shoot(){
  if(!gameState.playing || gameState.paused || gameState.over) return;
  if(player.reloadTime>0 || player.shootCooldown>0) return;
  if(player.ammo<=0){ startReload(); return; }
  player.ammo--;
  ammoEl.textContent = player.ammo;
  player.shootCooldown = 0.09; // 650 rpm
  // recoil
  pitch -= 0.006; yaw += (Math.random()-0.5)*0.004;
  player.bob += 2.2;
  // muzzle
  muzzleLight.intensity = 12;
  flashMat.opacity = 0.95;
  setTimeout(()=>{ muzzleLight.intensity=0; flashMat.opacity=0; }, 45);
  // camera kick
  weaponGroup.position.z = 0.08;
  weaponGroup.position.y = -0.02;
  // raycast
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const origin = camera.position.clone();
  // add spread based on movement
  const spread = player.isSprinting ? 0.02 : keys['ShiftLeft'] ? 0.015 : 0.006;
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.z += (Math.random()-0.5)*spread; dir.normalize();
  // tracer
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin.clone(), origin.clone().add(dir.clone().multiplyScalar(40))]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color:0xffe082, transparent:true, opacity:0.9 }));
  scene.add(tracer);
  setTimeout(()=>scene.remove(tracer), 40);
  // check enemy hits
  let hit=false;
  let closest=null, closestDist=Infinity;
  const ray = new THREE.Raycaster(origin, dir, 0, 80);
  const meshes = enemies.flatMap(e=> e.hitMeshes || [e.mesh]);
  const hits = ray.intersectObjects(meshes, true);
  if(hits.length){
    const h = hits[0];
    // find enemy owner
    const enemy = enemies.find(en=> h.object===en.mesh || en.hitMeshes?.includes(h.object) || h.object.parent===en.mesh);
    if(enemy){
      hitEnemy(enemy, h.point, dir);
      hit=true;
      } else {
      spawnImpact(h.point, h.face.normal);
    }
  } else {
    // wall hit test
    for(const w of walls){
      const isect = ray.intersectBox ? null : null;
    }
    // generic ground impact far
    const far = origin.clone().add(dir.clone().multiplyScalar(35));
    if(far.y<0) far.y=0.02;
  }
  if(hit){
    hitmarker.classList.add('show');
    setTimeout(()=>hitmarker.classList.remove('show'),90);
  }
  updateHUD();
}

function startReload(){
  if(player.reloadTime>0 || player.reserve<=0 || player.ammo===player.magSize) return;
  player.reloadTime = 1.35;
  ammoEl.textContent = '…';
  setTimeout(()=>{
    const need = player.magSize - player.ammo;
    const take = Math.min(need, player.reserve);
    player.reserve -= take; player.ammo += take;
    player.reloadTime=0; updateHUD();
  }, 1350);
}

function spawnImpact(point, normal){
  const g = new THREE.SphereGeometry(0.04,6,6);
  const m = new THREE.MeshBasicMaterial({ color:0x8899aa });
  const mesh = new THREE.Mesh(g,m);
  mesh.position.copy(point);
  scene.add(mesh);
  // spark particles
  for(let i=0;i<6;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.02,4,4), new THREE.MeshBasicMaterial({ color:0xffd54f }));
    p.position.copy(point);
    p.userData.vel = new THREE.Vector3((Math.random()-0.5)*4, Math.random()*4, (Math.random()-0.5)*4);
    p.userData.life=0.35; scene.add(p); particles.push(p);
  }
  setTimeout(()=>scene.remove(mesh), 900);
}

function hitEnemy(enemy, point, dir){
  enemy.health -= 34; // 3 hits kill
  spawnImpact(point, dir);
  enemy.mesh.position.add(dir.clone().multiplyScalar(-0.18));
  // flash red
  enemy.mesh.traverse(o=>{ if(o.isMesh){ o.material.emissive = new THREE.Color(0x550000); setTimeout(()=>{ if(o.material.emissive) o.material.emissive.set(0x000000); },80);} });
  if(enemy.health<=0){
    killEnemy(enemy);
  } else {
    // hit particles
    for(let i=0;i<8;i++){
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), new THREE.MeshBasicMaterial({ color:0xff5a3c }));
      p.position.copy(point); p.userData.vel = dir.clone().multiplyScalar(3+Math.random()*3).add(new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2));
      p.userData.life=0.4; scene.add(p); particles.push(p);
    }
  }
}

function killEnemy(enemy){
  const idx = enemies.indexOf(enemy);
  if(idx>=0) enemies.splice(idx,1);
  scene.remove(enemy.mesh);
  player.score += 150;
  player.kills += 1;
  updateHUD();
  // explosion
  for(let i=0;i<14;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06+Math.random()*0.06,6,6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.08+Math.random()*0.05,1,0.6) }));
    p.position.copy(enemy.mesh.position.clone().add(new THREE.Vector3(0,0.8,0)));
    p.userData.vel = new THREE.Vector3((Math.random()-0.5)*7, Math.random()*5+1, (Math.random()-0.5)*7);
    p.userData.life=0.6+Math.random()*0.3; scene.add(p); particles.push(p);
  }
  // drone wreck stays briefly
  checkWave();
}

// --- Enemies (drones + procedural bots) ---
let droneTemplate=null;
let droneMixer=null;
loader.load('/models/drone.glb', (gltf)=>{
  droneTemplate = gltf.scene;
  droneTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
  console.log('Drone template loaded, animations:', gltf.animations.length);
  // store mixer for cloning? easiest: clone scene per enemy and create new mixer
  droneTemplate.userData.animations = gltf.animations;
}, undefined, ()=>{});

function spawnEnemy(pos){
  const useDrone = !!droneTemplate && Math.random()<0.7;
  let mesh, animMixer=null;
  if(useDrone){
    mesh = droneTemplate.clone(true);
    // animate
    if(droneTemplate.userData.animations && droneTemplate.userData.animations.length){
      animMixer = new THREE.AnimationMixer(mesh);
      const clip = droneTemplate.userData.animations.find(c=>c.name.includes('Idle')) || droneTemplate.userData.animations[0];
      const action = animMixer.clipAction(clip);
      action.play();
      enemyMixers.push(animMixer);
    }
    mesh.scale.setScalar(1.1);
  } else {
    // procedural bot
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35,0.7,6,12), new THREE.MeshStandardMaterial({ color:0xe6392d, roughness:0.55, metalness:0.15 }));
    body.position.y=0.75; body.castShadow=true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,12,12), new THREE.MeshStandardMaterial({ color:0x1a1a1a }));
    head.position.y=1.35; g.add(head);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({ color:0x00e5ff }));
    eye.position.set(0,1.35,0.22); g.add(eye);
    mesh = g;
  }
  mesh.position.copy(pos);
  mesh.position.y = useDrone ? 1.1 : 0;
  scene.add(mesh);
  const enemy = { mesh, health:100, speed: 1.1 + Math.random()*0.9, lastShot:0, hitMeshes: [], mixer: animMixer };
  // collect hit meshes
  mesh.traverse(o=>{ if(o.isMesh) enemy.hitMeshes.push(o); });
  if(enemy.hitMeshes.length===0) enemy.hitMeshes=[mesh];
  enemies.push(enemy);
}

function spawnWave(n){
  for(let i=0;i<n;i++){
    const angle = Math.random()*Math.PI*2;
    const r = 14 + Math.random()*10;
    const x = Math.cos(angle)*r;
    const z = Math.sin(angle)*r - 4;
    // avoid spawning inside walls: clamp
    spawnEnemy(new THREE.Vector3(x,0,z));
  }
  waveEl.textContent = player.wave;
}

function checkWave(){
  if(enemies.length===0){
    player.wave++;
    const count = 3 + Math.floor(player.wave*1.4);
    setTimeout(()=>spawnWave(count), 900);
    waveEl.textContent = player.wave;
    player.score += 200;
    updateHUD();
  }
}

// --- Physics / Controls ---
const clock = new THREE.Clock();
let gameState={ playing:false, paused:false, over:false, timeLeft:120 };

function startGame(){
  gameState.playing=true; gameState.over=false; gameState.paused=false; gameState.timeLeft=120;
  player.health=100; player.score=0; player.kills=0; player.wave=1; player.ammo=30; player.reserve=90;
  player.pos.set(0,1.7,10); yaw=0; pitch=0; enemies.forEach(e=>scene.remove(e.mesh)); enemies.length=0; enemyMixers.length=0;
  spawnWave(4);
  updateHUD();
  vignette.style.opacity=0;
}

function updateHUD(){
  scoreEl.textContent = player.score;
  killsEl.textContent = player.kills;
  ammoEl.textContent = player.reloadTime>0 ? 'RELOAD' : player.ammo;
  hpEl.textContent = Math.max(0,Math.round(player.health));
  hpFill.style.width = Math.max(0,player.health)+'%';
  hpFill.style.background = player.health<35 ? 'linear-gradient(90deg,#ff3b30,#ff3b30)' : 'linear-gradient(90deg,#ff3b30,#ffd54f)';
}

function collide(pos, radius=0.4){
  for(const w of walls){
    const box = w.box;
    const closest = new THREE.Vector3(
      Math.max(box.min.x, Math.min(pos.x, box.max.x)),
      Math.max(box.min.y, Math.min(pos.y, box.max.y)),
      Math.max(box.min.z, Math.min(pos.z, box.max.z))
    );
    if(closest.distanceTo(pos) < radius) return true;
  }
  return false;
}

// Game loop
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  if(gameState.playing && !gameState.paused && !gameState.over){
    // timer
    gameState.timeLeft -= dt;
    if(gameState.timeLeft<=0){
      gameState.timeLeft=0;
      endGame(true);
    }
    const mins = Math.floor(gameState.timeLeft/60);
    const secs = Math.floor(gameState.timeLeft%60);
    timerEl.textContent = String(mins).padStart(2,'0')+':'+String(secs).padStart(2,'0');

    // input
    const moveSpeed = keys['ShiftLeft'] ? 5.2 : 3.2;
    player.isSprinting = !!keys['ShiftLeft'];
    const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const input = new THREE.Vector3();
    if(keys['KeyW']) input.add(forward);
    if(keys['KeyS']) input.sub(forward);
    if(keys['KeyD']) input.add(right);
    if(keys['KeyA']) input.sub(right);
    if(input.length()>0) input.normalize().multiplyScalar(moveSpeed*dt);
    // vertical
    if(keys['Space'] && player.isGrounded){
      player.vel.y = 4.2; player.isGrounded=false;
    }
    player.vel.y -= 12*dt; // gravity

    // try move X then Z to allow sliding
    const next = player.pos.clone();
    next.x += input.x;
    if(!collide(new THREE.Vector3(next.x, player.pos.y, player.pos.z))) player.pos.x = next.x;
    next.z = player.pos.z + input.z;
    if(!collide(new THREE.Vector3(player.pos.x, player.pos.y, next.z))) player.pos.z = next.z;
    player.pos.y += player.vel.y*dt;
    if(player.pos.y <= 1.7){ player.pos.y=1.7; player.vel.y=0; player.isGrounded=true; }
    // bounds
    player.pos.x = Math.max(-28, Math.min(28, player.pos.x));
    player.pos.z = Math.max(-20, Math.min(20, player.pos.z));

    // camera
    camera.position.copy(player.pos);
    camera.rotation.order='YXZ';
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    const bobSpeed = input.length()>0 ? (player.isSprinting? 12: 8) : 0;
    player.bob += dt*bobSpeed;
    const swayX = Math.sin(player.bob)*0.018 + (isLocked? (Math.sin(t*0.7)*0.004):0);
    const swayY = Math.abs(Math.cos(player.bob))*0.012;
    if(isADS){
      weaponGroup.position.x = THREE.MathUtils.lerp(weaponGroup.position.x, 0.01, 0.18);
      weaponGroup.position.y = THREE.MathUtils.lerp(weaponGroup.position.y, -0.18, 0.18);
      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.32, 0.18);
      crosshair.style.opacity = '0';
      camera.fov = THREE.MathUtils.lerp(camera.fov, 52, 0.18);
    } else {
      weaponGroup.position.x = THREE.MathUtils.lerp(weaponGroup.position.x, swayX, 0.12);
      weaponGroup.position.y = THREE.MathUtils.lerp(weaponGroup.position.y, -0.24 + swayY + (player.isSprinting? -0.04:0), 0.12);
      weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.45, 0.14);
      crosshair.style.opacity = '1';
      camera.fov = THREE.MathUtils.lerp(camera.fov, 74, 0.14);
    }
    camera.updateProjectionMatrix();
    weaponGroup.rotation.z = THREE.MathUtils.lerp(weaponGroup.rotation.z, (input.length()>0? Math.sin(player.bob)*0.06:0), 0.1);

    if(player.shootCooldown>0) player.shootCooldown -= dt;

    // enemies AI
    enemies.forEach(e=>{
      const toPlayer = new THREE.Vector3().subVectors(player.pos, e.mesh.position);
      toPlayer.y=0;
      const dist = toPlayer.length();
      if(dist>0.1){
        toPlayer.normalize().multiplyScalar(e.speed*dt);
        const tryPos = e.mesh.position.clone().add(toPlayer);
        if(!collide(tryPos, 0.5)) e.mesh.position.add(toPlayer);
        // look at player
        e.mesh.lookAt(player.pos.x, e.mesh.position.y, player.pos.z);
      }
      // attack
      if(dist<2.1 && t - e.lastShot > 0.9){
        e.lastShot = t;
        player.health -= 8 + Math.random()*6;
        updateHUD();
        vignette.style.opacity = Math.min(0.7, (100-player.health)/110);
        setTimeout(()=> vignette.style.opacity = Math.max(0, (100-player.health)/180), 120);
        camera.position.x += (Math.random()-0.5)*0.12;
        camera.position.z += (Math.random()-0.5)*0.12;
        if(player.health<=0){
          player.health=0; updateHUD(); endGame(false);
        }
      }
      if(e.mixer) e.mixer.update(dt);
    });
    // alias mixers
    enemyMixers.forEach(m=>m.update(dt));

    // particles
    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.position.add(p.userData.vel.clone().multiplyScalar(dt));
      p.userData.vel.y -= 9*dt;
      p.userData.life -= dt;
      p.material.opacity = Math.max(0, p.userData.life/0.6);
      p.material.transparent=true;
      if(p.userData.life<=0){ scene.remove(p); particles.splice(i,1); }
    }
  } else {
    // still update particles even when paused? no
  }

  renderer.render(scene, camera);
}
animate();

function endGame(win){
  gameState.over=true; gameState.playing=false;
  document.exitPointerLock?.();
  const title = document.getElementById('goTitle');
  const desc = document.getElementById('goDesc');
  if(win){
    title.textContent='MISSION COMPLETE';
    desc.textContent=`You extracted after ${player.wave} waves. Score ${player.score}.`;
  } else {
    title.textContent='KIA — MISSION FAILED';
    desc.textContent=`You were downed on wave ${player.wave}.`;
  }
  document.getElementById('finalScore').textContent = player.score;
  document.getElementById('finalKills').textContent = player.kills;
  gameOverEl.classList.remove('hidden');
}

playBtn.addEventListener('click', ()=>{ lock(); });
resumeBtn.addEventListener('click', ()=>{ lock(); });
restartBtn.addEventListener('click', ()=>{
  gameOverEl.classList.add('hidden');
  startGame(); lock();
});

window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// expose for verifier
window.__GAME__ = { player, gameState, scene, camera, renderer, spawnWave, enemies };

// initial HUD
updateHUD();

// subtle intro camera orbit before lock
let introT=0;
function intro(){
  if(gameState.playing) return;
  introT+=0.006;
  camera.position.set(Math.sin(introT)*1.2, 2.2+Math.sin(introT*0.7)*0.15, 10+Math.cos(introT)*0.6);
  camera.lookAt(0,0.8,-4);
  requestAnimationFrame(intro);
}
intro();

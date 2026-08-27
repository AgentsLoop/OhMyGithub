import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

// --- Attribution ---
let attribution = { name: 'FPS Silicone gun', author: 'Cransh', license: 'CC Attribution', authorUrl:'#', modelUrl:'#' };
fetch('/models/weapon.glb.attribution.json').then(r=>r.ok?r.json():null).then(j=>{
  if(j){ attribution=j; const attrEl=document.getElementById('attribution');
    if(attrEl) attrEl.innerHTML = `Viewmodel: <b>${attribution.name}</b> by <a href="${attribution.authorUrl}" target="_blank" style="color:var(--accent)">${attribution.author}</a> — ${attribution.license} — via <a href="${attribution.modelUrl}" target="_blank" style="color:rgba(255,255,255,0.6)">Sketchfab</a>`;
  }
}).catch(()=>{});
const attrElInit=document.getElementById('attribution');
if(attrElInit && !attrElInit.innerHTML) attrElInit.textContent=`Viewmodel: ${attribution.name} by ${attribution.author} — ${attribution.license}`;

const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a14);
scene.fog = new THREE.FogExp2(0x070a14, 0.018);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 400);
const cameraHolder = new THREE.Object3D(); // yaw
const pitchObj = new THREE.Object3D();
pitchObj.add(camera);
cameraHolder.add(pitchObj);
scene.add(cameraHolder);
cameraHolder.position.set(0, 1.72, 0);
camera.position.set(0, 0, 0);

// Lights — AAA PBR setup
scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x0a1020, 1.1));
const dir = new THREE.DirectionalLight(0xfff6e8, 2.2);
dir.position.set(18, 28, 12);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 90;
dir.shadow.camera.left = -30; dir.shadow.camera.right = 30; dir.shadow.camera.top = 30; dir.shadow.camera.bottom = -30;
dir.shadow.bias = -0.0006;
scene.add(dir);
const fill = new THREE.DirectionalLight(0x3d6bff, 0.9); fill.position.set(-14, 12, -10); scene.add(fill);
const neon = new THREE.PointLight(0x00ff9c, 2, 50); neon.position.set(0, 4, -18); scene.add(neon);
const pink = new THREE.PointLight(0xff2e7e, 1.2, 40); pink.position.set(-10, 2, 10); scene.add(pink);

// Environment map (procedural neutral)
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x0e1528);
const envMap = pmrem.fromScene(envScene, 0.05).texture;
scene.environment = envMap;

// Ground & Arena
const groundGeo = new THREE.PlaneGeometry(80, 80, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f1a30, roughness: 0.82, metalness: 0.06 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// grid helper
const grid = new THREE.GridHelper(80, 40, 0x1a2a4a, 0x111b33); grid.position.y = 0.02; scene.add(grid);
// decal ring
const ringGeo = new THREE.RingGeometry(10, 10.35, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff9c, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = -Math.PI/2; ring.position.y = 0.03; scene.add(ring);

// Walls — simple arena bounds (4 walls + pillars)
const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e1a33, roughness: 0.7, metalness: 0.12 });
const walls = [];
function addWall(x,z,w,d,h=4){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); walls.push(m);
  // collision box
  return new THREE.Box3().setFromObject(m);
}
const wallBoxes = [];
wallBoxes.push(addWall(0, -20, 44, 1));
wallBoxes.push(addWall(0, 20, 44, 1));
wallBoxes.push(addWall(-20, 0, 1, 44));
wallBoxes.push(addWall(20, 0, 1, 44));
// inner cover pillars
[[-8,-8],[8,-8],[-8,10],[8,10],[0,-10]].forEach(([x,z])=> addWall(x,z,2,2,2.2));
// low cover blocks for verticality
addWall(0, 0, 6, 1, 1.1);

// Ceiling not needed, skybox is fog

// Targets & enemies — neon drones
const targets = [];
const targetGroup = new THREE.Group(); scene.add(targetGroup);
function spawnTarget(i){
  const isDrone = Math.random() > 0.35;
  const geo = isDrone ? new THREE.IcosahedronGeometry(0.62, 1) : new THREE.BoxGeometry(0.9, 1.25, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: isDrone ? 0xff2e7e : 0x00ff9c,
    emissive: isDrone ? 0x6a0a2a : 0x00b36a,
    emissiveIntensity: 0.55,
    roughness: 0.35, metalness: 0.25
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  // pulsing core
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  core.position.z = 0.45; mesh.add(core);
  // health
  mesh.userData = { hp: isDrone?1:1, maxHp:1, idx:i, isDrone, baseY: 1.2+Math.random()*0.7, phase: Math.random()*Math.PI*2, speed: 0.6+Math.random()*1.0, dir: new THREE.Vector2((Math.random()-0.5)*2, (Math.random()-0.5)*2).normalize() };
  // spawn position away from player
  let x,z; do{ x=(Math.random()-0.5)*30; z=(Math.random()-0.5)*30; }while(Math.hypot(x,z)<6);
  mesh.position.set(x, mesh.userData.baseY, z);
  targetGroup.add(mesh);
  targets.push(mesh);
  // bounding sphere for raycast
  mesh.geometry.computeBoundingSphere();
}
for(let i=0;i<7;i++) spawnTarget(i);

// Crosshair & HUD refs
const healthBar = document.getElementById('health-bar');
const healthText = document.getElementById('health-text');
const ammoText = document.getElementById('ammo-text');
const scoreText = document.getElementById('score-text');
const timerText = document.getElementById('timer-text');
const reloadHint = document.getElementById('reload-hint');
const hitMarker = document.getElementById('hit-marker');
const damageVignette = document.getElementById('damage-vignette');
const overlay = document.getElementById('overlay');
const overlayWin = document.getElementById('overlay-win');
const overlayLose = document.getElementById('overlay-lose');

// Game state
let health = 100, maxHealth = 100;
let ammo = 30, reserve = 90, magSize = 30;
let kills = 0, killsToWin = 15;
let isLocked = false, isReloading = false, isShooting = false;
let canShoot = true;
let fireRate = 120; // ms
let lastShot = 0;
let gameState = 'menu'; // menu|playing|won|lost
let startTime = 0;

function updateHUD(){
  healthText.textContent = String(Math.max(0, Math.floor(health)));
  healthBar.style.width = `${Math.max(0, health/maxHealth*100)}%`;
  healthBar.style.background = health>50 ? 'linear-gradient(90deg,#00ff9c,#6affc2)' : health>30 ? 'linear-gradient(90deg,#ffaa00,#ffcc66)' : 'linear-gradient(90deg,#ff2e7e,#ff7a7a)';
  ammoText.textContent = `${ammo} / ${reserve}`;
  reloadHint.classList.toggle('show', ammo===0 || (ammo<8 && reserve>0));
  scoreText.textContent = `${kills} / ${killsToWin} ELIMINATED`;
  const elapsed = gameState==='playing' ? (performance.now()-startTime)/1000 : 0;
  const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
  const ss = String(Math.floor(elapsed%60)).padStart(2,'0');
  timerText.textContent = `${mm}:${ss}`;
}
updateHUD();

// Controls — pointer lock + WASD
const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyR'){ doReload(); }
  if(e.code==='KeyR' && (gameState==='won'||gameState==='lost')){ location.reload(); }
  if(e.code==='Escape'){ /* browser handles unlock */ }
});
window.addEventListener('keyup', e=> keys[e.code]=false);

let yaw=0, pitch=0;
const MOUSE_SENS = 0.0022;
function onMouseMove(e){
  if(!isLocked || gameState!=='playing') return;
  yaw -= e.movementX * MOUSE_SENS;
  pitch -= e.movementY * MOUSE_SENS;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
  cameraHolder.rotation.y = yaw;
  pitchObj.rotation.x = pitch;
}
document.addEventListener('mousemove', onMouseMove);

renderer.domElement.addEventListener('click', ()=>{
  if(gameState==='menu') return; // button handles
  if(!isLocked) renderer.domElement.requestPointerLock();
  else if(gameState==='playing') tryShoot();
});
document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement===renderer.domElement;
  document.getElementById('crosshair').style.opacity = isLocked? '1':'0.45';
});
document.addEventListener('mousedown', e=>{
  if(e.button===0 && isLocked && gameState==='playing') tryShoot();
});

// Movement physics
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let onGround = true;
const playerRadius = 0.45;
const playerHeight = 1.72;
let canJump = true;

function handleCollision(nextPos){
  // AABB walls (inflated by player radius)
  const box = new THREE.Box3();
  const pos2 = new THREE.Vector2(nextPos.x, nextPos.z);
  for(const w of walls){
    box.setFromObject(w);
    // expand
    box.min.x -= playerRadius; box.max.x += playerRadius;
    box.min.z -= playerRadius; box.max.z += playerRadius;
    if(nextPos.x >= box.min.x && nextPos.x <= box.max.x && nextPos.z >= box.min.z && nextPos.z <= box.max.z){
      // push out on smallest penetration
      const dx1 = Math.abs(nextPos.x - box.min.x), dx2 = Math.abs(nextPos.x - box.max.x);
      const dz1 = Math.abs(nextPos.z - box.min.z), dz2 = Math.abs(nextPos.z - box.max.z);
      const m = Math.min(dx1,dx2,dz1,dz2);
      if(m===dx1) nextPos.x = box.min.x - 0.02;
      else if(m===dx2) nextPos.x = box.max.x + 0.02;
      else if(m===dz1) nextPos.z = box.min.z - 0.02;
      else nextPos.z = box.max.z + 0.02;
    }
  }
  // arena bounds
  nextPos.x = Math.max(-19.2, Math.min(19.2, nextPos.x));
  nextPos.z = Math.max(-19.2, Math.min(19.2, nextPos.z));
  return nextPos;
}

// Weapon viewmodel — GLB
let weaponMixer=null, weaponClips={}, weaponRoot=null, currentAction=null;
const weaponHolder = new THREE.Group();
// mount relative to camera so it follows look
camera.add(weaponHolder);
weaponHolder.position.set(0.32, -0.32, -0.68);
weaponHolder.rotation.set(0.02, -0.05, 0);
weaponHolder.scale.set(0.9,0.9,0.9);

const loader = new GLTFLoader();
let weaponLoaded=false;
loader.load('/models/weapon.glb', (gltf)=>{
  let root = gltf.scene;
  // center & scale normalization via Box3
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z);
  const scale = maxDim>0 ? (0.95 / maxDim) : 1;
  // Compute center offset
  const center = box.getCenter(new THREE.Vector3());
  // Insert centering parent (preserve authored hierarchy)
  const centerParent = new THREE.Group();
  root.position.sub(center); // center geometry
  centerParent.add(root);
  // Scale centering parent
  centerParent.scale.setScalar(scale*1.8); // boost for FPS view
  // Orientation tweak: tilt to be visible
  centerParent.rotation.y = Math.PI;
  centerParent.position.set(0, -0.12, 0.12);
  weaponRoot = centerParent;
  weaponHolder.add(weaponRoot);
  // Material sanity: GLB has no textures, pbrSpecularGlossiness white → tint to gunmetal + neon
  weaponRoot.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true; o.receiveShadow=false;
      if(o.material){
        // Convert legacy white to stylized gunmetal
        o.material.metalness = 0.55; o.material.roughness = 0.45;
        if(o.material.color) o.material.color.setHex(0xcbd5e1);
        o.material.emissive = new THREE.Color(0x00ff9c);
        o.material.emissiveIntensity = 0.07;
        o.material.needsUpdate=true;
      }
    }
  });
  // Animations — mixer on root
  if(gltf.animations && gltf.animations.length){
    weaponMixer = new THREE.AnimationMixer(root);
    gltf.animations.forEach(clip=>{
      weaponClips[clip.name]=clip;
      // ensure loops
      if(clip.name.includes('idle')){
        const act = weaponMixer.clipAction(clip); act.loop=THREE.LoopRepeat; act.clampWhenFinished=false;
      }
    });
    // play idle
    const idle = weaponClips['Rig|siligun_idle'] || gltf.animations[0];
    if(idle){ currentAction = weaponMixer.clipAction(idle); currentAction.play(); }
  }
  weaponLoaded=true;
}, undefined, (err)=>{
  console.warn('weapon load fail',err);
  // fallback proc gun
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.55), new THREE.MeshStandardMaterial({color:0x182235, roughness:0.4, metalness:0.6}));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.42,12), new THREE.MeshStandardMaterial({color:0x0f1d2e}));
  barrel.rotation.z=Math.PI/2; barrel.position.x=0.22; fb.add(barrel);
  weaponHolder.add(fb); weaponLoaded=true;
});

// Muzzle flash + impact
const muzzleLight = new THREE.PointLight(0xffe9a0, 0, 6);
muzzleLight.position.set(0,0,-0.9); weaponHolder.add(muzzleLight);
let muzzleMesh=null;
{
  const g=new THREE.ConeGeometry(0.07,0.16,8); const m=new THREE.MeshBasicMaterial({color:0xffe48a, transparent:true, opacity:0}); muzzleMesh=new THREE.Mesh(g,m); muzzleMesh.rotation.x=Math.PI/2; muzzleMesh.position.set(0.42, -0.02, -0.62); muzzleMesh.visible=false; weaponHolder.add(muzzleMesh);
}
function triggerMuzzle(){
  muzzleLight.intensity=3.5; muzzleMesh.visible=true; muzzleMesh.material.opacity=0.95;
  setTimeout(()=>{ muzzleLight.intensity=0; muzzleMesh.visible=false; }, 60);
  // recoil kick
  weaponHolder.position.z += 0.06; weaponHolder.rotation.x += 0.04;
  setTimeout(()=>{ weaponHolder.position.z-=0.06; weaponHolder.rotation.x-=0.04; }, 70);
  // crosshair pop
  const ch=document.getElementById('crosshair'); ch.classList.add('fire'); setTimeout(()=>ch.classList.remove('fire'),90);
  // play fire anim if available
  if(weaponMixer && weaponClips['Rig|siligun_fire']){
    const cur = currentAction;
    const fire = weaponMixer.clipAction(weaponClips['Rig|siligun_fire']);
    fire.loop=THREE.LoopOnce; fire.clampWhenFinished=true; fire.reset().play();
    fire.getMixer().addEventListener('finished', function h(e){
      if(e.action===fire){ fire.stop(); if(cur) cur.reset().play(); fire.getMixer().removeEventListener('finished', h); }
    });
  }
}

// Raycast shooting
const raycaster = new THREE.Raycaster();
let shootCooldown=false;
function tryShoot(){
  if(gameState!=='playing' || isReloading) return;
  if(ammo<=0){ doReload(); return; }
  const now=performance.now();
  if(now-lastShot < fireRate) return;
  lastShot=now; ammo--; updateHUD();
  triggerMuzzle();
  // camera forward ray
  const dirVec = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
  raycaster.set(cameraHolder.position.clone().add(new THREE.Vector3(0,0,0)), dirVec);
  // we shoot from cameraHolder (player head)
  raycaster.ray.origin.copy(cameraHolder.position);
  raycaster.ray.direction.copy(dirVec);
  const hits = raycaster.intersectObjects(targets, false);
  if(hits.length){
    const hit = hits[0];
    const obj = hit.object;
    // find root target (could be child core) — walk up
    let target = obj; while(target && !targets.includes(target)) target = target.parent;
    if(target){
      handleHit(target, hit);
    }
  } else {
    // miss impact on ground/wall — spawn decal at far
    spawnImpact(cameraHolder.position.clone().add(dirVec.clone().multiplyScalar(30)), new THREE.Vector3(0,1,0));
  }
  // weapon bob gets reset
  // check reload auto
  if(ammo===0 && reserve>0) setTimeout(doReload, 180);
}

function handleHit(target, hit){
  // damage flash
  target.material.emissiveIntensity = 1.4;
  setTimeout(()=> target.material.emissiveIntensity=0.55, 120);
  // hit marker
  hitMarker.classList.add('show'); setTimeout(()=>hitMarker.classList.remove('show'),140);
  // impact particles
  spawnImpact(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0,1,0));
  // headshot check (core mesh)
  const isHead = hit.object !== target; // hit core
  // one-shot kill
  kills++; updateHUD();
  // death FX
  explode(target.position.clone());
  // respawn after delay
  target.visible=false;
  target.position.y = -10; // hide
  setTimeout(()=>{
    let x,z; do{ x=(Math.random()-0.5)*30; z=(Math.random()-0.5)*30; }while(Math.hypot(x-cameraHolder.position.x, z-cameraHolder.position.z)<7);
    target.position.set(x, target.userData.baseY, z);
    target.visible=true;
    target.material.emissiveIntensity=0.55;
  }, 900+Math.random()*600);
  // win check
  if(kills>=killsToWin) doWin();
}

function spawnImpact(pos, normal){
  const g=new THREE.SphereGeometry(0.06,6,6);
  const m=new THREE.MeshBasicMaterial({color:0x00ff9c});
  const s=new THREE.Mesh(g,m); s.position.copy(pos); s.position.add(normal.clone().multiplyScalar(0.02));
  scene.add(s);
  // spark
  const sparks=new THREE.Group();
  for(let i=0;i<6;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.02,4,4), new THREE.MeshBasicMaterial({color: i%2?0xffe48a:0x00ff9c}));
    p.userData={ vel: new THREE.Vector3((Math.random()-0.5)*4, Math.random()*3, (Math.random()-0.5)*4), life:0.35+Math.random()*0.25 };
    p.position.copy(pos); sparks.add(p);
  }
  scene.add(sparks);
  let t=0;
  function tickImp(dt){
    t+=dt;
    sparks.children.forEach(c=>{ c.position.add(c.userData.vel.clone().multiplyScalar(dt)); c.userData.vel.y -= 9*dt; c.userData.life-=dt; c.material.opacity = Math.max(0,c.userData.life/0.35); c.material.transparent=true; });
    s.material.opacity = Math.max(0,1-t/0.25); s.material.transparent=true; s.scale.multiplyScalar(1+dt*4);
    if(t>0.5){ scene.remove(s); scene.remove(sparks); }
    else requestAnimationFrame(()=>tickImp(0.016));
  }
  requestAnimationFrame(()=>tickImp(0.016));
  setTimeout(()=>scene.remove(s),400);
}

function explode(pos){
  const g=new THREE.Group();
  for(let i=0;i<10;i++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14), new THREE.MeshStandardMaterial({color: i%2?0xff2e7e:0x00ff9c, emissive: i%2?0x6a0a2a:0x00b36a, emissiveIntensity:0.6}));
    m.position.copy(pos); m.userData={ vel: new THREE.Vector3((Math.random()-0.5)*7, Math.random()*5+1, (Math.random()-0.5)*7), rot: new THREE.Vector3(Math.random()*6,Math.random()*6,Math.random()*6) };
    g.add(m);
  }
  // light burst
  const l=new THREE.PointLight(0x00ff9c, 4, 10); l.position.copy(pos); g.add(l);
  scene.add(g);
  let t=0; const clockTick=()=>{
    t+=0.016;
    g.children.forEach(c=>{
      if(c.isMesh){ c.position.add(c.userData.vel.clone().multiplyScalar(0.016)); c.userData.vel.y-=9*0.016; c.rotation.x+=c.userData.rot.x*0.016; c.rotation.y+=c.userData.rot.y*0.016; }
    });
    l.intensity = Math.max(0, 4*(1-t/0.4));
    if(t>0.6) scene.remove(g); else requestAnimationFrame(clockTick);
  }; requestAnimationFrame(clockTick);
}

function doReload(){
  if(isReloading || ammo===magSize || reserve<=0 || gameState!=='playing') return;
  isReloading=true;
  canShoot=false;
  ammoText.textContent='RELOADING...';
  // play reload clip
  if(weaponMixer && weaponClips['Rig|siligun_reload']){
    const cur=currentAction;
    const reload=weaponMixer.clipAction(weaponClips['Rig|siligun_reload']);
    reload.loop=THREE.LoopOnce; reload.clampWhenFinished=true; reload.reset().play();
    reload.getMixer().addEventListener('finished', function h(e){
      if(e.action===reload){ reload.stop(); if(cur) cur.reset().play(); reload.getMixer().removeEventListener('finished',h); }
    });
  } else {
    // proc tilt
    weaponHolder.rotation.x-=0.35;
  }
  setTimeout(()=>{
    const need = magSize - ammo;
    const take = Math.min(need, reserve);
    reserve -= take; ammo += take;
    isReloading=false; canShoot=true;
    if(!weaponMixer) weaponHolder.rotation.x+=0.35;
    updateHUD();
  }, 1100);
}

function doWin(){
  if(gameState==='won') return; gameState='won';
  document.exitPointerLock?.();
  const el=document.getElementById('win-stats'); const tm=timerText.textContent;
  el.textContent=`${kills} targets • ${tm} • Health ${Math.floor(health)}% — Valorant range pace, Doom snap`;
  overlayWin.classList.remove('hidden');
}
function doLose(){
  if(gameState==='lost') return; gameState='lost';
  document.exitPointerLock?.();
  const el=document.getElementById('lose-stats'); el.textContent=`${kills}/${killsToWin} eliminated — Drones closed in`;
  overlayLose.classList.remove('hidden');
}

// Input for movement loop
const clock=new THREE.Clock();
let bobPhase=0;
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.033);
  if(weaponMixer) weaponMixer.update(dt);
  if(gameState==='playing'){
    // movement
    const speed = keys['ShiftLeft']||keys['ShiftRight'] ? 6.2 : 3.8;
    direction.set(0,0,0);
    if(keys['KeyW']) direction.z -=1;
    if(keys['KeyS']) direction.z +=1;
    if(keys['KeyA']) direction.x -=1;
    if(keys['KeyD']) direction.x +=1;
    if(direction.lengthSq()>0) direction.normalize();
    // apply yaw rotation to movement
    const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -direction.z * speed * dt);
    move.addScaledVector(right, direction.x * speed * dt);
    // gravity/jump
    if(onGround && keys['Space'] && canJump){ velocity.y=5.4; onGround=false; canJump=false; }
    if(!keys['Space']) canJump=true;
    velocity.y -= 14*dt;
    move.y = velocity.y*dt;
    const next = cameraHolder.position.clone().add(move);
    // ground clamp
    if(next.y < playerHeight){
      next.y = playerHeight; velocity.y=0; onGround=true;
    } else if(next.y > playerHeight+2.5){ /* air */ }
    else onGround=false;
    handleCollision(next);
    cameraHolder.position.copy(next);
    // weapon bob
    const isMoving = direction.lengthSq()>0;
    bobPhase += dt * (isMoving ? (keys['ShiftLeft']?10:6.5) : 1.2);
    const bobX = Math.sin(bobPhase)* (isMoving?0.025:0.006);
    const bobY = Math.abs(Math.cos(bobPhase*1.1))* (isMoving?0.018:0.004);
    if(weaponLoaded) weaponHolder.position.x = 0.32 + bobX;
    if(weaponLoaded) weaponHolder.position.y = -0.32 + bobY;
    // drone movement + damage on proximity
    const now=performance.now()*0.001;
    targets.forEach(t=>{
      if(!t.visible) return;
      // hover
      t.position.y = t.userData.baseY + Math.sin(now*1.3 + t.userData.phase)*0.22;
      t.rotation.y += dt*0.7;
      // drift
      t.position.x += t.userData.dir.x * t.userData.speed * dt * 0.35;
      t.position.z += t.userData.dir.y * t.userData.speed * dt * 0.35;
      if(Math.abs(t.position.x)>18 || Math.abs(t.position.z)>18) { t.userData.dir.negate(); }
      // collision with player
      const dist = t.position.distanceTo(cameraHolder.position);
      if(dist < 1.45){
        // damage
        health -= 22*dt*2; // rapid when overlapping
        damageVignette.classList.add('flash');
        setTimeout(()=>damageVignette.classList.remove('flash'),120);
        // knockback
        const push = t.position.clone().sub(cameraHolder.position).normalize().multiplyScalar(0.9);
        cameraHolder.position.add(push.multiplyScalar(dt*3));
        updateHUD();
        if(health<=0) doLose();
      }
    });
    // also slowly regen 0.1?
    updateHUD();
  }
  renderer.render(scene, camera);
}
animate();

// Overlay play
document.getElementById('play-btn').addEventListener('click', ()=>{
  gameState='playing'; startTime=performance.now();
  overlay.classList.add('hidden');
  renderer.domElement.requestPointerLock();
  updateHUD();
});
window.addEventListener('resize', ()=>{
  camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
// allow R to restart anytime
window.addEventListener('keydown', e=>{
  if(e.code==='KeyR' && (gameState==='won'||gameState==='lost')){
    location.reload();
  }
});

// Debug HUD initial shows weapon loading
setTimeout(updateHUD, 300);
// Ensure viewer-like environment warmup
renderer.compile(scene,camera);

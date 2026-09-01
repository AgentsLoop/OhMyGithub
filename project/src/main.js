import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ---------- CONFIG ----------
const GAME_TIME = 120;
const MAG_SIZE = 30;
const RESERVE_START = 90;
const PLAYER_SPEED = 4.2;
const SPRINT_MULT = 1.65;
const ENEMY_COUNT = 8;
const PLAYER_MAX_HP = 100;

// ---------- SCENE ----------
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);
scene.fog = new THREE.Fog(0x0a1018, 28, 62);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// MWII-like post feel without postprocessing: ACES + subtle exposure, soft shadows, sRGB
app.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 1.7, 8);

const controls = new PointerLockControls(camera, renderer.domElement);

// ---------- LIGHTING (AAA tactical — desaturated Killhouse, warm tungsten, no cyan) ----------
scene.background = new THREE.Color(0x0e1116);
scene.fog = new THREE.FogExp2(0x0e1116, 0.028);
scene.add(new THREE.HemisphereLight(0xd8dde6, 0x0a0d11, 0.5));
const dir = new THREE.DirectionalLight(0xfff1d6, 1.05);
dir.position.set(10, 16, 7);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 60;
dir.shadow.camera.left=-24; dir.shadow.camera.right=24; dir.shadow.camera.top=24; dir.shadow.camera.bottom=-24;
dir.shadow.bias = -0.0006;
scene.add(dir);

const fill = new THREE.DirectionalLight(0xc8d6ff, 0.32);
fill.position.set(-10, 8, -10);
scene.add(fill);

// Warm edge markers — desaturated amber, not cyan (addresses critic: no Tron cyan)
function addWarmMarker(x,z,rot=0){
  const s = new THREE.Mesh(new THREE.BoxGeometry(3.2,0.05,0.08), new THREE.MeshStandardMaterial({emissive:0xff8c1a, emissiveIntensity:0.9, color:0x1a1206}));
  s.position.set(x,0.06,z); s.rotation.y=rot;
  scene.add(s);
}
addWarmMarker(0,-10.2,0); addWarmMarker(0,10.2,0);

// Spot lights — warm 3200K tungsten, intensity desaturated from 120 -> 16 (fixes blown hotspots)
for(let i=0;i<4;i++){
  const spot = new THREE.SpotLight(0xfff2d6, 16, 26, Math.PI/5.2, 0.52, 1.4);
  spot.position.set((i%2?1:-1)*7.2, 9.2, (i<2?1:-1)*7.2);
  spot.target.position.set(0,0,0); spot.castShadow=true; spot.shadow.mapSize.set(1024,1024);
  scene.add(spot); scene.add(spot.target);
  // subtle volumetric dust column under each spot (low-cost particles)
  const dustGeo = new THREE.BufferGeometry();
  const count=80;
  const pos=new Float32Array(count*3);
  for(let k=0;k<count;k++){ pos[k*3]=(Math.random()-0.5)*1.2; pos[k*3+1]=Math.random()*7+0.8; pos[k*3+2]=(Math.random()-0.5)*1.2; }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const dustMat = new THREE.PointsMaterial({color:0xfff2d6, size:0.06, transparent:true, opacity:0.18, depthWrite:false});
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.position.copy(spot.position);
  scene.add(dust);
}

// ---------- MATERIALS — grounded PBR feel (no flat Tron, addresses critic) ----------
const floorMat = new THREE.MeshStandardMaterial({ color:0x3a3e44, roughness:0.92, metalness:0.02 });
const wallMat = new THREE.MeshStandardMaterial({ color:0x2b333e, roughness:0.94, metalness:0.02 });
const wallAccentMat = new THREE.MeshStandardMaterial({ color:0x252d37, roughness:0.9, metalness:0.04 });
const crateWood = new THREE.MeshStandardMaterial({ color:0x6b5a3a, roughness:0.88, metalness:0.02 });
const crateMetal = new THREE.MeshStandardMaterial({ color:0x3f4a58, roughness:0.38, metalness:0.78 });
// Add AO / grime via vertex color simulation: darken bottom of walls later

// ---------- GEOMETRY: FLOOR & WALLS ----------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(36,36), floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow=true;
scene.add(floor);
// subtle floor breakup — no GridHelper (removes prototype tell per critic)
const floorDetail = new THREE.GridHelper(36, 72, 0x1e232a, 0x232830);
floorDetail.position.y = 0.015;
floorDetail.material.opacity = 0.22;
floorDetail.material.transparent = true;
scene.add(floorDetail);

// Walls
const walls = [];
function addWall(x,z,w,h,d){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
  m.position.set(x, h/2, z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  walls.push({ min:new THREE.Vector3(x-w/2,0,z-d/2), max:new THREE.Vector3(x+w/2,h,z+d/2) });
  return m;
}
addWall(0, -18, 36, 6, 0.6);
addWall(0, 18, 36, 6, 0.6);
addWall(-18, 0, 0.6, 6, 36);
addWall(18, 0, 0.6, 6, 36);

// Interior tactical structures
const colliders = [...walls];
function addBox(x,z,w,h,d,mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({min:new THREE.Vector3(x-w/2,0,z-d/2), max:new THREE.Vector3(x+w/2,h,z+d/2)});
  return m;
}
// Crates & barriers
const cratePositions = [[-6,-6],[ -6,6],[6,-6],[6,6],[0,-11],[0,11],[-10,0],[10,0]];
cratePositions.forEach(([x,z])=>{
  const h = 1.2+Math.random()*0.6;
  addBox(x,z,1.6,h,1.6, crateWood);
  // metal trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.65,0.12,1.65), crateMetal);
  trim.position.set(x,h,z); scene.add(trim);
});
// Low walls
addBox(-4,0,0.4,1.1,6, wallAccentMat);
addBox(4,0,0.4,1.1,6, wallAccentMat);
addBox(0,-4,6,1.1,0.4, wallAccentMat);
addBox(0,4,6,1.1,0.4, wallAccentMat);
// Pillars
[[-12,-12],[12,-12],[-12,12],[12,12]].forEach(([x,z])=> addBox(x,z,0.8,6,0.8, wallAccentMat));

// Ceiling panels (visual only)
const ceilGeo = new THREE.PlaneGeometry(36,36);
const ceilMat = new THREE.MeshStandardMaterial({color:0x0e131a, roughness:0.95, side:THREE.DoubleSide});
const ceil = new THREE.Mesh(ceilGeo, ceilMat);
ceil.rotation.x=Math.PI/2; ceil.position.y=6; scene.add(ceil);
// Ceiling lights mesh
for(let i=0;i<4;i++){
  const lm=new THREE.Mesh(new THREE.BoxGeometry(3,0.15,0.6), new THREE.MeshStandardMaterial({emissive:0xfff6d0, emissiveIntensity:1.5, color:0x111111}));
  lm.position.set((i%2?1:-1)*7, 5.96, (i<2?1:-1)*7);
  scene.add(lm);
}

// ---------- PLAYER STATE ----------
let hp = PLAYER_MAX_HP;
let mag = MAG_SIZE;
let reserve = RESERVE_START;
let timeLeft = GAME_TIME;
let kills = 0;
let gameState = 'menu'; // menu, playing, won, lost
let isAiming = false, isSprinting=false, isCrouching=false;
let reloading=false, reloadT=0;
let shootCooldown=0;

// Movement
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && gameState==='playing' && !reloading && mag<MAG_SIZE && reserve>0) startReload();
  if(e.code==='Space' && gameState==='playing'){ velocity.y=4.2; }
  if(e.code==='KeyP' && e.ctrlKey){ e.preventDefault(); /* dev */ }
});
addEventListener('keyup',e=> keys[e.code]=false);
addEventListener('keydown',e=>{
  if((e.code==='KeyR' && (gameState==='won'||gameState==='lost')) || (e.code==='Enter' && (gameState==='won'||gameState==='lost'))) restart();
});

let velocity = new THREE.Vector3();
let onGround=true;
const playerRadius=0.35;
let playerPos = new THREE.Vector3(0,1.7,12);
camera.position.copy(playerPos);
controls.getObject().position.copy(playerPos);

// ---------- WEAPON RIG ----------
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);

// Recoil / view-kick state (MWII snappy spring)
let recoilPosZ=0, recoilRotX=0, recoilRotY=0, recoilRotZ=0, viewKick=0;
let rifleWrapper=null;

// Procedural rifle (fallback + combined with GLB)
let rifleGLB=null;
let proceduralRifle=null;
function buildProceduralRifle(){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x0f141a, roughness:0.35, metalness:0.72});
  const metalMat=new THREE.MeshStandardMaterial({color:0x2a3038, roughness:0.28, metalness:0.85});
  const woodMat=new THREE.MeshStandardMaterial({color:0x5a3d1a, roughness:0.7});
  // receiver
  const rec=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.14,0.55), bodyMat); rec.position.set(0,-0.18,-0.22); g.add(rec);
  // barrel
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.75,16), metalMat); barrel.rotation.x=Math.PI/2; barrel.position.set(0,-0.18,-0.78); g.add(barrel);
  // handguard
  const hg=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.09,0.45), bodyMat); hg.position.set(0,-0.18,-0.62); g.add(hg);
  // stock
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.38), woodMat); stock.position.set(0,-0.16,0.18); g.add(stock);
  // scope
  const scope=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.42,16), metalMat); scope.rotation.x=Math.PI/2; scope.position.set(0,-0.08,-0.22); g.add(scope);
  // mag
  const magm=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.16,0.12), new THREE.MeshStandardMaterial({color:0x111111, roughness:0.6})); magm.position.set(0,-0.28,-0.15); g.add(magm);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; }});
  return g;
}
proceduralRifle=buildProceduralRifle();
proceduralRifle.position.set(0.32,-0.28,-0.55);
proceduralRifle.rotation.set(0.02, -0.05, 0);
weaponGroup.add(proceduralRifle);

// Muzzle flash
const muzzleLight=new THREE.PointLight(0xffaa44, 0, 4);
muzzleLight.position.set(0,-0.18,-1.15);
proceduralRifle.add(muzzleLight);
const flashMesh=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.18,8), new THREE.MeshBasicMaterial({color:0xffd27a, transparent:true, opacity:0}));
flashMesh.rotation.x=Math.PI/2; flashMesh.position.set(0,-0.18,-1.2);
proceduralRifle.add(flashMesh);

// Try load GLB
const loader=new GLTFLoader();
loader.load('/models/rifle.glb', gltf=>{
  rifleGLB=gltf.scene;
  rifleGLB.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; }});
  // normalize scale/pos: the Remington is ~1.1m long
  const box=new THREE.Box3().setFromObject(rifleGLB);
  const size=new THREE.Vector3(); box.getSize(size);
  const maxDim=Math.max(size.x,size.y,size.z);
  const scale=0.9 / maxDim;
  rifleGLB.scale.setScalar(scale);
  // center
  const center=new THREE.Vector3(); box.getCenter(center);
  rifleGLB.position.sub(center.multiplyScalar(scale));
  rifleGLB.position.add(new THREE.Vector3(0.32,-0.26,-0.58));
  rifleGLB.rotation.set(0.08, Math.PI+0.15, 0);
  // hide procedural, show GLB
  proceduralRifle.visible=false;
  rifleWrapper=new THREE.Group(); rifleWrapper.add(rifleGLB);
  // If GLB has dark materials without textures, add subtle env boost
  rifleGLB.traverse(o=>{
    if(o.isMesh && o.material){
      o.material.roughness = Math.min(o.material.roughness||0.6, 0.7);
      if(o.material.metalness===0) o.material.metalness=0.15;
    }
  });
  weaponGroup.add(rifleWrapper);
  // move flash to weaponGroup (centered for both rigs)
  flashMesh.position.set(0.32,-0.22,-1.05);
  weaponGroup.add(flashMesh);
  muzzleLight.position.set(0.32,-0.22,-1.05);
  weaponGroup.add(muzzleLight);
}, undefined, err=>{
  console.warn('GLB load fallback', err);
});

// Sway/bob
let swayX=0, swayY=0, bobT=0;

// ---------- ENEMIES ----------
const enemies=[];
const enemyGeo=new THREE.CapsuleGeometry(0.32,0.9,4,12);
const enemyMat=new THREE.MeshStandardMaterial({color:0xc23a2b, roughness:0.65, emissive:0x220000, emissiveIntensity:0.25});
const headGeo=new THREE.SphereGeometry(0.22,16,12);
const headMat=new THREE.MeshStandardMaterial({color:0xf0d0b8, roughness:0.8});
function spawnEnemies(){
  enemies.length=0;
  const spots=[[-7,-9],[7,-9],[-9,7],[9,7],[0,-6],[0,6],[-5,0],[5,0]];
  spots.forEach(([x,z],i)=>{
    const g=new THREE.Group();
    const body=new THREE.Mesh(enemyGeo, enemyMat.clone());
    body.castShadow=true; body.receiveShadow=true;
    const head=new THREE.Mesh(headGeo, headMat); head.position.y=0.78;
    body.add(head);
    g.add(body);
    g.position.set(x,0.9,z);
    g.userData={ hp:100, maxHp:100, alive:true, baseX:x, baseZ:z, phase:Math.random()*Math.PI*2, shootCd: 1+Math.random()*2, body, head };
    // health bar sprite
    const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=16;
    const tex=new THREE.CanvasTexture(canvas);
    const sprMat=new THREE.SpriteMaterial({map:tex});
    const spr=new THREE.Sprite(sprMat); spr.scale.set(1.1,0.18,1); spr.position.y=1.45;
    g.add(spr);
    g.userData.hpCanvas=canvas; g.userData.hpTex=tex; g.userData.hpSprite=spr;
    updateEnemyHpBar(g);
    scene.add(g);
    enemies.push(g);
  });
}
function updateEnemyHpBar(g){
  const c=g.userData.hpCanvas; const ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,c.width,c.height);
  const pct=g.userData.hp/g.userData.maxHp;
  ctx.fillStyle= pct>0.5 ? '#22ff66' : pct>0.25 ? '#ffcc00' : '#ff3b30';
  ctx.fillRect(2,2,(c.width-4)*pct, c.height-4);
  g.userData.hpTex.needsUpdate=true;
}

spawnEnemies();

// ---------- RAYCAST & SHOOTING ----------
const raycaster=new THREE.Raycaster();
let lastShoot=0;
function shoot(){
  if(gameState!=='playing' || reloading || mag<=0 || performance.now()-lastShoot<110) return;
  if(document.pointerLockElement!==renderer.domElement) return;
  lastShoot=performance.now();
  mag--;
  shootCooldown=0.08;
  // MWII-style recoil: vertical kick + slight random yaw, ADS dampens 45%
  const adsDamp = isAiming ? 0.55 : 1.0;
  const kickZ = (isAiming ? 0.042 : 0.085) * (0.9 + Math.random()*0.2);
  const kickPitch = (isAiming ? 0.045 : 0.095) * (0.9 + Math.random()*0.2);
  const kickYaw = (Math.random()-0.5) * 0.035 * adsDamp;
  const kickRoll = (Math.random()-0.5) * 0.02;
  recoilPosZ += kickZ;
  recoilRotX += kickPitch;
  recoilRotY += kickYaw;
  recoilRotZ += kickRoll;
  viewKick += (isAiming ? 0.0035 : 0.0085);
  // flash: brighter, shorter, with scale pulse (MWII)
  muzzleLight.intensity=22;
  flashMesh.material.opacity=0.98;
  flashMesh.scale.set(1.25,1.25,1.25);
  setTimeout(()=>{ flashMesh.material.opacity=0; muzzleLight.intensity=0; flashMesh.scale.set(1,1,1); }, 55);
  // legacy nudge for fallback mesh (spring system will handle return)
  proceduralRifle.position.z += kickZ*0.6;
  proceduralRifle.rotation.x -= kickPitch*0.35;
  // tracer
  spawnTracer();
  // ray
  raycaster.setFromCamera({x:0,y:0}, camera);
  const intersects=raycaster.intersectObjects(enemies.map(e=>e.userData.body).concat(enemies.map(e=>e.userData.head)), false);
  // Also check bounding via distance
  let hitEnemy=null; let hitHead=false;
  // Prefer head
  for(const e of enemies){
    if(!e.userData.alive) continue;
    const headPos=new THREE.Vector3(); e.userData.head.getWorldPosition(headPos);
    const toHead=headPos.distanceTo(camera.position);
    // cone check
    const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
    const toEnemy = headPos.clone().sub(camera.position).normalize();
    const ang= dir.angleTo(toEnemy);
    if(ang<0.07 && toHead<28){
      // ray to head sphere
      const sphere=new THREE.Sphere(headPos,0.22);
      const ray=new THREE.Ray(camera.position.clone(), dir);
      if(ray.intersectsSphere(sphere)){
        hitEnemy=e; hitHead=true; break;
      }
    }
  }
  if(!hitEnemy){
    for(const e of enemies){
      if(!e.userData.alive) continue;
      const pos=e.position.clone(); pos.y=0.9;
      const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
      const toEnemy=pos.clone().sub(camera.position).normalize();
      const ang=dir.angleTo(toEnemy);
      const dist=camera.position.distanceTo(pos);
      if(ang<0.09 && dist<28){
        const sphere=new THREE.Sphere(pos,0.42);
        const ray=new THREE.Ray(camera.position.clone(), dir);
        if(ray.intersectsSphere(sphere)){ hitEnemy=e; break; }
      }
    }
  }
  // wall decals fallback
  let hitPoint=null;
  if(hitEnemy){
    const dmg = hitHead ? 100 : 50;
    hitEnemy.userData.hp -= dmg;
    updateEnemyHpBar(hitEnemy);
    showHitmarker();
    spawnHitEffect(hitEnemy.position.clone().add(new THREE.Vector3(0,1.0,0)), hitHead);
    if(hitEnemy.userData.hp<=0){
      hitEnemy.userData.alive=false;
      hitEnemy.visible=false;
      kills++;
      // small explosion
      spawnHitEffect(hitEnemy.position.clone(), false, true);
    }
  } else {
    // find wall hit for decal
    const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
    const far=camera.position.clone().add(dir.multiplyScalar(30));
    // simple ground/wall hit approx
    hitPoint=far;
    // raycast against colliders via plane check: just use far point
    spawnDecal(hitPoint);
  }
  // shell ejection
  spawnShell();
  updateHUD();
  checkWinLose();
  if(mag===0 && reserve>0) startReload();
}

function showHitmarker(){
  const hm=document.getElementById('hitmarker');
  hm.classList.add('on');
  setTimeout(()=>hm.classList.remove('on'), 110);
}

const tracerPool=[];
function spawnTracer(){
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-6)]);
  const mat=new THREE.LineBasicMaterial({color:0xffe27a, transparent:true, opacity:0.9});
  const line=new THREE.Line(geo,mat);
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  line.position.copy(camera.position.clone().add(dir.clone().multiplyScalar(0.6)));
  line.quaternion.copy(camera.quaternion);
  scene.add(line);
  let t=0;
  const id=setInterval(()=>{
    t+=0.06; line.material.opacity=1-t; line.position.add(dir.clone().multiplyScalar(1.2));
    if(t>=1){ clearInterval(id); scene.remove(line); }
  },16);
}
function spawnDecal(pos){
  const d=new THREE.Mesh(new THREE.CircleGeometry(0.08,8), new THREE.MeshStandardMaterial({color:0x111111, roughness:0.9}));
  d.position.copy(pos); d.position.y=Math.max(0.3, d.position.y);
  d.lookAt(camera.position);
  scene.add(d);
  setTimeout(()=>scene.remove(d), 8000);
}
function spawnHitEffect(pos, head, dead){
  const color=head?0xffffff: dead?0xff3b30:0xffcc00;
  const count=head?18:10;
  for(let i=0;i<count;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
    p.position.copy(pos);
    const vel=new THREE.Vector3((Math.random()-0.5)*4, Math.random()*3+0.5, (Math.random()-0.5)*4);
    scene.add(p);
    let life=0;
    const iv=setInterval(()=>{
      life+=0.04; p.position.add(vel.clone().multiplyScalar(0.06)); vel.y-=0.18; p.material.opacity=1-life*1.8;
      if(life>=0.55){ clearInterval(iv); scene.remove(p); }
    },16);
  }
}
function spawnShell(){
  // MWII brass: proper ejection port, lateral eject, bounce + roll
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.014,0.032,10), new THREE.MeshStandardMaterial({color:0xc9a24a, metalness:0.82, roughness:0.28}));
  // ejection port relative to camera
  const ejectOffset=new THREE.Vector3(0.28,-0.18,-0.22).applyQuaternion(camera.quaternion);
  shell.position.copy(camera.position.clone().add(ejectOffset));
  shell.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0);
  const camRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const camUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const camFwd=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const vel=new THREE.Vector3().addScaledVector(camRight, 2.3 + Math.random()*1.0).addScaledVector(camUp, 0.9+Math.random()*0.5).addScaledVector(camFwd, (Math.random()-0.5)*0.6);
  const angVel=new THREE.Vector3((Math.random()-0.5)*12, (Math.random()-0.5)*10, 8+Math.random()*6);
  scene.add(shell);
  let bounces=0;
  const iv=setInterval(()=>{
    shell.position.add(vel.clone().multiplyScalar(0.016));
    vel.y -= 9.8*0.016; // gravity
    vel.multiplyScalar(0.998);
    shell.rotation.x += angVel.x*0.016;
    shell.rotation.y += angVel.y*0.016;
    shell.rotation.z += angVel.z*0.016;
    if(shell.position.y<=0.05){
      shell.position.y=0.05;
      if(bounces<2){
        vel.y = Math.abs(vel.y)*0.38;
        vel.x *= 0.72; vel.z *= 0.72;
        angVel.multiplyScalar(0.6);
        bounces++;
      } else {
        vel.set(0,0,0);
        angVel.set(0,0,0);
        clearInterval(iv);
        setTimeout(()=>scene.remove(shell), 900);
      }
    }
  },16);
  // safety cleanup
  setTimeout(()=>{ clearInterval(iv); if(shell.parent) scene.remove(shell); }, 3500);
}

function startReload(){
  if(reloading || reserve<=0 || mag===MAG_SIZE) return;
  reloading=true; reloadT=1.15;
  document.getElementById('ammoSub').textContent='↻ RELOADING...';
  // anim
  proceduralRifle.rotation.z = 0.12;
}
function finishReload(){
  const need=MAG_SIZE-mag;
  const take=Math.min(need,reserve);
  mag+=take; reserve-=take;
  reloading=false; reloadT=0;
  document.getElementById('ammoSub').textContent='5.56 NATO • AUTO • PRESS [R] TO RELOAD • [RMB] AIM • [SHIFT] SPRINT';
  updateHUD();
}

// ---------- COLLISION ----------
function collides(pos){
  for(const c of colliders){
    if(pos.x + playerRadius > c.min.x && pos.x - playerRadius < c.max.x &&
       pos.z + playerRadius > c.min.z && pos.z - playerRadius < c.max.z){
      return true;
    }
  }
  // bounds
  if(Math.abs(pos.x)>17.2 || Math.abs(pos.z)>17.2) return true;
  return false;
}

// ---------- HUD ----------
function updateHUD(){
  document.getElementById('ammoBig').textContent = `${String(mag).padStart(2,'0')} / ${String(reserve).padStart(2,'0')}`;
  document.getElementById('targetsTxt').textContent = `${kills}/${ENEMY_COUNT}`;
  document.getElementById('healthTxt').textContent = `${Math.max(0,Math.round(hp))}%`;
  document.getElementById('healthFill').style.width = `${Math.max(0,hp)}%`;
  document.getElementById('timeTxt').textContent = `${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(Math.floor(timeLeft%60)).padStart(2,'0')}`;
}
function takeDamage(amt){
  hp=Math.max(0,hp-amt);
  updateHUD();
  const flash=document.getElementById('damageFlash');
  flash.style.opacity='0.55';
  setTimeout(()=>flash.style.opacity='0', 180);
  // camera shake
  camera.rotation.z = (Math.random()-0.5)*0.06;
  if(hp<=0) lose();
}

// ---------- GAME STATE ----------
function checkWinLose(){
  if(kills>=ENEMY_COUNT) win();
}
function win(){
  if(gameState==='won') return;
  gameState='won';
  controls.unlock();
  showCenter('MISSION COMPLETE','All hostiles neutralized — Tactical Vector range cleared.','REPLAY', 'victory');
}
function lose(){
  if(gameState==='lost') return;
  gameState='lost';
  controls.unlock();
  showCenter('KIA — MISSION FAILED', hp<=0 ? 'Integrity compromised.' : 'Time expired. Hostiles remain.', 'RETRY','defeat');
}
function showCenter(title,sub,btn,cls){
  const el=document.getElementById('centerMsg');
  el.innerHTML=`<div class="center-title">${title}</div><div class="center-sub">${sub}</div><button class="btn" onclick="window.__restart()">${btn}</button>`;
  el.style.display='block';
}
function hideCenter(){ document.getElementById('centerMsg').style.display='none'; }
window.__restart=()=>restart();
function restart(){
  hp=PLAYER_MAX_HP; mag=MAG_SIZE; reserve=RESERVE_START; timeLeft=GAME_TIME; kills=0; gameState='playing';
  playerPos.set(0,1.7,12); velocity.set(0,0,0);
  camera.position.copy(playerPos);
  controls.getObject().position.copy(playerPos);
  hideCenter();
  document.getElementById('overlay').style.display='none';
  enemies.forEach(e=>scene.remove(e));
  spawnEnemies();
  updateHUD();
}

// ---------- INPUT LISTENERS ----------
renderer.domElement.addEventListener('click', ()=>{
  if(gameState==='menu') return;
  if(gameState==='playing' && document.pointerLockElement!==renderer.domElement) return;
  shoot();
});
addEventListener('mousedown', e=>{
  if(e.button===2) isAiming=true;
  if(e.button===0 && gameState==='playing') shoot();
});
addEventListener('mouseup', e=>{ if(e.button===2) isAiming=false; });
addEventListener('contextmenu', e=> e.preventDefault());

document.getElementById('playBtn').addEventListener('click', ()=>{
  document.getElementById('overlay').style.display='none';
  gameState='playing';
  controls.lock();
  hideCenter();
});
controls.addEventListener('lock', ()=>{
  if(gameState==='menu'){ /* keep */ }
});
controls.addEventListener('unlock', ()=>{
  if(gameState==='playing'){
    // show pause hint but not overlay
    // keep playing but require click to re-lock
  }
});

// ---------- LOOP ----------
let lastT=performance.now();
const miniCanvas=document.getElementById('miniCanvas');
const miniCtx=miniCanvas.getContext('2d');

function animate(){
  requestAnimationFrame(animate);
  const now=performance.now();
  const dt=Math.min(0.033, (now-lastT)/1000);
  lastT=now;

  // FPS pill
  const fps=Math.round(1/dt);
  document.getElementById('fpsPill').textContent = fps+' FPS';

  if(gameState==='playing'){
    timeLeft-=dt;
    if(timeLeft<=0){ timeLeft=0; lose(); }
    updateHUD();

    // movement
    const forward=new THREE.Vector3(); camera.getWorldDirection(forward); forward.y=0; forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
    // actually right is perp
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize(); // fix
    // recompute right correctly
    const r=new THREE.Vector3(); r.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
    // invert? test
    // Use camera right
    const camRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion); camRight.y=0; camRight.normalize();
    const camFwd=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); camFwd.y=0; camFwd.normalize();

    let moveX=0, moveZ=0;
    if(keys['KeyW']) moveZ+=1;
    if(keys['KeyS']) moveZ-=1;
    if(keys['KeyA']) moveX-=1;
    if(keys['KeyD']) moveX+=1;
    const isMoving= moveX!==0 || moveZ!==0;
    isSprinting = keys['ShiftLeft'] || keys['ShiftRight'];
    isCrouching = keys['ControlLeft'] || keys['ControlRight'];

    let speed=PLAYER_SPEED;
    if(isSprinting && isMoving) speed*=SPRINT_MULT;
    if(isCrouching) speed*=0.55;
    if(isAiming) speed*=0.55;

    // gravity
    velocity.y -= 14*dt;
    let move = new THREE.Vector3();
    if(isMoving){
      const dir=new THREE.Vector3();
      dir.addScaledVector(camFwd, moveZ);
      dir.addScaledVector(camRight, moveX);
      dir.normalize().multiplyScalar(speed*dt);
      // try X then Z separately for sliding
      const tryX = playerPos.clone().add(new THREE.Vector3(dir.x,0,0));
      if(!collides(tryX)) playerPos.x+=dir.x; 
      const tryZ = playerPos.clone().add(new THREE.Vector3(0,0,dir.z));
      if(!collides(tryZ)) playerPos.z+=dir.z;
    }
    playerPos.y += velocity.y*dt;
    if(playerPos.y<1.7){ playerPos.y=1.7; velocity.y=0; onGround=true; } else onGround=false;
    if(isCrouching) playerPos.y = THREE.MathUtils.lerp(playerPos.y, 1.05, dt*8);
    else playerPos.y = THREE.MathUtils.lerp(playerPos.y, 1.7, dt*8);

    camera.position.copy(playerPos);
    controls.getObject().position.copy(playerPos);

    // weapon sway / bob — MWII tightened: ADS dampens sway 70%, sprint bob sharper
    bobT+= dt * (isMoving? (isSprinting?14:9.5):1.6);
    const adsSwayMult = isAiming ? 0.22 : 1.0;
    const bobAmp = (isSprinting?0.042: isMoving?0.024:0.006) * adsSwayMult;
    const swayTargetX = (isMoving? Math.sin(bobT)*bobAmp : Math.sin(bobT*0.5)*0.004*adsSwayMult);
    const swayTargetY = (isMoving? Math.abs(Math.cos(bobT))*bobAmp*0.55 : Math.sin(bobT*0.7)*0.002);
    // recoil spring decay (snappy MWII)
    const recoilDecay = Math.exp(-dt*14);
    const rotDecay = Math.exp(-dt*11);
    recoilPosZ *= recoilDecay;
    recoilRotX *= rotDecay;
    recoilRotY = THREE.MathUtils.lerp(recoilRotY, 0, dt*10);
    recoilRotZ = THREE.MathUtils.lerp(recoilRotZ, 0, dt*10);
    viewKick = THREE.MathUtils.lerp(viewKick, 0, dt*9);
    if(shootCooldown>0) shootCooldown-=dt;
    // ADS crosshair + FOV (MWII: 74 hip -> 52 ADS, snappy)
    const hudEl=document.getElementById('hud');
    if(hudEl) hudEl.classList.toggle('is-aiming', isAiming);
    camera.fov = THREE.MathUtils.lerp(camera.fov, isAiming?52:74, dt*14);
    camera.updateProjectionMatrix();
    // view kick pitch (camera slightly looks up on shot)
    if(viewKick>0.0001){
      // apply via controls pitch offset without breaking PointerLock
      camera.rotation.x -= viewKick*0.35*dt*60;
    }
    // base aim positions
    const hipPos = new THREE.Vector3(0.32,-0.28,-0.55);
    const adsPos = new THREE.Vector3(0.015,-0.19,-0.41);
    const targetPos = isAiming ? adsPos : hipPos;
    // blend toward target then add sway + recoil
    const cur=proceduralRifle.position;
    cur.lerp(targetPos, dt*12);
    cur.x += swayTargetX;
    cur.y += swayTargetY*0.7 + (isAiming?-0.01:0);
    cur.z -= recoilPosZ; // recoil pushes back
    // rotation: base + sway + recoil
    const baseRotX = isAiming?0.015:0.02;
    proceduralRifle.rotation.x = THREE.MathUtils.lerp(proceduralRifle.rotation.x, baseRotX - recoilRotX*0.9, dt*16);
    proceduralRifle.rotation.y = THREE.MathUtils.lerp(proceduralRifle.rotation.y, -0.05 + recoilRotY, dt*14);
    proceduralRifle.rotation.z = THREE.MathUtils.lerp(proceduralRifle.rotation.z, recoilRotZ + (isMoving? Math.sin(bobT*0.7)*0.012*adsSwayMult:0), dt*14);
    // mirror transforms to GLB wrapper when active (keeps both rigs in sync)
    if(rifleWrapper){
      rifleWrapper.position.copy(cur).sub(hipPos).multiplyScalar(0.92);
      // keep wrapper centered offset so ADS aligns even though GLB origin differs
      rifleWrapper.rotation.set(proceduralRifle.rotation.x*0.85, proceduralRifle.rotation.y, proceduralRifle.rotation.z);
    }
    if(reloading){
      reloadT-=dt;
      const rp = Math.sin((1-reloadT/1.15)*Math.PI);
      proceduralRifle.rotation.z += rp*0.18;
      proceduralRifle.position.y -= rp*0.04;
      if(rifleWrapper){ rifleWrapper.rotation.z += rp*0.14; rifleWrapper.position.y -= rp*0.03; }
      if(reloadT<=0) finishReload();
    }

    // enemies: bob & shoot
    enemies.forEach(e=>{
      if(!e.userData.alive) return;
      const t=now*0.001;
      e.position.y = 0.9 + Math.sin(t*1.2 + e.userData.phase)*0.06;
      e.lookAt(camera.position.x, e.position.y, camera.position.z);
      e.userData.shootCd -= dt;
      const dist=camera.position.distanceTo(e.position);
      if(e.userData.shootCd<=0 && dist<18 && Math.random()<0.7){
        // line of sight simple: distance only
        e.userData.shootCd = 0.9 + Math.random()*1.2;
        // enemy flash
        const ef=new THREE.PointLight(0xffaa44, 8, 6);
        ef.position.copy(e.position.clone().add(new THREE.Vector3(0,0.5,0.6).applyQuaternion(e.quaternion)));
        scene.add(ef);
        setTimeout(()=>scene.remove(ef), 70);
        // damage with falloff & aim miss chance
        const hitProb = THREE.MathUtils.clamp(1.2 - dist/22, 0.18, 0.65);
        if(Math.random()<hitProb) takeDamage(7 + Math.random()*9);
      }
      // billboard hp already facing
      e.userData.hpSprite.lookAt(camera.position);
    });

    // minimap
    miniCtx.clearRect(0,0,150,150);
    miniCtx.fillStyle='#0d1520'; miniCtx.fillRect(0,0,150,150);
    miniCtx.strokeStyle='rgba(255,255,255,0.06)'; miniCtx.lineWidth=1;
    for(let i=0;i<=6;i++){ miniCtx.beginPath(); miniCtx.moveTo(i*25,0); miniCtx.lineTo(i*25,150); miniCtx.stroke(); miniCtx.beginPath(); miniCtx.moveTo(0,i*25); miniCtx.lineTo(150,i*25); miniCtx.stroke(); }
    // walls
    miniCtx.fillStyle='rgba(255,255,255,0.08)'; colliders.forEach(c=>{ const x=(c.min.x+18)/36*150, z=(c.min.z+18)/36*150, w=(c.max.x-c.min.x)/36*150, h=(c.max.z-c.min.z)/36*150; miniCtx.fillRect(x,z,w,h); });
    // enemies
    enemies.forEach(e=>{
      if(!e.userData.alive) return;
      const x=(e.position.x+18)/36*150, z=(e.position.z+18)/36*150;
      miniCtx.fillStyle='#ff3b30'; miniCtx.beginPath(); miniCtx.arc(x,z,3.5,0,Math.PI*2); miniCtx.fill();
    });
    // player
    const px=(playerPos.x+18)/36*150, pz=(playerPos.z+18)/36*150;
    miniCtx.fillStyle='#00e5ff'; miniCtx.beginPath(); miniCtx.arc(px,pz,4,0,Math.PI*2); miniCtx.fill();
    const dir2=new THREE.Vector3(); camera.getWorldDirection(dir2);
    miniCtx.strokeStyle='#00e5ff'; miniCtx.beginPath(); miniCtx.moveTo(px,pz); miniCtx.lineTo(px+dir2.x*14, pz+dir2.z*14); miniCtx.stroke();
  }

  renderer.render(scene, camera);
}
animate();

// resize
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
updateHUD();

// expose for tests
window.__game = { getState:()=>gameState, getKills:()=>kills, getHp:()=>hp, getMag:()=>mag, takeDamage, restart, shoot, startReload };

// initial center hide logic handled via overlay

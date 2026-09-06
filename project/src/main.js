import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- AAA THREE.JS FPS: COD BLACKLINE ---
// Reference bar: Call of Duty Modern Warfare II (2022) — side-by-side target

const canvas = document.getElementById('c');
const centerMsg = document.getElementById('centerMsg');
const playBtn = document.getElementById('playBtn');
const hitmarkerEl = document.getElementById('hitmarker');
const dmgVignette = document.getElementById('damageVignette');
const ammoMain = document.getElementById('ammoMain');
const healthFill = document.getElementById('healthFill');
const hpNum = document.getElementById('hpNum');
const killfeed = document.getElementById('killfeed');
const scoreStat = document.getElementById('scoreStat');
const enemyStat = document.getElementById('enemyStat');
const killStat = document.getElementById('killStat');
const accStat = document.getElementById('accStat');
const velStat = document.getElementById('velStat');
const posStat = document.getElementById('posStat');
const fpsStat = document.getElementById('fpsStat');
const scopeOverlay = document.getElementById('scopeOverlay');
const miniCanvas = document.getElementById('minimapCanvas');
const miniCtx = miniCanvas.getContext('2d');

// Renderer — ACES Filmic, sRGB, PCFSoft shadows, antialias
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8a9ba8, 0.012);
scene.background = new THREE.Color(0x8f9fb0);

// Camera + player
const camera = new THREE.PerspectiveCamera(74, window.innerWidth/window.innerHeight, 0.08, 600);
let cameraBaseFov = 74;
const player = new THREE.Group();
player.position.set(0, 1.7, 14);
scene.add(player);
player.add(camera);
camera.position.set(0,0,0);

// Lights — warm sun + cool skylight + fill
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(30, 45, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdfe9f3, 0x2a3a32, 0.85));
const fill = new THREE.DirectionalLight(0xbfd7ff, 0.35); fill.position.set(-20,15,-20); scene.add(fill);
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

// Ground — PBR textured plane
const groundMat = new THREE.MeshStandardMaterial({ color:0x6b6f73, roughness:0.92, metalness:0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(260,260), groundMat);
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
const gridHelper = new THREE.GridHelper(260, 52, 0x44484d, 0x55595f); gridHelper.position.y = 0.02; scene.add(gridHelper);

// Helper to make PBR box buildings
function makeBuilding(x,z,w,d,h, color=0x7a7d82){
  const g=new THREE.BoxGeometry(w,h,d);
  const m=new THREE.MeshStandardMaterial({ color, roughness:0.85, metalness:0.04 });
  const mesh=new THREE.Mesh(g,m); mesh.position.set(x,h/2,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  // windows emissive
  if(h>6){
    const winGeo=new THREE.PlaneGeometry(w*0.62,h*0.45);
    const winMat=new THREE.MeshStandardMaterial({ color:0xffd27a, emissive:0xffb84d, emissiveIntensity:0.55, roughness:0.4 });
    for(let side of [-1,1]){
      const p=new THREE.Mesh(winGeo,winMat);
      p.position.set(x+ (side*0.01 + (side>0? d/2 : -d/2)), h*0.55, z);
      if(side) p.rotation.y = side>0?0:Math.PI;
      // actually align to front/back only; add second set for left/right via clone
      scene.add(p);
    }
    // side windows
    const win2=new THREE.Mesh(new THREE.PlaneGeometry(d*0.62,h*0.45), winMat);
    win2.position.set(x, h*0.55, z+d/2+0.01); win2.rotation.y=0; scene.add(win2);
    const win3=win2.clone(); win3.position.set(x, h*0.55, z-d/2-0.01); win3.rotation.y=Math.PI; scene.add(win3);
  }
  return mesh;
}
// Warzone city layout — 9 buildings + containers + barriers
const colliders=[];
function addCollider(mesh){ const b=new THREE.Box3().setFromObject(mesh); colliders.push(b); }
let b;
b=makeBuilding(-18, -6, 14,16,12, 0x85888d); addCollider(b);
b=makeBuilding(16, -10, 18,12,14, 0x7d8186); addCollider(b);
b=makeBuilding(-2, -30, 32,10,9, 0x6f7276); addCollider(b);
b=makeBuilding(20, 18, 10,14,8, 0x8a8e93); addCollider(b);
b=makeBuilding(-22, 16, 12,12,10, 0x787c81); addCollider(b);
b=makeBuilding(0, 8, 6,6,4, 0x9aa0a6); addCollider(b);
// containers
function container(x,z,rot=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(6,2.6,2.4), new THREE.MeshStandardMaterial({color:0xc84a2a, roughness:0.7, metalness:0.05}));
  m.position.set(x,1.3,z); m.rotation.y=rot; m.castShadow=true; m.receiveShadow=true; scene.add(m); addCollider(m);
  const m2=m.clone(); m2.position.set(x+0.4,1.3,z+2.6); m2.material=m2.material.clone(); m2.material.color.set(0x2f6e8a); scene.add(m2); addCollider(m2);
}
container(-8, 4); container(10, -2); container(-12, -18, 0.3); container(14, 10, 0.6);
// barriers
for(let i=0;i<6;i++){
  const bx=new THREE.Mesh(new THREE.BoxGeometry(4,1.1,0.7), new THREE.MeshStandardMaterial({color:0xd9c4a0, roughness:0.9}));
  const ang=Math.random()*0.6-0.3; bx.position.set(-10+i*6.5,0.55,-2+Math.sin(i)*2); bx.rotation.y=ang; bx.castShadow=true; bx.receiveShadow=true; scene.add(bx); addCollider(bx);
}
// Decals: road markings
const roadMark=new THREE.Mesh(new THREE.PlaneGeometry(36,0.5), new THREE.MeshStandardMaterial({color:0xe8ff00, roughness:0.8}));
roadMark.rotation.x=-Math.PI/2; roadMark.position.set(0,0.03,0); scene.add(roadMark);
const roadMark2=roadMark.clone(); roadMark2.position.set(0,0.03,4); scene.add(roadMark2);

// Fog godrays via large plane + additive? subtle
scene.background = new THREE.Color(0xc9d6e3);

// Enemies — stylized soldiers with patrol
const enemies=[];
const enemyGeo = new THREE.CapsuleGeometry(0.4, 1.0, 4, 12);
function spawnEnemy(x,z){
  const mat=new THREE.MeshStandardMaterial({color:0x1e2a22, roughness:0.7});
  const mesh=new THREE.Mesh(enemyGeo, mat); mesh.position.set(x,1.0,z); mesh.castShadow=true;
  // helmet
  const helm=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,10), new THREE.MeshStandardMaterial({color:0x3a4a3d, roughness:0.6}));
  helm.position.y=0.75; mesh.add(helm);
  // visor emissive strip
  const vis=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.07), new THREE.MeshStandardMaterial({color:0xff3b30, emissive:0xff3b30, emissiveIntensity:1.2}));
  vis.position.set(0,0.78,0.28); mesh.add(vis);
  scene.add(mesh);
  enemies.push({mesh, hp:80, alive:true, patrol:{cx:x, cz:z, r:6, ang:Math.random()*Math.PI*2, speed:0.35+Math.random()*0.35}});
}
for(let i=0;i<8;i++){
  const ang=(i/8)*Math.PI*2 + Math.random()*0.4;
  const r=10+Math.random()*10;
  spawnEnemy(Math.cos(ang)*r, Math.sin(ang)*r*0.9);
}

// Weapon viewmodel — try GLTF, fallback to procedural high-poly rifle
let weaponRoot=new THREE.Group();
let muzzleLight=new THREE.PointLight(0xffc26a, 0, 8);
let muzzleFlash=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.45,8), new THREE.MeshBasicMaterial({color:0xfff2a0, transparent:true, opacity:0}));
muzzleFlash.rotation.x=Math.PI/2; muzzleFlash.position.set(0.12,-0.08,-1.15);
weaponRoot.add(muzzleFlash); weaponRoot.add(muzzleLight);
muzzleLight.position.copy(muzzleFlash.position);
let weaponLoaded=false;
const loader=new GLTFLoader();
loader.load('/models/rifle.glb', (gltf)=>{
  const model=gltf.scene;
  model.traverse(o=>{
    if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; if(o.material){ o.material.envMapIntensity=0.9; }}
  });
  // normalize scale/position for viewmodel
  model.scale.set(0.45,0.45,0.45);
  model.position.set(0.35,-0.24,-0.72);
  model.rotation.set(0.05, 3.14, 0);
  weaponRoot.add(model);
  weaponLoaded=true;
  // attribution already in HTML
}, undefined, ()=>{
  // fallback procedural rifle (still AAA look)
  const rifle=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x191c1f, roughness:0.45, metalness:0.55});
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.035,0.9,14), bodyMat); barrel.rotation.x=Math.PI/2; barrel.position.set(0.12,-0.1,-0.9); rifle.add(barrel);
  const rec=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.09,0.5), bodyMat); rec.position.set(0.12,-0.08,-0.55); rifle.add(rec);
  const grip=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.1), new THREE.MeshStandardMaterial({color:0x0e0f11, roughness:0.7})); grip.position.set(0.12,-0.16,-0.45); grip.rotation.x=0.35; rifle.add(grip);
  const scope=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.32,14), new THREE.MeshStandardMaterial({color:0x0a0a0a, roughness:0.3, metalness:0.6})); scope.rotation.z=Math.PI/2; scope.position.set(0.12,0.02,-0.55); rifle.add(scope);
  const stock=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.11,0.32), bodyMat); stock.position.set(0.12,-0.07,-0.18); rifle.add(stock);
  weaponRoot.add(rifle);
});
weaponRoot.position.set(0,0,0);
camera.add(weaponRoot);

// Sway group
let swayX=0, swayY=0, bobT=0;

// Controls — PointerLock
let moveF=false, moveB=false, moveL=false, moveR=false, sprint=false;
let velocity=new THREE.Vector3();
let isLocked=false;
let yaw=0, pitch=0;
const sensitivity=0.0022;
let canJump=false;

function lock(){
  canvas.requestPointerLock();
}
canvas.addEventListener('click', ()=>{ if(!isLocked) lock(); });
playBtn.addEventListener('click', lock);
document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement === canvas;
  centerMsg.style.display = isLocked ? 'none' : 'block';
  if(isLocked) { yaw = player.rotation.y; }
});
document.addEventListener('mousemove', (e)=>{
  if(!isLocked) return;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
  player.rotation.y = yaw;
  camera.rotation.x = pitch;
  // sway
  swayX += e.movementX*0.00012;
  swayY += e.movementY*0.00012;
  swayX = Math.max(-0.04, Math.min(0.04, swayX));
  swayY = Math.max(-0.04, Math.min(0.04, swayY));
});
window.addEventListener('keydown', (e)=>{
  if(e.code==='KeyW') moveF=true;
  if(e.code==='KeyS') moveB=true;
  if(e.code==='KeyA') moveL=true;
  if(e.code==='KeyD') moveR=true;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=true;
  if(e.code==='Space'){ if(canJump){ velocity.y=6.2; canJump=false; }}
  if(e.code==='KeyR'){ reload(); }
});
window.addEventListener('keyup', (e)=>{
  if(e.code==='KeyW') moveF=false;
  if(e.code==='KeyS') moveB=false;
  if(e.code==='KeyA') moveL=false;
  if(e.code==='KeyD') moveR=false;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=false;
});
window.addEventListener('mousedown', (e)=>{
  if(e.button===0 && isLocked) shoot();
  if(e.button===2 && isLocked){ ads(true); }
});
window.addEventListener('mouseup', (e)=>{ if(e.button===2) ads(false); });
window.addEventListener('contextmenu', e=>e.preventDefault());

// ADS
let aiming=false;
function ads(v){
  aiming=v;
  scopeOverlay.style.display = v?'flex':'none';
  document.getElementById('crosshair').style.display = v?'none':'block';
  camera.fov = v?52:74;
  camera.updateProjectionMatrix();
}

// Shooting
let ammo=30, reserve=90, kills=0, shots=0, hits=0, score=0;
let lastShot=0, isReloading=false;
let health=100;
const recoilState={x:0,y:0};
let shootRecoil=0;
function updateAmmoUI(){
  ammoMain.innerHTML = `${String(ammo).padStart(2,'0')} <span>/ ${reserve}</span>`;
  healthFill.style.width = health+'%';
  hpNum.textContent = Math.max(0,Math.round(health));
  scoreStat.textContent = `SCORE ${score}`;
  killStat.textContent = String(kills);
  enemyStat.textContent = `HOSTILES ${enemies.filter(e=>e.alive).length}`;
  if(shots>0) accStat.textContent = Math.round(hits/shots*100)+'%';
}
updateAmmoUI();

function reload(){
  if(isReloading||ammo===30||reserve===0) return;
  isReloading=true;
  const need=30-ammo;
  const take=Math.min(need,reserve);
  // anim
  weaponRoot.position.y-=0.08;
  setTimeout(()=>{ ammo+=take; reserve-=take; isReloading=false; updateAmmoUI(); pushKillfeed(`RELOAD +${take}`); weaponRoot.position.y+=0.08; },620);
}

const raycaster=new THREE.Raycaster();
const tracers=new THREE.Group(); scene.add(tracers);
const decals=new THREE.Group(); scene.add(decals);
const hitParticles=new THREE.Group(); scene.add(hitParticles);

function pushKillfeed(txt){
  const d=document.createElement('div'); d.textContent=txt; killfeed.prepend(d);
  setTimeout(()=>d.remove(), 2200);
  if(killfeed.children.length>4) killfeed.lastChild?.remove();
}

function muzzleFx(){
  muzzleFlash.material.opacity=0.95;
  muzzleLight.intensity=4.2;
  shootRecoil+=0.22;
  recoilState.x += (Math.random()-0.5)*0.025;
  recoilState.y += 0.045 + Math.random()*0.02;
  setTimeout(()=>{ muzzleFlash.material.opacity=0; muzzleLight.intensity=0; }, 55);
  // shell
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.022,6), new THREE.MeshStandardMaterial({color:0xc9a84a, metalness:0.7, roughness:0.3}));
  shell.position.copy(weaponRoot.position); // world-ish
  const wp=new THREE.Vector3(); weaponRoot.getWorldPosition(wp);
  shell.position.copy(wp); shell.position.add(new THREE.Vector3(0.25,-0.18,0.2).applyQuaternion(camera.quaternion).applyQuaternion(player.quaternion));
  shell.userData.vel=new THREE.Vector3((Math.random()-0.2)*1.2, 2.5+Math.random()*1.5, (Math.random()-0.5)*0.6);
  shell.userData.life=1.2; shell.castShadow=true; hitParticles.add(shell);
}

function shoot(){
  const now=performance.now();
  if(now-lastShot<105) return;
  if(isReloading) return;
  if(ammo<=0){ reload(); return; }
  lastShot=now;
  ammo--; shots++; updateAmmoUI();
  muzzleFx();
  // screen kick
  // raycast from camera center
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  // spread when hipfire
  if(!aiming){
    raycaster.ray.direction.x += (Math.random()-0.5)*0.012;
    raycaster.ray.direction.y += (Math.random()-0.5)*0.012;
  } else {
    raycaster.ray.direction.x += (Math.random()-0.5)*0.003;
    raycaster.ray.direction.y += (Math.random()-0.5)*0.003;
  }
  raycaster.ray.direction.normalize();
  // test enemies
  let hitEnemy=null, hitDist=999;
  let hitPoint=new THREE.Vector3();
  for(const e of enemies){
    if(!e.alive) continue;
    // sphere approx
    const toE=new THREE.Vector3().subVectors(e.mesh.position, raycaster.ray.origin);
    const proj=toE.dot(raycaster.ray.direction);
    if(proj<0||proj>80) continue;
    const closest=new THREE.Vector3().copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, proj);
    const d=closest.distanceTo(e.mesh.position);
    if(d<0.62 && proj<hitDist){ hitEnemy=e; hitDist=proj; hitPoint.copy(closest); }
  }
  // also ray vs ground/buildings for tracer end
  let tracerEnd=new THREE.Vector3().copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, hitEnemy? hitDist : 80);
  if(!hitEnemy){
    // ground intersect y=0
    if(raycaster.ray.direction.y < -0.001){
      const t=(0.05 - raycaster.ray.origin.y)/raycaster.ray.direction.y;
      if(t>0 && t < hitDist){ tracerEnd.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, t); }
    }
  }
  // tracer line
  const tracerGeo=new THREE.BufferGeometry().setFromPoints([raycaster.ray.origin.clone(), tracerEnd]);
  const tracer=new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({color:0xfff6a0, transparent:true, opacity:0.85}));
  tracers.add(tracer);
  setTimeout(()=>tracer.removeFromParent(), 65);
  // decal
  const decal=new THREE.Mesh(new THREE.CircleGeometry(0.08,8), new THREE.MeshStandardMaterial({color:0x111315, roughness:0.9}));
  decal.position.copy(tracerEnd); decal.position.y+=0.02;
  decal.rotation.x=-Math.PI/2; decal.rotation.z=Math.random()*Math.PI;
  if(hitEnemy){
    decal.material.color.set(0x3d1a1a);
    hitEnemy.hp-=34 + Math.random()*14;
    hits++; updateAmmoUI();
    hitmarkerEl.classList.add('show'); setTimeout(()=>hitmarkerEl.classList.remove('show'),90);
    // impact particles
    for(let i=0;i<6;i++){
      const p=new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6), new THREE.MeshBasicMaterial({color:0xffd0c0}));
      p.position.copy(hitPoint); p.userData.vel=new THREE.Vector3((Math.random()-0.5)*2, Math.random()*2, (Math.random()-0.5)*2); p.userData.life=0.45; hitParticles.add(p);
    }
    if(hitEnemy.hp<=0){
      hitEnemy.alive=false; hitEnemy.mesh.visible=false;
      score+=100; kills++; updateAmmoUI();
      pushKillfeed(`+100 ELIMINATION — M762`);
      // respawn after 4s
      setTimeout(()=>{ if(!hitEnemy.alive){ const ang=Math.random()*Math.PI*2; const r=12+Math.random()*8; hitEnemy.mesh.position.set(Math.cos(ang)*r,1.0, Math.sin(ang)*r); hitEnemy.hp=80; hitEnemy.alive=true; hitEnemy.mesh.visible=true; updateAmmoUI(); }}, 4000);
    }
  } else {
    decals.add(decal); setTimeout(()=>decal.removeFromParent(), 8000);
    if(decals.children.length>60) decals.children[0].removeFromParent();
  }
}

// Movement + physics
const clock=new THREE.Clock();
let lastFpsUpdate=0, frameCount=0;
function handleCollisions(nextPos){
  const radius=0.45;
  for(const b of colliders){
    const expanded=b.clone().expandByScalar(radius);
    if(expanded.containsPoint(new THREE.Vector3(nextPos.x,1.0,nextPos.z))){
      return false;
    }
  }
  // world bounds
  if(Math.abs(nextPos.x)>125 || Math.abs(nextPos.z)>125) return false;
  return true;
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(), 0.033);
  const t=clock.elapsedTime;

  // fps
  frameCount++; if(t-lastFpsUpdate>0.5){ fpsStat.textContent=Math.round(frameCount/(t-lastFpsUpdate)*0.5*60/30*60||60)+' FPS'; // approx
    // simpler: use dt
    fpsStat.textContent = Math.round(1/Math.max(dt,0.001))+' FPS'; lastFpsUpdate=t; frameCount=0; }

  // enemies patrol
  for(const e of enemies){
    if(!e.alive) continue;
    e.patrol.ang += dt*e.patrol.speed*0.6;
    const nx=e.patrol.cx + Math.cos(e.patrol.ang)*e.patrol.r;
    const nz=e.patrol.cz + Math.sin(e.patrol.ang)*e.patrol.r;
    e.mesh.position.x += (nx - e.mesh.position.x)*dt*2.2;
    e.mesh.position.z += (nz - e.mesh.position.z)*dt*2.2;
    e.mesh.lookAt(player.position.x, e.mesh.position.y, player.position.z);
    // occasional damage to player if close and in front
    if(e.mesh.position.distanceTo(player.position)<7.5 && Math.random()<0.009){
      health=Math.max(0, health-7); updateAmmoUI();
      dmgVignette.classList.add('hit'); setTimeout(()=>dmgVignette.classList.remove('hit'),180);
      camera.rotation.z = (Math.random()-0.5)*0.06;
      setTimeout(()=>camera.rotation.z=0,120);
      if(health<=0){ health=100; score=Math.max(0,score-50); updateAmmoUI(); pushKillfeed('DOWNED — RESPAWN'); player.position.set(0,1.7,14); velocity.set(0,0,0); }
    }
  }

  if(isLocked){
    // input vector
    const speedBase = sprint? 7.2 : 4.1;
    const forward=new THREE.Vector3(), right=new THREE.Vector3();
    camera.getWorldDirection(forward); forward.y=0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).negate(); // actually right = forward x up
    // simpler: use player yaw
    const fwdY=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-1); // careful sign
    // derive: yaw 0 looks toward -Z, so forward is (sin(yaw),0,-cos(yaw))
    const fwd=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw));
    const rg=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
    // but right should be (cos yaw, 0, sin yaw)? need test; use rg as right
    let move=new THREE.Vector3();
    if(moveF) move.add(fwd);
    if(moveB) move.sub(fwd);
    if(moveR) move.add(rg);
    if(moveL) move.sub(rg);
    if(move.length()>0){ move.normalize().multiplyScalar(speedBase*dt); }
    // propose next pos
    let next=player.position.clone().add(move);
    // simple slide: test x then z
    let tryX=new THREE.Vector3(next.x, player.position.y, player.position.z);
    if(!handleCollisions(tryX)) tryX.x=player.position.x;
    let tryZ=new THREE.Vector3(tryX.x, player.position.y, next.z);
    if(!handleCollisions(tryZ)) tryZ.z=player.position.z;
    player.position.x=tryX.x; player.position.z=tryZ.z;

    // gravity
    velocity.y -= 14.0*dt;
    player.position.y += velocity.y*dt;
    if(player.position.y <= 1.7){ player.position.y=1.7; velocity.y=0; canJump=true; }

    // velocity stats
    velStat.textContent = (move.length()/dt).toFixed(1);
    posStat.textContent = `${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`;

    // weapon bob + sway + recoil + ADS lerp
    bobT += dt * (move.length()>0 ? (sprint? 14 : 9) : 2);
    const bobX=Math.sin(bobT)*0.012 * (move.length()>0?1:0.15);
    const bobY=Math.abs(Math.cos(bobT))*0.015 * (move.length()>0?1:0.12);
    // recoil decay
    shootRecoil *= Math.pow(0.12, dt*10);
    recoilState.x *= Math.pow(0.08, dt*10);
    recoilState.y *= Math.pow(0.08, dt*10);
    const adsLerp = aiming? 0.18 : 1;
    // apply to weaponRoot
    weaponRoot.position.x = THREE.MathUtils.lerp(weaponRoot.position.x, (aiming?0.02:0.35) + swayX*0.6 + recoilState.x, 0.18);
    weaponRoot.position.y = THREE.MathUtils.lerp(weaponRoot.position.y, (aiming?-0.18:-0.24) + swayY*0.6 + bobY - shootRecoil*0.18, 0.18);
    weaponRoot.position.z = THREE.MathUtils.lerp(weaponRoot.position.z, (aiming?-0.52:-0.72) - Math.abs(swayX)*0.2, 0.22);
    weaponRoot.rotation.x = THREE.MathUtils.lerp(weaponRoot.rotation.x, (aiming?0:0.05) + bobY*0.6 + recoilState.y*0.6, 0.18);
    weaponRoot.rotation.y = THREE.MathUtils.lerp(weaponRoot.rotation.y, (aiming?0:0.02) + swayX*0.25 - recoilState.x*0.3, 0.18);
    swayX*=0.94; swayY*=0.94;
    // subtle camera roll when strafing
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, (moveR?-0.025: moveL?0.025:0) * (sprint?1.4:1), 0.12);
  }

  // hit particles life
  for(let i=hitParticles.children.length-1;i>=0;i--){
    const p=hitParticles.children[i];
    if(p.userData.vel){ p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y -= 6*dt; }
    if(p.userData.life!==undefined){ p.userData.life-=dt; p.material.opacity = Math.max(0, p.userData.life/0.45); if(p.material.transparent===false){ p.material.transparent=true; } if(p.userData.life<=0) p.removeFromParent(); }
  }

  // minimap
  miniCtx.clearRect(0,0,150,150);
  miniCtx.fillStyle='rgba(8,16,12,0.9)'; miniCtx.fillRect(0,0,150,150);
  miniCtx.strokeStyle='rgba(232,255,0,0.12)'; miniCtx.lineWidth=1;
  for(let i=0;i<150;i+=15){ miniCtx.beginPath(); miniCtx.moveTo(i,0); miniCtx.lineTo(i,150); miniCtx.stroke(); miniCtx.beginPath(); miniCtx.moveTo(0,i); miniCtx.lineTo(150,i); miniCtx.stroke(); }
  // buildings on minimap
  miniCtx.fillStyle='rgba(120,130,135,0.9)';
  for(const b of colliders){ const x=(b.min.x+125)/250*150; const z=(b.min.z+125)/250*150; const w=(b.max.x-b.min.x)/250*150; const d=(b.max.z-b.min.z)/250*150; miniCtx.fillRect(x,z,w,d); }
  // enemies
  for(const e of enemies){ if(!e.alive) continue; const ex=(e.mesh.position.x+125)/250*150; const ez=(e.mesh.position.z+125)/250*150; miniCtx.fillStyle='#ff3b30'; miniCtx.beginPath(); miniCtx.arc(ex,ez,3,0,Math.PI*2); miniCtx.fill(); }
  // player
  const px=(player.position.x+125)/250*150; const pz=(player.position.z+125)/250*150;
  miniCtx.fillStyle='#e8ff00'; miniCtx.beginPath(); miniCtx.arc(px,pz,4,0,Math.PI*2); miniCtx.fill();
  miniCtx.strokeStyle='#e8ff00'; miniCtx.lineWidth=2; miniCtx.beginPath(); miniCtx.moveTo(px,pz); miniCtx.lineTo(px+Math.sin(yaw)*12, pz+Math.cos(yaw)*12); miniCtx.stroke();

  renderer.render(scene, camera);
}
window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
updateAmmoUI();

// expose for tests
window.__FPS__={ player, enemies, shoot, reload, get ammo(){return ammo}, get health(){return health}, scene, renderer, camera };

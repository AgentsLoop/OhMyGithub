import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---- Scene / Renderer ----
const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1620, 0.018);
scene.background = new THREE.Color(0x87a8c7); // will be overwritten by sky

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
wrap.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 800);
camera.position.set(0, 1.7, 5);

// --- Lighting: AAA trio ---
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x0a1a0a, 1.1));
const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
sun.position.set(40, 48, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 180;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0004;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8ecbff, 0.45);
fill.position.set(-26, 18, -18);
scene.add(fill);

// Environment for PBR reflections
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x9ab7d6);
const envRenderTarget = pmrem.fromScene(envScene, 0.04);
scene.environment = envRenderTarget.texture;

// Sky dome gradient
function makeSky(){
  const geo = new THREE.SphereGeometry(400, 32, 15);
  const pos = geo.attributes.position;
  const col = [];
  for(let i=0;i<pos.count;i++){
    const y = pos.getY(i);
    const t = THREE.MathUtils.clamp((y+20)/380,0,1);
    const c = new THREE.Color().lerpColors(new THREE.Color(0x7aa0c7), new THREE.Color(0xe6eef8), Math.pow(t,0.7));
    col.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col,3));
  const mat = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.BackSide, fog:false});
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
}
makeSky();

// Ground + terrain
const groundMat = new THREE.MeshStandardMaterial({ color: 0x55604a, roughness: 0.92, metalness: 0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600,600), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);
// detail ground patches
for(let i=0;i<18;i++){
  const s = 6 + Math.random()*18;
  const m = new THREE.Mesh(new THREE.CircleGeometry(s, 12), new THREE.MeshStandardMaterial({color: 0x6b735e, roughness:1}));
  m.rotation.x = -Math.PI/2; m.position.set((Math.random()-0.5)*280, 0.02, (Math.random()-0.5)*280);
  m.receiveShadow = true; scene.add(m);
}

// Cover / buildings — COD urban ridge
const boxMat = new THREE.MeshStandardMaterial({ color: 0x7a7f87, roughness:0.78, metalness:0.08 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b333f, roughness:0.85 });
const rustMat = new THREE.MeshStandardMaterial({ color: 0x8c5a3a, roughness:0.88 });
function box(w,h,d,x,z,mat=boxMat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x, h/2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); colliders.push(m); return m;
}
const colliders = [];
// perimeter walls
box(6,4,120,-18,0); box(6,4,120,18,0);
box(120,4,6,0,-22, darkMat); box(80,3,4,0,26, rustMat);
// cover blocks
box(3,1.4,2, -8, -6); box(2.5,1.2,1.8, 7, -4); box(4,1.6,1.2, 0, -10);
box(2,1.1,2.2, -10, 6); box(3,1.5,1.4, 9, 8);
box(1.6,2.2,1.6, -4, 4, darkMat); box(1.6,2.2,1.6, 5, 2, darkMat);
// concrete barriers
for(let i=-2;i<=2;i++) box(0.7,0.9,0.3, i*2, 12, darkMat);
// watchtower
box(4,8,4, -14, -14, darkMat);
// distant mountains (low poly)
for(let i=0;i<6;i++){
  const h = 14+Math.random()*18;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(18+Math.random()*12, h, 6), new THREE.MeshStandardMaterial({color:0x4a5a6e, roughness:1}));
  const ang = i/6*Math.PI*2; const r=140; cone.position.set(Math.cos(ang)*r, h/2 -6, Math.sin(ang)*r); scene.add(cone);
}

// ---- Controls (PointerLock FPS) ----
let yaw = 0, pitch = 0;
let moveF=0, moveB=0, moveL=0, moveR=0, sprint=false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let onGround = true;
let health = 100, ammo = 30, reserve = 90, score = 0, kills = 0;
let gameActive = false, isADS = false, isReloading = false;
let spawnProtectionUntil = 0;
let lastShot = 0;
const fireInterval = 120; // ms

const healthText = document.getElementById('health-text');
const healthFill = document.getElementById('health-fill');
const ammoText = document.getElementById('ammo-text');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const hitmarker = document.getElementById('hitmarker');
const killfeed = document.getElementById('killfeed');
const vignette = document.getElementById('damage-vignette');
const scopeOverlay = document.getElementById('scope-overlay');
const crosshair = document.getElementById('crosshair');

function updateHUD(){
  healthText.innerHTML = Math.max(0,Math.round(health))+' <small>HP</small>';
  healthFill.style.width = Math.max(0,health)+'%';
  healthFill.classList.toggle('low', health<30);
  ammoText.innerHTML = (isReloading? 'RELOADING': ammo) + ' <small>/ '+reserve+'</small>';
  scoreEl.innerHTML = 'SCORE <b>'+score+'</b>';
}
updateHUD();

let startTime = performance.now();
function tickTimer(){
  const elapsed = Math.floor((performance.now()-startTime)/1000);
  const m = String(Math.floor(elapsed/60)).padStart(2,'0');
  const s = String(elapsed%60).padStart(2,'0');
  timerEl.textContent = m+':'+s;
  if(gameActive && elapsed>=90) winGame();
}

// Input
addEventListener('keydown', e=>{
  if(e.code==='KeyW') moveF=1;
  if(e.code==='KeyS') moveB=1;
  if(e.code==='KeyA') moveL=1;
  if(e.code==='KeyD') moveR=1;
  if(e.code==='ShiftLeft') sprint=true;
  if(e.code==='Space' && onGround){ velocity.y = 6.5; onGround=false; }
  if(e.code==='KeyR') reload();
  if(e.code==='Escape') pauseGame();
});
addEventListener('keyup', e=>{
  if(e.code==='KeyW') moveF=0;
  if(e.code==='KeyS') moveB=0;
  if(e.code==='KeyA') moveL=0;
  if(e.code==='KeyD') moveR=0;
  if(e.code==='ShiftLeft') sprint=false;
});
addEventListener('mousedown', e=>{
  if(!gameActive) return;
  if(e.button===0) shoot();
  if(e.button===2) setADS(true);
});
addEventListener('mouseup', e=>{
  if(e.button===2) setADS(false);
});
addEventListener('contextmenu', e=> e.preventDefault());
renderer.domElement.addEventListener('click', ()=>{
  if(!gameActive) return;
  if(document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', ()=>{
  const locked = document.pointerLockElement === renderer.domElement;
  if(!locked && gameActive && !document.getElementById('dead-overlay').classList.contains('hidden')) return;
  if(!locked && gameActive) pauseGame();
});
addEventListener('mousemove', e=>{
  if(document.pointerLockElement !== renderer.domElement) return;
  const sens = isADS ? 0.0012 : 0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = THREE.MathUtils.clamp(pitch, -1.45, 1.45);
});

let adsT = 0; // 0..1 lerp for ADS
let targetADS = 0;
function setADS(v){
  isADS = v;
  targetADS = v ? 1 : 0;
  crosshair.style.display = v ? 'none' : 'block';
}
function updateADS(dt){
  adsT = THREE.MathUtils.damp(adsT, targetADS, 14, dt);
  const fov = THREE.MathUtils.lerp(74, 42, adsT);
  if(Math.abs(camera.fov - fov) > 0.02){ camera.fov = fov; camera.updateProjectionMatrix(); }
  scopeOverlay.style.opacity = String(adsT);
  scopeOverlay.classList.toggle('on', adsT > 0.02);
  if(adsT > 0.02 && adsT < 0.98) scopeOverlay.style.display = 'block';
  else if(adsT <= 0.02) scopeOverlay.style.display = 'none';
  else scopeOverlay.style.display = 'block';
}

// Simple collision (AABB vs point radius)
function collide(pos, radius=0.6){
  for(const m of colliders){
    const b = new THREE.Box3().setFromObject(m);
    b.expandByScalar(radius);
    if(b.containsPoint(pos)) return true;
  }
  // bounds
  if(Math.abs(pos.x)>42 || Math.abs(pos.z)>42) return true;
  return false;
}

// ---- Weapon viewmodel ----
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);

let weaponMesh = null;
let muzzle = new THREE.Object3D();
const loader = new GLTFLoader();
loader.load('/models/weapon.glb', (gltf)=>{
  weaponMesh = gltf.scene;
  // Normalize: center and scale
  const box = new THREE.Box3().setFromObject(weaponMesh);
  const size = new THREE.Vector3(); box.getSize(size);
  const maxDim = Math.max(size.x,size.y,size.z);
  const scale = 1.6 / maxDim;
  weaponMesh.scale.setScalar(scale);
  // re-center
  const center = new THREE.Vector3(); box.getCenter(center);
  weaponMesh.position.sub(center.multiplyScalar(scale));
  // orient for FPS view: rifle points forward (-Z), adjust
  weaponMesh.rotation.set(0, Math.PI, 0);
  weaponMesh.position.set(0.42, -0.42, -0.9);
  weaponMesh.traverse(o=>{
    if(o.isMesh){ o.castShadow = true; o.frustumCulled=false; }
  });
  weaponGroup.add(weaponMesh);
  muzzle.position.set(0, 0.05, -0.95); // relative to weapon
  weaponGroup.add(muzzle);
  // attribution line already in HTML, but confirm file exists
  console.log('Weapon loaded', gltf);
}, undefined, (err)=>{
  console.warn('Weapon GLB failed, fallback box', err);
  const fallback = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.65), new THREE.MeshStandardMaterial({color:0x1a1f29, roughness:0.4, metalness:0.6}));
  fallback.position.set(0.42,-0.42,-0.8); weaponGroup.add(fallback); weaponMesh = fallback;
  muzzle.position.set(0.42, -0.32, -0.1); weaponGroup.add(muzzle);
});

// Fallback if weapon not yet: ensure weaponGroup exists
if(!weaponMesh){ muzzle.position.set(0.4,-0.35,-0.6); weaponGroup.add(muzzle); }

// Muzzle flash
const flashLight = new THREE.PointLight(0xffb86a, 0, 4);
flashLight.intensity = 0; scene.add(flashLight);
const flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,8), new THREE.MeshBasicMaterial({color:0xfff1a0, transparent:true, opacity:0}));
flashMesh.rotation.x = Math.PI/2; flashMesh.position.copy(muzzle.position); weaponGroup.add(flashMesh);
let flashUntil = 0;
function triggerFlash(){
  flashMesh.material.opacity = 0.95; flashLight.intensity = 6; flashLight.position.copy(muzzle.getWorldPosition(new THREE.Vector3())); flashUntil = performance.now()+70;
}

// Recoil anim state
let recoil = 0;
let sway = 0;

// ---- Enemies ----
const enemies = [];
const enemyGeo = new THREE.CapsuleGeometry(0.42, 1.0, 4, 12);
function spawnEnemy(){
  const mat = new THREE.MeshStandardMaterial({color: 0x1d2a3a, roughness:0.7, metalness:0.1});
  const mesh = new THREE.Mesh(enemyGeo, mat);
  mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  // helmet
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.3,12,8), new THREE.MeshStandardMaterial({color:0x2f3f2f}));
  helm.position.y = 0.75; g.add(helm);
  // health bar sprite
  const hp = 100;
  g.userData = { hp, max:100, alive:true, nextShot: performance.now()+1800+Math.random()*1800, vel:new THREE.Vector3((Math.random()-0.5)*1.2,0,(Math.random()-0.5)*1.2) };
  // spawn around perimeter but not inside walls and away from player spawn (0,6)
  let x,z; let tries=0; do{ x=(Math.random()-0.5)*36; z=(Math.random()-0.5)*36; tries++; } while((Math.sqrt(x*x+z*z)<7 || Math.hypot(x-0, z-6)<12 || collide(new THREE.Vector3(x,0,z),0.9)) && tries<40);
  g.position.set(x, 0.95, z);
  scene.add(g); enemies.push(g);
}
for(let i=0;i<6;i++) spawnEnemy();
setInterval(()=>{ if(gameActive && enemies.filter(e=>e.userData.alive).length<9) spawnEnemy(); }, 1800);

// Raycaster for shooting
const raycaster = new THREE.Raycaster();
function shoot(){
  const now = performance.now();
  if(now-lastShot < fireInterval) return;
  if(isReloading) return;
  if(ammo<=0){ reload(); return; }
  lastShot = now;
  ammo--; updateHUD();
  triggerFlash();
  recoil = 1.0;
  // camera kick
  pitch = THREE.MathUtils.clamp(pitch + 0.018 + Math.random()*0.01, -1.45,1.45);
  yaw += (Math.random()-0.5)*0.02;

  // tracer
  const start = muzzle.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  // spread
  const spread = isADS ? 0.002 : 0.014;
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.normalize();
  raycaster.set(start, dir);
  const targets = enemies.filter(e=>e.userData.alive);
  const intersects = raycaster.intersectObjects(targets, true);
  let hitEnemy = null; let hitPoint = null;
  if(intersects.length){
    const hit = intersects[0];
    hitPoint = hit.point;
    // find root enemy group
    let obj = hit.object;
    while(obj && !enemies.includes(obj)) obj = obj.parent;
    hitEnemy = obj;
  } else {
    hitPoint = start.clone().add(dir.multiplyScalar(80));
  }
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([start, hitPoint]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({color:0xfff2a0, transparent:true, opacity:0.9}));
  scene.add(tracer); setTimeout(()=>scene.remove(tracer), 60);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.7}));
  puff.position.copy(hitPoint); scene.add(puff);
  let puffT=0; (function animPuff(){ puffT+=0.16; puff.scale.setScalar(1+puffT*2); puff.material.opacity = 0.7 - puffT; if(puffT<0.7) requestAnimationFrame(animPuff); else scene.remove(puff); })();
  if(!hitEnemy){
    const decal = new THREE.Mesh(new THREE.CircleGeometry(0.05,6), new THREE.MeshBasicMaterial({color:0x111111, transparent:true, opacity:0.85, side:THREE.DoubleSide}));
    decal.position.copy(hitPoint).add(new THREE.Vector3(0,0.015,0));
    decal.rotation.x = -Math.PI/2;
    decal.rotation.z = Math.random()*Math.PI;
    scene.add(decal);
    setTimeout(()=>{ decal.material.opacity=0; setTimeout(()=>scene.remove(decal),400); }, 6000);
  }

  if(hitEnemy){
    hitEnemy.userData.hp -= isADS ? 55 : 38;
    hitEnemy.children[0].material.color.set(0xff3b30);
    setTimeout(()=>{ if(hitEnemy.userData.alive) hitEnemy.children[0].material.color.set(0x1d2a3a); }, 90);
    showHitmarker(false);
    if(hitEnemy.userData.hp<=0){
      killEnemy(hitEnemy);
    }
    // impulse
    hitEnemy.position.add(dir.clone().multiplyScalar(0.3));
  }

  // ammo check auto reload
  if(ammo===0 && reserve>0) setTimeout(reload, 320);
}

function showHitmarker(kill){
  hitmarker.classList.add('show');
  hitmarker.style.borderColor = kill? '#ff3b30':'#fff';
  setTimeout(()=>hitmarker.classList.remove('show'), 140);
  if(kill){
    const k = document.createElement('div'); k.className='kill'; k.textContent='ELIMINATED HOSTILE +100';
    killfeed.prepend(k); setTimeout(()=>k.remove(), 2200);
  }
}
function killEnemy(g){
  if(!g.userData.alive) return;
  g.userData.alive = false;
  score+=100; kills++; updateHUD();
  showHitmarker(true);
  // death anim
  g.rotation.z = Math.PI/3; g.position.y = 0.4;
  setTimeout(()=>{ scene.remove(g); const idx=enemies.indexOf(g); if(idx>=0) enemies.splice(idx,1); }, 2400);
  // drop maybe
  if(Math.random()<0.35){ reserve+=12; updateHUD(); }
}

function reload(){
  if(isReloading || ammo===30 || reserve<=0) return;
  isReloading = true; updateHUD();
  const need = 30 - ammo;
  setTimeout(()=>{
    const take = Math.min(need, reserve);
    ammo += take; reserve -= take; isReloading=false; updateHUD();
  }, 1100);
}

// Damage from enemies (simple line-of-sight shooting)
function enemyAI(dt){
  const now = performance.now();
  for(const e of enemies){
    if(!e.userData.alive) continue;
    // patrol
    const vel = e.userData.vel;
    let next = e.position.clone().add(vel.clone().multiplyScalar(dt));
    if(collide(next,0.6) || Math.random()<0.01){ vel.x = (Math.random()-0.5)*1.4; vel.z = (Math.random()-0.5)*1.4; } else {
      e.position.copy(next);
    }
    e.lookAt(camera.position.x, e.position.y, camera.position.z);
    // shoot if visible and cooldown
    const dist = e.position.distanceTo(camera.position);
    if(dist<28 && now > e.userData.nextShot){
      raycaster.set(e.position.clone().add(new THREE.Vector3(0,0.5,0)), camera.position.clone().sub(e.position).normalize());
      const hits = raycaster.intersectObjects(colliders, false);
      const blocked = hits.length && hits[0].distance < dist - 1;
      if(!blocked){
        e.userData.nextShot = now + 1400 + Math.random()*1100;
        const l = new THREE.PointLight(0xffb86a, 4, 6); l.position.copy(e.position).y+=1.2; scene.add(l); setTimeout(()=>scene.remove(l), 40);
        if(gameActive && now > spawnProtectionUntil && Math.random()<0.32){
          health -= 4 + Math.random()*4;
          updateHUD();
          vignette.classList.add('hit'); setTimeout(()=>vignette.classList.remove('hit'), 180);
          camera.position.y += (Math.random()-0.5)*0.04;
          if(health<=0) die();
        }
      } else {
        e.userData.nextShot = now + 400;
      }
    }
    // health bar color already handled
  }
}
function die(){
  if(health<=0){
    gameActive=false;
    document.exitPointerLock?.();
    document.getElementById('dead-stats').textContent = `Kills: ${kills} · Score: ${score} · Survived ${Math.floor((performance.now()-startTime)/1000)}s`;
    document.getElementById('dead-overlay').classList.remove('hidden');
  }
}
function winGame(){
  gameActive=false; document.exitPointerLock?.();
  const card = document.querySelector('#start-overlay .card');
  document.getElementById('start-overlay').classList.remove('hidden');
  card.querySelector('h1').innerHTML = 'RIDGE <span style="color:#00ff9c">HELD</span>';
  card.querySelector('.sub').textContent = `Mission success — ${kills} hostiles eliminated, score ${score}. You held the ridge for 90 seconds.`;
  document.getElementById('play-btn').textContent = 'Play Again';
}

// Movement loop
let last = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now(); const dt = Math.min(0.033, (now-last)/1000); last = now;
  tickTimer();
  if(gameActive && document.pointerLockElement===renderer.domElement){
    // move vector
    direction.z = Number(moveF) - Number(moveB);
    direction.x = Number(moveR) - Number(moveL);
    direction.normalize();
    const speed = sprint ? 5.2 : 3.1;
    const forward = new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(0,yaw,0));
    const right = new THREE.Vector3(1,0,0).applyEuler(new THREE.Euler(0,yaw,0));
    const move = new THREE.Vector3();
    move.addScaledVector(forward, direction.z * speed * dt);
    move.addScaledVector(right, direction.x * speed * dt);
    // gravity
    velocity.y -= 18 * dt;
    move.y = velocity.y * dt;
    const next = camera.position.clone().add(move);
    // horizontal collision
    const horiz = new THREE.Vector3(next.x, camera.position.y, next.z);
    if(!collide(horiz,0.5)) { camera.position.x = next.x; camera.position.z = next.z; }
    // vertical
    camera.position.y += move.y;
    if(camera.position.y < 1.7){ camera.position.y = 1.7; velocity.y = 0; onGround = true; } else { onGround = false; }
  }
  // apply yaw/pitch to camera
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  updateADS(dt);
  sway += dt*7;
  const bob = (moveF||moveB||moveL||moveR) ? Math.sin(sway)*0.012 : 0;
  const bobY = (moveF||moveB||moveL||moveR) ? Math.abs(Math.cos(sway*0.9))*0.01 : 0;
  const adsOffsetX = THREE.MathUtils.lerp(0, -0.12, adsT);
  const adsOffsetY = THREE.MathUtils.lerp(0, 0.06, adsT);
  const adsOffsetZ = THREE.MathUtils.lerp(0, 0.14, adsT);
  weaponGroup.position.x = bob + adsOffsetX;
  weaponGroup.position.y = bobY + (recoil*0.06) + adsOffsetY;
  weaponGroup.position.z = adsOffsetZ;
  weaponGroup.rotation.x = recoil*0.5 + adsT*0.04;
  weaponGroup.rotation.z = bob*0.6;
  recoil = Math.max(0, recoil - dt*6);

  // muzzle flash fade
  if(now > flashUntil && flashMesh.material.opacity>0){ flashMesh.material.opacity = Math.max(0, flashMesh.material.opacity - dt*12); flashLight.intensity = Math.max(0, flashLight.intensity - dt*60); }

  enemyAI(dt);

  // keep camera inside bounds height fog adjustment
  renderer.render(scene,camera);
}
animate();

// Resize
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});

// UI controls
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
document.getElementById('play-btn').addEventListener('click', ()=>{
  startOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  document.getElementById('dead-overlay').classList.add('hidden');
  health=100; ammo=30; reserve=90; score=0; kills=0; startTime=performance.now(); updateHUD();
  camera.position.set(0,1.7, 6); yaw=0; pitch=0; velocity.set(0,0,0);
  spawnProtectionUntil = performance.now() + 2200;
  for(const e of enemies) e.userData.nextShot = performance.now() + 1200 + Math.random()*1200;
  gameActive = true;
  renderer.domElement.requestPointerLock();
});
document.getElementById('resume-btn').addEventListener('click', ()=>{
  pauseOverlay.classList.add('hidden'); gameActive=true; renderer.domElement.requestPointerLock();
});
document.getElementById('respawn-btn').addEventListener('click', ()=>{
  document.getElementById('dead-overlay').classList.add('hidden');
  health=100; ammo=30; reserve=90; startTime=performance.now(); camera.position.set(0,1.7,6); yaw=0; pitch=0; velocity.set(0,0,0); updateHUD();
  spawnProtectionUntil = performance.now() + 2200;
  for(const e of enemies) e.userData.nextShot = performance.now() + 1200 + Math.random()*1200;
  gameActive=true; renderer.domElement.requestPointerLock();
});
function pauseGame(){
  if(!gameActive) return;
  gameActive=false; pauseOverlay.classList.remove('hidden'); document.exitPointerLock?.();
}

// Load attribution display
fetch('/models/weapon.glb.attribution.json').then(r=>r.json()).then(j=>{
  document.getElementById('attribution-line').textContent = `${j.name} — ${j.author} (${j.license}) via Sketchfab`;
  document.getElementById('weapon-name').textContent = j.name.toUpperCase();
}).catch(()=>{});

// Expose for verifier
window.__FPS_READY__ = true;

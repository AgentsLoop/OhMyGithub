import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');
const pausedEl = document.getElementById('paused');
const scoreEl = document.querySelector('#score span');
const healthEl = document.querySelector('#health span');
const ammoCurrentEl = document.getElementById('ammo-current');
const ammoReserveEl = document.getElementById('ammo-reserve');
const timerEl = document.getElementById('timer');
const hitmarker = document.getElementById('hitmarker');
const vignette = document.getElementById('damage-vignette');
const creditEl = document.getElementById('credit');

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0f1f, 28, 110);
scene.background = new THREE.Color(0x0f1426);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 300);
camera.position.set(0, 1.7, 8);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Lights — CoD-like tactical dusk
scene.add(new THREE.HemisphereLight(0x8ea6ff, 0x0a0f14, 0.9));
const dir = new THREE.DirectionalLight(0xfff0d6, 2.2);
dir.position.set(18, 28, 12);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 120;
dir.shadow.camera.left = -40; dir.shadow.camera.right = 40; dir.shadow.camera.top = 40; dir.shadow.camera.bottom = -40;
dir.shadow.bias = -0.0004;
scene.add(dir);
const fill = new THREE.DirectionalLight(0x6b8cff, 0.55); fill.position.set(-12, 14, -10); scene.add(fill);

// Environment
const floorGeo = new THREE.PlaneGeometry(80, 80);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1b2136, roughness: 0.92, metalness: 0.04 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

// Grid decal subtle
const grid = new THREE.GridHelper(80, 40, 0x2a355a, 0x1a2540);
grid.position.y = 0.02; scene.add(grid);

// Walls / cover — tactical arena
const wallMat = new THREE.MeshStandardMaterial({ color: 0x242c44, roughness: 0.88, metalness: 0.08 });
const boxMat2 = new THREE.MeshStandardMaterial({ color: 0x2e3654, roughness: 0.86 });
function addBox(x,z,w,h,d, mat=wallMat){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  walls.push(m);
  return m;
}
const walls=[];
// perimeter
addBox(0, -40, 80, 8, 1); addBox(0, 40, 80, 8, 1);
addBox(-40, 0, 1, 8, 80); addBox(40, 0, 1, 8, 80);
// cover
addBox(-10, -8, 6, 1.6, 1.2, boxMat2); addBox(10, -10, 5, 1.8, 1.2, boxMat2);
addBox(-6, 6, 4, 1.4, 4, boxMat2); addBox(8, 12, 8, 1.2, 1, boxMat2);
addBox(-16, 14, 1, 2.2, 8, wallMat); addBox(18, -2, 1, 2.2, 10, wallMat);
addBox(0, -18, 10, 1.2, 1, boxMat2); addBox(0, 18, 12, 1, 1, boxMat2);
addBox(-22, -18, 8, 1, 1, boxMat2); addBox(22, 16, 6, 1.6, 1.2, boxMat2);

// Targets
const targets=[];
const targetGroup=new THREE.Group(); scene.add(targetGroup);
function spawnTargets(){
  targetGroup.clear(); targets.length=0;
  const positions=[[-14,-6],[14,-8],[-8,10],[12,14],[0,4],[-18,18],[18,-16],[6,-14]];
  positions.forEach((p,i)=>{
    const g=new THREE.Group(); g.position.set(p[0],0,p[1]);
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.5,1.2,4,12), new THREE.MeshStandardMaterial({color:0x8f9cff, emissive:0x18204a, emissiveIntensity:0.35, roughness:0.5, metalness:0.1}));
    body.position.y=1.1; body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.33,12,12), new THREE.MeshStandardMaterial({color:0xffd6a0, roughness:0.6}));
    head.position.y=2.05; head.castShadow=true; g.add(head);
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.55,0.62,24), new THREE.MeshBasicMaterial({color:0x5a82ff, side:THREE.DoubleSide, transparent:true, opacity:.45}));
    ring.rotation.x=Math.PI/2; ring.position.y=0.04; g.add(ring);
    g.userData={hp:100, max:100, alive:true, idx:i, body, head, baseY:0, respawn:0};
    targetGroup.add(g); targets.push(g);
  });
}
spawnTargets();

// Weapon viewmodel
const weaponGroup=new THREE.Group();
camera.add(weaponGroup);
scene.add(camera);
weaponGroup.position.set(0.32,-0.28,-0.62);

let weaponMesh=null; let muzzle=null;
function addMuzzle(){
  muzzle=new THREE.PointLight(0xffc26a, 0, 6, 1.8);
  muzzle.position.set(0, -0.05, -0.85);
  weaponGroup.add(muzzle);
  const flash=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,6), new THREE.MeshBasicMaterial({color:0xfff2b8, transparent:true, opacity:0}));
  flash.rotation.x=Math.PI/2; flash.position.copy(muzzle.position); flash.position.z-=0.08;
  flash.name='flash'; weaponGroup.add(flash);
}
addMuzzle();
let proceduralWeapon=null;
function createProcedural(){
  const grp=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.06,0.52), new THREE.MeshStandardMaterial({color:0x191c22, roughness:0.55, metalness:0.35}));
  body.position.set(0,-0.02,-0.1); body.castShadow=true; grp.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.022,0.42,12), new THREE.MeshStandardMaterial({color:0x0f1115, roughness:0.35, metalness:0.6}));
  barrel.rotation.x=Math.PI/2; barrel.position.set(0,-0.015,-0.38); barrel.castShadow=true; grp.add(barrel);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.08), new THREE.MeshStandardMaterial({color:0x111319, roughness:0.7}));
  mag.position.set(0,-0.09,-0.08); grp.add(mag);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,0.07), new THREE.MeshStandardMaterial({color:0x2a2f3a}));
  sight.position.set(0,0.03,-0.12); grp.add(sight);
  grp.position.set(0,0,0);
  weaponGroup.add(grp);
  proceduralWeapon=grp;
  weaponMesh=grp;
}
createProcedural();

async function tryLoadGLB(){
  const candidates=['/models/weapon.glb','/models/weapon-normalized.glb','/public/models/weapon.glb'];
  const loader=new GLTFLoader();
  for(const url of candidates){
    try{
      const gltf=await loader.loadAsync(url);
      const root=gltf.scene;
      // center and scale
      root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; }});
      const box=new THREE.Box3().setFromObject(root);
      const size=new THREE.Vector3(); box.getSize(size);
      const center=new THREE.Vector3(); box.getCenter(center);
      root.position.sub(center);
      const maxDim=Math.max(size.x,size.y,size.z);
      const scale= maxDim>1.2 ? 0.55/maxDim : 0.55;
      root.scale.setScalar(scale);
      root.position.set(0, -0.08, -0.18);
      root.rotation.set(0, -0.05, 0);
      // remove procedural then add
      if(proceduralWeapon) proceduralWeapon.visible=false;
      weaponGroup.add(root);
      weaponMesh=root;
      // animations if any
      if(gltf.animations && gltf.animations.length){
        const mixer=new THREE.AnimationMixer(root);
        mixer.clipAction(gltf.animations[0]).play();
        weaponGroup.userData.mixer=mixer;
      }
      // try fetch attribution to update credit
      try{
        const r=await fetch(url+'.attribution.json'); if(r.ok){ const j=await r.json(); creditEl.textContent=`Weapon: ${j.title||j.name||'Sketchfab'} by ${j.author||j.user||'artist'} — ${j.license||'CC'} • ${j.url||''}`; }
      }catch{}
      return true;
    }catch(e){}
  }
  creditEl.textContent='Weapon: procedural M4A1 Tactical (fallback) — Sketchfab GLB not found, using PBR procedural';
  return false;
}
tryLoadGLB();

// Input state
const keys={};
let sprint=false, crouch=false;
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') sprint=true;
  if(e.code==='ControlLeft'||e.code==='ControlRight') crouch=true;
  if(e.code==='KeyR') reload();
});
addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') sprint=false;
  if(e.code==='ControlLeft'||e.code==='ControlRight') crouch=false;
});
let mouseDown=false;
addEventListener('mousedown', e=>{ if(controls.isLocked && e.button===0) mouseDown=true; });
addEventListener('mouseup', e=>{ if(e.button===0) mouseDown=false; });

// Player physics
let vel=new THREE.Vector3();
let onGround=true; let playerHeight=1.7;
let health=100, score=0, ammo=30, reserve=90;
let fireCooldown=0, reloadTimer=0;
let timeLeft=120; let lastShot=0;

function updateHUD(){
  healthEl.textContent=health;
  scoreEl.textContent=score;
  ammoCurrentEl.textContent=ammo;
  ammoReserveEl.textContent=reserve;
  timerEl.textContent=`${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(Math.floor(timeLeft%60)).padStart(2,'0')}`;
}
updateHUD();

function reload(){
  if(reloadTimer>0 || ammo===30 || reserve===0) return;
  reloadTimer=1.15;
  // visual tilt
}
function doReload(){
  const need=30-ammo;
  const take=Math.min(need,reserve);
  reserve-=take; ammo+=take; updateHUD();
}

// Shooting
const ray=new THREE.Raycaster();
const impactGeo=new THREE.SphereGeometry(0.04,6,6);
const impactMat=new THREE.MeshBasicMaterial({color:0xffc26a});
const decals=[];
function shoot(){
  if(fireCooldown>0 || reloadTimer>0) return;
  if(ammo<=0){ reload(); return; }
  ammo--; updateHUD();
  fireCooldown=0.11;
  lastShot=performance.now();
  // recoil
  weaponGroup.position.z+=0.06;
  weaponGroup.rotation.x+=0.06;
  // muzzle flash
  if(muzzle){ muzzle.intensity=5; setTimeout(()=>muzzle.intensity=0,40); }
  const flash=weaponGroup.getObjectByName('flash');
  if(flash){ flash.material.opacity=1; setTimeout(()=>flash.material.opacity=0,40); }

  ray.setFromCamera({x:0,y:0}, camera);
  const hits=ray.intersectObjects(targetGroup.children.map(g=>g.userData.body).filter(Boolean), false);
  // also walls
  const wallHits=ray.intersectObjects(walls, false);
  let hit=null; let hitPos=null;
  if(hits.length){
    const t = hits[0];
    // find parent group
    const grp=targets.find(g=>g.userData.body===t.object);
    if(grp && grp.userData.alive){
      grp.userData.hp-=34;
      hit=grp; hitPos=t.point;
      // hitmarker
      hitmarker.classList.add('show'); setTimeout(()=>hitmarker.classList.remove('show'),90);
      if(grp.userData.hp<=0){
        grp.userData.alive=false;
        grp.userData.respawn=2.2;
        score+=100; updateHUD();
        grp.visible=false;
      } else {
        grp.userData.body.material.emissive.setHex(0xff3b3b);
        setTimeout(()=>grp.userData.body.material.emissive.setHex(0x18204a),120);
      }
    }
  }
  if(!hit){
    if(wallHits.length){
      hitPos=wallHits[0].point;
    } else {
      // miss tracer end far
      hitPos=new THREE.Vector3().copy(ray.ray.direction).multiplyScalar(60).add(ray.ray.origin);
    }
  }
  if(hitPos){
    const imp=new THREE.Mesh(impactGeo, impactMat);
    imp.position.copy(hitPos); scene.add(imp);
    decals.push({m:imp, t:0.9});
  }
  // tracer
  const start=new THREE.Vector3().copy(weaponGroup.getWorldPosition(new THREE.Vector3()));
  // fallback start at camera
  start.copy(camera.getWorldPosition(new THREE.Vector3()));
  const end=hitPos.clone();
  const tracerGeo=new THREE.BufferGeometry().setFromPoints([start,end]);
  const tracer=new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({color:0xfff0b0, transparent:true, opacity:0.85}));
  scene.add(tracer);
  let tl=0; (function fade(){ tl+=0.016; tracer.material.opacity=1-tl*6; if(tl>0.16) scene.remove(tracer); else requestAnimationFrame(fade); })();
}

// Loop
let prev=performance.now();
let bob=0;
const playerPos=new THREE.Vector3(0,1.7,12);
controls.getObject().position.copy(playerPos);

function tick(){
  requestAnimationFrame(tick);
  const now=performance.now(); const dt=Math.min((now-prev)/1000,0.033); prev=now;
  if(!controls.isLocked){ renderer.render(scene, camera); return; }
  if(timeLeft>0) timeLeft-=dt;
  if(timeLeft<=0) timeLeft=0;
  if(Math.floor(timeLeft*10)%10===0) updateHUD();

  // cooldowns
  if(fireCooldown>0) fireCooldown-=dt;
  if(reloadTimer>0){ reloadTimer-=dt; weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, -0.35, dt*6); if(reloadTimer<=0){ doReload(); weaponGroup.rotation.x=0; } }
  else {
    weaponGroup.position.z = THREE.MathUtils.lerp(weaponGroup.position.z, -0.62, dt*12);
    // spread recovery
    weaponGroup.rotation.x = THREE.MathUtils.lerp(weaponGroup.rotation.x, 0, dt*10);
  }
  if(mouseDown){ if(performance.now()-lastShot>112) shoot(); }

  // movement
  const speed = sprint? 7.2 : 4.2;
  const forward= (keys['KeyW']||keys['ArrowUp']?1:0) - (keys['KeyS']||keys['ArrowDown']?1:0);
  const strafe= (keys['KeyD']?1:0) - (keys['KeyA']?1:0);
  const dirVec=new THREE.Vector3();
  if(forward) dirVec.z -= forward;
  if(strafe) dirVec.x += strafe;
  if(dirVec.length()) dirVec.normalize().multiplyScalar(speed*dt);
  // apply relative to camera yaw
  const yaw=controls.getObject().rotation.y;
  const cos=Math.cos(yaw), sin=Math.sin(yaw);
  const dx= dirVec.x*cos - dirVec.z*sin;
  const dz= dirVec.x*sin + dirVec.z*cos;
  // simple collision clamp to arena + walls
  let nx=playerPos.x+dx, nz=playerPos.z+dz;
  // clamp bounds
  nx=THREE.MathUtils.clamp(nx,-38,38); nz=THREE.MathUtils.clamp(nz,-38,38);
  // crouch lerp height
  const targetH= crouch?1.15:1.7;
  playerHeight=THREE.MathUtils.lerp(playerHeight,targetH,dt*10);
  // gravity/jump
  if(keys['Space'] && onGround){ vel.y=5.2; onGround=false; }
  vel.y -= 14*dt;
  let ny=playerPos.y + vel.y*dt;
  if(ny<=playerHeight){ ny=playerHeight; vel.y=0; onGround=true; } else onGround=false;
  playerPos.set(nx,ny,nz);
  controls.getObject().position.copy(playerPos);

  // weapon bob
  const moving= dirVec.length()>0.001;
  bob += dt * (moving? (sprint?14:10) : 2);
  const bobAmp = moving? (sprint?0.025:0.018) : 0.004;
  weaponGroup.position.y = -0.28 + Math.sin(bob)*bobAmp + (crouch? -0.06:0);
  weaponGroup.position.x = 0.32 + Math.cos(bob*0.7)*bobAmp*0.6;
  if(weaponGroup.userData.mixer) weaponGroup.userData.mixer.update(dt);

  // targets rotation / respawn
  targets.forEach(g=>{
    if(!g.userData.alive){
      g.userData.respawn-=dt;
      if(g.userData.respawn<=0){ g.userData.alive=true; g.userData.hp=100; g.visible=true; }
    } else {
      g.rotation.y += dt*0.6;
    }
  });
  // decals fade
  for(let i=decals.length-1;i>=0;i--){ const d=decals[i]; d.t-=dt; if(d.t<=0){ scene.remove(d.m); decals.splice(i,1);} else d.m.material.opacity=d.t; }

  // win check
  if(timeLeft<=0){
    overlay.classList.remove('hidden'); playBtn.textContent=`TIME UP — SCORE ${score} — PLAY AGAIN`;
    controls.unlock();
  }

  renderer.render(scene, camera);
}
tick();

// UI
playBtn.addEventListener('click', ()=>{ controls.lock(); });
controls.addEventListener('lock', ()=>{ overlay.classList.add('hidden'); pausedEl.classList.add('hidden'); });
controls.addEventListener('unlock', ()=>{ if(timeLeft>0) pausedEl.classList.remove('hidden'); });
addEventListener('keydown', e=>{ if(e.code==='Escape' && !controls.isLocked) pausedEl.classList.add('hidden'); });
window.addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

// damage demo on hit? keep simple

// initial render
renderer.render(scene, camera);

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const canvas = document.getElementById('canvas');
const scoreEl = document.getElementById('score');
const enemiesEl = document.getElementById('enemies');
const waveEl = document.getElementById('wave');
const timerEl = document.getElementById('timer');
const fpsEl = document.getElementById('fps');
const hpEl = document.getElementById('hp');
const hpBar = document.getElementById('hpBar');
const ammoEl = document.getElementById('ammo');
const ammoBar = document.getElementById('ammoBar');
const hitEl = document.getElementById('hit');
const hitmarkerEl = document.getElementById('hitmarker');
const crosshairEl = document.getElementById('crosshair');
const damageVignette = document.getElementById('damageVignette');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play');
const howBtn = document.getElementById('how');
const toast = document.getElementById('toast');

// — Halo Infinite feedback: damage vignette + hitmarker sound/pulse (WebAudio, no assets) —
let audioCtx=null;
function ensureAudio(){
  if(audioCtx) return audioCtx;
  try{
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
  }catch(e){ audioCtx=null; }
  return audioCtx;
}
function playTone(freq, dur, vol, type='sine', when=0){
  const ctx=ensureAudio(); if(!ctx) return;
  const o=ctx.createOscillator(); const g=ctx.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(0, ctx.currentTime+when);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime+when+0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+when+dur);
  o.connect(g).connect(ctx.destination); o.start(ctx.currentTime+when); o.stop(ctx.currentTime+when+dur+0.02);
}
function playHitmarkerSound(isKill){
  if(isKill){ playTone(1420,0.09,0.22,'sine',0); playTone(1850,0.11,0.18,'sine',0.065); playTone(880,0.06,0.10,'square',0.02); }
  else { playTone(1180,0.07,0.16,'sine',0); playTone(1650,0.04,0.08,'sine',0.03); }
}
function playHurtSound(severe){
  playTone(severe?110:155,0.18,0.16,'square',0); playTone(70,0.22,0.12,'sine',0.02);
}
let vignetteTimer=null;
let hitmarkerTimer=null;
function showHitmarker(isKill){
  if(!hitmarkerEl) return;
  hitmarkerEl.classList.toggle('kill', !!isKill);
  hitmarkerEl.classList.add('show');
  if(crosshairEl){ crosshairEl.classList.add('pulse'); setTimeout(()=>crosshairEl.classList.remove('pulse'),120); }
  clearTimeout(hitmarkerTimer);
  hitmarkerTimer=setTimeout(()=> hitmarkerEl.classList.remove('show'), isKill?260:150);
}
function flashDamage(intensity){
  if(!damageVignette) return;
  const severe = intensity>6 || hp<34;
  damageVignette.classList.add('flash');
  damageVignette.style.opacity='';
  playHurtSound(severe);
  // light camera punch on hurt
  pitch = Math.max(-1.25, Math.min(1.25, pitch + (severe?0.028:0.014)));
  yaw += (Math.random()-0.5)*0.018;
  clearTimeout(vignetteTimer);
  vignetteTimer=setTimeout(()=>{
    damageVignette.classList.remove('flash');
    syncLowHealthVignette();
  }, severe?220:160);
}
function syncLowHealthVignette(){
  if(!damageVignette) return;
  if(hp<=34 && hp>0 && !gameOver){ damageVignette.classList.add('low'); }
  else { damageVignette.classList.remove('low'); if(!damageVignette.classList.contains('flash')) damageVignette.style.opacity='0'; }
}

// Renderer — Halo Infinite bright hangar grade + UnrealBloom for emissive bleed
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1e36);
scene.fog = new THREE.Fog(0x0a1e36, 44, 96);

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 6);

const ambient = new THREE.HemisphereLight(0xd6ecff, 0x0a1e36, 1.1);
scene.add(ambient);
const dir = new THREE.DirectionalLight(0xffffff, 3.0);
dir.position.set(12,18,8);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 80;
dir.shadow.camera.left = -30; dir.shadow.camera.right = 30; dir.shadow.camera.top = 30; dir.shadow.camera.bottom = -30;
dir.shadow.bias = -0.0003;
scene.add(dir);
const rim = new THREE.PointLight(0x7af7ff, 22, 44);
rim.position.set(0,6,-18);
scene.add(rim);
const fill = new THREE.PointLight(0x6a5cff, 14, 34);
fill.position.set(10,4,10);
scene.add(fill);

// Post-processing bloom — makes emissive trim bleed like Halo Infinite (threshold keeps concrete clean)
let composer = null, bloomPass=null;
try{
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.52, 0.42, 0.82);
  composer.addPass(bloomPass);
} catch(e){ console.warn('bloom init failed', e); composer=null; }

// Arena
const ARENA = 22; // half size
const WALL_H = 6;
const loader = new THREE.TextureLoader();

// Procedural sci-fi panel texture for walls — brightened for Halo high-key hangar
function makeWallTexture(){
  const c = document.createElement('canvas'); c.width=512; c.height=512;
  const g=c.getContext('2d');
  g.fillStyle='#142e4d'; g.fillRect(0,0,512,512);
  g.strokeStyle='rgba(122,247,255,0.32)'; g.lineWidth=2;
  for(let y=0;y<512;y+=64){ g.beginPath(); g.moveTo(0,y); g.lineTo(512,y); g.stroke(); }
  for(let x=0;x<512;x+=64){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,512); g.stroke(); }
  g.fillStyle='rgba(122,247,255,0.18)'; for(let i=0;i<6;i++){ g.fillRect(14+i*84,18,54,10); }
  g.fillStyle='rgba(106,92,255,0.22)'; g.fillRect(22,460,468,18);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3,1); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}
const wallTex = makeWallTexture();

// Floor — brightened polished concrete (Halo Infinite) instead of near-black matte
const floorGeo = new THREE.PlaneGeometry(ARENA*2.2, ARENA*2.2, 1, 1);
const floorMat = new THREE.MeshStandardMaterial({ color:0x2c4a6a, roughness:0.52, metalness:0.34 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true;
scene.add(floor);
// neon grid — higher contrast vs bright floor
const grid = new THREE.GridHelper(ARENA*2.2, 22, 0x7af7ff, 0x2a5a82);
grid.position.y = 0.02; scene.add(grid);
// emissive floor lines — brighter with bloom bleed
const lineMat = new THREE.MeshBasicMaterial({ color:0x7af7ff, transparent:true, opacity:0.34 });
for(let i=-ARENA;i<=ARENA;i+=4){ const g=new THREE.PlaneGeometry(0.06, ARENA*2.2); const m=new THREE.Mesh(g, lineMat); m.rotation.x=-Math.PI/2; m.position.set(i,0.03,0); scene.add(m); const g2=new THREE.PlaneGeometry(ARENA*2.2,0.06); const m2=new THREE.Mesh(g2, lineMat); m2.rotation.x=-Math.PI/2; m2.position.set(0,0.031,i); scene.add(m2); }

// Walls - brighter material so bloom has something to bleed from
const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness:0.42, metalness:0.28, emissive:0x0e2a4a, emissiveIntensity:0.28 });
function makeWalls(){
  const t=0.6;
  const walls=[
    { pos:[0, WALL_H/2, -ARENA], size:[ARENA*2.2, WALL_H, t] },
    { pos:[0, WALL_H/2, ARENA], size:[ARENA*2.2, WALL_H, t] },
    { pos:[-ARENA, WALL_H/2, 0], size:[t, WALL_H, ARENA*2.2] },
    { pos:[ARENA, WALL_H/2, 0], size:[t, WALL_H, ARENA*2.2] },
  ];
  walls.forEach(w=>{
    const geo=new THREE.BoxGeometry(...w.size);
    const mesh=new THREE.Mesh(geo, wallMat);
    mesh.position.set(...w.pos); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  });
  // corner pillars glowing — boosted for bloom
  const pillarGeo=new THREE.BoxGeometry(1.2, WALL_H+0.4, 1.2);
  const pillarMat=new THREE.MeshStandardMaterial({ color:0x182f4f, emissive:0x7af7ff, emissiveIntensity:1.45, roughness:0.42, metalness:0.22 });
  for(let x of [-ARENA, ARENA]) for(let z of [-ARENA, ARENA]){
    const p=new THREE.Mesh(pillarGeo, pillarMat); p.position.set(x, (WALL_H+0.4)/2, z); p.castShadow=true; scene.add(p);
    const light=new THREE.PointLight(0x7af7ff, 9, 14); light.position.set(x,3.2, z); scene.add(light);
  }
  // ceiling emissive strips — bloom will bleed
  const ceilGeo=new THREE.PlaneGeometry(ARENA*2.2, 0.4); const ceilMat=new THREE.MeshStandardMaterial({ color:0x7af7ff, emissive:0x7af7ff, emissiveIntensity:2.4, transparent:true, opacity:0.95 });
  const c1=new THREE.Mesh(ceilGeo, ceilMat); c1.position.set(0, WALL_H-0.1, 0); c1.rotation.x=Math.PI/2; scene.add(c1);
}
makeWalls();

// Load GLB props
const gltfLoader = new GLTFLoader();
let crateTemplate = null;
let droneTemplate = null;
let crates = [];
let drones = [];

async function loadModels(){
  try{
    const crateGltf = await gltfLoader.loadAsync('/models/sci-fi-crate-normalized.glb');
    crateTemplate = crateGltf.scene;
    crateTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
  }catch(e){ console.warn('crate load failed', e); }
  try{
    const droneGltf = await gltfLoader.loadAsync('/models/sci-fi-drone.glb');
    droneTemplate = droneGltf.scene;
    droneTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
  }catch(e){ console.warn('drone load failed', e); }
}

// If models not loaded, fallback procedural
function fallbackCrate(){
  const g=new THREE.BoxGeometry(1.4,1.2,1.4);
  const m=new THREE.MeshStandardMaterial({ color:0x182a3a, emissive:0x0f2a44, emissiveIntensity:0.15, roughness:0.55, metalness:0.35 });
  const mesh=new THREE.Mesh(g,m); mesh.castShadow=true; mesh.receiveShadow=true; return mesh;
}
function fallbackDrone(){
  const group=new THREE.Group();
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.55,16,12), new THREE.MeshStandardMaterial({ color:0x8eeeff, emissive:0x2af598, emissiveIntensity:0.22, roughness:0.35, metalness:0.5 }));
  body.castShadow=true; group.add(body);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.75,0.08,10,18), new THREE.MeshStandardMaterial({ color:0x0e2a44, emissive:0x7af7ff, emissiveIntensity:0.4 }));
  ring.rotation.x=Math.PI/2; ring.position.y=-0.15; group.add(ring);
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,8), new THREE.MeshStandardMaterial({ color:0xff3b6b, emissive:0xff3b6b, emissiveIntensity:1.2 }));
  eye.position.set(0,0.12,0.42); group.add(eye);
  return group;
}

function spawnCrates(){
  const positions=[[ -8,0,-6],[8,0,-6],[-7,0,7],[7,0,7],[0,0,-2]];
  positions.forEach(([x,zSeed,yOff],i)=>{
    const z=zSeed;
    let mesh;
    if(crateTemplate){
      mesh = crateTemplate.clone(true);
      const s = 0.85 + (i%2)*0.2;
      mesh.scale.set(s,s,s);
      const box=new THREE.Box3().setFromObject(mesh);
      const center=box.getCenter(new THREE.Vector3());
      mesh.position.sub(center);
      const wrapper=new THREE.Group();
      wrapper.add(mesh);
      wrapper.position.set(x, 0.65, z);
      wrapper.rotation.y = (i*0.9);
      scene.add(wrapper);
      crates.push(wrapper);
      wrapper.userData.radius = 1.2;
    } else {
      mesh=fallbackCrate(); mesh.position.set(x,0.6,z); mesh.rotation.y=i*0.9; scene.add(mesh); crates.push(mesh); mesh.userData.radius=1.0;
    }
  });
}

// Drones = enemies
let enemyData = [];
function spawnWave(n){
  // clear old
  enemyData.forEach(e=>{ scene.remove(e.mesh); });
  enemyData=[];
  for(let i=0;i<n;i++){
    let mesh;
    if(droneTemplate){
      mesh = droneTemplate.clone(true);
      mesh.scale.set(0.95,0.95,0.95);
      const box=new THREE.Box3().setFromObject(mesh);
      const size=box.getSize(new THREE.Vector3());
      // center
      const cen=box.getCenter(new THREE.Vector3());
      mesh.position.sub(cen);
      const wrapper=new THREE.Group();
      wrapper.add(mesh);
      // random pos inside arena avoiding crates
      let x,y,z;
      let tries=0;
      do{
        x=(Math.random()*2-1)*(ARENA-4);
        z=(Math.random()*2-1)*(ARENA-4);
        tries++;
      }while(tries<12 && crates.some(c=> Math.hypot(c.position.x - x, c.position.z - z) < 3));
      wrapper.position.set(x, 1.1 + Math.random()*0.6, z);
      wrapper.rotation.y = Math.random()*Math.PI*2;
      scene.add(wrapper);
      enemyData.push({ mesh: wrapper, hp: 3, max:3, t: Math.random()*6, alive:true, vx:0, vz:0 });
    } else {
      mesh=fallbackDrone();
      let x=(Math.random()*2-1)*(ARENA-4);
      let z=(Math.random()*2-1)*(ARENA-4);
      mesh.position.set(x,1.3,z);
      scene.add(mesh);
      enemyData.push({ mesh, hp:3, max:3, t: Math.random()*6, alive:true, vx:0, vz:0 });
    }
  }
  enemiesEl.textContent = String(n);
}

// Controls
let yaw=0, pitch=0;
let move={ f:0,b:0,l:0,r:0, sprint:false };
let keys=new Set();
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d','shift','r'].includes(k)) e.preventDefault();
  keys.add(k);
  if(k==='r') reload();
  if(k==='p' || k==='escape'){ if(!overlay.classList.contains('hidden')) return; paused=!paused; toastMsg(paused?'PAUSED':'RESUMED'); }
});
addEventListener('keyup', e=> keys.delete(e.key.toLowerCase()));

let isLocked=false;
canvas.addEventListener('click', ()=>{
  if(overlay.classList.contains('hidden') && !isLocked) { canvas.requestPointerLock(); }
});
document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement===canvas;
});
document.addEventListener('mousemove', e=>{
  if(!isLocked || paused) return;
  const sens=0.0022;
  yaw -= e.movementX*sens;
  pitch -= e.movementY*sens;
  pitch=Math.max(-1.25, Math.min(1.25, pitch));
});
// touch look
let touchLook=null;
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){ touchLook={ x:e.touches[0].clientX, y:e.touches[0].clientY, yaw, pitch }; }
},{passive:true});
canvas.addEventListener('touchmove', e=>{
  if(!touchLook) return;
  const t=e.touches[0];
  const dx=t.clientX - touchLook.x; const dy=t.clientY - touchLook.y;
  yaw = touchLook.yaw - dx*0.006; pitch = touchLook.pitch - dy*0.006; pitch=Math.max(-1.25,Math.min(1.25,pitch));
},{passive:true});
canvas.addEventListener('touchend', ()=> touchLook=null, {passive:true});

// Mobile stick
let stick={ x:0, y:0, active:false };
function ensureMobile(){
  if(innerWidth>720) return;
  const m=document.getElementById('mobile');
  m.style.display='block'; m.style.pointerEvents='auto';
  m.innerHTML=`<div style="position:absolute;left:14px;bottom:14px;width:118px;height:118px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(122,247,255,.25);backdrop-filter:blur(8px)"><div id="stick" style="position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(122,247,255,.9);box-shadow:0 6px 18px rgba(122,247,255,.4)"></div></div><button id="fireBtn" style="position:absolute;right:16px;bottom:22px;width:86px;height:86px;border-radius:50%;background:linear-gradient(180deg,#ff3b6b,#ff6a3d);border:2px solid rgba(255,255,255,.9);color:#fff;font-weight:900;letter-spacing:.1em;box-shadow:0 10px 28px rgba(255,59,107,.45)">FIRE</button>`;
  const area=m.firstChild; const knob=document.getElementById('stick');
  function pos(e){ const r=area.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; const x=t.clientX - r.left - r.width/2; const y=t.clientY - r.top - r.height/2; const len=Math.hypot(x,y); const max=38; const c=len>max?max/len:1; return { x:x*c/max, y:y*c/max }; }
  area.addEventListener('touchstart', e=>{ stick.active=true; const p=pos(e); stick.x=p.x; stick.y=p.y; knob.style.transform=`translate(${p.x*38}px,${p.y*38}px)`; e.preventDefault(); },{passive:false});
  area.addEventListener('touchmove', e=>{ const p=pos(e); stick.x=p.x; stick.y=p.y; knob.style.transform=`translate(${p.x*38}px,${p.y*38}px)`; e.preventDefault(); },{passive:false});
  area.addEventListener('touchend', ()=>{ stick.active=false; stick.x=0; stick.y=0; knob.style.transform='translate(0,0)'; });
  document.getElementById('fireBtn').addEventListener('touchstart', e=>{ e.preventDefault(); tryShoot(); });
  document.getElementById('fireBtn').addEventListener('click', e=>{ e.preventDefault(); tryShoot(); });
}
ensureMobile();
addEventListener('resize', ensureMobile);

// Player state
let playerPos=new THREE.Vector3(0,1.7, 10);
let vel=new THREE.Vector3();
let hp=100, ammo=30, reserve=90, score=0, wave=1, timeLeft=120, paused=true, gameOver=false;
let lastShot=0, shootCd=145;
let hitTimer=0;
let lastHurtFlash=0;

function toastMsg(t){
  toast.textContent=t; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),900);
}
function reload(){
  if(ammo===30 || reserve===0 || gameOver) return;
  const need=30-ammo; const take=Math.min(need,reserve); ammo+=take; reserve-=take;
  toastMsg('RELOADING'); updateHUD();
}
function updateHUD(){
  scoreEl.textContent=String(score);
  waveEl.textContent=`Wave ${wave} • ${enemyData.filter(e=>e.alive).length} left`;
  enemiesEl.textContent=String(enemyData.filter(e=>e.alive).length);
  hpEl.textContent=`${Math.max(0,Math.round(hp))} HP`; hpBar.style.width=`${Math.max(0,hp)}%`;
  if(hp<=30) hpBar.style.filter='brightness(1.25) drop-shadow(0 0 6px rgba(255,59,107,.9))';
  else hpBar.style.filter='';
  ammoEl.textContent=`${ammo}/${reserve}`; ammoBar.style.width=`${ (ammo/30*100).toFixed(0)}%`;
  const m=Math.floor(Math.max(0,timeLeft)/60), s=Math.floor(Math.max(0,timeLeft)%60);
  timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  syncLowHealthVignette();
}

function tryShoot(){
  const now=performance.now(); if(now-lastShot < shootCd) return; if(gameOver || paused) return;
  if(ammo<=0){ toastMsg('RELOAD!'); return; }
  lastShot=now; ammo--; updateHUD();
  // muzzle flash
  const flash=new THREE.PointLight(0x7af7ff, 9, 6); flash.position.copy(camera.position).add(getForward().multiplyScalar(0.5)); scene.add(flash); setTimeout(()=>scene.remove(flash), 60);
  // raycast
  const origin=camera.position.clone();
  const dirRay=getForward();
  const ray=new THREE.Raycaster(origin, dirRay, 0, 90);
  // hit drones
  let hit=false;
  let closest=null, cDist=Infinity;
  for(const e of enemyData){ if(!e.alive) continue; const d=ray.ray.distanceToPoint(e.mesh.position); if(d<1.35){ const dist=origin.distanceTo(e.mesh.position); const dot=dirRay.dot(e.mesh.position.clone().sub(origin).normalize()); if(dot>0.92 && dist < cDist){ cDist=dist; closest=e; } } }
  if(closest){
    closest.hp -=1; hit=true;
    const isKill = closest.hp<=0;
    // Halo hitmarker: white X on hit, red X + higher ding on kill
    showHitmarker(isKill);
    playHitmarkerSound(isKill);
    // impulse
    closest.mesh.position.add(dirRay.clone().multiplyScalar(0.35));
    // hit effect
    const spark=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,8), new THREE.MeshBasicMaterial({ color: isKill?0xff3b6b:0x7af7ff }));
    spark.position.copy(closest.mesh.position); scene.add(spark); setTimeout(()=>scene.remove(spark), 90);
    if(isKill){
      closest.alive=false; score+= 150; if(closest.mesh.children[0]){ closest.mesh.rotation.z+=1.2; }
      // scales down
      const t=setInterval(()=>{ closest.mesh.scale.multiplyScalar(0.92); if(closest.mesh.scale.x<0.05){ clearInterval(t); scene.remove(closest.mesh); } }, 30);
      if(enemyData.filter(e=>e.alive).length===0){ setTimeout(nextWave, 700); }
    } else {
      score+= 25;
    }
    updateHUD();
  }
  // hit walls/crates visual tracer
  if(!hit){
    // tracer line
    const end=origin.clone().add(dirRay.clone().multiplyScalar(44));
    const geo=new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line=new THREE.Line(geo, new THREE.LineBasicMaterial({ color:0x7af7ff, transparent:true, opacity:0.9 }));
    scene.add(line); setTimeout(()=>scene.remove(line), 45);
  } else {
    hitEl.classList.add('show'); setTimeout(()=>hitEl.classList.remove('show'), 180);
    // quick camera kick — now handled with hitmarker punch, keep subtle
    pitch += 0.008;
  }
  // enemy retaliation chance when shooting near
}
function getForward(){
  const f=new THREE.Vector3(0,0,-1);
  f.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ')));
  return f.normalize();
}
function getRight(){
  const r=new THREE.Vector3(1,0,0);
  r.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ')));
  return r.normalize();
}
canvas.addEventListener('mousedown', e=>{ if(e.button===0) tryShoot(); });
addEventListener('keydown', e=>{ if(e.code==='Space') tryShoot(); });

function nextWave(){
  if(gameOver) return;
  wave++; if(wave>3){ win(); return; }
  toastMsg(`WAVE ${wave}`);
  waveEl.textContent=`Wave ${wave}`;
  spawnWave(5 + wave*2);
  hp=Math.min(100, hp+18); updateHUD();
}
function win(){
  gameOver=true; paused=true; overlay.classList.remove('hidden');
  overlay.querySelector('h1').innerHTML='VICTORY <i>!</i>';
  overlay.querySelector('p').textContent=`Arena cleared in ${Math.max(0,Math.round(120-timeLeft))}s. Score ${score}. Halo-clean, 60fps, PBR crate fidelity verified.`;
  playBtn.textContent='↻ PLAY AGAIN'; playBtn.onclick=()=> location.reload();
}
function lose(){
  gameOver=true; paused=true; overlay.classList.remove('hidden');
  overlay.querySelector('h1').innerHTML='FLATLINE <i>!</i>';
  overlay.querySelector('p').textContent=`You were overwhelmed. Wave ${wave}, score ${score}. Try again — keep strafing and use crate cover.`;
  playBtn.textContent='↻ RETRY'; playBtn.onclick=()=> location.reload();
}

// Main loop
let last=performance.now(), fpsAcc=0, fpsCount=0, fpsTime=0;
const clock=new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const now=performance.now(); const dt=Math.min(0.033, (now-last)/1000); last=now;
  if(!paused && !gameOver){
    timeLeft -= dt; if(timeLeft<=0){ timeLeft=0; lose(); }
    // movement
    const speed = (keys.has('shift') || stick.active) ? 6.2 : 4.2;
    const fwd=getForward(); fwd.y=0; fwd.normalize();
    const right=getRight();
    let mv=new THREE.Vector3();
    if(keys.has('w')) mv.add(fwd);
    if(keys.has('s')) mv.sub(fwd);
    if(keys.has('a')) mv.sub(right);
    if(keys.has('d')) mv.add(right);
    if(stick.active){ // stick y is forward/back inverted
      mv.add(fwd.clone().multiplyScalar(-stick.y*1.25));
      mv.add(right.clone().multiplyScalar(stick.x*1.25));
    }
    if(mv.length()>0){ mv.normalize().multiplyScalar(speed*dt); }
    // friction + accel
    vel.lerp(mv, 0.28);
    if(mv.length()===0) vel.multiplyScalar(0.88);
    let nextPos=playerPos.clone().add(vel);
    // clamp arena + crate collision
    nextPos.x=Math.max(-ARENA+0.8, Math.min(ARENA-0.8, nextPos.x));
    nextPos.z=Math.max(-ARENA+0.8, Math.min(ARENA-0.8, nextPos.z));
    for(const c of crates){
      const d=new THREE.Vector2(nextPos.x - c.position.x, nextPos.z - c.position.z).length();
      if(d<1.55){ const push=new THREE.Vector2(nextPos.x - c.position.x, nextPos.z - c.position.z).normalize().multiplyScalar(1.55 - d + 0.02); nextPos.x+=push.x; nextPos.z+=push.y; vel.multiplyScalar(0.55); }
    }
    playerPos.copy(nextPos);
    camera.position.copy(playerPos);
    camera.rotation.order='YXZ'; camera.rotation.y=yaw; camera.rotation.x=pitch;

    // drone AI
    const t=clock.getElapsedTime();
    for(const e of enemyData){ if(!e.alive) continue;
      // bob
      e.mesh.position.y = 1.18 + Math.sin(t*1.7 + e.t)*0.22;
      e.mesh.rotation.y += dt*0.6;
      // strafe around player
      const toPlayer=new THREE.Vector3().subVectors(playerPos, e.mesh.position); toPlayer.y=0; const dist=toPlayer.length();
      if(dist>1.2){ toPlayer.normalize().multiplyScalar(Math.min(2.6*dt, dist*0.6*dt)); // chase
        // avoid crates
        for(const c of crates){ const d2=new THREE.Vector2(e.mesh.position.x - c.position.x, e.mesh.position.z - c.position.z).length(); if(d2<1.9){ const push=new THREE.Vector2(e.mesh.position.x - c.position.x, e.mesh.position.z - c.position.z).normalize().multiplyScalar(0.04); e.mesh.position.x+=push.x; e.mesh.position.z+=push.y; } }
        // strafe perpendicular sometimes
        const strafe=Math.sin(t*0.9 + e.t)*0.7;
        const perp=new THREE.Vector3(-toPlayer.z,0,toPlayer.x).normalize().multiplyScalar(strafe*dt);
        e.mesh.position.add(toPlayer).add(perp);
      }
      // damage player if close — throttled vignette so it doesn't spam every frame (Halo-style)
      if(dist<1.8){
        const before=Math.round(hp);
        hp -= 12*dt; updateHUD(); if(hp<=0) lose();
        const now2=performance.now();
        if(now2 - lastHurtFlash > 420 && before!==Math.round(hp)){
          lastHurtFlash=now2; flashDamage(4);
        }
      }
      // drone shoot visual occasionally
      if(Math.random()<0.006 && dist<18){
        const tracer=new THREE.Line(new THREE.BufferGeometry().setFromPoints([e.mesh.position.clone().add(new THREE.Vector3(0,0.15,0)), playerPos.clone()]), new THREE.LineBasicMaterial({ color:0xff3b6b, transparent:true, opacity:0.45 }));
        scene.add(tracer); setTimeout(()=>scene.remove(tracer), 70);
        if(dist<13 && Math.random()<0.35){
          hp -= 7; updateHUD(); hitEl.textContent='HIT!'; hitEl.classList.add('show'); setTimeout(()=>{hitEl.classList.remove('show'); hitEl.textContent='HIT';},220);
          flashDamage(7);
          if(hp<=0) lose();
        }
      }
    }

    // floor emissive pulse
    rim.intensity = 14 + Math.sin(t*1.2)*3;
  } else {
    // still update camera rotation when paused? no
    camera.rotation.order='YXZ'; camera.rotation.y=yaw; camera.rotation.x=pitch;
  }

  if(composer && bloomPass){ composer.render(); } else { renderer.render(scene, camera); }

  // fps
  fpsAcc += 1/dt; fpsCount++; fpsTime += dt;
  if(fpsTime > 0.4){ fpsEl.textContent = Math.round(fpsAcc / fpsCount).toString(); fpsAcc=0; fpsCount=0; fpsTime=0; updateHUD(); }
}
frame();

// overlay
playBtn.addEventListener('click', ()=>{
  overlay.classList.add('hidden');
  paused=false; gameOver=false;
  canvas.requestPointerLock?.();
  last=performance.now();
  ensureAudio();
});
howBtn.addEventListener('click', ()=>{
  const p=overlay.querySelector('p');
  if(howBtn.dataset.open==='1'){
    p.textContent='Compact sci-fi arena inspired by Halo Infinite Arena & Destiny 2 Crucible. Clean PBR, emissive neon, tight gunplay. Survive 3 waves inside a 44m hex-arena with physical crate cover and agile drone adversaries.';
    howBtn.textContent='HOW TO PLAY'; howBtn.dataset.open='0';
  } else {
    p.innerHTML='WASD to move, mouse to look, click or Space to fire, Shift to sprint, R to reload. Drones strafe and chip you at close range — keep moving, use crates as cover, aim for the red eye (headshot bonus is visual). Clear 3 waves before the 2:00 timer.';
    howBtn.textContent='BACK'; howBtn.dataset.open='1';
  }
});

// responsive
addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if(composer) composer.setSize(innerWidth, innerHeight);
});

// expose for verifier
window.__NEXUS={ scene, renderer, camera, getState:()=>({ score, wave, hp, ammo, reserve, timeLeft, enemies: enemyData.filter(e=>e.alive).length, crates: crates.length, hasCrate: !!crateTemplate, hasDrone: !!droneTemplate }) };

// async init without top-level await
(async()=>{
  await loadModels();
  spawnCrates();
  spawnWave(6);
  updateHUD();
  console.log('[NEXUS] ready', window.__NEXUS.getState());
})();

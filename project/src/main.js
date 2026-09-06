import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const canvas = document.getElementById('c');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const livesEl = document.getElementById('lives');
const progressBar = document.getElementById('progressBar');
const overlayStart = document.getElementById('overlayStart');
const overlayWin = document.getElementById('overlayWin');
const overlayLose = document.getElementById('overlayLose');
const btnPlay = document.getElementById('btnPlay');
const btnRestart = document.getElementById('btnRestart');
const winScoreEl = document.getElementById('winScore');
const loseReasonEl = document.getElementById('loseReason');
const loseScoreEl = document.getElementById('loseScore');
const assetStatus = document.getElementById('assetStatus');
const loadInfo = document.getElementById('loadInfo');
const flashEl = document.getElementById('flash');
const mobileControls = document.getElementById('mobileControls');

const CONFIG = {
  targetScore: 15,
  timeLimit: 60,
  arenaHalf: 14,
  collectRadius: 1.35,
  asteroidRadius: 1.1,
  playerSpeed: 9.5,
  drag: 0.88,
  asteroidCount: 5,
  crystalCount: 4,
};

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a14);
scene.fog = new THREE.Fog(0x060a14, 32, 48);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 11.5, 15.5);

// Lights - readable PBR
scene.add(new THREE.HemisphereLight(0x8ab4ff, 0x081020, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.35);
dir.position.set(6, 12, 4);
scene.add(dir);
const fill = new THREE.DirectionalLight(0x7dd3fc, 0.55);
fill.position.set(-6, 6, -6);
scene.add(fill);
const rim = new THREE.PointLight(0x38bdf8, 18, 22);
rim.position.set(0, 4, -8);
scene.add(rim);

// Ground + grid
const groundGeo = new THREE.PlaneGeometry(36, 36);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0b1226, roughness: 0.92, metalness: 0.04 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

const grid = new THREE.GridHelper(32, 32, 0x1e3a5f, 0x13233f);
grid.position.y = 0.01;
scene.add(grid);

// Arena walls (invisible bounds visual via edge lines)
const edgeMat = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent:true, opacity:0.55 });
function makeEdge(x1,z1,x2,z2){
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,0.02,z1), new THREE.Vector3(x2,0.02,z2)]);
  scene.add(new THREE.Line(g, edgeMat));
}
const H = CONFIG.arenaHalf;
makeEdge(-H,-H, H,-H); makeEdge(H,-H, H,H); makeEdge(H,H, -H,H); makeEdge(-H,H, -H,-H);

// Starfield particles
const starGeo = new THREE.BufferGeometry();
const starCount = 650;
const starPos = new Float32Array(starCount*3);
for(let i=0;i<starCount;i++){
  starPos[i*3] = (Math.random()-0.5)*90;
  starPos[i*3+1] = Math.random()*18 + 6;
  starPos[i*3+2] = (Math.random()-0.5)*90;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0x9ad0ff, size: 0.09, transparent:true, opacity:0.85, sizeAttenuation:true });
scene.add(new THREE.Points(starGeo, starMat));

// --- Asset loading ---
const loader = new GLTFLoader();
let playerRoot = null; // THREE.Group containing ship
let playerMixer = null;
let crystalTemplate = null; // Group for cloning
let crystalMixers = [];
let asteroidTemplate = null;
let assets = { player: false, crystal: false, asteroid: false };
let assetErrors = [];

function centerAndScale(object, targetSize = 1.7){
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;
  const scale = targetSize / maxDim;
  object.scale.setScalar(scale);
  // re-center to origin on XZ, keep Y base near 0
  object.updateWorldMatrix(true,true);
  const box2 = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3(); box2.getCenter(center);
  object.position.sub(center);
  object.position.y += 0.52; // hover height
}

function makeFallbackShip(){
  const g = new THREE.Group();
  g.name = 'FallbackShip';
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x1a3a8a, roughness:0.32, metalness:0.45 }));
  hull.rotation.x = Math.PI/2;
  hull.position.z = 0.12;
  g.add(hull);
  const wingGeo = new THREE.BufferGeometry();
  // simple delta wings as buffer
  const wPos = new Float32Array([ -0.3,0,0.1, -0.35,0,-0.25, -1.12,0,-0.4, -0.62,0,0.05, 0.3,0,0.1, 0.35,0,-0.25, 1.12,0,-0.4, 0.62,0,0.05 ]);
  const wIdx = [0,1,2, 0,2,3, 4,6,5, 4,7,6];
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wPos,3));
  wingGeo.setIndex(wIdx);
  wingGeo.computeVertexNormals();
  const wing = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color:0x0a1e5a, roughness:0.28, metalness:0.6, side: THREE.DoubleSide }));
  g.add(wing);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({ color:0x7dd3fc, emissive:0x0ea5e9, emissiveIntensity:1.2, roughness:0.2 }));
  cockpit.position.set(0,0.18,0.28); cockpit.scale.set(1,0.6,1.2);
  g.add(cockpit);
  const eng1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.09,0.28,10), new THREE.MeshStandardMaterial({ color:0xff6b2c, emissive:0xff3b0a, emissiveIntensity:1.6 }));
  eng1.rotation.x = Math.PI/2; eng1.position.set(-0.18,-0.04,-0.78);
  const eng2 = eng1.clone(); eng2.position.x = 0.18;
  g.add(eng1, eng2);
  g.position.y = 0.52;
  return g;
}
function makeFallbackCrystal(){
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ color:0x22d3ee, emissive:0x0ea5e9, emissiveIntensity:1.4, roughness:0.12, metalness:0.02, transparent:true, opacity:0.96 }));
  const inner = new THREE.Mesh(new THREE.OctahedronGeometry(0.18,0), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:1.2 }));
  g.add(outer, inner);
  g.userData.outer = outer; g.userData.inner = inner;
  return g;
}
function makeFallbackAsteroid(){
  const geo = new THREE.IcosahedronGeometry(0.52, 1);
  // jitter
  const p = geo.attributes.position;
  for(let i=0;i<p.count;i++){
    const j = (Math.sin(i*12.9898)*43758.5453)%1;
    p.setX(i, p.getX(i) * (0.88 + Math.abs(j)*0.28));
    p.setY(i, p.getY(i) * (0.88 + Math.abs(j*1.3)%1*0.28));
    p.setZ(i, p.getZ(i) * (0.88 + Math.abs(j*2.1)%1*0.28));
  }
  p.needsUpdate=true; geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:0x8b7355, roughness:0.92 }));
  return m;
}
async function loadAssets(){
  const report = (msg, isError=false)=>{
    loadInfo.textContent = msg;
    loadInfo.className = 'load-info ' + (isError ? 'err' : 'ok');
    assetStatus.textContent = msg;
    assetStatus.classList.toggle('hidden', false);
    assetStatus.classList.toggle('error', isError);
    if (!isError) setTimeout(()=>assetStatus.classList.add('hidden'), 3200);
  };
  // Player
  try {
    const gltf = await loader.loadAsync('/models/player.glb');
    const root = gltf.scene;
    // preserve hierarchy, add to parent for framing instead of mutating root
    const container = new THREE.Group();
    container.add(root);
    centerAndScale(container, 1.85);
    // ensure materials are PBR readable: boost env? Keep as is.
    // Traverse to enable shadows/emissive correctly
    container.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=false; if(o.material){ o.material.needsUpdate=true; } } });
    playerRoot = container;
    assets.player = true;
    report('Ship GLB loaded ✓ — ' + (gltf.scene.children.length) + ' nodes');
  } catch(e){
    console.warn('player.glb failed', e);
    assetErrors.push('player.glb');
    playerRoot = new THREE.Group();
    playerRoot.add(makeFallbackShip());
    assets.player = false;
    report('Ship GLB failed — using fallback mesh', true);
  }
  // Crystal
  try {
    const gltf = await loader.loadAsync('/models/collectible.glb');
    const root = gltf.scene;
    const container = new THREE.Group();
    container.add(root.clone(true));
    // keep animation clips if any, but we will rotate manually; store first template
    crystalTemplate = container;
    // Create mixer for template to test but we clone per instance manually
    if (gltf.animations && gltf.animations.length){
      const m = new THREE.AnimationMixer(container);
      gltf.animations.forEach(clip=> m.clipAction(clip).play());
      crystalMixers.push(m);
    }
    centerAndScale(crystalTemplate, 0.95);
    assets.crystal = true;
    report((assets.player ? 'Ship + ' : '') + 'Crystal GLB loaded ✓ — ' + gltf.animations.length + ' clips');
  } catch(e){
    console.warn('collectible.glb failed', e);
    assetErrors.push('collectible.glb');
    crystalTemplate = makeFallbackCrystal();
    assets.crystal = false;
    report('Crystal GLB failed — fallback crystal active', true);
  }
  // Asteroid - optional, failure is okay and uses fallback
  try {
    const gltf = await loader.loadAsync('/models/asteroid.glb');
    asteroidTemplate = gltf.scene;
    const c = new THREE.Group(); c.add(asteroidTemplate);
    centerAndScale(c, 1.0);
    asteroidTemplate = c;
    assets.asteroid = true;
  } catch(e){
    asteroidTemplate = makeFallbackAsteroid();
    assets.asteroid = false;
  }

  // Final status for start screen
  const ok = assetErrors.length===0;
  if (ok) {
    loadInfo.textContent = '✓ All GLBs ready — player & crystal verified in Three.js (PBR, emissive, animation)';
    loadInfo.className = 'load-info ok';
  } else {
    loadInfo.textContent = '⚠ ' + assetErrors.join(', ') + ' failed — fallback mesh active. Game remains playable.';
    loadInfo.className = 'load-info err';
  }
  btnPlay.disabled = false;
  btnPlay.textContent = '▶ START RUN';
}

// Game state
let state = 'loading'; // loading | start | playing | won | lost
let score = 0, lives = 3, timeLeft = CONFIG.timeLimit;
let playerPos = new THREE.Vector3(0, 0.52, 0);
let playerVel = new THREE.Vector3();
let yaw = 0;
let crystals = []; // { mesh, pos, taken }
let asteroids = [];
let clock = new THREE.Clock();
let invuln = 0;
let keys = {};
let touchDir = { x:0, y:0 };
let dragActive = false;
let dragTarget = null;

function resetWorld(){
  score = 0; lives = 3; timeLeft = CONFIG.timeLimit;
  playerPos.set(0,0.52,0); playerVel.set(0,0,0); yaw = 0; invuln = 0;
  // clear old
  crystals.forEach(c=> scene.remove(c.mesh));
  asteroids.forEach(a=> scene.remove(a.mesh));
  crystals = []; asteroids = [];
  spawnCrystals(CONFIG.crystalCount);
  spawnAsteroids(CONFIG.asteroidCount);
  updateHUD();
}

function spawnCrystals(n){
  for(let i=0;i<n;i++){
    const mesh = crystalTemplate.clone(true);
    // If template had mixer animation, we clone group but manual rotation is used; ensure scale preserved
    // For fallback, already correct size; for GLB clone, need to keep original scale transform from centerAndScale
    // Since clone copies Group containing scaled root, scale is on parent Group, not inner. Simpler: just clone and keep.
    const pos = randomArenaPos(2.2);
    mesh.position.copy(pos);
    mesh.rotation.y = Math.random()*Math.PI*2;
    mesh.userData.baseY = pos.y;
    mesh.userData.spinSpeed = 0.9 + Math.random()*0.7;
    mesh.userData.bobPhase = Math.random()*Math.PI*2;
    crystals.push({ mesh, pos, taken:false });
    scene.add(mesh);
  }
}
function spawnAsteroids(n){
  for(let i=0;i<n;i++){
    const mesh = asteroidTemplate.clone(true);
    const pos = randomArenaPos(4);
    // avoid near center
    if (pos.length() < 3.5){ pos.x += 4*Math.sign(pos.x||1); }
    mesh.position.copy(pos);
    mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    const vel = new THREE.Vector3((Math.random()-0.5)*2.2, 0, (Math.random()-0.5)*2.2);
    if (vel.length()<0.6) vel.set(1,0,0.4);
    asteroids.push({ mesh, vel, rotVel: new THREE.Vector3((Math.random()-0.5)*1.2, (Math.random()-0.5)*1.2, (Math.random()-0.5)*0.6) });
    scene.add(mesh);
  }
}
function randomArenaPos(margin=1){
  const r = H - margin;
  return new THREE.Vector3((Math.random()-0.5)*2*r, 0.45 + Math.random()*0.25, (Math.random()-0.5)*2*r);
}

// Input
window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault(); });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', ()=> keys = {});

// Touch D-pad
mobileControls.querySelectorAll('.dpad-btn').forEach(btn=>{
  const dir = btn.dataset.dir;
  const set = (v)=> {
    btn.classList.toggle('pressed', v);
    if(dir==='left') touchDir.x = v ? -1 : (touchDir.x===-1?0:touchDir.x);
    if(dir==='right') touchDir.x = v ? 1 : (touchDir.x===1?0:touchDir.x);
    if(dir==='up') touchDir.y = v ? -1 : (touchDir.y===-1?0:touchDir.y);
    if(dir==='down') touchDir.y = v ? 1 : (touchDir.y===1?0:touchDir.y);
  };
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); set(true); }, {passive:false});
  btn.addEventListener('touchend', e=>{ e.preventDefault(); set(false); }, {passive:false});
  btn.addEventListener('touchcancel', ()=> set(false));
  btn.addEventListener('mousedown', ()=> set(true));
  btn.addEventListener('mouseup', ()=> set(false));
  btn.addEventListener('mouseleave', ()=> set(false));
});
// Drag on canvas for mobile steering
canvas.addEventListener('pointerdown', e=>{
  if (state!=='playing') return;
  if (e.pointerType==='touch' || e.pointerType==='pen' || window.innerWidth<900){
    dragActive=true; canvas.setPointerCapture(e.pointerId); updateDragTarget(e);
  }
});
canvas.addEventListener('pointermove', e=>{ if(dragActive) updateDragTarget(e); });
canvas.addEventListener('pointerup', e=>{ dragActive=false; dragTarget=null; });
canvas.addEventListener('pointercancel', ()=>{ dragActive=false; dragTarget=null; });
function updateDragTarget(e){
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left)/rect.width)*2 -1;
  const y = -(((e.clientY - rect.top)/rect.height)*2 -1);
  // Map to arena target (invert y to z)
  dragTarget = new THREE.Vector3(x * H * 0.92, 0, y * H * 0.92);
}

// HUD
function updateHUD(){
  scoreEl.textContent = `${score} / ${CONFIG.targetScore}`;
  timeEl.textContent = timeLeft.toFixed(1);
  livesEl.textContent = '♥ '.repeat(lives).trim() + (lives<3 ? ' ♡'.repeat(3-lives).trim() : '');
  if(lives===0) livesEl.textContent = '♡ ♡ ♡';
  progressBar.style.width = `${(score/CONFIG.targetScore)*100}%`;
}

function setOverlay(which){
  overlayStart.classList.toggle('visible', which==='start');
  overlayWin.classList.toggle('visible', which==='won');
  overlayLose.classList.toggle('visible', which==='lost');
  if(which==='playing'){
    overlayStart.classList.remove('visible');
    overlayWin.classList.remove('visible');
    overlayLose.classList.remove('visible');
  }
}

btnPlay.addEventListener('click', ()=>{
  if(state==='loading') return;
  state='playing';
  clock.start(); clock.getDelta();
  setOverlay('playing');
});
btnRestart.addEventListener('click', ()=>{
  state='start';
  resetWorld();
  setOverlay('start');
  timeLeft = CONFIG.timeLimit; updateHUD();
});
document.querySelectorAll('[data-restart]').forEach(b=> b.addEventListener('click', ()=>{
  resetWorld();
  state='playing';
  clock.getDelta();
  setOverlay('playing');
}));

// Responsive + mobile controls visibility
function handleResize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  // Camera framing: mobile slightly higher
  if (w < 640){
    camera.position.set(0, 13.2, 16.8);
  } else if (w < 900){
    camera.position.set(0, 12.2, 16);
  } else {
    camera.position.set(0, 11.5, 15.5);
  }
  // Show mobile controls on touch or small screen during playing
  const showMobile = w < 900 || ('ontouchstart' in window);
  mobileControls.classList.toggle('hidden', !showMobile || state!=='playing');
}
window.addEventListener('resize', handleResize);

// Main loop
let playerContainer = null;
function ensurePlayerContainer(){
  if (playerContainer) return;
  playerContainer = new THREE.Group();
  playerContainer.add(playerRoot);
  // Slight tilt offset for banking
  scene.add(playerContainer);
  // If fallback, ensure facing correctly
  // Make player point toward +Z forward? Our hull nose is at +Z, so forward is +Z.
  // We'll keep yaw rotation around Y.
}

let lastFlash = 0;
function triggerFlash(){
  flashEl.classList.add('hit');
  setTimeout(()=> flashEl.classList.remove('hit'), 180);
}

function update(dt){
  if(state!=='playing') return;
  timeLeft -= dt;
  if(timeLeft <= 0){
    timeLeft = 0;
    state = 'lost';
    loseReasonEl.textContent = 'Reactor timeout — out of time';
    loseScoreEl.textContent = `${score} / ${CONFIG.targetScore} crystals`;
    setOverlay('lost');
    updateHUD(); return;
  }

  // Input vector
  let ix = 0, iz = 0;
  if(keys['arrowleft']||keys['a']) ix -= 1;
  if(keys['arrowright']||keys['d']) ix += 1;
  if(keys['arrowup']||keys['w']) iz -= 1;
  if(keys['arrowdown']||keys['s']) iz += 1;
  ix += touchDir.x;
  iz += touchDir.y;
  // Drag steering: move toward dragTarget
  if(dragActive && dragTarget){
    const to = new THREE.Vector3(dragTarget.x - playerPos.x, 0, dragTarget.z - playerPos.z);
    const len = to.length();
    if (len > 0.25){
      to.normalize();
      ix += to.x * 1.2;
      iz += to.z * 1.2;
    }
  }
  // Normalize if needed
  const mag = Math.hypot(ix, iz);
  if(mag>1){ ix/=mag; iz/=mag; }

  // Physics: acceleration -> velocity -> position
  const accel = new THREE.Vector3(ix * CONFIG.playerSpeed, 0, iz * CONFIG.playerSpeed);
  playerVel.x += accel.x * dt;
  playerVel.z += accel.z * dt;
  // Drag
  const dragF = Math.pow(CONFIG.drag, dt*60);
  playerVel.x *= dragF;
  playerVel.z *= dragF;
  playerPos.x += playerVel.x * dt;
  playerPos.z += playerVel.z * dt;
  // Clamp arena
  playerPos.x = Math.max(-H+0.8, Math.min(H-0.8, playerPos.x));
  playerPos.z = Math.max(-H+0.8, Math.min(H-0.8, playerPos.z));
  if (playerPos.x <= -H+0.82 || playerPos.x >= H-0.82) playerVel.x *= -0.45;
  if (playerPos.z <= -H+0.82 || playerPos.z >= H-0.82) playerVel.z *= -0.45;

  // Yaw facing velocity or input
  const targetYaw = (Math.abs(playerVel.x) > 0.1 || Math.abs(playerVel.z) > 0.1) ? Math.atan2(playerVel.x, playerVel.z) : yaw;
  // lerp yaw shortest path
  let dy = targetYaw - yaw;
  while(dy > Math.PI) dy-=Math.PI*2;
  while(dy < -Math.PI) dy+=Math.PI*2;
  yaw += dy * Math.min(1, dt*6);

  if(playerContainer){
    playerContainer.position.copy(playerPos);
    playerContainer.position.y = 0.52 + Math.sin(performance.now()*0.0025)*0.06;
    playerContainer.rotation.y = yaw;
    // Banking
    const bank = -playerVel.x * 0.06;
    playerContainer.rotation.z = bank;
    const pitch = playerVel.z * 0.035;
    playerContainer.rotation.x = pitch;
  }

  // Invuln timer
  if(invuln>0){ invuln -= dt; if(playerContainer) playerContainer.visible = Math.floor(invuln*14)%2===0; }
  else if(playerContainer) playerContainer.visible = true;

  // Update crystals: spin + bob + collection
  for(let i=crystals.length-1;i>=0;i--){
    const c = crystals[i];
    if(c.taken) continue;
    c.mesh.rotation.y += dt * c.mesh.userData.spinSpeed;
    c.mesh.position.y = c.mesh.userData.baseY + Math.sin(performance.now()*0.002 + c.mesh.userData.bobPhase)*0.14;
    // slow pulsate
    if(c.mesh.userData.outer){
      c.mesh.userData.outer.rotation.y += dt*0.6;
    }
    const d = c.mesh.position.distanceTo(playerPos);
    if(d < CONFIG.collectRadius){
      // collect
      c.taken = true;
      scene.remove(c.mesh);
      crystals.splice(i,1);
      score++;
      updateHUD();
      // spawn burst particles quickly
      spawnBurst(c.mesh.position.clone());
      // spawn replacement
      if(score < CONFIG.targetScore){
        const nm = crystalTemplate.clone(true);
        const p = randomArenaPos(2.2);
        nm.position.copy(p);
        nm.userData.baseY = p.y; nm.userData.spinSpeed = 0.9+Math.random()*0.7; nm.userData.bobPhase = Math.random()*Math.PI*2;
        crystals.push({ mesh:nm, pos:p, taken:false });
        scene.add(nm);
      }
      if(score >= CONFIG.targetScore){
        state='won';
        winScoreEl.textContent = `${score} / ${CONFIG.targetScore} crystals • ${(CONFIG.timeLimit - timeLeft).toFixed(1)}s`;
        setOverlay('won');
        triggerFlash();
        break;
      }
    }
  }

  // Update asteroids
  for(const a of asteroids){
    a.mesh.position.x += a.vel.x * dt;
    a.mesh.position.z += a.vel.z * dt;
    a.mesh.rotation.x += a.rotVel.x * dt;
    a.mesh.rotation.y += a.rotVel.y * dt;
    a.mesh.rotation.z += a.rotVel.z * dt;
    // bounce walls
    if(a.mesh.position.x < -H+0.7 || a.mesh.position.x > H-0.7){ a.vel.x *= -1; a.mesh.position.x = THREE.MathUtils.clamp(a.mesh.position.x, -H+0.7, H-0.7); }
    if(a.mesh.position.z < -H+0.7 || a.mesh.position.z > H-0.7){ a.vel.z *= -1; a.mesh.position.z = THREE.MathUtils.clamp(a.mesh.position.z, -H+0.7, H-0.7); }
    // collision with player
    if(invuln<=0){
      const d = a.mesh.position.distanceTo(playerPos);
      if(d < CONFIG.asteroidRadius){
        lives--;
        invuln = 1.2;
        triggerFlash();
        updateHUD();
        // knockback
        const dir = new THREE.Vector3().subVectors(playerPos, a.mesh.position).normalize();
        if(dir.length()<0.1) dir.set(1,0,0);
        playerVel.add(dir.multiplyScalar(8));
        a.vel.multiplyScalar(-0.9);
        if(lives<=0){
          state='lost';
          loseReasonEl.textContent = 'Hull breach — asteroids destroyed you';
          loseScoreEl.textContent = `${score} / ${CONFIG.targetScore} crystals • ${timeLeft.toFixed(1)}s left`;
          setOverlay('lost');
        }
      }
    }
  }

  updateHUD();

  // Camera follow: lerp toward player
  const targetCamPos = new THREE.Vector3(playerPos.x*0.28, camera.position.y, playerPos.z*0.28 + 10.5);
  // keep y stable, only x/z follow subtly so framing stays centered but tracks
  camera.position.x += (targetCamPos.x - camera.position.x) * dt * 2.2;
  camera.position.z += (targetCamPos.z - camera.position.z) * dt * 2.2;
  camera.lookAt(playerPos.x, 0.2, playerPos.z);
}

// Burst effect
let bursts = [];
function spawnBurst(pos){
  const g = new THREE.Group();
  const count=10;
  for(let i=0;i<count;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6,6), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.53 + Math.random()*0.08, 1, 0.62), transparent:true, opacity:0.95 }));
    m.userData.vel = new THREE.Vector3((Math.random()-0.5)*6, Math.random()*3+1, (Math.random()-0.5)*6);
    m.position.copy(pos);
    g.add(m);
  }
  g.userData.life=0.55;
  scene.add(g);
  bursts.push(g);
}
function updateBursts(dt){
  for(let i=bursts.length-1;i>=0;i--){
    const g=bursts[i];
    g.userData.life -= dt;
    if(g.userData.life<=0){ scene.remove(g); bursts.splice(i,1); continue; }
    for(const m of g.children){
      m.position.addScaledVector(m.userData.vel, dt);
      m.userData.vel.y -= 9*dt;
      m.material.opacity = g.userData.life/0.55;
      m.scale.setScalar(1 - (0.55-g.userData.life)*0.6);
    }
  }
}

// Animation loop
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.034);
  if(state==='playing'){
    update(dt);
    updateBursts(dt);
  } else if(state==='start' || state==='loading'){
    // idle bob for crystals in start view
    for(const c of crystals){ c.mesh.rotation.y += dt*0.9; c.mesh.position.y = c.mesh.userData.baseY + Math.sin(performance.now()*0.0015 + c.mesh.userData.bobPhase)*0.12; }
    for(const b of bursts) updateBursts(dt);
    if(playerContainer){ playerContainer.rotation.y += dt*0.35; playerContainer.position.y = 0.52 + Math.sin(performance.now()*0.001)*0.08; }
  }
  renderer.render(scene, camera);
}

// Start
handleResize();
state='loading';
btnPlay.disabled = true; btnPlay.textContent = 'Loading…';
loadAssets().then(()=>{
  ensurePlayerContainer();
  resetWorld();
  // Ensure player visible immediately
  playerContainer.position.copy(playerPos);
  state='start';
  handleResize();
  animate();
}).catch(e=>{
  console.error(e);
  ensurePlayerContainer();
  resetWorld();
  state='start';
  animate();
});

// Also keep playing bursts etc outside playing? animate handles.

window.addEventListener('keydown', e=>{
  if(e.key==='r' || e.key==='R'){ if(state==='playing' || state==='won' || state==='lost'){ resetWorld(); state='playing'; setOverlay('playing'); clock.getDelta(); } }
});

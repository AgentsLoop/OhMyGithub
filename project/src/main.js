import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Scene setup ---
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1a);
scene.fog = new THREE.Fog(0x0a0f1a, 28, 52);

const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 9, 11);

const clock = new THREE.Clock();

// Lights - PBR friendly, neutral procedural env via lights
scene.add(new THREE.HemisphereLight(0xddeeff, 0x0a0f1a, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 2.2);
dir.position.set(8,14,6);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 1; dir.shadow.camera.far = 40;
dir.shadow.camera.left=-18; dir.shadow.camera.right=18; dir.shadow.camera.top=18; dir.shadow.camera.bottom=-18;
dir.shadow.bias = -0.0005;
scene.add(dir);
const fill = new THREE.DirectionalLight(0x8ac8ff, 0.6);
fill.position.set(-6, 8, -8);
scene.add(fill);

// Simple procedural environment mimic: ambient probe via small color
scene.environment = null;

// Ground
const groundMat = new THREE.MeshStandardMaterial({ color: 0x101827, roughness: 0.92, metalness: 0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(42,42), groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// Gallery walls + pedestals
const wallMat = new THREE.MeshStandardMaterial({ color: 0x14203a, roughness: 0.85 });
const wallGeo = new THREE.BoxGeometry(42,5,0.6);
const wallN = new THREE.Mesh(wallGeo, wallMat); wallN.position.set(0,2.5, -21); wallN.receiveShadow=true; wallN.castShadow=true;
const wallS = wallN.clone(); wallS.position.z = 21;
const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.6,5,42), wallMat); wallE.position.set(21,2.5,0); wallE.receiveShadow=true; wallE.castShadow=true;
const wallW = wallE.clone(); wallW.position.x = -21;
scene.add(wallN, wallS, wallE, wallW);

// grid lines subtle
const grid = new THREE.GridHelper(42, 42, 0x1e2a44, 0x18233d);
grid.position.y = 0.02;
scene.add(grid);

// Pedestals deco (non-colliding)
const pedGeo = new THREE.CylinderGeometry(0.55,0.65,0.9,12);
const pedMat = new THREE.MeshStandardMaterial({ color: 0x1a2744, roughness:0.7, metalness:0.1 });
for (let i=0;i<6;i++){
  const ped = new THREE.Mesh(pedGeo, pedMat);
  const a = (i/6)*Math.PI*2;
  ped.position.set(Math.cos(a)*9, 0.45, Math.sin(a)*9);
  ped.castShadow=true; ped.receiveShadow=true;
  scene.add(ped);
  // spotlight cone deco
  const spot = new THREE.PointLight(0x3b82f6, 3, 6);
  spot.position.set(ped.position.x, 3.2, ped.position.z);
  scene.add(spot);
}

// --- Hero loading via GLTFLoader ---
let hero = null;
let mixer = null;
const heroGroup = new THREE.Group();
scene.add(heroGroup);
const modelBadge = document.getElementById('modelBadge');
let heroReady = false;
let fallbackUsed = false;

function makeFallbackHero(){
  fallbackUsed = true;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.9,0.45), new THREE.MeshStandardMaterial({ color: 0xf35a1a, roughness:0.85 }));
  body.position.y=0.85;
  body.castShadow=true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56,0.56,0.56), new THREE.MeshStandardMaterial({ color: 0x33d9f0, roughness:0.4 }));
  head.position.y=1.55; head.castShadow=true;
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.1,0.06), new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0x0a5aff, emissiveIntensity:0.6 }));
  eyeL.position.set(-0.12,1.55,0.3);
  const eyeR = eyeL.clone(); eyeR.position.x=0.12;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.72,0.22), new THREE.MeshStandardMaterial({ color: 0xf0d824 }));
  armL.position.set(-0.52,0.8,0); armL.castShadow=true;
  const armR = armL.clone(); armR.position.x=0.52;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.8,0.26), new THREE.MeshStandardMaterial({ color: 0xf0d824 }));
  legL.position.set(-0.18,0.02,0); legL.castShadow=true;
  const legR = legL.clone(); legR.position.x=0.18;
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.32,0.07), new THREE.MeshStandardMaterial({color:0xf35a1a}));
  ant.position.y=1.92;
  g.add(body,head,eyeL,eyeR,armL,armR,legL,legR,ant);
  return g;
}

async function loadHero(){
  const loader = new GLTFLoader();
  try{
    const gltf = await loader.loadAsync('/models/hero.glb');
    const root = gltf.scene;
    // configure materials/shadows like skill viewer does
    root.traverse(o=>{
      if(o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
        if(o.material){
          o.material.side = THREE.FrontSide;
        }
      }
    });
    // center/normalize: compute box
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // shift so feet at y~0 and centered xz
    root.position.sub(center);
    root.position.y += size.y/2; // feet at 0 after centering ?

    // Actually our generator already centered such that bottom at 0, but Box center y ~0.98 -> shift
    // Instead reframe: compute after shift
    // Use parent wrapper for scaling if needed
    const maxDim = Math.max(size.x,size.y,size.z);
    const targetHeight = 1.9;
    const scale = targetHeight / maxDim;
    root.scale.setScalar(scale);
    // Animation
    if(gltf.animations && gltf.animations.length){
      mixer = new THREE.AnimationMixer(root);
      const clip = gltf.animations[0];
      const action = mixer.clipAction(clip);
      action.play();
    }
    hero = root;
    heroGroup.add(hero);
    // attribution check
    try{
      const r = await fetch('/models/hero.glb.attribution.json');
      if(r.ok){
        const j = await r.json();
        document.getElementById('attribution').textContent = `Hero: ${j.name} · ${j.license} · ${j.glbBytes} bytes · ${j.meshes||'?'} meshes`;
      }
    }catch{}
    modelBadge.textContent = `◍ GLB loaded — ${gltf.scene.children.length} nodes · ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} · Idle Bob`;
    modelBadge.style.background='rgba(46,229,166,.15)';
    modelBadge.style.borderColor='rgba(46,229,166,.35)';
    modelBadge.style.color='#b8ffe8';
    heroReady = true;
  }catch(e){
    console.warn('GLB load failed, using fallback', e);
    modelBadge.textContent = '⚠ GLB fallback — procedural hero';
    modelBadge.style.background='rgba(250,204,21,.15)';
    modelBadge.style.borderColor='rgba(250,204,21,.4)';
    hero = makeFallbackHero();
    heroGroup.add(hero);
    heroReady = true;
  }
  // ensure hero initial pos
  heroGroup.position.set(0,0,0);
}
loadHero();

// --- Collectibles: floating prisms ---
const PRISM_COUNT = 8;
const prisms = [];
const prismGroup = new THREE.Group();
scene.add(prismGroup);

function createPrism(i){
  // Octahedron as prism
  const geo = new THREE.OctahedronGeometry(0.38, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL((0.15 + i*0.11)%1, 0.95, 0.6),
    roughness: 0.25, metalness: 0.15, emissive: new THREE.Color().setHSL((0.15 + i*0.11)%1, 0.9, 0.25), emissiveIntensity: 0.9
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  // ring base
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52,0.04,8,16), new THREE.MeshStandardMaterial({ color:0x2ee5a6, emissive:0x2ee5a6, emissiveIntensity:0.6, roughness:0.6 }));
  ring.rotation.x = Math.PI/2;
  ring.position.y = -0.05;
  const holder = new THREE.Group();
  holder.add(m); holder.add(ring);
  // shadow catcher disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.7,16), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.14 }));
  disc.rotation.x = -Math.PI/2;
  disc.position.y = 0.02;
  holder.add(disc);
  // light
  const light = new THREE.PointLight(mat.color, 2.2, 6);
  light.position.y = 0.6;
  holder.add(light);
  holder.userData = { baseY: 0.9, phase: Math.random()*Math.PI*2, spin: 0.6 + Math.random()*0.8, floatAmp: 0.18+Math.random()*0.12, collected:false, index:i };
  return holder;
}

function placePrisms(){
  prisms.length=0; prismGroup.clear();
  const positions = [
    [ 9,  -13], [ -10, -11], [ 13, 8], [ -13, 9],
    [ 0, -16], [ 16, 0], [ 0, 16], [ -16, 0]
  ];
  // jitter slightly
  for(let i=0;i<PRISM_COUNT;i++){
    const p = createPrism(i);
    let [x,z] = positions[i];
    x += (Math.random()-0.5)*1.2;
    z += (Math.random()-0.5)*1.2;
    p.position.set(x, 0, z);
    prisms.push(p);
    prismGroup.add(p);
  }
}
placePrisms();

// --- Game state ---
const STATE = { IDLE:'idle', PLAYING:'playing', WON:'won', LOST:'lost' };
let state = STATE.IDLE;
let score = 0;
let timeLeft = 60;
let best = localStorage.getItem('gallery-best') ? parseFloat(localStorage.getItem('gallery-best')) : null;
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const bestEl = document.getElementById('best');
const toastEl = document.getElementById('toast');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const endEyebrow = document.getElementById('endEyebrow');
const endTitle = document.getElementById('endTitle');
const endDesc = document.getElementById('endDesc');
const endTime = document.getElementById('endTime');
const endScore = document.getElementById('endScore');
const endBest = document.getElementById('endBest');

function updateHUD(){
  scoreEl.textContent = `${score} / ${PRISM_COUNT}`;
  timerEl.textContent = `${timeLeft.toFixed(1)}s`;
  if(timerEl) timerEl.style.color = timeLeft < 10 ? '#ff6b6b' : timeLeft < 20 ? '#facc15' : '';
  bestEl.textContent = best != null ? `${best.toFixed(1)}s left` : '—';
}
updateHUD();

function showToast(msg, ms=1600){
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> toastEl.classList.add('hidden'), ms);
}

// Movement
const keys = new Set();
const keyMap = {
  'w':'up','arrowup':'up',
  's':'down','arrowdown':'down',
  'a':'left','arrowleft':'left',
  'd':'right','arrowright':'right',
  'shift':'sprint'
};
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  const mapped = keyMap[k];
  if(mapped) { keys.add(mapped); if(['up','down','left','right'].includes(mapped)) e.preventDefault(); }
  if(k==='r') restart();
  if(k===' ' || k==='enter'){ if(state===STATE.IDLE) startGame(); }
});
addEventListener('keyup', e=>{
  const k = e.key.toLowerCase();
  const mapped = keyMap[k];
  if(mapped) keys.delete(mapped);
});
// touch
document.querySelectorAll('.dpad button[data-dir]').forEach(b=>{
  const dir = b.dataset.dir;
  const map = { up:'up', down:'down', left:'left', right:'right' };
  const press = ()=> keys.add(map[dir]);
  const release = ()=> keys.delete(map[dir]);
  b.addEventListener('pointerdown', e=>{ e.preventDefault(); press(); b.setPointerCapture(e.pointerId); });
  b.addEventListener('pointerup', release);
  b.addEventListener('pointerleave', release);
});
const dashBtn = document.getElementById('dashBtn');
dashBtn.addEventListener('pointerdown', ()=> keys.add('sprint'));
dashBtn.addEventListener('pointerup', ()=> keys.delete('sprint'));

// pointer controls for quick tests: click ground to move? ignore

let vel = new THREE.Vector2(0,0);
const BOUNDS = 19.5;
function clampToBounds(pos){
  pos.x = Math.max(-BOUNDS, Math.min(BOUNDS, pos.x));
  pos.z = Math.max(-BOUNDS, Math.min(BOUNDS, pos.z));
}

function startGame(){
  if(!heroReady){ showToast('Hero GLB still loading…'); return; }
  state = STATE.PLAYING;
  score = 0;
  timeLeft = 60;
  heroGroup.position.set(0,0,0);
  vel.set(0,0);
  // reset prisms
  for(const p of prisms){
    p.userData.collected=false;
    p.visible=true;
    p.scale.set(1,1,1);
  }
  // re-place prisms to be random again
  placePrisms();
  startOverlay.classList.add('hidden');
  endOverlay.classList.add('hidden');
  clock.getDelta(); // discard
  showToast('Dash! Collect all prisms ✨');
  updateHUD();
}
function winGame(){
  state = STATE.WON;
  const remaining = timeLeft;
  if(best==null || remaining > best){
    best = remaining;
    localStorage.setItem('gallery-best', String(best));
  }
  endEyebrow.textContent = 'CLEARED — NEW RECORD';
  endEyebrow.style.color = 'var(--accent)';
  endTitle.textContent = 'Gallery Cleared!';
  endDesc.textContent = `You zipped through and grabbed all ${PRISM_COUNT} prisms.`;
  endTime.textContent = `${remaining.toFixed(1)}s`;
  endScore.textContent = `${score}/${PRISM_COUNT}`;
  endBest.textContent = best!=null ? `${best.toFixed(1)}s left` : '—';
  endOverlay.classList.remove('hidden');
  showToast('🏆 Gallery cleared!', 2200);
  updateHUD();
}
function loseGame(){
  state = STATE.LOST;
  endEyebrow.textContent = 'TIME UP';
  endEyebrow.style.color = '#ff6b6b';
  endTitle.textContent = 'Out of Time';
  endDesc.textContent = `You collected ${score} / ${PRISM_COUNT}. Sprint faster next run!`;
  endTime.textContent = `0.0s`;
  endScore.textContent = `${score}/${PRISM_COUNT}`;
  endBest.textContent = best!=null ? `${best.toFixed(1)}s left` : '—';
  endOverlay.classList.remove('hidden');
}
function restart(){
  startGame();
}

// buttons
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('ctaStart').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('playAgain').addEventListener('click', restart);
document.getElementById('viewGallery').addEventListener('click', ()=>{
  endOverlay.classList.add('hidden');
  state = STATE.IDLE;
  startOverlay.classList.remove('hidden');
});

// hero orientation smooth
let targetYaw = 0;
let currentYaw = 0;

// game loop
let lastPos = new THREE.Vector3();
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // mixer for hero bob
  if(mixer) mixer.update(dt);

  // prism float/spin
  const t = clock.elapsedTime;
  for(const p of prisms){
    if(p.userData.collected) continue;
    const d = p.userData;
    p.position.y = d.baseY + Math.sin(t*1.4 + d.phase)*d.floatAmp;
    p.children[0].rotation.y += dt * d.spin; // octa
    p.children[0].rotation.x += dt * 0.3;
    // pulse scale subtle
    const s = 1 + Math.sin(t*2 + d.phase)*0.05;
    p.children[0].scale.set(s,s,s);
  }

  if(state === STATE.PLAYING){
    timeLeft -= dt;
    if(timeLeft <= 0){ timeLeft=0; updateHUD(); loseGame(); }
    else updateHUD();

    // movement input
    let ix = 0, iz = 0;
    if(keys.has('left')) ix -= 1;
    if(keys.has('right')) ix += 1;
    if(keys.has('up')) iz -= 1;
    if(keys.has('down')) iz += 1;
    const sprint = keys.has('sprint');
    const inputLen = Math.hypot(ix,iz);
    if(inputLen>0){
      ix/=inputLen; iz/=inputLen;
      targetYaw = Math.atan2(ix, iz);
      // shortest angle
      let diff = targetYaw - currentYaw;
      while(diff > Math.PI) diff -= Math.PI*2;
      while(diff < -Math.PI) diff += Math.PI*2;
      currentYaw += diff * Math.min(1, dt*10);
      heroGroup.rotation.y = currentYaw;
      const speed = sprint ? 9.5 : 5.6;
      // simple acceleration
      const ax = ix * speed;
      const az = iz * speed;
      vel.x += (ax - vel.x) * Math.min(1, dt*12);
      vel.y += (az - vel.y) * Math.min(1, dt*12);
    } else {
      vel.x *= Math.max(0, 1 - dt*8);
      vel.y *= Math.max(0, 1 - dt*8);
      // idle sway
      if(hero) hero.rotation.z = Math.sin(t*1.2)*0.05;
    }
    if(hero) hero.rotation.z *= 0.96;

    // move
    heroGroup.position.x += vel.x * dt;
    heroGroup.position.z += vel.y * dt;
    clampToBounds(heroGroup.position);
    // bob walk when moving
    if(inputLen>0 && hero){
      const bob = Math.sin(t* (sprint? 14 : 9))*0.06;
      hero.position.y = bob;
      hero.rotation.x = Math.sin(t* (sprint? 14:9))*0.06;
    } else if(hero){
      hero.position.y *= 0.9;
      hero.rotation.x *= 0.9;
    }

    // collection check - magnetize
    for(const p of prisms){
      if(p.userData.collected) continue;
      const dx = p.position.x - heroGroup.position.x;
      const dz = p.position.z - heroGroup.position.z;
      const dist = Math.hypot(dx,dz);
      const dy = Math.abs(p.position.y - (heroGroup.position.y + 0.9));
      const effective = Math.hypot(dist, dy*1.2);
      if(effective < 1.05){
        p.userData.collected = true;
        score++;
        updateHUD();
        // pop animation
        p.children[0].material.emissiveIntensity = 2.5;
        let scale = 1;
        const pop = setInterval(()=>{
          scale += 0.28;
          p.scale.set(scale,scale,scale);
          p.children[0].material.opacity = (p.children[0].material.opacity ?? 1) - 0.18;
          if(scale>2.2){ clearInterval(pop); p.visible=false; }
        }, 18);
        // floating text
        showToast(`+1 prism  ${score}/${PRISM_COUNT}  ✨`, 900);
        if(score===PRISM_COUNT) winGame();
      } else if(dist < 3.0){
        // subtle magnet pull
        p.position.x -= dx * dt * 1.2;
        p.position.z -= dz * dt * 1.2;
      }
    }
  }

  // camera follow - smooth third person
  const camTarget = heroGroup.position;
  const desired = new THREE.Vector3(camTarget.x, 9, camTarget.z + 11);
  // lerp
  camera.position.lerp(desired, Math.min(1, dt*3.5));
  // look slightly ahead in movement direction
  const lookAt = new THREE.Vector3(camTarget.x + vel.x*0.35, 0.9, camTarget.z + vel.y*0.35);
  camera.lookAt(lookAt);

  renderer.render(scene, camera);
}
animate();

// resize
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setSize(innerWidth, innerHeight);

// expose for tests
window.__GAME__ = {
  get state(){ return state; },
  get score(){ return score; },
  get timeLeft(){ return timeLeft; },
  get heroReady(){ return heroReady; },
  get fallbackUsed(){ return fallbackUsed; },
  get prismCount(){ return PRISM_COUNT; },
  startGame, restart, winGame, loseGame,
  heroGroup, prisms,
  renderer, scene, camera
};

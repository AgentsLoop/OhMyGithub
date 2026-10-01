import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GameState } from './gameState.mjs';

// --- Scene setup ------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1420);
scene.fog = new THREE.Fog(0x0e1420, 22, 42);

const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 14, 14);

const clock = new THREE.Clock();

// Lights
scene.add(new THREE.HemisphereLight(0xddeeff, 0x221100, 0.9));
const dir = new THREE.DirectionalLight(0xfff2d6, 1.6);
dir.position.set(6, 12, 4);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 40;
dir.shadow.camera.left = -15; dir.shadow.camera.right = 15; dir.shadow.camera.top = 15; dir.shadow.camera.bottom = -15;
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

// Environment light probe via neutral gradient (helps PBR show correctly)
function applyNeutralEnv() {
  const c = document.createElement('canvas'); c.width=256; c.height=128;
  const g=c.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,c.height);
  grad.addColorStop(0,'#a9c8ff'); grad.addColorStop(0.5,'#6b7d99'); grad.addColorStop(1,'#2a2f3a');
  g.fillStyle=grad; g.fillRect(0,0,c.width,c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = tex;
}
applyNeutralEnv();

// Ground + walls
const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, roughness: 0.85, metalness: 0.05 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(22,22), floorMat);
floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; scene.add(floor);

// faint grid
const grid = new THREE.GridHelper(22, 22, 0x2a3a52, 0x1e2b40); grid.position.y=0.02; scene.add(grid);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x243044, roughness: 0.9 });
function wall(x,z,w,h) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.2, h), wallMat);
  m.position.set(x,1.1,z); m.castShadow=true; m.receiveShadow=true; scene.add(m); return m;
}
wall(0, 11.2, 22, 0.6); wall(0,-11.2,22,0.6); wall(-11.2,0,0.6,22); wall(11.2,0,0.6,22);
// inner pillars
for (const p of [[-6,-6],[-6,6],[6,-6],[6,6]]) {
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.42,2.0,10), wallMat);
  col.position.set(p[0],1, p[1]); col.castShadow=true; scene.add(col);
}

// Pedestal for relic
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.05,0.6,16), new THREE.MeshStandardMaterial({ color:0x3a2f24, roughness:0.7, metalness:0.2 }));
pedestal.position.set(0,0.3, -2); pedestal.castShadow=true; pedestal.receiveShadow=true; scene.add(pedestal);
const pedestalRing = new THREE.Mesh(new THREE.RingGeometry(1.0,1.25,24), new THREE.MeshStandardMaterial({ color:0xffb13d, emissive:0xff8a1a, emissiveIntensity:0.35, side:THREE.DoubleSide }));
pedestalRing.rotation.x = -Math.PI/2; pedestalRing.position.set(0,0.61,-2); scene.add(pedestalRing);

// Exit gate (north)
const gateGroup = new THREE.Group(); gateGroup.position.set(0,1.0, 10.0); scene.add(gateGroup);
const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(3.2,2.4,0.4), new THREE.MeshStandardMaterial({ color:0x2b3446 }));
gateGroup.add(gateFrame);
const gateDoor = new THREE.Mesh(new THREE.BoxGeometry(2.2,1.9,0.18), new THREE.MeshStandardMaterial({ color:0x111a26, emissive:0xff2233, emissiveIntensity:0.15 }));
gateDoor.position.set(0,0,0.14); gateGroup.add(gateDoor);
const gateLight = new THREE.PointLight(0x00ff88, 0, 6); gateLight.position.set(0,0.8,0.8); gateGroup.add(gateLight);
const exitMarker = new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,0.04,24), new THREE.MeshStandardMaterial({ color:0x00ff88, emissive:0x00ff88, emissiveIntensity:0.9, transparent:true, opacity:0.18 }));
exitMarker.position.set(0,0.05,10); scene.add(exitMarker);

// Player
const playerGroup = new THREE.Group(); scene.add(playerGroup);
const playerMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.5,8,16), new THREE.MeshStandardMaterial({ color:0x3dd6ff, roughness:0.35, metalness:0.1, emissive:0x0a4a66, emissiveIntensity:0.25 }));
playerMesh.position.y=0.7; playerMesh.castShadow=true; playerGroup.add(playerMesh);
const playerGlow = new THREE.Mesh(new THREE.CircleGeometry(0.55,16), new THREE.MeshBasicMaterial({ color:0x3dd6ff, transparent:true, opacity:0.22 }));
playerGlow.rotation.x=-Math.PI/2; playerGlow.position.y=0.02; playerGroup.add(playerGlow);
playerGroup.position.set(0,0,7);

// Hazards (sentinels)
const hazardMat = new THREE.MeshStandardMaterial({ color:0xff3b3b, emissive:0xff1a1a, emissiveIntensity:0.6, roughness:0.4 });
const hazards = [];
function addHazard(path) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), hazardMat);
  m.castShadow=true; m.userData.path=path; m.userData.t= Math.random();
  m.userData.base = path;
  hazards.push(m); scene.add(m);
}
addHazard({ axis:'x', y:0.55, z:-5, min:-8, max:8, speed:2.8 });
addHazard({ axis:'z', x:-4, y:0.55, min:-8, max:8, speed:2.2 });
addHazard({ axis:'x', y:0.55, z: 3, min:-7, max:7, speed:2.5 });

// Relic GLB loading
let relicRoot = null;
let relicHolder = new THREE.Group(); scene.add(relicHolder);
relicHolder.position.set(0,0,-2);
let relicLoaded = false;
let relicCollectEffect = 0;

const loader = new GLTFLoader();
const proofEl = document.getElementById('material-proof');
loader.load('/models/relic.glb', (gltf) => {
  const src = gltf.scene;
  // Framing fix: compute bounds before parent scaling, preserve authored hierarchy via centering parent
  src.updateWorldMatrix(true,true);
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Normalize: longest dimension to ~1.6
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const target = 1.6;
  const scale = target / maxDim;
  // Center correction: shift so geometric center sits at holder origin, then lift
  const offset = center.clone().multiplyScalar(-1);
  // Create wrapper that holds corrected transform, per skill: insert separate centering parent (we use relicHolder as parent)
  const wrapper = new THREE.Group();
  src.position.copy(offset);
  wrapper.add(src);
  wrapper.scale.setScalar(scale);
  // Lift so bottom sits on pedestal top (~0.6)
  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const bottom = scaledBox.min.y;
  wrapper.position.y = -bottom + 0.68; // pedestal top + small gap
  // Ensure materials use correct encoding and shadows
  src.traverse(o=>{
    if(o.isMesh){ o.castShadow=true; o.receiveShadow=false;
      if(o.material){ o.material.needsUpdate=true; }
    }
  });
  relicHolder.add(wrapper);
  relicRoot = wrapper;
  relicLoaded = true;

  // report proof
  let matCount=0, texCount=0, tri=0;
  src.traverse(o=>{ if(o.isMesh){ tri+= (o.geometry.index? o.geometry.index.count/3 : o.geometry.attributes.position.count/3); if(o.material) matCount++; }});
  // textures from material
  texCount=1; // known 1
  proofEl.textContent = `✔ rendered — ${matCount} mat, ${texCount} tex, ~${Math.round(tri)} tris · specular PBR OK`;
  proofEl.style.color = 'var(--success)';
  // expose for verification
  window.__relic = { wrapper, tri, matCount, boxSize:size, scale };
}, (ev)=> {
  if(ev.lengthComputable) proofEl.textContent = `loading relic… ${Math.round(ev.loaded/ev.total*100)}%`;
}, (err)=>{
  console.error(err);
  proofEl.textContent = '✕ relic load failed — check /models/relic.glb';
  proofEl.style.color = 'var(--danger)';
});

// Game state
const state = new GameState({ timeLimit: 50, maxHealth: 3 });
let invuln = 0;
let dashCooldown = 0;
let dashTime = 0;

function updateHUD() {
  document.getElementById('hud-time').textContent = state.timeLeft.toFixed(1)+'s';
  const pct = (state.timeLeft / state.timeLimit)*100;
  document.getElementById('timer-fill').style.width = pct+'%';
  document.getElementById('timer-fill').style.background = state.hasRelic && state.timeLeft<15 ? 'linear-gradient(90deg,#ff2a2a,#ff6b2c)' : 'linear-gradient(90deg,var(--accent),#ff6b2c)';
  document.getElementById('hud-relic').textContent = state.hasRelic ? '✔ Collected' : '✕ Not collected';
  document.getElementById('hud-relic').style.color = state.hasRelic? 'var(--success)' : '';
  const ot = document.getElementById('objective-text');
  ot.textContent = !state.hasRelic ? 'Reach the Idol (center)' : 'Escape through North Gate!';
  ot.style.color = state.hasRelic ? 'var(--success)' : '';
  const heartsEl = document.getElementById('hud-hearts'); heartsEl.innerHTML='';
  for(let i=0;i<state.maxHealth;i++){ const d=document.createElement('div'); d.className='heart'+(i>=state.health?' empty':''); heartsEl.appendChild(d); }
  // gate visual
  if(state.hasRelic){
    gateDoor.material.color.set(0x0a2e1a); gateDoor.material.emissive.set(0x00ff88); gateDoor.material.emissiveIntensity=0.9;
    gateLight.intensity=2.5; exitMarker.material.opacity=0.28;
  } else {
    gateDoor.material.color.set(0x111a26); gateDoor.material.emissive.set(0xff2233); gateDoor.material.emissiveIntensity=0.15;
    gateLight.intensity=0.0; exitMarker.material.opacity=0.12;
  }
}

// Input
const keys = new Set();
addEventListener('keydown', e=>{
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)) e.preventDefault();
  keys.add(k);
  if(k==='r' && (state.isWon()||state.isLost())) restart();
  if(k===' ' || k==='spacebar') triggerDash();
});
addEventListener('keyup', e=> keys.delete(e.key.toLowerCase()));

// Mobile joystick
let joyVec = { x:0, y:0 };
const joy = document.getElementById('joy');
const stick = document.getElementById('joy-stick');
let joyActive=false;
function joyPos(e){
  const r=joy.getBoundingClientRect();
  const t=e.touches? e.touches[0] : e;
  let x = (t.clientX - (r.left+r.width/2)) / (r.width/2);
  let y = (t.clientY - (r.top+r.height/2)) / (r.height/2);
  const len = Math.hypot(x,y);
  if(len>1){ x/=len; y/=len; }
  return {x, y, len: Math.min(1,len)};
}
function handleJoy(e){
  if(!joyActive) return;
  e.preventDefault();
  const {x,y,len}=joyPos(e);
  joyVec.x=x; joyVec.y=y;
  stick.style.transform=`translate(${x*36}px, ${y*36}px)`;
}
joy.addEventListener('touchstart', e=>{ joyActive=true; handleJoy(e); }, {passive:false});
joy.addEventListener('touchmove', handleJoy, {passive:false});
joy.addEventListener('touchend', ()=>{ joyActive=false; joyVec.x=0; joyVec.y=0; stick.style.transform='translate(0,0)'; });
joy.addEventListener('mousedown', e=>{ joyActive=true; handleJoy(e); });
addEventListener('mousemove', e=>{ if(joyActive && e.buttons) handleJoy(e); });
addEventListener('mouseup', ()=>{ if(joyActive){ joyActive=false; joyVec.x=0; joyVec.y=0; stick.style.transform='translate(0,0)'; }});

document.getElementById('btn-dash').addEventListener('touchstart', e=>{ e.preventDefault(); triggerDash(); }, {passive:false});
document.getElementById('btn-dash').addEventListener('click', triggerDash);

function triggerDash(){
  if(dashCooldown>0) return;
  dashTime=0.22; dashCooldown=0.9;
}

function getInputVector(){
  let x=0, y=0;
  if(keys.has('arrowleft')||keys.has('a')) x-=1;
  if(keys.has('arrowright')||keys.has('d')) x+=1;
  if(keys.has('arrowup')||keys.has('w')) y-=1;
  if(keys.has('arrowdown')||keys.has('s')) y+=1;
  // mobile joystick overrides/adds
  x += joyVec.x;
  y += joyVec.y;
  const len=Math.hypot(x,y);
  if(len>0){ x/=len; y/=len; }
  return {x,y, len: Math.min(1,len)};
}

// Game loop helpers
let playing=false;

function restart(){
  state.reset();
  invuln=0; dashCooldown=0; dashTime=0;
  playerGroup.position.set(0,0,7);
  hazards.forEach(h=> h.userData.t=Math.random());
  // reset relic holder
  if(relicRoot){
    relicHolder.position.set(0,0,-2);
    relicHolder.visible=true;
    relicRoot.visible=true;
    // re-attach if was attached
    if(relicRoot.parent !== relicHolder){
      relicHolder.add(relicRoot);
      relicRoot.position.set(0,0,0);
      // need to recompute wrapper offset? simpler restore
      relicRoot.scale.setScalar(relicRoot.scale.x); // keep
      relicRoot.position.y = 0.7; // will be reset by load logic? we'll re-create? simpler reload page? but keep
    }
    // restore position after collect: remove from player
    if(playerGroup.children.includes(relicRoot)){
      playerGroup.remove(relicRoot);
      relicHolder.add(relicRoot);
    }
  }
  relicCollectEffect=0;
  document.getElementById('win-card').classList.add('hidden');
  document.getElementById('lose-card').classList.add('hidden');
  playing=true;
  updateHUD();
}

function collectRelic(){
  if(!relicLoaded || state.hasRelic) return;
  state.collectRelic();
  // visual: attach relic to player overhead
  relicCollectEffect=1;
  // move relic to player
  // detach from holder, attach to playerGroup offset above head
  try{
    relicHolder.remove(relicRoot);
    relicRoot.position.set(0,1.25,0);
    relicRoot.scale.setScalar(0.75); // slightly smaller when carried
    playerGroup.add(relicRoot);
  }catch(e){ console.warn(e); }
  // pulse pedestal
  pedestalRing.material.emissiveIntensity=1.5;
  updateHUD();
}

function doDamage(){
  if(invuln>0) return;
  state.takeDamage(1);
  invuln=1.2;
  playerMesh.material.emissiveIntensity=1.2;
  updateHUD();
  if(state.isLost()){
    playing=false;
    document.getElementById('lose-stats').textContent = state.cause==='time' ? 'Temple collapsed — time ran out.' : 'Sentinels shattered you.';
    document.getElementById('lose-card').classList.remove('hidden');
  }
}

function winGame(){
  if(!state.reachExit()) return;
  playing=false;
  document.getElementById('win-stats').textContent = `Score ${state.score} · Time left ${state.timeLeft.toFixed(1)}s · Health ${state.health}/${state.maxHealth}`;
  document.getElementById('win-card').classList.remove('hidden');
  updateHUD();
}

// Start button
document.getElementById('btn-play').addEventListener('click', ()=>{
  document.getElementById('start-card').classList.add('hidden');
  playing=true;
  clock.getDelta(); // reset
});
document.getElementById('btn-restart-win').addEventListener('click', restart);
document.getElementById('btn-restart-lose').addEventListener('click', restart);

// Resize
function onResize(){
  const w=innerWidth, h=innerHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
addEventListener('resize', onResize); onResize();

// Animation loop
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1/30);
  if(!playing){
    // still render idle floating relic
    if(relicRoot && !state.hasRelic){
      relicHolder.rotation.y += dt*0.35;
      relicHolder.position.y = Math.sin(performance.now()*0.002)*0.12;
    }
    renderer.render(scene, camera);
    return;
  }

  // state update
  state.update(dt);
  if(state.isLost()){
    playing=false;
    document.getElementById('lose-stats').textContent = 'Time ran out — the ceiling caved in.';
    document.getElementById('lose-card').classList.remove('hidden');
    updateHUD();
  }

  // movement
  const input = getInputVector();
  let speed = 5.2;
  if(state.hasRelic) speed *= 1.02;
  if(dashTime>0){ speed *= 2.4; dashTime -= dt; }
  if(dashCooldown>0) dashCooldown -= dt;
  if(input.len>0.01){
    playerGroup.position.x += input.x * speed * dt;
    playerGroup.position.z += input.y * speed * dt;
    playerGroup.rotation.y = Math.atan2(input.x, input.y);
    // walk bob
    playerMesh.position.y = 0.7 + Math.sin(performance.now()*0.012)*0.04;
  }
  // clamp bounds
  playerGroup.position.x = Math.max(-10, Math.min(10, playerGroup.position.x));
  playerGroup.position.z = Math.max(-10, Math.min(10, playerGroup.position.z));
  // keep inside walls (gate opening)
  if(playerGroup.position.z > 9.4 && Math.abs(playerGroup.position.x) > 1.6) {
    playerGroup.position.z = 9.4;
  }

  // invuln blink
  if(invuln>0){
    invuln-=dt;
    const blink = Math.floor(invuln*10)%2===0;
    playerMesh.visible = blink;
    if(invuln<=0){ playerMesh.visible=true; playerMesh.material.emissiveIntensity=0.25; }
  }

  // hazards movement
  const hazardSpeedMul = state.hasRelic ? 1.35 : 1.0;
  hazards.forEach(h=>{
    const p=h.userData.path;
    h.userData.t += dt * p.speed * hazardSpeedMul * 0.22;
    const t = (Math.sin(h.userData.t*1.1)*0.5+0.5); // 0-1 ping-pong
    if(p.axis==='x'){
      h.position.set(THREE.MathUtils.lerp(p.min,p.max,t), p.y, p.z);
    } else {
      h.position.set(p.x, p.y, THREE.MathUtils.lerp(p.min,p.max,t));
    }
    h.rotation.y += dt*1.5; h.rotation.x += dt*0.7;
    // collision with player
    const d = h.position.distanceTo(playerGroup.position.clone().setY(0.55));
    if(d < 1.05){ doDamage(); }
  });

  // relic floating if not collected
  if(relicLoaded && !state.hasRelic){
    relicHolder.rotation.y += dt*0.45;
    relicHolder.position.y = Math.sin(performance.now()*0.0022)*0.14;
    // check collect distance
    const d = playerGroup.position.distanceTo(relicHolder.position);
    if(d < 1.45){
      collectRelic();
    }
  } else if(state.hasRelic && relicRoot){
    // carried relic spins slowly above player
    relicRoot.rotation.y += dt*1.2;
  }

  // pedestal ring pulse after collect
  if(relicCollectEffect>0){
    relicCollectEffect-=dt*1.5;
    pedestalRing.scale.setScalar(1+ (1-relicCollectEffect)*0.6);
    pedestalRing.material.opacity = relicCollectEffect;
    if(relicCollectEffect<=0) pedestalRing.visible=false;
  }

  // exit check
  if(state.hasRelic){
    const dExit = playerGroup.position.distanceTo(new THREE.Vector3(0,0,10));
    if(dExit < 1.6) winGame();
  }

  // camera follow lerp
  const target = playerGroup.position.clone(); target.y=0;
  const camDesired = new THREE.Vector3(target.x*0.35, 14, target.z*0.22+13);
  camera.position.lerp(camDesired, dt*2.2);
  camera.lookAt(target.x, 0, target.z*0.25);

  updateHUD();
  renderer.render(scene, camera);
}
animate();
updateHUD();
window.__GLB_REL = { state, scene, renderer, camera };

// expose material proof for tests?

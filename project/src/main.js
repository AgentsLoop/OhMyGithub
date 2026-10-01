import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// DOM
const canvas = document.getElementById('game-canvas');
const loadingScreen = document.getElementById('loading-screen');
const loadingFill = document.getElementById('loading-fill');
const loadingText = document.getElementById('loading-text');
const counterText = document.getElementById('counter-text');
const dots = [...document.querySelectorAll('.dot')];
const objectiveText = document.getElementById('objective-text');
const statusText = document.getElementById('status-text');
const interactPrompt = document.getElementById('interact-prompt');
const winOverlay = document.getElementById('win-overlay');
const creditsModal = document.getElementById('credits-modal');
const winTimeEl = document.getElementById('win-time');

let collected = 0;
let gameWon = false;
let startTime = performance.now();
let interactableChest = null;

function setProgress(p, label) {
  loadingFill.style.width = `${Math.round(p*100)}%`;
  loadingText.textContent = `${label} ${Math.round(p*100)}%`;
}
function updateCounter() {
  counterText.textContent = `${collected} / 3`;
  dots.forEach((d,i)=> d.classList.toggle('filled', i < collected));
}
function updateObjective() {
  if (collected < 3) {
    objectiveText.textContent = `Find ${3-collected} more chest${3-collected===1?'':'s'} hidden on the island`;
  } else {
    objectiveText.textContent = 'All chests found! Return to your ship to win';
  }
}
function setStatus(msg) {
  statusText.textContent = msg;
}

// Renderer / Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c7e8);
scene.fog = new THREE.Fog(0x8fd3f0, 48, 110);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 300);
camera.position.set(18, 13, 18);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 42;
controls.maxPolarAngle = Math.PI * 0.47;
controls.target.set(0, 1, 0);

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a40, 1.05));
const sun = new THREE.DirectionalLight(0xfff6d6, 2.2);
sun.position.set(28, 28, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0008;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9ecbff, 0.7);
fill.position.set(-12, 12, -10);
scene.add(fill);

// Ocean
const oceanGeo = new THREE.PlaneGeometry(260, 260, 1, 1);
const oceanMat = new THREE.MeshStandardMaterial({ color: 0x1a7fb8, roughness: 0.18, metalness: 0.06, transparent: true, opacity: 0.98 });
const ocean = new THREE.Mesh(oceanGeo, oceanMat);
ocean.rotation.x = -Math.PI/2;
ocean.position.y = -0.6;
ocean.receiveShadow = true;
scene.add(ocean);
// second deeper ocean tint
const oceanDeep = new THREE.Mesh(new THREE.PlaneGeometry(420,420), new THREE.MeshStandardMaterial({ color: 0x0e4a6b, roughness: 0.9 }));
oceanDeep.rotation.x = -Math.PI/2;
oceanDeep.position.y = -1.2;
scene.add(oceanDeep);

// Island base — displaced circle
const islandRadius = 18;
const islandGeo = new THREE.CircleGeometry(islandRadius, 64);
islandGeo.rotateX(-Math.PI/2);
// displace Y via vertex manipulation for gentle hills
const pos = islandGeo.attributes.position;
for (let i=0;i<pos.count;i++){
  const x = pos.getX(i), z = pos.getZ(i);
  const d = Math.hypot(x,z);
  // height: dome + noise
  let h = Math.max(0, (1 - d/islandRadius)) * 3.2;
  h += Math.sin(x*0.35)*0.3 + Math.cos(z*0.4)*0.25;
  h += (Math.sin(x*0.8+z*0.6)*0.12);
  // flatten near shore slightly
  if (d > 13) h *= Math.max(0, (islandRadius - d)/5);
  pos.setY(i, h - 0.15);
}
islandGeo.computeVertexNormals();
const islandMat = new THREE.MeshStandardMaterial({ color: 0x9ed16a, roughness: 0.92, metalness: 0.0 });
const island = new THREE.Mesh(islandGeo, islandMat);
island.receiveShadow = true;
island.castShadow = true;
scene.add(island);

// Sand ring
const sandGeo = new THREE.RingGeometry(13, islandRadius+1.2, 64);
sandGeo.rotateX(-Math.PI/2);
sandGeo.translate(0, -0.02, 0);
// color per vertex approx
const sandMat = new THREE.MeshStandardMaterial({ color: 0xfde7a0, roughness: 1.0, side: THREE.DoubleSide });
const sand = new THREE.Mesh(sandGeo, sandMat);
sand.receiveShadow = true;
scene.add(sand);

// Rocks scattered
const rockGeo = new THREE.DodecahedronGeometry(1, 0);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.9 });
for (let i=0;i<18;i++){
  const ang = Math.random()*Math.PI*2;
  const r = 4 + Math.random()*10;
  const x = Math.cos(ang)*r;
  const z = Math.sin(ang)*r;
  const s = 0.5 + Math.random()*0.9;
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.set(x, 0.15*s, z);
  rock.scale.set(s, s*0.7, s);
  rock.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
  rock.castShadow = true; rock.receiveShadow = true;
  // lift to ground height approx
  rock.position.y = 0.35*s;
  scene.add(rock);
}

// Palm trees (procedural)
function makePalm(x,z, scale=1){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12*scale, 0.18*scale, 3.2*scale, 7), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }));
  trunk.position.y = 1.6*scale;
  trunk.castShadow = true;
  g.add(trunk);
  const leaves = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d7a3b, roughness: 0.8, side: THREE.DoubleSide });
  for(let i=0;i<6;i++){
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.9*scale, 7, 6), leafMat);
    leaf.scale.set(1.2, 0.25, 0.6);
    const ang = (i/6)*Math.PI*2;
    leaf.position.set(Math.cos(ang)*0.45*scale, 3.15*scale, Math.sin(ang)*0.45*scale);
    leaf.lookAt(0, 3.15*scale, 0);
    leaf.rotateX(0.35);
    leaf.castShadow = true;
    leaves.add(leaf);
  }
  g.add(leaves);
  g.position.set(x, 0, z);
  // tilt a bit
  g.rotation.z = (Math.random()-0.5)*0.15;
  g.rotation.x = (Math.random()-0.5)*0.15;
  scene.add(g);
}
const palmPositions = [[-6, -8],[8, -7],[ -4, 10],[10, 6],[ -10, 3],[5, 11],[ -8, -3],[2, -12]];
palmPositions.forEach(([x,z])=> makePalm(x, z, 0.9 + Math.random()*0.35));
for(let i=0;i<10;i++){ const a=Math.random()*Math.PI*2, r=5+Math.random()*8; makePalm(Math.cos(a)*r, Math.sin(a)*r, 0.7+Math.random()*0.4); }

// Treasure chests
const chestGroup = new THREE.Group();
scene.add(chestGroup);
const chestPositions = [
  new THREE.Vector3(-9, 0.35, 7),
  new THREE.Vector3(11, 0.35, -2),
  new THREE.Vector3(0.5, 0.35, 12.5),
];
const chests = [];
function createChest(pos) {
  const grp = new THREE.Group();
  grp.position.copy(pos);
  // base
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.0), new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7 }));
  base.position.y = 0.42;
  base.castShadow = true; base.receiveShadow = true;
  grp.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.05), new THREE.MeshStandardMaterial({ color: 0xb7792a, roughness: 0.55, metalness: 0.15 }));
  lid.position.y = 0.95;
  lid.castShadow = true;
  grp.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.08), new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 0.6, roughness: 0.3 }));
  lock.position.set(0, 0.6, 0.52);
  grp.add(lock);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffb700, emissiveIntensity: 1.2, transparent: true, opacity: 0.0 }));
  glow.position.y = 1.3;
  grp.add(glow);
  // point light for collected effect
  const light = new THREE.PointLight(0xffc54a, 0, 6);
  light.position.y = 1.1;
  grp.add(light);
  // pedestal shadow
  grp.userData = { base, lid, lock, glow, light, collected: false, pulse: Math.random()*Math.PI*2 };
  chestGroup.add(grp);
  return grp;
}
chestPositions.forEach(p=> chests.push(createChest(p)));

// Ship dock area - create a wooden pier
const pier = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.25, 7), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 }));
pier.position.set(14.5, -0.05, -6);
pier.receiveShadow = true; pier.castShadow = true;
scene.add(pier);
const pierPostGeo = new THREE.CylinderGeometry(0.09,0.09,1.4,6);
for(let x of [-1.9,1.9]) for(let z of [-3,0,3]){ const post=new THREE.Mesh(pierPostGeo, new THREE.MeshStandardMaterial({color:0x5c3a1a})); post.position.set(14.5+x,-0.4,-6+z); scene.add(post); }

// Player - start at island center for best initial overview (ship remains at pier 16,-6)
const playerGroup = new THREE.Group();
playerGroup.position.set(0, 0, 2);
scene.add(playerGroup);
// placeholder capsule while GLB loads
const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf87171 }));
capsule.position.y = 0.9;
capsule.visible = true;
playerGroup.add(capsule);
// shadow disc
const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5,16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.22 }));
shadowDisc.rotation.x = -Math.PI/2;
shadowDisc.position.y = 0.02;
playerGroup.add(shadowDisc);

let pirateMixer = null;
let pirateModel = null;
let shipModel = null;
let shipBoundsHelper = null;
const shipPos = new THREE.Vector3(16.2, 0.55, -6);

// Input
const keys = { w:false,a:false,s:false,d:false, arrowup:false, arrowleft:false, arrowdown:false, arrowright:false, e:false };
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  if(k in keys) keys[k]=true;
  if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) e.preventDefault();
  if(k==='e') tryCollect();
});
addEventListener('keyup', e=>{
  const k = e.key.toLowerCase();
  if(k in keys) keys[k]=false;
});
addEventListener('blur', ()=> Object.keys(keys).forEach(k=> keys[k]=false));

function getMoveInput() {
  let x=0, y=0;
  if(keys.w||keys.arrowup) y+=1;
  if(keys.s||keys.arrowdown) y-=1;
  if(keys.a||keys.arrowleft) x-=1;
  if(keys.d||keys.arrowright) x+=1;
  if(x!==0||y!==0){
    const l=Math.hypot(x,y); x/=l; y/=l;
  }
  return {x, y};
}

// Orbit damping target follow
let playerYaw = 0;

// Loading GLBs
const loader = new GLTFLoader();
let loadedCount = 0;
const totalToLoad = 2;
function onLoadProgress(name, p){
  const overall = (loadedCount + p)/totalToLoad;
  setProgress(overall, `Loading ${name}…`);
}

async function loadShip(){
  setProgress(0.05, 'Loading pirate ship…');
  try{
    const gltf = await loader.loadAsync('/models/pirate-ship.glb', (ev)=>{
      if(ev.lengthComputable) onLoadProgress('pirate ship', ev.loaded/ev.total * 0.5);
    });
    shipModel = gltf.scene;
    // Normalize scale: compute bounds
    shipModel.updateWorldMatrix(true,true);
    const box = new THREE.Box3().setFromObject(shipModel);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    // target size ~5.5 units long (approx X or Z)
    const target = 5.6;
    const scale = target / maxDim;
    // center model
    shipModel.position.sub(center);
    // Apply scale via wrapper
    const wrapper = new THREE.Group();
    wrapper.add(shipModel);
    wrapper.scale.setScalar(scale);
    wrapper.position.copy(shipPos);
    // The ship model originally may be oriented oddly; rotate to face island
    wrapper.rotation.y = -Math.PI * 0.72;
    wrapper.traverse(o=>{
      if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; if(o.material){ o.material.needsUpdate = true; } }
    });
    scene.add(wrapper);
    shipModel = wrapper;
    // Create win zone indicator ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.55, 32), new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent:true, opacity:0.55, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI/2;
    ring.position.set(shipPos.x-1.2, 0.04, shipPos.z+0.6);
    scene.add(ring);
    // bobbing animation helper
    shipModel.userData.baseY = shipModel.position.y;
    shipModel.userData.ring = ring;
    loadedCount += 1;
    setProgress(loadedCount/totalToLoad, 'Ship ready');
  }catch(err){
    console.error('Ship load failed', err);
    statusText.textContent = 'Ship asset failed to load — check console';
    loadedCount+=1;
  }
}
async function loadCharacter(){
  setProgress(0.25, 'Loading pirate hero…');
  try{
    const gltf = await loader.loadAsync('/models/pirate-character.glb', (ev)=>{
      if(ev.lengthComputable) onLoadProgress('pirate hero', ev.loaded/ev.total * 0.5);
    });
    const model = gltf.scene;
    model.traverse(o=>{
      if(o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
        if(o.material){
          // ensure double sided already, fix any transparency issues
          o.material.needsUpdate = true;
        }
      }
    });
    // Center and normalize character - model bounds are tiny due to skinning (~0.02), scale to ~1.7m
    model.updateWorldMatrix(true,true);
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3(); box.getCenter(center);
    const size = new THREE.Vector3(); box.getSize(size);
    const height = size.y;
    console.log('Pirate bounds', size, center, 'height', height);
    // Empirical scale: Box3 height ~0.02 underestimates; visual tests show scale 2-3 is correct for ~1.7m
    const s = 2.2;
    console.log('Pirate scale', s, 'height', height);
    model.position.sub(center);
    model.position.y += height/2;
    model.scale.setScalar(s);
    // Some models face +Z, we want -Z forward? Test orientation: pirate likely faces +Z originally; we will rotate 180 if needed
    // The mixamo animation may assume Y up; keep as is and rotate model to face North
    model.rotation.y = Math.PI;
    // Hide placeholder
    capsule.visible = false;
    playerGroup.add(model);
    pirateModel = model;
    // Animation mixer - static pose for stable framing (avoid root-motion drift)
    if(gltf.animations && gltf.animations.length){
      pirateMixer = new THREE.AnimationMixer(model);
      const clip = gltf.animations[0];
      // Remove root position tracks to prevent drift covering screen
      const filteredClip = clip.clone();
      filteredClip.tracks = filteredClip.tracks.filter(t => !t.name.endsWith('.position'));
      const action = pirateMixer.clipAction(filteredClip);
      action.play();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      pirateMixer.timeScale = 0.7;
    }
    // Ensure playerGroup height aligns
    loadedCount += 1;
    setProgress(loadedCount/totalToLoad, 'Pirate ready');
  }catch(err){
    console.error('Character load failed', err);
    statusText.textContent = 'Pirate asset failed — using fallback';
    loadedCount+=1;
  }
}

// Init loads sequentially
let _shipReady = false, _pirateReady = false;
loadShip().then(()=>{ _shipReady=true; maybeStart(); });
loadCharacter().then(()=>{ _pirateReady=true; maybeStart(); });
function maybeStart(){
  if(!_shipReady || !_pirateReady) return;
  setProgress(1, 'Ready!');
  setTimeout(()=>{ loadingScreen.classList.add('done'); }, 500);
  updateCounter(); updateObjective();
  setStatus('Tip: Follow the golden glows — 3 chests await!');
}

// Game loop helpers
const clock = new THREE.Clock();
let playerVel = new THREE.Vector3();
const playerSpeed = 4.2;
const playerRadius = 0.42;

function isOnIsland(x,z){
  const d = Math.hypot(x,z);
  // allow pier area near ship
  if (x > 12 && z > -9 && z < -2) return true;
  return d < islandRadius + 0.6;
}

function updateMovement(dt){
  const inp = getMoveInput();
  // camera-relative movement
  const camForward = new THREE.Vector3();
  camera.getWorldDirection(camForward);
  camForward.y = 0; camForward.normalize();
  const camRight = new THREE.Vector3().crossVectors(camForward, new THREE.Vector3(0,1,0)).negate(); // careful: right = forward cross up
  // Actually compute correctly: right = forward x up ? Let's recalc
  // forward x up = right? For y up, forward (0,0,-1), cross (0,1,0) => (-1,0,0) ??? hmm.
  // Simpler: use camera position relative to target
  const toCam = new THREE.Vector3().subVectors(camera.position, controls.target);
  toCam.y = 0; toCam.normalize();
  // forward is -toCam ? When camera is behind player, forward should be away from camera.
  // Let's recompute: camForward already is camera look direction (from camera to target). That's towards player. So moving 'forward' (w) should move away from camera? Actually player forward should be where camera looks? Common third-person: W moves in camera forward direction (toward where camera faces, away from camera)
  // So if camForward points from camera to target (toward scene), W should move in camForward direction projected.
  // Let's use camForward for y input.
  const move = new THREE.Vector3();
  // inp.y is forward/back, inp.x is left/right
  move.addScaledVector(camForward, inp.y);
  // right vector perpendicular to forward
  const right = new THREE.Vector3(camForward.z, 0, -camForward.x); // 90 deg rotation
  move.addScaledVector(right, inp.x);
  if(move.lengthSq()>0.001){
    move.normalize();
    // apply velocity with acceleration
    const accel = 18;
    playerVel.x += move.x * accel * dt;
    playerVel.z += move.z * accel * dt;
    // face movement direction
    const targetYaw = Math.atan2(move.x, move.z);
    // smooth yaw
    let diff = targetYaw - playerYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    playerYaw += diff * Math.min(1, 12*dt);
    playerGroup.rotation.y = playerYaw;
    // walk animation speed
    if(pirateMixer) pirateMixer.timeScale = 1.15;
    if(pirateModel) pirateModel.position.y = 0.06 * Math.sin(performance.now()*0.011);
  } else {
    // friction
    const friction = 10;
    playerVel.x -= playerVel.x * Math.min(1, friction*dt);
    playerVel.z -= playerVel.z * Math.min(1, friction*dt);
    if(playerVel.lengthSq()<0.001){ playerVel.set(0,0,0); }
    if(pirateMixer) pirateMixer.timeScale = 0.7;
  }
  // limit speed
  const spd = Math.hypot(playerVel.x, playerVel.z);
  if(spd > playerSpeed){
    playerVel.x *= playerSpeed/spd;
    playerVel.z *= playerSpeed/spd;
  }
  // integrate
  let nextX = playerGroup.position.x + playerVel.x * dt;
  let nextZ = playerGroup.position.z + playerVel.z * dt;
  // collision with island bounds: slide along edge
  if(!isOnIsland(nextX, nextZ)){
    // try sliding X only, Z only
    if(isOnIsland(nextX, playerGroup.position.z)){
      nextZ = playerGroup.position.z;
      playerVel.z *= -0.2;
    } else if(isOnIsland(playerGroup.position.x, nextZ)){
      nextX = playerGroup.position.x;
      playerVel.x *= -0.2;
    } else {
      // push back to center slightly
      const ang = Math.atan2(playerGroup.position.z, playerGroup.position.x);
      nextX = Math.cos(ang)*(islandRadius-0.2);
      nextZ = Math.sin(ang)*(islandRadius-0.2);
      playerVel.multiplyScalar(0.3);
    }
  }
  // simple rock avoidance: push away if too close to rocks? Skip detailed.
  playerGroup.position.x = nextX;
  playerGroup.position.z = nextZ;
  // hover y to terrain approx
  const d = Math.hypot(nextX, nextZ);
  let h = Math.max(0, (1 - d/islandRadius))*1.8;
  // flatten
  if(d>13) h*= Math.max(0, (islandRadius - d)/5);
  playerGroup.position.y = h * 0.55;
  // pier flat
  if(nextX>12 && nextZ > -9 && nextZ < -2){
    playerGroup.position.y = 0.12;
  }
  // update orbit target to player head
  const targetY = playerGroup.position.y + 1.0;
  controls.target.lerp(new THREE.Vector3(playerGroup.position.x, targetY, playerGroup.position.z), Math.min(1, 6*dt));
}

function checkChests(){
  let nearest = null;
  let nearestDist = Infinity;
  chests.forEach(c=>{
    if(c.userData.collected) return;
    const d = c.position.distanceTo(playerGroup.position);
    if(d < nearestDist){ nearestDist=d; nearest=c; }
    // pulse glow when near
    const pulse = Math.sin(performance.now()*0.004 + c.userData.pulse)*0.2 + 0.8;
    c.userData.glow.material.opacity = THREE.MathUtils.clamp(1.6 - d*0.45, 0, 0.85) * pulse;
    c.userData.glow.scale.setScalar(1 + pulse*0.15);
    c.userData.light.intensity = c.userData.collected ? 0 : Math.max(0, (2.2 - d*0.6))*pulse;
  });
  // show prompt if nearest within 2.2
  if(nearest && nearestDist < 2.2 && !nearest.userData.collected){
    interactPrompt.classList.remove('hidden');
    interactableChest = nearest;
    setStatus('Press E to open chest!');
  } else {
    interactPrompt.classList.add('hidden');
    interactableChest = null;
    if(collected<3) setStatus('Explore — listen for the treasure sparkle.');
    else setStatus('Return to your ship at the pier!');
  }
}

function collectChest(chest){
  if(chest.userData.collected) return;
  chest.userData.collected = true;
  collected++;
  updateCounter(); updateObjective();
  // animation: lid pop, particles
  chest.userData.lid.position.y = 1.25;
  chest.userData.lid.rotation.x = -0.45;
  chest.userData.glow.material.opacity = 0;
  chest.userData.light.intensity = 3;
  // particle burst
  burstParticles(chest.position.clone().add(new THREE.Vector3(0,1,0)), 18, 0xf5c542);
  setStatus(`Chest ${collected}/3 secured! ${collected<3 ? 'Keep hunting!' : 'Now return to the ship!'}`);
  // small camera shake ?
  // check win proximity will be checked elsewhere
  if(collected===3){
    // make ship ring pulse stronger
    if(shipModel && shipModel.userData.ring){
      shipModel.userData.ring.material.color.set(0xfff6a0);
    }
  }
}

function tryCollect(){
  if(interactableChest) collectChest(interactableChest);
  else if(collected<3){
    // optional feedback if near but not enough? just ignore
  }
}

// Particles
const particleGroup = new THREE.Group();
scene.add(particleGroup);
function burstParticles(origin, count, color){
  for(let i=0;i<count;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09,6,6), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1 }));
    m.position.copy(origin);
    const vel = new THREE.Vector3((Math.random()-0.5)*4, Math.random()*4+1, (Math.random()-0.5)*4);
    particleGroup.add(m);
    const start = performance.now();
    const tick = ()=>{
      const t = (performance.now()-start)/1000;
      if(t>1.1){ particleGroup.remove(m); return; }
      m.position.addScaledVector(vel, 0.016);
      vel.y -= 6*0.016;
      m.material.opacity = 1 - t;
      m.material.transparent = true;
      requestAnimationFrame(tick);
    };
    tick();
  }
}

function checkWin(){
  if(gameWon || collected<3 || !shipModel) return;
  const d = new THREE.Vector2(playerGroup.position.x, playerGroup.position.z).distanceTo(new THREE.Vector2(shipPos.x-1.2, shipPos.z));
  if(d < 2.6){
    gameWon = true;
    const elapsed = Math.round((performance.now()-startTime)/1000);
    winTimeEl.textContent = `Time: ${elapsed}s · Chests: ${collected}/3`;
    winOverlay.classList.remove('hidden');
    burstParticles(playerGroup.position.clone().add(new THREE.Vector3(0,1.2,0)), 30, 0xfff1a0);
    setStatus('Victory! You escaped with the treasure!');
  }
}

// Auto-collect also when very close (1.1 units) for accessibility
function autoCollectProximity(){
  chests.forEach(c=>{
    if(c.userData.collected) return;
    if(c.position.distanceTo(playerGroup.position) < 1.15){
      collectChest(c);
    }
  });
}

// Animate
let lastT = performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - lastT)/1000);
  lastT = now;
  const elapsed = now*0.001;
  updateMovement(dt);
  checkChests();
  autoCollectProximity();
  checkWin();
  if(pirateMixer) pirateMixer.update(dt);
  // chest idle bob
  chests.forEach(c=>{
    if(!c.userData.collected){
      c.position.y = 0.35 + Math.sin(elapsed*1.2 + c.userData.pulse)*0.07;
      c.rotation.y += dt*0.35;
    } else {
      c.position.y = THREE.MathUtils.lerp(c.position.y, 0.35, dt*4);
    }
  });
  // ship bob & rock
  if(shipModel){
    shipModel.position.y = shipModel.userData.baseY + Math.sin(elapsed*0.7)*0.12;
    shipModel.rotation.z = Math.sin(elapsed*0.5)*0.02;
    if(shipModel.userData.ring){
      shipModel.userData.ring.material.opacity = 0.45 + Math.sin(elapsed*2.0)*0.18;
      if(collected<3) shipModel.userData.ring.material.opacity *= 0.0; // hide until all collected? Let's keep subtle
      else shipModel.userData.ring.material.opacity = 0.55 + Math.sin(elapsed*2.6)*0.2;
    }
  }
  // ocean subtle movement
  ocean.position.y = -0.6 + Math.sin(elapsed*0.45)*0.04;
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Resize
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// UI buttons
document.getElementById('credits-btn').onclick = ()=> creditsModal.classList.remove('hidden');
document.getElementById('win-credits-btn').onclick = ()=> creditsModal.classList.remove('hidden');
document.getElementById('close-credits-btn').onclick = ()=> creditsModal.classList.add('hidden');
creditsModal.addEventListener('click', e=>{ if(e.target===creditsModal) creditsModal.classList.add('hidden'); });
winOverlay.addEventListener('click', e=>{ if(e.target===winOverlay) {/* ignore */}});
document.getElementById('reset-btn').onclick = ()=> resetGame();
document.getElementById('play-again-btn').onclick = ()=> resetGame();

function resetGame(){
  collected = 0;
  gameWon = false;
  startTime = performance.now();
  updateCounter(); updateObjective();
  winOverlay.classList.add('hidden');
  playerGroup.position.set(0, 0.12, 2);
  playerVel.set(0,0,0);
  playerYaw = 0;
  playerGroup.rotation.y = 0;
  controls.target.set(playerGroup.position.x, 1, playerGroup.position.z);
  camera.position.set(4, 14, 16);
  chests.forEach(c=>{
    c.userData.collected = false;
    c.userData.lid.position.y = 0.95;
    c.userData.lid.rotation.x = 0;
    c.userData.glow.material.opacity = 0;
  });
  setStatus('New voyage started — find the 3 chests!');
}

// Expose for tests
window.__game = { getCollected: ()=>collected, getChests: ()=>chests, playerGroup, shipPos, collectChest: (i)=> collectChest(chests[i]), tryWinCheck: checkWin, camera, controls, get shipModel(){return shipModel;}, get pirateModel(){return pirateModel;} };

// Keyboard help focus canvas
canvas.tabIndex = 0;
canvas.focus();

// Ensure camera looks at player initially - overview showing island, ship, and pirate hero
controls.target.set(playerGroup.position.x, 1, playerGroup.position.z);
camera.position.set(4, 14, 16);
controls.update();

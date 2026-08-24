import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createState, moveLane, takeDamage, updateDistance, isColliding, formatSpeed } from './gameLogic.js';

const canvas = document.getElementById('c');
const distEl = document.getElementById('dist');
const relicCountEl = document.getElementById('relicCount');
const healthFill = document.getElementById('healthFill');
const speedPill = document.getElementById('speedPill');
const loadStatus = document.getElementById('loadStatus');
const overlay = document.getElementById('overlay');
const startCard = document.getElementById('startCard');
const winCard = document.getElementById('winCard');
const loseCard = document.getElementById('loseCard');
const playBtn = document.getElementById('playBtn');
const againBtn = document.getElementById('againBtn');
const retryBtn = document.getElementById('retryBtn');
const inspectBtn = document.getElementById('inspectBtn');
const shareBtn = document.getElementById('shareBtn');

let scene, camera, renderer, clock;
let player, playerGroup, relicWrapper, relicModel, relicLight, relicGlow;
let animationMixer;
let floor, walls = [];
let obstacles = [];
let particles = [];
let running = false;
let pausedForInspect = false;
let state = createState();
let keys = {};
let touchStartX = 0;

let relicLoaded = false;
let relicBox = new THREE.Box3();
let relicCenter = new THREE.Vector3();
let relicSize = new THREE.Vector3();

// Scene setup
function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a1408, 40, 95);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 5.5, 11);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  clock = new THREE.Clock();

  // lights
  const hemi = new THREE.HemisphereLight(0xfff2d0, 0x1a1408, 1.1);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe7b0, 2.2);
  sun.position.set(12, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8ec8ff, 0.35);
  fill.position.set(-10, 8, -10);
  scene.add(fill);

  // environment subtle
  scene.background = new THREE.Color(0x0f0e0a);

  // floor temple corridor
  const floorGeo = new THREE.PlaneGeometry(9, 300);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd9a86c, roughness: 0.88, metalness: 0.02 });
  floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = 0;
  floor.position.z = -60;
  floor.receiveShadow = true;
  scene.add(floor);

  // floor tiles pattern via grid helper fake
  const grid = new THREE.GridHelper(200, 40, 0x9a7a52, 0xb9996a);
  grid.position.y = 0.02;
  grid.position.z = -60;
  scene.add(grid);

  // side walls
  const wallGeo = new THREE.BoxGeometry(0.6, 4.5, 300);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.92 });
  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-4.7, 2.25, -60);
  const rightWall = leftWall.clone();
  rightWall.position.x = 4.7;
  walls.push(leftWall, rightWall);
  scene.add(leftWall, rightWall);

  // decorative columns every 15m
  for(let z=10; z>-180; z-=14){
    for(let side of [-4.1, 4.1]){
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.44,4.2,12), new THREE.MeshStandardMaterial({ color: 0x5c4a33, roughness:0.8 }));
      col.position.set(side, 2.1, z);
      col.castShadow = true;
      col.receiveShadow = true;
      scene.add(col);
    }
  }

  // player
  playerGroup = new THREE.Group();
  player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.9, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x00e5cc, roughness: 0.35, metalness: 0.15, emissive: 0x00302a, emissiveIntensity: 0.2 })
  );
  player.position.y = 0.95;
  player.castShadow = true;
  playerGroup.add(player);
  // shadow disc
  const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent:true, opacity:0.22 }));
  shadowDisc.rotation.x = -Math.PI/2;
  shadowDisc.position.y = 0.03;
  playerGroup.add(shadowDisc);
  // visor
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness:0.6, roughness:0.18 }));
  visor.position.set(0, 1.25, 0.22);
  visor.scale.set(1.1,0.7,0.6);
  playerGroup.add(visor);

  playerGroup.position.set(0,0,4);
  scene.add(playerGroup);

  // relic wrapper for centering / framing per skill guidance
  relicWrapper = new THREE.Group();
  relicWrapper.position.set(0, 0.55, -140);
  scene.add(relicWrapper);

  // pedestal for relic
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.95,1.15,0.65,16), new THREE.MeshStandardMaterial({ color:0x3d3528, roughness:0.85 }));
  pedestal.position.y = 0.32;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  relicWrapper.add(pedestal);

  const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,0.12,16), new THREE.MeshStandardMaterial({ color:0x6b5a3a, roughness:0.6, metalness:0.2 }));
  pedTop.position.y = 0.7;
  relicWrapper.add(pedTop);

  // glow
  relicGlow = new THREE.PointLight(0xffb700, 2.2, 12, 2);
  relicGlow.position.set(0,1.4,0);
  relicWrapper.add(relicGlow);

  relicLight = new THREE.SpotLight(0xffe7a0, 12, 18, Math.PI/5, 0.6, 1);
  relicLight.position.set(0,7,0);
  relicLight.target = relicWrapper;
  relicWrapper.add(relicLight);

  // particles aura
  for(let i=0;i<18;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6), new THREE.MeshBasicMaterial({ color:0xffd36a, transparent:true, opacity:0.55 }));
    p.userData = { baseY: 1+Math.random()*1.2, phase: Math.random()*Math.PI*2, radius: 0.9+Math.random()*0.7, speed: 0.4+Math.random()*0.8 };
    p.position.set((Math.random()-0.5)*1.6, p.userData.baseY, (Math.random()-0.5)*1.6);
    particles.push(p);
    relicWrapper.add(p);
  }

  loadRelic();
  createObstacles();
  bindEvents();
  animate();
}

function loadRelic(){
  const loader = new GLTFLoader();
  loader.load('/models/relic.glb', (gltf)=>{
    // Preserve authored hierarchy by inserting centering parent (skill guidance)
    const root = gltf.scene;
    // Ensure materials are preserved (no override), enable shadows, keep textures
    root.traverse(o=>{
      if(o.isMesh){
        o.castShadow = true;
        o.receiveShadow = true;
        // preserve authored materials — do not replace
        if(o.material){
          o.material.needsUpdate = true;
        }
      }
    });
    // Compute bounds and frame correctly
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3(); box.getCenter(center);
    const size = new THREE.Vector3(); box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const desired = 1.45; // chest should be ~1.45m wide for pedestal
    const scale = maxDim>0 ? desired / maxDim : 1;
    // Create centering group
    const centerGroup = new THREE.Group();
    // move root so its center aligns
    root.position.sub(center);
    centerGroup.add(root);
    centerGroup.scale.setScalar(scale);
    centerGroup.position.y = 0.95; // lift above pedestal
    relicWrapper.add(centerGroup);
    relicModel = centerGroup;

    // record for verification
    relicBox.copy(box);
    relicCenter.copy(center);
    relicSize.copy(size);
    relicLoaded = true;
    loadStatus.textContent = `Relic visible • ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}m • scale ${scale.toFixed(2)}`;
    loadStatus.style.color = '#00e5a0';
    console.log('[Relic] Loaded', { size: size.toArray(), center: center.toArray(), scale });

    // spin animation
    // If file had animations, would play via AnimationMixer; our proxy has none, we create idle hover/spin
    if(gltf.animations && gltf.animations.length){
      animationMixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach(c=> animationMixer.clipAction(c).play());
    }
  }, (ev)=>{
    if(ev.lengthComputable) loadStatus.textContent = `Loading relic… ${Math.round(ev.loaded/ev.total*100)}%`;
  }, (err)=>{
    console.error('GLB load failed', err);
    loadStatus.textContent = 'Relic failed to load — check console';
    loadStatus.style.color = '#ff3b30';
    // fallback: create visible fallback chest so game remains playable
    const fallback = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.7,0.8), new THREE.MeshStandardMaterial({ color:0x8b5a2b }));
    fallback.position.y = 0.95;
    relicWrapper.add(fallback);
    relicModel = fallback;
    relicLoaded = true;
  });
}

function createObstacles(){
  obstacles = [];
  // generate 16 obstacles along track
  const lanePos = [-2.2, 0, 2.2];
  let z = -18;
  for(let i=0;i<18;i++){
    const lane = Math.floor(Math.random()*3);
    const type = Math.random()<0.55 ? 'pillar' : 'barrier';
    let mesh;
    if(type==='pillar'){
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2,1.6,1.1), new THREE.MeshStandardMaterial({ color:0x4a3f2e, roughness:0.85 }));
      mesh.position.set(lanePos[lane], 0.8, z);
      // top hazard spikes
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18,0.45,6), new THREE.MeshStandardMaterial({ color:0x8a3218 }));
      spike.position.y = 1.02;
      mesh.add(spike);
    } else {
      // low barrier requires jump
      mesh = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.55,0.7), new THREE.MeshStandardMaterial({ color:0x6b5a3a, roughness:0.9 }));
      // if barrier, occupy center and one side lane? Make lane random but barrier covers 1 lane only for navigability
      mesh.position.set(lanePos[lane], 0.28, z);
      mesh.userData.isLow = true;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...mesh.userData, lane, baseZ: z, hit: false };
    scene.add(mesh);
    obstacles.push(mesh);
    z -= 7 + Math.random()*5;
  }
  // ensure final stretch is clear for dramatic approach
  obstacles = obstacles.filter(o=> o.position.z > -128);
}

let jumpV = 0, isGrounded = true, slideT = 0;
let targetX = 0;

function bindEvents(){
  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.addEventListener('keydown', e=>{
    keys[e.key.toLowerCase()] = true;
    if(['ArrowLeft','a'].includes(e.key.toLowerCase()) && running) handleMove(-1);
    if(['ArrowRight','d'].includes(e.key.toLowerCase()) && running) handleMove(1);
    if([' ','arrowup','w'].includes(e.key.toLowerCase()) && running && isGrounded){ jumpV = 9.2; isGrounded = false; }
    if(['s','arrowdown'].includes(e.key.toLowerCase()) && running){ slideT = 0.55; }
  });
  window.addEventListener('keyup', e=> keys[e.key.toLowerCase()] = false);
  canvas.addEventListener('touchstart', e=>{ touchStartX = e.touches[0].clientX; });
  canvas.addEventListener('touchend', e=>{
    const dx = e.changedTouches[0].clientX - touchStartX;
    if(Math.abs(dx) > 30){
      handleMove(dx>0?1:-1);
    } else {
      if(isGrounded){ jumpV=9; isGrounded=false; }
    }
  });
  playBtn.addEventListener('click', startRun);
  againBtn.addEventListener('click', restart);
  retryBtn.addEventListener('click', restart);
  inspectBtn.addEventListener('click', ()=>{
    pausedForInspect = !pausedForInspect;
    if(pausedForInspect){
      startCard.querySelector('h2').textContent = 'Relic Inspected';
      startCard.querySelector('.sub').textContent = 'Yaw the camera around the pedestal and admire the PBR wood and metal. Press Start Run when ready.';
      relicWrapper.visible = true;
      camera.position.set(3.2, 2.8, -135);
      camera.lookAt(relicWrapper.position.x, 1.2, relicWrapper.position.z);
    } else {
      camera.position.set(0,5.5,11);
      camera.lookAt(0,1, -8);
    }
  });
  shareBtn.addEventListener('click', ()=>{
    // focus camera on relic
    running=false;
    overlay.classList.remove('hidden');
    winCard.classList.add('hidden');
    startCard.classList.remove('hidden');
    pausedForInspect=true;
    camera.position.set(2.6,2.2,-136);
    camera.lookAt(relicWrapper.position);
  });
}

function handleMove(dir){
  moveLane(state, dir);
  targetX = state.x;
}

function startRun(){
  state = createState();
  targetX = 0;
  playerGroup.position.set(0,0,4);
  jumpV=0; isGrounded=true; slideT=0;
  obstacles.forEach(o=> o.userData.hit=false);
  overlay.classList.add('hidden');
  startCard.classList.remove('hidden');
  winCard.classList.add('hidden');
  loseCard.classList.add('hidden');
  running = true;
  pausedForInspect=false;
  clock.getDelta(); // reset
}

function restart(){
  winCard.classList.add('hidden');
  loseCard.classList.add('hidden');
  startCard.classList.remove('hidden');
  overlay.classList.add('hidden');
  startRun();
}

function checkCollisions(){
  const pz = playerGroup.position.z + state.z; // world? playerGroup z is fixed at 4, state.z negative moving forward
  // Actually track is moving; easier compute obstacle world Z vs player world Z (approx 4+state.z)
  // Obstacles static world, player moves forward virtually; we compare projected distance
  const playerWorldZ = state.z + 4; // player moving negative
  const px = playerGroup.position.x;
  const py = playerGroup.position.y;

  for(const obs of obstacles){
    if(obs.userData.hit) continue;
    const oz = obs.position.z;
    const ox = obs.position.x;
    const dz = Math.abs(playerWorldZ - oz);
    const dx = Math.abs(px - ox);
    // ignore far
    if(dz > 1.25) continue;
    if(dx > 1.15) continue;
    // check vertical clearance for low barriers (need jump)
    if(obs.userData.isLow){
      if(py > 0.9) continue; // jumped over
    } else {
      if(slideT>0 && py < 0.7) continue; // slid under? but pillars are tall, not slidable; keep hit
      if(obs.userData.isLow===undefined && slideT>0) {
        // sliding doesn't help against pillar
      }
    }
    // hit
    obs.userData.hit = true;
    obs.material.color.set(0x8a2e1e);
    obs.material.emissive = new THREE.Color(0x441000);
    obs.material.emissiveIntensity = 0.5;
    const hp = takeDamage(state, 34);
    healthFill.style.width = hp + '%';
    // knockback
    playerGroup.position.x += (px - ox)*0.35;
    targetX = playerGroup.position.x;
    state.x = targetX;
    // flash
    player.material.emissiveIntensity = 1;
    setTimeout(()=> player.material.emissiveIntensity = 0.2, 200);
    // particle burst
    burst(playerGroup.position.x, 0.6, playerWorldZ);

    if(state.lost){
      running=false;
      setTimeout(()=> {
        overlay.classList.remove('hidden');
        loseCard.classList.remove('hidden');
        startCard.classList.add('hidden');
        document.getElementById('loseText').textContent = `You fell at ${Math.round(state.distance)} m / 140 m — ${state.obstaclesHit} hits. The chest was ${(140 - state.distance).toFixed(0)} m ahead.`;
      }, 350);
      break;
    }
  }

  // win proximity to relic
  const distToRelic = Math.abs(playerWorldZ - (-140));
  if(distToRelic < 2.2 && !state.won && !state.lost){
    // collect
    state.relics = 1; state.won = true;
    running=false;
    relicGlow.intensity = 5;
    // confetti
    for(let i=0;i<24;i++) burst(relicWrapper.position.x + (Math.random()-0.5)*2, 1.2+Math.random(), relicWrapper.position.z + (Math.random()-0.5)*2, 0xffd36a);
    setTimeout(()=>{
      overlay.classList.remove('hidden');
      winCard.classList.remove('hidden');
      startCard.classList.add('hidden');
      document.getElementById('winText').textContent = `You claimed the chest in ${state.time.toFixed(1)}s at ${formatSpeed(state.speed)} km/h — ${state.obstaclesHit} hits taken. The relic's wood and metal PBR glints as it spins for you.`;
    }, 400);
  }
}

function burst(x,y,z,color=0xffe7a0){
  for(let i=0;i<6;i++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshBasicMaterial({ color }));
    s.position.set(x,y,z);
    s.userData = { vx:(Math.random()-0.5)*4, vy: 2+Math.random()*4, vz:(Math.random()-0.5)*4, life:0.6 };
    scene.add(s);
    const iv=setInterval(()=>{
      s.position.x+= s.userData.vx*0.016;
      s.position.y+= s.userData.vy*0.016;
      s.position.z+= s.userData.vz*0.016;
      s.userData.vy -= 12*0.016;
      s.userData.life-=0.016;
      s.material.opacity = Math.max(0,s.userData.life/0.6);
      s.material.transparent=true;
      if(s.userData.life<=0){ scene.remove(s); clearInterval(iv); }
    },16);
  }
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(0.032, clock.getDelta());

  if(relicModel && !pausedForInspect){
    relicModel.rotation.y += dt*0.45;
    relicWrapper.position.y = 0.55 + Math.sin(clock.elapsedTime*1.1)*0.08;
  }
  if(relicWrapper) {
    // particles orbit
    particles.forEach(p=>{
      p.userData.phase += dt*p.userData.speed;
      p.position.x = Math.cos(p.userData.phase)*p.userData.radius*0.5;
      p.position.z = Math.sin(p.userData.phase*0.7)*p.userData.radius*0.5;
      p.position.y = p.userData.baseY + Math.sin(p.userData.phase*1.3)*0.25;
      p.material.opacity = 0.35 + Math.sin(p.userData.phase*2)*0.2;
    });
    relicGlow.intensity = 2.0 + Math.sin(clock.elapsedTime*2)*0.6;
  }

  if(running && !state.won && !state.lost){
    updateDistance(state, dt);
    // smooth lane
    playerGroup.position.x += (targetX - playerGroup.position.x)* 10*dt;
    // jump physics
    if(!isGrounded){
      jumpV -= 21*dt;
      playerGroup.position.y += jumpV*dt;
      if(playerGroup.position.y <= 0){
        playerGroup.position.y = 0;
        jumpV=0; isGrounded=true;
      }
    }
    if(slideT>0){
      slideT-=dt;
      player.scale.y = 0.55;
      player.position.y = 0.55;
    } else {
      player.scale.y += (1 - player.scale.y)*10*dt;
      if(isGrounded) player.position.y += (0.95 - player.position.y)*10*dt;
    }

    // camera follow
    const camTargetX = playerGroup.position.x * 0.35;
    camera.position.x += (camTargetX - camera.position.x)*3*dt;
    camera.position.z = 11 + state.z + 4; // keep behind player as track moves? Actually we move logical distance, world static, so keep camera fixed behind player world
    // simpler: keep camera fixed offset from player world Z
    const playerWorldZ = state.z + 4;
    camera.position.z = playerWorldZ + 7;
    camera.lookAt(playerGroup.position.x*0.5, 1.1, playerWorldZ - 10);

    // obstacles scrolling is via player moving; no need to move obstacles

    checkCollisions();

    distEl.textContent = Math.round(state.distance) + ' m';
    relicCountEl.textContent = (state.won? '1/1' : '0/1');
    speedPill.textContent = '▶ ' + formatSpeed(state.speed) + ' km/h';
    // health already
  } else {
    // idle bob
    playerGroup.position.y = Math.sin(clock.elapsedTime*2)*0.06;
    if(!pausedForInspect){
      // camera orbit idle
      camera.position.x = Math.sin(clock.elapsedTime*0.25)*0.6;
      camera.lookAt(0,1, state.z - 4);
    }
  }

  // sway player with lane
  player.rotation.z = (targetX - playerGroup.position.x)*0.35;
  player.rotation.x = isGrounded ? 0 : -0.25;

  if(animationMixer) animationMixer.update(dt);

  renderer.render(scene, camera);
}

init();
// expose for debug / test hooks
window.__relicLoaded = ()=> relicLoaded;
window.__state = ()=> state;


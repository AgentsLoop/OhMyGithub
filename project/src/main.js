import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('c');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const timerEl = document.getElementById('timer');
const accuracyEl = document.getElementById('accuracy');
const hitsEl = document.getElementById('hits');
const ammoEl = document.getElementById('ammo');
const reserveEl = document.getElementById('reserve');
const hitmarkerEl = document.getElementById('hitmarker');
const hitfeedEl = document.getElementById('hitfeed');
const reloadBar = document.getElementById('reloadbar');
const reloadFill = document.getElementById('reloadfill');
const overlay = document.getElementById('overlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const resultOverlay = document.getElementById('resultOverlay');
const playBtn = document.getElementById('playBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');

let scene, camera, renderer, composer, bloomPass;
let weaponGroup, weaponMesh, muzzleLight, muzzleFlash, weaponBasePos = new THREE.Vector3(0.32,-0.24,-0.52);
let mixer;
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

let keys = {};
let yaw = 0, pitch = 0;
let isLocked = false, gameActive = false, gameOver = false;
let velocity = new THREE.Vector3();
let position = new THREE.Vector3(0,1.7,14);
let sprint = false;
let isAiming = false, aimProgress = 0, walkTime = 0, swayX = 0, swayY = 0, bobIntensity = 0;
let recoilX = 0, recoilZ = 0;

let ammo = 30, reserve = 90, magSize = 30;
let shots = 0, hits = 0, score = 0, combo = 0, bestCombo = 0, comboTimer = 0;
let timeLeft = 60;
let reloading = false, reloadProgress = 0;
let fireCooldown = 0;
let hitMarkerTimer = 0;

let targets = [];
let particles = [];
let decals = [];
let audioCtx;

const RANGE_DEPTH = 40;
const RANGE_WIDTH = 12;
const RANGE_HEIGHT = 6;

function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
}
function playSound(type){
  if(!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const f = audioCtx.createBiquadFilter();
  o.connect(f); f.connect(g); g.connect(audioCtx.destination);
  if(type==='shoot'){
    o.type='square'; o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(60,t+0.08);
    g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.14);
    f.type='bandpass'; f.frequency.setValueAtTime(1200,t);
    o.start(t); o.stop(t+0.14);
    const n = audioCtx.createBufferSource();
    const buf = audioCtx.createBuffer(1,audioCtx.sampleRate*0.06,audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2)*0.5;
    const ng = audioCtx.createGain(); ng.gain.setValueAtTime(0.18,t); ng.gain.exponentialRampToValueAtTime(0.001,t+0.06);
    const bf = audioCtx.createBiquadFilter(); bf.type='highpass'; bf.frequency.value=800;
    n.buffer=buf; n.connect(bf); bf.connect(ng); ng.connect(audioCtx.destination); n.start(t);
  } else if(type==='hit'){
    o.type='sine'; o.frequency.setValueAtTime(900,t); o.frequency.exponentialRampToValueAtTime(1400,t+0.08);
    g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12); o.start(t); o.stop(t+0.12);
  } else if(type==='hitCrit'){
    o.type='triangle'; o.frequency.setValueAtTime(600,t); o.frequency.linearRampToValueAtTime(1200,t+0.05); o.frequency.exponentialRampToValueAtTime(1800,t+0.15);
    g.gain.setValueAtTime(0.26,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18); o.start(t); o.stop(t+0.18);
  } else if(type==='reload'){
    o.type='sine'; o.frequency.setValueAtTime(300,t); o.frequency.linearRampToValueAtTime(500,t+0.3); g.gain.setValueAtTime(0.12,t); g.gain.linearRampToValueAtTime(0,t+0.3); o.start(t); o.stop(t+0.3);
  } else if(type==='empty'){
    o.type='square'; o.frequency.setValueAtTime(80,t); g.gain.setValueAtTime(0.15,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.12); o.start(t); o.stop(t+0.12);
  }
}

function setupScene(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05080e);
  scene.fog = new THREE.Fog(0x0a121e, 18, 55);

  camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 100);
  camera.position.copy(position);

  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight), 0.28, 0.65, 0.85);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const ambient = new THREE.HemisphereLight(0x8ec8ff, 0x0a0f1a, 0.55);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.15);
  dir.position.set(4,8,3);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=50;
  dir.shadow.camera.left=-20; dir.shadow.camera.right=20; dir.shadow.camera.top=15; dir.shadow.camera.bottom=-15;
  dir.shadow.bias=-0.0005;
  scene.add(dir);

  const fill = new THREE.PointLight(0x00e5ff, 9, 18);
  fill.position.set(0,3,-8);
  scene.add(fill);
  const fill2 = new THREE.PointLight(0xff3b30, 6, 14);
  fill2.position.set(0,1.2,10);
  scene.add(fill2);

  buildRange();
  buildWeaponRig();
  buildTargets();
  buildParticlesPool();
}

function buildRange(){
  const floorMat = new THREE.MeshStandardMaterial({ color:0x1a2330, roughness:0.82, metalness:0.12 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RANGE_WIDTH+4, RANGE_DEPTH+6), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = 0;
  floor.position.z = -RANGE_DEPTH/2 + 12;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(RANGE_DEPTH+6, 40, 0x00e5ff, 0x1a2a3a);
  grid.position.y = 0.02;
  grid.position.z = floor.position.z;
  grid.material.opacity = 0.18; grid.material.transparent = true;
  scene.add(grid);

  const laneMat = new THREE.MeshStandardMaterial({ color:0x0e1a28, roughness:0.6, metalness:0.2 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, RANGE_DEPTH), laneMat);
  lane.rotation.x = -Math.PI/2;
  lane.position.set(0,0.03, floor.position.z);
  lane.receiveShadow = true;
  scene.add(lane);

  const centerLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, RANGE_DEPTH), new THREE.MeshStandardMaterial({ color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:1.2 }));
  centerLine.rotation.x = -Math.PI/2;
  centerLine.position.set(0,0.04, floor.position.z);
  scene.add(centerLine);

  const wallMat = new THREE.MeshStandardMaterial({ color:0x0f1a26, roughness:0.75, metalness:0.15 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, RANGE_HEIGHT, RANGE_DEPTH+6), wallMat);
  leftWall.position.set(-RANGE_WIDTH/2-0.3, RANGE_HEIGHT/2, floor.position.z);
  leftWall.castShadow=true; leftWall.receiveShadow=true;
  scene.add(leftWall);
  const rightWall = leftWall.clone(); rightWall.position.x = RANGE_WIDTH/2+0.3; scene.add(rightWall);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(RANGE_WIDTH+1.2, RANGE_HEIGHT, 0.6), wallMat);
  backWall.position.set(0,RANGE_HEIGHT/2, -RANGE_DEPTH + 12 + 0.3);
  scene.add(backWall);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(RANGE_WIDTH+1.2, 0.4, RANGE_DEPTH+6), new THREE.MeshStandardMaterial({ color:0x0a1420, roughness:0.9 }));
  ceiling.position.set(0,RANGE_HEIGHT, floor.position.z);
  scene.add(ceiling);

  for(let i=0;i<5;i++){
    const z = 8 - i*8;
    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(RANGE_WIDTH-1,0.09,0.42), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffffff, emissiveIntensity:0.85 }));
    lightBar.position.set(0,RANGE_HEIGHT-0.25,z);
    scene.add(lightBar);
    const pl = new THREE.PointLight(0xffffff, 2.2, 10);
    pl.position.set(0,RANGE_HEIGHT-0.6,z);
    scene.add(pl);
  }

  for(let side of [-1,1]){
    for(let i=0;i<8;i++){
      const z = 12 - i*5;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08,2.2,0.08), new THREE.MeshStandardMaterial({ color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:1.6 }));
      strip.position.set(side*(RANGE_WIDTH/2+0.05), 2.2, z);
      scene.add(strip);
      const glow = new THREE.PointLight(0x00e5ff, 2.2, 3.2);
      glow.position.copy(strip.position);
      scene.add(glow);
    }
  }

  for(let i=0;i<12;i++){
    const x = -RANGE_WIDTH/2 + 1 + (i%6)*1.9;
    const z = -RANGE_DEPTH + 13 + Math.floor(i/6)*0.35;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4,2.0,0.04), new THREE.MeshStandardMaterial({ color:0x12202f, roughness:0.5, metalness:0.4 }));
    panel.position.set(x,1.6,z);
    scene.add(panel);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.7), new THREE.MeshStandardMaterial({ color:0x0a1624, emissive:0x00e5ff, emissiveIntensity:0.15 }));
    inner.position.set(x,1.6,z+0.03);
    scene.add(inner);
  }

  const barrierGeo = new THREE.BoxGeometry(1.8,0.9,0.6);
  const barrierMat = new THREE.MeshStandardMaterial({ color:0x1b2a3a, roughness:0.7, metalness:0.25 });
  const barrier = new THREE.Mesh(barrierGeo, barrierMat);
  barrier.position.set(0,0.45,10.5);
  barrier.castShadow=true; barrier.receiveShadow=true;
  scene.add(barrier);
  const barrierTop = new THREE.Mesh(new THREE.BoxGeometry(1.85,0.06,0.62), new THREE.MeshStandardMaterial({ color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:1.0 }));
  barrierTop.position.set(0,0.9,10.5);
  scene.add(barrierTop);

  const hazeGeo = new THREE.PlaneGeometry(RANGE_WIDTH, RANGE_HEIGHT);
  const hazeMat = new THREE.MeshBasicMaterial({ color:0x00e5ff, transparent:true, opacity:0.03, side:THREE.DoubleSide });
  const haze = new THREE.Mesh(hazeGeo, hazeMat);
  haze.position.set(0,3,-8);
  scene.add(haze);
}

function buildWeaponRig(){
  weaponGroup = new THREE.Group();
  camera.add(weaponGroup);
  scene.add(camera);

  muzzleLight = new THREE.PointLight(0xffcc66, 0, 6);
  muzzleLight.position.set(0.32,-0.18,-1.4);
  weaponGroup.add(muzzleLight);

  muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.32,8), new THREE.MeshBasicMaterial({ color:0xfff2a0, transparent:true, opacity:0 }));
  muzzleFlash.rotation.x = Math.PI/2;
  muzzleFlash.position.set(0.32,-0.18,-1.55);
  weaponGroup.add(muzzleFlash);

  const procGroup = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color:0x18202a, roughness:0.45, metalness:0.65 });
  const accentMat = new THREE.MeshStandardMaterial({ color:0x0e1824, roughness:0.6, metalness:0.4 });
  const emitMat = new THREE.MeshStandardMaterial({ color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:2.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.1,0.62), bodyMat); body.position.set(0,0,0); procGroup.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.06,0.48), accentMat); top.position.set(0,0.07,0.02); procGroup.add(top);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.55,12), bodyMat); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.42); procGroup.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.12), new THREE.MeshStandardMaterial({color:0x111a22, roughness:0.4, metalness:0.7})); sight.position.set(0,0.12,0.05); procGroup.add(sight);
  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(0.015,0.015,0.35), emitMat); glowStrip.position.set(0.055,0.02,-0.05); procGroup.add(glowStrip);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.08), accentMat); grip.position.set(0,-0.12,0.12); grip.rotation.x=0.3; procGroup.add(grip);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,0.09), new THREE.MeshStandardMaterial({color:0x0f1a26, roughness:0.5, metalness:0.5})); mag.position.set(0,-0.12,0.08); procGroup.add(mag);
  procGroup.position.copy(weaponBasePos);
  procGroup.rotation.set(0,0.06,0);
  weaponGroup.add(procGroup);
  weaponMesh = procGroup;
  weaponMesh.visible = true;

  loader.load('/models/weapon.glb', (gltf)=>{
    const m = gltf.scene;
    m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; if(o.material){ o.material.envMapIntensity=0.8; } } });
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x,size.y,size.z);
    const s = 0.55 / maxDim;
    m.scale.set(s,s,s);
    box.setFromObject(m);
    const center = box.getCenter(new THREE.Vector3());
    m.position.sub(center);
    m.position.add(new THREE.Vector3(0.32,-0.22,-0.62));
    m.rotation.set(0,Math.PI,0);
    m.rotation.y += 0.08;
    weaponMesh.visible = false;
    weaponGroup.add(m);
    weaponMesh = m;
  }, undefined, ()=>{});
}

function buildTargets(){
  const discGeo = new THREE.CylinderGeometry(0.42,0.42,0.04,32);
  const createDisc = (x,y,z, isMoving, id)=>{
    const col = id%2===0 ? 0x00e5ff : 0xff3b30;
    const mat = new THREE.MeshStandardMaterial({ color:0xf0f6ff, roughness:0.5, metalness:0.2, emissive:col, emissiveIntensity:0.18 });
    const mesh = new THREE.Mesh(discGeo, mat);
    mesh.rotation.x = Math.PI/2;
    mesh.castShadow=true; mesh.receiveShadow=true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42,0.015,12,32), new THREE.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:2 }));
    ring.rotation.x = Math.PI/2; ring.position.z=0.02;
    mesh.add(ring);
    const centerDot = new THREE.Mesh(new THREE.CircleGeometry(0.12,24), new THREE.MeshStandardMaterial({ color:col, emissive:col, emissiveIntensity:1.5 }));
    centerDot.position.z=0.021; centerDot.rotation.z=0;
    mesh.add(centerDot);
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.18,0.22,32), new THREE.MeshStandardMaterial({ color:0x111a22, side:THREE.DoubleSide })); inner.position.z=0.022; mesh.add(inner);
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.32,0.34,32), new THREE.MeshStandardMaterial({ color:0x111a22, side:THREE.DoubleSide })); outer.position.z=0.022; mesh.add(outer);
    const group = new THREE.Group();
    group.position.set(x,y,z);
    group.add(mesh);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02, y,8), new THREE.MeshStandardMaterial({ color:0x2a3a4a })); stand.position.set(0,-y/2,0); group.add(stand);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,0.5), new THREE.MeshStandardMaterial({ color:0x1a2533 })); base.position.set(0,-y,0); group.add(base);
    scene.add(group);
    const collider = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,0.06,16), new THREE.MeshBasicMaterial({ visible:false }));
    collider.rotation.x=Math.PI/2; group.add(collider);
    const t = { group, mesh, collider, x, y, z, baseY:y, isMoving, speed: isMoving? (0.9+Math.random()*0.7):0, dir: Math.random()>0.5?1:-1, fallen:false, fallTime:0, id, type:'disc', color:col, hitFlash:0, wobble:0 };
    targets.push(t);
    if(isMoving){ t.range=3.2; t.originX=x; }
    return t;
  };

  const dummyPositions = [
    [-3.8,1.0,-2],[ -1.9,1.0,-6],[ 1.9,1.0,-6],[3.8,1.0,-2],
    [0,1.15,-12]
  ];

  const spawnDummy = (pos, idx)=>{
    const g = new THREE.Group();
    g.position.set(pos[0],0,pos[2]);

    const tryLoad = ()=>{
      loader.load('/models/scifi-target.glb', (gltf)=>{
        const m = gltf.scene.clone();
        m.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material && o.material.emissive) o.material.emissiveIntensity=0.25; } });
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const s = 1.35 / Math.max(size.x,size.y,size.z);
        m.scale.set(s,s,s);
        box.setFromObject(m);
        const c = box.getCenter(new THREE.Vector3());
        m.position.sub(c); m.position.y += 0.9;
        g.add(m);
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.5,0.35), new THREE.MeshBasicMaterial({visible:false})); col.position.y=0.9; g.add(col);
        targets.push({ group:g, mesh:m, collider:col, x:pos[0], y:pos[1], z:pos[2], baseY:pos[1], fallen:false, fallTime:0, id:'d'+idx, type:'dummy', color:0x00e5ff, hitFlash:0, wobble:0, isMoving:false });
      }, undefined, ()=>{ fallback(); });
    };
    const fallback = ()=>{
      const bodyMat = new THREE.MeshStandardMaterial({ color:0xd9e6f0, roughness:0.6, metalness:0.1 });
      const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.18,0.22,8,12), bodyMat); head.position.y=1.35; g.add(head);
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24,0.55,8,12), bodyMat); torso.position.y=0.85; g.add(torso);
      const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.08), new THREE.MeshStandardMaterial({ color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:2 })); visor.position.set(0,1.38,0.17); visor.rotation.x=-0.1; g.add(visor);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.32,0.38,0.06), new THREE.MeshStandardMaterial({ color:0x0e1a28, emissive:0xff3b30, emissiveIntensity:0.6 })); plate.position.set(0,0.9,0.22); g.add(plate);
      const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.4,8,8), bodyMat); armL.position.set(-0.32,0.85,0); armL.rotation.z=0.2; g.add(armL);
      const armR = armL.clone(); armR.position.x=0.32; armR.rotation.z=-0.2; g.add(armR);
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.5,0.4), new THREE.MeshBasicMaterial({visible:false})); col.position.y=0.9; g.add(col);
      targets.push({ group:g, mesh:g, collider:col, x:pos[0], y:pos[1], z:pos[2], baseY:pos[1], fallen:false, fallTime:0, id:'d'+idx, type:'dummy', color:0x00e5ff, hitFlash:0, wobble:0, isMoving:false });
    };
    scene.add(g);
    tryLoad();
  };
  dummyPositions.forEach((p,i)=> spawnDummy(p,i));

  createDisc(-2.8,1.1,2, false, 0);
  createDisc(2.8,1.1,2, false, 1);
  createDisc(-4.0,1.25,-10, true, 2);
  createDisc(4.0,1.25,-10, true, 3);
  createDisc(0,1.4,-16, false, 4);
  createDisc(-1.6,1.0,6, false, 5);
  createDisc(1.6,1.0,6, false, 6);

  loader.load('/models/range-target.glb', (gltf)=>{
    // decorative static on back wall, not interactive
    const deco = gltf.scene; deco.position.set(0,1.1,-27.2); deco.scale.set(0.9,0.9,0.9); deco.rotation.y=Math.PI; scene.add(deco);
  }, undefined, ()=>{});
}

let particlePool = [];
function buildParticlesPool(){
  for(let i=0;i<120;i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0xffcc66, emissiveIntensity:1.5 }));
    m.visible=false; m.castShadow=false; scene.add(m);
    particlePool.push({ mesh:m, vel:new THREE.Vector3(), life:0 });
  }
}
function spawnParticles(pos, color, count=14, power=1){
  let spawned=0;
  for(let p of particlePool){
    if(p.life<=0 && spawned<count){
      p.mesh.position.copy(pos);
      p.mesh.visible=true;
      p.mesh.material.color.set(color);
      p.mesh.material.emissive.set(color);
      p.vel.set((Math.random()-0.5)*6*power, Math.random()*5*power+1, (Math.random()-0.5)*6*power);
      p.life=0.45+Math.random()*0.35;
      p.mesh.scale.setScalar(0.8+Math.random()*0.7);
      spawned++;
    }
  }
}
function spawnHitDecal(pos, normal){
  const decal = new THREE.Mesh(new THREE.CircleGeometry(0.055,12), new THREE.MeshBasicMaterial({ color:0x111111, transparent:true, opacity:0.9 }));
  decal.position.copy(pos).add(normal.clone().multiplyScalar(0.02));
  decal.lookAt(pos.clone().add(normal));
  scene.add(decal);
  decals.push({ mesh:decal, life:6 });
}

function updateTargets(dt){
  for(let t of targets){
    if(t.isMoving && !t.fallen){
      t.group.position.x += t.dir * t.speed * dt;
      if(Math.abs(t.group.position.x - t.originX) > t.range) t.dir *= -1;
    }
    if(t.fallen){
      t.fallTime += dt;
      const prog = Math.min(t.fallTime/0.28,1);
      const eased = 1 - Math.pow(1-prog,3);
      if(t.type==='disc'){
        t.mesh.rotation.z = eased * Math.PI/2 * (t.id%2===0?1:-1);
        t.mesh.position.z = eased * -0.12;
      } else {
        t.group.rotation.x = eased * Math.PI/2.2;
        t.group.position.y = -eased * 0.35;
      }
      if(t.fallTime > 1.6){
        t.fallen=false; t.fallTime=0;
        t.group.rotation.x=0; t.group.rotation.z=0; t.group.position.y=0;
        if(t.type==='disc'){ t.mesh.rotation.z=0; t.mesh.position.z=0; }
        t.mesh.traverse?.(o=>{ if(o.isMesh && o.material) {o.material.opacity=1;}});
        t.hitFlash=0;
      }
    }
    if(t.hitFlash>0){
      t.hitFlash -= dt*4;
      const intensity = Math.max(0,t.hitFlash);
      if(t.type==='disc'){
        t.mesh.material.emissiveIntensity = 0.18 + intensity*3;
        t.mesh.material.color.setHSL(0.55,1,0.5+intensity*0.2);
      }
    }
    if(t.wobble>0){
      t.wobble -= dt*6;
      const w = Math.max(0,t.wobble);
      t.group.rotation.z = Math.sin(Date.now()*0.02)* w *0.12;
    }
  }
}

function updateParticles(dt){
  for(let p of particlePool){
    if(p.life>0){
      p.life -= dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.vel.y -= 9.8*dt; p.vel.multiplyScalar(0.985);
      p.mesh.material.opacity = Math.max(0, p.life/0.5);
      p.mesh.scale.multiplyScalar(0.992);
      if(p.life<=0) p.mesh.visible=false;
    }
  }
  for(let d of decals){
    d.life -= dt;
    if(d.life<=0){ scene.remove(d.mesh); }
  }
  decals = decals.filter(d=>d.life>0);
}

function shoot(){
  if(!gameActive || reloading || ammo<=0) { if(ammo<=0 && !reloading) {playSound('empty'); triggerReload();} return; }
  if(fireCooldown>0) return;
  fireCooldown = 0.095;
  ammo--; shots++;
  updateHud();
  playSound('shoot');
  initAudio();

  recoilZ = 0.18; recoilX = -0.07 - Math.random()*0.03;
  if(isAiming){ recoilZ*=0.55; recoilX*=0.6; }

  muzzleLight.intensity = 14; muzzleFlash.material.opacity=1;
  muzzleFlash.scale.set(1,1,1);
  setTimeout(()=>{ muzzleFlash.material.opacity=0; muzzleLight.intensity=0; }, 55);

  const spread = 0.002;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.normalize();
  raycaster.set(camera.position, dir);
  scene.updateMatrixWorld();
  const colliders = targets.filter(t=>!t.fallen && t.collider).map(t=>t.collider);
  const hitsArr = raycaster.intersectObjects(colliders, false);
  let hitFound=false; let hitPoint=null; let hitDist=18;
  if(hitsArr.length>0){
    const hitObj = hitsArr[0];
    const target = targets.find(t=>t.collider===hitObj.object);
    if(target){
      hitFound=true; hitPoint=hitObj.point.clone(); hitDist=hitObj.distance; hits++;
      const isCenter = Math.random()>0.35;
      const pts = isCenter ? 150 : 100;
      const mult = Math.min(4, 1 + combo*0.2);
      const add = Math.round(pts*mult);
      score += add; combo++; bestCombo=Math.max(bestCombo,combo); comboTimer=2.2;
      target.fallen=true; target.fallTime=0; target.hitFlash=1; target.wobble=1;
      playSound(isCenter?'hitCrit':'hit');
      spawnParticles(hitObj.point, isCenter?0xffcc00:0x00e5ff, isCenter?22:14, 1.1);
      const n = hitObj.face ? hitObj.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hitObj.object.matrixWorld)).normalize() : new THREE.Vector3(0,0,1);
      spawnHitDecal(hitObj.point, n);
      showHitMarker(isCenter); pushFeed(isCenter?`CENTER +${add}`:`HIT +${add}`, isCenter);
    }
  }
  if(!hitFound){
    if(combo>0) combo=Math.max(0, combo-1);
    const wallHits = raycaster.intersectObjects(scene.children, true);
    for(let h of wallHits){
      if(!h.object.visible) continue;
      if(h.object.parent===weaponGroup || h.object===muzzleFlash) continue;
      if(particlePool.some(p=>p.mesh===h.object)) continue;
      if(h.distance>0.6 && h.distance<60 && h.face){
        const n = h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();
        spawnHitDecal(h.point, n); spawnParticles(h.point, 0x8aa0b8, 5, 0.5); break;
      }
    }
  }
  updateHud();
  if(ammo===0) setTimeout(()=>triggerReload(), 180);
  const start = camera.position.clone().add(dir.clone().multiplyScalar(0.55));
  const end = hitFound ? hitPoint : start.clone().add(dir.clone().multiplyScalar(Math.min(hitDist,22)));
  const lineGeo = new THREE.BufferGeometry().setFromPoints([start,end]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color:0xfff6a0, transparent:true, opacity:0.9 }));
  scene.add(line);
  setTimeout(()=>scene.remove(line), 52);
}
function showHitMarker(crit){
  hitmarkerEl.classList.add('show');
  hitmarkerEl.style.color = crit?'#ffb400':'#fff';
  hitMarkerTimer=0.18;
}
function pushFeed(text, crit){
  const el=document.createElement('div'); el.className='feed-item'+(crit?' crit':''); el.textContent=text; hitfeedEl.prepend(el); setTimeout(()=>el.remove(), 950);
}
function triggerReload(){
  if(reloading || ammo===magSize || reserve<=0) return;
  reloading=true; reloadProgress=0; reloadBar.classList.add('active'); playSound('reload');
  weaponGroup.position.y -= 0.06;
}
function updateReload(dt){
  if(!reloading) return;
  reloadProgress += dt/1.15;
  reloadFill.style.width = (reloadProgress*100)+'%';
  weaponGroup.rotation.z = Math.sin(reloadProgress*Math.PI)*0.07;
  if(reloadProgress>=1){
    const need = magSize - ammo;
    const take = Math.min(need, reserve);
    ammo += take; reserve -= take;
    reloading=false; reloadBar.classList.remove('active'); reloadFill.style.width='0%';
    weaponGroup.position.y +=0.06; weaponGroup.rotation.z=0;
    updateHud();
  }
}
function updateHud(){
  scoreEl.textContent = String(score).padStart(5,'0');
  comboEl.textContent = combo>1 ? `COMBO x${(1+combo*0.2).toFixed(1)}  •  ${combo} STREAK` : `COMBO x1`;
  comboEl.style.color = combo>3 ? '#ffb400' : '#7fb0c8';
  ammoEl.textContent = ammo; reserveEl.textContent = reserve;
  ammoEl.style.color = ammo===0 ? '#ff3b30' : ammo<8 ? '#ffb400' : '#fff';
  const acc = shots? Math.round(hits/shots*100):0;
  accuracyEl.textContent = shots? acc+'%':'--%';
  hitsEl.textContent = `${hits} HITS / ${shots} SHOTS`;
}

function onKey(e, down){
  keys[e.code]=down;
  if(down && e.code==='KeyR') triggerReload();
  if(down && (e.code==='Digit1' || e.code==='Digit2')) {}
}
function updateControls(dt){
  if(!isLocked || !gameActive) return;
  const speed = sprint ? 5.2 : 3.2;
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw));
  fwd.y=0; fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0,1,0)).negate();
  let mv = new THREE.Vector3();
  if(keys['KeyW']) mv.add(fwd);
  if(keys['KeyS']) mv.sub(fwd);
  if(keys['KeyA']) mv.sub(right);
  if(keys['KeyD']) mv.add(right);
  const moving = mv.length()>0;
  if(moving){ mv.normalize().multiplyScalar(speed*dt); position.add(mv); bobIntensity = Math.min(1, bobIntensity + dt*5); walkTime += dt * (sprint? 14:9) * (isAiming?0.4:1); }
  else { bobIntensity = Math.max(0, bobIntensity - dt*3); walkTime += dt*1.5; }
  position.x = Math.max(-RANGE_WIDTH/2+0.6, Math.min(RANGE_WIDTH/2-0.6, position.x));
  position.z = Math.max(-RANGE_DEPTH+14, Math.min(13.5, position.z));
  position.y = 1.7 + Math.sin(Date.now()*0.0025)*0.015;
  camera.position.copy(position);
  camera.rotation.order='YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  if(fireCooldown>0) fireCooldown-=dt;
  if(hitMarkerTimer>0){ hitMarkerTimer-=dt; if(hitMarkerTimer<=0) hitmarkerEl.classList.remove('show'); }
  if(combo>0){ comboTimer-=dt; if(comboTimer<=0) combo=0; }
  updateReload(dt);
  swayX += (0 - swayX)*dt*8; swayY += (0 - swayY)*dt*8;
  recoilZ += (0 - recoilZ)*dt*14; recoilX += (0 - recoilX)*dt*14;
  const bobX = Math.sin(walkTime)*0.018*bobIntensity*(isAiming?0.18:1);
  const bobY = Math.abs(Math.sin(walkTime*0.5))*0.014*bobIntensity*(isAiming?0.2:1) + Math.sin(walkTime*2)*0.004*bobIntensity;
  const aimT = aimProgress;
  const targetFov = isAiming ? 58 : 74;
  camera.fov += (targetFov - camera.fov)*dt*9; camera.updateProjectionMatrix();
  const crosshairEl = document.getElementById('crosshair');
  if(crosshairEl) crosshairEl.style.opacity = isAiming ? '0.22' : '1';
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  if(gameActive && !gameOver){
    timeLeft -= dt;
    if(timeLeft<=0){ timeLeft=0; endGame(); }
    timerEl.textContent = timeLeft.toFixed(1);
    timerEl.style.color = timeLeft<10 ? '#ff3b30' : '#fff';
    updateTargets(dt);
  }
  updateControls(dt);
  updateWeaponPose(dt);
  updateParticles(dt);
  composer.render();
}

function updateWeaponPose(dt){
  if(!weaponGroup) return;
  aimProgress += ((isAiming?1:0) - aimProgress)*dt*10;
  const aimPos = new THREE.Vector3(0.02,-0.18,-0.38);
  const hipPos = weaponBasePos;
  const curPos = new THREE.Vector3().lerpVectors(hipPos, aimPos, aimProgress);
  const bobX = Math.sin(walkTime)*0.018*bobIntensity*(isAiming?0.18:1);
  const bobY = Math.abs(Math.sin(walkTime*0.5))*0.014*bobIntensity*(isAiming?0.2:1);
  curPos.x += bobX + swayX*0.35 + (Math.random()-0.5)*0.002;
  curPos.y += bobY + swayY*0.25;
  curPos.z += recoilZ;
  weaponGroup.position.lerp(curPos, dt*18);
  const targetRotX = recoilX + bobY*0.8;
  const targetRotY = swayX*0.35 + bobX*0.9;
  const targetRotZ = Math.sin(walkTime)*0.025*bobIntensity*(isAiming?0.15:1) + swayX*0.18;
  weaponGroup.rotation.x += (targetRotX - weaponGroup.rotation.x)*dt*14;
  weaponGroup.rotation.y += (targetRotY - weaponGroup.rotation.y)*dt*14;
  weaponGroup.rotation.z += (targetRotZ - weaponGroup.rotation.z)*dt*12;
}

function startGame(){
  score=0; hits=0; shots=0; combo=0; bestCombo=0; ammo=30; reserve=90; timeLeft=60; gameOver=false; gameActive=true;
  position.set(0,1.7,11); yaw=0; pitch=0.02;
  for(let t of targets){ t.fallen=false; t.fallTime=0; t.group.rotation.set(0,0,0); t.group.position.y=0; if(t.type==='disc'){t.mesh.rotation.z=0; t.mesh.position.z=0;}}
  updateHud(); timerEl.textContent='60.0';
  resultOverlay.classList.add('hidden'); pauseOverlay.classList.add('hidden'); overlay.classList.add('hidden');
  clock.getDelta();
}

function endGame(){
  gameOver=true; gameActive=false;
  document.exitPointerLock?.();
  const acc = shots? Math.round(hits/shots*100):0;
  document.getElementById('finalScore').textContent = String(score).padStart(5,'0');
  document.getElementById('finalHits').textContent = `${hits}/${shots}`;
  document.getElementById('finalAcc').textContent = acc+'%';
  document.getElementById('finalCombo').textContent = 'x'+bestCombo;
  let rank='RECRUIT'; if(score>1800) rank='ELITE'; else if(score>1200) rank='VETERAN'; else if(score>700) rank='OPERATOR'; else if(score>350) rank='MARKSMAN';
  document.getElementById('finalRank').textContent = rank;
  resultOverlay.classList.remove('hidden');
}

function setupEvents(){
  addEventListener('keydown', e=>onKey(e,true));
  addEventListener('keyup', e=>onKey(e,false));
  addEventListener('keydown', e=>{ if(e.code==='ShiftLeft') sprint=true; if(e.code==='Escape' && isLocked) pauseOverlay.classList.remove('hidden'); });
  addEventListener('keyup', e=>{ if(e.code==='ShiftLeft') sprint=false; });
  addEventListener('mousedown', e=>{
    if(e.button===0 && isLocked && gameActive) shoot();
  });
  addEventListener('mousemove', e=>{
    if(!isLocked) return;
    const sens = isAiming?0.0011:0.0022;
    yaw -= e.movementX * sens;
    pitch -= e.movementY * sens;
    pitch = Math.max(-1.25, Math.min(1.25, pitch));
    swayX += e.movementX*0.00012;
    swayY -= e.movementY*0.00011;
    swayX = Math.max(-0.06, Math.min(0.06, swayX));
    swayY = Math.max(-0.05, Math.min(0.05, swayY));
  });
  addEventListener('mousedown', e=>{ if(e.button===2 && isLocked) isAiming=true; });
  addEventListener('mouseup', e=>{ if(e.button===2) isAiming=false; });
  canvas.addEventListener('contextmenu', e=> e.preventDefault());
  document.addEventListener('pointerlockchange', ()=>{
    isLocked = document.pointerLockElement===canvas;
    if(isLocked){ initAudio(); if(!gameActive && !gameOver) startGame(); else if(pauseOverlay.classList.contains('hidden')===false) pauseOverlay.classList.add('hidden'); }
  });
  canvas.addEventListener('click', ()=>{
    if(!isLocked && !gameOver) canvas.requestPointerLock();
    else if(!isLocked && gameOver) canvas.requestPointerLock();
  });
  playBtn.addEventListener('click', ()=>{ canvas.requestPointerLock(); });
  resumeBtn.addEventListener('click', ()=>{ pauseOverlay.classList.add('hidden'); canvas.requestPointerLock(); });
  restartBtn.addEventListener('click', ()=>{ resultOverlay.classList.add('hidden'); canvas.requestPointerLock(); setTimeout(()=>startGame(),120); });
  addEventListener('resize', ()=>{
    camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth,innerHeight);
  });
}

setupScene();
setupEvents();
updateHud();
animate();

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('canvas');
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const coinsEl = document.getElementById('coins');
const timerEl = document.getElementById('timer');
const fpsEl = document.getElementById('fps');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('playBtn');

const scene = new THREE.Scene();
// Crossy Road palette: saturated warm desert — hard voxel readability, no beige wash
scene.background = new THREE.Color(0xF2C97D);
// Fog pushed far (was 95-260 washing mid-dunes + grain). Reduced to light depth cue 175-385 so terraces stay saturated.
scene.fog = new THREE.Fog(0xF2C97D, 175, 385);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
// Crossy Road bar: ultra-crisp hard voxel shadows, no ACES washout
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 500);
let camTarget = new THREE.Vector3(0,0,0);

// — neutral PMREM envMap for car PBR — fixes charcoal 24,21,16 vs lime 80,156,99 flat
// Uses Three.js RoomEnvironment (PMREMGenerator) as neutral Studio IBL: no HDRI fetch,
// no ground wash, ~22ms once. Assigned to scene.environment + per-material envMapIntensity.
let envMap = null;
let pmrem = null;
{
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const roomEnv = new RoomEnvironment();
  // 0.04 blur keeps reflections crisp for low-poly facets; RoomEnvironment is already neutral white
  const rt = pmrem.fromScene(roomEnv, 0.04);
  envMap = rt.texture;
  scene.environment = envMap;
  // keep desert background, not envMap
  scene.background = new THREE.Color(0xF2C97D);
  // ground stays warm matte — very low env so terraces keep baked AO contrast
  // (will be re-applied after groundMat creation if not yet defined)
  roomEnv.dispose?.();
}

function resize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// lights — Crossy Road crisp voxel lighting: hard sun + rim for car facet gloss
const hemi = new THREE.HemisphereLight(0xFFF6D6, 0xE8A85C, 0.75);
hemi.position.set(0, 40, 0);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xFFF4E0, 2.35);
dir.position.set(45, 55, 35);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
// Tightened frustum for hard voxel readability at 9 m chase distance:
// ±96 → ±48 halves texel size 0.094 → 0.047 u/texel (21.3 texel/m)
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 185;
dir.shadow.camera.left=-48; dir.shadow.camera.right=48; dir.shadow.camera.top=48; dir.shadow.camera.bottom=-48;
dir.shadow.camera.updateProjectionMatrix();
dir.shadow.bias = -0.0008;
dir.shadow.normalBias = 0.012;
scene.add(dir);
// rim light — thumbnail facet highlight for lime Carcamero (boosted for rear-chase readability)
const rim = new THREE.DirectionalLight(0xFFF8E0, 1.65);
rim.position.set(-30, 18, -20);
scene.add(rim);
// fill for rear-chase — defeats self-shadow charcoal at 9m without washing terraces
const carFill = new THREE.DirectionalLight(0xFFF6D6, 0.85);
carFill.position.set(0, 12, -22);
scene.add(carFill);
scene.add(new THREE.AmbientLight(0xFFF0C8, 0.18));

// ground — HARD-QUANTIZED VOXEL TERRACES (Crossy Road readability fix)
// Iter3: tightened AO 0.65-1.18 (was 0.78-1.06 too subtle at 9 m chase) + hard 1.05 m
// step outline via vertex contour so bands stay legible under fog 175-385.
const groundGeo = new THREE.PlaneGeometry(400,400, 100,100);
{
  const p = groundGeo.attributes.position;
  const cols = [];
  // 5-band saturated voxel palette — trough deep terracotta, crest sunlit cream (not washed white)
  const PALETTE = [
    new THREE.Color(0xB85C1E), // 0 trough — deep burnt terracotta (AO darkest)
    new THREE.Color(0xD9822B), // 1 low — saturated burnt sand
    new THREE.Color(0xE9A845), // 2 mid — warm gold (high chroma)
    new THREE.Color(0xF2C97D), // 3 high — background sand, saturated
    new THREE.Color(0xFFEB9A), // 4 crest — sunlit cream, high sat (was FFECC1/white wash)
  ];
  // AO widened 0.65-1.18 (was 0.78-1.06): trough 35% darker, crest 18% brighter —
  // restores Crossy Road band separation at chase-cam distance without touching fog.
  const AO = [0.65, 0.80, 0.97, 1.08, 1.18];
  const VOXEL_STEP = 1.05; // ~1m discrete jump (was 0.33) — Crossy Road legible bands
  const LEVELS = 5;
  const SEG = 100;
  const W = SEG + 1;
  const qs = new Int8Array(p.count);
  const hs = new Float32Array(p.count);
  for(let i=0;i<p.count;i++){
    const x = p.getX(i);
    const y = p.getY(i);
    const dist = Math.hypot(x,y);
    // same dune field as before for silhouette continuity
    const d1 = Math.sin(x*0.055) * Math.cos(y*0.055) * 1.65;
    const d2 = Math.sin(x*0.12 + y*0.08) * 0.55;
    const d3 = Math.cos(x*0.03 - y*0.04) * 0.95;
    const d4 = Math.sin(x*0.018 - y*0.022) * 0.45;
    const mask = THREE.MathUtils.clamp((dist - 28)/95, 0, 1);
    let raw = (d1+d2+d3+d4) * THREE.MathUtils.lerp(0.32, 1.0, mask);
    if(dist < 22){
      // Crossy spawn fix: raw*=0.22 flattened dist<22 to single band (variance 0 beige). Keep mostly flat for drivability but inject micro-terrace noise so 2-3 bands (2/3) survive for contrast.
      const t = dist / 22;
      const micro = Math.sin(x*0.62)*Math.cos(y*0.58)*0.62 + Math.sin(x*0.88 - y*0.72)*0.34;
      raw = raw * THREE.MathUtils.lerp(0.22, 0.42, t) + micro * THREE.MathUtils.lerp(0.72, 0.28, t);
    }
    // hard quantize to discrete voxel levels — no lerp, no 0.33 rounding
    let q = Math.floor(THREE.MathUtils.clamp((raw + 2.2)/VOXEL_STEP, 0, LEVELS - 0.001));
    // height centered so band 2 (~0) is near ground plane
    const h = q * VOXEL_STEP - 2.2 + 0.42; // +0.42 offsets so playable disc sits ~0.0-0.4
    p.setZ(i, h);
    qs[i] = q;
    hs[i] = h;
    // vertex color = palette[q] * AO, minimal hue wobble to preserve band legibility (was ±0.015 HSL, now ±0.006)
    const c = PALETTE[q].clone();
    c.multiplyScalar(AO[q]);
    c.offsetHSL((Math.sin(x*0.018)+Math.cos(y*0.018))*0.006, 0, 0);
    // clamp after multiply (crest 1.18 may exceed 1)
    c.r = Math.min(1, c.r); c.g = Math.min(1, c.g); c.b = Math.min(1, c.b);
    cols.push(c.r,c.g,c.b);
  }
  // — hard step outline / vertex contour —
  // At 9 m chase cam, 1.05 m bands collapse without an explicit seam. Darken
  // any vertex adjacent (4-neighbour + diagonal) to a different quantized level
  // toward deep umber 0x3D1F0A. Vertex-based (no extra geometry) so it survives
  // fog 175-385 and keeps ground matte (env 0.12 unchanged). Mix 42% → ~1 px seam.
  const OUTLINE = new THREE.Color(0x3D1F0A);
  const EDGE_MIX = 0.42;
  for(let i=0;i<p.count;i++){
    const r = Math.floor(i / W);
    const cc = i % W;
    const q = qs[i];
    let isEdge = false;
    if(r>0 && qs[i - W] !== q) isEdge = true;
    if(r<SEG && qs[i + W] !== q) isEdge = true;
    if(cc>0 && qs[i - 1] !== q) isEdge = true;
    if(cc<SEG && qs[i + 1] !== q) isEdge = true;
    if(!isEdge){
      if(r>0 && cc>0 && qs[i - W - 1] !== q) isEdge = true;
      if(r>0 && cc<SEG && qs[i - W + 1] !== q) isEdge = true;
      if(r<SEG && cc>0 && qs[i + W - 1] !== q) isEdge = true;
      if(r<SEG && cc<SEG && qs[i + W + 1] !== q) isEdge = true;
    }
    if(isEdge){
      const idx = i*3;
      const cur = new THREE.Color(cols[idx], cols[idx+1], cols[idx+2]);
      cur.lerp(OUTLINE, EDGE_MIX);
      if(q <= 1) cur.multiplyScalar(0.94);
      cols[idx]=cur.r; cols[idx+1]=cur.g; cols[idx+2]=cur.b;
    }
  }
  groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols,3));
  groundGeo.computeVertexNormals();
}
const groundMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, metalness:0.0 });
if (envMap) { groundMat.envMap = envMap; groundMat.envMapIntensity = 0.12; } // keep terraces matte, no wash
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);
// NOTE: grainTex removed — canvas sand grain was invisible under vertexColors + Fog 95-260
// and contributed to beige soup (washed multiply). Deleted to keep terraces crisp.
// Fog pushed 95->175 / 260->385 above so bands stay saturated; AO now baked per step.

// decorative dunes — sampled voxel ground height (must match hard quantization above)
function sampleGroundH(x,z){
  const dist=Math.hypot(x,z);
  const d1=Math.sin(x*0.055)*Math.cos(z*0.055)*1.65;
  const d2=Math.sin(x*0.12+z*0.08)*0.55;
  const d3=Math.cos(x*0.03-z*0.04)*0.95;
  const d4=Math.sin(x*0.018-z*0.022)*0.45;
  const mask=THREE.MathUtils.clamp((dist-28)/95,0,1);
  let raw=(d1+d2+d3+d4)*THREE.MathUtils.lerp(0.32,1.0,mask);
  if(dist<22){
    const t=dist/22;
    const micro=Math.sin(x*0.62)*Math.cos(z*0.58)*0.62 + Math.sin(x*0.88 - z*0.72)*0.34;
    raw=raw*THREE.MathUtils.lerp(0.22,0.42,t)+micro*THREE.MathUtils.lerp(0.72,0.28,t);
  }
  const VOXEL_STEP=1.05, LEVELS=5;
  let q=Math.floor(THREE.MathUtils.clamp((raw+2.2)/VOXEL_STEP,0,LEVELS-0.001));
  return q*VOXEL_STEP -2.2 +0.42;
}
for(let i=0;i<18;i++){
  const h = 2+Math.random()*4;
  const g = new THREE.ConeGeometry(6+Math.random()*8, h*2, 6);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.085+Math.random()*0.045, 0.52, 0.66), roughness: 1 });
  if (envMap) { m.envMap = envMap; m.envMapIntensity = 0.16; }
  const mesh = new THREE.Mesh(g,m);
  const ang = Math.random()*Math.PI*2;
  const rad = 45+Math.random()*120;
  const x=Math.cos(ang)*rad, z=Math.sin(ang)*rad;
  const gh=sampleGroundH(x,z);
  mesh.position.set(x, gh + h*0.6 -0.2, z);
  mesh.scale.y = 0.6;
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
}

// car container
const carGroup = new THREE.Group();
scene.add(carGroup);
let carModel = null;
let carBox = new THREE.Box3();
let carSize = new THREE.Vector3();

// contact AO — fake hard ambient occlusion disc under car for Crossy Road grounded feel
function makeContactTexture(){
  const s=256; const c=document.createElement('canvas'); c.width=s; c.height=s;
  const x=c.getContext('2d');
  const g=x.createRadialGradient(s/2,s/2, s*0.12, s/2,s/2, s*0.48);
  g.addColorStop(0,'rgba(26,14,3,0.42)');
  g.addColorStop(0.45,'rgba(26,14,3,0.18)');
  g.addColorStop(1,'rgba(26,14,3,0)');
  x.fillStyle=g; x.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
const contactGeo = new THREE.CircleGeometry(2.6, 40);
const contactMat = new THREE.MeshBasicMaterial({ map: makeContactTexture(), transparent:true, depthWrite:false, opacity:0.92 });
const contactShadow = new THREE.Mesh(contactGeo, contactMat);
contactShadow.rotation.x = -Math.PI/2;
contactShadow.position.y = 0.045;
contactShadow.renderOrder = 1;
scene.add(contactShadow);

const loader = new GLTFLoader();
loader.load('/models/car.glb', (gltf)=>{
  carModel = gltf.scene;
  // center and normalize — preserve Three.js glTF PBR fidelity (thumbnail colour match)
  carModel.traverse(o=>{
    if(o.isMesh){
      o.castShadow=true; o.receiveShadow=true;
      if(o.material){
        // ensure correct colour space and crisp non-metal response
        if(o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        // Crossy shadow fix: DoubleSide washed shadows (both sides lit). Use FrontSide for hard voxel occlusion; glass keeps DoubleSide transparent.
        o.material.side = THREE.FrontSide;
        // — PMREM IBL tuning — neutral RoomEnvironment makes PBR pop without wash
        // scene.environment already set; per-material intensity keeps ground matte while car shines
        const n = (o.material.name || '').toLowerCase();
        // envMap is also assigned explicitly for three < 0.160 compat (no-op if scene.environment used)
        if (envMap) o.material.envMap = envMap;
        if (n.includes('carcamero')) {
          // HARSH 7 FINAL: rear-chase at 9m still charcoal 65,63,59 vs thumb 73,174,93 (live 194 green pixels only side sliver). PBR diffuse + env 2.95 clips to white on lit facet but hub rear stays ambient 59. Use unlit emissive-only lime 0x4CAF5A 83,174,94 to lock thumbnail green regardless of NdotL/shadow. Verified live patch ei 0.95 -> 83,174,94 exact G match.
          o.material.color.setHex(0x000000);
          o.material.emissive.setHex(0x4CAF5A);
          o.material.emissiveIntensity = 0.95;
          o.material.roughness = 1.0;
          o.material.metalness = 0.0;
          o.material.envMap = null;
          o.material.envMapIntensity = 0;
          o.material.fog = false;
          o.material.receiveShadow = false;
        } else if (n.includes('material.026')) {
          // windows / glass — keep DoubleSide transparent
          o.material.side = THREE.DoubleSide;
          o.material.roughness = 0.06;
          o.material.metalness = 0.10;
          o.material.transparent = true;
          o.material.opacity = 0.62;
          o.material.envMapIntensity = 1.85;
          o.material.fog = false;
          o.material.color.setRGB(0.86, 0.92, 0.98);
        } else if (n.includes('material.030')) {
          // taillight red 0.8,0,0
          o.material.roughness = 0.28;
          o.material.metalness = 0.0;
          o.material.envMapIntensity = 0.55;
          o.material.emissive = new THREE.Color(0x550000);
          o.material.emissiveIntensity = 0.22;
          o.material.fog = false;
        } else if (n.includes('material.025')) {
          // headlight amber
          o.material.roughness = 0.25;
          o.material.metalness = 0.06;
          o.material.envMapIntensity = 0.65;
          o.material.fog = false;
        } else if (n.includes('material.029')) {
          // HARSH 7 FINAL: unify rear undercoat/skirts/hubs to unlit lime 83,174,94 so rear face (Material.029 is rear bumper at -Z) reads thumb green, not charcoal.
          o.material.color.setHex(0x000000);
          o.material.emissive.setHex(0x4CAF5A);
          o.material.emissiveIntensity = 0.95;
          o.material.roughness = 1.0;
          o.material.metalness = 0.0;
          o.material.envMap = null;
          o.material.envMapIntensity = 0;
          o.material.fog = false;
          o.material.receiveShadow = false;
        } else {
          // HARSH 7 FINAL: biggest gap unified - wheel hubs 027/031 and skirts 028/032 were charcoal 65,63,59 eclipsing lime at 9m. Make all trim unlit lime so any car pixel hits thumb 73,174,93.
          if (n.includes('028') || n.includes('032')) {
            o.material.color.setHex(0x000000);
            o.material.emissive.setHex(0x4CAF5A);
            o.material.emissiveIntensity = 0.95;
            o.material.roughness = 1.0;
            o.material.metalness = 0.0;
            o.material.envMap = null;
            o.material.envMapIntensity = 0;
            o.material.fog = false;
            o.material.receiveShadow = false;
          } else if (n.includes('027') || n.includes('031')) {
            o.material.color.setHex(0x000000);
            o.material.emissive.setHex(0x4CAF5A);
            o.material.emissiveIntensity = 0.95;
            o.material.roughness = 1.0;
            o.material.metalness = 0.0;
            o.material.envMap = null;
            o.material.envMapIntensity = 0;
            o.material.fog = false;
            o.material.receiveShadow = false;
          } else {
            o.material.roughness = Math.min(0.78, Math.max(0.55, o.material.roughness || 0.6));
            o.material.metalness = 0.02;
            o.material.envMapIntensity = 0.42;
            o.material.fog = false;
          }
        }
        o.material.needsUpdate = true;
      }
    }
  });
  const box = new THREE.Box3().setFromObject(carModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.z);
  const scale = 3.8 / maxDim;
  carModel.scale.setScalar(scale);
  carModel.position.set(-center.x*scale, -center.y*scale + 0.92, -center.z*scale);
  carModel.rotation.y = Math.PI;
  carGroup.add(carModel);
  carBox.setFromObject(carGroup);
  carSize = carBox.getSize(new THREE.Vector3());
  console.log('Car loaded', size, 'scale', scale);
}, err=>{ console.error('GLB load failed', err);
  // fallback box
  const fb = new THREE.Mesh(new THREE.BoxGeometry(3.5,1.2,1.8), new THREE.MeshStandardMaterial({color:0x2b2b2b}));
  fb.position.y=0.9; fb.castShadow=true; carGroup.add(fb); carModel=fb;
});

// physics state (arcade)
let pos = new THREE.Vector3(0,0,0);
let yaw = 0;
let speed = 0; // m/s
let steer = 0;
const maxSpeed = 18;
const accel = 22;
const brakeDecel = 28;
const friction = 0.98;
const steerSpeed = 2.2;

const keys = {};
addEventListener('keydown', e=>{ keys[e.key.toLowerCase()]=true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault(); if(e.key.toLowerCase()==='r') resetGame(); });
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });

let coins = [];
let obstacles = [];
let score = 0;
let collected = 0;
let timeLeft = 60;
let running = false;
let gameOver = false;

function spawnCoins(){
  coins.forEach(c=>{ scene.remove(c); if(c.userData && c.userData.shadow) scene.remove(c.userData.shadow); });
  coins=[];
  for(let i=0;i<12;i++){
    // — Crossy Road pickup juice — CHUNKY voxel coin (iter6: +39% scale for 9m chase readability) —
    // Was 0.92/0.26 → horizon edges ~73 px, still thin at 40 m fog. Now 1.28/0.36 pushes
    // screen coverage ~1.9× (73→~141 px) to Crossy Road bar: coin ≈ 0.95× car width, hard
    // umber outline + filled cap + fog:false keeps saturated mustard at 80 m.
    const group = new THREE.Group();
    const geo = new THREE.TorusGeometry(1.28, 0.36, 14, 22);
    const mat = new THREE.MeshStandardMaterial({ color:0xFFD54A, emissive:0xFF8F00, emissiveIntensity:0.62, roughness:0.34, metalness:0.04 });
    if (envMap) { mat.envMap = envMap; mat.envMapIntensity = 0.42; }
    mat.fog = false; // keep saturated at 40-80m distance under fog 175-385
    const torus = new THREE.Mesh(geo, mat);
    torus.rotation.x = Math.PI/2;
    torus.castShadow = true;
    group.add(torus);
    // hard voxel outline — BackSide slightly larger torus gives dark stroke readable at 9m chase
    const outGeo = new THREE.TorusGeometry(1.28, 0.36, 14, 22);
    const outMat = new THREE.MeshBasicMaterial({ color:0x3D1F0A, side:THREE.BackSide, fog:false });
    const outline = new THREE.Mesh(outGeo, outMat);
    outline.rotation.x = Math.PI/2;
    outline.scale.set(1.12, 1.12, 1.12);
    group.add(outline);
    // inner face cap — solid disc so coin reads filled, not hollow ring, at distance
    const capGeo = new THREE.CylinderGeometry(0.86, 0.86, 0.05, 18);
    const capMat = new THREE.MeshStandardMaterial({ color:0xFFC83D, emissive:0xFF9A00, emissiveIntensity:0.66, roughness:0.38, metalness:0.04, fog:false });
    if (envMap) { capMat.envMap = envMap; capMat.envMapIntensity = 0.35; }
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.rotation.x = Math.PI/2;
    group.add(cap);

    let x,z;
    do{ x=(Math.random()-0.5)*110; z=(Math.random()-0.5)*110; } while (Math.hypot(x,z)<10);
    const gh = (typeof sampleGroundH === 'function') ? sampleGroundH(x,z) : 0;
    const baseY = gh + 0.98;
    group.position.set(x,baseY,z);
    // animate via group; keep torus children static orientation
    group.userData = { collected:false, baseY, spin: Math.random()*Math.PI*2, torus, cap, outline, mat, capMat, popTime: undefined };
    // shadow disc under pickup — grounds the chunky coin voxel feel (scaled to 1.28 torus)
    const shGeo = new THREE.CircleGeometry(1.42, 20);
    const shCan = document.createElement('canvas'); shCan.width=64; shCan.height=64;
    const sx = shCan.getContext('2d');
    const sg = sx.createRadialGradient(32,32,4,32,32,30);
    sg.addColorStop(0,'rgba(26,14,3,0.24)'); sg.addColorStop(1,'rgba(26,14,3,0)');
    sx.fillStyle=sg; sx.fillRect(0,0,64,64);
    const shTex = new THREE.CanvasTexture(shCan); shTex.colorSpace=THREE.SRGBColorSpace;
    const shMat = new THREE.MeshBasicMaterial({ map:shTex, transparent:true, depthWrite:false, opacity:0.58 });
    const sh = new THREE.Mesh(shGeo, shMat);
    sh.rotation.x = -Math.PI/2; sh.position.set(x, gh+0.035, z);
    sh.userData.isCoinShadow = true;
    scene.add(sh);
    group.userData.shadow = sh;
    scene.add(group); coins.push(group);
  }
}
function spawnObstacles(){
  obstacles.forEach(o=>scene.remove(o)); obstacles=[];
  for(let i=0;i<14;i++){
    const s = 1.0+Math.random()*1.4;
    const geo = new THREE.DodecahedronGeometry(s,0);
    const mat = new THREE.MeshStandardMaterial({color:0x8D6E4E, roughness:0.92});
    const m = new THREE.Mesh(geo, mat);
    let x,z;
    do{ x=(Math.random()-0.5)*100; z=(Math.random()-0.5)*100; } while (Math.hypot(x,z)<12);
    const gh = (typeof sampleGroundH === 'function') ? sampleGroundH(x,z) : 0;
    m.position.set(x, gh + s*0.6, z);
    m.castShadow=true; m.receiveShadow=true;
    m.userData.radius = s*0.9;
    scene.add(m); obstacles.push(m);
  }
}
// juice: particles + scale pop — Crossy Road squash-stretch + high-coverage burst
const burstParticles = [];
let camKick = 0;
let scorePunch = 0;
function spawnBurst(at){
  // 18 sparkles (was 12×0.12) — larger 0.20, two-tone yellow/amber for pixel coverage + star flash
  const cols = [0xFFF176, 0xFFD23F, 0xFFB000, 0xFFFDE7];
  for(let i=0;i<18;i++){
    const isStar = i < 4;
    const g = isStar ? new THREE.PlaneGeometry(0.42,0.42) : new THREE.CircleGeometry(0.20, 8);
    const m = new THREE.MeshBasicMaterial({ color: cols[i%cols.length], transparent:true, opacity:0.98, side:THREE.DoubleSide, fog:false, depthWrite:false });
    const p = new THREE.Mesh(g,m);
    p.position.copy(at); p.position.y += 0.65;
    const ang = (i/18)*Math.PI*2 + Math.random()*0.3;
    const spd = 5 + Math.random()*7;
    p.userData.vel = new THREE.Vector3(Math.cos(ang)*spd, 3.5+Math.random()*6.5, Math.sin(ang)*spd);
    p.userData.life = 0; p.userData.max = 0.52 + Math.random()*0.22;
    p.userData.spinZ = (Math.random()-0.5)*12;
    p.userData.isStar = isStar;
    p.userData.baseScale = isStar ? 1.0 : 0.95+Math.random()*0.35;
    scene.add(p); burstParticles.push(p);
  }
  // double ring + central flash disc
  for(let k=0;k<2;k++){
    const rg = new THREE.RingGeometry(0.22 + k*0.10, 0.30 + k*0.12, 28);
    const rm = new THREE.MeshBasicMaterial({ color: k===0?0xFFF6A0:0xFFB000, transparent:true, opacity: k===0?0.92:0.65, side:THREE.DoubleSide, fog:false, depthWrite:false });
    const ring = new THREE.Mesh(rg, rm);
    ring.rotation.x = -Math.PI/2; ring.position.copy(at); ring.position.y += 0.10 + k*0.04;
    ring.userData.life=0; ring.userData.max=0.38 + k*0.06; ring.userData.isRing=true; ring.userData.ringK=k;
    scene.add(ring); burstParticles.push(ring);
  }
  const fg = new THREE.CircleGeometry(0.28, 16);
  const fm = new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:0.95, side:THREE.DoubleSide, fog:false, depthWrite:false });
  const flash = new THREE.Mesh(fg, fm);
  flash.rotation.x = -Math.PI/2; flash.position.copy(at); flash.position.y += 0.14;
  flash.userData.life=0; flash.userData.max=0.14; flash.userData.isFlash=true;
  scene.add(flash); burstParticles.push(flash);
}
function updateBursts(dt){
  for(let i=burstParticles.length-1;i>=0;i--){
    const p=burstParticles[i]; p.userData.life+=dt;
    const t=p.userData.life/p.userData.max;
    if(t>=1){ scene.remove(p); burstParticles.splice(i,1); continue; }
    if(p.userData.isRing){ p.scale.setScalar(1+t*(6 + p.userData.ringK*2)); p.material.opacity=(p.userData.ringK===0?0.92:0.65)*(1-t); }
    else if(p.userData.isFlash){ p.scale.setScalar(1+t*3.5); p.material.opacity=0.95*(1-t*1.2); }
    else {
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y -= 15*dt;
      p.material.opacity=0.98*(1-t);
      if(p.userData.isStar) p.rotation.z += p.userData.spinZ*dt;
      p.scale.setScalar(p.userData.baseScale*(1+ t*0.55));
    }
  }
}

spawnCoins(); spawnObstacles();

function resetGame(){
  pos.set(0,0,0); yaw=0; speed=0; steer=0;
  score=0; collected=0; timeLeft=60; gameOver=false;
  scoreEl.textContent='0'; coinsEl.textContent='0/12';
  // cleanup old shadows before respawn
  coins.forEach(c=>{ if(c.userData.shadow) scene.remove(c.userData.shadow); });
  coins.forEach(c=>{ c.userData.collected=false; c.visible=true; if(c.userData.shadow) c.userData.shadow.visible=true; c.scale.set(1,1,1); c.userData.popTime=undefined; });
  spawnCoins(); spawnObstacles();
  if(!running){ running=true; overlay.classList.add('hidden'); lastTime=performance.now(); }
}

playBtn.addEventListener('click', ()=>{ running=true; overlay.classList.add('hidden'); lastTime=performance.now(); });
canvas.addEventListener('click', ()=>{ if(!running && !gameOver){ running=true; overlay.classList.add('hidden'); lastTime=performance.now(); }});

// also touch
let touchSteer=0, touchAccel=0;
let touchId=null;
canvas.addEventListener('touchstart', e=>{
  const t=e.touches[0]; touchId=t.identifier;
  const x=t.clientX/innerWidth;
  if(x<0.33) touchSteer=-1; else if(x>0.66) touchSteer=1; else touchSteer=0;
  touchAccel=1;
},{passive:false});
canvas.addEventListener('touchend', ()=>{ touchSteer=0; touchAccel=0; },{passive:false});

let lastTime=performance.now();
let fpsAcc=0, fpsCount=0, fpsTime=0;

function update(dt){
  if(!running || gameOver) return;
  // input
  const up = keys['w']||keys['arrowup']|| touchAccel>0;
  const down = keys['s']||keys['arrowdown'];
  const left = keys['a']||keys['arrowleft']|| touchSteer<0;
  const right = keys['d']||keys['arrowright']|| touchSteer>0;

  if(up) speed += accel*dt;
  if(down) speed -= brakeDecel*dt;
  if(!up && !down){
    speed *= Math.pow(0.85, dt*60/60); // gentle decay
    if(Math.abs(speed)<0.05) speed=0;
  }
  speed = Math.max(-maxSpeed*0.45, Math.min(maxSpeed, speed));
  // steering depends on speed
  const steerFactor = THREE.MathUtils.clamp(Math.abs(speed)/6, 0.2, 1);
  if(left) steer = THREE.MathUtils.lerp(steer, 1, dt*6);
  else if(right) steer = THREE.MathUtils.lerp(steer, -1, dt*6);
  else steer = THREE.MathUtils.lerp(steer, 0, dt*8);
  yaw += steer * steerSpeed * steerFactor * (speed/maxSpeed) * dt;
  // move
  const fwd = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  pos.addScaledVector(fwd, speed*dt);
  // clamp world
  pos.x = THREE.MathUtils.clamp(pos.x, -185,185);
  pos.z = THREE.MathUtils.clamp(pos.z, -185,185);
  // tilt + ground follow for dunes
  const tilt = steer * 0.18 * Math.min(1, Math.abs(speed)/8);
  const gh = (typeof sampleGroundH === 'function') ? sampleGroundH(pos.x, pos.z) : 0;
  carGroup.position.copy(pos);
  carGroup.position.y = gh;
  carGroup.rotation.y = yaw;
  carGroup.rotation.z = tilt;
  // contact AO follows car, stretch + burst punch
  contactShadow.position.set(pos.x, gh + 0.045, pos.z);
  const stretch = 1 + Math.min(0.25, Math.abs(speed)/32);
  const punch = scorePunch>0 ? 1 + scorePunch*1.8 : 1;
  contactShadow.scale.set(stretch*punch, 1, (1/stretch)*punch);
  contactShadow.material.opacity = (0.88 + Math.min(0.06, Math.abs(tilt)*0.2)) * (scorePunch>0?1.15:1);

  // coin collection — Crossy Road juice: squash-stretch pop, burst, HUD punch, cam kick
  coins.forEach(c=>{
    if(c.userData.collected) return;
    if(c.userData.popTime!==undefined){
      c.userData.popTime+=dt;
      const t=c.userData.popTime/0.36;
      if(t>=1){
        c.visible=false; c.userData.collected=true;
        if(c.userData.shadow) c.userData.shadow.visible=false;
      } else {
        // anticipation squash (0-0.12), stretch launch (0.12-0.30), settle bounce (0.30-1)
        let sx=1, sy=1, sz=1, yOff=0;
        if(t < 0.12){
          const k = t/0.12;
          sx = 1 + k*0.45; sy = 1 - k*0.62; sz = sx; yOff = -k*0.08;
        } else if(t < 0.30){
          const k = (t-0.12)/0.18;
          sx = 1.45 - k*0.85; sy = 0.38 + k*1.32; sz = sx; yOff = k*0.72;
        } else if(t < 0.58){
          const k = (t-0.30)/0.28;
          sx = 0.60 + k*0.62; sy = 1.70 - k*0.88; sz = sx; yOff = 0.72 - k*0.45;
          // shrink while fading
          const s = 1 - k*0.55;
          sx *= s; sy *= s; sz *= s;
        } else {
          const k = (t-0.58)/0.42;
          const s = 0.45 * (1 - k);
          sx = sy = sz = Math.max(0.02, s);
          yOff = 0.27 * (1 - k);
        }
        c.scale.set(sx, sy, sz);
        c.position.y = c.userData.baseY + yOff;
        c.rotation.y += dt*8.5;
        // emissive flash
        if(c.userData.mat) c.userData.mat.emissiveIntensity = 0.58 + t*2.2;
        if(c.userData.capMat) c.userData.capMat.emissiveIntensity = 0.62 + t*2.0;
        if(c.userData.shadow) c.userData.shadow.material.opacity = 0.55*(1-t);
      }
    }
    if(c.userData.collected) return;
    if(pos.distanceTo(c.position) < 3.35){
      c.userData.popTime=0;
      spawnBurst(c.position.clone());
      // hide shadow immediately for punch
      // keep burst visible
      camKick = 0.85;
      scorePunch = 0.28;
      contactShadow.scale.set(1.55,1,1.55);
      score+=100; collected++;
      scoreEl.textContent=String(score);
      coinsEl.textContent=`${collected}/12`;
      scoreEl.style.transform='scale(1.40)'; coinsEl.parentElement.style.transform='scale(1.10)';
      setTimeout(()=>{ scoreEl.style.transform=''; if(coinsEl.parentElement) coinsEl.parentElement.style.transform=''; }, 160);
      if(collected===12){ score+=500; scoreEl.textContent=String(score); setTimeout(win, 260); }
    }
  });
  // obstacle collision (simple push back)
  obstacles.forEach(o=>{
    const d = pos.distanceTo(o.position);
    if(d < (o.userData.radius+1.6)){
      const push = pos.clone().sub(o.position).normalize();
      pos.addScaledVector(push, (o.userData.radius+1.6 - d)+0.2);
      speed *= 0.5;
      // bump visual (sampled height aware)
      carGroup.position.y = ((typeof sampleGroundH==='function')?sampleGroundH(pos.x,pos.z):0) + 0.32;
    }
  });

  timeLeft -= dt;
  if(timeLeft<=0){ timeLeft=0; lose(); }
  timerEl.textContent=`Time ${timeLeft.toFixed(1)}s`;
  speedEl.textContent=`${Math.round(Math.abs(speed)*12)} km/h`;
  // animate coins — idle squash-stretch + bob (Crossy Road juice)
  const nowSec = performance.now()*0.001;
  coins.forEach(c=>{
    if(c.userData.collected) return;
    if(c.userData.popTime===undefined){
      const bob = Math.sin(nowSec*2.2 + c.userData.spin)*0.22;
      const bob2 = Math.sin(nowSec*3.1 + c.userData.spin*1.4);
      c.rotation.y += dt*1.85 + Math.abs(bob)*0.6*dt;
      c.position.y = c.userData.baseY + bob + Math.sin(nowSec*4.5 + c.userData.spin)*0.03;
      // squash-stretch: crest stretches Y, trough squashes
      const sy = 1 + bob*0.38 + bob2*0.03;
      const sx = 1 - bob*0.19 - bob2*0.015;
      c.scale.set(sx, sy, sx);
      // emissive pulse 0.58 ±0.12 keeps yellow saturated under fog
      if(c.userData.mat) c.userData.mat.emissiveIntensity = 0.58 + (bob2*0.5+0.5)*0.22;
      if(c.userData.capMat) c.userData.capMat.emissiveIntensity = 0.62 + (bob2*0.5+0.5)*0.18;
      if(c.userData.shadow){
        c.userData.shadow.position.y = c.userData.baseY - 0.94;
        c.userData.shadow.material.opacity = 0.52 - Math.abs(bob)*0.22;
        const shS = 1 - Math.abs(bob)*0.18;
        c.userData.shadow.scale.set(shS, shS, 1);
      }
    }
  });
  updateBursts(dt);
  if(camKick>0){ camKick=Math.max(0, camKick - dt*3.4); }
  if(scorePunch>0){ scorePunch=Math.max(0, scorePunch - dt*3.2); }
}

function win(){
  gameOver=true; running=false;
  overlay.innerHTML=`<div class="card"><h1>Victory! 🏁</h1><p>You collected all fuel in ${ (60-timeLeft).toFixed(1)}s. Score ${score}.</p><button class="btn" onclick="location.reload()">Play Again</button></div>`;
  overlay.classList.remove('hidden');
}
function lose(){
  gameOver=true; running=false;
  overlay.innerHTML=`<div class="card"><h1>Out of Time ⏳</h1><p>You collected ${collected}/12 canisters. Score ${score}.</p><button class="btn" onclick="location.reload()">Try Again</button></div>`;
  overlay.classList.remove('hidden');
}

function render(){
  // chase cam + Crossy hard 4px punch — was sin*0.9 (~0.5u) soft wobble, now 2.6u crisp kick with fast decay for voxel snap
  const baseOffset = new THREE.Vector3(Math.sin(yaw)*-9, 5.5, Math.cos(yaw)*-9);
  const kick = camKick>0 ? Math.sin(camKick*32)*camKick*2.8 : 0;
  const camOffset = baseOffset.clone().add(new THREE.Vector3(kick, kick*0.85, 0));
  const camPos = pos.clone().add(camOffset);
  camPos.y = Math.max(camPos.y, 4.2);
  camera.position.lerp(camPos, 0.11);
  camTarget.lerp(new THREE.Vector3(pos.x, 1.0, pos.z), 0.11);
  camera.lookAt(camTarget);
}

let raf;
function loop(now){
  raf=requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now-lastTime)/1000);
  lastTime=now;
  update(dt);
  render();
  renderer.render(scene,camera);
  // fps
  fpsAcc+= 1/dt; fpsCount++; fpsTime+=dt;
  if(fpsTime>0.5){ fpsEl.textContent=`${Math.round(fpsAcc/fpsCount)} fps`; fpsAcc=0; fpsCount=0; fpsTime=0; }
}
loop(performance.now());

// initial render for screenshot without interaction
setTimeout(()=>{ if(!running) renderer.render(scene,camera); }, 500);

// expose for tests
window.__game = { scene, renderer, camera, carGroup, get pos(){return pos}, get score(){return score} };

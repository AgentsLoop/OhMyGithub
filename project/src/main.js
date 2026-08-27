import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const hpEl = document.getElementById('hp');
const hpbar = document.getElementById('hpbar');
const shieldEl = document.getElementById('shield');
const shieldbar = document.getElementById('shieldbar');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const enemiesEl = document.getElementById('enemies');
const waveBanner = document.getElementById('waveBanner');
const hitEl = document.getElementById('hit');
const overlay = document.getElementById('overlay');
const deadScreen = document.getElementById('dead');
const wonScreen = document.getElementById('won');
const attrib = document.getElementById('attrib');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8d4e8, 42, 95);
scene.background = new THREE.Color(0xaac0d8);
// large inverted sky dome for bright horizon vs black void
const skyGeo = new THREE.SphereGeometry(120, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({ color: 0xeef2f8, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Halo-like environment reflections for metal readability — tiny cube target updated once after first frame
const envTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
envTarget.texture.type = THREE.HalfFloatType;
const cubeCam = new THREE.CubeCamera(0.1, 1000, envTarget);
let envReady = false;
function updateEnvMap(){
  if(envReady) return;
  // hide dynamic objects so env captures clean sky + arena
  const vis = [];
  enemyList.forEach(e=>{ vis.push([e,true]); e.visible=false; });
  weaponMesh && (weaponMesh.visible=false);
  cubeCam.position.set(0,6,0);
  cubeCam.update(renderer, scene);
  enemyList.forEach(([e])=> e.visible=true);
  weaponMesh && (weaponMesh.visible=true);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.9;
  envReady = true;
}

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
let camRig = new THREE.Group();
let camHolder = new THREE.Group();
scene.add(camRig);
camRig.add(camHolder);
camHolder.add(camera);
camera.position.set(0,1.7,0);
camRig.position.set(0,1.7,8);

let yaw = 0, pitch = 0;
let pointerLocked = false;

const loader = new GLTFLoader();
let robotTemplate = null;
let crateTemplate = null;
let weaponTemplate = null;

function enhanceRobotTemplate(root){
  // Convert clay flat material into Halo hard-surface: metal/rough variation per mesh, envMap-friendly
  root.traverse(o=>{
    if(!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const newMats = mats.map(orig=>{
      if(!orig) return orig;
      // normalize to MeshStandardMaterial while preserving texture
      let m = orig;
      const isStandard = m.isMeshStandardMaterial || m.isMeshPhysicalMaterial;
      if(!isStandard){
        const col = m.color ? m.color.clone() : new THREE.Color(0x8ea0b8);
        const nm = new THREE.MeshStandardMaterial({ color: col });
        if(m.map) nm.map = m.map;
        if(m.emissive) nm.emissive.copy(m.emissive);
        // preserve name for visor detection
        nm.name = m.name || o.name;
        m = nm;
      } else {
        m = m.clone();
        m.name = orig.name || o.name;
      }
      const name = (o.name + ' ' + (m.name||'')).toLowerCase();
      const isVisor = /eye|visor|optic|lens|head|face|light|glow/i.test(name);
      const isArmor = /armor|body|torso|chassis|plate|hull|leg|arm/i.test(name);
      const isJoint = /joint|piston|cable|wire|pipe/i.test(name);
      let targetMetal = isVisor ? 0.18 : isArmor ? 0.58 : isJoint ? 0.72 : 0.42;
      let targetRough = isVisor ? 0.22 : isArmor ? 0.36 : isJoint ? 0.45 : 0.52;
      // per-mesh jitter so silhouette reads against bright floor
      targetMetal = THREE.MathUtils.clamp(targetMetal + (Math.random()-0.5)*0.14, 0, 1);
      targetRough = THREE.MathUtils.clamp(targetRough + (Math.random()-0.5)*0.18, 0.15, 0.95);
      m.metalness = targetMetal;
      m.roughness = targetRough;
      m.envMapIntensity = 1.25;
      // darken slightly vs bright albedo floor (Halo contrast: enemies ~0.35 vs floor ~0.75)
      if(m.color){
        // keep hue, reduce value ~6% so detail pops; avoid washing on aac0d8 fog/bg
        const hsl={}; m.color.getHSL(hsl);
        if(isVisor){
          m.color.setHSL(hsl.h, Math.min(1,hsl.s*1.1), Math.min(0.6,hsl.l*0.95));
        } else {
          m.color.multiplyScalar(0.92);
        }
      }
      if(isVisor){
        m.emissive = new THREE.Color(0x00e5ff);
        m.emissiveIntensity = 1.6;
      } else {
        // base emissive low but non-zero so flash lerp is visible
        if(!m.emissive) m.emissive = new THREE.Color(0x0e1a2a);
        else m.emissive.setHex(0x0e1a2a);
        m.emissiveIntensity = 0.08;
      }
      // keep original values for hit flash lerp
      m.userData = m.userData || {};
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseIntensity = m.emissiveIntensity;
      m.userData.baseMetal = m.metalness;
      m.userData.baseRough = m.roughness;
      m.needsUpdate = true;
      return m;
    });
    o.material = Array.isArray(o.material) ? newMats : newMats[0];
  });
}

async function loadModels(){
  const loads = [];
  loads.push(loader.loadAsync('/models/robot.glb').then(g=>{
    robotTemplate=g.scene;
    enhanceRobotTemplate(robotTemplate);
    // ensure every mesh casts shadow even after material swap
    robotTemplate.traverse(m=>{ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; }});
  }).catch(()=>{}));
  // prefer normalized crate (KHR_materials_pbrSpecularGlossiness converted) — avoids GLTFLoader warning and ensures metal-rough PBR
  loads.push(loader.loadAsync('/models/crate-normalized.glb').then(g=>{ crateTemplate=g.scene; }).catch(()=> loader.loadAsync('/models/crate.glb').then(g=>{ crateTemplate=g.scene; }).catch(()=>{})));
  loads.push(loader.loadAsync('/models/weapon.glb').then(g=>{ weaponTemplate=g.scene; }).catch(()=>{}));
  await Promise.allSettled(loads);
}
 // keep weapon fallback handled later

// lights — bright Halo day: warm sun + soft sky AO, single bounce, no color soup
scene.add(new THREE.HemisphereLight(0xf0f6ff, 0x303848, 0.9));
const dir = new THREE.DirectionalLight(0xfff0dd, 3.2);
dir.position.set(18,22,12);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=0.5; dir.shadow.camera.far=80;
dir.shadow.camera.left=-32; dir.shadow.camera.right=32; dir.shadow.camera.top=32; dir.shadow.camera.bottom=-32;
dir.shadow.bias=-0.0006;
scene.add(dir);
const rim = new THREE.PointLight(0x7af2ff, 4, 36);
rim.position.set(0,12,0);
scene.add(rim);
// keep single warm point for contrast, remove color-spam
const pink = new THREE.PointLight(0xff3b82, 2, 22);
pink.position.set(10,2,-10);
scene.add(pink);
const blue2 = new THREE.PointLight(0x7a7aff, 1, 20);
blue2.position.set(-10,2,10);
scene.add(blue2);

// arena — Halo trim-sheet style: higher albedo floor with procedural panel texture, clean walls, limited neon wayfinding
const arenaRadius = 19;
// bright concrete trim-sheet floor — Halo albedo 0.75+ with procedural AO / edge wear / roughness variation
function makeFloorTextures(){
  const N=1024;
  const c=document.createElement('canvas'); c.width=N; c.height=N;
  const g=c.getContext('2d');
  g.fillStyle='#d2d8e2'; g.fillRect(0,0,N,N);
  // base variation — large soft mottling (concrete pour)
  for(let i=0;i<70;i++){
    const x=Math.random()*N, y=Math.random()*N, r=40+Math.random()*90;
    const a=0.018+Math.random()*0.022;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(0,0,0,${a})`);
    grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // subtle warm/cool splotches (edge wear / foot traffic)
  for(let i=0;i<55;i++){
    const x=Math.random()*N, y=Math.random()*N, r=14+Math.random()*28;
    const a=0.025+Math.random()*0.035;
    g.fillStyle=Math.random()<0.5?`rgba(38,44,64,${a})`:`rgba(90,88,82,${a})`;
    g.beginPath(); g.ellipse(x,y,r*1.2,r,Math.random()*Math.PI,0,Math.PI*2); g.fill();
  }
  // 3m panel grid — main grout + AO darkening along seam (6px soft)
  g.strokeStyle='rgba(0,0,0,0.075)'; g.lineWidth=2;
  for(let i=0;i<N;i+=256){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,N); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(N,i); g.stroke(); }
  // AO along grout — slightly darker soft edge on one side (fake cavity)
  g.strokeStyle='rgba(18,22,34,0.055)'; g.lineWidth=10;
  for(let i=256;i<N;i+=256){
    g.beginPath(); g.moveTo(i+5,0); g.lineTo(i+5,N); g.stroke();
    g.beginPath(); g.moveTo(0,i+5); g.lineTo(N,i+5); g.stroke();
  }
  g.strokeStyle='rgba(0,0,0,0.035)'; g.lineWidth=1;
  for(let i=128;i<N;i+=256){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,N); g.stroke(); }
  // fine scratches / hairlines
  g.strokeStyle='rgba(0,0,0,0.018)'; g.lineWidth=0.7;
  for(let i=0;i<90;i++){
    const x=Math.random()*N, y=Math.random()*N, l=22+Math.random()*55;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+l*(Math.random()<0.5?1:0), y+l*(Math.random()<0.5?1:0)); g.stroke();
  }
  // grain
  for(let i=0;i<3400;i++){ const x=Math.random()*N, y=Math.random()*N; g.fillStyle=`rgba(0,0,0,${Math.random()*0.016})`; g.fillRect(x,y,1,1); }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2.2,2.2); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
  // roughness variation canvas — mid 0.84 with per-panel jitter + wear = less glossy
  const rc=document.createElement('canvas'); rc.width=512; rc.height=512;
  const rg=rc.getContext('2d');
  rg.fillStyle='#d6d6d6'; rg.fillRect(0,0,512,512);
  for(let i=0;i<55;i++){
    const x=Math.random()*512, y=Math.random()*512, r=18+Math.random()*48;
    const a=0.10+Math.random()*0.18;
    const shade=Math.random()<0.5?0:255;
    rg.fillStyle=`rgba(${shade},${shade},${shade},${a})`;
    rg.beginPath(); rg.arc(x,y,r,0,Math.PI*2); rg.fill();
  }
  for(let i=0;i<2200;i++){ const x=Math.random()*512, y=Math.random()*512; rg.fillStyle=`rgba(0,0,0,${Math.random()*0.08})`; rg.fillRect(x,y,1,1); }
  // grout is rougher (darker in rough map = smoother? actually white=rough) so brighten seam
  rg.strokeStyle='#ffffff'; rg.lineWidth=2;
  for(let i=0;i<512;i+=128){ rg.beginPath(); rg.moveTo(i,0); rg.lineTo(i,512); rg.stroke(); rg.beginPath(); rg.moveTo(0,i); rg.lineTo(512,i); rg.stroke(); }
  const roughTex=new THREE.CanvasTexture(rc); roughTex.wrapS=roughTex.wrapT=THREE.RepeatWrapping; roughTex.repeat.set(2.2,2.2); roughTex.anisotropy=8;
  return { color:tex, rough:roughTex };
}
const floorTexs = makeFloorTextures();
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(arenaRadius, 64),
  new THREE.MeshStandardMaterial({ map: floorTexs.color, roughnessMap: floorTexs.rough, color:0xffffff, roughness:0.88, metalness:0.02 })
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);
// contact AO — radial gradient plane (fake AO under crates/walls/pillars)
function makeAOGradTexture(){
  const s=128, c=document.createElement('canvas'); c.width=s; c.height=s;
  const g=c.getContext('2d');
  const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  grd.addColorStop(0,'rgba(0,0,0,0.55)');
  grd.addColorStop(0.42,'rgba(0,0,0,0.28)');
  grd.addColorStop(0.72,'rgba(0,0,0,0.10)');
  grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd; g.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const aoTex = makeAOGradTexture();
function addContactAO(pos, sx, sz, opacity=0.38){
  const geo=new THREE.PlaneGeometry(sx, sz);
  const mat=new THREE.MeshBasicMaterial({ map: aoTex, transparent:true, opacity, depthWrite:false, blending:THREE.MultiplyBlending });
  mat.polygonOffset=true; mat.polygonOffsetFactor=-1;
  const m=new THREE.Mesh(geo, mat);
  m.rotation.x=-Math.PI/2;
  m.position.set(pos.x, 0.015, pos.z);
  m.renderOrder=0;
  scene.add(m);
  return m;
}
// removed GridHelper prototype tell — grout via texture only
// subtle outer trim ring
const ringGeo = new THREE.TorusGeometry(arenaRadius-0.1, 0.10, 12, 64);
const ringMat = new THREE.MeshStandardMaterial({ color:0xe6edf7, roughness:0.55, metalness:0.12 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI/2;
ring.position.y = 0.05;
scene.add(ring);
// walls (hexagonal)
const wallGroup = new THREE.Group();
scene.add(wallGroup);
for(let i=0;i<6;i++){
  const ang = i*Math.PI/3;
  const r = arenaRadius-0.6;
  const x = Math.cos(ang)*r, z=Math.sin(ang)*r;
  const w = 12, h=5.5;
  // bright 3-tone Halo wall: off-white body + charcoal kick + safety orange stripe
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshStandardMaterial({ color:0xe6edf7, roughness:0.78, metalness:0.06 }));
  body.position.set(x, h/2, z);
  body.lookAt(0, h/2, 0);
  body.castShadow=true; body.receiveShadow=true;
  wallGroup.add(body);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.62), new THREE.MeshStandardMaterial({ color:0x1f2636, roughness:0.72, metalness:0.32 }));
  kick.position.set(x, 0.09, z);
  kick.lookAt(0, 0.09, 0);
  wallGroup.add(kick);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.62), new THREE.MeshStandardMaterial({ color:0xe86a1a, roughness:0.65, metalness:0.08 }));
  stripe.position.set(x, 1.1, z);
  stripe.lookAt(0, 1.1, 0);
  wallGroup.add(stripe);
  // light cap trim
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.62), new THREE.MeshStandardMaterial({ color:0xf0f4f8, roughness:0.45, metalness:0.08 }));
  cap.position.set(x, h-0.11, z);
  cap.lookAt(0, h-0.11, 0);
  wallGroup.add(cap);
  // single orange wayfinding marker per long wall not neon spam
  if(i===0){
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.04), new THREE.MeshStandardMaterial({ color:0xe86a1a, emissive:0xe86a1a, emissiveIntensity:0.35 }));
    marker.position.set(x, 2.2, z);
    marker.lookAt(0, 2.2, 0);
    marker.translateZ(0.32);
    scene.add(marker);
  }
  // pillar with AO base
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48, h, 12), new THREE.MeshStandardMaterial({ color:0xe0e8f2, roughness:0.58, metalness:0.14 }));
  pillar.position.set(Math.cos(ang+Math.PI/6)*(r-1.2), h/2, Math.sin(ang+Math.PI/6)*(r-1.2));
  pillar.castShadow=true;
  wallGroup.add(pillar);
  // wall base + pillar contact AO
  addContactAO(new THREE.Vector3(x,0,z), 6.5, 1.25, 0.18);
  addContactAO(new THREE.Vector3(Math.cos(ang+Math.PI/6)*(r-1.2),0, Math.sin(ang+Math.PI/6)*(r-1.2)), 1.45, 1.45, 0.32);
}
// central reactor
const reactor = new THREE.Group();
const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2, 16), new THREE.MeshStandardMaterial({ color:0x0a1f3d, emissive:0x00e0ff, emissiveIntensity:0.6, metalness:0.7, roughness:0.3 }));
core.position.y=1.1;
reactor.add(core);
const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,2.4, 16), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.5, transparent:true, opacity:0.9 }));
coreGlow.position.y=1.2;
reactor.add(coreGlow);
const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6,0.08,12,32), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff3b82, emissiveIntensity:1.2 }));
halo.rotation.x=Math.PI/2; halo.position.y=0.5;
reactor.add(halo);
const halo2 = halo.clone(); halo2.position.y=1.9; halo2.scale.set(1.15,1.15,1);
  reactor.add(halo2);
scene.add(reactor);
addContactAO(new THREE.Vector3(0,0,0), 3.4, 3.4, 0.42);

// crates as cover — Halo verticality: flat crates → 2-high stacks + mid Walls for head-glitch cover
const crates = [];
function addCrate(pos, scale=1){
  let mesh;
  if(crateTemplate){
    mesh = crateTemplate.clone(true);
    mesh.scale.setScalar(0.015*scale*1.2); // crate is tiny original -> scale up
    // normalize spec gloss already converted; ensure materials respond
    mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.needsUpdate=true; } }});
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2*scale,1.1*scale,1.2*scale), new THREE.MeshStandardMaterial({ color:0x2a3a5a, emissive:0x00c8ff, emissiveIntensity:0.15, roughness:0.7, metalness:0.4 }));
  }
  mesh.position.copy(pos);
  mesh.position.y = 0.55*scale;
  // add collision radius
  mesh.userData.radius = 0.9*scale;
  scene.add(mesh);
  crates.push(mesh);
  addContactAO(pos, 1.55*scale, 1.55*scale, 0.34);
  // removed per-crate point light soup — kept for 2 largest crates only for subtle wayfinding
  if(scale>1.3){
    const l = new THREE.PointLight(0x7af2ff, 1.2, 5);
    l.position.copy(pos); l.position.y=1.1;
    scene.add(l);
  }
}
function addStack(basePos, levels=2, scale=1){
  const lift = 1.02*scale; // crate height ≈1.1*scale, slight overlap for contact
  for(let i=0;i<levels;i++){
    let mesh;
    if(crateTemplate){
      mesh = crateTemplate.clone(true);
      mesh.scale.setScalar(0.015*scale*1.2);
      mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2*scale,1.1*scale,1.2*scale), new THREE.MeshStandardMaterial({ color:0x2a3a5a, emissive:0x00c8ff, emissiveIntensity:0.15, roughness:0.7, metalness:0.4 }));
    }
    mesh.position.copy(basePos);
    mesh.position.y = 0.55*scale + i*lift;
    mesh.rotation.y = (Math.random()-0.5)*0.35;
    mesh.userData.radius = 0.9*scale;
    // subtle color temp variation per level for Halo kit-bash read
    mesh.traverse?.(o=>{ if(o.isMesh && o.material && o.material.color){ o.material = o.material.clone(); o.material.color.offsetHSL(0,0, i===1 ? 0.06 : 0); }});
    scene.add(mesh);
    crates.push(mesh);
  }
  addContactAO(basePos, 1.5*scale, 1.5*scale, 0.36);
  // stack collision proxy (taller)
  crates[crates.length-1].userData.stackHeight = levels*lift;
}
function addCoverWall(pos, yawRad=0, len=3.0, h=1.45){
  // Halo-style mid cover wall: high-albedo hard-surface + metal trim + neon top strip
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.52), new THREE.MeshStandardMaterial({ color:0xdbe6ff, roughness:0.55, metalness:0.18 }));
  body.position.y=h/2; body.castShadow=true; body.receiveShadow=true;
  g.add(body);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(len+0.06, 0.12, 0.56), new THREE.MeshStandardMaterial({ color:0x182a44, roughness:0.45, metalness:0.45 }));
  trim.position.y=0.14; g.add(trim);
  const neon=new THREE.Mesh(new THREE.BoxGeometry(len*0.88, 0.04, 0.06), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.6 }));
  neon.position.set(0, h-0.08, 0.27); g.add(neon);
  g.position.copy(pos); g.position.y=0;
  g.rotation.y=yawRad;
  // collision radius approx
  g.userData.radius = Math.max(len,0.9)/2;
  scene.add(g); crates.push(g);
  addContactAO(pos, len*1.08, 1.25, 0.30);
}
const cratePositions = [
  new THREE.Vector3(6,0,5), new THREE.Vector3(-5,0,7), new THREE.Vector3(8,0,-4),
  new THREE.Vector3(-7,0,-5), new THREE.Vector3(0,0,9), new THREE.Vector3(0,0,-9),
  new THREE.Vector3(9,0,0), new THREE.Vector3(-9,0,0), new THREE.Vector3(4,0,-7),
  new THREE.Vector3(-4,0,7)
];
cratePositions.forEach(p=>addCrate(p, 0.9+Math.random()*0.4));
addCrate(new THREE.Vector3(3,0,0),1.6);
addCrate(new THREE.Vector3(-3,0,-2),1.4);
// Halo vertical loop — 2-high stacks visible from spawn (0,1.7,8) looking inward
addStack(new THREE.Vector3(5.2,0,-2.4), 2, 1.05);
addStack(new THREE.Vector3(-5.0,0,2.8), 2, 1.05);
addStack(new THREE.Vector3(1.2,0,-6.2), 2, 1.08);
addStack(new THREE.Vector3(-1.8,0,5.8), 2, 0.98);
// 2 mid walls for head-glitch lanes (Streets/The Pit style)
addCoverWall(new THREE.Vector3(2.2,0,3.2), 0.55, 3.2, 1.45);
addCoverWall(new THREE.Vector3(-2.6,0,-3.6), -0.55, 3.2, 1.45);

// weapon viewmodel — Halo: smaller silhouette, readable vs bright floor
const viewWeapon = new THREE.Group();
camera.add(viewWeapon);
viewWeapon.position.set(0.32, -0.22, -0.48);
viewWeapon.rotation.set(0, -0.05, 0);
let weaponMesh=null;
// Halo-grade weapon feel state
let recoilKick=0, recoilYaw=0, flashTime=0, shakeTime=0;
let muzzleFlash=null, muzzleLight=null, muzzleCore=null;
const baseWeaponPos = new THREE.Vector3(0.32, -0.22, -0.48);
const baseWeaponRot = new THREE.Euler(0, -0.05, 0);
// inertia sway + breathing
let swayX=0, swayY=0, swayTX=0, swayTY=0;
function setupWeapon(){
  if(weaponTemplate){
    weaponMesh = weaponTemplate.clone(true);
    weaponMesh.scale.setScalar(0.095);
    weaponMesh.rotation.set(0, Math.PI, 0);
    weaponMesh.position.set(0, -0.04, 0);
    weaponMesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; if(o.material){ o.material.metalness=0.35; o.material.roughness=0.45; }}});
    viewWeapon.add(weaponMesh);
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0.05,-1.05);
  } else {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.55), new THREE.MeshStandardMaterial({ color:0x1a2a44, metalness:0.7, roughness:0.35 }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.65,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:0.6, metalness:0.8, roughness:0.2 }));
    barrel.rotation.x=Math.PI/2; barrel.position.set(0,0,-0.55);
    g.add(body); g.add(barrel);
    viewWeapon.add(g);
    weaponMesh=g;
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0,-0.9);
  }
  // subtle emissive glow
  const glow = new THREE.PointLight(0x7af2ff, 6, 3);
  glow.position.set(0,0,-0.7);
  viewWeapon.add(glow);
  // Halo-style muzzle flash: additive cone + core sprite + point light at barrel tip
  muzzleFlash = new THREE.Group();
  muzzleFlash.position.set(0, -0.02, -0.88);
  viewWeapon.add(muzzleFlash);
  const coneGeo = new THREE.ConeGeometry(0.11, 0.26, 12, 1, true);
  coneGeo.rotateX(-Math.PI/2);
  coneGeo.translate(0,0,-0.13);
  muzzleCore = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color:0xfff0a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
  muzzleFlash.add(muzzleCore);
  const ringGeo = new THREE.RingGeometry(0.03, 0.085, 12);
  // ring faces forward
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
  ring.position.set(0,0,-0.18);
  ring.lookAt(0,0,-1);
  ring.userData.isRing=true;
  muzzleFlash.add(ring);
  muzzleLight = new THREE.PointLight(0x8ef0ff, 0, 4.5);
  muzzleLight.intensity=0;
  muzzleLight.position.set(0,0,-0.88);
  viewWeapon.add(muzzleLight);
}

// game state
let health=100, shield=50, score=0, wave=1, enemiesAlive=0, alive=true, started=false, time=0;
let heat=0, overheat=false;
const maxHealth=100, maxShield=50;
let kills=0, damageDealt=0;
let keys={}, sprint=false;
let velocity = new THREE.Vector3();
let dashCooldown=0, dashTime=0;
let enemyList=[], bulletList=[], particleList=[], pickupList=[];
let waveTimer=60, spawnCooldown=0;

function updateHUD(){
  hpEl.textContent=Math.ceil(health);
  shieldEl.textContent=Math.ceil(shield);
  hpbar.style.width = (health/maxHealth*100)+'%';
  shieldbar.style.width = (shield/maxShield*100)+'%';
  scoreEl.textContent=score;
  waveEl.textContent=wave;
  enemiesEl.textContent=enemyList.length;
}

function flashHit(){ hitEl.classList.remove('show'); void hitEl.offsetWidth; hitEl.classList.add('show'); }

// input
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=true;
  if(e.code==='KeyR') resetGame();
  if(e.code==='Space'){ e.preventDefault(); tryDash(); }
});
addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=false;
});
canvas.addEventListener('click', ()=>{
  if(!started) return;
  if(!pointerLocked) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', ()=>{
  pointerLocked = document.pointerLockElement===canvas;
});
addEventListener('mousemove', e=>{
  if(!started) return;
  const sens=0.0022;
  if(pointerLocked){
    yaw -= e.movementX*sens;
    pitch -= e.movementY*sens;
    // weapon inertia — push opposite to look, clamped like Halo
    swayTX += THREE.MathUtils.clamp(e.movementX*0.00055, -0.06, 0.06);
    swayTY += THREE.MathUtils.clamp(e.movementY*0.00055, -0.045, 0.045);
    swayTX = THREE.MathUtils.clamp(swayTX,-0.09,0.09);
    swayTY = THREE.MathUtils.clamp(swayTY,-0.07,0.07);
  } else if(e.buttons===1 && /Mobi|Android/i.test(navigator.userAgent)){
    yaw -= e.movementX*sens*1.2;
    pitch -= e.movementY*sens*1.2;
  }
  pitch=Math.max(-1.35,Math.min(1.35,pitch));
});

// mobile joystick
const joy=document.getElementById('joy'), stick=document.getElementById('stick'), mFire=document.getElementById('mFire'), mDash=document.getElementById('mDash'), mobileWrap=document.getElementById('mobile');
let joyVec={x:0,y:0}, joyActive=false, touchLookId=null, lastTouchX=0, lastTouchY=0;
function isMobile(){ return /Mobi|Android/i.test(navigator.userAgent) || innerWidth<700; }
if(isMobile()){ mobileWrap.style.display='flex'; }
function joyPos(e){
  const r=joy.getBoundingClientRect(); const t=e.touches?e.touches[0]:e;
  const x=t.clientX-(r.left+r.width/2), y=t.clientY-(r.top+r.height/2);
  const d=Math.hypot(x,y), max=44; const c=Math.min(1,d/max);
  const nx=d?x/d:0, ny=d?y/d:0;
  joyVec.x=nx*c; joyVec.y=ny*c;
  stick.style.transform=`translate(calc(-50% + ${nx*c*max}px), calc(-50% + ${ny*c*max}px))`;
}
joy.addEventListener('touchstart', e=>{ joyActive=true; joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchmove', e=>{ if(joyActive) joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchend', ()=>{ joyActive=false; joyVec={x:0,y:0}; stick.style.transform='translate(-50%,-50%)'; });
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){
    const t=e.touches[0];
    if(t.clientX>innerWidth*0.35) { lastTouchX=t.clientX; lastTouchY=t.clientY; touchLookId=t.identifier; }
  }
});
canvas.addEventListener('touchmove', e=>{
  for(const t of e.touches){ if(t.identifier===touchLookId){
    const dx=t.clientX-lastTouchX, dy=t.clientY-lastTouchY;
    yaw -= dx*0.004; pitch -= dy*0.004; pitch=Math.max(-1.3,Math.min(1.3,pitch));
    lastTouchX=t.clientX; lastTouchY=t.clientY;
  }}
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend', e=>{
  for(const t of e.changedTouches) if(t.identifier===touchLookId) touchLookId=null;
});
let fireHeld=false;
mFire.addEventListener('touchstart', e=>{ fireHeld=true; e.preventDefault(); },{passive:false});
mFire.addEventListener('touchend', ()=> fireHeld=false);
mDash.addEventListener('touchstart', e=>{ tryDash(); e.preventDefault(); },{passive:false});

// utility
function clampToArena(v){
  const d=Math.hypot(v.x,v.z);
  if(d>arenaRadius-1.1){
    const s=(arenaRadius-1.1)/d; v.x*=s; v.z*=s;
  }
  // crate collision simple push
  for(const c of crates){
    const dx=v.x-c.position.x, dz=v.z-c.position.z;
    const dist=Math.hypot(dx,dz);
    const min = 1.0 + c.userData.radius;
    if(dist<min && dist>0.01){
      const push=(min-dist)/dist;
      v.x += dx*push*0.9; v.z += dz*push*0.9;
    }
  }
}

function tryDash(){
  if(dashCooldown>0 || !alive || !started) return;
  const dir=new THREE.Vector3();
  if(keys['KeyW']) dir.z-=1; if(keys['KeyS']) dir.z+=1; if(keys['KeyA']) dir.x-=1; if(keys['KeyD']) dir.x+=1;
  if(joyVec.x||joyVec.y){ dir.x=joyVec.x; dir.z=joyVec.y; }
  if(dir.length()<0.1){
    dir.set(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-1);
  }
  dir.normalize();
  // apply yaw
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const world = new THREE.Vector3().addScaledVector(right, dir.x).addScaledVector(fwd, dir.z);
  world.normalize();
  dashTime=0.22; dashCooldown=1.1;
  velocity.addScaledVector(world, 18);
  // i-frame hint
  camHolder.position.y=1.75;
  setTimeout(()=> camHolder.position.y=1.7, 120);
}

function spawnEnemy(){
  const ang=Math.random()*Math.PI*2;
  const r= arenaRadius-2.5;
  const pos=new THREE.Vector3(Math.cos(ang)*r,0, Math.sin(ang)*r);
  let mesh;
  if(robotTemplate){
    mesh = robotTemplate.clone(true);
    mesh.scale.setScalar(0.85);
    mesh.rotation.y=ang+Math.PI;
    // per-instance material jitter so swarm not uniform clay — envMap response varies per drone
    const hueShift = (Math.random()-0.5)*0.04;
    const valShift = (Math.random()-0.5)*0.08;
    mesh.traverse(o=>{
      if(!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map(m=>{
        if(!m || !m.clone) return m;
        const nm = m.clone();
        // subtle per-instance variation
        if(nm.color){
          const hsl={}; nm.color.getHSL(hsl);
          nm.color.setHSL(THREE.MathUtils.clamp(hsl.h+hueShift,0,1), hsl.s, THREE.MathUtils.clamp(hsl.l+valShift,0,1));
        }
        // ensure envMap still hooked (scene.environment will propagate, but set intensity)
        nm.envMapIntensity = 1.25;
        // keep base refs for flash
        nm.userData = nm.userData || {};
        if(nm.userData.baseIntensity===undefined) nm.userData.baseIntensity = nm.emissiveIntensity ?? 0.08;
        if(nm.userData.baseEmissive===undefined) nm.userData.baseEmissive = nm.emissive ? nm.emissive.getHex() : 0x0e1a2a;
        return nm;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
  } else {
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45,1.1,8,12), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff1a5a, emissiveIntensity:0.35, roughness:0.5, metalness:0.2 }));
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:2 }));
    eye.position.set(0,0.55,0.35); mesh.add(eye);
    mesh.castShadow=true;
  }
  const g=new THREE.Group();
  g.add(mesh);
  g.position.copy(pos);
  g.position.y=0.7;
  // contact shadow blob — stronger for readability vs bright floor
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.62,16), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.42 }));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=-0.68;
  shadow.renderOrder = 1;
  g.add(shadow);
  // subtle rim flash light per enemy for hit feedback (inactive until hit)
  const flashLight = new THREE.PointLight(0xff5a3b, 0, 3.2);
  flashLight.position.set(0,1.0,0);
  g.add(flashLight);
  g.userData={ hp: 3 + Math.floor(wave*0.7), maxHp:3+Math.floor(wave*0.7), speed: 2.1 + wave*0.18 + Math.random()*0.6, mesh, ang, hitFlash:0, flashLight, shadow };
  scene.add(g);
  enemyList.push(g);
}

function spawnPickup(pos, type){
  const geo = new THREE.IcosahedronGeometry(0.28,0);
  const mat = new THREE.MeshStandardMaterial({ color: type==='shield'?0x7af2ff:0xff5a8f, emissive: type==='shield'?0x00c8ff:0xff1a5a, emissiveIntensity:1.2, metalness:0.4, roughness:0.3 });
  const m=new THREE.Mesh(geo,mat);
  m.position.copy(pos); m.position.y=0.5;
  m.userData={ type, t:0, bob:Math.random()*Math.PI*2 };
  const light=new THREE.PointLight(mat.color, 6, 5);
  light.position.copy(m.position);
  m.userData.light=light;
  scene.add(m); scene.add(light);
  pickupList.push(m);
}

function shoot(){
  if(!alive || !started) return;
  if(overheat) return;
  if(heat>0.92) { overheat=true; setTimeout(()=> overheat=false, 900); return; }
  heat = Math.min(1, heat+0.085);
  // Halo-like recoil + view kick (crunchy, recoverable)
  recoilKick = 1.0;
  recoilYaw = (Math.random()-0.5)*0.12;
  pitch = Math.max(-1.35, Math.min(1.35, pitch + 0.008));
  flashTime = 0.09;
  shakeTime = 0.09;
  if(muzzleLight) muzzleLight.intensity = 18;
  if(muzzleCore){ muzzleCore.material.opacity=1; muzzleCore.scale.set(0.9+Math.random()*0.25,0.9+Math.random()*0.25,1); }
  if(muzzleFlash){
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing){ c.material.opacity=0.95; c.scale.setScalar(0.85+Math.random()*0.2); }});
    muzzleFlash.rotation.z = Math.random()*Math.PI;
  }
  // ray
  const origin = new THREE.Vector3().copy(camRig.position); origin.y=1.7;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0))).normalize();
  // bullet tracer — Halo bright additive streak
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,1.4,6), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending }));
  const mid = origin.clone().addScaledVector(dir, 5.5);
  tracer.position.copy(mid);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  tracer.scale.y=5.2;
  tracer.userData={ life:0.06, vel:new THREE.Vector3(0,0,0) };
  scene.add(tracer); particleList.push(tracer);
  // eject brass (tiny) — view space
  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.07,6), new THREE.MeshStandardMaterial({ color:0xc8a44a, metalness:0.6, roughness:0.4 }));
  brass.position.copy(origin).addScaledVector(dir, 0.3).add(new THREE.Vector3(0.16,-0.12,0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0))));
  brass.userData={ vel:new THREE.Vector3((Math.random()-0.5)*2+0.6, 2+Math.random()*1.2, (Math.random()-0.5)*1.2), life:0.55, isBrass:true };
  scene.add(brass); particleList.push(brass);
  // hit test enemies
  let hit=null, hitDist=1e9, hitPos=null;
  for(const e of enemyList){
    const to = new THREE.Vector3().subVectors(e.position, origin);
    const proj = to.dot(dir);
    if(proj<0 || proj>42) continue;
    const closest = origin.clone().addScaledVector(dir, proj);
    const dist = closest.distanceTo(e.position);
    if(dist<0.85 && proj<hitDist){ hit=e; hitDist=proj; hitPos=closest; }
  }
  // wall hit fallback
  if(hit){
    hit.userData.hp -=1;
    hit.userData.hitFlash=0.18;
    damageDealt+=1;
    // knockback
    hit.position.addScaledVector(dir, 0.35);
    flashHit();
    score+= (hit.userData.hp<=0? 50:10);
    if(hit.userData.hp<=0){
      // death
      kills++;
      score+=20;
      // explosion
      for(let i=0;i<8;i++){
        const p=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshStandardMaterial({ color:0xff8a3b, emissive:0xff3b82, emissiveIntensity:1 }));
        p.position.copy(hit.position); p.position.y+=0.5;
        p.userData={ vel:new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4+1, (Math.random()-0.5)*6), life:0.5+Math.random()*0.4 };
        scene.add(p); particleList.push(p);
      }
      if(Math.random()<0.35) spawnPickup(hit.position.clone(), Math.random()<0.5?'shield':'health');
      scene.remove(hit); enemyList.splice(enemyList.indexOf(hit),1);
      // ring pulse
      reactor.scale.set(1.2,1.2,1.2); setTimeout(()=> reactor.scale.set(1,1,1), 120);
    }
    // Halo hitmarker + impact sparks at hitPos
    const isKill = hit.userData.hp<=0;
    // show crosshair hit feedback
    hitEl.textContent = isKill ? 'ELIMINATED' : 'HIT';
    hitEl.style.color = isKill ? '#ffd166' : '#7af2ff';
    flashHit();
    // spark burst
    for(let i=0;i<5;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.035,5,5), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.95 }));
      s.position.copy(hitPos);
      const spread = new THREE.Vector3((Math.random()-0.5)*1, (Math.random()-0.5)*1 +0.3, (Math.random()-0.5)*1);
      spread.addScaledVector(dir, -0.5 + Math.random()*0.5);
      s.userData={ vel: spread.multiplyScalar(3.5), life:0.22+Math.random()*0.12, isSpark:true };
      scene.add(s); particleList.push(s);
    }
    // impact ring decal
    const decal = new THREE.Mesh(new THREE.RingGeometry(0.12,0.18,12), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    decal.position.copy(hitPos);
    decal.lookAt(hitPos.clone().add(dir));
    decal.userData={ life:0.14, isDecal:true };
    scene.add(decal); particleList.push(decal);
  } else {
    const far = origin.clone().addScaledVector(dir, 18);
    if(far.length()>arenaRadius) far.normalize().multiplyScalar(arenaRadius-0.3);
    // wall spark burst
    for(let i=0;i<4;i++){
      const sp=new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.9 }));
      sp.position.copy(far); sp.position.y=0.22;
      sp.userData={ vel:new THREE.Vector3((Math.random()-0.5)*3, Math.random()*2, (Math.random()-0.5)*3).addScaledVector(dir, -0.8), life:0.2+Math.random()*0.1, isSpark:true };
      scene.add(sp); particleList.push(sp);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.1,0.16,12), new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
    ring.position.copy(far); ring.position.y=0.04; ring.rotation.x=-Math.PI/2;
    ring.userData={ life:0.18, isDecal:true };
    scene.add(ring); particleList.push(ring);
  }
  updateHUD();
}

// firing loop
let fireCooldown=0;
addEventListener('mousedown', e=>{ if(e.button===0 && started) { if(!pointerLocked) canvas.requestPointerLock?.(); else shoot(); }});
let isMouseDown=false;
addEventListener('mousedown', e=>{ if(e.button===0) isMouseDown=true; });
addEventListener('mouseup', e=>{ if(e.button===0) isMouseDown=false; });

function handleInput(dt){
  if(!alive || !started) return;
  const speed = sprint? 5.6: 3.4;
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let move=new THREE.Vector3();
  if(keys['KeyW']) move.addScaledVector(fwd, -1);
  if(keys['KeyS']) move.addScaledVector(fwd, 1);
  if(keys['KeyA']) move.addScaledVector(right, -1);
  if(keys['KeyD']) move.addScaledVector(right, 1);
  if(joyVec.x||joyVec.y){
    move.addScaledVector(right, joyVec.x);
    move.addScaledVector(fwd, joyVec.y);
  }
  if(move.length()>0) move.normalize().multiplyScalar(speed*dt);
  // dash
  if(dashTime>0){ move.addScaledVector(velocity, dt); dashTime-=dt; }
  // apply
  const next = camRig.position.clone().add(move);
  next.y=1.7;
  clampToArena(next);
  camRig.position.copy(next);
  // heat decay
  heat = Math.max(0, heat - dt*0.55);
  if(heat<0.15) overheat=false;
  // recoil spring (Halo snap + recover)
  recoilKick = Math.max(0, recoilKick - dt*6.5);
  recoilYaw *= Math.pow(0.85, dt*60);
  flashTime = Math.max(0, flashTime - dt);
  shakeTime = Math.max(0, shakeTime - dt);
  if(muzzleLight){
    muzzleLight.intensity = flashTime>0 ? 16*(flashTime/0.09) : 0;
    if(muzzleCore) muzzleCore.material.opacity = flashTime>0 ? Math.pow(flashTime/0.09, 0.7) : 0;
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing) c.material.opacity = flashTime>0 ? (flashTime/0.09) : 0; });
  }
  // subtle screenshake on fire
  if(shakeTime>0){
    camera.position.x = (Math.random()-0.5)*0.025*(shakeTime/0.09);
    camera.position.y = (Math.random()-0.5)*0.02*(shakeTime/0.09);
  } else {
    camera.position.set(0,1.7,0);
  }
  // inertia sway spring (look lag) + breathing
  swayTX *= Math.pow(0.86, dt*60);
  swayTY *= Math.pow(0.86, dt*60);
  swayX += (swayTX - swayX) * dt * 9;
  swayY += (swayTY - swayY) * dt * 9;
  // add movement-induced sway (strafe leans weapon)
  const strafeIn = (keys['KeyA']?1:0)-(keys['KeyD']?1:0) + joyVec.x;
  swayTX += strafeIn * dt * 0.18;
  const breathY = Math.sin(time*1.05)*0.006 + Math.sin(time*0.62)*0.004;
  const breathX = Math.cos(time*0.9)*0.004;
  // view bob + recoil + sway (viewmodel stays grounded like Halo)
  const moving = move.length()>0.001;
  const kickZ = recoilKick * 0.14;
  const kickY = recoilKick * 0.035;
  const kickPitch = recoilKick * 0.22;
  viewWeapon.position.x = baseWeaponPos.x + Math.sin(time*9)*(moving?0.012:0.004) + recoilYaw*0.08 - swayX*0.55 + breathX*(moving?0.2:1);
  viewWeapon.position.y = baseWeaponPos.y + Math.abs(Math.sin(time*18))*(moving?0.012:0.003) - kickY - swayY*0.45 + breathY*(moving?0.3:1);
  viewWeapon.position.z = baseWeaponPos.z - kickZ + Math.abs(swayX)*0.06;
  viewWeapon.rotation.x = baseWeaponRot.x - kickPitch + swayY*1.1 + breathY*0.6 + (overheat ? -0.15 : 0);
  viewWeapon.rotation.y = baseWeaponRot.y + recoilYaw*0.6 - swayX*1.3;
  viewWeapon.rotation.z = Math.sin(time*6)*(moving?0.03:0.01) - recoilYaw*0.4 - swayX*0.9;
}

function updateEnemies(dt){
  for(const e of enemyList){
    const toPlayer = new THREE.Vector3().subVectors(camRig.position, e.position);
    toPlayer.y=0;
    const dist=toPlayer.length();
    if(dist>0.1){ toPlayer.normalize().multiplyScalar(e.userData.speed*dt); }
    // simple avoidance among enemies
    for(const o of enemyList) if(o!==e){
      const d=e.position.distanceTo(o.position);
      if(d<1.2){ const push=new THREE.Vector3().subVectors(e.position,o.position).normalize().multiplyScalar((1.2-d)*dt*2); e.position.add(push); }
    }
    // move towards player but respect crates
    const next = e.position.clone().add(toPlayer);
    // crate push
    for(const c of crates){
      const dx=next.x-c.position.x, dz=next.z-c.position.z;
      const dd=Math.hypot(dx,dz);
      if(dd<1.05 + c.userData.radius){
        const nx=dx/(dd||1), nz=dz/(dd||1);
        next.x = c.position.x + nx*(1.05+c.userData.radius);
        next.z = c.position.z + nz*(1.05+c.userData.radius);
      }
    }
    const nd=Math.hypot(next.x,next.z);
    if(nd<arenaRadius-1) e.position.copy(next);
    else e.position.addScaledVector(toPlayer, -0.5*dt);
    // face player
    e.lookAt(camRig.position.x, e.position.y, camRig.position.z);
    e.rotation.y+=Math.PI;
    // hit flash — subtle warm emissive pulse + visor flare, decays fast so not flat clay
    if(e.userData.hitFlash>0){
      e.userData.hitFlash-=dt;
      const t = Math.max(0, e.userData.hitFlash/0.18);
      // point light flash fades
      if(e.userData.flashLight) e.userData.flashLight.intensity = t * 6.0;
      e.traverse(o=>{
        if(!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{
          if(!m.emissive) return;
          const isVisor = /eye|visor|optic|lens/i.test((o.name+' '+(m.name||'')).toLowerCase());
          const base = m.userData?.baseIntensity ?? (isVisor?1.6:0.08);
          const flash = isVisor ? base + t*2.2 : base + t*1.4;
          m.emissiveIntensity = flash;
          // warm flash color lerp
          if(t>0.01){
            const flashCol = new THREE.Color(0xff3b2e);
            const baseCol = new THREE.Color(m.userData?.baseEmissive ?? 0x0e1a2a);
            if(!isVisor) m.emissive.lerpColors(baseCol, flashCol, t*0.85);
          }
        });
      });
      if(e.userData.hitFlash<=0){
        // restore base
        e.traverse(o=>{
          if(!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m=>{
            if(m.userData){
              if(m.userData.baseIntensity!==undefined) m.emissiveIntensity = m.userData.baseIntensity;
              if(m.userData.baseEmissive!==undefined) m.emissive.setHex(m.userData.baseEmissive);
            }
          });
        });
        if(e.userData.flashLight) e.userData.flashLight.intensity = 0;
      }
    } else {
      // idle subtle visor pulse so robot reads against bright floor
      e.traverse(o=>{
        if(!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{
          const isVisor = /eye|visor|optic|lens/i.test((o.name+' '+(m.name||'')).toLowerCase());
          if(isVisor && m.userData){
            m.emissiveIntensity = m.userData.baseIntensity + Math.sin(time*3.2 + e.userData.ang)*0.18;
          }
        });
      });
    }
    // scale contact shadow with height (fake AO)
    if(e.userData.shadow){
      const s = 1.0 - Math.min(0.25, Math.abs(Math.sin(time*2 + e.userData.ang))*0.06);
      e.userData.shadow.scale.setScalar(s);
      e.userData.shadow.material.opacity = 0.42 * (0.9 + 0.1*Math.sin(time*2));
    }
    // attack if close
    if(dist<1.35 && dashTime<=0){
      // damage with cooldown per enemy
      e.userData.cooldown = (e.userData.cooldown||0)-dt;
      if(e.userData.cooldown<=0){
        const dmg = 8 + wave*1.2;
        if(shield>0){ const absorb=Math.min(shield,dmg); shield-=absorb; const rem=dmg-absorb; health-=rem; } else health-=dmg;
        e.userData.cooldown=0.9;
        camHolder.position.x = (Math.random()-0.5)*0.12;
        setTimeout(()=> camHolder.position.x=0, 80);
        // hurt vignette via flash
        document.body.style.boxShadow='inset 0 0 80px rgba(255,59,130,.6)';
        setTimeout(()=> document.body.style.boxShadow='', 120);
        updateHUD();
        if(health<=0){ health=0; alive=false; deadScreen.style.display='flex'; document.getElementById('deadStats').textContent=`Score ${score} · Wave ${wave} · Kills ${kills} · Time ${Math.floor(time)}s`; document.exitPointerLock?.(); }
      }
    }
  }
}

function updatePickups(dt){
  for(let i=pickupList.length-1;i>=0;i--){
    const p=pickupList[i];
    p.userData.t+=dt;
    p.rotation.y+=dt*2.2;
    p.position.y=0.5+Math.sin(p.userData.t*2.6 + p.userData.bob)*0.18;
    p.userData.light.position.copy(p.position);
    const d=p.position.distanceTo(camRig.position);
    if(d<1.1){
      if(p.userData.type==='health'){ health=Math.min(maxHealth, health+28); }
      else { shield=Math.min(maxShield, shield+22); }
      score+=15;
      scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); updateHUD();
      // pickup flash
      const f=new THREE.Mesh(new THREE.RingGeometry(0.5,0.7,16), new THREE.MeshBasicMaterial({ color: p.userData.type==='health'?0xff5a8f:0x7af2ff, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
      f.rotation.x=-Math.PI/2; f.position.copy(camRig.position); f.position.y=0.05; scene.add(f);
      let t=0; const iv=setInterval(()=>{ t+=0.05; f.scale.setScalar(1+t*2); f.material.opacity-=0.07; if(f.material.opacity<=0){ scene.remove(f); clearInterval(iv);} },16);
    }
    if(p.userData.t>14){ scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); }
  }
}

function updateParticles(dt){
  for(let i=particleList.length-1;i>=0;i--){
    const p=particleList[i];
    if(p.userData.vel){
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y -= 9.8*dt*0.6;
      p.userData.vel.multiplyScalar(0.98);
      if(p.userData.isBrass) p.rotation.x += dt*12;
    }
    p.userData.life-=dt;
    if(p.material){
      p.material.transparent=true;
      if(p.userData.isDecal){
        p.material.opacity = Math.max(0, p.userData.life*3.5);
        p.scale.setScalar(1 + (0.18 - p.userData.life)*1.2);
      } else if(p.userData.isSpark){
        p.material.opacity = Math.max(0, p.userData.life*4);
      } else {
        p.material.opacity = Math.max(0, p.userData.life*1.5);
        if(!p.userData.isBrass) p.scale.setScalar(1 - p.userData.life*0.2);
      }
    }
    if(p.userData.life<=0){ scene.remove(p); particleList.splice(i,1); }
  }
}

function updateWave(dt){
  waveTimer-=dt;
  spawnCooldown-=dt;
  if(spawnCooldown<=0 && enemyList.length < 3+wave*1.8){
    spawnEnemy();
    spawnCooldown= 1.6 - Math.min(1.0, wave*0.12) + Math.random()*0.7;
  }
  if(waveTimer<=0){
    wave++;
    waveTimer=60;
    waveEl.textContent=wave;
    waveBanner.textContent=`WAVE ${wave} — REINFORCEMENTS INBOUND`;
    waveBanner.style.background='rgba(255,59,130,.18)';
    waveBanner.style.borderColor='rgba(255,59,130,.5)';
    waveBanner.style.color='#ff8a8f';
    setTimeout(()=>{ waveBanner.style.background=''; waveBanner.style.borderColor=''; waveBanner.style.color=''; waveBanner.textContent=`WAVE ${wave}`; },2200);
    updateHUD();
    if(wave>3){
      alive=false; wonScreen.style.display='flex'; document.getElementById('wonStats').textContent=`Score ${score} · Kills ${kills} · Perfect arena hold — extraction ready.`;
      document.exitPointerLock?.();
    }
  } else {
    waveBanner.textContent=`WAVE ${wave} — ${Math.ceil(waveTimer)}s`;
  }
  // reactor pulse
  const s=1+Math.sin(time*2.2)*0.03;
  reactor.scale.set(s,s,s);
  coreGlow.material.emissiveIntensity=1.2+Math.sin(time*3)*0.3;
  // subtle point lights — dimmed to not wash bright day
  pink.intensity=2+Math.sin(time*1.3)*0.5;
  blue2.intensity=1+Math.cos(time*1.1)*0.4;
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.033, (performance.now()-(animate._last||performance.now()))/1000);
  animate._last=performance.now();
  if(started && alive) time+=dt;
  // camera rig rotation
  camRig.rotation.y=yaw;
  camera.rotation.x=pitch;
  camera.rotation.y=0; camera.rotation.z=0;
  if(started && alive){
    handleInput(dt);
    // auto fire if held
    fireCooldown-=dt;
    if((isMouseDown || fireHeld) && fireCooldown<=0){ shoot(); fireCooldown=0.11; }
    if(dashCooldown>0) dashCooldown-=dt;
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateWave(dt);
  }
  renderer.render(scene,camera);
}

function resetGame(){
  health=100; shield=50; score=0; wave=1; time=0; heat=0; overheat=false; alive=true;
  kills=0; waveTimer=60; enemyList.forEach(e=>scene.remove(e)); enemyList=[]; particleList.forEach(p=>scene.remove(p)); particleList=[]; pickupList.forEach(p=>{scene.remove(p); scene.remove(p.userData.light)}); pickupList=[];
  camRig.position.set(0,1.7,8); yaw=0; pitch=0;
  deadScreen.style.display='none'; wonScreen.style.display='none';
  updateHUD();
}

// attribution
async function setAttrib(){
  try{
    const [r,c,w]=await Promise.all([
      fetch('/models/robot.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/crate.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/weapon.glb.attribution.json').then(r=>r.json()).catch(()=>null),
    ]);
    const parts=[];
    if(r) parts.push(`Enemy: "${r.name}" by ${r.author} — <a href="${r.modelUrl}" target="_blank">${r.license}</a>`);
    if(c) parts.push(`Crate: "${c.name}" by ${c.author} — <a href="${c.modelUrl}" target="_blank">${c.license}</a>`);
    if(w) parts.push(`Weapon: "${w.name}" by ${w.author} — <a href="${w.modelUrl}" target="_blank">${w.license}</a>`);
    attrib.innerHTML=parts.join('<br>');
  }catch{}
}

// init
(async()=>{
  await loadModels();
  setupWeapon();
  setAttrib();
  updateHUD();
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  // generate envMap after first paint (sky/floor present) so robot metals reflect
  requestAnimationFrame(()=> requestAnimationFrame(()=> updateEnvMap()));
  animate();
  document.getElementById('playBtn').addEventListener('click', ()=>{
    started=true; overlay.style.display='none';
    canvas.requestPointerLock?.();
    // spawn initial
    for(let i=0;i<2;i++) spawnEnemy();
  });
  document.getElementById('howBtn').addEventListener('click', ()=>{
    const h=document.getElementById('how'); h.style.display=h.style.display==='none'?'block':'none';
  });
  // allow click on overlay to start as well
  overlay.addEventListener('click', e=>{ if(e.target===overlay) document.getElementById('playBtn').click(); });
})();

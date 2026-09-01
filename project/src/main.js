import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('canvas');
const startOverlay = document.getElementById('startOverlay');
const endOverlay = document.getElementById('endOverlay');
const playBtn = document.getElementById('playBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');
const scoreEl = document.getElementById('scoreEl');
const waveEl = document.getElementById('waveEl');
const enemiesEl = document.getElementById('enemiesEl');
const ammoEl = document.getElementById('ammoEl');
const reserveEl = document.getElementById('reserveEl');
const killsEl = document.getElementById('killsEl');
const statusEl = document.getElementById('statusEl');
const reloadHint = document.getElementById('reloadHint');
const vignette = document.getElementById('vignette');
const hitMarker = document.getElementById('hitMarker');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1e38);
scene.fog = new THREE.Fog(0x0a1e38, 18, 48);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0,1.7,8);

const loader = new GLTFLoader();

// ---- Lighting — BLACKSITE containment look ----
scene.add(new THREE.HemisphereLight(0x9ed8ff, 0x071220, 0.62));
const dir = new THREE.DirectionalLight(0xffffff, 1.65);
dir.position.set(10,14,6);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 0.5; dir.shadow.camera.far = 55;
dir.shadow.camera.left=-18; dir.shadow.camera.right=18; dir.shadow.camera.top=18; dir.shadow.camera.bottom=-18;
dir.shadow.bias = -0.0004;
scene.add(dir);
const fill = new THREE.DirectionalLight(0x00f0ff, 0.32);
fill.position.set(-9,7,-11);
scene.add(fill);
const pCore = new THREE.PointLight(0x00f0ff, 1.1, 20); pCore.position.set(0,3.0,0); scene.add(pCore);
const pRed = new THREE.PointLight(0xff1133, 1.35, 16); pRed.position.set(12,2.4,7); scene.add(pRed);
const pRed2 = new THREE.PointLight(0xff1133, 0.9, 14); pRed2.position.set(-12,2.2,-9); scene.add(pRed2);
scene.add(new THREE.AmbientLight(0x0a1e38, 0.55));

// helpers to create hazard canvas texture
function makeHazardTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=128;
  const g=c.getContext('2d');
  g.fillStyle='#0a0a0a'; g.fillRect(0,0,512,128);
  const stripeW=42;
  for(let x=-128;x<640;x+=stripeW*2){
    g.save(); g.translate(x,64); g.rotate(Math.PI/4);
    g.fillStyle='#ffcc00'; g.fillRect(-60,-80,stripeW,220);
    g.restore();
  }
  g.fillStyle='rgba(0,0,0,0.18)'; g.fillRect(0,0,512,8); g.fillRect(0,120,512,8);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=THREE.RepeatWrapping; tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(6,1); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4; return tex;
}
function makeFloorMarkTexture(){
  const c=document.createElement('canvas'); c.width=1024; c.height=1024;
  const g=c.getContext('2d');
  g.fillStyle='#1a2f4a'; g.fillRect(0,0,1024,1024);
  // subtle concrete noise
  for(let i=0;i<9000;i++){ const x=Math.random()*1024,y=Math.random()*1024,a=Math.random()*0.07; g.fillStyle=`rgba(255,255,255,${a})`; g.fillRect(x,y,1.5,1.5); }
  // panel lines
  g.strokeStyle='rgba(0,240,255,0.07)'; g.lineWidth=2;
  for(let x=0;x<=1024;x+=128){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,1024); g.stroke(); }
  for(let y=0;y<=1024;y+=128){ g.beginPath(); g.moveTo(0,y); g.lineTo(1024,y); g.stroke(); }
  // center ring
  g.strokeStyle='rgba(0,240,255,0.22)'; g.lineWidth=4; g.beginPath(); g.arc(512,512,210,0,Math.PI*2); g.stroke();
  g.strokeStyle='rgba(255,40,60,0.18)'; g.lineWidth=2; g.beginPath(); g.arc(512,512,220,0,Math.PI*2); g.stroke();
  g.strokeStyle='rgba(0,240,255,0.14)'; g.lineWidth=2; g.beginPath(); g.arc(512,512,150,0,Math.PI*2); g.stroke();
  // SECTOR 07 text
  g.fillStyle='rgba(0,240,255,0.9)'; g.font='700 54px Orbitron, monospace'; g.textAlign='center';
  g.fillText('SECTOR 07',512,498);
  g.fillStyle='rgba(255,60,70,0.85)'; g.font='400 18px JetBrains Mono, monospace'; g.letterSpacing='6px';
  g.fillText('CONTAINMENT  //  KEEP CLEAR',512,528);
  g.fillStyle='rgba(255,255,255,0.06)'; g.font='700 120px Orbitron, monospace'; g.fillText('07',512,760);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4; return tex;
}
function makeWallDecalTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=256;
  const g=c.getContext('2d');
  g.fillStyle='#0b1e33'; g.fillRect(0,0,512,256);
  g.fillStyle='rgba(0,240,255,0.9)'; g.font='800 46px Orbitron, monospace'; g.fillText('BLACKSITE',18,56);
  g.fillStyle='rgba(140,180,200,0.9)'; g.font='11px JetBrains Mono, monospace'; g.fillText('PROTOCOL  //  SECTOR 07  //  BIOHAZARD CONTAINMENT',18,78);
  g.strokeStyle='rgba(0,240,255,0.22)'; g.lineWidth=2; g.strokeRect(12,12,488,232);
  g.fillStyle='#ffcc00'; g.fillRect(14,210,100,10); g.fillStyle='#111'; g.fillRect(14,225,100,6);
  // hazard mini
  for(let i=0;i<6;i++){ g.fillStyle=i%2?'#ffcc00':'#111'; g.beginPath(); g.moveTo(360+i*22,200); g.lineTo(370+i*22,228); g.lineTo(350+i*22,228); g.fill(); }
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; return tex;
}

// Floor — PBR + markings
const floorMarkTex = makeFloorMarkTexture();
const floorMat = new THREE.MeshStandardMaterial({ map: floorMarkTex, roughness:0.72, metalness:0.12 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(32,32), floorMat);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(32, 32, 0x00f0ff, 0x0e2e4a);
grid.position.y = 0.015;
scene.add(grid);
// hazard perimeter ring (thin boxes with hazard texture)
const hazardTex = makeHazardTexture();
const hazMat = new THREE.MeshStandardMaterial({ map:hazardTex, roughness:0.9, metalness:0.04, emissive:0x331a00, emissiveIntensity:0.12 });
for(const [x,z,w,d,ry] of [[0,14.6,28,0.55,0],[0,-14.6,28,0.55,0],[14.6,0,0.55,28,0],[-14.6,0,0.55,28,0]]){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), hazMat);
  m.rotation.x=-Math.PI/2; m.position.set(x,0.02,z); m.receiveShadow=true; scene.add(m);
}
// small floor decals: arrows toward center
function addArrow(x,z,ry){
  const a=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.55), new THREE.MeshBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.18, side:THREE.DoubleSide}));
  a.rotation.x=-Math.PI/2; a.rotation.z=ry; a.position.set(x,0.018,z); scene.add(a);
  const tip=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.5), new THREE.MeshBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.22, side:THREE.DoubleSide}));
  tip.rotation.x=-Math.PI/2; tip.rotation.z=ry; tip.position.set(x+Math.cos(ry)*0.55,0.019,z+Math.sin(ry)*0.55); scene.add(tip);
}
addArrow(-8,0,0); addArrow(8,0,Math.PI); addArrow(0,8,-Math.PI/2); addArrow(0,-8,Math.PI/2);

// Ceiling (dark, with rivets) — gives containment feel and avoids open sky
const ceilMat = new THREE.MeshStandardMaterial({ color:0x0a1626, roughness:0.92, metalness:0.05, side:THREE.DoubleSide });
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(32,32), ceilMat);
ceiling.rotation.x = Math.PI/2;
ceiling.position.y = 5.6;
ceiling.receiveShadow = false;
scene.add(ceiling);
// ceiling light panels
for(let x=-12;x<=12;x+=8){
  for(let z=-12;z<=12;z+=8){
    if(Math.abs(x)<2 && Math.abs(z)<2) continue; // keep center darker (core)
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.42), new THREE.MeshStandardMaterial({ color:0xcff8ff, emissive:0x00f0ff, emissiveIntensity:0.85, side:THREE.DoubleSide }));
    panel.rotation.x=Math.PI/2; panel.position.set(x,5.58,z);
    scene.add(panel);
    const glow=new THREE.PointLight(0x8ef0ff, 0.32, 7); glow.position.set(x,5.0,z); scene.add(glow);
  }
}
// thin ceiling beams
const beamMat=new THREE.MeshStandardMaterial({color:0x0e1f33, roughness:0.85});
for(let i=-16;i<=16;i+=8){
  const bx=new THREE.Mesh(new THREE.BoxGeometry(32,0.14,0.14), beamMat); bx.position.set(0,5.55,i); scene.add(bx);
  const bz=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,32), beamMat); bz.position.set(i,5.55,0); scene.add(bz);
}

// Walls — 32m arena, with trim, pipes, decals, emergency strips
const wallMat = new THREE.MeshStandardMaterial({ color:0x0b1e33, roughness:0.86, metalness:0.12 });
const wallTrimMat = new THREE.MeshStandardMaterial({ color:0x0f2a46, roughness:0.78, metalness:0.18 });
function wall(x,z,w,d){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,5.2,d), wallMat);
  m.position.set(x,2.6,z);
  m.castShadow=true; m.receiveShadow=true;
  scene.add(m);
  // base trim
  const trim=new THREE.Mesh(new THREE.BoxGeometry(w+0.04,0.35,d+0.04), wallTrimMat);
  trim.position.set(x,0.22,z); trim.receiveShadow=true; scene.add(trim);
  // top crown
  const crown=new THREE.Mesh(new THREE.BoxGeometry(w+0.04,0.22,d+0.04), new THREE.MeshStandardMaterial({color:0x142c48}));
  crown.position.set(x,5.08,z); scene.add(crown);
  return m;
}
wall(0,16,32,0.7); wall(0,-16,32,0.7); wall(16,0,0.7,32); wall(-16,0,0.7,32);
// horizontal cyan light strips on each wall
function lightStrip(x,y,z,w,d){
  const s=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,d), new THREE.MeshStandardMaterial({color:0x00f0ff, emissive:0x00f0ff, emissiveIntensity:0.9}));
  s.position.set(x,y,z); scene.add(s);
  const glow=new THREE.PointLight(0x00f0ff, 0.28, 8); glow.position.set(x,y,z); scene.add(glow);
}
lightStrip(0,3.1,15.62,22,0.05); lightStrip(0,3.1,-15.62,22,0.05);
lightStrip(15.62,3.1,0,0.05,22); lightStrip(-15.62,3.1,0,0.05,22);
// red emergency strips low
function redStrip(x,y,z,w,d){
  const s=new THREE.Mesh(new THREE.BoxGeometry(w,0.04,d), new THREE.MeshStandardMaterial({color:0xff2233, emissive:0xff2233, emissiveIntensity:0.75}));
  s.position.set(x,y,z); scene.add(s);
}
redStrip(0,1.05,15.63,18,0.04); redStrip(0,1.05,-15.63,18,0.04);
redStrip(15.63,1.05,0,0.04,18); redStrip(-15.63,1.05,0,0.04,18);
// wall pipes
const pipeMat=new THREE.MeshStandardMaterial({color:0x1a2f4a, roughness:0.65, metalness:0.35});
for(const z of [-10,-4,4,10]){
  const p=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,30.5,10), pipeMat);
  p.rotation.z=Math.PI/2; p.position.set(0,2.15,z); p.castShadow=false; scene.add(p);
  const p2=p.clone(); p2.position.set(0,2.15,z); // already
}
for(const x of [-10,-4,4,10]){
  const p=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,30.5,10), pipeMat);
  p.position.set(x,2.15,0); p.castShadow=false; scene.add(p);
}
// wall decals
const wallDecalTex=makeWallDecalTexture();
function addWallDecal(pos,rotY){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(3.2,1.6), new THREE.MeshStandardMaterial({ map:wallDecalTex, transparent:true, roughness:0.9, side:THREE.DoubleSide }));
  m.position.copy(pos); m.rotation.y=rotY; scene.add(m);
}
addWallDecal(new THREE.Vector3(0,2.0,15.60), Math.PI);
addWallDecal(new THREE.Vector3(0,2.0,-15.60), 0);
addWallDecal(new THREE.Vector3(15.60,2.0,0), -Math.PI/2);
addWallDecal(new THREE.Vector3(-15.60,2.0,0), Math.PI/2);

// Pillars — 4 corners with bands
const pillarMat = new THREE.MeshStandardMaterial({ color:0x112a44, roughness:0.74, metalness:0.2 });
for(const [x,z] of [[-7,-7],[7,-7],[-7,7],[7,7]]){
  const c=new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.66,5.05,14), pillarMat);
  c.position.set(x,2.52,z); c.castShadow=true; c.receiveShadow=true; scene.add(c);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.68,0.68,0.14,14), new THREE.MeshStandardMaterial({color:0x00f0ff, emissive:0x00f0ff, emissiveIntensity:0.85}));
  band.position.set(x,2.9,z); scene.add(band);
  const band2=new THREE.Mesh(new THREE.CylinderGeometry(0.65,0.65,0.08,14), new THREE.MeshStandardMaterial({color:0xff2233, emissive:0xff2233, emissiveIntensity:0.65}));
  band2.position.set(x,1.25,z); scene.add(band2);
  // cable box on pillar
  const box=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.42,0.18), new THREE.MeshStandardMaterial({color:0x0f2238}));
  box.position.set(x+(x>0? -0.58:0.58),1.55,z); scene.add(box);
  const led=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.02), new THREE.MeshStandardMaterial({color:0x00ff99, emissive:0x00ff99, emissiveIntensity:2}));
  led.position.set(x+(x>0? -0.74:0.74),1.62,z+0.08); scene.add(led);
}
// central reactor core (visual anchor, not collidable tall)
const coreBase=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.15,0.55,16), new THREE.MeshStandardMaterial({color:0x0f2238, roughness:0.7, metalness:0.25}));
coreBase.position.set(0,0.28,0); coreBase.receiveShadow=true; coreBase.castShadow=true; scene.add(coreBase);
const coreCol=new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,2.6,16), new THREE.MeshStandardMaterial({color:0x0a1a2e, roughness:0.6, metalness:0.3, emissive:0x00f0ff, emissiveIntensity:0.18, transparent:true, opacity:0.9}));
coreCol.position.set(0,1.45,0); scene.add(coreCol);
const coreRing=new THREE.Mesh(new THREE.TorusGeometry(0.62,0.07,10,22), new THREE.MeshStandardMaterial({color:0x00f0ff, emissive:0x00f0ff, emissiveIntensity:0.95}));
coreRing.position.set(0,1.05,0); coreRing.rotation.x=Math.PI/2; scene.add(coreRing);
const coreTop=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,0.18,16), new THREE.MeshStandardMaterial({color:0x122a44, emissive:0x00f0ff, emissiveIntensity:0.6}));
coreTop.position.set(0,2.62,0); scene.add(coreTop);
const coreLight=new THREE.PointLight(0x00f0ff, 2.8, 12); coreLight.position.set(0,1.4,0); scene.add(coreLight);
const heatGrille=new THREE.Mesh(new THREE.CylinderGeometry(1.18,1.18,0.04,16), new THREE.MeshStandardMaterial({color:0x0a1626}));
heatGrille.position.set(0,0.56,0); scene.add(heatGrille);

// Cover crates — GLB clones + fallback boxes with hazard edges
let crateTemplate = null;
let crateFallbackMat = new THREE.MeshStandardMaterial({ color:0x122a42, roughness:0.86, metalness:0.14, emissive:0x00f0ff, emissiveIntensity:0.06 });
let colliders = [];
function addCollider(pos,size){
  colliders.push({ min:new THREE.Vector3(pos.x-size.x/2,0,pos.z-size.z/2), max:new THREE.Vector3(pos.x+size.x/2,size.y,pos.z+size.z/2) });
}
function addBoxCrate(x,z,rx=0){
  const g=new THREE.BoxGeometry(1.55,1.02,1.0);
  const m=new THREE.Mesh(g, crateFallbackMat);
  m.position.set(x,0.51,z); m.rotation.y=rx; m.castShadow=true; m.receiveShadow=true; scene.add(m);
  const e=new THREE.Mesh(new THREE.BoxGeometry(1.57,0.07,1.02), new THREE.MeshStandardMaterial({color:0x00f0ff, emissive:0x00f0ff, emissiveIntensity:0.85}));
  e.position.set(x,0.92,z); e.rotation.y=rx; scene.add(e);
  const haz=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.14), new THREE.MeshStandardMaterial({map:makeHazardTexture(), transparent:false}));
  haz.rotation.x=-Math.PI/2; haz.rotation.z=rx; haz.position.set(x,0.025,z+0.32); scene.add(haz);
  addCollider(new THREE.Vector3(x,0,z), new THREE.Vector3(1.55,1.02,1.0));
  return m;
}
const cratePositions = [
  [-4,3,0.2],[4,4,-0.4],[0,0,0.6],[ -9,9,0.9],[9,-6,-0.5],[ -6,-3, -0.7],[6,-9,0.3],[ -3,10],[2,7],[ -10,0],[10,2]
];
let crateInstances=[];
async function loadCrates(){
  try{
    const gltf = await loader.loadAsync('/models/crate-normalized.glb');
    crateTemplate = gltf.scene;
    crateTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.roughness=0.88; if(!o.material.map) o.material.metalness=0.1; } }});
    const box=new THREE.Box3().setFromObject(crateTemplate);
    const size=new THREE.Vector3(); box.getSize(size);
    const scale=1.32/Math.max(0.001,size.y);
    crateTemplate.scale.setScalar(scale);
    for(const [x,z,ry] of [[-4,3,0.2],[4,4,-0.4],[0,0,0.6],[-9,9,0.9],[9,-6,-0.5],[-6,-3,-0.7],[6,-9,0.3]]){
      const clone=crateTemplate.clone(true);
      clone.position.set(x,0.02,z);
      clone.rotation.y=ry||0;
      scene.add(clone);
      crateInstances.push(clone);
      addCollider(new THREE.Vector3(x,0,z), new THREE.Vector3(1.42,1.05,0.96));
      // subtle emissive base ring under GLB crate to ground it
      const ring=new THREE.Mesh(new THREE.RingGeometry(0.55,0.72,12), new THREE.MeshBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.10, side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2; ring.position.set(x,0.03,z); scene.add(ring);
    }
    for(const [x,z] of [[-10,0],[10,2],[2,7],[-3,10]]){ addBoxCrate(x,z,Math.random()*Math.PI); }
    console.log('[crates] GLB loaded, instances',crateInstances.length);
  }catch(e){
    console.warn('crate GLB failed',e);
    for(const [x,z] of cratePositions){ addBoxCrate(x,z,Math.random()*Math.PI); }
  }
}
loadCrates();

// Weapon viewmodel (rifle GLB)
const weaponGroup = new THREE.Group();
camera.add(weaponGroup);
// dedicated weapon light so viewmodel is never pure black
const weaponLight = new THREE.PointLight(0xffffff, 4.5, 4);
weaponLight.position.set(0.5, 0.55, -1.0);
weaponGroup.add(weaponLight);
const rim = new THREE.DirectionalLight(0x00f0ff, 2.0); rim.position.set(-1.2, 0.8, -1.5); weaponGroup.add(rim);
scene.add(camera);
let rifle = null;
let muzzle = new THREE.Object3D();
let muzzleFlash = null;
weaponGroup.add(muzzle);
async function loadRifle(){
  try{
    const gltf = await loader.loadAsync('/models/rifle.glb');
    rifle = gltf.scene;
    rifle.traverse(o=>{
      if(o.isMesh){
        o.castShadow=false; o.receiveShadow=false;
        if(o.material) {
          o.material.roughness = 0.42;
          o.material.metalness = 0.18;
          o.material.envMapIntensity = 1.2;
        }
      }
    });
    const box=new THREE.Box3().setFromObject(rifle);
    const size=new THREE.Vector3(); box.getSize(size);
    const center=new THREE.Vector3(); box.getCenter(center);
    rifle.position.sub(center);
    const targetLen = 1.42;
    const s = targetLen / Math.max(size.x,size.y,size.z);
    rifle.scale.setScalar(s*1.02);
    // Correct orientation: barrel along -Z. Apply yaw PI to flip, small pitch.
    rifle.rotation.set(0.065, Math.PI, 0);
    // Position right-hand viewmodel — larger, closer, more weight
    rifle.position.set(0.48,-0.31,-0.55);
    weaponGroup.add(rifle);
    muzzle.position.set(0.04, -0.06, -0.98);
    muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,8), new THREE.MeshBasicMaterial({color:0xffffaa, transparent:true, opacity:0}));
    muzzleFlash.rotation.x = Math.PI/2;
    muzzleFlash.position.copy(muzzle.position);
    muzzleFlash.position.z -= 0.08;
    weaponGroup.add(muzzleFlash);
    console.log('[rifle] loaded', size, center);
  }catch(e){
    console.warn('rifle GLB failed, fallback box',e);
    const fb=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.06,0.55), new THREE.MeshStandardMaterial({color:0x1a2330}));
    fb.position.set(0.32,-0.18,-0.6);
    weaponGroup.add(fb);
    muzzle.position.set(0.32,-0.18,-0.88);
    muzzleFlash=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,8), new THREE.MeshBasicMaterial({color:0xffffaa, transparent:true, opacity:0}));
    muzzleFlash.rotation.x=Math.PI/2; muzzleFlash.position.copy(muzzle.position); muzzleFlash.position.z-=0.05; weaponGroup.add(muzzleFlash);
  }
}
loadRifle();

// Enemies
let enemies=[];
let enemyGroup=new THREE.Group(); scene.add(enemyGroup);
function spawnEnemy(){
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:0x182235, roughness:0.68, metalness:0.16});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.85,4,10), bodyMat);
  body.position.y=0.85; body.castShadow=true;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.31,12,10), new THREE.MeshStandardMaterial({color:0x0e1828, roughness:0.6, emissive:0xff0040, emissiveIntensity:0.95}));
  head.position.y=1.55;
  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(0.055,8,8), new THREE.MeshBasicMaterial({color:0xff3040}));
  eyeL.position.set(-0.11,1.56,0.22);
  const eyeR=eyeL.clone(); eyeR.position.x=0.11;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.33,0.03,8,16), new THREE.MeshBasicMaterial({color:0x00f0ff}));
  ring.position.y=0.95; ring.rotation.x=Math.PI/2;
  g.add(body,head,eyeL,eyeR,ring);
  const edge = Math.floor(Math.random()*4);
  let x,z;
  if(edge===0){ x=(Math.random()-0.5)*28; z=14; }
  else if(edge===1){ x=(Math.random()-0.5)*28; z=-14; }
  else if(edge===2){ x=14; z=(Math.random()-0.5)*28; }
  else { x=-14; z=(Math.random()-0.5)*28; }
  g.position.set(x,0,z);
  g.userData={ hp:3, maxHp:3, speed:1.9+Math.random()*0.75, lastHit:0, stagger:0 };
  enemies.push(g); enemyGroup.add(g);
  updateEnemiesHUD();
}
function updateEnemiesHUD(){ enemiesEl.textContent = String(enemies.length); }

// Player state
let playerPos=new THREE.Vector3(0,1.7,8);
let vel=new THREE.Vector3();
let yaw=0, pitch=0;
let health=100;
let score=0, kills=0, wave=1, waveKills=0, timeAlive=0;
let ammo=30, reserve=90, isReloading=false, reloadTimer=0;
let dashCooldown=0;
let gameState='menu';
let lastShot=0, shootCooldown=0.11;
let hitFlash=0;

const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && gameState==='playing') tryReload();
  if(e.code==='Space' && gameState==='playing'){ if(dashCooldown<=0){ dash(); e.preventDefault(); } }
  if(e.code==='Escape'){ document.exitPointerLock?.(); }
});
addEventListener('keyup',e=> keys[e.code]=false);
let mouseDown=false;
addEventListener('mousedown',e=>{ if(gameState==='playing' && document.pointerLockElement) mouseDown=true; });
addEventListener('mouseup',()=> mouseDown=false);

canvas.addEventListener('click',()=>{
  if(gameState==='playing' && document.pointerLockElement!==canvas){
    canvas.requestPointerLock?.();
  }
});
canvas.addEventListener('mousemove',e=>{
  if(document.pointerLockElement===canvas && gameState==='playing'){
    const sens=0.0022;
    yaw -= e.movementX * sens;
    pitch -= e.movementY * sens;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
  }
});
let touchLookActive=false, lastTouchX=0, lastTouchY=0;
canvas.addEventListener('touchstart',e=>{
  if(gameState!=='playing') return;
  const t=e.touches[0]; if(!t) return;
  touchLookActive=true; lastTouchX=t.clientX; lastTouchY=t.clientY;
});
canvas.addEventListener('touchmove',e=>{
  if(!touchLookActive || gameState!=='playing') return;
  const t=e.touches[0]; if(!t) return;
  const dx=t.clientX-lastTouchX, dy=t.clientY-lastTouchY;
  yaw -= dx*0.004; pitch -= dy*0.004; pitch=Math.max(-1.35,Math.min(1.35,pitch));
  lastTouchX=t.clientX; lastTouchY=t.clientY;
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend',()=> touchLookActive=false);

const stick=document.getElementById('stick');
let stickActive=false, stickVec=new THREE.Vector2();
let stickCenter={x:0,y:0};
function stickPos(e){ const t=e.touches?e.touches[0]:e; return {x:t.clientX,y:t.clientY}; }
if(stick){
  stick.addEventListener('touchstart',e=>{
    stickActive=true; const r=stick.getBoundingClientRect(); stickCenter={x:r.left+r.width/2,y:r.top+r.height/2}; e.preventDefault();
  },{passive:false});
  stick.addEventListener('touchmove',e=>{
    if(!stickActive) return;
    const p=stickPos(e);
    let dx=p.x-stickCenter.x, dy=p.y-stickCenter.y;
    const mag=Math.hypot(dx,dy); const max=45;
    if(mag>max){ dx*=max/mag; dy*=max/mag; }
    stickVec.set(dx/max, dy/max);
    e.preventDefault();
  },{passive:false});
  stick.addEventListener('touchend',()=>{ stickActive=false; stickVec.set(0,0); });
  stick.addEventListener('touchcancel',()=>{ stickActive=false; stickVec.set(0,0); });
}
const mShoot=document.getElementById('mShoot');
const mReload=document.getElementById('mReload');
if(mShoot){
  mShoot.addEventListener('touchstart',e=>{ mouseDown=true; e.preventDefault(); },{passive:false});
  mShoot.addEventListener('touchend',e=>{ mouseDown=false; e.preventDefault(); });
  mShoot.addEventListener('touchcancel',e=>{ mouseDown=false; e.preventDefault(); });
}
if(mReload) mReload.addEventListener('touchstart',e=>{ tryReload(); e.preventDefault(); },{passive:false});

function tryReload(){
  if(isReloading || ammo===30 || reserve===0) return;
  isReloading=true; reloadTimer=1.02; reloadHint.style.display='block'; statusEl.textContent='RELOADING';
}
function dash(){
  const forward=getForward();
  const dashDir=new THREE.Vector3();
  if(keys['KeyW']||keys['ArrowUp']) dashDir.add(forward);
  if(keys['KeyS']||keys['ArrowDown']) dashDir.sub(forward);
  const right=getRight();
  if(keys['KeyA']||keys['ArrowLeft']) dashDir.sub(right);
  if(keys['KeyD']||keys['ArrowRight']) dashDir.add(right);
  if(dashDir.length()<0.1) dashDir.copy(forward);
  dashDir.normalize();
  vel.add(dashDir.multiplyScalar(10));
  dashCooldown=1.15;
}

function getForward(){ return new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)); }
function getRight(){ return new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)); }

let shootEffectTimer=0;
let hitMarkerTimer=0;
function shoot(){
  if(isReloading || ammo<=0){
    if(ammo<=0 && !isReloading) tryReload();
    return;
  }
  ammo--;
  if(muzzleFlash){ muzzleFlash.material.opacity=1; shootEffectTimer=0.07; }
  const start=new THREE.Vector3();
  muzzle.getWorldPosition(start);
  // fallback if muzzle not yet loaded: use camera pos
  if(start.lengthSq()<0.01) camera.getWorldPosition(start);
  const dir=new THREE.Vector3(0,0,-1); dir.applyQuaternion(camera.quaternion);
  dir.x+=(Math.random()-0.5)*0.008; dir.y+=(Math.random()-0.5)*0.008; dir.normalize();
  const camPos=new THREE.Vector3(); camera.getWorldPosition(camPos);
  let hit=null, hitDist=60, hitPoint=new THREE.Vector3().copy(camPos).add(dir.clone().multiplyScalar(60));
  for(const e of enemies){
    const to = new THREE.Vector3().subVectors(e.position, camPos);
    const proj = to.dot(dir);
    if(proj<0.4||proj>42) continue;
    const closest = new THREE.Vector3().copy(camPos).add(dir.clone().multiplyScalar(proj));
    const d = closest.distanceTo(new THREE.Vector3(e.position.x,1.0,e.position.z));
    if(d<0.78 && proj<hitDist){ hit=e; hitDist=proj; hitPoint.copy(closest); }
  }
  if(!hit){
    if(dir.y < -0.015){
      const t = (0.05 - camPos.y)/dir.y;
      if(t>0 && t<hitDist){ hitPoint.copy(camPos).add(dir.clone().multiplyScalar(t)); hit='floor'; hitDist=t; }
    }
  }
  const lineGeom=new THREE.BufferGeometry().setFromPoints([start, hitPoint]);
  const line=new THREE.Line(lineGeom, new THREE.LineBasicMaterial({color:0x00f0ff, transparent:true, opacity:0.92}));
  scene.add(line);
  setTimeout(()=> scene.remove(line), 68);
  const imp=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,8), new THREE.MeshBasicMaterial({color: hit && hit!=='floor'?0xff3040:0x00f0ff}));
  imp.position.copy(hitPoint); scene.add(imp);
  setTimeout(()=> scene.remove(imp), 88);
  if(hit && hit!=='floor' && hit.userData){
    hit.userData.hp--;
    hit.userData.stagger=0.20;
    hit.children[1].material.emissiveIntensity=3.2;
    setTimeout(()=> { try{ hit.children[1].material.emissiveIntensity=0.95; }catch(_){} }, 90);
    hitMarker.style.opacity='1'; hitMarker.textContent = hit.userData.hp<=0?'ELIMINATED':'HIT';
    hitMarker.classList.add('show'); hitMarkerTimer=0.22;
    if(hit.userData.hp<=0){
      for(let i=0;i<10;i++){
        const p=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.09,0.09), new THREE.MeshBasicMaterial({color:0xff3b30}));
        p.position.copy(hit.position); p.position.y=0.9;
        const v=new THREE.Vector3((Math.random()-0.5)*6, Math.random()*5+1, (Math.random()-0.5)*6);
        scene.add(p);
        let life=0.45;
        const anim=()=>{ p.position.add(v.clone().multiplyScalar(0.016)); v.y-=9*0.016; life-=0.016; if(life<=0) scene.remove(p); else requestAnimationFrame(anim); };
        anim();
      }
      enemyGroup.remove(hit);
      enemies = enemies.filter(e=> e!==hit);
      kills++; score+=150; waveKills++; updateEnemiesHUD();
      if(waveKills>=7 && wave<3){ wave++; waveKills=0; waveEl.textContent=`${wave} / 3`; statusEl.textContent=`WAVE ${wave} — HOLD`; for(let i=0;i<3;i++) setTimeout(spawnEnemy, i*300); }
      if(kills>=20){ win(); }
      if(wave===3 && waveKills>=7){ win(); }
    } else {
      score+=25;
    }
  }
  updateHUD();
  pitch = Math.max(-1.35, Math.min(1.35, pitch - 0.007));
}

function updateHUD(){
  ammoEl.textContent=String(ammo); reserveEl.textContent=String(reserve);
  killsEl.textContent=String(kills); scoreEl.textContent=String(score);
  hpFill.style.width = Math.max(0,health)+'%';
  hpFill.classList.toggle('low', health<34);
  hpText.textContent = Math.round(health)+'%';
  waveEl.textContent=`${wave} / 3`;
}

function takeDamage(d){
  if(gameState!=='playing') return;
  health=Math.max(0, health-d);
  hitFlash=0.38; vignette.classList.add('on');
  updateHUD();
  if(health<=0) die();
}

function win(){
  if(gameState!=='playing') return;
  gameState='won';
  document.exitPointerLock?.();
  endOverlay.classList.remove('hidden');
  document.getElementById('endBadge').textContent='PROTOCOL SECURED';
  document.getElementById('endTitle').innerHTML='CONTAINMENT <span style="color:var(--cyan)">HELD</span>';
  document.getElementById('endDesc').textContent=`Sector 07 secured after ${Math.floor(timeAlive)}s. ${kills} hostiles neutralized. Final score ${score}.`;
  document.getElementById('endKills').textContent=kills;
  document.getElementById('endWave').textContent=wave;
}
function die(){
  gameState='dead';
  document.exitPointerLock?.();
  endOverlay.classList.remove('hidden');
  document.getElementById('endBadge').textContent='SIGNAL LOST';
  document.getElementById('endTitle').innerHTML='CONTAINMENT <span style="color:var(--mag)">FAILED</span>';
  document.getElementById('endDesc').textContent=`Operator down after ${Math.floor(timeAlive)}s. ${kills} neutralized, wave ${wave}.`;
  document.getElementById('endKills').textContent=kills;
  document.getElementById('endWave').textContent=wave;
}

function resetGame(){
  health=100; score=0; kills=0; wave=1; waveKills=0; timeAlive=0; ammo=30; reserve=90; isReloading=false; reloadTimer=0; hitFlash=0;
  playerPos.set(0,1.7,8); vel.set(0,0,0); yaw=0; pitch=0;
  for(const e of [...enemies]) enemyGroup.remove(e);
  enemies=[]; spawnWave(); updateHUD(); statusEl.textContent='CONTAINMENT ACTIVE'; reloadHint.style.display='none'; vignette.classList.remove('on');
}
function spawnWave(){
  for(let i=0;i<4;i++) setTimeout(()=> spawnEnemy(), i*420);
}

function collides(pos){
  for(const c of colliders){
    if(pos.x>c.min.x && pos.x<c.max.x && pos.z>c.min.z && pos.z<c.max.z) return true;
  }
  // reactor core collider (radius ~1.15)
  if(Math.hypot(pos.x, pos.z) < 1.35) return true;
  if(Math.abs(pos.x)>15.05 || Math.abs(pos.z)>15.05) return true;
  return false;
}

let last=performance.now();
let spawnTimer=3.0;
function frame(){
  requestAnimationFrame(frame);
  const now=performance.now();
  const dt=Math.min(0.033, (now-last)/1000);
  last=now;
  // subtle emergency light flicker
  const flick = 0.85 + Math.sin(now*0.008)*0.15 + (Math.random()>0.97?0.2:0);
  pRed.intensity = 1.35 * flick;
  pRed2.intensity = 0.9 * (0.9 + Math.sin(now*0.006+2)*0.2);
  pCore.intensity = 2.0 + Math.sin(now*0.003)*0.25;
  // core ring rotation
  coreRing.rotation.z += dt*0.7;

  if(gameState==='playing'){
    timeAlive+=dt;
    if(isReloading){
      reloadTimer-=dt;
      if(reloadTimer<=0){
        const need=30-ammo; const take=Math.min(need,reserve);
        ammo+=take; reserve-=take; isReloading=false; reloadHint.style.display='none'; statusEl.textContent='CONTAINMENT ACTIVE'; updateHUD();
      }
    }
    if(dashCooldown>0) dashCooldown-=dt;
    const speedBase = (keys['ShiftLeft']||keys['ShiftRight'])?5.25:3.15;
    if(stickActive){
      const sx=stickVec.x, sy=stickVec.y;
      if(Math.hypot(sx,sy)>0.07){
        const f=getForward(), r=getRight();
        const mv=new THREE.Vector3().addScaledVector(r,sx).addScaledVector(f,-sy);
        mv.normalize().multiplyScalar(speedBase*dt);
        const next=new THREE.Vector3().copy(playerPos).add(mv);
        if(!collides(next)) playerPos.add(mv);
        else {
          const nx=new THREE.Vector3(playerPos.x+mv.x, playerPos.y, playerPos.z);
          const nz=new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z+mv.z);
          if(!collides(nx)) playerPos.x=nx.x;
          if(!collides(nz)) playerPos.z=nz.z;
        }
      }
    } else {
      let mv=new THREE.Vector3();
      const f=getForward(), r=getRight();
      if(keys['KeyW']||keys['ArrowUp']) mv.add(f);
      if(keys['KeyS']||keys['ArrowDown']) mv.sub(f);
      if(keys['KeyA']||keys['ArrowLeft']) mv.sub(r);
      if(keys['KeyD']||keys['ArrowRight']) mv.add(r);
      if(mv.length()>0){
        mv.normalize().multiplyScalar(speedBase*dt);
        const nx=new THREE.Vector3(playerPos.x+mv.x, playerPos.y, playerPos.z);
        const nz=new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z+mv.z);
        if(!collides(nx)) playerPos.x=nx.x;
        if(!collides(nz)) playerPos.z=nz.z;
      }
    }
    if(vel.length()>0.01){
      const v2=new THREE.Vector3(vel.x,0,vel.z).multiplyScalar(dt);
      const next=new THREE.Vector3().copy(playerPos).add(v2);
      if(!collides(next)) playerPos.add(v2);
      else {
        const nx=new THREE.Vector3(playerPos.x+v2.x, playerPos.y, playerPos.z);
        const nz=new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z+v2.z);
        if(!collides(nx)) playerPos.x=nx.x;
        if(!collides(nz)) playerPos.z=nz.z;
        vel.multiplyScalar(0.5);
      }
      vel.multiplyScalar(0.90);
      if(vel.length()<0.05) vel.set(0,0,0);
    }
    if(mouseDown && now-lastShot>shootCooldown*1000){
      if(ammo>0 && !isReloading){ shoot(); lastShot=now; }
    }
    if(shootEffectTimer>0){ shootEffectTimer-=dt; if(shootEffectTimer<=0 && muzzleFlash) muzzleFlash.material.opacity=0; }
    if(hitMarkerTimer>0){ hitMarkerTimer-=dt; if(hitMarkerTimer<=0){ hitMarker.classList.remove('show'); setTimeout(()=> hitMarker.style.opacity='0', 120); } }
    if(hitFlash>0){ hitFlash-=dt; if(hitFlash<=0) vignette.classList.remove('on'); }
    spawnTimer-=dt;
    if(spawnTimer<=0 && enemies.length<7){
      spawnEnemy(); spawnTimer=3.6 - wave*0.45;
    }
    for(const e of enemies){
      if(e.userData.stagger>0){ e.userData.stagger-=dt; continue; }
      const dir=new THREE.Vector3().subVectors(playerPos, e.position);
      const dist=Math.hypot(dir.x,dir.z);
      dir.y=0; if(dir.length()>0.01) dir.normalize();
      const nextPos=new THREE.Vector3().copy(e.position).add(dir.clone().multiplyScalar(e.userData.speed*dt));
      let blocked=false;
      for(const c of colliders){
        if(nextPos.x>c.min.x && nextPos.x<c.max.x && nextPos.z>c.min.z && nextPos.z<c.max.z){ blocked=true; break; }
      }
      if(!blocked && Math.hypot(nextPos.x,nextPos.z) < 1.35) blocked=true;
      if(blocked){
        const perp=new THREE.Vector3(-dir.z,0,dir.x);
        const alt=new THREE.Vector3().copy(e.position).add(perp.clone().multiplyScalar(e.userData.speed*dt*0.9));
        let altBlocked=false;
        for(const c of colliders){ if(alt.x>c.min.x && alt.x<c.max.x && alt.z>c.min.z && alt.z<c.max.z){ altBlocked=true; break; } }
        if(!altBlocked && Math.hypot(alt.x,alt.z)>=1.35) e.position.copy(alt);
        else{
          const alt2=new THREE.Vector3().copy(e.position).add(perp.clone().multiplyScalar(-e.userData.speed*dt*0.9));
          if(Math.hypot(alt2.x,alt2.z)>=1.35) e.position.copy(alt2);
        }
      } else {
        e.position.add(dir.clone().multiplyScalar(e.userData.speed*dt));
      }
      e.lookAt(playerPos.x, e.position.y, playerPos.z);
      if(dist<1.55){
        takeDamage(18*dt*2.25);
      }
      e.position.y = Math.sin(now*0.004 + e.position.x)*0.035;
    }
    const moving = (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']||stickActive);
    const t=now*0.001;
    const swayX = moving? Math.sin(t*8)*0.008 : 0;
    const swayY = moving? Math.abs(Math.cos(t*8))*0.01 : 0;
    camera.position.copy(playerPos);
    camera.rotation.order='YXZ';
    camera.rotation.y=yaw + swayX*0.35;
    camera.rotation.x=pitch + swayY*0.35;
    camera.rotation.z=0;
    weaponGroup.position.set(swayX*0.25, swayY*0.25, 0);
  } else {
    if(gameState==='menu'){
      const t=now*0.00035;
      camera.position.set(Math.sin(t)*11, 5.2, Math.cos(t)*11);
      camera.lookAt(0,1,0);
    }
  }
  renderer.render(scene,camera);
}
frame();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

playBtn.addEventListener('click',()=>{
  startOverlay.classList.add('hidden');
  gameState='playing';
  resetGame();
  canvas.requestPointerLock?.();
});
restartBtn.addEventListener('click',()=>{
  endOverlay.classList.add('hidden');
  gameState='playing';
  resetGame();
  canvas.requestPointerLock?.();
});
menuBtn.addEventListener('click',()=>{
  endOverlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
  gameState='menu';
});

updateHUD();
spawnWave();

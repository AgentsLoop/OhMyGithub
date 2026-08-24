import * as THREE from 'three';

// Scene setup
const canvas = document.getElementById('c');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);
scene.fog = new THREE.Fog(0x0a1018, 28, 58);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 100);
let yaw = Math.PI * 0.15;
let pitch = -0.06;

// Lighting - sci-fi
scene.add(new THREE.HemisphereLight(0xadc9e6, 0x0a1018, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(12, 18, 8);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near = 1; dir.shadow.camera.far = 50;
dir.shadow.camera.left=-30; dir.shadow.camera.right=30; dir.shadow.camera.top=20; dir.shadow.camera.bottom=-20;
scene.add(dir);
const fill = new THREE.PointLight(0x2d8cff, 1.2, 30); fill.position.set(-8, 5, -6); scene.add(fill);
const fill2 = new THREE.PointLight(0xff7a1a, 1.0, 28); fill2.position.set(10, 5, 6); scene.add(fill2);

function resize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// Materials
function makePanelTexture(){
  const c=document.createElement('canvas'); c.width=256; c.height=256;
  const g=c.getContext('2d');
  g.fillStyle='#eef4ff'; g.fillRect(0,0,256,256);
  g.strokeStyle='rgba(20,40,70,0.12)'; g.lineWidth=2;
  g.strokeRect(4,4,248,248);
  g.strokeStyle='rgba(20,40,70,0.07)';
  for(let i=32;i<256;i+=32){ g.beginPath(); g.moveTo(i,4); g.lineTo(i,252); g.stroke(); g.beginPath(); g.moveTo(4,i); g.lineTo(252,i); g.stroke();}
  g.fillStyle='rgba(30,60,110,0.04)'; g.fillRect(10,10,236,236);
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.anisotropy=4; return tex;
}
const panelTex = makePanelTexture();
const floorTex = (()=>{ const c=document.createElement('canvas'); c.width=256; c.height=256; const g=c.getContext('2d'); g.fillStyle='#f2f7ff'; g.fillRect(0,0,256,256); g.strokeStyle='rgba(30,50,90,0.14)'; g.lineWidth=3; g.strokeRect(2,2,252,252); g.fillStyle='rgba(20,40,70,0.06)'; for(let i=0;i<256;i+=64){ g.fillRect(i,0,2,256); g.fillRect(0,i,256,2);} const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,4); return t; })();

const matFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness:0.85, metalness:0.05 });
const matWall = new THREE.MeshStandardMaterial({ map: panelTex, roughness:0.9, metalness:0.02 });
const matPortalable = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness:0.96, emissive:0x182a44, emissiveIntensity:0.15 });
const matDark = new THREE.MeshStandardMaterial({ color: 0x0f1a28, roughness:0.9 });
const matPit = new THREE.MeshStandardMaterial({ color: 0x02060c, roughness:1 });
const matOrangeGlow = new THREE.MeshStandardMaterial({ color:0xff7a1a, emissive:0xff5a00, emissiveIntensity:1.2 });
const matBlueGlow = new THREE.MeshStandardMaterial({ color:0x2d8cff, emissive:0x1464ff, emissiveIntensity:1.2 });

// Geometry containers
const colliders=[]; // { box: Box3, mesh }
const portalSurfaces=[];

function boxMesh(w,h,d, x,y,z, mat, addCollider=true){
  const g=new THREE.BoxGeometry(w,h,d);
  const m=new THREE.Mesh(g, mat);
  m.position.set(x,y,z);
  m.castShadow=true; m.receiveShadow=true;
  scene.add(m);
  if(addCollider){
    const b=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,y,z), new THREE.Vector3(w,h,d));
    colliders.push({box:b, mesh:m});
  }
  return m;
}
function portalPanel(w,h, x,y,z, rotY, isHorizontal=false){
  const g=new THREE.BoxGeometry(w, isHorizontal?0.2:h, isHorizontal?h:0.2);
  // For vertical walls, thin depth 0.2 along normal; but easier use plane+box.
  // Instead create proper BoxGeometry thin
  let mesh;
  if(isHorizontal){
    // horizontal panel on floor/ceiling: thin Y
    mesh = boxMesh(w,0.2,h, x,y,z, matPortalable, true);
    // mark for portal surface: top face
    mesh.userData.isPortalSurface=true;
    mesh.userData.normal = isHorizontal ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
    // offset collider thickness to allow placement tolerance
  } else {
    // vertical wall panel: oriented. Need correctly sized collider facing normal.
    // For cardinal walls we know axis, so we can set box thin along normal axis.
    // We'll create custom box manually to avoid rotation complications - just axis-aligned thin box.
    // For Y rotation we set size accordingly.
    // Simplified: use BoxGeometry axis-aligned, manually set position, treat as portal surface with explicit normal.
    const thickness=0.2;
    // Determine dimensions based on rotY: 0 => facing +Z (wall at Z constant), thickness along Z
    // But our chamber walls are axis-aligned, so we handle via manual box
    mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,thickness), matPortalable);
    mesh.position.set(x,y,z);
    mesh.rotation.y = rotY;
    mesh.castShadow=true; mesh.receiveShadow=true;
    scene.add(mesh);
    const b=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x,y,z), new THREE.Vector3(w+0.1,h+0.1,thickness+0.1));
    // Expand box slightly for collision tolerance - but we use raycast for portal placement separately
    colliders.push({box:b, mesh});
    mesh.userData.isPortalSurface=true;
    // normal = direction portal faces (into room)
    const n = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), rotY);
    mesh.userData.normal = n;
    mesh.userData.isVertical=true;
    return mesh;
  }
  // For horizontal
  mesh.userData.isPortalSurface=true;
  mesh.userData.normal = new THREE.Vector3(0,1,0);
  portalSurfaces.push(mesh);
  return mesh;
}

// Chamber dimensions
const W=30, D=22, H=8;

// Floor and ceiling
boxMesh(W,0.6,D, 0,-0.3,0, matFloor, false); // floor visible top at y=0
// collider for floor is plane y=0
colliders.push({ box: new THREE.Box3(new THREE.Vector3(-W/2,-0.3,-D/2), new THREE.Vector3(W/2,0.1,D/2)), mesh:null, isFloor:true });

// Ceiling
boxMesh(W,0.5,D, 0, H+0.25, 0, matDark, false);
// pits kill zone (gap)

// Perimeter walls
const wallThick=1;
boxMesh(wallThick, H, D, -W/2 - wallThick/2 +0.5, H/2, 0, matWall); // left
boxMesh(wallThick, H, D,  W/2 + wallThick/2 -0.5, H/2, 0, matWall); // right
boxMesh(W, H, wallThick, 0, H/2, -D/2 - wallThick/2 +0.5, matWall); // back
boxMesh(W, H, wallThick, 0, H/2,  D/2 + wallThick/2 -0.5, matWall); // front

// Interior architecture for puzzles
// -- Puzzle 1: Gap / pit
// Pit area: x -4 to 2, z -4 to 4, depth -5 (visual)
const pitMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 8), matPit);
pitMesh.position.set(-1, -3, 0);
scene.add(pitMesh);
// Pit colliders not - but fall detection below y -2 triggers reset-ish

// Pillars flanking gap with portal surfaces
// Left pillar at x=-5, z=-4 and z=4 ? Actually create two portal walls
portalPanel(3, 4, -6.5, 2, -4, 0); // south? Let's place at x=-6.5 facing +X (right)
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(0.2,4,3), matPortalable);
  m.position.set(-6.5,2,-4); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(-6.7,0,-5.5), new THREE.Vector3(-6.3,4,-2.5)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(1,0,0); portalSurfaces.push(m);
}
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(0.2,4,3), matPortalable);
  m.position.set(-6.5,2,4); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(-6.7,0,2.5), new THREE.Vector3(-6.3,4,5.5)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(1,0,0); portalSurfaces.push(m);
}
// Right side portal walls for gap crossing (high wall with portal panel)
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(0.2,4,3), matPortalable);
  m.position.set(3,2,-4); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(2.8,0,-5.5), new THREE.Vector3(3.2,4,-2.5)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(-1,0,0); portalSurfaces.push(m);
}
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(0.2,4,3), matPortalable);
  m.position.set(3,2,4); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(2.8,0,2.5), new THREE.Vector3(3.2,4,5.5)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(-1,0,0); portalSurfaces.push(m);
}
// Gap bridge barriers - invisible walls to force portal use (no walk around side?) Leave side paths but block with barriers along z edges for pit?
boxMesh(0.5,1, 8, -1,0.5,-4.8, matDark); // along pit edge south
boxMesh(0.5,1, 8, -1,0.5, 4.8, matDark);

// Middle divider wall with opening that can only be crossed via portal gap?
// Actually gap itself is the puzzle: player must portal across 6m void. Without portals they'd fall.

// Puzzle 2 area: raised platform at x~10, y=4.5, size 7x7
const platform = boxMesh(7,0.5,7, 10.5, 4.2, 0, new THREE.MeshStandardMaterial({color:0xe8f0ff, roughness:0.8}));
boxMesh(0.4,4.2,7, 7.2,2.1,0, matWall); // side wall under platform
boxMesh(7,4.2,0.4, 10.5,2.1,-3.6, matWall);
boxMesh(7,4.2,0.4, 10.5,2.1, 3.6, matWall);
// Steps visuals for hint but not climbable
for(let i=0;i<3;i++){
  boxMesh(1.2,0.3+0.3*i,1.2, 6.8,0.15+0.15*i, 2+i*1.2, matDark, false);
}

// Portal surfaces for puzzle 2: vertical panel on platform front, floor panel below
// Floor portal panel (horizontal) at (6, 0, 0) size 3x3
{
  const m = new THREE.Mesh(new THREE.BoxGeometry(3,0.15,3), matPortalable);
  m.position.set(6,0.08,0); m.receiveShadow=true; scene.add(m);
  // not adding thick collider, just surface; floor collider already covers
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(0,1,0); portalSurfaces.push(m);
  // visual ring
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.2,1.35,32), new THREE.MeshBasicMaterial({color:0x6fafff, side:THREE.DoubleSide, transparent:true, opacity:0.35}));
  ring.rotation.x=-Math.PI/2; ring.position.set(6,0.16,0); scene.add(ring);
}
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(3,3,0.2), matPortalable);
  m.position.set(10.5,5.8, -3.55); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(9,4.3,-3.75), new THREE.Vector3(12,7.3,-3.35)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(0,0,1); portalSurfaces.push(m);
}
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(3,3,0.2), matPortalable);
  m.position.set(10.5,5.8, 3.55); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(9,4.3,3.35), new THREE.Vector3(12,7.3,3.75)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(0,0,-1); portalSurfaces.push(m);
}
// Additional side wall portal for alternate solution
{
  const m= new THREE.Mesh(new THREE.BoxGeometry(0.2,3,3), matPortalable);
  m.position.set(13.7,5.8,0); m.castShadow=true; m.receiveShadow=true; scene.add(m);
  colliders.push({box:new THREE.Box3(new THREE.Vector3(13.5,4.3,-1.5), new THREE.Vector3(13.9,7.3,1.5)), mesh:m});
  m.userData.isPortalSurface=true; m.userData.normal=new THREE.Vector3(-1,0,0); portalSurfaces.push(m);
}

// Exit door on platform at x 13.5
const exitDoor = new THREE.Group();
const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.2,3.2,0.4), new THREE.MeshStandardMaterial({color:0x1a2a40, emissive:0x0a1a30, roughness:0.4}));
doorFrame.position.set(13.2,5.8,0);
scene.add(doorFrame);
const doorInner = new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.6), new THREE.MeshStandardMaterial({color:0x00ff88, emissive:0x00ff88, emissiveIntensity:0.9}));
doorInner.position.set(13.02,5.8,0); doorInner.rotation.y=Math.PI/2; scene.add(doorInner);
const doorLight = new THREE.PointLight(0x00ff88, 2.5, 12); doorLight.position.set(13,5.8,0); scene.add(doorLight);
// Exit sign
const exitSign = (()=>{ const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d'); g.fillStyle='#00d67a'; g.fillRect(0,0,256,64); g.fillStyle='white'; g.font='bold 32px monospace'; g.textAlign='center'; g.fillText('EXIT',128,42); const t=new THREE.CanvasTexture(c); const m=new THREE.Mesh(new THREE.PlaneGeometry(2,0.5), new THREE.MeshBasicMaterial({map:t, transparent:true})); m.position.set(13.2,7.6,0); m.rotation.y=-Math.PI/2; return m;})();
scene.add(exitSign);

// Landmarks and decor
// Glowing strips on ceiling
for(let x=-12;x<=12;x+=6){
  const strip=new THREE.Mesh(new THREE.BoxGeometry(5,0.08,0.12), new THREE.MeshStandardMaterial({color:0x2d8cff, emissive:0x2d8cff, emissiveIntensity:1.5}));
  strip.position.set(x, H-0.15, 0); scene.add(strip);
}
// Number labels
function label(text, x,y,z, ry=0){
  const c=document.createElement('canvas'); c.width=512; c.height=128; const g=c.getContext('2d'); g.fillStyle='rgba(15,26,40,0.85)'; g.fillRect(0,0,512,128); g.strokeStyle='rgba(100,180,255,0.3)'; g.strokeRect(4,4,504,120); g.fillStyle='#7ec8ff'; g.font='bold 52px monospace'; g.textAlign='center'; g.fillText(text,256,78); const tex=new THREE.CanvasTexture(c); const m=new THREE.Mesh(new THREE.PlaneGeometry(4,1), new THREE.MeshBasicMaterial({map:tex, transparent:true})); m.position.set(x,y,z); m.rotation.y=ry; scene.add(m);
}
label('TEST 01 — GAP', -8, 3, -10.6);
label('TEST 02 — ASCENT', 6, 3, -10.6);
label('CHAMBER 09', 0, 6.5, 10.6, Math.PI);
// Companion cube-ish
const cube = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.9), new THREE.MeshStandardMaterial({color:0x8ab4ff, roughness:0.4, metalness:0.2}));
cube.position.set(-10,0.45,-2); cube.castShadow=true; cube.receiveShadow=true; scene.add(cube);
const cubeLight=new THREE.PointLight(0x8ab4ff,0.6,6); cubeLight.position.copy(cube.position); cubeLight.position.y+=1; scene.add(cubeLight);

// Portal System
const portalTargets = [];
const portals=[];
const portalRT = [new THREE.WebGLRenderTarget(512,512), new THREE.WebGLRenderTarget(512,512)];
portalRT.forEach(rt=>{ rt.texture.colorSpace=THREE.SRGBColorSpace; });
const portalCams=[new THREE.PerspectiveCamera(74,1,0.1,50), new THREE.PerspectiveCamera(74,1,0.1,50)];

function createPortal(idx, color, glowMat){
  const group=new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2,3.2,0.12), glowMat);
  frame.castShadow=false; group.add(frame);
  // inner portal surface
  const innerGeo=new THREE.PlaneGeometry(1.9,2.9);
  const innerMat=new THREE.MeshBasicMaterial({ map: portalRT[idx].texture, side:THREE.DoubleSide });
  const inner=new THREE.Mesh(innerGeo, innerMat);
  inner.position.z=0.07;
  group.add(inner);
  // fallback emissive when not linked
  const fallback=new THREE.Mesh(new THREE.PlaneGeometry(1.9,2.9), new THREE.MeshBasicMaterial({color: color, transparent:true, opacity:0.25}));
  fallback.position.z=0.065; fallback.visible=false; group.add(fallback);
  // animated ring
  const ringGeo=new THREE.RingGeometry(0.95,1.02,32);
  const ringMat=new THREE.MeshBasicMaterial({color: color, side:THREE.DoubleSide, transparent:true, opacity:0.9});
  const ring=new THREE.Mesh(ringGeo, ringMat); ring.position.z=0.09; group.add(ring);
  group.visible=false;
  scene.add(group);
  return { group, frame, inner, innerMat, fallback, ring, color };
}
const portalBlue = createPortal(0, 0x2d8cff, matBlueGlow);
const portalOrange = createPortal(1, 0xff7a1a, matOrangeGlow);
portals.push(null,null); // placeholder for data objects
let portalData=[null,null]; // {pos, normal, quat, matrix, invMatrix}

function quatFromNormal(n){
  const q=new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0,0,1), n.clone().normalize());
  return q;
}
function placePortal(idx, hitPos, hitNormal){
  const n=hitNormal.clone().normalize();
  const pos=hitPos.clone().add(n.clone().multiplyScalar(0.06));
  const q=quatFromNormal(n);
  // For horizontal portals, keep plane flat; our setFromUnitVectors already makes it horizontal facing up
  // Build matrices
  const m=new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1,1,1));
  const inv=new THREE.Matrix4().copy(m).invert();
  portalData[idx]={pos:pos.clone(), normal:n.clone(), quat:q.clone(), matrix:m, invMatrix:inv, width:1.9, height:2.9, isHorizontal: Math.abs(n.y)>0.5 };
  const obj = idx===0?portalBlue:portalOrange;
  obj.group.position.copy(pos);
  obj.group.quaternion.copy(q);
  obj.group.visible=true;
  obj.fallback.visible=false;
  // portal frame thickness visual adjustment for floor portals
  if(Math.abs(n.y)>0.5){
    obj.group.rotation.x = n.y>0 ? -Math.PI/2 : Math.PI/2; // Actually q already handles; but ensure
    // q already gives rotation, so no extra
  }
  updatePortalIndicator();
  checkPuzzles();
  portalCount++;
  updateStats();
  // sound-ish flash
  obj.ring.scale.set(0.2,0.2,1); // will animate
}

let portalCount=0;

function removePortal(idx){
  const obj= idx===0?portalBlue:portalOrange;
  obj.group.visible=false;
  portalData[idx]=null;
  updatePortalIndicator();
}

// Indicator
function updatePortalIndicator(){
  document.getElementById('pi-blue').textContent = portalData[0] ? 'ACTIVE' : '—';
  document.getElementById('pi-orange').textContent = portalData[1] ? 'ACTIVE' : '—';
  document.getElementById('pi-blue').style.color = portalData[0] ? '#6bb8ff' : '#8aa';
  document.getElementById('pi-orange').style.color = portalData[1] ? '#ff9a3d' : '#8aa';
}

// Raycast for portal placement - shoot from camera forward up to 25m, find closest portal surface
const raycaster=new THREE.Raycaster();
function tryPlacePortal(idx){
  const origin = camera.position.clone();
  const dirVec=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  raycaster.set(origin, dirVec);
  // We'll intersect manually with portalSurfaces via raycasting against their meshes using bounding + plane
  // Simpler: use Three raycaster intersectObjects
  const hits=raycaster.intersectObjects(portalSurfaces, false);
  if(hits.length>0 && hits[0].distance < 30){
    const hit=hits[0];
    const mesh=hit.object;
    const normal = mesh.userData.normal.clone();
    // For vertical surfaces, ensure hit point is not too close to edge (leave margin)
    // Add small offset to avoid placing twice on same spot overlapping? allow
    placePortal(idx, hit.point, normal);
    // spawn spark
    spawnSpark(hit.point, idx===0?0x2d8cff:0xff7a1a);
    return true;
  } else {
    // miss feedback
    spawnMiss(origin, dirVec);
    return false;
  }
}
function spawnSpark(pos, col){
  const g=new THREE.SphereGeometry(0.08,8,8);
  const m=new THREE.MeshBasicMaterial({color:col});
  const s=new THREE.Mesh(g,m); s.position.copy(pos); scene.add(s);
  let t=0; const anim=()=>{ t+=0.07; s.scale.setScalar(1+t*1.2); m.opacity=1-t*2; m.transparent=true; if(t<0.5) requestAnimationFrame(anim); else scene.remove(s);};
  anim();
}
function spawnMiss(o,d){
  // tiny cross at end of ray
  const p=o.clone().add(d.clone().multiplyScalar(6));
  spawnSpark(p, 0x777777);
}

// Player physics
let pos = new THREE.Vector3(-12, 1.7, 0);
let vel = new THREE.Vector3(0,0,0);
let onGround=false;
let canJump=true;
const playerRadius=0.35;
const eyeHeight=1.62;
const gravity=16;
const speed=5.2;
const jumpVel=5.5;

const keys={w:false,a:false,s:false,d:false, shift:false};
addEventListener('keydown', e=>{
  if(e.code==='KeyW') keys.w=true;
  if(e.code==='KeyA') keys.a=true;
  if(e.code==='KeyS') keys.s=true;
  if(e.code==='KeyD') keys.d=true;
  if(e.code==='ShiftLeft') keys.shift=true;
  if(e.code==='Space'){ if(onGround){ vel.y=jumpVel; onGround=false; } e.preventDefault();}
  if(e.code==='KeyR'){ resetPlayer(); }
});
addEventListener('keyup', e=>{
  if(e.code==='KeyW') keys.w=false;
  if(e.code==='KeyA') keys.a=false;
  if(e.code==='KeyS') keys.s=false;
  if(e.code==='KeyD') keys.d=false;
  if(e.code==='ShiftLeft') keys.shift=false;
});

function resetPlayer(){
  pos.set(-12,1.7,0);
  vel.set(0,0,0);
  yaw=Math.PI*0.15; pitch=-0.06;
  // keep portals? reset portals too? Keep per instruction: reset action restores chamber
  // We'll keep portals but could clear if player wants. Let's keep them.
  timeStart=performance.now();
  won=false;
  document.getElementById('overlay-win').classList.add('hidden');
  blocker.classList.remove('hidden');
  document.body.requestPointerLock?.(); // will fail if not click; but we'll lock on demand
  updateMissions(false,false,false);
}

// Pointer lock
const blocker=document.getElementById('blocker');
const btnPlay=document.getElementById('btn-play');
const btnEnter=document.getElementById('btn-enter');
const btnReset=document.getElementById('btn-reset');
function lock(){
  renderer.domElement.requestPointerLock?.();
  // also canvas request
  canvas.requestPointerLock?.();
}
btnPlay.addEventListener('click', lock);
btnEnter.addEventListener('click', lock);
btnReset.addEventListener('click', resetPlayer);
canvas.addEventListener('click', ()=>{ if(document.pointerLockElement===canvas || document.pointerLockElement===document.body) return; lock(); });

document.addEventListener('pointerlockchange', ()=>{
  const locked = document.pointerLockElement===canvas || document.pointerLockElement===renderer.domElement || document.pointerLockElement===document.body;
  if(locked){ blocker.classList.add('hidden'); document.getElementById('center-msg').style.display='none'; }
  else { blocker.classList.remove('hidden'); document.getElementById('center-msg').style.display='block'; }
});
canvas.addEventListener('mousedown', e=>{
  if(document.pointerLockElement!==canvas && document.pointerLockElement!==renderer.domElement && document.pointerLockElement!==document.body) return;
  if(e.button===0) tryPlacePortal(0);
  if(e.button===2) tryPlacePortal(1);
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());

addEventListener('mousemove', e=>{
  if(document.pointerLockElement!==canvas && document.pointerLockElement!==renderer.domElement && document.pointerLockElement!==document.body) return;
  const sens=0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch=Math.max(-1.45, Math.min(1.45, pitch));
});

// Collision helper
function collide(pos, vel, dt){
  // gravity
  vel.y -= gravity * dt;
  // apply horizontal input later, but integrate vertical first
  // We'll handle full movement with simple AABB sliding
  // Next position
  let next=pos.clone().add(vel.clone().multiplyScalar(dt));
  // floor
  if(next.y < eyeHeight){
    if(pos.y >= eyeHeight || vel.y < 0){
      // check if over pit? Pit is at x -4 to 2, z -4 to 4, if over pit, don't snap - let fall
      const overPit = next.x > -4 && next.x < 2 && next.z > -4 && next.z < 4;
      if(!overPit){
        next.y = eyeHeight;
        vel.y = 0;
        onGround=true;
      } else {
        onGround=false;
        // if far below, reset
        if(next.y < -4){
          // fell
          pos.set(-12,1.7,0); vel.set(0,0,0); return;
        }
      }
    }
  } else {
    // check ceiling
    if(next.y > H - 0.2){ next.y = H -0.2; vel.y = 0; }
    onGround=false;
  }
  // platform collision (raised platform 7x7 at 10.5,4.2)
  // AABB for platform top: x 7 to 14, z -3.5 to 3.5, y 4.2 to 4.7
  // If next.y in that range and inside xz, block
  // Simplified platform top: stand on it if falling onto it
  const onPlatformXZ = next.x > 7.0 && next.x < 14.0 && next.z > -3.5 && next.z < 3.5;
  const platformTop = 4.45; // eyeHeight offset? Actually platform top at y=4.45 (4.2+0.25) player feet at y-eyeHeight, but we track eye
  // foot = eye - eyeHeight (1.62) +? pos.y is eye, floor at 0, so foot = pos.y - 1.62 . Platform top at 4.2+0.25=4.45 feet, eye should be 4.45+1.62=6.07 when standing
  const footNext = next.y - eyeHeight;
  const footCurr = pos.y - eyeHeight;
  if(onPlatformXZ){
    if(footNext >= 4.3 && footNext <= 4.7 && footCurr >= 4.7 && vel.y <0){
      // landing on platform
      next.y = 4.45 + eyeHeight;
      vel.y=0; onGround=true;
    } else if(footNext < 4.45 && footNext > 3.0 && footCurr >=4.45){
      // hitting side? simplified: block vertical through
    }
    // side collisions for platform walls
    if(footNext < 4.45 && footNext > 0){
      // if inside platform volume horizontally, block horizontal
      // platform side walls already as colliders via boxes, handle below
    }
  }

  // Wall colliders AABB checks horizontal
  // We'll do iterative slide: check X then Z
  const checkBox = (p)=>{
    for(const c of colliders){
      if(c.isFloor) continue;
      const b=c.box;
      // expand by player radius in xz, and check y overlap (eye height vs box y)
      // Player vertical capsule from foot to head
      const foot = p.y - eyeHeight; const head = p.y + 0.2;
      if(foot > b.max.y || head < b.min.y) continue;
      if(p.x + playerRadius < b.min.x || p.x - playerRadius > b.max.x) continue;
      if(p.z + playerRadius < b.min.z || p.z - playerRadius > b.max.z) continue;
      return true;
    }
    return false;
  };
  // Try X movement alone
  let tryX = new THREE.Vector3(next.x, pos.y, pos.z);
  if(checkBox(tryX)){
    // slide: cancel x vel
    next.x = pos.x;
    vel.x *= 0.2;
  }
  let tryZ = new THREE.Vector3(next.x, pos.y, next.z);
  if(checkBox(tryZ)){
    next.z = pos.z;
    vel.z *= 0.2;
  }
  // final combined check
  if(checkBox(next)){
    next.x = pos.x; next.z = pos.z;
    vel.x *=0.1; vel.z*=0.1;
  }
  pos.copy(next);
}

function applyInput(dt){
  const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  forward.y=0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize(); // careful cross order
  // Correct right: forward x up
  right.crossVectors(forward, new THREE.Vector3(0,1,0)).negate?.(); // Let's recompute properly
  // simpler: right = forward cross up
  // Use: right = new Vector3( forward.z,0,-forward.x ) for yaw only
  // Let's compute directly: right.x = Math.cos(yaw), right.z = Math.sin(yaw)? For yaw rotation, forward = ( -sin(yaw),0,-cos(yaw) )? Let's align with camera quaternion.
  // Instead derive from camera quaternion yaw only:
  const f=new THREE.Vector3(); camera.getWorldDirection(f); f.y=0; f.normalize();
  const r=new THREE.Vector3(f.z,0,-f.x); // 90deg right
  let mv=new THREE.Vector3();
  if(keys.w) mv.add(f);
  if(keys.s) mv.sub(f);
  if(keys.a) mv.sub(r);
  if(keys.d) mv.add(r);
  if(mv.lengthSq()>0){
    mv.normalize().multiplyScalar(speed * (keys.shift?1.45:1));
    // smooth accel
    vel.x += (mv.x - vel.x) * 0.18;
    vel.z += (mv.z - vel.z) * 0.18;
  } else {
    vel.x *= 0.85;
    vel.z *= 0.85;
    if(Math.abs(vel.x)<0.02) vel.x=0;
    if(Math.abs(vel.z)<0.02) vel.z=0;
  }
}

// Portal teleport transform
let teleportCooldown=0;
function tryTeleport(){
  if(teleportCooldown>0) return;
  if(!portalData[0] || !portalData[1]) return;
  for(let i=0;i<2;i++){
    const entry=portalData[i];
    const exit=portalData[1-i];
    if(!entry || !exit) continue;
    // distance to plane
    const toPlayer = pos.clone().sub(entry.pos);
    const dist = toPlayer.dot(entry.normal);
    // player must be in front (>0) and close
    if(dist < -0.9 || dist > 0.9) continue;
    // check within portal rectangle: transform to local
    const local = toPlayer.clone().applyQuaternion(entry.quat.clone().invert());
    // For vertical portal, local x,y correspond to portal width/height, z is along normal
    // But our plane is 1.9x2.9, so check |x|<1.1 and |y|<1.6
    // For horizontal portal (floor), local x,z are plane coords
    let inside=false;
    if(entry.isHorizontal){
      // local x = world X after rotation, local y = world Y? Actually for floor quat (0,0,1 -> 0,1,0) = -90deg X, so local becomes different. Simpler use world coords offset check
      // Check world xz distance to portal center
      const dx=pos.x - entry.pos.x, dz=pos.z - entry.pos.z;
      inside = Math.abs(dx) < 1.15 && Math.abs(dz) < 1.65;
    } else {
      // vertical: after inverse quat, local.x is across width, local.y is height
      inside = Math.abs(local.x) < 1.05 && Math.abs(local.y) < 1.55;
    }
    if(!inside) continue;
    // additionally, moving toward portal: vel dot entry.normal < 0 (approaching from front) ??? We earlier said front is positive normal, so moving towards wall is -normal => dot <0
    // But we measure dist sign: front is + along normal, so to go through you cross from + to -, vel should be - normal direction
    const velDot = vel.dot(entry.normal);
    // allow either direction but primarily crossing? Require |vel| or movement direction toward portal (dist decreasing)
    // Check player is moving through (previous dist vs current) but simpler require velDot < 0.1 and dist <0.4
    if(dist > 0.35 && velDot > -0.1) continue;
    // TELEPORT
    // Compute mirrored local, then transform to exit
    // Use matrices: localPos = invEntry * worldPos ; then mirroredLocal.z = -localPos.z ; then world = exitMatrix * mirroredLocal
    const worldPos4 = new THREE.Vector4(pos.x, pos.y, pos.z, 1);
    // Instead use Vector3 apply matrix
    const localPos = pos.clone().applyMatrix4(entry.invMatrix);
    // mirror Z and also invert X? Keep X same to avoid mirroring; Portal mirrors? Let's keep without X inversion for intuitiveness
    localPos.z = -localPos.z;
    // For horizontal/vertical transition, this handles
    const newPos = localPos.clone().applyMatrix4(exit.matrix);
    // Offset slightly away from exit to avoid immediate re-teleport
    newPos.add(exit.normal.clone().multiplyScalar(0.9));
    pos.copy(newPos);
    // Transform velocity: localVel = invEntry rotation * vel ; mirror Z ; exit rotation * localVel
    const invQuat = entry.quat.clone().invert();
    const localVel = vel.clone().applyQuaternion(invQuat);
    localVel.z = -localVel.z;
    const newVel = localVel.clone().applyQuaternion(exit.quat);
    vel.copy(newVel);
    // Transform yaw/pitch: forward vector
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const localFwd = fwd.clone().applyQuaternion(invQuat);
    localFwd.z = -localFwd.z;
    const newFwd = localFwd.clone().applyQuaternion(exit.quat);
    // derive new yaw/pitch from newFwd
    const newYaw = Math.atan2(-newFwd.x, -newFwd.z);
    const horizLen = Math.sqrt(newFwd.x*newFwd.x + newFwd.z*newFwd.z);
    const newPitch = Math.atan2(newFwd.y, horizLen);
    yaw = newYaw;
    pitch = Math.max(-1.45, Math.min(1.45, newPitch));
    teleportCooldown = 0.6;
    spawnSpark(exit.pos.clone().add(exit.normal.clone().multiplyScalar(0.1)), i===0?0x2d8cff:0xff7a1a);
    // hapticish
    break;
  }
}

// Missions / puzzles
let puzzle1=false, puzzle2=false, won=false;
let timeStart=performance.now();
function checkPuzzles(){
  // puzzle1 considered solved when player has crossed gap: x > 1 (beyond pit)
  if(pos.x > 2.2) puzzle1=true;
  // puzzle2 solved when player is on platform (eye height ~6 and inside platform xz)
  if(pos.x > 7 && pos.x <14 && pos.z > -3.5 && pos.z <3.5 && pos.y > 5.2) puzzle2=true;
}
function updateMissions(p1,p2,p3){
  document.getElementById('m1').className = p1?'done':'';
  document.getElementById('m1').querySelector('.check').textContent = p1?'✓':'○';
  document.getElementById('m2').className = p2?'done':'';
  document.getElementById('m2').querySelector('.check').textContent = p2?'✓':'○';
  document.getElementById('m3').className = p3?'done':'';
  document.getElementById('m3').querySelector('.check').textContent = p3?'✓':'○';
  const prog = (p1?0.33:0)+(p2?0.33:0)+(p3?0.34:0);
  document.getElementById('progress-bar').style.width = (prog*100)+'%';
  document.getElementById('stat-puzzles').textContent = `Puzzles: ${(p1?1:0)+(p2?1:0)}/2`;
}
function updateStats(){
  const elapsed = (performance.now()-timeStart)/1000;
  const mm=String(Math.floor(elapsed/60)).padStart(2,'0');
  const ss=String(Math.floor(elapsed%60)).padStart(2,'0');
  document.getElementById('stat-time').textContent = `${mm}:${ss}`;
  if(won){
    document.getElementById('win-time').textContent=`Time: ${mm}:${ss}`;
    document.getElementById('win-portals').textContent=`Portals: ${portalCount}`;
  }
}

// Exit trigger
function checkWin(){
  const d = pos.distanceTo(new THREE.Vector3(13.2, 6.07, 0));
  if(d < 1.6 && pos.y > 5.0){
    if(puzzle1 && puzzle2){
      if(!won){
        won=true;
        document.getElementById('overlay-win').classList.remove('hidden');
        document.exitPointerLock?.();
        // unlock
        if(document.pointerLockElement) document.exitPointerLock();
        updateStats();
      }
      return true;
    }
  }
  return false;
}
document.getElementById('btn-restart').addEventListener('click', ()=>{
  resetPlayer();
  removePortal(0); removePortal(1);
  portalCount=0; puzzle1=false; puzzle2=false; won=false;
  timeStart=performance.now();
  updateMissions(false,false,false);
  document.getElementById('overlay-win').classList.add('hidden');
});

// Portal view rendering via render targets
function updatePortalViews(){
  if(!portalData[0] || !portalData[1]) {
    // show fallback color when only one active
    portalBlue.fallback.visible = portalData[0] && !portalData[1];
    portalOrange.fallback.visible = portalData[1] && !portalData[0];
    return;
  }
  portalBlue.fallback.visible=false; portalOrange.fallback.visible=false;
  for(let i=0;i<2;i++){
    const srcIdx=i; // portal i shows view through to other side
    const dstIdx=1-i; // camera placed relative to dst portal
    const src = portalData[srcIdx];
    const dst = portalData[dstIdx];
    const cam = portalCams[srcIdx];
    // Compute portal camera transform: mirror player through dst->src
    // player local relative to dst (the portal player looks towards)
    const localPos = pos.clone().applyMatrix4(dst.invMatrix);
    localPos.z = -localPos.z;
    const camPos = localPos.clone().applyMatrix4(src.matrix);
    camPos.add(src.normal.clone().multiplyScalar(0.0)); // already offset by transform
    cam.position.copy(camPos);
    // orientation
    const qInv = dst.quat.clone().invert();
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
    const localFwd = fwd.clone().applyQuaternion(qInv); localFwd.z=-localFwd.z;
    const newFwd = localFwd.clone().applyQuaternion(src.quat);
    // up vector similarly
    const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const localUp = up.clone().applyQuaternion(qInv); localUp.z=-localUp.z;
    const newUp = localUp.clone().applyQuaternion(src.quat);
    const target = camPos.clone().add(newFwd);
    cam.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1), newFwd.clone().normalize());
    // more precise lookAt
    cam.position.copy(camPos);
    cam.lookAt(target);
    // Use up vector
    cam.up.copy(newUp);
    // copy fov
    cam.fov = camera.fov; cam.aspect = 1.9/2.9; cam.updateProjectionMatrix();
  }
  // Render each portal view to its target while hiding portal meshes to avoid recursion
  const origVisible0 = portalBlue.group.visible;
  const origVisible1 = portalOrange.group.visible;
  // Hide both portals during render to avoid seeing them in own view (recursion)
  portalBlue.group.visible=false; portalOrange.group.visible=false;
  // Render portal 0 view (camera 0 sees through portal 0 to dst side)
  renderer.setRenderTarget(portalRT[0]);
  renderer.render(scene, portalCams[0]);
  renderer.setRenderTarget(portalRT[1]);
  renderer.render(scene, portalCams[1]);
  renderer.setRenderTarget(null);
  portalBlue.group.visible=origVisible0;
  portalOrange.group.visible=origVisible1;
}

// Main loop
let last=performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(0.033, (now-last)/1000); last=now;
  if(teleportCooldown>0) teleportCooldown-=dt;
  // input
  applyInput(dt);
  // physics
  collide(pos, vel, dt);
  // teleport check before camera update?
  tryTeleport();
  checkPuzzles();
  if(checkWin()){
    updateMissions(puzzle1,puzzle2,true);
  } else {
    updateMissions(puzzle1,puzzle2,false);
  }
  // camera
  camera.position.copy(pos);
  camera.rotation.order='YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  // cube spin
  cube.rotation.y += dt*0.6; cube.position.y = 0.45 + Math.sin(now*0.002)*0.08;
  // portal ring anim
  portalBlue.ring.rotation.z += dt*1.2;
  portalOrange.ring.rotation.z -= dt*1.2;
  // update views then render
  updatePortalViews();
  renderer.render(scene, camera);
  updateStats();
  // teleport visual pulse
  if(portalBlue.group.visible) portalBlue.ring.scale.setScalar(1 + Math.sin(now*0.005)*0.03);
  if(portalOrange.group.visible) portalOrange.ring.scale.setScalar(1 + Math.sin(now*0.005+1)*0.03);
}
animate(performance.now());

// expose for testing
window.__GAME__ = { get pos(){return pos.clone()}, get yaw(){return yaw}, portalData, resetPlayer, tryPlacePortal };

// Prevent scroll
addEventListener('wheel', e=> e.preventDefault(), {passive:false});

// Initial indicator
updatePortalIndicator();

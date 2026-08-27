import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COST, MAP_SIZE, SUPPLY_BASE, SUPPLY_PER_DEPOT } from './gameConfig.js';
import { canAfford } from './economy.js';
import { canPlace } from './building.js';

// DOM
const canvas = document.getElementById('canvas');
const minVal = document.getElementById('minVal');
const gasVal = document.getElementById('gasVal');
const supVal = document.getElementById('supVal');
const waveVal = document.getElementById('waveVal');
const waveTimerEl = document.getElementById('waveTimer');
const selTitle = document.getElementById('selTitle');
const selgrid = document.getElementById('selgrid');
const toastEl = document.getElementById('toast');
const selbox = document.getElementById('selbox');
const minimap = document.getElementById('minimap');
const minimapWrap = document.getElementById('minimapWrap');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');

let minerals = 600, gas = 0, supplyUsed=0, supplyCap=SUPPLY_BASE;
let wave=1, waveCountDown=30, gameOver=false;
let selected = new Set();
let ctrlGroups = {1:[],2:[],3:[]};
let attackMode=false;
let ghost=null, ghostType=null;
let buildQueue=[]; // {type, remaining, buildingId}
let resourcesList=[]; // mineral fields and geysers
let units=[], buildings=[], projectiles=[], effects=[];
let enemyBuildings=[], enemyUnits=[];
let animId=0;

function toast(msg){
  toastEl.textContent=msg;
  toastEl.style.display='block';
  clearTimeout(toastEl._t);
  toastEl._t=setTimeout(()=>toastEl.style.display='none',2200);
}

// THREE setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1628, 0.008);
scene.background = new THREE.Color(0x060d1a);

const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 500);
camera.position.set(22, 34, 22);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0,0,8);
controls.maxPolarAngle = Math.PI*0.46;
controls.minDistance=8;
controls.maxDistance=78;
controls.enableDamping=true;
controls.dampingFactor=0.08;
controls.mouseButtons={ LEFT:null, MIDDLE:THREE.MOUSE.DOLLY, RIGHT:THREE.MOUSE.PAN };
controls.update();

function onResize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight,false); }
addEventListener('resize', onResize);
onResize();

// lights
const amb = new THREE.AmbientLight(0x8fb0d8,0.55);
scene.add(amb);
const dir = new THREE.DirectionalLight(0xfff6e0,1.35);
dir.position.set(30,48,18);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=1; dir.shadow.camera.far=120;
dir.shadow.camera.left=-60; dir.shadow.camera.right=60; dir.shadow.camera.top=60; dir.shadow.camera.bottom=-60;
dir.shadow.bias=-0.0006;
scene.add(dir);
const hemi = new THREE.HemisphereLight(0x8bb0ff,0x0b1a2e,0.35);
scene.add(hemi);

// stars + planet backdrop
const starGeo = new THREE.BufferGeometry();
const starPos=[]; for(let i=0;i<900;i++){ starPos.push((Math.random()-0.5)*800, 60+Math.random()*120, (Math.random()-0.5)*800); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos,3));
const starMat=new THREE.PointsMaterial({color:0x9fbfff,size:0.55, transparent:true, opacity:0.7});
scene.add(new THREE.Points(starGeo, starMat));

// Terrain
const groundSize=MAP_SIZE;
const groundGeo=new THREE.PlaneGeometry(groundSize, groundSize, 64, 64);
// slight height + color variation
const colors=[];
const colBase=new THREE.Color(0x1a2e4a); const colHigh=new THREE.Color(0x2a4a3a); const crater=new THREE.Color(0x3a3520);
for(let i=0;i<groundGeo.attributes.position.count;i++){
  const x=groundGeo.attributes.position.getX(i), y=groundGeo.attributes.position.getY(i);
  const d=Math.hypot(x,y);
  const h=(Math.sin(x*0.11)*1.1 + Math.cos(y*0.09)*1.1 + Math.sin((x+y)*0.06)*0.9);
  groundGeo.attributes.position.setZ(i, h*0.55 - d*0.015);
  // vertex color based on mineral patches
  let c=colBase.clone().lerp(colHigh, Math.min(1, Math.max(0,(h+2)/4)));
  if(Math.sin(x*0.2)*Math.cos(y*0.2)>0.85) c.lerp(crater,0.18);
  colors.push(c.r,c.g,c.b);
}
groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
groundGeo.computeVertexNormals();
const groundMat=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.92, metalness:0.06 });
const ground=new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x=-Math.PI/2;
ground.receiveShadow=true;
scene.add(ground);
const gridHelper=new THREE.GridHelper(groundSize, 20, 0x24405f, 0x1a2f4a);
gridHelper.position.y=0.08;
scene.add(gridHelper);

// Helper to get terrain height (approx)
function terrainY(x,z){
  // bilinear from groundGeo not precise; approximate with same formula
  return (Math.sin(x*0.11)*1.1 + Math.cos(z*0.09)*1.1 + Math.sin((x+z)*0.06)*0.9)*0.55 - Math.hypot(x,z)*0.015 + 0.05;
}

// Resources
function createMineralField(x,z, amt=1500){
  const grp=new THREE.Group();
  grp.position.set(x, terrainY(x,z), z);
  const geo=new THREE.IcosahedronGeometry(0.9,1);
  const mat=new THREE.MeshStandardMaterial({color:0x4fc3f7, emissive:0x0e2a3a, emissiveIntensity:0.7, roughness:0.35, metalness:0.25});
  for(let i=0;i<4;i++){
    const m=new THREE.Mesh(geo,mat);
    m.position.set((Math.random()-0.5)*1.6, 0.6+Math.random()*0.4, (Math.random()-0.5)*1.6);
    m.scale.setScalar(0.85+Math.random()*0.25);
    m.castShadow=true; m.receiveShadow=true;
    grp.add(m);
  }
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.7,0.25,7), new THREE.MeshStandardMaterial({color:0x1a2e4a}));
  base.position.y=0.12; base.receiveShadow=true; grp.add(base);
  scene.add(grp);
  const res={type:'mineral', x,z, grp, amount:amt, max:amt, id:'min'+Math.random().toString(36).slice(2)};
  resourcesList.push(res);
  return res;
}
function createGeyser(x,z){
  const grp=new THREE.Group(); grp.position.set(x, terrainY(x,z), z);
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.9,1.2,12), new THREE.MeshStandardMaterial({color:0x2e7d6b, emissive:0x0a3a2e, emissiveIntensity:0.5}));
  cyl.position.y=0.6; cyl.castShadow=true; grp.add(cyl);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.12,8,16), new THREE.MeshStandardMaterial({color:0x81c784}));
  ring.rotation.x=Math.PI/2; ring.position.y=0.22; grp.add(ring);
  const puff=new THREE.Mesh(new THREE.SphereGeometry(0.45,10,8), new THREE.MeshStandardMaterial({color:0x81c784, transparent:true, opacity:0.55}));
  puff.position.y=1.35; grp.add(puff);
  scene.add(grp);
  const res={type:'gas', x,z, grp, amount:2000, max:2000, id:'gas'+Math.random().toString(36).slice(2)};
  resourcesList.push(res); return res;
}
// place minerals near player base (south) and enemy north
createMineralField(-12, -10); createMineralField(-6,-10); createMineralField(8,-10); createMineralField(14,-12);
createGeyser(-9,-6); createGeyser(11,-6);
createMineralField(-10, 30); createMineralField(10,32);
createGeyser(0,36);

// Buildings factory
function makeBuildingMesh(kind, isEnemy=false){
  const g=new THREE.Group();
  let size=4, h=2.6, color=isEnemy?0x7a1a1a:0x1e3a5f;
  if(kind==='command'){ size=6; h=3.2; color=isEnemy?0x8b1a1a:0x2a4a7a; }
  if(kind==='supply'){ size=3; h=2.0; color=0x3a3a5a }
  const base=new THREE.Mesh(new THREE.BoxGeometry(size, h, size), new THREE.MeshStandardMaterial({color, roughness:0.78, metalness:0.18}));
  base.position.y=h/2; base.castShadow=true; base.receiveShadow=true; g.add(base);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(size+0.3,0.22,size+0.3), new THREE.MeshStandardMaterial({color:isEnemy?0xff6b6b:0x5ab0ff, emissive:isEnemy?0x330000:0x002244, emissiveIntensity:0.9}));
  trim.position.y=h+0.15; g.add(trim);
  if(kind==='command'){
    const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,1.8,6), new THREE.MeshStandardMaterial({color:0xcde}));
    ant.position.set(1.2,h+0.9,0.8); g.add(ant);
  }
  if(kind==='barracks'){
    const bay=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.0,1.8), new THREE.MeshStandardMaterial({color:0x9fbfff}));
    bay.position.set(0,0.9,size/2+0.25); g.add(bay);
  }
  g.userData.kind=kind; g.userData.size=size;
  return g;
}
function addBuilding(kind, x, z, isEnemy=false, instant=false){
  const mesh=makeBuildingMesh(kind,isEnemy);
  const y=terrainY(x,z);
  mesh.position.set(x,y,z);
  scene.add(mesh);
  const b={id:'b'+Math.random().toString(36).slice(2,7), kind, x,z, y, mesh, hp: kind==='command'?1200:600, maxHp: kind==='command'?1200:600, buildProgress: instant?1:0, isEnemy, size: mesh.userData.size, queue:[] };
  if(!isEnemy) buildings.push(b); else enemyBuildings.push(b);
  // HP bar sprite
  b.hpSprite=makeHpBar(b);
  return b;
}
function makeHpBar(entity){
  const c=document.createElement('canvas'); c.width=64; c.height=10;
  const tex=new THREE.CanvasTexture(c); tex.minFilter=THREE.LinearFilter;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  spr.scale.set(3.2,0.45,1); spr.position.y=4.2; entity.mesh.add(spr);
  entity._hpCanvas=c; entity._hpTex=tex;
  updateHpBar(entity); return spr;
}
function updateHpBar(e){
  if(!e._hpCanvas) return;
  const c=e._hpCanvas, ctx=c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,c.width,c.height);
  const pct=Math.max(0, e.hp/e.maxHp);
  ctx.fillStyle= e.isEnemy? '#e53935' : '#4caf50'; ctx.fillRect(1,1,(c.width-2)*pct,6);
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(1,7,c.width-2,2);
  e._hpTex.needsUpdate=true;
  e.mesh.visible = e.hp>0;
}

// Units
function makeUnitMesh(type, isEnemy=false){
  const g=new THREE.Group();
  let color=isEnemy?0xe53935:(type==='scv'?0xffd54f: type==='marine'?0x64b5f6:0x90a4ae);
  let h=1.1;
  if(type==='tank'){ h=1.4; }
  if(type==='zergling'){ h=0.9; }
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.9,h,0.9), new THREE.MeshStandardMaterial({color, roughness:0.6}));
  body.position.y=h/2+0.1; body.castShadow=true; g.add(body);
  if(type==='marine'){
    const vis=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.22,0.55), new THREE.MeshStandardMaterial({color:0x0a1a33}));
    vis.position.set(0,h*0.62,0.28); g.add(vis);
    const gun=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.95), new THREE.MeshStandardMaterial({color:0x111}));
    gun.position.set(0,h*0.45,0.75); g.add(gun);
  }
  if(type==='tank'){
    const turret=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.42,0.28,8), new THREE.MeshStandardMaterial({color:0x6b7a8a}));
    turret.position.y=h+0.18; g.add(turret);
    const barrel=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,1.4), new THREE.MeshStandardMaterial({color:0x1a1a1a}));
    barrel.position.set(0,h+0.18,0.9); g.add(barrel);
  }
  if(type==='scv'){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.32,0.22), new THREE.MeshStandardMaterial({color:0x8d6e63}));
    arm.position.set(0.42, h*0.55,0.32); g.add(arm);
  }
  if(type==='zergling'){
    const claw=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.08,0.6), new THREE.MeshStandardMaterial({color:0x3a0a0a}));
    claw.position.set(0.34,0.45,0.4); g.add(claw);
    const claw2=claw.clone(); claw2.position.x=-0.34; g.add(claw2);
  }
  // selection ring
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.62,0.88,20), new THREE.MeshBasicMaterial({color: isEnemy?0xff3b30:0x4fc3f7, side:THREE.DoubleSide, transparent:true, opacity:0.98}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.06; ring.visible=false; g.add(ring);
  g.userData.ring=ring;
  g.userData.type=type;
  return g;
}
function spawnUnit(type, x,z, isEnemy=false){
  const mesh=makeUnitMesh(type,isEnemy);
  const y=terrainY(x,z);
  mesh.position.set(x,y+0.2,z);
  scene.add(mesh);
  const stats = type==='scv'? {hp:45,dmg:5,range:1.2,speed:4,cd:0.9} :
                type==='marine'? {hp:40,dmg:9,range:7,speed:3.2,cd:0.55} :
                type==='tank'? {hp:150,dmg:28,range:9,speed:2.2,cd:1.35} :
                {hp:35,dmg:7,range:1.4,speed:4.4,cd:0.7};
  const u={id:'u'+Math.random().toString(36).slice(2,7), type, x,z, mesh, hp:stats.hp, maxHp:stats.hp, dmg:stats.dmg, range:stats.range, speed:stats.speed, cd:stats.cd, cooldown:0, target:null, dest:null, isEnemy, state:'idle', carry:0, carryType:null, miningTarget:null };
  u.hpSprite=makeHpBar(u);
  if(!isEnemy) units.push(u); else enemyUnits.push(u);
  if(!isEnemy) supplyUsed += (type==='tank'?2:1);
  updateResourcesUI();
  updateHpBar(u);
  return u;
}
function updateHpBarU(u){ updateHpBar(u); }

// initial friendly and enemy bases
const playerCC = addBuilding('command', 0, -18, false, true);
const enemyCC = addBuilding('command', 0, 36, true, true);
addBuilding('supply', -6, -16, false, true);
spawnUnit('scv', -2, -14); spawnUnit('scv', 2, -14); spawnUnit('marine', 0, -10);
spawnUnit('zergling', -3, 32, true); spawnUnit('zergling', 3, 32, true); spawnUnit('zergling', 0, 34, true);

// Ghost placement
function ensureGhost(kind){
  if(ghost){ scene.remove(ghost); ghost=null; }
  ghostType=kind;
  const size=kind==='supply'?3:4;
  const g=makeBuildingMesh(kind==='supply'?'supply':'barracks', false);
  g.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.transparent=true; o.material.opacity=0.55; }});
  ghost=g; ghost.userData.size=size; ghost.visible=false; scene.add(ghost);
}
function updateGhostAt(x,z){
  if(!ghost) return;
  const size=ghost.userData.size;
  const ok = canPlace({x,z}, size, [...buildings, ...enemyBuildings]);
  const cost = ghostType==='supply'?COST.supply:COST.barracks;
  const afford = minerals >= (cost.m||0);
  const can = ok && afford && isInsideMap(x,z,size);
  ghost.position.set(x, terrainY(x,z), z);
  ghost.visible=true;
  ghost.traverse(o=>{ if(o.isMesh && o.material.emissive){ o.material.emissive.setHex(can?0x00aa00:0xaa0000); }});
  ghost.userData.canPlace=can;
}
function isInsideMap(x,z,size){ return x>-MAP_SIZE/2+size/2+1 && x<MAP_SIZE/2-size/2-1 && z>-MAP_SIZE/2+size/2+1 && z<MAP_SIZE/2-size/2-1 }
function placeGhost(){
  if(!ghost || !ghost.visible || !ghost.userData.canPlace){ toast(!ghost?'Select building first':'Invalid placement or not enough minerals'); return; }
  const cost=ghostType==='supply'?COST.supply:COST.barracks;
  if(!canAfford({minerals,gas,supplyUsed,supplyCap}, cost)){ toast('Not enough minerals'); return; }
  // building takes 4-5s constructed by SCV? For simplicity instant deduct and create under construction
  minerals -= cost.m; if(cost.g) gas-=cost.g; updateResourcesUI();
  const x=ghost.position.x, z=ghost.position.z;
  const b=addBuilding(ghostType==='supply'?'supply':'barracks', x,z,false,false);
  b.buildProgress=0.01;
  // assign nearby SCV to build
  const scv = selected.size? [...selected].find(id=> units.find(u=>u.id===id && u.type==='scv')) : null;
  let builder = scv ? units.find(u=>u.id===scv) : units.find(u=>u.type==='scv');
  if(builder){ builder.dest={x,z}; builder.state='building'; builder.buildTarget=b; }
  ghost.visible=false;
  toast(ghostType==='supply'?'Supply Depot placed':'Barracks placed');
}

// Raycaster & selection
const raycaster=new THREE.Raycaster(); const mouse=new THREE.Vector2();
let isDragging=false, dragStart=null;
function getMouse(e){ const r=canvas.getBoundingClientRect(); mouse.x=((e.clientX-r.left)/r.width)*2-1; mouse.y=-((e.clientY-r.top)/r.height)*2+1; return mouse; }

canvas.addEventListener('mousedown', (e)=>{
  if(gameOver) return;
  if(e.button===0){
    // if ghost placing, left click places
    if(ghost && ghost.visible){
      const p=getGroundAt(e); if(p) { placeGhost(); return; }
    }
    isDragging=true; dragStart={x:e.clientX,y:e.clientY};
    selbox.style.left=e.clientX+'px'; selbox.style.top=e.clientY+'px'; selbox.style.width='0px'; selbox.style.height='0px'; selbox.style.display='block';
  }
});
canvas.addEventListener('mousemove', (e)=>{
  getMouse(e);
  if(ghost && ghost.visible){
    const p=getGroundAt(e); if(p) updateGhostAt(p.x,p.z);
  }
  if(isDragging && dragStart){
    const x=Math.min(e.clientX, dragStart.x), y=Math.min(e.clientY, dragStart.y);
    const w=Math.abs(e.clientX-dragStart.x), h=Math.abs(e.clientY-dragStart.y);
    selbox.style.left=x+'px'; selbox.style.top=y+'px'; selbox.style.width=w+'px'; selbox.style.height=h+'px';
  }
});
canvas.addEventListener('mouseup', (e)=>{
  if(e.button!==0) return;
  selbox.style.display='none';
  if(!isDragging) return; isDragging=false;
  const dx=Math.abs(e.clientX-dragStart.x), dy=Math.abs(e.clientY-dragStart.y);
  if(dx<7 && dy<7){
    // click select
    handleClickSelect(e);
  } else {
    handleBoxSelect(dragStart, {x:e.clientX,y:e.clientY}, e.shiftKey);
  }
  dragStart=null;
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('mouseup', (e)=>{
  if(e.button===2){
    const p=getGroundAt(e);
    // check if clicked enemy
    const target=pickUnitOrBuilding(e, true);
    handleRightClick(p, target, e);
  }
});
function getGroundAt(e){
  getMouse(e); raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObject(ground);
  if(hits.length) return hits[0].point;
  return null;
}
function pickUnitOrBuilding(e, enemyOnly=false){
  getMouse(e); raycaster.setFromCamera(mouse,camera);
  const allMeshes=[...units.map(u=>u.mesh), ...enemyUnits.map(u=>u.mesh), ...buildings.map(b=>b.mesh), ...enemyBuildings.map(b=>b.mesh)];
  // collect candidates via raycast on groups
  let best=null, bestDist=999;
  const test=[...(!enemyOnly?units:[]), ...enemyUnits, ...(!enemyOnly?buildings:[]), ...enemyBuildings];
  for(const ent of test){
    // quick distance via bounding
    const pos=ent.mesh.position; const ndc=pos.clone().project(camera);
    const sx=(ndc.x*0.5+0.5)*innerWidth, sy=(-ndc.y*0.5+0.5)*innerHeight;
    const d=Math.hypot(sx-e.clientX, sy-e.clientY);
    if(d<28 && ndc.z<1 && ndc.z>-1){ if(d<bestDist){ bestDist=d; best=ent; }}
  }
  return best;
}
function handleClickSelect(e){
  const ent=pickUnitOrBuilding(e,false);
  if(ent && ent.type){ // unit
    if(!e.shiftKey) clearSelection();
    toggleSelect(ent.id);
  } else if(ent && ent.kind){ // building
    if(!e.shiftKey) clearSelection();
    toggleSelect(ent.id);
  } else {
    // mineral? click to mine if SCV selected
    const res=pickResource(e);
    if(res && hasSelectedSCV()){
      orderMining(res);
    } else {
      if(!e.shiftKey) clearSelection();
    }
  }
  updateSelectionUI();
}
function pickResource(e){
  getMouse(e); raycaster.setFromCamera(mouse,camera);
  for(const r of resourcesList){
    const pos=r.grp.position; const ndc=pos.clone().project(camera);
    const sx=(ndc.x*0.5+0.5)*innerWidth, sy=(-ndc.y*0.5+0.5)*innerHeight;
    if(Math.hypot(sx-e.clientX, sy-e.clientY)<32) return r;
  }
  return null;
}
function hasSelectedSCV(){ return [...selected].some(id=> units.find(u=>u.id===id && u.type==='scv')); }
function orderMining(res){
  for(const id of selected){
    const u=units.find(x=>x.id===id && x.type==='scv');
    if(u){ u.miningTarget=res; u.dest={x:res.x, z:res.z}; u.state='toMine'; u.carry=0; }
  }
  toast('Mining ordered');
}
function handleBoxSelect(a,b, add){
  const minX=Math.min(a.x,b.x), maxX=Math.max(a.x,b.x), minY=Math.min(a.y,b.y), maxY=Math.max(a.y,b.y);
  if(!add) clearSelection();
  for(const u of units){
    const p=u.mesh.position.clone().project(camera);
    const sx=(p.x*0.5+0.5)*innerWidth, sy=(-p.y*0.5+0.5)*innerHeight;
    if(sx>=minX && sx<=maxX && sy>=minY && sy<=maxY && p.z>-1 && p.z<1){
      selected.add(u.id);
      u.mesh.userData.ring.visible=true;
    }
  }
  updateSelectionUI();
}
function toggleSelect(id){
  const ent = units.find(u=>u.id===id) || buildings.find(b=>b.id===id);
  if(selected.has(id)){ selected.delete(id); if(ent) ent.mesh.userData.ring&&(ent.mesh.userData.ring.visible=false); }
  else { selected.add(id); if(ent && ent.mesh.userData.ring) ent.mesh.userData.ring.visible=true; if(ent && ent.kind) { /* building ring not present, add highlight */ ent.mesh.traverse(o=>{if(o.isMesh) o.material.emissiveIntensity=1.2}); setTimeout(()=>ent.mesh.traverse(o=>{if(o.isMesh) o.material.emissiveIntensity=0.9}),300); } }
}
function clearSelection(){
  for(const id of selected){
    const u=units.find(x=>x.id===id); if(u) u.mesh.userData.ring.visible=false;
    const b=buildings.find(x=>x.id===id); if(b) b.mesh.traverse(o=>{if(o.isMesh) o.material.emissiveIntensity=0.9});
  }
  selected.clear();
}
function handleRightClick(point, target, e){
  if(selected.size===0) return;
  if(target && (target.isEnemy || target.kind && target.isEnemy)){
    // attack
    for(const id of selected){
      const u=units.find(x=>x.id===id);
      if(u){ u.target=target; u.dest={x:target.x, z:target.z}; u.state='attack'; }
    }
    toast('Attack!');
  } else if(target && target.type==='mineral' || target && target.type==='gas'){
    orderMining(target);
  } else if(point){
    // check mineral near point
    let res=null; for(const r of resourcesList){ if(Math.hypot(r.x-point.x, r.z-point.z)<1.8) res=r; }
    if(res && hasSelectedSCV()){ orderMining(res); return; }
    // move
    for(const id of selected){
      const u=units.find(x=>x.id===id);
      if(u){ u.dest={x:point.x,z:point.z}; u.target=null; u.state='move'; u.attackMode=attackMode; }
    }
    spawnPing(point.x, point.z, 0x4fc3f7);
  }
}
function spawnPing(x,z,color){
  const g=new THREE.Mesh(new THREE.RingGeometry(0.6,0.72,18), new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide, transparent:true, opacity:0.9}));
  g.rotation.x=-Math.PI/2; g.position.set(x, terrainY(x,z)+0.25, z);
  scene.add(g); effects.push({mesh:g, t:0, life:0.7, type:'ping'});
}

// UI bindings
document.getElementById('btnBarracks').onclick=()=>{ ensureGhost('barracks'); toast('Place Barracks — click green zone'); };
document.getElementById('btnSupply').onclick=()=>{ ensureGhost('supply'); toast('Place Supply Depot'); };
document.getElementById('btnSCV').onclick=()=>queueUnit('scv');
document.getElementById('btnMarine').onclick=()=>queueUnit('marine');
document.getElementById('btnTank').onclick=()=>queueUnit('tank');
document.getElementById('btnRestart').onclick=()=>location.reload();
document.getElementById('btnSave').onclick=()=>{ localStorage.setItem('sc3d', JSON.stringify({minerals,gas,wave})); toast('Saved'); };
document.getElementById('modalBtn').onclick=()=>location.reload();

function queueUnit(type){
  if(selected.size===0){ toast('Select Command Center or Barracks'); return; }
  // find selected building capable
  let b=null;
  for(const id of selected){
    const cand=buildings.find(x=>x.id===id);
    if(cand){ if(type==='scv' && cand.kind==='command') b=cand; if((type==='marine'||type==='tank') && cand.kind==='barracks') b=cand; }
  }
  if(!b){ toast(type==='scv'?'Select Command Center':'Select Barracks'); return; }
  if(b.buildProgress<1){ toast('Building still constructing'); return; }
  const cost=COST[type];
  if(!canAfford({minerals,gas,supplyUsed,supplyCap}, cost)){ toast('Not enough resources/supply'); return; }
  if(b.queue.length>=5){ toast('Queue full (5)'); return; }
  minerals-=cost.m; gas-=cost.g||0; updateResourcesUI();
  b.queue.push({type, remaining: cost.time});
  toast(`${type} queued`);
}

function updateResourcesUI(){
  minVal.textContent=Math.floor(minerals);
  gasVal.textContent=Math.floor(gas);
  supVal.textContent=`${supplyUsed}/${supplyCap}`;
}
updateResourcesUI();

// Keyboard
addEventListener('keydown', (e)=>{
  if(e.key==='a' || e.key==='A'){ attackMode=!attackMode; toast(attackMode?'Attack-move ON (right-click to attack-move)':'Attack-move OFF'); e.preventDefault(); }
  if(e.key==='Escape'){ if(ghost){ scene.remove(ghost); ghost=null; ghostType=null; toast('Cancelled'); } clearSelection(); updateSelectionUI(); }
  if(e.ctrlKey && ['1','2','3'].includes(e.key)){ ctrlGroups[e.key]=[...selected]; toast('Group '+e.key+' saved ('+selected.size+')'); e.preventDefault(); }
  else if(['1','2','3'].includes(e.key) && !e.ctrlKey){
    clearSelection(); for(const id of ctrlGroups[e.key]||[]){ const u=units.find(x=>x.id===id); if(u){ selected.add(id); u.mesh.userData.ring.visible=true; } } updateSelectionUI();
  }
  if(e.key==='b' || e.key==='B'){ ensureGhost('barracks'); }
  if(e.key==='s' || e.key==='S'){ ensureGhost('supply'); }
});

function updateSelectionUI(){
  if(selected.size===0){ selTitle.textContent='No selection — drag to select SCVs/Marines'; selgrid.innerHTML=''; document.getElementById('actionGrid').innerHTML=''; return; }
  const ids=[...selected];
  const first=units.find(u=>u.id===ids[0]) || buildings.find(b=>b.id===ids[0]) || enemyUnits.find(u=>u.id===ids[0]);
  selTitle.textContent=`Selected: ${ids.length} — ${first?.type||first?.kind} ${ids.length>1?' +'+(ids.length-1):''} (RMB move/attack)`;
  selgrid.innerHTML=ids.slice(0,12).map(id=>{
    const u=units.find(x=>x.id===id) || buildings.find(x=>x.id===id);
    const label=u?.type||u?.kind||id;
    const hp=u? `${Math.ceil(u.hp)}/${u.maxHp}` : '';
    return `<span class="chip">${label} ${hp}</span>`;
  }).join('');
  // action grid contextual
  const hasSCV = ids.some(id=> units.find(u=>u.id===id && u.type==='scv'));
  const hasCC = ids.some(id=> buildings.find(b=>b.id===id && b.kind==='command'));
  const hasRax = ids.some(id=> buildings.find(b=>b.id===id && b.kind==='barracks'));
  let html='';
  if(hasSCV) html+=`<button class="ui" onclick="document.getElementById('btnBarracks').click()">Barracks (B)</button><button class="ui" onclick="document.getElementById('btnSupply').click()">Supply (S)</button>`;
  if(hasCC) html+=`<button class="ui" onclick="document.getElementById('btnSCV').click()">Train SCV 50M</button>`;
  if(hasRax) html+=`<button class="ui" onclick="document.getElementById('btnMarine').click()">Marine 60M</button><button class="ui" onclick="document.getElementById('btnTank').click()">Tank 120M+20G</button>`;
  document.getElementById('actionGrid').innerHTML=html;
}

// Minimap
const mctx=minimap.getContext('2d');
function drawMinimap(){
  const s=200, pad=6;
  mctx.clearRect(0,0,s,s);
  // background
  mctx.fillStyle='#0b1a2e'; mctx.fillRect(0,0,s,s);
  // terrain simple gradient based on height approximation
  // draw resources
  function toMap(x,z){ return {x: (x/MAP_SIZE+0.5)* (s-pad*2)+pad, y: (1-(z/MAP_SIZE+0.5))*(s-pad*2)+pad }; }
  // minerals
  for(const r of resourcesList){
    const p=toMap(r.x,r.z);
    mctx.fillStyle=r.type==='mineral'? '#4fc3f7' : '#81c784';
    mctx.globalAlpha= Math.max(0.25, r.amount/r.max);
    mctx.beginPath(); mctx.arc(p.x,p.y, r.type==='mineral'?4:5,0,Math.PI*2); mctx.fill();
    mctx.globalAlpha=1;
  }
  // buildings
  for(const b of [...buildings, ...enemyBuildings]){
    const p=toMap(b.x,b.z);
    mctx.fillStyle=b.isEnemy? '#e53935' : (b.kind==='command'?'#5ab0ff':'#90a4ae');
    mctx.fillRect(p.x-3,p.y-3,6,6);
    if(b.hp < b.maxHp){ mctx.fillStyle='#000'; mctx.fillRect(p.x-6,p.y-5,12,2); mctx.fillStyle='#4caf50'; mctx.fillRect(p.x-6,p.y-5,12*(b.hp/b.maxHp),2); }
  }
  // units
  for(const u of [...units, ...enemyUnits]){
    const p=toMap(u.mesh.position.x, u.mesh.position.z);
    mctx.fillStyle=u.isEnemy? '#ff5252' : (u.type==='scv'?'#ffd54f': u.type==='marine'?'#64b5f6' :'#b0bec5');
    mctx.beginPath(); mctx.arc(p.x,p.y,2.4,0,Math.PI*2); mctx.fill();
    if(selected.has(u.id)){ mctx.strokeStyle='#fff'; mctx.lineWidth=1; mctx.stroke(); }
  }
  // camera frustum
  const camMap=toMap(controls.target.x, controls.target.z);
  mctx.strokeStyle='rgba(255,255,255,0.65)'; mctx.lineWidth=1;
  mctx.strokeRect(camMap.x-14, camMap.y-10,28,20);
  // border
  mctx.strokeStyle='#2a4a6a'; mctx.lineWidth=2; mctx.strokeRect(0.5,0.5,s-1,s-1);
}
minimap.addEventListener('click', (e)=>{
  const r=minimap.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
  const wx=(x-0.5)*MAP_SIZE, wz=(1-y-0.5)*MAP_SIZE;
  controls.target.set(wx,0,wz); camera.position.set(wx+22,34,wz+22); controls.update();
});

// Game loop helpers
let last=performance.now();
function nearestEnemy(unit, range=999){
  let best=null, dmin=range;
  for(const e of [...enemyUnits, ...enemyBuildings]){ if(e.hp<=0) continue; const d=Math.hypot(e.x - unit.mesh.position.x, e.z - unit.mesh.position.z); if(d<dmin){ dmin=d; best=e; } }
  return best;
}
function nearestFriendlyForEnemy(eu){
  let best=null, dmin=999;
  for(const u of [...units, ...buildings]){ if(u.hp<=0) continue; const d=Math.hypot(u.x - eu.mesh.position.x, u.z - eu.mesh.position.z); if(d<dmin){ dmin=d; best=u; } }
  return best;
}
function moveTowards(ent, dest, dt){
  const dx=dest.x - ent.mesh.position.x, dz=dest.z - ent.mesh.position.z;
  const d=Math.hypot(dx,dz);
  if(d<0.45){ ent.mesh.position.x=dest.x; ent.mesh.position.z=dest.z; ent.x=dest.x; ent.z=dest.z; return true; }
  const step=ent.speed*dt;
  const nx=dx/d*step, nz=dz/d*step;
  ent.mesh.position.x+=nx; ent.mesh.position.z+=nz;
  ent.mesh.position.y=terrainY(ent.mesh.position.x, ent.mesh.position.z)+0.2;
  ent.x=ent.mesh.position.x; ent.z=ent.mesh.position.z;
  // face
  ent.mesh.rotation.y=Math.atan2(dx,dz);
  return false;
}
function tryAttack(attacker, target, dt){
  if(!target || target.hp<=0) return false;
  const d=Math.hypot(target.x - attacker.mesh.position.x, target.z - attacker.mesh.position.z);
  if(d > attacker.range){
    // close in
    attacker.dest={x:target.x, z:target.z};
    moveTowards(attacker, attacker.dest, dt);
    return false;
  }
  // in range, attack cooldown
  attacker.cooldown-=dt;
  if(attacker.cooldown<=0){
    attacker.cooldown=attacker.cd;
    // projectile
    if(attacker.type==='marine' || attacker.type==='tank' || attacker.type==='zergling' || attacker.type==='scv'){
      const start=attacker.mesh.position.clone(); start.y+=0.9;
      const end=new THREE.Vector3(target.x, terrainY(target.x,target.z)+0.9, target.z);
      const proj=new THREE.Mesh(new THREE.SphereGeometry(attacker.type==='tank'?0.18:0.09,6,6), new THREE.MeshBasicMaterial({color: attacker.isEnemy?0xff6b6b:0xffe082}));
      proj.position.copy(start); scene.add(proj);
      projectiles.push({mesh:proj, from:start, to:end, t:0, dmg:attacker.dmg, target});
    } else {
      target.hp-=attacker.dmg; updateHpBar(target);
    }
    // muzzle flash
    const flash=new THREE.Mesh(new THREE.SphereGeometry(0.18,6,6), new THREE.MeshBasicMaterial({color:0xfff6a0, transparent:true, opacity:0.9}));
    flash.position.copy(attacker.mesh.position); flash.position.y+=0.9; flash.position.z+=0.5;
    scene.add(flash); effects.push({mesh:flash,t:0,life:0.12,type:'flash'});
  }
  return true;
}

function updateBuildings(dt){
  for(const b of buildings){
    if(b.buildProgress<1){
      b.buildProgress+= dt/5; // 5s build
      if(b.buildProgress>=1){ b.buildProgress=1; toast((b.kind==='barracks'?'Barracks':'Supply Depot')+' ready'); if(b.kind==='supply'){ supplyCap+=SUPPLY_PER_DEPOT; updateResourcesUI(); } }
      // scale effect
      const s=0.4 + b.buildProgress*0.6; b.mesh.scale.set(s,s,s);
    }
    if(b.queue.length){
      b.queue[0].remaining-= dt*1000;
      if(b.queue[0].remaining<=0){
        const q=b.queue.shift();
        const spawnX=b.x + (Math.random()-0.5)*2, spawnZ=b.z+3;
        spawnUnit(q.type, spawnX, spawnZ, false);
        toast(q.type+' ready');
      }
    }
  }
}

function updateUnits(dt){
  for(const u of [...units, ...enemyUnits]){
    if(u.hp<=0) continue;
    // AI for enemy zerglings: chase nearest friendly
    if(u.isEnemy){
      if(!u.target || u.target.hp<=0) u.target=nearestFriendlyForEnemy(u);
      if(u.target){ tryAttack(u, u.target, dt); }
      else if(u.dest) moveTowards(u,u.dest, dt);
      continue;
    }
    // friendly logic
    if(u.type==='scv' && (u.state==='toMine' || u.state==='mining' || u.state==='returning')){
      if(u.state==='toMine'){
        const r=u.miningTarget; if(!r || r.amount<=0){ u.state='idle'; continue; }
        const arrived=moveTowards(u, {x:r.x, z:r.z}, dt);
        if(arrived){ u.state='mining'; u.miningTime=0; }
      } else if(u.state==='mining'){
        u.miningTime+=dt;
        if(u.miningTime>1.1){
          if(u.miningTarget.amount>0){
            const take=Math.min(8, u.miningTarget.amount);
            u.miningTarget.amount-=take; u.carry=take; u.carryType=u.miningTarget.type;
            u.state='returning'; u.dest={x:playerCC.x, z:playerCC.z};
            // visual carry
            if(!u._carryMesh){ const cm=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.32,0.42), new THREE.MeshStandardMaterial({color: u.carryType==='mineral'?0x4fc3f7:0x81c784})); cm.position.set(0.42,0.95,0); u.mesh.add(cm); u._carryMesh=cm; }
          } else u.state='idle';
        }
      } else if(u.state==='returning'){
        const arrived=moveTowards(u, u.dest, dt);
        if(arrived){
          if(u.carryType==='mineral') minerals+=u.carry; else gas+=u.carry;
          u.carry=0; updateResourcesUI();
          if(u._carryMesh){ u.mesh.remove(u._carryMesh); u._carryMesh=null; }
          if(u.miningTarget && u.miningTarget.amount>0){ u.state='toMine'; u.dest={x:u.miningTarget.x, z:u.miningTarget.z}; } else u.state='idle';
        }
      }
      continue;
    }
    if(u.state==='building'){
      if(u.buildTarget){
        const bt=u.buildTarget;
        const arrived=moveTowards(u, {x:bt.x, z:bt.z}, dt);
        if(Math.hypot(u.x-bt.x, u.z-bt.z)<2.2){
          // build assist
          bt.buildProgress+= dt/4;
          if(bt.buildProgress>=1){ bt.buildProgress=1; u.state='idle'; u.buildTarget=null; }
        }
      } else u.state='idle';
      continue;
    }
    if(u.state==='attack' && u.target){
      if(u.target.hp<=0){ u.target=null; u.state='idle'; continue; }
      tryAttack(u, u.target, dt);
      continue;
    }
    if(u.state==='move' && u.dest){
      const done=moveTowards(u, u.dest, dt);
      if(done){ u.state='idle'; u.dest=null; }
      // if attack-move, scan for enemies
      if(u.attackMode && !u.target){
        const e=nearestEnemy(u, u.range+2);
        if(e){ u.target=e; u.state='attack'; }
      }
      continue;
    }
    // idle: auto-attack nearby
    const e=nearestEnemy(u, u.range);
    if(e){ u.target=e; u.state='attack'; }
  }
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i]; p.t+= dt*4.5;
    if(p.t>=1){
      if(p.target && p.target.hp>0){ p.target.hp-=p.dmg; updateHpBar(p.target);
        // damage flash
        p.target.mesh.traverse(o=>{if(o.isMesh && o.material.emissive) o.material.emissive.setHex(0xff0000);});
        setTimeout(()=>{ if(p.target.mesh) p.target.mesh.traverse(o=>{if(o.isMesh) o.material.emissive.setHex(0x000000);}); },90);
        // number pop
        const c=document.createElement('canvas'); c.width=64; c.height=28;
        const ctx=c.getContext('2d'); ctx.fillStyle='rgba(255,60,60,0.95)'; ctx.font='bold 18px monospace'; ctx.fillText('-'+p.dmg,6,20);
        const tex=new THREE.CanvasTexture(c); const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex}));
        spr.position.set(p.target.x, terrainY(p.target.x,p.target.z)+3.2, p.target.z); spr.scale.set(2.2,0.95,1); scene.add(spr);
        effects.push({mesh:spr,t:0,life:0.7,type:'dmg'});
        if(p.target.hp<=0){
          // death explosion
          const boom=new THREE.Mesh(new THREE.SphereGeometry(0.9,10,8), new THREE.MeshBasicMaterial({color:0xff6b35, transparent:true, opacity:0.85}));
          boom.position.set(p.target.x, terrainY(p.target.x,p.target.z)+0.9, p.target.z); scene.add(boom);
          effects.push({mesh:boom,t:0,life:0.45,type:'boom'});
          // remove entity
          scene.remove(p.target.mesh);
          if(p.target._hpCanvas) p.target.mesh.remove(p.target.hpSprite);
          if(p.target.isEnemy){
            enemyUnits=enemyUnits.filter(x=>x!==p.target); enemyBuildings=enemyBuildings.filter(x=>x!==p.target);
            if(p.target.kind==='command'){ winGame(); }
          } else {
            units=units.filter(x=>x!==p.target); buildings=buildings.filter(x=>x!==p.target);
            supplyUsed=Math.max(0, supplyUsed-1);
            updateResourcesUI();
            if(p.target.kind==='command'){ loseGame(); }
          }
        }
      }
      scene.remove(p.mesh); projectiles.splice(i,1);
    } else {
      p.mesh.position.lerpVectors(p.from, p.to, p.t);
    }
  }
}
function updateEffects(dt){
  for(let i=effects.length-1;i>=0;i--){
    const e=effects[i]; e.t+=dt;
    if(e.t>e.life){ scene.remove(e.mesh); effects.splice(i,1); continue; }
    if(e.type==='ping'){ e.mesh.material.opacity=0.9*(1-e.t/e.life); e.mesh.scale.setScalar(1+e.t*1.2); }
    if(e.type==='flash'){ e.mesh.material.opacity=0.9*(1-e.t/e.life); e.mesh.scale.setScalar(1+e.t*6); }
    if(e.type==='dmg'){ e.mesh.position.y+= dt*0.9; e.mesh.material.opacity=1-e.t/e.life; }
    if(e.type==='boom'){ e.mesh.scale.setScalar(1+e.t*4); e.mesh.material.opacity=0.85*(1-e.t/e.life); }
  }
}

// Wave spawner
let waveElapsed=0;
function updateWaves(dt){
  if(gameOver) return;
  waveElapsed+=dt; waveCountDown-=dt;
  if(waveCountDown<=0){
    wave++; waveCountDown=32; waveVal.textContent=wave;
    // spawn waveSize = 2+wave
    const size= 2 + Math.floor(wave*1.2);
    for(let i=0;i<size;i++){
      setTimeout(()=> spawnUnit('zergling', (Math.random()-0.5)*18, 38+Math.random()*6, true), i*420);
    }
    toast('Wave '+wave+' incoming! ('+size+' zerglings)');
    // also give player passive gas trickle
    gas+=4; updateResourcesUI();
  }
  waveTimerEl.textContent=`— ${Math.max(0,Math.ceil(waveCountDown))}s`;
}

function winGame(){ if(gameOver) return; gameOver=true; modalTitle.textContent='Victory!'; modalBody.textContent='Enemy Command Center destroyed. Sector secured.'; modal.style.display='flex'; }
function loseGame(){ if(gameOver) return; gameOver=true; modalTitle.textContent='Defeat'; modalBody.textContent='Your Command Center was destroyed. The swarm prevails.'; modal.style.display='flex'; }

function animate(now){
  animId=requestAnimationFrame(animate);
  const dt=Math.min(0.033, (now-last)/1000); last=now;
  if(!gameOver){
    updateBuildings(dt);
    updateUnits(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateWaves(dt);
  } else {
    updateProjectiles(dt); updateEffects(dt);
  }
  controls.update();
  renderer.render(scene, camera);
  drawMinimap();
  // subtle resource puff anim
  for(const r of resourcesList){ if(r.type==='gas') r.grp.children[2].position.y=1.35+Math.sin(now*0.002+r.x)*0.12; }
}
animate(performance.now());

// initial ping
setTimeout(()=> spawnPing(0,36,0xff5252), 800);

// passive income fallback (if SCV idle, give trickle)
setInterval(()=>{ if(!gameOver && units.filter(u=>u.type==='scv').length===0){ minerals+=2; updateResourcesUI(); } }, 2500);

// expose for tests / debug
window.__sc = { canPlace, terrainY, COST };


import * as THREE from 'three';
import { canPickup, shipZone, isWin } from './gameLogic.js';

// ---------- DOM ----------
const canvas = document.getElementById('c');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderText = document.getElementById('loaderText');
const countEl = document.getElementById('count');
const objectiveEl = document.getElementById('objective');
const chestsRow = document.getElementById('chestsRow');
const promptEl = document.getElementById('prompt');
const promptText = document.getElementById('promptText');
const promptBtn = document.getElementById('promptBtn');
const winEl = document.getElementById('win');
const winTime = document.getElementById('winTime');
const restartBtn = document.getElementById('restartBtn');
const continueBtn = document.getElementById('continueBtn');
const creditsBtn = document.getElementById('creditsBtn');
const credits = document.getElementById('credits');
const closeCredits = document.getElementById('closeCredits');
const minimap = document.getElementById('map');
const mctx = minimap.getContext('2d');
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const mobileAction = document.getElementById('mobileAction');

function setLoader(p, t){ loaderFill.style.width = p+'%'; if(t) loaderText.textContent=t; }
setLoader(10,'Carving island from the sea…');

// ---------- THREE ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c7ee);
scene.fog = new THREE.Fog(0x9fd4f0, 48, 140);

const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 400);
let camYaw = Math.PI; // looking north to island
let camPitch = 0.58;
let camDist = 14;
let camTarget = new THREE.Vector3(0,1,2);
let orbitDragging=false, lastX=0, lastY=0;

// lights
scene.add(new THREE.HemisphereLight(0xdff4ff, 0x1a3a2a, 1.35));
const sun = new THREE.DirectionalLight(0xfff2c2, 2.2);
sun.position.set(28,42,18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near=1; sun.shadow.camera.far=120;
sun.shadow.camera.left=-50; sun.shadow.camera.right=50; sun.shadow.camera.top=50; sun.shadow.camera.bottom=-50;
sun.shadow.bias=-0.0006;
scene.add(sun);
// fill
const fill = new THREE.DirectionalLight(0x7ec8ff, 0.55);
fill.position.set(-22,18,-18);
scene.add(fill);

setLoader(22,'Raising palm crowns & basalt cliffs…');

// ---------- helpers ----------
function lerp(a,b,t){return a+(b-a)*t}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}

// materials
const matSand = new THREE.MeshStandardMaterial({ color:0xE8C99A, roughness:0.95 });
const matBeach = new THREE.MeshStandardMaterial({ color:0xF2D9B0, roughness:0.9 });
const matGrass = new THREE.MeshStandardMaterial({ color:0x4a9a3a, roughness:0.9 });
const matGrassDark = new THREE.MeshStandardMaterial({ color:0x2f6b26, roughness:1 });
const matRock = new THREE.MeshStandardMaterial({ color:0x8a7f78, roughness:0.92 });
const matRockDark = new THREE.MeshStandardMaterial({ color:0x5e5752, roughness:0.95 });
const matTrunk = new THREE.MeshStandardMaterial({ color:0x6b3f1f, roughness:0.88 });
const matPalmLeaf = new THREE.MeshStandardMaterial({ color:0x2f7a2d, roughness:0.7, side:THREE.DoubleSide });
const matOcean = new THREE.MeshStandardMaterial({ color:0x0e6b8a, roughness:0.35, metalness:0.06, transparent:true, opacity:0.98 });

// ---------- OCEAN ----------
const oceanGeo = new THREE.PlaneGeometry(420,420,80,80);
const ocean = new THREE.Mesh(oceanGeo, matOcean);
ocean.rotation.x = -Math.PI/2;
ocean.position.y = -0.9;
ocean.receiveShadow = true;
scene.add(ocean);
// store original
const oceanPos = oceanGeo.attributes.position;
const oceanOrig = oceanPos.array.slice();

// island group
const island = new THREE.Group();
scene.add(island);

// base island disc with slight noise — use cylinder
const islandBaseGeo = new THREE.CylinderGeometry(26,27,2.2,40);
const islandBase = new THREE.Mesh(islandBaseGeo, matSand);
islandBase.position.y = -0.2;
islandBase.receiveShadow = true; islandBase.castShadow=true;
island.add(islandBase);
// beach ring
const beachGeo = new THREE.RingGeometry(18,26.5,48);
beachGeo.rotateX(-Math.PI/2);
const beach = new THREE.Mesh(beachGeo, matBeach);
beach.position.y = 0.02;
beach.receiveShadow=true;
island.add(beach);
// grass interior
const grassGeo = new THREE.CircleGeometry(18.8,48);
grassGeo.rotateX(-Math.PI/2);
const grass = new THREE.Mesh(grassGeo, matGrass);
grass.position.y = 0.06;
grass.receiveShadow=true;
island.add(grass);
// central hill
const hillGeo = new THREE.SphereGeometry(9,32,20,0,Math.PI*2,0,Math.PI/2);
hillGeo.scale(1,0.55,1);
const hill = new THREE.Mesh(hillGeo, matGrassDark);
hill.position.set(3,0.08, -6);
hill.castShadow=true; hill.receiveShadow=true;
island.add(hill);
const hill2Geo = new THREE.SphereGeometry(6.5,24,16,0,Math.PI*2,0,Math.PI/2);
hill2Geo.scale(1,0.6,1);
const hill2 = new THREE.Mesh(hill2Geo, new THREE.MeshStandardMaterial({color:0x3a7f2f, roughness:0.95}));
hill2.position.set(-7,0.06, -2);
island.add(hill2);

// lagoon cut — dock bay at south
const bayGeo = new THREE.CircleGeometry(7,32);
bayGeo.rotateX(-Math.PI/2);
const bay = new THREE.Mesh(bayGeo, new THREE.MeshStandardMaterial({color:0x2fb5d8, roughness:0.4, metalness:0.06, transparent:true, opacity:0.9}));
bay.position.set(0, -0.18, 20.5);
bay.scale.set(1,1,0.75);
island.add(bay);

// dock
const dockGroup = new THREE.Group();
dockGroup.position.set(0,0.02, 24);
island.add(dockGroup);
const dockPlankMat = new THREE.MeshStandardMaterial({color:0x8a5a2a, roughness:0.85});
for(let i=0;i<5;i++){
  const plank = new THREE.Mesh(new THREE.BoxGeometry(10,0.14,0.5), dockPlankMat);
  plank.position.set(0,0, i*0.62-1.2);
  plank.castShadow=true; plank.receiveShadow=true;
  dockGroup.add(plank);
}
const dockPiles = new THREE.Mesh(new THREE.BoxGeometry(10.4,1.2,0.2), new THREE.MeshStandardMaterial({color:0x5a3a14}));
dockPiles.position.y=-0.6; dockGroup.add(dockPiles);

// rocks scattered
function createRock(x,z,s,h){
  const g = new THREE.DodecahedronGeometry(s,0);
  // distort
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    pos.setXYZ(i, pos.getX(i)*(0.8+Math.random()*0.4), pos.getY(i)*(0.5+Math.random()*0.5), pos.getZ(i)*(0.8+Math.random()*0.4));
  }
  pos.needsUpdate=true; g.computeVertexNormals();
  const m = new THREE.Mesh(g, Math.random()<0.5?matRock:matRockDark);
  m.position.set(x, h*0.5, z);
  m.scale.set(1, h/s*0.9, 1);
  m.castShadow=true; m.receiveShadow=true;
  m.rotation.set(Math.random()*0.6, Math.random()*Math.PI, Math.random()*0.4);
  island.add(m);
  return m;
}
const colliders = [];
function addCollider(x,z,r){ colliders.push({x,z,r}); }
createRock(-12, -8, 1.8, 1.6); addCollider(-12,-8,1.7);
createRock(10, -10, 2.2, 1.9); addCollider(10,-10,2.0);
createRock(-15, 4, 1.6, 1.2); addCollider(-15,4,1.5);
createRock(13, 6, 1.7, 1.4); addCollider(13,6,1.5);
createRock(-5, -12, 1.3, 1.0); addCollider(-5,-12,1.2);
createRock(6, 2, 1.1, 0.9); addCollider(6,2,1.0);
createRock(-8, -1, 1.0, 0.8); addCollider(-8,-1,0.95);
createRock(0, -9, 1.2, 0.85); addCollider(0,-9,1.0);
// ring of small rocks near water
for(let i=0;i<12;i++){
  const a = (i/12)*Math.PI*2;
  const r = 22+Math.random()*2;
  createRock(Math.cos(a)*r, Math.sin(a)*r, 0.7+Math.random()*0.6, 0.7);
}

// palms
function createPalm(x,z,scale=1){
  const g = new THREE.Group();
  g.position.set(x,0,z);
  const h = (5+Math.random()*1.6)*scale;
  const trunkGeo = new THREE.CylinderGeometry(0.18*scale,0.28*scale,h,8);
  // bend trunk slight
  const trunk = new THREE.Mesh(trunkGeo, matTrunk);
  trunk.position.y = h/2;
  trunk.castShadow=true;
  // lean
  trunk.rotation.z = (Math.random()-0.5)*0.18;
  trunk.rotation.x = (Math.random()-0.5)*0.12;
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(0,h,0);
  g.add(crown);
  const leaves = new THREE.Group();
  crown.add(leaves);
  for(let i=0;i<6;i++){
    const leafGeo = new THREE.CapsuleGeometry(0.26*scale, 1.9*scale, 4, 8);
    leafGeo.rotateZ(Math.PI/2);
    const leaf = new THREE.Mesh(leafGeo, matPalmLeaf);
    leaf.position.y = 0.15*scale;
    leaf.rotation.y = (i/6)*Math.PI*2;
    leaf.rotation.z = 0.35 + Math.random()*0.2;
    leaf.castShadow=true;
    leaves.add(leaf);
  }
  // coconuts
  for(let i=0;i<3;i++){
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.18*scale,8,6), new THREE.MeshStandardMaterial({color:0x6b3a1a}));
    c.position.set(Math.cos(i*2.1)*0.18, -0.18, Math.sin(i*2.1)*0.18);
    crown.add(c);
  }
  crown.userData.baseY = h;
  island.add(g);
  addCollider(x,z,0.9*scale);
  return g;
}
const palms=[];
palms.push(createPalm(-14, -3, 0.95));
palms.push(createPalm(11, -2, 1.05));
palms.push(createPalm(-9, 8, 0.9));
palms.push(createPalm(7, 9, 1.0));
palms.push(createPalm(-16, 7, 0.85));
palms.push(createPalm(15, -6, 0.9));
palms.push(createPalm(2, 10, 0.85));
palms.push(createPalm(-4, 12, 0.8));
palms.push(createPalm(12, 11, 0.8));
palms.push(createPalm(-18, 0, 0.9));

setLoader(44,'Building brigantine at the pier…');
// ---------- SHIP ----------
function createShip(){
  const g = new THREE.Group();
  g.position.set(0,0.35, 33);
  g.rotation.y = Math.PI; // bow north
  // hull using extruded shape
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.2, -5.5);
  hullShape.lineTo(-2.2, 3.5);
  hullShape.bezierCurveTo(-1.2,5.2, 1.2,5.2, 2.2,3.5);
  hullShape.lineTo(2.2,-5.5);
  hullShape.lineTo(-2.2,-5.5);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape,{depth:1.8, bevelEnabled:true, bevelThickness:0.12, bevelSize:0.08, bevelSegments:3});
  hullGeo.rotateX(Math.PI/2);
  hullGeo.translate(0,0.2,0);
  const hullMat = new THREE.MeshStandardMaterial({color:0x6b2d14, roughness:0.75});
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.castShadow=true; hull.receiveShadow=true;
  g.add(hull);
  // deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.12,8), new THREE.MeshStandardMaterial({color:0xC9A86A, roughness:0.85}));
  deck.position.set(0,1.1,0.2);
  deck.castShadow=true; deck.receiveShadow=true;
  g.add(deck);
  // cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8,1.1,2.2), new THREE.MeshStandardMaterial({color:0x7a3a18, roughness:0.8}));
  cabin.position.set(0,1.7,-2.2);
  cabin.castShadow=true; g.add(cabin);
  // masts
  function mast(z,h){
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,h,8), new THREE.MeshStandardMaterial({color:0xE8D9B0}));
    pole.position.set(0,1.1+h/2, z);
    pole.castShadow=true; g.add(pole);
    // yard + sail
    const sailGeo = new THREE.PlaneGeometry(2.4, h*0.62);
    const sailMat = new THREE.MeshStandardMaterial({color:0xfff8e6, side:THREE.DoubleSide, roughness:0.9});
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0,1.1+h*0.55, z+0.18);
    sail.castShadow=true; g.add(sail);
    // flag
    const flagGeo = new THREE.PlaneGeometry(0.9,0.6);
    const flagMat = new THREE.MeshStandardMaterial({color:0x111111, side:THREE.DoubleSide});
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.55,1.1+h-0.15, z);
    // skull
    const skull = new THREE.Mesh(new THREE.CircleGeometry(0.14,12), new THREE.MeshStandardMaterial({color:0xffffff}));
    skull.position.z=0.01; flag.add(skull);
    g.add(flag);
    // cross on flag
    const cross1 = new THREE.Mesh(new THREE.PlaneGeometry(0.4,0.07), new THREE.MeshStandardMaterial({color:0xffffff, side:THREE.DoubleSide}));
    cross1.position.z=0.02; flag.add(cross1);
    const cross2 = cross1.clone(); cross2.rotation.z=Math.PI/2; flag.add(cross2);
  }
  mast(1.8,6.2);
  mast(-0.6,7.0);
  // cannons
  for(let s of [-1,1]){
    for(let i=0;i<2;i++){
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.8,10), new THREE.MeshStandardMaterial({color:0x1a1a1a}));
      can.rotation.z=Math.PI/2; can.position.set(s*1.95,0.95, i*2-0.5);
      g.add(can);
    }
  }
  // win zone ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.8,5.1,32), new THREE.MeshStandardMaterial({color:0x13b5a0, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=-0.28; ring.position.z=-1;
  g.add(ring);
  // lantern glow
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.55,12,8), new THREE.MeshStandardMaterial({color:0x13b5a0, emissive:0x13b5a0, emissiveIntensity:1.2, transparent:true, opacity:0.85}));
  glow.position.set(0,1.3,2.8); g.add(glow);
  g.userData.ring=ring; g.userData.glow=glow;
  scene.add(g);
  return g;
}
const ship = createShip();
const shipPos = { x:0, z:33 };

setLoader(62,'Forging cursed chests…');
// ---------- CHESTS ----------
function createChest(x,z){
  const g = new THREE.Group();
  g.position.set(x,0.12,z);
  // base box
  const baseMat = new THREE.MeshStandardMaterial({color:0x8a4a12, roughness:0.7});
  const goldMat = new THREE.MeshStandardMaterial({color:0xffc94a, roughness:0.35, metalness:0.45});
  const darkWood = new THREE.MeshStandardMaterial({color:0x5a2e0a, roughness:0.8});
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.45,0.7,0.9), baseMat);
  box.position.y=0.35; box.castShadow=true; box.receiveShadow=true;
  g.add(box);
  // lid
  const lidGroup = new THREE.Group();
  lidGroup.position.set(0,0.7, -0.22);
  const lidGeo = new THREE.BoxGeometry(1.48,0.32,0.96);
  const lid = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({color:0x9c5d14, roughness:0.65}));
  lid.position.set(0,0.12,0.22);
  lid.castShadow=true;
  // barrel top
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48,1.48,16,1,false,0,Math.PI), new THREE.MeshStandardMaterial({color:0xa66a1a, roughness:0.6}));
  top.rotation.z=Math.PI/2; top.position.set(0,0.28,0.22);
  lidGroup.add(lid); lidGroup.add(top);
  // gold trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.52,0.08,1.02), goldMat);
  trim.position.set(0,0.02,0.22); lidGroup.add(trim);
  // lock
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.18,0.06), goldMat);
  lock.position.set(0,0.02,0.71); lidGroup.add(lock);
  g.add(lidGroup);
  // treasure peek when open — coins + jewels inside
  const gems = new THREE.Group();
  gems.visible=false;
  const coinGeo = new THREE.CylinderGeometry(0.16,0.16,0.06,12);
  for(let i=0;i<9;i++){
    const coin = new THREE.Mesh(coinGeo, goldMat);
    coin.rotation.x=Math.random()*0.6; coin.rotation.z=Math.random()*0.6;
    coin.position.set((Math.random()-0.5)*0.7, 0.22+Math.random()*0.32, (Math.random()-0.5)*0.42);
    coin.castShadow=true; gems.add(coin);
  }
  const jewelMats=[
    new THREE.MeshStandardMaterial({color:0x00e5c0, emissive:0x00bfa5, emissiveIntensity:0.7, roughness:0.2, metalness:0.1}),
    new THREE.MeshStandardMaterial({color:0xff3b6a, emissive:0xff1744, emissiveIntensity:0.6, roughness:0.2}),
    new THREE.MeshStandardMaterial({color:0x7c4dff, emissive:0x651fff, emissiveIntensity:0.6, roughness:0.2}),
  ];
  for(let i=0;i<4;i++){
    const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.18,0), jewelMats[i%3]);
    j.position.set((Math.random()-0.5)*0.6, 0.45+Math.random()*0.2, (Math.random()-0.5)*0.32);
    j.castShadow=true; gems.add(j);
  }
  g.add(gems);
  // glow beam
  const beamGeo = new THREE.CylinderGeometry(0.02,0.7,6,16,true);
  const beamMat = new THREE.MeshBasicMaterial({color:0xffd54a, transparent:true, opacity:0.0, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y=3.2; g.add(beam);
  // base glow ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85,1.15,20), new THREE.MeshBasicMaterial({color:0xffc94a, transparent:true, opacity:0.65, side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=0.02; g.add(ring);
  // point light
  const light = new THREE.PointLight(0xffc94a, 1.2, 7);
  light.position.set(0,0.9,0); g.add(light);

  g.userData={ lidGroup, gems, beam, ring, light, opened:false, collected:false, baseY:0.12 };
  // foundation rock under chest
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.25,0.18,12), matRockDark);
  plinth.position.y=-0.03; plinth.receiveShadow=true; g.add(plinth);
  scene.add(g);
  return g;
}
const chestPositions = [
  { x: -10, z: -9 },
  { x: 9, z: -7 },
  { x: 1, z: 8 },
];
const chests = chestPositions.map(p=> createChest(p.x,p.z));

// ---------- PIRATE ----------
function createPirate(){
  const g = new THREE.Group();
  // shadow disc
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55,16), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.28}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.02; g.add(shadow);
  // legs
  const legMat = new THREE.MeshStandardMaterial({color:0x5a3a1a, roughness:0.85});
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.16,0.5,4,8), legMat);
  leftLeg.position.set(-0.18,0.62,0); g.add(leftLeg);
  const rightLeg = leftLeg.clone(); rightLeg.position.x=0.18; g.add(rightLeg);
  // boots
  const bootMat = new THREE.MeshStandardMaterial({color:0x1a1208, roughness:0.9});
  const bootGeo = new THREE.BoxGeometry(0.26,0.18,0.38);
  const b1=new THREE.Mesh(bootGeo,bootMat); b1.position.set(-0.18,0.22,0.06); g.add(b1);
  const b2=b1.clone(); b2.position.x=0.18; g.add(b2);
  // torso coat
  const coatMat = new THREE.MeshStandardMaterial({color:0x8b1a1a, roughness:0.8});
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.42,0.78,10), coatMat);
  torso.position.y=1.12; torso.castShadow=true; g.add(torso);
  // coat tails
  const tails = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.42,0.08), coatMat);
  tails.position.set(0,0.78,-0.18); tails.castShadow=true; g.add(tails);
  // belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.12,0.54), new THREE.MeshStandardMaterial({color:0x2b1808}));
  belt.position.y=0.84; g.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.14,0.05), new THREE.MeshStandardMaterial({color:0xffd54a, metalness:0.6, roughness:0.35}));
  buckle.position.set(0,0.84,0.28); g.add(buckle);
  // arms
  const armMat = new THREE.MeshStandardMaterial({color:0xF2D0A6, roughness:0.85});
  const sleeveMat = new THREE.MeshStandardMaterial({color:0xfff6e0, roughness:0.9});
  function arm(side){
    const ag=new THREE.Group(); ag.position.set(side*0.42,1.18,0);
    const upper=new THREE.Mesh(new THREE.CapsuleGeometry(0.11,0.34,4,8), sleeveMat); upper.position.y=-0.12; ag.add(upper);
    const forearm=new THREE.Mesh(new THREE.CapsuleGeometry(0.1,0.3,4,8), armMat); forearm.position.y=-0.48; ag.add(forearm);
    const hand=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), armMat); hand.position.y=-0.68; ag.add(hand);
    return ag;
  }
  const leftArm=arm(-1), rightArm=arm(1);
  g.add(leftArm); g.add(rightArm);
  // sword on right
  const sword = new THREE.Group(); rightArm.add(sword);
  const blade=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.06,0.9), new THREE.MeshStandardMaterial({color:0xE8F0FF, metalness:0.7, roughness:0.2}));
  blade.position.set(0,-0.68,0.5); blade.rotation.x=Math.PI/2; sword.add(blade);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.06,0.18), new THREE.MeshStandardMaterial({color:0xffc94a, metalness:0.55, roughness:0.4}));
  hilt.position.set(0,-0.68,0.05); sword.add(hilt);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28,16,12), armMat);
  head.position.y=1.68; head.castShadow=true; g.add(head);
  // beard
  const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8,0,Math.PI*2,0,Math.PI/2), new THREE.MeshStandardMaterial({color:0x2b1808, roughness:1}));
  beard.rotation.x=Math.PI; beard.position.set(0,1.58,0.14); beard.scale.set(1,0.9,0.6); g.add(beard);
  // hat tricorn
  const hatGroup=new THREE.Group(); hatGroup.position.set(0,1.84,0); g.add(hatGroup);
  const hatBrimGeo=new THREE.CylinderGeometry(0.52,0.52,0.06,3);
  hatBrimGeo.rotateY(Math.PI/6);
  const hatMat=new THREE.MeshStandardMaterial({color:0x0f1b2e, roughness:0.9});
  const brim=new THREE.Mesh(hatBrimGeo,hatMat); brim.scale.set(1.15,1,1.15); brim.castShadow=true; hatGroup.add(brim);
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.30,0.26,12), hatMat); crown.position.y=0.14; hatGroup.add(crown);
  const feather=new THREE.Mesh(new THREE.PlaneGeometry(0.28,0.12), new THREE.MeshStandardMaterial({color:0xff3b30, side:THREE.DoubleSide}));
  feather.position.set(0.22,0.18,0); feather.rotation.z=0.3; feather.rotation.y=0.6; hatGroup.add(feather);
  const skullHat=new THREE.Mesh(new THREE.CircleGeometry(0.07,8), new THREE.MeshStandardMaterial({color:0xffd54a})); skullHat.position.set(0,0.12,0.27); skullHat.rotation.x=-0.5; hatGroup.add(skullHat);

  g.userData={ leftLeg, rightLeg, leftArm, rightArm, torso, head, shadow };
  scene.add(g);
  return g;
}
const pirate = createPirate();
let piratePos = new THREE.Vector3(0,0,28);
let pirateYaw = Math.PI; // facing north initially
let pirateSpeed = 0;

setLoader(88,'Hoisting Jolly Roger…');

// ---------- PARTICLES ----------
const particlePool=[];
function spawnBurst(pos, color=0xffd54a, count=18){
  for(let i=0;i<count;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.08+Math.random()*0.08,6,6), new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:0.9, transparent:true, opacity:0.95}));
    m.position.copy(pos); m.position.y+=0.3;
    const vel=new THREE.Vector3((Math.random()-0.5)*6, 3+Math.random()*4, (Math.random()-0.5)*6);
    scene.add(m);
    particlePool.push({ mesh:m, vel, life:0.9, age:0 });
  }
}
function spawnCoins(pos){
  for(let i=0;i<6;i++){
    const coin=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.04,10), new THREE.MeshStandardMaterial({color:0xffc94a, metalness:0.6, roughness:0.35}));
    coin.position.copy(pos); coin.position.y+=0.6+Math.random()*0.4;
    const vel=new THREE.Vector3((Math.random()-0.5)*3.5, 2.5+Math.random()*2.2, (Math.random()-0.5)*3.5);
    scene.add(coin);
    particlePool.push({ mesh:coin, vel, life:0.9+Math.random()*0.4, age:0, spin: new THREE.Vector3(Math.random()*6,Math.random()*6,Math.random()*6) });
  }
}

// ---------- INPUT ----------
const keys={};
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(k==='e' || k===' ' ) { e.preventDefault(); tryPickup(); }
});
addEventListener('keyup',e=> keys[e.key.toLowerCase()]=false);

// orbit controls via mouse
canvas.addEventListener('pointerdown',e=>{
  orbitDragging=true; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId);
});
addEventListener('pointerup',()=> orbitDragging=false);
addEventListener('pointermove',e=>{
  if(!orbitDragging) return;
  const dx=e.clientX-lastX, dy=e.clientY-lastY;
  camYaw -= dx*0.0045;
  camPitch = clamp(camPitch - dy*0.0045, 0.18, 1.18);
  lastX=e.clientX; lastY=e.clientY;
});
canvas.addEventListener('wheel',e=>{
  camDist = clamp(camDist + e.deltaY*0.012, 7, 24);
},{passive:true});
promptBtn.addEventListener('click', tryPickup);
mobileAction.addEventListener('click', tryPickup);
creditsBtn.addEventListener('click',()=> credits.classList.remove('hidden'));
closeCredits.addEventListener('click',()=> credits.classList.add('hidden'));
credits.addEventListener('click',e=>{ if(e.target===credits) credits.classList.add('hidden'); });

// joystick
let joyActive=false, joyVec={x:0,y:0};
joystick.addEventListener('pointerdown',e=>{ joyActive=true; joystick.setPointerCapture(e.pointerId); updateJoy(e); });
addEventListener('pointerup',()=>{ joyActive=false; joyVec={x:0,y:0}; stick.style.transform='translate(0,0)'; });
addEventListener('pointermove',e=>{ if(joyActive) updateJoy(e); });
function updateJoy(e){
  const r=joystick.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  let dx=e.clientX-cx, dy=e.clientY-cy;
  const max=36;
  const len=Math.hypot(dx,dy);
  if(len>max){ dx=dx/len*max; dy=dy/len*max; }
  stick.style.transform=`translate(${dx}px,${dy}px)`;
  joyVec.x = dx/max; joyVec.y = dy/max;
}

// ---------- GAME STATE ----------
let collected=0;
let gameTime=0;
let won=false;
let victoryAnnounced=false;

function updateUI(){
  countEl.textContent=collected;
  // slots
  [...chestsRow.children].forEach((el,i)=>{
    el.classList.toggle('found', i<collected);
    el.querySelector('.slot-icon').textContent = i<collected? '✔':'◈';
  });
  const p2={x:piratePos.x,z:piratePos.z};
  const atShip = shipZone(p2, shipPos, 5.2);
  let text='';
  if(collected<3) text=`Find chest ${collected+1} of 3 — ${3-collected} remaining`;
  else if(!atShip) text=`All 3 chests! Return to your ship at the south dock!`;
  else text=`Press E at the ship to escape!`;
  objectiveEl.textContent=text;
  objectiveEl.style.background = atShip && collected===3 ? 'rgba(19,181,160,.22)' : 'rgba(255,191,46,.16)';
  objectiveEl.style.borderColor = atShip && collected===3 ? 'rgba(19,181,160,.5)' : 'rgba(255,191,46,.4)';
  // prompt logic
  let nearest=-1, nearestDist=1e9;
  chests.forEach((c,i)=>{
    if(c.userData.collected) return;
    const d=Math.hypot(piratePos.x-c.position.x, piratePos.z-c.position.z);
    if(d<nearestDist){ nearestDist=d; nearest=i; }
  });
  const nearChest = nearest!==-1 && nearestDist<3.0;
  const nearShip = atShip;
  if(!won){
    if(nearChest && collected<3){
      promptEl.classList.remove('hidden');
      promptText.textContent=`Plunder Chest ${nearest+1}`;
      promptBtn.textContent='PLUNDER';
      mobileAction.style.display='block';
      mobileAction.textContent='◈ PLUNDER';
    } else if(collected===3 && nearShip){
      promptEl.classList.remove('hidden');
      promptText.textContent='Board your ship & escape!';
      promptBtn.textContent='ESCAPE';
      mobileAction.textContent='⚓ ESCAPE';
      mobileAction.style.display='block';
    } else {
      promptEl.classList.add('hidden');
      if(innerWidth>900) mobileAction.style.display='none';
    }
  } else {
    promptEl.classList.add('hidden');
  }
}

function tryPickup(){
  if(won) return;
  const p2={x:piratePos.x,z:piratePos.z};
  // chests
  for(let i=0;i<chests.length;i++){
    const c=chests[i];
    if(c.userData.collected) continue;
    if(canPickup(p2, {x:c.position.x, z:c.position.z}, 3.0)){
      collectChest(c,i);
      return;
    }
  }
  // ship escape
  if(collected===3 && shipZone(p2, shipPos, 5.2)){
    winGame();
  }
}

function collectChest(chest, idx){
  if(chest.userData.collected) return;
  chest.userData.collected=true;
  collected++;
  // animate open
  chest.userData.opened=true;
  chest.userData.gems.visible=true;
  // tween lid
  chest.userData.lidGroup.rotation.x = -1.25;
  chest.userData.beam.material.opacity=0.0;
  chest.userData.ring.material.opacity=0.0;
  chest.userData.light.intensity=0.15;
  spawnBurst(new THREE.Vector3(chest.position.x,0.7,chest.position.z), 0xffd54a, 22);
  spawnCoins(new THREE.Vector3(chest.position.x,0.7,chest.position.z));
  // camera punch
  camPitch = clamp(camPitch+0.06,0.18,1.18);
  // haptic
  if(navigator.vibrate) navigator.vibrate(30);
  updateUI();
  // check all collected feedback: ship beacon intensify
  if(collected===3){
    ship.userData.glow.material.emissiveIntensity=2.2;
    ship.userData.ring.material.opacity=0.95;
    // flash
    const flash=document.createElement('div');
    flash.style.cssText='position:fixed;inset:0;background:radial-gradient(600px 400px at 50% 50%, rgba(255,213,74,.35), transparent 70%);pointer-events:none;z-index:15;animation:flash .9s ease-out forwards';
    document.body.appendChild(flash);
    setTimeout(()=>flash.remove(),950);
  }
}

function winGame(){
  if(victoryAnnounced) return;
  victoryAnnounced=true; won=true;
  spawnBurst(new THREE.Vector3(ship.position.x,1.2, ship.position.z), 0x7af0d8, 32);
  spawnBurst(new THREE.Vector3(piratePos.x,1, piratePos.z), 0xffd54a, 20);
  winTime.textContent = formatTime(gameTime);
  document.getElementById('winMoves').textContent = `${collected}/3 chests`;
  winEl.classList.remove('hidden');
  // ship sail off tween handled visually by particles
}
function formatTime(s){ const m=Math.floor(s/60), sec=Math.floor(s%60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
restartBtn.addEventListener('click',()=> location.reload());
continueBtn.addEventListener('click',()=> winEl.classList.add('hidden'));

setLoader(100,'Setting course…');
setTimeout(()=> loader.classList.add('hidden'), 380);

// ---------- ANIMATION LOOP ----------
let lastT=performance.now();
let walkPhase=0;

function isBlocked(nx,nz){
  // island boundary
  if(Math.hypot(nx,nz) > 24.5) return true;
  // dock bay water gap allow corridor
  // allow south corridor narrow
  // if inside bay water but on dock planks it's ok — dock is at z~24, width 5
  const onDock = Math.abs(nx) < 5.2 && nz>21.5 && nz<26.5;
  if(onDock) return false;
  // block if inside ocean bay outside island but not dock
  if(nz>19 && Math.hypot(nx, nz-20.5)<6.2 && !onDock) return true;
  // rock colliders
  for(const col of colliders){
    if(Math.hypot(nx-col.x, nz-col.z) < col.r+0.65) return true;
  }
  return false;
}

function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now-lastT)/1000); lastT=now;
  if(!won) gameTime+=dt;

  // input vector
  let ix=0, iz=0;
  if(keys['w']||keys['arrowup']) iz-=1;
  if(keys['s']||keys['arrowdown']) iz+=1;
  if(keys['a']||keys['arrowleft']) ix-=1;
  if(keys['d']||keys['arrowright']) ix+=1;
  // joystick overrides/combines
  if(joyActive){
    ix += joyVec.x;
    iz += joyVec.y;
  }
  const mag=Math.hypot(ix,iz);
  if(mag>1){ ix/=mag; iz/=mag; }
  // camera-relative movement (yaw)
  if(mag>0.02){
    const yawCam = camYaw;
    const fwdX = Math.sin(yawCam), fwdZ = Math.cos(yawCam);
    const rightX = Math.sin(yawCam+Math.PI/2), rightZ = Math.cos(yawCam+Math.PI/2);
    const mx = ix*rightX + iz*fwdX;
    const mz = ix*rightZ + iz*fwdZ;
    const speed = 5.8*dt;
    let nx = piratePos.x + mx*speed;
    let nz = piratePos.z + mz*speed;
    // slide collision: try x then z
    if(isBlocked(nx, piratePos.z)) nx = piratePos.x;
    if(isBlocked(nx, nz)) nz = piratePos.z;
    // final island boundary clamp
    if(Math.hypot(nx,nz)>24) {
      const ang=Math.atan2(nz,nx); const len=24; nx=Math.cos(ang)*len; nz=Math.sin(ang)*len;
    }
    const moved = Math.hypot(nx-piratePos.x, nz-piratePos.z) > 0.0001;
    piratePos.x = lerp(piratePos.x, nx, 1);
    piratePos.z = lerp(piratePos.z, nz, 1);
    if(moved){
      pirateYaw = Math.atan2(mx, mz);
      pirateSpeed = lerp(pirateSpeed, 1, 0.18);
    } else pirateSpeed = lerp(pirateSpeed,0,0.18);
  } else {
    pirateSpeed = lerp(pirateSpeed,0,0.15);
  }

  // pirate rig
  pirate.position.set(piratePos.x, 0, piratePos.z);
  pirate.rotation.y = THREE.MathUtils.lerp(pirate.rotation.y, pirateYaw, 0.18);
  walkPhase += dt * (pirateSpeed>0.1? 11:0);
  const bob = Math.sin(walkPhase)*0.06*pirateSpeed;
  const sideBob = Math.sin(walkPhase*0.5)*0.035*pirateSpeed;
  pirate.position.y = bob;
  if(pirate.userData.leftLeg){
    pirate.userData.leftLeg.rotation.x = Math.sin(walkPhase)*0.65*pirateSpeed;
    pirate.userData.rightLeg.rotation.x = Math.sin(walkPhase+Math.PI)*0.65*pirateSpeed;
    pirate.userData.leftArm.rotation.x = Math.sin(walkPhase+Math.PI)*0.55*pirateSpeed;
    pirate.userData.rightArm.rotation.x = Math.sin(walkPhase)*0.55*pirateSpeed;
  }
  // scale hit when picking?
  
  // particles
  for(let i=particlePool.length-1;i>=0;i--){
    const p=particlePool[i];
    p.age+=dt; p.life-=dt;
    p.vel.y -= 9*dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.x*= (1-0.9*dt); p.vel.z*=(1-0.9*dt);
    if(p.mesh.material.opacity!==undefined) p.mesh.material.opacity = clamp(p.life,0,1);
    p.mesh.scale.setScalar(clamp(p.life,0,1));
    if(p.spin) { p.mesh.rotation.x+=p.spin.x*dt; p.mesh.rotation.y+=p.spin.y*dt; }
    if(p.life<=0){ scene.remove(p.mesh); p.mesh.geometry.dispose?.(); particlePool.splice(i,1); }
  }

  // ocean waves
  const t=now*0.00055;
  for(let i=0;i<oceanPos.count;i++){
    const ox=oceanOrig[i*3], oz=oceanOrig[i*3+1];
    // plane after rotate? original plane in xy; after rotate x is x, y is z. But we read orig as plane local
    const wave = Math.sin(ox*0.07 + t*2.8)*0.28 + Math.cos(oz*0.06 - t*2.0)*0.22 + Math.sin((ox+oz)*0.045 + t*1.6)*0.18;
    oceanPos.setZ(i, wave);
  }
  oceanPos.needsUpdate=true; oceanGeo.computeVertexNormals();

  // palm sway
  palms.forEach((p,i)=>{
    const sway = Math.sin(t*0.9 + i)*0.07 + Math.cos(t*0.6 + i*1.3)*0.04;
    const crown=p.children[1];
    if(crown) crown.rotation.z = sway;
  });

  // chest bob & beam pulse for uncollected
  chests.forEach(c=>{
    if(!c.userData.collected){
      c.position.y = c.userData.baseY + Math.sin(t*1.8 + c.position.x)*0.08;
      c.rotation.y += dt*0.25;
      c.userData.beam.material.opacity = 0.42 + Math.sin(t*2.2 + c.position.z)*0.18;
      c.userData.beam.rotation.y += dt*0.9;
      c.userData.ring.material.opacity = 0.55 + Math.sin(t*2.6)*0.15;
      c.userData.light.intensity = 1.0 + Math.sin(t*3)*0.35;
      c.userData.ring.rotation.z += dt*0.7;
    } else {
      // gems sparkle
      c.userData.gems.rotation.y += dt*0.7;
    }
  });

  // ship gentle bob
  ship.position.y = 0.35 + Math.sin(t*0.85)*0.12;
  ship.rotation.z = Math.sin(t*0.5)*0.025;
  ship.userData.ring.rotation.z += dt*0.35;
  ship.userData.glow.scale.setScalar(1+Math.sin(t*2)*0.08);

  // camera follow
  camTarget.lerp(new THREE.Vector3(piratePos.x, 1.0, piratePos.z), 0.11);
  const desired = new THREE.Vector3(
    camTarget.x + Math.sin(camYaw)*Math.cos(camPitch)*camDist,
    camTarget.y + Math.sin(camPitch)*camDist + 2.2,
    camTarget.z + Math.cos(camYaw)*Math.cos(camPitch)*camDist
  );
  camera.position.lerp(desired, 0.09);
  camera.lookAt(camTarget.x, camTarget.y+0.55, camTarget.z);
  // auto-orbit friction when idle?

  // auto-check win zone proximity passive (also requires press, but allow walking in)
  // keep UI fresh at 6hz
  if(Math.floor(now/160) %2===0) updateUI();
  drawMinimap();

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// minimap
function drawMinimap(){
  const w=140,h=140;
  mctx.clearRect(0,0,w,h);
  // water bg already via css but draw again
  const grd=mctx.createRadialGradient(w/2,h/2,18,w/2,h/2,78);
  grd.addColorStop(0,'#2fb5d8'); grd.addColorStop(0.55,'#0e6b8a'); grd.addColorStop(1,'#052030');
  mctx.fillStyle=grd; mctx.fillRect(0,0,w,h);
  // island
  mctx.fillStyle='#E8C99A'; mctx.beginPath(); mctx.ellipse(w/2,h/2,56,52,0,0,Math.PI*2); mctx.fill();
  mctx.fillStyle='#4a9a3a'; mctx.beginPath(); mctx.ellipse(w/2, h*0.48, 40,36,0,0,Math.PI*2); mctx.fill();
  mctx.fillStyle='#2f6b26'; mctx.beginPath(); mctx.ellipse(w/2+6, h*0.42, 18,14,0,0,Math.PI*2); mctx.fill();
  // chests
  chests.forEach(c=>{
    if(c.userData.collected) return;
    const mx = w/2 + c.position.x * 2.15;
    const my = h/2 + c.position.z * 2.15;
    mctx.fillStyle='#ffd54a'; mctx.strokeStyle='rgba(0,0,0,.5)'; mctx.lineWidth=1;
    mctx.beginPath(); mctx.arc(mx,my,5,0,Math.PI*2); mctx.fill(); mctx.stroke();
    mctx.fillStyle='#5a2e0a'; mctx.font='700 7px Inter'; mctx.textAlign='center'; mctx.fillText('◈', mx, my+2.5);
  });
  // ship
  {
    const sx=w/2+ shipPos.x*2.15, sy=h/2+ shipPos.z*2.15;
    mctx.fillStyle='#13b5a0'; mctx.beginPath(); mctx.arc(sx,sy,6.5,0,Math.PI*2); mctx.fill();
    mctx.fillStyle='#fff'; mctx.font='700 8px Inter'; mctx.fillText('⬢', sx, sy+2.5);
  }
  // pirate
  {
    const px=w/2+ piratePos.x*2.15, py=w/2+ piratePos.z*2.15; // w/2 for y too to keep centered transform? use h/2
    const pyy = h/2+ piratePos.z*2.15;
    mctx.fillStyle='#ff3b30'; mctx.strokeStyle='#fff'; mctx.lineWidth=1.6;
    mctx.beginPath(); mctx.arc(px,pyy,4.2,0,Math.PI*2); mctx.fill(); mctx.stroke();
    // heading
    mctx.strokeStyle='rgba(255,255,255,.9)'; mctx.lineWidth=1.2; mctx.beginPath();
    mctx.moveTo(px,pyy); mctx.lineTo(px+Math.sin(pirateYaw)*8, pyy+Math.cos(pirateYaw)*8); mctx.stroke();
  }
  // boundary
  mctx.strokeStyle='rgba(255,255,255,.18)'; mctx.lineWidth=1; mctx.strokeRect(0.5,0.5,w-1,h-1);
}

// resize
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
renderer.setSize(innerWidth, innerHeight);

// initial camera framing — attractive 3/4 view showing island, ship foreground, hill backdrop
camYaw=Math.PI -0.18; camPitch=0.62; camDist=15.5;
updateUI();

// inject flash keyframe
const style=document.createElement('style');
style.textContent='@keyframes flash{0%{opacity:1}100%{opacity:0}}';
document.head.appendChild(style);

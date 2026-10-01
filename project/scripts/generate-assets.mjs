import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Accessor, Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsEmissiveStrength, KHRMaterialsTransmission } from '@gltf-transform/extensions';

const outDir = resolve('public/models');
await mkdir(outDir, { recursive: true });

async function writePlayer() {
  const doc = new Document();
  const buffer = doc.createBuffer('player-buffer');

  // Create materials
  const hullMat = doc.createMaterial('Hull')
    .setBaseColorFactor([0.08, 0.18, 0.52, 1])
    .setMetallicFactor(0.35)
    .setRoughnessFactor(0.35)
    .setDoubleSided(false);
  const wingMat = doc.createMaterial('Wing')
    .setBaseColorFactor([0.03, 0.09, 0.32, 1])
    .setMetallicFactor(0.6)
    .setRoughnessFactor(0.28)
    .setDoubleSided(true);
  const cockpitMat = doc.createMaterial('Cockpit')
    .setBaseColorFactor([0.2, 0.85, 1, 1])
    .setEmissiveFactor([0.12, 0.55, 0.95])
    .setMetallicFactor(0.1)
    .setRoughnessFactor(0.15)
    .setDoubleSided(false);
  const engineMat = doc.createMaterial('Engine')
    .setBaseColorFactor([0.95, 0.45, 0.05, 1])
    .setEmissiveFactor([1.0, 0.35, 0.08])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.85)
    .setDoubleSided(false);
  const detailMat = doc.createMaterial('Detail')
    .setBaseColorFactor([0.85, 0.92, 1, 1])
    .setMetallicFactor(0.5)
    .setRoughnessFactor(0.4);

  // Helper to push geometry
  function addMesh(name, positionsArr, indicesArr, material, extraAttribs = {}) {
    const pos = doc.createAccessor(`${name}-pos`).setType(Accessor.Type.VEC3).setArray(new Float32Array(positionsArr)).setBuffer(buffer);
    const idx = doc.createAccessor(`${name}-idx`).setType(Accessor.Type.SCALAR).setArray(new Uint16Array(indicesArr)).setBuffer(buffer);
    const primArgs = { name };
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx).setMaterial(material);
    if (extraAttribs.normal) {
      const n = doc.createAccessor(`${name}-norm`).setType(Accessor.Type.VEC3).setArray(new Float32Array(extraAttribs.normal)).setBuffer(buffer);
      prim.setAttribute('NORMAL', n);
    }
    const mesh = doc.createMesh(name).addPrimitive(prim);
    return { mesh, prim, pos, idx };
  }

  // 1) Main hull - elongated pyramid/cone-like fuselage (hex cone + bottom)
  // Create cone hull along Z: nose at z=1.4, tail at z=-0.9
  // Cross-section hexagon at z=0.2 and tail ring
  const hullPositions = [];
  const hullIndices = [];
  // Nose tip
  hullPositions.push(0, 0.18, 1.45);
  // Mid ring 6 vertices at z=0.25 radius 0.38
  const midZ = 0.25; const midR = 0.38;
  // Tail ring 6 vertices at z=-0.9 radius 0.32
  const tailZ = -0.9; const tailR = 0.32;
  const segs = 6;
  // mid ring vertices indices 1-6
  for (let i=0;i<segs;i++) {
    const a = (i/segs)*Math.PI*2;
    hullPositions.push(Math.cos(a)*midR, Math.sin(a)*midR*0.62+0.05, midZ);
  }
  // tail ring vertices indices 7-12
  for (let i=0;i<segs;i++) {
    const a = (i/segs)*Math.PI*2;
    hullPositions.push(Math.cos(a)*tailR, Math.sin(a)*tailR*0.58+0.02, tailZ);
  }
  // Indices: nose fan to mid ring
  for (let i=0;i<segs;i++) {
    const a = 1+i;
    const b = 1+((i+1)%segs);
    hullIndices.push(0, b, a);
  }
  // Quad strip mid->tail (2 tris per segment)
  for (let i=0;i<segs;i++) {
    const m0 = 1+i;
    const m1 = 1+((i+1)%segs);
    const t0 = 7+i;
    const t1 = 7+((i+1)%segs);
    hullIndices.push(m0, t0, t1);
    hullIndices.push(m0, t1, m1);
  }
  // Tail cap fan (center tail)
  const tailCenterIdx = hullPositions.length/3;
  hullPositions.push(0, 0.02, tailZ);
  for (let i=0;i<segs;i++) {
    const a = 7+i;
    const b = 7+((i+1)%segs);
    hullIndices.push(tailCenterIdx, a, b);
  }
  const hull = addMesh('HullMesh', hullPositions, hullIndices, hullMat);

  // 2) Wings - left/right delta wings attached at mid
  function makeWing(side) {
    const s = side; // -1 left, 1 right
    const wingPos = [
      0.28*s, 0.02, 0.15,   // root front
      0.35*s, 0.02, -0.25,  // root rear
      1.15*s, 0.02, -0.42,  // tip
      0.62*s, 0.02, 0.05,   // leading kink
    ];
    // two triangles
    const wingIdx = [0,1,2, 0,2,3];
    // Add thickness by duplicating with slight Y offset? Keep flat double-sided material, so single sheet is fine.
    return addMesh(`Wing-${side>0?'R':'L'}`, wingPos, wingIdx, wingMat);
  }
  const wingL = makeWing(-1);
  const wingR = makeWing(1);

  // 3) Cockpit canopy - small bulge on top
  const canopyPos = [];
  const canopyIdx = [];
  // Simple half-ellipsoid approximated with 3x3 grid projected
  const capZ0 = 0.6, capZ1 = -0.05, capY = 0.48, capR = 0.22;
  // Create a 4-vertex top quad plus tip
  canopyPos.push(
    0, capY, 0.55,          // front tip
    -capR, 0.33, 0.35,
    capR, 0.33, 0.35,
    -capR*0.9, 0.33, -0.02,
    capR*0.9, 0.33, -0.02
  );
  canopyIdx.push(0,1,2, 1,3,2, 2,3,4, 1,2,4, 1,4,3);
  const canopy = addMesh('Canopy', canopyPos, canopyIdx, cockpitMat);

  // 4) Engine thrusters - two small cylinders at tail
  function makeEngine(sx){
    const cx = sx*0.18; const cz = -0.92; const r=0.11; const len=0.18;
    const engPos=[];
    const engIdx=[];
    // front ring 6 verts, rear ring 6 verts + center
    const zFront = cz+len*0.2; const zRear = cz - len*0.25;
    const se = 6;
    for(let i=0;i<se;i++){ const a=i/se*Math.PI*2; engPos.push(cx+Math.cos(a)*r, Math.sin(a)*r*0.9 -0.02, zFront); }
    for(let i=0;i<se;i++){ const a=i/se*Math.PI*2; engPos.push(cx+Math.cos(a)*r*0.95, Math.sin(a)*r*0.95*0.9 -0.02, zRear); }
    // side quads
    for(let i=0;i<se;i++){ const a=i; const b=(i+1)%se; const c=se+b; const d=se+a; engIdx.push(a,b,c, a,c,d); }
    // rear cap
    const cen = engPos.length/3; engPos.push(cx, -0.02, zRear);
    for(let i=0;i<se;i++){ const a=se+i; const b=se+((i+1)%se); engIdx.push(cen,b,a); }
    // front cap (attach)
    const cenF = engPos.length/3; engPos.push(cx, -0.02, zFront);
    for(let i=0;i<se;i++){ const a=i; const b=(i+1)%se; engIdx.push(cenF,a,b); }
    return addMesh(`Engine-${sx>0?'R':'L'}`, engPos, engIdx, engineMat);
  }
  const engL = makeEngine(-1);
  const engR = makeEngine(1);

  // 5) Detail stripe - small top line
  const stripePos = [ -0.04,0.24,0.85, 0.04,0.24,0.85, 0.04,0.24,-0.55, -0.04,0.24,-0.55 ];
  const stripeIdx = [0,1,2, 0,2,3];
  const stripe = addMesh('Stripe', stripePos, stripeIdx, detailMat);

  // Assemble scene
  const nodes = [];
  for (const {mesh} of [hull, wingL, wingR, canopy, engL, engR, stripe]) {
    const n = doc.createNode(mesh.getName()).setMesh(mesh);
    nodes.push(n);
  }
  const shipNode = doc.createNode('Starship').addChild(nodes[0]);
  // Add remaining as children of starship for single hierarchy transform
  for (let i=1;i<nodes.length;i++) shipNode.addChild(nodes[i]);
  const scene = doc.createScene('PlayerScene').addChild(shipNode);
  doc.getRoot().setDefaultScene(scene);

  const out = resolve(outDir, 'player.glb');
  const io = new NodeIO();
  await io.write(out, doc);
  const s = await stat(out);
  await writeFile(out+'.attribution.json', JSON.stringify({
    uid: 'custom-player-starship-v1',
    name: 'Starship - Custom Procedural',
    author: 'aiplay procedural generator (CC0)',
    license: 'CC0-1.0',
    modelUrl: null,
    thumbnailUrl: null,
    glbBytes: s.size,
    note: 'Procedurally generated low-poly starship for game'
  }, null, 2)+'\n');
  console.log(`player.glb ${s.size} bytes`);
}

async function writeCollectible() {
  const doc = new Document();
  const buffer = doc.createBuffer('collectible-buffer');

  // Materials: crystal core and outer glow
  const crystalMat = doc.createMaterial('Crystal')
    .setBaseColorFactor([0.08, 0.92, 1.0, 1])
    .setEmissiveFactor([0.05, 0.72, 0.95])
    .setMetallicFactor(0.05)
    .setRoughnessFactor(0.12)
    .setDoubleSided(false);
  // Using emissiveStrength extension if available
  crystalMat.setEmissiveStrength?.(1.8);

  const innerMat = doc.createMaterial('InnerCore')
    .setBaseColorFactor([0.98, 0.98, 1, 1])
    .setEmissiveFactor([0.9, 0.92, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.05);
  innerMat.setEmissiveStrength?.(2.2);

  // Outer octahedron (double pyramid)
  const topY = 0.68; const bottomY = -0.68; const ringR = 0.42;
  const pos = [];
  pos.push(0, topY, 0); //0 top
  pos.push(0, bottomY, 0); //1 bottom
  const ringStart = 2;
  for(let i=0;i<4;i++){ const a=i/4*Math.PI*2 + Math.PI/4; pos.push(Math.cos(a)*ringR, 0, Math.sin(a)*ringR); }
  // inner ring for bevel (smaller)
  const innerR = 0.28;
  for(let i=0;i<4;i++){ const a=i/4*Math.PI*2 + Math.PI/4; pos.push(Math.cos(a)*innerR, 0.18, Math.sin(a)*innerR); } // 6-9
  for(let i=0;i<4;i++){ const a=i/4*Math.PI*2 + Math.PI/4; pos.push(Math.cos(a)*innerR, -0.18, Math.sin(a)*innerR); } //10-13

  const idx = [];
  // Top cap fan
  for(let i=0;i<4;i++){ const a=ringStart+i; const b=ringStart+((i+1)%4); idx.push(0,b,a); }
  // Bottom cap fan
  for(let i=0;i<4;i++){ const a=ringStart+i; const b=ringStart+((i+1)%4); idx.push(1,a,b); }
  // Side quads bridging ring to inner - but simpler add inner bevel triangles
  // Bevel top ring to inner top
  for(let i=0;i<4;i++){
    const r0=ringStart+i; const r1=ringStart+((i+1)%4);
    const t0=6+i; const t1=6+((i+1)%4);
    idx.push(r0, t0, t1); idx.push(r0, t1, r1);
  }
  for(let i=0;i<4;i++){
    const r0=ringStart+i; const r1=ringStart+((i+1)%4);
    const b0=10+i; const b1=10+((i+1)%4);
    idx.push(r0, r1, b1); idx.push(r0, b1, b0);
  }

  // Inner core octahedron small
  const corePos = [
    0, 0.32, 0,
    0,-0.32, 0,
    0.18,0,0,
    0,0,0.18,
    -0.18,0,0,
    0,0,-0.18
  ];
  const coreIdx = [
    0,2,3, 0,3,4, 0,4,5, 0,5,2,
    1,3,2, 1,4,3, 1,5,4, 1,2,5
  ];

  function add(name, positions, indices, mat){
    const pAcc = doc.createAccessor(name+'-pos').setType(Accessor.Type.VEC3).setArray(new Float32Array(positions)).setBuffer(buffer);
    const iAcc = doc.createAccessor(name+'-idx').setType(Accessor.Type.SCALAR).setArray(new Uint16Array(indices)).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pAcc).setIndices(iAcc).setMaterial(mat);
    const mesh = doc.createMesh(name).addPrimitive(prim);
    return mesh;
  }
  const outerMesh = add('CrystalOuter', pos, idx, crystalMat);
  const innerMesh = add('CrystalInner', corePos, coreIdx, innerMat);

  const outerNode = doc.createNode('CrystalOuter').setMesh(outerMesh);
  const innerNode = doc.createNode('CrystalInner').setMesh(innerMesh);
  const root = doc.createNode('EnergyCrystal').addChild(outerNode).addChild(innerNode);
  // Add animation: rotation Y and bobbing
  const times = doc.createAccessor('anim-times').setType(Accessor.Type.SCALAR).setArray(new Float32Array([0,1,2,3,4])).setBuffer(buffer);
  const rotVals = doc.createAccessor('anim-rot').setType(Accessor.Type.VEC4).setArray(new Float32Array([
    0,0,0,1,
    0,0.707,0,0.707,
    0,1,0,0,
    0,0.707,0,-0.707,
    0,0,0,1
  ])).setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(rotVals).setInterpolation('LINEAR');
  const chan = doc.createAnimationChannel().setTargetNode(root).setTargetPath('rotation').setSampler(sampler);
  doc.createAnimation('Spin').addSampler(sampler).addChannel(chan);

  const transPosVals = doc.createAccessor('bob-pos').setType(Accessor.Type.VEC3).setArray(new Float32Array([
    0,0,0,
    0,0.18,0,
    0,0,0,
    0,-0.18,0,
    0,0,0
  ])).setBuffer(buffer);
  const bobSampler = doc.createAnimationSampler().setInput(times).setOutput(transPosVals);
  const bobChan = doc.createAnimationChannel().setTargetNode(innerNode).setTargetPath('translation').setSampler(bobSampler);
  doc.createAnimation('Bob').addSampler(bobSampler).addChannel(bobChan);

  const scene = doc.createScene('CollectibleScene').addChild(root);
  doc.getRoot().setDefaultScene(scene);

  const out = resolve(outDir, 'collectible.glb');
  const io = new NodeIO();
  await io.write(out, doc);
  const s = await stat(out);
  await writeFile(out+'.attribution.json', JSON.stringify({
    uid: 'custom-collectible-crystal-v1',
    name: 'Energy Crystal - Custom Procedural',
    author: 'aiplay procedural generator (CC0)',
    license: 'CC0-1.0',
    modelUrl: null,
    thumbnailUrl: null,
    glbBytes: s.size,
    note: 'Procedurally generated crystal with spin animation'
  }, null, 2)+'\n');
  console.log(`collectible.glb ${s.size} bytes`);
}

await writePlayer();
await writeCollectible();

// Also create a simple rock asteroid glb as bonus third asset for environment - not required but nice
async function writeAsteroid(){
  const doc = new Document();
  const buffer = doc.createBuffer('asteroid-buffer');
  const rockMat = doc.createMaterial('Rock')
    .setBaseColorFactor([0.55,0.45,0.38,1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.92)
    .setDoubleSided(true);
  // Icosahedron-like rough rock with jitter
  let verts = [];
  // Use icosahedron base
  const t = (1+Math.sqrt(5))/2;
  const base = [
    [-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],
    [0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],
    [t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]
  ];
  // normalize and scale 0.5 + jitter
  const rnd = (seed)=>{ let x=Math.sin(seed*9301+49297)*49297; return x-Math.floor(x); };
  let idx = 0;
  for(let v of base){
    const len=Math.hypot(...v);
    const nx=v[0]/len, ny=v[1]/len, nz=v[2]/len;
    const jx=1+ (rnd(idx++)-0.5)*0.28;
    const jy=1+ (rnd(idx++)-0.5)*0.28;
    const jz=1+ (rnd(idx++)-0.5)*0.28;
    verts.push(nx*0.5*jx, ny*0.5*jy, nz*0.5*jz);
  }
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]
  ];
  const positions = verts;
  const indices = faces.flat();
  // Add small crater detail via extra verts? keep simple
  const pAcc = doc.createAccessor('asteroid-pos').setType(Accessor.Type.VEC3).setArray(new Float32Array(positions.flat())).setBuffer(buffer);
  const iAcc = doc.createAccessor('asteroid-idx').setType(Accessor.Type.SCALAR).setArray(new Uint16Array(indices)).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', pAcc).setIndices(iAcc).setMaterial(rockMat);
  const mesh = doc.createMesh('Asteroid').addPrimitive(prim);
  const node = doc.createNode('Asteroid').setMesh(mesh);
  const scene = doc.createScene('AsteroidScene').addChild(node);
  doc.getRoot().setDefaultScene(scene);
  const out = resolve(outDir, 'asteroid.glb');
  const io = new NodeIO();
  await io.write(out, doc);
  const s= await stat(out);
  await writeFile(out+'.attribution.json', JSON.stringify({uid:'custom-asteroid-v1', name:'Asteroid - Procedural', author:'aiplay procedural (CC0)', license:'CC0-1.0', glbBytes:s.size}, null,2)+'\n');
  console.log(`asteroid.glb ${s.size} bytes`);
}
await writeAsteroid();

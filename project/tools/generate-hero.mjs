#!/usr/bin/env node
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Document, Accessor, AnimationChannel } from '@gltf-transform/core';

const out = resolve('public/models/hero.glb');
await mkdir(resolve('public/models'), { recursive: true });

function createBoxPositions(size) {
  const [sx, sy, sz] = size;
  // 8 corners
  const pos = new Float32Array([
    -sx, -sy, -sz,
     sx, -sy, -sz,
     sx,  sy, -sz,
    -sx,  sy, -sz,
    -sx, -sy,  sz,
     sx, -sy,  sz,
     sx,  sy,  sz,
    -sx,  sy,  sz,
  ]);
  // normals not needed strictly, but provide for PBR
  const nrm = new Float32Array([
    -0.577,-0.577,-0.577,
     0.577,-0.577,-0.577,
     0.577, 0.577,-0.577,
    -0.577, 0.577,-0.577,
    -0.577,-0.577, 0.577,
     0.577,-0.577, 0.577,
     0.577, 0.577, 0.577,
    -0.577, 0.577, 0.577,
  ]);
  const indices = new Uint16Array([
    0,1,2, 0,2,3, // back
    4,6,5, 4,7,6, // front
    0,4,5, 0,5,1, // bottom
    3,2,6, 3,6,7, // top
    0,3,7, 0,7,4, // left
    1,5,6, 1,6,2  // right
  ]);
  return { pos, nrm, indices };
}

function addBox(doc, buffer, name, size, material, translation) {
  const { pos, nrm, indices } = createBoxPositions(size);
  const posAcc = doc.createAccessor(`${name}-positions`).setType(Accessor.Type.VEC3).setArray(pos).setBuffer(buffer);
  const nrmAcc = doc.createAccessor(`${name}-normals`).setType(Accessor.Type.VEC3).setArray(nrm).setBuffer(buffer);
  const idxAcc = doc.createAccessor(`${name}-indices`).setType(Accessor.Type.SCALAR).setArray(indices).setBuffer(buffer);
  const prim = doc.createPrimitive(name).setAttribute('POSITION', posAcc).setAttribute('NORMAL', nrmAcc).setIndices(idxAcc).setMaterial(material);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh).setTranslation(translation);
  return node;
}

async function main(){
  const doc = new Document();
  const buffer = doc.createBuffer('hero-buffer');
  // Materials - vivid low-poly PBR
  const matBody = doc.createMaterial('Body').setBaseColorFactor([0.95,0.35,0.18,1]).setMetallicFactor(0.0).setRoughnessFactor(0.85).setDoubleSided(false);
  const matHead = doc.createMaterial('Head').setBaseColorFactor([0.2,0.85,0.95,1]).setMetallicFactor(0.1).setRoughnessFactor(0.4);
  const matLimbs = doc.createMaterial('Limbs').setBaseColorFactor([0.95,0.88,0.25,1]).setMetallicFactor(0.0).setRoughnessFactor(0.75);
  const matEye = doc.createMaterial('Eye').setBaseColorFactor([0.05,0.05,0.08,1]).setMetallicFactor(0.0).setRoughnessFactor(0.9).setEmissiveFactor([0.0,0.2,0.6]);
  // Create body parts
  // Sizes are half extents
  const heroRoot = doc.createNode('HeroRoot');

  const body = addBox(doc, buffer, 'Torso', [0.35,0.45,0.22], matBody, [0,0.85,0]);
  const head = addBox(doc, buffer, 'Head', [0.28,0.28,0.28], matHead, [0,1.55,0]);
  // Eyes as small boxes on head
  const eyeL = addBox(doc, buffer, 'EyeL', [0.08,0.06,0.05], matEye, [-0.12,1.55,0.24]);
  const eyeR = addBox(doc, buffer, 'EyeR', [0.08,0.06,0.05], matEye, [0.12,1.55,0.24]);
  const armL = addBox(doc, buffer, 'ArmL', [0.12,0.38,0.12], matLimbs, [-0.52,0.8,0]);
  const armR = addBox(doc, buffer, 'ArmR', [0.12,0.38,0.12], matLimbs, [0.52,0.8,0]);
  const legL = addBox(doc, buffer, 'LegL', [0.14,0.42,0.14], matLimbs, [-0.18,0.02,0]);
  const legR = addBox(doc, buffer, 'LegR', [0.14,0.42,0.14], matLimbs, [0.18,0.02,0]);

  // Antenna on head
  const antenna = addBox(doc, buffer, 'Antenna', [0.04,0.18,0.04], matBody, [0,1.95,0]);

  // Group all under heroRoot
  for (const n of [body, head, eyeL, eyeR, armL, armR, legL, legR, antenna]) heroRoot.addChild(n);

  doc.createScene('HeroScene').addChild(heroRoot);

  // Add simple bob animation (translation Y of root)
  const times = doc.createAccessor('bob-times').setType(Accessor.Type.SCALAR).setArray(new Float32Array([0,0.5,1.0])).setBuffer(buffer);
  const values = doc.createAccessor('bob-values').setType(Accessor.Type.VEC3).setArray(new Float32Array([
    0,0,0,
    0,0.15,0,
    0,0,0
  ])).setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(times).setOutput(values).setInterpolation('CUBICSPLINE');
  // Cubicspline needs 3x values; simplify to LINEAR
  // Fix: recreate linear
  const linTimes = doc.createAccessor('bob-times-lin').setType(Accessor.Type.SCALAR).setArray(new Float32Array([0,0.5,1.0])).setBuffer(buffer);
  const linValues = doc.createAccessor('bob-values-lin').setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0, 0,0.15,0, 0,0,0])).setBuffer(buffer);
  const linSampler = doc.createAnimationSampler().setInput(linTimes).setOutput(linValues);
  const channel = doc.createAnimationChannel().setTargetNode(heroRoot).setTargetPath(AnimationChannel.TargetPath.TRANSLATION).setSampler(linSampler);
  doc.createAnimation('Idle Bob').addSampler(linSampler).addChannel(channel);

  const { NodeIO } = await import('@gltf-transform/core');
  const io = new NodeIO();
  await io.write(out, doc);
  const st = await stat(out);
  await writeFile(out + '.attribution.json', JSON.stringify({
    uid: 'synthetic-hero-lowpoly',
    name: 'Low-Poly Gallery Hero (synthetic)',
    author: 'GLB Gallery Dash generator',
    license: 'CC0-1.0',
    modelUrl: null,
    thumbnailUrl: null,
    glbBytes: st.size,
    meshes: 9,
    materials: 4
  }, null, 2) + '\n');
  console.log('Wrote', out, st.size, 'bytes');
}
main().catch(e=>{ console.error(e); process.exit(1); });

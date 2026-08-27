import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let ok=true;
function assert(cond, msg){ if(!cond){ console.error('FAIL: '+msg); ok=false; } else console.log('PASS: '+msg); }

const idx = readFileSync('index.html','utf-8');
assert(idx.toLowerCase().includes('three'), 'index.html references Three.js');
assert(idx.includes('canvas'), 'index has canvas');
assert(idx.includes('GLB') || idx.includes('models/rifle'), 'attribution mentions GLB');
assert(existsSync('public/models/rifle.glb'), 'rifle.glb exists');
assert(existsSync('public/models/rifle.glb.attribution.json'), 'rifle attribution exists');
assert(existsSync('public/models/drone.glb'), 'drone.glb exists');
assert(existsSync('public/models/drone.glb.attribution.json'), 'drone attribution exists');
const rAttr = JSON.parse(readFileSync('public/models/rifle.glb.attribution.json','utf-8'));
assert(rAttr.license.includes('CC') || rAttr.license.includes('Attribution') || rAttr.license.includes('Standard'), 'rifle license present');
assert(rAttr.author, 'rifle author present');
const src = readFileSync('src/main.js','utf-8');
assert(src.includes('GLTFLoader'), 'uses GLTFLoader');
assert(src.includes('PointerLock') || src.includes('requestPointerLock'), 'uses pointer lock');
assert(src.includes('ACESToneMapping') || src.includes('ACESFilmic'), 'uses ACES tone mapping');
assert(src.includes('castShadow'), 'uses shadows');
assert(src.includes('Raycaster'), 'uses raycaster for shooting');
if(!ok){ process.exit(1); }
console.log('All tests passed');

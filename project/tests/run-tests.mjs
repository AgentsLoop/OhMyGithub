import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
function assert(cond, msg){ if(!cond) throw new Error(msg); }
const files = [
  'index.html',
  'src/main.js',
  'public/models/sci-fi-crate-normalized.glb',
  'public/models/sci-fi-drone.glb',
  'dist/index.html'
];
for(const f of files){ assert(fs.existsSync(path.join(projectRoot,f)), `missing ${f}`); }
const crate = fs.statSync(path.join(projectRoot,'public/models/sci-fi-crate-normalized.glb'));
assert(crate.size===183216, 'crate size mismatch');
const html = fs.readFileSync(path.join(projectRoot,'index.html'),'utf8');
assert(html.includes('NEXUS ARENA'), 'title missing');
const main = fs.readFileSync(path.join(projectRoot,'src/main.js'),'utf8');
assert(main.includes('UnrealBloomPass'), 'bloom missing');
assert(main.includes('hitmarker'), 'hitmarker missing');
assert(main.includes('/models/sci-fi-crate-normalized.glb'), 'crate load missing');
console.log('All tests passed: '+files.length+' checks');

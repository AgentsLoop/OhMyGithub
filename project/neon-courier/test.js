import assert from 'assert';
import fs from 'fs';
const html = fs.readFileSync('index.html','utf8');
const css = fs.readFileSync('style.css','utf8');
const js = fs.readFileSync('main.js','utf8');

// FPS structure checks — BO6 fidelity bar
assert(html.includes('hud-score') || html.includes('id="hud-score"'), 'score HUD missing');
assert(html.includes('hud-timer') || html.includes('id="hud-timer"'), 'timer missing');
assert(html.includes('hud-health') || html.includes('id="hud-health"'), 'health HUD missing');
assert(html.includes('hud-ammo'), 'ammo HUD missing');
assert(html.includes('id="crosshair"'), 'crosshair missing');
assert(html.includes('id="minimap"'), 'minimap missing');
assert(html.includes('id="overlay-start"'), 'start overlay missing');
assert(html.includes('PointerLock') || html.includes('DEPLOY') || html.includes('CLICK TO LOCK'), 'pointer-lock prompt missing');
assert(css.includes('@media'), 'responsive missing');
assert(js.includes('GAME_TIME'), 'timer logic missing');
assert(js.includes('KILL_TARGET'), 'kill target missing');
assert(js.includes('PointerLockControls'), 'pointer-lock controls missing');
assert(js.includes('raycaster') || js.includes('Raycaster'), 'raycast hit detection missing');
assert(js.includes('GLTFLoader') || js.includes('weapon.glb'), 'GLB weapon loader missing');
assert(js.includes('muzzle') || js.includes('Muzzle'), 'muzzle flash missing');
assert(js.includes('hitmarker'), 'hit marker missing');
assert(js.includes('reload'), 'reload logic missing');
assert(js.includes('THREE.') || js.includes('three'), 'Three.js missing');

console.log('All static checks passed — FPS BO6 bar');

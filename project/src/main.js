import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import './style.css';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b12);
scene.fog = new THREE.FogExp2(0x080b12, 0.032);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 1.7, 11);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
document.querySelector('#game').prepend(renderer.domElement);

const clock = new THREE.Clock(); const raycaster = new THREE.Raycaster(); const keys = new Set(); const enemies = []; const sparks = [];
let yaw = 0, pitch = 0, playing = false, firing = false, reloading = false, reloadTimer = 0, shotCooldown = 0, wave = 1, score = 0, health = 100, ammo = 12, waveDelay = 0;
const $ = (id) => document.getElementById(id);
const enemyLayer = new THREE.Group(); scene.add(enemyLayer);

function mat(color, emissive = 0x000000, intensity = 0) { return new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .35, emissive, emissiveIntensity: intensity }); }
function box(w, h, d, material, pos) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
function addPanel(w, h, d, material, pos, rotation = 0) { const panel = box(w, h, d, material, pos); panel.rotation.y = rotation; scene.add(panel); return panel; }
function addCover(x, z, rotation = 0, height = 1.45) {
  const cover = new THREE.Group(); cover.position.set(x, 0, z); cover.rotation.y = rotation;
  cover.add(box(2.8, height, .78, mat(0x26343a), [0, height / 2, 0]));
  cover.add(box(2.35, .08, .84, mat(0x52636a), [0, height - .16, 0]));
  cover.add(box(.08, height - .22, .86, mat(0xd38b3d), [-1.12, (height - .22) / 2, 0]));
  cover.add(box(.08, height - .22, .86, mat(0x3c4f55), [1.12, (height - .22) / 2, 0]));
  cover.add(box(2.35, .055, .035, mat(0x5ed8cc, 0x2bd5ca, 2.5), [0, .3, -.44]));
  scene.add(cover);
}
function buildArena() {
  scene.add(new THREE.HemisphereLight(0x9ab8c4, 0x10151b, 1.65));
  const sun = new THREE.DirectionalLight(0xb9d3d0, 2.1); sun.position.set(-8, 13, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(38, 58), new THREE.MeshStandardMaterial({ color: 0x1a2429, roughness: .82, metalness: .38 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.03, -7); floor.receiveShadow = true; scene.add(floor);
  const floorInset = mat(0x11191e); addPanel(31, .08, 56, floorInset, [0, .01, -7]);
  const seam = mat(0x405158); for (let z = 8; z >= -34; z -= 4) { addPanel(30, .025, .045, seam, [0, .08, z]); }
  const laneLight = mat(0x1b4d50, 0x35cfc3, 1.8); [-8, 8].forEach((x) => { addPanel(.06, .035, 52, laneLight, [x, .1, -10]); });
  const wallMat = mat(0x1d2a31); const trim = mat(0x34474e);
  [[-16, 3.2, -10, .7, 6.4, 52], [16, 3.2, -10, .7, 6.4, 52], [0, 5.8, -35, 32, 4.5, .7]].forEach(([x,y,z,w,h,d]) => scene.add(box(w,h,d,wallMat,[x,y,z])));
  [-13.5, 13.5].forEach((x) => { addPanel(.12, 5.2, 52, trim, [x, 2.7, -10]); for (let z = 8; z > -35; z -= 7) addPanel(2.4, .12, .12, trim, [x, 4.6, z]); });
  for (let z = 5; z >= -30; z -= 8) { addPanel(30, .28, .28, trim, [0, 5.3, z]); }
  const cyan = new THREE.PointLight(0x31d8d0, 22, 18); cyan.position.set(-9, 3.5, -2); scene.add(cyan);
  const amber = new THREE.PointLight(0xe69e3b, 18, 17); amber.position.set(9, 3.1, -13); scene.add(amber);
  [[-9, 3.6, 1.5, 0x31d8d0], [9, 3.6, -8, 0xe69e3b], [-8, 3.6, -22, 0x31d8d0], [8, 3.6, -29, 0xe69e3b]].forEach(([x,y,z,color]) => { const light = new THREE.PointLight(color, 15, 10); light.position.set(x,y,z); scene.add(light); addPanel(2.8, .06, .12, mat(color, color, 5), [x, 5.05, z]); });
  addCover(-7, 1.5, -.08, 1.55); addCover(7, -5, .12, 1.3); addCover(-7, -13, .06, 1.65); addCover(7, -20, -.1, 1.4); addCover(-5.5, -27, .1, 1.7);
  [[-12, 1.2, -3], [12, 1.2, -11], [-11, 1.2, -25], [11, 1.2, -30]].forEach(([x,y,z]) => { const drum = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, 1.8, 12), mat(0x34434a)); drum.position.set(x,y,z); drum.castShadow = true; scene.add(drum); addPanel(.76, .04, .04, mat(0xe0a346, 0xe0a346, 2), [x, 1.65, z]); });
  const loader = new GLTFLoader(); loader.load('/models/sci-fi-crate-normalized.glb', (gltf) => { const root = gltf.scene; root.scale.setScalar(.018); root.position.set(-7, .02, -5); root.rotation.y = -.35; root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(root); const second = root.clone(true); second.position.set(7, .02, -12); second.rotation.y = 2.1; scene.add(second); }, undefined, () => showToast('PROP SIGNAL LOST'));
}

function spawnEnemy() {
  const group = new THREE.Group(); const armor = mat(0x3c4b50); const darkArmor = mat(0x18252a); const visor = mat(0xff3f35, 0xff2f25, 6);
  group.add(box(.72, 1.05, .38, armor, [0, .95, 0])); group.add(box(.48, .48, .42, darkArmor, [0, 1.72, 0]));
  group.add(box(.56, .13, .045, visor, [0, 1.77, .235])); group.add(box(.18, .72, .2, darkArmor, [-.55, 1.02, 0])); group.add(box(.18, .72, .2, darkArmor, [.55, 1.02, 0]));
  group.add(box(.27, .82, .25, darkArmor, [-.22, .2, 0])); group.add(box(.27, .82, .25, darkArmor, [.22, .2, 0]));
  const badge = new THREE.Mesh(new THREE.BoxGeometry(.24, .24, .03), mat(0xe0a346, 0xe0a346, 2.5)); badge.position.set(0, 1.15, .21); group.add(badge);
  const lanes = [[-5.2, -10], [0, -17], [5.2, -12], [-3.5, -25], [4, -28], [0, -31]]; const lane = lanes[enemies.length % lanes.length]; group.position.set(lane[0], 0, lane[1]); group.userData = { hp: 2, phase: Math.random() * 6, speed: .35 + Math.random() * .3 }; enemyLayer.add(group); enemies.push(group);
}
function startWave() { for (let i = 0; i < wave + 3; i++) spawnEnemy(); updateHud(); }
function removeEnemy(enemy) { enemyLayer.remove(enemy); const index = enemies.indexOf(enemy); if (index >= 0) enemies.splice(index, 1); }
function shoot() { if (!playing || reloading || shotCooldown > 0) return; if (ammo <= 0) { showToast('R TO RELOAD'); return; } ammo--; shotCooldown = .18; $('crosshair').classList.add('fire'); setTimeout(() => $('crosshair').classList.remove('fire'), 90); raycaster.setFromCamera(new THREE.Vector2(0, 0), camera); const targets = enemies.flatMap((e) => e.children); const hit = raycaster.intersectObjects(targets, false)[0]; if (hit) { const enemy = hit.object.parent; enemy.userData.hp--; showHit(); spark(hit.point); if (enemy.userData.hp <= 0) { score += 100 * wave; removeEnemy(enemy); if (!enemies.length) { waveDelay = 2.4; showToast(`SECTOR ${String(wave).padStart(2, '0')} CLEAR`); } } } updateHud(); }
function reload() { if (!playing || reloading || ammo === 12) return; reloading = true; reloadTimer = 1.25; $('status').textContent = 'MAG CHANGE'; showToast('RELOADING'); }
function showHit() { const marker = $('hit-marker'); marker.classList.remove('show'); void marker.offsetWidth; marker.classList.add('show'); }
function showToast(text) { const toast = $('toast'); toast.textContent = text; toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show'); }
function spark(point) { for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.035, 5, 5), mat(0xffb44c, 0xff632e, 5)); s.position.copy(point); s.userData.life = .35; s.userData.velocity = new THREE.Vector3((Math.random()-.5)*2, Math.random()*2, (Math.random()-.5)*2); scene.add(s); sparks.push(s); } }
function updateHud() { $('wave').textContent = String(wave).padStart(2, '0'); $('hostiles').textContent = String(enemies.length).padStart(2, '0'); $('score').textContent = String(score).padStart(6, '0'); $('ammo').textContent = String(ammo).padStart(2, '0'); $('ammo').nextElementSibling; document.querySelector('.ammo-bar i').style.width = `${ammo / 12 * 100}%`; $('health').textContent = health; document.querySelector('.health-bar i').style.width = `${health}%`; document.querySelector('.health-bar i').style.background = health < 35 ? '#f05d50' : '#65ddd0'; }
function damage() { health = Math.max(0, health - 12); updateHud(); if (!health) { playing = false; document.exitPointerLock(); $('status').textContent = 'SIGNAL LOST'; document.querySelector('#start-screen').classList.remove('hidden'); document.querySelector('#start-screen h1').innerHTML = 'RUN<span> ENDED</span>'; document.querySelector('#start-screen .lede').innerHTML = `Final score: ${String(score).padStart(6, '0')}<br />The range is still waiting.`; $('start-button').textContent = 'RESTART RANGE'; } }
function animate() { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .05); if (playing) { shotCooldown = Math.max(0, shotCooldown - dt); if (reloading && (reloadTimer -= dt) <= 0) { ammo = 12; reloading = false; reloadTimer = 0; $('status').textContent = 'LIVE FEED'; updateHud(); } if (firing) shoot(); const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 7 : 4.2; const move = new THREE.Vector3((keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), 0, (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0)); if (move.lengthSq()) { move.normalize().multiplyScalar(speed * dt); move.applyAxisAngle(new THREE.Vector3(0,1,0), yaw); camera.position.add(move); camera.position.x = THREE.MathUtils.clamp(camera.position.x, -17, 17); camera.position.z = THREE.MathUtils.clamp(camera.position.z, -17, 17); } camera.position.y = 1.7; camera.rotation.set(pitch, yaw, 0, 'YXZ'); enemies.forEach((enemy) => { enemy.lookAt(camera.position.x, enemy.position.y, camera.position.z); enemy.position.y += Math.sin(clock.elapsedTime * 2 + enemy.userData.phase) * dt * .15; if (enemy.position.distanceTo(camera.position) < 1.35) damage(); }); sparks.forEach((s, i) => { s.userData.life -= dt; s.position.addScaledVector(s.userData.velocity, dt); s.userData.velocity.y -= 5 * dt; if (s.userData.life <= 0) { scene.remove(s); sparks.splice(i, 1); } }); if (waveDelay > 0 && (waveDelay -= dt) <= 0) { wave++; startWave(); } updateHud(); } renderer.render(scene, camera); }

buildArena(); animate();
document.addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'KeyR') reload(); }); document.addEventListener('keyup', (e) => keys.delete(e.code)); document.addEventListener('mousedown', () => { if (playing) { firing = true; shoot(); } }); document.addEventListener('mouseup', () => firing = false);
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement !== renderer.domElement) return; yaw -= e.movementX * .002; pitch -= e.movementY * .002; pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35); });
renderer.domElement.addEventListener('click', () => { if (playing) renderer.domElement.requestPointerLock(); }); document.addEventListener('pointerlockchange', () => { if (playing && document.pointerLockElement !== renderer.domElement) { $('status').textContent = 'PAUSED / CLICK TO RESUME'; } else if (playing) $('status').textContent = 'LIVE FEED'; });
$('start-button').addEventListener('click', () => { playing = true; firing = false; reloading = false; reloadTimer = 0; waveDelay = 0; wave = 1; score = 0; health = 100; ammo = 12; enemies.splice(0).forEach(removeEnemy); document.querySelector('#start-screen').classList.add('hidden'); $('hud').classList.remove('hidden'); document.querySelector('#start-screen h1').innerHTML = 'NIGHT<span>SHIFT</span>'; $('status').textContent = 'LIVE FEED'; renderer.domElement.requestPointerLock(); startWave(); updateHud(); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

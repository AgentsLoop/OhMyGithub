import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// =============================================================
// Tactical Range — AAA FPS Skeleton (MWIII / BO6 bar)
// - Three.js 0.160, PointerLock, raycast shooting, viewmodel
// =============================================================

const CONFIG = {
  duration: 120, // seconds
  magSize: 30,
  reserve: 90,
  damage: 34, // 3 hits to kill 100HP dummy
  headshotMult: 2.2,
  fireRate: 110, // ms
  reloadTime: 1650,
  sprintMult: 1.6,
  walkSpeed: 4.2,
  jumpForce: 5.2,
  gravity: 14.5,
};

// DOM
const blocker = document.getElementById('blocker');
const playBtn = document.getElementById('playBtn');
const scoreVal = document.getElementById('scoreVal');
const timeVal = document.getElementById('timeVal');
const targetsVal = document.getElementById('targetsVal');
const ammoEl = document.getElementById('ammo');
const healthFill = document.getElementById('healthFill');
const healthVal = document.getElementById('healthVal');
const hitmarker = document.getElementById('hitmarker');
const timerBar = document.getElementById('timerBar');
const killfeed = document.getElementById('killfeed');
const damageVig = document.getElementById('damageVignette');
const hintTxt = document.getElementById('hintTxt');

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ea0b8);
scene.fog = new THREE.Fog(0x9fb0c6, 42, 115);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 300);
camera.position.set(0, 1.68, 8);

// Controls
const controls = new PointerLockControls(camera, document.body);
let sens = 1.0;
document.getElementById('sensUp').onclick = () => { sens = Math.min(2.2, sens + 0.15); hintTxt.textContent = `Sensitivity: ${sens.toFixed(2)}x`; };
document.getElementById('sensDown').onclick = () => { sens = Math.max(0.35, sens - 0.15); hintTxt.textContent = `Sensitivity: ${sens.toFixed(2)}x`; };

playBtn.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => { blocker.style.display = 'flex'; });

// Wrap PointerLockControls mouseMove to apply sensitivity
const origOnMouseMove = controls.onMouseMove.bind(controls);
controls.onMouseMove = (e) => {
  if (!controls.isLocked) return;
  // scale movement
  const ev = { movementX: e.movementX * sens, movementY: e.movementY * sens };
  origOnMouseMove(ev);
};

// Lighting — COD-like high contrast
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x2a3320, 1.15));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.position.set(22, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 90;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8fb7ff, 0.55);
fill.position.set(-12, 14, -10);
scene.add(fill);

// Ground
const groundMat = new THREE.MeshStandardMaterial({ color: 0x7a8a7a, roughness: 0.92, metalness: 0.02 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid decal helper
const grid = new THREE.GridHelper(72, 36, 0x6b7a6b, 0x8a9a8a);
grid.position.y = 0.02;
scene.add(grid);

// Level builders
function box(w, h, d, x, y, z, color = 0x9aa0a8, roughness = 0.82) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.06 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push({ type: 'box', mesh, min: new THREE.Vector3(x - w / 2, 0, z - d / 2), max: new THREE.Vector3(x + w / 2, h, z + d / 2) });
  return mesh;
}
function crate(x, z, s = 1) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b6a3a, roughness: 0.88 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.45, metalness: 0.5 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 1.0 * s, 1.2 * s), wood);
  b.castShadow = true; b.receiveShadow = true; g.add(b);
  for (let y of [-0.32 * s, 0.32 * s]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.24 * s, 0.06 * s, 1.24 * s), metal);
    band.position.y = y; g.add(band);
  }
  g.position.set(x, 0.5 * s, z);
  scene.add(g);
  colliders.push({ type: 'box', mesh: b, min: new THREE.Vector3(x - 0.6 * s, 0, z - 0.6 * s), max: new THREE.Vector3(x + 0.6 * s, 1.0 * s, z + 0.6 * s) });
}

const colliders = [];

// Perimeter walls — CQB facility
const wallMatColor = 0xc2c9d1;
box(72, 5, 0.6, 0, 2.5, -36, wallMatColor);
box(72, 5, 0.6, 0, 2.5, 36, wallMatColor);
box(0.6, 5, 72, -36, 2.5, 0, wallMatColor);
box(0.6, 5, 72, 36, 2.5, 0, wallMatColor);
// Inner walls / cover
box(10, 2.2, 0.45, -10, 1.1, -10, 0xb8bec6);
box(10, 2.2, 0.45, 12, 1.1, -14, 0xb8bec6);
box(0.45, 2.2, 12, 0, 1.1, 0, 0xaeb6bf);
box(8, 2.2, 0.45, -14, 1.1, 8, 0xb8bec6);
box(6, 2.2, 0.45, 14, 1.1, 10, 0xb8bec6);
box(0.45, 2.2, 6, -18, 1.1, -20, 0xaeb6bf);
box(12, 0.2, 12, 0, 3.2, -8, 0x6a7480); // overhead catwalk shadow caster
// Crates
for (let i = 0; i < 10; i++) {
  const x = (Math.random() - 0.5) * 44, z = (Math.random() - 0.5) * 44;
  if (Math.hypot(x, z) < 6) continue;
  crate(x, z, 0.9 + Math.random() * 0.5);
}
crate(-5, -2, 1.2); crate(-6.2, -2, 1.1); crate(7, 4, 1.0);

// Lights with shadows visuals: overhead lamps
for (let p of [[-12, 8, -12], [12, 8, 12], [0, 9, 0]]) {
  const lamp = new THREE.PointLight(0xfff0cc, 22, 30, 1.7);
  lamp.position.set(p[0], 8, p[2]);
  lamp.castShadow = false;
  scene.add(lamp);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0xfff4cc, emissive: 0xfff0aa, emissiveIntensity: 2 }));
  bulb.position.copy(lamp.position); scene.add(bulb);
}

// ===================== Targets / Enemies =====================
const targets = [];
const targetGroup = new THREE.Group();
scene.add(targetGroup);

function makeDummy(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9c7a5, roughness: 0.78 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 6, 14), bodyMat);
  body.position.y = 1.05; body.castShadow = true; body.receiveShadow = true; body.name = 'body';
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.7 }));
  head.position.y = 1.82; head.castShadow = true; head.name = 'head';
  g.add(head);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: .7, roughness: .35 }));
  stand.position.y = 0.5; stand.scale.z = 0.3; g.add(stand);
  // hit rings texture via canvas
  const ring = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), new THREE.MeshBasicMaterial({ color: 0xcc2222, side: THREE.DoubleSide }));
  ring.position.set(0, 1.05, 0.39); g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  ring2.position.set(0, 1.05, 0.40); g.add(ring2);
  const ring3 = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshBasicMaterial({ color: 0xcc2222, side: THREE.DoubleSide }));
  ring3.position.set(0, 1.05, 0.41); g.add(ring3);

  g.userData = { hp: 102, maxHp: 102, alive: true, hitFlash: 0, sway: Math.random() * Math.PI * 2, baseX: x, baseZ: z, isHead: false };
  // Attach userData to meshes for raycast identification
  body.userData = { dummy: g, part: 'body' };
  head.userData = { dummy: g, part: 'head' };
  targetGroup.add(g);
  targets.push(g);
  return g;
}

// Place dummies in lanes
const dummyPositions = [
  [0, -18, 0], [6, -20, 0.2], [-7, -18, -0.3], [14, -8, Math.PI / 2], [-16, -6, -Math.PI / 2],
  [10, 6, Math.PI], [-12, 12, 0.6], [18, 18, -0.8], [-18, 16, 0.9]
];
dummyPositions.forEach(([x, z, yaw]) => makeDummy(x, z, yaw));

// ===================== Weapon Viewmodel =====================
// Procedural M4-ish placeholder; GLB from /public/models will override if present
const weaponGroup = new THREE.Group();
scene.add(weaponGroup);

// Keep weapon attached to camera via separate scene? Use camera.add for true viewmodel so it doesn't clip world.
camera.add(weaponGroup);
scene.add(camera); // ensure camera in scene for controls

function createProceduralRifle() {
  const g = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 0.42, metalness: 0.55 });
  const gunDark = new THREE.MeshStandardMaterial({ color: 0x0f1318, roughness: 0.55, metalness: 0.35 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x1e242e, roughness: 0.72, metalness: 0.1 });

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.48), gunMetal);
  receiver.position.set(0, -0.18, -0.42); g.add(receiver);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.42), gunDark);
  handguard.position.set(0, -0.18, -0.78); g.add(handguard);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58, 12), gunMetal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, -0.165, -1.08); g.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), gunMetal);
  sight.position.set(0, -0.11, -0.46); g.add(sight);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.10), poly);
  mag.position.set(0, -0.30, -0.42); mag.rotation.x = 0.12; g.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.09), poly);
  grip.position.set(0, -0.30, -0.30); grip.rotation.x = 0.28; g.add(grip);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.24), poly);
  stock.position.set(0, -0.17, -0.14); g.add(stock);

  // hands (mittens)
  const handMat = new THREE.MeshStandardMaterial({ color: 0x8a7a62, roughness: 0.9 });
  const fHand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.14), handMat);
  fHand.position.set(0, -0.24, -0.72); g.add(fHand);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.12), handMat);
  rHand.position.set(0.04, -0.29, -0.30); g.add(rHand);

  g.position.set(0.28, -0.22, -0.55);
  g.rotation.set(0, 0, 0);
  return g;
}

let viewModel = createProceduralRifle();
weaponGroup.add(viewModel);

// Muzzle
const muzzleFlash = new THREE.PointLight(0xfff0a0, 0, 4, 1.6);
muzzleFlash.position.set(0, -0.165, -1.38);
viewModel.add(muzzleFlash);
const muzzleSprite = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: 0xfff6a0, transparent: true, opacity: 0 }));
muzzleSprite.position.copy(muzzleFlash.position);
muzzleSprite.position.z -= 0.02;
muzzleSprite.lookAt(0, 0, 0);
viewModel.add(muzzleSprite);

// Try to load GLB if artist drops one at /public/models/rifle.glb — gracefully fall back
import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
  const loader = new GLTFLoader();
  loader.load('/models/rifle.glb', (gltf) => {
    const glb = gltf.scene;
    // normalize: center and scale to viewmodel volume
    const box3 = new THREE.Box3().setFromObject(glb);
    const size = new THREE.Vector3(); box3.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 0.55 / maxDim;
    glb.scale.setScalar(scale);
    box3.setFromObject(glb);
    const center = new THREE.Vector3(); box3.getCenter(center);
    glb.position.sub(center);
    glb.position.add(new THREE.Vector3(0.28, -0.22, -0.55));
    // fix materials: ensure shadows/double side not needed
    glb.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; if (o.material) o.material.needsUpdate = true; } });
    weaponGroup.remove(viewModel);
    viewModel = new THREE.Group();
    viewModel.add(glb);
    // reattach muzzle at barrel tip estimate
    viewModel.add(muzzleFlash);
    viewModel.add(muzzleSprite);
    muzzleFlash.position.set(0.28, -0.165, -1.38);
    weaponGroup.add(viewModel);
  }, undefined, () => { /* no glb yet — keep procedural */ });
});

// ===================== Input & Physics =====================
const keys = {};
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyR') tryReload();
  if (e.code === 'KeyQ') ads = !ads;
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousedown', e => { if (e.button === 0) wantFire = true; if (e.button === 2) ads = true; });
addEventListener('mouseup', e => { if (e.button === 0) wantFire = false; if (e.button === 2) ads = false; });
addEventListener('contextmenu', e => e.preventDefault());

let velocity = new THREE.Vector3();
let onGround = true;
let ads = false;
let wantFire = false;
let sprinting = false;

const player = {
  pos: new THREE.Vector3(0, 1.68, 8),
  vel: new THREE.Vector3(),
  yaw: 0,
  health: 100,
  score: 0,
  ammo: CONFIG.magSize,
  reserve: CONFIG.reserve,
  reloading: false,
  lastShot: 0,
};

// HUD update
function updateHUD() {
  ammoEl.innerHTML = `${player.ammo}<small> / ${player.reserve}</small>`;
  if (player.reloading) ammoEl.style.opacity = '0.55'; else ammoEl.style.opacity = '1';
  healthVal.textContent = Math.round(player.health);
  healthFill.style.width = player.health + '%';
  healthFill.style.background = player.health > 55 ? 'linear-gradient(90deg,#1ce06a,#0aa84a)' : player.health > 25 ? 'linear-gradient(90deg,#ffbf2e,#ff7a00)' : 'linear-gradient(90deg,#ff3b3b,#b40000)';
  scoreVal.textContent = player.score;
  const alive = targets.filter(t => t.userData.alive).length;
  targetsVal.textContent = `${alive} targets`;
}

// ===================== Shooting =====================
const raycaster = new THREE.Raycaster();
let shootCooldown = 0;
let reloadTimer = 0;
const tracers = [];
const decals = [];
const hitPuffs = [];

function canShoot() {
  return !player.reloading && player.ammo > 0 && performance.now() - player.lastShot > CONFIG.fireRate;
}

function tryReload() {
  if (player.reloading || player.ammo === CONFIG.magSize || player.reserve <= 0) return;
  player.reloading = true;
  reloadTimer = CONFIG.reloadTime;
  // weapon anim
  viewModel.userData.reloadT = 0;
}

function doReload() {
  const need = CONFIG.magSize - player.ammo;
  const take = Math.min(need, player.reserve);
  player.reserve -= take;
  player.ammo += take;
  player.reloading = false;
  updateHUD();
  pushKillfeed(`Reloaded +${take}`);
}

function spawnTracer(from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const mat = new THREE.LineBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  tracers.push({ mesh: line, t: 0, mat });
}

function spawnDecal(pos, normal) {
  const g = new THREE.CircleGeometry(0.05 + Math.random() * 0.03, 8);
  const m = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, transparent: true, opacity: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(pos).addScaledVector(normal, 0.01);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  mesh.userData.life = 14;
  scene.add(mesh);
  decals.push(mesh);
}

function hitEffect(pos) {
  const geo = new THREE.SphereGeometry(0.06, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos);
  scene.add(m);
  hitPuffs.push({ mesh: m, t: 0, mat });
}

function showHitmarker(headshot = false) {
  hitmarker.classList.remove('show'); void hitmarker.offsetWidth;
  hitmarker.classList.add('show');
  hitmarker.style.filter = headshot ? 'drop-shadow(0 0 8px #ff2b2b)' : 'none';
  // color heads
  const spans = hitmarker.querySelectorAll('span');
  spans.forEach(s => s.style.background = headshot ? '#ff2b2b' : '#fff');
  setTimeout(() => hitmarker.classList.remove('show'), 140);
  // haptic-ish crosshair kick
  const ch = document.getElementById('crosshair');
  ch.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(1.35)' }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 120 });
}

function pushKillfeed(txt) {
  const el = document.createElement('div'); el.className = 'kf'; el.textContent = txt;
  killfeed.prepend(el);
  setTimeout(() => el.remove(), 2400);
  if (killfeed.children.length > 4) killfeed.lastChild.remove();
}

function shoot() {
  if (!canShoot()) return;
  if (!controls.isLocked) return;
  player.lastShot = performance.now();
  player.ammo--;
  updateHUD();

  // muzzle flash
  muzzleFlash.intensity = 14;
  muzzleFlash.distance = 7;
  muzzleSprite.material.opacity = 1;
  setTimeout(() => { muzzleSprite.material.opacity = 0; }, 45);
  setTimeout(() => { muzzleFlash.intensity = 0; }, 60);

  // recoil kick
  viewModel.position.z += 0.04;
  viewModel.rotation.x -= 0.018;
  camera.rotation.x -= 0.002; // subtle handled via controls pitch?
  // apply via controls object rotation
  const obj = controls.getObject();
  obj.rotation.x = Math.max(-Math.PI / 2 + 0.1, obj.rotation.x - 0.012 * (ads ? 0.5 : 1));

  // raycast from camera
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  // slight spread when not ADS
  if (!ads) {
    const spread = 0.006;
    raycaster.ray.direction.x += (Math.random() - 0.5) * spread;
    raycaster.ray.direction.y += (Math.random() - 0.5) * spread;
    raycaster.ray.direction.normalize();
  }
  const allMeshes = [];
  targets.forEach(g => g.traverse(o => { if (o.isMesh) allMeshes.push(o); }));
  // also test walls/ground for decals
  const wallMeshes = [];
  scene.traverse(o => { if (o.isMesh && !o.userData.dummy && o !== ground && o.geometry && o.geometry.type === 'BoxGeometry') wallMeshes.push(o); });
  const hits = raycaster.intersectObjects([...allMeshes, ground, ...wallMeshes], false);
  let hitPos = null;
  let hitNormal = new THREE.Vector3(0, 1, 0);
  if (hits.length) {
    const h = hits[0];
    hitPos = h.point.clone();
    hitNormal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize() : new THREE.Vector3(0, 1, 0);
    // check if target
    let objHit = h.object;
    // traverse up to find dummy
    let dummy = objHit.userData.dummy;
    let part = objHit.userData.part;
    if (!dummy) {
      // fallback search parents
      let p = objHit.parent;
      while (p && !dummy) { if (p.userData && p.userData.alive !== undefined) dummy = p; p = p.parent; }
    }
    if (dummy && dummy.userData.alive) {
      const isHead = part === 'head';
      const dmg = Math.round(CONFIG.damage * (isHead ? CONFIG.headshotMult : 1));
      dummy.userData.hp -= dmg;
      dummy.userData.hitFlash = 1;
      showHitmarker(isHead);
      hitEffect(hitPos);
      // knockback
      dummy.position.addScaledVector(raycaster.ray.direction, 0.08);
      if (dummy.userData.hp <= 0) {
        dummy.userData.alive = false;
        dummy.userData.fallT = 0;
        player.score += isHead ? 150 : 100;
        updateHUD();
        pushKillfeed(isHead ? `HEADSHOT +150` : `HIT +100  •  Dummy down`);
        // drop animation
      } else {
        pushKillfeed(isHead ? `HEADSHOT ${dmg}` : `HIT ${dmg}`);
      }
    } else {
      spawnDecal(hitPos, hitNormal);
      hitEffect(hitPos);
    }
  }
  // tracer
  const origin = new THREE.Vector3();
  muzzleFlash.getWorldPosition(origin);
  const end = hitPos ? hitPos.clone() : raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 60);
  spawnTracer(origin, end);

  if (player.ammo === 0) {
    setTimeout(() => tryReload(), 180);
  }
}

// ===================== Movement =====================
const clock = new THREE.Clock();
let timeLeft = CONFIG.duration;
let gameOver = false;

function collide(pos, radius = 0.42) {
  for (const c of colliders) {
    if (pos.x + radius > c.min.x && pos.x - radius < c.max.x && pos.z + radius > c.min.z && pos.z - radius < c.max.z) {
      return c;
    }
  }
  return null;
}

function update(dt) {
  if (gameOver) return;
  // timer
  timeLeft -= dt;
  if (timeLeft <= 0) { timeLeft = 0; gameOver = true; blocker.style.display = 'flex'; document.querySelector('#menu h1').innerHTML = `Range <em>Complete</em>`; playBtn.textContent = `↻  Play Again`; updateHUD(); }
  const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const s = Math.floor(timeLeft % 60).toString().padStart(2, '0');
  timeVal.textContent = `${m}:${s}`;
  timerBar.style.width = (timeLeft / CONFIG.duration * 100) + '%';

  // input vector
  const forward = Number(keys['KeyW'] || keys['ArrowUp']) - Number(keys['KeyS'] || keys['ArrowDown']);
  const strafe = Number(keys['KeyD'] || keys['ArrowRight']) - Number(keys['KeyA'] || keys['ArrowLeft']);
  sprinting = !!keys['ShiftLeft'] && forward > 0 && !ads;
  const speed = CONFIG.walkSpeed * (sprinting ? CONFIG.sprintMult : 1) * (ads ? 0.55 : 1);

  // camera yaw
  const obj = controls.getObject();
  // keep player.pos in sync with camera (PointerLockControls moves camera directly)
  // Instead, we drive camera.position manually when locked, by moving obj.position

  // Build move dir in world space from camera yaw
  const yaw = obj.rotation.y;
  const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = new THREE.Vector3();
  wish.addScaledVector(fwd, forward);
  wish.addScaledVector(right, strafe);
  if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed * dt);

  // simple collision slide: try X then Z
  let next = obj.position.clone().add(new THREE.Vector3(wish.x, 0, 0));
  if (!collide(next)) obj.position.x = next.x;
  next = obj.position.clone().add(new THREE.Vector3(0, 0, wish.z));
  if (!collide(next)) obj.position.z = next.z;

  // clamp inside arena
  obj.position.x = THREE.MathUtils.clamp(obj.position.x, -34, 34);
  obj.position.z = THREE.MathUtils.clamp(obj.position.z, -34, 34);

  // gravity / jump
  if (keys['Space'] && onGround) { player.vel.y = CONFIG.jumpForce; onGround = false; }
  player.vel.y -= CONFIG.gravity * dt;
  obj.position.y += player.vel.y * dt;
  if (obj.position.y <= 1.68) { obj.position.y = 1.68; player.vel.y = 0; onGround = true; }
  if (obj.position.y > 6) { obj.position.y = 6; player.vel.y = 0; }

  // bob + ADS lerp for viewmodel
  const t = performance.now() * 0.001;
  const moving = wish.length() > 0.001;
  const bobAmp = sprinting ? 0.045 : 0.022;
  const bobFreq = sprinting ? 11 : 7.2;
  const bobX = moving ? Math.sin(t * bobFreq) * bobAmp : 0;
  const bobY = moving ? Math.abs(Math.cos(t * bobFreq)) * bobAmp * 0.6 : 0;
  const adsT = ads ? 1 : 0;
  // smooth ads
  viewModel.userData.adsLerp = THREE.MathUtils.lerp(viewModel.userData.adsLerp || 0, adsT, dt * 9);
  const a = viewModel.userData.adsLerp;
  viewModel.position.lerp(new THREE.Vector3(
    THREE.MathUtils.lerp(0.28, 0.0, a) + bobX * 0.1,
    THREE.MathUtils.lerp(-0.22, -0.18, a) + bobY,
    THREE.MathUtils.lerp(-0.55, -0.38, a)
  ), dt * 14);
  viewModel.rotation.x = THREE.MathUtils.lerp(viewModel.rotation.x, -0.02 * a, dt * 10);
  // sprint tilt
  viewModel.rotation.z = THREE.MathUtils.lerp(viewModel.rotation.z, sprinting ? -0.12 : 0, dt * 8);
  viewModel.rotation.y = THREE.MathUtils.lerp(viewModel.rotation.y, sprinting ? 0.08 : 0, dt * 8);

  // reload lerp
  if (player.reloading) {
    reloadTimer -= dt * 1000;
    const p = 1 - reloadTimer / CONFIG.reloadTime;
    viewModel.rotation.x = Math.sin(p * Math.PI) * 0.35;
    viewModel.position.y += Math.sin(p * Math.PI) * 0.06;
    if (reloadTimer <= 0) doReload();
  }

  // shooting hold
  if (wantFire) shoot();
  else if (player.ammo === 0 && !player.reloading) { /* auto reload handled */ }

  // recoil recovery
  viewModel.position.z = THREE.MathUtils.lerp(viewModel.position.z, THREE.MathUtils.lerp(-0.55, -0.38, a), dt * 10);
  viewModel.rotation.x = THREE.MathUtils.lerp(viewModel.rotation.x, THREE.MathUtils.lerp(0, -0.02, a), dt * 8);

  // targets sway + hit flash + fall
  for (const d of targets) {
    if (d.userData.alive) {
      if (d.userData.hitFlash > 0) {
        d.userData.hitFlash -= dt * 4;
        d.traverse(o => { if (o.isMesh && o.material && o.material.color) o.material.color.setHSL(0, 0.9, 0.5 + d.userData.hitFlash * 0.18); });
      }
      // gentle sway
      d.position.x = d.userData.baseX + Math.sin(t * 0.6 + d.userData.sway) * 0.06;
      // respawn flash reset color
      if (d.userData.hitFlash <= 0) {
        d.traverse(o => {
          if (o.name === 'body') o.material.color.set(0xd9c7a5);
          if (o.name === 'head') o.material.color.set(0xe8dfc8);
        });
        d.userData.hitFlash = 0;
      }
    } else {
      d.userData.fallT = (d.userData.fallT || 0) + dt * 1.8;
      const p2 = Math.min(1, d.userData.fallT);
      d.rotation.z = THREE.MathUtils.lerp(0, -Math.PI / 2.2, p2);
      d.position.y = THREE.MathUtils.lerp(0, -0.45, p2);
      if (p2 >= 1 && d.userData.respawnAt == null) {
        d.userData.respawnAt = t + 2.2;
      }
      if (d.userData.respawnAt && t > d.userData.respawnAt) {
        d.userData.alive = true; d.userData.hp = d.userData.maxHp; d.userData.hitFlash = 0; d.userData.fallT = 0; d.userData.respawnAt = null;
        d.rotation.z = 0; d.position.y = 0;
        d.position.x = d.userData.baseX; d.position.z = d.userData.baseZ;
        // flicker spawn
        pushKillfeed('Target reset');
        updateHUD();
      }
    }
  }

  // tracers fade
  for (let i = tracers.length - 1; i >= 0; i--) {
    const tr = tracers[i];
    tr.t += dt * 6;
    tr.mat.opacity = 1 - tr.t;
    if (tr.t >= 1) { scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tracers.splice(i, 1); }
  }
  for (let i = hitPuffs.length - 1; i >= 0; i--) {
    const h = hitPuffs[i];
    h.t += dt * 5;
    h.mesh.scale.setScalar(1 + h.t * 2.2);
    h.mat.opacity = 1 - h.t;
    if (h.t >= 1) { scene.remove(h.mesh); hitPuffs.splice(i, 1); }
  }
  // decals expire slowly
  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].userData.life -= dt;
    if (decals[i].userData.life <= 0) { scene.remove(decals[i]); decals.splice(i, 1); }
  }

  // subtle vignette when sprinting
  damageVig.style.opacity = sprinting ? '0.08' : '0';
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Prevent stuck pointer when tab hidden
document.addEventListener('visibilitychange', () => { wantFire = false; });

// Init HUD
updateHUD();
controls.getObject().position.copy(camera.position);
scene.add(controls.getObject());

// Auto-focus hint for port 3000 runners
console.log('[FPS] Tactical Range ready — click Play to lock pointer. Port 3000.');

// Fake damage vignette test on 'H'
addEventListener('keydown', e => {
  if (e.code === 'KeyH') { player.health = Math.max(0, player.health - 18); damageVig.style.opacity = '0.55'; setTimeout(() => damageVig.style.opacity = '0', 260); updateHUD(); }
});

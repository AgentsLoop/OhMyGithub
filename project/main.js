import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------- Scene setup ----------
const canvas = document.getElementById('c');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ea0b5); // will override with fog + sky
scene.fog = new THREE.FogExp2(0x9aa8bd, 0.012);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 600);
camera.position.set(0, 1.7, 12);

// ---------- Postprocessing (Black Ops 6 filmic bar) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// bloom: makes muzzle flash / explosions / sun glow like BO6 (threshold tuned so only bright emissives bloom)
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.38, 0.68);
composer.addPass(bloomPass);
// filmic vignette + grain + subtle warm grade + contrast — cheap ShaderPass, no extra render target
const FilmVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.42 },
    vignetteSoftness: { value: 0.58 },
    time: { value: 0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteStrength;
    uniform float vignetteSoftness;
    uniform float time;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // CoD-style corner vignette (darkens edges, keeps center punchy)
      float d = distance(vUv, vec2(0.5));
      float vign = 1.0 - vignetteStrength * smoothstep(0.45, 1.35, d * 1.9);
      c.rgb *= vign;
      // subtle film grain (animated via time hash)
      float g = hash(vUv * 600.0 + vec2(time*4.0, time*1.7)) * 0.07 - 0.035;
      c.rgb += g * 0.55;
      // BO6 contrast: slight S-curve / lifted blacks
      c.rgb = pow(c.rgb, vec3(0.97));
      c.rgb = (c.rgb - 0.5) * 1.07 + 0.5;
      // warm push (BO6 desert/urban is warm, shadows cool — mix very subtle)
      c.rgb = mix(c.rgb, vec3(c.r*1.045, c.g*1.0, c.b*0.965), 0.14);
      // clamp
      c.rgb = clamp(c.rgb, 0.0, 1.0);
      gl_FragColor = c;
    }
  `
};
const filmPass = new ShaderPass(FilmVignetteShader);
composer.addPass(filmPass);
composer.addPass(new OutputPass());

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

// Lights — AAA-like: sun + sky + fill
const dirLight = new THREE.DirectionalLight(0xfff6e8, 2.2);
dirLight.position.set(22, 34, 14);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048,2048);
dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 120;
dirLight.shadow.camera.left = -40; dirLight.shadow.camera.right = 40; dirLight.shadow.camera.top = 40; dirLight.shadow.camera.bottom = -40;
dirLight.shadow.bias = -0.0006;
scene.add(dirLight);
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a332e, 0.85));
const fill = new THREE.DirectionalLight(0x8ecbff, 0.5); fill.position.set(-18,12,-14); scene.add(fill);

// Sky dome
{
  const geo = new THREE.SphereGeometry(300, 32, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms:{t:{value:0}},
    vertexShader:`varying vec3 vpos; void main(){vpos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vpos; void main(){ float h = normalize(vpos).y; vec3 top=vec3(0.55,0.68,0.85); vec3 bot=vec3(0.86,0.90,0.95); vec3 col=mix(bot,top, smoothstep(-0.15,0.65,h)); col += vec3(0.12,0.14,0.18)*pow(max(0.,h),8.); gl_FragColor=vec4(col,1.); }`
  });
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
}

// Ground — large PBR plane with grief texture procedurally via canvas
function makeGroundTexture(){
  const c=document.createElement('canvas'); c.width=1024;c.height=1024;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#8a8f96'; ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<9000;i++){ const x=Math.random()*1024,y=Math.random()*1024, r=Math.random()*1.8+0.6; ctx.fillStyle=`rgba(${120+Math.random()*40},${122+Math.random()*30},${130+Math.random()*30},${0.15+Math.random()*0.2})`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  // cracks/lines
  ctx.strokeStyle='rgba(60,64,70,0.18)'; ctx.lineWidth=1.2;
  for(let i=0;i<120;i++){ ctx.beginPath(); ctx.moveTo(Math.random()*1024,Math.random()*1024); ctx.lineTo(Math.random()*1024,Math.random()*1024); ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(10,10); tex.anisotropy=8; tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
const groundTex=makeGroundTexture();
const groundBump=new THREE.CanvasTexture(document.createElement('canvas')); // keep placeholder
const groundMat=new THREE.MeshStandardMaterial({ map: groundTex, roughness:0.92, metalness:0.04 });
const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220), groundMat);
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);

// Level colliders (AABB list for simple collision)
const colliders=[];
function addBox(pos, size, color=0x7c8694, roughness=0.78){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,size.y,size.z), new THREE.MeshStandardMaterial({ color, roughness, metalness:0.05 }));
  mesh.position.copy(pos); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  colliders.push({ min: new THREE.Vector3(pos.x-size.x/2, pos.y-size.y/2, pos.z-size.z/2), max: new THREE.Vector3(pos.x+size.x/2, pos.y+size.y/2, pos.z+size.z/2) });
  return mesh;
}
function addContainer(pos, yaw=0){
  const g=new THREE.Group(); g.position.copy(pos); g.rotation.y=yaw; scene.add(g);
  const body=new THREE.Mesh(new THREE.BoxGeometry(6,2.6,2.4), new THREE.MeshStandardMaterial({ color:0xb63a1a, roughness:0.82, metalness:0.12 })); body.castShadow=true; body.receiveShadow=true; g.add(body);
  // corrugation deco
  const top=new THREE.Mesh(new THREE.BoxGeometry(6.05,0.08,2.45), new THREE.MeshStandardMaterial({ color:0x8f2e14 })); top.position.y=1.34; g.add(top);
  // add collider
  const half=new THREE.Vector3(3,1.3,1.2);
  // approximate AABB world (axis-aligned after yaw -> enlarge)
  const min=new THREE.Vector3(pos.x- half.x-1, pos.y-half.y, pos.z-half.z-1), max=new THREE.Vector3(pos.x+half.x+1, pos.y+half.y, pos.z+half.z+1);
  colliders.push({ min, max });
}
function addBarrel(pos){
  const geo=new THREE.CylinderGeometry(0.45,0.45,0.95,16);
  const mesh=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color:0x2b2f36, roughness:0.65, metalness:0.35 }));
  mesh.position.copy(pos); mesh.position.y+=0.475; mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  colliders.push({ min:new THREE.Vector3(pos.x-0.45, pos.y, pos.z-0.45), max:new THREE.Vector3(pos.x+0.45,pos.y+0.95,pos.z+0.45) });
}
function addWall(pos,size){
  addBox(pos,size,0xc2c9d1,0.88);
}
// Perimeter walls
addWall(new THREE.Vector3(0,2.5, -52), new THREE.Vector3(110,5,2));
addWall(new THREE.Vector3(0,2.5, 52), new THREE.Vector3(110,5,2));
addWall(new THREE.Vector3(-55,2.5,0), new THREE.Vector3(2,5,104));
addWall(new THREE.Vector3(55,2.5,0), new THREE.Vector3(2,5,104));
// Interior cover
addContainer(new THREE.Vector3(-12,1.3, -8), 0.19);
addContainer(new THREE.Vector3(10,1.3, -14), -0.34);
addContainer(new THREE.Vector3(18,1.3, 6), 0.6);
addContainer(new THREE.Vector3(-18,1.3, 10), -0.22);
addContainer(new THREE.Vector3(0,1.3, 18), Math.PI/2);
addBox(new THREE.Vector3(-6,1.0, 2), new THREE.Vector3(1.2,2,6), 0x9aa3ae);
addBox(new THREE.Vector3(8,1.0, -2), new THREE.Vector3(8,2,1.1), 0x9aa3ae);
addBox(new THREE.Vector3(-2,1.5, -22), new THREE.Vector3(14,3,1.4));
addBox(new THREE.Vector3(22,1.5, -6), new THREE.Vector3(1.4,3,14));
addBox(new THREE.Vector3(-22,1.5, 4), new THREE.Vector3(1.4,3,16));
for(let i=0;i<14;i++) addBarrel(new THREE.Vector3((Math.random()-0.5)*42,0,(Math.random()-0.5)*42));
// Guard towers
addBox(new THREE.Vector3(32,4, -32), new THREE.Vector3(4,8,4), 0x3a3f47);
addBox(new THREE.Vector3(-34,4, 28), new THREE.Vector3(4,8,4), 0x3a3f47);

// ---------- Weapon ----------
const weaponGroup=new THREE.Group();
let rifle=null; let muzzle=null;
const loader=new GLTFLoader();
loader.load('/models/rifle.glb', (gltf)=>{
  rifle=gltf.scene;
  rifle.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.frustumCulled=false; }});
  // Normalize scale/position: the M4 is ~2 units long; scale down, rotate to face forward
  const box=new THREE.Box3().setFromObject(rifle);
  const size=new THREE.Vector3(); box.getSize(size);
  const center=new THREE.Vector3(); box.getCenter(center);
  rifle.position.sub(center);
  // Heuristic: make length ~1.9 along Z
  const scale = 0.9 / Math.max(size.z, size.x*2);
  rifle.scale.setScalar(scale*1.8);
  rifle.position.set(0.32, -0.22, -0.65); // viewmodel offset relative to weaponGroup
  rifle.rotation.y = Math.PI; // face forward
  weaponGroup.add(rifle);
  // fallback procedural rifle if still offset wrong? keep it
}, (e)=>console.log('rifle load progress',e), (err)=>{ console.warn('rifle failed',err); createProceduralRifle(); });

function createProceduralRifle(){
  if(rifle) return;
  const mat=new THREE.MeshStandardMaterial({ color:0x1a1d22, roughness:0.55, metalness:0.25 });
  const mat2=new THREE.MeshStandardMaterial({ color:0x4a4d52, roughness:0.4, metalness:0.6 });
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.08,0.62), mat); body.position.set(0,0,0); weaponGroup.add(body);
  const hand=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.09), mat); hand.position.set(0,-0.09,0.1); weaponGroup.add(hand);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.55,12), mat2); barrel.rotation.x=Math.PI/2; barrel.position.set(0,0.02,-0.45); weaponGroup.add(barrel);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.04,0.04), mat2); sight.position.set(0,0.06,0); weaponGroup.add(sight);
  rifle=body;
}
createProceduralRifle();

// muzzle flash point
muzzle=new THREE.PointLight(0xff8a00, 0, 6, 1.6); muzzle.position.set(0,0.02,-0.9); weaponGroup.add(muzzle);
const flashMesh=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,8), new THREE.MeshBasicMaterial({ color:0xffd27a, transparent:true, opacity:0 })); flashMesh.rotation.x=Math.PI/2; flashMesh.position.copy(muzzle.position); flashMesh.position.z-=0.08; weaponGroup.add(flashMesh);

// Weapon sway helpers
let weaponSway={ x:0,y:0 };
camera.add(weaponGroup);
weaponGroup.position.set(0.35,-0.28,-0.55);
scene.add(camera);

// ---------- Enemies ----------
const enemies=[];
const enemyGeo=new THREE.CapsuleGeometry(0.42, 1.0, 8, 16);
let soldierTemplate=null, soldierAnims=[];
let soldierLoaded=false;
const mixers=[];
loader.load('/models/soldier.glb', (gltf)=>{
  soldierTemplate=gltf.scene;
  soldierTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; o.frustumCulled=false; }});
  soldierAnims=gltf.animations;
  soldierLoaded=true;
  // replace existing capsule enemies with skinned clones
  enemies.forEach(e=>{
    if(!e.mesh.userData.isSoldier){
      const clone=SkeletonUtils.clone(soldierTemplate);
      clone.position.copy(e.mesh.position); clone.quaternion.copy(e.mesh.quaternion);
      clone.scale.set(1.18,1.18,1.18);
      scene.remove(e.mesh);
      scene.add(clone);
      e.mesh=clone;
      e.mixer=new THREE.AnimationMixer(clone);
      e.mixer.clipAction(soldierAnims.find(a=> a.name.includes('idle')) || soldierAnims[0]).play();
      clone.userData.isSoldier=true;
      mixers.push(e.mixer);
    }
  });
}, undefined, ()=>{ console.warn('soldier load failed, keeping capsules'); });
function spawnEnemy(pos){
  // start as capsule, will be upgraded to skinned soldier once loaded (covers instant gameplay)
  const mat=new THREE.MeshStandardMaterial({ color:0x2f3a42, roughness:0.75, metalness:0.08 });
  const mesh=new THREE.Mesh(enemyGeo, mat); mesh.position.copy(pos); mesh.position.y=1.02; mesh.castShadow=true; mesh.receiveShadow=true;
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,12,12), new THREE.MeshStandardMaterial({ color:0x1e2328 })); head.position.y=0.78; mesh.add(head);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.62,0.34), new THREE.MeshStandardMaterial({ color:0x5a6440, roughness:0.9 })); vest.position.y=0.18; mesh.add(vest);
  scene.add(mesh);
  const e={ mesh, hp:100, alive:true, lastShot:0, detect: 18+Math.random()*12, state:'patrol', patrol: pos.clone(), vel:new THREE.Vector3(), shootCooldown: 900+Math.random()*600, mixer:null };
  enemies.push(e);
  // if soldier already loaded, immediately upgrade
  if(soldierLoaded && soldierTemplate){
    const clone=SkeletonUtils.clone(soldierTemplate);
    clone.position.copy(mesh.position); clone.scale.set(1.18,1.18,1.18);
    scene.remove(mesh); scene.add(clone);
    e.mesh=clone; e.mixer=new THREE.AnimationMixer(clone);
    e.mixer.clipAction(soldierAnims.find(a=> a.name.includes('idle')) || soldierAnims[0]).play();
    clone.userData.isSoldier=true; mixers.push(e.mixer);
  }
}
for(let i=0;i<12;i++){
  let p=new THREE.Vector3((Math.random()-0.5)*70,0,(Math.random()-0.5)*70);
  if(p.length()<8) p.set(20+Math.random()*10,0, 12+Math.random()*10);
  spawnEnemy(p);
}

// ---------- Game state ----------
let keys={};
let vel=new THREE.Vector3();
let canJump=false;
let health=100, armor=50;
let ammo=30, reserve=90;
let sprinting=false, ads=false;
let yaw=0, pitch=0;
let kills=0, score=0;
let timeLeft=240;
let gameState='menu'; // menu, playing, paused, dead, won
let hitmarkerTimer=0, flashTimer=0, reloadTimer=0, isReloading=false;
let recoil=0;
const playerPos=()=> controls.getObject().position;
playerPos().set(0,1.7, 18);
const playerVel=new THREE.Vector3();

// UI refs
const ammoEl=document.getElementById('ammo'), reserveEl=document.getElementById('reserve'), healthEl=document.getElementById('health'), healthBar=document.getElementById('health-bar');
const scoreEl=document.getElementById('score'), objText=document.getElementById('obj-text'), timerEl=document.getElementById('timer'), centerMsg=document.getElementById('center-msg');
const hitmarker=document.getElementById('hitmarker'), crosshair=document.getElementById('crosshair'), damageV=document.getElementById('damage-vignette'), killfeed=document.getElementById('killfeed');
const adsOverlay=document.getElementById('ads-overlay');

function updateHUD(){
  ammoEl.textContent=ammo; reserveEl.textContent=reserve; healthEl.textContent=Math.max(0,Math.round(health));
  healthBar.style.width= (health)+'%';
  healthBar.style.background = health<30 ? 'linear-gradient(90deg,#ff1a1a,#ff6a00)' : health<60 ? 'linear-gradient(90deg,#ffb700,#ff3c00)' : 'linear-gradient(90deg,#ff3c00,#ff7a00)';
  document.getElementById('armor-text').textContent='ARMOR '+Math.max(0,Math.round(armor));
  scoreEl.textContent=score; objText.textContent=`ELIMINATE HOSTILES • ${kills} / 12`;
  timerEl.textContent= `${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(Math.floor(timeLeft%60)).padStart(2,'0')}`;
}
updateHUD();

// Input
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && !isReloading && ammo<30 && reserve>0) startReload();
  if(e.code==='KeyG'){ spawnGrenade(); }
  if(e.code==='Escape' && gameState==='playing'){ pause(); }
});
addEventListener('keyup', e=> keys[e.code]=false);
addEventListener('mousedown', e=>{
  if(gameState!=='playing') return;
  if(e.button===0) shoot();
  if(e.button===2) setADS(true);
});
addEventListener('mouseup', e=>{ if(e.button===2) setADS(false); });
addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('mousemove', e=>{
  if(!controls.isLocked || gameState!=='playing') return;
  const sens=0.0022;
  yaw -= e.movementX*sens;
  pitch -= e.movementY*sens;
  pitch=Math.max(-1.35, Math.min(1.35,pitch));
  controls.getObject().rotation.order='YXZ';
  controls.getObject().rotation.y=yaw;
  controls.getObject().rotation.x=pitch;
  weaponSway.x += e.movementX*0.0006; weaponSway.y += e.movementY*0.0006;
});
canvas.addEventListener('click', ()=>{
  if(gameState==='menu' || gameState==='paused') controls.lock();
});
controls.addEventListener('lock', ()=>{
  if(gameState==='menu'){ startGame(); }
  if(gameState==='paused') resume();
});
controls.addEventListener('unlock', ()=>{
  if(gameState==='playing') pause();
});

document.getElementById('play-btn').addEventListener('click', ()=> controls.lock());
document.getElementById('resume-btn').addEventListener('click', ()=> controls.lock());
document.getElementById('restart-btn').addEventListener('click', ()=> restart());
document.getElementById('respawn-btn').addEventListener('click', ()=> respawn());
document.getElementById('again-btn').addEventListener('click', ()=> restart());

function setADS(v){
  ads=v;
  adsOverlay.classList.toggle('hidden', !v);
  crosshair.classList.toggle('ads', v);
  camera.fov = v? 52 : (sprinting? 82:74);
  camera.updateProjectionMatrix();
}
function pause(){
  if(gameState!=='playing') return;
  gameState='paused';
  document.getElementById('pause-screen').classList.remove('hidden');
  controls.unlock();
}
function resume(){
  document.getElementById('pause-screen').classList.add('hidden');
  gameState='playing';
  controls.lock();
}
function startGame(){
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('win-screen').classList.add('hidden');
  gameState='playing';
  updateHUD();
}
function restart(){
  health=100; armor=50; ammo=30; reserve=90; kills=0; score=0; timeLeft=240;
  playerPos().set(0,1.7,18); yaw=0; pitch=0; controls.getObject().rotation.set(0,0,0);
  enemies.forEach((e,i)=>{
    e.alive=true; e.hp=100; e.mesh.visible=true;
    const p=new THREE.Vector3((Math.random()-0.5)*70,0,(Math.random()-0.5)*70); if(p.length()<8) p.set(20,0,12);
    e.mesh.position.copy(p); e.mesh.position.y=1.02; e.patrol.copy(p);
  });
  document.getElementById('win-screen').classList.add('hidden');
  document.getElementById('death-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  gameState='playing'; controls.lock(); updateHUD();
}
function respawn(){
  health=100; armor=50; playerPos().set(0,1.7,18);
  document.getElementById('death-screen').classList.add('hidden');
  gameState='playing'; controls.lock(); updateHUD();
}
function die(){
  gameState='dead';
  document.getElementById('death-screen').classList.remove('hidden');
  controls.unlock();
}
function win(){
  gameState='won';
  document.getElementById('win-stats').textContent=`Kills: ${kills} • Score: ${score} • Time remaining: ${Math.floor(timeLeft)}s`;
  document.getElementById('win-screen').classList.remove('hidden');
  controls.unlock();
}

// Audio helper (procedural)
let audioCtx=null;
function ensureAudio(){ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }
function playSound(kind){
  ensureAudio(); if(audioCtx.state==='suspended') audioCtx.resume();
  const o=audioCtx.createOscillator(), g=audioCtx.createGain(), f=audioCtx.createBiquadFilter();
  o.connect(f); f.connect(g); g.connect(audioCtx.destination);
  if(kind==='shoot'){ o.type='square'; o.frequency.setValueAtTime(180,audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(40,audioCtx.currentTime+0.08); g.gain.setValueAtTime(0.22,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.12); o.start(); o.stop(audioCtx.currentTime+0.13);
    // noise burst
    const buf=audioCtx.createBuffer(1, audioCtx.sampleRate*0.08, audioCtx.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2)*0.6;
    const src=audioCtx.createBufferSource(); src.buffer=buf; const ng=audioCtx.createGain(); ng.gain.value=0.35; src.connect(ng); ng.connect(audioCtx.destination); src.start();
  } else if(kind==='hit'){ o.type='sine'; o.frequency.value=880; g.gain.setValueAtTime(0.22,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.08); o.start(); o.stop(audioCtx.currentTime+0.09);}
  else if(kind==='reload'){ o.type='triangle'; o.frequency.value=220; g.gain.setValueAtTime(0.18,audioCtx.currentTime); g.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.3); o.start(); o.stop(audioCtx.currentTime+0.3);}
  else if(kind==='hurt'){ o.type='sawtooth'; o.frequency.value=120; g.gain.setValueAtTime(0.18,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.25); o.start(); o.stop(audioCtx.currentTime+0.26);}
}

function startReload(){
  if(isReloading || reserve<=0 || ammo===30) return;
  isReloading=true; playSound('reload');
  centerMsg.textContent='RELOADING'; centerMsg.style.opacity=1;
  reloadTimer=1.05;
}
function finishReload(){
  const need=30-ammo; const take=Math.min(need,reserve); ammo+=take; reserve-=take; isReloading=false; centerMsg.style.opacity=0; updateHUD();
}

// Shooting
const raycaster=new THREE.Raycaster();
let lastShot=0;
const bulletDecals=[]; const tracers=[];
function shoot(){
  if(gameState!=='playing' || isReloading) return;
  const now=performance.now();
  if(now-lastShot < 95) return;
  if(ammo<=0){ playSound('hit'); centerMsg.textContent='RELOAD [R]'; centerMsg.style.opacity=1; setTimeout(()=>centerMsg.style.opacity=0,700); return; }
  lastShot=now; ammo--; updateHUD(); playSound('shoot');
  // recoil
  recoil += ads? 0.18 : 0.34;
  pitch -= 0.008 + Math.random()*0.006;
  yaw += (Math.random()-0.5)*0.006;
  flashTimer=0.06; muzzle.intensity=5; flashMesh.material.opacity=0.95;
  // shell
  spawnShell();
  // spread
  const spread = ads? 0.003 : 0.012;
  const dir=new THREE.Vector3(0,0,-1); dir.applyQuaternion(camera.quaternion);
  dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread; dir.normalize();
  raycaster.set(camera.position, dir);
  const targets=enemies.filter(e=>e.alive).map(e=>e.mesh);
  const hits=raycaster.intersectObjects(targets, true);
  // also intersect world boxes quickly via ray-AABB? We'll use raycast against wrapper meshes collection
  // Build temp meshes list for world: use colliders visualization? For decals we raycast against ground + boxes
  const worldMeshes=[ground, ...Array.from(scene.children).filter(o=> o.isMesh && o!==ground)];
  // Simple: check enemy hit first if distance < world hit
  let closest=null; let isEnemy=false;
  if(hits.length){ closest=hits[0]; isEnemy=true; }
  // world hit
  const worldHits=raycaster.intersectObjects(scene.children, true);
  let worldHit=null;
  for(const h of worldHits){ if(h.object===ground || h.object.parent===ground || h.object.geometry?.type==='BoxGeometry' || h.object.geometry?.type==='CylinderGeometry'){ worldHit=h; break; } }
  // decide
  if(isEnemy && (!worldHit || closest.distance < worldHit.distance)){
    const enemy=enemies.find(e=> e.mesh===closest.object || e.mesh.children.includes(closest.object) || closest.object.parent===e.mesh);
    const targetEnemy = enemy || enemies.find(e=> closest.object.traverseAncestors && false);
    // fallback: find by proximity
    let hitEnemy=null;
    for(const e of enemies){ if(!e.alive) continue; const d=e.mesh.position.distanceTo(closest.point); if(d<1.2) { hitEnemy=e; break; } }
    const eHit = enemy || hitEnemy;
    if(eHit){
      // headshot if hit near top
      const isHead = closest.point.y > eHit.mesh.position.y + 0.55;
      const dmg = isHead? 65 : 34;
      eHit.hp -= dmg;
      spawnHitEffect(closest.point, isHead);
      hitmarker.classList.remove('hidden'); hitmarkerTimer=0.12; playSound('hit');
      const ind=document.getElementById('hit-indicator'); ind.classList.remove('hidden'); ind.textContent = isHead? 'HEADSHOT' : 'HIT'; setTimeout(()=> ind.classList.add('hidden'), 220);
      if(eHit.hp<=0){ eHit.alive=false; eHit.mesh.visible=false; kills++; score+= isHead? 250:100; addKillfeed(isHead? 'HEADSHOT':'ELIMINATED'); if(kills>=12) win(); updateHUD(); }
      // impulse
      eHit.mesh.position.add(dir.clone().multiplyScalar(0.08));
    }
  } else if(worldHit){
    spawnDecal(worldHit.point, worldHit.face.normal);
    spawnImpact(worldHit.point);
  } else {
    // tracer into sky
  }
  spawnTracer(camera.position.clone(), dir.clone().multiplyScalar(90).add(camera.position));
  if(ammo===0 && !isReloading) { centerMsg.textContent='RELOAD [R]'; centerMsg.style.opacity=1; }
}

function spawnDecal(pos, normal){
  const geo=new THREE.CircleGeometry(0.08, 8);
  const mat=new THREE.MeshBasicMaterial({ color:0x1a1a1a, transparent:true, opacity:0.85, side:THREE.DoubleSide });
  const m=new THREE.Mesh(geo, mat); m.position.copy(pos).add(normal.clone().multiplyScalar(0.015));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), normal);
  m.rotation.z=Math.random()*Math.PI;
  scene.add(m); bulletDecals.push({ mesh:m, t:0 });
  // also small crater dark
  if(bulletDecals.length>80){ const old=bulletDecals.shift(); scene.remove(old.mesh); }
}
function spawnImpact(pos){
  const p=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,6), new THREE.MeshBasicMaterial({ color:0x8a8a8a, transparent:true, opacity:0.6 }));
  p.position.copy(pos); scene.add(p);
  let t=0; const anim=()=>{ t+=0.016; p.scale.setScalar(1+t*3); p.material.opacity=0.6*(1-t*4); if(t<0.25) requestAnimationFrame(anim); else scene.remove(p); }; anim();
}
function spawnHitEffect(pos, head){
  const c=head?0xff3c00:0xffd54a;
  for(let i=0;i<6;i++){ const s=new THREE.Mesh(new THREE.SphereGeometry(0.03,6,6), new THREE.MeshBasicMaterial({ color:c })); s.position.copy(pos); scene.add(s); const dir=new THREE.Vector3((Math.random()-0.5)*1, Math.random()*0.7, (Math.random()-0.5)*1).normalize(); let life=0; (function tick(){ life+=0.016; s.position.add(dir.clone().multiplyScalar(0.08)); dir.y-=0.04; s.material.opacity=1-life*2.2; if(life<0.45) requestAnimationFrame(tick); else scene.remove(s); })(); }
}
function spawnTracer(from, to){
  const pts=[from.clone(), to.clone()];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({ color:0xffe9a8, transparent:true, opacity:0.85 });
  const line=new THREE.Line(geo, mat); scene.add(line); tracers.push({ line, t:0 });
}
function spawnShell(){
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.03,8), new THREE.MeshStandardMaterial({ color:0xd4b45a, metalness:0.7, roughness:0.35 }));
  const wp=new THREE.Vector3(); weaponGroup.getWorldPosition(wp);
  shell.position.copy(wp).add(new THREE.Vector3(0.18,-0.12,0.1).applyQuaternion(camera.quaternion));
  shell.quaternion.copy(camera.quaternion);
  scene.add(shell);
  const vel=new THREE.Vector3(0.8+Math.random()*0.6, 0.9+Math.random()*0.4, (Math.random()-0.5)*0.8);
  vel.applyQuaternion(camera.quaternion);
  let life=0; (function tick(){ life+=0.016; shell.position.add(vel.clone().multiplyScalar(0.016)); vel.y-=0.32*0.016*9.8; shell.rotation.x+=0.3; shell.rotation.z+=0.2; if(life<1.2 && shell.position.y>0.02) requestAnimationFrame(tick); else scene.remove(shell); })();
}
function spawnGrenade(){
  if(gameState!=='playing') return;
  const g=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,10), new THREE.MeshStandardMaterial({ color:0x4a5a3a }));
  const pos=camera.position.clone(); g.position.copy(pos); scene.add(g);
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion); dir.y+=0.28; dir.normalize().multiplyScalar(13);
  let vel=dir.clone(); vel.y+=2;
  let fuse=1.9; const tick=()=>{
    if(gameState!=='playing' && gameState!=='paused'){ scene.remove(g); return; }
    const dt=0.016; vel.y-=9.8*dt; g.position.add(vel.clone().multiplyScalar(dt));
    if(g.position.y<0.15){ g.position.y=0.15; vel.y*=-0.35; vel.x*=0.6; vel.z*=0.6; }
    fuse-=dt;
    if(fuse<=0){ explode(g.position.clone()); scene.remove(g); } else requestAnimationFrame(tick);
  }; tick();
}
function explode(pos){
  // flash
  const light=new THREE.PointLight(0xff8a00, 8, 18, 1.5); light.position.copy(pos); scene.add(light);
  const exp=new THREE.Mesh(new THREE.SphereGeometry(0.5,16,16), new THREE.MeshBasicMaterial({ color:0xff7a00, transparent:true, opacity:0.85 })); exp.position.copy(pos); scene.add(exp);
  playSound('shoot');
  // damage enemies in radius
  enemies.forEach(e=>{ if(!e.alive) return; const d=e.mesh.position.distanceTo(pos); if(d<7){ e.hp-= Math.round(110*(1-d/7)); if(e.hp<=0){ e.alive=false; e.mesh.visible=false; kills++; score+=150; addKillfeed('EXPLOSION'); updateHUD(); if(kills>=12) win(); } } });
  // camera shake
  const dcam=pos.distanceTo(camera.position); if(dcam<18){ recoil+= 1.2*(1-dcam/18); damageV.style.opacity=0.45; setTimeout(()=>damageV.style.opacity=0,180); }
  let t=0; (function anim(){ t+=0.016; light.intensity=8*(1-t*2.2); exp.scale.setScalar(1+t*4); exp.material.opacity=0.85*(1-t*1.4); if(t<0.72) requestAnimationFrame(anim); else { scene.remove(exp); scene.remove(light);} })();
  // scorch decal
  spawnDecal(pos, new THREE.Vector3(0,1,0));
}

function addKillfeed(txt){
  const el=document.createElement('div'); el.className='kill-item'; el.textContent= txt + '  +'+ (txt==='HEADSHOT'?250:txt==='EXPLOSION'?150:100);
  killfeed.appendChild(el); setTimeout(()=> el.remove(), 2200);
}

// ---------- Collision ----------
function collide(pos, radius=0.45){
  for(const c of colliders){
    const clamped=new THREE.Vector3( Math.max(c.min.x, Math.min(pos.x, c.max.x)), Math.max(c.min.y, Math.min(pos.y, c.max.y)), Math.max(c.min.z, Math.min(pos.z, c.max.z)) );
    if(clamped.distanceTo(pos) < radius) return true;
  }
  // bounds
  if(Math.abs(pos.x)>53 || Math.abs(pos.z)>50) return true;
  return false;
}

// ---------- Minimap ----------
const minimap=document.getElementById('minimap'), mctx=minimap.getContext('2d');
function drawMinimap(){
  const s=140, scale=1.7;
  mctx.clearRect(0,0,s,s);
  mctx.fillStyle='#0d141b'; mctx.fillRect(0,0,s,s);
  // grid
  mctx.strokeStyle='rgba(255,255,255,0.06)'; mctx.lineWidth=1;
  for(let i=0;i<s;i+=14){ mctx.beginPath(); mctx.moveTo(i,0); mctx.lineTo(i,s); mctx.stroke(); mctx.beginPath(); mctx.moveTo(0,i); mctx.lineTo(s,i); mctx.stroke(); }
  // walls/containers
  mctx.fillStyle='rgba(180,190,200,0.9)';
  // cheap: draw colliders projected
  colliders.forEach(c=>{ const cx=(c.min.x+c.max.x)/2, cz=(c.min.z+c.max.z)/2, w=(c.max.x-c.min.x), h=(c.max.z-c.min.z); const x=s/2 + cx*scale, y=s/2 + cz*scale; mctx.fillRect(x-w*scale/2, y-h*scale/2, w*scale, h*scale); });
  // enemies
  enemies.forEach(e=>{ if(!e.alive) return; const x=s/2 + e.mesh.position.x*scale, y=s/2 + e.mesh.position.z*scale; mctx.fillStyle='#ff3c00'; mctx.beginPath(); mctx.arc(x,y,3,0,Math.PI*2); mctx.fill(); });
  // player
  const px=s/2 + playerPos().x*scale, py=s/2 + playerPos().z*scale;
  mctx.fillStyle='#00e5ff'; mctx.beginPath(); mctx.arc(px,py,4,0,Math.PI*2); mctx.fill();
  // dir
  const ang=yaw; mctx.strokeStyle='#00e5ff'; mctx.lineWidth=1.5; mctx.beginPath(); mctx.moveTo(px,py); mctx.lineTo(px+Math.sin(ang)*12, py+Math.cos(ang)*12*-1); mctx.stroke();
}

// ---------- Loop ----------
let last=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(); const dt=Math.min(0.033, (now-last)/1000); last=now;
  if(gameState==='playing'){
    timeLeft=Math.max(0, timeLeft-dt); if(timeLeft<=0){ die(); }
    // movement
    const speed = sprinting? 6.2 : 3.4;
    sprinting = !!keys['ShiftLeft'] && (keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD']);
    const forward=new THREE.Vector3(), right=new THREE.Vector3();
    // yaw only for movement plane
    const yawQuat=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
    forward.set(0,0,-1).applyQuaternion(yawQuat); right.set(1,0,0).applyQuaternion(yawQuat);
    const wish=new THREE.Vector3();
    if(keys['KeyW']) wish.add(forward);
    if(keys['KeyS']) wish.sub(forward);
    if(keys['KeyA']) wish.sub(right);
    if(keys['KeyD']) wish.add(right);
    if(wish.lengthSq()>0){ wish.normalize().multiplyScalar(speed*dt); }
    // gravity simple + keep on ground
    const nextPos=playerPos().clone().add(wish);
    nextPos.y=1.7;
    if(!collide(nextPos)) playerPos().copy(nextPos);
    else {
      const tryX=playerPos().clone(); tryX.x+=wish.x; tryX.y=1.7; if(!collide(tryX)) playerPos().x=tryX.x;
      const tryZ=playerPos().clone(); tryZ.z+=wish.z; tryZ.y=1.7; if(!collide(tryZ)) playerPos().z=tryZ.z;
    }
    // timers
    if(flashTimer>0){ flashTimer-=dt; if(flashTimer<=0){ muzzle.intensity=0; flashMesh.material.opacity=0; } }
    if(hitmarkerTimer>0){ hitmarkerTimer-=dt; if(hitmarkerTimer<=0) hitmarker.classList.add('hidden'); }
    if(isReloading){ reloadTimer-=dt; if(reloadTimer<=0) finishReload(); }
    if(recoil>0){ recoil=Math.max(0, recoil - dt*3.5); weaponGroup.rotation.x = -recoil*0.08; }
    // weapon bob & sway
    const moving = wish.lengthSq()>0.0001;
    const t=now*0.001;
    const bob = moving? (sprinting?0.028:0.014):0;
    weaponGroup.position.x = 0.35 + Math.sin(t* (sprinting?14:9))*bob*0.9 + weaponSway.x*1.2;
    weaponGroup.position.y = -0.28 + Math.abs(Math.sin(t* (sprinting?14:9)))*bob + weaponSway.y*0.9;
    weaponSway.x*=0.92; weaponSway.y*=0.92;
    // ADS lerp
    const targetADSPos = ads? new THREE.Vector3(0.01,-0.18,-0.35) : new THREE.Vector3(0.35,-0.28,-0.55);
    weaponGroup.position.lerp(targetADSPos, dt*9);
    // FOV sprint
    const targetFOV = ads?52 : sprinting?82:74;
    if(Math.abs(camera.fov-targetFOV)>0.1){ camera.fov += (targetFOV-camera.fov)*dt*6; camera.updateProjectionMatrix(); }
    // enemies AI
    // update skinned mixers
    mixers.forEach(m=> m.update(dt));
    enemies.forEach(e=>{
      if(!e.alive) return;
      const dpos=e.mesh.position.distanceTo(playerPos());
      // face player if close
      if(dpos < e.detect){
        const dir=new THREE.Vector3().subVectors(playerPos(), e.mesh.position); dir.y=0; dir.normalize();
        // move toward player if far, with collision avoid
        if(dpos>4.5){
          const step=dir.clone().multiplyScalar(1.35*dt);
          const nxt=e.mesh.position.clone().add(step); nxt.y= e.mesh.userData.isSoldier?0:1.02;
          if(!collide(nxt,0.5)) e.mesh.position.copy(nxt);
          if(e.mixer && e.state!=='run'){ e.mixer.stopAllAction(); const clip=soldierAnims.find(a=> a.name.includes('run'))||soldierAnims.find(a=> a.name.includes('walk'))||soldierAnims[0]; e.mixer.clipAction(clip).play(); e.state='run';}
        } else {
          if(e.mixer && e.state!=='idle'){ e.mixer.stopAllAction(); const clip=soldierAnims.find(a=> a.name.includes('idle'))||soldierAnims[0]; e.mixer.clipAction(clip).play(); e.state='idle';}
        }
        // look
        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        // shoot
        if(dpos<26 && now - e.lastShot > e.shootCooldown){
          e.lastShot=now; e.shootCooldown= 700 + Math.random()*700;
          // enemy tracer toward player
          const eDir=new THREE.Vector3().subVectors(playerPos(), e.mesh.position.clone().add(new THREE.Vector3(0,0.9,0))).normalize();
          // hit chance
          if(Math.random()<0.42){
            const dmg = 8 + Math.random()*14;
            if(armor>0){ const aAbs=Math.min(armor, dmg*0.55); armor-=aAbs; health-= (dmg-aAbs); } else health-=dmg;
            playSound('hurt');
            damageV.style.opacity= Math.min(0.65, 0.22 + (100-health)/140);
            setTimeout(()=> damageV.style.opacity=0, 140);
            updateHUD();
            if(health<=0) die();
          }
          spawnTracer(e.mesh.position.clone().add(new THREE.Vector3(0,0.95,0)), e.mesh.position.clone().add(eDir.clone().multiplyScalar(20)));
        }
      } else {
        // patrol wander
        if(Math.random()<0.008){ const ang=Math.random()*Math.PI*2; const step=new THREE.Vector3(Math.cos(ang),0,Math.sin(ang)).multiplyScalar(0.6); const nxt=e.mesh.position.clone().add(step); nxt.y=1.02; if(!collide(nxt,0.5)) e.mesh.position.copy(nxt); }
      }
      // bob
      e.mesh.position.y = 1.02 + Math.sin(now*0.003 + e.mesh.position.x)*0.03;
    });
    // tracers/decals lifetime
    tracers.forEach((tr,i)=>{ tr.t+=dt; tr.line.material.opacity=0.85*(1-tr.t*6); if(tr.t>0.14){ scene.remove(tr.line); tracers.splice(i,1); }});
    updateHUD();
    drawMinimap();
  }
  // filmic grain anim
  filmPass.uniforms.time.value = now * 0.001;
  // dynamic bloom: push when firing / exploding so flash blooms hard like BO6
  bloomPass.strength = 0.38 + flashTimer * 3.2;
  composer.render();
}
animate();

addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); composer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
});

// Expose for verifier
window.__game = { scene, camera, renderer, composer, enemies, get health(){return health}, get kills(){return kills}, get state(){return gameState} };

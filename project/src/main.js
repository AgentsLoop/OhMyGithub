import * as THREE from 'three';
import './style.css';
import {
  CONFIG, clamp, lerp, throttleToSpeed, updateHealth, addScore,
  canFireGun, canFireMissile, computeLockProgress, isLocked, findLockTarget, checkBulletHit, evaluateMissionState, flightUpdate, createWaves
} from './game/logic.js';

// --- DOM ---
const canvasWrap = document.getElementById('canvasWrap');
const uiWave = document.getElementById('uiWave');
const uiScore = document.getElementById('uiScore');
const uiTime = document.getElementById('uiTime');
const uiSpeed = document.getElementById('uiSpeed');
const uiAlt = document.getElementById('uiAlt');
const uiThrottlePct = document.getElementById('uiThrottlePct');
const barSpeed = document.getElementById('barSpeed');
const barAlt = document.getElementById('barAlt');
const barLock = document.getElementById('barLock');
const uiLockText = document.getElementById('uiLockText');
const uiLockName = document.getElementById('uiLockName');
const uiLockHint = document.getElementById('uiLockHint');
const uiHealth = document.getElementById('uiHealth');
const barHealth = document.getElementById('barHealth');
const uiWarn = document.getElementById('uiWarn');
const uiAmmo = document.getElementById('uiAmmo');
const uiGun = document.getElementById('uiGun');
const uiKills = document.getElementById('uiKills');
const uiObjective = document.getElementById('uiObjective');
const uiObjSub = document.getElementById('uiObjSub');
const uiWaveDots = document.getElementById('uiWaveDots');
const reticle = document.getElementById('reticle');
const reticleLabel = document.getElementById('reticleLabel');
const hitFlash = document.getElementById('hitFlash');
const toast = document.getElementById('toast');
const overlayStart = document.getElementById('overlayStart');
const overlayEnd = document.getElementById('overlayEnd');
const endTitle = document.getElementById('endTitle');
const endSub = document.getElementById('endSub');
const endBadge = document.getElementById('endBadge');
const endScore = document.getElementById('endScore');
const endKills = document.getElementById('endKills');
const endTime = document.getElementById('endTime');
const endAcc = document.getElementById('endAcc');
const statBest = document.getElementById('statBest');

// --- THREE setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a1e3a, 0.00014);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasWrap.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(74, canvasWrap.clientWidth/canvasWrap.clientHeight, 0.1, 22000);
const cameraTarget = new THREE.Vector3();

// lights
scene.add(new THREE.HemisphereLight(0x8fbfff, 0x0a1a2e, 0.85));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(1200, 1800, -900);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 6000;
sun.shadow.camera.left = -2500; sun.shadow.camera.right = 2500; sun.shadow.camera.top = 2500; sun.shadow.camera.bottom = -2500;
sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x8ec8ff, 0.55); fill.position.set(-800, 900, 1200); scene.add(fill);

// sky dome
{
  const geo = new THREE.SphereGeometry(12000, 32, 32);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor:{value:new THREE.Color(0x2a6bd8)},
      bottomColor:{value:new THREE.Color(0x88c8ff)},
      offset:{value: 600}, exponent:{value: 1.15}
    },
    vertexShader:`varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`uniform vec3 topColor,bottomColor; uniform float offset,exponent; varying vec3 vWorld; void main(){
      float h=normalize(vWorld).y; float t= pow(max(0.0, (h+0.35)), exponent);
      vec3 c=mix(bottomColor, topColor, clamp(t,0.0,1.0));
      // sun haze
      float sunHaze = pow(max(0.0, dot(normalize(vWorld), normalize(vec3(0.5,0.6,-0.4)))), 18.0)*0.55;
      c+= vec3(1.0,0.9,0.75)*sunHaze;
      gl_FragColor=vec4(c,1.0);
    }`
  });
  const sky = new THREE.Mesh(geo, mat); scene.add(sky);
}

// ocean + islands
let ocean, terrain;
{
  const oceanGeo = new THREE.PlaneGeometry(14000,14000, 80,80);
  // slight waves via vertex displacement in JS bake
  const pos = oceanGeo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i);
    const d=Math.hypot(x,y);
    const z=Math.sin(x*0.0009)*12 + Math.cos(y*0.0007)*10 + (Math.random()-0.5)*2;
    pos.setZ(i, z);
  }
  oceanGeo.computeVertexNormals();
  const oceanMat = new THREE.MeshStandardMaterial({ color:0x0e3a62, roughness:0.28, metalness:0.22, envMapIntensity:0.7 });
  ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI/2;
  ocean.position.y = 0;
  ocean.receiveShadow = true;
  scene.add(ocean);

  // island archipelago using low poly clusters
  const islandGroup = new THREE.Group();
  const islandMat = new THREE.MeshStandardMaterial({ color:0x1a2f1a, roughness:0.9 });
  const sandMat = new THREE.MeshStandardMaterial({ color:0xccb98a, roughness:0.8 });
  function island(x,z, s){
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.ConeGeometry(420*s, 120*s, 7), islandMat); m1.position.y=60*s; m1.castShadow=true; m1.receiveShadow=true;
    const m2 = new THREE.Mesh(new THREE.CylinderGeometry(520*s, 560*s, 18*s, 10), sandMat); m2.position.y=8*s; m2.receiveShadow=true;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(90*s), new THREE.MeshStandardMaterial({color:0x3a4a3a, roughness:0.85})); rock.position.set(120*s, 40*s, -80*s); rock.scale.set(1,0.6,1);
    g.add(m2,m1,rock); g.position.set(x,0,z); return g;
  }
  islandGroup.add(island(  0, -600, 1.15), island(-1800, 900, 0.95), island(2100, 700, 0.9), island(-900, -2100, 0.8), island(1600, -1800, 1.0), island(0, 2200, 0.7));
  scene.add(islandGroup);
  terrain = islandGroup;

  // far haze mountains rim
  const rimGeo = new THREE.RingGeometry(6200, 7500, 64);
  const rimMat = new THREE.MeshBasicMaterial({ color:0x0e2a52, transparent:true, opacity:0.55, side:THREE.DoubleSide });
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x=Math.PI/2; rim.position.y=2; scene.add(rim);
}

// clouds
const cloudGroup = new THREE.Group();
{
  const cloudMat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.9, transparent:true, opacity:0.88 });
  for(let i=0;i<28;i++){
    const cl = new THREE.Group();
    const n = 3 + Math.floor(Math.random()*4);
    for(let j=0;j<n;j++){
      const sph = new THREE.Mesh(new THREE.SphereGeometry(70+Math.random()*80, 10,8), cloudMat);
      sph.position.set((Math.random()-0.5)*220, (Math.random()-0.5)*30, (Math.random()-0.5)*220);
      sph.scale.set(1,0.55,1);
      cl.add(sph);
    }
    const r = 800 + Math.random()*4600;
    const a = Math.random()*Math.PI*2;
    cl.position.set(Math.cos(a)*r, 420 + Math.random()*900, Math.sin(a)*r);
    cl.userData.drift = (Math.random()-0.5)*6;
    cloudGroup.add(cl);
  }
  scene.add(cloudGroup);
}

// speed lines particle field
let speedLines;
{
  const count=420;
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  for(let i=0;i<count;i++){ pos[i*3]= (Math.random()-0.5)*3200; pos[i*3+1]= 80+Math.random()*1600; pos[i*3+2]=(Math.random()-0.5)*3200; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const mat=new THREE.PointsMaterial({ color:0xffffff, size:1.8, transparent:true, opacity:0.0, sizeAttenuation:true, blending:THREE.AdditiveBlending });
  speedLines=new THREE.Points(geo,mat); scene.add(speedLines);
}

// --- Aircraft factory ---
function createFighterMesh(isPlayer=false){
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: isPlayer?0xd9e8ff:0xffd0c0, roughness:0.45, metalness:0.22 });
  const darkMat = new THREE.MeshStandardMaterial({ color:0x0e1a33, roughness:0.6, metalness:0.15 });
  const canoMat = new THREE.MeshStandardMaterial({ color: isPlayer?0x7ec8ff:0xffb080, roughness:0.2, metalness:0.55, transparent:true, opacity:0.92 });
  const accent = isPlayer?0x4fd1ff:0xff4d4d;

  // fuselage
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 78, 12), bodyMat);
  fus.rotation.x = Math.PI/2; fus.position.z = -2; fus.castShadow=true; g.add(fus);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(6, 22, 12), bodyMat); nose.rotation.x=Math.PI/2; nose.position.z= 42; nose.castShadow=true; g.add(nose);
  // cockpit
  const cano = new THREE.Mesh(new THREE.CapsuleGeometry(5.5, 18, 4, 10), canoMat); cano.rotation.x=Math.PI/2; cano.position.set(0,4.2,8); g.add(cano);
  // wings
  const wingShape = new THREE.Shape(); wingShape.moveTo(0,0); wingShape.lineTo(38, -14); wingShape.lineTo(38, -22); wingShape.lineTo(0,-18); wingShape.lineTo(0,0);
  const wingExtrude = new THREE.ExtrudeGeometry(wingShape, { depth:1.2, bevelEnabled:false });
  const wingL = new THREE.Mesh(wingExtrude, bodyMat); wingL.rotation.x=Math.PI/2; wingL.rotation.z=Math.PI; wingL.position.set(6,0,4); wingL.castShadow=true; g.add(wingL);
  const wingR = wingL.clone(); wingR.position.set(-6,0,4); wingR.rotation.z=0; wingR.scale.x=-1; // mirror via clone scale tricky; rebuild
  // rebuild right wing properly
  g.remove(wingR);
  const wingShapeR = new THREE.Shape(); wingShapeR.moveTo(0,0); wingShapeR.lineTo(-38, -14); wingShapeR.lineTo(-38,-22); wingShapeR.lineTo(0,-18); wingShapeR.lineTo(0,0);
  const wingR2 = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShapeR,{depth:1.2,bevelEnabled:false}), bodyMat); wingR2.rotation.x=Math.PI/2; wingR2.position.set(-6,0,4); wingR2.castShadow=true; g.add(wingR2);

  // tail
  const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.9, 14, 12), darkMat); tailV.position.set(0,7,-30); tailV.rotation.x=0.22; tailV.castShadow=true; g.add(tailV);
  const tailH1 = new THREE.Mesh(new THREE.BoxGeometry(16,0.9,7), bodyMat); tailH1.position.set(8,1.5,-32); tailH1.rotation.y=0.28; g.add(tailH1);
  const tailH2 = tailH1.clone(); tailH2.position.set(-8,1.5,-32); tailH2.rotation.y=-0.28; g.add(tailH2);
  // intakes
  const intakeL = new THREE.Mesh(new THREE.BoxGeometry(4,4,14), darkMat); intakeL.position.set(7,-2,6); g.add(intakeL);
  const intakeR = intakeL.clone(); intakeR.position.set(-7,-2,6); g.add(intakeR);
  // engine glow
  const glow = new THREE.Mesh(new THREE.CircleGeometry(4.2, 12), new THREE.MeshBasicMaterial({ color: accent, transparent:true, opacity:0.0, blending:THREE.AdditiveBlending, side:THREE.DoubleSide }));
  glow.rotation.x=Math.PI/2; glow.rotation.y=Math.PI; glow.position.set(0,0,-40.5);
  g.add(glow);
  g.userData.glow = glow;
  // insignia
  const dot = new THREE.Mesh(new THREE.CircleGeometry(2.2,10), new THREE.MeshBasicMaterial({ color: accent })); dot.rotation.x=-Math.PI/2; dot.position.set(0,0.21,10); g.add(dot);
  // shadow helper
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false; }});
  return g;
}

const playerMesh = createFighterMesh(true);
playerMesh.scale.set(1.15,1.15,1.15);
scene.add(playerMesh);

// shadow projection blob under player (cheap)
const shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(28, 20), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.22 }));
shadowBlob.rotation.x = -Math.PI/2; scene.add(shadowBlob);

// enemies container
let enemies = []; // {id, mesh, pos:THREE.Vector3, vel:THREE.Vector3, hp, alive, aiPhase}
let bullets = []; // {mesh,pos,vel,life}
let missiles = []; // {mesh,pos,vel,targetId,life}
let particles = []; // {mesh,vel,life,scale}
let explosions = []; // {light,mesh,time}

// game state
let flightState = {
  pitch:0, roll:0, yaw:0, throttle:62, speed: 155,
  pos: new THREE.Vector3(0, 520, 900),
  vel: new THREE.Vector3(0,0,0)
};
let health = CONFIG.playerHP;
let score = 0;
let kills = 0;
let totalEnemies = 7;
let waveIdx = 0;
let waves = createWaves(totalEnemies);
let lockProgress = 0;
let lockedTarget = null;
let lastGun = -9, lastMissile = -9;
let ammo = CONFIG.missileAmmo;
let gunHeat = 0;
let elapsed = 0;
let state = 'menu'; // menu, playing, paused, won, lost, crashed
let keys = {};
let bestScore = parseInt(localStorage.getItem('skystrike-best')||'0',10);
if(statBest) statBest.textContent = bestScore ? bestScore.toLocaleString() : '—';

// input
addEventListener('keydown', e=>{
  const k = e.key.toLowerCase();
  keys[k]=true;
  if(k===' '){ e.preventDefault(); tryFireMissile(); }
  if(k==='enter'){ tryFireGun(true); }
  if(k==='r'){ restartMission(); }
  if(k==='p'){ togglePause(); }
  if(k==='h'){ document.getElementById('helpCard').classList.toggle('hidden'); }
});
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
addEventListener('mousedown', e=>{
  if(state!=='playing') return;
  if(e.button===0) tryFireGun(true);
});
addEventListener('contextmenu', e=> e.preventDefault());

// buttons
document.getElementById('btnPlay').onclick = ()=> startMission();
document.getElementById('btnHow').onclick = ()=> document.getElementById('helpCard').scrollIntoView({behavior:'smooth',block:'center'});
document.getElementById('btnRestart').onclick = ()=> restartMission();
document.getElementById('btnPause').onclick = ()=> togglePause();
document.getElementById('btnHelp').onclick = ()=> document.getElementById('helpCard').classList.toggle('hidden');
document.getElementById('btnReplay').onclick = ()=> restartMission();
document.getElementById('btnCloseEnd').onclick = ()=> { overlayEnd.classList.add('hidden'); };

// helpers
function showToast(msg){
  toast.textContent = msg; toast.classList.remove('hidden');
  clearTimeout(showToast._t); showToast._t=setTimeout(()=> toast.classList.add('hidden'), 1200);
}
function flashHit(){
  hitFlash.classList.remove('flash'); void hitFlash.offsetWidth; hitFlash.classList.add('flash');
}
function spawnExplosion(pos, scale=1, color=0xff6a3d){
  const g = new THREE.Group(); g.position.copy(pos);
  const core = new THREE.Mesh(new THREE.SphereGeometry(6*scale, 12,12), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending }));
  const fire = new THREE.Mesh(new THREE.SphereGeometry(14*scale, 14,12), new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(8*scale, 18*scale, 20), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }));
  ring.rotation.x=Math.PI/2;
  g.add(core,fire,ring);
  scene.add(g);
  const light = new THREE.PointLight(color, 18, 900); light.position.copy(pos); scene.add(light);
  explosions.push({ group:g, light, t:0, max:0.65 });
  // debris particles
  for(let i=0;i<10;i++){
    const p = new THREE.Mesh(new THREE.SphereGeometry(1.2+Math.random()*2.2,6,6), new THREE.MeshBasicMaterial({ color: Math.random()<0.5?0xff8a3d:0x4fd1ff, transparent:true, opacity:0.9 }));
    p.position.copy(pos);
    const v = new THREE.Vector3((Math.random()-0.5)*260, Math.random()*180+20, (Math.random()-0.5)*260);
    particles.push({ mesh:p, vel:v, life:0.6+Math.random()*0.5, age:0 });
    scene.add(p);
  }
}
function spawnTracer(from, dir){
  const geo = new THREE.CylinderGeometry(0.9,0.9,22,6);
  const mat = new THREE.MeshBasicMaterial({ color:0xfff2a0, blending:THREE.AdditiveBlending, transparent:true, opacity:0.95 });
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
  const vel = dir.clone().normalize().multiplyScalar(CONFIG.bulletSpeed);
  bullets.push({ mesh:m, vel, life:1.2 });
  scene.add(m);
  // muzzle flash
  const flash = new THREE.Mesh(new THREE.SphereGeometry(3.2,8,8), new THREE.MeshBasicMaterial({ color:0xfff7a0, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending }));
  flash.position.copy(from);
  scene.add(flash);
  setTimeout(()=> scene.remove(flash), 60);
}
function spawnMissile(from, target){
  const m = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,18,8), new THREE.MeshStandardMaterial({color:0xeaf0ff, roughness:0.4})); body.rotation.x=Math.PI/2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(1.4,5,8), new THREE.MeshStandardMaterial({color:0xff3b3b})); head.rotation.x=Math.PI/2; head.position.z=11;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(4,0.3,3), new THREE.MeshStandardMaterial({color:0x8ea3c7})); fin.position.set(0,0,-6);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(2,6,8), new THREE.MeshBasicMaterial({color:0xff6a2d, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending })); flame.rotation.x=-Math.PI/2; flame.position.z=-12;
  m.add(body,head,fin,flame);
  m.position.copy(from);
  const dir = target ? new THREE.Vector3().subVectors(target.pos, from).normalize() : new THREE.Vector3(0,0,-1).applyQuaternion(playerMesh.quaternion);
  const vel = dir.multiplyScalar(120); // initial kick, homing adds
  missiles.push({ group:m, pos:m.position, vel, targetId: target?target.id:null, life:6, trailTimer:0 });
  scene.add(m);
  showToast('MSL AWAY — TRACKING');
}

// enemy spawning
function spawnWave(idx){
  if(idx<0 || idx>=waves.length) return;
  const wave = waves[idx];
  const base = flightState.pos.clone(); base.y = 580 + Math.random()*220;
  const center = new THREE.Vector3((Math.random()-0.5)*900, base.y, base.z - 1400 - Math.random()*900);
  const positions=[];
  if(wave.pattern==='line'){
    for(let i=0;i<wave.count;i++) positions.push(new THREE.Vector3(center.x + (i- (wave.count-1)/2)*220, center.y + (Math.random()-0.5)*80, center.z + (Math.random()-0.5)*120));
  } else if(wave.pattern==='vee'){
    positions.push(center.clone());
    for(let i=1;i<wave.count;i++){ const s = i%2?1:-1; positions.push(new THREE.Vector3(center.x + s*240 + (Math.random()-0.5)*60, center.y+ (Math.random()-0.5)*60, center.z - 80 - Math.random()*60)); }
  } else {
    for(let i=0;i<wave.count;i++){ const ang=i/wave.count*Math.PI*2; positions.push(new THREE.Vector3(center.x+ Math.cos(ang)*280, center.y+Math.sin(ang)*60, center.z+Math.sin(ang*1.5)*180)); }
  }
  positions.forEach((p, i)=>{
    const id = 'e_'+Date.now()+'_'+idx+'_'+i;
    const mesh = createFighterMesh(false);
    mesh.position.copy(p);
    mesh.userData.id=id;
    // random tint per enemy
    const hue = 0.02 + Math.random()*0.06;
    mesh.traverse(o=>{ if(o.isMesh && o.material && o.material.color) o.material.color.offsetHSL(hue,0,0); });
    scene.add(mesh);
    enemies.push({ id, mesh, pos:p.clone(), vel:new THREE.Vector3((Math.random()-0.5)*40,0,-110 -Math.random()*40), hp:CONFIG.enemyHP, alive:true, aiT:Math.random()*3 });
  });
}

function clearEnemies(){
  enemies.forEach(e=> scene.remove(e.mesh));
  enemies=[];
}
function updateWaveDots(){
  uiWaveDots.innerHTML='';
  waves.forEach((w,i)=>{
    const el=document.createElement('i');
    if(i<waveIdx) el.className='on';
    else if(i===waveIdx) el.className='active';
    uiWaveDots.appendChild(el);
  });
}

function resetFlight(){
  flightState = { pitch:0, roll:0, yaw:0, throttle:62, speed:155, pos:new THREE.Vector3(0,520,900), vel:new THREE.Vector3(0,0,0) };
  health = CONFIG.playerHP; score=0; kills=0; elapsed=0; lockProgress=0; lockedTarget=null; ammo=CONFIG.missileAmmo; lastGun=-9; lastMissile=-9; gunHeat=0;
  clearEnemies(); bullets.forEach(b=> scene.remove(b.mesh)); bullets=[];
  missiles.forEach(m=> scene.remove(m.group)); missiles=[];
  particles.forEach(p=> scene.remove(p.mesh)); particles=[];
  explosions.forEach(e=> { scene.remove(e.group); scene.remove(e.light); }); explosions=[];
  waveIdx=0; waves=createWaves(totalEnemies); spawnWave(0); updateWaveDots();
}

function startMission(){
  resetFlight(); state='playing'; overlayStart.classList.add('hidden'); overlayEnd.classList.add('hidden');
}
function restartMission(){
  resetFlight(); state='playing'; overlayEnd.classList.add('hidden'); overlayStart.classList.add('hidden');
}
function togglePause(){
  if(state==='playing'){ state='paused'; showToast('PAUSED — PRESS P TO RESUME'); }
  else if(state==='paused'){ state='playing'; showToast('RESUMED'); }
}

function tryFireGun(force=false){
  const now = elapsed;
  if(!canFireGun(lastGun, now)) return;
  if(gunHeat> 95) return;
  lastGun = now; gunHeat = Math.min(100, gunHeat+ 7);
  const fwd = new THREE.Vector3(0,0,1).applyQuaternion(playerMesh.quaternion);
  const left = new THREE.Vector3(-2.2, -1.0, 44).applyMatrix4(playerMesh.matrixWorld);
  const right = new THREE.Vector3(2.2, -1.0, 44).applyMatrix4(playerMesh.matrixWorld);
  // alternate barrels
  const origin = (Math.floor(now*12)%2===0) ? left : right;
  const spread = 0.012; // slight spread
  const dir = fwd.clone(); dir.x += (Math.random()-0.5)*spread; dir.y += (Math.random()-0.5)*spread;
  spawnTracer(origin, dir);
  uiGun.textContent='FIRING'; setTimeout(()=>{ if(state==='playing') uiGun.textContent='READY'; }, 90);
  // camera kick
  cameraKick(0.6);
}
function tryFireMissile(){
  if(state!=='playing') return;
  const now=elapsed;
  const chk=canFireMissile({ ammo, lastFire:lastMissile, now, isLocked: !!lockedTarget && isLocked(lockProgress) });
  if(!chk.ok){
    if(chk.reason==='no_lock') showToast('NO LOCK — HOLD TARGET IN RETICLE');
    else if(chk.reason==='no_ammo') showToast('MSL EMPTY');
    else if(chk.reason==='cooldown') showToast('MSL COOLING');
    return;
  }
  lastMissile = now; ammo = Math.max(0, ammo-1);
  const origin = new THREE.Vector3(0,-3, 18).applyMatrix4(playerMesh.matrixWorld);
  const targetObj = enemies.find(e=> e.id===lockedTarget?.id && e.alive);
  spawnMissile(origin, targetObj);
  lockProgress = 0; // reset after fire
  cameraKick(1.4);
}
function cameraKick(amount){
  camShake = Math.min(6, camShake + amount);
}

// HUD update
function updateHUD(dt){
  const spdKnots = Math.round(flightState.speed * 1.18);
  uiSpeed.textContent = spdKnots.toString().padStart(3,'0');
  uiAlt.textContent = Math.round(flightState.pos.y * 3.1).toString();
  uiThrottlePct.textContent = Math.round(flightState.throttle)+'%';
  barSpeed.style.width = clamp((flightState.speed - CONFIG.minSpeed)/(CONFIG.maxSpeed-CONFIG.minSpeed)*100,0,100)+'%';
  barAlt.style.width = clamp(flightState.pos.y/1200*100,0,100)+'%';
  barHealth.style.width = clamp(health,0,100)+'%';
  uiHealth.textContent = Math.round(health)+'%';
  barHealth.style.background = health>60 ? 'linear-gradient(90deg,#38ffb0,#4fd1ff)' : health>30 ? 'linear-gradient(90deg,#ffcc33,#ff8a3d)' : 'linear-gradient(90deg,#ff3b5c,#ff1a3d)';
  uiWarn.classList.toggle('hidden', !(flightState.speed < CONFIG.stallSpeed*1.05 || flightState.pos.y < 80));
  uiWarn.textContent = flightState.pos.y < 80 ? '⚠ PULL UP' : '⚠ STALL';
  uiScore.textContent = score.toString().padStart(5,'0');
  const remain = Math.max(0, CONFIG.timeLimit - elapsed);
  const mm = String(Math.floor(remain/60)).padStart(2,'0'), ss=String(Math.floor(remain%60)).padStart(2,'0');
  uiTime.textContent = `${mm}:${ss}`;
  uiWave.textContent = `${Math.min(waveIdx+1,waves.length)}/${waves.length}`;
  uiKills.textContent = `${kills}/${totalEnemies}`;
  uiObjSub.textContent = `${kills} / ${totalEnemies} eliminated`;
  uiWaveDots && updateWaveDots();
  // ammo
  uiAmmo.innerHTML='';
  for(let i=0;i<CONFIG.missileAmmo;i++){ const el=document.createElement('i'); if(i>=ammo) el.className='off'; uiAmmo.appendChild(el); }
  // lock
  if(lockedTarget && lockedTarget.alive){
    const locked = isLocked(lockProgress);
    barLock.style.width = Math.round(lockProgress*100)+'%';
    uiLockText.textContent = locked ? 'LOCKED' : `LOCKING ${Math.round(lockProgress*100)}%`;
    uiLockText.style.color = locked ? '#ff4d6a' : '#4fd1ff';
    uiLockName.textContent = locked ? `BANDIT ${lockedTarget.id.slice(-4).toUpperCase()} • TRACK` : `BANDIT ${lockedTarget.id.slice(-4).toUpperCase()}`;
    uiLockHint.textContent = locked ? 'PRESS SPACE TO FIRE MSL' : 'KEEP IN RETICLE TO LOCK';
    reticle.classList.toggle('locked', locked);
    reticleLabel.textContent = locked ? '● LOCKED — FIRE' : '◯ LOCKING';
    reticleLabel.style.color = locked ? '#ff4d6a' : '#4fd1ff';
    if(locked && Math.floor(elapsed*6)%6===0){ /* subtle pulse could be added */ }
  } else {
    barLock.style.width='0%';
    uiLockText.textContent='SEARCH';
    uiLockText.style.color='#8ea3c7';
    uiLockName.textContent='NO TARGET';
    uiLockHint.textContent='KEEP TARGET IN RETICLE';
    reticle.classList.remove('locked');
    reticleLabel.textContent='GUNS READY';
    reticleLabel.style.color='#4fd1ff';
  }
  // gun heat to UI
  if(gunHeat>0){
    uiGun.textContent = gunHeat>85 ? 'HOT' : gunHeat>50 ? 'WARM' : 'READY';
    uiGun.style.color = gunHeat>85 ? '#ff4d6a' : gunHeat>50 ? '#ffcc33' : '#eaf0ff';
  }
}

// camera control
let camShake=0;
let camPos = new THREE.Vector3();
let camLook = new THREE.Vector3();

function updateCamera(dt){
  const fwd = new THREE.Vector3(0,0,1).applyQuaternion(playerMesh.quaternion);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(playerMesh.quaternion);
  // chase offset behind + slightly above, adjusts with speed and roll
  const speedFactor = clamp((flightState.speed - 80)/300,0,1);
  const dist = lerp(76, 108, speedFactor);
  const height = lerp(16, 20, speedFactor);
  const chase = flightState.pos.clone().addScaledVector(fwd, -dist).addScaledVector(up, height);
  // roll influence — camera banks a bit
  chase.addScaledVector(new THREE.Vector3(1,0,0).applyQuaternion(playerMesh.quaternion), flightState.roll*0.08);
  camPos.lerp(chase, 1 - Math.pow(0.0008, dt*60)); // damped
  if(camShake>0){
    camShake = Math.max(0, camShake - dt*8);
    camPos.x += (Math.random()-0.5)*camShake;
    camPos.y += (Math.random()-0.5)*camShake;
    camPos.z += (Math.random()-0.5)*camShake;
  }
  camera.position.copy(camPos);
  const lookAt = flightState.pos.clone().addScaledVector(fwd, 220).addScaledVector(up, 6);
  camLook.lerp(lookAt, 1 - Math.pow(0.001, dt*60));
  camera.lookAt(camLook);
  // FOV kick
  camera.fov = lerp(74, 78.5, speedFactor) + Math.sin(elapsed*9)*0.07* (speedFactor>0.6?1:0);
  camera.updateProjectionMatrix();

  // shadow blob projection onto ocean y=0
  shadowBlob.position.set(flightState.pos.x, 0.3, flightState.pos.z);
  const altFactor = clamp(1 - flightState.pos.y/1200, 0, 1);
  shadowBlob.material.opacity = 0.22 * altFactor;
  shadowBlob.scale.setScalar(1 + flightState.pos.y*0.0012);

  // engine glow intensity
  const glow = playerMesh.userData.glow;
  if(glow){
    glow.material.opacity = clamp(flightState.throttle/100*0.75 + speedFactor*0.22, 0, 0.92);
    glow.scale.setScalar(1 + speedFactor*0.3);
  }
  // speed lines opacity
  if(speedLines){
    speedLines.material.opacity = clamp(speedFactor*0.11, 0, 0.11);
    const arr = speedLines.geometry.attributes.position.array;
    for(let i=0;i<arr.length;i+=3){
      arr[i+2] += flightState.speed * dt * 0.9; // move towards camera? simple drift
      if(arr[i+2] > 1600){ arr[i+2] = -1600; arr[i]= (Math.random()-0.5)*3200; arr[i+1]=80+Math.random()*1600; }
    }
    speedLines.geometry.attributes.position.needsUpdate = true;
    speedLines.position.copy(flightState.pos);
    // keep around player
  }
}

// game logic update
function updateEnemies(dt){
  enemies.forEach(e=>{
    if(!e.alive) return;
    e.aiT += dt;
    // simple pursuit: steer toward player with lead, plus strafe
    const toPlayer = new THREE.Vector3().subVectors(flightState.pos, e.pos);
    const dist = toPlayer.length();
    const desiredDir = toPlayer.clone().normalize();
    // add evasive wobble when close
    if(dist < 520){
      desiredDir.x += Math.sin(e.aiT*1.7)*0.22;
      desiredDir.y += Math.cos(e.aiT*1.3)*0.14;
    }
    // bank towards desired
    const targetVel = desiredDir.multiplyScalar( lerp(160, 210, Math.random()*0.15) );
    e.vel.lerp(targetVel, dt*0.9);
    // occasional vertical bob
    e.vel.y += Math.sin(e.aiT*0.9 + e.pos.x*0.001)* 8 * dt;
    e.pos.addScaledVector(e.vel, dt);
    e.pos.y = clamp(e.pos.y, 60, 1700);
    e.mesh.position.copy(e.pos);
    // orientation: look along vel, with banking
    if(e.vel.length()>10){
      const look = e.pos.clone().add(e.vel);
      e.mesh.lookAt(look);
      e.mesh.rotateX(Math.PI/2);
      // banking visual
      const bank = clamp(e.vel.x*0.002, -0.9, 0.9);
      e.mesh.rotation.z += bank; // after lookAt this mixes but okay
    }
    // enemy guns: occasional tracer if in cone
    if(dist < 700 && dist > 80 && Math.random() < 0.012 && state==='playing'){
      const dir = new THREE.Vector3().subVectors(flightState.pos, e.pos).normalize();
      dir.x += (Math.random()-0.5)*0.04; dir.y+=(Math.random()-0.5)*0.04;
      const geo = new THREE.CylinderGeometry(0.7,0.7,18,5);
      const mat = new THREE.MeshBasicMaterial({ color:0xff6b6b, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(e.pos);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
      m.quaternion.copy(q);
      const vel = dir.multiplyScalar(780);
      bullets.push({ mesh:m, vel, life:1.4, isEnemy:true });
      scene.add(m);
    }
  });
}

function updateProjectiles(dt){
  // bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    // check hits
    if(b.isEnemy){
      if(b.mesh.position.distanceTo(flightState.pos) < 18){
        health = updateHealth(health, 7);
        spawnExplosion(b.mesh.position.clone(), 0.45, 0xff3b2f);
        flashHit(); cameraKick(2.1);
        scene.remove(b.mesh); bullets.splice(i,1); continue;
      }
    } else {
      // vs enemies
      for(const e of enemies){
        if(!e.alive) continue;
        if(b.mesh.position.distanceTo(e.pos) < CONFIG.hitRadius){
          e.hp -= CONFIG.gunDamage;
          score = addScore(score,'hit');
          // hit flash
          const hf = new THREE.Mesh(new THREE.SphereGeometry(4,6,6), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.8, blending:THREE.AdditiveBlending}));
          hf.position.copy(e.pos); scene.add(hf); setTimeout(()=> scene.remove(hf), 80);
          if(e.hp<=0){
            e.alive=false; scene.remove(e.mesh); kills++; score=addScore(score,'kill'); spawnExplosion(e.pos.clone(), 1.1); cameraKick(2.8);
            showToast('SPLASH ONE — BANDIT DOWN');
          } else {
            // spark
            spawnExplosion(b.mesh.position.clone(), 0.28, 0xffcc33);
          }
          scene.remove(b.mesh); bullets.splice(i,1); // remove bullet
          flashHit();
          break;
        }
      }
      if(bullets[i]!==b) continue; // already removed
    }
    if(b.life<=0){ scene.remove(b.mesh); bullets.splice(i,1); }
    // remove if far from player
    if(b.mesh.position.distanceTo(flightState.pos) > 3200){ scene.remove(b.mesh); bullets.splice(i,1); }
  }
  // missiles
  for(let i=missiles.length-1;i>=0;i--){
    const m = missiles[i];
    let target = null;
    if(m.targetId) target = enemies.find(e=> e.id===m.targetId && e.alive);
    if(target){
      const to = new THREE.Vector3().subVectors(target.pos, m.group.position);
      const desired = to.normalize();
      const curDir = m.vel.clone().normalize();
      curDir.lerp(desired, dt*2.6); // homing
      const speed = lerp(m.vel.length(), CONFIG.missileSpeed, dt*1.4);
      m.vel.copy(curDir.multiplyScalar(speed));
      // look
      const look = m.group.position.clone().add(m.vel);
      m.group.lookAt(look); m.group.rotateX(Math.PI/2);
    } else {
      // no target: continue straight with slight drop
      m.vel.y -= 18*dt;
    }
    m.group.position.addScaledVector(m.vel, dt);
    m.life -= dt;
    // smoke trail
    m.trailTimer -= dt;
    if(m.trailTimer<=0){
      m.trailTimer=0.04;
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.9+Math.random()*1.2,6,6), new THREE.MeshBasicMaterial({ color:0x9aa8c0, transparent:true, opacity:0.42 }));
      s.position.copy(m.group.position); scene.add(s);
      particles.push({ mesh:s, vel:new THREE.Vector3((Math.random()-0.5)*8, (Math.random()-0.5)*8, (Math.random()-0.5)*8), life:0.7, age:0 });
    }
    // check hit
    const hitTarget = target;
    if(hitTarget && m.group.position.distanceTo(hitTarget.pos) < 32){
      hitTarget.hp -= CONFIG.missileDamage;
      score = addScore(score,'missile_hit');
      if(hitTarget.hp<=0){ hitTarget.alive=false; scene.remove(hitTarget.mesh); kills++; score=addScore(score,'kill'); }
      spawnExplosion(hitTarget.pos.clone(), 1.35, 0xff5a2d);
      cameraKick(3.5); flashHit(); showToast(hitTarget.alive ? 'HIT — BANDIT DAMAGED' : 'SPLASH — MSL KILL');
      scene.remove(m.group); missiles.splice(i,1); continue;
    }
    // hit terrain/ocean
    if(m.group.position.y < 4){
      spawnExplosion(m.group.position.clone(), 0.9, 0xff7a3d); scene.remove(m.group); missiles.splice(i,1); continue;
    }
    if(m.life<=0){ spawnExplosion(m.group.position.clone(),0.7); scene.remove(m.group); missiles.splice(i,1); }
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.age+=dt; p.life-=dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 22*dt; // gravity for debris
    p.mesh.material.opacity = clamp(p.life/0.7,0,0.9);
    p.mesh.scale.setScalar(1 + p.age*0.6);
    if(p.life<=0){ scene.remove(p.mesh); particles.splice(i,1); }
  }
  for(let i=explosions.length-1;i>=0;i--){
    const e=explosions[i]; e.t+=dt;
    const t=e.t/e.max;
    e.group.scale.setScalar(1 + t*2.2);
    e.group.children.forEach((c,idx)=>{ if(c.material) c.material.opacity = (1-t)* (idx===0?0.95:0.55); });
    e.light.intensity = (1-t)*14;
    if(e.t>=e.max){ scene.remove(e.group); scene.remove(e.light); explosions.splice(i,1); }
  }
}

// main loop
let last = performance.now();
let rafId;
function tick(){
  rafId = requestAnimationFrame(tick);
  const now = performance.now(); let dt = (now-last)/1000; last=now;
  dt = Math.min(dt, 0.033); // cap

  // handle input -> flight inputs
  if(state==='playing'){
    elapsed += dt;
    // controls mapping
    let pitchIn = 0, rollIn=0, yawIn=0, thDelta=0;
    if(keys['w']||keys['arrowup']) pitchIn -=1;
    if(keys['s']||keys['arrowdown']) pitchIn +=1;
    if(keys['a']||keys['arrowleft']) rollIn -=1;
    if(keys['d']||keys['arrowright']) rollIn +=1;
    if(keys['q']) yawIn -=1;
    if(keys['e']) yawIn +=1;
    if(keys['shift']) thDelta +=1;
    if(keys['control']) thDelta -=1;
    // mouse steering alternative: hold mouse to pitch/roll? we keep keyboard primary
    // auto throttle jitter when stall
    const newState = flightUpdate({
      pitch: flightState.pitch, roll: flightState.roll, yaw: flightState.yaw,
      throttle: flightState.throttle, speed: flightState.speed,
      pos: { x:flightState.pos.x, y:flightState.pos.y, z:flightState.pos.z },
      vel: { x:flightState.vel.x, y:flightState.vel.y, z:flightState.vel.z }
    }, { pitch: pitchIn, roll: rollIn, yaw: yawIn, throttleDelta: thDelta }, dt);
    flightState.pitch=newState.pitch; flightState.roll=newState.roll; flightState.yaw=newState.yaw;
    flightState.throttle=newState.throttle; flightState.speed=newState.speed;
    flightState.pos.set(newState.pos.x, newState.pos.y, newState.pos.z);
    flightState.vel.set(newState.vel.x, newState.vel.y, newState.vel.z);

    // update player mesh transform
    playerMesh.position.copy(flightState.pos);
    // quaternion from Euler (order YXZ maybe): use yaw, pitch, roll
    const euler = new THREE.Euler( THREE.MathUtils.degToRad(flightState.pitch), THREE.MathUtils.degToRad(flightState.yaw), THREE.MathUtils.degToRad(flightState.roll), 'YXZ');
    playerMesh.quaternion.setFromEuler(euler);

    // gun heat cool
    gunHeat = Math.max(0, gunHeat - dt*28);
    // auto guns when holding? we do single per click plus continuous if mouse held? simple: if mouse held, auto fire handled via canFire check every frame if mouse down flag not tracked here; we fire on click only for now plus allow holding Space? guns need hold: check if mouse down via keys? simpler: check if ' ' ??? We'll allow holding mouse via checking if left button held? Instead check if keys['mouse']? Let's use interval: if left mouse held, fire
    // not implementing hold to avoid spam; user can spam click

    // targeting
    const aliveEnemies = enemies.filter(e=>e.alive).map(e=> ({ id:e.id, pos:{x:e.pos.x,y:e.pos.y,z:e.pos.z}, alive:e.alive }));
    const fwdVec = new THREE.Vector3(0,0,1).applyQuaternion(playerMesh.quaternion);
    const found = findLockTarget(aliveEnemies, {x:flightState.pos.x,y:flightState.pos.y,z:flightState.pos.z}, {x:fwdVec.x,y:fwdVec.y,z:fwdVec.z}, CONFIG.lockDistance, CONFIG.lockAngleDeg);
    const hasTarget = !!found;
    // map found to actual enemy object for lock
    let currentLockObj = null;
    if(found) currentLockObj = enemies.find(e=> e.id===found.id) || null;
    // if target changed, reset progress partially
    if(currentLockObj && lockedTarget && currentLockObj.id !== lockedTarget.id){
      lockProgress = Math.max(0, lockProgress - 0.35);
    }
    lockedTarget = currentLockObj;
    lockProgress = computeLockProgress(lockProgress, dt, hasTarget, CONFIG.lockTime);

    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);

    // wave progression
    const aliveCount = enemies.filter(e=>e.alive).length;
    if(aliveCount===0){
      if(waveIdx < waves.length-1){
        waveIdx++; spawnWave(waveIdx); showToast(`WAVE ${waveIdx+1} INBOUND`);
      }
    }

    // mission evaluation
    const totalAlive = enemies.filter(e=>e.alive).length;
    const total = totalEnemies;
    // but waves spawn gradually, so check overall kills
    const missionResult = evaluateMissionState({ enemiesAlive: totalAlive, totalEnemies: (waveIdx===waves.length-1 && totalAlive===0 ? total : total), playerHealth: health, altitude: flightState.pos.y, elapsed, timeLimit: CONFIG.timeLimit });
    // we treat win only when all waves cleared and kills==total
    if(kills >= totalEnemies){
      state='won'; showEnd(true);
    } else if(missionResult==='lost' || missionResult==='crashed'){
      state = missionResult==='crashed' ? 'crashed' : 'lost';
      showEnd(false);
    }

    // HUD
    updateHUD(dt);
  } else {
    // even when not playing, still update time hud for menu?
    updateHUD(dt);
  }

  // clouds drift
  cloudGroup.children.forEach(c=>{
    c.position.x += c.userData.drift * dt;
    c.position.z += Math.sin(elapsed*0.06 + c.position.x*0.0001)* 4 * dt;
  });

  updateCamera(dt);
  renderer.render(scene, camera);
}

function showEnd(won){
  const isCrash = state==='crashed';
  endTitle.textContent = won ? 'MISSION COMPLETE' : isCrash ? 'MIA — CRASH' : 'MISSION FAILED';
  endSub.textContent = won ? 'All bandits splashed. Outstanding flying, Ace.' : isCrash ? 'You went below minimum altitude and hit the deck.' : 'Bandits remain or time expired. Try again, Ace.';
  endBadge.textContent = won ? 'VICTORY' : isCrash ? 'CRASH' : 'DEFEAT';
  endBadge.style.background = won ? 'rgba(56,255,176,.18)' : 'rgba(255,77,106,.18)';
  endBadge.style.color = won ? '#38ffb0' : '#ff4d6a';
  endScore.textContent = score.toLocaleString();
  endKills.textContent = `${kills}/${totalEnemies}`;
  const rem = Math.max(0, CONFIG.timeLimit - elapsed);
  const mm=String(Math.floor(rem/60)).padStart(2,'0'), ss=String(Math.floor(rem%60)).padStart(2,'0');
  endTime.textContent = `${mm}:${ss} LEFT`;
  endAcc.textContent = won ? 'ACE' : kills>=4 ? 'VETERAN' : 'ROOKIE';
  overlayEnd.classList.remove('hidden');
  if(score > bestScore){ bestScore=score; localStorage.setItem('skystrike-best', String(bestScore)); if(statBest) statBest.textContent=bestScore.toLocaleString(); }
  // bestScore update
}

function onResize(){
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  renderer.setSize(w,h); camera.aspect = w/h; camera.updateProjectionMatrix();
}
addEventListener('resize', onResize);
new ResizeObserver(onResize).observe(canvasWrap);

// initial HUD
updateHUD(0);
updateWaveDots();
resetFlight();
state='menu'; // show start
last = performance.now();
tick();

// expose for tests/debug
window.__game = { flightState, getState:()=>state };


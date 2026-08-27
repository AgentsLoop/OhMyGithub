import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('playBtn');
const healthFill = document.getElementById('healthFill');
const healthText = document.getElementById('healthText');
const ammoEl = document.getElementById('ammo');
const reloadEl = document.getElementById('reload');
const enemyCountEl = document.getElementById('enemyCount');
const scoreEl = document.getElementById('scoreEl');
const accEl = document.getElementById('accEl');
const timerEl = document.getElementById('timer');
const damageEl = document.getElementById('damage');
const crossEl = document.getElementById('cross');
const killfeedEl = document.getElementById('killfeed');
const attributionEl = document.getElementById('attribution');
const statusLine = document.getElementById('statusLine');

let SKETCH_ATTRIB = null;
async function loadAttribution(){
  // Show both assets
  const parts=[];
  for(const u of ['/models/weapon.glb.attribution.json','/models/hands.glb.attribution.json']){
    try{ const r=await fetch(u); if(r.ok){ const j=await r.json(); parts.push(`<b>${j.name||j.title}</b> by ${j.author} · ${j.license||''}`); }}catch{}
  }
  if(parts.length){ attributionEl.style.display='block'; attributionEl.innerHTML = parts.join(' | ') + ' — <a target="_blank" href="https://sketchfab.com">Sketchfab</a>'; }
}
await loadAttribution();

// Renderer — COD-like: ACES filmic, slightly punchy exposure, soft shadows
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb7e8);
scene.fog = new THREE.FogExp2(0x8fb7e8, 0.012);

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 300);
camera.position.set(0,1.7,8);

// Lights — COD palette: warm key + cool fill + subtle ground bounce
scene.add(new THREE.HemisphereLight(0xe6efff, 0x1e242f, 0.85));
const dir = new THREE.DirectionalLight(0xfff4db, 2.45);
dir.position.set(20,30,14);
dir.castShadow = true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=1; dir.shadow.camera.far=90;
dir.shadow.camera.left=-45; dir.shadow.camera.right=45; dir.shadow.camera.top=45; dir.shadow.camera.bottom=-45;
dir.shadow.bias=-0.0005;
dir.shadow.radius=4;
scene.add(dir);
const fill = new THREE.DirectionalLight(0x9ab6ff, 0.55); fill.position.set(-14,16,-12); scene.add(fill);
// Warm bounce near ground (fake AO/GI) + subtle rim
const ambientPoint = new THREE.PointLight(0xffc98b, 45, 36); ambientPoint.position.set(0,5.5,-6); scene.add(ambientPoint);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.35); rimLight.position.set(0,8,-28); scene.add(rimLight);

// Ground — procedural asphalt (removes debug GridHelper which screamed prototype)
function makeAsphaltTexture(){
  const c=document.createElement('canvas'); c.width=512; c.height=512;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#3a3f4b'; ctx.fillRect(0,0,512,512);
  for(let i=0;i<9000;i++){
    const x=Math.random()*512, y=Math.random()*512;
    const v= Math.random()*28+ (Math.random()<0.08? 32:0);
    const s= Math.floor(v); ctx.fillStyle=`rgba(${s},${s},${s+2},${0.18+Math.random()*0.28})`;
    ctx.fillRect(x,y, 1+Math.random()*2.2,1+Math.random()*1.2);
  }
  // road wear lines
  ctx.strokeStyle='rgba(205,210,220,0.07)'; ctx.lineWidth=1.2;
  for(let y=0;y<512;y+=64){ ctx.beginPath(); ctx.moveTo(0,y+Math.random()*4); for(let x=0;x<512;x+=16){ ctx.lineTo(x, y+ (Math.random()-0.5)*3); } ctx.stroke(); }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(12,12); tex.anisotropy=8; tex.colorSpace=THREE.SRGBColorSpace; return tex;
}
const asphaltTex=makeAsphaltTexture();
const groundMat = new THREE.MeshStandardMaterial({ map: asphaltTex, color:0xffffff, roughness:0.88, metalness:0.03 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(180,180), groundMat);
ground.rotation.x = -Math.PI/2; ground.receiveShadow=true; scene.add(ground);
// subtle contact shadow under player area (no GridHelper)
const aoGeo = new THREE.CircleGeometry(38, 48);
const aoMat = new THREE.MeshBasicMaterial({ color:0x0b0f17, transparent:true, opacity:0.18, depthWrite:false });
const aoDecal = new THREE.Mesh(aoGeo, aoMat); aoDecal.rotation.x=-Math.PI/2; aoDecal.position.y=0.04; scene.add(aoDecal);

// Level: walls & cover — COD-inspired concrete/brick
const level = new THREE.Group(); scene.add(level);
function makeBox(w,h,d,x,y,z,color=0x9aa3b8, rough=0.85){
  const m=new THREE.MeshStandardMaterial({color, roughness:rough, metalness:0.06});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), m);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; level.add(mesh);
  return mesh;
}
function makeBuilding(w,h,d,x,z, tint=0xcbd3e2){
  const g=new THREE.Group(); level.add(g);
  // base concrete — slightly warm, less flat than before
  const mat = new THREE.MeshStandardMaterial({ color:tint, roughness:0.9, metalness:0.03 });
  const base=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); base.position.set(x,h/2,z); base.castShadow=true; base.receiveShadow=true; g.add(base);
  // darker concrete plinth at bottom (fake AO/trim)
  const plinthH = Math.min(0.9, h*0.11);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w+0.12, plinthH, d+0.12), new THREE.MeshStandardMaterial({ color:0x8a93a6, roughness:0.95 }));
  plinth.position.set(x, plinthH/2+0.02, z); plinth.receiveShadow=true; g.add(plinth);
  // parapet/edge trim
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w+0.08, 0.28, d+0.08), new THREE.MeshStandardMaterial({ color:0x9aa5bd, roughness:0.88 }));
  trim.position.set(x, h-0.14, z); trim.castShadow=true; g.add(trim);
  // windows — deeper, slight emissive for lived-in feel
  for(let i=0;i<3;i++){
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w*0.18, h*0.16), new THREE.MeshStandardMaterial({ color:0x0b162c, roughness:0.25, metalness:0.18, emissive:0x0a1a33, emissiveIntensity:0.18 }));
    win.position.set(x - w*0.22 + i*w*0.22, h*0.55, z + d/2+0.03); g.add(win);
    // window frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w*0.2, h*0.18, 0.04), new THREE.MeshStandardMaterial({ color:0x6b758a, roughness:0.9 }));
    // keep frame subtle: just offset slightly behind win plane is enough; skip to keep poly low
  }
  return g;
}
// Perimeter walls
makeBox(180, 8, 1.2, 0,4, -52, 0x4b5363);
makeBox(180, 8, 1.2, 0,4, 52, 0x4b5363);
makeBox(1.2, 8, 104, -52,4,0, 0x4b5363);
makeBox(1.2, 8, 104, 52,4,0, 0x4b5363);
// Interior buildings — varied tints for material richness (COD urban)
makeBuilding(18,8,14, -16, -18, 0xd4dbe8);
makeBuilding(16,6,12, 18, -14, 0xc9cfdd);
makeBuilding(14,7,16, 0, 18, 0xd1d8e6);
makeBuilding(10,6,10, -28, 8, 0xc2c9d8);
makeBuilding(12,9,9, 28, 12, 0xd8dde9);
// Cover crates
for(let i=0;i<18;i++){
  const x=(Math.random()-0.5)*70, z=(Math.random()-0.5)*70;
  if(Math.hypot(x,z)<8) continue;
  const h=1+Math.random()*1.2;
  makeBox(1.8, h, 1.1, x, h/2, z, i%2?0x8b7355:0x7a8a9a, 0.9);
}
// Barrels
for(let i=0;i<10;i++){
  const x=(Math.random()-0.5)*60, z=(Math.random()-0.5)*60;
  if(Math.hypot(x,z)<10) continue;
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,1.1,16), new THREE.MeshStandardMaterial({color:0x9a3a2a, roughness:0.7, metalness:0.2}));
  cyl.position.set(x,0.55,z); cyl.castShadow=true; cyl.receiveShadow=true; level.add(cyl);
}

// Weapon + Hands viewmodel — STRICT GLB ONLY, no procedural mockups
const weaponGroup = new THREE.Group(); camera.add(weaponGroup); scene.add(camera);
let glbWeapon = null; // rifle (optional)
let handsModel = null;
let mixer = null;
let clipIdle=null, clipShoot=null, clipReload=null, clipTake=null;
let currentAction=null;
const loader = new GLTFLoader();

async function loadViewmodel(){
  // 1) Load rifle GLB (M762) — kept for attribution/A-B proof but not primary viewmodel if hands present
  let rifleInfo='';
  try{
    const gRifle = await loader.loadAsync('/models/weapon.glb');
    glbWeapon = gRifle.scene;
    glbWeapon.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.frustumCulled=false; }});
    // don't add to scene yet — hands model is primary
    const box=new THREE.Box3().setFromObject(glbWeapon);
    const size=new THREE.Vector3(); box.getSize(size);
    rifleInfo = `Rifle ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}`;
  }catch(e){ console.warn('rifle GLB missing',e); rifleInfo='rifle missing'; }

  // 2) Load hands+animated pistol — PRIMARY viewmodel with real skeletal animations
  try{
    const gHands = await loader.loadAsync('/models/hands.glb');
    handsModel = gHands.scene;
    const clips = gHands.animations || [];
    console.log('[hands] clips', clips.map(c=>c.name));
    handsModel.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.frustumCulled=false; if(o.material) o.material.needsUpdate=true; }});

    // Normalize scale — hands are in decimeters; fit to COD-like viewmodel
    const boxH=new THREE.Box3().setFromObject(handsModel);
    const centerH=new THREE.Vector3(); boxH.getCenter(centerH);
    const sizeH=new THREE.Vector3(); boxH.getSize(sizeH);
    // hands model origin is at wrist; we keep original pivot, just scale
    const targetScale = 1.0; // model is already roughly 0.3m; keep ~1
    // Apply scale and position to mimic FPS hands in bottom-center
    handsModel.scale.setScalar(0.85);
    // Center correction tweaks — shift hands into view
    // Empirical: hands model faces +Z, we need it facing -Z (camera forward)
    // Keep original orientation but offset
    handsModel.position.set(0.08, -0.28, -0.55);
    handsModel.rotation.set(0.12, Math.PI, 0);

    weaponGroup.add(handsModel);

    // Animation mixer — fix frozen Idle (0.0s) by using Watch as breathing idle
    if(clips.length){
      mixer = new THREE.AnimationMixer(handsModel);
      const find = (needle)=> clips.find(c=> c.name.toLowerCase().includes(needle.toLowerCase()));
      let idleCandidate = find('Idle');
      if(!idleCandidate || idleCandidate.duration < 0.1){
        idleCandidate = find('Watch') || find('Idle') || clips[0];
        console.log('[hands] Idle was',find('Idle')?.duration,'s — substituting Watch/Idle', idleCandidate?.name, idleCandidate?.duration);
      }
      clipIdle = idleCandidate;
      clipShoot = find('Shoot') || find('Take') || clips[0];
      clipReload = find('Reload') || clips[0];
      clipTake = find('Take') || clips[0];
      console.log('[hands] using clips', clipIdle?.name, clipShoot?.name, clipReload?.name);
      if(clipIdle){
        currentAction = mixer.clipAction(clipIdle);
        currentAction.setLoop(THREE.LoopRepeat, Infinity);
        currentAction.play();
      }
      // Play Take intro once then return to breathing idle
      if(clipTake && clipTake!==clipIdle){
        const act = mixer.clipAction(clipTake);
        act.setLoop(THREE.LoopOnce,1); act.clampWhenFinished=true;
        act.play();
        setTimeout(()=>{ act.fadeOut(0.2); currentAction?.reset().fadeIn(0.2).play(); }, clipTake.duration*1000);
      }
    }
    // Muzzle point — pistol barrel tip relative to weaponGroup (hands at 0.08,-0.28,-0.55)
    const muzzleOffset = new THREE.Vector3(0.08, -0.06, -1.10);
    // muzzle visuals are attached to weaponGroup so they follow viewmodel sway/bob
    statusLine.textContent = `Viewmodel: Animated pistol hands by JUST (6 clips: Idle/Shoot/Reload) + ${rifleInfo} — real GLB, no mockup`;
    statusLine.style.color='#7dd3a0';
  }catch(e){
    console.error('[hands] FAILED', e);
    statusLine.textContent = `ERROR hands GLB failed: ${e.message}. No mockup — check /public/models/hands.glb`;
    statusLine.style.color='#ff6b6b';
    // Fallback to rifle alone if hands fail
    if(glbWeapon){
      const wrapper=new THREE.Group(); wrapper.add(glbWeapon);
      const box=new THREE.Box3().setFromObject(wrapper);
      const c=new THREE.Vector3(); box.getCenter(c); glbWeapon.position.sub(c);
      wrapper.position.set(0.34,-0.23,-0.72); wrapper.rotation.set(0.04, Math.PI-0.18, 0);
      weaponGroup.add(wrapper); handsModel=wrapper; glbWeapon=wrapper;
    }
  }
}
await loadViewmodel();
function playClip(clip, loop=THREE.LoopOnce, clamp=true){
  if(!mixer||!clip) return;
  if(currentAction) currentAction.fadeOut(0.08);
  const act=mixer.clipAction(clip);
  act.reset(); act.setLoop(loop,1); act.clampWhenFinished=clamp; act.fadeIn(0.08); act.play();
  currentAction=act;
  return act;
}

// Muzzle flash (attached to weaponGroup so it tracks viewmodel) — aligned to barrel tip
const muzzleLight = new THREE.PointLight(0xfff2a0, 0, 3.8); muzzleLight.position.set(0.08,-0.06,-1.10); weaponGroup.add(muzzleLight);
let muzzleMesh = new THREE.Mesh(new THREE.ConeGeometry(0.052,0.13,8), new THREE.MeshBasicMaterial({color:0xfff2a0, transparent:true, opacity:0})); muzzleMesh.rotation.x=-Math.PI/2; muzzleMesh.position.copy(muzzleLight.position); weaponGroup.add(muzzleMesh);

// Crosshair & HUD state
let health=100, maxHealth=100;
let score=0, kills=0, shots=0, hits=0;
let ammo=30, reserve=90, magSize=30;
let reloading=false, reloadTimer=0;
let gameTime=120, alive=true, won=false;
let sprint=false;

// Enemies
const enemies=[];
const enemyGroup=new THREE.Group(); scene.add(enemyGroup);
function createEnemy(pos){
  const g=new THREE.Group(); g.position.copy(pos);
  const bodyMat=new THREE.MeshStandardMaterial({color:0x2b3a55, roughness:0.85});
  const headMat=new THREE.MeshStandardMaterial({color:0xe9c9a8, roughness:0.7});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(0.38,0.8,6,12), bodyMat); body.position.y=0.95; body.castShadow=true; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.28,16,16), headMat); head.position.y=1.65; head.castShadow=true; g.add(head);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.08,0.04), new THREE.MeshStandardMaterial({color:0x0b0f1a})); visor.position.set(0,1.65,0.22); g.add(visor);
  // health bar sprite (simple plane)
  const hpBg=new THREE.Mesh(new THREE.PlaneGeometry(0.9,0.08), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.6, side:THREE.DoubleSide})); hpBg.position.set(0,2.25,0); g.add(hpBg);
  const hpFill=new THREE.Mesh(new THREE.PlaneGeometry(0.86,0.05), new THREE.MeshBasicMaterial({color:0x22c55e, side:THREE.DoubleSide})); hpFill.position.set(0,2.25,0.01); g.add(hpFill);
  g.userData={ hp:100, max:100, hpFill, hpBg, dead:false, lastShot:0, shootCd: 900+Math.random()*900, pos: pos.clone(), vel:new THREE.Vector3(), targetPos: pos.clone() };
  // collider for raycast (use body mesh)
  body.userData.isEnemy=true; body.userData.group=g; head.userData.isEnemy=true; head.userData.group=g; head.userData.isHead=true;
  enemyGroup.add(g); enemies.push(g);
  return g;
}
function spawnEnemies(n=10){
  for(let i=0;i<n;i++){
    let p; let tries=0;
    do{ p=new THREE.Vector3((Math.random()-0.5)*70,0,(Math.random()-0.5)*70); tries++; }while(p.length()<10 && tries<50);
    createEnemy(p);
  }
}
spawnEnemies(10);

// Controls - Pointer lock FPS
let yaw=0, pitch=0;
let moveF=0, moveR=0;
let velY=0, onGround=true;
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyR' && !reloading && ammo<magSize && reserve>0) startReload();
  if(e.code==='KeyR' && e.repeat) e.preventDefault();
});
addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('click', ()=>{
  if(!alive) return;
  if(document.pointerLockElement!==canvas) canvas.requestPointerLock();
  else shoot();
});
document.addEventListener('pointerlockchange', ()=>{
  if(document.pointerLockElement===canvas){ overlay.style.display='none'; }
  else { if(alive && !won) overlay.style.display='flex'; }
});
document.addEventListener('mousemove', e=>{
  if(document.pointerLockElement!==canvas) return;
  const sens=0.0022;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-1.35, Math.min(1.35, pitch));
});

// Movement physics
const player = { pos: new THREE.Vector3(0,1.7, 14), vel: new THREE.Vector3() };
camera.position.copy(player.pos);
function updateControls(dt){
  sprint = !!keys['ShiftLeft']||!!keys['ShiftRight'];
  moveF = (keys['KeyW']?1:0) - (keys['KeyS']?1:0);
  moveR = (keys['KeyD']?1:0) - (keys['KeyA']?1:0);
  const len=Math.hypot(moveF,moveR)||1; moveF/=len; moveR/=len;
  const speed = sprint? 5.2 : 3.1;
  const forward = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right = new THREE.Vector3(Math.sin(yaw+Math.PI/2),0,Math.cos(yaw+Math.PI/2));
  // apply input to horizontal velocity
  const wish = new THREE.Vector3().addScaledVector(forward, -moveF*speed).addScaledVector(right, moveR*speed);
  // simple smoothing
  player.vel.x = THREE.MathUtils.lerp(player.vel.x, wish.x, dt*12);
  player.vel.z = THREE.MathUtils.lerp(player.vel.z, wish.z, dt*12);
  // gravity & jump
  if(keys['Space'] && onGround){ velY=5.2; onGround=false; }
  velY -= 14*dt;
  player.vel.y = velY;
  const next = player.pos.clone().addScaledVector(player.vel, dt);
  // ground collision
  if(next.y < 1.7){ next.y=1.7; velY=0; onGround=true; }
  else onGround=false;
  // wall collision crude: keep inside bounds and repel from buildings
  next.x = Math.max(-49, Math.min(49, next.x));
  next.z = Math.max(-49, Math.min(49, next.z));
  // simple building push
  const buildings=[[-16,-18,18,14],[18,-14,16,12],[0,18,14,16],[-28,8,10,10],[28,12,12,9]];
  for(const [bx,bz,w,d] of buildings){
    const dx=next.x-bx, dz=next.z-bz;
    if(Math.abs(dx)<w/2+0.9 && Math.abs(dz)<d/2+0.9){
      const px=(w/2+0.9)-Math.abs(dx), pz=(d/2+0.9)-Math.abs(dz);
      if(px<pz) next.x += Math.sign(dx)*px; else next.z += Math.sign(dz)*pz;
    }
  }
  player.pos.copy(next);
  camera.position.copy(player.pos);
  camera.rotation.order='YXZ';
  camera.rotation.y=yaw; camera.rotation.x=pitch;
}

// Shooting
const raycaster=new THREE.Raycaster();
let lastShot=0;
function startReload(){
  if(reloading) return;
  reloading=true; reloadTimer= clipReload? clipReload.duration : 1.4; // match real anim
  reloadEl.style.display='block';
  crossEl.style.opacity='0.6';
  if(mixer && clipReload) playClip(clipReload);
}
function finishReload(){
  const need=magSize-ammo; const take=Math.min(need, reserve);
  ammo+=take; reserve-=take; reloading=false; reloadEl.style.display='none'; updateHudAmmo();
  if(mixer && clipIdle) setTimeout(()=> playClip(clipIdle, THREE.LoopRepeat, false), 60);
}
function updateHudAmmo(){ ammoEl.innerHTML=`${ammo} <small>/ ${reserve}</small>`; }
function addKillFeed(text, color='#22c55e'){
  const el=document.createElement('div'); el.className='kf'; el.textContent=text; el.style.borderLeftColor=color; killfeedEl.prepend(el);
  setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),400);},1800);
}
function shoot(){
  if(!alive||reloading) return;
  const now=performance.now(); if(now-lastShot<105) return; lastShot=now;
  if(ammo<=0){ startReload(); return; }
  ammo--; shots++; updateHudAmmo();
  if(ammo===0 && reserve>0) startReload();
  // muzzle flash + shoot animation
  muzzleLight.intensity=12; muzzleMesh.material.opacity=0.95;
  setTimeout(()=>{ muzzleLight.intensity=0; muzzleMesh.material.opacity=0; }, 50);
  if(mixer && clipShoot && !reloading){
    playClip(clipShoot);
    // return to idle after shoot
    const dur = clipShoot.duration*1000;
    setTimeout(()=>{ if(!reloading && clipIdle) playClip(clipIdle, THREE.LoopRepeat, false); }, dur+40);
  } else {
    // fallback kick if no mixer
    const vm = handsModel || glbWeapon;
    if(vm){ vm.position.z += 0.06; setTimeout(()=>{ if(vm) vm.position.z-=0.06; },60); }
  }
  // slight camera kick
  pitch += 0.004; yaw += (Math.random()-0.5)*0.003;
  // raycast from center
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  const hitsMesh = raycaster.intersectObjects(enemyGroup.children, true);
  let hitEnemy=null, isHead=false, hitPoint=null;
  for(const h of hitsMesh){ if(h.object.userData.isEnemy){ hitEnemy=h.object.userData.group; isHead=!!h.object.userData.isHead; hitPoint=h.point; break; } }
  // also check ground/buildings for impact effect (optional)
  if(hitEnemy){
    hits++;
    const dmg = isHead? 55 : 28;
    const d = hitEnemy.userData;
    d.hp -= dmg;
    d.hpFill.scale.x = Math.max(0, d.hp/d.max);
    // hit flash
    crossEl.classList.add('hit'); setTimeout(()=>crossEl.classList.remove('hit'),120);
    // knock
    hitEnemy.position.add(new THREE.Vector3((Math.random()-0.5)*0.2,0,(Math.random()-0.5)*0.2));
    spawnImpact(hitPoint, isHead?0xffd23f:0xffffff);
    // floating damage
    spawnFloatingText(hitPoint, isHead? 'HEADSHOT -'+dmg : '-'+dmg, isHead);
    if(d.hp<=0 && !d.dead){
      d.dead=true;
      kills++; score+= isHead? 250:150;
      addKillFeed((isHead?'Headshot ':'Eliminated ')+`Hostile +${isHead?250:150}`);
      // death anim
      hitEnemy.userData.hpBg.visible=false; hitEnemy.userData.hpFill.visible=false;
      // ragdoll-ish fall
      const tl = { t:0 };
      const startY=hitEnemy.position.y;
      const fall = setInterval(()=>{
        tl.t+=0.05; hitEnemy.rotation.z += 0.18; hitEnemy.position.y -= 0.08; hitEnemy.position.y = Math.max(0.2, hitEnemy.position.y);
        if(tl.t>1){ clearInterval(fall); hitEnemy.visible=false; }
      },16);
      updateHud();
      checkWin();
    }
  }else{
    // miss impact on level
    const lvlHits=raycaster.intersectObjects(level.children, false);
    if(lvlHits[0]) spawnImpact(lvlHits[0].point, 0xaaaaaa);
  }
  updateHud();
}

// Impacts
const impactGroup=new THREE.Group(); scene.add(impactGroup);
function spawnImpact(p, color){
  if(!p) return;
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9}));
  m.position.copy(p); impactGroup.add(m);
  let t=0; const id=setInterval(()=>{ t+=0.08; m.scale.multiplyScalar(1.08); m.material.opacity-=0.12; if(m.material.opacity<=0){ clearInterval(id); impactGroup.remove(m); }},16);
}
function spawnFloatingText(p, text, head){
  const c=document.createElement('div'); c.textContent=text; c.style.position='fixed'; c.style.left='50%'; c.style.top='50%'; c.style.transform='translate(-50%,-50%)'; c.style.color=head?'#ffd23f':'#fff'; c.style.fontWeight='800'; c.style.fontSize=head?'18px':'14px'; c.style.textShadow='0 2px 8px rgba(0,0,0,.8)'; c.style.pointerEvents='none'; c.style.zIndex='5'; document.body.appendChild(c);
  const start=performance.now();
  function tick(now){
    const t=(now-start)/600;
    c.style.transform=`translate(-50%, calc(-50% - ${t*60}px))`;
    c.style.opacity=String(1-t);
    if(t<1) requestAnimationFrame(tick); else c.remove();
  } requestAnimationFrame(tick);
}

// Enemy AI
function updateEnemies(dt, now){
  for(const e of enemies){
    if(e.userData.dead) continue;
    // billboard hp
    e.userData.hpBg.lookAt(camera.position); e.userData.hpFill.lookAt(camera.position);
    // movement: strafe around player with noise
    const toPlayer = new THREE.Vector3().subVectors(player.pos, e.position);
    const dist = toPlayer.length();
    toPlayer.y=0; toPlayer.normalize();
    // keep distance 8-16
    let move = new THREE.Vector3();
    if(dist>14) move.addScaledVector(toPlayer, 1.6*dt*  (sprint?1.2:1));
    else if(dist<7) move.addScaledVector(toPlayer, -1.2*dt);
    else {
      // strafe
      const perp=new THREE.Vector3(-toPlayer.z,0,toPlayer.x);
      const dir = Math.sin(now*0.001 + e.position.x)*0.7;
      move.addScaledVector(perp, dir*1.1*dt);
      move.addScaledVector(toPlayer, (Math.random()-0.5)*0.6*dt);
    }
    e.position.add(move);
    e.lookAt(player.pos.x, e.position.y, player.pos.z);
    // shoot at player
    if(now - e.userData.lastShot > e.userData.shootCd && dist<42){
      // line of sight simple (no occlusion for now)
      e.userData.lastShot=now;
      e.userData.shootCd= 850+Math.random()*1100;
      // muzzle
      const dmg = 6 + Math.random()*9;
      if(dist<38 && Math.random()<0.45){ // hit chance
        health -= dmg; health=Math.max(0,health);
        damageEl.style.background='rgba(255,40,40,.18)'; damageEl.style.borderWidth='16px'; damageEl.style.borderColor='rgba(255,40,40,.5)';
        setTimeout(()=>{ damageEl.style.background='rgba(255,0,0,0)'; damageEl.style.borderWidth='0px'; },120);
        if(health<=0) doGameOver(false);
        updateHud();
      }
      // tracer line visual
      const a=e.position.clone(); a.y=1.4;
      const b=player.pos.clone();
      const lineGeo=new THREE.BufferGeometry().setFromPoints([a,b]);
      const line=new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:0xff3b30, transparent:true, opacity:0.7}));
      scene.add(line); setTimeout(()=>scene.remove(line),70);
    }
  }
}

function updateHud(){
  healthFill.style.width=(health/maxHealth*100)+'%';
  healthText.textContent=Math.round(health);
  healthFill.style.background = health<30? '#ef4444' : health<60? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#21e6a0,#3b82f6)';
  enemyCountEl.textContent = `${enemies.filter(e=>e.userData.dead).length} / ${enemies.length}`;
  scoreEl.textContent=String(score);
  const acc = shots? Math.round(hits/shots*100):0;
  accEl.textContent = shots? acc+'%':'—';
  timerEl.textContent = `${String(Math.floor(Math.max(0,gameTime)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,gameTime)%60)).padStart(2,'0')}`;
  timerEl.style.color = gameTime<20? '#ff3b30' : '#e8eef7';
}
function checkWin(){
  if(enemies.every(e=>e.userData.dead)){
    doGameOver(true);
  }
}
function doGameOver(win){
  if(!alive) return;
  alive=false; won=win;
  document.exitPointerLock?.();
  overlay.style.display='flex';
  const dead = enemies.filter(e=>e.userData.dead).length;
  document.getElementById('card').innerHTML = `
    <h1>${win? 'Facility <i>Secured</i>' : 'Mission <i>Failed</i>'}</h1>
    <p>${win? 'All hostiles neutralized. Outstanding tactical performance.' : health<=0? 'You were neutralized. Regroup and try again.' : 'Time expired. The facility remains hostile.'}</p>
    <div class="grid">
      <div class="k"><b>Score</b><div>${score}</div></div>
      <div class="k"><b>Eliminated</b><div>${dead} / ${enemies.length}</div></div>
      <div class="k"><b>Accuracy</b><div>${shots? Math.round(hits/shots*100)+'%':'—'} (${hits}/${shots})</div></div>
      <div class="k"><b>Time</b><div>${Math.max(0,Math.floor(120-gameTime))}s elapsed</div></div>
    </div>
    <button id="playBtn" onclick="location.reload()">Restart Mission</button>
    <div id="hint">Click to play again. Try to beat your accuracy.</div>
  `;
}

// Loop
let last=performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(0.033, (now-last)/1000); last=now;
  if(alive){
    updateControls(dt);
    updateEnemies(dt, now);
    if(mixer) mixer.update(dt);
    gameTime-=dt; if(gameTime<=0){ gameTime=0; doGameOver(false); }
    if(reloading){ reloadTimer-=dt; if(reloadTimer<=0) finishReload(); }
    // bob viewmodel (hands) — subtle, COD-like
    const moving = Math.hypot(player.vel.x, player.vel.z)>0.3;
    const t=now*0.001;
    const vm = handsModel || glbWeapon;
    if(vm && !reloading){
      // only bob when not reloading (anim controls position then)
      const bob = moving? Math.sin(t*9)*0.009 : Math.sin(t*1.2)*0.003;
      const sway = moving? Math.sin(t*4.5)*0.008 : 0;
      // preserve base plus bob via small offset on top of anim
      vm.position.y = -0.28 + bob + (sprint&&moving?0.01:0);
      vm.position.x = 0.08 + sway + (sprint&&moving?0.015:0);
    }
    updateHud();
  }
  renderer.render(scene,camera);
}
updateHud(); updateHudAmmo();
animate(performance.now());

addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight);
});
playBtn.addEventListener('click', ()=>{
  canvas.requestPointerLock();
});
statusLine.textContent += ' · Click Enter Facility to lock pointer and start.';

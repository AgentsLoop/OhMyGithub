import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const hpEl = document.getElementById('hp');
const hpbar = document.getElementById('hpbar');
const shieldEl = document.getElementById('shield');
const shieldbar = document.getElementById('shieldbar');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const enemiesEl = document.getElementById('enemies');
const waveBanner = document.getElementById('waveBanner');
const hitEl = document.getElementById('hit');
const overlay = document.getElementById('overlay');
const deadScreen = document.getElementById('dead');
const wonScreen = document.getElementById('won');
const attrib = document.getElementById('attrib');

const scene = new THREE.Scene();
// Iteration 4: reduce wash — tighter, darker fog + desaturated sky/bg for Halo mid-distance depth cue
scene.fog = new THREE.Fog(0xa8bed8, 38, 85);
scene.background = new THREE.Color(0x8ea6c6);
// Iteration 10: subtle warm/cool grading via fog lerp — nudge 2-3% toward warm paper to counter cool ACES blue, keeps Halo mid-distance depth without washing
scene.fog.color.lerp(new THREE.Color(0xc9b8a6), 0.03);
scene.background.lerp(new THREE.Color(0xd2c4b2), 0.02);
// large inverted sky dome — was 0xeef2f8 (bleached) → 0xc9d6ea restores contrast vs white trim
const skyGeo = new THREE.SphereGeometry(120, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({ color: 0xc9d6ea, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);
// Height haze dome — subtle vertical gradient to mimic Halo atmospheric depth (denser near ground)
let heightHaze = null;
{
  const hGeo = new THREE.SphereGeometry(58, 32, 22, 0, Math.PI*2, 0, Math.PI*0.58);
  const hMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent:true, depthWrite:false, fog:false,
    uniforms:{ col:{value:new THREE.Color(0x8ea6c6)}, fogCol:{value:new THREE.Color(0xa8bed8)} },
    vertexShader:`varying float vH; void main(){ vH = position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader:`varying float vH; uniform vec3 col; uniform vec3 fogCol; void main(){
      float t = clamp((vH + 2.0)/ 18.0, 0.0, 1.0);
      float alpha = (1.0 - t) * 0.22;
      // slightly darker/bluer toward horizon
      vec3 c = mix(fogCol, col, t*0.6);
      gl_FragColor = vec4(c, alpha);
    }`,
    blending: THREE.NormalBlending
  });
  heightHaze = new THREE.Mesh(hGeo, hMat);
  heightHaze.position.y = -2.0;
  heightHaze.renderOrder = -1;
  scene.add(heightHaze);
}
// subtle vignette overlay — Halo lift blacks in corners to fight ACES wash
{
  const vig = document.createElement('div');
  vig.id='vignette';
  vig.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 50%, transparent 62%, rgba(10,18,36,0.52) 100%);opacity:0.55;';
  document.body.appendChild(vig);
}
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance', alpha:false, premultipliedAlpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
// Iteration 10: Halo color grading — fine-tuned exposure restores highlight headroom + subtle contrast/saturation lift via CSS filter (warm/cool balanced, not washed)
canvas.style.filter = 'contrast(1.07) saturate(1.08) brightness(1.015) sepia(0.03) hue-rotate(-1deg)';
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Halo-like wayfinding + crunch state — neon trim registry + reactor halo base colors
const wallNeonTrims = [];
const reactorHaloBase = new THREE.Color(0xff3b82);
const reactorHaloShift = new THREE.Color(0xff8ab8);
const reactorCoreBase = new THREE.Color(0x7af2ff);
const reactorCoreShift = new THREE.Color(0x8af0ff);
// Halo-like environment reflections for metal readability — tiny cube target updated once after first frame
const envTarget = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
envTarget.texture.type = THREE.HalfFloatType;
const cubeCam = new THREE.CubeCamera(0.1, 1000, envTarget);
let envReady = false;
function updateEnvMap(){
  if(envReady) return;
  // hide dynamic objects so env captures clean sky + arena
  const vis = [];
  enemyList.forEach(e=>{ vis.push([e,true]); e.visible=false; });
  weaponMesh && (weaponMesh.visible=false);
  cubeCam.position.set(0,6,0);
  cubeCam.update(renderer, scene);
  enemyList.forEach(([e])=> e.visible=true);
  weaponMesh && (weaponMesh.visible=true);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.9;
  envReady = true;
}

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200);
let camRig = new THREE.Group();
let camHolder = new THREE.Group();
scene.add(camRig);
camRig.add(camHolder);
camHolder.add(camera);
camera.position.set(0,1.7,0);
camRig.position.set(0,1.7,8);

let yaw = 0, pitch = 0;
let pointerLocked = false;

const loader = new GLTFLoader();
let robotTemplate = null;
let crateTemplate = null;
let weaponTemplate = null;

function enhanceRobotTemplate(root){
  // Convert clay flat material into Halo hard-surface: metal/rough variation per mesh, envMap-friendly
  root.traverse(o=>{
    if(!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const newMats = mats.map(orig=>{
      if(!orig) return orig;
      // normalize to MeshStandardMaterial while preserving texture
      let m = orig;
      const isStandard = m.isMeshStandardMaterial || m.isMeshPhysicalMaterial;
      if(!isStandard){
        const col = m.color ? m.color.clone() : new THREE.Color(0x8ea0b8);
        const nm = new THREE.MeshStandardMaterial({ color: col });
        if(m.map) nm.map = m.map;
        if(m.emissive) nm.emissive.copy(m.emissive);
        // preserve name for visor detection
        nm.name = m.name || o.name;
        m = nm;
      } else {
        m = m.clone();
        m.name = orig.name || o.name;
      }
      const name = (o.name + ' ' + (m.name||'')).toLowerCase();
      const isVisor = /eye|visor|optic|lens|head|face|light|glow/i.test(name);
      const isArmor = /armor|body|torso|chassis|plate|hull|leg|arm/i.test(name);
      const isJoint = /joint|piston|cable|wire|pipe/i.test(name);
      let targetMetal = isVisor ? 0.18 : isArmor ? 0.58 : isJoint ? 0.72 : 0.42;
      let targetRough = isVisor ? 0.22 : isArmor ? 0.36 : isJoint ? 0.45 : 0.52;
      // per-mesh jitter so silhouette reads against bright floor
      targetMetal = THREE.MathUtils.clamp(targetMetal + (Math.random()-0.5)*0.14, 0, 1);
      targetRough = THREE.MathUtils.clamp(targetRough + (Math.random()-0.5)*0.18, 0.15, 0.95);
      m.metalness = targetMetal;
      m.roughness = targetRough;
      m.envMapIntensity = 1.35;
      // darken slightly vs bright albedo floor (Halo contrast: enemies ~0.35 vs floor ~0.75)
      if(m.color){
        // keep hue, reduce value ~6% so detail pops; avoid washing on aac0d8 fog/bg
        const hsl={}; m.color.getHSL(hsl);
        if(isVisor){
          m.color.setHSL(hsl.h, Math.min(1,hsl.s*1.1), Math.min(0.6,hsl.l*0.95));
        } else {
          m.color.multiplyScalar(0.92);
        }
      }
      if(isVisor){
        m.emissive = new THREE.Color(0x00e5ff);
        m.emissiveIntensity = 1.6;
      } else {
        // base emissive low but non-zero so flash lerp is visible
        if(!m.emissive) m.emissive = new THREE.Color(0x0e1a2a);
        else m.emissive.setHex(0x0e1a2a);
        m.emissiveIntensity = 0.08;
      }
      // keep original values for hit flash lerp
      m.userData = m.userData || {};
      m.userData.baseEmissive = m.emissive.getHex();
      m.userData.baseIntensity = m.emissiveIntensity;
      m.userData.baseMetal = m.metalness;
      m.userData.baseRough = m.roughness;
      m.needsUpdate = true;
      return m;
    });
    o.material = Array.isArray(o.material) ? newMats : newMats[0];
  });
}

async function loadModels(){
  const loads = [];
  loads.push(loader.loadAsync('/models/robot.glb').then(g=>{
    robotTemplate=g.scene;
    enhanceRobotTemplate(robotTemplate);
    // ensure every mesh casts shadow even after material swap
    robotTemplate.traverse(m=>{ if(m.isMesh){ m.castShadow=true; m.receiveShadow=true; }});
  }).catch(()=>{}));
  // prefer normalized crate (KHR_materials_pbrSpecularGlossiness converted) — avoids GLTFLoader warning and ensures metal-rough PBR
  loads.push(loader.loadAsync('/models/crate-normalized.glb').then(g=>{ crateTemplate=g.scene; }).catch(()=> loader.loadAsync('/models/crate.glb').then(g=>{ crateTemplate=g.scene; }).catch(()=>{})));
  loads.push(loader.loadAsync('/models/weapon.glb').then(g=>{ weaponTemplate=g.scene; }).catch(()=>{}));
  await Promise.allSettled(loads);
}
 // keep weapon fallback handled later

// lights — Halo day, iteration 4: lower hemi fill to restore contrast, keep warm sun but 2.9 not 3.2 (was wash)
scene.add(new THREE.HemisphereLight(0xeef4ff, 0x2a3448, 0.72));
const dir = new THREE.DirectionalLight(0xfff1d6, 2.85);
dir.position.set(18,22,12);
dir.castShadow=true;
dir.shadow.mapSize.set(2048,2048);
dir.shadow.camera.near=0.5; dir.shadow.camera.far=80;
dir.shadow.camera.left=-32; dir.shadow.camera.right=32; dir.shadow.camera.top=32; dir.shadow.camera.bottom=-32;
dir.shadow.bias=-0.0006;
scene.add(dir);
const rim = new THREE.PointLight(0x7af2ff, 4, 36);
rim.position.set(0,12,0);
scene.add(rim);
// keep single warm point for contrast, remove color-spam
const pink = new THREE.PointLight(0xff3b82, 2, 22);
pink.position.set(10,2,-10);
scene.add(pink);
const blue2 = new THREE.PointLight(0x7a7aff, 1, 20);
blue2.position.set(-10,2,10);
scene.add(blue2);

// arena — Halo trim-sheet style: higher albedo floor with procedural panel texture, clean walls, limited neon wayfinding
const arenaRadius = 19;
// bright concrete trim-sheet floor — Halo albedo 0.75+ with procedural AO / edge wear / roughness variation
function makeFloorTextures(){
  const N=1024;
  const c=document.createElement('canvas'); c.width=N; c.height=N;
  const g=c.getContext('2d');
  g.fillStyle='#d2d8e2'; g.fillRect(0,0,N,N);
  // Iteration 11: Halo authored panel albedo variation — checker-like cool/warm per 3m tile (tiled albedo without external textures: alternating +/− hue like Halo trim sheet)
  for(let ty=0; ty<N; ty+=256) for(let tx=0; tx<N; tx+=256){
    const isCool = ((tx/256 + ty/256) & 1)===0;
    g.fillStyle = isCool ? 'rgba(124,152,195,0.038)' : 'rgba(192,176,150,0.036)';
    // inset 1px so grout AO stays clean; keeps panel read not wash
    g.fillRect(tx+1, ty+1, 254, 254);
    // faint inner panel edge lift for authored bevel read
    g.strokeStyle = isCool ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.022)';
    g.lineWidth=1; g.strokeRect(tx+3.5, ty+3.5, 249, 249);
  }
  // base variation — large soft mottling (concrete pour)
  for(let i=0;i<70;i++){
    const x=Math.random()*N, y=Math.random()*N, r=40+Math.random()*90;
    const a=0.018+Math.random()*0.022;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(0,0,0,${a})`);
    grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // subtle warm/cool splotches (edge wear / foot traffic)
  for(let i=0;i<55;i++){
    const x=Math.random()*N, y=Math.random()*N, r=14+Math.random()*28;
    const a=0.025+Math.random()*0.035;
    g.fillStyle=Math.random()<0.5?`rgba(38,44,64,${a})`:`rgba(90,88,82,${a})`;
    g.beginPath(); g.ellipse(x,y,r*1.2,r,Math.random()*Math.PI,0,Math.PI*2); g.fill();
  }
  // 3m panel grid — main grout + AO darkening along seam (6px soft)
  g.strokeStyle='rgba(0,0,0,0.075)'; g.lineWidth=2;
  for(let i=0;i<N;i+=256){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,N); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(N,i); g.stroke(); }
  // AO along grout — slightly darker soft edge on one side (fake cavity)
  g.strokeStyle='rgba(18,22,34,0.055)'; g.lineWidth=10;
  for(let i=256;i<N;i+=256){
    g.beginPath(); g.moveTo(i+5,0); g.lineTo(i+5,N); g.stroke();
    g.beginPath(); g.moveTo(0,i+5); g.lineTo(N,i+5); g.stroke();
  }
  g.strokeStyle='rgba(0,0,0,0.035)'; g.lineWidth=1;
  for(let i=128;i<N;i+=256){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,N); g.stroke(); }
  // iteration 5: fake cavity edge-wear / dirt — dark broken streaks along panel grout (authored trim-sheet wear without external textures)
  g.save();
  for(let i=256;i<N;i+=256){
    for(let y=0;y<N;){
      const segLen=18+Math.random()*52, gap=12+Math.random()*38;
      const wob=(Math.random()-0.5)*3.5, a=0.022+Math.random()*0.028;
      g.strokeStyle=`rgba(22,24,34,${a})`; g.lineWidth=3+Math.random()*2.2; g.lineCap='round';
      g.beginPath(); g.moveTo(i+wob+1, y+2); g.lineTo(i+wob-1, y+segLen); g.stroke();
      g.strokeStyle=`rgba(255,255,255,${a*0.5})`; g.lineWidth=0.9;
      g.beginPath(); g.moveTo(i+wob+3, y+4); g.lineTo(i+wob+2, y+segLen-3); g.stroke();
      y+=segLen+gap;
    }
    for(let x=0;x<N;){
      const segLen=18+Math.random()*52, gap=12+Math.random()*38;
      const wob=(Math.random()-0.5)*3.5, a=0.022+Math.random()*0.028;
      g.strokeStyle=`rgba(22,24,34,${a})`; g.lineWidth=3+Math.random()*2.2; g.lineCap='round';
      g.beginPath(); g.moveTo(x+2, i+wob+1); g.lineTo(x+segLen, i+wob-1); g.stroke();
      g.strokeStyle=`rgba(255,255,255,${a*0.5})`; g.lineWidth=0.9;
      g.beginPath(); g.moveTo(x+4, i+wob+3); g.lineTo(x+segLen-3, i+wob+2); g.stroke();
      x+=segLen+gap;
    }
  }
  for(let y=0;y<N;y+=256) for(let x=0;x<N;x+=256){
    if(Math.random()<0.72){
      const rad=9+Math.random()*14, a=0.035+Math.random()*0.04;
      const grd=g.createRadialGradient(x,y,0,x,y,rad);
      grd.addColorStop(0,`rgba(18,20,32,${a})`); grd.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grd; g.beginPath(); g.arc(x,y,rad,0,Math.PI*2); g.fill();
      g.fillStyle=`rgba(255,255,255,${a*0.32})`; g.beginPath(); g.arc(x+2,y+2,rad*0.5,0,Math.PI*2); g.fill();
    }
  }
  // scattered oil/dirt leaks near random panel edges
  for(let k=0;k<22;k++){
    const gx=(Math.floor(Math.random()*4)*256), gy=(Math.floor(Math.random()*4)*256);
    const rx=gx+(Math.random()-0.5)*18, ry=gy+(Math.random()-0.5)*18;
    const r=6+Math.random()*13, a=0.03+Math.random()*0.04;
    g.fillStyle=`rgba(36,28,22,${a})`; g.beginPath(); g.ellipse(rx,ry,r*1.3,r,Math.random()*Math.PI,0,Math.PI*2); g.fill();
  }
  g.restore();
  // fine scratches / hairlines
  g.strokeStyle='rgba(0,0,0,0.018)'; g.lineWidth=0.7;
  for(let i=0;i<90;i++){
    const x=Math.random()*N, y=Math.random()*N, l=22+Math.random()*55;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+l*(Math.random()<0.5?1:0), y+l*(Math.random()<0.5?1:0)); g.stroke();
  }
  // grain
  for(let i=0;i<3400;i++){ const x=Math.random()*N, y=Math.random()*N; g.fillStyle=`rgba(0,0,0,${Math.random()*0.016})`; g.fillRect(x,y,1,1); }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2.2,2.2); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
  // iteration 8: procedural height → bump approximation — grout grooves feel deeper, bevel catches specular like authored normalMap
  const bumpCanvas=document.createElement('canvas'); bumpCanvas.width=N; bumpCanvas.height=N;
  const bc=bumpCanvas.getContext('2d');
  bc.fillStyle='#808080'; bc.fillRect(0,0,N,N);
  // base concrete micro-height — mid-gray speckle jitter
  for(let i=0;i<3200;i++){ const x=Math.random()*N, y=Math.random()*N; const v=Math.floor(128+(Math.random()-0.5)*22); bc.fillStyle=`rgb(${v},${v},${v})`; bc.fillRect(x,y,1,1); }
  for(let i=0;i<70;i++){
    const x=Math.random()*N, y=Math.random()*N, r=40+Math.random()*90;
    const dark=Math.random()<0.5;
    const delta= dark ? -16 : 14;
    const v=128+delta;
    const grd=bc.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(${v},${v},${v},0.55)`); grd.addColorStop(1,'rgba(128,128,128,0)');
    bc.fillStyle=grd; bc.beginPath(); bc.arc(x,y,r,0,Math.PI*2); bc.fill();
  }
  // grout grooves — darker = deeper, plus thin light bevel highlight on +side (fake normal chamfer)
  for(let i=0;i<N;i+=256){
    // deep groove
    bc.strokeStyle='#3e434f'; bc.lineWidth=7; bc.beginPath(); bc.moveTo(i,0); bc.lineTo(i,N); bc.stroke();
    bc.beginPath(); bc.moveTo(0,i); bc.lineTo(N,i); bc.stroke();
    // soft wider trough (deeper shadow)
    bc.strokeStyle='#52575f'; bc.lineWidth=12; bc.globalAlpha=0.42; bc.beginPath(); bc.moveTo(i,0); bc.lineTo(i,N); bc.stroke();
    bc.beginPath(); bc.moveTo(0,i); bc.lineTo(N,i); bc.stroke(); bc.globalAlpha=1;
    // bevel highlight — one pixel light edge simulating 45° chamfer catch
    bc.strokeStyle='#aeb4c0'; bc.lineWidth=1.2; bc.globalAlpha=0.55;
    bc.beginPath(); bc.moveTo(i+4,0); bc.lineTo(i+4,N); bc.stroke();
    bc.beginPath(); bc.moveTo(0,i+4); bc.lineTo(N,i+4); bc.stroke(); bc.globalAlpha=1;
  }
  // faint secondary grid at 128
  bc.strokeStyle='#6e727a'; bc.lineWidth=1; bc.globalAlpha=0.32;
  for(let i=128;i<N;i+=256){ bc.beginPath(); bc.moveTo(i,0); bc.lineTo(i,N); bc.stroke(); bc.beginPath(); bc.moveTo(0,i); bc.lineTo(N,i); bc.stroke(); }
  bc.globalAlpha=1;
  const floorBump=new THREE.CanvasTexture(bumpCanvas); floorBump.wrapS=floorBump.wrapT=THREE.RepeatWrapping; floorBump.repeat.set(2.2,2.2); floorBump.anisotropy=8;
  // roughness variation canvas — mid 0.84 with per-panel jitter + wear = less glossy
  const rc=document.createElement('canvas'); rc.width=512; rc.height=512;
  const rg=rc.getContext('2d');
  rg.fillStyle='#d6d6d6'; rg.fillRect(0,0,512,512);
  for(let i=0;i<55;i++){
    const x=Math.random()*512, y=Math.random()*512, r=18+Math.random()*48;
    const a=0.10+Math.random()*0.18;
    const shade=Math.random()<0.5?0:255;
    rg.fillStyle=`rgba(${shade},${shade},${shade},${a})`;
    rg.beginPath(); rg.arc(x,y,r,0,Math.PI*2); rg.fill();
  }
  for(let i=0;i<2200;i++){ const x=Math.random()*512, y=Math.random()*512; rg.fillStyle=`rgba(0,0,0,${Math.random()*0.08})`; rg.fillRect(x,y,1,1); }
  // grout is rougher (darker in rough map = smoother? actually white=rough) so brighten seam
  rg.strokeStyle='#ffffff'; rg.lineWidth=2;
  for(let i=0;i<512;i+=128){ rg.beginPath(); rg.moveTo(i,0); rg.lineTo(i,512); rg.stroke(); rg.beginPath(); rg.moveTo(0,i); rg.lineTo(512,i); rg.stroke(); }
  const roughTex=new THREE.CanvasTexture(rc); roughTex.wrapS=roughTex.wrapT=THREE.RepeatWrapping; roughTex.repeat.set(2.2,2.2); roughTex.anisotropy=8;
  return { color:tex, rough:roughTex, bump:floorBump };
}
const floorTexs = makeFloorTextures();
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(arenaRadius, 64),
  new THREE.MeshStandardMaterial({ map: floorTexs.color, roughnessMap: floorTexs.rough, bumpMap: floorTexs.bump, bumpScale:0.058, color:0xffffff, roughness:0.88, metalness:0.02 })
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);
// iteration 8: subtle floor reflection — low-opacity metalized duplicate plane (fake planar reflection, catches sky/env like Halo 45° chamfer floors)
const floorReflect = new THREE.Mesh(
  new THREE.CircleGeometry(arenaRadius*0.985, 64),
  new THREE.MeshStandardMaterial({ color:0xc9d6ea, roughness:0.28, metalness:0.42, transparent:true, opacity:0.055, envMapIntensity:1.0 })
);
floorReflect.rotation.x = -Math.PI/2;
floorReflect.position.y = 0.012;
floorReflect.receiveShadow=false;
floorReflect.renderOrder = 1;
scene.add(floorReflect);
// Iteration 11: subtle floor edge wear darkening along outer ring — world-space ring (outer ~28% annulus) simulates Halo trap-edge dirt/AO where arena meets wall kick, self-contained canvas radial
{
  const Rw = 256;
  const rc2=document.createElement('canvas'); rc2.width=Rw; rc2.height=Rw;
  const gc=rc2.getContext('2d');
  gc.clearRect(0,0,Rw,Rw);
  // radial: transparent center → soft outer darkening with subtle noise breaks (not flat vignette)
  const outer = gc.createRadialGradient(Rw/2,Rw/2, Rw*0.28, Rw/2,Rw/2, Rw*0.50);
  outer.addColorStop(0,'rgba(18,22,32,0)');
  outer.addColorStop(0.42,'rgba(18,22,32,0)');
  outer.addColorStop(0.72,'rgba(26,30,44,0.16)');
  outer.addColorStop(0.86,'rgba(18,22,32,0.24)');
  outer.addColorStop(1,'rgba(14,18,30,0.32)');
  gc.fillStyle=outer; gc.beginPath(); gc.arc(Rw/2,Rw/2,Rw/2,0,Math.PI*2); gc.fill();
  // break up perfect circle with a few soft blotches (foot traffic / edge pooling like authored AO)
  for(let i=0;i<18;i++){
    const a=Math.random()*Math.PI*2, r=Rw*0.36+Math.random()*Rw*0.10;
    const x=Rw/2+Math.cos(a)*r, y=Rw/2+Math.sin(a)*r;
    const rad=10+Math.random()*18, alpha=0.06+Math.random()*0.08;
    gc.fillStyle=`rgba(22,24,32,${alpha})`;
    gc.beginPath(); gc.ellipse(x,y,rad*1.4,rad,Math.random()*Math.PI,0,Math.PI*2); gc.fill();
  }
  const edgeTex=new THREE.CanvasTexture(rc2); edgeTex.colorSpace=THREE.SRGBColorSpace; edgeTex.anisotropy=4;
  const ringMat2=new THREE.MeshBasicMaterial({ map:edgeTex, transparent:true, opacity:0.44, depthWrite:false, blending:THREE.MultiplyBlending, premultipliedAlpha:true });
  ringMat2.polygonOffset=true; ringMat2.polygonOffsetFactor=-0.6;
  const edgeRing=new THREE.Mesh(new THREE.RingGeometry(arenaRadius*0.62, arenaRadius*0.99, 64), ringMat2);
  edgeRing.rotation.x=-Math.PI/2;
  edgeRing.position.y=0.014;
  edgeRing.renderOrder=2;
  scene.add(edgeRing);
}
// contact AO — radial gradient plane (fake AO under crates/walls/pillars)
function makeAOGradTexture(){
  const s=128, c=document.createElement('canvas'); c.width=s; c.height=s;
  const g=c.getContext('2d');
  const grd=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  grd.addColorStop(0,'rgba(0,0,0,0.55)');
  grd.addColorStop(0.42,'rgba(0,0,0,0.28)');
  grd.addColorStop(0.72,'rgba(0,0,0,0.10)');
  grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd; g.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const aoTex = makeAOGradTexture();
function addContactAO(pos, sx, sz, opacity=0.38){
  const geo=new THREE.PlaneGeometry(sx, sz);
  const mat=new THREE.MeshBasicMaterial({ map: aoTex, transparent:true, opacity, depthWrite:false, blending:THREE.MultiplyBlending, premultipliedAlpha:true });
  mat.polygonOffset=true; mat.polygonOffsetFactor=-1;
  const m=new THREE.Mesh(geo, mat);
  m.rotation.x=-Math.PI/2;
  m.position.set(pos.x, 0.015, pos.z);
  m.renderOrder=0;
  scene.add(m);
  return m;
}
// removed GridHelper prototype tell — grout via texture only
// subtle outer trim ring
const ringGeo = new THREE.TorusGeometry(arenaRadius-0.1, 0.10, 12, 64);
const ringMat = new THREE.MeshStandardMaterial({ color:0xe6edf7, roughness:0.55, metalness:0.12 });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI/2;
ring.position.y = 0.05;
scene.add(ring);
// Halo trim-sheet wall textures — breaks flat #e6edf7 with AO, panel seams, micro variation
function makeWallTextures(){
  const N=512;
  const c=document.createElement('canvas'); c.width=N; c.height=N;
  const g=c.getContext('2d');
  g.fillStyle='#e6edf7'; g.fillRect(0,0,N,N);
  // Iteration 10: Halo trim-sheet panel variation — top panel (above mid seam) ~4% brighter albedo than bottom, simulates authored albedo variation without external textures
  g.fillStyle='rgba(255,255,255,0.040)'; g.fillRect(0,0,N,N*0.48);
  g.fillStyle='rgba(18,22,34,0.030)'; g.fillRect(0,N*0.52,N,N*0.48);
  // subtle warm-cool shift — top slightly cooler (sky light catch), bottom slightly warmer (bounce/dust) for Halo didactic read
  g.fillStyle='rgba(122,160,210,0.018)'; g.fillRect(0,0,N,N*0.48);
  g.fillStyle='rgba(210,180,150,0.015)'; g.fillRect(0,N*0.52,N,N*0.48);
  // large soft mottling (paint micro-unevenness)
  for(let i=0;i<28;i++){
    const x=Math.random()*N, y=Math.random()*N, r=32+Math.random()*68;
    const a=0.012+Math.random()*0.018;
    const grd=g.createRadialGradient(x,y,0,x,y,r);
    grd.addColorStop(0,`rgba(18,24,38,${a})`);
    grd.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=grd; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
  }
  // warm edge dust / handling smudges near bottom third
  for(let i=0;i<18;i++){
    const x=Math.random()*N, y=N*0.55+Math.random()*N*0.45, r=18+Math.random()*34;
    const a=0.02+Math.random()*0.03;
    g.fillStyle=`rgba(48,42,36,${a})`;
    g.beginPath(); g.ellipse(x,y,r*1.4,r,Math.random()*0.4,0,Math.PI*2); g.fill();
  }
  // vertical panel seams (2.4m spacing ≈ 512/2.8) — dark groove + light bevel highlight
  g.strokeStyle='rgba(18,26,42,0.085)'; g.lineWidth=2;
  for(let x=86;x<N;x+=172){
    g.beginPath(); g.moveTo(x,0); g.lineTo(x,N); g.stroke();
  }
  g.strokeStyle='rgba(255,255,255,0.32)'; g.lineWidth=1;
  for(let x=87;x<N;x+=172){
    g.beginPath(); g.moveTo(x+1,0); g.lineTo(x+1,N); g.stroke();
  }
  // horizontal mid seam at ~2.7m (wall mid) — iteration 9: extra dark cavity trough so panel break reads like authored AO/45° chamfer
  g.fillStyle='rgba(18,22,32,0.095)'; g.fillRect(0, N*0.48-3.5, N, 7);
  g.strokeStyle='rgba(18,22,32,0.14)'; g.lineWidth=2.2;
  g.beginPath(); g.moveTo(0, N*0.48); g.lineTo(N, N*0.48); g.stroke();
  g.strokeStyle='rgba(255,255,255,0.26)'; g.lineWidth=1;
  g.beginPath(); g.moveTo(0, N*0.48+1.6); g.lineTo(N, N*0.48+1.6); g.stroke();
  // cavity AO along top edge + bottom edge — iteration 8: stronger top cavity (was 0.14 → 0.26) so wall-to-ceiling reads like authored AO
  const topGrad=g.createLinearGradient(0,0,0,42);
  topGrad.addColorStop(0,'rgba(14,18,30,0.26)'); topGrad.addColorStop(0.5,'rgba(18,24,38,0.11)'); topGrad.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=topGrad; g.fillRect(0,0,N,42);
  // extra dark line right at chamfer (bevel shadow)
  g.fillStyle='rgba(14,18,30,0.14)'; g.fillRect(0,36, N, 6);
  const botGrad=g.createLinearGradient(0,N-46,0,N);
  botGrad.addColorStop(0,'rgba(18,24,38,0)'); botGrad.addColorStop(1,'rgba(18,24,38,0.20)');
  g.fillStyle=botGrad; g.fillRect(0,N-46,N,46);
  // iteration 9: floor-wall junction extra cavity — dark base + core line like Halo trim-sheet skirting AO
  g.fillStyle='rgba(18,22,32,0.16)'; g.fillRect(0, N-10, N, 10);
  g.strokeStyle='rgba(14,18,30,0.22)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(0, N-11); g.lineTo(N, N-11); g.stroke();
  g.strokeStyle='rgba(255,255,255,0.10)'; g.lineWidth=1;
  g.beginPath(); g.moveTo(0, N-9); g.lineTo(N, N-9); g.stroke();
  // iteration 5: fake edge-wear/dirt — broken dark streaks along vertical panel seams + drips near floor joint (Halo didactic wear)
  g.save();
  for(const sx of [86,258,430]){
    for(let y=0;y<N;){
      const len=22+Math.random()*48, gap=18+Math.random()*46;
      const wob=(Math.random()-0.5)*2.8, a=0.028+Math.random()*0.032;
      g.strokeStyle=`rgba(20,26,38,${a})`; g.lineWidth=4+Math.random()*2.8; g.lineCap='round';
      g.beginPath(); g.moveTo(sx+wob+1, y); g.lineTo(sx+wob-0.5, y+len); g.stroke();
      g.strokeStyle=`rgba(255,255,255,${a*0.48})`; g.lineWidth=1;
      g.beginPath(); g.moveTo(sx+wob+3, y+3); g.lineTo(sx+wob+2.2, y+len-4); g.stroke();
      y+=len+gap;
    }
  }
  for(let x=0;x<N;){
    const len=26+Math.random()*44, gap=14+Math.random()*36;
    const wob=(Math.random()-0.5)*2.2, a=0.02+Math.random()*0.025;
    g.strokeStyle=`rgba(20,26,38,${a})`; g.lineWidth=3+Math.random()*1.6; g.lineCap='round';
    g.beginPath(); g.moveTo(x, N*0.48+wob); g.lineTo(x+len, N*0.48+wob+0.6); g.stroke();
    x+=len+gap;
  }
  for(let i=0;i<14;i++){
    const x=Math.random()*N, y0=N-46+Math.random()*18;
    const len=8+Math.random()*22, a=0.03+Math.random()*0.045;
    g.strokeStyle=`rgba(28,24,18,${a})`; g.lineWidth=2.2+Math.random()*2.5; g.lineCap='round';
    g.beginPath(); g.moveTo(x,y0); g.lineTo(x+(Math.random()-0.5)*4, y0+len); g.stroke();
  }
  for(const sx of [86,258,430]){
    const sy=N*0.48;
    if(Math.random()<0.9){
      const rad=7+Math.random()*9, a=0.04+Math.random()*0.05;
      const grd=g.createRadialGradient(sx,sy,0,sx,sy,rad);
      grd.addColorStop(0,`rgba(18,20,32,${a})`); grd.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=grd; g.beginPath(); g.arc(sx,sy,rad,0,Math.PI*2); g.fill();
    }
  }
  // subtle rust/dirt speckles near seams (warm leak)
  for(let i=0;i<30;i++){
    const sx=[86,258,430][Math.floor(Math.random()*3)] + (Math.random()-0.5)*14;
    const y=Math.random()*N, r=2.5+Math.random()*5.5, a=0.04+Math.random()*0.06;
    g.fillStyle=`rgba(58,38,24,${a})`; g.beginPath(); g.arc(sx,y,r,0,Math.PI*2); g.fill();
  }
  g.restore();
  // fine grain / noise
  for(let i=0;i<1600;i++){ const x=Math.random()*N, y=Math.random()*N; g.fillStyle=`rgba(0,0,0,${Math.random()*0.012})`; g.fillRect(x,y,1,1); }
  for(let i=0;i<42;i++){
    const x=Math.random()*N, y=Math.random()*N, l=10+Math.random()*26;
    g.strokeStyle='rgba(18,24,38,0.022)'; g.lineWidth=0.6;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+l,y); g.stroke();
  }
  const tex=new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(1.05,0.58); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
  // roughness variation — mid 0.78 with jitter + seams rougher
  const rc=document.createElement('canvas'); rc.width=512; rc.height=512;
  const rg=rc.getContext('2d');
  rg.fillStyle='#d3d3d3'; rg.fillRect(0,0,512,512);
  for(let i=0;i<38;i++){
    const x=Math.random()*512, y=Math.random()*512, r=16+Math.random()*44;
    const a=0.08+Math.random()*0.14;
    const shade=Math.random()<0.5?0:255;
    rg.fillStyle=`rgba(${shade},${shade},${shade},${a})`;
    rg.beginPath(); rg.arc(x,y,r,0,Math.PI*2); rg.fill();
  }
  for(let i=0;i<1400;i++){ const x=Math.random()*512, y=Math.random()*512; rg.fillStyle=`rgba(0,0,0,${Math.random()*0.07})`; rg.fillRect(x,y,1,1); }
  // seams rougher (brighter in roughness map)
  rg.strokeStyle='#ececec'; rg.lineWidth=2.2;
  for(let x=86;x<512;x+=172){ rg.beginPath(); rg.moveTo(x,0); rg.lineTo(x,512); rg.stroke(); }
  rg.strokeStyle='#ececec'; rg.lineWidth=1.2;
  rg.beginPath(); rg.moveTo(0,512*0.48); rg.lineTo(512,512*0.48); rg.stroke();
  const roughTex=new THREE.CanvasTexture(rc); roughTex.wrapS=roughTex.wrapT=THREE.RepeatWrapping; roughTex.repeat.set(1.05,0.58); roughTex.anisotropy=8;
  // bump map reused from color luminance variation — subtle
  const bumpTex=new THREE.CanvasTexture(c); bumpTex.wrapS=bumpTex.wrapT=THREE.RepeatWrapping; bumpTex.repeat.set(1.05,0.58); bumpTex.anisotropy=8;
  return { color:tex, rough:roughTex, bump:bumpTex };
}
const wallTexs = makeWallTextures();
// walls (hexagonal) — trim-sheet + bevel/AO + seam/rivet decals
const wallGroup = new THREE.Group();
scene.add(wallGroup);
const wallBodies = []; // for distance darken (mid-distance readability)
// shared small geometries/materials for rivets/bevels (reuse to keep draw calls low)
const rivetGeo = new THREE.BoxGeometry(0.05,0.05,0.02);
const rivetMat = new THREE.MeshStandardMaterial({ color:0x5a6b88, roughness:0.42, metalness:0.72 });
const seamGeo = new THREE.BoxGeometry(0.04, 5.02, 0.03);
const seamMat = new THREE.MeshStandardMaterial({ color:0xc8d3e6, roughness:0.86, metalness:0.04 });
const seamDarkGeo = new THREE.BoxGeometry(0.02, 5.02, 0.035);
const seamDarkMat = new THREE.MeshStandardMaterial({ color:0x1a2338, roughness:0.92, metalness:0.08 });
// Iteration 12: inset chamfered trim-sheet tiles — real geometry chamfer per 1.2-2.4m module (two stacked panels per wall, recessed, with AO dirt at seams) + baked floor-wall junction AO
const insetPanelW = 11.66, insetPanelH = 2.38, insetThick = 0.05;
const insetTopMat = new THREE.MeshStandardMaterial({ map: wallTexs.color, roughnessMap: wallTexs.rough, bumpMap: wallTexs.bump, bumpScale:0.040, color:0xf6f9ff, roughness:0.72, metalness:0.07 });
insetTopMat.map = wallTexs.color.clone(); insetTopMat.map.repeat.set(1.05,0.58); insetTopMat.map.needsUpdate=true;
insetTopMat.roughnessMap = wallTexs.rough.clone(); insetTopMat.roughnessMap.repeat.set(1.05,0.58); insetTopMat.roughnessMap.needsUpdate=true;
insetTopMat.bumpMap = wallTexs.bump.clone(); insetTopMat.bumpMap.repeat.set(1.05,0.58); insetTopMat.bumpMap.needsUpdate=true;
const insetBotMat = new THREE.MeshStandardMaterial({ map: wallTexs.color, roughnessMap: wallTexs.rough, bumpMap: wallTexs.bump, bumpScale:0.040, color:0xd9deeb, roughness:0.81, metalness:0.05 });
insetBotMat.map = wallTexs.color.clone(); insetBotMat.map.repeat.set(1.05,0.58); insetBotMat.map.needsUpdate=true;
insetBotMat.roughnessMap = wallTexs.rough.clone(); insetBotMat.roughnessMap.repeat.set(1.05,0.58); insetBotMat.roughnessMap.needsUpdate=true;
insetBotMat.bumpMap = wallTexs.bump.clone(); insetBotMat.bumpMap.repeat.set(1.05,0.58); insetBotMat.bumpMap.needsUpdate=true;
// vertical panel dividers inside inset (chamfered trim columns ~2.4m module) — shared thin box
const insetVDivGeo = new THREE.BoxGeometry(0.045, insetPanelH, 0.02);
const insetVDivMat = new THREE.MeshStandardMaterial({ color:0xd1d9ea, roughness:0.62, metalness:0.10 });
const insetVDivDarkGeo = new THREE.BoxGeometry(0.022, insetPanelH, 0.025);
const insetVDivDarkMat = new THREE.MeshStandardMaterial({ color:0x182030, roughness:0.92, metalness:0.04 });
// floor-wall baked AO texture — shared 256x64 gradient: dark at wall edge (0.25) fading to transparent over 0.9m
let wallFloorAOTex = null;
{
  const W=256, H=64;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const g=c.getContext('2d');
  g.clearRect(0,0,W,H);
  // vertical gradient along H (0 = at wall, H = toward center) — Multiply dark
  const grd=g.createLinearGradient(0,0,0,H);
  grd.addColorStop(0,'rgba(14,18,30,0.86)');
  grd.addColorStop(0.18,'rgba(14,18,30,0.52)');
  grd.addColorStop(0.42,'rgba(18,22,36,0.24)');
  grd.addColorStop(0.70,'rgba(18,22,36,0.08)');
  grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=grd; g.fillRect(0,0,W,H);
  // break perfect strip with soft dirt blobs along wall edge (baked AO variation)
  for(let i=0;i<28;i++){
    const x=Math.random()*W, y=Math.random()*H*0.45;
    const rx=10+Math.random()*26, ry=4+Math.random()*9;
    const a=0.035+Math.random()*0.06;
    g.fillStyle=`rgba(10,14,24,${a})`;
    g.beginPath(); g.ellipse(x,y,rx,ry, (Math.random()-0.5)*0.5, 0, Math.PI*2); g.fill();
  }
  // faint highlight edge at wall face (bevel catch) — 2px inner line
  g.fillStyle='rgba(205,212,230,0.18)'; g.fillRect(0,0,W,2);
  g.fillStyle='rgba(14,18,30,0.55)'; g.fillRect(0,1,W,1.5);
  wallFloorAOTex=new THREE.CanvasTexture(c); wallFloorAOTex.colorSpace=THREE.SRGBColorSpace; wallFloorAOTex.anisotropy=4;
}
for(let i=0;i<6;i++){
  const ang = i*Math.PI/3;
  const r = arenaRadius-0.6;
  const x = Math.cos(ang)*r, z=Math.sin(ang)*r;
  const w = 12, h=5.5;
  // body with trim-sheet textures
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshStandardMaterial({ map: wallTexs.color, roughnessMap: wallTexs.rough, bumpMap: wallTexs.bump, bumpScale:0.055, color:0xffffff, roughness:0.79, metalness:0.06 }));
  body.position.set(x, h/2, z);
  body.lookAt(0, h/2, 0);
  body.castShadow=true; body.receiveShadow=true;
  wallGroup.add(body); wallBodies.push(body);
  // Iteration 12: inset chamfered trim-sheet tiles — two recessed panels per wall (real geometry chamfer, not tape), ~2.4m module
  for(const [py, mat] of [[3.99, insetTopMat], [1.52, insetBotMat]]){
    const inset = new THREE.Mesh(new THREE.BoxGeometry(insetPanelW, insetPanelH, insetThick), mat);
    inset.position.set(x, py, z);
    inset.lookAt(0, py, 0);
    inset.translateZ(0.262);
    inset.castShadow=true; inset.receiveShadow=true;
    wallGroup.add(inset);
    // vertical mullions per 2.9m module (4 columns across 11.66m) — thin highlight + dark cavity pair for 45° chamfer read
    for(const off of [-2.915, 0, 2.915]){
      const vx = x + (-Math.sin(ang))*off;
      const vz = z + (Math.cos(ang))*off;
      const div = new THREE.Mesh(insetVDivGeo, insetVDivMat);
      div.position.set(vx, py, vz);
      div.lookAt(0, py, 0);
      div.translateZ(0.283);
      div.translateX(0.012);
      wallGroup.add(div);
      const divDark = new THREE.Mesh(insetVDivDarkGeo, insetVDivDarkMat);
      divDark.position.set(vx, py, vz);
      divDark.lookAt(0, py, 0);
      divDark.translateZ(0.285);
      divDark.translateX(-0.014);
      wallGroup.add(divDark);
    }
    // subtle chamfer edge highlight along inset top/bottom perimeter (catches directional sun)
    const hEdgeMat = new THREE.MeshStandardMaterial({ color:0xeef4ff, roughness:0.42, metalness:0.09 });
    const topEdge = new THREE.Mesh(new THREE.BoxGeometry(insetPanelW+0.02, 0.016, 0.025), hEdgeMat);
    topEdge.position.set(x, py + insetPanelH/2 - 0.008, z);
    topEdge.lookAt(0, py + insetPanelH/2 - 0.008, 0);
    topEdge.translateZ(0.285);
    wallGroup.add(topEdge);
    const botEdgeDark = new THREE.Mesh(new THREE.BoxGeometry(insetPanelW+0.02, 0.018, 0.025), new THREE.MeshStandardMaterial({ color:0x182030, roughness:0.92, metalness:0.04 }));
    botEdgeDark.position.set(x, py - insetPanelH/2 + 0.009, z);
    botEdgeDark.lookAt(0, py - insetPanelH/2 + 0.009, 0);
    botEdgeDark.translateZ(0.286);
    wallGroup.add(botEdgeDark);
  }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.62), new THREE.MeshStandardMaterial({ color:0x1f2636, roughness:0.72, metalness:0.32 }));
  kick.position.set(x, 0.09, z);
  kick.lookAt(0, 0.09, 0);
  wallGroup.add(kick);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.62), new THREE.MeshStandardMaterial({ color:0xe86a1a, roughness:0.65, metalness:0.08 }));
  stripe.position.set(x, 1.1, z);
  stripe.lookAt(0, 1.1, 0);
  wallGroup.add(stripe);
  // light cap trim — Iteration 11: Halo trim cap variation (alternating cooler/warmer whites like authored trim cap, not uniform 0xf0f4f8)
  const capIsCool = (i & 1)===0;
  const capCol = capIsCool ? 0xf1f5fa : 0xe8ecf2;
  const capRough = capIsCool ? 0.42 : 0.50;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.62), new THREE.MeshStandardMaterial({ color:capCol, roughness:capRough, metalness:0.09 }));
  cap.position.set(x, h-0.11, z);
  cap.lookAt(0, h-0.11, 0);
  wallGroup.add(cap);
  // bevel chamfers — thin lighter highlight on top edge, darker cavity at bottom edge above kick
  const bevelTop = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.038, 0.64), new THREE.MeshStandardMaterial({ color:0xf2f6fb, roughness:0.42, metalness:0.10 }));
  bevelTop.position.set(x, h-0.235, z);
  bevelTop.lookAt(0, h-0.235, 0);
  wallGroup.add(bevelTop);
  // iteration 6: extra highlight — slightly brighter top edge (specular catch like Halo authored bevel hi-light)
  const bevelHi = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.016, 0.645), new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.28, metalness:0.14 }));
  bevelHi.position.set(x, h-0.212, z);
  bevelHi.lookAt(0, h-0.212, 0);
  wallGroup.add(bevelHi);
  // iteration 8: cavity AO darkening strip right under top bevel (simulates chamfer shadow / aoMap where wall meets cap)
  const wallCavityAO = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.055, 0.04), new THREE.MeshStandardMaterial({ color:0x182030, roughness:0.92, metalness:0.04 }));
  wallCavityAO.position.set(x, h-0.275, z);
  wallCavityAO.lookAt(0, h-0.275, 0);
  wallCavityAO.translateZ(0.31);
  wallGroup.add(wallCavityAO);
  // Iteration 10: extra wall panel highlight variation — subtle brighter top panel vs bottom (Halo trim-sheet didactic albedo: top ~0.86 vs bottom ~0.80, no external textures)
  const topPanelVar = new THREE.Mesh(new THREE.BoxGeometry(w*0.97, h*0.44, 0.015), new THREE.MeshStandardMaterial({ color:0xeef4ff, roughness:0.66, metalness:0.08, transparent:true, opacity:0.18 }));
  topPanelVar.position.set(x, h*0.735, z);
  topPanelVar.lookAt(0, h*0.735, 0);
  topPanelVar.translateZ(0.306);
  wallGroup.add(topPanelVar);
  const botPanelWash = new THREE.Mesh(new THREE.BoxGeometry(w*0.97, h*0.44, 0.015), new THREE.MeshStandardMaterial({ color:0xd9e2f3, roughness:0.78, metalness:0.05, transparent:true, opacity:0.09 }));
  botPanelWash.position.set(x, h*0.24, z);
  botPanelWash.lookAt(0, h*0.24, 0);
  botPanelWash.translateZ(0.305);
  wallGroup.add(botPanelWash);
  // iteration 7: Halo neon wayfinding — thin emissive trim along top edge (reads at distance, not color spam)
  const neonTrim = new THREE.Mesh(new THREE.BoxGeometry(w*0.94, 0.028, 0.04), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.45 }));
  neonTrim.position.set(x, h-0.46, z);
  neonTrim.lookAt(0, h-0.46, 0);
  neonTrim.translateZ(0.33);
  wallGroup.add(neonTrim);
  wallNeonTrims.push(neonTrim);
  // iteration 9: wall mid-seam cavity + highlight — extra dark line at ~2.68m panel break (authored 45° chamfer AO), plus subtle catch light
  const midCavity = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.05, 0.04), new THREE.MeshStandardMaterial({ color:0x182030, roughness:0.94, metalness:0.04 }));
  midCavity.position.set(x, h*0.50 - 0.015, z);
  midCavity.lookAt(0, h*0.50 - 0.015, 0);
  midCavity.translateZ(0.311);
  wallGroup.add(midCavity);
  const midHi = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.014, 0.045), new THREE.MeshStandardMaterial({ color:0xe8eef7, roughness:0.42, metalness:0.08 }));
  midHi.position.set(x, h*0.50 + 0.027, z);
  midHi.lookAt(0, h*0.50 + 0.027, 0);
  midHi.translateZ(0.313);
  wallGroup.add(midHi);
  // iteration 9: floor-wall junction cavity — additional dark strip where wall meets kick/soffit, deepens AO like Halo skirting
  const floorWallCavity = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.036, 0.04), new THREE.MeshStandardMaterial({ color:0x0f1420, roughness:0.96, metalness:0.05 }));
  floorWallCavity.position.set(x, 0.168, z);
  floorWallCavity.lookAt(0, 0.168, 0);
  floorWallCavity.translateZ(0.314);
  wallGroup.add(floorWallCavity);
  const floorWallHi = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.012, 0.045), new THREE.MeshStandardMaterial({ color:0xd7deea, roughness:0.48, metalness:0.09 }));
  floorWallHi.position.set(x, 0.192, z);
  floorWallHi.lookAt(0, 0.192, 0);
  floorWallHi.translateZ(0.316);
  wallGroup.add(floorWallHi);
  const bevelBot = new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.042, 0.66), new THREE.MeshStandardMaterial({ color:0xc2cddd, roughness:0.84, metalness:0.05 }));
  bevelBot.position.set(x, 0.205, z);
  bevelBot.lookAt(0, 0.205, 0);
  wallGroup.add(bevelBot);
  // vertical seam decals — two interior seams per wall (breaks pastel flatness, hints trim-sheet joints)
  for(const off of [-3.55, 3.55]){
    const sx = x + (-Math.sin(ang))*off;
    const sz = z + (Math.cos(ang))*off;
    const seam = new THREE.Mesh(seamGeo, seamMat);
    seam.position.set(sx, h/2, sz);
    seam.lookAt(0, h/2, 0);
    seam.translateZ(0.31);
    wallGroup.add(seam);
    const seamDark = new THREE.Mesh(seamDarkGeo, seamDarkMat);
    seamDark.position.set(sx, h/2, sz);
    seamDark.lookAt(0, h/2, 0);
    seamDark.translateZ(0.312);
    seamDark.translateX(-0.015);
    wallGroup.add(seamDark);
  }
  // corner rivets + mid-height bolts along bottom and top rail (small BoxGeometry = Halo bevel screws)
  const rivetYs = [0.28, h-0.42];
  const rivetXs = [-5.65, -1.85, 1.85, 5.65];
  for(const ry of rivetYs){
    for(const rx of rivetXs){
      const rxW = x + (-Math.sin(ang))*rx;
      const rzW = z + (Math.cos(ang))*rx;
      const riv = new THREE.Mesh(rivetGeo, rivetMat);
      riv.position.set(rxW, ry, rzW);
      riv.lookAt(0, ry, 0);
      riv.translateZ(0.32);
      wallGroup.add(riv);
    }
  }
  // vertical corner bevels (chamfer strips at wall ends)
  for(const off of [-5.98, 5.98]){
    const ex = x + (-Math.sin(ang))*off;
    const ez = z + (Math.cos(ang))*off;
    const vBevel = new THREE.Mesh(new THREE.BoxGeometry(0.06, h-0.32, 0.04), new THREE.MeshStandardMaterial({ color:0xd7deea, roughness:0.62, metalness:0.12 }));
    vBevel.position.set(ex, h/2, ez);
    vBevel.lookAt(0, h/2, 0);
    vBevel.translateZ(0.30);
    wallGroup.add(vBevel);
  }
  // single orange wayfinding marker per long wall not neon spam
  if(i===0){
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 0.04), new THREE.MeshStandardMaterial({ color:0xe86a1a, emissive:0xe86a1a, emissiveIntensity:0.35 }));
    marker.position.set(x, 2.2, z);
    marker.lookAt(0, 2.2, 0);
    marker.translateZ(0.32);
    scene.add(marker);
  }
  // Iteration 12: baked AO shadow plane at floor-wall junction — concave junction darken (Halo baked/HBAO) over 0.9m sweep, 0.15-0.25 effective multiply
  {
    const aoMat = new THREE.MeshBasicMaterial({ map: wallFloorAOTex, transparent:true, opacity:0.38, depthWrite:false, blending:THREE.MultiplyBlending, premultipliedAlpha:true });
    aoMat.polygonOffset=true; aoMat.polygonOffsetFactor=-1.2;
    const aoW = w + 0.8, aoD = 0.92;
    // plane center ~0.46m inward from wall face (face at r-0.30)
    const faceR = r - 0.30;
    const centerR = faceR - aoD/2;
    const cx = Math.cos(ang)*centerR, cz = Math.sin(ang)*centerR;
    const aoGroup2 = new THREE.Group();
    aoGroup2.position.set(cx, 0.018, cz);
    aoGroup2.lookAt(0, 0.018, 0);
    const aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(aoW, aoD), aoMat);
    aoPlane.rotation.x = -Math.PI/2;
    aoPlane.renderOrder = 3;
    aoGroup2.add(aoPlane);
    scene.add(aoGroup2);
    // extra narrow core-contact dark line right at foot (crispy cavity like Halo trim skirting, 0.18m band)
    const coreMat = new THREE.MeshBasicMaterial({ color:0x0f1420, transparent:true, opacity:0.22, depthWrite:false, blending:THREE.MultiplyBlending });
    coreMat.polygonOffset=true; coreMat.polygonOffsetFactor=-1.3;
    const coreW = w + 0.62, coreD = 0.18;
    const coreR = faceR - coreD/2 + 0.02;
    const ccx = Math.cos(ang)*coreR, ccz = Math.sin(ang)*coreR;
    const coreGroup = new THREE.Group();
    coreGroup.position.set(ccx, 0.019, ccz);
    coreGroup.lookAt(0, 0.019, 0);
    const corePlane = new THREE.Mesh(new THREE.PlaneGeometry(coreW, coreD), coreMat);
    corePlane.rotation.x = -Math.PI/2;
    corePlane.renderOrder = 4;
    coreGroup.add(corePlane);
    scene.add(coreGroup);
  }
  // pillar with AO base
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.48, h, 12), new THREE.MeshStandardMaterial({ color:0xe0e8f2, roughness:0.58, metalness:0.14 }));
  pillar.position.set(Math.cos(ang+Math.PI/6)*(r-1.2), h/2, Math.sin(ang+Math.PI/6)*(r-1.2));
  pillar.castShadow=true;
  wallGroup.add(pillar);
  // wall base + pillar contact AO
  addContactAO(new THREE.Vector3(x,0,z), 6.5, 1.25, 0.18);
  addContactAO(new THREE.Vector3(Math.cos(ang+Math.PI/6)*(r-1.2),0, Math.sin(ang+Math.PI/6)*(r-1.2)), 1.45, 1.45, 0.32);
}
// central reactor
const reactor = new THREE.Group();
const core = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,2.2, 16), new THREE.MeshStandardMaterial({ color:0x0a1f3d, emissive:0x00e0ff, emissiveIntensity:0.6, metalness:0.7, roughness:0.3 }));
core.position.y=1.1;
reactor.add(core);
const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,2.4, 16), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.5, transparent:true, opacity:0.9 }));
coreGlow.position.y=1.2;
reactor.add(coreGlow);
const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6,0.08,12,32), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff3b82, emissiveIntensity:1.2 }));
halo.rotation.x=Math.PI/2; halo.position.y=0.5;
reactor.add(halo);
const halo2 = halo.clone(); halo2.position.y=1.9; halo2.scale.set(1.15,1.15,1);
  reactor.add(halo2);
scene.add(reactor);
addContactAO(new THREE.Vector3(0,0,0), 3.4, 3.4, 0.42);

// crates as cover — Halo verticality: flat crates → 2-high stacks + mid Walls for head-glitch cover
const crates = [];
// iteration 9: subtle crate emissive pulse variation for wayfinding without new textures (each stack/crate breathes slightly out-of-phase)
const cratePulseData = [];
function ensureCrateEmissive(mesh){
  const isWarm = Math.random() < 0.22;
  const col = isWarm ? new THREE.Color(0xff7a2a) : new THREE.Color(0x1ec4ff);
  col.multiplyScalar(0.82);
  mesh.traverse(o=>{
    if(o.isMesh && o.material){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m=>{
        if(!m.emissive) m.emissive = col.clone();
        else if(m.emissive.getHex()===0) m.emissive.copy(col);
        else m.emissive.lerp(col, 0.32);
        if(m.emissiveIntensity===0 || m.emissiveIntensity===undefined) m.emissiveIntensity = 0.10;
        // clone so per-crate intensity not shared
        if(m.userData && m.userData.crateBase===undefined){
          // mark cloned
        }
      });
    }
  });
}
function registerCratePulse(mesh){
  ensureCrateEmissive(mesh);
  // clone mats per crate so emissiveIntensity is instance-local
  const mats=[];
  mesh.traverse(o=>{
    if(o.isMesh && o.material){
      const isArr = Array.isArray(o.material);
      const src = isArr ? o.material : [o.material];
      const cloned = src.map(m=>{
        if(!m) return m;
        const nm = m.clone();
        nm.userData = { ...(m.userData||{}) };
        if(nm.userData.crateBase===undefined) nm.userData.crateBase = nm.emissiveIntensity ?? 0.11;
        // slight per-crate brightness jitter like Halo authored emissive variation
        nm.userData.crateBase *= (0.86 + Math.random()*0.32);
        // occasional warmer crates pop for wayfinding
        if(Math.random()<0.18) nm.emissive.setHex(0xff8a2a);
        mats.push(nm);
        return nm;
      });
      o.material = isArr ? cloned : cloned[0];
    }
  });
  if(mats.length){
    cratePulseData.push({ mats, phase: Math.random()*Math.PI*2, amp: 0.28 + Math.random()*0.22, speed: 0.85 + Math.random()*0.55 });
  }
}
function addCrate(pos, scale=1){
  let mesh;
  if(crateTemplate){
    mesh = crateTemplate.clone(true);
    mesh.scale.setScalar(0.015*scale*1.2); // crate is tiny original -> scale up
    // normalize spec gloss already converted; ensure materials respond
    mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.needsUpdate=true; } }});
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2*scale,1.1*scale,1.2*scale), new THREE.MeshStandardMaterial({ color:0x2a3a5a, emissive:0x00c8ff, emissiveIntensity:0.15, roughness:0.7, metalness:0.4 }));
  }
  mesh.position.copy(pos);
  mesh.position.y = 0.55*scale;
  // add collision radius
  mesh.userData.radius = 0.9*scale;
  registerCratePulse(mesh);
  scene.add(mesh);
  crates.push(mesh);
  addContactAO(pos, 1.55*scale, 1.55*scale, 0.34);
  // removed per-crate point light soup — kept for 2 largest crates only for subtle wayfinding
  if(scale>1.3){
    const l = new THREE.PointLight(0x7af2ff, 1.2, 5);
    l.position.copy(pos); l.position.y=1.1;
    scene.add(l);
  }
}
function addStack(basePos, levels=2, scale=1){
  const lift = 1.02*scale; // crate height ≈1.1*scale, slight overlap for contact
  for(let i=0;i<levels;i++){
    let mesh;
    if(crateTemplate){
      mesh = crateTemplate.clone(true);
      mesh.scale.setScalar(0.015*scale*1.2);
      mesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; }});
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2*scale,1.1*scale,1.2*scale), new THREE.MeshStandardMaterial({ color:0x2a3a5a, emissive:0x00c8ff, emissiveIntensity:0.15, roughness:0.7, metalness:0.4 }));
    }
    mesh.position.copy(basePos);
    mesh.position.y = 0.55*scale + i*lift;
    mesh.rotation.y = (Math.random()-0.5)*0.35;
    mesh.userData.radius = 0.9*scale;
    // subtle color temp variation per level for Halo kit-bash read
    mesh.traverse?.(o=>{ if(o.isMesh && o.material && o.material.color){ o.material = o.material.clone(); o.material.color.offsetHSL(0,0, i===1 ? 0.06 : 0); }});
    registerCratePulse(mesh);
    scene.add(mesh);
    crates.push(mesh);
  }
  addContactAO(basePos, 1.5*scale, 1.5*scale, 0.36);
  // stack collision proxy (taller)
  crates[crates.length-1].userData.stackHeight = levels*lift;
}
function addCoverWall(pos, yawRad=0, len=3.0, h=1.45){
  // Halo-style mid cover wall: high-albedo hard-surface + metal trim + neon top strip
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.52), new THREE.MeshStandardMaterial({ color:0xdbe6ff, roughness:0.55, metalness:0.18 }));
  body.position.y=h/2; body.castShadow=true; body.receiveShadow=true;
  g.add(body);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(len+0.06, 0.12, 0.56), new THREE.MeshStandardMaterial({ color:0x182a44, roughness:0.45, metalness:0.45 }));
  trim.position.y=0.14; g.add(trim);
  const neon=new THREE.Mesh(new THREE.BoxGeometry(len*0.88, 0.04, 0.06), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:1.6 }));
  neon.position.set(0, h-0.08, 0.27); g.add(neon);
  g.position.copy(pos); g.position.y=0;
  g.rotation.y=yawRad;
  // collision radius approx
  g.userData.radius = Math.max(len,0.9)/2;
  scene.add(g); crates.push(g);
  addContactAO(pos, len*1.08, 1.25, 0.30);
}
// elevated platforms — Halo verticality (Beaver Creek / Lockout style top lanes) + floor cavity AO
const platforms=[]; // {pos,yaw,w,d,h}
function isInsidePlatform(x,z,plat){
  // yaw-aware rect test (inverse rotate)
  const dx=x-plat.pos.x, dz=z-plat.pos.z;
  const c=Math.cos(-plat.yaw), s=Math.sin(-plat.yaw);
  const lx=dx*c - dz*s, lz=dx*s + dz*c;
  return Math.abs(lx) < plat.w/2 + 0.12 && Math.abs(lz) < plat.d/2 + 0.12;
}
function createElevatedPlatform(pos, yawRad=0, w=3.5, d=2.0, h=1.2){
  const g=new THREE.Group();
  g.position.copy(pos); g.position.y=0; g.rotation.y=yawRad;
  // main body — reuses wall trim-sheet material for hard-surface coherence
  const bodyMat = new THREE.MeshStandardMaterial({ map: wallTexs.color, roughnessMap: wallTexs.rough, bumpMap: wallTexs.bump, bumpScale:0.055, color:0xffffff, roughness:0.78, metalness:0.08 });
  // clone canvas repeat tweak so platform top not obviously same tiling as walls
  bodyMat.map = wallTexs.color.clone(); bodyMat.map.repeat.set(0.85,0.48); bodyMat.map.needsUpdate=true;
  bodyMat.roughnessMap = wallTexs.rough.clone(); bodyMat.roughnessMap.repeat.set(0.85,0.48); bodyMat.roughnessMap.needsUpdate=true;
  const body=new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y=h/2; body.castShadow=true; body.receiveShadow=true;
  g.add(body);
  // top plate — slightly brighter rim vs wall sides (Halo didactic top vs shadowed sides)
  const topPlate=new THREE.Mesh(new THREE.BoxGeometry(w+0.02, 0.05, d+0.02), new THREE.MeshStandardMaterial({ color:0xe8edf5, roughness:0.52, metalness:0.12 }));
  topPlate.position.y=h-0.025; topPlate.receiveShadow=true;
  g.add(topPlate);
  // bevel highlight — light chamfer on top edge (matches wall bevelTop 0xf2f6fb)
  const bevelT=new THREE.Mesh(new THREE.BoxGeometry(w+0.04, 0.04, d+0.04), new THREE.MeshStandardMaterial({ color:0xf2f6fb, roughness:0.42, metalness:0.10 }));
  bevelT.position.y=h-0.06;
  g.add(bevelT);
  // bottom cavity dark kick — like wall bevelBot but inset
  const kick=new THREE.Mesh(new THREE.BoxGeometry(w+0.03, 0.10, d+0.03), new THREE.MeshStandardMaterial({ color:0x1f2636, roughness:0.68, metalness:0.28 }));
  kick.position.y=0.05;
  g.add(kick);
  const cave=new THREE.Mesh(new THREE.BoxGeometry(w+0.04, 0.04, d+0.04), new THREE.MeshStandardMaterial({ color:0xc2cddd, roughness:0.84, metalness:0.05 }));
  cave.position.y=0.12;
  g.add(cave);
  // edge trim — orange wayfinding strip along front long edge (reads at distance)
  const frontTrim=new THREE.Mesh(new THREE.BoxGeometry(w*0.92, 0.06, 0.04), new THREE.MeshStandardMaterial({ color:0xe86a1a, roughness:0.55, metalness:0.12 }));
  frontTrim.position.set(0, h-0.09, d/2+0.02);
  g.add(frontTrim);
  // seam line across platform top (panel joint)
  const topSeam=new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, 0.04), new THREE.MeshStandardMaterial({ color:0xc8d3e6, roughness:0.86, metalness:0.04 }));
  topSeam.position.set(0, h+0.028, 0);
  g.add(topSeam);
  const topSeamDark=new THREE.Mesh(new THREE.BoxGeometry(w, 0.015, 0.02), new THREE.MeshStandardMaterial({ color:0x1a2338, roughness:0.92, metalness:0.08 }));
  topSeamDark.position.set(0, h+0.026, 0.015);
  g.add(topSeamDark);
  // rivets along top perimeter (reuse shared rivetGeo/mat)
  const rxOffs=[-w/2+0.16, w/2-0.16], rzOffs=[-d/2+0.16, d/2-0.16];
  for(const rx of rxOffs) for(const rz of rzOffs){
    const riv=new THREE.Mesh(rivetGeo, rivetMat);
    riv.position.set(rx, h-0.04, rz);
    g.add(riv);
  }
  // mid-edge rivets
  for(const rx of [-w/4, w/4]){
    const r1=new THREE.Mesh(rivetGeo, rivetMat); r1.position.set(rx, h-0.04, d/2-0.08); g.add(r1);
    const r2=new THREE.Mesh(rivetGeo, rivetMat); r2.position.set(rx, h-0.04, -d/2+0.08); g.add(r2);
  }
  // side face vertical edge bevels (chamfer strips matching wall vBevel)
  for(const off of [-w/2+0.02, w/2-0.02]){
    const v=new THREE.Mesh(new THREE.BoxGeometry(0.05, h-0.22, 0.04), new THREE.MeshStandardMaterial({ color:0xd7deea, roughness:0.62, metalness:0.12 }));
    v.position.set(off, h/2, d/2-0.02); g.add(v);
    const v2=v.clone(); v2.position.set(off, h/2, -d/2+0.02); g.add(v2);
  }
  // two-step staircase on the southern short side (accessible walk-up; south = -z in local)
  const step1=new THREE.Mesh(new THREE.BoxGeometry(w*0.62, 0.40, 0.62), new THREE.MeshStandardMaterial({ color:0xdbe6ff, roughness:0.58, metalness:0.14 }));
  step1.position.set(0, 0.20, -d/2 - 0.42); step1.receiveShadow=true; step1.castShadow=true; g.add(step1);
  const step2=new THREE.Mesh(new THREE.BoxGeometry(w*0.62, 0.80, 0.62), new THREE.MeshStandardMaterial({ color:0xdbe6ff, roughness:0.58, metalness:0.14 }));
  step2.position.set(0, 0.40, -d/2 + 0.18); step2.receiveShadow=true; step2.castShadow=true; g.add(step2);
  // step bevel highlights
  const sBevel1=new THREE.Mesh(new THREE.BoxGeometry(w*0.63, 0.03, 0.64), new THREE.MeshStandardMaterial({ color:0xf2f6fb, roughness:0.42, metalness:0.10 }));
  sBevel1.position.set(0, 0.40, -d/2 - 0.42); g.add(sBevel1);
  const sBevel2=new THREE.Mesh(new THREE.BoxGeometry(w*0.63, 0.03, 0.64), new THREE.MeshStandardMaterial({ color:0xf2f6fb, roughness:0.42, metalness:0.10 }));
  sBevel2.position.set(0, 0.81, -d/2 + 0.18); g.add(sBevel2);
  scene.add(g);
  // collision + platform record
  g.userData.radius = Math.max(w,d)/1.6;
  crates.push(g);
  platforms.push({pos:pos.clone(), yaw:yawRad, w, d, h, group:g});
  // floor AO: broad contact under platform + thin cavity planes along 4 edges (fake cavity AO)
  addContactAO(pos, w*1.08, d*1.08, 0.36);
  const edgeAOmat = new THREE.MeshBasicMaterial({ color:0x182030, transparent:true, opacity:0.14, depthWrite:false, blending:THREE.MultiplyBlending, premultipliedAlpha:true });
  edgeAOmat.polygonOffset=true; edgeAOmat.polygonOffsetFactor=-0.8;
  const thickness=0.28;
  // we need world positions for AO planes; use group transform by creating child planes inside g but at y=0.018 (just above floor local)
  // Actually create world-space AO planes as children of scene for stable blending; compute via pos/yaw offsets
  function addEdgeAO(localX, localZ, sx, sz){
    const geo=new THREE.PlaneGeometry(sx, sz);
    const m=new THREE.Mesh(geo, edgeAOmat.clone());
    m.rotation.x=-Math.PI/2;
    // local to world
    const c=Math.cos(yawRad), s=Math.sin(yawRad);
    const wx=pos.x + localX*c - localZ*s;
    const wz=pos.z + localX*s + localZ*c;
    m.position.set(wx, 0.018, wz);
    m.renderOrder=1;
    scene.add(m);
  }
  // along 4 sides (outside just beyond the kick)
  addEdgeAO(0, d/2 + 0.18, w+0.6, thickness);
  addEdgeAO(0, -d/2 - 0.72 - 0.05, w+0.6, thickness+0.18); // extended for steps footprint (two steps depth 1.24)
  addEdgeAO(-w/2 - 0.18, 0, thickness, d);
  addEdgeAO(w/2 + 0.18, 0, thickness, d);
  // extra darkening strip right under the kick (inner cavity line)
  const innerMat=new THREE.MeshBasicMaterial({ color:0x0f1420, transparent:true, opacity:0.18, depthWrite:false, blending:THREE.MultiplyBlending, premultipliedAlpha:true });
  innerMat.polygonOffset=true; innerMat.polygonOffsetFactor=-0.9;
  function addInnerStrip(lx,lz,sx,sz){
    const geo=new THREE.PlaneGeometry(sx, sz);
    const mm=new THREE.Mesh(geo, innerMat.clone());
    mm.rotation.x=-Math.PI/2;
    const c=Math.cos(yawRad), s=Math.sin(yawRad);
    const wx=pos.x + lx*c - lz*s;
    const wz=pos.z + lx*s + lz*c;
    mm.position.set(wx, 0.020, wz);
    mm.renderOrder=1;
    scene.add(mm);
  }
  addInnerStrip(0, d/2+0.05, w+0.08, 0.10);
  addInnerStrip(0, -d/2-0.05, w*0.62+0.08, 0.10);
}
const cratePositions = [
  new THREE.Vector3(6,0,5), new THREE.Vector3(-5,0,7), new THREE.Vector3(8,0,-4),
  new THREE.Vector3(-7,0,-5), new THREE.Vector3(0,0,9), new THREE.Vector3(0,0,-9),
  new THREE.Vector3(9,0,0), new THREE.Vector3(-9,0,0), new THREE.Vector3(4,0,-7),
  new THREE.Vector3(-4,0,7)
];
cratePositions.forEach(p=>addCrate(p, 0.9+Math.random()*0.4));
addCrate(new THREE.Vector3(3,0,0),1.6);
addCrate(new THREE.Vector3(-3,0,-2),1.4);
// Halo vertical loop — 2-high stacks visible from spawn (0,1.7,8) looking inward
addStack(new THREE.Vector3(5.2,0,-2.4), 2, 1.05);
addStack(new THREE.Vector3(-5.0,0,2.8), 2, 1.05);
addStack(new THREE.Vector3(1.2,0,-6.2), 2, 1.08);
addStack(new THREE.Vector3(-1.8,0,5.8), 2, 0.98);
// 2 mid walls for head-glitch lanes (Streets/The Pit style)
addCoverWall(new THREE.Vector3(2.2,0,3.2), 0.55, 3.2, 1.45);
addCoverWall(new THREE.Vector3(-2.6,0,-3.6), -0.55, 3.2, 1.45);
// two elevated walkway platforms — 1.2m high, 3.5×2.0m at opposite ends near walls (verticality + arena lane)
createElevatedPlatform(new THREE.Vector3(0,0,12.8), 0, 3.5, 2.0, 1.2);
createElevatedPlatform(new THREE.Vector3(0,0,-12.8), Math.PI, 3.5, 2.0, 1.2);

// weapon viewmodel — Halo: smaller silhouette, readable vs bright floor
const viewWeapon = new THREE.Group();
camera.add(viewWeapon);
viewWeapon.position.set(0.32, -0.22, -0.48);
viewWeapon.rotation.set(0, -0.05, 0);
let weaponMesh=null;
// Halo-grade weapon feel state
let recoilKick=0, recoilYaw=0, flashTime=0, shakeTime=0;
let hitShakeTime=0, hitShakeAmp=0;
let muzzleFlash=null, muzzleLight=null, muzzleCore=null;
const baseWeaponPos = new THREE.Vector3(0.32, -0.22, -0.48);
const baseWeaponRot = new THREE.Euler(0, -0.05, 0);
// inertia sway + breathing
let swayX=0, swayY=0, swayTX=0, swayTY=0;
function setupWeapon(){
  if(weaponTemplate){
    weaponMesh = weaponTemplate.clone(true);
    weaponMesh.scale.setScalar(0.095);
    weaponMesh.rotation.set(0, Math.PI, 0);
    weaponMesh.position.set(0, -0.04, 0);
    weaponMesh.traverse(o=>{ if(o.isMesh){ o.castShadow=true; if(o.material){ o.material.metalness=0.35; o.material.roughness=0.45; }}});
    viewWeapon.add(weaponMesh);
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0.05,-1.05);
  } else {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.55), new THREE.MeshStandardMaterial({ color:0x1a2a44, metalness:0.7, roughness:0.35 }));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.65,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:0.6, metalness:0.8, roughness:0.2 }));
    barrel.rotation.x=Math.PI/2; barrel.position.set(0,0,-0.55);
    g.add(body); g.add(barrel);
    viewWeapon.add(g);
    weaponMesh=g;
    weaponMesh.userData.muzzle = new THREE.Vector3(0,0,-0.9);
  }
  // subtle emissive glow
  const glow = new THREE.PointLight(0x7af2ff, 6, 3);
  glow.position.set(0,0,-0.7);
  viewWeapon.add(glow);
  // Halo-style muzzle flash: additive cone + core sprite + point light at barrel tip
  muzzleFlash = new THREE.Group();
  muzzleFlash.position.set(0, -0.02, -0.88);
  viewWeapon.add(muzzleFlash);
  const coneGeo = new THREE.ConeGeometry(0.11, 0.26, 12, 1, true);
  coneGeo.rotateX(-Math.PI/2);
  coneGeo.translate(0,0,-0.13);
  muzzleCore = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color:0xfff0a0, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending }));
  muzzleFlash.add(muzzleCore);
  const ringGeo = new THREE.RingGeometry(0.03, 0.085, 12);
  // ring faces forward
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending }));
  ring.position.set(0,0,-0.18);
  ring.lookAt(0,0,-1);
  ring.userData.isRing=true;
  muzzleFlash.add(ring);
  muzzleLight = new THREE.PointLight(0x8ef0ff, 0, 4.5);
  muzzleLight.intensity=0;
  muzzleLight.position.set(0,0,-0.88);
  viewWeapon.add(muzzleLight);
}

// game state
let health=100, shield=50, score=0, wave=1, enemiesAlive=0, alive=true, started=false, time=0;
let heat=0, overheat=false;
const maxHealth=100, maxShield=50;
let kills=0, damageDealt=0;
let keys={}, sprint=false;
let velocity = new THREE.Vector3();
let dashCooldown=0, dashTime=0;
let enemyList=[], bulletList=[], particleList=[], pickupList=[];
let waveTimer=60, spawnCooldown=0;

function updateHUD(){
  hpEl.textContent=Math.ceil(health);
  shieldEl.textContent=Math.ceil(shield);
  hpbar.style.width = (health/maxHealth*100)+'%';
  shieldbar.style.width = (shield/maxShield*100)+'%';
  scoreEl.textContent=score;
  waveEl.textContent=wave;
  enemiesEl.textContent=enemyList.length;
}

function flashHit(){ hitEl.classList.remove('show'); void hitEl.offsetWidth; hitEl.classList.add('show'); }

// input
addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=true;
  if(e.code==='KeyR') resetGame();
  if(e.code==='Space'){ e.preventDefault(); tryDash(); }
});
addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='ShiftLeft' || e.code==='ShiftRight') sprint=false;
});
canvas.addEventListener('click', ()=>{
  if(!started) return;
  if(!pointerLocked) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', ()=>{
  pointerLocked = document.pointerLockElement===canvas;
});
addEventListener('mousemove', e=>{
  if(!started) return;
  const sens=0.0022;
  if(pointerLocked){
    yaw -= e.movementX*sens;
    pitch -= e.movementY*sens;
    // weapon inertia — push opposite to look, clamped like Halo
    swayTX += THREE.MathUtils.clamp(e.movementX*0.00055, -0.06, 0.06);
    swayTY += THREE.MathUtils.clamp(e.movementY*0.00055, -0.045, 0.045);
    swayTX = THREE.MathUtils.clamp(swayTX,-0.09,0.09);
    swayTY = THREE.MathUtils.clamp(swayTY,-0.07,0.07);
  } else if(e.buttons===1 && /Mobi|Android/i.test(navigator.userAgent)){
    yaw -= e.movementX*sens*1.2;
    pitch -= e.movementY*sens*1.2;
  }
  pitch=Math.max(-1.35,Math.min(1.35,pitch));
});

// mobile joystick
const joy=document.getElementById('joy'), stick=document.getElementById('stick'), mFire=document.getElementById('mFire'), mDash=document.getElementById('mDash'), mobileWrap=document.getElementById('mobile');
let joyVec={x:0,y:0}, joyActive=false, touchLookId=null, lastTouchX=0, lastTouchY=0;
function isMobile(){ return /Mobi|Android/i.test(navigator.userAgent) || innerWidth<700; }
if(isMobile()){ mobileWrap.style.display='flex'; }
function joyPos(e){
  const r=joy.getBoundingClientRect(); const t=e.touches?e.touches[0]:e;
  const x=t.clientX-(r.left+r.width/2), y=t.clientY-(r.top+r.height/2);
  const d=Math.hypot(x,y), max=44; const c=Math.min(1,d/max);
  const nx=d?x/d:0, ny=d?y/d:0;
  joyVec.x=nx*c; joyVec.y=ny*c;
  stick.style.transform=`translate(calc(-50% + ${nx*c*max}px), calc(-50% + ${ny*c*max}px))`;
}
joy.addEventListener('touchstart', e=>{ joyActive=true; joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchmove', e=>{ if(joyActive) joyPos(e); e.preventDefault(); },{passive:false});
joy.addEventListener('touchend', ()=>{ joyActive=false; joyVec={x:0,y:0}; stick.style.transform='translate(-50%,-50%)'; });
canvas.addEventListener('touchstart', e=>{
  if(e.touches.length===1){
    const t=e.touches[0];
    if(t.clientX>innerWidth*0.35) { lastTouchX=t.clientX; lastTouchY=t.clientY; touchLookId=t.identifier; }
  }
});
canvas.addEventListener('touchmove', e=>{
  for(const t of e.touches){ if(t.identifier===touchLookId){
    const dx=t.clientX-lastTouchX, dy=t.clientY-lastTouchY;
    yaw -= dx*0.004; pitch -= dy*0.004; pitch=Math.max(-1.3,Math.min(1.3,pitch));
    lastTouchX=t.clientX; lastTouchY=t.clientY;
  }}
  e.preventDefault();
},{passive:false});
canvas.addEventListener('touchend', e=>{
  for(const t of e.changedTouches) if(t.identifier===touchLookId) touchLookId=null;
});
let fireHeld=false;
mFire.addEventListener('touchstart', e=>{ fireHeld=true; e.preventDefault(); },{passive:false});
mFire.addEventListener('touchend', ()=> fireHeld=false);
mDash.addEventListener('touchstart', e=>{ tryDash(); e.preventDefault(); },{passive:false});

// utility — platform-aware arena clamp (allows walk-up onto 1.2m platforms via steps)
function getPlatformHeightAt(x,z){
  for(const p of platforms){
    if(isInsidePlatform(x,z,p)) return p.h;
  }
  return 0;
}
function clampToArena(v){
  const d=Math.hypot(v.x,v.z);
  if(d>arenaRadius-1.1){
    const s=(arenaRadius-1.1)/d; v.x*=s; v.z*=s;
  }
  // crate collision simple push — skip if target is on a platform (player climbs via steps)
  const onPlat = getPlatformHeightAt(v.x, v.z) > 0.5;
  for(const c of crates){
    // skip platform bodies when climbing (they are crates with isPlatform via platforms list)
    // allow entry onto platform by ignoring its own radial push when v is inside its footprint
    let isOwnPlatform=false;
    for(const p of platforms){ if(c===p.group && isInsidePlatform(v.x,v.z,p)) { isOwnPlatform=true; break; } }
    if(isOwnPlatform) continue;
    // also skip all platform crates when onPlat and moving toward platform center (soften)
    const dx=v.x-c.position.x, dz=v.z-c.position.z;
    const dist=Math.hypot(dx,dz);
    const min = 1.0 + c.userData.radius;
    if(dist<min && dist>0.01){
      // if on platform, only block other crates/platforms not the one we stand on
      if(onPlat && c.userData.radius>1.2) {
        // still block if not the platform we're on
        const otherPlat = platforms.find(p=>p.group===c);
        if(otherPlat && isInsidePlatform(v.x,v.z,otherPlat)) continue;
      }
      const push=(min-dist)/dist;
      v.x += dx*push*0.9; v.z += dz*push*0.9;
    }
  }
}

function tryDash(){
  if(dashCooldown>0 || !alive || !started) return;
  const dir=new THREE.Vector3();
  if(keys['KeyW']) dir.z-=1; if(keys['KeyS']) dir.z+=1; if(keys['KeyA']) dir.x-=1; if(keys['KeyD']) dir.x+=1;
  if(joyVec.x||joyVec.y){ dir.x=joyVec.x; dir.z=joyVec.y; }
  if(dir.length()<0.1){
    dir.set(Math.sin(yaw),0,Math.cos(yaw)).multiplyScalar(-1);
  }
  dir.normalize();
  // apply yaw
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const world = new THREE.Vector3().addScaledVector(right, dir.x).addScaledVector(fwd, dir.z);
  world.normalize();
  dashTime=0.22; dashCooldown=1.1;
  velocity.addScaledVector(world, 18);
  // i-frame hint
  camHolder.position.y=1.75;
  setTimeout(()=> camHolder.position.y=1.7, 120);
}

function spawnEnemy(){
  const ang=Math.random()*Math.PI*2;
  const r= arenaRadius-2.5;
  const pos=new THREE.Vector3(Math.cos(ang)*r,0, Math.sin(ang)*r);
  let mesh;
  if(robotTemplate){
    mesh = robotTemplate.clone(true);
    mesh.scale.setScalar(0.85);
    mesh.rotation.y=ang+Math.PI;
    // per-instance material jitter so swarm not uniform clay — envMap response varies per drone (iteration 6: stronger hue/env variance)
    const hueShift = (Math.random()-0.5)*0.07;
    const valShift = (Math.random()-0.5)*0.10;
    const satShift = (Math.random()-0.5)*0.08;
    const envJitter = 1.38 + (Math.random()-0.5)*0.38; // 1.19-1.57, avg 1.38 vs 1.25 before
    mesh.traverse(o=>{
      if(!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map(m=>{
        if(!m || !m.clone) return m;
        const nm = m.clone();
        // subtle per-instance variation — hue + value + saturation so clones not clones
        if(nm.color){
          const hsl={}; nm.color.getHSL(hsl);
          nm.color.setHSL(THREE.MathUtils.clamp(hsl.h+hueShift,0,1), THREE.MathUtils.clamp(hsl.s+satShift,0,1), THREE.MathUtils.clamp(hsl.l+valShift,0,1));
        }
        // per-drone metal/rough micro-variance for highlight breakup
        if(nm.metalness!==undefined) nm.metalness = THREE.MathUtils.clamp(nm.metalness + (Math.random()-0.5)*0.09, 0, 1);
        if(nm.roughness!==undefined) nm.roughness = THREE.MathUtils.clamp(nm.roughness + (Math.random()-0.5)*0.08, 0.15, 0.95);
        nm.envMapIntensity = envJitter;
        // keep base refs for flash
        nm.userData = nm.userData || {};
        if(nm.userData.baseIntensity===undefined) nm.userData.baseIntensity = nm.emissiveIntensity ?? 0.08;
        if(nm.userData.baseEmissive===undefined) nm.userData.baseEmissive = nm.emissive ? nm.emissive.getHex() : 0x0e1a2a;
        return nm;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
  } else {
    mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45,1.1,8,12), new THREE.MeshStandardMaterial({ color:0xff3b82, emissive:0xff1a5a, emissiveIntensity:0.35, roughness:0.5, metalness:0.2 }));
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.18,12,12), new THREE.MeshStandardMaterial({ color:0x7af2ff, emissive:0x7af2ff, emissiveIntensity:2 }));
    eye.position.set(0,0.55,0.35); mesh.add(eye);
    mesh.castShadow=true;
  }
  const g=new THREE.Group();
  g.add(mesh);
  g.position.copy(pos);
  g.position.y=0.7;
  // contact shadow blob — stronger for readability vs bright floor
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(0.62,16), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.42 }));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=-0.68;
  shadow.renderOrder = 1;
  g.add(shadow);
  // subtle rim flash light per enemy for hit feedback (inactive until hit)
  const flashLight = new THREE.PointLight(0xff5a3b, 0, 3.2);
  flashLight.position.set(0,1.0,0);
  g.add(flashLight);
  g.userData={ hp: 3 + Math.floor(wave*0.7), maxHp:3+Math.floor(wave*0.7), speed: 2.1 + wave*0.18 + Math.random()*0.6, mesh, ang, hitFlash:0, flashLight, shadow };
  scene.add(g);
  enemyList.push(g);
}

function spawnPickup(pos, type){
  const geo = new THREE.IcosahedronGeometry(0.28,0);
  const mat = new THREE.MeshStandardMaterial({ color: type==='shield'?0x7af2ff:0xff5a8f, emissive: type==='shield'?0x00c8ff:0xff1a5a, emissiveIntensity:1.2, metalness:0.4, roughness:0.3 });
  const m=new THREE.Mesh(geo,mat);
  m.position.copy(pos); m.position.y=0.5;
  m.userData={ type, t:0, bob:Math.random()*Math.PI*2 };
  const light=new THREE.PointLight(mat.color, 6, 5);
  light.position.copy(m.position);
  m.userData.light=light;
  scene.add(m); scene.add(light);
  pickupList.push(m);
}

function shoot(){
  if(!alive || !started) return;
  if(overheat) return;
  if(heat>0.92) { overheat=true; setTimeout(()=> overheat=false, 900); return; }
  heat = Math.min(1, heat+0.085);
  // Halo-like recoil + view kick (crunchy, recoverable)
  recoilKick = 1.0;
  recoilYaw = (Math.random()-0.5)*0.12;
  pitch = Math.max(-1.35, Math.min(1.35, pitch + 0.008));
  flashTime = 0.09;
  shakeTime = 0.09;
  if(muzzleLight) muzzleLight.intensity = 18;
  if(muzzleCore){ muzzleCore.material.opacity=1; muzzleCore.scale.set(0.9+Math.random()*0.25,0.9+Math.random()*0.25,1); }
  if(muzzleFlash){
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing){ c.material.opacity=0.95; c.scale.setScalar(0.85+Math.random()*0.2); }});
    muzzleFlash.rotation.z = Math.random()*Math.PI;
  }
  // ray — use actual eye height (camRig.y already includes platform 1.2m lift via handleInput lerp)
  const origin = new THREE.Vector3().copy(camRig.position); origin.y = camRig.position.y;
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0))).normalize();
  // bullet tracer — Halo bright additive streak
  const tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,1.4,6), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.95, depthWrite:false, blending:THREE.AdditiveBlending }));
  const mid = origin.clone().addScaledVector(dir, 5.5);
  tracer.position.copy(mid);
  tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  tracer.scale.y=5.2;
  tracer.userData={ life:0.06, vel:new THREE.Vector3(0,0,0) };
  scene.add(tracer); particleList.push(tracer);
  // eject brass (tiny) — view space
  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.07,6), new THREE.MeshStandardMaterial({ color:0xc8a44a, metalness:0.6, roughness:0.4 }));
  brass.position.copy(origin).addScaledVector(dir, 0.3).add(new THREE.Vector3(0.16,-0.12,0).applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0))));
  brass.userData={ vel:new THREE.Vector3((Math.random()-0.5)*2+0.6, 2+Math.random()*1.2, (Math.random()-0.5)*1.2), life:0.55, isBrass:true };
  scene.add(brass); particleList.push(brass);
  // hit test enemies
  let hit=null, hitDist=1e9, hitPos=null;
  for(const e of enemyList){
    const to = new THREE.Vector3().subVectors(e.position, origin);
    const proj = to.dot(dir);
    if(proj<0 || proj>42) continue;
    const closest = origin.clone().addScaledVector(dir, proj);
    const dist = closest.distanceTo(e.position);
    if(dist<0.85 && proj<hitDist){ hit=e; hitDist=proj; hitPos=closest; }
  }
  // wall hit fallback
  if(hit){
    hit.userData.hp -=1;
    hit.userData.hitFlash=0.18;
    damageDealt+=1;
    // knockback
    hit.position.addScaledVector(dir, 0.35);
    // iteration 7: weapon crunch — pronounced hit flash + camera holder shake on confirmed hit (Halo didactic hit)
    const _isKillHit = hit.userData.hp<=0;
    hitShakeTime = _isKillHit ? 0.19 : 0.14;
    hitShakeAmp = _isKillHit ? 0.10 : 0.052;
    shakeTime = Math.max(shakeTime, _isKillHit ? 0.16 : 0.12);
    recoilKick = Math.max(recoilKick, _isKillHit ? 0.78 : 0.55);
    if(muzzleLight) muzzleLight.intensity = _isKillHit ? 26 : 20;
    flashTime = Math.max(flashTime, _isKillHit ? 0.13 : 0.10);
    flashHit();
    score+= (_isKillHit? 50:10);
    if(hit.userData.hp<=0){
      // death
      kills++;
      score+=20;
      // explosion
      for(let i=0;i<8;i++){
        const p=new THREE.Mesh(new THREE.SphereGeometry(0.08,6,6), new THREE.MeshStandardMaterial({ color:0xff8a3b, emissive:0xff3b82, emissiveIntensity:1 }));
        p.position.copy(hit.position); p.position.y+=0.5;
        p.userData={ vel:new THREE.Vector3((Math.random()-0.5)*6, Math.random()*4+1, (Math.random()-0.5)*6), life:0.5+Math.random()*0.4 };
        scene.add(p); particleList.push(p);
      }
      if(Math.random()<0.35) spawnPickup(hit.position.clone(), Math.random()<0.5?'shield':'health');
      scene.remove(hit); enemyList.splice(enemyList.indexOf(hit),1);
      // ring pulse
      reactor.scale.set(1.2,1.2,1.2); setTimeout(()=> reactor.scale.set(1,1,1), 120);
    }
    // Halo hitmarker + impact sparks at hitPos
    const isKill = hit.userData.hp<=0;
    // show crosshair hit feedback
    hitEl.textContent = isKill ? 'ELIMINATED' : 'HIT';
    hitEl.style.color = isKill ? '#ffd166' : '#7af2ff';
    flashHit();
    // spark burst
    for(let i=0;i<5;i++){
      const s=new THREE.Mesh(new THREE.SphereGeometry(0.035,5,5), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.95 }));
      s.position.copy(hitPos);
      const spread = new THREE.Vector3((Math.random()-0.5)*1, (Math.random()-0.5)*1 +0.3, (Math.random()-0.5)*1);
      spread.addScaledVector(dir, -0.5 + Math.random()*0.5);
      s.userData={ vel: spread.multiplyScalar(3.5), life:0.22+Math.random()*0.12, isSpark:true };
      scene.add(s); particleList.push(s);
    }
    // impact ring decal
    const decal = new THREE.Mesh(new THREE.RingGeometry(0.12,0.18,12), new THREE.MeshBasicMaterial({ color: isKill?0xffd166:0x7af2ff, transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    decal.position.copy(hitPos);
    decal.lookAt(hitPos.clone().add(dir));
    decal.userData={ life:0.14, isDecal:true };
    scene.add(decal); particleList.push(decal);
  } else {
    const far = origin.clone().addScaledVector(dir, 18);
    if(far.length()>arenaRadius) far.normalize().multiplyScalar(arenaRadius-0.3);
    // wall spark burst
    for(let i=0;i<4;i++){
      const sp=new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), new THREE.MeshBasicMaterial({ color:0x9af0ff, transparent:true, opacity:0.9 }));
      sp.position.copy(far); sp.position.y=0.22;
      sp.userData={ vel:new THREE.Vector3((Math.random()-0.5)*3, Math.random()*2, (Math.random()-0.5)*3).addScaledVector(dir, -0.8), life:0.2+Math.random()*0.1, isSpark:true };
      scene.add(sp); particleList.push(sp);
    }
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.1,0.16,12), new THREE.MeshBasicMaterial({ color:0x7af2ff, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
    ring.position.copy(far); ring.position.y=0.04; ring.rotation.x=-Math.PI/2;
    ring.userData={ life:0.18, isDecal:true };
    scene.add(ring); particleList.push(ring);
  }
  updateHUD();
}

// firing loop
let fireCooldown=0;
addEventListener('mousedown', e=>{ if(e.button===0 && started) { if(!pointerLocked) canvas.requestPointerLock?.(); else shoot(); }});
let isMouseDown=false;
addEventListener('mousedown', e=>{ if(e.button===0) isMouseDown=true; });
addEventListener('mouseup', e=>{ if(e.button===0) isMouseDown=false; });

function handleInput(dt){
  if(!alive || !started) return;
  const speed = sprint? 5.6: 3.4;
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  let move=new THREE.Vector3();
  if(keys['KeyW']) move.addScaledVector(fwd, -1);
  if(keys['KeyS']) move.addScaledVector(fwd, 1);
  if(keys['KeyA']) move.addScaledVector(right, -1);
  if(keys['KeyD']) move.addScaledVector(right, 1);
  if(joyVec.x||joyVec.y){
    move.addScaledVector(right, joyVec.x);
    move.addScaledVector(fwd, joyVec.y);
  }
  if(move.length()>0) move.normalize().multiplyScalar(speed*dt);
  // dash
  if(dashTime>0){ move.addScaledVector(velocity, dt); dashTime-=dt; }
  // apply — platform height lerp (walk up 1.2m walkways at opposite ends)
  const next = camRig.position.clone().add(move);
  // desired Y based on platform under next xz (1.7 ground → 2.9 on 1.2m platform)
  const targetH = getPlatformHeightAt(next.x, next.z);
  const targetY = 1.7 + targetH;
  // smooth step so not snapping (0.22s lerp mimics Halo mantling)
  const curY = camRig.position.y;
  let nextY = curY;
  if(Math.abs(curY - targetY) > 0.001){
    const step = dt * 8.0;
    nextY = THREE.MathUtils.lerp(curY, targetY, Math.min(1, step));
    // when jumping onto platform via steps allow slightly higher interpolation
    if(targetH>0.5 && nextY < targetY) nextY = Math.min(targetY, curY + dt*10);
    if(targetH===0 && nextY > targetY) nextY = Math.max(targetY, curY - dt*14);
  } else nextY = targetY;
  next.y = nextY;
  clampToArena(next);
  camRig.position.copy(next);
  // keep camera holder eye height offset synced (camHolder already at 0, camera at 0,1.7,0) — instead drive camRig.y as above and keep camera y=0? original set camera.position.y later, preserve
  // ensure we don't overwrite platform Y with camera shake later — shake is additive on camera
  // heat decay
  heat = Math.max(0, heat - dt*0.55);
  if(heat<0.15) overheat=false;
  // recoil spring (Halo snap + recover)
  recoilKick = Math.max(0, recoilKick - dt*6.5);
  recoilYaw *= Math.pow(0.85, dt*60);
  flashTime = Math.max(0, flashTime - dt);
  shakeTime = Math.max(0, shakeTime - dt);
  hitShakeTime = Math.max(0, hitShakeTime - dt);
  if(muzzleLight){
    muzzleLight.intensity = flashTime>0 ? 16*(flashTime/0.09) : 0;
    if(muzzleCore) muzzleCore.material.opacity = flashTime>0 ? Math.pow(flashTime/0.09, 0.7) : 0;
    muzzleFlash.children.forEach(c=>{ if(c.userData.isRing) c.material.opacity = flashTime>0 ? (flashTime/0.09) : 0; });
  }
  // subtle screenshake on fire — stronger for Halo crunch, plus holder shake on hit
  if(shakeTime>0){
    const s = shakeTime/0.16;
    camera.position.x = (Math.random()-0.5)*0.036*s;
    camera.position.y = 1.7 + (Math.random()-0.5)*0.028*s;
    camera.position.z = (Math.random()-0.5)*0.014*s;
  } else {
    camera.position.set(0,1.7,0);
  }
  if(hitShakeTime>0){
    const hs = hitShakeTime/0.19;
    camHolder.position.x = (Math.random()-0.5)*hitShakeAmp*2*hs;
    camHolder.position.z = (Math.random()-0.5)*hitShakeAmp*1.2*hs;
    camHolder.position.y = (Math.random()-0.5)*hitShakeAmp*0.7*hs;
  } else {
    camHolder.position.set(0,0,0);
  }
  // inertia sway spring (look lag) + breathing
  swayTX *= Math.pow(0.86, dt*60);
  swayTY *= Math.pow(0.86, dt*60);
  swayX += (swayTX - swayX) * dt * 9;
  swayY += (swayTY - swayY) * dt * 9;
  // add movement-induced sway (strafe leans weapon)
  const strafeIn = (keys['KeyA']?1:0)-(keys['KeyD']?1:0) + joyVec.x;
  swayTX += strafeIn * dt * 0.18;
  const breathY = Math.sin(time*1.05)*0.006 + Math.sin(time*0.62)*0.004;
  const breathX = Math.cos(time*0.9)*0.004;
  // view bob + recoil + sway (viewmodel stays grounded like Halo)
  const moving = move.length()>0.001;
  const kickZ = recoilKick * 0.14;
  const kickY = recoilKick * 0.035;
  const kickPitch = recoilKick * 0.22;
  viewWeapon.position.x = baseWeaponPos.x + Math.sin(time*9)*(moving?0.012:0.004) + recoilYaw*0.08 - swayX*0.55 + breathX*(moving?0.2:1);
  viewWeapon.position.y = baseWeaponPos.y + Math.abs(Math.sin(time*18))*(moving?0.012:0.003) - kickY - swayY*0.45 + breathY*(moving?0.3:1);
  viewWeapon.position.z = baseWeaponPos.z - kickZ + Math.abs(swayX)*0.06;
  viewWeapon.rotation.x = baseWeaponRot.x - kickPitch + swayY*1.1 + breathY*0.6 + (overheat ? -0.15 : 0);
  viewWeapon.rotation.y = baseWeaponRot.y + recoilYaw*0.6 - swayX*1.3;
  viewWeapon.rotation.z = Math.sin(time*6)*(moving?0.03:0.01) - recoilYaw*0.4 - swayX*0.9;
}

function updateEnemies(dt){
  for(const e of enemyList){
    const toPlayer = new THREE.Vector3().subVectors(camRig.position, e.position);
    toPlayer.y=0;
    const dist=toPlayer.length();
    if(dist>0.1){ toPlayer.normalize().multiplyScalar(e.userData.speed*dt); }
    // simple avoidance among enemies
    for(const o of enemyList) if(o!==e){
      const d=e.position.distanceTo(o.position);
      if(d<1.2){ const push=new THREE.Vector3().subVectors(e.position,o.position).normalize().multiplyScalar((1.2-d)*dt*2); e.position.add(push); }
    }
    // move towards player but respect crates
    const next = e.position.clone().add(toPlayer);
    // crate push
    for(const c of crates){
      const dx=next.x-c.position.x, dz=next.z-c.position.z;
      const dd=Math.hypot(dx,dz);
      if(dd<1.05 + c.userData.radius){
        const nx=dx/(dd||1), nz=dz/(dd||1);
        next.x = c.position.x + nx*(1.05+c.userData.radius);
        next.z = c.position.z + nz*(1.05+c.userData.radius);
      }
    }
    const nd=Math.hypot(next.x,next.z);
    if(nd<arenaRadius-1) e.position.copy(next);
    else e.position.addScaledVector(toPlayer, -0.5*dt);
    // face player
    e.lookAt(camRig.position.x, e.position.y, camRig.position.z);
    e.rotation.y+=Math.PI;
    // hit flash — subtle warm emissive pulse + visor flare, decays fast so not flat clay
    if(e.userData.hitFlash>0){
      e.userData.hitFlash-=dt;
      const t = Math.max(0, e.userData.hitFlash/0.18);
      // point light flash fades
      if(e.userData.flashLight) e.userData.flashLight.intensity = t * 6.0;
      e.traverse(o=>{
        if(!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{
          if(!m.emissive) return;
          const isVisor = /eye|visor|optic|lens/i.test((o.name+' '+(m.name||'')).toLowerCase());
          const base = m.userData?.baseIntensity ?? (isVisor?1.6:0.08);
          const flash = isVisor ? base + t*2.2 : base + t*1.4;
          m.emissiveIntensity = flash;
          // warm flash color lerp
          if(t>0.01){
            const flashCol = new THREE.Color(0xff3b2e);
            const baseCol = new THREE.Color(m.userData?.baseEmissive ?? 0x0e1a2a);
            if(!isVisor) m.emissive.lerpColors(baseCol, flashCol, t*0.85);
          }
        });
      });
      if(e.userData.hitFlash<=0){
        // restore base
        e.traverse(o=>{
          if(!o.isMesh || !o.material) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m=>{
            if(m.userData){
              if(m.userData.baseIntensity!==undefined) m.emissiveIntensity = m.userData.baseIntensity;
              if(m.userData.baseEmissive!==undefined) m.emissive.setHex(m.userData.baseEmissive);
            }
          });
        });
        if(e.userData.flashLight) e.userData.flashLight.intensity = 0;
      }
    } else {
      // idle subtle visor pulse so robot reads against bright floor
      e.traverse(o=>{
        if(!o.isMesh || !o.material) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m=>{
          const isVisor = /eye|visor|optic|lens/i.test((o.name+' '+(m.name||'')).toLowerCase());
          if(isVisor && m.userData){
            m.emissiveIntensity = m.userData.baseIntensity + Math.sin(time*3.2 + e.userData.ang)*0.26;
          }
        });
      });
    }
    // scale contact shadow with height (fake AO)
    if(e.userData.shadow){
      const s = 1.0 - Math.min(0.25, Math.abs(Math.sin(time*2 + e.userData.ang))*0.06);
      e.userData.shadow.scale.setScalar(s);
      e.userData.shadow.material.opacity = 0.42 * (0.9 + 0.1*Math.sin(time*2));
    }
    // attack if close
    if(dist<1.35 && dashTime<=0){
      // damage with cooldown per enemy
      e.userData.cooldown = (e.userData.cooldown||0)-dt;
      if(e.userData.cooldown<=0){
        const dmg = 8 + wave*1.2;
        if(shield>0){ const absorb=Math.min(shield,dmg); shield-=absorb; const rem=dmg-absorb; health-=rem; } else health-=dmg;
        e.userData.cooldown=0.9;
        hitShakeTime = 0.22; hitShakeAmp = 0.14;
        // hurt vignette via flash
        document.body.style.boxShadow='inset 0 0 80px rgba(255,59,130,.6)';
        setTimeout(()=> document.body.style.boxShadow='', 120);
        updateHUD();
        if(health<=0){ health=0; alive=false; deadScreen.style.display='flex'; document.getElementById('deadStats').textContent=`Score ${score} · Wave ${wave} · Kills ${kills} · Time ${Math.floor(time)}s`; document.exitPointerLock?.(); }
      }
    }
  }
}

function updatePickups(dt){
  for(let i=pickupList.length-1;i>=0;i--){
    const p=pickupList[i];
    p.userData.t+=dt;
    p.rotation.y+=dt*2.2;
    p.position.y=0.5+Math.sin(p.userData.t*2.6 + p.userData.bob)*0.18;
    p.userData.light.position.copy(p.position);
    const d=p.position.distanceTo(camRig.position);
    if(d<1.1){
      if(p.userData.type==='health'){ health=Math.min(maxHealth, health+28); }
      else { shield=Math.min(maxShield, shield+22); }
      score+=15;
      scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); updateHUD();
      // pickup flash
      const f=new THREE.Mesh(new THREE.RingGeometry(0.5,0.7,16), new THREE.MeshBasicMaterial({ color: p.userData.type==='health'?0xff5a8f:0x7af2ff, transparent:true, opacity:0.7, side:THREE.DoubleSide }));
      f.rotation.x=-Math.PI/2; f.position.copy(camRig.position); f.position.y=0.05; scene.add(f);
      let t=0; const iv=setInterval(()=>{ t+=0.05; f.scale.setScalar(1+t*2); f.material.opacity-=0.07; if(f.material.opacity<=0){ scene.remove(f); clearInterval(iv);} },16);
    }
    if(p.userData.t>14){ scene.remove(p); scene.remove(p.userData.light); pickupList.splice(i,1); }
  }
}

function updateParticles(dt){
  for(let i=particleList.length-1;i>=0;i--){
    const p=particleList[i];
    if(p.userData.vel){
      p.position.addScaledVector(p.userData.vel, dt);
      p.userData.vel.y -= 9.8*dt*0.6;
      p.userData.vel.multiplyScalar(0.98);
      if(p.userData.isBrass) p.rotation.x += dt*12;
    }
    p.userData.life-=dt;
    if(p.material){
      p.material.transparent=true;
      if(p.userData.isDecal){
        p.material.opacity = Math.max(0, p.userData.life*3.5);
        p.scale.setScalar(1 + (0.18 - p.userData.life)*1.2);
      } else if(p.userData.isSpark){
        p.material.opacity = Math.max(0, p.userData.life*4);
      } else {
        p.material.opacity = Math.max(0, p.userData.life*1.5);
        if(!p.userData.isBrass) p.scale.setScalar(1 - p.userData.life*0.2);
      }
    }
    if(p.userData.life<=0){ scene.remove(p); particleList.splice(i,1); }
  }
}

function updateWave(dt){
  waveTimer-=dt;
  spawnCooldown-=dt;
  if(spawnCooldown<=0 && enemyList.length < 3+wave*1.8){
    spawnEnemy();
    spawnCooldown= 1.6 - Math.min(1.0, wave*0.12) + Math.random()*0.7;
  }
  if(waveTimer<=0){
    wave++;
    waveTimer=60;
    waveEl.textContent=wave;
    waveBanner.textContent=`WAVE ${wave} — REINFORCEMENTS INBOUND`;
    waveBanner.style.background='rgba(255,59,130,.18)';
    waveBanner.style.borderColor='rgba(255,59,130,.5)';
    waveBanner.style.color='#ff8a8f';
    setTimeout(()=>{ waveBanner.style.background=''; waveBanner.style.borderColor=''; waveBanner.style.color=''; waveBanner.textContent=`WAVE ${wave}`; },2200);
    updateHUD();
    if(wave>3){
      alive=false; wonScreen.style.display='flex'; document.getElementById('wonStats').textContent=`Score ${score} · Kills ${kills} · Perfect arena hold — extraction ready.`;
      document.exitPointerLock?.();
    }
  } else {
    waveBanner.textContent=`WAVE ${wave} — ${Math.ceil(waveTimer)}s`;
  }
  // reactor pulse — iteration 7: stronger emissiveIntensity + subtle hue shift (Halo authored pulse, not flat)
  const pulse = Math.sin(time*2.6);
  const fast = Math.sin(time*7.2);
  const s=1+ pulse*0.045 + fast*0.012;
  reactor.scale.set(s,s,s);
  coreGlow.material.emissiveIntensity = 1.65 + pulse*0.65 + fast*0.22;
  core.material.emissiveIntensity = 0.68 + pulse*0.42 + fast*0.14;
  // hue shift: lerp core glow cyan↔aqua, halo pink↔magenta
  coreGlow.material.emissive.lerpColors(reactorCoreBase, reactorCoreShift, (pulse+1)*0.22 + fast*0.06);
  core.material.emissive.lerpColors(new THREE.Color(0x0088aa), new THREE.Color(0x00c8ff), (pulse+1)*0.18);
  // halo rings — stronger pulse so emissive reads against bright day
  const haloPulse = 1.45 + pulse*0.85 + fast*0.32;
  halo.material.emissiveIntensity = haloPulse;
  halo2.material.emissiveIntensity = haloPulse*0.96;
  halo.material.emissive.lerpColors(reactorHaloBase, reactorHaloShift, (pulse+1)*0.28);
  halo2.material.emissive.copy(halo.material.emissive);
  halo2.material.emissiveIntensity = haloPulse*0.92;
  // wall neon wayfinding — subtle breathe synced to reactor
  wallNeonTrims.forEach((m,i)=>{
    m.material.emissiveIntensity = 1.42 + Math.sin(time*2.2 + i*0.55)*0.38 + fast*0.10;
  });
  // iteration 9: crate emissive pulse variation — subtle out-of-phase breathe for wayfinding (no new textures)
  cratePulseData.forEach(d=>{
    const v = Math.sin(time*d.speed + d.phase);
    const f = 1 + v*d.amp*0.55;
    d.mats.forEach(m=>{ m.emissiveIntensity = (m.userData.crateBase ?? 0.11) * f; });
  });
  // subtle point lights — dimmed to not wash bright day
  pink.intensity=2+Math.sin(time*1.3)*0.5;
  blue2.intensity=1+Math.cos(time*1.1)*0.4;
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.033, (performance.now()-(animate._last||performance.now()))/1000);
  animate._last=performance.now();
  if(started && alive) time+=dt;
  // camera rig rotation
  camRig.rotation.y=yaw;
  camera.rotation.x=pitch;
  camera.rotation.y=0; camera.rotation.z=0;
  if(started && alive){
    handleInput(dt);
    // auto fire if held
    fireCooldown-=dt;
    if((isMouseDown || fireHeld) && fireCooldown<=0){ shoot(); fireCooldown=0.11; }
    if(dashCooldown>0) dashCooldown-=dt;
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateWave(dt);
  }
  // Halo depth cue: gently darken distant walls with distance (mimics fog AO + trimsheet distance read)
  for(const b of wallBodies){
    const d = b.position.distanceTo(camRig.position);
    const t = THREE.MathUtils.clamp((d - 12) / 22, 0, 1);
    // 0 at near → 1 at far: darken up to ~16% and add slight blue fog tint
    const dark = 1 - t * 0.16;
    // modulate material color lerp toward fog (avoid rebuilding texture)
    if(b.material && b.material.color){
      // base is white (texture tint); lerp white→0.88 gray plus fog tint
      b.material.color.setRGB(dark, dark, dark);
      // subtle roughness lift at distance so highlight not blown
      b.material.roughness = 0.79 + t * 0.06;
    }
  }
  // keep height haze centered on player for stable horizon
  if(heightHaze){
    heightHaze.position.x = camRig.position.x;
    heightHaze.position.z = camRig.position.z;
  }
  renderer.render(scene,camera);
}

function resetGame(){
  health=100; shield=50; score=0; wave=1; time=0; heat=0; overheat=false; alive=true;
  kills=0; waveTimer=60; enemyList.forEach(e=>scene.remove(e)); enemyList=[]; particleList.forEach(p=>scene.remove(p)); particleList=[]; pickupList.forEach(p=>{scene.remove(p); scene.remove(p.userData.light)}); pickupList=[];
  camRig.position.set(0,1.7,8); yaw=0; pitch=0;
  deadScreen.style.display='none'; wonScreen.style.display='none';
  updateHUD();
}

// attribution
async function setAttrib(){
  try{
    const [r,c,w]=await Promise.all([
      fetch('/models/robot.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/crate.glb.attribution.json').then(r=>r.json()).catch(()=>null),
      fetch('/models/weapon.glb.attribution.json').then(r=>r.json()).catch(()=>null),
    ]);
    const parts=[];
    if(r) parts.push(`Enemy: "${r.name}" by ${r.author} — <a href="${r.modelUrl}" target="_blank">${r.license}</a>`);
    if(c) parts.push(`Crate: "${c.name}" by ${c.author} — <a href="${c.modelUrl}" target="_blank">${c.license}</a>`);
    if(w) parts.push(`Weapon: "${w.name}" by ${w.author} — <a href="${w.modelUrl}" target="_blank">${w.license}</a>`);
    attrib.innerHTML=parts.join('<br>');
  }catch{}
}

// init
(async()=>{
  await loadModels();
  setupWeapon();
  setAttrib();
  updateHUD();
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  // generate envMap after first paint (sky/floor present) so robot metals reflect
  requestAnimationFrame(()=> requestAnimationFrame(()=> updateEnvMap()));
  animate();
  document.getElementById('playBtn').addEventListener('click', ()=>{
    started=true; overlay.style.display='none';
    canvas.requestPointerLock?.();
    // spawn initial
    for(let i=0;i<2;i++) spawnEnemy();
  });
  document.getElementById('howBtn').addEventListener('click', ()=>{
    const h=document.getElementById('how'); h.style.display=h.style.display==='none'?'block':'none';
  });
  // allow click on overlay to start as well
  overlay.addEventListener('click', e=>{ if(e.target===overlay) document.getElementById('playBtn').click(); });
})();

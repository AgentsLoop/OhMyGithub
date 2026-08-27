import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './style.css'

const $ = (s)=>document.querySelector(s)
const app = document.getElementById('app')
app.innerHTML = `
<div id="canvas-wrap"></div>
<div id="hud">
  <div class="topbar">
    <div class="brand">
      <div style="width:10px;height:10px;border-radius:50%;background:#38bdf8;box-shadow:0 0 14px #38bdf8"></div>
      <div>
        <h1>NEXUS BREACH</h1>
        <p>SECURE THE SECTOR • CLEAR ALL TARGETS</p>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><label>Health</label><div class="bar"><i id="healthBar" style="width:100%"></i></div><b id="healthText">100</b></div>
      <div class="stat"><label>Ammo <span id="magText" style="text-transform:none;letter-spacing:0">30/30</span></label><div class="bar"><i id="ammoBar" style="width:100%"></i></div><b id="ammoText">30</b></div>
      <div class="stat" style="min-width:110px"><label>Targets</label><b id="targetsText">8</b><span style="font-size:10px;opacity:0.6">REMAINING</span></div>
      <div class="stat" style="min-width:110px"><label>Time</label><b id="timeText">60.0</b><span style="font-size:10px;opacity:0.6">SECONDS</span></div>
    </div>
  </div>
  <div class="bottombar">
    <div class="controls">
      <b>WASD</b> move &nbsp; <b>Mouse</b> look &nbsp; <b>Click</b> shoot &nbsp; <kbd>R</kbd> reload &nbsp; <kbd>ESC</kbd> pause<br/>
      <span style="opacity:0.7">Collision keeps you inside the arena. Empty mag blocks fire. Toolbar flashes on hit.</span>
    </div>
    <div class="targetsLeft">
      <span>SECTOR STATUS</span>
      <strong id="statusText">ENGAGE</strong>
      <div id="statusSub" style="font-size:11px;opacity:0.7">Clear 8 targets before health fails</div>
    </div>
  </div>
</div>
<div id="crosshair"><i></i></div>
<div id="hitMarker">+ HIT</div>
<div id="attrib"></div>

<div id="overlay-start" class="overlay">
  <div class="card">
    <div class="badge">THREE.JS FPS • POINTER LOCK • GLB VERIFIED</div>
    <h2>NEXUS BREACH</h2>
    <p>A polished browser FPS vertical slice. Move with <b>WASD</b>, look with mouse, <b>Click</b> to shoot crates. 30 rounds, reload with <b>R</b>. Clear 8 targets, manage 100 health (decays over time, hit refills), avoid walls. Win by clearing, lose if health 0 or timer 0.</p>
    <p style="font-size:12px;opacity:0.65">Bar inspiration: <b>Krunker.io</b> clean arena + <b>Three.js FPS Example</b> movement feel. Built with Vite + Three r160, GLTFLoader, AABB collision, raycast shooting, verified GLB assets.</p>
    <div class="row">
      <button id="btnPlay" class="btn">CLICK TO BREACH • PLAY</button>
      <button id="btnHow" class="btn secondary">Controls</button>
    </div>
    <p id="loadStatus" style="font-size:11px;opacity:0.6;margin-top:10px">Loading crate GLB…</p>
    <p style="font-size:10px;opacity:0.5;margin-top:8px">Models: Rifle (Alexereth, CC Attribution) & Crate (Legeaf, CC Attribution) via Sketchfab • Attribution preserved in <code>/public/models/*.attribution.json</code></p>
  </div>
</div>

<div id="overlay-win" class="overlay hidden">
  <div class="card">
    <div class="badge" style="border-color:#22c55e;color:#86efac;background:rgba(34,197,94,0.12)">SECTOR SECURED</div>
    <h2>YOU WIN</h2>
    <p id="winStats">All targets eliminated.</p>
    <div class="row">
      <button id="btnReplayWin" class="btn">PLAY AGAIN</button>
    </div>
  </div>
</div>

<div id="overlay-lose" class="overlay hidden">
  <div class="card">
    <div class="badge" style="border-color:#ef4444;color:#fca5a5;background:rgba(239,68,68,0.12)">SECTOR LOST</div>
    <h2>YOU FAILED</h2>
    <p id="loseStats">Health or time expired.</p>
    <div class="row">
      <button id="btnReplayLose" class="btn">RETRY</button>
    </div>
  </div>
</div>
`

const wrap = document.getElementById('canvas-wrap')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x060a14)
scene.fog = new THREE.Fog(0x060a14, 22, 68)
{
  const skyGeo = new THREE.SphereGeometry(90, 32, 16)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vPos; void main(){
      float h = normalize(vPos).y;
      vec3 top = vec3(0.04, 0.12, 0.26);
      vec3 mid = vec3(0.02, 0.06, 0.14);
      vec3 bot = vec3(0.03, 0.04, 0.09);
      vec3 col = mix(bot, mid, smoothstep(-0.2, 0.3, h));
      col = mix(col, top, smoothstep(0.3, 0.9, h));
      // subtle horizon glow
      float glow = exp(-pow(h+0.05, 2.0)* 80.0)*0.35;
      col += vec3(0.15,0.45,0.85)*glow;
      gl_FragColor = vec4(col, 1.0);
    }`
  })
  const sky = new THREE.Mesh(skyGeo, skyMat)
  scene.add(sky)
}

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 200)
camera.position.set(0, 1.75, 9)

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
wrap.appendChild(renderer.domElement)

// Lights - PBR friendly
scene.add(new THREE.HemisphereLight(0x8ecbff, 0x0b1020, 1.1))
const dir = new THREE.DirectionalLight(0xffffff, 1.7)
dir.position.set(10, 18, 8)
dir.castShadow = true
dir.shadow.mapSize.set(2048,2048)
dir.shadow.camera.near = 1
dir.shadow.camera.far = 60
dir.shadow.camera.left = -20
dir.shadow.camera.right = 20
dir.shadow.camera.top = 20
dir.shadow.camera.bottom = -20
dir.shadow.bias = -0.0006
scene.add(dir)
const fill = new THREE.DirectionalLight(0x7dd3fc, 0.5)
fill.position.set(-10, 10, -10)
scene.add(fill)

// Env - neutral for crate PBR
const pmrem = new THREE.PMREMGenerator(renderer)
scene.environment = pmrem.fromScene(new THREE.Scene(), 0.04).texture

// Floor & arena
const floorGeo = new THREE.PlaneGeometry(44, 44)
const floorMat = new THREE.MeshStandardMaterial({ color:0x0e1a2e, roughness:0.82, metalness:0.06 })
const floor = new THREE.Mesh(floorGeo, floorMat)
floor.rotation.x = -Math.PI/2
floor.receiveShadow = true
scene.add(floor)
const grid = new THREE.GridHelper(44, 44, 0x1e3a5f, 0x11223a)
grid.position.y = 0.02
scene.add(grid)

// Walls AABB - 4 walls + inner pillars for collision variety
const walls = []
function addWall(x,z,w,d){
  const h = 3.5
  const geo = new THREE.BoxGeometry(w,h,d)
  const mat = new THREE.MeshStandardMaterial({ color:0x0f223d, roughness:0.72, metalness:0.08 })
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x,h/2,z)
  m.castShadow = true
  m.receiveShadow = true
  scene.add(m)
  walls.push({ min: new THREE.Vector3(x-w/2,0,z-d/2), max: new THREE.Vector3(x+w/2,h,z+d/2), mesh:m })
  // edging light
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w+0.04,0.08,d+0.04), new THREE.MeshStandardMaterial({ color:0x38bdf8, emissive:0x0ea5e9, emissiveIntensity:0.7 }))
  edge.position.set(x,0.07,z)
  scene.add(edge)
}
const S=22
addWall(0, S, 44, 1)
addWall(0,-S,44,1)
addWall(S,0,1,44)
addWall(-S,0,1,44)
// inner pillars
addWall(8,8,1.2,1.2)
addWall(-9,6,1.2,4)
addWall(6,-9,4,1.2)
addWall(-7,-8,1.2,1.2)
addWall(0,0,0.0,0)

// ceiling beams for visual
for(let i=-16;i<=16;i+=8){
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,44), new THREE.MeshStandardMaterial({ color:0x182f56 }))
  beam.position.set(i,3.2,0)
  scene.add(beam)
  const beam2 = new THREE.Mesh(new THREE.BoxGeometry(44,0.4,0.4), new THREE.MeshStandardMaterial({ color:0x182f56 }))
  beam2.position.set(0,3.2,i)
  scene.add(beam2)
}

// Controls
const controls = new PointerLockControls(camera, renderer.domElement)
const move = { forward:false, back:false, left:false, right:false, sprint:false }
let velocity = new THREE.Vector3()
let isLocked=false
controls.addEventListener('lock', ()=>{ isLocked=true; hideOverlaysWhenPlaying() })
controls.addEventListener('unlock', ()=>{ isLocked=false; if(gameState==='playing') showPause() })

window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase()
  if(k==='w') move.forward=true
  if(k==='s') move.back=true
  if(k==='a') move.left=true
  if(k==='d') move.right=true
  if(k==='shift') move.sprint=true
  if(k==='r' && gameState==='playing') reload()
  if(k==='escape' && isLocked) controls.unlock()
})
window.addEventListener('keyup', (e)=>{
  const k=e.key.toLowerCase()
  if(k==='w') move.forward=false
  if(k==='s') move.back=false
  if(k==='a') move.left=false
  if(k==='d') move.right=false
  if(k==='shift') move.sprint=false
})

renderer.domElement.addEventListener('click', ()=>{
  if(gameState==='playing' && !isLocked) controls.lock()
  else if(gameState==='playing' && isLocked) shoot()
})

// Game state
let gameState='loading' // loading, ready, playing, won, lost
let health=100
let ammo=30
let magCapacity=30
let reloading=false
let targets=[]
let totalTargets=8
let timeLeft=60
let startTime=0
let elapsed=0
let lastHealthDecay=0

const ui={
  healthBar:$('#healthBar'), healthText:$('#healthText'),
  ammoBar:$('#ammoBar'), ammoText:$('#ammoText'), magText:$('#magText'),
  targetsText:$('#targetsText'), timeText:$('#timeText'),
  statusText:$('#statusText'), statusSub:$('#statusSub'),
  hitMarker:$('#hitMarker'),
  overlayStart:$('#overlay-start'), overlayWin:$('#overlay-win'), overlayLose:$('#overlay-lose'),
  loadStatus:$('#loadStatus'),
  attrib:$('#attrib'),
}

// Attribution links
ui.attrib.innerHTML = `Models: <a href="https://sketchfab.com/3d-models/none-64641260a203491f9f59b3dcaa04c919" target="_blank">Crate by Legeaf (CC Attribution)</a> • <a href="https://sketchfab.com/3d-models/none-578d6ffa887b4a2c87d11e6184ef3bc4" target="_blank">Rifle by Alexereth (CC Attribution)</a>`

// Loader - crate instancing
const loader = new GLTFLoader()
let crateTemplate=null
let rifleTemplate=null
let crateLoadFailed=false

function loadGLBs(){
  return new Promise((resolve)=>{
    let pending=2
    const done=()=>{ pending--; if(pending<=0) resolve() }
    loader.load('/models/crate.glb', (gltf)=>{
      crateTemplate = gltf.scene
      crateTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true }})
      // Center + scale normalize
      const box=new THREE.Box3().setFromObject(crateTemplate)
      const size=new THREE.Vector3(); box.getSize(size)
      const scale = 1.2 / Math.max(size.x, size.y, size.z)
      crateTemplate.scale.setScalar(scale)
      // re-center to origin
      const center=new THREE.Vector3(); box.getCenter(center)
      crateTemplate.position.sub(center.multiplyScalar(scale))
      ui.loadStatus.textContent = `Crate GLB loaded (${Math.round(gltf.scene.children.length)} nodes, ${gltf.scene ? 'ok' : 'fail'})`
      done()
    }, undefined, (e)=>{
      console.warn('crate load failed', e)
      crateLoadFailed=true
      ui.loadStatus.textContent = 'Crate GLB failed, using fallback geometry'
      done()
    })
    loader.load('/models/rifle.glb', (gltf)=>{
      rifleTemplate = gltf.scene
      rifleTemplate.traverse(o=>{ if(o.isMesh){ o.castShadow=true }})
      const box=new THREE.Box3().setFromObject(rifleTemplate)
      const size=new THREE.Vector3(); box.getSize(size)
      const scale = 0.9 / Math.max(size.x, size.y, size.z)
      rifleTemplate.scale.setScalar(scale)
      done()
    }, undefined, (e)=>{
      console.warn('rifle load failed', e)
      done()
    })
  })
}

// Targets placement - mixed crate GLB + emissive drones if needed
function spawnTargets(){
  // clear previous
  targets.forEach(t=>scene.remove(t.group))
  targets=[]
  const positions=[
    [ 9, 0.6,  9],[ -10,0.6,  8],[  11,0.6, -7],[ -8,0.6,-10],
    [ 0,0.6, 14],[ 14,0.6,  0],[ -14,0.6, -2],[  3,0.6,-14],
  ]
  for(let i=0;i<Math.min(totalTargets, positions.length);i++){
    const [x,y,z]=positions[i]
    const group=new THREE.Group()
    group.position.set(x,y,z)
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,0.2,12), new THREE.MeshStandardMaterial({ color:0x18284a }))
    ped.position.y=-0.35
    ped.receiveShadow=true
    ped.castShadow=true
    group.add(ped)
    // crate or fallback box
    let meshGroup
    if(crateTemplate && !crateLoadFailed){
      meshGroup = crateTemplate.clone(true)
      meshGroup.position.y=0.15
      // add outline emissive pulse child
      meshGroup.traverse(o=>{ if(o.isMesh) o.material = o.material.clone() })
      group.add(meshGroup)
    }else{
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.9,0.9), new THREE.MeshStandardMaterial({ color:0x38bdf8, emissive:0x0ea5e9, emissiveIntensity:0.15 }))
      b.castShadow=true
      b.position.y=0.2
      group.add(b)
      meshGroup=b
    }
    // hover light
    const point = new THREE.PointLight(0x38bdf8, 0.8, 4)
    point.position.set(0,0.9,0)
    group.add(point)
    // floating animation data
    group.userData = { baseY:y, phase:Math.random()*Math.PI*2, meshGroup, point }
    // collision AABB approx
    const aabb={ min:new THREE.Vector3(x-0.6,0,z-0.6), max:new THREE.Vector3(x+0.6,1.4,z+0.6), alive:true, health:2 }
    const t={ group, aabb, alive:true, hits:0, hp:2 }
    // raycast helper - we will raycast against group children recursively, but need aabb early out
    scene.add(group)
    targets.push(t)
  }
  ui.targetsText.textContent = String(targets.filter(t=>t.alive).length)
}

// Weapon viewmodel - attach to camera
let weapon=null
function attachWeapon(){
  if(!rifleTemplate) return
  weapon = rifleTemplate.clone(true)
  // position in front of camera like viewmodel
  weapon.position.set(0.35, -0.28, -0.75)
  weapon.rotation.set(0, Math.PI, 0) // face forward
  weapon.scale.setScalar(0.65 * weapon.scale.x / 0.9 * 0.9) // keep normalized
  // Ensure not too big - adjust
  camera.add(weapon)
  scene.add(camera) // ensure camera is in scene (PointerLockControls already does)
}

// Ensure camera added to scene
scene.add(camera)

// Shooting
const raycaster=new THREE.Raycaster()
let shootCooldown=0
let muzzleFlash=null
function ensureMuzzle(){
  if(muzzleFlash) return muzzleFlash
  const g=new THREE.Group()
  const core=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,8), new THREE.MeshBasicMaterial({ color:0xfff2a8 }))
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.08,0.16,12), new THREE.MeshBasicMaterial({ color:0xffb84d, side:THREE.DoubleSide, transparent:true, opacity:0.8 }))
  ring.rotation.x=Math.PI/2
  g.add(core,ring)
  g.visible=false
  camera.add(g)
  g.position.set(0.35,-0.24,-0.9)
  muzzleFlash=g
  return g
}
function flash(){
  const m=ensureMuzzle()
  m.visible=true
  m.scale.set(1,1,1)
  setTimeout(()=>m.visible=false, 70)
}
function hitMarker(){
  ui.hitMarker.classList.add('show')
  setTimeout(()=>ui.hitMarker.classList.remove('show'), 180)
}
function updateHUD(){
  const hp = Math.max(0, Math.round(health))
  ui.healthText.textContent = String(hp)
  ui.healthBar.style.width = hp + '%'
  ui.healthBar.style.background = hp<30 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : hp<60 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : 'linear-gradient(90deg,#22c55e,#38bdf8)'
  ui.ammoText.textContent = String(ammo)
  ui.ammoBar.style.width = (ammo/magCapacity*100)+'%'
  ui.magText.textContent = `${ammo}/${magCapacity}${reloading?' • RELOADING':''}`
  ui.ammoBar.style.opacity = reloading ? '0.6' : '1'
  ui.targetsText.textContent = String(targets.filter(t=>t.alive).length)
  ui.timeText.textContent = timeLeft.toFixed(1)
  if(gameState==='playing'){
    const remain = targets.filter(t=>t.alive).length
    if(remain===0) {ui.statusText.textContent='CLEAR'; ui.statusSub.textContent='Sector secured';}
    else if(health<35) {ui.statusText.textContent='CRITICAL'; ui.statusSub.textContent='Health low — finish fast';}
    else {ui.statusText.textContent='ENGAGE'; ui.statusSub.textContent=`${remain} targets • ${timeLeft.toFixed(0)}s`}
  }
}
function reload(){
  if(reloading || ammo===magCapacity) return
  reloading=true
  updateHUD()
  ui.statusText.textContent='RELOADING'
  setTimeout(()=>{
    ammo=magCapacity
    reloading=false
    updateHUD()
  }, 750)
}
function damagePlayer(amt){
  if(gameState!=='playing') return
  health = Math.max(0, health - amt)
  updateHUD()
  // screen flash
  renderer.domElement.style.filter = 'brightness(1.3) saturate(1.2)'
  setTimeout(()=>renderer.domElement.style.filter='', 90)
  if(health<=0) lose('Health depleted')
}

function shoot(){
  if(gameState!=='playing' || reloading || shootCooldown>0) return
  if(ammo<=0){
    // click empty
    ui.statusText.textContent='EMPTY'
    ui.statusSub.textContent='Press R to reload'
    // tiny shake
    camera.position.x += (Math.random()-0.5)*0.02
    return
  }
  ammo--
  shootCooldown=0.12
  flash()
  updateHUD()
  // ray
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera)
  const intersects=[]
  // collect target meshes
  targets.forEach(t=>{
    if(!t.alive) return
    // early AABB ray vs box distance
    const origin=raycaster.ray.origin.clone(), dir=raycaster.ray.direction.clone()
    // check intersection with expanded AABB via ray-box
    const invDir = new THREE.Vector3(1/dir.x,1/dir.y,1/dir.z)
    // simple: check distance to center
    const center = t.group.position.clone()
    const toCenter = center.clone().sub(origin)
    const proj = toCenter.dot(dir)
    if(proj<0 || proj>60) return
    const closest = origin.clone().add(dir.clone().multiplyScalar(proj))
    if(closest.distanceTo(center) > 1.4) return
    // real mesh raycast
    const hits = raycaster.intersectObject(t.group, true)
    if(hits.length){
      intersects.push({ t, dist:hits[0].distance, point:hits[0].point, hits })
    }
  })
  // wall hits (for visual)
  let wallHit=null
  const wallHits=[]
  walls.forEach(w=>{
    const box=new THREE.Box3(w.min, w.max)
    const hit = raycaster.ray.intersectBox(box, new THREE.Vector3())
    if(hit) wallHits.push(hit.distanceTo(raycaster.ray.origin))
  })
  // choose closest target
  intersects.sort((a,b)=>a.dist-b.dist)
  const nearestWall = wallHits.length? Math.min(...wallHits) : Infinity
  if(intersects.length && intersects[0].dist < nearestWall){
    const target=intersects[0].t
    target.hits++
    target.hp--
    // hit effect
    spawnImpact(intersects[0].point, 0x38bdf8)
    hitMarker()
    // pulse point light
    target.group.userData.point.intensity=2.2
    setTimeout(()=>{ if(target.alive) target.group.userData.point.intensity=0.8 }, 120)
    // damage mesh emissive flash
    target.group.traverse(o=>{
      if(o.isMesh && o.material.emissive){
        o.material.emissive.setHex(0x38bdf8)
        o.material.emissiveIntensity=0.6
        setTimeout(()=>{ o.material.emissiveIntensity=0 }, 120)
      }
    })
    if(target.hp<=0){
      target.alive=false
      // explode
      explode(target.group.position.clone())
      // remove after delay
      setTimeout(()=>{
        scene.remove(target.group)
      }, 180)
      health = Math.min(100, health + 7)
      ui.targetsText.textContent = String(targets.filter(t=>t.alive).length)
      // check win
      if(targets.every(t=>!t.alive)){
        win()
      }
    }
  } else {
    // miss - wall or sky
    if(nearestWall!==Infinity){
      const pt = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(Math.min(nearestWall, 22)))
      spawnImpact(pt, 0x94a3b8)
    } else {
      // sky miss - tracer only
    }
    // slight health decay on miss? not, but ammo waste is penalty already
  }
  // tracer
  spawnTracer()
  updateHUD()
}

function spawnTracer(){
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.35,-0.24,-0.9), new THREE.Vector3(0,0,-22)])
  const line=new THREE.Line(geo, new THREE.LineBasicMaterial({ color:0x7dd3fc, transparent:true, opacity:0.85 }))
  camera.add(line)
  setTimeout(()=>camera.remove(line), 55)
}
function spawnImpact(pos, color){
  const g=new THREE.Group()
  g.position.copy(pos)
  const s=new THREE.Mesh(new THREE.SphereGeometry(0.09,8,8), new THREE.MeshBasicMaterial({ color }))
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.12,0.22,10), new THREE.MeshBasicMaterial({ color, side:THREE.DoubleSide, transparent:true, opacity:0.9 }))
  ring.lookAt(camera.position)
  g.add(s,ring)
  scene.add(g)
  let t=0
  const anim=()=>{
    t+=0.08
    s.scale.setScalar(1+t*1.2)
    ring.scale.setScalar(1+t*1.5)
    ring.material.opacity = Math.max(0, 0.9 - t*1.8)
    if(t<1) requestAnimationFrame(anim)
    else scene.remove(g)
  }
  anim()
}
function explode(pos){
  const count=14
  for(let i=0;i<count;i++){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14), new THREE.MeshStandardMaterial({ color:0x38bdf8, emissive:0x0ea5e9, emissiveIntensity:0.8 }))
    p.position.copy(pos).add(new THREE.Vector3((Math.random()-0.5)*0.3,0.4+Math.random()*0.3,(Math.random()-0.5)*0.3))
    const vel=new THREE.Vector3((Math.random()-0.5)*6, 3+Math.random()*4, (Math.random()-0.5)*6)
    scene.add(p)
    let life=0
    const tick=()=>{
      life+=0.016
      p.position.add(vel.clone().multiplyScalar(0.016))
      vel.y -= 9*0.016
      vel.multiplyScalar(0.985)
      p.rotation.x+=0.2; p.rotation.y+=0.15
      if(life<0.9) requestAnimationFrame(tick)
      else scene.remove(p)
    }
    tick()
  }
  // shock ring
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.2,0.35,16), new THREE.MeshBasicMaterial({ color:0x7dd3fc, side:THREE.DoubleSide, transparent:true, opacity:0.9 }))
  ring.position.copy(pos)
  ring.position.y+=0.05
  ring.rotation.x=-Math.PI/2
  scene.add(ring)
  let a=0
  const anim=()=>{
    a+=0.07
    ring.scale.setScalar(1+a*2.2)
    ring.material.opacity=Math.max(0,0.9-a*1.1)
    if(a<1) requestAnimationFrame(anim)
    else scene.remove(ring)
  }
  anim()
}

// Collision helpers
function collides(pos){
  const r=0.35
  const pMin=new THREE.Vector3(pos.x-r,0,pos.z-r)
  const pMax=new THREE.Vector3(pos.x+r,1.8,pos.z+r)
  // walls
  for(const w of walls){
    if(pMax.x>w.min.x && pMin.x<w.max.x && pMax.z>w.min.z && pMin.z<w.max.z) return true
  }
  // targets as solid? allow walking through but bounce a bit
  // arena bounds
  if(Math.abs(pos.x)>21.2 || Math.abs(pos.z)>21.2) return true
  return false
}
let playerVelocity=new THREE.Vector3()
let lastPos=new THREE.Vector3().copy(camera.position)
function updateMovement(dt){
  if(gameState!=='playing' || !isLocked) return
  const speed = move.sprint ? 6.5 : 4.0
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y=0; forward.normalize()
  right.crossVectors(forward, new THREE.Vector3(0,1,0)).negate() // right = forward x up?

  // Actually right should be camera right
  const camRight = new THREE.Vector3()
  camRight.crossVectors(camera.getWorldDirection(new THREE.Vector3()), new THREE.Vector3(0,1,0)).normalize()
  // simpler: use controls movement
  let moveX=0, moveZ=0
  if(move.forward) moveZ -=1
  if(move.back) moveZ +=1
  if(move.left) moveX -=1
  if(move.right) moveX +=1
  const len=Math.hypot(moveX,moveZ)
  if(len>0){ moveX/=len; moveZ/=len }

  const wish = new THREE.Vector3()
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y=0; fwd.normalize()
  const rgt = new THREE.Vector3(); rgt.crossVectors(fwd, new THREE.Vector3(0,1,0)).normalize().negate() // hmm
  // Correct rgt:
  const up=new THREE.Vector3(0,1,0)
  const rightDir=new THREE.Vector3().crossVectors(fwd, up).negate() // no, fwd x up = right? Let's compute properly
  // For FPS: right = fwd cross up
  const properRight=new THREE.Vector3().crossVectors(fwd, up).normalize()
  // wish = fwd * -moveZ? Actually forward is -Z in view space? We use moveZ forward negative.
  wish.addScaledVector(fwd, -moveZ)
  wish.addScaledVector(properRight, moveX)
  if(wish.length()>0) wish.normalize().multiplyScalar(speed*dt)

  const next = camera.position.clone().add(wish)
  next.y = 1.75
  // separate axis collision for sliding
  const tryX = new THREE.Vector3(next.x, 1.75, camera.position.z)
  const tryZ = new THREE.Vector3(camera.position.x, 1.75, next.z)
  if(!collides(tryX)) camera.position.x = tryX.x
  if(!collides(tryZ)) camera.position.z = tryZ.z
  // clamp y
  camera.position.y=1.75
}


function hideOverlaysWhenPlaying(){
  if(gameState==='playing'){
    ui.overlayStart.classList.add('hidden')
    ui.overlayWin.classList.add('hidden')
    ui.overlayLose.classList.add('hidden')
  }
}
function showPause(){
  if(gameState==='playing'){
    ui.overlayStart.classList.remove('hidden')
    ui.overlayStart.querySelector('h2').textContent='PAUSED'
    ui.overlayStart.querySelector('p').textContent='Click to resume • ESC to stay paused'
    $('#btnPlay').textContent='RESUME'
  }
}
function resetGame(){
  health=100
  ammo=30
  reloading=false
  shootCooldown=0
  timeLeft=60
  elapsed=0
  startTime=performance.now()
  lastHealthDecay=performance.now()
  gameState='playing'
  ui.overlayStart.classList.add('hidden')
  ui.overlayWin.classList.add('hidden')
  ui.overlayLose.classList.add('hidden')
  ui.overlayStart.querySelector('h2').textContent='NEXUS BREACH'
  $('#btnPlay').textContent='CLICK TO BREACH • PLAY'
  camera.position.set(0,1.75,9)
  camera.rotation.set(0,0,0)
  controls.lock()
  spawnTargets()
  updateHUD()
}

function win(){
  if(gameState!=='playing') return
  gameState='won'
  controls.unlock()
  ui.overlayWin.classList.remove('hidden')
  const t=(60-timeLeft).toFixed(1)
  $('#winStats').textContent=`Cleared ${totalTargets} targets in ${t}s with ${health|0} health remaining.`
  updateHUD()
}
function lose(reason){
  if(gameState!=='playing') return
  gameState='lost'
  controls.unlock()
  ui.overlayLose.classList.remove('hidden')
  $('#loseStats').textContent = reason || 'Health or time expired.'
  updateHUD()
}

// UI buttons
$('#btnPlay').addEventListener('click', ()=>{
  if(gameState==='loading' || gameState==='ready') {
    resetGame()
  } else if(gameState==='playing' && !isLocked){
    controls.lock()
  } else if(gameState==='playing'){
    controls.lock()
  } else {
    resetGame()
  }
})
$('#btnHow').addEventListener('click', ()=>{
  alert('WASD move, Mouse look, Click shoot, R reload, ESC pause. Shoot all 8 crates before 60s or health 0. Walls block you. Ammo 30.')
})
$('#btnReplayWin').addEventListener('click', resetGame)
$('#btnReplayLose').addEventListener('click', resetGame)

addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth,innerHeight)
})

// Loop
let last=performance.now()
function animate(now){
  requestAnimationFrame(animate)
  const dt=Math.min(0.05, (now-last)/1000)
  last=now
  if(gameState==='playing'){
    if(isLocked) updateMovement(dt)
    shootCooldown=Math.max(0, shootCooldown-dt)
    // time
    elapsed=(now-startTime)/1000
    timeLeft=Math.max(0, 60 - elapsed)
    if(timeLeft<=0) lose('Time expired — 60 seconds elapsed')
    // health decay
    health = Math.max(0, health - dt*0.45) // ~27 per minute, forces speed
    // targets floating
    targets.forEach(t=>{
      if(!t.alive) return
      t.group.position.y = t.group.userData.baseY + Math.sin(now*0.0015 + t.group.userData.phase)*0.12
      t.group.rotation.y += dt*0.5
    })
    if(health<=0) lose('Health depleted')
    updateHUD()
  }
  // weapon sway when moving
  if(weapon && gameState==='playing' && isLocked){
    const moving = move.forward||move.back||move.left||move.right
    const sway = moving ? Math.sin(now*0.006)*0.015 : Math.sin(now*0.002)*0.004
    weapon.position.x = 0.35 + sway
    weapon.position.y = -0.28 + Math.abs(sway)*0.6
  }
  renderer.render(scene,camera)
}
animate(performance.now())

// Init: load GLBs then ready
loadGLBs().then(()=>{
  attachWeapon()
  spawnTargets()
  gameState='ready'
  ui.loadStatus.textContent='Ready — click Play'
  updateHUD()
  // prepare ground collision ready
  startTime=performance.now()
})

// Add some ambient particles for polish
{
  const g=new THREE.BufferGeometry()
  const cnt=600
  const pos=new Float32Array(cnt*3)
  for(let i=0;i<cnt;i++){
    pos[i*3]=(Math.random()-0.5)*44
    pos[i*3+1]=Math.random()*8+0.5
    pos[i*3+2]=(Math.random()-0.5)*44
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3))
  const m=new THREE.PointsMaterial({ color:0x38bdf8, size:0.06, transparent:true, opacity:0.35, sizeAttenuation:true })
  const pts=new THREE.Points(g,m)
  scene.add(pts)
}

// Expose for e2e checks
window.__GAME__ = {
  get state(){return gameState},
  get health(){return health},
  get ammo(){return ammo},
  get targets(){return targets.filter(t=>t.alive).length},
  get timeLeft(){return timeLeft},
  shoot, reload, reset:resetGame,
  win, lose,
}

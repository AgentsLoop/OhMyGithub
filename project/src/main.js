import * as THREE from 'three'
import { GAME, PLAYER, WEAPON, ENEMY, ARENA, WAVES, SCORE } from './constants.js'
import { GameState, gameState } from './state.js'
import { audio } from './audio.js'

// ---------- helpers ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v))
const lerp = (a,b,t)=>a+(b-a)*t
const rand = (a,b)=>a+Math.random()*(b-a)

// Expose for inspection
window.render_game_to_text = () => gameState.toText()
window.__GAME_STATE__ = gameState

// ---------- scene ----------
const canvas = document.getElementById('canvas')
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x8ea0b8)
scene.fog = new THREE.Fog(0xd6dde6, ARENA.fogNear, ARENA.fogFar)

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true })
renderer.setPixelRatio(Math.min(devicePixelRatio,2))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08

const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.1, 300)
camera.position.set(0, PLAYER.eyeHeight, 14)

const clock = new THREE.Clock()

// lights
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x8a6b45, 0.85))
const sun = new THREE.DirectionalLight(0xfff4e0, 1.35)
sun.position.set(40, 55, 22)
sun.castShadow = true
sun.shadow.mapSize.set(2048,2048)
sun.shadow.camera.near = 0.5
sun.shadow.camera.far = 180
sun.shadow.camera.left = -60
sun.shadow.camera.right = 60
sun.shadow.camera.top = 60
sun.shadow.camera.bottom = -60
sun.shadow.bias = -0.0006
scene.add(sun)
const fill = new THREE.DirectionalLight(0x8ecbff, 0.35)
fill.position.set(-30, 20, -30)
scene.add(fill)

// ground
const groundGeo = new THREE.PlaneGeometry(ARENA.size, ARENA.size)
const groundMat = new THREE.MeshStandardMaterial({ color: 0xcbbda6, roughness:0.92, metalness:0.02 })
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI/2
ground.receiveShadow = true
scene.add(ground)
// dust detail - subtle grid texture via canvas
{
  const c=document.createElement('canvas'); c.width=256;c.height=256
  const g=c.getContext('2d')
  g.fillStyle='#cbbda6'; g.fillRect(0,0,256,256)
  for(let i=0;i<4000;i++){ g.fillStyle=`rgba(110,90,60,${Math.random()*0.08})`; g.fillRect(Math.random()*256,Math.random()*256,2,2)}
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(6,6); t.colorSpace=THREE.SRGBColorSpace
  ground.material.map = t; ground.material.needsUpdate=true
}

// markings
{
  const markGeo = new THREE.RingGeometry(2.8,3.0,32)
  const markMat = new THREE.MeshBasicMaterial({color:0x182635, opacity:0.9, transparent:true, side:THREE.DoubleSide})
  for(let i=0;i<4;i++){
    const m=new THREE.Mesh(markGeo, markMat)
    m.rotation.x=-Math.PI/2; m.position.set(rand(-18,18),0.02,rand(-18,18))
    scene.add(m)
  }
}

const colliders = []
// walls
const wallMat = new THREE.MeshStandardMaterial({ color:0xb8c0cc, roughness:0.85 })
const wallH = ARENA.wallHeight
function wall(w,h,d,x,z){
  const g=new THREE.BoxGeometry(w,h,d)
  const m=new THREE.Mesh(g, wallMat)
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true
  scene.add(m)
  // collisions
  colliders.push({ min:new THREE.Vector3(x-w/2,0,z-d/2), max:new THREE.Vector3(x+w/2,h,z+d/2) })
}
const S = ARENA.size
wall(S+2, wallH, 2, 0, -S/2)
wall(S+2, wallH, 2, 0, S/2)
wall(2, wallH, S+2, -S/2, 0)
wall(2, wallH, S+2, S/2, 0)

// internal cover & structures
function boxCover(w,h,d,x,z, color=0x7b8a96, yaw=0){
  const g=new THREE.BoxGeometry(w,h,d)
  const mat=new THREE.MeshStandardMaterial({ color, roughness:0.78 })
  const m=new THREE.Mesh(g,mat)
  m.position.set(x,h/2,z); m.rotation.y=yaw; m.castShadow=true; m.receiveShadow=true
  scene.add(m)
  // AABB approx (ignore rotation for collision)
  const pad=0.2
  // enlarge a bit for rotated cases
  const hw=w/2+pad, hd=d/2+pad
  colliders.push({ min:new THREE.Vector3(x-hw,0,z-hd), max:new THREE.Vector3(x+hw,h,z+hd), mesh:m })
  return m
}
// concrete barriers
for(let i=0;i<14;i++){
  const x=rand(-S*0.42,S*0.42), z=rand(-S*0.42,S*0.42)
  if(Math.hypot(x,z)<8) continue
  const w=rand(2.2,4.5), d=rand(0.6,1.0)
  boxCover(w,1.1,d,x,z, 0x9aa7b5, rand(-0.5,0.5))
}
// shipping containers (cover + verticality)
boxCover(6,2.6,2.4, -18, -12, 0xc04a2f)
boxCover(6,2.6,2.4, -18, -9.6, 0xc04a2f)
boxCover(6,2.6,2.4, 19, 10, 0x2f6cb5)
boxCover(6,2.6,2.4, 19, 12.5, 0x2f6cb5)
boxCover(8,2.6,2.6, 0, -28, 0xb0b9c4)
boxCover(8,2.6,2.6, 0, 28, 0xb0b9c4)
// central depot structure
boxCover(10,3.2,10, 0,0, 0xa9b6c4)
{
  // pillars
  for(let p of [[-4,-4],[4,-4],[-4,4],[4,4]]){
    boxCover(0.7,3.2,0.7,p[0],p[1],0x8a94a2)
  }
}
// watch towers corners
function tower(x,z){
  boxCover(3.2,5,3.2,x,z,0x8f9dad)
  // top platform rim - visual only
  const g=new THREE.BoxGeometry(3.6,0.3,3.6)
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x18222e}))
  m.position.set(x,5.1,z); m.castShadow=true; scene.add(m)
}
tower(-S/2+6,-S/2+6); tower(S/2-6,-S/2+6); tower(-S/2+6,S/2-6); tower(S/2-6,S/2-6)

// spawn points visualized faint
// add some crates
for(let i=0;i<10;i++){
  const x=rand(-20,20), z=rand(-20,20)
  if(Math.hypot(x,z)<6) continue
  boxCover(1.1,1.1,1.1,x,z, 0x9a7b4a)
}

// ---------- player controller ----------
const keys = { w:false,a:false,s:false,d:false,shift:false}
let mouseDown=false
let yaw=0, pitch=0
let vel = new THREE.Vector3()
let onGround=true
let playerPos = new THREE.Vector3(0, PLAYER.eyeHeight, 14)
let playerVelY=0
let canJump=true
let lastShoot= -999
let screenShake=0
let fovBase=74

function isColliding(pos, radius=PLAYER.radius){
  for(const c of colliders){
    const cx=clamp(pos.x, c.min.x - radius, c.max.x + radius)
    const cz=clamp(pos.z, c.min.z - radius, c.max.z + radius)
    // quick check: if clamped point inside expanded box? simpler: check overlap
    const insideX = pos.x + radius > c.min.x && pos.x - radius < c.max.x
    const insideZ = pos.z + radius > c.min.z && pos.z - radius < c.max.z
    const insideY = pos.y - PLAYER.eyeHeight < c.max.y && pos.y > 0 // naive
    if(insideX && insideZ && insideY) return c
  }
  // arena bounds
  const lim=S/2-1
  if(Math.abs(pos.x)>lim || Math.abs(pos.z)>lim) return { min:new THREE.Vector3(-lim,-10,-lim), max:new THREE.Vector3(lim,10,lim), isWall:true }
  return null
}

// pointer lock
let isLocked=false
canvas.addEventListener('click', ()=>{
  if(gameState.get().phase!=='playing') return
  if(!isLocked){
    try{ canvas.requestPointerLock() }catch{}
    audio.unlock()
  } else {
    tryShoot()
  }
})
document.addEventListener('pointerlockchange', ()=>{
  isLocked = document.pointerLockElement===canvas
  document.getElementById('screenPause').classList.toggle('hidden', isLocked || gameState.get().phase!=='playing')
  if(isLocked) audio.unlock()
})
document.addEventListener('mousemove', (e)=>{
  if(!isLocked) return
  const sens=0.0024
  yaw -= e.movementX * sens
  pitch -= e.movementY * sens
  pitch = clamp(pitch, -1.42, 1.42)
})

window.addEventListener('keydown', (e)=>{
  const k=e.key.toLowerCase()
  if(k==='w') keys.w=true
  if(k==='a') keys.a=true
  if(k==='s') keys.s=true
  if(k==='d') keys.d=true
  if(k==='shift') keys.shift=true
  if(k==='r'){ tryReload() }
  if(k===' '){ if(onGround && canJump){ playerVelY = PLAYER.jumpForce; onGround=false; canJump=false; audio.step(false) } e.preventDefault() }
  if(k==='escape'){
    if(gameState.get().phase==='playing' && isLocked) document.exitPointerLock()
  }
})
window.addEventListener('keyup', (e)=>{
  const k=e.key.toLowerCase()
  if(k==='w') keys.w=false
  if(k==='a') keys.a=false
  if(k==='s') keys.s=false
  if(k==='d') keys.d=false
  if(k==='shift') keys.shift=false
  if(k===' ') canJump=true
})
window.addEventListener('mousedown', (e)=>{
  if(e.button===0){ mouseDown=true; if(gameState.get().phase==='playing' && isLocked) tryShoot() }
})
window.addEventListener('mouseup', (e)=>{ if(e.button===0) mouseDown=false })

// ---------- weapon visuals ----------
const weaponGroup = new THREE.Group()
camera.add(weaponGroup)
scene.add(camera) // ensure camera in scene

// gun model - procedural carbine
let muzzleFlash
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.09,0.42), new THREE.MeshStandardMaterial({color:0x18202a, roughness:0.4, metalness:0.2}))
  body.position.set(0.28,-0.24,-0.48)
  weaponGroup.add(body)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.28,10), new THREE.MeshStandardMaterial({color:0x11151b}))
  barrel.rotation.x=Math.PI/2; barrel.position.set(0.28,-0.21,-0.74); weaponGroup.add(barrel)
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.04,0.06), new THREE.MeshStandardMaterial({color:0x0f141a}))
  sight.position.set(0.28,-0.17,-0.5); weaponGroup.add(sight)
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.12,0.09), new THREE.MeshStandardMaterial({color:0x101720}))
  mag.position.set(0.28,-0.33,-0.42); weaponGroup.add(mag)
  // muzzle flash billboard
  const flashGeo = new THREE.PlaneGeometry(0.18,0.18)
  const flashMat = new THREE.MeshBasicMaterial({ color:0xfff1a6, transparent:true, opacity:0, side:THREE.DoubleSide, blending:THREE.AdditiveBlending })
  muzzleFlash = new THREE.Mesh(flashGeo, flashMat)
  muzzleFlash.position.set(0.28,-0.21,-0.88)
  muzzleFlash.lookAt(0.28,-0.21,-1.5)
  weaponGroup.add(muzzleFlash)
}

// tracers pool
const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)])
const tracers=[]
function spawnTracer(from, dir, len=8){
  const mat=new THREE.LineBasicMaterial({color:0xfff2a0, transparent:true, opacity:0.95})
  const geo=new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone().add(dir.clone().multiplyScalar(len))])
  const line=new THREE.Line(geo, mat)
  scene.add(line)
  tracers.push({ line, mat, life:0.07 })
}

// particles
const particles=[]
function spawnParticles(pos, color, count=10, speed=5){
  for(let i=0;i<count;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.05,6,6), new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.95}))
    p.position.copy(pos)
    const v=new THREE.Vector3(rand(-1,1), rand(-0.2,1), rand(-1,1)).normalize().multiplyScalar(rand(speed*0.5,speed))
    particles.push({ mesh:p, vel:v, life:rand(0.35,0.7), age:0, gravity: -7 })
    scene.add(p)
  }
}
function spawnSparks(pos){
  for(let i=0;i<12;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(0.025,5,5), new THREE.MeshBasicMaterial({color:0xffd56b}))
    p.position.copy(pos)
    const v=new THREE.Vector3(rand(-1,1), rand(0.3,1), rand(-1,1)).normalize().multiplyScalar(rand(6,13))
    particles.push({ mesh:p, vel:v, life:0.25, age:0, gravity:-14 })
    scene.add(p)
  }
}

// ---------- enemies ----------
const enemies=[]
let enemyGroup=new THREE.Group()
scene.add(enemyGroup)

function makeGrunt(pos){
  const g=new THREE.Group()
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.9,0.38), new THREE.MeshStandardMaterial({color:0x2b3a4a, roughness:0.8}))
  body.position.y=0.9; body.castShadow=true; g.add(body)
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), new THREE.MeshStandardMaterial({color:0xd8c9b4}))
  head.position.y=1.55; g.add(head)
  const eyeL=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,6), new THREE.MeshBasicMaterial({color:0xff2d2d}))
  eyeL.position.set(-0.08,1.56,0.18); g.add(eyeL)
  const eyeR=eyeL.clone(); eyeR.position.x=0.08; g.add(eyeR)
  // weapon
  const gun=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.06,0.32), new THREE.MeshStandardMaterial({color:0x0f141a}))
  gun.position.set(0.22,0.95,0.28); g.add(gun)
  // health bar sprite
  const canvasHB=document.createElement('canvas'); canvasHB.width=128; canvasHB.height=16
  const ctx=canvasHB.getContext('2d')
  const tex=new THREE.CanvasTexture(canvasHB)
  const sprMat=new THREE.SpriteMaterial({map:tex})
  const sprite=new THREE.Sprite(sprMat); sprite.scale.set(1.1,0.15,1); sprite.position.y=2.1
  g.add(sprite)
  g.position.copy(pos); g.position.y=0
  enemyGroup.add(g)
  return { kind:'grunt', mesh:g, pos:g.position, health:ENEMY.gruntHealth, max:ENEMY.gruntHealth, lastAtk:-999, dead:false, speed:ENEMY.gruntSpeed, bar:{canvas:canvasHB,ctx,tex,sprite} }
}
function makeDrone(pos){
  const g=new THREE.Group()
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.16,14), new THREE.MeshStandardMaterial({color:0x3b4a5e, roughness:0.5, metalness:0.25}))
  disc.position.y=1.9; disc.castShadow=true; g.add(disc)
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.12,10,10), new THREE.MeshBasicMaterial({color:0xff3b3b}))
  eye.position.y=1.9; g.add(eye)
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.32,0.38,16), new THREE.MeshBasicMaterial({color:0x7ef0a8, side:THREE.DoubleSide, transparent:true, opacity:0.85}))
  ring.rotation.x=Math.PI/2; ring.position.y=1.82; g.add(ring)
  const prop=new THREE.Mesh(new THREE.BoxGeometry(0.68,0.02,0.08), new THREE.MeshBasicMaterial({color:0x9bb0c8, transparent:true, opacity:0.9}))
  prop.position.y=2.0; g.add(prop)
  // health bar
  const canvasHB=document.createElement('canvas'); canvasHB.width=128; canvasHB.height=16
  const ctx=canvasHB.getContext('2d')
  const tex=new THREE.CanvasTexture(canvasHB)
  const sprMat=new THREE.SpriteMaterial({map:tex})
  const sprite=new THREE.Sprite(sprMat); sprite.scale.set(1.0,0.13,1); sprite.position.y=2.45
  g.add(sprite)
  g.userData.prop=prop; g.userData.baseY=1.9
  g.position.copy(pos); g.position.y=0
  enemyGroup.add(g)
  return { kind:'drone', mesh:g, pos:g.position, health:ENEMY.droneHealth, max:ENEMY.droneHealth, lastAtk:-999, dead:false, speed:ENEMY.droneSpeed, bar:{canvas:canvasHB,ctx,tex,sprite}, hover:Math.random()*Math.PI*2 }
}

function updateEnemyBar(e){
  const {ctx,canvas,tex}=e.bar
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,128,16)
  const pct=clamp(e.health/e.max,0,1)
  ctx.fillStyle=pct>0.5?'#21ff86':pct>0.25?'#ffcc2e':'#ff3b3b'
  ctx.fillRect(2,3, (124)*pct,10)
  ctx.strokeStyle='rgba(255,255,255,0.25)'; ctx.strokeRect(0.5,0.5,127,15)
  tex.needsUpdate=true
}

function spawnWave(index){
  // clear previous dead references? keep group
  const wave=WAVES[index]
  const count=wave.grunts+wave.drones
  gameState.registerWaveAlive(count)
  // spawn positions around arena
  const pts=[]
  for(let i=0;i<wave.grunts;i++){
    let p
    let tries=0
    do{
      const ang= rand(0, Math.PI*2)
      const rad= rand(12, ARENA.size*0.42)
      p=new THREE.Vector3(Math.cos(ang)*rad,0, Math.sin(ang)*rad)
      tries++
    }while(Math.hypot(p.x - playerPos.x, p.z - playerPos.z)<10 && tries<20)
    const e=makeGrunt(p)
    enemies.push(e); updateEnemyBar(e)
    pts.push(e)
  }
  for(let i=0;i<wave.drones;i++){
    const ang=rand(0,Math.PI*2), rad=rand(10, ARENA.size*0.40)
    const p=new THREE.Vector3(Math.cos(ang)*rad,0, Math.sin(ang)*rad)
    const e=makeDrone(p)
    enemies.push(e); updateEnemyBar(e)
    pts.push(e)
  }
  updateHUD()
  showToast(`WAVE ${index+1}: ${wave.objective} — ${count} hostiles`)
  audio.wave()
}

// ---------- HUD ----------
function updateHUD(){
  const s=gameState.get()
  const wave=WAVES[s.waveIndex]
  document.getElementById('hudWave').textContent=`${s.waveIndex+1}/${s.wavesTotal}`
  document.getElementById('hudKills').textContent=s.kills
  document.getElementById('hudScore').textContent=s.score
  document.getElementById('hudAmmo').textContent=s.ammo
  document.getElementById('hudMag').textContent=`/${s.magSize}`
  document.getElementById('hudReserve').textContent=s.reserve
  document.getElementById('hudEnemies').textContent=s.enemiesAlive
  document.getElementById('hudHealthTxt').textContent=`${Math.round(s.health)}%`
  document.getElementById('healthBar').style.width=`${clamp(s.health,0,100)}%`
  document.getElementById('healthBar').className=''
  if(s.health<35) document.getElementById('healthBar').classList.add('low')
  document.getElementById('objText').textContent=wave.objective
  document.getElementById('objCount').textContent=`• ${s.enemiesAlive} hostiles`
  const sec=Math.floor(s.time)
  const mm=String(Math.floor(sec/60)).padStart(2,'0')
  const ss=String(sec%60).padStart(2,'0')
  document.getElementById('hudTime').textContent=`${mm}:${ss}`
  document.getElementById('reloadBar').style.width=`${s.isReloading? (s.reloadProgress*100).toFixed(1)+'%':'0%'}`
  if(s.isReloading) document.getElementById('hudWeaponMeta').textContent='RELOADING…'
  else if(s.ammo===0) document.getElementById('hudWeaponMeta').textContent='EMPTY — Press R to reload'
  else document.getElementById('hudWeaponMeta').textContent='Click to shoot • R to reload • Hold Shift to sprint'
}

function showToast(msg){
  const t=document.getElementById('toast')
  t.textContent=msg; t.classList.add('show')
  clearTimeout(showToast._id)
  showToast._id=setTimeout(()=> t.classList.remove('show'), 2200)
}
function hitMarkerFlash(headshot){
  const el=document.getElementById('hitMarker')
  el.textContent=headshot? 'HEADSHOT':'HIT'
  el.style.color=headshot?'#ffeb3b':'#fff'
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show')
  document.getElementById('crosshair').classList.remove('hit'); void document.getElementById('crosshair').offsetWidth; document.getElementById('crosshair').classList.add('hit')
}
function damageVignette(intensity){
  const v=document.getElementById('damageVignette')
  v.style.boxShadow=`inset 0 0 0 999px rgba(255,30,30,${0.42*intensity})`
  setTimeout(()=> v.style.boxShadow=`inset 0 0 0 999px rgba(255,30,30,0)`, 170)
}

// ---------- combat ----------
function tryShoot(){
  const now=clock.getElapsedTime()
  if(now - lastShoot < WEAPON.fireRate) return
  const s=gameState.get()
  if(s.phase!=='playing') return
  if(s.isReloading) return
  if(s.ammo<=0){ audio.hit(); showToast('Reload! Press R'); return }
  // fire
  const ok=gameState.shoot(now)
  if(!ok) return
  lastShoot=now
  // effects
  audio.shoot()
  screenShake=0.55
  // muzzle flash
  muzzleFlash.material.opacity=1
  setTimeout(()=> muzzleFlash.material.opacity=0, 48)
  // weapon kick anim
  weaponGroup.position.z = 0.08
  setTimeout(()=> weaponGroup.position.z=0, 80)
  // raycast
  const origin= camera.getWorldPosition(new THREE.Vector3())
  const dir= camera.getWorldDirection(new THREE.Vector3())
  // slight spread
  dir.x += rand(-WEAPON.spread, WEAPON.spread)
  dir.y += rand(-WEAPON.spread, WEAPON.spread)
  dir.z += rand(-WEAPON.spread, WEAPON.spread)
  dir.normalize()
  // trace to enemies first (sphere approximated)
  let hit=null, hitDist=WEAPON.range, hitHead=false
  const hitPos=new THREE.Vector3()
  for(const e of enemies){
    if(e.dead) continue
    // center
    const center=e.mesh.position.clone(); center.y = e.kind==='drone'?1.9:1.0
    const to = center.clone().sub(origin)
    const proj = to.dot(dir)
    if(proj<0 || proj>hitDist) continue
    const closest = origin.clone().add(dir.clone().multiplyScalar(proj))
    const dist = closest.distanceTo(center)
    const radius = e.kind==='drone'?0.55:0.6
    if(dist < radius){
      if(proj < hitDist){
        hit=e; hitDist=proj; hitPos.copy(closest)
        // headshot check for grunt: top portion
        if(e.kind==='grunt' && closest.y > 1.35) hitHead=true
        else hitHead=false
      }
    }
  }
  // wall / ground intersection for visual - just use hitDist endpoint
  const end = origin.clone().add(dir.clone().multiplyScalar(hit ? hitDist : WEAPON.range))
  spawnTracer(origin, dir, hit?hitDist:10)

  if(hit){
    const dmg = WEAPON.damage * (hitHead? WEAPON.headshotMult:1)
    hit.health -= dmg
    updateEnemyBar(hit)
    // push back
    hit.mesh.position.add(dir.clone().multiplyScalar(0.22))
    if(hit.health<=0){
      hit.dead=true
      // explode
      spawnParticles(hit.mesh.position.clone().add(new THREE.Vector3(0,1,0)), hit.kind==='drone'?0x7ef0a8:0xff3b3b, 16, 7)
      spawnSparks(hit.mesh.position.clone().add(new THREE.Vector3(0,1,0)))
      // fade out mesh
      hit.mesh.visible=false
      gameState.addKill(hit.kind, hitHead)
      audio.kill()
      hitMarkerFlash(hitHead)
      showToast(hitHead? 'HEADSHOT +50':'ELIMINATED')
    } else {
      // hit feedback: tint
      const meshes=[]
      hit.mesh.traverse(o=>{ if(o.isMesh) meshes.push(o) })
      const orig=meshes.map(m=>m.material.color?m.material.color.clone():null)
      meshes.forEach(m=>{ if(m.material.color) m.material.color.set(0xff3840) })
      setTimeout(()=> meshes.forEach((m,i)=>{ if(m.material.color && orig[i]) m.material.color.copy(orig[i]) }), 80)
      audio.hitEnemy()
      hitMarkerFlash(hitHead)
      spawnSparks(hitPos)
    }
    // check wave completion
    const alive = enemies.filter(e=>!e.dead).length
    gameState.get().enemiesAlive = alive
    if(alive===0){
      const advanced=gameState.tryAdvanceWave()
      if(advanced){
        if(gameState.get().phase==='won'){
          showWon()
          audio.win()
        } else {
          // next wave after delay
          setTimeout(()=> spawnWave(gameState.get().waveIndex), 1600)
          audio.wave()
          showToast(`WAVE ${gameState.get().waveIndex+1} INBOUND`)
        }
      }
    }
  } else {
    // miss: impact on ground/wall -> spark at end point if near ground
    // simple ground impact
    const impact = end.clone()
    // clamp to nearest wall if ray goes beyond arena
    // just spark a bit mid-air
    spawnSparks(impact)
  }
  updateHUD()
}

function tryReload(){
  const s=gameState.get()
  if(s.phase!=='playing') return
  if(s.isReloading) return
  if(s.ammo===s.magSize || s.reserve<=0) return
  const ok=gameState.beginReload(clock.getElapsedTime())
  if(!ok) return
  audio.reload()
  showToast('Reloading…')
  // progress
  let start=clock.getElapsedTime()
  function tick(){
    const now=clock.getElapsedTime()
    const p=clamp((now-start)/WEAPON.reloadTime,0,1)
    gameState.get().reloadProgress=p
    updateHUD()
    if(p>=1){
      gameState.completeReload()
      audio.reloadDone()
      updateHUD()
      showToast('Ready')
    } else if(gameState.get().isReloading){
      requestAnimationFrame(tick)
    }
  }
  requestAnimationFrame(tick)
}

// ---------- minimap ----------
const miniCanvas=document.getElementById('mini')
const miniCtx=miniCanvas.getContext('2d')
function drawMini(){
  const s=gameState.get()
  const w=300,h=300
  miniCtx.clearRect(0,0,w,h)
  // bg
  miniCtx.fillStyle='#0d1520'; miniCtx.fillRect(0,0,w,h)
  // bounds
  miniCtx.strokeStyle='rgba(255,255,255,0.1)'; miniCtx.lineWidth=2
  miniCtx.strokeRect(8,8,w-16,h-16)
  // cover dots
  miniCtx.fillStyle='rgba(154,170,185,0.9)'
  for(const c of colliders){
    // project world xz to minimap 300
    const nx=(c.min.x / (S/2))* (w*0.42) + w/2
    const nz=(c.min.z / (S/2))* (h*0.42) + h/2
    const ww=Math.max(3, (c.max.x-c.min.x)*2.2)
    const hh=Math.max(3, (c.max.z-c.min.z)*2.2)
    miniCtx.fillRect(nx-ww/2, nz-hh/2, ww, hh)
  }
  // enemies
  for(const e of enemies){
    if(e.dead) continue
    const nx=(e.pos.x/(S/2))*(w*0.42)+w/2
    const nz=(e.pos.z/(S/2))*(h*0.42)+h/2
    miniCtx.fillStyle=e.kind==='drone'?'#7ef0a8':'#ff5a5a'
    miniCtx.beginPath(); miniCtx.arc(nx,nz, e.kind==='drone'?4:3.5,0,Math.PI*2); miniCtx.fill()
  }
  // player
  const px=(playerPos.x/(S/2))*(w*0.42)+w/2
  const pz=(playerPos.z/(S/2))*(h*0.42)+h/2
  miniCtx.fillStyle='#fff'
  miniCtx.beginPath(); miniCtx.arc(px,pz,5,0,Math.PI*2); miniCtx.fill()
  // dir
  miniCtx.strokeStyle='#fff'; miniCtx.lineWidth=2
  miniCtx.beginPath(); miniCtx.moveTo(px,pz); miniCtx.lineTo(px+Math.sin(yaw)*14, pz+Math.cos(yaw)*14); miniCtx.stroke()
}

// ---------- game flow ----------
function startMission(){
  // reset
  enemies.forEach(e=>{ enemyGroup.remove(e.mesh) })
  enemies.length=0
  playerPos.set(0, PLAYER.eyeHeight, 14)
  vel.set(0,0,0); playerVelY=0; onGround=true
  yaw=0; pitch=0
  gameState.startMission()
  gameState.get().time=0
  // reset screens
  document.getElementById('screenTitle').classList.add('hidden')
  document.getElementById('screenDead').classList.add('hidden')
  document.getElementById('screenWon').classList.add('hidden')
  document.getElementById('screenPause').classList.add('hidden')
  spawnWave(0)
  // lock pointer next tick
  setTimeout(()=>{
    try{ canvas.requestPointerLock() }catch{}
    audio.unlock()
  }, 60)
  updateHUD()
}
function showDead(){
  document.getElementById('deadWave').textContent=`${gameState.get().waveIndex+1}/${gameState.get().wavesTotal}`
  document.getElementById('deadScore').textContent=gameState.get().score
  document.getElementById('deadKills').textContent=gameState.get().kills
  document.getElementById('screenDead').classList.remove('hidden')
  try{ document.exitPointerLock() }catch{}
}
function showWon(){
  const s=gameState.get()
  document.getElementById('wonScore').textContent=s.score
  document.getElementById('wonKills').textContent=s.kills
  const sec=Math.floor(s.time); const mm=String(Math.floor(sec/60)).padStart(2,'0'); const ss=String(sec%60).padStart(2,'0')
  document.getElementById('wonTime').textContent=`${mm}:${ss}`
  document.getElementById('screenWon').classList.remove('hidden')
  try{ document.exitPointerLock() }catch{}
}

// button wiring
document.getElementById('btnStart').addEventListener('click', ()=>{ audio.unlock(); startMission() })
document.getElementById('btnHow').addEventListener('click', ()=>{ showToast('WASD Move • Mouse Look • Click Shoot • R Reload • Shift Sprint • Space Jump') })
document.getElementById('btnRespawn').addEventListener('click', startMission)
document.getElementById('btnAgain').addEventListener('click', startMission)
document.getElementById('btnToTitle1').addEventListener('click', ()=>{ document.getElementById('screenDead').classList.add('hidden'); document.getElementById('screenTitle').classList.remove('hidden'); gameState.reset(); updateHUD() })
document.getElementById('btnToTitle2').addEventListener('click', ()=>{ document.getElementById('screenWon').classList.add('hidden'); document.getElementById('screenTitle').classList.remove('hidden'); gameState.reset(); updateHUD() })
document.getElementById('btnResume').addEventListener('click', ()=>{ try{ canvas.requestPointerLock()}catch{} })

// expose test helpers
window.__testStartMission = startMission
window.__testShoot = () => { tryShoot(); return gameState.get().firedShot }
window.__testReload = () => { tryReload(); return gameState.get().isReloading }
window.__testTakeDamage = (amt=20) => { gameState.takeDamage(amt, clock.getElapsedTime()); updateHUD(); return gameState.get().health }
window.__testRestart = () => { gameState.reset(); enemies.forEach(e=>enemyGroup.remove(e.mesh)); enemies.length=0; updateHUD(); document.getElementById('screenDead').classList.add('hidden'); document.getElementById('screenWon').classList.add('hidden'); document.getElementById('screenTitle').classList.remove('hidden'); return true }
window.__testCompleteObjective = () => {
  // kill all alive instantly for test
  for(const e of enemies){ if(!e.dead){ e.dead=true; e.mesh.visible=false; gameState.addKill(e.kind,false) } }
  gameState.get().enemiesAlive=0
  // advance through all waves
  while(gameState.get().phase==='playing' && gameState.get().enemiesAlive===0){
    const wasLast = gameState.get().waveIndex >= WAVES.length-1
    gameState.tryAdvanceWave()
    if(wasLast) break
    if(gameState.get().phase==='won') break
    // spawn and instantly kill next wave? skip spawn for test - just increment
    if(gameState.get().enemiesAlive===0 && gameState.get().phase!=='won'){
      // simulate spawning and clearing without actually spawning geometry
      gameState.registerWaveAlive(0)
    }
  }
  updateHUD()
  return gameState.get().phase
}
window.__testMove = (dx,dz) => {
  const np=playerPos.clone(); np.x+=dx; np.z+=dz
  const col=isColliding(np)
  if(!col) playerPos.copy(np)
  return { x:playerPos.x, z:playerPos.z, collided:!!col }
}
window.dispatchGameEvent = (ev, data) => gameState.emit(ev,data)

// listen for death/win to show screens
gameState.on('player:death', ()=> showDead())
gameState.on('game:win', ()=> showWon())
gameState.on('player:damage', ()=> { damageVignette(1); screenShake=0.7; audio.hurt() })

// ---------- render loop ----------
let lastStepSound=0
function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(), 0.033)
  const elapsed=clock.getElapsedTime()
  const s=gameState.get()

  // Auto-shoot while holding mouse
  if(mouseDown && isLocked && s.phase==='playing' && !s.isReloading){
    if(elapsed - lastShoot >= WEAPON.fireRate) tryShoot()
  }

  if(s.phase==='playing'){
    s.time += dt
    // movement
    const speed = PLAYER.speed * (keys.shift? PLAYER.sprintMult:1)
    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw))
    const right=new THREE.Vector3(Math.sin(yaw+Math.PI/2),0,Math.cos(yaw+Math.PI/2))
    let move=new THREE.Vector3()
    if(keys.w) move.add(forward)
    if(keys.s) move.sub(forward)
    if(keys.a) move.sub(right)
    if(keys.d) move.add(right)
    if(move.lengthSq()>0){
      move.normalize().multiplyScalar(speed*dt)
      // try X then Z for sliding collisions
      const tryX=playerPos.clone(); tryX.x+=move.x
      if(!isColliding(tryX)) playerPos.x=tryX.x
      const tryZ=playerPos.clone(); tryZ.z+=move.z
      if(!isColliding(tryZ)) playerPos.z=tryZ.z
      // footstep sound
      if(elapsed - lastStepSound > (keys.shift?0.26:0.38)){
        lastStepSound=elapsed
        if(onGround) audio.step(keys.shift)
      }
      s.sprinting=keys.shift
    } else s.sprinting=false

    // gravity / jump
    playerVelY -= PLAYER.gravity * dt
    playerPos.y += playerVelY * dt
    if(playerPos.y <= PLAYER.eyeHeight){
      playerPos.y = PLAYER.eyeHeight
      playerVelY=0
      onGround=true
    } else onGround=false
    s.onGround=onGround
    s.position.x=playerPos.x; s.position.y=playerPos.y; s.position.z=playerPos.z
    s.yaw=yaw; s.pitch=pitch
    s.damageFlash = Math.max(0, s.damageFlash - dt*3)
    s.hitMarker = Math.max(0, s.hitMarker - dt*4)

    // enemies AI
    for(const e of enemies){
      if(e.dead) continue
      // look at player
      const dx=playerPos.x - e.pos.x
      const dz=playerPos.z - e.pos.z
      const dist=Math.hypot(dx,dz)
      // hovering bob for drone
      if(e.kind==='drone'){
        e.hover+= dt*2.4
        e.mesh.position.y = Math.sin(e.hover)*0.22
        if(e.mesh.userData.prop) e.mesh.userData.prop.rotation.y+= dt*10
      }
      if(dist < ENEMY.detectionRange){
        // move towards but keep range
        let moveSpeed=e.speed*dt
        // strafe occasionally
        const desired= ENEMY.attackRange*0.55
        let targetDist=dist
        // jitter
        if(dist > desired+1){
          const dirX=dx/dist, dirZ=dz/dist
          const nx=e.pos.x + dirX*moveSpeed
          const nz=e.pos.z + dirZ*moveSpeed
          const np=new THREE.Vector3(nx,0,nz)
          // simple collision avoid: if collides, try perpendicular
          const col=isColliding(np,0.5)
          if(!col){
            e.pos.x=nx; e.pos.z=nz
          } else {
            // strafe
            e.pos.x += -dirZ*moveSpeed*0.7
            e.pos.z += dirX*moveSpeed*0.7
          }
        } else if(dist < 4){
          // back up a bit
          const dirX=dx/dist, dirZ=dz/dist
          e.pos.x -= dirX*moveSpeed*0.5
          e.pos.z -= dirZ*moveSpeed*0.5
        } else {
          // strafe
          const ang=elapsed*0.7 + (e.kind==='drone'? 1.3:0)
          e.pos.x += Math.cos(ang)*moveSpeed*0.6
          e.pos.z += Math.sin(ang)*moveSpeed*0.6
        }
        // rotate to player
        const angTo=Math.atan2(dx,dz)
        e.mesh.rotation.y=angTo
        // attack
        if(dist < ENEMY.attackRange && elapsed - e.lastAtk > ENEMY.attackCooldown){
          // line of sight simple: check no collider between
          let blocked=false
          // ray march few steps
          const steps=8
          for(let ss2=1; ss2<=steps; ss2++){
            const t=ss2/steps
            const mx= lerp(e.pos.x, playerPos.x, t)
            const mz= lerp(e.pos.z, playerPos.z, t)
            const test=new THREE.Vector3(mx,1,mz)
            // if cover blocks at about 1m height
            for(const c of colliders){
              if(mx> c.min.x && mx< c.max.x && mz> c.min.z && mz< c.max.z && c.max.y>0.8){
                // check if this collider is between - coarse
                // if closer to enemy than player, assume block
                const d1=Math.hypot(mx-e.pos.x, mz-e.pos.z)
                if(d1 < dist*0.85 && d1>1.2){ blocked=true; break }
              }
            }
            if(blocked) break
          }
          if(!blocked){
            e.lastAtk=elapsed
            // muzzle-like flash on enemy
            spawnSparks(e.mesh.position.clone().add(new THREE.Vector3(0,1,0)))
            const dmg=e.kind==='drone'? ENEMY.droneDamage: ENEMY.gruntDamage
            const took=gameState.takeDamage(dmg, elapsed)
            if(took){ damageVignette(1); screenShake=0.65 }
          }
        }
      }
      e.mesh.position.x=e.pos.x
      e.mesh.position.z=e.pos.z
      updateEnemyBar(e)
    }

    // update HUD time
    updateHUD()
  }

  // particles update
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]
    p.age+=dt
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt))
    p.vel.y += p.gravity*dt
    p.vel.multiplyScalar(0.985)
    p.mesh.material.opacity = 1 - p.age/p.life
    p.mesh.scale.setScalar(1 - p.age/p.life*0.3)
    if(p.age>=p.life){ scene.remove(p.mesh); particles.splice(i,1) }
  }
  // tracers
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i]
    t.life-=dt
    t.mat.opacity = t.life/0.07
    if(t.life<=0){ scene.remove(t.line); tracers.splice(i,1) }
  }

  // camera
  camera.position.copy(playerPos)
  camera.rotation.order='YXZ'
  camera.rotation.y=yaw
  camera.rotation.x=pitch
  // sprint FOV
  const targetFov = (keys.shift && (keys.w||keys.a||keys.s||keys.d) && s.phase==='playing' && onGround)? 78:74
  camera.fov = lerp(camera.fov, targetFov, dt*6)
  camera.updateProjectionMatrix()
  // screen shake
  if(screenShake>0){
    const sx=(Math.random()-0.5)*screenShake*0.08
    const sy=(Math.random()-0.5)*screenShake*0.08
    camera.position.x+=sx; camera.position.y+=sy
    screenShake = Math.max(0, screenShake - dt*2.2)
  }
  // weapon bob
  {
    const moving = (keys.w||keys.a||keys.s||keys.d) && s.phase==='playing'
    const t=elapsed* (keys.shift?11:7)
    const bobX = moving? Math.sin(t)*0.012 : 0
    const bobY = moving? Math.abs(Math.cos(t))*0.015 : 0
    weaponGroup.position.x = lerp(weaponGroup.position.x, bobX, dt*8)
    weaponGroup.position.y = lerp(weaponGroup.position.y, bobY -0.02, dt*8)
    weaponGroup.rotation.z = lerp(weaponGroup.rotation.z, moving? Math.sin(t)*0.02:0, dt*8)
  }

  drawMini()
  renderer.render(scene,camera)
}
animate()

// resize
window.addEventListener('resize', ()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix()
  renderer.setSize(innerWidth,innerHeight)
})

// initial HUD
updateHUD()
drawMini()

// keep render_game_to_text updated via HUD loop already, but ensure window global
window.render_game_to_text = () => gameState.toText()

// Auto-pause handling when tab hidden? ignore

// Accessibility: show title on load
console.log(GAME.title, GAME.codename)

<template>
  <main class="moondash">
    <div class="moondash-bg" aria-hidden="true">
      <div class="stars"></div>
      <div class="crater c1"></div>
      <div class="crater c2"></div>
      <div class="crater c3"></div>
    </div>

    <header class="md-header">
      <div class="md-title">
        <p class="eyebrow orange">MOONLIT PARCEL DASH — PLAYABLE NOW</p>
        <h1>Moonlit Parcel Dash</h1>
        <p>Pilot the rover, collect glowing parcels, dodge drifting rocks, deliver to the beacon before time runs out.</p>
      </div>
      <div class="md-badges">
        <span class="badge">◷ {{ timeLeft }}s</span>
        <span class="badge">✦ {{ score }} parcels</span>
        <span class="badge lives">♥ {{ lives }}</span>
        <button class="badge sound" :class="{ muted: !soundEnabled }" @click="soundEnabled=!soundEnabled" :aria-pressed="String(soundEnabled)" :title="soundEnabled ? 'Sound on (placeholder — no audio assets)' : 'Sound muted (placeholder)'">{{ soundEnabled ? '🔊 Sound' : '🔇 Muted' }}</button>
      </div>
    </header>

    <section class="game-shell">
      <div class="hud">
        <div class="hud-left">
          <strong>{{ hudState.label }}</strong>
          <small>{{ hudState.sub }}</small>
        </div>
        <div class="hud-right">
          <span class="need">Need {{ needed }} parcels to unlock beacon</span>
          <div class="progress"><div class="bar" :style="{ width: progress + '%' }"></div></div>
        </div>
      </div>

      <div class="canvas-wrap" ref="wrapRef">
        <canvas ref="canvasRef" width="960" height="540" aria-label="Moonlit Parcel Dash game canvas" role="img"></canvas>

        <!-- overlays -->
        <div v-if="phase==='idle'" class="overlay">
          <h2>Ready to roll?</h2>
          <p>Collect {{ needed }} glowing parcels and reach the pulsing beacon. Avoid rocks!</p>
          <div class="controls-legend">
            <span><kbd>WASD</kbd> / <kbd>Arrows</kbd> move</span>
            <span><kbd>Space</kbd> brake / dash</span>
            <span>Touch: on-screen pad or swipe</span>
          </div>
          <button class="primary" @click="startGame">Launch Rover ▶</button>
          <p class="hint">Tip: Beacon appears after collecting {{ needed }} parcels. Deliver fast for bonus time!</p>
        </div>

        <div v-if="phase==='won'" class="overlay win">
          <h2>Delivery Complete! 🌕📦</h2>
          <p>You delivered {{ score }} parcels in {{ elapsed }}s — Rover hero!</p>
          <div class="stats"><span>Score {{ score * 120 + Math.max(0, timeLeft)*10 }}</span><span>Time left {{ timeLeft }}s</span><span>Lives {{ lives }}/3</span></div>
          <button class="primary" @click="startGame">Replay ↺</button>
        </div>

        <div v-if="phase==='lost'" class="overlay lose">
          <h2>{{ lossReason }}</h2>
          <p>{{ score }} parcels collected. The moon is unforgiving.</p>
          <button class="primary" @click="startGame">Try Again ↺</button>
        </div>

        <div v-if="phase==='paused'" class="overlay">
          <h2>Paused</h2>
          <button class="primary" @click="resume">Resume ▶</button>
        </div>
      </div>

      <div class="bottom-row">
        <div class="touch-pad" aria-label="Touch controls">
          <div class="drow">
            <button @touchstart.prevent="press('up',true)" @touchend.prevent="press('up',false)" @mousedown="press('up',true)" @mouseup="press('up',false)" @mouseleave="press('up',false)">▲</button>
          </div>
          <div class="drow">
            <button @touchstart.prevent="press('left',true)" @touchend.prevent="press('left',false)" @mousedown="press('left',true)" @mouseup="press('left',false)" @mouseleave="press('left',false)">◀</button>
            <button @touchstart.prevent="press('down',true)" @touchend.prevent="press('down',false)" @mousedown="press('down',true)" @mouseup="press('down',false)" @mouseleave="press('down',false)">▼</button>
            <button @touchstart.prevent="press('right',true)" @touchend.prevent="press('right',false)" @mousedown="press('right',true)" @mouseup="press('right',false)" @mouseleave="press('right',false)">▶</button>
          </div>
        </div>
        <div class="actions">
          <button class="ghost" @click="togglePause">{{ phase==='playing' ? 'Pause ⏸' : phase==='paused' ? 'Resume ▶' : 'Pause' }}</button>
          <button class="ghost" @click="startGame">Replay ↺</button>
          <button class="ghost" @click="soundEnabled=!soundEnabled" :title="soundEnabled ? 'Sound on (placeholder)' : 'Sound muted (placeholder)'">{{ soundEnabled ? '🔊' : '🔇' }} {{ soundEnabled ? 'Sound on' : 'Muted' }}</button>
          <span class="keys">Desktop: WASD / Arrows · Space brake · P pause · R replay · {{ soundEnabled ? 'Sound placeholder on' : 'Sound placeholder muted' }}</span>
        </div>
      </div>

      <p class="attribution">No external assets — all visuals drawn on canvas. Inspired by lunar courier missions.</p>
    </section>
  </main>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref(null)
const wrapRef = ref(null)
let ctx = null
let raf = 0
let last = 0

const TIME_TOTAL = 60
const NEEDED = 8
const needed = NEEDED
const timeLeft = ref(TIME_TOTAL)
const score = ref(0)
const lives = ref(3)
const phase = ref('idle') // idle | playing | paused | won | lost
const elapsed = ref(0)
const lossReason = ref('Out of Time')
const soundEnabled = ref(true) // placeholder — no audio assets, visual toggle only

const progress = computed(() => Math.min(100, (score.value / needed) * 100))
const hudState = computed(() => {
  if (phase.value === 'won') return { label: 'Delivered!', sub: 'Beacon reached' }
  if (phase.value === 'lost') return { label: 'Mission failed', sub: lossReason.value }
  if (phase.value === 'idle') return { label: 'Awaiting launch', sub: 'Press Launch Rover' }
  if (beaconActive.value) return { label: 'Beacon unlocked — deliver now!', sub: 'Head to the pulsing green light' }
  return { label: `Collect parcels ${score.value}/${needed}`, sub: 'Dodge the drifting rocks' }
})

const keys = { up:false, down:false, left:false, right:false, space:false }
const touch = { up:false, down:false, left:false, right:false }

function press(dir, v){ touch[dir]=v }

const rover = { x: 120, y: 270, w: 34, h: 22, vx:0, vy:0, angle:0 }
let parcels = []
let rocks = []
let beacon = null
let beaconActive = ref(false)
let particles = []
let timerAcc = 0
let startTime = 0

function rand(a,b){ return a + Math.random()*(b-a) }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y) }

function spawnParcels(){
  parcels=[]
  const minDist = 56
  let attempts = 0
  while(parcels.length < 10 && attempts < 300){
    attempts++
    const x = rand(200, 860)
    const y = rand(70, 470)
    // keep parcels away from rover start to avoid instant collection
    if(Math.hypot(x-120, y-270) < 90) continue
    // avoid parcel clustering
    let tooClose = false
    for(const p of parcels){ if(Math.hypot(p.x-x, p.y-y) < minDist) { tooClose=true; break } }
    if(tooClose) continue
    parcels.push({
      x, y,
      r: 12,
      collected:false,
      phase: rand(0, Math.PI*2),
      color: parcels.length%2? '#ffcf3d' : '#7af0ff'
    })
  }
  // fallback fill if avoidance loop under-filled
  while(parcels.length < 10){
    parcels.push({ x: rand(200,860), y: rand(70,470), r:12, collected:false, phase: rand(0,Math.PI*2), color: parcels.length%2? '#ffcf3d':'#7af0ff' })
  }
}
function spawnRocks(){
  rocks=[]
  for(let i=0;i<7;i++){
    let x, y, tries=0
    do{
      x = rand(180, 880)
      y = rand(40, 500)
      tries++
    } while(Math.hypot(x-120, y-270) < 110 && tries < 20)
    const vx = rand(-0.6, 0.6)
    const vy = rand(-0.6, 0.6)
    rocks.push({
      x, y,
      r: rand(16, 28),
      vx, vy,
      baseVx: vx,
      baseVy: vy,
      rot: rand(0, Math.PI*2),
      vr: rand(-0.02,0.02),
      baseVr: 0,
      poly: Array.from({length: 7}, (_,k)=> {
        const a = k/7*Math.PI*2
        return { a, d: rand(0.85,1.15) }
      })
    })
  }
  // stash base rotation speed after creation
  for(const r of rocks) r.baseVr = r.vr
}
function spawnBeacon(){
  beacon = { x: 880, y: 270, r: 26, pulse:0 }
}

function resetGame(){
  rover.x=120; rover.y=270; rover.vx=0; rover.vy=0; rover.angle=0
  score.value=0; lives.value=3; timeLeft.value=TIME_TOTAL; elapsed.value=0
  beaconActive.value=false; beacon=null
  lossReason.value='Out of Time'
  // clear input lingering
  keys.up=keys.down=keys.left=keys.right=keys.space=false
  touch.up=touch.down=touch.left=touch.right=false
  spawnParcels(); spawnRocks(); particles=[]; _trail=[]
  timerAcc=0; startTime=performance.now()
}

function startGame(){
  resetGame()
  phase.value='playing'
  last=performance.now()
  cancelAnimationFrame(raf)
  raf=requestAnimationFrame(loop)
}
function togglePause(){
  if(phase.value==='playing'){ phase.value='paused' }
  else if(phase.value==='paused'){ resume() }
}
function resume(){
  if(phase.value==='paused'){
    phase.value='playing'
    last=performance.now()
    raf=requestAnimationFrame(loop)
  }
}

function onKey(e, down){
  const k=e.key.toLowerCase()
  if(k==='w' || k==='arrowup') keys.up=down
  if(k==='s' || k==='arrowdown') keys.down=down
  if(k==='a' || k==='arrowleft') keys.left=down
  if(k==='d' || k==='arrowright') keys.right=down
  if(k===' ') keys.space=down
  if(down && k==='p') togglePause()
  if(down && k==='r'){ startGame() }
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k) && down) e.preventDefault()
}

function update(dt){
  if(phase.value!=='playing') return
  timerAcc += dt
  if(timerAcc >= 1000){
    const dec = Math.floor(timerAcc/1000)
    timeLeft.value = Math.max(0, timeLeft.value - dec)
    timerAcc -= dec*1000
    elapsed.value = TIME_TOTAL - timeLeft.value
    if(timeLeft.value<=0){
      phase.value='lost'
      lossReason.value='Time Expired ⏳'
      spawnBurst(rover.x, rover.y, '#ff6b6b')
      return
    }
  }

  // input
  const ax = (keys.right||touch.right)-(keys.left||touch.left)
  const ay = (keys.down||touch.down)-(keys.up||touch.up)
  const accel = 0.28
  const friction = 0.93
  const maxSpeed = 4.2
  rover.vx += ax * accel
  rover.vy += ay * accel
  if(keys.space){
    rover.vx *= 0.86
    rover.vy *= 0.86
  }
  rover.vx *= friction
  rover.vy *= friction
  // clamp speed
  const sp = Math.hypot(rover.vx, rover.vy)
  if(sp>maxSpeed){
    rover.vx = rover.vx/sp*maxSpeed
    rover.vy = rover.vy/sp*maxSpeed
  }
  rover.x += rover.vx
  rover.y += rover.vy
  // angle lerp to velocity
  if(sp>0.3) rover.angle = Math.atan2(rover.vy, rover.vx)
  // dust trail — subtle dots behind rover
  if(sp>1.0){
    _trail.push({ x: rover.x - Math.cos(rover.angle)*14, y: rover.y - Math.sin(rover.angle)*14, a: 0.42, life: 420 })
    if(_trail.length>18) _trail.shift()
  }
  for(const t of _trail){ t.life -= dt; t.a = Math.max(0, t.life/420 * 0.42) }
  _trail = _trail.filter(t=>t.life>0)

  // bounds (keep inside with bounce)
  rover.x = Math.max(18, Math.min(942, rover.x))
  rover.y = Math.max(18, Math.min(522, rover.y))
  if(rover.x<=18 || rover.x>=942) rover.vx*=-0.6
  if(rover.y<=18 || rover.y>=522) rover.vy*=-0.6

  // rocks drift — difficulty ramp: speed scales gently with elapsed time
  const difficulty = Math.min(2.2, 1 + elapsed.value * 0.018)
  for(const r of rocks){
    // keep base velocity, scale by difficulty each frame
    r.vx = (r.baseVx ?? r.vx) * difficulty
    r.vy = (r.baseVy ?? r.vy) * difficulty
    r.vr = (r.baseVr ?? r.vr) * (1 + (difficulty-1)*0.35)
    r.x += r.vx + Math.sin(performance.now()*0.0004 + r.rot)*0.2 * difficulty
    r.y += r.vy + Math.cos(performance.now()*0.0005 + r.rot)*0.2 * difficulty
    r.rot += r.vr
    if(r.x<30 || r.x>930) { r.baseVx *= -1; r.vx*=-1 }
    if(r.y<30 || r.y>510) { r.baseVy *= -1; r.vy*=-1 }
    // collision with rover
    if(dist(rover, r) < r.r + 16){
      // knockback
      const a = Math.atan2(rover.y - r.y, rover.x - r.x)
      rover.vx += Math.cos(a)*2.5
      rover.vy += Math.sin(a)*2.5
      // damage cooldown
      if(!r._hitCooldown || performance.now() - r._hitCooldown > 900){
        r._hitCooldown = performance.now()
        lives.value--
        spawnBurst(rover.x, rover.y, '#ff7a3d')
        if(lives.value<=0){
          phase.value='lost'
          lossReason.value='Rover Wrecked ☄️'
        }
      }
    }
  }

  // parcels
  for(const p of parcels){
    if(p.collected) continue
    p.phase += 0.08
    if(dist(rover, p) < 22){
      p.collected=true
      score.value++
      timeLeft.value = Math.min(TIME_TOTAL, timeLeft.value + 2) // bonus
      spawnBurst(p.x, p.y, p.color)
      if(score.value>=needed && !beaconActive.value){
        beaconActive.value=true
        spawnBeacon()
        spawnBurst(beacon.x, beacon.y, '#42f59b')
      }
    }
  }

  // beacon
  if(beaconActive.value && beacon){
    beacon.pulse += 0.08
    if(dist(rover, beacon) < beacon.r + 18){
      phase.value='won'
      elapsed.value = TIME_TOTAL - timeLeft.value
      spawnBurst(beacon.x, beacon.y, '#42f59b')
    }
  }

  // win if all parcels? optional but beacon required
  // particles
  for(const pt of particles){
    pt.x += pt.vx
    pt.y += pt.vy
    pt.vy += 0.06
    pt.life -= dt
    pt.a = Math.max(0, pt.life/pt.max)
  }
  particles = particles.filter(p=>p.life>0)
}

function spawnBurst(x,y, col){
  for(let i=0;i<14;i++){
    const a = Math.random()*Math.PI*2
    const s = rand(1,4)
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - rand(0,2), life: 500, max:500, r: rand(2,4), col, a:1 })
  }
}

function draw(){
  if(!ctx) return
  const w=960, h=540
  // background
  const g = ctx.createLinearGradient(0,0,0,h)
  g.addColorStop(0,'#06070c')
  g.addColorStop(0.5,'#0d1020')
  g.addColorStop(1,'#171a2e')
  ctx.fillStyle=g
  ctx.fillRect(0,0,w,h)

  // stars — softer, less noisy
  ctx.fillStyle='rgba(255,255,255,0.85)'
  for(let i=0;i<75;i++){
    const x = (i*137.5)%w
    const y = (i*73)% (h*0.55)
    const tw = 0.5 + Math.sin(performance.now()*0.0016 + i*0.9)*0.5
    ctx.globalAlpha = 0.18 + tw*0.28
    ctx.beginPath(); ctx.arc(x,y, (i%4===0?1.4:0.9),0,Math.PI*2); ctx.fill()
  }
  ctx.globalAlpha=1

  // moon surface horizon glow
  const hg = ctx.createLinearGradient(0,420,0,h)
  hg.addColorStop(0,'rgba(255,103,25,0.08)')
  hg.addColorStop(1,'rgba(0,0,0,0)')
  ctx.fillStyle=hg; ctx.fillRect(0,420,w,120)

  // ground texture (dusted)
  ctx.fillStyle='#1a1d2f'
  ctx.fillRect(0,460,w,80)
  ctx.fillStyle='rgba(255,255,255,0.04)'
  for(let i=0;i<30;i++){
    const x=(i*97)%w, y=470 + (i*13)%60
    ctx.beginPath(); ctx.ellipse(x,y, rand(18,50), rand(6,12),0,0,Math.PI*2); ctx.fill()
  }

  // grid dust lines — reduced to 0.025 for Mini-Metro whitespace
  ctx.strokeStyle='rgba(255,255,255,0.025)'
  ctx.lineWidth=1
  for(let y=80;y<h;y+=70){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke() }
  for(let x=0;x<w;x+=120){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke() }

  // craters bg
  drawCrater(170,430,54); drawCrater(560,480,38); drawCrater(780,450,62); drawCrater(340,500,28)

  // parcels — icon-driven rounded box + tape for crisp read at thumbnail
  for(const p of parcels){
    if(p.collected) continue
    const bob = Math.sin(p.phase)*3.5
    const y = p.y + bob
    const x = p.x
    // soft outer glow
    ctx.shadowColor=p.color; ctx.shadowBlur=14
    ctx.fillStyle=p.color
    roundRect(x-10, y-10, 20, 20, 4); ctx.fill()
    ctx.shadowBlur=0
    // inner white box
    ctx.fillStyle='rgba(255,255,255,0.96)'
    roundRect(x-9, y-9, 18, 18, 3.5); ctx.fill()
    // tape stripe
    ctx.fillStyle=p.color
    ctx.fillRect(x-9, y-3, 18, 6)
    ctx.fillStyle='rgba(0,0,0,0.14)'; ctx.fillRect(x-9, y+3, 18, 2)
    // outline crisp
    ctx.strokeStyle='rgba(15,15,25,0.18)'; ctx.lineWidth=1; roundRect(x-9, y-9, 18, 18, 3.5); ctx.stroke()
    // icon sparkle
    ctx.fillStyle='rgba(255,255,255,0.9)'
    ctx.beginPath(); ctx.arc(x+6, y-6, 1.6,0,Math.PI*2); ctx.fill()
    // subtle shadow under parcel
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, y+13, 10,3,0,0,Math.PI*2); ctx.fill()
  }

  // rocks
  for(const r of rocks){
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot)
    const grad = ctx.createRadialGradient(0,0,4,0,0,r.r)
    grad.addColorStop(0,'#3a3f5a'); grad.addColorStop(1,'#1e2238')
    ctx.fillStyle=grad
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=10; ctx.shadowOffsetY=6
    ctx.beginPath()
    r.poly.forEach((pt,i)=>{
      const rad = r.r * pt.d
      const x = Math.cos(pt.a)*rad
      const y = Math.sin(pt.a)*rad*0.86
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
    })
    ctx.closePath(); ctx.fill(); ctx.shadowBlur=0
    // crater pits on rock
    ctx.fillStyle='rgba(0,0,0,0.25)'
    ctx.beginPath(); ctx.arc(r.r*0.2, -r.r*0.15, r.r*0.18,0,Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(-r.r*0.3, r.r*0.2, r.r*0.12,0,Math.PI*2); ctx.fill()
    ctx.restore()
  }

  // beacon
  if(beaconActive.value && beacon){
    const pulse = Math.sin(beacon.pulse)*0.2+0.8
    ctx.save(); ctx.translate(beacon.x, beacon.y)
    // outer glow
    ctx.fillStyle=`rgba(66,245,155,${0.18*pulse})`
    ctx.beginPath(); ctx.arc(0,0, beacon.r+22*pulse,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='rgba(66,245,155,0.35)'; ctx.beginPath(); ctx.arc(0,0, beacon.r+10,0,Math.PI*2); ctx.fill()
    ctx.fillStyle='#42f59b'; ctx.shadowColor='#42f59b'; ctx.shadowBlur=22
    ctx.beginPath(); ctx.arc(0,0, beacon.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0
    ctx.fillStyle='white'; ctx.font='700 12px Space Grotesk'; ctx.textAlign='center'; ctx.fillText('BEACON',0,5)
    // arrow guide
    ctx.strokeStyle='rgba(66,245,155,0.9)'; ctx.setLineDash([6,6]); ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(-42, -42); ctx.lineTo(-18,-18); ctx.stroke(); ctx.setLineDash([])
    ctx.restore()
    // tether beam
    ctx.strokeStyle='rgba(66,245,155,0.5)'; ctx.lineWidth=1; ctx.setLineDash([4,8])
    ctx.beginPath(); ctx.moveTo(beacon.x, beacon.y - beacon.r); ctx.lineTo(beacon.x, 0); ctx.stroke(); ctx.setLineDash([])
  }

  // dust trail behind rover
  for(const t of _trail){
    ctx.globalAlpha = t.a
    ctx.fillStyle='rgba(180,190,210,0.9)'
    ctx.beginPath(); ctx.arc(t.x, t.y, 2.2,0,Math.PI*2); ctx.fill()
  }
  ctx.globalAlpha=1
  // rover shadow
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(rover.x, rover.y+18, 22,8,0,0,Math.PI*2); ctx.fill()

  // rover body
  ctx.save(); ctx.translate(rover.x, rover.y); ctx.rotate(rover.angle)
  // headlight cones
  ctx.fillStyle='rgba(255,235,160,0.18)'
  ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(46, -18); ctx.lineTo(46,18); ctx.lineTo(14,8); ctx.closePath(); ctx.fill()
  // chassis
  ctx.fillStyle='#e9eef5'; ctx.strokeStyle='#aab3c8'; ctx.lineWidth=1.4
  roundRect(-16,-11,32,22,6); ctx.fill(); ctx.stroke()
  // cabin
  ctx.fillStyle='#2a2f4a'; ctx.beginPath(); ctx.ellipse(4, -2, 9,8,0,0,Math.PI*2); ctx.fill()
  ctx.fillStyle='rgba(122,240,255,0.9)'; ctx.beginPath(); ctx.ellipse(5,-3,5.5,4.5,0,0,Math.PI*2); ctx.fill()
  // wheels
  ctx.fillStyle='#101322'; ctx.strokeStyle='#2e344f'; ctx.lineWidth=1
  ;[[-10,11],[10,11],[-10,-11],[10,-11]].forEach(([wx,wy])=>{
    ctx.beginPath(); ctx.ellipse(wx,wy,6,3.5,0,0,Math.PI*2); ctx.fill(); ctx.stroke()
  })
  // antenna
  ctx.strokeStyle='#ff6719'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-14,-6); ctx.lineTo(-18,-16); ctx.stroke()
  ctx.fillStyle='#ff6719'; ctx.beginPath(); ctx.arc(-18,-16,2.5,0,Math.PI*2); ctx.fill()
  // signal blink
  if(Math.floor(performance.now()/400)%2===0){ ctx.fillStyle='#ff6719'; ctx.shadowColor='#ff6719'; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(-18,-16,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0 }
  ctx.restore()

  // particles
  for(const pt of particles){
    ctx.globalAlpha=pt.a
    ctx.fillStyle=pt.col
    ctx.shadowColor=pt.col; ctx.shadowBlur=8
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0
  }
  ctx.globalAlpha=1

  // vignette — lighter so art breathes
  const vg = ctx.createRadialGradient(w/2,h/2, 320, w/2,h/2, 700)
  vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,0,0.28)')
  ctx.fillStyle=vg; ctx.fillRect(0,0,w,h)

  // top highlight
  ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.fillRect(0,0,w,1)
}

function roundRect(x,y,w,h,r){
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath()
}
function drawCrater(x,y,r){
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.ellipse(x,y,r, r*0.6,0,0,Math.PI*2); ctx.fill()
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1; ctx.stroke()
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x+ r*0.18, y+2, r*0.5, r*0.32,0,0,Math.PI*2); ctx.fill()
}

function loop(now){
  const dt = Math.min(33, now - last)
  last = now
  update(dt)
  draw()
  // draw hit flash when low lives
  if(lives.value===1 && Math.floor(now/250)%2===0){
    ctx.fillStyle='rgba(255,60,60,0.08)'; ctx.fillRect(0,0,960,540)
  }
  if(phase.value==='playing' || particles.length){
    raf = requestAnimationFrame(loop)
  } else {
    // keep drawing static for overlay clarity but stop timer
    draw()
  }
}

let _onKeyDown = e=> onKey(e,true)
let _onKeyUp = e=> onKey(e,false)
let _onBlur = ()=>{ keys.up=keys.down=keys.left=keys.right=keys.space=false; touch.up=touch.down=touch.left=touch.right=false }
let _dpr = 1
let _trail = []
function applyDpr(){
  const c = canvasRef.value
  if(!c || !ctx) return
  _dpr = Math.min(2, window.devicePixelRatio || 1)
  // logical size stays 960x540; backbuffer scaled for crisp HiDPI
  c.width = Math.round(960 * _dpr)
  c.height = Math.round(540 * _dpr)
  // css size is controlled by stylesheet (width:100% aspect-ratio), so keep style
  c.style.width = '100%'
  // reset transform then scale so drawing stays in 960x540 coords
  ctx.setTransform(_dpr,0,0,_dpr,0,0)
  ctx.imageSmoothingEnabled = true
}

onMounted(()=> {
  ctx = canvasRef.value.getContext('2d')
  applyDpr()
  draw()
  window.addEventListener('keydown', _onKeyDown)
  window.addEventListener('keyup', _onKeyUp)
  window.addEventListener('blur', _onBlur)
  window.addEventListener('resize', applyDpr)
  // touch swipe on canvas
  let sx=0, sy=0
  const c = canvasRef.value
  c.addEventListener('touchstart', e=>{
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY
  }, {passive:true})
  c.addEventListener('touchmove', e=>{
    if(!sx) return
    const t=e.touches[0]
    const dx=t.clientX - sx, dy=t.clientY - sy
    touch.left = dx < -12; touch.right = dx > 12; touch.up = dy < -12; touch.down = dy > 12
    if(phase.value==='idle') startGame()
  }, {passive:true})
  c.addEventListener('touchend', ()=>{ touch.left=touch.right=touch.up=touch.down=false; sx=0 }, {passive:true})
  // pointer for desktop drag
  c.addEventListener('click', ()=>{ if(phase.value==='idle') startGame() })

  // initial draw loop idle
  raf = requestAnimationFrame(function idleDraw(){
    draw()
    if(phase.value==='idle' || phase.value==='paused') raf=requestAnimationFrame(idleDraw)
  })
})
onBeforeUnmount(()=> {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', _onKeyDown)
  window.removeEventListener('keyup', _onKeyUp)
  window.removeEventListener('blur', _onBlur)
  window.removeEventListener('resize', applyDpr)
})
</script>

<style scoped>
.moondash{
  min-height: calc(100vh - 68px);
  background:#0a0b12;
  color:#f6f6f3;
  padding: 28px clamp(12px, 4vw, 48px) 40px;
  position:relative;
  overflow:hidden;
}
.moondash-bg{ position:absolute; inset:0; overflow:hidden; pointer-events:none }
.moondash-bg .stars{
  position:absolute; inset:0;
  background:
    radial-gradient(circle at 20% 15%, rgba(255,255,255,0.9) 0 1px, transparent 1.5px),
    radial-gradient(circle at 70% 25%, rgba(255,255,255,0.7) 0 1px, transparent 1.5px),
    radial-gradient(circle at 50% 60%, rgba(255,255,255,0.4) 0 1px, transparent 1.5px);
  background-size: 280px 200px;
  opacity:0.5;
}
.crater{ position:absolute; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06)}
.c1{ width:260px; height:160px; left:8%; top:62% }
.c2{ width:180px; height:110px; left:48%; top:71% }
.c3{ width:220px; height:130px; left:72%; top:58% }
.md-header{
  position:relative;
  display:flex; gap:24px; justify-content:space-between; align-items:flex-start; flex-wrap:wrap;
  max-width:1200px; margin:auto;
}
.md-title h1{ font:700 42px "Space Grotesk"; letter-spacing:-0.03em; margin:6px 0 8px }
.md-title p{ color:#a5a5ab; max-width:620px; margin:0; line-height:1.5 }
.md-badges{ display:flex; gap:10px; flex-wrap:wrap; align-items:center }
.badge{ background:#1c1d23; border:1px solid #2d2d33; padding:10px 14px; border-radius:999px; font-weight:700; font-size:13px }
.badge.lives{ color:#ff8a7a; border-color:#3a2522 }
.badge.sound{ cursor:pointer; transition:filter 0.15s, opacity 0.15s }
.badge.sound:hover{ filter:brightness(1.08) }
.badge.sound.muted{ opacity:0.7; color:#a6a6ab }
.game-shell{
  position:relative;
  max-width:1200px; margin:22px auto 0;
  background:rgba(18,18,22,0.96); border:1px solid #2b2b2e; border-radius:22px; overflow:hidden;
  box-shadow:0 24px 60px rgba(0,0,0,0.5);
}
.hud{
  display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap;
  padding:14px 18px; background:#17171c; border-bottom:1px solid #2a2a2e;
}
.hud-left strong{ display:block; font:700 14px "Space Grotesk" }
.hud-left small{ color:#8e8e93; font-size:12px }
.hud-right{ display:flex; align-items:center; gap:12px; min-width:220px; flex:1; justify-content:flex-end }
.need{ font-size:12px; color:#a6a6ab; white-space:nowrap }
.progress{ width:160px; height:8px; background:#2a2a2e; border-radius:999px; overflow:hidden }
.bar{ height:100%; background:linear-gradient(90deg,#ff6719,#ffcf3d); transition:width 0.3s }
.canvas-wrap{
  position:relative; background:#05060a; display:grid; place-items:center; padding:0;
}
canvas{
  width:100%; height:auto; max-height: min(62vh, 560px); aspect-ratio: 16/9; display:block; background:#06070c;
  touch-action:none;
}
.overlay{
  position:absolute; inset:0; display:grid; place-content:center; text-align:center; padding:24px;
  background: radial-gradient(ellipse at center, rgba(10,12,22,0.92) 30%, rgba(10,12,22,0.88));
  backdrop-filter: blur(2px);
}
.overlay h2{ font:700 32px "Space Grotesk"; margin:0 0 8px }
.overlay p{ color:#b8b8bf; margin:0 0 14px; max-width:520px; line-height:1.5 }
.controls-legend{ display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin:10px 0 16px }
.controls-legend span{ background:#1e1e26; border:1px solid #333; padding:6px 10px; border-radius:999px; font-size:12px; color:#aaa }
kbd{ background:#2c2c34; border:1px solid #444; border-bottom-width:2px; padding:1px 6px; border-radius:5px; font-size:11px; color:white }
.primary{
  justify-self:center; background:#ff6719; color:#0a0a0a; border:0; border-radius:999px; padding:12px 22px; font:700 15px "Space Grotesk"; cursor:pointer;
  box-shadow:0 8px 24px rgba(255,103,25,0.35);
}
.primary:hover{ filter:brightness(1.05) }
.hint{ font-size:11px; color:#7a7a80; margin-top:10px }
.stats{ display:flex; gap:14px; justify-content:center; margin:10px 0 14px; flex-wrap:wrap }
.stats span{ background:#1d1d24; border:1px solid #2f2f35; padding:8px 12px; border-radius:999px; font-size:12px; font-weight:600 }
.bottom-row{
  display:flex; gap:16px; justify-content:space-between; align-items:center; flex-wrap:wrap;
  padding:14px 18px; background:#0f0f13; border-top:1px solid #26262a;
}
.touch-pad{ display:grid; gap:6px; justify-items:center }
.touch-pad button{
  width:44px; height:44px; border-radius:10px; border:1px solid #333; background:#1d1d24; color:white; font-size:16px; cursor:pointer;
}
.touch-pad button:active{ background:#2a2a33 }
.drow{ display:flex; gap:6px }
.actions{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-left:auto }
.ghost{ background:#1e1e24; border:1px solid #333; color:white; padding:10px 14px; border-radius:999px; font-weight:600; cursor:pointer; font-size:13px }
.keys{ font-size:11px; color:#7a7a80; max-width:260px; line-height:1.4 }
.attribution{ text-align:center; font-size:11px; color:#6e6e76; padding:10px; margin:0; background:#0a0a0f; border-top:1px solid #222 }
@media (max-width:780px){
  .md-title h1{ font-size:30px }
  .hud-right{ justify-content:flex-start }
  .progress{ width:120px }
  canvas{ max-height:52vh }
  .controls-legend{ gap:6px; margin:6px 0 12px }
  .overlay{ padding:16px }
  .overlay h2{ font-size:26px }
}
@media (max-width:520px){
  .moondash{ padding:16px 12px 28px }
  .badge{ padding:8px 11px; font-size:12px }
  .hud{ padding:10px 12px }
  .need{ white-space:normal; line-height:1.2 }
  .progress{ width:100px; height:7px }
  .canvas-wrap{ border-radius:12px; overflow:hidden }
  canvas{ max-height:50vh; border-radius:12px }
  .bottom-row{ flex-direction:column; align-items:stretch; gap:10px }
  .touch-pad{ order:1 }
  .touch-pad button{ width:52px; height:52px; font-size:18px; touch-action:manipulation }
  .actions{ margin-left:0; justify-content:center; width:100% }
  .actions .ghost{ flex:1 1 auto; text-align:center }
  .keys{ max-width:none; text-align:center; width:100% }
}
</style>

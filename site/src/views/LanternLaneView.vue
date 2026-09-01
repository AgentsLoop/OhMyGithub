<template>
  <main class="lantern-page">
    <div class="lantern-wrap">
      <header class="lantern-header">
        <div>
          <p class="eyebrow orange">LANTERN LANE — 60S ESCAPE</p>
          <h1>Garden Gate</h1>
          <p class="sub">Carry the lantern through the dark. Collect fireflies · Avoid moths · Reach the gate</p>
        </div>
        <div class="header-actions">
          <button class="ghost" @click="resetGame">Restart ↻</button>
          <a class="ghost" href="/">← OmGithub</a>
        </div>
      </header>

      <div class="hud">
        <div class="hud-item"><span class="k">Score</span><strong>{{ score }}</strong></div>
        <div class="hud-item"><span class="k">Fireflies</span><strong>{{ collected }}/{{ totalFireflies }}</strong></div>
        <div class="hud-item" :class="{ danger: timeLeft <= 15 }"><span class="k">Time</span><strong>{{ timeLeft }}s</strong></div>
        <div class="hud-item lives"><span class="k">Lantern</span><span class="hearts"><i v-for="n in 3" :key="n" :class="{ on: n <= lives }">♥</i></span></div>
      </div>

      <div class="game-frame" ref="frameRef">
        <canvas ref="canvasRef" width="900" height="560" tabindex="0" aria-label="Lantern Lane game canvas"></canvas>

        <!-- Start overlay -->
        <div v-if="state === 'start'" class="overlay start">
          <div class="card">
            <div class="lantern-icon">🏮</div>
            <h2>Lantern Lane</h2>
            <p>A winding garden path lies in darkness. Your lantern is the only light. Gather <b>8 glowing fireflies</b>, dodge <b>3 restless moths</b>, and slip through the garden gate before time runs out.</p>
            <ul>
              <li><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> or <kbd>WASD</kbd> to move</li>
              <li>Touch &amp; drag on mobile — or use the D-pad</li>
              <li>Touch a moth = lose a heart · 3 hits = extinguished</li>
            </ul>
            <button class="play" @click="startGame">Light the Lantern — Play</button>
            <p class="hint">Path is dark outside the lantern glow — stay on the pale winding lane.</p>
          </div>
        </div>

        <!-- Win overlay -->
        <div v-if="state === 'won'" class="overlay win">
          <div class="card">
            <div class="lantern-icon">🌿✨</div>
            <h2>You escaped!</h2>
            <p>Gate reached in <b>{{ 60 - timeLeft }}s</b> — <b>{{ score }} pts</b> from {{ collected }} fireflies.</p>
            <p class="rank">{{ rankText }}</p>
            <div class="row">
              <button class="play" @click="resetGame">Play Again</button>
              <button class="ghost" @click="shareScore">Copy Score</button>
            </div>
          </div>
        </div>

        <!-- Lose overlay -->
        <div v-if="state === 'lost'" class="overlay lose">
          <div class="card">
            <div class="lantern-icon">{{ loseReason === 'time' ? '⏳' : '🦋' }}</div>
            <h2>{{ loseReason === 'time' ? 'Night fell…' : 'Lantern snuffed!' }}</h2>
            <p v-if="loseReason === 'time'">Time ran out before you reached the gate. You collected {{ collected }} fireflies.</p>
            <p v-else>The moths overwhelmed your light. You collected {{ collected }} fireflies.</p>
            <div class="row">
              <button class="play" @click="resetGame">Try Again</button>
              <button class="ghost" @click="startGame">Quick Restart</button>
            </div>
          </div>
        </div>

        <div v-if="state === 'playing' && paused" class="overlay pause">
          <div class="card small"><h3>Paused</h3><button class="play" @click="paused = false">Resume</button></div>
        </div>
      </div>

      <div class="controls-bar">
        <div class="dpad" @touchstart.prevent @touchmove.prevent>
          <button @touchstart.prevent="touchDir('up', true)" @touchend.prevent="touchDir('up', false)" @mousedown="touchDir('up', true)" @mouseup="touchDir('up', false)" @mouseleave="touchDir('up', false)" aria-label="Up">▲</button>
          <div class="mid">
            <button @touchstart.prevent="touchDir('left', true)" @touchend.prevent="touchDir('left', false)" @mousedown="touchDir('left', true)" @mouseup="touchDir('left', false)" @mouseleave="touchDir('left', false)" aria-label="Left">◀</button>
            <button @touchstart.prevent="touchDir('down', true)" @touchend.prevent="touchDir('down', false)" @mousedown="touchDir('down', true)" @mouseup="touchDir('down', false)" @mouseleave="touchDir('down', false)" aria-label="Down">▼</button>
            <button @touchstart.prevent="touchDir('right', true)" @touchend.prevent="touchDir('right', false)" @mousedown="touchDir('right', true)" @mouseup="touchDir('right', false)" @mouseleave="touchDir('right', false)" aria-label="Right">▶</button>
          </div>
        </div>
        <div class="legend">
          <span><i class="dot fire"></i> Firefly +10</span>
          <span><i class="dot moth"></i> Moth — avoid</span>
          <span><i class="dot gate"></i> Garden Gate</span>
          <button class="ghost tiny" @click="paused = !paused" v-if="state === 'playing'">{{ paused ? 'Resume' : 'Pause' }}</button>
        </div>
        <div class="keys-hint"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> / <kbd>WASD</kbd> · <kbd>R</kbd> restart · <kbd>P</kbd> pause</div>
      </div>

      <p class="attribution">No external assets or services — pure Canvas. Built for OmGithub.</p>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const canvasRef = ref(null)
const frameRef = ref(null)
const score = ref(0)
const collected = ref(0)
const totalFireflies = 8
const timeLeft = ref(60)
const lives = ref(3)
const state = ref('start') // start | playing | won | lost
const paused = ref(false)
const loseReason = ref('time')

const W = 900, H = 560
const PLAYER_R = 14
const FIRE_R = 11
const MOTH_R = 18
const GATE_W = 54, GATE_H = 64
const PATH_W = 98
const SPEED = 3.1

// S-shaped centerline waypoints
const centerline = [
  { x: 80, y: 480 },
  { x: 720, y: 480 },
  { x: 720, y: 300 },
  { x: 150, y: 300 },
  { x: 150, y: 110 },
  { x: 760, y: 110 },
]
const gatePos = { x: 770, y: 110 }

let player = { x: 90, y: 480, vx: 0, vy: 0, invuln: 0 }
let fireflies = []
let moths = []
let sparks = []
let keys = {}
let touch = { up: false, down: false, left: false, right: false }
let raf = 0, timerInt = 0, last = 0
let pulse = 0

function distToSegment(px, py, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (l2 === 0) return Math.hypot(px - a.x, py - a.y)
  let t = ((px - a.x) * (b.x - a.x) + (py - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  return Math.hypot(px - proj.x, py - proj.y)
}
function isOnPath(x, y, pad = 0) {
  let d = Infinity
  for (let i = 0; i < centerline.length - 1; i++) d = Math.min(d, distToSegment(x, y, centerline[i], centerline[i + 1]))
  return d <= PATH_W / 2 - pad
}
function closestPointOnPath(x, y) {
  let best = null, bestD = Infinity
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i], b = centerline[i + 1]
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    let t = l2 ? ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / l2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = a.x + t * (b.x - a.x), py = a.y + t * (b.y - a.y)
    const d = Math.hypot(x - px, y - py)
    if (d < bestD) { bestD = d; best = { x: px, y: py } }
  }
  return best
}
function randomOnPath() {
  // pick random segment and random t
  const idx = Math.floor(Math.random() * (centerline.length - 1))
  const a = centerline[idx], b = centerline[idx + 1]
  const t = 0.15 + Math.random() * 0.7
  const cx = a.x + (b.x - a.x) * t
  const cy = a.y + (b.y - a.y) * t
  // jitter perpendicular
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
  const off = (Math.random() - 0.5) * (PATH_W * 0.55)
  return { x: Math.max(20, Math.min(W - 20, cx + Math.cos(ang) * off)), y: Math.max(20, Math.min(H - 20, cy + Math.sin(ang) * off)) }
}

function initFireflies() {
  fireflies = []
  for (let i = 0; i < totalFireflies; i++) {
    let p
    do { p = randomOnPath() } while (Math.hypot(p.x - player.x, p.y - player.y) < 80)
    fireflies.push({ x: p.x, y: p.y, taken: false, phase: Math.random() * Math.PI * 2 })
  }
}
function initMoths() {
  const starts = [randomOnPath(), randomOnPath(), randomOnPath()]
  moths = starts.map((p, i) => ({
    x: p.x, y: p.y,
    tx: p.x, ty: p.y,
    // wider variance so moths feel individually tuned (chaser vs drifter)
    speed: 0.82 + Math.random() * 1.18,
    phase: Math.random() * Math.PI * 2,
    hue: [32, 285, 195][i] || 30,
    cooldown: 0
  }))
  // ensure moths not too close to start
  moths.forEach(m => { if (Math.hypot(m.x - player.x, m.y - player.y) < 140) { m.x += 140; m.y -= 40 } })
}

function resetPositions() {
  player = { x: 90, y: 480, vx: 0, vy: 0, invuln: 0 }
  score.value = 0
  collected.value = 0
  lives.value = 3
  timeLeft.value = 60
  loseReason.value = 'time'
  sparks = []
  initFireflies()
  initMoths()
}

function startGame() {
  if (state.value === 'start' || state.value === 'lost' || state.value === 'won') resetPositions()
  state.value = 'playing'
  paused.value = false
  last = performance.now()
  clearInterval(timerInt)
  timerInt = setInterval(() => {
    if (state.value !== 'playing' || paused.value) return
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      timeLeft.value = 0
      lose('time')
    }
  }, 1000)
  canvasRef.value?.focus()
}
function resetGame() {
  paused.value = false
  state.value = 'start'
  clearInterval(timerInt)
  resetPositions()
  draw()
}
function lose(reason) {
  state.value = 'lost'
  loseReason.value = reason
  clearInterval(timerInt)
}
function win() {
  state.value = 'won'
  clearInterval(timerInt)
}
const rankText = computed(() => {
  if (score.value >= 80) return 'Rank: Starlight Keeper ★★★'
  if (score.value >= 50) return 'Rank: Lantern Bearer ★★'
  if (score.value >= 30) return 'Rank: Twilight Walker ★'
  return 'Rank: First Steps'
})

function shareScore() {
  const text = `Lantern Lane — ${score.value} pts, ${collected.value}/8 fireflies in ${60 - timeLeft.value}s — ${rankText.value}`
  navigator.clipboard?.writeText(text)
}

function touchDir(dir, on) { touch[dir] = on }

let onKeyDown = null, onKeyUp = null

function handleKey(e, down) {
  const k = e.key.toLowerCase()
  if (['arrowup', 'w'].includes(k)) keys.up = down
  if (['arrowdown', 's'].includes(k)) keys.down = down
  if (['arrowleft', 'a'].includes(k)) keys.left = down
  if (['arrowright', 'd'].includes(k)) keys.right = down
  if (down && k === 'r') resetGame()
  if (down && k === 'p' && state.value === 'playing') paused.value = !paused.value
  if (down && k === ' ' && state.value !== 'playing') startGame()
  if (down && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
}

function update(dt) {
  if (state.value !== 'playing' || paused.value) return
  pulse += dt * 0.004

  // input
  let ix = 0, iy = 0
  if (keys.up || touch.up) iy -= 1
  if (keys.down || touch.down) iy += 1
  if (keys.left || touch.left) ix -= 1
  if (keys.right || touch.right) ix += 1
  if (ix !== 0 && iy !== 0) { ix *= 0.707; iy *= 0.707 }
  const targetVx = ix * SPEED
  const targetVy = iy * SPEED
  player.vx += (targetVx - player.vx) * 0.22
  player.vy += (targetVy - player.vy) * 0.22
  if (Math.abs(ix) < 0.01) player.vx *= 0.82
  if (Math.abs(iy) < 0.01) player.vy *= 0.82

  let nx = player.x + player.vx
  let ny = player.y + player.vy
  nx = Math.max(PLAYER_R + 6, Math.min(W - PLAYER_R - 6, nx))
  ny = Math.max(PLAYER_R + 6, Math.min(H - PLAYER_R - 6, ny))

  // wall clamp: project onto path edge and slide along tangent (fixes jitter)
  if (!isOnPath(nx, ny, PLAYER_R + 2)) {
    const cp = closestPointOnPath(nx, ny)
    const ang = Math.atan2(ny - cp.y, nx - cp.x)
    const limit = PATH_W / 2 - PLAYER_R - 3
    const clamped = { x: cp.x + Math.cos(ang) * limit, y: cp.y + Math.sin(ang) * limit }
    // slide: keep velocity component along path tangent, damp wall-normal
    const tx = -Math.sin(ang), ty = Math.cos(ang)
    const dot = player.vx * tx + player.vy * ty
    player.vx = tx * dot * 0.92
    player.vy = ty * dot * 0.92
    nx = clamped.x
    ny = clamped.y
  }
  player.x = nx
  player.y = ny
  if (player.invuln > 0) player.invuln -= dt

  // moths
  moths.forEach(m => {
    if (m.cooldown > 0) { m.cooldown -= dt; return }
    const dx = m.tx - m.x, dy = m.ty - m.y
    const d = Math.hypot(dx, dy)
    if (d < 12) {
      const np = randomOnPath()
      m.tx = np.x; m.ty = np.y
      // re-roll speed slightly each leg so no two moths stay locked
      m.speed = 0.82 + Math.random() * 1.18
    } else {
      const toPlayer = Math.hypot(player.x - m.x, player.y - m.y)
      if (toPlayer < 160) {
        // blend target toward player, normalize properly (fixes distance-dependent crawl)
        const bx = m.tx * 0.62 + player.x * 0.38
        const by = m.ty * 0.62 + player.y * 0.38
        const bdx = bx - m.x, bdy = by - m.y
        const bd = Math.hypot(bdx, bdy) || 1
        m.x += (bdx / bd) * m.speed * 0.72
        m.y += (bdy / bd) * m.speed * 0.72
      } else {
        m.x += (dx / d) * m.speed
        m.y += (dy / d) * m.speed
      }
      // sinusoidal flutter
      m.phase += dt * 0.008
      m.x += Math.cos(m.phase) * 0.6
      m.y += Math.sin(m.phase * 1.3) * 0.45
    }
    // keep on path
    if (!isOnPath(m.x, m.y, MOTH_R)) {
      const cp = closestPointOnPath(m.x, m.y)
      m.x = cp.x; m.y = cp.y
      const np = randomOnPath(); m.tx = np.x; m.ty = np.y
    }
  })

  // firefly collect
  fireflies.forEach(f => {
    if (f.taken) return
    f.phase += dt * 0.005 + Math.random() * 0.001
    if (Math.hypot(player.x - f.x, player.y - f.y) < PLAYER_R + FIRE_R + 4) {
      f.taken = true
      collected.value += 1
      score.value += 10
      // subtle particle spark (lightweight, capped)
      for (let k = 0; k < 10; k++) {
        const a = (Math.PI * 2 * k) / 10 + Math.random() * 0.35
        const sp = 1.6 + Math.random() * 2.8
        sparks.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.7, life: 1, decay: 0.065 + Math.random() * 0.05, r: 1.4 + Math.random() * 1.6 })
      }
      if (sparks.length > 80) sparks.splice(0, sparks.length - 80)
      if (navigator.vibrate) navigator.vibrate(20)
    }
  })
  // sparks tick (frame-rate independent-ish)
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]
    s.x += s.vx; s.y += s.vy; s.vy += 0.08; s.vx *= 0.98; s.life -= s.decay * (dt / 16.7)
    if (s.life <= 0) sparks.splice(i, 1)
  }

  // moth collision
  if (player.invuln <= 0) {
    for (const m of moths) {
      if (Math.hypot(player.x - m.x, player.y - m.y) < PLAYER_R + MOTH_R - 2) {
        lives.value -= 1
        player.invuln = 1200
        if (navigator.vibrate) navigator.vibrate([30, 40, 30])
        score.value = Math.max(0, score.value - 5)
        m.cooldown = 600
        // push away
        const ang = Math.atan2(player.y - m.y, player.x - m.x)
        player.x += Math.cos(ang) * 18
        player.y += Math.sin(ang) * 18
        if (lives.value <= 0) lose('moth')
        break
      }
    }
  }

  // gate check - require all fireflies collected (Pac-Man clear-the-board loop)
  if (Math.hypot(player.x - gatePos.x, player.y - gatePos.y) < 34) {
    if (collected.value >= totalFireflies) win()
    else {
      // nudge hint — gate is locked
      if (player.invuln <= 0) player.invuln = 300
    }
  }
}

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  // sky / night
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0a1020')
  bg.addColorStop(0.55, '#101a2e')
  bg.addColorStop(1, '#0f1a12')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  const stars = [[120, 40], [340, 28], [500, 55], [680, 18], [820, 44], [200, 65], [430, 78], [760, 62], [60, 85], [880, 30]]
  stars.forEach(([x, y], i) => {
    const tw = 0.6 + Math.sin(pulse * 1.2 + i) * 0.3
    ctx.globalAlpha = tw
    ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill()
  })
  ctx.globalAlpha = 1

  // hedges / off-path darkness
  // draw hedges as dark blocks with texture around path
  // We'll draw path first as pale lane, then vignette off-path with hedge pattern

  // hedge background texture
  ctx.fillStyle = '#0b1a0e'
  ctx.fillRect(0, 0, W, H)
  // subtle hedge rows (grid of small leaves)
  ctx.fillStyle = 'rgba(24,52,30,0.9)'
  for (let y = 0; y < H; y += 18) {
    for (let x = 0; x < W; x += 18) {
      if (isOnPath(x, y, -6)) continue
      ctx.beginPath()
      ctx.arc(x + Math.sin(y * 0.1) * 2, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // darker border
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1
  for (let i = 0; i < 4; i++) { ctx.strokeRect(i, i, W - i * 2, H - i * 2) }

  // path - draw thick polyline with round caps
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#e8dcc3'
  ctx.lineWidth = PATH_W
  ctx.beginPath()
  ctx.moveTo(centerline[0].x, centerline[0].y)
  for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y)
  ctx.stroke()

  // path inner lighter
  ctx.strokeStyle = '#f3e9cc'
  ctx.lineWidth = PATH_W - 22
  ctx.beginPath()
  ctx.moveTo(centerline[0].x, centerline[0].y)
  for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y)
  ctx.stroke()

  // path edge lines (hedge trim)
  ctx.strokeStyle = 'rgba(110,90,40,0.35)'
  ctx.lineWidth = PATH_W + 8
  ctx.globalCompositeOperation = 'source-over'
  ctx.beginPath()
  ctx.moveTo(centerline[0].x, centerline[0].y)
  for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y)
  ctx.stroke()
  ctx.strokeStyle = '#e8dcc3'
  ctx.lineWidth = PATH_W
  ctx.beginPath()
  ctx.moveTo(centerline[0].x, centerline[0].y)
  for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y)
  ctx.stroke()
  ctx.strokeStyle = '#f3e9cc'
  ctx.lineWidth = PATH_W - 22
  ctx.beginPath()
  ctx.moveTo(centerline[0].x, centerline[0].y)
  for (let i = 1; i < centerline.length; i++) ctx.lineTo(centerline[i].x, centerline[i].y)
  ctx.stroke()

  // small stones along path edges
  ctx.fillStyle = 'rgba(120,100,60,0.28)'
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i], b = centerline[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.floor(len / 34)
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps
      const cx = a.x + (b.x - a.x) * t
      const cy = a.y + (b.y - a.y) * t
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
      const d = PATH_W / 2 - 10
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(cx + Math.cos(ang) * d * side, cy + Math.sin(ang) * d * side, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // garden gate
  const gx = gatePos.x, gy = gatePos.y
  // gate arch shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(gx - 32, gy - 32, 64, 64)
  // posts
  ctx.fillStyle = '#3b2f20'
  ctx.fillRect(gx - 30, gy - 28, 8, 56)
  ctx.fillRect(gx + 22, gy - 28, 8, 56)
  // arch top
  ctx.fillStyle = '#5a3f1a'
  ctx.beginPath()
  ctx.moveTo(gx - 30, gy - 28)
  ctx.quadraticCurveTo(gx, gy - 52, gx + 30, gy - 28)
  ctx.lineTo(gx + 22, gy - 20)
  ctx.quadraticCurveTo(gx, gy - 38, gx - 22, gy - 20)
  ctx.closePath(); ctx.fill()
  // gate bars
  ctx.strokeStyle = '#8b6b2e'
  ctx.lineWidth = 2
  for (let i = -18; i <= 18; i += 9) {
    ctx.beginPath(); ctx.moveTo(gx + i, gy - 22); ctx.lineTo(gx + i, gy + 26); ctx.stroke()
  }
  ctx.beginPath(); ctx.moveTo(gx - 22, gy + 2); ctx.lineTo(gx + 22, gy + 2); ctx.stroke()
  // glow if near — green when open, amber locked when fireflies remain
  const allCollected = collected.value >= totalFireflies
  const nearGate = Math.hypot(player.x - gx, player.y - gy) < 120
  if (nearGate) {
    ctx.fillStyle = allCollected ? `rgba(120,220,140,${0.18 + Math.sin(pulse) * 0.07})` : `rgba(255,180,60,${0.16 + Math.sin(pulse) * 0.06})`
    ctx.beginPath(); ctx.arc(gx, gy, 42, 0, Math.PI * 2); ctx.fill()
  }
  // lock overlay when not all collected
  if (!allCollected) {
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.fillRect(gx - 18, gy - 18, 36, 36)
    ctx.fillStyle = '#ffbe3a'
    ctx.font = '700 18px "DM Sans"'
    ctx.textAlign = 'center'
    ctx.fillText('🔒', gx, gy + 6)
    ctx.fillStyle = '#ffbe3a'
    ctx.font = '700 9px "DM Sans"'
    ctx.fillText(`${collected.value}/${totalFireflies}`, gx, gy + 42)
  } else {
    ctx.fillStyle = '#7be68a'
    ctx.font = '700 18px "DM Sans"'
    ctx.textAlign = 'center'
    ctx.fillText('✦', gx, gy + 6)
    ctx.fillStyle = '#f3e9cc'
    ctx.font = '700 11px "DM Sans"'
    ctx.fillText('GATE OPEN', gx, gy + 42)
  }

  // fireflies
  fireflies.forEach(f => {
    if (f.taken) return
    const bob = Math.sin(f.phase) * 3
    const glow = 0.7 + Math.sin(f.phase * 1.5) * 0.3
    // outer glow
    const g = ctx.createRadialGradient(f.x, f.y + bob, 2, f.x, f.y + bob, 26)
    g.addColorStop(0, `rgba(255,235,80,${0.55 * glow})`)
    g.addColorStop(0.35, `rgba(255,210,50,${0.22 * glow})`)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(f.x, f.y + bob, 26, 0, Math.PI * 2); ctx.fill()
    // body
    ctx.fillStyle = '#fff7a0'
    ctx.beginPath(); ctx.arc(f.x, f.y + bob, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffcf33'
    ctx.beginPath(); ctx.arc(f.x, f.y + bob, 3.2, 0, Math.PI * 2); ctx.fill()
    // wings shimmer
    ctx.fillStyle = `rgba(255,255,255,${0.45 + Math.sin(f.phase * 2) * 0.2})`
    ctx.beginPath(); ctx.ellipse(f.x - 5, f.y + bob, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(f.x + 5, f.y + bob, 4, 2, 0.4, 0, Math.PI * 2); ctx.fill()
  })

  // sparks (firefly collect particles)
  sparks.forEach(s => {
    const a = Math.max(0, s.life)
    ctx.fillStyle = `rgba(255,235,80,${0.85 * a})`
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * a, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = `rgba(255,210,50,${0.35 * a})`
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * a * 2.2, 0, Math.PI * 2); ctx.fill()
  })

  // moths
  moths.forEach(m => {
    const flutter = Math.sin(m.phase) * 6
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 14, 14, 6, 0, 0, Math.PI * 2); ctx.fill()
    // glow warning
    ctx.fillStyle = 'rgba(255,120,90,0.18)'
    ctx.beginPath(); ctx.arc(m.x, m.y, MOTH_R + 10, 0, Math.PI * 2); ctx.fill()
    // wings
    const wingA = 0.55 + Math.sin(m.phase * 2) * 0.35
    ctx.fillStyle = `hsla(${m.hue}, 38%, 68%, 0.95)`
    ctx.beginPath()
    ctx.ellipse(m.x - 14, m.y + flutter * 0.2, 13, 9 * wingA, -0.35, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(m.x + 14, m.y + flutter * 0.2, 13, 9 * wingA, 0.35, 0, Math.PI * 2)
    ctx.fill()
    // body
    ctx.fillStyle = '#2b241e'
    ctx.beginPath(); ctx.ellipse(m.x, m.y, 6, 11, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#ffd8a6'
    ctx.beginPath(); ctx.arc(m.x, m.y - 6, 4.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#111'
    ctx.beginPath(); ctx.arc(m.x - 1.8, m.y - 6.5, 1.1, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(m.x + 1.8, m.y - 6.5, 1.1, 0, Math.PI * 2); ctx.fill()
    // danger dots
    ctx.fillStyle = '#ff4d4d'
    ctx.beginPath(); ctx.arc(m.x - 7, m.y + 2, 1.8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(m.x + 7, m.y + 2, 1.8, 0, Math.PI * 2); ctx.fill()
  })

  // player lantern
  const flick = 1 + Math.sin(pulse * 2.1) * 0.08
  // light radius - darkness outside
  // punch light hole with clip: darken entire canvas outside light when playing
  if (state.value === 'playing') {
    ctx.save()
    // create darkness overlay with hole
    ctx.fillStyle = 'rgba(6,10,18,0.72)'
    ctx.fillRect(0, 0, W, H)
    // carve light
    ctx.globalCompositeOperation = 'destination-out'
    const lightR = 118 * flick
    const lg = ctx.createRadialGradient(player.x, player.y, 18, player.x, player.y, lightR)
    lg.addColorStop(0, 'rgba(0,0,0,1)')
    lg.addColorStop(0.55, 'rgba(0,0,0,0.85)')
    lg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lg
    ctx.beginPath(); ctx.arc(player.x, player.y, lightR, 0, Math.PI * 2); ctx.fill()
    // second smaller crisp core
    ctx.beginPath(); ctx.arc(player.x, player.y, 52, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    // soft light tint around player
    const glow = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, 84)
    glow.addColorStop(0, 'rgba(255,220,110,0.42)')
    glow.addColorStop(0.5, 'rgba(255,175,60,0.18)')
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(player.x, player.y, 84, 0, Math.PI * 2); ctx.fill()
  }

  // lantern body
  const blink = player.invuln > 0 && Math.floor(player.invuln / 100) % 2 === 0
  if (!blink) {
    ctx.fillStyle = '#2a1e0f'
    ctx.fillRect(player.x - 10, player.y - 18, 20, 4) // top cap
    ctx.fillStyle = '#ffcf4a'
    ctx.fillRect(player.x - 11, player.y - 14, 22, 22)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillRect(player.x - 8, player.y - 11, 16, 16)
    ctx.fillStyle = `rgba(255,${170 + Math.sin(pulse * 3) * 20}, 40, 0.95)`
    ctx.beginPath(); ctx.arc(player.x, player.y - 3, 5 * flick, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#2a1e0f'
    ctx.fillRect(player.x - 10, player.y + 8, 20, 4)
    // handle
    ctx.strokeStyle = '#3d2b12'
    ctx.lineWidth = 1.8
    ctx.beginPath(); ctx.arc(player.x, player.y - 20, 8, Math.PI, 0); ctx.stroke()
    // legs / shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 16, 11, 4, 0, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255,100,80,0.9)'
    ctx.beginPath(); ctx.arc(player.x, player.y, 16, 0, Math.PI * 2); ctx.fill()
  }

  // vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.85)
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)
}

function loop(now) {
  raf = requestAnimationFrame(loop)
  const dt = Math.min(32, now - last)
  last = now
  update(dt)
  draw()
}

onMounted(() => {
  resetPositions()
  draw()
  last = performance.now()
  raf = requestAnimationFrame(loop)
  onKeyDown = e => handleKey(e, true)
  onKeyUp = e => handleKey(e, false)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  // focus canvas for keyboard — trap focus while playing
  canvasRef.value?.addEventListener('click', () => canvasRef.value?.focus())
  canvasRef.value?.focus()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearInterval(timerInt)
  if (onKeyDown) window.removeEventListener('keydown', onKeyDown)
  if (onKeyUp) window.removeEventListener('keyup', onKeyUp)
})

watch(state, s => { if (s === 'playing') canvasRef.value?.focus() })
</script>

<style scoped>
.lantern-page {
  min-height: calc(100vh - 68px);
  background: #080a0f;
  color: #f6f6f3;
  display: grid;
  place-items: start center;
  padding: 18px 14px 40px;
}
.lantern-wrap {
  width: min(940px, 100%);
}
.lantern-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 14px;
}
.lantern-header h1 {
  font: 700 30px "Space Grotesk";
  letter-spacing: -0.03em;
  margin: 4px 0 6px;
}
.sub {
  color: #9aa0ab;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.ghost {
  border: 1px solid #2d2d30;
  background: #1a1a1d;
  color: #e8e8ea;
  border-radius: 999px;
  padding: 9px 14px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.ghost.tiny { padding: 6px 10px; font-size: 11px; }
.hud {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.hud-item {
  background: #13151a;
  border: 1px solid #24272e;
  border-radius: 14px;
  padding: 10px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hud-item .k { color: #8a8f98; font-size: 11px; letter-spacing: 0.08em; font-weight: 700; text-transform: uppercase; }
.hud-item strong { font: 700 18px "Space Grotesk"; }
.hud-item.danger { border-color: #6b2a2a; background: #1a1212; }
.hud-item.danger strong { color: #ff6b6b; }
.hearts { display: flex; gap: 2px; }
.hearts i { font-style: normal; color: #2a2a2e; font-size: 16px; }
.hearts i.on { color: #ff8a3d; text-shadow: 0 0 8px #ff8a3d; }
.game-frame {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #2a2d34;
  background: #0a0f1a;
  box-shadow: 0 20px 60px #0009;
  aspect-ratio: 900 / 560;
}
.game-frame canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 15, 0.72);
  backdrop-filter: blur(6px);
  padding: 18px;
}
.card {
  width: min(520px, 100%);
  background: #14161b;
  border: 1px solid #2c2f36;
  border-radius: 18px;
  padding: 22px 22px 18px;
  text-align: center;
  box-shadow: 0 16px 40px #0008;
}
.card.small { width: auto; padding: 18px 26px; }
.lantern-icon { font-size: 42px; margin-bottom: 8px; }
.card h2 { font: 700 26px "Space Grotesk"; margin: 0 0 8px; }
.card h3 { margin: 0 0 10px; }
.card p { color: #a8adb5; line-height: 1.6; font-size: 14px; margin: 0 0 10px; }
.card ul { text-align: left; background: #0f1116; border: 1px solid #23252c; border-radius: 12px; padding: 10px 14px; margin: 12px 0; list-style: none; }
.card ul li { font-size: 13px; color: #c9cdd3; padding: 3px 0; }
.card ul li kbd {
  display: inline-block;
  border: 1px solid #3a3d44;
  background: #1d1f26;
  border-radius: 6px;
  padding: 1px 6px;
  font-size: 11px;
  margin-right: 3px;
  border-bottom-width: 2px;
}
button.play {
  width: 100%;
  border: 0;
  background: #ff6719;
  color: #111;
  border-radius: 999px;
  padding: 13px 18px;
  font: 700 15px "DM Sans";
  cursor: pointer;
  margin-top: 10px;
}
button.play:hover { background: #ff7a33; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.rank { color: #ffcf4a !important; font-weight: 700; }
.hint { font-size: 11px !important; color: #6f7580 !important; margin-top: 10px !important; }
.controls-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.dpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: #13151a;
  border: 1px solid #24272e;
  border-radius: 14px;
  padding: 8px;
}
.dpad button {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  border: 1px solid #2e323a;
  background: #1c1e25;
  color: #e8e8ea;
  font-size: 16px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.dpad button:active { background: #2a2d38; }
.dpad .mid { display: flex; gap: 4px; align-items: center; }
.legend {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  color: #8a8f98;
  font-size: 13px;
  font-weight: 600;
}
.legend .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 4px; vertical-align: middle; }
.dot.fire { background: #ffeb50; box-shadow: 0 0 8px #ffeb50; }
.dot.moth { background: #ff6b6b; }
.dot.gate { background: #7be68a; }
.keys-hint { color: #5f6570; font-size: 11px; }
.keys-hint kbd {
  border: 1px solid #2e323a;
  background: #1a1c22;
  border-radius: 5px;
  padding: 1px 5px;
  font-size: 10px;
  margin: 0 1px;
}
.attribution { text-align: center; color: #4a4f5b; font-size: 11px; margin-top: 14px; }
@media (max-width: 700px) {
  .lantern-header { flex-direction: column; align-items: stretch; }
  .hud { grid-template-columns: 1fr 1fr; }
  .controls-bar { justify-content: center; }
  .keys-hint { display: none; }
}
</style>

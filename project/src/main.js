import { clamp, shipAsteroidCollides, createAsteroid, getSpawnInterval, getDifficulty, addScore, isOutOfBounds } from './logic.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const restartBtn2 = document.getElementById('restartBtn2');
const resumeBtn = document.getElementById('resumeBtn');
const finalScoreEl = document.getElementById('finalScore');
const finalBestEl = document.getElementById('finalBest');

// Responsive canvas sizing
let W = 800, H = 600, dpr = 1;
function resize() {
  const wrap = document.getElementById('wrap');
  const rect = wrap.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  // Keep aspect ~800x600 but fit container
  const maxW = Math.min(860, rect.width - 16);
  const maxH = Math.min(window.innerHeight - 220, 640);
  let cssW = maxW;
  let cssH = cssW * 0.75;
  if (cssH > maxH) { cssH = maxH; cssW = cssH / 0.75; }
  W = Math.round(cssW);
  H = Math.round(cssH);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);

// Game state
const STATE = { IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };
let state = STATE.IDLE;
let score = 0;
let best = Number(localStorage.getItem('asteroid-best') || 0);
let difficulty = 0;
let ship = { x: 0, y: 0, w: 36, h: 44, r: 18, vx: 0, vy: 0 };
let asteroids = [];
let particles = [];
let stars = [];
let keys = {};
let spawnTimer = 0;
let lastTime = 0;
let shake = 0;
let thruster = 0;

bestEl.textContent = String(best);

function resetShip() {
  ship.w = 36; ship.h = 44; ship.r = 18;
  ship.x = W / 2 - ship.w / 2;
  ship.y = H - 78;
  ship.vx = 0; ship.vy = 0;
}

function initStars() {
  stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.2,
      speed: 0.3 + Math.random() * 2.2,
      alpha: 0.35 + Math.random() * 0.65,
      twinkle: Math.random() * Math.PI * 2
    });
  }
}

function spawnParticles(x, y, color, count = 18, speed = 4) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed + 0.5;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: Math.random() * 2.5 + 1,
      life: 1, decay: 0.02 + Math.random() * 0.03,
      color
    });
  }
}

// Input
const keyMap = {
  'ArrowUp': 'up', 'KeyW': 'up', 'w': 'up', 'W': 'up',
  'ArrowDown': 'down', 'KeyS': 'down', 's': 'down', 'S': 'down',
  'ArrowLeft': 'left', 'KeyA': 'left', 'a': 'left', 'A': 'left',
  'ArrowRight': 'right', 'KeyD': 'right', 'd': 'right', 'D': 'right',
};
window.addEventListener('keydown', (e) => {
  const k = keyMap[e.code] ?? keyMap[e.key];
  if (k) { keys[k] = true; e.preventDefault(); }
  if (e.code === 'Space' || e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
    if (state === STATE.PLAYING) pause();
    else if (state === STATE.PAUSED) resume();
  }
  if (e.code === 'Enter') {
    if (state === STATE.IDLE) startGame();
    else if (state === STATE.GAMEOVER) startGame();
  }
});
window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code] ?? keyMap[e.key];
  if (k) keys[k] = false;
});

// Touch / mouse
let touchActive = false;
let touchX = 0, touchY = 0;
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - rect.left), y: (t.clientY - rect.top) };
}
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); touchActive = true; const p = canvasPos(e); touchX = p.x; touchY = p.y; }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (!touchActive) return; const p = canvasPos(e); touchX = p.x; touchY = p.y; }, { passive: false });
canvas.addEventListener('touchend', () => { touchActive = false; });
canvas.addEventListener('touchcancel', () => { touchActive = false; });
canvas.addEventListener('mousedown', (e) => { if (state !== STATE.PLAYING) return; touchActive = true; const p = canvasPos(e); touchX = p.x; touchY = p.y; });
window.addEventListener('mousemove', (e) => { if (!touchActive) return; const p = canvasPos(e); touchX = p.x; touchY = p.y; });
window.addEventListener('mouseup', () => { touchActive = false; });

// Buttons
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
restartBtn2.addEventListener('click', startGame);
resumeBtn.addEventListener('click', resume);
document.getElementById('pauseBtn').addEventListener('click', () => {
  if (state === STATE.PLAYING) pause();
  else if (state === STATE.PAUSED) resume();
});

function setState(n) {
  state = n;
  startOverlay.classList.toggle('hidden', n !== STATE.IDLE);
  gameOverOverlay.classList.toggle('hidden', n !== STATE.GAMEOVER);
  pauseOverlay.classList.toggle('hidden', n !== STATE.PAUSED);
}

function startGame() {
  score = 0;
  difficulty = 0;
  asteroids = [];
  particles = [];
  spawnTimer = 0;
  resetShip();
  shake = 0;
  setState(STATE.PLAYING);
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function pause() {
  if (state !== STATE.PLAYING) return;
  setState(STATE.PAUSED);
}
function resume() {
  if (state !== STATE.PAUSED) return;
  setState(STATE.PLAYING);
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function gameOver() {
  setState(STATE.GAMEOVER);
  if (score > best) { best = Math.floor(score); localStorage.setItem('asteroid-best', String(best)); }
  bestEl.textContent = String(best);
  finalScoreEl.textContent = String(Math.floor(score));
  finalBestEl.textContent = String(best);
  // explosion
  spawnParticles(ship.x + ship.w / 2, ship.y + ship.h / 2, '#ff7a3d', 42, 7);
  spawnParticles(ship.x + ship.w / 2, ship.y + ship.h / 2, '#ffd23f', 28, 5);
  shake = 14;
}

// Game loop
function loop(now) {
  if (state !== STATE.PLAYING) return;
  const dt = Math.min(32, now - lastTime);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  // score & difficulty
  score = addScore(score, dt);
  difficulty = getDifficulty(score);
  scoreEl.textContent = String(Math.floor(score));
  levelEl.textContent = String(difficulty + 1);
  if (Math.floor(score) > best) bestEl.textContent = String(Math.floor(score));

  // ship movement: keyboard vector
  const speed = 5.6 + difficulty * 0.08; // subtle speed up
  let dx = 0, dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  // normalize diagonal
  if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }
  // touch overrides / blends
  if (touchActive) {
    const targetX = clamp(touchX - ship.w / 2, 0, W - ship.w);
    const targetY = clamp(touchY - ship.h / 2, 0, H - ship.h);
    // smooth follow
    const tx = targetX - ship.x;
    const ty = targetY - ship.y;
    dx = clamp(tx / 18, -1, 1);
    dy = clamp(ty / 18, -1, 1);
    // if close enough, snap
    if (Math.hypot(tx, ty) < 2) { dx = 0; dy = 0; }
  }

  ship.x = clamp(ship.x + dx * speed * (dt / 16.67), 0, W - ship.w);
  ship.y = clamp(ship.y + dy * speed * (dt / 16.67), 0, H - ship.h);

  thruster = (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1 || touchActive) ? 1 : Math.max(0, thruster - 0.08);

  // spawn asteroids
  spawnTimer += dt;
  const interval = getSpawnInterval(difficulty);
  while (spawnTimer > interval) {
    spawnTimer -= interval;
    const a = createAsteroid(W, H, difficulty);
    // ensure not spawning directly on ship
    if (Math.abs(a.x - (ship.x + ship.w / 2)) < 60 && a.y < 80) a.x = (a.x + 200) % (W - 40) + 20;
    asteroids.push(a);
    // occasional double spawn at high difficulty
    if (difficulty > 6 && Math.random() < 0.28) {
      const b = createAsteroid(W, H, difficulty);
      asteroids.push(b);
    }
  }

  // update asteroids
  for (let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    a.x += a.speedX * (dt / 16.67);
    a.y += a.speedY * (dt / 16.67);
    a.rotation += a.rotationSpeed * (dt / 16.67);
    // wall bounce slight
    if (a.x < a.r && a.speedX < 0) a.speedX *= -0.9;
    if (a.x > W - a.r && a.speedX > 0) a.speedX *= -0.9;
    if (isOutOfBounds(a, W, H)) {
      asteroids.splice(i, 1);
      // dodged bonus
      score += 12;
    } else if (shipAsteroidCollides(ship, a)) {
      // collision!
      spawnParticles(a.x, a.y, '#8b8fa3', 14, 5);
      gameOver();
      return;
    }
  }

  // stars parallax
  for (const s of stars) {
    s.y += s.speed * (dt / 16.67) * (0.6 + difficulty * 0.03);
    s.twinkle += 0.05;
    if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * (dt / 16.67);
    p.y += p.vy * (dt / 16.67);
    p.vy += 0.06 * (dt / 16.67);
    p.life -= p.decay * (dt / 16.67);
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (shake > 0) shake *= 0.88 - difficulty * 0.005;
  if (shake < 0.08) shake = 0;
}

// Draw helpers
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw() {
  ctx.save();
  if (shake) {
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.translate(sx, sy);
  }
  // background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#070a1a');
  grad.addColorStop(0.55, '#0e1430');
  grad.addColorStop(1, '#0b1026');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // subtle nebula
  ctx.fillStyle = 'rgba(124, 77, 255, 0.06)';
  ctx.beginPath();
  ctx.ellipse(W * 0.72, H * 0.18, W * 0.42, H * 0.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
  ctx.beginPath();
  ctx.ellipse(W * 0.18, H * 0.72, W * 0.35, H * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // stars
  for (const s of stars) {
    const tw = 0.85 + Math.sin(s.twinkle) * 0.15;
    ctx.globalAlpha = s.alpha * tw;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // asteroids
  for (const a of asteroids) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 6, a.r * 0.9, a.r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    const bodyGrad = ctx.createRadialGradient(-a.r * 0.22, -a.r * 0.3, a.r * 0.22, 0, 0, a.r);
    bodyGrad.addColorStop(0, '#9aa0b3');
    bodyGrad.addColorStop(0.5, '#6b7083');
    bodyGrad.addColorStop(1, '#3f4352');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#2a2e3d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < a.vertices.length; i++) {
      const v = a.vertices[i];
      const ang = v.angle;
      const rad = a.r * v.scale;
      const x = Math.cos(ang) * rad;
      const y = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // craters
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(a.r * -0.18, a.r * -0.12, a.r * 0.18, 0, Math.PI * 2);
    ctx.arc(a.r * 0.32, a.r * 0.18, a.r * 0.12, 0, Math.PI * 2);
    ctx.arc(a.r * 0.05, a.r * 0.36, a.r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ship
  drawShip(ship.x, ship.y, ship.w, ship.h);

  ctx.restore();

  // grid vignette
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 42) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 42) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H));
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawShip(x, y, w, h) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  // thruster flame when moving
  if (state === STATE.PLAYING && (thruster > 0.08 || touchActive)) {
    const flick = 0.85 + Math.random() * 0.3;
    ctx.globalAlpha = 0.9;
    // outer flame
    ctx.fillStyle = '#ff6a00';
    ctx.beginPath();
    ctx.moveTo(-w * 0.14, h * 0.38);
    ctx.lineTo(0, h * (0.62 + thruster * 0.18 * flick));
    ctx.lineTo(w * 0.14, h * 0.38);
    ctx.closePath();
    ctx.fill();
    // inner flame
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, h * 0.38);
    ctx.lineTo(0, h * (0.52 + thruster * 0.14 * flick));
    ctx.lineTo(w * 0.08, h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 10, w * 0.42, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // hull base - clipped triangle shape
  ctx.fillStyle = '#e9f0ff';
  ctx.strokeStyle = '#8ea0c8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.5); // nose
  ctx.lineTo(-w * 0.46, h * 0.42);
  ctx.lineTo(-w * 0.18, h * 0.32);
  ctx.lineTo(w * 0.18, h * 0.32);
  ctx.lineTo(w * 0.46, h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // side wings accent
  ctx.fillStyle = '#7c4dff';
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, h * 0.42);
  ctx.lineTo(-w * 0.28, h * 0.10);
  ctx.lineTo(-w * 0.18, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.42);
  ctx.lineTo(w * 0.28, h * 0.10);
  ctx.lineTo(w * 0.18, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // cockpit
  const cg = ctx.createLinearGradient(0, -h * 0.18, 0, h * 0.08);
  cg.addColorStop(0, '#00e5ff');
  cg.addColorStop(1, '#0a3a6b');
  ctx.fillStyle = cg;
  ctx.strokeStyle = '#cfe9ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, -2, w * 0.16, h * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // cockpit glare
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-w * 0.05, -h * 0.08, w * 0.06, h * 0.06, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // engine nozzles
  ctx.fillStyle = '#2a2e3d';
  ctx.fillRect(-w * 0.18 - 3, h * 0.30, 7, 5);
  ctx.fillRect(w * 0.18 - 4, h * 0.30, 7, 5);
  ctx.fillStyle = '#ff7a3d';
  ctx.fillRect(-w * 0.18 - 1, h * 0.32, 3, 2);
  ctx.fillRect(w * 0.18 - 2, h * 0.32, 3, 2);

  ctx.restore();
}

// Init
resize();
initStars();
resetShip();
draw();
setState(STATE.IDLE);

// idle animation loop (stars + ship bob)
let idleRaf;
function idleLoop() {
  if (state !== STATE.IDLE) return;
  // gentle star drift + draw
  for (const s of stars) {
    s.y += s.speed * 0.28;
    s.twinkle += 0.04;
    if (s.y > H + 2) { s.y = -2; s.x = Math.random() * W; }
  }
  // subtle ship hover
  const t = performance.now() * 0.001;
  const hoverY = Math.sin(t * 1.6) * 4;
  const savedY = ship.y;
  ship.y = H - 78 + hoverY;
  draw();
  ship.y = savedY;
  idleRaf = requestAnimationFrame(idleLoop);
}
idleLoop();

// when window regains focus ensure correct
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state === STATE.PLAYING) {
    lastTime = performance.now();
  }
});

// Debug: expose for tests if needed
window.__game = { get state() { return state; }, get score() { return score; }, ship, asteroids };

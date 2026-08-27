(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayMsg = document.getElementById('overlay-msg');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  const W = canvas.width;
  const H = canvas.height;

  const ROUND_TIME = 30; // seconds
  let best = parseInt(localStorage.getItem('coinCatchBest') || '0', 10);
  bestEl.textContent = best;

  // Game state
  let score = 0;
  let timeLeft = ROUND_TIME;
  let state = 'idle'; // idle, playing, over
  let rafId = null;
  let lastTs = 0;
  let spawnAccum = 0;
  let coins = [];
  let particles = [];
  let missed = 0;

  // Player
  const player = {
    x: W / 2 - 50,
    y: H - 44,
    w: 100,
    h: 18,
    speed: 360, // px per second
    vx: 0
  };

  const keys = { left: false, right: false };

  function resetGame() {
    score = 0;
    timeLeft = ROUND_TIME;
    coins = [];
    particles = [];
    missed = 0;
    spawnAccum = 0;
    player.x = W / 2 - player.w / 2;
    player.vx = 0;
    updateHud();
    draw(0);
  }

  function startGame() {
    resetGame();
    state = 'playing';
    overlay.classList.add('hidden');
    lastTs = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    state = 'over';
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (score > best) {
      best = score;
      localStorage.setItem('coinCatchBest', String(best));
      bestEl.textContent = best;
    }
    let title = "Time's Up!";
    let msg = `You caught <strong>${score}</strong> coins`;
    if (missed > 0) msg += ` and missed ${missed}.`;
    else msg += ` with no misses! Amazing!`;

    let rank = '';
    if (score >= 35) rank = '<br><span style="color:#ffd23f">Rank: Coin Master ★★★</span>';
    else if (score >= 22) rank = '<br><span style="color:#ffd23f">Rank: Collector ★★</span>';
    else if (score >= 12) rank = '<br><span style="color:#a8b2d6">Rank: Apprentice ★</span>';
    else rank = '<br><span style="color:#9aa3c2">Rank: Keep practicing!</span>';

    overlayTitle.textContent = title;
    overlayMsg.innerHTML = msg + rank + '<br><br>Press Start or Restart to play again.';
    startBtn.textContent = 'Play Again';
    overlay.classList.remove('hidden');
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    timeEl.textContent = timeLeft.toFixed(1);
    // color urgency
    if (timeLeft <= 10 && state === 'playing') timeEl.style.color = '#ff6b6b';
    else timeEl.style.color = '';
  }

  // Input
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    // space / enter to start (covers e.key ' ', e.code 'Space', older 'Spacebar')
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Spacebar' || e.key === 'Enter') {
      if (state !== 'playing') {
        e.preventDefault();
        startGame();
      } else if (e.key === ' ') {
        e.preventDefault();
      }
    }
    // prevent scrolling for arrows and space
    if (['ArrowLeft','ArrowRight',' '].includes(e.key) || e.code==='Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left=false; keys.right=false; dragging=false; });

  // Touch / mouse drag
  let dragging = false;
  function canvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    return (clientX - rect.left) * scale;
  }
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    const x = canvasX(e.clientX);
    player.x = Math.max(0, Math.min(W - player.w, x - player.w / 2));
    if (state === 'idle') startGame();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const x = canvasX(e.clientX);
    player.x = Math.max(0, Math.min(W - player.w, x - player.w / 2));
  });
  canvas.addEventListener('pointerup', () => dragging = false);
  canvas.addEventListener('pointercancel', () => dragging = false);
  canvas.addEventListener('pointerleave', () => dragging = false);

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => {
    if (state === 'playing') {
      resetGame();
      state = 'playing';
      overlay.classList.add('hidden');
      lastTs = performance.now();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    } else {
      startGame();
    }
  });

  function spawnCoin() {
    const r = 14 + Math.random() * 6;
    const x = r + Math.random() * (W - r * 2);
    const speed = 120 + Math.random() * 120 + (ROUND_TIME - timeLeft) * 8; // ramp up
    const drift = (Math.random() - 0.5) * 30;
    const type = Math.random() < 0.12 ? 'rare' : 'normal'; // rare worth 3
    coins.push({ x, y: -r - 10, r, speed, drift, rot: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*4, type });
  }

  function addParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 30,
        life: 0.4 + Math.random()*0.2,
        t: 0,
        color
      });
    }
  }

  function update(dt) {
    // player movement (keyboard) - always responsive even while dragging
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    player.x += dir * player.speed * dt;
    player.x = Math.max(0, Math.min(W - player.w, player.x));

    // spawn
    spawnAccum += dt;
    let interval = Math.max(0.22, 0.72 - (ROUND_TIME - timeLeft) * 0.015);
    while (spawnAccum > interval) {
      spawnAccum -= interval;
      spawnCoin();
      // occasional double spawn later
      if (timeLeft < 15 && Math.random() < 0.35) spawnCoin();
    }

    // coins update
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.y += c.speed * dt;
      c.x += c.drift * dt;
      c.rot += c.rotSpeed * dt;
      // bounce off walls gently
      if (c.x < c.r) { c.x = c.r; c.drift *= -0.6; }
      if (c.x > W - c.r) { c.x = W - c.r; c.drift *= -0.6; }

      // catch check: AABB vs circle (basket at player.y)
      const basketTop = player.y;
      const basketBottom = player.y + player.h;
      // coin center within x bounds and y overlapping basket
      if (c.y + c.r >= basketTop && c.y - c.r <= basketBottom &&
          c.x >= player.x - 6 && c.x <= player.x + player.w + 6) {
        const pts = c.type === 'rare' ? 3 : 1;
        score += pts;
        addParticles(c.x, c.y, c.type === 'rare' ? '#7af0ff' : '#ffd23f');
        coins.splice(i, 1);
        continue;
      }
      if (c.y - c.r > H + 20) {
        coins.splice(i, 1);
        missed++;
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt; // gravity
      p.vx *= 0.98;
      if (p.t >= p.life) particles.splice(i, 1);
    }

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endGame();
      return false;
    }
    updateHud();
    return true;
  }

  function draw(dt) {
    // clear
    ctx.clearRect(0, 0, W, H);

    // subtle grid
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // ground
    ctx.fillStyle = '#0b1028';
    ctx.fillRect(0, H - 12, W, 12);
    ctx.fillStyle = '#1e2a5a';
    ctx.fillRect(0, H - 14, W, 2);

    // coins
    for (const c of coins) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      // shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(2, 6, c.r*0.9, c.r*0.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;

      // outer
      const isRare = c.type === 'rare';
      ctx.fillStyle = isRare ? '#7af0ff' : '#ffd23f';
      ctx.strokeStyle = isRare ? '#3ec0d8' : '#e6a800';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // inner
      ctx.strokeStyle = isRare ? '#baf6ff' : '#fff2a8';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, c.r*0.62, 0, Math.PI*2); ctx.stroke();
      // $ or star
      ctx.fillStyle = isRare ? '#0a2a33' : '#7a4a00';
      ctx.font = `bold ${c.r*1.05}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isRare ? '★' : '$', 0, 1);
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-c.r*0.35, -c.r*0.35, c.r*0.22, c.r*0.32, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // player - basket + shadow
    ctx.save();
    // shadow under player
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(player.x + player.w/2, H - 6, player.w*0.5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    const px = player.x;
    const py = player.y;
    // basket body
    const grad = ctx.createLinearGradient(px, py, px, py+player.h+14);
    grad.addColorStop(0, '#ffdc6b');
    grad.addColorStop(1, '#d48a1a');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#8a5a0a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // trapezoid basket
    ctx.moveTo(px+6, py);
    ctx.lineTo(px+player.w-6, py);
    ctx.lineTo(px+player.w, py+player.h+10);
    ctx.lineTo(px, py+player.h+10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // rim highlight
    ctx.fillStyle = '#fff4b8';
    ctx.fillRect(px+2, py-4, player.w-4, 6);
    ctx.strokeRect(px+2, py-4, player.w-4, 6);
    // weave lines
    ctx.strokeStyle = 'rgba(120,70,0,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 3; i++) {
      const y = py + (player.h+10) * (i/4);
      ctx.beginPath(); ctx.moveTo(px+4, y); ctx.lineTo(px+player.w-4, y); ctx.stroke();
    }
    for (let i = 1; i <= 4; i++) {
      const x = px + player.w * (i/5);
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + (i-2.5)*4, py+player.h+10); ctx.stroke();
    }
    // glow when catching recently? simple
    ctx.restore();

    // particles
    for (const p of particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * a + 1, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // vignette
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.4, W/2, H/2, H);
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0,0,W,H);
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    const cont = update(dt);
    draw(dt);
    if (cont) rafId = requestAnimationFrame(loop);
  }

  // initial draw
  resetGame();
  // pause overlay initially visible - draw once
  draw(0);
})();

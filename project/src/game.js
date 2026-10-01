export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const SHIP_SIZE = 32;
export const SHIP_SPEED = 320; // px per second

export const COMET_SIZE = 18;
export const ASTEROID_SIZE = 28;

export const INITIAL_LIVES = 3;
export const COMET_SCORE = 10;
export const COMET_SPAWN_INTERVAL = 0.9; // seconds
export const ASTEROID_SPAWN_INTERVAL = 1.4;

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function isColliding(a, b) {
  // circle collision based on size/2
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < (a.radius + b.radius);
}

export function getDifficulty(score) {
  // Level 1 at 0, +1 every 100 points, cap 10
  return Math.min(10, 1 + Math.floor(score / 100));
}

export function getSpawnConfig(difficulty) {
  // returns effective intervals and speeds
  return {
    cometInterval: Math.max(0.35, COMET_SPAWN_INTERVAL - (difficulty - 1) * 0.06),
    asteroidInterval: Math.max(0.35, ASTEROID_SPAWN_INTERVAL - (difficulty - 1) * 0.10),
    asteroidSpeedMin: 80 + (difficulty - 1) * 18,
    asteroidSpeedMax: 160 + (difficulty - 1) * 22,
    cometSpeedMin: 70 + (difficulty - 1) * 10,
    cometSpeedMax: 140 + (difficulty - 1) * 12
  };
}

export function createInitialState() {
  return {
    ship: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 70, radius: SHIP_SIZE * 0.45, vx: 0, vy: 0 },
    comets: [],
    asteroids: [],
    particles: [],
    score: 0,
    lives: INITIAL_LIVES,
    difficulty: 1,
    time: 0,
    cometTimer: 0,
    asteroidTimer: 0,
    gameOver: false,
    highScore: 0,
    invulnerable: 0 // seconds of invuln after hit
  };
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function spawnComet(state) {
  const cfg = getSpawnConfig(state.difficulty);
  const speed = randomRange(cfg.cometSpeedMin, cfg.cometSpeedMax);
  state.comets.push({
    x: randomRange(COMET_SIZE, GAME_WIDTH - COMET_SIZE),
    y: -COMET_SIZE,
    radius: COMET_SIZE * 0.55,
    vy: speed,
    vx: randomRange(-20, 20),
    phase: Math.random() * Math.PI * 2,
    kind: Math.random() < 0.2 ? 'rare' : 'common'
  });
}

export function spawnAsteroid(state) {
  const cfg = getSpawnConfig(state.difficulty);
  const speed = randomRange(cfg.asteroidSpeedMin, cfg.asteroidSpeedMax);
  const sizeVar = randomRange(0.85, 1.25);
  state.asteroids.push({
    x: randomRange(ASTEROID_SIZE, GAME_WIDTH - ASTEROID_SIZE),
    y: -ASTEROID_SIZE * 1.5,
    radius: ASTEROID_SIZE * 0.5 * sizeVar,
    vy: speed,
    vx: randomRange(-30, 30),
    rotation: randomRange(0, Math.PI * 2),
    rotSpeed: randomRange(-2, 2)
  });
}

/**
 * Update ship position based on input and dt
 * input: { left, right, up, down }
 */
export function updateShip(state, input, dt) {
  if (state.gameOver) return;
  let dx = 0, dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (dx !== 0 && dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  const speed = SHIP_SPEED;
  // simple lerp for smoother feel if no input -> friction? direct movement for now.
  state.ship.x += dx * speed * dt;
  state.ship.y += dy * speed * dt;

  // clamp inside bounds
  const pad = state.ship.radius;
  state.ship.x = clamp(state.ship.x, pad, GAME_WIDTH - pad);
  state.ship.y = clamp(state.ship.y, pad, GAME_HEIGHT - pad);

  if (state.invulnerable > 0) {
    state.invulnerable = Math.max(0, state.invulnerable - dt);
  }
}

export function updateEntities(state, dt) {
  // comets
  for (const c of state.comets) {
    c.y += c.vy * dt;
    c.x += c.vx * dt;
    c.phase += dt * 4;
    // gentle wobble
    c.x += Math.sin(c.phase) * 0.5;
  }
  for (const a of state.asteroids) {
    a.y += a.vy * dt;
    a.x += a.vx * dt;
    a.rotation += a.rotSpeed * dt;
  }
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 80 * dt; // gravity drag
  }

  // cull off-screen and dead particles
  state.comets = state.comets.filter(c => c.y < GAME_HEIGHT + 40 && c.x > -40 && c.x < GAME_WIDTH + 40);
  state.asteroids = state.asteroids.filter(a => a.y < GAME_HEIGHT + 60 && a.x > -60 && a.x < GAME_WIDTH + 60);
  state.particles = state.particles.filter(p => p.life > 0);
}

export function checkCollisions(state) {
  if (state.gameOver) return;

  // comet collection
  for (let i = state.comets.length - 1; i >= 0; i--) {
    const c = state.comets[i];
    if (isColliding(state.ship, c)) {
      state.comets.splice(i, 1);
      const pts = c.kind === 'rare' ? 25 : COMET_SCORE;
      state.score += pts;
      // highscore tracking
      if (state.score > state.highScore) state.highScore = state.score;
      // particles
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        const sp = randomRange(60, 140);
        state.particles.push({
          x: c.x, y: c.y,
          vx: Math.cos(ang) * sp + randomRange(-20, 20),
          vy: Math.sin(ang) * sp + randomRange(-20, 20),
          life: randomRange(0.3, 0.6),
          maxLife: 0.6,
          color: c.kind === 'rare' ? '#facc15' : '#38bdf8'
        });
      }
    }
  }

  // asteroid collision - only if not invulnerable
  if (state.invulnerable <= 0) {
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
      const a = state.asteroids[i];
      if (isColliding(state.ship, a)) {
        state.asteroids.splice(i, 1);
        state.lives -= 1;
        state.invulnerable = 1.2; // brief invuln

        // explosion particles
        for (let k = 0; k < 16; k++) {
          const ang = Math.random() * Math.PI * 2;
          const sp = randomRange(80, 220);
          state.particles.push({
            x: a.x, y: a.y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: randomRange(0.4, 0.8),
            maxLife: 0.8,
            color: '#f87171'
          });
        }

        if (state.lives <= 0) {
          state.lives = 0;
          state.gameOver = true;
        }
        break; // only one hit per frame
      }
    }
  }
}

export function updateDifficulty(state) {
  const newDiff = getDifficulty(state.score);
  if (newDiff !== state.difficulty) {
    state.difficulty = newDiff;
  }
}

export function tick(state, input, dt) {
  if (state.gameOver) return;
  state.time += dt;

  updateDifficulty(state);
  const cfg = getSpawnConfig(state.difficulty);

  state.cometTimer += dt;
  state.asteroidTimer += dt;

  if (state.cometTimer >= cfg.cometInterval) {
    state.cometTimer = 0;
    spawnComet(state);
  }
  if (state.asteroidTimer >= cfg.asteroidInterval) {
    state.asteroidTimer = 0;
    spawnAsteroid(state);
    // at higher difficulty occasionally spawn double
    if (state.difficulty >= 5 && Math.random() < 0.35) {
      spawnAsteroid(state);
    }
  }

  updateShip(state, input, dt);
  updateEntities(state, dt);
  checkCollisions(state);
}

export function restartState(state) {
  const high = state.highScore;
  const fresh = createInitialState();
  fresh.highScore = Math.max(high, state.score);
  Object.assign(state, fresh);
}

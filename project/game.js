// Asteroid Sprint - pure game logic (testable, no DOM)
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;
export const SHIP_WIDTH = 36;
export const SHIP_HEIGHT = 48;
export const SHIP_SPEED = 340; // px per second
export const ASTEROID_MIN_SIZE = 24;
export const ASTEROID_MAX_SIZE = 52;
export const ASTEROID_BASE_SPEED = 160;
export const ASTEROID_SPEED_VARIANCE = 120;
export const SPAWN_INTERVAL_START = 900; // ms
export const SPAWN_INTERVAL_MIN = 320;

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createShip() {
  return {
    x: GAME_WIDTH / 2 - SHIP_WIDTH / 2,
    y: GAME_HEIGHT - SHIP_HEIGHT - 24,
    width: SHIP_WIDTH,
    height: SHIP_HEIGHT
  };
}

export function createInitialState() {
  return {
    ship: createShip(),
    asteroids: [],
    score: 0,
    elapsed: 0,
    spawnTimer: 0,
    spawnInterval: SPAWN_INTERVAL_START,
    gameOver: false,
    difficulty: 1
  };
}

// direction: -1 left, 0 none, 1 right, dt in seconds
export function updateShip(ship, direction, dt) {
  const nextX = ship.x + direction * SHIP_SPEED * dt;
  ship.x = clamp(nextX, 0, GAME_WIDTH - ship.width);
  return ship;
}

export function spawnAsteroid(state, random = Math.random) {
  const size = ASTEROID_MIN_SIZE + random() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
  const x = random() * (GAME_WIDTH - size);
  const speed = ASTEROID_BASE_SPEED + random() * ASTEROID_SPEED_VARIANCE + state.difficulty * 18;
  const asteroid = {
    x,
    y: -size,
    size,
    speed,
    rotation: random() * Math.PI * 2,
    rotationSpeed: (random() - 0.5) * 2.5,
    // polygon jitter for visual variety
    points: 7 + Math.floor(random() * 4)
  };
  state.asteroids.push(asteroid);
  return asteroid;
}

export function updateAsteroids(state, dt) {
  let dodged = 0;
  for (const a of state.asteroids) {
    a.y += a.speed * dt;
    a.rotation += a.rotationSpeed * dt;
  }
  // remove off-screen and count score
  const remaining = [];
  for (const a of state.asteroids) {
    if (a.y > GAME_HEIGHT + a.size) {
      dodged++;
    } else {
      remaining.push(a);
    }
  }
  state.asteroids = remaining;
  if (dodged > 0) {
    state.score += dodged * 10;
  }
  return dodged;
}

// AABB collision with slight inset for fairness
export function checkCollision(ship, asteroid) {
  const shipLeft = ship.x + 4;
  const shipRight = ship.x + ship.width - 4;
  const shipTop = ship.y + 6;
  const shipBottom = ship.y + ship.height - 6;

  const astLeft = asteroid.x + asteroid.size * 0.12;
  const astRight = asteroid.x + asteroid.size * 0.88;
  const astTop = asteroid.y + asteroid.size * 0.12;
  const astBottom = asteroid.y + asteroid.size * 0.88;

  return !(shipRight < astLeft || shipLeft > astRight || shipBottom < astTop || shipTop > astBottom);
}

export function isColliding(state) {
  for (const a of state.asteroids) {
    if (checkCollision(state.ship, a)) return true;
  }
  return false;
}

// main tick: dt in seconds, direction -1/0/1, random fn for spawning
export function updateGame(state, dt, direction, random = Math.random) {
  if (state.gameOver) return state;

  state.elapsed += dt;
  // difficulty ramp
  state.difficulty = 1 + state.elapsed * 0.12; // gradually faster spawns
  state.spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_START - state.elapsed * 22);

  updateShip(state.ship, direction, dt);

  // spawning
  state.spawnTimer += dt * 1000;
  while (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer -= state.spawnInterval;
    spawnAsteroid(state, random);
  }

  updateAsteroids(state, dt);

  // score also ticks with time (survival bonus)
  state.score += dt * 12;

  if (isColliding(state)) {
    state.gameOver = true;
  }

  return state;
}

export function resetGame(state) {
  const fresh = createInitialState();
  Object.assign(state, fresh);
  return state;
}

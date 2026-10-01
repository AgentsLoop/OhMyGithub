// Crystal Catcher - core game logic (pure + testable)
export const CONFIG = {
  width: 480,
  height: 720,
  basketWidth: 110,
  basketHeight: 28,
  basketY: 660, // from top (height - 60)
  basketSpeed: 520, // px per second
  objectSize: 36,
  crystalValue: { blue: 10, purple: 20, cyan: 30, gold: 50 },
  crystalTypes: ['blue', 'purple', 'cyan', 'gold'],
  crystalWeights: [0.45, 0.30, 0.18, 0.07], // probability distribution
  bombChanceBase: 0.18,
  bombChanceIncrement: 0.025, // per level
  initialLives: 3,
  initialSpawnInterval: 900, // ms
  minSpawnInterval: 280,
  spawnDecreasePerLevel: 70,
  baseFallSpeed: 170,
  fallSpeedPerLevel: 32,
  levelScoreStep: 250, // points per level
  maxLives: 5
};

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function getLevelFromScore(score) {
  return Math.floor(score / CONFIG.levelScoreStep) + 1;
}

export function getSpawnInterval(level) {
  return Math.max(CONFIG.minSpawnInterval, CONFIG.initialSpawnInterval - (level - 1) * CONFIG.spawnDecreasePerLevel);
}

export function getFallSpeed(level) {
  return CONFIG.baseFallSpeed + (level - 1) * CONFIG.fallSpeedPerLevel;
}

export function getBombChance(level) {
  return Math.min(0.45, CONFIG.bombChanceBase + (level - 1) * CONFIG.bombChanceIncrement);
}

export function createBasket(width, height) {
  return {
    x: (width - CONFIG.basketWidth) / 2,
    y: height - 60,
    width: CONFIG.basketWidth,
    height: CONFIG.basketHeight,
    speed: CONFIG.basketSpeed
  };
}

export function createInitialState(width = CONFIG.width, height = CONFIG.height) {
  return {
    width,
    height,
    basket: createBasket(width, height),
    objects: [],
    score: 0,
    lives: CONFIG.initialLives,
    level: 1,
    gameOver: false,
    spawnTimer: 0,
    spawnInterval: CONFIG.initialSpawnInterval,
    fallSpeed: CONFIG.baseFallSpeed,
    nextId: 1,
    caught: 0,
    bombsHit: 0
  };
}

export function pickCrystalType(rand = Math.random) {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < CONFIG.crystalTypes.length; i++) {
    acc += CONFIG.crystalWeights[i];
    if (r < acc) return CONFIG.crystalTypes[i];
  }
  return CONFIG.crystalTypes[0];
}

export function spawnObject(state, rand = Math.random) {
  const isBomb = rand() < getBombChance(state.level);
  const type = isBomb ? 'bomb' : pickCrystalType(rand);
  const size = isBomb ? CONFIG.objectSize : CONFIG.objectSize - 4 + (type === 'gold' ? 6 : 0);
  const x = rand() * (state.width - size - 16) + 8;
  const vy = getFallSpeed(state.level) * (0.85 + rand() * 0.4);
  const obj = {
    id: state.nextId++,
    x,
    y: -size - 10,
    width: size,
    height: size,
    type,
    vy,
    rotation: rand() * Math.PI * 2,
    rotSpeed: (rand() - 0.5) * 3,
    // for visual variation
    wobble: rand() * Math.PI * 2
  };
  state.objects.push(obj);
  return obj;
}

export function checkCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function moveBasket(state, direction, deltaSeconds) {
  if (state.gameOver) return;
  const delta = direction * state.basket.speed * deltaSeconds;
  state.basket.x = clamp(state.basket.x + delta, 0, state.width - state.basket.width);
}

export function setBasketPosition(state, xCenter) {
  if (state.gameOver) return;
  const half = state.basket.width / 2;
  state.basket.x = clamp(xCenter - half, 0, state.width - state.basket.width);
}

/**
 * Update game state by deltaTime (ms)
 * Returns an object describing events that happened this tick
 */
export function update(state, deltaMs, rand = Math.random) {
  if (state.gameOver) return { caught: [], bombHits: [], missed: [] };

  const deltaSec = deltaMs / 1000;

  // difficulty
  const newLevel = getLevelFromScore(state.score);
  if (newLevel !== state.level) {
    state.level = newLevel;
    state.spawnInterval = getSpawnInterval(state.level);
    state.fallSpeed = getFallSpeed(state.level);
  }

  // spawn
  state.spawnTimer += deltaMs;
  while (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer -= state.spawnInterval;
    spawnObject(state, rand);
  }

  const events = { caught: [], bombHits: [], missed: [], gameOver: false };

  // move objects
  for (const obj of state.objects) {
    obj.y += obj.vy * deltaSec;
    obj.rotation += obj.rotSpeed * deltaSec;
    obj.wobble += deltaSec * 4;
  }

  // collision & off-screen
  const remaining = [];
  for (const obj of state.objects) {
    // basket collision rect: slightly smaller height for forgiving feel but wider
    const basketHitBox = {
      x: state.basket.x - 6,
      y: state.basket.y,
      width: state.basket.width + 12,
      height: state.basket.height + 8
    };
    if (checkCollision(basketHitBox, obj)) {
      if (obj.type === 'bomb') {
        state.lives -= 1;
        state.bombsHit += 1;
        events.bombHits.push(obj);
        if (state.lives <= 0) {
          state.lives = 0;
          state.gameOver = true;
          events.gameOver = true;
        }
      } else {
        const val = CONFIG.crystalValue[obj.type] || 10;
        // bonus for gold & combo could be added
        state.score += val;
        state.caught += 1;
        events.caught.push({ ...obj, value: val });
        // extra life every 1000 points? optional affordance
        if (state.score > 0 && state.score % 1000 === 0 && state.lives < CONFIG.maxLives) {
          // will actually trigger on catch that hits 1000,2000 etc
          // we check after increment
        }
      }
      // consumed, don't keep
    } else if (obj.y > state.height + 40) {
      // missed object falls off bottom
      events.missed.push(obj);
      // No penalty for missing crystals; bombs missed is good
    } else {
      remaining.push(obj);
    }
  }
  state.objects = remaining;

  // extra life handling: grant life when crossing 1000 thresholds (check after score update)
  // We implement as: if score crossed a 1000 boundary since last update, grant life
  // Safer: caller can use events; but we implement simple: every time score % 1000 ==0 handled above
  // Instead handle generically: level already handles; we can also give life every 800? Keep simple: no auto life.
  // Let's implement: if score >= 1000 and previously was <1000, gain life - but we don't store prev. Simpler: do nothing.

  // sync level after potential score change mid-tick -> will apply next tick

  return events;
}

export function resetState(state) {
  const fresh = createInitialState(state.width, state.height);
  Object.assign(state, fresh);
}

// Helper for tests: create deterministic state with given objects
export function createTestState(overrides = {}) {
  const s = createInitialState(480, 720);
  Object.assign(s, overrides);
  if (overrides.basket) Object.assign(s.basket, overrides.basket);
  return s;
}

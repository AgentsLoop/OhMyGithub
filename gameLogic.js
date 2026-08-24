// Pure game logic for Star Dodger - testable with node --test
// Also usable in browser via global

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function checkCollision(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function updateShipPosition(x, direction, speed, minX, maxX) {
  return clamp(x + direction * speed, minX, maxX);
}

function createAsteroid(canvasWidth, seedRandom = Math.random) {
  const size = 18 + seedRandom() * 22; // 18-40
  const x = seedRandom() * (canvasWidth - size);
  const speed = 1.8 + seedRandom() * 3.5;
  const rotationSpeed = (seedRandom() - 0.5) * 0.08;
  const type = seedRandom() > 0.35 ? 'asteroid' : 'star';
  return {
    x, y: -size - 10,
    w: size, h: size,
    speed,
    rotation: seedRandom() * Math.PI * 2,
    rotationSpeed,
    type,
    points: type === 'star' ? 5 : 0
  };
}

function updateAsteroids(asteroids, dt, canvasHeight) {
  for (const a of asteroids) {
    a.y += a.speed * dt * 60;
    a.rotation += a.rotationSpeed * dt * 60;
  }
  // keep only on-screen (with buffer)
  return asteroids.filter(a => a.y < canvasHeight + 60);
}

function getDifficultyMultiplier(elapsedMs) {
  // increases slowly: every 10s +0.15 speed
  return 1 + Math.floor(elapsedMs / 10000) * 0.15;
}

function calculateScore(elapsedMs) {
  return Math.floor(elapsedMs / 100);
}

function shouldSpawn(elapsedMs, lastSpawnMs, baseInterval = 650) {
  const difficulty = getDifficultyMultiplier(elapsedMs);
  const interval = Math.max(180, baseInterval / difficulty);
  return elapsedMs - lastSpawnMs >= interval;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    clamp,
    checkCollision,
    updateShipPosition,
    createAsteroid,
    updateAsteroids,
    getDifficultyMultiplier,
    calculateScore,
    shouldSpawn
  };
}
if (typeof window !== 'undefined') {
  window.StarDodgerLogic = {
    clamp, checkCollision, updateShipPosition, createAsteroid, updateAsteroids,
    getDifficultyMultiplier, calculateScore, shouldSpawn
  };
}

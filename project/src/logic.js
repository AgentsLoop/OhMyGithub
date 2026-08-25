/**
 * Pure game logic — no DOM, testable in Node.
 * @module logic
 */

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// distance between two points
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Simple circle-circle collision
export function circleCollides(a, b) {
  return dist(a.x, a.y, b.x, b.y) < a.r + b.r;
}

// Ship vs asteroid: ship is approximated as circle for gameplay fairness
// Ship circle centered slightly forward; asteroid is circle.
export function shipAsteroidCollides(ship, asteroid) {
  // ship: {x, y, w, h, r}
  // asteroid: {x, y, r}
  const sx = ship.x + ship.w / 2;
  const sy = ship.y + ship.h / 2;
  // shrink ship collision a bit for fairness (0.72 factor)
  const sr = (ship.r ?? Math.min(ship.w, ship.h) / 2) * 0.72;
  return dist(sx, sy, asteroid.x, asteroid.y) < sr + asteroid.r * 0.9;
}

// Create an asteroid object given canvas width and difficulty
export function createAsteroid(canvasWidth, canvasHeight = 600, difficulty = 0, rng = Math.random) {
  const r = 18 + rng() * 28 + Math.min(12, difficulty * 1.2); // size grows slightly with difficulty
  const x = rng() * (canvasWidth - r * 2) + r;
  const y = -r - rng() * 80;
  const baseSpeed = 1.6 + rng() * 1.2;
  const speedY = baseSpeed + difficulty * 0.38 + rng() * 0.6;
  const speedX = (rng() - 0.5) * (1.2 + difficulty * 0.18);
  const rotation = rng() * Math.PI * 2;
  const rotationSpeed = (rng() - 0.5) * 0.06;
  const sides = 7 + Math.floor(rng() * 5);
  const irregularity = 0.18 + rng() * 0.22;
  const vertices = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const scale = 1 - irregularity * rng();
    vertices.push({ angle, scale });
  }
  return { x, y, r, speedX, speedY, rotation, rotationSpeed, sides, vertices, irregularity, hp: 1 };
}

export function getSpawnInterval(difficulty, base = 900, min = 220) {
  // difficulty 0 => 900ms, each level -65ms
  return Math.max(min, base - difficulty * 65);
}

export function getAsteroidSpeedMultiplier(difficulty) {
  return 1 + difficulty * 0.07;
}

// Difficulty level from score: every 800 points = +1 level, max 20
export function getDifficulty(score) {
  return Math.min(20, Math.floor(score / 800));
}

// Score tick: 1 point per ~16ms scaled, plus bonus per asteroid dodged
export function addScore(score, deltaMs) {
  // 10 points per second baseline
  return score + deltaMs * 0.06;
}

export function isOutOfBounds(obj, canvasWidth, canvasHeight, margin = 80) {
  return obj.y - obj.r > canvasHeight + margin || obj.x + obj.r < -margin || obj.x - obj.r > canvasWidth + margin;
}

// Pure game logic for unit testing — no Three.js dependency
export function createState() {
  return {
    distance: 0,
    maxDistance: 140,
    speed: 12,
    baseSpeed: 12,
    lane: 1, // 0 left,1 center,2 right
    x: 0,
    z: 0,
    hp: 100,
    relics: 0,
    won: false,
    lost: false,
    time: 0,
    obstaclesHit: 0,
    nextObstacleZ: 15,
  };
}

export function moveLane(state, dir) {
  const next = Math.max(0, Math.min(2, state.lane + dir));
  state.lane = next;
  state.x = (next - 1) * 2.2;
  return state.lane;
}

export function takeDamage(state, amount = 34) {
  state.hp = Math.max(0, state.hp - amount);
  state.obstaclesHit += 1;
  if (state.hp <= 0) state.lost = true;
  return state.hp;
}

export function checkWin(state) {
  if (state.distance >= state.maxDistance && !state.lost) {
    state.won = true;
    state.relics = 1;
  }
  return state.won;
}

export function updateDistance(state, dt) {
  if (state.won || state.lost) return state.distance;
  state.time += dt;
  // slight acceleration over time
  state.speed = state.baseSpeed + Math.min(10, state.time * 0.35);
  state.distance += state.speed * dt;
  state.z = -state.distance;
  checkWin(state);
  return state.distance;
}

export function isColliding(playerX, playerZ, obsX, obsZ, radius = 1.05) {
  const dx = playerX - obsX;
  const dz = playerZ - obsZ;
  return Math.sqrt(dx * dx + dz * dz) < radius;
}

export function formatSpeed(speed) {
  return Math.round(speed * 3.6);
}

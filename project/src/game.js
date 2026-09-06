export const CONFIG = {
  canvasW: 520,
  canvasH: 760,
  playerW: 26,
  playerH: 26,
  playerY: 640,
  baseSpeed: 2.2,
  speedStep: 0.35,
  gateHeight: 38,
  gapMin: 98,
  gapMax: 168,
  gateSpacing: 170,
  lives: 3,
  gatesPerLevel: 10,
};

export function createInitialState() {
  return {
    score: 0,
    best: Number(localStorage.getItem('gg_best') || 0),
    level: 1,
    lives: CONFIG.lives,
    speed: CONFIG.baseSpeed,
    playerX: CONFIG.canvasW / 2,
    targetX: CONFIG.canvasW / 2,
    gates: [],
    particles: [],
    streak: 0,
    bestStreak: 0,
    gateCount: 0,
    distance: 0,
    status: 'start', // start | playing | paused | over
    shake: 0,
  };
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function spawnGate(y, gap, gapX) {
  return { y, gap, gapX, passed: false, hit: false };
}

/**
 * Generate gate gap position deterministically-ish
 * @param {number} prevGapX
 */
export function nextGapX(prevGapX, gap) {
  const margin = 60 + gap/2;
  const min = margin;
  const max = CONFIG.canvasW - margin;
  // jitter within ±110
  let nx = prevGapX + (Math.random()*2-1)*110;
  // keep within bounds and avoid extreme jumps sometimes smooth
  if (Math.random() < 0.2) nx = min + Math.random()*(max-min);
  return clamp(nx, min, max);
}

export function checkCollision(playerX, gate) {
  const half = CONFIG.playerW/2 + 2;
  const playerL = playerX - half;
  const playerR = playerX + half;
  const gapL = gate.gapX - gate.gap/2;
  const gapR = gate.gapX + gate.gap/2;
  // collision if player extends outside gap when gate overlaps player Y
  return playerR < gapL + 2 || playerL > gapR - 2;
}

export function updatePlayer(state, dt) {
  const diff = state.targetX - state.playerX;
  // lerp with speed dependent
  const k = 1 - Math.pow(0.001, dt/16);
  state.playerX += diff * k * 0.55;
  state.playerX = clamp(state.playerX, 18, CONFIG.canvasW-18);
}

export function levelFromGates(gateCount) {
  return Math.floor(gateCount / CONFIG.gatesPerLevel) + 1;
}

export function gapForLevel(level) {
  const t = clamp((level-1)/6, 0, 1);
  return CONFIG.gapMax - t*(CONFIG.gapMax - CONFIG.gapMin);
}

export function speedForLevel(level) {
  return CONFIG.baseSpeed + (level-1)*CONFIG.speedStep;
}

// Expose to window for testing / render_game_to_text
export function renderGameToText(state) {
  return `score:${state.score} lives:${state.lives} level:${state.level} gates:${state.gateCount} speed:${state.speed.toFixed(2)} status:${state.status}`;
}

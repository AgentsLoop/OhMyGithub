// scoring.js – pure scoring / combo / level logic

export function createScoreState() {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    delivered: 0,
    failed: 0,
    lastScoreTime: 0,
  };
}

export const COMBO_WINDOW_MS = 2500;
export const BASE_POINTS = 100;
export const COMBO_BONUS_PER = 25; // per combo extra

export function pointsForDelivery(comboBefore) {
  // combo = number of consecutive successes before this one. New combo = comboBefore +1
  // points = base + bonus * comboBefore
  const combo = comboBefore + 1;
  const multiplier = 1 + (combo - 1) * 0.5; // 1,1.5,2,2.5...
  // alternative: base + bonus per combo
  return Math.round(BASE_POINTS * multiplier);
  // e.g. combo1=100, combo2=150, combo3=200
}

export function onDelivered(state, nowMs) {
  const withinWindow = nowMs - state.lastScoreTime <= COMBO_WINDOW_MS;
  const comboBefore = withinWindow ? state.combo : 0;
  const pts = pointsForDelivery(comboBefore);
  const newCombo = comboBefore + 1;
  return {
    ...state,
    score: state.score + pts,
    combo: newCombo,
    maxCombo: Math.max(state.maxCombo, newCombo),
    delivered: state.delivered + 1,
    lastScoreTime: nowMs,
    pointsEarned: pts,
  };
}

export function onFailed(state) {
  return {
    ...state,
    combo: 0,
    failed: state.failed + 1,
  };
}

export function shouldDecayCombo(state, nowMs) {
  return state.combo > 0 && nowMs - state.lastScoreTime > COMBO_WINDOW_MS;
}

export function tickCombo(state, nowMs) {
  if (shouldDecayCombo(state, nowMs)) return { ...state, combo: 0 };
  return state;
}

// Level config
export const LEVELS = [
  { id: 1, name: 'Ignition', gridW: 5, gridH: 5, time: 45, goal: 6, pulseInterval: 1800, pulseSpeed: 220, colors: 2 },
  { id: 2, name: 'Prism', gridW: 6, gridH: 5, time: 50, goal: 9, pulseInterval: 1500, pulseSpeed: 240, colors: 2 },
  { id: 3, name: 'Relay', gridW: 6, gridH: 6, time: 55, goal: 12, pulseInterval: 1300, pulseSpeed: 260, colors: 3 },
  { id: 4, name: 'Spectrum', gridW: 7, gridH: 6, time: 60, goal: 15, pulseInterval: 1100, pulseSpeed: 280, colors: 3 },
  { id: 5, name: 'Nova', gridW: 7, gridH: 7, time: 60, goal: 20, pulseInterval: 900, pulseSpeed: 300, colors: 3 },
];

export function getLevel(idx) {
  return LEVELS[Math.min(idx, LEVELS.length - 1)];
}

export function isLevelCleared(delivered, level) {
  return delivered >= level.goal;
}

export function timeLeft(level, elapsedSec) {
  return Math.max(0, level.time - elapsedSec);
}

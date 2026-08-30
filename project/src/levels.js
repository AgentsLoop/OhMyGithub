// levels.js – level grid generation
import { createCell, JUNCTION_TYPES, DIRS } from './routing.js';

function rng(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const J_TYPES = [JUNCTION_TYPES.STRAIGHT, JUNCTION_TYPES.ELBOW, JUNCTION_TYPES.TEE];

export function generateLevel(levelIdx, seed = Date.now()) {
  const rnd = rng(seed + levelIdx * 9991);
  const map = {
    0: { w: 5, h: 5 },
    1: { w: 6, h: 5 },
    2: { w: 6, h: 6 },
    3: { w: 7, h: 6 },
    4: { w: 7, h: 7 },
  };
  const { w, h } = map[Math.min(levelIdx, 4)];
  // Build grid
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      // borders: emitters on top, receivers on bottom
      if (y === 0 && (x === 1 || x === w - 2)) {
        const color = x === 1 ? 'cyan' : 'magenta';
        // if 3 colors level, middle emitter amber
        return createCell({ kind: 'emitter', color, dir: DIRS.S });
      }
      if (y === h - 1 && (x === 1 || x === w - 2)) {
        const color = x === 1 ? 'cyan' : 'magenta';
        return createCell({ kind: 'receiver', color, dir: DIRS.N });
      }
      if (levelIdx >= 2 && y === 0 && x === Math.floor(w / 2)) {
        return createCell({ kind: 'emitter', color: 'amber', dir: DIRS.S });
      }
      if (levelIdx >= 2 && y === h - 1 && x === Math.floor(w / 2)) {
        return createCell({ kind: 'receiver', color: 'amber', dir: DIRS.N });
      }
      // interior: random junction, tuned for escalation
      // Blocks only on higher levels, scaling with difficulty
      if (levelIdx >= 3 && rnd() < (levelIdx === 3 ? 0.07 : 0.10)) {
        return createCell({ type: JUNCTION_TYPES.BLOCK, kind: 'junction' });
      }
      // Level 1 favors straights for gentler onboarding; later levels mix evenly
      let t;
      if (levelIdx === 0) {
        const r = rnd();
        t = r < 0.5 ? JUNCTION_TYPES.STRAIGHT : r < 0.8 ? JUNCTION_TYPES.ELBOW : JUNCTION_TYPES.TEE;
      } else if (levelIdx === 1) {
        const r = rnd();
        t = r < 0.35 ? JUNCTION_TYPES.STRAIGHT : r < 0.70 ? JUNCTION_TYPES.ELBOW : JUNCTION_TYPES.TEE;
      } else {
        t = J_TYPES[Math.floor(rnd() * J_TYPES.length)];
      }
      const rot = Math.floor(rnd() * 4);
      return createCell({ type: t, rotation: rot, kind: 'junction' });
    })
  );
  // Ensure level 1 has at least one guaranteed vertical corridor so it's completable in 45s
  // For level 0, carve straight N-S path under each emitter for immediate solvability, then apply small random jitter
  if (levelIdx === 0) {
    // 30% chance to keep carved path pristine, else jitter one cell to keep puzzle interesting but still solvable with 1 rotation
    const jitter = rnd() < 0.3 ? -1 : Math.floor(rnd() * (h - 2)) + 1;
    for (const x of [1, w - 2]) {
      for (let y = 1; y < h - 1; y++) {
        if (y === jitter) continue; // leave one elbow/tee for player to fix
        grid[y][x] = createCell({ type: JUNCTION_TYPES.STRAIGHT, rotation: 0, kind: 'junction' });
      }
      if (jitter >= 1 && jitter < h - 1) {
        // ensure jitter cell is at worst one rotation away
        const r = Math.floor(rnd() * 2); // 0 or 1 -> either correct or one turn away
        grid[jitter][x] = createCell({ type: JUNCTION_TYPES.STRAIGHT, rotation: r, kind: 'junction' });
      }
    }
  }
  // On small grid ensure emitters/receivers not overwritten
  return grid;
}

// For deterministic tests
export function makeSimpleGrid() {
  // 3x3 with cyan emitter top middle, receiver bottom middle
  const grid = [
    [null, createCell({ kind: 'emitter', color: 'cyan', dir: DIRS.S }), null],
    [createCell({ type: JUNCTION_TYPES.STRAIGHT, rotation: 0 }), createCell({ type: JUNCTION_TYPES.STRAIGHT, rotation: 0 }), createCell({ type: JUNCTION_TYPES.ELBOW, rotation: 1 })],
    [null, createCell({ kind: 'receiver', color: 'cyan', dir: DIRS.N }), null],
  ];
  return grid;
}

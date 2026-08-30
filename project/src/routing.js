// routing.js – pure logic for Prism Relay junctions and pulse pathing. Testable, no DOM.

export const DIRS = {
  N: 0, E: 1, S: 2, W: 3,
};
export const DIR_VECTORS = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
];
export const COLORS = ['cyan', 'magenta', 'amber']; // amber = yellow
export const COLOR_HEX = { cyan: '#00e5ff', magenta: '#ff2d95', amber: '#ffb700' };

export const JUNCTION_TYPES = {
  STRAIGHT: 'straight', // connects opposite sides
  ELBOW: 'elbow',       // 90° bend
  TEE: 'tee',           // 3-way
  CROSS: 'cross',       // 4-way
  BLOCK: 'block',       // impassable
};

export function baseConnections(type) {
  // connections at rotation 0 (0= N)
  switch (type) {
    case JUNCTION_TYPES.STRAIGHT: return [DIRS.N, DIRS.S];
    case JUNCTION_TYPES.ELBOW: return [DIRS.N, DIRS.E];
    case JUNCTION_TYPES.TEE: return [DIRS.N, DIRS.E, DIRS.S];
    case JUNCTION_TYPES.CROSS: return [DIRS.N, DIRS.E, DIRS.S, DIRS.W];
    case JUNCTION_TYPES.BLOCK: return [];
    default: return [];
  }
}

export function rotatedConnections(type, rotation) {
  const r = ((rotation % 4) + 4) % 4;
  return baseConnections(type).map(d => (d + r) % 4);
}

export function hasConnection(cell, dir) {
  if (!cell) return false;
  // emitters/receivers are special: they connect only toward the grid interior
  // but for routing we treat them as having that direction
  if (cell.kind === 'emitter' || cell.kind === 'receiver') {
    return cell.dir === dir;
  }
  const conns = rotatedConnections(cell.type, cell.rotation);
  return conns.includes(dir);
}

export function opposite(dir) { return (dir + 2) % 4; }

export function createCell({ type = JUNCTION_TYPES.ELBOW, rotation = 0, kind = 'junction', color = null, dir = null } = {}) {
  return { type, rotation: ((rotation %4)+4)%4, kind, color, dir };
}

export function rotateCell(cell, steps = 1) {
  if (cell.kind !== 'junction') return cell;
  if (cell.type === JUNCTION_TYPES.CROSS || cell.type === JUNCTION_TYPES.BLOCK) return cell;
  return { ...cell, rotation: ((cell.rotation + steps) % 4 + 4) % 4 };
}

// Grid helpers: grid[y][x] = cell or null
export function inBounds(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
}

export function neighbor(grid, x, y, dir) {
  const [dx, dy] = DIR_VECTORS[dir];
  const nx = x + dx, ny = y + dy;
  if (!inBounds(grid, nx, ny)) return null;
  return { cell: grid[ny][nx], x: nx, y: ny };
}

// Simulate one pulse step through grid; returns { status: 'moving'|'delivered'|'failed' , nextX,nextY, entryDir }
export function stepPulse(grid, pulse) {
  // pulse: { x,y, dir, color }
  const { x, y, dir, color } = pulse;
  const cur = grid[y]?.[x];
  // If currently on receiver, check color
  if (cur && cur.kind === 'receiver') {
    if (cur.color === color) return { status: 'delivered', x, y };
    return { status: 'failed', reason: 'color-mismatch', x, y };
  }
  // Next cell
  const [dx, dy] = DIR_VECTORS[dir];
  const nx = x + dx, ny = y + dy;
  if (!inBounds(grid, nx, ny)) return { status: 'failed', reason: 'out-of-bounds', x: nx, y: ny };
  const next = grid[ny][nx];
  if (!next) return { status: 'failed', reason: 'void', x: nx, y: ny };
  if (next.type === JUNCTION_TYPES.BLOCK) return { status: 'failed', reason: 'blocked', x: nx, y: ny };

  const entryDir = opposite(dir);
  // Need next cell to accept entry
  if (!hasConnection(next, entryDir)) return { status: 'failed', reason: 'no-entry', x: nx, y: ny };

  // If next is receiver or emitter with matching dir check already done, deliver check next step
  if (next.kind === 'receiver') {
    // will be checked on next step; but we can immediately check if we want
    if (next.color === color) return { status: 'delivered', x: nx, y: ny };
    return { status: 'failed', reason: 'color-mismatch', x: nx, y: ny };
  }

  // For junction, figure exit direction (must be different from entry)
  if (next.kind === 'junction') {
    const conns = rotatedConnections(next.type, next.rotation);
    const exits = conns.filter(d => d !== entryDir);
    if (exits.length === 0) return { status: 'failed', reason: 'dead-end', x: nx, y: ny };
    // For straight/elbow, one exit; for tee/cross, choose deterministic: prefer straight through, else smallest dir
    let exitDir;
    if (exits.length === 1) exitDir = exits[0];
    else {
      // Prefer opposite if available, else clockwise preference
      if (exits.includes(opposite(entryDir))) exitDir = opposite(entryDir);
      else exitDir = exits[0];
    }
    return { status: 'moving', x: nx, y: ny, dir: exitDir, color };
  }
  return { status: 'failed', reason: 'unknown', x: nx, y: ny };
}

// Trace full path from emitter until termination, with loop detection
export function tracePath(grid, startX, startY, startDir, color, maxSteps = 100) {
  let x = startX, y = startY, dir = startDir;
  const path = [{ x, y, dir }];
  const visited = new Set();
  for (let i = 0; i < maxSteps; i++) {
    const key = `${x},${y},${dir}`;
    if (visited.has(key)) return { status: 'failed', reason: 'loop', path };
    visited.add(key);
    const res = stepPulse(grid, { x, y, dir, color });
    if (res.status === 'delivered') {
      path.push({ x: res.x, y: res.y, dir });
      return { status: 'delivered', path, deliveredAt: { x: res.x, y: res.y } };
    }
    if (res.status === 'failed') {
      path.push({ x: res.x, y: res.y, dir, failed: true, reason: res.reason });
      return { status: 'failed', reason: res.reason, path };
    }
    // moving
    x = res.x; y = res.y; dir = res.dir;
    path.push({ x, y, dir });
  }
  return { status: 'failed', reason: 'max-steps', path };
}

export function isConnected(grid, fromX, fromY, fromDir, toX, toY) {
  const a = grid[fromY]?.[fromX];
  const b = grid[toY]?.[toX];
  if (!a || !b) return false;
  // Check a has fromDir and b has opposite
  return hasConnection(a, fromDir) && hasConnection(b, opposite(fromDir));
}

// Utility to create empty grid
export function makeGrid(w, h, fill = null) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

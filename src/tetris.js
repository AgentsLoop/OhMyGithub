// Pure Tetris game logic, no DOM dependencies. Deterministic when an RNG is injected.

export const COLS = 10;
export const ROWS = 20;

export const PIECES = {
  I: { cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#31c4f3' },
  J: { cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#4f68ff' },
  L: { cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f39b26' },
  O: { cells: [[1, 1], [1, 1]], color: '#f3d323' },
  S: { cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#5ec93e' },
  T: { cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#a957eb' },
  Z: { cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#ef4f4f' },
};

export const PIECE_TYPES = Object.keys(PIECES);

// Points per simultaneous line clear, multiplied by level.
export const LINE_SCORES = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };
export const SOFT_DROP_SCORE = 1;
export const HARD_DROP_SCORE = 2;
export const LINES_PER_LEVEL = 10;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyBoard(rows = ROWS, cols = COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function rotateMatrixCW(matrix) {
  const n = matrix.length;
  return matrix.map((row, y) => row.map((_, x) => matrix[n - 1 - x][y]));
}

export function rotateCW(cells) {
  return rotateMatrixCW(cells);
}

export function collides(board, piece, x = piece.x, y = piece.y, cells = piece.cells) {
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const bx = x + c;
      const by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

// Standard-ish wall kicks: try the original spot then sidesteps.
const KICK_OFFSETS = [0, -1, 1, -2, 2];

function shuffledBag(random) {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function createGame({ random = Math.random } = {}) {
  const state = {
    board: emptyBoard(),
    active: null,
    nextType: null,
    score: 0,
    lines: 0,
    level: 1,
    status: 'idle', // idle | running | paused | over
    _random: random,
    _bag: [],
  };
  refillBag(state);
  state.nextType = drawFromBag(state);
  spawnNext(state);
  return state;
}

function refillBag(state) {
  while (state._bag.length < PIECE_TYPES.length) {
    state._bag.push(...shuffledBag(state._random));
  }
}

function drawFromBag(state) {
  if (!state._bag.length) refillBag(state);
  return state._bag.shift();
}

export function spawnNext(state) {
  const type = state.nextType ?? drawFromBag(state);
  state.nextType = drawFromBag(state);
  refillBag(state);
  const def = PIECES[type];
  const piece = {
    type,
    cells: def.cells.map((row) => [...row]),
    x: Math.floor((COLS - def.cells[0].length) / 2),
    y: type === 'I' ? -1 : 0,
  };
  state.active = piece;
  // Game over: a fresh piece overlaps settled blocks immediately.
  if (collides(state.board, piece)) {
    state.status = 'over';
  }
  return state.active;
}

export function move(state, dx, dy) {
  if (state.status !== 'running' || !state.active) return false;
  const { active } = state;
  if (!collides(state.board, active, active.x + dx, active.y + dy)) {
    active.x += dx;
    active.y += dy;
    return true;
  }
  return false;
}

export function moveLeft(state) {
  return move(state, -1, 0);
}

export function moveRight(state) {
  return move(state, 1, 0);
}

// Soft drop: returns true when the piece actually descended.
export function softDrop(state) {
  if (state.status !== 'running' || !state.active) return false;
  if (move(state, 0, 1)) {
    state.score += SOFT_DROP_SCORE;
    return true;
  }
  lockPiece(state);
  return false;
}

// Hard drop: slam to the landing position, award points, lock.
export function hardDrop(state) {
  if (state.status !== 'running' || !state.active) return 0;
  let cells = 0;
  while (move(state, 0, 1)) cells++;
  state.score += cells * HARD_DROP_SCORE;
  lockPiece(state);
  return cells;
}

export function tryRotate(state) {
  if (state.status !== 'running' || !state.active) return false;
  const { active } = state;
  const rotated = rotateCW(active.cells);
  for (const offset of KICK_OFFSETS) {
    if (!collides(state.board, active, active.x + offset, active.y, rotated)) {
      active.cells = rotated;
      active.x += offset;
      return true;
    }
  }
  return false;
}

function mergePiece(state) {
  const { cells, x, y, type } = state.active;
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!cells[r][c]) continue;
      const by = y + r;
      const bx = x + c;
      if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
        state.board[by][bx] = type;
      }
    }
  }
}

function findFullRows(board) {
  const rows = [];
  for (let r = 0; r < board.length; r++) {
    if (board[r].every(Boolean)) rows.push(r);
  }
  return rows;
}

function clearLines(state) {
  const fullRows = findFullRows(state.board).sort((a, b) => a - b);
  for (const row of fullRows) {
    state.board.splice(row, 1);
    state.board.unshift(Array(COLS).fill(null));
  }
  if (fullRows.length) {
    state.lines += fullRows.length;
    state.score += LINE_SCORES[fullRows.length] * state.level;
    state.level = Math.floor(state.lines / LINES_PER_LEVEL) + 1;
  }
  return fullRows.length;
}

export function lockPiece(state) {
  if (!state.active) return;
  mergePiece(state);
  clearLines(state);
  spawnNext(state);
}

// One gravity step; locks and spawns when the piece cannot descend.
export function tick(state) {
  if (state.status !== 'running') return false;
  if (move(state, 0, 1)) return true;
  lockPiece(state);
  return false;
}

export function start(state) {
  if (state.status === 'over' || state.status === 'idle') restart(state);
  state.status = 'running';
  return state;
}

export function pause(state) {
  if (state.status === 'running') state.status = 'paused';
  else if (state.status === 'paused') state.status = 'running';
  return state;
}

export function restart(state) {
  state.board = emptyBoard();
  state.score = 0;
  state.lines = 0;
  state.level = 1;
  state.status = 'running';
  state._bag = [];
  refillBag(state);
  state.nextType = drawFromBag(state);
  spawnNext(state);
  return state;
}

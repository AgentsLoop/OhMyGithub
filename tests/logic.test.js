import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS, ROWS,
  createGame, restart, moveLeft, moveRight, softDrop, hardDrop,
  tryRotate, tick, collides, mulberry32,
} from '../src/tetris.js';

const seeded = (seed = 42) => ({ random: mulberry32(seed) });

function filledColumnOffsets(piece) {
  const offsets = [];
  piece.cells.forEach((row, r) => row.forEach((cell, c) => { if (cell) offsets.push(c); }));
  return offsets;
}

function setActive(state, type, cells, x, y) {
  state.active = { type, cells, x, y };
}

test('createGame starts with an empty board and fresh stats', () => {
  const game = createGame(seeded());
  assert.equal(game.board.length, ROWS);
  assert.ok(game.board.every((row) => row.length === COLS && row.every((cell) => cell === null)));
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.status, 'idle');
  assert.ok(game.active);
  assert.ok(game.nextType);
});

test('pieces spawn horizontally centered at the top', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const game = createGame({ random: mulberry32(seed) });
    const width = game.active.cells[0].length;
    assert.equal(game.active.x, Math.floor((COLS - width) / 2));
    assert.ok(game.active.y <= 0);
  }
});

test('moveLeft and moveRight shift the piece and respect walls', () => {
  const game = createGame(seeded());
  game.status = 'running';
  const startX = game.active.x;
  assert.equal(moveLeft(game), true);
  assert.equal(game.active.x, startX - 1);

  // Slam into the left wall.
  for (let i = 0; i < COLS + 5; i++) moveLeft(game);
  let minCol = Math.min(...filledColumnOffsets(game.active));
  assert.ok(game.active.x + minCol >= 0);

  // Slam into the right wall.
  for (let i = 0; i < COLS * 2 + 5; i++) moveRight(game);
  minCol = Math.min(...filledColumnOffsets(game.active));
  const maxCol = Math.max(...filledColumnOffsets(game.active));
  assert.ok(game.active.x + minCol >= 0);
  assert.ok(game.active.x + maxCol <= COLS - 1);
});

test('rotation changes piece orientation with wall kicks', () => {
  let seed = 0;
  let game;
  do {
    game = createGame({ random: mulberry32(seed++) });
  } while (game.active.type !== 'J');
  game.status = 'running';
  const before = JSON.stringify(game.active.cells);
  for (let i = 0; i < COLS; i++) moveRight(game);
  assert.equal(tryRotate(game), true, 'J rotates against an empty-board wall via kicks');
  assert.notEqual(JSON.stringify(game.active.cells), before);
  const inBounds = game.active.cells.every((row, r) =>
    row.every((cell, c) => !cell || (game.active.x + c >= 0 && game.active.x + c < COLS)),
  );
  assert.ok(inBounds, 'rotated piece must stay inside the board');
});

test('soft drop moves the piece down one row', () => {
  const game = createGame(seeded());
  game.status = 'running';
  const startY = game.active.y;
  assert.equal(softDrop(game), true);
  assert.equal(game.active.y, startY + 1);
});

test('tick applies gravity and eventually locks pieces', () => {
  const game = createGame(seeded());
  game.status = 'running';
  const firstType = game.active.type;
  let locked = false;
  for (let i = 0; i < ROWS * 3 && !locked; i++) {
    tick(game);
    if (game.board.some((row) => row.some(Boolean))) locked = true;
  }
  assert.equal(locked, true, 'gravity settles the first piece within a few ticks');
  assert.ok(game.board.flat().filter(Boolean).length > 0);
});

test('hard drop lands instantly and awards two points per cell', () => {
  const game = createGame(seeded());
  game.status = 'running';
  const bottomRowOfPiece = Math.max(
    ...game.active.cells.flatMap((row, r) => row.map((v) => (v ? r : -1))),
  );
  const expectedCells = ROWS - (game.active.y + bottomRowOfPiece) - 1;
  const scoreBefore = game.score;
  const dropped = hardDrop(game);
  assert.equal(dropped, expectedCells);
  assert.equal(game.score, scoreBefore + dropped * 2);
});

test('clearing a full row removes it, shifts rows down and scores', () => {
  const game = createGame(seeded());
  game.status = 'running';
  for (let x = 0; x < COLS; x++) game.board[ROWS - 1][x] = x === 4 ? null : 'O';
  setActive(game, 'I', [[1], [1], [1], [1]], 4, 0); // vertical I fills the single gap
  const scoreBefore = game.score;
  const dropped = hardDrop(game);
  // Bottom row cleared; the remaining three I cells shifted down by one.
  assert.equal(game.board[ROWS - 4][4], null);
  assert.equal(game.board[ROWS - 3][4], 'I');
  assert.equal(game.board[ROWS - 2][4], 'I');
  assert.equal(game.board[ROWS - 1][4], 'I');
  assert.ok(game.board[ROWS - 1].every((c, i) => (i === 4 ? c === 'I' : c === null)));
  assert.equal(game.lines, 1);
  assert.equal(dropped, ROWS - 4);
  assert.equal(game.score, scoreBefore + 100 + dropped * 2);
});

test('level rises every ten lines', () => {
  const game = createGame(seeded());
  game.status = 'running';
  for (let clears = 0; clears < 10; clears++) {
    // Reset everything above the floor so leftovers never block the next drop.
    for (let y = 0; y < ROWS - 1; y++) game.board[y] = Array(COLS).fill(null);
    for (let x = 0; x < COLS; x++) game.board[ROWS - 1][x] = x === 4 ? null : 'O';
    setActive(game, 'I', [[1], [1], [1], [1]], 4, 0);
    hardDrop(game);
    assert.equal(game.status, 'running');
  }
  assert.equal(game.lines, 10);
  assert.equal(game.level, 2);
});

test('double clear awards 300 times level', () => {
  const game = createGame(seeded());
  game.status = 'running';
  for (let y = ROWS - 2; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) game.board[y][x] = x === 4 ? null : 'O';
  }
  setActive(game, 'I', [[1], [1], [1], [1]], 4, 0);
  const scoreBefore = game.score;
  const dropped = hardDrop(game);
  assert.equal(game.lines, 2);
  assert.equal(dropped, ROWS - 4);
  assert.equal(game.score, scoreBefore + 300 + dropped * 2);
});

test('game over triggers when the stack reaches the top', () => {
  const game = createGame(seeded());
  game.status = 'running';
  // Tower of rows 0..15, each missing exactly one column so no row is ever
  // complete (a complete tower would clear itself instead of ending the game).
  for (let y = 0; y <= 15; y++) {
    for (let x = 0; x < COLS; x++) {
      game.board[y][x] = x === y % COLS ? null : 'Z';
    }
  }
  setActive(game, 'O', [[1, 1], [1, 1]], 4, 0);
  hardDrop(game); // locks mid-tower, clears nothing, next spawn collides
  assert.equal(game.status, 'over');
});

test('restart resets board, score and status', () => {
  const game = createGame(seeded());
  game.status = 'running';
  hardDrop(game);
  game.score += 500;
  assert.ok(game.score > 0);
  restart(game);
  assert.equal(game.score, 0);
  assert.equal(game.lines, 0);
  assert.equal(game.level, 1);
  assert.equal(game.status, 'running');
  assert.ok(game.board.every((row) => row.every((cell) => cell === null)));
});

test('collides detects floor, wall and stack overlaps', () => {
  const game = createGame(seeded());
  const piece = game.active;
  assert.equal(collides(game.board, piece, piece.x, ROWS), true, 'below floor');

  const maxCol = Math.max(...filledColumnOffsets(piece));
  assert.equal(collides(game.board, piece, COLS - maxCol, piece.y), true, 'past right wall');

  game.board[5][piece.x] = 'T';
  const lowestRowOfPiece = Math.max(
    ...piece.cells.flatMap((row, r) => row.map((v) => (v ? r : -1))),
  );
  assert.equal(collides(game.board, piece, piece.x, 5 - lowestRowOfPiece), true, 'overlap with settled block');
});

test('moves are ignored when the game is not running', () => {
  const game = createGame(seeded());
  assert.equal(game.status, 'idle');
  const y = game.active.y;
  assert.equal(softDrop(game), false);
  assert.equal(moveLeft(game), false);
  assert.equal(hardDrop(game), 0);
  assert.equal(tick(game), false);
  assert.equal(game.active.y, y);
});

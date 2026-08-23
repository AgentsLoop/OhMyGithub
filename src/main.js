import {
  COLS, ROWS, PIECES, LINES_PER_LEVEL,
  createGame, start as startGame, pause as pauseGame, restart as restartGame,
  moveLeft, moveRight, softDrop, hardDrop, tryRotate, tick,
} from './tetris.js';

const CELL = 30;
const boardCanvas = document.getElementById('board');
const nextCanvas = document.getElementById('next');
const ctx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');

let game = createGame();
let dropTimer = null;

function gravityMs(level) {
  return Math.max(120, 800 - (level - 1) * 70);
}

function drawCell(context, x, y, color, size = CELL, offsetY = 0) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, (y + offsetY) * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.25)';
  context.fillRect(x * size + 1, (y + offsetY) * size + 1, size - 2, 4);
}

function render() {
  ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const type = game.board[y][x];
      if (type) drawCell(ctx, x, y, PIECES[type].color);
    }
  }
  if (game.active && game.status !== 'over') {
    const { cells, x, y } = game.active;
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (!cells[r][c]) continue;
        if (y + r >= 0) drawCell(ctx, x + c, y + r, PIECES[game.active.type].color);
      }
    }
  }

  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (game.nextType) {
    const def = PIECES[game.nextType];
    const size = 20;
    const offsetX = Math.floor((nextCanvas.width / size - def.cells[0].length) / 2);
    const offsetY = Math.floor((nextCanvas.height / size - def.cells.length) / 2);
    for (let r = 0; r < def.cells.length; r++) {
      for (let c = 0; c < def.cells[r].length; c++) {
        if (def.cells[r][c]) drawCell(nextCtx, offsetX + c, offsetY + r, def.color, size);
      }
    }
  }

  scoreEl.textContent = String(game.score);
  linesEl.textContent = String(game.lines);
  levelEl.textContent = String(game.level);
}

function showOverlay(text) {
  overlayText.textContent = text;
  overlay.classList.add('visible');
}

function hideOverlay() {
  overlay.classList.remove('visible');
}

function syncControls() {
  pauseBtn.disabled = game.status !== 'running' && game.status !== 'paused';
  pauseBtn.textContent = game.status === 'paused' ? 'Resume' : 'Pause';
  startBtn.disabled = game.status === 'running';
}

function scheduleGravity() {
  clearInterval(dropTimer);
  dropTimer = setInterval(() => {
    tick(game);
    render();
    syncControls();
    if (game.status === 'over') onGameOver();
  }, gravityMs(game.level));
}

function onGameOver() {
  clearInterval(dropTimer);
  dropTimer = null;
  showOverlay(`Game Over — ${game.score}`);
  syncControls();
}

function beginRun() {
  hideOverlay();
  scheduleGravity();
  syncControls();
}

function handleStart() {
  startGame(game);
  beginRun();
}

function handlePause() {
  pauseGame(game);
  if (game.status === 'paused') {
    clearInterval(dropTimer);
    dropTimer = null;
    showOverlay('Paused');
  } else if (game.status === 'running') {
    hideOverlay();
    scheduleGravity();
  }
  syncControls();
}

function handleRestart() {
  restartGame(game);
  beginRun();
}

startBtn.addEventListener('click', handleStart);
pauseBtn.addEventListener('click', handlePause);
restartBtn.addEventListener('click', handleRestart);

document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' || event.key === 'Enter') {
    if (game.status === 'idle') handleStart();
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    handleRestart();
    return;
  }
  if (event.key === 'p' || event.key === 'P') {
    handlePause();
    return;
  }
  if (game.status !== 'running') return;
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      moveLeft(game);
      break;
    case 'ArrowRight':
      event.preventDefault();
      moveRight(game);
      break;
    case 'ArrowDown':
      event.preventDefault();
      softDrop(game);
      break;
    case 'ArrowUp':
      event.preventDefault();
      tryRotate(game);
      break;
    case ' ':
      event.preventDefault();
      hardDrop(game);
      break;
    default:
      return;
  }
  render();
  syncControls();
  if (game.status === 'over') onGameOver();
});

render();
syncControls();

// Hook used by automated browser tests.
window.__tetris = { get state() { return game; } };

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serve the project root (this file lives in tests/).
const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

async function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const filePath = normalize(join(root, pathname));
      if (!filePath.startsWith(root)) throw new Error('forbidden');
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

test('browser app starts, plays, pauses and restarts', async () => {
  const { server, url } = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  try {
    await page.goto(url);

    // Initial idle state: overlay shown, zeroed stats.
    await page.waitForSelector('#overlay.visible');
    assert.equal(await page.textContent('#score'), '0');
    const initialState = await page.evaluate(() => ({
      status: window.__tetris.state.status,
      rows: window.__tetris.state.board.length,
    }));
    assert.equal(initialState.status, 'idle');
    assert.equal(initialState.rows, 20);

    // Start the game via the button.
    await page.click('#start-btn');
    await page.waitForFunction(() => window.__tetris.state.status === 'running');
    assert.equal(await page.textContent('#level'), '1');

    // The active piece renders onto the canvas.
    const paintedCells = await page.evaluate(() => {
      const ctx = document.getElementById('board').getContext('2d');
      const { data } = ctx.getImageData(0, 0, 300, 600);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) painted++;
      return painted;
    });
    assert.ok(paintedCells > 100, `expected painted cells, got ${paintedCells}`);

    // Gravity: the piece descends within a couple of ticks.
    const yBefore = await page.evaluate(() => window.__tetris.state.active.y);
    await page.waitForFunction(
      (y) => window.__tetris.state.active.y > y || window.__tetris.state.score > 0,
      yBefore,
      { timeout: 5000 },
    );

    // Keyboard controls move and rotate the piece.
    const xBefore = await page.evaluate(() => window.__tetris.state.active.x);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction((x) => window.__tetris.state.active.x < x, xBefore, { timeout: 2000 });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction((x) => window.__tetris.state.active.x === x, xBefore + 1, { timeout: 2000 });

    const cellsBeforeRotate = await page.evaluate(() => JSON.stringify(window.__tetris.state.active.cells));
    const typeBeforeRotate = await page.evaluate(() => window.__tetris.state.active.type);
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction(
      ({ cells, type }) =>
        type === 'O' || JSON.stringify(window.__tetris.state.active.cells) !== cells,
      { cells: cellsBeforeRotate, type: typeBeforeRotate },
      { timeout: 2000 },
    );

    // Hard drop scores points immediately.
    await page.keyboard.press(' ');
    await page.waitForFunction(() => window.__tetris.state.score > 0, undefined, { timeout: 2000 });

    // Pause stops the run; resume returns to it.
    await page.click('#pause-btn');
    await page.waitForFunction(() => window.__tetris.state.status === 'paused');
    assert.ok(await page.locator('#overlay.visible').count());
    assert.equal(await page.textContent('#pause-btn'), 'Resume');
    await page.click('#pause-btn');
    await page.waitForFunction(() => window.__tetris.state.status === 'running');

    // Restart wipes score and keeps a clean board.
    await page.click('#restart-btn');
    await page.waitForFunction(() => window.__tetris.state.score === 0);
    const restarted = await page.evaluate(() => ({
      status: window.__tetris.state.status,
      filled: window.__tetris.state.board.flat().some(Boolean),
      hasActive: Boolean(window.__tetris.state.active),
    }));
    assert.equal(restarted.status, 'running');
    assert.equal(restarted.filled, false);
    assert.ok(restarted.hasActive);

    // No script errors surfaced anywhere along the way.
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

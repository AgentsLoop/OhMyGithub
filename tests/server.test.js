const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

describe('Star Dodger app', () => {
  it('index.html exists and contains required elements', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /Star Dodger/i);
    assert.match(html, /<canvas[^>]*id="game"/);
    assert.match(html, /id="scoreEl"/);
    assert.match(html, /id="restartBtn"/);
    assert.match(html, /Game Over/);
    assert.match(html, /ArrowLeft|ArrowRight/);
    assert.match(html, /A\/D| A /);
  });

  it('gameLogic.js exports pure functions', () => {
    const logic = require('../gameLogic');
    assert.equal(typeof logic.checkCollision, 'function');
    assert.equal(typeof logic.calculateScore, 'function');
    assert.equal(typeof logic.createAsteroid, 'function');
  });

  it('package.json has start and test scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.ok(pkg.scripts.start);
    assert.ok(pkg.scripts.test);
  });

  it('server serves index.html on random port', async () => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    const port = 3456 + Math.floor(Math.random()*1000);
    const proc = spawn('node', [serverPath, '--port', String(port)], { stdio: 'ignore' });
    // wait for server
    const html = await new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        http.get(`http://127.0.0.1:${port}/`, res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            clearInterval(timer);
            resolve(data);
          });
        }).on('error', () => {
          if (attempts > 15) {
            clearInterval(timer);
            reject(new Error('server did not start'));
          }
        });
      }, 300);
    });
    assert.match(html, /Star Dodger/);
    proc.kill();
    await new Promise(r => setTimeout(r, 300));
  });

  it('mobile responsiveness: viewport meta and flexible css', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /meta name="viewport"/);
    assert.match(html, /@media.*max-width/);
    assert.match(html, /touch-btn|touch-row/);
  });
});

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  clamp,
  checkCollision,
  updateShipPosition,
  createAsteroid,
  updateAsteroids,
  getDifficultyMultiplier,
  calculateScore,
  shouldSpawn
} = require('../gameLogic');

describe('Star Dodger logic', () => {
  it('clamp keeps value within bounds', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-2, 0, 10), 0);
    assert.equal(clamp(15, 0, 10), 10);
  });

  it('checkCollision detects overlapping rects', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, w: 10, h: 10 };
    const c = { x: 20, y: 20, w: 5, h: 5 };
    assert.equal(checkCollision(a, b), true);
    assert.equal(checkCollision(a, c), false);
    assert.equal(checkCollision(b, c), false);
  });

  it('checkCollision edge touching is not collision', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 0, w: 10, h: 10 };
    assert.equal(checkCollision(a, b), false);
  });

  it('updateShipPosition moves and clamps', () => {
    assert.equal(updateShipPosition(100, 1, 6, 0, 480), 106);
    assert.equal(updateShipPosition(100, -1, 6, 0, 480), 94);
    assert.equal(updateShipPosition(0, -1, 6, 0, 480), 0);
    assert.equal(updateShipPosition(480, 1, 6, 0, 440), 440);
  });

  it('createAsteroid creates within canvas and with valid properties', () => {
    const a = createAsteroid(520, () => 0.5);
    assert.ok(a.x >= 0 && a.x <= 520 - a.w);
    assert.ok(a.w >= 18 && a.w <= 40);
    assert.ok(a.speed > 0);
    assert.ok(['asteroid', 'star'].includes(a.type));
  });

  it('updateAsteroids moves down and filters off-screen', () => {
    const ast = [{ x: 10, y: 0, w: 20, h: 20, speed: 2, rotation: 0, rotationSpeed: 0 }];
    const out = updateAsteroids(ast, 1, 100);
    assert.equal(out[0].y > 0, true);
    const off = [{ x: 0, y: 200, w: 10, h: 10, speed: 1, rotation: 0, rotationSpeed: 0 }];
    assert.equal(updateAsteroids(off, 1, 100).length, 0);
  });

  it('getDifficultyMultiplier increases over time', () => {
    assert.equal(getDifficultyMultiplier(0), 1);
    assert.equal(getDifficultyMultiplier(9999), 1);
    assert.equal(getDifficultyMultiplier(10000), 1.15);
    assert.equal(getDifficultyMultiplier(20000), 1.30);
  });

  it('calculateScore increases with time', () => {
    assert.equal(calculateScore(0), 0);
    assert.equal(calculateScore(1000), 10);
    assert.equal(calculateScore(5000), 50);
    assert.ok(calculateScore(2000) > calculateScore(1000));
  });

  it('shouldSpawn respects interval and difficulty', () => {
    assert.equal(shouldSpawn(700, 0), true);
    assert.equal(shouldSpawn(500, 0), false);
    // difficulty reduces interval, so should spawn sooner later in game
    assert.equal(shouldSpawn(20000, 19500), true); // level 3 interval smaller
  });

  it('ship stays within canvas after many moves', () => {
    let x = 250;
    for (let i = 0; i < 100; i++) x = updateShipPosition(x, 1, 10, 0, 478);
    assert.ok(x <= 478);
    for (let i = 0; i < 100; i++) x = updateShipPosition(x, -1, 10, 0, 478);
    assert.ok(x >= 0);
  });
});

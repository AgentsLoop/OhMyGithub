import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, dist, circleCollides, shipAsteroidCollides, createAsteroid, getSpawnInterval, getDifficulty, addScore, isOutOfBounds } from '../src/logic.js';

describe('clamp', () => {
  it('clamps within range', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-2, 0, 10), 0);
    assert.equal(clamp(20, 0, 10), 10);
  });
});

describe('circleCollides', () => {
  it('detects overlapping circles', () => {
    assert.equal(circleCollides({x:0,y:0,r:10},{x:15,y:0,r:10}), true);
    assert.equal(circleCollides({x:0,y:0,r:10},{x:25,y:0,r:10}), false);
    assert.equal(circleCollides({x:0,y:0,r:10},{x:20,y:0,r:10}), false); // exactly touching = not colliding (<)
  });
});

describe('shipAsteroidCollides', () => {
  it('collides when overlapping', () => {
    const ship = { x: 100, y: 100, w: 36, h: 44, r: 18 };
    // ship center ~118,122
    const asteroidHit = { x: 118, y: 122, r: 12 };
    assert.equal(shipAsteroidCollides(ship, asteroidHit), true);
  });
  it('does not collide when far', () => {
    const ship = { x: 100, y: 100, w: 36, h: 44, r: 18 };
    const asteroidFar = { x: 300, y: 300, r: 20 };
    assert.equal(shipAsteroidCollides(ship, asteroidFar), false);
  });
  it('fairness shrink: edge case', () => {
    const ship = { x: 0, y: 0, w: 36, h: 44, r: 18 };
    const center = { x: ship.x + ship.w/2, y: ship.y + ship.h/2 };
    // place asteroid at distance = 0.72*18 + 0.9*10 - 1 => should collide
    const sr = 18*0.72; const ar=10;
    const asteroid = { x: center.x + sr + ar*0.9 - 1, y: center.y, r: ar };
    assert.equal(shipAsteroidCollides(ship, asteroid), true);
    const asteroid2 = { x: center.x + sr + ar*0.9 + 2, y: center.y, r: ar };
    assert.equal(shipAsteroidCollides(ship, asteroid2), false);
  });
});

describe('createAsteroid', () => {
  it('creates asteroid within bounds', () => {
    const a = createAsteroid(800, 600, 0, () => 0.5);
    assert.ok(a.r >= 18 && a.r <= 60);
    assert.ok(a.x >= a.r && a.x <= 800 - a.r);
    assert.ok(a.y < 0);
    assert.ok(a.speedY > 0);
    assert.ok(a.vertices.length >= 7 && a.vertices.length <= 11);
  });
  it('higher difficulty increases speed', () => {
    const a0 = createAsteroid(800, 600, 0, () => 0.5);
    const a10 = createAsteroid(800, 600, 10, () => 0.5);
    assert.ok(a10.speedY > a0.speedY);
    assert.ok(a10.r >= a0.r);
  });
});

describe('getSpawnInterval', () => {
  it('decreases with difficulty and respects min', () => {
    assert.equal(getSpawnInterval(0), 900);
    assert.ok(getSpawnInterval(5) < 900);
    assert.equal(getSpawnInterval(20), 220); // floor at min
    assert.equal(getSpawnInterval(100), 220);
  });
});

describe('getDifficulty', () => {
  it('increases every 800 points', () => {
    assert.equal(getDifficulty(0), 0);
    assert.equal(getDifficulty(799), 0);
    assert.equal(getDifficulty(800), 1);
    assert.equal(getDifficulty(1600), 2);
    assert.equal(getDifficulty(20000), 20); // capped
  });
});

describe('addScore', () => {
  it('adds score proportionally to delta', () => {
    const s = addScore(0, 1000);
    assert.ok(s > 50 && s < 70); // 0.06*1000=60
    assert.ok(addScore(100, 16.67) > 100);
  });
});

describe('isOutOfBounds', () => {
  it('detects out of bounds', () => {
    assert.equal(isOutOfBounds({x:400,y:720,r:20},800,600), true);
    assert.equal(isOutOfBounds({x:400,y:300,r:20},800,600), false);
    assert.equal(isOutOfBounds({x:-200,y:100,r:20},800,600), true);
    assert.equal(isOutOfBounds({x:1000,y:100,r:20},800,600), true);
  });
});

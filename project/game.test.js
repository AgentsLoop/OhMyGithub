import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  createShip,
  clamp,
  updateShip,
  spawnAsteroid,
  updateAsteroids,
  checkCollision,
  isColliding,
  updateGame,
  resetGame,
  GAME_WIDTH,
  SHIP_SPEED,
  SHIP_WIDTH
} from './game.js';

describe('Asteroid Sprint logic', () => {
  it('creates ship centered near bottom', () => {
    const s = createShip();
    expect(s.x).toBeCloseTo(GAME_WIDTH/2 - SHIP_WIDTH/2);
    expect(s.y).toBeGreaterThan(600);
    expect(s.width).toBe(SHIP_WIDTH);
  });

  it('clamp keeps values in bounds', () => {
    expect(clamp(5,0,10)).toBe(5);
    expect(clamp(-2,0,10)).toBe(0);
    expect(clamp(15,0,10)).toBe(10);
  });

  it('moves ship left and right with Arrow keys / A D and clamps to edges', () => {
    const ship = createShip();
    const dt = 1; // 1 second
    ship.x = 0;
    updateShip(ship, -1, dt);
    expect(ship.x).toBe(0); // cannot go beyond left

    ship.x = GAME_WIDTH - ship.width;
    updateShip(ship, 1, dt);
    expect(ship.x).toBe(GAME_WIDTH - ship.width);

    ship.x = 100;
    updateShip(ship, 1, 0.5);
    expect(ship.x).toBeCloseTo(100 + SHIP_SPEED * 0.5);
  });

  it('ship does not move with direction 0', () => {
    const ship = createShip();
    const orig = ship.x;
    updateShip(ship, 0, 1);
    expect(ship.x).toBe(orig);
  });

  it('spawns asteroid within horizontal bounds', () => {
    const state = createInitialState();
    const a = spawnAsteroid(state, () => 0.5);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.x + a.size).toBeLessThanOrEqual(GAME_WIDTH);
    expect(a.y).toBeLessThan(0);
    expect(a.speed).toBeGreaterThan(100);
  });

  it('updateAsteroids moves asteroids and scores when they exit', () => {
    const state = createInitialState();
    state.asteroids = [{ x: 10, y: 700, size: 30, speed: 200, rotation:0, rotationSpeed:0 }];
    const beforeScore = state.score;
    updateAsteroids(state, 1); // 1 sec -> y = 900
    expect(state.asteroids.length).toBe(0);
    expect(state.score).toBeGreaterThan(beforeScore);
  });

  it('detects collision accurately', () => {
    const ship = { x: 100, y: 600, width: 36, height: 48 };
    const overlapping = { x: 100, y: 600, size: 30 };
    const far = { x: 300, y: 100, size: 30 };
    expect(checkCollision(ship, overlapping)).toBe(true);
    expect(checkCollision(ship, far)).toBe(false);
    // edge near but not overlapping due to inset
    const nearMiss = { x: 100 + 36 + 5, y: 600, size: 30 };
    expect(checkCollision(ship, nearMiss)).toBe(false);
  });

  it('isColliding checks all asteroids', () => {
    const state = createInitialState();
    state.ship = { x: 100, y: 600, width: 36, height: 48 };
    state.asteroids = [{ x: 300, y: 100, size: 30 },{ x: 100, y: 600, size: 30 }];
    expect(isColliding(state)).toBe(true);
    state.asteroids = [{ x: 0, y: 0, size: 20 }];
    expect(isColliding(state)).toBe(false);
  });

  it('updateGame triggers game over on collision', () => {
    const state = createInitialState();
    // place asteroid directly on ship
    state.ship.x = 100; state.ship.y = 600;
    state.asteroids = [{ x: 100, y: 600, size: 40, speed: 0, rotation:0, rotationSpeed:0 }];
    updateGame(state, 0.016, 0, () => 0.9);
    expect(state.gameOver).toBe(true);
  });

  it('updateGame increments score over time and spawns asteroids', () => {
    const state = createInitialState();
    const startScore = state.score;
    // force spawn by advancing timer
    updateGame(state, 2, 0, () => 0.5);
    expect(state.score).toBeGreaterThan(startScore);
    expect(state.asteroids.length).toBeGreaterThan(0);
  });

  it('score and Restart logic: game over shows and reset clears', () => {
    const state = createInitialState();
    state.score = 123;
    state.gameOver = true;
    state.asteroids = [{ x: 0, y: 0, size: 30, speed: 0, rotation:0, rotationSpeed:0 }];
    resetGame(state);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.asteroids.length).toBe(0);
  });

  it('does not update when gameOver true', () => {
    const state = createInitialState();
    state.gameOver = true;
    state.score = 50;
    updateGame(state, 1, 1);
    expect(state.score).toBe(50);
  });

  it('supports ArrowLeft/Right and A/D via direction parameter', () => {
    const state = createInitialState();
    const leftX = state.ship.x;
    updateGame(state, 0.5, -1, () => 0.99); // avoid spawning randomness side-effect on position check? use high random to spawn far
    expect(state.ship.x).toBeLessThan(leftX);
    const afterLeft = state.ship.x;
    updateGame(state, 0.5, 1);
    expect(state.ship.x).toBeGreaterThan(afterLeft);
  });

  it('mobile/desktop responsiveness: game width is constrained and ship stays in bounds', () => {
    const state = createInitialState();
    // simulate many left moves
    for (let i=0;i<20;i++) updateGame(state, 0.5, -1, () => 0.5);
    expect(state.ship.x).toBeGreaterThanOrEqual(0);
    expect(state.ship.x + state.ship.width).toBeLessThanOrEqual(GAME_WIDTH);
  });
});

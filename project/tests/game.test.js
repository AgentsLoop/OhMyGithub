import { describe, it, expect } from 'vitest';
import {
  CONFIG,
  clamp,
  getLevelFromScore,
  getSpawnInterval,
  getFallSpeed,
  getBombChance,
  createInitialState,
  checkCollision,
  moveBasket,
  setBasketPosition,
  spawnObject,
  update,
  resetState,
  createTestState
} from '../src/game.js';

describe('CONFIG sanity', () => {
  it('has required fields', () => {
    expect(CONFIG.width).toBeGreaterThan(0);
    expect(CONFIG.height).toBeGreaterThan(0);
    expect(CONFIG.initialLives).toBe(3);
  });
});

describe('clamp', () => {
  it('clamps correctly', () => {
    expect(clamp(5,0,10)).toBe(5);
    expect(clamp(-5,0,10)).toBe(0);
    expect(clamp(15,0,10)).toBe(10);
  });
});

describe('getLevelFromScore', () => {
  it('starts at level 1', () => {
    expect(getLevelFromScore(0)).toBe(1);
    expect(getLevelFromScore(249)).toBe(1);
    expect(getLevelFromScore(250)).toBe(2);
    expect(getLevelFromScore(500)).toBe(3);
    expect(getLevelFromScore(1000)).toBe(5);
  });
});

describe('getSpawnInterval', () => {
  it('decreases with level but not below min', () => {
    expect(getSpawnInterval(1)).toBe(CONFIG.initialSpawnInterval);
    expect(getSpawnInterval(2)).toBe(CONFIG.initialSpawnInterval - CONFIG.spawnDecreasePerLevel);
    expect(getSpawnInterval(100)).toBe(CONFIG.minSpawnInterval);
  });
});

describe('getFallSpeed', () => {
  it('increases with level', () => {
    expect(getFallSpeed(1)).toBe(CONFIG.baseFallSpeed);
    expect(getFallSpeed(2)).toBe(CONFIG.baseFallSpeed + CONFIG.fallSpeedPerLevel);
    expect(getFallSpeed(5)).toBeGreaterThan(getFallSpeed(1));
  });
});

describe('getBombChance', () => {
  it('increases and caps', () => {
    expect(getBombChance(1)).toBeCloseTo(CONFIG.bombChanceBase);
    expect(getBombChance(10)).toBeGreaterThan(getBombChance(1));
    expect(getBombChance(100)).toBeLessThanOrEqual(0.45);
  });
});

describe('createInitialState', () => {
  it('creates basket centered', () => {
    const s = createInitialState(480,720);
    expect(s.basket.x).toBeCloseTo((480 - CONFIG.basketWidth)/2);
    expect(s.basket.y).toBe(660);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
    expect(s.level).toBe(1);
    expect(s.objects).toEqual([]);
    expect(s.gameOver).toBe(false);
  });
});

describe('checkCollision', () => {
  it('detects overlapping rects', () => {
    const a = {x:0,y:0,width:10,height:10};
    const b = {x:5,y:5,width:10,height:10};
    const c = {x:20,y:20,width:5,height:5};
    expect(checkCollision(a,b)).toBe(true);
    expect(checkCollision(a,c)).toBe(false);
    expect(checkCollision(b,c)).toBe(false);
  });
  it('edge touching is not collision (< vs <=)', () => {
    const a = {x:0,y:0,width:10,height:10};
    const b = {x:10,y:0,width:10,height:10};
    expect(checkCollision(a,b)).toBe(false);
  });
});

describe('moveBasket', () => {
  it('moves left and right', () => {
    const s = createTestState();
    const startX = s.basket.x;
    moveBasket(s, -1, 0.1); // 52px left
    expect(s.basket.x).toBeLessThan(startX);
    moveBasket(s, 1, 0.1);
    expect(s.basket.x).toBeCloseTo(startX);
  });
  it('clamps at edges', () => {
    const s = createTestState();
    s.basket.x = 0;
    moveBasket(s, -1, 1);
    expect(s.basket.x).toBe(0);
    s.basket.x = s.width - s.basket.width;
    moveBasket(s, 1, 1);
    expect(s.basket.x).toBe(s.width - s.basket.width);
  });
  it('does not move when gameOver', () => {
    const s = createTestState({ gameOver:true });
    const x = s.basket.x;
    moveBasket(s, 1, 1);
    expect(s.basket.x).toBe(x);
  });
});

describe('setBasketPosition', () => {
  it('centers basket on given x', () => {
    const s = createTestState();
    setBasketPosition(s, 240);
    expect(s.basket.x).toBeCloseTo(240 - CONFIG.basketWidth/2);
  });
  it('clamps', () => {
    const s = createTestState();
    setBasketPosition(s, -100);
    expect(s.basket.x).toBe(0);
    setBasketPosition(s, 9999);
    expect(s.basket.x).toBe(s.width - s.basket.width);
  });
});

describe('spawnObject', () => {
  it('spawns object within bounds', () => {
    const s = createInitialState();
    const rand = () => 0.5;
    const obj = spawnObject(s, rand);
    expect(s.objects.length).toBe(1);
    expect(obj.x).toBeGreaterThanOrEqual(0);
    expect(obj.x + obj.width).toBeLessThanOrEqual(s.width);
    expect(obj.y).toBeLessThan(0);
    expect(obj.vy).toBeGreaterThan(0);
  });
  it('can spawn bomb or crystal depending on rand', () => {
    const s = createInitialState();
    s.level = 1;
    // bombChance ~0.18, so rand 0.05 => bomb
    const bomb = spawnObject(s, () => 0.05);
    expect(bomb.type).toBe('bomb');
    // next rand: need sequence for crystal: first check bomb (0.5 >0.18 => not bomb), then pick crystal type (0.5 => purple)
    let calls=0;
    const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const obj2 = spawnObject(s, () => seq[calls++ % seq.length]);
    expect(['blue','purple','cyan','gold']).toContain(obj2.type);
  });
});

describe('update', () => {
  it('moves objects down', () => {
    const s = createTestState();
    s.objects = [{ id:1, x:100,y:0,width:30,height:30,type:'blue', vy:100, rotation:0, rotSpeed:0, wobble:0 }];
    update(s, 1000);
    expect(s.objects[0].y).toBeCloseTo(100);
  });
  it('catches crystal and adds score', () => {
    const s = createTestState();
    // place crystal overlapping basket
    s.objects = [{ id:1, x: s.basket.x+10, y: s.basket.y, width:30,height:30,type:'blue', vy:0, rotation:0, rotSpeed:0, wobble:0 }];
    const ev = update(s, 16);
    expect(ev.caught.length).toBe(1);
    expect(s.score).toBe(CONFIG.crystalValue.blue);
    expect(s.objects.length).toBe(0);
    expect(s.caught).toBe(1);
  });
  it('gold gives more points', () => {
    const s = createTestState();
    s.objects = [{ id:1, x: s.basket.x+10, y: s.basket.y, width:30,height:30,type:'gold', vy:0, rotation:0, rotSpeed:0, wobble:0 }];
    update(s, 16);
    expect(s.score).toBe(CONFIG.crystalValue.gold);
  });
  it('bomb reduces lives', () => {
    const s = createTestState();
    s.lives = 3;
    s.objects = [{ id:1, x: s.basket.x+5, y: s.basket.y, width:30,height:30,type:'bomb', vy:0, rotation:0, rotSpeed:0, wobble:0 }];
    const ev = update(s, 16);
    expect(ev.bombHits.length).toBe(1);
    expect(s.lives).toBe(2);
    expect(s.gameOver).toBe(false);
  });
  it('game over when lives hit zero', () => {
    const s = createTestState();
    s.lives = 1;
    s.objects = [{ id:1, x: s.basket.x+5, y: s.basket.y, width:30,height:30,type:'bomb', vy:0, rotation:0, rotSpeed:0, wobble:0 }];
    const ev = update(s, 16);
    expect(s.lives).toBe(0);
    expect(s.gameOver).toBe(true);
    expect(ev.gameOver).toBe(true);
  });
  it('missed objects are removed but do not affect lives/score', () => {
    const s = createTestState();
    s.objects = [{ id:1, x:10, y: s.height+50, width:30,height:30,type:'blue', vy:0, rotation:0, rotSpeed:0, wobble:0 }];
    const ev = update(s, 16);
    expect(s.objects.length).toBe(0);
    expect(ev.missed.length).toBe(1);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
  });
  it('spawns objects over time', () => {
    const s = createTestState();
    s.spawnInterval = 100;
    s.spawnTimer = 0;
    s.objects = [];
    update(s, 250, () => 0.5);
    expect(s.objects.length).toBe(2); // 250ms /100 =2 spawns
  });
  it('level increases with score', () => {
    const s = createTestState();
    s.score = 250;
    s.level = 1;
    update(s, 16);
    expect(s.level).toBe(2);
    expect(s.spawnInterval).toBe(getSpawnInterval(2));
  });
  it('does nothing after gameOver', () => {
    const s = createTestState({ gameOver:true, score:100 });
    s.objects = [{ id:1, x:10,y:10,width:10,height:10,type:'blue', vy:100, rotation:0, rotSpeed:0, wobble:0 }];
    const ev = update(s, 1000);
    expect(s.objects[0].y).toBe(10);
    expect(ev.caught.length).toBe(0);
  });
});

describe('resetState', () => {
  it('resets to initial', () => {
    const s = createInitialState();
    s.score = 999; s.lives = 1; s.objects.push({id:1});
    s.gameOver=true;
    resetState(s);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(CONFIG.initialLives);
    expect(s.objects.length).toBe(0);
    expect(s.gameOver).toBe(false);
  });
});

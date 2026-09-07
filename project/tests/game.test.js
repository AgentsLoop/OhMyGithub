import { describe, it, expect } from 'vitest';
import {
  clamp, isColliding, getDifficulty, getSpawnConfig,
  createInitialState, spawnComet, spawnAsteroid,
  updateShip, updateEntities, checkCollisions, updateDifficulty, tick, restartState,
  GAME_WIDTH, GAME_HEIGHT, SHIP_SPEED, COMET_SCORE, INITIAL_LIVES
} from '../src/game.js';

describe('clamp', ()=>{
  it('clamps values', ()=>{
    expect(clamp(5,0,10)).toBe(5);
    expect(clamp(-2,0,10)).toBe(0);
    expect(clamp(15,0,10)).toBe(10);
  });
});

describe('isColliding', ()=>{
  it('detects collision when overlapping', ()=>{
    const a={x:0,y:0,radius:10};
    const b={x:15,y:0,radius:10};
    expect(isColliding(a,b)).toBe(true);
  });
  it('no collision when far', ()=>{
    const a={x:0,y:0,radius:10};
    const b={x:30,y:0,radius:10};
    expect(isColliding(a,b)).toBe(false);
  });
  it('edge case exactly touching', ()=>{
    const a={x:0,y:0,radius:10};
    const b={x:20,y:0,radius:10};
    expect(isColliding(a,b)).toBe(false); // < not <=
  });
});

describe('getDifficulty', ()=>{
  it('level progression', ()=>{
    expect(getDifficulty(0)).toBe(1);
    expect(getDifficulty(99)).toBe(1);
    expect(getDifficulty(100)).toBe(2);
    expect(getDifficulty(250)).toBe(3);
    expect(getDifficulty(950)).toBe(10);
    expect(getDifficulty(2000)).toBe(10);
  });
});

describe('getSpawnConfig', ()=>{
  it('higher difficulty spawns faster and quicker', ()=>{
    const c1=getSpawnConfig(1);
    const c5=getSpawnConfig(5);
    expect(c5.cometInterval).toBeLessThan(c1.cometInterval);
    expect(c5.asteroidInterval).toBeLessThan(c1.asteroidInterval);
    expect(c5.asteroidSpeedMin).toBeGreaterThan(c1.asteroidSpeedMin);
    expect(c5.cometSpeedMax).toBeGreaterThan(c1.cometSpeedMax);
  });
  it('caps intervals', ()=>{
    const c10=getSpawnConfig(10);
    expect(c10.cometInterval).toBeGreaterThanOrEqual(0.35);
    expect(c10.asteroidInterval).toBeGreaterThanOrEqual(0.35);
  });
});

describe('createInitialState', ()=>{
  it('has correct defaults', ()=>{
    const s=createInitialState();
    expect(s.score).toBe(0);
    expect(s.lives).toBe(INITIAL_LIVES);
    expect(s.difficulty).toBe(1);
    expect(s.gameOver).toBe(false);
    expect(s.ship.x).toBe(GAME_WIDTH/2);
    expect(s.comets.length).toBe(0);
  });
});

describe('updateShip', ()=>{
  it('moves right with input', ()=>{
    const s=createInitialState();
    const startX=s.ship.x;
    updateShip(s, {right:true}, 0.5);
    expect(s.ship.x).toBeGreaterThan(startX);
    expect(s.ship.x).toBeCloseTo(startX+SHIP_SPEED*0.5, 1);
  });
  it('normalizes diagonal speed', ()=>{
    const s=createInitialState();
    s.ship.x=400; s.ship.y=300;
    updateShip(s, {right:true, up:true}, 1);
    const dx = s.ship.x-400;
    const dy = s.ship.y-300;
    const len=Math.hypot(dx,dy);
    expect(len).toBeCloseTo(SHIP_SPEED, 0.5);
  });
  it('clamps to bounds', ()=>{
    const s=createInitialState();
    s.ship.x=5; s.ship.y=5;
    updateShip(s, {left:true, up:true}, 1);
    expect(s.ship.x).toBeGreaterThanOrEqual(s.ship.radius);
    expect(s.ship.y).toBeGreaterThanOrEqual(s.ship.radius);
    s.ship.x=GAME_WIDTH-5; s.ship.y=GAME_HEIGHT-5;
    updateShip(s, {right:true, down:true}, 1);
    expect(s.ship.x).toBeLessThanOrEqual(GAME_WIDTH - s.ship.radius);
    expect(s.ship.y).toBeLessThanOrEqual(GAME_HEIGHT - s.ship.radius);
  });
  it('invulnerability decays', ()=>{
    const s=createInitialState();
    s.invulnerable=1;
    updateShip(s, {}, 0.5);
    expect(s.invulnerable).toBeCloseTo(0.5);
  });
  it('does not move when gameOver', ()=>{
    const s=createInitialState();
    s.gameOver=true;
    const x=s.ship.x;
    updateShip(s, {right:true}, 1);
    expect(s.ship.x).toBe(x);
  });
});

describe('spawn helpers', ()=>{
  it('spawnComet adds entity within bounds', ()=>{
    const s=createInitialState();
    spawnComet(s);
    expect(s.comets.length).toBe(1);
    expect(s.comets[0].x).toBeGreaterThanOrEqual(0);
    expect(s.comets[0].x).toBeLessThanOrEqual(GAME_WIDTH);
    expect(s.comets[0].vy).toBeGreaterThan(0);
  });
  it('spawnAsteroid adds entity', ()=>{
    const s=createInitialState();
    spawnAsteroid(s);
    expect(s.asteroids.length).toBe(1);
    expect(s.asteroids[0].radius).toBeGreaterThan(10);
  });
});

describe('updateEntities', ()=>{
  it('moves entities and culls off-screen', ()=>{
    const s=createInitialState();
    s.comets=[{x:100,y:GAME_HEIGHT+50, radius:10, vy:50, vx:0, phase:0, kind:'common'}];
    s.asteroids=[{x:200,y:GAME_HEIGHT+70, radius:15, vy:50, vx:0, rotation:0, rotSpeed:0}];
    s.particles=[{x:0,y:0,vx:0,vy:0,life:-0.1,maxLife:0.5,color:'#fff'}];
    updateEntities(s, 0.1);
    expect(s.comets.length).toBe(0);
    expect(s.asteroids.length).toBe(0);
    expect(s.particles.length).toBe(0);
  });
  it('updates positions', ()=>{
    const s=createInitialState();
    s.comets=[{x:100,y:100,radius:10,vy:100,vx:10,phase:0,kind:'common'}];
    updateEntities(s,1);
    expect(s.comets[0].y).toBeCloseTo(200);
  });
});

describe('checkCollisions', ()=>{
  it('collects comet and adds score', ()=>{
    const s=createInitialState();
    s.ship.x=100; s.ship.y=100;
    s.comets=[{x:100,y:100,radius:5,vy:0,vx:0,phase:0,kind:'common'}];
    const before=s.score;
    checkCollisions(s);
    expect(s.comets.length).toBe(0);
    expect(s.score).toBe(before+COMET_SCORE);
    expect(s.particles.length).toBeGreaterThan(0);
  });
  it('rare comet gives 25', ()=>{
    const s=createInitialState();
    s.ship.x=100; s.ship.y=100;
    s.comets=[{x:100,y:100,radius:5,vy:0,vx:0,phase:0,kind:'rare'}];
    checkCollisions(s);
    expect(s.score).toBe(25);
  });
  it('asteroid hit reduces lives and sets invuln', ()=>{
    const s=createInitialState();
    s.ship.x=100; s.ship.y=100;
    s.asteroids=[{x:100,y:100,radius:10,vy:0,vx:0,rotation:0,rotSpeed:0}];
    checkCollisions(s);
    expect(s.asteroids.length).toBe(0);
    expect(s.lives).toBe(INITIAL_LIVES-1);
    expect(s.invulnerable).toBeGreaterThan(0);
    expect(s.gameOver).toBe(false);
  });
  it('invulnerable prevents asteroid damage', ()=>{
    const s=createInitialState();
    s.ship.x=100; s.ship.y=100;
    s.invulnerable=1;
    s.asteroids=[{x:100,y:100,radius:10,vy:0,vx:0,rotation:0,rotSpeed:0}];
    checkCollisions(s);
    expect(s.lives).toBe(INITIAL_LIVES);
    expect(s.asteroids.length).toBe(1);
  });
  it('game over when lives depleted', ()=>{
    const s=createInitialState();
    s.lives=1;
    s.ship.x=50; s.ship.y=50;
    s.asteroids=[{x:50,y:50,radius:10,vy:0,vx:0,rotation:0,rotSpeed:0}];
    checkCollisions(s);
    expect(s.lives).toBe(0);
    expect(s.gameOver).toBe(true);
  });
});

describe('updateDifficulty', ()=>{
  it('updates difficulty based on score', ()=>{
    const s=createInitialState();
    s.score=250;
    updateDifficulty(s);
    expect(s.difficulty).toBe(3);
  });
});

describe('tick', ()=>{
  it('advances time and spawns', ()=>{
    const s=createInitialState();
    // force timers to trigger
    s.cometTimer=10;
    s.asteroidTimer=10;
    tick(s, {}, 0.016);
    expect(s.comets.length + s.asteroids.length).toBeGreaterThan(0);
    expect(s.time).toBeGreaterThan(0);
  });
  it('does nothing when gameOver', ()=>{
    const s=createInitialState();
    s.gameOver=true;
    const t=s.time;
    tick(s, {right:true}, 0.5);
    expect(s.time).toBe(t);
  });
  it('difficulty progresses via tick', ()=>{
    const s=createInitialState();
    s.score=100;
    tick(s, {}, 0.016);
    expect(s.difficulty).toBe(2);
  });
});

describe('restartState', ()=>{
  it('resets but keeps highScore', ()=>{
    const s=createInitialState();
    s.score=150; s.lives=1; s.gameOver=true;
    s.highScore=150;
    s.comets=[{x:0,y:0,radius:5,vy:0,vx:0,phase:0,kind:'common'}];
    restartState(s);
    expect(s.score).toBe(0);
    expect(s.lives).toBe(INITIAL_LIVES);
    expect(s.gameOver).toBe(false);
    expect(s.comets.length).toBe(0);
    expect(s.highScore).toBe(150);
  });
  it('updates highScore if new score higher', ()=>{
    const s=createInitialState();
    s.score=200; s.highScore=100;
    restartState(s);
    expect(s.highScore).toBe(200);
  });
});

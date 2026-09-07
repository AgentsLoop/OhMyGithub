import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, spawnFood, step, setDirection, isOpposite, nextHead, initGame } from '../src/game.js';

describe('isOpposite', () => {
  it('detects opposite pairs', () => {
    assert.equal(isOpposite('UP','DOWN'), true);
    assert.equal(isOpposite('DOWN','UP'), true);
    assert.equal(isOpposite('LEFT','RIGHT'), true);
    assert.equal(isOpposite('RIGHT','LEFT'), true);
  });
  it('not opposite for same or perpendicular', () => {
    assert.equal(isOpposite('UP','UP'), false);
    assert.equal(isOpposite('UP','LEFT'), false);
    assert.equal(isOpposite('UP','RIGHT'), false);
  });
});

describe('nextHead', () => {
  it('moves correctly', () => {
    assert.deepEqual(nextHead({x:5,y:5},'UP'), {x:5,y:4});
    assert.deepEqual(nextHead({x:5,y:5},'DOWN'), {x:5,y:6});
    assert.deepEqual(nextHead({x:5,y:5},'LEFT'), {x:4,y:5});
    assert.deepEqual(nextHead({x:5,y:5},'RIGHT'), {x:6,y:5});
  });
});

describe('createInitialState', () => {
  it('creates centered snake length 3 heading RIGHT', () => {
    const s = createInitialState(20,20);
    assert.equal(s.snake.length, 3);
    assert.equal(s.direction,'RIGHT');
    assert.equal(s.nextDirection,'RIGHT');
    assert.equal(s.score,0);
    assert.equal(s.gameOver,false);
    // head centered
    assert.deepEqual(s.snake[0], {x:10,y:10});
  });
});

describe('spawnFood', () => {
  it('never spawns on snake', () => {
    const snake=[{x:0,y:0},{x:1,y:0},{x:2,y:0}];
    for(let i=0;i<20;i++){
      const f=spawnFood(snake,3,3);
      assert.ok(f);
      assert.ok(!snake.some(p=>p.x===f.x && p.y===f.y));
    }
  });
  it('returns null when board full', () => {
    const snake=[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}];
    const f=spawnFood(snake,2,2);
    assert.equal(f,null);
  });
  it('deterministic with rng', () => {
    const snake=[{x:0,y:0}];
    const f1=spawnFood(snake,2,2, () => 0);
    const f2=spawnFood(snake,2,2, () => 0.999);
    // with rng 0 should pick first free cell, with 0.999 last
    assert.notDeepEqual(f1,f2);
  });
});

describe('setDirection - prevent reverse', () => {
  it('blocks 180 reverse', () => {
    const s = createInitialState(10,10);
    s.direction='RIGHT'; s.nextDirection='RIGHT';
    const s2=setDirection(s,'LEFT');
    assert.equal(s2.nextDirection,'RIGHT', 'should not allow reverse LEFT when moving RIGHT');
  });
  it('allows perpendicular', () => {
    const s = createInitialState(10,10);
    s.direction='RIGHT'; s.nextDirection='RIGHT';
    const s2=setDirection(s,'UP');
    assert.equal(s2.nextDirection,'UP');
  });
  it('blocks UP->DOWN', () => {
    let s=createInitialState(10,10);
    s.direction='UP'; s.nextDirection='UP';
    s=setDirection(s,'DOWN');
    assert.equal(s.nextDirection,'UP');
  });
});

describe('step - movement', () => {
  it('moves snake forward without eating', () => {
    let s=createInitialState(10,10);
    s.food={x:0,y:0}; // far away
    const beforeHead={...s.snake[0]};
    s=step(s);
    assert.deepEqual(s.snake[0], {x:beforeHead.x+1, y:beforeHead.y});
    assert.equal(s.snake.length,3);
    assert.equal(s.score,0);
  });
  it('grows and scores when eating', () => {
    let s=createInitialState(10,10);
    // place food directly ahead
    const head=s.snake[0];
    s.food={x:head.x+1, y:head.y};
    s=step(s);
    assert.equal(s.snake.length,4);
    assert.equal(s.score,10);
    // new food not on snake
    if(s.food) assert.ok(!s.snake.some(p=>p.x===s.food.x && p.y===s.food.y));
  });
  it('game over on wall collision', () => {
    let s=createInitialState(5,5);
    // put snake at right edge moving right
    s.snake=[{x:4,y:2},{x:3,y:2},{x:2,y:2}];
    s.direction='RIGHT'; s.nextDirection='RIGHT';
    s.food={x:0,y:0};
    s=step(s);
    assert.equal(s.gameOver,true);
    assert.equal(s.reason,'wall');
  });
  it('game over on self collision', () => {
    // create a U shape where next move hits body
    let s=createInitialState(10,10);
    s.snake=[
      {x:2,y:2},
      {x:2,y:1},
      {x:1,y:1},
      {x:1,y:2},
      {x:1,y:3},
    ];
    s.direction='UP'; s.nextDirection='UP';
    // head at 2,2 moving UP to 2,1 which is body[1]
    s.food={x:9,y:9};
    s=step(s);
    assert.equal(s.gameOver,true);
    assert.equal(s.reason,'self');
  });
  it('tail is not counted as collision when not eating (moving into vacated tail)', () => {
    let s=createInitialState(10,10);
    // snake in a loop where head moves into tail position
    // layout: head 1,1 -> 2,1 ->2,2 ->1,2 (tail at 1,2) Actually head moving DOWN into tail?
    // simpler: snake length 4 forming a square clockwise, head at 1,1 moving LEFT? Let's craft 2x2 loop
    s.snake=[
      {x:1,y:1},
      {x:2,y:1},
      {x:2,y:2},
      {x:1,y:2},
    ];
    s.direction='DOWN'; s.nextDirection='DOWN';
    // head 1,1 moving DOWN to 1,2 which is tail position; should NOT be collision because tail will move
    s.food={x:9,y:9};
    const result=step(s);
    assert.equal(result.gameOver,false);
    assert.equal(result.snake.length,4);
  });
  it('does not step when already gameOver', () => {
    let s=createInitialState(5,5);
    s.gameOver=true; s.reason='wall';
    const prev={...s, snake:[...s.snake]};
    const next=step(s);
    assert.equal(next.gameOver,true);
    assert.deepEqual(next.snake, prev.snake);
  });
});

describe('initGame', () => {
  it('spawns food not on snake', () => {
    const s=initGame(10,10, ()=>0.5);
    assert.ok(s.food);
    assert.ok(!s.snake.some(p=>p.x===s.food.x && p.y===s.food.y));
  });
  it('board win when filling', () => {
    // 2x2 board with snake length 3, food in last cell, eating fills board and wins
    let s={
      width:2,height:2,
      snake:[{x:1,y:0},{x:0,y:0},{x:0,y:1}],
      direction:'DOWN', nextDirection:'DOWN',
      food:{x:1,y:1}, score:20, gameOver:false, reason:null
    };
    s=step(s);
    assert.equal(s.gameOver,true);
    assert.equal(s.reason,'win');
    assert.equal(s.score,30);
    assert.equal(s.snake.length,4);
  });
});

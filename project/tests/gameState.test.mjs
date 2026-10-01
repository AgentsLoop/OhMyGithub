import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/gameState.mjs';

describe('GameState', () => {
  it('initializes with correct defaults', () => {
    const s = new GameState({ timeLimit: 50, maxHealth: 3 });
    assert.equal(s.timeLeft, 50);
    assert.equal(s.health, 3);
    assert.equal(s.hasRelic, false);
    assert.equal(s.status, 'playing');
    assert.ok(s.isPlaying());
  });

  it('collects relic once and scores', () => {
    const s = new GameState();
    assert.equal(s.collectRelic(), true);
    assert.equal(s.hasRelic, true);
    assert.equal(s.score, 100);
    assert.equal(s.collectRelic(), false);
    assert.equal(s.score, 100);
  });

  it('requires relic to win and awards time bonus', () => {
    const s = new GameState({ timeLimit: 50 });
    assert.equal(s.reachExit(), false);
    assert.equal(s.isWon(), false);
    s.collectRelic();
    s.timeLeft = 20;
    assert.equal(s.reachExit(), true);
    assert.equal(s.isWon(), true);
    assert.equal(s.cause, 'win');
    assert.ok(s.score >= 140);
  });

  it('takes damage and loses at zero health', () => {
    const s = new GameState({ maxHealth: 3 });
    s.takeDamage(1);
    assert.equal(s.health, 2);
    assert.equal(s.isLost(), false);
    s.takeDamage(2);
    assert.equal(s.health, 0);
    assert.equal(s.isLost(), true);
    assert.equal(s.cause, 'health');
    // further damage ignored after lost
    s.takeDamage(1);
    assert.equal(s.health, 0);
  });

  it('loses on timeout', () => {
    const s = new GameState({ timeLimit: 10 });
    s.update(5);
    assert.equal(s.isPlaying(), true);
    assert.equal(s.timeLeft, 5);
    s.update(5.1);
    assert.equal(s.isLost(), true);
    assert.equal(s.cause, 'time');
    assert.equal(s.timeLeft, 0);
  });

  it('reset restores initial state', () => {
    const s = new GameState({ timeLimit: 30, maxHealth: 3 });
    s.collectRelic();
    s.takeDamage(2);
    s.update(10);
    s.reset();
    assert.equal(s.hasRelic, false);
    assert.equal(s.health, 3);
    assert.equal(s.timeLeft, 30);
    assert.equal(s.status, 'playing');
    assert.equal(s.score, 0);
  });

  it('distance helpers work', () => {
    const s = new GameState();
    assert.equal(s.canCollect(1.0, 1.4), true);
    assert.equal(s.canCollect(2.0, 1.4), false);
    s.collectRelic();
    assert.equal(s.canCollect(1.0, 1.4), false);
    assert.equal(s.canExit(1.0, 1.6), true);
    s.hasRelic = false;
    assert.equal(s.canExit(1.0, 1.6), false);
  });

  it('heal caps at maxHealth', () => {
    const s = new GameState({ maxHealth: 3 });
    s.takeDamage(2);
    s.heal(5);
    assert.equal(s.health, 3);
  });
});

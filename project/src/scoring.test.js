import { describe, it, expect } from 'vitest';
import { createScoreState, onDelivered, onFailed, tickCombo, pointsForDelivery, LEVELS, getLevel, isLevelCleared, timeLeft, COMBO_WINDOW_MS } from './scoring.js';

describe('scoring – points and combo', () => {
  it('first delivery gives base points', () => {
    expect(pointsForDelivery(0)).toBe(100);
  });
  it('combo increases multiplier', () => {
    expect(pointsForDelivery(1)).toBe(150); // x1.5
    expect(pointsForDelivery(2)).toBe(200); // x2
    expect(pointsForDelivery(3)).toBe(250);
  });
  it('onDelivered increments combo within window', () => {
    let s = createScoreState();
    s = onDelivered(s, 1000);
    expect(s.combo).toBe(1);
    expect(s.score).toBe(100);
    s = onDelivered(s, 1000 + 1000); // within 2500
    expect(s.combo).toBe(2);
    expect(s.score).toBe(250); // 100+150
    s = onDelivered(s, 2000 + 2000); // within still? 2000->4000 diff 2000 <2500
    expect(s.combo).toBe(3);
  });
  it('combo resets if outside window', () => {
    let s = createScoreState();
    s = onDelivered(s, 0);
    expect(s.combo).toBe(1);
    s = onDelivered(s, COMBO_WINDOW_MS + 100); // outside
    expect(s.combo).toBe(1); // reset then +1 =1 not 2
    expect(s.score).toBe(200); // 100+100
  });
  it('onFailed resets combo', () => {
    let s = createScoreState();
    s = onDelivered(s, 0);
    s = onDelivered(s, 500);
    expect(s.combo).toBe(2);
    s = onFailed(s);
    expect(s.combo).toBe(0);
    expect(s.failed).toBe(1);
    s = onDelivered(s, 1000);
    expect(s.combo).toBe(1);
  });
  it('tickCombo decays after window', () => {
    let s = createScoreState();
    s = onDelivered(s, 0);
    expect(s.combo).toBe(1);
    s = tickCombo(s, COMBO_WINDOW_MS + 10);
    expect(s.combo).toBe(0);
    s = onDelivered(s, 0);
    s = tickCombo(s, 1000);
    expect(s.combo).toBe(1); // not yet
  });
  it('maxCombo tracks highest', () => {
    let s = createScoreState();
    s = onDelivered(s, 0);
    s = onDelivered(s, 500);
    s = onFailed(s);
    s = onDelivered(s, 600);
    expect(s.maxCombo).toBe(2);
  });
});

describe('levels', () => {
  it('LEVELS has 5 entries with escalating goals', () => {
    expect(LEVELS.length).toBe(5);
    for(let i=1;i<LEVELS.length;i++) expect(LEVELS[i].goal >= LEVELS[i-1].goal).toBe(true);
  });
  it('getLevel clamps', () => {
    expect(getLevel(99).id).toBe(5);
    expect(getLevel(0).id).toBe(1);
  });
  it('isLevelCleared', () => {
    expect(isLevelCleared(6, LEVELS[0])).toBe(true);
    expect(isLevelCleared(5, LEVELS[0])).toBe(false);
  });
  it('timeLeft never negative', () => {
    expect(timeLeft(LEVELS[0], 100)).toBe(0);
    expect(timeLeft(LEVELS[0], 10)).toBe(35);
  });
});

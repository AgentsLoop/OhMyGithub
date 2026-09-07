import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, setupScenario, trainUnit, placeBuilding, issueOrder, tick } from './game-logic.mjs';

test('scenario spawns player + enemy bases and resources', () => {
  const s = setupScenario(createState());
  assert.ok(s.entities.some((e) => e.owner === 'player' && e.kind === 'commandCenter'));
  assert.ok(s.entities.some((e) => e.owner === 'enemy' && e.kind === 'commandCenter'));
  assert.equal(s.entities.filter((e) => e.kind === 'mineral').length, 6);
  assert.equal(s.entities.filter((e) => e.kind === 'scv').length, 4);
});

test('SCV harvest loop earns minerals', () => {
  const s = setupScenario(createState());
  const scv = s.entities.find((e) => e.kind === 'scv');
  const node = s.entities.find((e) => e.kind === 'mineral');
  scv.x = node.x - 20; scv.y = node.y;
  issueOrder(s, [scv.id], { type: 'harvest', targetId: node.id });
  const m0 = s.minerals;
  for (let i = 0; i < 600; i++) tick(s, 0.1); // 60s sim
  assert.ok(s.minerals > m0, `expected income, got ${m0} -> ${s.minerals}`);
});

test('marine requires barracks; SCV trains from CC', () => {
  const s = setupScenario(createState());
  s.minerals = 500;
  assert.equal(trainUnit(s, 'marine').ok, false);
  assert.equal(trainUnit(s, 'marine').reason, 'need-barracks');
  assert.equal(trainUnit(s, 'scv').ok, true);
  for (let i = 0; i < 200; i++) tick(s, 0.1);
  assert.equal(s.entities.filter((e) => e.kind === 'scv' && e.owner === 'player').length, 5);
});

test('depot raises supply cap when finished', () => {
  const s = setupScenario(createState());
  s.minerals = 500;
  const cap0 = s.supplyCap;
  const r = placeBuilding(s, 'depot', 300, 400);
  assert.equal(r.ok, true);
  for (let i = 0; i < 300; i++) tick(s, 0.1);
  assert.equal(s.supplyCap, cap0 + 8);
});

test('marines can kill enemy CC => win', () => {
  const s = setupScenario(createState());
  const cc = s.entities.find((e) => e.owner === 'enemy' && e.kind === 'commandCenter');
  cc.hp = 10;
  const m = s.entities.find((e) => e.kind === 'marine');
  m.x = cc.x - 60; m.y = cc.y;
  issueOrder(s, [m.id], { type: 'attack', targetId: cc.id });
  for (let i = 0; i < 200 && !s.result; i++) tick(s, 0.1);
  assert.equal(s.result, 'win');
});

test('losing player CC => loss', () => {
  const s = setupScenario(createState());
  const cc = s.entities.find((e) => e.owner === 'player' && e.kind === 'commandCenter');
  cc.hp = 0;
  tick(s, 0.1);
  assert.equal(s.result, 'loss');
});

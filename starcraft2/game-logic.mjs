// StarCraft 2 mini-RTS — pure simulation logic (no DOM).
// Shared between browser (game.js) and Node tests.
export const COSTS = {
  scv: { minerals: 50, gas: 0, supply: 1, buildTime: 12 },
  marine: { minerals: 50, gas: 0, supply: 1, buildTime: 18 },
  depot: { minerals: 100, gas: 0, supply: 0, buildTime: 20, hp: 350 },
  barracks: { minerals: 150, gas: 0, supply: 0, buildTime: 40, hp: 1000 },
};

export const STATS = {
  commandCenter: { hp: 1500, sight: 260 },
  scv: { hp: 45, speed: 90, dps: 5, range: 18, sight: 160 },
  marine: { hp: 55, speed: 110, dps: 12, range: 140, sight: 220, cooldown: 0.6 },
  zergling: { hp: 35, speed: 130, dps: 8, range: 16, sight: 200, cooldown: 0.7 },
};

let nextId = 1;
export function resetIds() { nextId = 1; }

export function createState() {
  resetIds();
  return {
    time: 0,
    minerals: 200,
    gas: 50,
    supplyUsed: 6, // CC + 4 SCV + starting marine overhead
    supplyCap: 11,
    entities: [],
    queue: [], // production queue {kind, remaining, total}
    result: null, // 'win' | 'loss'
    kills: 0,
    harvested: 0,
  };
}

export function addEntity(state, e) {
  e.id = nextId++;
  e.hp = e.hp ?? e.maxHp;
  e.cooldown = 0;
  e.order = e.order || null;
  state.entities.push(e);
  return e;
}

export function setupScenario(state) {
  // Player base (bottom-left)
  addEntity(state, { kind: 'commandCenter', owner: 'player', x: 160, y: 560, maxHp: STATS.commandCenter.hp, hp: STATS.commandCenter.hp });
  for (let i = 0; i < 4; i++) {
    addEntity(state, { kind: 'scv', owner: 'player', x: 220 + i * 28, y: 520 + (i % 2) * 28, maxHp: STATS.scv.hp, hp: STATS.scv.hp, carrying: null });
  }
  addEntity(state, { kind: 'marine', owner: 'player', x: 260, y: 600, maxHp: STATS.marine.hp, hp: STATS.marine.hp });
  // Mineral line + gas
  for (let i = 0; i < 6; i++) {
    addEntity(state, { kind: 'mineral', owner: 'neutral', x: 420 + (i % 3) * 46, y: 480 + Math.floor(i / 3) * 46, maxHp: 1500, hp: 1500, amount: 1500 });
  }
  addEntity(state, { kind: 'gas', owner: 'neutral', x: 420, y: 640, maxHp: 2000, hp: 2000, amount: 2000 });
  // Enemy base (top-right)
  addEntity(state, { kind: 'commandCenter', owner: 'enemy', x: 1120, y: 160, maxHp: STATS.commandCenter.hp, hp: STATS.commandCenter.hp });
  for (let i = 0; i < 3; i++) {
    addEntity(state, { kind: 'zergling', owner: 'enemy', x: 1060 + i * 30, y: 220, maxHp: STATS.zergling.hp, hp: STATS.zergling.hp });
  }
  state.nextWave = 45; // first enemy wave timer
  return state;
}

export function canAfford(state, cost) {
  return state.minerals >= (cost.minerals || 0) && state.gas >= (cost.gas || 0) &&
    state.supplyUsed + (cost.supply || 0) <= state.supplyCap;
}

export function trainUnit(state, kind) {
  const cost = COSTS[kind];
  if (!cost || (kind !== 'scv' && kind !== 'marine')) return { ok: false, reason: 'unknown-unit' };
  const cc = state.entities.find((e) => e.owner === 'player' && e.kind === 'commandCenter' && e.hp > 0);
  const barracks = state.entities.find((e) => e.owner === 'player' && e.kind === 'barracks' && e.hp > 0 && !e.underConstruction);
  if (kind === 'scv' && !cc) return { ok: false, reason: 'need-cc' };
  if (kind === 'marine' && !barracks) return { ok: false, reason: 'need-barracks' };
  if (!canAfford(state, cost)) return { ok: false, reason: 'cant-afford' };
  state.minerals -= cost.minerals;
  state.gas -= cost.gas || 0;
  state.supplyUsed += cost.supply || 0;
  state.queue.push({ kind, remaining: cost.buildTime, total: cost.buildTime });
  return { ok: true };
}

export function placeBuilding(state, kind, x, y) {
  const cost = COSTS[kind];
  if (!cost || (kind !== 'depot' && kind !== 'barracks')) return { ok: false, reason: 'unknown-building' };
  if (state.minerals < cost.minerals) return { ok: false, reason: 'cant-afford' };
  state.minerals -= cost.minerals;
  const b = addEntity(state, {
    kind, owner: 'player', x, y,
    maxHp: cost.hp, hp: Math.round(cost.hp * 0.35),
    underConstruction: cost.buildTime, buildTotal: cost.buildTime,
  });
  return { ok: true, id: b.id };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function issueOrder(state, ids, order) {
  for (const e of state.entities) {
    if (ids.includes(e.id) && e.owner === 'player' && (e.kind === 'scv' || e.kind === 'marine')) {
      e.order = { ...order };
    }
  }
}

function nearestEnemy(state, e, range) {
  let best = null; let bd = range;
  for (const t of state.entities) {
    if (t.owner === 'neutral' || t.owner === e.owner || t.hp <= 0) continue;
    if (t.kind === 'mineral' || t.kind === 'gas') continue;
    const d = dist(e, t);
    if (d <= bd) { bd = d; best = t; }
  }
  return best;
}

export function tick(state, dt) {
  if (state.result) return state;
  state.time += dt;

  // Production queue
  if (state.queue.length) {
    const q = state.queue[0];
    q.remaining -= dt;
    if (q.remaining <= 0) {
      state.queue.shift();
      const cc = state.entities.find((e) => e.owner === 'player' && e.kind === 'commandCenter');
      const sx = cc ? cc.x + 70 : 200; const sy = cc ? cc.y - 60 : 500;
      const st = q.kind === 'scv' ? STATS.scv : STATS.marine;
      addEntity(state, { kind: q.kind, owner: 'player', x: sx, y: sy, maxHp: st.hp, hp: st.hp, carrying: null });
    }
  }

  // Construction progress (auto-build)
  for (const e of state.entities) {
    if (e.underConstruction && e.hp > 0) {
      e.underConstruction -= dt;
      e.hp = Math.min(e.maxHp, e.hp + (e.maxHp / (e.buildTotal || 20)) * dt);
      if (e.underConstruction <= 0) {
        delete e.underConstruction;
        e.hp = e.maxHp;
        if (e.kind === 'depot') state.supplyCap += 8;
      }
    }
  }

  // Unit behavior
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    if (e.cooldown > 0) e.cooldown -= dt;
    if (e.kind !== 'scv' && e.kind !== 'marine' && e.kind !== 'zergling') continue;
    const st = STATS[e.kind];

    // Auto-acquire for combat units / zerglings
    let target = null;
    if (e.order?.type === 'attackmove' || e.kind === 'zergling' || e.kind === 'marine') {
      const aggro = e.kind === 'zergling' ? 320 : st.sight;
      target = e.order?.targetId ? state.entities.find((t) => t.id === e.order.targetId && t.hp > 0) : nearestEnemy(state, e, aggro);
    } else if (e.order?.type === 'attack' && e.order.targetId) {
      target = state.entities.find((t) => t.id === e.order.targetId && t.hp > 0) || null;
    }
    if (target) {
      const d = dist(e, target);
      if (d > st.range) {
        const sp = st.speed * dt;
        e.x += ((target.x - e.x) / (d || 1)) * Math.min(sp, d - st.range * 0.8);
        e.y += ((target.y - e.y) / (d || 1)) * Math.min(sp, d - st.range * 0.8);
      } else if (e.cooldown <= 0) {
        target.hp -= st.dps * (st.cooldown || 0.8);
        e.cooldown = st.cooldown || 0.8;
        e.facing = Math.atan2(target.y - e.y, target.x - e.x);
        if (target.hp <= 0 && target.owner === 'enemy') state.kills++;
      }
      continue;
    }

    if (!e.order) {
      // Zerglings with no order hunt player units
      if (e.kind === 'zergling') {
        const prey = nearestEnemy(state, e, 600);
        if (prey) e.order = { type: 'attack', targetId: prey.id };
      }
      continue;
    }

    if (e.order.type === 'move' || e.order.type === 'attackmove') {
      const d = Math.hypot(e.order.x - e.x, e.order.y - e.y);
      if (d < 6) { e.order = null; continue; }
      const sp = st.speed * dt;
      e.x += ((e.order.x - e.x) / d) * Math.min(sp, d);
      e.y += ((e.order.y - e.y) / d) * Math.min(sp, d);
      e.facing = Math.atan2(e.order.y - e.y, e.order.x - e.x);
    } else if (e.order.type === 'harvest' && e.kind === 'scv') {
      const node = state.entities.find((t) => t.id === e.order.targetId && t.amount > 0);
      const cc = state.entities.find((c) => c.owner === 'player' && c.kind === 'commandCenter' && c.hp > 0);
      if (!node) { e.order = null; continue; }
      if (!e.carrying) {
        const d = dist(e, node);
        if (d > 34) {
          const sp = st.speed * dt;
          e.x += ((node.x - e.x) / d) * Math.min(sp, d);
          e.y += ((node.y - e.y) / d) * Math.min(sp, d);
        } else {
          e.carrying = node.kind === 'gas' ? 'gas' : 'minerals';
          node.amount -= 5; node.hp = node.amount;
          e.returning = true;
        }
      } else if (cc) {
        const d = dist(e, cc);
        if (d > 70) {
          const sp = st.speed * dt;
          e.x += ((cc.x - e.x) / d) * Math.min(sp, d);
          e.y += ((cc.y - e.y) / d) * Math.min(sp, d);
        } else {
          if (e.carrying === 'minerals') { state.minerals += 5; state.harvested += 5; }
          else state.gas += 4;
          e.carrying = null; e.returning = false;
        }
      }
    } else if (e.order.type === 'attack') {
      e.order = null; // resolved via auto-acquire above
    }
  }

  // Remove depleted nodes
  state.entities = state.entities.filter((e) => !(e.kind === 'mineral' || e.kind === 'gas') || e.amount > 0);

  // Enemy waves
  if (state.nextWave != null) {
    state.nextWave -= dt;
    if (state.nextWave <= 0) {
      const n = Math.min(2 + Math.floor(state.time / 60), 6);
      for (let i = 0; i < n; i++) {
        const z = addEntity(state, { kind: 'zergling', owner: 'enemy', x: 1100 + (i * 37) % 120, y: 120 + (i * 23) % 80, maxHp: STATS.zergling.hp, hp: STATS.zergling.hp });
        z.order = { type: 'attackmove', x: 200, y: 540 };
      }
      state.nextWave = 50;
    }
  }

  // Win / loss
  const playerCC = state.entities.find((e) => e.owner === 'player' && e.kind === 'commandCenter' && e.hp > 0);
  const enemyCC = state.entities.find((e) => e.owner === 'enemy' && e.kind === 'commandCenter' && e.hp > 0);
  if (!playerCC) state.result = 'loss';
  else if (!enemyCC) state.result = 'win';

  // Remove corpses of mobile units
  state.entities = state.entities.filter((e) => e.hp > 0 || e.kind === 'commandCenter' || e.kind === 'barracks' || e.kind === 'depot');
  // Dead buildings stay as rubble (hp<=0) but block win check above since filtered by hp>0

  return state;
}

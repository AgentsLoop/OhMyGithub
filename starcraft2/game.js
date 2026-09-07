import { createState, setupScenario, trainUnit, placeBuilding, issueOrder, tick, COSTS } from './game-logic.mjs';

const WORLD = { w: 1280, h: 800 };
const state = setupScenario(createState());
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');

let cam = { x: 0, y: 0 };
let selected = new Set();
let box = null;
let placing = null;
let last = performance.now();
let msg = 'Select workers (drag), right-click mineral to harvest. Build a Barracks, train Marines, destroy the red Command Center!';
let msgT = 8;

const hud = {
  minerals: document.getElementById('minerals'),
  gas: document.getElementById('gas'),
  supply: document.getElementById('supply'),
  queue: document.getElementById('queue'),
  msg: document.getElementById('msg'),
  time: document.getElementById('time'),
  kills: document.getElementById('kills'),
};

function say(t, secs = 5) { msg = t; msgT = secs; }
function worldFromEvent(ev) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  return { x: (ev.clientX - r.left) * sx + cam.x, y: (ev.clientY - r.top) * sy + cam.y };
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  const p = worldFromEvent(e);
  if (e.button === 2) { // right click: smart order
    if (!selected.size) return;
    const ids = [...selected];
    const foe = state.entities.find((t) => t.hp > 0 && t.owner === 'enemy' && Math.hypot(t.x - p.x, t.y - p.y) < 40 && t.kind !== 'mineral');
    const node = state.entities.find((t) => (t.kind === 'mineral' || t.kind === 'gas') && Math.hypot(t.x - p.x, t.y - p.y) < 46);
    if (placing) return;
    if (foe) issueOrder(state, ids, { type: 'attack', targetId: foe.id });
    else if (node) issueOrder(state, ids, { type: 'harvest', targetId: node.id });
    else issueOrder(state, ids, { type: 'attackmove', x: p.x, y: p.y });
    ping(p.x, p.y);
    return;
  }
  if (placing) {
    const r = placeBuilding(state, placing, p.x, p.y);
    if (r.ok) { say(`${placing} under construction`, 3); placing = null; canvas.style.cursor = 'default'; }
    else say('Not enough minerals', 3);
    return;
  }
  box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
});
canvas.addEventListener('mousemove', (e) => {
  if (box) { const p = worldFromEvent(e); box.x1 = p.x; box.y1 = p.y; }
});
canvas.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || !box) return;
  const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1);
  const y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
  box = null;
  if (x1 - x0 < 8 && y1 - y0 < 8) {
    const p = worldFromEvent(e);
    const hit = [...state.entities].reverse().find((t) => t.hp > 0 && t.owner === 'player' && Math.hypot(t.x - p.x, t.y - p.y) < 34);
    selected = new Set(hit ? [hit.id] : []);
  } else {
    selected = new Set(state.entities.filter((t) => t.hp > 0 && t.owner === 'player' &&
      (t.kind === 'scv' || t.kind === 'marine') && t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1).map((t) => t.id));
  }
});

let pings = [];
function ping(x, y) { pings.push({ x, y, t: 0.6 }); }

// Buttons
document.querySelectorAll('[data-train]').forEach((b) => b.addEventListener('click', () => {
  const r = trainUnit(state, b.dataset.train);
  say(r.ok ? `Training ${b.dataset.train}…` : ({ 'need-barracks': 'Build a Barracks first (B)', 'need-cc': 'Command Center lost!', 'cant-afford': 'Cannot afford (need minerals/supply)' }[r.reason] || 'Denied'), 3);
}));
document.querySelectorAll('[data-build]').forEach((b) => b.addEventListener('click', () => {
  placing = b.dataset.build; canvas.style.cursor = 'crosshair';
  say(`Click map to place ${placing} — right-click cancels`, 4);
}));
window.addEventListener('keydown', (e) => {
  if (e.key === 'b' || e.key === 'B') placing = 'barracks';
  if (e.key === 's' || e.key === 'S') placing = 'depot';
  if (e.key === 'Escape') { placing = null; selected.clear(); canvas.style.cursor = 'default'; }
  if (e.key === 'a' || e.key === 'A') trainUnit(state, 'scv');
});
canvas.addEventListener('mouseleave', () => { box = null; });

function fitCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(640, Math.floor(r.width));
  canvas.height = Math.max(400, Math.floor(r.height * 0 + 560));
}
window.addEventListener('resize', fitCanvas); fitCanvas();

function draw() {
  // camera follows selection average, clamped
  const sel = state.entities.filter((e) => selected.has(e.id));
  if (sel.length) {
    const ax = sel.reduce((a, e) => a + e.x, 0) / sel.length;
    const ay = sel.reduce((a, e) => a + e.y, 0) / sel.length;
    cam.x += ((ax - canvas.width / 2) - cam.x) * 0.06;
    cam.y += ((ay - canvas.height / 2) - cam.y) * 0.06;
  }
  cam.x = Math.max(0, Math.min(WORLD.w - canvas.width, cam.x));
  cam.y = Math.max(0, Math.min(WORLD.h - canvas.height, cam.y));

  // terrain
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#10141c'); g.addColorStop(1, '#0a0f16');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = 'rgba(90,140,200,0.10)'; ctx.lineWidth = 1;
  for (let x = 0; x < WORLD.w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.h); ctx.stroke(); }
  for (let y = 0; y < WORLD.h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.w, y); ctx.stroke(); }

  for (const e of state.entities) {
    if (e.hp <= 0 && (e.kind === 'scv' || e.kind === 'marine' || e.kind === 'zergling')) continue;
    drawEntity(e);
  }
  // selection box
  if (box) {
    ctx.strokeStyle = '#37e08b'; ctx.setLineDash([6, 4]);
    ctx.strokeRect(Math.min(box.x0, box.x1), Math.min(box.y0, box.y1), Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
    ctx.setLineDash([]);
  }
  // pings
  for (const p of pings) {
    ctx.strokeStyle = `rgba(55,224,139,${p.t})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, (0.6 - p.t) * 60 + 8, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  drawMinimap();
}

function hpBar(e, w) {
  const pct = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - 30, w, 5);
  ctx.fillStyle = pct > 0.5 ? '#37e08b' : pct > 0.25 ? '#ffcf4d' : '#ff5d5d';
  ctx.fillRect(e.x - w / 2, e.y - 30, w * pct, 5);
}

function drawEntity(e) {
  const isSel = selected.has(e.id);
  if (isSel) { ctx.strokeStyle = '#37e08b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 24, 0, Math.PI * 2); ctx.stroke(); }
  if (e.kind === 'mineral') {
    ctx.fillStyle = '#4db2ff';
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-14, -14, 28, 28); ctx.strokeStyle = '#bfe6ff'; ctx.strokeRect(-14, -14, 28, 28);
    ctx.restore();
  } else if (e.kind === 'gas') {
    ctx.fillStyle = '#7dff9a'; ctx.beginPath(); ctx.arc(e.x, e.y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1d5c33'; ctx.stroke();
    ctx.fillStyle = '#06240f'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GAS', e.x, e.y + 4);
  } else if (e.kind === 'commandCenter') {
    ctx.fillStyle = e.owner === 'player' ? '#1f6feb' : '#c81e1e';
    ctx.fillRect(e.x - 46, e.y - 34, 92, 68);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(e.x - 46, e.y - 34, 92, 14);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.owner === 'player' ? 'COMMAND' : 'ENEMY HIVE', e.x, e.y + 4);
    hpBar(e, 92);
    if (e.underConstruction) { ctx.fillStyle = '#ffcf4d'; ctx.fillText('…', e.x, e.y - 36); }
  } else if (e.kind === 'barracks' || e.kind === 'depot') {
    ctx.fillStyle = e.kind === 'barracks' ? '#2f81f7' : '#8a6d2b';
    ctx.fillRect(e.x - 34, e.y - 24, 68, 48);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.kind.toUpperCase(), e.x, e.y + 4);
    hpBar(e, 68);
  } else if (e.kind === 'scv') {
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3200'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SCV', e.x, e.y + 3);
    if (e.carrying) { ctx.fillStyle = e.carrying === 'gas' ? '#7dff9a' : '#4db2ff'; ctx.fillRect(e.x - 4, e.y - 20, 8, 8); }
    hpBar(e, 30);
  } else if (e.kind === 'marine') {
    ctx.fillStyle = '#37e08b'; ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#063'; ctx.stroke();
    ctx.fillStyle = '#04120a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MAR', e.x, e.y + 3);
    hpBar(e, 30);
  } else if (e.kind === 'zergling') {
    ctx.fillStyle = '#ff5d5d'; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3d0000'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Z', e.x, e.y + 3);
    hpBar(e, 26);
  }
}

function drawMinimap() {
  mctx.fillStyle = '#05080d'; mctx.fillRect(0, 0, mini.width, mini.height);
  const sx = mini.width / WORLD.w, sy = mini.height / WORLD.h;
  for (const e of state.entities) {
    if (e.hp <= 0) continue;
    mctx.fillStyle = e.owner === 'player' ? '#2f81f7' : e.owner === 'enemy' ? '#ff5d5d' : e.kind === 'gas' ? '#7dff9a' : '#4db2ff';
    const s = e.kind === 'commandCenter' ? 6 : 3;
    mctx.fillRect(e.x * sx - s / 2, e.y * sy - s / 2, s, s);
  }
  mctx.strokeStyle = '#37e08b'; mctx.strokeRect(cam.x * sx, cam.y * sy, canvas.width * sx, canvas.height * sy);
}

function updateHud(dt) {
  hud.minerals.textContent = Math.floor(state.minerals);
  hud.gas.textContent = Math.floor(state.gas);
  hud.supply.textContent = `${state.supplyUsed}/${state.supplyCap}`;
  hud.time.textContent = `${String(Math.floor(state.time / 60)).padStart(2, '0')}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`;
  hud.kills.textContent = String(state.kills);
  hud.queue.textContent = state.queue.length ? `${state.queue[0].kind} ${Math.ceil(state.queue[0].remaining)}s (+${state.queue.length - 1})` : 'idle';
  msgT -= dt;
  hud.msg.textContent = state.result ? '' : msg;
  document.getElementById('overlay').style.display = state.result ? 'flex' : 'none';
  if (state.result) {
    document.getElementById('result-title').textContent = state.result === 'win' ? 'VICTORY' : 'DEFEAT';
    document.getElementById('result-sub').textContent = state.result === 'win'
      ? `Enemy Command Center destroyed in ${hud.time.textContent} — ${state.kills} kills, ${Math.floor(state.harvested)} minerals mined.`
      : 'Your Command Center has fallen. Rebuild, expand, and strike earlier next time.';
  }
  // trickle to avoid stalemate for demo
  state.minerals += dt * 0.4;
}

document.getElementById('restart').addEventListener('click', () => location.reload());

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!state.result) tick(state, dt);
  pings = pings.filter((p) => (p.t -= dt) > 0);
  updateHud(dt);
  draw();
  requestAnimationFrame(frame);
}
say(msg, 9);
requestAnimationFrame(frame);

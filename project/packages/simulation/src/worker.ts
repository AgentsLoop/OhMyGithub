/**
 * Simulation Worker entry — runs Simulation in a Web Worker.
 * This file is the ONLY place where Worker globals are accessed.
 * It keeps the rest of Simulation pure and headless-testable.
 */

import type { WorkerRequest, WorkerResponse, ScenarioConfig } from "@rts/contracts";
import { Simulation } from "./simulation.js";
import { FixedClock } from "./clock.js";

let sim: Simulation | null = null;
let timer: number | null = null;
let tickRate = 20;
const clock = new FixedClock();

function post(msg: WorkerResponse): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).postMessage(msg);
}

function startLoop(): void {
  if (timer !== null) return;
  const intervalMs = Math.round(1000 / tickRate);
  let last = performance.now();
  timer = self.setInterval(() => {
    if (!sim) return;
    const now = performance.now();
    const dt = now - last;
    last = now;
    // FixedClock is the deterministic accumulator; even if we currently step
    // one tick per interval, consuming dt proves the wall-clock path is
    // bounded and headless tests can drive the same ticks via stepN().
    const steps = clock.consume(dt);
    // deterministic accumulator: headless tests drive ticks via stepN(), wall path via consume().
    // clamp 1..4 to avoid spiral while keeping determinism
    const n = Math.min(4, Math.max(1, steps || 1));
    for (let i = 0; i < n; i++) {
      sim.step();
      clock.advanceOneTick();
    }
    const snap = sim.snapshot();
    post({ type: "snapshot", snapshot: snap });
    const ev = sim.drainEvents();
    if (ev.length > 0) post({ type: "events", events: ev });
  }, intervalMs) as unknown as number;
}

const BUILTIN_SCENARIOS: Record<string, ScenarioConfig> = {
  empty: {
    id: "empty",
    name: "Empty (baseline)",
    description: "No entities. Deterministic baseline for harness.",
    seed: 1,
    worldBounds: { width: 40, height: 40 },
    entities: [],
    tags: ["baseline"],
  },
  duel: {
    id: "duel",
    name: "Duel",
    description: "Two entities opposite corners — test movement determinism.",
    seed: 42,
    worldBounds: { width: 60, height: 60 },
    entities: [
      { id: "alpha", prototypeId: "scout", position: { x: -10, y: -10 } },
      { id: "bravo", prototypeId: "tank", position: { x: 10, y: 10 } },
    ],
    tags: ["movement", "smoke"],
  },
  squad: {
    id: "squad",
    name: "Squad (5)",
    description: "Five entities in formation — stress interpolation and culling.",
    seed: 1337,
    worldBounds: { width: 80, height: 80 },
    entities: [
      { id: "e0", prototypeId: "scout", position: { x: -12, y: 0 } },
      { id: "e1", prototypeId: "scout", position: { x: -6, y: 3 } },
      { id: "e2", prototypeId: "scout", position: { x: -6, y: -3 } },
      { id: "e3", prototypeId: "tank", position: { x: 0, y: 6 } },
      { id: "e4", prototypeId: "tank", position: { x: 0, y: -6 } },
    ],
    tags: ["formation"],
  },
};

function stopLoop(): void {
  if (timer !== null) {
    clearInterval(timer as unknown as number);
    timer = null;
  }
}

self.addEventListener("message", (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case "init": {
        tickRate = msg.tickRate ?? 20;
        sim = new Simulation({ seed: msg.seed });
        const first = BUILTIN_SCENARIOS["empty"];
        if (first) sim.loadScenario(first);
        post({ type: "ready", tick: sim.tick });
        post({ type: "snapshot", snapshot: sim.snapshot() });
        break;
      }
      case "start":
        startLoop();
        break;
      case "pause":
        stopLoop();
        break;
      case "step": {
        if (!sim) throw new Error("Simulation not initialized");
        const count = msg.count ?? 1;
        for (let i = 0; i < count; i++) sim.step();
        post({ type: "snapshot", snapshot: sim.snapshot() });
        post({ type: "events", events: sim.drainEvents() });
        break;
      }
      case "enqueueCommands": {
        if (!sim) throw new Error("Simulation not initialized");
        sim.enqueueCommands(msg.commands);
        break;
      }
      case "setScenario": {
        if (!sim) throw new Error("Simulation not initialized");
        const sc = BUILTIN_SCENARIOS[msg.scenarioId];
        if (!sc) throw new Error(`Unknown scenario ${msg.scenarioId}`);
        sim.loadScenario(sc);
        post({ type: "snapshot", snapshot: sim.snapshot() });
        post({ type: "scenarioList", scenarios: Object.keys(BUILTIN_SCENARIOS) });
        break;
      }
      case "reset": {
        if (!sim) sim = new Simulation({ seed: msg.seed ?? 42 });
        else {
          const first = BUILTIN_SCENARIOS["empty"];
          if (first) sim.loadScenario(first);
        }
        post({ type: "ready", tick: sim.tick });
        post({ type: "snapshot", snapshot: sim.snapshot() });
        break;
      }
      case "dispose":
        stopLoop();
        sim = null;
        break;
      default:
        post({ type: "error", message: `Unknown message type ${(msg as { type: string }).type}` });
    }
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
});

// notify ready immediately if needed
post({ type: "ready", tick: 0 as unknown as import("@rts/contracts").Tick });

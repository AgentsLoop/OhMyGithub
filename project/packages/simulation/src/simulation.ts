import type {
  Command,
  SimulationEvent,
  WorldSnapshot,
  EntitySnapshot,
  ScenarioConfig,
} from "@rts/contracts";
import { TICK_DT_MS } from "@rts/contracts";
import type { Tick, EntityId } from "@rts/contracts";
import { DeterministicRng } from "./rng.js";

/**
 * Minimal deterministic simulation.
 *
 * Invariants:
 * - No import of renderer, React, DOM, Node fs.
 * - All state is plain JSON-serializable.
 * - Fixed timestep (50ms), 20 Hz.
 * - Commands are queued and applied at their `atTick` or next tick.
 * - Snapshots are deterministic given same seed + commands.
 *
 * This class contains NO game logic (no economy, combat, pathfinding).
 * It is a scaffold for future systems — current movement is trivial lerp toward target for demo.
 */

type InternalEntity = {
  id: EntityId;
  position: { x: number; y: number };
  target: { x: number; y: number } | null;
  prototypeId: string;
  headingRad: number;
  speed: number; // units per second
};

function checksum(entities: InternalEntity[]): string {
  // simple deterministic hash: FNV-1a over positions
  let h = 2166136261;
  for (const e of entities) {
    const s = `${e.id}:${e.position.x.toFixed(3)},${e.position.y.toFixed(3)}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface SimulationOptions {
  seed: number;
  scenario?: ScenarioConfig | undefined;
}

export class Simulation {
  private rng: DeterministicRng;
  private tickNum: number = 0;
  private entities: Map<EntityId, InternalEntity> = new Map();
  private commandQueue: Command[] = [];
  private pendingEvents: SimulationEvent[] = [];
  private readonly seed: number;

  constructor(opts: SimulationOptions) {
    this.seed = opts.seed;
    this.rng = new DeterministicRng(opts.seed);
    if (opts.scenario) this.loadScenario(opts.scenario);
  }

  get tick(): Tick {
    return this.tickNum as Tick;
  }

  get timeMs(): number {
    return this.tickNum * TICK_DT_MS;
  }

  loadScenario(scenario: ScenarioConfig): void {
    this.entities.clear();
    this.commandQueue = [];
    this.pendingEvents = [];
    this.tickNum = 0;
    this.rng = new DeterministicRng(scenario.seed ?? this.seed);
    for (const e of scenario.entities) {
      this.entities.set(e.id as EntityId, {
        id: e.id as EntityId,
        position: { x: e.position.x, y: e.position.y },
        target: null,
        prototypeId: e.prototypeId,
        headingRad: e.headingRad ?? 0,
        speed: 3 + this.rng.nextFloat() * 2, // slight variation but deterministic per seed
      });
    }
  }

  enqueueCommands(commands: readonly Command[]): void {
    // validate and order
    for (const c of commands) {
      if (!c.kind || typeof c.seq !== "number") {
        this.pendingEvents.push({
          kind: "commandRejected",
          tick: this.tick,
          atMs: this.timeMs,
          reason: `Invalid command shape: ${JSON.stringify(c)}`,
          correlationId: (c as { correlationId?: string }).correlationId,
        });
        continue;
      }
      this.commandQueue.push(c);
    }
    // sort by atTick then seq for determinism
    this.commandQueue.sort((a, b) => {
      const ta = (a.atTick as number | undefined) ?? this.tickNum + 1;
      const tb = (b.atTick as number | undefined) ?? this.tickNum + 1;
      if (ta !== tb) return ta - tb;
      return a.seq - b.seq;
    });
  }

  /**
   * Advance by exactly one fixed tick. Returns events for this tick.
   */
  step(): readonly SimulationEvent[] {
    this.tickNum += 1;
    const tick = this.tick;
    const atMs = this.timeMs;
    const events: SimulationEvent[] = [];
    let processed = 0;

    // apply commands scheduled for this tick or earlier (if missed)
    const remaining: Command[] = [];
    for (const cmd of this.commandQueue) {
      const atTick = (cmd.atTick as number | undefined) ?? tick;
      if (atTick > (tick as number)) {
        remaining.push(cmd);
        continue;
      }
      processed++;
      this.applyCommand(cmd, tick, atMs, events);
    }
    this.commandQueue = remaining;

    // integrate movement
    for (const e of this.entities.values()) {
      if (e.target) {
        const dx = e.target.x - e.position.x;
        const dy = e.target.y - e.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          const from = { ...e.position };
          e.position = { ...e.target };
          e.target = null;
          events.push({
            kind: "entityMoved",
            tick,
            atMs,
            entityId: e.id,
            from,
            to: { ...e.position },
          });
        } else {
          const stepDist = e.speed * (TICK_DT_MS / 1000);
          const t = Math.min(1, stepDist / dist);
          const from = { ...e.position };
          e.position.x += dx * t;
          e.position.y += dy * t;
          e.headingRad = Math.atan2(dy, dx);
          events.push({
            kind: "entityMoved",
            tick,
            atMs,
            entityId: e.id,
            from,
            to: { ...e.position },
          });
        }
      }
    }

    events.push({ kind: "tickCompleted", tick, atMs, processedCommands: processed });
    this.pendingEvents.push(...events);
    return events;
  }

  /**
   * Step N ticks — useful for headless tests.
   */
  stepN(count: number): readonly SimulationEvent[][] {
    const all: SimulationEvent[][] = [];
    for (let i = 0; i < count; i++) all.push([...this.step()]);
    return all;
  }

  snapshot(): WorldSnapshot {
    const entities: EntitySnapshot[] = [...this.entities.values()]
      .map(e => ({
        id: e.id,
        position: { x: e.position.x, y: e.position.y },
        prototypeId: e.prototypeId,
        headingRad: e.headingRad,
        velocity: e.target
          ? { x: Math.cos(e.headingRad) * e.speed, y: Math.sin(e.headingRad) * e.speed }
          : undefined,
      }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));

    return {
      tick: this.tick,
      timeMs: this.timeMs,
      entities,
      checksum: checksum([...this.entities.values()]),
    };
  }

  drainEvents(): readonly SimulationEvent[] {
    const ev = [...this.pendingEvents];
    this.pendingEvents = [];
    return ev;
  }

  private applyCommand(cmd: Command, tick: Tick, atMs: number, events: SimulationEvent[]): void {
    switch (cmd.kind) {
      case "move": {
        const e = this.entities.get(cmd.entityId);
        if (!e) {
          events.push({
            kind: "commandRejected",
            tick,
            atMs,
            reason: `move: entity ${cmd.entityId} not found`,
            correlationId: cmd.correlationId,
          });
          return;
        }
        e.target = { x: cmd.target.x, y: cmd.target.y };
        break;
      }
      case "spawn": {
        if (this.entities.has(cmd.entityId)) {
          events.push({
            kind: "commandRejected",
            tick,
            atMs,
            reason: `spawn: entity ${cmd.entityId} already exists`,
            correlationId: cmd.correlationId,
          });
          return;
        }
        this.entities.set(cmd.entityId, {
          id: cmd.entityId,
          position: { x: cmd.position.x, y: cmd.position.y },
          target: null,
          prototypeId: cmd.prototypeId ?? "default",
          headingRad: 0,
          speed: 3 + this.rng.nextFloat() * 2,
        });
        events.push({
          kind: "entitySpawned",
          tick,
          atMs,
          entityId: cmd.entityId,
          position: { x: cmd.position.x, y: cmd.position.y },
        });
        break;
      }
      case "despawn": {
        const existed = this.entities.delete(cmd.entityId);
        if (!existed) {
          events.push({
            kind: "commandRejected",
            tick,
            atMs,
            reason: `despawn: entity ${cmd.entityId} not found`,
            correlationId: cmd.correlationId,
          });
          return;
        }
        events.push({ kind: "entityDespawned", tick, atMs, entityId: cmd.entityId });
        break;
      }
      case "noop":
        break;
      default: {
        const _exhaustive: never = cmd;
        events.push({
          kind: "commandRejected",
          tick,
          atMs,
          reason: `Unknown command kind: ${(_exhaustive as { kind: string }).kind}`,
        });
      }
    }
  }
}

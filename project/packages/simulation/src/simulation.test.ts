import { describe, it, expect } from "vitest";
import { Simulation } from "./simulation.js";
import { DeterministicRng } from "./rng.js";
import type { ScenarioConfig } from "@rts/contracts";

const emptyScenario: ScenarioConfig = {
  id: "empty",
  name: "Empty",
  description: "empty",
  seed: 123,
  worldBounds: { width: 20, height: 20 },
  entities: [],
};

const twoEntities: ScenarioConfig = {
  id: "two",
  name: "Two",
  description: "two entities",
  seed: 42,
  worldBounds: { width: 40, height: 40 },
  entities: [
    { id: "a", prototypeId: "scout", position: { x: 0, y: 0 } },
    { id: "b", prototypeId: "tank", position: { x: 10, y: 10 } },
  ],
};

describe("DeterministicRng", () => {
  it("is deterministic for same seed", () => {
    const a = new DeterministicRng(42);
    const b = new DeterministicRng(42);
    for (let i = 0; i < 10; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });
  it("diverges for different seeds", () => {
    const a = new DeterministicRng(1);
    const b = new DeterministicRng(2);
    expect(a.nextUint32()).not.toBe(b.nextUint32());
  });
});

describe("Simulation", () => {
  it("empty scenario produces stable checksum", () => {
    const s = new Simulation({ seed: 1, scenario: emptyScenario });
    const snap0 = s.snapshot();
    expect(snap0.entities).toHaveLength(0);
    s.step();
    const snap1 = s.snapshot();
    expect(snap1.tick).toBe(1);
    expect(snap1.checksum).toBe(snap0.checksum);
  });

  it("deterministic: same seed + commands => same snapshots", () => {
    const make = (): Simulation => {
      const sim = new Simulation({ seed: 99, scenario: twoEntities });
      sim.enqueueCommands([
        {
          kind: "move",
          entityId: "a" as unknown as import("@rts/contracts").EntityId,
          playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
          seq: 1,
          target: { x: 20, y: 0 },
        },
      ]);
      sim.stepN(10);
      return sim;
    };
    const snapA = make().snapshot();
    const snapB = make().snapshot();
    expect(snapA).toEqual(snapB);
    expect(snapA.checksum).toBe(snapB.checksum);
  });

  it("spawn and despawn emit events", () => {
    const sim = new Simulation({ seed: 7, scenario: emptyScenario });
    sim.enqueueCommands([
      {
        kind: "spawn",
        entityId: "x" as unknown as import("@rts/contracts").EntityId,
        playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
        seq: 1,
        position: { x: 5, y: 5 },
        prototypeId: "scout",
      },
    ]);
    const evs = sim.step();
    expect(evs.some(e => e.kind === "entitySpawned")).toBe(true);
    expect(sim.snapshot().entities).toHaveLength(1);

    sim.enqueueCommands([
      {
        kind: "despawn",
        entityId: "x" as unknown as import("@rts/contracts").EntityId,
        playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
        seq: 2,
      },
    ]);
    const evs2 = sim.step();
    expect(evs2.some(e => e.kind === "entityDespawned")).toBe(true);
    expect(sim.snapshot().entities).toHaveLength(0);
  });

  it("headless fixed timestep: stepN advances tick deterministically", () => {
    const sim = new Simulation({ seed: 5, scenario: twoEntities });
    sim.stepN(60);
    expect(sim.tick).toBe(60);
    expect(sim.timeMs).toBe(60 * 50);
  });

  it("rejects unknown entity move", () => {
    const sim = new Simulation({ seed: 1, scenario: emptyScenario });
    sim.enqueueCommands([
      {
        kind: "move",
        entityId: "ghost" as unknown as import("@rts/contracts").EntityId,
        playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
        seq: 1,
        target: { x: 1, y: 1 },
      },
    ]);
    const evs = sim.step();
    expect(evs.some(e => e.kind === "commandRejected")).toBe(true);
  });

  it("snapshot checksum changes when entity moves", () => {
    const sim = new Simulation({ seed: 1, scenario: twoEntities });
    const before = sim.snapshot().checksum;
    sim.enqueueCommands([
      {
        kind: "move",
        entityId: "a" as unknown as import("@rts/contracts").EntityId,
        playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
        seq: 1,
        target: { x: 30, y: 0 },
      },
    ]);
    sim.stepN(20);
    const after = sim.snapshot().checksum;
    expect(after).not.toBe(before);
  });
});

import type { EntityId, Tick, Vec2 } from "./types.js";

/**
 * Snapshot — authoritative state of the world at a given tick.
 * Must be JSON-serializable, deep-cloneable via structuredClone/JSON.
 * Renderer consumes snapshots only; never mutates them.
 */

export interface EntitySnapshot {
  readonly id: EntityId;
  readonly position: Vec2;
  readonly prototypeId: string;
  readonly headingRad: number;
  /** Optional velocity for interpolation */
  readonly velocity?: Vec2 | undefined;
}

export interface WorldSnapshot {
  readonly tick: Tick;
  readonly timeMs: number; // tick * TICK_DT_MS
  readonly entities: readonly EntitySnapshot[];
  /** Hash for determinism check (e.g., simple checksum). Filled by simulation. */
  readonly checksum: string;
}

export function emptySnapshot(tick: Tick): WorldSnapshot {
  return {
    tick,
    timeMs: (tick as number) * 50,
    entities: [],
    checksum: "00000000",
  };
}

/**
 * Snapshot diff helper — for renderer interpolation.
 */
export function snapshotEquals(a: WorldSnapshot, b: WorldSnapshot): boolean {
  return a.checksum === b.checksum && a.tick === b.tick;
}

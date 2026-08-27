import type { EntityId, Tick, Vec2 } from "./types.js";

/**
 * Events — facts emitted by simulation after processing commands.
 * Events are append-only, deterministic and replayable.
 */

export type EventKind =
  "entitySpawned" | "entityMoved" | "entityDespawned" | "tickCompleted" | "commandRejected";

export interface BaseEvent {
  readonly kind: EventKind;
  readonly tick: Tick;
  readonly atMs: number; // wall-clock of tick start (for debugging only, not for determinism)
}

export interface EntitySpawnedEvent extends BaseEvent {
  readonly kind: "entitySpawned";
  readonly entityId: EntityId;
  readonly position: Vec2;
}

export interface EntityMovedEvent extends BaseEvent {
  readonly kind: "entityMoved";
  readonly entityId: EntityId;
  readonly from: Vec2;
  readonly to: Vec2;
}

export interface EntityDespawnedEvent extends BaseEvent {
  readonly kind: "entityDespawned";
  readonly entityId: EntityId;
}

export interface TickCompletedEvent extends BaseEvent {
  readonly kind: "tickCompleted";
  readonly processedCommands: number;
}

export interface CommandRejectedEvent extends BaseEvent {
  readonly kind: "commandRejected";
  readonly reason: string;
  readonly correlationId?: string | undefined;
}

export type SimulationEvent =
  | EntitySpawnedEvent
  | EntityMovedEvent
  | EntityDespawnedEvent
  | TickCompletedEvent
  | CommandRejectedEvent;

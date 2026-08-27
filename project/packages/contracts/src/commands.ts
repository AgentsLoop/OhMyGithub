import type { EntityId, PlayerId, Tick, Vec2 } from "./types.js";

/**
 * Commands — intents from shell/UI/network toward simulation.
 * All commands are validated at simulation boundary; unknown kind is rejected.
 * Deterministic: commands are ordered by (tick, seq).
 */

export type CommandKind = "move" | "spawn" | "despawn" | "noop";

export interface BaseCommand {
  readonly kind: CommandKind;
  /** Player who issued the command */
  readonly playerId: PlayerId;
  /** Target tick for execution (authoritative). If omitted — next tick. */
  readonly atTick?: Tick | undefined;
  /** Monotonic per-player sequence for ordering */
  readonly seq: number;
  /** Optional correlation id for UI feedback */
  readonly correlationId?: string | undefined;
}

export interface MoveCommand extends BaseCommand {
  readonly kind: "move";
  readonly entityId: EntityId;
  readonly target: Vec2;
}

export interface SpawnCommand extends BaseCommand {
  readonly kind: "spawn";
  readonly entityId: EntityId;
  readonly position: Vec2;
  readonly prototypeId?: string | undefined;
}

export interface DespawnCommand extends BaseCommand {
  readonly kind: "despawn";
  readonly entityId: EntityId;
}

export interface NoopCommand extends BaseCommand {
  readonly kind: "noop";
}

export type Command = MoveCommand | SpawnCommand | DespawnCommand | NoopCommand;

export function isCommand(value: unknown): value is Command {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["kind"] === "string" &&
    typeof v["playerId"] === "string" &&
    typeof v["seq"] === "number" &&
    ["move", "spawn", "despawn", "noop"].includes(v["kind"] as string)
  );
}

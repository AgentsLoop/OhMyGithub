import type { Command } from "./commands.js";
import type { SimulationEvent } from "./events.js";
import type { WorldSnapshot } from "./snapshot.js";
import type { Tick } from "./types.js";

/**
 * Worker protocol — messages between dev-shell (main thread) and simulation Worker.
 * All payloads are structured-cloneable. No functions, no class instances.
 */

// main -> worker
export type WorkerRequest =
  | { readonly type: "init"; readonly seed: number; readonly tickRate?: number | undefined }
  | { readonly type: "start" }
  | { readonly type: "pause" }
  | { readonly type: "step"; readonly count?: number | undefined }
  | { readonly type: "enqueueCommands"; readonly commands: readonly Command[] }
  | { readonly type: "setScenario"; readonly scenarioId: string }
  | { readonly type: "reset"; readonly seed?: number | undefined }
  | { readonly type: "dispose" };

// worker -> main
export type WorkerResponse =
  | { readonly type: "ready"; readonly tick: Tick }
  | { readonly type: "snapshot"; readonly snapshot: WorldSnapshot }
  | { readonly type: "events"; readonly events: readonly SimulationEvent[] }
  | { readonly type: "error"; readonly message: string; readonly stack?: string | undefined }
  | { readonly type: "pong"; readonly tick: Tick }
  | { readonly type: "scenarioList"; readonly scenarios: readonly string[] };

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["type"] === "string";
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["type"] === "string";
}

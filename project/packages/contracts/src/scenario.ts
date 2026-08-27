import type { Vec2 } from "./types.js";

/**
 * Scenario — declarative JSON that drives simulation initial conditions.
 * Stored as JSON files under `assets/scenarios/` or `packages/simulation-world/scenarios/`.
 * LLM can add new scenarios by adding a JSON file that validates against this type.
 */

export interface ScenarioEntity {
  readonly id: string;
  readonly prototypeId: string;
  readonly position: Vec2;
  readonly headingRad?: number | undefined;
}

export interface ScenarioConfig {
  /** Unique id, maps to filename without extension */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly seed: number;
  readonly tickRate?: number | undefined;
  readonly worldBounds: { readonly width: number; readonly height: number };
  readonly entities: readonly ScenarioEntity[];
  /** Future: terrain, resources, etc. Kept minimal. */
  readonly tags?: readonly string[] | undefined;
}

export function validateScenarioConfig(value: unknown): asserts value is ScenarioConfig {
  if (typeof value !== "object" || value === null) throw new Error("Scenario must be object");
  const v = value as Record<string, unknown>;
  if (typeof v["id"] !== "string") throw new Error("Scenario.id must be string");
  if (typeof v["name"] !== "string") throw new Error("Scenario.name must be string");
  if (!Array.isArray(v["entities"])) throw new Error("Scenario.entities must be array");
}

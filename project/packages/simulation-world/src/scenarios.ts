import type { ScenarioConfig } from "@rts/contracts";

/**
 * Declarative scenarios — JSON-serializable, versioned in Git.
 * LLM adds new scenarios by adding JSON files that conform to ScenarioConfig.
 * Keep logic-free: scenarios are data, not code.
 */

export const emptyScenario: ScenarioConfig = {
  id: "empty",
  name: "Empty (baseline)",
  description: "No entities. Deterministic baseline for harness.",
  seed: 1,
  worldBounds: { width: 40, height: 40 },
  entities: [],
  tags: ["baseline"],
};

export const duelScenario: ScenarioConfig = {
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
};

export const squadScenario: ScenarioConfig = {
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
};

const registry: Record<string, ScenarioConfig> = {
  [emptyScenario.id]: emptyScenario,
  [duelScenario.id]: duelScenario,
  [squadScenario.id]: squadScenario,
};

export function getScenario(id: string): ScenarioConfig | undefined {
  return registry[id];
}

export function listScenarios(): readonly ScenarioConfig[] {
  return Object.values(registry);
}

export function emptyScenarios(): readonly ScenarioConfig[] {
  return listScenarios();
}

import type { ScenarioConfig, WorldSnapshot } from "@rts/contracts";
import { Simulation } from "@rts/simulation";

/**
 * World facade — thin wrapper around Simulation that exposes scenario loading.
 * Keeps future game-specific systems (economy, combat, pathfinding) out of
 * the core Simulation. For now it is deliberately empty; it exists so LLM
 * can add systems here without touching the deterministic core.
 *
 * Invariant: this package never imports @rts/renderer.
 */

export class World {
  private readonly sim: Simulation;
  private scenario: ScenarioConfig;

  constructor(initial: ScenarioConfig) {
    this.scenario = initial;
    this.sim = new Simulation({ seed: initial.seed, scenario: initial });
  }

  get tick(): number {
    return this.sim.tick as number;
  }

  loadScenario(config: ScenarioConfig): void {
    this.scenario = config;
    this.sim.loadScenario(config);
  }

  getScenario(): ScenarioConfig {
    return this.scenario;
  }

  get simulation(): Simulation {
    return this.sim;
  }

  snapshot(): WorldSnapshot {
    return this.sim.snapshot();
  }
}

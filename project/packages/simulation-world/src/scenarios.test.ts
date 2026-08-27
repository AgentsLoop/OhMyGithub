import { describe, it, expect } from "vitest";
import { listScenarios, getScenario, emptyScenario } from "./scenarios.js";
import { World } from "./world.js";

describe("scenarios", () => {
  it("list contains at least empty, duel, squad", () => {
    const ids = listScenarios().map(s => s.id);
    expect(ids).toContain("empty");
    expect(ids).toContain("duel");
    expect(ids).toContain("squad");
  });

  it("getScenario returns copy", () => {
    expect(getScenario("empty")).toBeDefined();
    expect(getScenario("missing")).toBeUndefined();
  });

  it("World loads scenario deterministically", () => {
    const w = new World(emptyScenario);
    expect(w.snapshot().entities).toHaveLength(0);
    const duel = getScenario("duel");
    if (!duel) throw new Error("missing duel");
    w.loadScenario(duel);
    expect(w.snapshot().entities).toHaveLength(2);
  });
});

import { useState } from "react";
import { BabylonCanvas } from "./BabylonCanvas.js";
import { useSimulation } from "./useSimulation.js";
import { listScenarios } from "@rts/simulation-world";

export function App() {
  const sim = useSimulation();
  const [scenarioId, setScenarioId] = useState("empty");
  const scenarios = listScenarios();

  return (
    <div className="shell">
      <header className="topbar">
        <h1>RTS Platform — Dev Shell</h1>
        <span className="tag">LLM-first • deterministic • headless</span>
        <span className="tag">Babylon.js 7</span>
        <div className="spacer" />
        <span className="badge">
          <span className={`status-dot ${sim.running ? "ok" : "idle"}`} />
          {sim.running ? "running" : "paused"}
        </span>
        <button className="btn" onClick={sim.toggleRun} data-testid="toggle-run">
          {sim.running ? "Pause" : "Start"}
        </button>
        <button className="btn secondary" onClick={sim.stepOnce} data-testid="step-once">
          Step
        </button>
      </header>

      <div className="canvasWrap">
        <BabylonCanvas snapshot={sim.snapshot} />
        <div className="hud" data-testid="hud">
          <h3>Debug HUD</h3>
          <div className="row">
            <span>Tick</span>
            <span className="val" data-testid="hud-tick">
              {sim.tick}
            </span>
          </div>
          <div className="row">
            <span>Entities</span>
            <span className="val" data-testid="hud-entities">
              {sim.snapshot?.entities.length ?? 0}
            </span>
          </div>
          <div className="row">
            <span>Checksum</span>
            <span className="val" style={{ fontSize: "10px" }} data-testid="hud-checksum">
              {sim.snapshot?.checksum ?? "—"}
            </span>
          </div>
          <div className="row">
            <span>FPS (shell)</span>
            <span className="val" data-testid="hud-fps">
              {sim.fps}
            </span>
          </div>
          <div className="row">
            <span>Scenario</span>
            <span className="val">{scenarioId}</span>
          </div>
        </div>
      </div>

      <aside className="side">
        <div className="section">
          <h2>Scenario</h2>
          <select
            className="select"
            value={scenarioId}
            onChange={e => {
              const id = e.target.value;
              setScenarioId(id);
              sim.setScenario(id);
            }}
            data-testid="scenario-select"
          >
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.id}
              </option>
            ))}
          </select>
          <p
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              lineHeight: "16px",
              margin: "8px 0 0",
            }}
          >
            {scenarios.find(s => s.id === scenarioId)?.description}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn secondary" onClick={sim.reset} data-testid="reset-btn">
              Reset
            </button>
            <button
              className="btn secondary"
              onClick={() => sim.stepMany(10)}
              data-testid="step10-btn"
            >
              Step ×10
            </button>
          </div>
        </div>

        <div className="section">
          <h2>Commands</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn secondary" onClick={sim.spawnRandom} data-testid="spawn-btn">
              Spawn random
            </button>
            <button className="btn secondary" onClick={sim.moveRandom} data-testid="move-btn">
              Move random
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: 8 }}>
            Commands → Worker → Simulation (fixed 20 Hz). Snapshots are JSON-serializable.
          </p>
        </div>

        <div className="section">
          <h2>Snapshot (JSON)</h2>
          <div className="log" data-testid="snapshot-log">
            {sim.snapshot ? JSON.stringify(sim.snapshot, null, 2) : "— waiting for snapshot —"}
          </div>
        </div>

        <div className="section">
          <h2>Events</h2>
          <div className="log" data-testid="events-log">
            {sim.eventsLog.length === 0 ? "— no events —" : sim.eventsLog.join("\n")}
          </div>
        </div>

        <div className="section">
          <h2>Boundaries</h2>
          <div className="kv">
            <span>contracts</span>
            <span className="badge">zero deps</span>
          </div>
          <div className="kv">
            <span>simulation</span>
            <span className="badge">no renderer</span>
          </div>
          <div className="kv">
            <span>renderer</span>
            <span className="badge">Babylon only</span>
          </div>
          <div className="kv">
            <span>dev-shell</span>
            <span className="badge">wires all</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: 8 }}>
            ESLint `boundaries/element-types` enforces this. Run <code>pnpm lint</code>.
          </p>
        </div>

        <div className="section">
          <h2>Assets</h2>
          <div className="kv">
            <span>models</span>
            <span className="badge">assets/models/*.glb</span>
          </div>
          <div className="kv">
            <span>textures</span>
            <span className="badge">assets/textures/*.ktx2</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: 8 }}>
            Placeholder loaders in <code>packages/renderer</code>. Real GLB/KTX2 future-proof.
          </p>
        </div>
      </aside>
    </div>
  );
}

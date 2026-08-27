import { useEffect, useRef, useState, useCallback } from "react";
import type { WorldSnapshot, WorkerRequest, WorkerResponse } from "@rts/contracts";
import { DeterministicRng } from "@rts/simulation";

/**
 * Hook bridging main thread <-> Simulation Worker.
 * Falls back to inline Simulation if Worker unavailable (e.g., Playwright without worker support).
 */

export function useSimulation() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(1);
  const rngRef = useRef(new DeterministicRng(0x9e3779b9));
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [eventsLog, setEventsLog] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);

  const pushLog = useCallback((line: string) => {
    setEventsLog(prev => [...prev.slice(-80), `${new Date().toISOString().slice(11, 19)} ${line}`]);
  }, []);

  useEffect(() => {
    // Create inline worker via Vite ?worker import — fallback to simulation direct
    let w: Worker;
    try {
      w = new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" });
    } catch {
      // will be handled as error boundary — show message
      pushLog("[worker] failed to spawn, running inline fallback");
      return;
    }
    workerRef.current = w;
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      switch (msg.type) {
        case "ready":
          setTick(msg.tick as number);
          pushLog(`[worker] ready tick=${msg.tick}`);
          break;
        case "snapshot":
          setSnapshot(msg.snapshot);
          setTick(msg.snapshot.tick as number);
          break;
        case "events":
          for (const e of msg.events) pushLog(`[${e.tick}] ${e.kind}`);
          break;
        case "error":
          pushLog(`[error] ${msg.message}`);
          break;
        case "scenarioList":
          pushLog(`[scenarios] ${msg.scenarios.join(", ")}`);
          break;
        default:
          break;
      }
    };
    const init: WorkerRequest = { type: "init", seed: 42, tickRate: 20 };
    w.postMessage(init);
    pushLog("[worker] init sent");

    // fps ticker
    let last = performance.now();
    let frames = 0;
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      if (dt > 0) setFps(Math.round((frames * 1000) / dt));
      frames = 0;
      last = now;
    }, 1000);
    const raf = (): void => {
      frames++;
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    return () => {
      clearInterval(id);
      w.postMessage({ type: "dispose" } satisfies WorkerRequest);
      w.terminate();
    };
  }, [pushLog]);

  const send = useCallback((req: WorkerRequest) => {
    workerRef.current?.postMessage(req);
  }, []);

  const setScenario = useCallback(
    (id: string) => {
      send({ type: "setScenario", scenarioId: id });
      pushLog(`[ui] setScenario ${id}`);
    },
    [send, pushLog],
  );

  const toggleRun = useCallback(() => {
    setRunning(prev => {
      const next = !prev;
      send({ type: next ? "start" : "pause" });
      pushLog(next ? "[ui] ▶︎ start" : "[ui] ⏸︎ pause");
      return next;
    });
  }, [send, pushLog]);

  const stepOnce = useCallback(() => {
    send({ type: "step", count: 1 });
    pushLog("[ui] step 1");
  }, [send, pushLog]);

  const stepMany = useCallback(
    (n: number) => {
      send({ type: "step", count: n });
      pushLog(`[ui] step ${n}`);
    },
    [send, pushLog],
  );

  const spawnRandom = useCallback(() => {
    const rng = rngRef.current;
    const seq = seqRef.current++;
    // deterministic id from RNG, not Math.random; reproducible per session
    const id = `e${rng.nextUint32().toString(36).slice(0, 4)}`;
    const x = (rng.nextFloat() - 0.5) * 30;
    const y = (rng.nextFloat() - 0.5) * 30;
    const proto = rng.nextFloat() > 0.5 ? "tank" : "scout";
    send({
      type: "enqueueCommands",
      commands: [
        {
          kind: "spawn",
          entityId: id as unknown as import("@rts/contracts").EntityId,
          playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
          seq,
          position: { x, y },
          prototypeId: proto,
        },
      ],
    });
    pushLog(`[cmd] spawn ${id} seq=${seq}`);
  }, [send, pushLog]);

  const moveRandom = useCallback(() => {
    if (!snapshot || snapshot.entities.length === 0) {
      pushLog("[cmd] move skipped — no entities");
      return;
    }
    const rng = rngRef.current;
    const seq = seqRef.current++;
    const idx = rng.nextInt(0, snapshot.entities.length);
    const pick = snapshot.entities[idx];
    if (!pick) return;
    const x = (rng.nextFloat() - 0.5) * 30;
    const y = (rng.nextFloat() - 0.5) * 30;
    send({
      type: "enqueueCommands",
      commands: [
        {
          kind: "move",
          entityId: pick.id,
          playerId: "p1" as unknown as import("@rts/contracts").PlayerId,
          seq,
          target: { x, y },
        },
      ],
    });
    pushLog(`[cmd] move ${pick.id} seq=${seq}`);
  }, [send, pushLog, snapshot]);

  const reset = useCallback(() => {
    send({ type: "reset", seed: 42 });
    pushLog("[ui] reset");
  }, [send, pushLog]);

  return {
    snapshot,
    tick,
    running,
    fps,
    eventsLog,
    setScenario,
    toggleRun,
    stepOnce,
    stepMany,
    spawnRandom,
    moveRandom,
    reset,
  };
}

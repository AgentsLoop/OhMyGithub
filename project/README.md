# RTS Platform — LLM-first Foundation

Minimal, transparent, mechanically verifiable foundation for future 3D RTS development.  
**Goal of this stage:** not to build a game, engine, economy or combat — but to build the _environment where an LLM can safely build those systems later_.

## Principles

- **Source of truth:** TypeScript + JSON + Markdown in Git. No binary scenes, no hidden editor state.
- **LLM-optimised:** small focused packages, explicit dependency boundaries, JSON-serializable contracts.
- **Determinism:** fixed-timestep simulation (20 Hz, `TICK_DT_MS=50`), seedable RNG, snapshot checksums.
- **Isolation:** `simulation` never imports `renderer` / React / DOM; `contracts` has zero deps.
- **Verifiability:** headless Vitest + Playwright browser tests + ESLint boundary checks run identically locally and in CI.

## Tech Stack

| Layer      | Choice                                                                               |
| ---------- | ------------------------------------------------------------------------------------ |
| Language   | TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` etc. |
| Monorepo   | pnpm workspaces (pinned via `packageManager`)                                        |
| Build      | Vite 6                                                                               |
| 3D         | Babylon.js 7 (`@babylonjs/core`, `@babylonjs/loaders`)                               |
| UI         | React 18 — only for debug HUD/tools in `apps/dev-shell`                              |
| Simulation | Web Worker + fixed timestep, headless Vitest                                         |
| Tests      | Vitest (unit/integration) + Playwright (browser/input/visual)                        |
| Assets     | `assets/models/*.glb`, `assets/textures/*.ktx2` (placeholders)                       |
| Lint       | ESLint 9 flat + `eslint-plugin-boundaries` + Prettier                                |

Pinned versions: Node `22.23.2` (`.nvmrc` / `.node-version`), pnpm `9.12.3` (`packageManager`).

## Monorepo Layout

```
apps/
  dev-shell/          # Vite + React + Babylon canvas + Worker bridge
packages/
  contracts/          # Commands, Events, Snapshots, Worker protocol — ZERO deps
  simulation/         # Deterministic fixed-step simulation, headless, no renderer
  simulation-world/   # Scenario registry + World facade (future systems live here)
  renderer/           # Babylon.js thin layer — consumes snapshots only
assets/
  models/             # future .glb
  textures/           # future .ktx2
e2e/                  # Playwright tests
docs/
```

Dependency boundaries (enforced by `eslint`):

- `contracts → []`
- `simulation → [contracts]`
- `simulation-world → [contracts, simulation]`
- `renderer → [contracts]`
- `dev-shell → [contracts, simulation, simulation-world, renderer]`

Importing `react` or `@babylonjs/*` outside allowed packages fails lint.

## Commands (local === CI)

```bash
pnpm install

pnpm dev            # dev-shell on http://localhost:5173
pnpm build          # all packages + dev-shell
pnpm typecheck      # tsc --noEmit per package
pnpm lint           # eslint with boundary checks
pnpm format         # prettier --check
pnpm test           # vitest run (headless simulation)
pnpm test:e2e       # playwright (requires built shell or pnpm dev)
pnpm check          # typecheck + lint + format + test
```

## Scenarios

Scenarios are data, not code — JSON-serializable `ScenarioConfig` in `packages/simulation-world/src/scenarios.ts`.  
LLM adds a scenario by adding a new entry (or JSON file) that validates against `ScenarioConfig`:

```ts
export const myScenario: ScenarioConfig = {
  id: "my-map",
  name: "My Map",
  seed: 123,
  worldBounds: { width: 60, height: 60 },
  entities: [{ id: "e0", prototypeId: "scout", position: { x: 0, y: 0 } }],
};
```

Register in `registry` and it appears in the dev-shell dropdown automatically. No editor.

## Worker Protocol

Main ↔ Worker is `structuredClone`-able JSON:

- `main → worker`: `init`, `start`, `pause`, `step`, `enqueueCommands`, `setScenario`, `reset`
- `worker → main`: `ready`, `snapshot`, `events`, `error`

Types live in `packages/contracts/src/worker-protocol.ts`.

## Rendering

`packages/renderer/src/createRenderer.ts` maps `WorldSnapshot` → Babylon meshes. GLB/KTX2 loading is stubbed (`loadGlbPlaceholder` / `loadKtx2Placeholder`) — path validation only, real loading will use `SceneLoader` + KTX2 decoder. Keeps the glTF/ktx2 future declared without binary assets now.

## Testing

- **Vitest** — `packages/simulation/src/simulation.test.ts` proves determinism, command rejection, checksum drift.
- **Playwright** — `e2e/dev-shell.spec.ts` checks shell boots, HUD shows tick, canvas renders, scenario switch, spawn/move.
- **Boundaries** — `pnpm lint` fails if `simulation` imports Babylon.

## Adding Game Systems (future)

Create a new package (e.g., `packages/combat/`) or extend `simulation-world`:

1. Define new `Command`/`Event` kinds in `contracts` (add union members).
2. Handle them in `Simulation.applyCommand` or a new system in `simulation-world`.
3. Add Vitest covering determinism.
4. No changes to `renderer` contract — it still just renders snapshots.

All logic stays inspectable as TS diffs.

## CI

All `pnpm` commands are hermetic — same Node/pnpm versions, same ESLint/Prettier/Vitest/Playwright. No environment-specific scripts. Pinning doc: `docs/pinning.md`.

## License

MIT — see `packages/*/package.json`.

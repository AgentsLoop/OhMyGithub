# Architecture — LLM-first constraints

## Why this shape

- LLM reads Git, not editor inspectors. So source of truth is TS/JSON/MD.
- LLM edits must be locally verifiable. So every package has `pnpm typecheck && pnpm lint` and `pnpm test`.
- LLM must not leak renderer into simulation. So ESLint boundary rule `boundaries/element-types` + `no-restricted-imports`.

## Package contracts

### contracts (zero deps)

Types only. No `import` from any package. No Babylon, React, DOM, Node. Exports: `Command`, `SimulationEvent`, `WorldSnapshot`, `WorkerRequest/Response`, `ScenarioConfig`.

### simulation (deterministic)

Owns `Simulation`, `FixedClock`, `DeterministicRng`. Fixed 20 Hz, `step()` advances exactly one tick. `snapshot()` returns deep-clone-safe JSON with `checksum`. Headless: `pnpm test` runs in Node without canvas.

### simulation-world

Data: `scenarios.ts` registry. Facade: `World` wraps `Simulation` for scenario loading. Future systems (economy etc.) live here, not in `simulation` core.

### renderer

`createRenderer(canvas)` → `{ engine, scene, renderSnapshot }`. Maps snapshot entities to Babylon meshes. `loadGlbPlaceholder` / `loadKtx2Placeholder` declare future asset paths.

### dev-shell

Vite app. Owns `BabylonCanvas`, `useSimulation` hook (Worker bridge), React HUD, scenario selector. Only place allowed to import all packages.

## Assets

- `assets/models/*.glb` — future glTF binary. Not committed now; `loadGlbPlaceholder` validates path prefix.
- `assets/textures/*.ktx2` — future compressed textures. Same stub.
- No `.blend`, no `.unity`, no editor meta.

## Testing layers

1. **Unit** — `simulation` determinism (Vitest).
2. **Integration** — `simulation-world` scenario loading.
3. **Browser** — Playwright `e2e/dev-shell.spec.ts` (HUD, canvas, scenario switch, commands).

## Future hooks

- Add package `packages/pathfinding` that depends on `contracts`+`simulation` only.
- Add `packages/combat` similarly.
- Each new package gets a boundary rule in `eslint.config.js` before code lands.

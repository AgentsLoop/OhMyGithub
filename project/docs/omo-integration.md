# OMO Integration — From Agent Orchestration to Squad AI

## Concept

`oh-my-openagent` (now `oh-my-opencode`) orchestrates work through a **Sisyphus orchestrator** that delegates to 11 discipline agents — each with a focused prompt, model, and toolset — then folds their results under a single config surface (`omo.jsonc`). This game's **Squad AI** reuses that idea literally in gameplay.

## Mapping: OMO → Squad

| OMO agent | Game role | Behavior |
|---|---|---|
| **sisyphus** (orchestrator) | **Squad Lead** | Picks sector to push, decides flank vs. suppress, owns kill-feed bookkeeping |
| **hephaestus** (deep implementer) | **Breacher** (close) | Rushes when player reloads or is isolated; high aggression |
| **prometheus** (planner) | **Flanker** | Circles perpendicular to LOS — `dir ⊥` strafe (`sin(t)` in `src/main.js:updateEnemies`) |
| **oracle** (architecture/debug) | **Marksman** | Holds mid-range, peeks from cover, 15% higher hit chance |
| **librarian** (docs/search) | **Spotter** | Keeps LOS, exposes player pos to squad (minimap sharing) |
| **explore** (fast grep) | **Scout** | Fast strafe, triggers reposition |
| **multimodal-looker** | **Point** | Leads pushes into warehouse center |
| **metis** (plan reviewer) | **Cover** | Holds near crates, fires in bursts |
| **momus** (critic) | **Suppressive** | Sustained fire to force player to move |
| **atlas** (long-running) | **Anchor** | Holds lane, slow but segments retreat |
| **sisyphus-junior** | **Rookie** | Weaker, but spawns in pairs on wave ≥3 |

Implementation is intentionally cheap — a state machine (`patrol → approach → flank → suppress`) keyed off distance and timers, plus separation steering so agents don't stack. The *narrative* is what matters: the squad feels like a coordinated team, not independent bots, because the same two primitives OMO uses — **orchestration + typed disciplines** — are visible in enemy timing and positioning.

## Config easter egg: `.omo/omo.jsonc`

The repo ships `project/.omo/omo.jsonc` — a trimmed, game-themed copy of `docs/examples/default.jsonc` / `coding-focused.jsonc`. Key patterns copied from the real loader (`packages/omo-config-core`):

- `$schema` pointer to `assets/omo.schema.json` (dev branch URL)
- `[opencode]` freeform block carrying the full plugin config
- `agents` with `model` + `prompt_append` per discipline (mirrors the real `sisyphus`/`hephaestus` split)
- `categories` routing (`quick` / `deep` / `visual-engineering`) — in-game: quick scouts vs. deep breach
- `background_task.providerConcurrency` — in-game: max concurrent hostiles per wave

Inspect it at `.omo/omo.jsonc`. It's loaded nowhere at runtime — it's a lore artifact and a parser-valid JSONC file for `loader/loader.ts` if someone points the harness at the game folder.

## OH-My-OpenAgent summary

A verbatim-trimmed summary of the reference checkout (`/tmp/oh-my-openagent`) lives in `docs/oh-my-openagent-summary/`:

- `docs/oh-my-openagent-summary/README.md` — what OMO is (sourced from the real `README.md` header + `AGENTS.md`)
- `docs/oh-my-openagent-summary/examples/` — copies of `docs/examples/default.jsonc` and `coding-focused.jsonc` (the archetypes)
- `docs/oh-my-openagent-summary/omo-json-reference.md` — excerpt of `docs/reference/omo-json.md` (file locations, precedence, merge rules)
- `docs/oh-my-openagent-summary/rules-test-discipline.md` — copy of `.omo/rules/test-discipline` (the most load-bearing rule)

These are snapshots taken at build time (2026-08-27) from the oh-my-openagent checkout at `/tmp/oh-my-openagent` — not a live clone — to keep `project/` self-contained and small.

## How to see it in-game

1. Open the minimap — each **red chevron** is a discipline. The lead (no suffix) stays central; flankers peel perpendicular.
2. Reload (`R`) — Breachers push during the 1350 ms window.
3. Check the kill feed phrasing — `HEADSHOT` / `ELIMINATED` mirrors OMO's `evidence/` naming.

## Files

- `src/main.js` — `updateEnemies()` + `GAME_CONFIG` + `spawnWave()` (squad tactics)
- `.omo/omo.jsonc` — easter-egg config
- `docs/oh-my-openagent-summary/` — reference snapshot
- `public/models/README.md` — Sketchfab weapon slot (GLTFLoader hook)


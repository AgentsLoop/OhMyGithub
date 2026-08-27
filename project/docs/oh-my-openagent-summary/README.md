# oh-my-openagent (oh-my-opencode) — Summary Snapshot

**Source:** `/tmp/oh-my-openagent` checkout at `2026-08-27` (branch `dev`, release `5.0.0-beta.22`).
**Upstream:** https://github.com/code-yeongyu/oh-my-openagent
**Maintained as:** `oh-my-opencode` — OpenCode plugin + Senpi + Codex harnesses.

## What it is

From the real `README.md` header:

> **"The Best AI Agent Harness — Batteries-Included OpenCode Plugin with Multi-Model Orchestration, Parallel Background Agents, and Crafted LSP/AST Tools"**

Key ideas copied into this game:

- **Sisyphus orchestrator** — single lead agent that delegates work and owns completion.
- **11 discipline agents** (`hephaestus`, `prometheus`, `oracle`, `librarian`, `explore`, `multimodal-looker`, `metis`, `momus`, `atlas`, `sisyphus-junior`) — each tuned model + prompt + permission.
- **Categories** (`quick` / `unspecified-low|high` / `deep` / `ultrabrain` / `visual-engineering` / `writing`) — model routing per task shape.
- **`omo.jsonc` unified config** — one file configures every harness (OpenCode, Senpi, Codex) with layered precedence (`~/.omo` → `.omo/` ancestors) and strict schema at `assets/omo.schema.json`.
- **`background_task.providerConcurrency`** — caps parallel LLM calls per provider (cost/latency control).

## How the game uses it

See `../omo-integration.md` for the full mapping. Short version: each discipline becomes a Squad AI archetype (Breacher, Flanker, Marksman, Spotter, …) with a matching prompt in `.omo/omo.jsonc`.

## Files in this snapshot

- `examples/default.jsonc` — balanced defaults (copy of `docs/examples/default.jsonc`)
- `examples/coding-focused.jsonc` — intensive coding profile (copy of `docs/examples/coding-focused.jsonc`)
- `omo-json-reference.md` — copy of `docs/reference/omo-json.md` (loader paths, precedence, `$schema`)
- `rules-test-discipline.md` — copy of `.omo/rules/test-discipline.md` (most load-bearing rule)

## AGENTS.md excerpt (first 80 lines, verbatim)

# oh-my-opencode — OpenCode Plugin

> **HOLD THE FUCK UP. THIS ENTIRE GODDAMN CODEBASE IS BEING RIPPED APART AND REBUILT RIGHT NOW. A MASSIVE MULTI-HARNESS AGENT OS REFACTOR IS IN PROGRESS — WE ARE RESTRUCTURING EVERYTHING TO SUPPORT MULTIPLE AGENT HARNESSES (OPENCODE, CODEX, PI, AND OTHERS). DO NOT TRUST THE STRUCTURE BELOW AS STABLE. READ THE [ROADMAP](./ROADMAP.md) BEFORE YOU TOUCH ANYTHING OR SO HELP ME GOD.**

**Generated:** 2026-08-24 | **Source snapshot:** f3642fcda | **Branch:** initdeep-refresh-20260824 | **Release:** v5.0.0-beta.18

## STOP. QA IS MANDATORY. NON-NEGOTIABLE. EVERY SINGLE TIME YOU TOUCH AN OPENCODE-, CODEX-, OR SENPI-CONNECTED COMPONENT.

> **IF YOUR CHANGE TOUCHES ANYTHING WIRED INTO OPENCODE, INTO THE CODEX LIGHT EDITION, OR INTO THE SENPI ADAPTER, YOU MUST QA IT. ALWAYS. EVERY SINGLE TIME. NO EXCEPTIONS. THERE IS NO "TOO SMALL TO SKIP". THERE IS NO "IT OBVIOUSLY WORKS".**

**"It typechecks" is NOT QA. "`bun test` is green" is NOT QA.** YOU MUST DRIVE THE REAL HARNESS, and then **YOU MUST WRITE THE EVIDENCE TO DISK.** If there is no evidence file, **the QA DID NOT HAPPEN**, and **YOU ARE NOT ALLOWED TO COMMIT OR PUSH.**

This is repeated on purpose, because it is the single most ignored rule in this repo. **CHANGE A HOOK, A TOOL, AN AGENT, A FEATURE, A CONFIG SCHEMA, AN MCP, A CLI COMMAND, AN INSTALLER, A PROMPT, OR ANYTHING ELSE THAT REACHES OPENCODE, CODEX, OR SENPI, THEN: RUN QA, THEN RECORD EVIDENCE.** Always. Every time. No exceptions.

### OPENCODE side (`packages/omo-opencode/`): ALWAYS run the `opencode-qa` skill

1. **ALWAYS RUN THE `opencode-qa` SKILL** (`.agents/skills/opencode-qa/`) to map the EXPECTED IMPACT and the FULL CHANGE SCOPE of your edit BEFORE and AFTER. Pick the right case: CLI (`opencode run --format json`), server + SSE hook proof, TUI smoke, or DB inspection.
2. **ISOLATE EVERYTHING.** Any QA that SPAWNS opencode MUST run in an isolated XDG sandbox (`XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_STATE_HOME` / `XDG_CACHE_HOME` pointed at temp dirs). The bundled scripts already do this. **NEVER pollute the real `~/.local/share/opencode/opencode.db`.** PROVE isolation by comparing `SELECT count(*) FROM session` before and after.
3. **USE tmux** for the TUI smoke (`scripts/tui-smoke.sh`) and for any interactive driving. tmux is for SMOKE (did it boot, render, accept a key); assert REAL behavior via `opencode run --format json` or the server API + SSE.
4. **PROVE THE HOOK FIRED.** If you changed a lifecycle hook, prove the matching event hit the wire (`scripts/sse-hook-probe.sh --event <name>`). Seeing the event proves the hook would fire.

### CODEX side (`packages/omo-codex/`): ALWAYS run the `codex-qa` skill

1. **ALWAYS RUN THE `codex-qa` SKILL** (`.agents/skills/codex-qa/`) to map the EXPECTED IMPACT and the FULL CHANGE SCOPE of your edit BEFORE and AFTER. It exercises ONLY our plugin in strict isolation — an isolated `CODEX_HOME` + a LOCAL mock model (no real API call) — so the real `~/.codex` is NEVER read or written. NEVER QA against your real `~/.codex`; NEVER the published package.
2. **PROVE THE HOOK FIRED, FIRST-PARTY.** The skill drives the real `codex app-server` and asserts `hook/started` / `hook/completed` notifications for our components (`scripts/app-server-drive.sh --plugin`). Deterministic per-component checks: `scripts/hook-unit-probe.sh`. Installer + `config.toml` landing: `scripts/install-verify.sh`. tmux TUI smoke: `scripts/tui-smoke.sh`. Each script ships a `--self-test`.
3. **RUN THE CODEX GATE:** `bun run test:codex` (installer + config migration + plugin component suite). This is the hermetic UNIT gate; it does NOT prove a live session — the `codex-qa` skill does.
4. **CONFIRM THE REAL `~/.codex/config.toml` WAS NOT TOUCHED** — every `codex-qa` script asserts this automatically (shasum before/after).

### SENPI side (`packages/omo-senpi/`, `packages/senpi-task/`): ALWAYS run the `senpi-qa` skill

1. **ALWAYS RUN THE `senpi-qa` SKILL** (`.agents/skills/senpi-qa/`) to map the EXPECTED IMPACT and the FULL CHANGE SCOPE of your edit BEFORE and AFTER. It drives the REAL `senpi` binary through the drivers in `packages/omo-senpi/scripts/qa/`, which build their own isolated `SENPI_CODING_AGENT_DIR` and IGNORE a caller-provided one, so the real `~/.senpi/agent` is NEVER written.
2. **RESOLVE THE EVIDENCE DIRECTORY WITH THE SKILL'S SCRIPT.** `node .agents/skills/senpi-qa/scripts/resolve-evidence-dir.mjs --repo-root "$(git rev-parse --show-toplevel)" --slug <YYYYMMDD>-<short-slug>` is the ONLY sanctioned way to pick the path. It returns an absolute path under `.omo/evidence/omo-senpi-adapter/<slug>/`, creates nothing, and rejects traversal, separators, absolute paths, and stray roots such as `local-ignore/qa-evidence`.
3. **RUN THE SENPI GATE:** `tsgo --noEmit -p packages/omo-senpi/tsconfig.json` then `bun run test:senpi`. This is the hermetic UNIT gate; it does NOT prove a live session — the `senpi-qa` skill does.
4. **CONFIRM THE REAL `~/.senpi/agent` WAS NOT TOUCHED** — record the live driver's `realSenpiUntouched` / changed-path fields and isolated agent-dir path. A whole-directory digest is supporting evidence only because live debug/cache files may change. A driver reporting `SKIP` because the `senpi` binary is absent is NOT a pass; say so in the evidence.

### EVIDENCE: record it under `.omo/evidence/` or it DID NOT HAPPEN

**WRITE EVERY QA ARTIFACT TO `.omo/evidence/<YYYYMMDD>-<short-slug>/`** (the existing evidence dir; one subfolder per change, keep it ORGANIZED). Live Senpi QA is the one scoped exception: it goes under `.omo/evidence/omo-senpi-adapter/<slug>/`, resolved by the `senpi-qa` skill's script. For EVERY change you MUST record reviewer-readable plain files:
- **WHAT WAS TESTED:** the command or manual action, the surface driven, and the behavior it was meant to prove.
- **WHAT WAS OBSERVED:** the before/after or new behavior, isolation proof such as unchanged session counts, and the artifact path for the exact captured output.
- **WHY IT IS ENOUGH:** how the evidence covers the intended behavior and remaining regression risk.
- **WHAT WAS OMITTED:** redact or summarize raw secret-bearing logs, env dumps, tokens, auth headers, and private credentials instead of copying them.

**NO EVIDENCE FILE == NO QA == NO COMMIT == NO PUSH.** ALWAYS. EVERY TIME. NO EXCEPTIONS.

## MANDATORY CHANGE-EXECUTION PROTOCOL. EVERY USER-ORDERED PATCH FOLLOWS THIS. NO EXCEPTIONS.

> **THE MOMENT A TASK REQUIRES PRODUCING A PATCH THAT MODIFIES THIS REPOSITORY, AND THE USER HAS EXPLICITLY INSTRUCTED THAT MODIFICATION, THIS PROTOCOL IS LAW. IT IS NOT A SUGGESTION. IT IS NOT OPTIONAL. THERE IS NO "TOO SMALL TO BOTHER", NO "JUST THIS ONCE", NO "I ALREADY KNOW THE CODEBASE". YOU RUN EVERY STEP, IN ORDER, EVERY SINGLE TIME.**

1. **EXPLORE.** MAP the code you are about to touch BEFORE editing a single line: read the real files, trace the call paths, measure the blast radius. NEVER patch from memory.
2. **MAKE A PLAN.** Write the full plan down BEFORE the first edit: every file, every change, the verification for each. NO PLAN ON DISK MEANS YOU DO NOT START.
3. **ADD TODOS IN ULTRA-DETAIL.** Mirror EVERY atomic step of the plan into the todo list: one todo per edit-plus-verification unit. Vague todos like "implement feature" are FORBIDDEN.
4. **MAKE A NEW WORKTREE.** ALL implementation happens in a fresh, task-owned git worktree. NEVER edit the main checkout in place, NEVER hand-commit to `dev`.
5. **MAKE A PR AND WORK UNTIL IT GETS MERGED.** Open a reviewer-readable PR and STAY ON IT until it is MERGED: fix CI, answer review, re-run QA, resolve conflicts via `smart-rebase`. AN UNMERGED PR IS UNFINISHED WORK.
6. **SET A GOAL AND RUN THE ULW LOOP.** Register the goal with binding success criteria and drive the work through the `ulw-loop`: evidence-bound, failing-first, real-surface QA. "IT SHOULD WORK" IS NOT EVIDENCE.
7. **MANAGE THE TODO LIST OBSESSIVELY.** Mark a step in progress the instant it begins, done the instant it finishes, append new steps the moment they surface. THE TODO LIST NEVER LAGS REALITY. EVER.

## DEFAULT WORKFLOW — how to take on any task

Unless the user EXPLICITLY says otherwise, or the task is an urgent must-fix-now hotfix, deliver every change through the **`work-with-pr`** skill: it works in an isolated git worktree, implements with evidence-bound manual QA, opens a reviewer-readable English PR (what changed, why, observed behavior, QA/evidence, residual risk), runs the verification loop, and merges. Do NOT hand-commit normal work straight to `dev`.

- **QA is the evidence gate, scoped to what you touched.** A change under `packages/omo-opencode/` MUST run the **`opencode-qa`** skill; a change under `packages/omo-codex/` (lazycodex) MUST run the **`codex-qa`** skill; a change under `packages/omo-senpi/` or `packages/senpi-task/` MUST run the **`senpi-qa`** skill (see the QA section above for each). Run the matching skill, and treat its captured output (written under `.omo/evidence/`) as the QA evidence `work-with-pr` requires. A change touching more than one runs each.
- **Conflicts → `smart-rebase`.** If the worktree branch conflicts with its base, resolve it with the **`smart-rebase`** skill, then re-run the scoped QA. Never hand-resolve by force-pushing shared history.
- **Merge → merge commit, ALWAYS.** Land the PR with a merge commit per **PR MERGE POLICY** below. NEVER squash-merge or rebase-merge, even if a generic workflow, skill, or GitHub default suggests it.

## OVERVIEW

OpenCode plugin (npm: `oh-my-opencode`, dual-published as `oh-my-openagent` during the rename transition) extending OpenCode with 11 agents, ~54-62 lifecycle hooks (54 base / 61 team / 62 monitor) across 62 dirs, 12-38 registry tools (gated by config flags including team-mode and goal; 8 `lsp_*` aliases served via the built-in lsp MCP), 3-tier MCP system (built-in + .mcp.json + skill-embedded), Hashline LINE#ID edit tool, IntentGate keyword detector, Team Mode (parallel multi-agent coordination, OFF by default), Boulder feature (boulder-state work tracking + cli/boulder subcommand), configurable agent ordering, and Claude Code compatibility.

**The package layering refactor moved the entire plugin out of root `src/` into [`packages/omo-opencode/src/`](packages/omo-opencode/src/AGENTS.md)** (a 100% git rename — there is NO root `src/` anymore). That adapter tree is now the OpenCode-facing shim over 20 Core packages + 4 MCP packages + sibling adapters (Codex, Senpi, native). Build entry: `packages/omo-opencode/src/index.ts`, a thin wrapper that delegates to `packages/omo-opencode/src/testing/create-plugin-module.ts` `createPluginModule()` → staged plugin init (see INITIALIZATION FLOW). Ships in two editions of one product: **Ultimate** (omo for OpenCode, this plugin = `packages/omo-opencode/`) and **Light** (omo for Codex CLI = [`packages/omo-codex/`](packages/omo-codex/AGENTS.md), with `lazycodex` as the repository/bin identity and `lazycodex-ai` as the live npm alias; see CODEX LIGHT EDITION below).

## STRUCTURE

```
oh-my-opencode/                      # workspace root (no root src/ — it moved into packages/omo-opencode)
├── packages/                        # 45 sibling packages across Core/MCP/Skills/Adapters/Platform/Web. See packages/AGENTS.md
│   ├── omo-opencode/                # ★ THE OpenCode plugin adapter (formerly root src/). Build entry: src/index.ts
│   │   ├── src/                     # plugin source and OpenCode-facing adapter shims. Full breakdown → packages/omo-opencode/src/AGENTS.md
│   │       ├── index.ts             # Plugin entry; thin wrapper re-exporting createPluginModule() from src/testing/
│   │       ├── plugin-interface.ts  # 12 OpenCode hook handlers (+2 wired in testing/create-plugin-module.ts)


---
Source checkout: /tmp/oh-my-openagent — snapshot 2026-08-27

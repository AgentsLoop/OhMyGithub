---
name: game-issue-e2e
description: Start the issue-triggered game workflow, wait for the OpenCode session link, and return that link without waiting for the workflow to finish.
---

# Game issue workflow kickoff

Use this skill when the user asks to start the issue-triggered game workflow
with a new game or create a game issue. This skill intentionally ends after the
workflow publishes the OpenCode Web UI session link; it does not watch the
workflow to completion or claim that the game, PR, or public app is finished.

If the caller does not provide a game concept or prompt, invent a random,
small playable browser game and write a brief issue prompt for it. Do not ask
the caller to supply the missing concept. Apply matching skill labels only when
the invented game clearly requires them.

## Required outcome

The kickoff is complete when all of these are true:

- A fresh GitHub issue was created with `/omg` in its title or body. Add the
  `/Goal` label by default; omit it only when the caller explicitly requests a
  standard-mode workflow test.
- The `issues` event triggered `.github/workflows/opencode.yml`.
- The initial OpenCode Web UI session link was posted.

Do not wait for `gh run watch`, the verification prompt, the public tunnel, the
pull request, or tests after the session link has been found.

## Skill labels

Before creating the test issue, inspect the repository's current labels and
use the available `skill/*` labels that match the requested game. The current
skill labels are:

- `skill/gauntlet-loop` — use for Gauntlet Loop/gameplay-loop or iterative
  game-building requests.
- `skill/image-search` — use when the request needs web image discovery or
  image-search assets.
- `skill/load-sketchfab-threejs` — required for 3D game requests; use it for
  Sketchfab, GLB, Three.js, or PlayCanvas model-loading/material/animation
  requests.
- `skill/mcp-duckgo` — use when the request explicitly requires DuckDuckGo/MCP
  search support.

These labels are based on the skill labels currently configured in
`agents-dev/aiplay`; refresh them with `gh label list` before each test because
the set can change. Do not add a skill label merely because a skill exists:
apply only labels supported by the issue's requirements. If a matching label
does not exist, continue without inventing or creating one and record that in
the test report.

When the caller requests the Luna model, use the OpenAI provider label
`model/openai/gpt-5.6-luna`. Confirm that label exists before creating the
issue; if it is missing, create the model label with `gh label create` because
the workflow synchronizes model labels during the run but cannot add a label to
the triggering issue retroactively. Do not use
`model/opencode/gpt-5.6-luna`, which selects OpenCode Zen instead of the OpenAI
OAuth provider.

## Procedure

1. Before starting the test, inspect the working tree with `git status --short`.
   Stage and commit all current changes, then push the current branch. Verify
   that the working tree is clean and the pushed commit is the branch tip.
   Determine the current branch with `git branch --show-current` and the
   repository default branch with `gh repo view --json defaultBranchRef --jq
   .defaultBranchRef.name`. When the current branch differs from the default
   branch, include `--branch <current-branch>` immediately after `/omg` in the
   issue title or body. This forwards the complete workflow to that branch's
   YAML; do not merely describe the branch in prose. On the default branch,
   omit the flag.
   Do not start the test with uncommitted or unpushed changes.
2. Confirm `gh auth status` and identify the repository with `gh repo view`.
3. Inspect the current labels with `gh label list`, identify the applicable
   `skill/*` labels and model label from the request, and create a new issue
   with one `--label` option per applicable label. Put `/omg` in the title or
   body. If a branch flag is required, use the exact command form
   `/omg --branch <current-branch> <objective>`. Add `/Goal` by default; this
   specifically exercises the goal plugin and `opencode run --command goal`
   path. Omit `/Goal` only when the caller explicitly requests the standard
   OpenCode path. Do not add a comment
   because this tests the `issues` trigger.
   If the caller supplied a game or prompt, preserve its intent. Otherwise,
   generate a random game concept and a concise playable implementation brief.
   For any 3D game, also pass `--label skill/load-sketchfab-threejs` when that
   label exists, and require the issue prompt to use the
   `load-sketchfab-threejs` skill for a suitable downloadable GLB asset while
   preserving attribution and verifying geometry, materials, and animations.
   Do not add this label or requirement to a 2D/canvas-only game.
   If multiple skills are needed, pass one `--label` option per matching
   label. Record the issue's final labels and verify them with
   `gh issue view <issue-number> --json labels`.
4. Locate the newest `opencode.yml` run with:

   ```sh
   gh run list --workflow opencode.yml --limit 5 --json databaseId,displayTitle,event,status,url
   ```

   Confirm its event is `issues` on the default branch when no branch flag was
   used. When `--branch` was used, confirm the dispatcher `issue` run is
   followed by a `workflow_dispatch` run whose `headBranch` is the requested
   branch; poll that forwarded run or issue comments only until the initial
   OpenCode session link appears.
   Do not use `gh run watch` through completion.
5. Extract the OpenCode Web UI URL from the issue comment or the completed
   `Run OpenCode and locate its web session` step. Return the issue, run, and
   session URL immediately. Clearly state that the workflow remains active and
   that build, verification, public-app, PR, and test results have not yet been
   checked.

## Safety and scope

This skill intentionally creates a real issue and starts a real GitHub Action.
Use it only when the user explicitly requests an end-to-end workflow test.
Never cancel or rerun an active test without checking its current step first.
Keep unrelated worktree changes untouched.

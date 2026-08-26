---
name: game-issue-e2e
description: Start the issue-triggered game workflow, wait for the OpenCode session link, and return that link without waiting for the workflow to finish.
---

# Game issue workflow kickoff

Use this skill when the user asks to start the issue-triggered game workflow
with a new game or create a game issue. This skill intentionally ends after the
workflow publishes the OpenCode Web UI session link; it does not watch the
workflow to completion or claim that the game, PR, or public app is finished.

## Required outcome

The kickoff is complete when all of these are true:

- A fresh GitHub issue was created with `/oc` in its title or body.
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
- `skill/load-sketchfab-threejs` — use for Sketchfab, GLB, Three.js, or
  PlayCanvas model-loading/material/animation requests.
- `skill/mcp-duckgo` — use when the request explicitly requires DuckDuckGo/MCP
  search support.

These labels are based on the skill labels currently configured in
`agents-dev/aiplay`; refresh them with `gh label list` before each test because
the set can change. Do not add a skill label merely because a skill exists:
apply only labels supported by the issue's requirements. If a matching label
does not exist, continue without inventing or creating one and record that in
the test report.

## Procedure

1. Before starting the test, inspect the working tree with `git status --short`.
   Stage and commit all current changes, then push the current branch. Verify
   that the working tree is clean and the pushed commit is the branch tip
   before creating the issue or triggering any Action. Do not start the test
   with uncommitted or unpushed changes.
2. Confirm `gh auth status` and identify the repository with `gh repo view`.
3. Inspect the current labels with `gh label list`, identify the applicable
   `skill/*` labels from the request, and create a new issue with
   `gh issue create --label <label> ...`. Put `/oc` in the title or body; do
   not add a comment because this specifically tests the `issues` trigger.
   Ask for a concrete playable game and include its functional requirements.
   If multiple skills are needed, pass one `--label` option per matching
   label. Record the issue's final labels and verify them with
   `gh issue view <issue-number> --json labels`.
4. Locate the newest `opencode.yml` run with:

   ```sh
   gh run list --workflow opencode.yml --limit 5 --json databaseId,displayTitle,event,status,url
   ```

   Confirm its event is `issues` and its title matches the new issue. Poll the
   run or issue comments only until the initial OpenCode session link appears.
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

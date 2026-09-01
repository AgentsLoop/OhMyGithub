---
name: issue-e2e
description: Start the issue-triggered workflow from the caller's prompt, wait for the OpenCode session link, and return that link without waiting for the workflow to finish.
---

# Issue workflow kickoff

## Trigger rule

GitHub uses the term **label**. The required execution label is exactly
`OpenCode`. Create the issue with that label, or add it to an existing issue;
do not use comments, edits, or the word “tag” as a trigger. The
App dispatches the workflow once when an issue is opened with the label or when
`OpenCode` is added.

When the caller explicitly requests a custom branch, append
` branch: <existing-branch>` to the issue title. Treat that suffix as routing
metadata rather than part of the caller's implementation prompt.
Verify the branch exists before creating the issue. Otherwise omit the directive
and use the repository default branch.

Use this skill when the user asks to start the issue-triggered workflow with a
request or create an issue. Treat the user's next message after invoking this
skill as the task prompt when one is supplied. Preserve a supplied prompt's
intent and details; do not invent, replace, summarize, or augment it with a
random task. When no prompt is supplied (or the prompt is empty), randomly
choose a small playable browser-game concept and write a brief implementation
prompt for it. This skill intentionally ends after the workflow publishes the
OpenCode Web UI session link; it does not watch the workflow to completion or
claim that the implementation, PR, or public app is finished.

## Repository selection

Use the repository supplied by the caller when one is provided. When no
repository is supplied, default to `AgentsLoop/PlayGround`. Resolve the full
`OWNER/REPO` with `gh repo view` and confirm the authenticated account can
administer it before creating issues or triggering Actions. Do not silently
substitute a different repository. If the target does not contain
`.github/workflows/opencode.yml`, still create the requested issue, but report
that the E2E workflow is unavailable and do not claim that an Action or session
was started.

The caller's following message is sufficient as the prompt when one is
provided, even when it is short or does not describe a game. If no prompt is
provided or the prompt is empty, invent a random, small playable browser game
and write a brief issue prompt for it. Apply matching skill labels only when
the prompt or invented game clearly requires them.

## Required outcome

The kickoff is complete when all of these are true:

- A fresh GitHub issue was created with the `OpenCode` label. Add the `Goal`
  label by default; omit it only when the caller explicitly requests a
  standard-mode workflow test. The App dispatches the workflow once.
- The App triggered `.github/workflows/opencode.yml` through `workflow_dispatch`.
  For a custom branch, the run's head branch is that requested branch. An
  `issues` event or default-branch run is a routing failure, not a successful
  custom-branch test.
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

Refresh the available labels with `gh label list` before each test because the
set can change. Do not add a skill label merely because a skill exists:
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
   that the working tree is clean and the pushed commit is the branch tip
   before creating the issue or triggering any Action. Do not start the test
   with uncommitted or unpushed changes.
2. Confirm `gh auth status`, resolve the target repository (default
   `AgentsLoop/PlayGround`), and inspect it with `gh repo view <owner>/<repo>`.
   Check whether `.github/workflows/opencode.yml` exists. If it is missing,
   continue through issue creation, then report that no workflow or session
   could be started and stop without attempting run polling.
3. Inspect the current labels in the target repository with
   `gh label list --repo <owner>/<repo>`, identify the applicable
   `skill/*` labels and model label from the request, and create a new issue
   with one `--label` option per applicable label, always including `OpenCode`.
   Add `Goal` by default; this specifically exercises the goal plugin and
   `opencode run --command goal`
   path. Omit `Goal` only when the caller explicitly requests the standard
   OpenCode path. Do not add a comment because comments do not trigger the
   workflow. If testing an existing issue instead, adding the `OpenCode` label
   is the only supported way to start it.
   If the caller supplied a prompt, use it as the complete issue prompt and
   preserve it verbatim. If no prompt was supplied, generate a random, small
   playable browser game and use a concise implementation brief as the issue
   prompt. If the prompt requests 3D content, also pass
   `--label skill/load-sketchfab-threejs` when that label exists, and require
   the issue prompt to use the
   `load-sketchfab-threejs` skill for a suitable downloadable GLB asset while
   preserving attribution and verifying geometry, materials, and animations.
   Do not add this label or requirement when the prompt does not request 3D
   content.
   If multiple skills are needed, pass one `--label` option per matching
   label. Record the issue's final labels and verify them with
   `gh issue view <issue-number> --json labels`.
4. Locate the newest `opencode.yml` run in the target repository with:

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 --json databaseId,displayTitle,event,status,url
   ```

   Confirm its event is `workflow_dispatch`, its title matches the new issue,
   and its head branch matches the requested branch (or the default branch when
   no directive was supplied). If it is an `issues` event or uses the wrong
   branch, report the routing failure and do not treat a session as validation.
   Poll the run or issue comments only until the initial OpenCode session link
   appears.
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

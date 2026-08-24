---
name: game-issue-e2e
description: Test the issue-triggered game workflow by creating a new game issue, waiting for both OpenCode prompts, and validating the resulting PR and public app tunnel.
---

# Game issue end-to-end test

Use this skill when the user asks to test the game workflow with a new game,
create a game issue, or verify that the `/oc` follow-up workflow works.

## Required outcome

The test is complete only when all of these are true:

- A fresh GitHub issue was created with `/oc` in its title or body.
- The `issues` event triggered `.github/workflows/opencode.yml`.
- The workflow completed successfully.
- The build prompt and the verification prompt both ran. Confirm this from
  the run's completed steps and, when needed, the runner log through the
  temporary SSH command.
- The workflow posted a verified application `trycloudflare.com` URL after
  the verification step, not only the OpenCode Web UI URL.
- A pull request was created from the generated `opencode/<run-id>` branch.
- The PR is clean and its exact head commit passes the repository's unit and
  browser tests.
- The public application URL responds successfully while the temporary tunnel
  is still alive.

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

   Confirm its event is `issues` and its title matches the new issue. Monitor
   it with `gh run watch <run-id> --exit-status --repo <owner>/<repo>`.
5. After completion, inspect the job steps. Require success for `Run OpenCode
   and locate its web session`, `Verify app with second OpenCode prompt`,
   `Expose verified app`, `Create pull request`, and `Post verified app URL`.
   Do not treat the first OpenCode Web UI URL as the app URL.
6. Read the issue comments and extract the final comment containing
   `Verified app is live`. Validate that URL with `curl --fail --max-time 20`.
7. Find the PR whose head is `opencode/<run-id>`. Check its state and merge
   status, then fetch the exact head commit into an isolated temporary
   worktree. Run `npm ci`, `npm test`, and any project-specific runtime check.
   Remove the temporary worktree after the test.
8. Report the issue, run, PR, both-prompt evidence, app URL, and test results.
   If the run is still active, report exactly which step is active and do not
   claim the app is complete.

## Safety and scope

This skill intentionally creates a real issue and starts a real GitHub Action.
Use it only when the user explicitly requests an end-to-end workflow test.
Never cancel or rerun an active test without checking its current step first.
Keep unrelated worktree changes untouched.

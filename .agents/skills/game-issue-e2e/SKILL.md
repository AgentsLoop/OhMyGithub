---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only when the user explicitly requests an issue-triggered E2E run. Create
the real issue and Action, then stop at the initial Web UI session link; do not
claim implementation, tests, PR, or deployment completion.

## Prompt and branch

Locate `Issue e2e` (or this skill's invocation) in the user message:

- At the beginning: preserve the following request directly, making only
  necessary cleanup.
- In the middle or at the end: combine request text on both sides, reason about
  the desired result, and rewrite a concise prompt in your own words.

Always remove the invocation, skill name, local path, and skill link from the
issue prompt. With no request text, invent a small playable browser-game brief.

Before creating the issue, check `git branch --show-current`. If the current
branch is non-empty and not `main`, verify it exists and append
` branch: <current-branch>` to the issue title. The reusable workflow checks
out `github.ref_name` and bases its OpenCode branch on it, so this preserves the
debugging worktree. The suffix is routing metadata, not prompt text. On `main`,
omit it and use the default branch.

## Target and labels

Use the supplied repository or default to `AgentsLoop/PlayGround`. Verify
`gh auth status`, admin access via `gh repo view`, and
`.github/workflows/opencode.yml`. If the workflow is absent, create the issue
but report that no Action or session could start.

Run `gh label list` before each kickoff. Always apply `OpenCode` and `Goal`.
Apply only existing matching labels: `skill/image-search`,
`skill/load-sketchfab-threejs` for 3D/GLB/Three.js/PlayCanvas,
`skill/gauntlet-loop`, `skill/mcp-duckgo`, `linux` for explicit Linux requests,
and a requested model label. Do not invent `skill/*` labels; record unavailable
matches. If `Goal` is missing, create it:

```sh
gh label create Goal --repo <owner>/<repo> --color 8A2BE2 \
  --description 'Run OMG with the persistent Goal command'
```

If Linux is requested and `linux` is missing, create it:

```sh
gh label create linux --repo <owner>/<repo> --color 1D76DB \
  --description 'Run OpenCode on the ubuntu-latest GitHub-hosted runner'
```

For Luna, use `model/openai/gpt-5.6-luna`; create it if missing rather than
using `model/opencode/gpt-5.6-luna`:

```sh
gh label create model/openai/gpt-5.6-luna --repo <owner>/<repo> \
  --color 5319E7 --description 'OpenAI model: openai/gpt-5.6-luna'
```

For 3D, verify the workflow defaults to
`macos-latest`; for Linux, verify `linux` routes to `ubuntu-latest`.
Require the 3D prompt to use `load-sketchfab-threejs` for a downloadable GLB,
attribution, and geometry/material/animation verification.

## Procedure

1. Check `git status --short` and `git branch --show-current`; preserve
   unrelated changes and derive the branch suffix as described above.
2. Create a fresh issue with `OpenCode`, `Goal`, and applicable labels. Do not
   use comments, edits, or other labels as triggers. Verify with:
   `gh issue view <number> --json labels`.
3. Confirm the newest run is a matching `workflow_dispatch` run on the current
   non-`main` branch, or on `main` when the current branch is `main`:

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 \
     --json databaseId,displayTitle,event,status,url,headBranch
   ```

   An `issues` event or wrong branch is routing failure, not validation.
4. Poll only until the initial OpenCode Web UI URL appears. Return clickable
   issue, run, and session links immediately. Do not use `gh run watch` to
   completion or cancel/rerun an active run without checking its current step.

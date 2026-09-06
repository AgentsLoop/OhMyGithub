---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only for an explicitly requested issue-triggered E2E run. Create the issue
and Action, then stop at the initial Web UI link; do not claim completion.

## Prompt and branch

Locate `Issue e2e` (or this skill's invocation):

- Beginning: preserve following text directly, with only necessary cleanup.
- Middle/end: combine text on both sides, reason about the result, and rewrite
  a concise prompt in your own words.

Always remove the invocation, skill name/path, and skill link. With no request,
invent a small playable browser-game brief.

Check `git branch --show-current`. If non-empty and not `main`, verify it and
append ` branch: <current-branch>` to the title. The reusable workflow checks
out `github.ref_name` and bases its OpenCode branch on it, preserving the
debugging worktree. This suffix is routing metadata, not prompt text. On `main`,
omit it.

## Target and labels

Use the supplied repository or `AgentsLoop/PlayGround`. Verify `gh auth status`,
admin access with `gh repo view`, and `.github/workflows/opencode.yml`. If absent,
create the issue but report that no Action/session could start.

Run `gh label list` each time. Always apply `OpenCode` and `Goal`; apply only
existing matches: `skill/image-search`,
`skill/load-sketchfab-threejs` for 3D/GLB/Three.js/PlayCanvas,
`skill/gauntlet-loop`, `skill/mcp-duckgo`, `linux` for explicit Linux, and a
requested model label. Do not invent `skill/*`; record unavailable matches.
If `Goal` is missing:

```sh
gh label create Goal --repo <owner>/<repo> --color 8A2BE2 \
  --description 'Run OMG with the persistent Goal command'
```

If Linux is requested and `linux` is missing:

```sh
gh label create linux --repo <owner>/<repo> --color 1D76DB \
  --description 'Run OpenCode on the ubuntu-latest GitHub-hosted runner'
```

For Luna, use `model/openai/gpt-5.6-luna`, creating it if missing; never use
`model/opencode/gpt-5.6-luna`:

```sh
gh label create model/openai/gpt-5.6-luna --repo <owner>/<repo> \
  --color 5319E7 --description 'OpenAI model: openai/gpt-5.6-luna'
```

For 3D, verify `macos-latest`; for Linux, verify `linux` routes to
`ubuntu-latest`. Require 3D prompts to use `load-sketchfab-threejs` for a
downloadable GLB, attribution, and geometry/material/animation verification.

## Procedure

1. Check `git status --short` and the current branch; preserve unrelated work.
2. Create a fresh issue with `OpenCode`, `Goal`, and applicable labels. Comments,
   edits, and other labels are not triggers. Verify `gh issue view <number> --json labels`.
3. Confirm the newest run is matching `workflow_dispatch`, title, and current
   non-`main` branch (or `main`):

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 \
     --json databaseId,displayTitle,event,status,url,headBranch
   ```

   An `issues` event or wrong branch is routing failure, not validation.
4. Poll only until the initial Web UI URL appears; return issue, run, and session
   links immediately. Do not `gh run watch` to completion or cancel/rerun an
   active run without checking its current step.

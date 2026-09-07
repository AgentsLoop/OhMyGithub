---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only for an explicitly requested issue-triggered E2E run. Create the issue
and Action, then stop at the initial Web UI link. Do not claim implementation
completion.

## Write the issue prompt

Read `references/gauntlet-prompt-rubric.md` before rewriting a sparse request.
Use these rules:

- Preserve the requested subject, named game, and intended player experience.
  Keep a named game recognizable in the title and set the goal as the closest
  practical visual and gameplay recreation, not a generic game in the same
  genre.
- Determine the source game's dimensionality. If it is a 3D game or the user
  asks for 3D, require a real 3D scene with perspective, depth, 3D geometry,
  lighting, materials, and spatial collision. Preserve that dimensionality in
  the implementation and never silently flatten the experience.
- Require reference research before implementation. Search for real gameplay
  screenshots or footage of the named game and collect several high-signal
  references for the camera, arena, player objects, effects, HUD, and menus.
  Record source URLs and the selected visual anchors in the live progress page.
- Require an iterative fidelity loop: a builder produces the piece, a
  fresh-context critic inspects the running output, compares it with the
  references, identifies the largest mismatch, and sends it back for another
  improvement. Continue until the result closely resembles the references or
  the run is stopped; do not use a fixed round count.
- State only observable controls, game loop, feedback, restart behavior, and
  fidelity requirements. Let the lead choose the implementation and divide
  the work into independently judgeable pieces.
- If text appears before or after the skill invocation, merge it and rewrite
  it in your own words. If the invocation begins the request, preserve the
  request after removing only invocation syntax and routing labels. Keep the
  final prompt concise while retaining the full fidelity and review contract.

Do not execute the full Gauntlet Loop during issue-e2e kickoff. The prompt
should instruct the worker to do that work after the issue starts.


Check `git branch --show-current`. If non-empty and not `main`, verify it and
append ` branch: <current-branch>` to the title. The reusable workflow checks
out `github.ref_name` and bases its OpenCode branch on it, preserving the
debugging worktree. This suffix is routing metadata, not prompt text. On `main`,
omit it.

If the request contains `#main`, use the supplied or current repository on its
`main` branch; remove `#main` from the prompt and do not default to
`AgentsLoop/PlayGround`. Otherwise, use the supplied repository or
`AgentsLoop/PlayGround` when the selected branch is `main`.

if other local skills mentioned verify they exist on https://github.com/agents-dev/skills/ or push them first

## Procedure

1. Check `git status --short` and the current branch; preserve unrelated work.
2. Treat request tags like `#mac` as GitHub labels: strip `#`, create missing
   labels, and attach them with `OpenCode` and `Goal`. Do not create a label for
   `#main`. Verify labels with `gh issue view <number> --json labels`. Comments,
   edits, and other labels are not triggers.
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

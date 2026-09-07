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
Treat that reference as the canonical prompt-writing and issue-formatting
guide. Keep its detailed rules there; do not duplicate or summarize them in
this file.

Preserve the request and remove only invocation syntax and routing metadata.
If request text surrounds the invocation, merge it before applying the
canonical guide.

Do not execute the full Gauntlet Loop during issue-e2e kickoff. The prompt
should instruct the worker to perform the sustained project work after the
issue starts.


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

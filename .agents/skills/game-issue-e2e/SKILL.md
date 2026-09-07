---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only for an explicitly requested issue-triggered E2E run. Create the issue
and Action, then stop at the initial Web UI link; do not claim completion.

## Prompt and branch

Locate `Issue e2e` (or this skill's invocation):

- If the skill invocation begins the request, preserve the following request
  directly, with only necessary cleanup such as removing this invocation.
- If request text appears before the invocation, or the invocation is in the
  middle, combine the text on both sides, reason about the desired result, and
  rewrite a concise prompt in your own words; do not copy it verbatim. Read
  `references/gauntlet-prompt-rubric.md` and apply its prompt-quality criteria.
  The resulting issue prompt must remain short while carrying the full loop
  contract from that rubric.
  This reuses the rubric only; do not execute the full Gauntlet Loop during
  issue-e2e kickoff.


Check `git branch --show-current`. If non-empty and not `main`, verify it and
append ` branch: <current-branch>` to the title. The reusable workflow checks
out `github.ref_name` and bases its OpenCode branch on it, preserving the
debugging worktree. This suffix is routing metadata, not prompt text. On `main`,
omit it.

Use the supplied repository or `AgentsLoop/PlayGround` if on main branch

if other local skills mentioned verify they exist on https://github.com/agents-dev/skills/ or push them first

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

---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use only for an explicitly requested issue-triggered E2E run. Create the issue
and Action, then stop at the initial Web UI link; do not claim completion.

## Prompt and branch

Locate `Issue e2e` (or this skill's invocation):

- Beginning: preserve the following request directly, with only necessary
  cleanup such as removing this invocation.
- Middle/end: combine the text on both sides, reason about the desired result,
  and rewrite a concise prompt in your own words.

When the request explicitly names another skill, the issue prompt must preserve
a direct instruction to use that skill at its exact supplied path and must
include its exact Markdown link. In particular, every request naming
`$gauntlet-loop` must include this required link verbatim:
`[$gauntlet-loop](/Users/igor/.codex/skills/gauntlet-loop/SKILL.md)`. Do not
paraphrase the named skill's instructions or replace the required link with a
description. Remove only this skill's invocation, name/path, and link from the
issue prompt. With no request, invent a small playable browser-game brief.

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

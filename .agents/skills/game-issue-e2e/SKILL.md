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

If the invocation has no request text, invent a fresh random small playable
browser-game brief. Do not substitute a generic workflow-validation task or
ask the user for a game concept.

Repeat the exact issue title as the first Markdown heading in the issue body.
Keep the title as issue metadata too; the body must not omit or paraphrase it.

Write the issue body to a temporary Markdown file and pass it with
`gh issue create --body-file <path>` or `gh issue edit --body-file <path>`.
Do not interpolate Markdown containing backticks, `$`, `$(...)`, or backslashes
inside a shell double-quoted argument. Verify the saved body with
`gh issue view <number> --json title,body,labels` before checking the run.

Do not execute the full Gauntlet Loop during issue-e2e kickoff. The prompt
should instruct the worker to perform the sustained project work after the
issue starts.


Check `git branch --show-current`. If non-empty and not `main`, verify it and
append ` branch: <current-branch>` to the title. The reusable workflow checks
out the validated `target_sha` and uses `target_ref` as its result base, preserving the
debugging worktree. This suffix is routing metadata, not prompt text. On `main`,
omit it.

Resolve the target repository before creating the issue. An explicitly supplied
repository wins. With `#main`, use the supplied or current repository on
`main`; otherwise, on `main` without a supplied repository, use
`AgentsLoop/PlayGround` explicitly. On another branch, use the current
repository. Never infer the default `main` repository from `git remote`.

if other local skills mentioned verify they exist on https://github.com/agents-dev/skills/ or push them first

## Procedure

1. Check `git status --short` and the current branch; preserve unrelated work.
   Resolve `<target-repo>` and `<target-branch>` before any issue or workflow
   command. Verify the default `main` target is `AgentsLoop/PlayGround`.
2. Treat request tags like `#mac` as GitHub labels: strip `#`, create missing
   labels, and create the issue with `Goal` and all mode labels. Verify the
   default-branch listener exists, then add `OpenCode` separately. Do not create a label for
   `#self`. Verify labels with `gh issue view <number> --json labels`. Comments,
   edits, and other labels are not triggers.
3. Confirm the newest run is matching `issues`, title, resolved
   `<target-repo>`, and the repository default branch:

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 \
     --json databaseId,displayTitle,event,status,url,headBranch
   ```

   Check preparation outputs for `<target-branch>` and the frozen checkout SHA.
4. Poll only until the initial Web UI URL appears; return issue, run, and session
   links immediately. Also extract the SSH command from the temporary access
   comment and return it with the links. Do not `gh run watch` to completion or
   cancel/rerun an active run without checking its current step.

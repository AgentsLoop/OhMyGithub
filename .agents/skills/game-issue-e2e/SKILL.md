---
name: issue-e2e
description: Start the issue-triggered workflow and return its initial OpenCode session link.
---

# Issue E2E kickoff

Use this only when the user explicitly asks for an issue-triggered E2E run. It
creates a real GitHub issue and Action, then stops at the first OpenCode Web UI
session link. Do not claim that implementation, tests, PR, or deployment are
complete.

## Prompt

Find the invocation in the user's message:

- If `Issue e2e` is at the beginning, preserve the following request directly.
  Only make necessary cleanup, such as removing the invocation itself.
- If it is in the middle or at the end, use request text on both sides as
  context, reason about the desired result, and rewrite a concise prompt in
  your own words.
- In every case, remove the skill name, local skill path, and invocation link
  from the issue prompt. If there is no request text, invent a small playable
  browser-game brief.

## Target and labels

Use the supplied repository, or `AgentsLoop/PlayGround` by default. Verify
`gh auth status`, admin access with `gh repo view`, and that
`.github/workflows/opencode.yml` exists. If the workflow is missing, create the
issue but report that no run or session could start.

Before creating the issue, run `gh label list`. Always apply `OpenCode` and
`Goal`. Apply matching labels only when they exist:

- `skill/image-search` for image discovery.
- `skill/load-sketchfab-threejs` for 3D, GLB, Three.js, or PlayCanvas work.
- `skill/gauntlet-loop` for Gauntlet Loop work.
- `linux` only for an explicitly Linux request.
- The requested model label when one is specified.

For 3D requests, verify the workflow defaults to `macos-latest`; for Linux
requests, verify `linux` routes to `ubuntu-latest`. Create missing `Goal` or
`linux` labels using the repository's documented commands.

## Procedure

1. Check `git status --short` and leave unrelated changes untouched.
2. Create a fresh issue with the derived prompt and required labels. Do not
   add a comment as a trigger. Verify labels with `gh issue view <number>`.
3. Find the newest run:

   ```sh
   gh run list --repo <owner>/<repo> --workflow opencode.yml --limit 5 \
     --json databaseId,displayTitle,event,status,url,headBranch
   ```

   Require `workflow_dispatch`, the new issue title, and the correct branch.
4. Poll issue comments or the run only until the initial OpenCode Web UI URL
   appears. Return clickable links for the issue, run, and session immediately.

Never cancel or rerun an active run without checking its current step first.
